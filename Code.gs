/**
 * Jalankan fungsi ini SATU KALI dari Apps Script Editor untuk mengizinkan (otorisasi) akses Google Drive.
 */
function authorizeDrive() {
  const file = DriveApp.createFile("auth_test.txt", "testing write permission");
  file.setTrashed(true);
  Logger.log("Berhasil membuat dan menghapus file! Izin tulis Drive aktif 100%.");
}

// ID Spreadsheet Anda dari Google Sheets URL
const SPREADSHEET_ID = "1NVnYLfFanw3m-CvHhzP8CMjX2-81oA2wV4TGnb7W3xs";

// Objek untuk memetakan nama sheet agar mudah dikelola
const SHEETS = {
  Users: "Users",
  Log: "LogAktivitas",
};

// Fungsi Bantu untuk Aset Dinamis
function getAssetSheetNames() {
  const cache = CacheService.getScriptCache();
  const cachedNames = cache.get("ASSET_SHEET_NAMES");
  if (cachedNames) return JSON.parse(cachedNames);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const names = ss.getSheets()
    .map(s => s.getName())
    .filter(name => name !== SHEETS.Users && name !== SHEETS.Log);
  
  cache.put("ASSET_SHEET_NAMES", JSON.stringify(names), 3600); // 1 jam
  return names;
}

/**
 * Fungsi RINGAN untuk mengambil daftar menu saja (tanpa data berat)
 * Dipakai saat inisialisasi awal agar dropdown cepat muncul
 */
function normalizeStatusFieldConfig(fields) {
  if (!fields) return [{
    name: 'Status',
    type: 'dropdown',
    options: 'DIPAKAI, TERSEDIA, RUSAK',
    showInChart: true
  }];
  if (!Array.isArray(fields)) return fields;
  
  let hasStatus = false;
  const normalized = fields.map(f => {
    if (f && f.name && f.name.toLowerCase() === 'status') {
      hasStatus = true;
      return {
        ...f,
        type: 'dropdown',
        options: (f.options && String(f.options).trim()) ? f.options : 'DIPAKAI, TERSEDIA, RUSAK'
      };
    }
    return f;
  });

  if (!hasStatus) {
    normalized.push({
      name: 'Status',
      type: 'dropdown',
      options: 'DIPAKAI, TERSEDIA, RUSAK',
      showInChart: true
    });
  }

  return normalized;
}

function getAssetTypeMenuData() {
  try {
    const assetSheets = getAssetSheetNames();
    const props = PropertiesService.getScriptProperties().getProperties();
    const menuData = {};

    for (const sheetName of assetSheets) {
        const cleanName = String(sheetName).trim();
        const configStr = props['ASSET_CONFIG_' + cleanName];
        let dashboardDesign = 'standard';
        let fields = [];
        let columnWidths = {};

        if (configStr) {
            const parsed = JSON.parse(configStr);
            if (Array.isArray(parsed)) {
                fields = parsed;
                dashboardDesign = 'standard';
            } else {
                fields = parsed.fields || [];
                dashboardDesign = parsed.dashboardDesign || 'standard';
                columnWidths = parsed.columnWidths || {};
            }
        }

        fields = normalizeStatusFieldConfig(fields);

        menuData[sheetName] = { 
            name: sheetName,
            dashboardDesign: dashboardDesign,
            fields: fields,
            fieldCount: fields.length,
            columnWidths: columnWidths
        };
    }
    return menuData;
  } catch (e) {
    return { error: e.message };
  }
}

function isAssetSheet(sheetName) {
  if (!sheetName) return false;
  const target = sheetName.toLowerCase();
  return getAssetSheetNames().some(n => n.toLowerCase() === target);
}

function getActualSheetName(sheetName) {
  if (!sheetName) return null;
  const target = sheetName.toLowerCase();
  return getAssetSheetNames().find(n => n.toLowerCase() === target) || sheetName;
}

// Durasi sesi dalam detik (misal: 6 jam)
const SESSION_DURATION = 6 * 60 * 60;

/**
 * =================================================================
 * FUNGSI PENCATATAN AKTIVITAS (LOGGING)
 * =================================================================
 */

/**
 * Mencatat aktivitas ke sheet LogAktivitas.
 * @param {string} assetId ID aset yang terpengaruh.
 * @param {string} assetType Tipe aset.
 * @param {string} action Aksi yang dilakukan (e.g., CREATE, UPDATE, DELETE).
 * @param {object} user Objek pengguna yang melakukan aksi.
 * @param {string} details Detail perubahan.
 */
function logActivity(assetId, assetType, action, user, details) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let logSheet = ss.getSheetByName(SHEETS.Log);

    if (!logSheet) {
      logSheet = ss.insertSheet(SHEETS.Log);
      logSheet.appendRow([
        "Timestamp",
        "Username",
        "Aksi",
        "Tipe Aset",
        "ID Aset",
        "Detail",
      ]);
    }

    const timestamp = new Date();
    // Penanganan user yang lebih robust (bisa objek atau string)
    let username = "SYSTEM";
    if (user) {
      if (typeof user === 'object' && user.username) {
        username = user.username;
      } else if (typeof user === 'string') {
        username = user;
      }
    }

    logSheet.appendRow([
      timestamp,
      username,
      action,
      assetType,
      assetId,
      details,
    ]);

    // Memaksa penulisan ke spreadsheet segera
    SpreadsheetApp.flush();
  } catch (e) {
    Logger.log(`Gagal mencatat aktivitas: ${e.message}`);
  }
}

/**
 * Mengambil riwayat aktivitas untuk sebuah aset tertentu.
 * @param {string} assetId ID aset yang akan dicari riwayatnya.
 * @returns {object[]} Array berisi objek log.
 */
function getAssetHistory(assetId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = ss.getSheetByName(SHEETS.Log);
    if (!logSheet) {
      return [];
    }

    const data = logSheet.getDataRange().getValues();
    const headers = data.shift();
    const headersLower = headers.map(h => String(h).toLowerCase().trim());
    
    // Find column indexes robustly
    const tsIdx = headersLower.indexOf("timestamp");
    const userIdx = headersLower.indexOf("username");
    const actionIdx = headersLower.indexOf("aksi");
    const assetIdIdx = headersLower.indexOf("id aset") === -1 ? headersLower.indexOf("id") : headersLower.indexOf("id aset");
    const detailIdx = headersLower.indexOf("detail");

    if (assetIdIdx === -1) {
      return [];
    }

    const history = [];
    data.forEach((row) => {
      // Compare as strings to avoid type issues
      if (String(row[assetIdIdx]) === String(assetId)) {
        let ts = row[tsIdx];
        if (ts instanceof Date) {
          ts = Utilities.formatDate(ts, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        }

        history.push({
          timestamp: ts || "-",
          user: (userIdx !== -1 ? row[userIdx] : "-") || "N/A",
          action: (actionIdx !== -1 ? row[actionIdx] : "-") || "Aktivitas",
          details: (detailIdx !== -1 ? row[detailIdx] : "-") || "Tanpa detail"
        });
      }
    });

    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (e) {
    Logger.log(`Error in getAssetHistory: ${e.message}`);
    return [];
  }
}

/**
 * Mengambil semua riwayat aktivitas untuk sebuah tipe aset tertentu.
 * @param {string} assetType Tipe aset yang akan dicari riwayatnya.
 * @returns {object[]} Array berisi objek log.
 */
function getLogsForAssetType(assetType) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = ss.getSheetByName(SHEETS.Log);
    if (!logSheet) {
      return [];
    }

    const data = logSheet.getDataRange().getValues();
    const headers = data.shift();
    const assetTypeColIndex = headers.indexOf("Tipe Aset");

    if (assetTypeColIndex === -1) {
      return [];
    }

    const history = [];
    data.forEach((row) => {
      if (row[assetTypeColIndex] === assetType) {
        let logEntry = {};
        headers.forEach((header, index) => {
          let value = row[index];
          if (header === "Timestamp" && value instanceof Date) {
            logEntry[header] = Utilities.formatDate(
              value,
              Session.getScriptTimeZone(),
              "yyyy-MM-dd HH:mm:ss"
            );
          } else {
            logEntry[header] = value;
          }
        });
        history.push(logEntry);
      }
    });

    return history.sort(
      (a, b) => new Date(b.Timestamp) - new Date(a.Timestamp)
    );
  } catch (e) {
    Logger.log(`Error in getLogsForAssetType: ${e.message}`);
    return [];
  }
}

/**
 * =================================================================
 * FUNGSI BANTU (HELPER)
 * =================================================================
 */

/**
 * Membuat ID sekuensial baru (e.g., Laptop-1, Tablet-2).
 * @param {Sheet} sheet Objek sheet dari SpreadsheetApp.
 * @returns {string} ID baru.
 */
function generateNewId(sheet) {
  const sheetName = sheet.getName();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    // Hanya ada baris header
    return `${sheetName}-1`;
  } else {
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    const idColumnIndex = headers.indexOf("ID");

    if (idColumnIndex === -1) {
      Logger.log(
        `Kolom 'ID' tidak ditemukan di sheet ${sheetName}. Menggunakan UUID sebagai fallback.`
      );
      return Utilities.getUuid(); // Fallback ke UUID jika kolom ID tidak ada
    }

    const idColumn = idColumnIndex + 1;
    const idRange = sheet.getRange(2, idColumn, lastRow - 1, 1);
    const ids = idRange.getValues().flat();

    let maxNumber = 0;
    ids.forEach((id) => {
      if (id && typeof id === "string" && id.startsWith(sheetName + "-")) {
        const parts = id.split("-");
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    });

    const newNumber = maxNumber + 1;
    return `${sheetName}-${newNumber}`;
  }
}

/**
 * =================================================================
 * FUNGSI INTI & ROUTING APLIKASI WEB
 * =================================================================
 */

/**
 * Mengambil data gambar background dari Google Drive dan menyajikannya sebagai Data URL.
 * Menjamin background 100% muncul di semua perangkat, browser, dan pengguna lain
 * tanpa terhalang izin akun Google Drive atau pembatasan third-party cookies.
 */
function getBackgroundImageUrl() {
  try {
    const props = PropertiesService.getScriptProperties();
    const fileId = props.getProperty('UI_BG_IMAGE_ID');
    if (!fileId) return '';
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch(e) {
    Logger.log('getBackgroundImageUrl error: ' + e.message);
    return PropertiesService.getScriptProperties().getProperty('UI_BG_IMAGE_URL') || '';
  }
}

function doGet(e) {
  const props = PropertiesService.getScriptProperties();
  const appName = props.getProperty('UI_APP_NAME') || 'Inventaris';
  const primaryColor = props.getProperty('UI_PRIMARY_COLOR') || '#4f46e5';
  const bgImageUrl = getBackgroundImageUrl();

  if (e.parameter.page === "detail" && e.parameter.id) {
    const template = HtmlService.createTemplateFromFile("Detail");
    template.assetId = e.parameter.id;
    template.appName = appName;
    template.primaryColor = primaryColor;
    template.bgImageUrl = bgImageUrl;
    return template
      .evaluate()
      .setTitle("Detail Aset - " + appName)
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
  } else {
    const template = HtmlService.createTemplateFromFile("Index");
    template.appName = appName;
    template.primaryColor = primaryColor;
    template.bgImageUrl = bgImageUrl;
    return template
      .evaluate()
      .setTitle("Aplikasi " + appName)
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0");
  }
}

/**
 * Fungsi untuk menyertakan konten file lain (CSS/JS) ke dalam HTML utama.
 * @param {string} filename Nama file yang berisi CSS atau JS.
 * @returns {string} Konten dari file yang diminta.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * =================================================================
 * FUNGSI YANG DIPANGGIL DARI CLIENT-SIDE (FRONTEND)
 * =================================================================
 */

function getHeadersFor(assetType) {
  try {
    const actualName = getActualSheetName(assetType);
    if (!isAssetSheet(actualName)) {
      throw new Error("Jenis aset tidak valid.");
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(actualName);
    if (!sheet) {
      return [];
    }
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    return headers;
  } catch (e) {
    Logger.log(`Error in getHeadersFor(${assetType}): ${e.message}`);
    return [];
  }
}

function getDataFor(assetType) {
  try {
    const actualName = getActualSheetName(assetType);
    if (!isAssetSheet(actualName)) {
      throw new Error("Jenis aset tidak valid.");
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(actualName);
    if (!sheet) {
      return { [assetType]: { headers: [], rows: [], config: null } };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data.shift() || [];

    const formattedRows = data.map(row => row.map(cell => {
       if (cell instanceof Date) {
         return Utilities.formatDate(
           cell,
           Session.getScriptTimeZone(),
           "yyyy-MM-dd HH:mm:ss"
         );
       }
       return cell;
    }));

    const props = PropertiesService.getScriptProperties().getProperties();
    const cleanName = String(actualName).trim();
    const configStr = props['ASSET_CONFIG_' + cleanName];
    let fieldConfig = null;
    let dashboardDesign = 'standard';
    let columnWidths = {};
    
    if (configStr) {
        const parsed = JSON.parse(configStr);
        if (Array.isArray(parsed)) {
            fieldConfig = parsed;
        } else {
            fieldConfig = parsed.fields || null;
            dashboardDesign = parsed.dashboardDesign || 'standard';
            columnWidths = parsed.columnWidths || {};
        }
    }

    fieldConfig = normalizeStatusFieldConfig(fieldConfig);

    return { 
      [assetType]: {
        headers: headers,
        rows: formattedRows,
        config: fieldConfig,
        dashboardDesign: dashboardDesign,
        columnWidths: columnWidths
      }
    };
  } catch (e) {
    Logger.log(`Error in getDataFor(${assetType}): ${e.message}`);
    return { error: e.message };
  }
}

function getAssetDetailsById(id) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const assetSheets = getAssetSheetNames();
    for (const sheetName of assetSheets) {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) continue;
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        const idColumnIndex = headers.indexOf("ID");

        if (idColumnIndex !== -1) {
          for (let i = 1; i < data.length; i++) {
            if (data[i][idColumnIndex] === id) {
              const assetData = {};
              headers.forEach((header, index) => {
                let value = data[i][index];
                if (value instanceof Date) {
                  value = Utilities.formatDate(
                    value,
                    Session.getScriptTimeZone(),
                    "yyyy-MM-dd HH:mm:ss"
                  );
                }
                assetData[header] = value;
              });
              return { assetType: sheetName, details: assetData };
            }
          }
        }
    }
    return null;
  } catch (e) {
    Logger.log("Error in getAssetDetailsById: " + e.message);
    return null;
  }
}

const CACHE_KEY_ALL_DATA = "ALL_DATA_CACHE";
const CACHE_EXPIRATION = 21600; // 6 hours

function getAllData() {
  try {
    const cache = CacheService.getScriptCache();
    const cachedData = cache.get(CACHE_KEY_ALL_DATA);
    let allData = null;

    if (cachedData) {
      allData = JSON.parse(cachedData);
    } else {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      allData = {};
      const assetSheets = getAssetSheetNames();

      for (const sheetName of assetSheets) {
          const sheet = ss.getSheetByName(sheetName);
          if (!sheet) continue;
          const data = sheet.getDataRange().getValues();
          const headers = data.shift();
          if (!headers) continue;

          // Optimized: Return Headers + Rows (Matrix) instead of Array of Objects
          const formattedRows = data.map(row => row.map(cell => {
             if (cell instanceof Date) {
               return Utilities.formatDate(
                 cell,
                 Session.getScriptTimeZone(),
                 "yyyy-MM-dd HH:mm:ss"
               );
             }
             return cell;
          }));

          allData[sheetName] = { 
              headers: headers, 
              rows: formattedRows 
          };
      }
      
      try {
        cache.put(CACHE_KEY_ALL_DATA, JSON.stringify(allData), CACHE_EXPIRATION);
      } catch (e) {
        console.log("Cache put failed: " + e.message);
      }
    }

    // ALWAYS fetch latest config from PropertiesService!
    const props = PropertiesService.getScriptProperties().getProperties();
    for (const sheetName in allData) {
        const cleanName = String(sheetName).trim();
        const configStr = props['ASSET_CONFIG_' + cleanName];
        let fieldConfig = null;
        let dashboardDesign = 'standard';
        let columnWidths = {};
        
        if (configStr) {
            const parsed = JSON.parse(configStr);
            if (Array.isArray(parsed)) {
                fieldConfig = parsed;
            } else {
                fieldConfig = parsed.fields || null;
                dashboardDesign = parsed.dashboardDesign || 'standard';
                columnWidths = parsed.columnWidths || {};
            }
        }
        allData[sheetName].config = normalizeStatusFieldConfig(fieldConfig);
        allData[sheetName].dashboardDesign = dashboardDesign;
        allData[sheetName].columnWidths = columnWidths;
    }

    return allData;
  } catch (e) {
    return { error: e.message };
  }
}

function saveData(dataObject, user) {
  try {
    const sheetName = dataObject.assetType;
    if (!sheetName || !isAssetSheet(sheetName)) {
      throw new Error("Jenis aset tidak valid atau tidak dipilih.");
    }
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      throw new Error("Sheet '" + sheetName + "' kosong dan tidak memiliki header.");
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    const assetId = generateNewId(sheet);

    const newRow = headers.map((header) => {
      if (header === "ID") return assetId;
      if (header === "Diubah Oleh" && user) return user.username;

      // Handle Otomatis Tanggal untuk Semua Jenis Aset
      if (header === "Tgl Peminjaman") {
        const s = String(dataObject.status || "").toLowerCase();
        if (s.includes("pinjam") || s.includes("pakai")) return new Date();
      }
      if (header === "Tgl Pengembalian") {
        const s = String(dataObject.status || "").toLowerCase();
        if (s.includes("kembali") || s.includes("tersedia") || s.includes("pfa")) return new Date();
      }

      const normalizedHeader = String(header).replace(/\s/g, "").toLowerCase();
      const formKey = Object.keys(dataObject).find(
        (key) => key.toLowerCase() === normalizedHeader
      );

      return formKey ? dataObject[formKey] : "";
    });

    sheet.appendRow(newRow);

    // Ambil nama aset dengan fallback key yang lebih fleksibel (nama, name, merek, model, etc)
    const normalizedKeys = Object.keys(dataObject).reduce((acc, k) => {
      acc[k.toLowerCase().replace(/\s/g, "")] = dataObject[k];
      return acc;
    }, {});
    
    let assetName = normalizedKeys['nama'] || normalizedKeys['name'] || normalizedKeys['merek'] || normalizedKeys['brand'] || normalizedKeys['model'] || normalizedKeys['hostname'];
    
    // Jika tidak ketemu di key umum, cari kolom data pertama di sheet
    if (!assetName) {
      const skippedHeaders = ["ID", "Tgl Peminjaman", "Tgl Pengembalian", "Status", "Diubah Oleh", "Timestamp"];
      const representativeHeader = headers.find(h => !skippedHeaders.includes(h));
      if (representativeHeader) {
        const formKey = Object.keys(dataObject).find(k => k.toLowerCase() === String(representativeHeader).toLowerCase().replace(/\s/g, ""));
        if (formKey) assetName = dataObject[formKey];
      }
    }

    if (!assetName) assetName = "N/A";

    const details = `Aset baru "${assetName}" ditambahkan - "Dashboard ${sheetName}"`;
    logActivity(assetId, sheetName, "CREATE", user, details);

    // Invalidate Cache
    CacheService.getScriptCache().remove(CACHE_KEY_ALL_DATA);

    return { status: "success", message: "Data berhasil disimpan!" };
  } catch (e) {
    Logger.log("Error in saveData: " + e.message);
    return { status: "error", message: e.message };
  }
}

function deleteData(assetType, id, user) {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(assetType);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColumnIndex = headers.indexOf("ID");
    if (idColumnIndex === -1) throw new Error("Kolom ID tidak ditemukan.");

    let rowDeleted = false;
    for (let i = data.length - 1; i > 0; i--) {
      if (data[i][idColumnIndex] === id) {
        const nameIndex = headers.indexOf("Nama");
        const assetName = nameIndex !== -1 ? data[i][nameIndex] : `ID: ${id}`;
        const details = `Aset "${assetName}" telah dihapus - "Dashboard ${assetType}"`;

        sheet.deleteRow(i + 1);
        rowDeleted = true;

        logActivity(id, assetType, "DELETE", user, details);
        break; // Stop searching once deleted
      }
    }

    if (!rowDeleted) {
      return { status: "error", message: "Data tidak ditemukan." };
    }

    // Invalidate Cache
    CacheService.getScriptCache().remove(CACHE_KEY_ALL_DATA);

    // After deletion, get the fresh data to send back to the client
    const freshData = getDataFor(assetType);

    if (freshData.error) {
      // If fetching new data fails, still report success for the deletion
      return {
        status: "success",
        message:
          "Data berhasil dihapus, tetapi gagal memuat ulang data terbaru.",
        data: null,
      };
    }

    // Return success message along with the fresh data
    return {
      status: "success",
      message: "Data berhasil dihapus.",
      data: freshData,
    };
  } catch (e) {
    return { status: "error", message: e.message };
  }
}

function updateData(assetType, id, updatedData, user) {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(assetType);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColumnIndex = headers.indexOf("ID");
    if (idColumnIndex === -1) throw new Error("Kolom ID tidak ditemukan.");

    let rowIndexToUpdate = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumnIndex] === id) {
        rowIndexToUpdate = i;
        break;
      }
    }

    if (rowIndexToUpdate === -1) {
      throw new Error("Data dengan ID tersebut tidak ditemukan.");
    }

    const oldRowData = {};
    headers.forEach((header, index) => {
      let value = data[rowIndexToUpdate][index];
      if (value instanceof Date) {
        value = Utilities.formatDate(
          value,
          Session.getScriptTimeZone(),
          "yyyy-MM-dd HH:mm:ss"
        );
      }
      oldRowData[header] = value;
    });

    const newRow = headers.map((header, index) => {
      const normalizedHeader = String(header).replace(/\s/g, "").toLowerCase();
      const formKey = Object.keys(updatedData).find(
        (k) => k.toLowerCase() === normalizedHeader
      );
      return formKey !== undefined
        ? updatedData[formKey]
        : data[rowIndexToUpdate][index];
    });

    const statusIndex = headers.indexOf("Status");
    const loanDateIndex = headers.indexOf("Tgl Peminjaman");
    const returnDateIndex = headers.indexOf("Tgl Pengembalian");

    if (statusIndex !== -1) {
      const oldStatus = String(data[rowIndexToUpdate][statusIndex]).toLowerCase();
      const newStatus = String(updatedData["status"] || "").toLowerCase();

      // Transisi ke Dipakai/Dipinjam (Set Tgl Peminjaman & Kosongkan Tgl Pengembalian)
      if (!oldStatus.includes("pinjam") && !oldStatus.includes("pakai") && 
          (newStatus.includes("pinjam") || newStatus.includes("pakai"))) {
        if (loanDateIndex !== -1) {
          newRow[loanDateIndex] = new Date();
        }
        if (returnDateIndex !== -1) {
          newRow[returnDateIndex] = ""; // Otomatis kosongkan Tgl Pengembalian
        }
      }

      // Transisi ke Tersedia/Dikembalikan (Set Tgl Pengembalian)
      // Transisi ke DIKEMBALIKAN KE PFA (Realtime catat Tgl Pengembalian)
      if (newStatus.includes("pfa")) {
        if (returnDateIndex !== -1) {
          newRow[returnDateIndex] = new Date();
        }
      } else if (!oldStatus.includes("kembali") && !oldStatus.includes("tersedia") &&
          (newStatus.includes("kembali") || newStatus.includes("tersedia"))) {
        if (returnDateIndex !== -1) {
          newRow[returnDateIndex] = new Date();
        }
      }
    }

    const diubahOlehIndex = headers.indexOf("Diubah Oleh");
    if (diubahOlehIndex !== -1 && user) {
      newRow[diubahOlehIndex] = user.username;
    }

    const changes = [];
    headers.forEach((header) => {
      const normalizedHeader = String(header).replace(/\s/g, "").toLowerCase();
      const formKey = Object.keys(updatedData).find(
        (k) => k.toLowerCase() === normalizedHeader
      );
      if (
        formKey &&
        String(oldRowData[header]) !== String(updatedData[formKey])
      ) {
        changes.push(
          `'${header}' diubah dari "${oldRowData[header] || ""}" menjadi "${updatedData[formKey] || ""
          }"`
        );
      }
    });

    if (changes.length > 0) {
      const details = changes.join("; ") + ` - "Dashboard ${assetType}"`;
      logActivity(id, assetType, "UPDATE", user, details);
    }

    sheet
      .getRange(rowIndexToUpdate + 1, 1, 1, newRow.length)
      .setValues([newRow]);

    // Invalidate cache
    CacheService.getScriptCache().remove(CACHE_KEY_ALL_DATA);

    return { status: "success", message: "Data berhasil diperbarui." };
  } catch (e) {
    Logger.log("Error in updateData: " + e.message);
    return { status: "error", message: e.message };
  }
}

function updateLoanDate(assetType, id, newLoanDateString, newReturnDateString, user) {
  try {
    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(assetType);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColumnIndex = headers.indexOf("ID");
    const loanDateColumnIndex = headers.indexOf("Tgl Peminjaman");
    const returnDateColumnIndex = headers.indexOf("Tgl Pengembalian");

    if (idColumnIndex === -1) throw new Error("Kolom ID tidak ditemukan.");

    let rowIndexToUpdate = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][idColumnIndex] === id) {
        rowIndexToUpdate = i + 1;
        break;
      }
    }

    if (rowIndexToUpdate === -1) {
      throw new Error("Data dengan ID tersebut tidak ditemukan.");
    }

    const changes = [];

    // Update Tgl Peminjaman
    if (loanDateColumnIndex !== -1 && newLoanDateString !== undefined) {
      const oldDate = sheet.getRange(rowIndexToUpdate, loanDateColumnIndex + 1).getValue();
      const oldDateString = oldDate instanceof Date ? Utilities.formatDate(oldDate, Session.getScriptTimeZone(), "yyyy-MM-dd") : oldDate;
      const newDate = newLoanDateString ? new Date(newLoanDateString) : "";
      
      sheet.getRange(rowIndexToUpdate, loanDateColumnIndex + 1).setValue(newDate);
      if (String(oldDateString) !== String(newLoanDateString)) {
        changes.push(`'Tgl Peminjaman' diubah dari "${oldDateString}" menjadi "${newLoanDateString}"`);
      }
    }

    // Update Tgl Pengembalian
    if (returnDateColumnIndex !== -1 && newReturnDateString !== undefined) {
      const oldDate = sheet.getRange(rowIndexToUpdate, returnDateColumnIndex + 1).getValue();
      const oldDateString = oldDate instanceof Date ? Utilities.formatDate(oldDate, Session.getScriptTimeZone(), "yyyy-MM-dd") : oldDate;
      const newDate = newReturnDateString ? new Date(newReturnDateString) : "";
      
      sheet.getRange(rowIndexToUpdate, returnDateColumnIndex + 1).setValue(newDate);
      if (String(oldDateString) !== String(newReturnDateString)) {
        changes.push(`'Tgl Pengembalian' diubah dari "${oldDateString}" menjadi "${newReturnDateString}"`);
      }
    }

    if (changes.length > 0) {
      const details = changes.join("; ") + ` - "Dashboard ${assetType}"`;
      logActivity(id, assetType, "UPDATE_DATE", user, details);
      
      // Update "Diubah Oleh" if exists
      const diubahOlehIndex = headers.indexOf("Diubah Oleh");
      if (diubahOlehIndex !== -1 && user) {
        sheet.getRange(rowIndexToUpdate, diubahOlehIndex + 1).setValue(user.username);
      }
      
      // Invalidate cache
      CacheService.getScriptCache().remove(CACHE_KEY_ALL_DATA);
    }

    return {
      status: "success",
      message: "Tanggal berhasil diperbarui.",
    };
  } catch (e) {
    Logger.log("Error in updateLoanDate: " + e.message);
    return { status: "error", message: e.message };
  }
}

function getWebAppUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * =================================================================
 * FUNGSI AUTENTIKASI & MANAJEMEN PENGGUNA
 * =================================================================
 */// --- AUTHENTICATION ---
function login(credentials, clientInfo) {
  const usersSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(
    SHEETS.Users
  );

  // Fallback: If clientInfo is missing or only contains default values
  let ipAddress = "IP Tidak Terdeteksi";
  let userAgent = "Browser Tidak Diketahui";
  let platform = "-";
  
  if (clientInfo) {
      if (clientInfo.ip) ipAddress = clientInfo.ip;
      if (clientInfo.userAgent) userAgent = clientInfo.userAgent;
      if (clientInfo.platform) platform = clientInfo.platform;
  }

  const data = usersSheet.getDataRange().getValues();
  const headers = data[0];
  
  // Map Columns Dynamically
  const idx = {
      username: headers.indexOf("Username"),
      salt: headers.indexOf("Salt"),
      hash: headers.indexOf("HashedPassword"),
      name: headers.indexOf("NamaLengkap"),
      role: headers.indexOf("Role")
  };

  // Fallback if headers are missing (Legacy Support)
  if (idx.username === -1) idx.username = 0;
  if (idx.salt === -1) idx.salt = 1;
  if (idx.hash === -1) idx.hash = 2;
  if (idx.name === -1) idx.name = 3;
  // Role might not exist in legacy, default to undefined or check index 4
  if (idx.role === -1) idx.role = 4; 

  const userRow = data.slice(1).find((r) => String(r[idx.username]).trim() === credentials.username.trim());

  if (!userRow) {
    return { success: false, message: "Username tidak ditemukan." };
  }

  const storedHash = userRow[idx.hash];
  const salt = userRow[idx.salt];
  const role = userRow[idx.role] || 'User'; // Default role
  const name = userRow[idx.name];

  if (verifyPassword(credentials.password, salt, storedHash)) {
    // Cek apakah user sudah login (Simple Session Check via Cache)
    const cache = CacheService.getScriptCache();
    const sessionKey = "SESSION_" + credentials.username;
    const existingSession = cache.get(sessionKey);

    if (existingSession) {
      return {
        success: false,
        message: "User anda masih login di browser lain. Silakan logout dari sesi lain atau tunggu sesi berakhir (6 jam).",
      };
    }

    // Generate New Token
    const token = Utilities.getUuid();
    
    // Store Detailed Session Info
    const sessionPayload = {
        token: token,
        ip: ipAddress,
        userAgent: userAgent,
        platform: platform, // Kita anggap platform sebagai "Hostname" terbaik yang bisa didapat
        loginTime: new Date().toISOString(),
        role: role,
        name: name
    };
    
    cache.put(sessionKey, JSON.stringify(sessionPayload), SESSION_DURATION);

    // Bundle allData sekaligus agar client tidak perlu fetch terpisah (hemat 1 round-trip)
    let allDataBundle = null;
    try { allDataBundle = getAllData(); } catch(e) {}
    
    return {
      success: true,
      token: token,
      user: { username: credentials.username, role: role, name: name },
      menuData: getAssetTypeMenuData(), // Sertakan data menu langsung
      allData: allDataBundle            // Bundle data penuh (rows)
    };
  } else {
    return { success: false, message: "Password salah." };
  }
}

function checkAuth(username, token) {
  const cache = CacheService.getScriptCache();
  const sessionKey = "SESSION_" + username;
  const storedSession = cache.get(sessionKey);

  if (storedSession) {
      try {
          // Try parse JSON (New Format)
          const sessionData = JSON.parse(storedSession);
          if (sessionData.token === token) {
             // Bundle allData sekaligus agar client tidak perlu fetch terpisah (hemat 1 round-trip)
             let allDataBundle = null;
             try { allDataBundle = getAllData(); } catch(e) {}
             return { 
               loggedIn: true, 
               user: { username: username, name: sessionData.name || username, role: sessionData.role || 'User' },
               menuData: getAssetTypeMenuData(), // Sertakan data menu langsung
               allData: allDataBundle             // Bundle data penuh (rows)
             }; 
          }
      } catch (e) {
          // Fallback legacy string token
          if (storedSession === token) {
             let allDataBundle = null;
             try { allDataBundle = getAllData(); } catch(e) {}
             return { loggedIn: true, user: { username: username, name: username, role: 'User' }, allData: allDataBundle }; 
          }
      }
  }
  return { loggedIn: false };
}

function logout(username) {
  try {
    const cache = CacheService.getScriptCache();
    const sessionKey = "SESSION_" + username;
    cache.remove(sessionKey);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}


function bytesToHex(bytes) {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    let byte = (bytes[i] + 256) % 256;
    hex += (byte < 16 ? "0" : "") + byte.toString(16);
  }
  return hex;
}

function generatePasswordHash(password) {
  const salt = Utilities.getUuid();
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + salt
  );
  const hash = bytesToHex(digest);
  return { salt: salt, hash: hash };
}

function verifyPassword(password, salt, storedHash) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + salt
  );
  const hash = bytesToHex(digest);
  return hash === storedHash;
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Manajemen Pengguna")
    .addItem("Tambah/Update Password", "addUserOrUpdatePassword")
    .addToUi();
}

function addUserOrUpdatePassword() {
  const ui = SpreadsheetApp.getUi();
  const MASTER_PASSWORD = "MasterAdmin123!";

  const masterPassResponse = ui.prompt(
    "Verifikasi Admin",
    "Masukkan Password Master:",
    ui.ButtonSet.OK_CANCEL
  );
  if (
    masterPassResponse.getSelectedButton() !== ui.Button.OK ||
    masterPassResponse.getResponseText() !== MASTER_PASSWORD
  ) {
    ui.alert("Akses Ditolak", "Password Master salah.", ui.ButtonSet.OK);
    return;
  }

  const usernameResponse = ui.prompt(
    "Update Pengguna",
    "Masukkan Username:",
    ui.ButtonSet.OK_CANCEL
  );
  if (
    usernameResponse.getSelectedButton() !== ui.Button.OK ||
    usernameResponse.getResponseText() === ""
  ) {
    return;
  }
  const username = usernameResponse.getResponseText().trim();

  const passwordResponse = ui.prompt(
    "Update Pengguna",
    `Masukkan password baru untuk user "${username}":`,
    ui.ButtonSet.OK_CANCEL
  );
  if (
    passwordResponse.getSelectedButton() !== ui.Button.OK ||
    passwordResponse.getResponseText() === ""
  ) {
    return;
  }
  const password = passwordResponse.getResponseText();

  try {
    const userSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(
      SHEETS.Users
    );
    const data = userSheet.getDataRange().getValues();
    const headers = data[0];
    const usernameColIndex = headers.indexOf("Username");
    const saltColIndex = headers.indexOf("Salt");
    const hashColIndex = headers.indexOf("HashedPassword");
    const nameColIndex = headers.indexOf("NamaLengkap");

    const hashResult = generatePasswordHash(password);

    let userFound = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][usernameColIndex] === username) {
        userSheet.getRange(i + 1, saltColIndex + 1).setValue(hashResult.salt);
        userSheet.getRange(i + 1, hashColIndex + 1).setValue(hashResult.hash);
        userFound = true;
        break;
      }
    }

    if (!userFound) {
      const nameResponse = ui.prompt(
        "Pengguna Baru",
        `Masukkan Nama Lengkap untuk user "${username}":`,
        ui.ButtonSet.OK_CANCEL
      );
      const fullName =
        nameResponse.getSelectedButton() === ui.Button.OK
          ? nameResponse.getResponseText()
          : username;

      const newRow = [];
      newRow[usernameColIndex] = username;
      newRow[saltColIndex] = hashResult.salt;
      newRow[hashColIndex] = hashResult.hash;
      newRow[nameColIndex] = fullName;
      userSheet.appendRow(newRow);
    }

    SpreadsheetApp.flush();
    ui.alert(
      `Sukses: Password untuk user "${username}" telah berhasil ${userFound ? "diperbarui" : "dibuat"
      }.`
    );
  } catch (e) {
    Logger.log(e);
    ui.alert("Error: Terjadi kesalahan: " + e.message);
  }
}

/**
 * Mengimpor data aset secara batch.
 * @param {string} assetType Tipe aset.
 * @param {object[]} dataItems Array objek data yang akan diimpor.
 * @param {object} user User yang melakukan impor.
 */
/**
 * Mengimpor data aset secara batch (Multi-Sheet).
 * @param {object} batchData Objek berisi array data per tipe aset { "Laptop": [...], "PC": [...] }.
 * @param {object} user User yang melakukan impor.
 */
function importBatchData_OLD(batchData, user) {
  const results = [];
  const errors = [];

  // Konfigurasi kolom unik untuk validasi duplikat
  const UNIQUE_KEYS = {
    'Headset': ['SN Headset'],
    'Laptop': ['Serial Number'],
    'PC': ['Serial Number', 'IP Address'],
    'RAM': ['SN'],
    'Speaker': ['Serial Number'],
    'Tablet': ['Serial Number']
  };

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Iterate over each asset type in the batch
    for (const assetType of Object.keys(batchData)) {
      if (!isAssetSheet(assetType)) {
        errors.push(`${assetType}: Tipe aset tidak valid.`);
        continue;
      }

      const dataItems = batchData[assetType];
      if (!dataItems || dataItems.length === 0) continue;

      const sheet = ss.getSheetByName(assetType);
      if (!sheet) {
        errors.push(`${assetType}: Sheet tidak ditemukan.`);
        continue;
      }

      const lastRow = sheet.getLastRow();
      const range = sheet.getDataRange();
      const values = range.getValues();
      const headers = values[0];
      const idIndex = headers.indexOf('ID');

      // Indexes for Unique Keys
      const uniqueIndexes = {};
      if (UNIQUE_KEYS[assetType]) {
        UNIQUE_KEYS[assetType].forEach(key => {
          const idx = headers.indexOf(key);
          if (idx !== -1) uniqueIndexes[key] = idx;
        });
      }

      // Map Existing IDs & Unique Values
      const existingIds = {};
      const existingUniqueValues = {}; // { 'Serial Number': Set('SN1', 'SN2'), 'IP': Set(...) }

      // Initialize Sets
      Object.keys(uniqueIndexes).forEach(k => existingUniqueValues[k] = new Set());

      if (idIndex !== -1) {
        for (let i = 1; i < values.length; i++) {
          const id = values[i][idIndex];
          if (id) existingIds[String(id)] = i + 1; // Row Index (1-based)

          // Track Unique Keys
          Object.keys(uniqueIndexes).forEach(key => {
            const idx = uniqueIndexes[key];
            const val = values[i][idx];
            if (val) existingUniqueValues[key].add(String(val).toLowerCase().trim());
          });
        }
      }

      const appendRows = [];
      let updatedCount = 0;
      let skippedCount = 0;
      let appendedCount = 0;

      dataItems.forEach(item => {
        let rowId = item['ID'];
        // Normalize ID
        if (rowId === undefined || rowId === null || String(rowId).trim() === '') rowId = null;

        // DUPLICATE CHECK (Only for new items or items without ID, or changing items?)
        // Usually we check duplicates for NEW items. If updating (ID exists), we allow it (unless it changes SN to clash? ignore for now).
        // If ID is NULL, check if SN exists.
        let isDuplicate = false;
        if (!rowId) {
          Object.keys(uniqueIndexes).forEach(key => {
            const val = item[key];
            if (val) {
              const cleanVal = String(val).toLowerCase().trim();
              if (existingUniqueValues[key].has(cleanVal)) {
                isDuplicate = true;
              }
            }
          });
        }

        if (isDuplicate) {
          skippedCount++;
          return; // SKIP this item
        }

        const rowArray = headers.map(header => {
          if (header === 'Diubah Oleh') return user ? user.username : '';
          let val = item[header];
          return (val === undefined || val === null) ? '' : val;
        });

        if (rowId && existingIds[String(rowId)]) {
          // Update
          const rowIndex = existingIds[String(rowId)];
          sheet.getRange(rowIndex, 1, 1, rowArray.length).setValues([rowArray]);
          updatedCount++;
        } else {
          // Append
          appendRows.push(rowArray);
          appendedCount++;

          // Add to unique sets to prevent double insert in same batch
          Object.keys(uniqueIndexes).forEach(key => {
            const val = item[key];
            if (val) existingUniqueValues[key].add(String(val).toLowerCase().trim());
          });
        }
      });

      // Batch Append Logic (with ID Generation)
      if (appendRows.length > 0) {
        if (idIndex !== -1) {
          const allIds = values.slice(1).map(r => r[idIndex]).filter(id => String(id).startsWith(assetType + '-'));
          let maxNum = 0;
          allIds.forEach(id => {
            const parts = String(id).split('-');
            const n = parseInt(parts[parts.length - 1]);
            if (!isNaN(n) && n > maxNum) maxNum = n;
          });

          appendRows.forEach(row => {
            if (!row[idIndex] || String(row[idIndex]).trim() === '' || String(row[idIndex]).toUpperCase().includes('AUTO')) {
              currentMax++;
              row[idIndex] = `${assetType}-${currentMax}`;
            }
          });
        }
        sheet.getRange(sheet.getLastRow() + 1, 1, appendRows.length, headers.length).setValues(appendRows);
      }

      resultSummary.newCount += typeNew;
      resultSummary.updateCount += typeUpd;
      resultSummary.duplicateCount += typeDup;
    }

    if (!dryRun) {
      CacheService.getScriptCache().remove(CACHE_KEY_ALL_DATA);
      logActivity("BATCH", "ALL", "IMPORT", user, `Import: ${resultSummary.newCount} new, ${resultSummary.updateCount} upd.`);
    }

    // Message Construction
    let msg = `Data Baru : ${resultSummary.newCount}\nData Duplikat : ${resultSummary.duplicateCount}\nData Update : ${resultSummary.updateCount}`;
    if (errors.length > 0) msg += '\nErrors: ' + errors.join('; ');

    return { success: true, message: msg, summary: resultSummary };

  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * =================================================================
 * FUNGSI MANAJEMEN ADMIN (Users & UI)
 * =================================================================
 */

// Manajemen Pengguna
function getAdminUsers(authUser) {
  try {
    if (!authUser || authUser.role !== 'Admin') throw new Error("Akses Ditolak: Hanya Admin.");
    
    const usersSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.Users);
    const data = usersSheet.getDataRange().getValues();
    const headers = data[0];
    
    const idx = {
        username: headers.indexOf("Username"),
        name: headers.indexOf("NamaLengkap"),
        role: headers.indexOf("Role")
    };
    
    const users = [];
    for (let i = 1; i < data.length; i++) {
        users.push({
            username: data[i][idx.username],
            name: data[i][idx.name] || '',
            role: data[i][idx.role] || 'User'
        });
    }
    return { success: true, data: users };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function saveAdminUser(userData, authUser) {
  try {
    if (!authUser || authUser.role !== 'Admin') throw new Error("Akses Ditolak: Hanya Admin.");
    
    const usersSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.Users);
    const data = usersSheet.getDataRange().getValues();
    const headers = data[0];
    
    const idx = {
        username: headers.indexOf("Username"),
        salt: headers.indexOf("Salt"),
        hash: headers.indexOf("HashedPassword"),
        name: headers.indexOf("NamaLengkap"),
        role: headers.indexOf("Role")
    };

    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
        if (data[i][idx.username] === userData.username) {
            rowIndex = i + 1;
            break;
        }
    }

    if (rowIndex > -1) {
        // Update User
        if (userData.name) usersSheet.getRange(rowIndex, idx.name + 1).setValue(userData.name);
        if (userData.role) usersSheet.getRange(rowIndex, idx.role + 1).setValue(userData.role);
        if (userData.password) {
            const hashResult = generatePasswordHash(userData.password);
            usersSheet.getRange(rowIndex, idx.salt + 1).setValue(hashResult.salt);
            usersSheet.getRange(rowIndex, idx.hash + 1).setValue(hashResult.hash);
        }
        return { success: true, message: "Pengguna berhasil diperbarui." };
    } else {
        // Create User
        if (!userData.password) userData.password = "123456"; // Default
        const hashResult = generatePasswordHash(userData.password);
        
        const newRow = [];
        newRow[idx.username] = userData.username;
        newRow[idx.salt] = hashResult.salt;
        newRow[idx.hash] = hashResult.hash;
        newRow[idx.name] = userData.name || userData.username;
        
        // Handle if role column exists
        if (idx.role > -1) {
            newRow[idx.role] = userData.role || 'User';
        } else {
            // Append header if missing
            usersSheet.getRange(1, headers.length + 1).setValue("Role");
            newRow[headers.length] = userData.role || 'User';
        }

        usersSheet.appendRow(newRow);
        return { success: true, message: "Pengguna berhasil ditambahkan." };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function resetUserSession(targetUsername, authUser) {
  try {
    if (!authUser || authUser.role !== 'Admin') throw new Error("Akses Ditolak: Hanya Admin.");
    const cache = CacheService.getScriptCache();
    cache.remove("SESSION_" + targetUsername);
    return { success: true, message: "Sesi user " + targetUsername + " berhasil direset." };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function deleteAdminUser(username, authUser) {
  try {
    if (!authUser || authUser.role !== 'Admin') throw new Error("Akses Ditolak: Hanya Admin.");
    if (username === authUser.username) throw new Error("Anda tidak dapat menghapus akun Anda sendiri.");
    
    const usersSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.Users);
    const data = usersSheet.getDataRange().getValues();
    const usernameIndex = data[0].indexOf("Username");
    
    for (let i = 1; i < data.length; i++) {
        if (data[i][usernameIndex] === username) {
            usersSheet.deleteRow(i + 1);
            return { success: true, message: "Pengguna berhasil dihapus." };
        }
    }
    throw new Error("Pengguna tidak ditemukan.");
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// Manajemen Tampilan (UI Settings)
function getUISettings() {
   try {
       const props = PropertiesService.getScriptProperties();
       return {
           success: true,
           data: {
               appName: props.getProperty('UI_APP_NAME') || 'Inventaris',
               primaryColor: props.getProperty('UI_PRIMARY_COLOR') || '#4f46e5', // default indigo-600
               bgImageUrl: getBackgroundImageUrl()
           }
       };
   } catch(e) {
       return { success: false, message: e.message };
   }
}

function saveUISettings(settings, authUser) {
   try {
       if (!authUser || authUser.role !== 'Admin') throw new Error("Akses Ditolak: Hanya Admin.");
       
       const props = PropertiesService.getScriptProperties();
       if (settings.appName) props.setProperty('UI_APP_NAME', settings.appName);
       if (settings.primaryColor) props.setProperty('UI_PRIMARY_COLOR', settings.primaryColor);
       
       let newBgUrl = null;

       // Hapus background jika diminta
       if (settings.removeBg) {
           const oldFileId = props.getProperty('UI_BG_IMAGE_ID');
           if (oldFileId) {
               try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch(e) {}
           }
           props.deleteProperty('UI_BG_IMAGE_URL');
           props.deleteProperty('UI_BG_IMAGE_ID');
           newBgUrl = '';
       } 
       // Simpan file gambar baru jika ada
       else if (settings.bgImageFile && settings.bgImageFile.base64) {
           // Temukan folder tempat Spreadsheet database tersimpan
           const ssFile = DriveApp.getFileById(SPREADSHEET_ID);
           const parents = ssFile.getParents();
           let folder;
           if (parents.hasNext()) {
               folder = parents.next();
           } else {
               folder = DriveApp.getRootFolder();
           }

           // Ekstrak base64 data
           let base64Str = settings.bgImageFile.base64;
           if (base64Str.indexOf('base64,') !== -1) {
               base64Str = base64Str.split('base64,')[1];
           }
           const bytes = Utilities.base64Decode(base64Str);
           const safeExt = (settings.bgImageFile.mimeType && settings.bgImageFile.mimeType.includes('png')) ? '.png' : '.jpg';
           const fileName = "app_bg_" + new Date().getTime() + (settings.bgImageFile.fileName ? "_" + settings.bgImageFile.fileName.replace(/[^a-zA-Z0-9._-]/g, '') : safeExt);
           const blob = Utilities.newBlob(bytes, settings.bgImageFile.mimeType || 'image/jpeg', fileName);

           // Hapus file gambar lama jika ada
           const oldFileId = props.getProperty('UI_BG_IMAGE_ID');
           if (oldFileId) {
               try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch(e) {}
           }

           // Buat file di folder spreadsheet
           const file = folder.createFile(blob);
           
           // Set akses view agar bisa diakses sebagai background
           try {
               file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
           } catch(e) {
               try {
                   file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
               } catch(err) {}
           }

           const fileId = file.getId();
           const fileUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w2560';
           props.setProperty('UI_BG_IMAGE_ID', fileId);
           props.setProperty('UI_BG_IMAGE_URL', fileUrl);
           newBgUrl = "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes());
       }

       return { 
           success: true, 
           message: "Pengaturan tampilan berhasil disimpan.",
           bgImageUrl: newBgUrl !== null ? newBgUrl : (props.getProperty('UI_BG_IMAGE_URL') || '')
       };
   } catch(e) {
       return { success: false, message: e.message };
   }
}

// Manajemen Jenis Aset
function saveAssetType(assetType, fieldConfigs, dashboardDesign, authUser) {
    try {
        if (!authUser || authUser.role !== 'Admin') {
            throw new Error("Hanya Admin yang dapat menambah jenis aset.");
        }

        const cleanName = assetType.trim();
        if (!cleanName) throw new Error("Nama aset tidak boleh kosong.");

        if (cleanName.toLowerCase() === 'users' || cleanName.toLowerCase() === 'logaktivitas') {
            throw new Error("Nama tidak diizinkan.");
        }

        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        let isNew = false;
        if (!ss.getSheetByName(cleanName)) {
            isNew = true;
        }

        let sheet = ss.getSheetByName(cleanName);
        if (!sheet) {
            sheet = ss.insertSheet(cleanName);
        }
        
        const systemHeadersStart = ["ID", "Tgl Peminjaman", "Tgl Pengembalian"];
        const systemHeadersEnd = ["Status", "Diubah Oleh"];
        
        const protectedHeaders = [...systemHeadersStart, ...systemHeadersEnd].map(h => h.toLowerCase());
        const customHeaders = fieldConfigs
          .map(c => c.name)
          .filter(name => !protectedHeaders.includes(name.toLowerCase()));
        
        const allHeaders = [...systemHeadersStart, ...customHeaders, ...systemHeadersEnd];

        if (isNew) {
            sheet.appendRow(allHeaders);
            sheet.getRange(1, 1, 1, allHeaders.length).setFontWeight("bold");
        } else {
            const lastRow = sheet.getLastRow();
            const lastCol = sheet.getLastColumn();
            
            if (lastCol > 0) {
                const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
                const existingHeadersLower = existingHeaders.map(h => String(h).toLowerCase().trim());
                
                if (lastRow > 1) {
                    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
                    
                    const newRows = data.map(row => {
                        const newRow = new Array(allHeaders.length).fill("");
                        allHeaders.forEach((newH, newIdx) => {
                            const oldIdx = existingHeadersLower.indexOf(String(newH).toLowerCase().trim());
                            if (oldIdx !== -1) {
                                newRow[newIdx] = row[oldIdx];
                            }
                        });
                        return newRow;
                    });
                    
                    // Kita clear konten seluruh sheet
                    sheet.clearContents();
                    
                    // Kita buat ulang header dan masukkan data
                    sheet.getRange(1, 1, 1, allHeaders.length).setValues([allHeaders]).setFontWeight("bold");
                    sheet.getRange(2, 1, newRows.length, allHeaders.length).setValues(newRows);
                } else {
                    sheet.clearContents();
                    sheet.getRange(1, 1, 1, allHeaders.length).setValues([allHeaders]).setFontWeight("bold");
                }
            } else {
                sheet.appendRow(allHeaders);
                sheet.getRange(1, 1, 1, allHeaders.length).setFontWeight("bold");
            }
        }
        
        // Simpan Konfigurasi Field ke Properties
        const props = PropertiesService.getScriptProperties();
        const configData = {
            fields: fieldConfigs,
            dashboardDesign: dashboardDesign || 'standard',
            columnWidths: {}
        };
        props.setProperty('ASSET_CONFIG_' + cleanName, JSON.stringify(configData));

        // Bersihkan cache
        const cache = CacheService.getScriptCache();
        cache.remove(CACHE_KEY_ALL_DATA);
        cache.remove("ASSET_SHEET_NAMES");

        if (isNew) {
            logActivity('-', cleanName, 'CREATE-DASHBOARD-ASET', authUser, `Dashboard aset baru "${cleanName}" telah dibuat.`);
        }
        
        return { success: true, message: "Jenis aset '" + cleanName + "' berhasil ditambahkan/diupdate dengan " + fieldConfigs.length + " kolom!" };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

/**
 * Menghapus sebuah jenis aset: menghapus sheet dan konfigurasi dari Properties.
 * @param {string} assetType Nama jenis aset yang akan dihapus.
 * @param {object} authUser User yang melakukan aksi (harus Admin).
 */
function deleteAssetType(assetType, authUser) {
  try {
    if (!authUser || authUser.role !== 'Admin') {
      throw new Error("Hanya Admin yang dapat menghapus jenis aset.");
    }

    const cleanName = assetType.trim();
    if (!cleanName) throw new Error("Nama aset tidak boleh kosong.");

    if (cleanName.toLowerCase() === 'users' || cleanName.toLowerCase() === 'logaktivitas') {
      throw new Error("Jenis aset sistem tidak dapat dihapus.");
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(cleanName);

    if (sheet) {
      // Pastikan minimal ada 1 sheet tersisa
      if (ss.getSheets().length <= 1) {
        throw new Error("Tidak dapat menghapus satu-satunya sheet yang tersisa.");
      }
      ss.deleteSheet(sheet);
    } else {
      throw new Error("Sheet '" + cleanName + "' tidak ditemukan.");
    }

    // Hapus konfigurasi dari Script Properties
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty('ASSET_CONFIG_' + cleanName);

    // Bersihkan cache
    const cache = CacheService.getScriptCache();
    cache.remove(CACHE_KEY_ALL_DATA);
    cache.remove("ASSET_SHEET_NAMES");

    logActivity('-', cleanName, 'DELETE_TYPE', authUser, "Jenis aset '" + cleanName + "' dihapus oleh Admin.");

    return { success: true, message: "Jenis aset '" + cleanName + "' berhasil dihapus." };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function saveColumnWidths(assetType, columnWidths, authUser) {
    try {
        if (!authUser || authUser.role !== 'Admin') {
            throw new Error('Hanya Admin yang dapat menyimpan setingan lebar kolom.');
        }
        
        const cleanName = String(assetType).trim();
        const props = PropertiesService.getScriptProperties();
        const configStr = props.getProperty('ASSET_CONFIG_' + cleanName);
        
        let configData = { fields: [], dashboardDesign: 'standard', columnWidths: {} };
        if (configStr) {
            const parsed = JSON.parse(configStr);
            if (Array.isArray(parsed)) {
                configData.fields = parsed;
            } else {
                configData = parsed;
            }
        }
        
        configData.columnWidths = columnWidths;
        props.setProperty('ASSET_CONFIG_' + cleanName, JSON.stringify(configData));
        
        const cache = CacheService.getScriptCache();
        cache.remove(CACHE_KEY_ALL_DATA);
        
        return { success: true, message: 'Ukuran kolom berhasil disimpan.' };
    } catch(e) {
        return { success: false, message: e.message };
    }
}





// Push trigger


// Fix Status column issue

function importBatchData(batchData, user, dryRun = false) {
  const resultSummary = {
    newCount: 0,
    updateCount: 0,
    duplicateCount: 0,
    details: []
  };
  const errors = [];

  const UNIQUE_KEYS = {
    'Headset': ['SN Headset'],
    'Laptop': ['Serial Number'],
    'PC': ['Serial Number'],
    'RAM': ['SN'],
    'Speaker': ['Serial Number'],
    'Tablet': ['Serial Number']
  };

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    for (const assetType of Object.keys(batchData)) {
      if (!isAssetSheet(assetType)) {
        errors.push(`${assetType}: Tipe aset tidak valid.`);
        continue;
      }

      const dataItems = batchData[assetType];
      if (!dataItems || dataItems.length === 0) continue;

      const sheet = ss.getSheetByName(assetType);
      if (!sheet) {
        errors.push(`${assetType}: Sheet tidak ditemukan.`);
        continue;
      }

      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const range = sheet.getDataRange();
      const values = range.getValues();
      const idIndex = headers.indexOf('ID');

      // Indexes for Unique Keys
      const uniqueIndexes = {};
      if (UNIQUE_KEYS[assetType]) {
        UNIQUE_KEYS[assetType].forEach(key => {
          const idx = headers.indexOf(key);
          if (idx !== -1) uniqueIndexes[key] = idx;
        });
      }

      const mapById = {};
      const mapByUnique = {};
      Object.keys(uniqueIndexes).forEach(k => mapByUnique[k] = {});

      if (idIndex !== -1) {
        for (let i = 1; i < values.length; i++) {
          const id = values[i][idIndex];
          if (id) mapById[String(id)] = i;

          Object.keys(uniqueIndexes).forEach(key => {
            const idx = uniqueIndexes[key];
            const val = values[i][idx];
            if (val) {
              const cleanVal = String(val).toLowerCase().trim();
              mapByUnique[key][cleanVal] = i;
            }
          });
        }
      }

      const appendRows = [];
      let typeNew = 0;
      let typeUpd = 0;
      let typeDup = 0;

      dataItems.forEach(item => {
        let rowId = item['ID'];
        if (rowId === undefined || rowId === null || String(rowId).trim() === '') rowId = null;

        let targetRowIndex = -1;
        let matchReason = '';

        if (rowId && mapById[String(rowId)] !== undefined) {
          targetRowIndex = mapById[String(rowId)];
          matchReason = 'Match ID';
        } else {
          Object.keys(uniqueIndexes).forEach(key => {
            const val = item[key];
            if (val) {
              const cleanVal = String(val).toLowerCase().trim();
              if (mapByUnique[key][cleanVal] !== undefined) {
                targetRowIndex = mapByUnique[key][cleanVal];
                matchReason = `Match ${key}`;
              }
            }
          });
        }

        const rowArray = headers.map(header => {
          if (header === 'Diubah Oleh') return user ? user.username : '';
          let val = item[header];
          return (val === undefined || val === null) ? '' : val;
        });

        if (targetRowIndex !== -1) {
          const existingRowVals = values[targetRowIndex];
          let hasChanges = false;
          const changes = [];

          headers.forEach((h, colIdx) => {
            if (h === 'Diubah Oleh') return;
            
            // PROTECT ID: Jangan pernah timpa ID existing dengan yang kosong dari Excel
            if (h === 'ID') {
                rowArray[colIdx] = existingRowVals[colIdx];
                return;
            }
            
            let vOld = String(existingRowVals[colIdx]);
            let vNew = String(rowArray[colIdx]);
            
            // PROTECT BLANK VALUES: Jika di excel kosong, jangan hapus data lama yang ada
            if (vNew === '' && vOld !== '') {
                rowArray[colIdx] = existingRowVals[colIdx];
                return;
            }
            
            if (vOld !== vNew) {
              hasChanges = true;
              changes.push(h);
            }
          });

          if (hasChanges) {
            typeUpd++;
            if (dryRun) {
              const name = item['Nama'] || item['ID'] || 'Unknown';
              resultSummary.details.push({
                type: 'Update',
                asset: assetType,
                name: name,
                reason: matchReason,
                changes: changes
              });
            } else {
              sheet.getRange(targetRowIndex + 1, 1, 1, rowArray.length).setValues([rowArray]);
            }
          } else {
            typeDup++;
          }
        } else {
          typeNew++;
          if (!dryRun) appendRows.push(rowArray);
        }
      });

      if (!dryRun && appendRows.length > 0) {
        if (idIndex !== -1) {
          const allIds = sheet.getDataRange().getValues().slice(1).map(r => r[idIndex]).filter(id => String(id).startsWith(assetType + '-'));
          let maxNum = 0;
          allIds.forEach(id => {
            const parts = String(id).split('-');
            const n = parseInt(parts[parts.length - 1]);
            if (!isNaN(n) && n > maxNum) maxNum = n;
          });

          let currentMax = maxNum;
          appendRows.forEach(row => {
            if (!row[idIndex] || String(row[idIndex]).trim() === '' || String(row[idIndex]).toUpperCase().includes('AUTO')) {
              currentMax++;
              row[idIndex] = `${assetType}-${currentMax}`;
            }
          });
        }
        sheet.getRange(sheet.getLastRow() + 1, 1, appendRows.length, headers.length).setValues(appendRows);
      }

      resultSummary.newCount += typeNew;
      resultSummary.updateCount += typeUpd;
      resultSummary.duplicateCount += typeDup;
    }

    if (!dryRun) {
      CacheService.getScriptCache().remove(CACHE_KEY_ALL_DATA);
      logActivity("BATCH", "ALL", "IMPORT", user, `Import: ${resultSummary.newCount} new, ${resultSummary.updateCount} upd.`);
    }

    let msg = `Data Baru : ${resultSummary.newCount}\nData Duplikat : ${resultSummary.duplicateCount}\nData Update : ${resultSummary.updateCount}`;
    if (errors.length > 0) msg += '\nErrors: ' + errors.join('; ');

    return { success: true, message: msg, summary: resultSummary };

  } catch (e) {
    return { success: false, message: e.message };
  }
}
