/**
 * mock-backend.js
 * Mock backend untuk Live Demo di GitHub Pages / Web Browser statis.
 * Menggantikan `window.google.script.run` ketika aplikasi dibuka di luar lingkungan Google Apps Script.
 * Menyimpan seluruh data palsu (dummy) di LocalStorage sehingga pengguna bisa
 * mencoba CRUD (Tambah aset, Edit aset, Hapus aset, Manage Pengguna, dsb) secara interaktif.
 */

(function () {
  // Hanya inisialisasi jika BUKAN di lingkungan Google Apps Script
  const isGAS = window.google && window.google.script && window.google.script.run && typeof window.google.script.run.getWebAppUrl === 'function';
  if (isGAS) return;

  const STORAGE_PREFIX = 'DEMO_INVENTARIS_';

  function getStore(key, defaultValue) {
    try {
      const val = localStorage.getItem(STORAGE_PREFIX + key);
      return val ? JSON.parse(val) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  function setStore(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }

  // --- DUMMY USERS ---
  const INITIAL_USERS = [
    {
      username: 'admin',
      password: 'admin123',
      name: 'Administrator Demo',
      role: 'Admin',
      status: 'Active',
      lastLogin: new Date().toISOString()
    },
    {
      username: 'user',
      password: 'user123',
      name: 'Staff Petugas Demo',
      role: 'User',
      status: 'Active',
      lastLogin: new Date().toISOString()
    }
  ];

  // --- DUMMY ASSET CONFIGURATIONS ---
  const INITIAL_MENU_CONFIG = {
    Laptop: {
      name: 'Laptop',
      dashboardDesign: 'laptop',
      fields: [
        { name: 'Nama', type: 'text', groupName: 'Detail Pengguna' },
        { name: 'Merek', type: 'dropdown', options: 'Lenovo, Dell, Asus, HP, Acer, Apple', showInChart: true, groupName: 'Detail Laptop' },
        { name: 'Model', type: 'text', groupName: 'Detail Laptop' },
        { name: 'Serial Number', type: 'text', groupName: 'Detail Laptop' },
        { name: 'Processor', type: 'text', groupName: 'Spesifikasi' },
        { name: 'RAM', type: 'text', groupName: 'Spesifikasi' },
        { name: 'Storage', type: 'text', groupName: 'Spesifikasi' },
        { name: 'Petugas', type: 'text' },
        { name: 'Status', type: 'dropdown', options: 'DIPAKAI, TERSEDIA, RUSAK', showInChart: true },
        { name: 'Tgl Peminjaman', type: 'date' },
        { name: 'Tgl Pengembalian', type: 'date' }
      ],
      fieldCount: 11,
      columnWidths: {}
    },
    PC: {
      name: 'PC',
      dashboardDesign: 'pc',
      fields: [
        { name: 'IP Address', type: 'text' },
        { name: 'Serial Number', type: 'text' },
        { name: 'RAM', type: 'text' },
        { name: 'Hostname', type: 'text' },
        { name: 'Type PC', type: 'dropdown', options: 'DESKTOP, AIO, MINI PC' },
        { name: 'Type Keyboard', type: 'text' },
        { name: 'Type Mouse', type: 'text' },
        { name: 'Serial Number Monitor', type: 'text' },
        { name: 'NIB Monitor', type: 'text' },
        { name: 'Nama', type: 'text' },
        { name: 'HQ', type: 'text' },
        { name: 'Extension', type: 'text' },
        { name: 'Layanan', type: 'text' },
        { name: 'Operating System', type: 'dropdown', options: 'Windows 11 Pro, Windows 10 Pro, Windows 7 Pro, Windows Server 2012 R2, Windows XP' },
        { name: 'Lantai', type: 'dropdown', options: 'Lantai 1, Lantai 2, Lantai 3, Lantai 4' },
        { name: 'Status', type: 'dropdown', options: 'DIPAKAI, TERSEDIA, RUSAK', showInChart: true }
      ],
      fieldCount: 16,
      columnWidths: {}
    },
    Headset: {
      name: 'Headset',
      dashboardDesign: 'headset',
      fields: [
        { name: 'Nama', type: 'text' },
        { name: 'NPP', type: 'text' },
        { name: 'Nama Onair', type: 'text' },
        { name: 'Site', type: 'text' },
        { name: 'Merek', type: 'dropdown', options: 'Jabra, Logitech, Plantronics, Sennheiser', showInChart: true },
        { name: 'SN Headset', type: 'text' },
        { name: 'Type', type: 'dropdown', options: 'USB, Jack 3.5mm, Wireless' },
        { name: 'Jenis', type: 'dropdown', options: 'Mono, Stereo' },
        { name: 'Kondisi', type: 'dropdown', options: 'Baik, Rusak Busa, Kabel Putus, Mati' },
        { name: 'Layanan', type: 'text' },
        { name: 'Status', type: 'dropdown', options: 'DIPAKAI, TERSEDIA, RUSAK', showInChart: true },
        { name: 'Tgl Peminjaman', type: 'date' },
        { name: 'Tgl Pengembalian', type: 'date' }
      ],
      fieldCount: 13,
      columnWidths: {}
    },
    Tablet: {
      name: 'Tablet',
      dashboardDesign: 'tablet',
      fields: [
        { name: 'Nama', type: 'text' },
        { name: 'Keperluan', type: 'text' },
        { name: 'Keterangan', type: 'text' },
        { name: 'QTY', type: 'number' },
        { name: 'Merek', type: 'dropdown', options: 'Samsung, Apple, Huawei, Xiaomi', showInChart: true },
        { name: 'Model', type: 'text' },
        { name: 'Serial Number', type: 'text' },
        { name: 'IMEI 1', type: 'text' },
        { name: 'Petugas', type: 'text' },
        { name: 'Status', type: 'dropdown', options: 'DIPAKAI, TERSEDIA, RUSAK', showInChart: true },
        { name: 'Tgl Peminjaman', type: 'date' },
        { name: 'Tgl Pengembalian', type: 'date' }
      ],
      fieldCount: 12,
      columnWidths: {}
    },
    RAM: {
      name: 'RAM',
      dashboardDesign: 'ram',
      fields: [
        { name: 'Merk', type: 'dropdown', options: 'Kingston, Corsair, Samsung, V-GeN, Hynix' },
        { name: 'SN', type: 'text' },
        { name: 'Type Ram', type: 'dropdown', options: 'DDR4, DDR5, DDR3' },
        { name: 'Jenis Ram', type: 'dropdown', options: 'SODIMM, LongDIMM' },
        { name: 'Size', type: 'dropdown', options: '4, 8, 16, 32' },
        { name: 'Tgl Pengadaan', type: 'date' },
        { name: 'Layanan', type: 'text' },
        { name: 'Pengguna', type: 'text' },
        { name: 'SN PC', type: 'text' },
        { name: 'Ket.', type: 'text' },
        { name: 'Status', type: 'dropdown', options: 'DIPAKAI, TERSEDIA, RUSAK', showInChart: true }
      ],
      fieldCount: 11,
      columnWidths: {}
    }
  };

  // --- DUMMY INITIAL ASSETS DATA (Matrix Rows) ---
  const INITIAL_ASSETS_DATA = {
    Laptop: {
      headers: ['ID', 'Nama', 'Merek', 'Model', 'Serial Number', 'Processor', 'RAM', 'Storage', 'Petugas', 'Status', 'Tgl Peminjaman', 'Tgl Pengembalian', 'RowIndex', 'SheetName', 'Timestamp', 'Diubah Oleh'],
      rows: [
        ['Laptop-1', 'Budi Santoso', 'Lenovo', 'ThinkPad T14 Gen 3', 'SN-TP-9921', 'Intel Core i7-1260P', '16 GB', '512 GB SSD', 'Admin Demo', 'DIPAKAI', '2026-03-01', '', 2, 'Laptop', '2026-03-01 08:30:00', 'Admin Demo'],
        ['Laptop-2', 'Siti Rahmawati', 'Dell', 'Latitude 5430', 'SN-LT-4412', 'Intel Core i5-1245U', '16 GB', '512 GB SSD', 'Staff Demo', 'DIPAKAI', '2026-03-10', '', 3, 'Laptop', '2026-03-10 09:15:00', 'Staff Demo'],
        ['Laptop-3', 'Ahmad Hidayat', 'Asus', 'ExpertBook B9', 'SN-EB-1082', 'Intel Core i7-1165G7', '16 GB', '1 TB SSD', 'Admin Demo', 'TERSEDIA', '2026-02-15', '2026-03-20', 4, 'Laptop', '2026-03-20 14:00:00', 'Admin Demo'],
        ['Laptop-4', 'Dewi Lestari', 'HP', 'EliteBook 840 G8', 'SN-HP-3329', 'Intel Core i5-1135G7', '8 GB', '256 GB SSD', 'Staff Demo', 'DIPAKAI', '2026-03-15', '', 5, 'Laptop', '2026-03-15 10:00:00', 'Staff Demo'],
        ['Laptop-5', '', 'Acer', 'TravelMate P2', 'SN-TM-5521', 'Intel Core i3-1115G4', '8 GB', '256 GB SSD', 'Admin Demo', 'TERSEDIA', '', '', 6, 'Laptop', '2026-01-10 11:00:00', 'Admin Demo'],
        ['Laptop-6', 'Doni Kusuma', 'Lenovo', 'IdeaPad Slim 5', 'SN-IP-7711', 'AMD Ryzen 5 5500U', '8 GB', '512 GB SSD', 'Admin Demo', 'RUSAK', '2026-02-01', '2026-02-28', 7, 'Laptop', '2026-02-28 16:30:00', 'Admin Demo'],
        ['Laptop-7', 'Eka Pratama', 'Apple', 'MacBook Air M2', 'SN-MB-8800', 'Apple M2 8-Core', '8 GB', '256 GB SSD', 'Staff Demo', 'DIPAKAI', '2026-04-01', '', 8, 'Laptop', '2026-04-01 09:00:00', 'Staff Demo']
      ]
    },
    PC: {
      headers: ['ID', 'IP Address', 'Serial Number', 'RAM', 'Hostname', 'Type PC', 'Type Keyboard', 'Type Mouse', 'Serial Number Monitor', 'NIB Monitor', 'Nama', 'HQ', 'Extension', 'Layanan', 'Operating System', 'Lantai', 'Status', 'RowIndex', 'SheetName', 'Timestamp', 'Diubah Oleh'],
      rows: [
        ['PC-1', '192.168.1.101', 'PC-SN-001', '16 GB', 'PC-IT-01', 'DESKTOP', 'Logitech K120', 'Logitech B100', 'MON-001', 'NIB-881', 'Rian Hidayat', 'Pusat', '101', 'IT Support', 'Windows 11 Pro', 'Lantai 1', 'DIPAKAI', 2, 'PC', '2026-01-05 08:00:00', 'Admin Demo'],
        ['PC-2', '192.168.1.102', 'PC-SN-002', '16 GB', 'PC-FIN-01', 'DESKTOP', 'Dell KB216', 'Dell MS116', 'MON-002', 'NIB-882', 'Fitri Handayani', 'Pusat', '102', 'Finance', 'Windows 10 Pro', 'Lantai 1', 'DIPAKAI', 3, 'PC', '2026-01-05 08:30:00', 'Admin Demo'],
        ['PC-3', '192.168.1.103', 'PC-SN-003', '8 GB', 'PC-CS-01', 'AIO', 'Lenovo USB', 'Lenovo USB', 'MON-003', 'NIB-883', 'Novi Anggraini', 'Pusat', '103', 'Customer Service', 'Windows 10 Pro', 'Lantai 2', 'DIPAKAI', 4, 'PC', '2026-01-08 09:00:00', 'Admin Demo'],
        ['PC-4', '192.168.1.104', 'PC-SN-004', '32 GB', 'PC-SRV-01', 'MINI PC', 'HP USB', 'HP USB', 'MON-004', 'NIB-884', 'Server Monitoring', 'Pusat', '104', 'Infrastructure', 'Windows Server 2012 R2', 'Lantai 3', 'DIPAKAI', 5, 'PC', '2026-01-10 10:00:00', 'Admin Demo'],
        ['PC-5', '192.168.1.105', 'PC-SN-005', '8 GB', 'PC-STOK-01', 'DESKTOP', 'Standard USB', 'Standard USB', 'MON-005', 'NIB-885', '', 'Pusat', '', 'Inventory', 'Windows 10 Pro', 'Lantai 2', 'TERSEDIA', 6, 'PC', '2026-02-01 11:00:00', 'Admin Demo'],
        ['PC-6', '192.168.1.106', 'PC-SN-006', '4 GB', 'PC-OLD-01', 'DESKTOP', 'Genius', 'Genius', 'MON-006', 'NIB-886', 'Gudang Lama', 'Pusat', '', 'General Affairs', 'Windows 7 Pro', 'Lantai 4', 'RUSAK', 7, 'PC', '2026-02-15 15:00:00', 'Admin Demo']
      ]
    },
    Headset: {
      headers: ['ID', 'Nama', 'NPP', 'Nama Onair', 'Site', 'Merek', 'SN Headset', 'Type', 'Jenis', 'Kondisi', 'Layanan', 'Status', 'Tgl Peminjaman', 'Tgl Pengembalian', 'RowIndex', 'SheetName', 'Timestamp', 'Diubah Oleh'],
      rows: [
        ['Headset-1', 'Anisa Putri', 'NPP-1011', 'Annisa', 'Site Alpha', 'Jabra', 'HS-JB-901', 'USB', 'Stereo', 'Baik', 'Inbound CS', 'DIPAKAI', '2026-02-10', '', 2, 'Headset', '2026-02-10 08:00:00', 'Admin Demo'],
        ['Headset-2', 'Bambang Irawan', 'NPP-1012', 'Bams', 'Site Alpha', 'Logitech', 'HS-LG-502', 'USB', 'Mono', 'Baik', 'Outbound CS', 'DIPAKAI', '2026-02-12', '', 3, 'Headset', '2026-02-12 08:30:00', 'Admin Demo'],
        ['Headset-3', 'Citra Melati', 'NPP-1013', 'Citra', 'Site Beta', 'Plantronics', 'HS-PL-303', 'Jack 3.5mm', 'Stereo', 'Baik', 'Quality Assurance', 'TERSEDIA', '2026-01-15', '2026-03-01', 4, 'Headset', '2026-03-01 17:00:00', 'Staff Demo'],
        ['Headset-4', 'Deni Saputra', 'NPP-1014', 'Deni', 'Site Beta', 'Sennheiser', 'HS-SN-704', 'USB', 'Stereo', 'Kabel Putus', 'Inbound CS', 'RUSAK', '2026-02-01', '2026-02-20', 5, 'Headset', '2026-02-20 16:00:00', 'Admin Demo']
      ]
    },
    Tablet: {
      headers: ['ID', 'Nama', 'Keperluan', 'Keterangan', 'QTY', 'Merek', 'Model', 'Serial Number', 'IMEI 1', 'Petugas', 'Status', 'Tgl Peminjaman', 'Tgl Pengembalian', 'RowIndex', 'SheetName', 'Timestamp', 'Diubah Oleh'],
      rows: [
        ['Tablet-1', 'Tim Survei Lapangan', 'Pemeriksaan Aset Cabang', 'Kelengkapan charger + stylus pen', 1, 'Samsung', 'Galaxy Tab S8', 'TAB-SM-001', '356789012345671', 'Admin Demo', 'DIPAKAI', '2026-03-05', '', 2, 'Tablet', '2026-03-05 09:00:00', 'Admin Demo'],
        ['Tablet-2', 'Tim Pameran & Event', 'Display Demo Produk', 'Unit mulus dengan casing armor', 1, 'Apple', 'iPad Pro 11"', 'TAB-AP-002', '356789012345672', 'Staff Demo', 'TERSEDIA', '2026-02-20', '2026-03-02', 3, 'Tablet', '2026-03-02 18:00:00', 'Staff Demo'],
        ['Tablet-3', 'Audit Internal', 'Stock Opname Semester 1', 'Termasuk holder mobil', 1, 'Huawei', 'MatePad 11', 'TAB-HW-003', '356789012345673', 'Admin Demo', 'DIPAKAI', '2026-03-12', '', 4, 'Tablet', '2026-03-12 10:00:00', 'Admin Demo']
      ]
    },
    RAM: {
      headers: ['ID', 'Merk', 'SN', 'Type Ram', 'Jenis Ram', 'Size', 'Tgl Pengadaan', 'Layanan', 'Pengguna', 'SN PC', 'Ket.', 'Status', 'RowIndex', 'SheetName', 'Timestamp', 'Diubah Oleh'],
      rows: [
        ['RAM-1', 'Kingston', 'SN-KNG-01', 'DDR4', 'LongDIMM', '16', '2026-01-15', 'IT Support', 'PC-IT-01', 'PC-SN-001', 'Upgrade PC Admin', 'DIPAKAI', 2, 'RAM', '2026-01-15 10:00:00', 'Admin Demo'],
        ['RAM-2', 'Corsair', 'SN-COR-02', 'DDR4', 'LongDIMM', '16', '2026-01-15', 'Finance', 'PC-FIN-01', 'PC-SN-002', 'Spare cadangan', 'TERSEDIA', 3, 'RAM', '2026-01-15 10:00:00', 'Admin Demo'],
        ['RAM-3', 'Samsung', 'SN-SAM-03', 'DDR5', 'SODIMM', '32', '2026-02-01', 'Infrastructure', '', '', 'Stok baru di laci IT', 'TERSEDIA', 4, 'RAM', '2026-02-01 11:00:00', 'Admin Demo'],
        ['RAM-4', 'V-GeN', 'SN-VGN-04', 'DDR3', 'LongDIMM', '4', '2025-06-10', 'Arsip', '', '', 'Keping rusak/bluescreen', 'RUSAK', 5, 'RAM', '2025-06-10 14:00:00', 'Admin Demo']
      ]
    }
  };

  // --- INITIALIZE STORAGE IF EMPTY ---
  if (!localStorage.getItem(STORAGE_PREFIX + 'USERS')) {
    setStore('USERS', INITIAL_USERS);
  }
  if (!localStorage.getItem(STORAGE_PREFIX + 'MENU_CONFIG')) {
    setStore('MENU_CONFIG', INITIAL_MENU_CONFIG);
  }
  if (!localStorage.getItem(STORAGE_PREFIX + 'ASSETS_DATA')) {
    setStore('ASSETS_DATA', INITIAL_ASSETS_DATA);
  }
  if (!localStorage.getItem(STORAGE_PREFIX + 'UI_SETTINGS')) {
    setStore('UI_SETTINGS', {
      primaryColor: '#4f46e5',
      appName: 'Aplikasi Inventaris Demo',
      bgImageUrl: ''
    });
  }
  if (!localStorage.getItem(STORAGE_PREFIX + 'ACTIVITY_LOGS')) {
    setStore('ACTIVITY_LOGS', [
      { timestamp: '2026-03-01 08:30:00', user: 'Admin Demo', action: 'CREATE', assetType: 'Laptop', assetId: 'Laptop-1', details: 'Aset Laptop baru ditambahkan' },
      { timestamp: '2026-03-05 09:00:00', user: 'Admin Demo', action: 'PINJAM', assetType: 'Tablet', assetId: 'Tablet-1', details: 'Dipinjam oleh Tim Survei Lapangan' }
    ]);
  }

  function getAssetsData() {
    return getStore('ASSETS_DATA', INITIAL_ASSETS_DATA);
  }

  function saveAssetsData(data) {
    setStore('ASSETS_DATA', data);
  }

  function getMenuConfig() {
    return getStore('MENU_CONFIG', INITIAL_MENU_CONFIG);
  }

  function logActivity(assetId, assetType, action, user, details) {
    const logs = getStore('ACTIVITY_LOGS', []);
    const username = (user && typeof user === 'object' ? user.name || user.username : user) || 'SYSTEM';
    const now = new Date();
    const ts = now.toISOString().replace('T', ' ').slice(0, 19);
    logs.unshift({
      timestamp: ts,
      user: username,
      action: action,
      assetType: assetType,
      assetId: assetId,
      details: details || '-'
    });
    setStore('ACTIVITY_LOGS', logs.slice(0, 500)); // keep last 500
  }

  function getFullBundle() {
    const assets = getAssetsData();
    const menuConfig = getMenuConfig();
    const bundle = {};

    for (const type in assets) {
      const cfg = menuConfig[type] || {
        fields: [],
        dashboardDesign: type.toLowerCase(),
        columnWidths: {}
      };
      bundle[type] = {
        headers: assets[type].headers,
        rows: assets[type].rows,
        config: cfg.fields,
        dashboardDesign: cfg.dashboardDesign || 'standard',
        columnWidths: cfg.columnWidths || {}
      };
    }
    return bundle;
  }

  // --- MOCK RUN OBJECT (Implements chained withSuccessHandler / withFailureHandler) ---
  class MockRunner {
    constructor() {
      this._success = () => {};
      this._failure = () => {};
      this._delayMs = 120; // simulasi latency realistis
    }

    withSuccessHandler(cb) {
      if (typeof cb === 'function') this._success = cb;
      return this;
    }

    withFailureHandler(cb) {
      if (typeof cb === 'function') this._failure = cb;
      return this;
    }

    withUserObject() {
      return this;
    }

    _async(fn) {
      setTimeout(() => {
        try {
          const res = fn();
          this._success(res);
        } catch (err) {
          console.error('[MockRunner Error]', err);
          this._failure(err);
        }
      }, this._delayMs);
      return this;
    }

    // --- API METHODS ---

    getWebAppUrl() {
      return this._async(() => window.location.href.split('#')[0]);
    }

    login(credentials) {
      return this._async(() => {
        const users = getStore('USERS', INITIAL_USERS);
        const user = users.find(u => u.username.toLowerCase() === (credentials.username || '').toLowerCase().trim());

        if (!user) {
          return { success: false, message: 'Username tidak ditemukan (Coba username: admin atau user).' };
        }
        if (user.password !== credentials.password) {
          return { success: false, message: 'Password salah (Gunakan password: ' + (user.username === 'admin' ? 'admin123' : 'user123') + ').' };
        }

        user.lastLogin = new Date().toISOString();
        setStore('USERS', users);

        const token = 'demo-token-' + Date.now();
        const menuData = getMenuConfig();
        const allDataBundle = getFullBundle();

        return {
          success: true,
          token: token,
          user: { username: user.username, role: user.role, name: user.name },
          menuData: menuData,
          allData: allDataBundle
        };
      });
    }

    checkAuth(username, token) {
      return this._async(() => {
        const users = getStore('USERS', INITIAL_USERS);
        const user = users.find(u => u.username.toLowerCase() === (username || '').toLowerCase().trim());
        if (user && token) {
          return {
            loggedIn: true,
            user: { username: user.username, role: user.role, name: user.name },
            menuData: getMenuConfig(),
            allData: getFullBundle()
          };
        }
        return { loggedIn: false };
      });
    }

    logout(username) {
      return this._async(() => {
        return { success: true };
      });
    }

    getAllData() {
      return this._async(() => getFullBundle());
    }

    getDataFor(assetType) {
      return this._async(() => {
        const all = getFullBundle();
        if (all[assetType]) {
          return { [assetType]: all[assetType] };
        }
        return { error: 'Jenis aset tidak ditemukan' };
      });
    }

    getAssetTypeMenuData() {
      return this._async(() => getMenuConfig());
    }

    getAssetHistory(assetId) {
      return this._async(() => {
        const logs = getStore('ACTIVITY_LOGS', []);
        return logs.filter(l => String(l.assetId) === String(assetId));
      });
    }

    getLogsForAssetType(assetType) {
      return this._async(() => {
        const logs = getStore('ACTIVITY_LOGS', []);
        return logs.filter(l => String(l.assetType).toLowerCase() === String(assetType).toLowerCase());
      });
    }

    saveData(dataObject, user) {
      return this._async(() => {
        const type = dataObject.assetType;
        if (!type) throw new Error('Jenis aset harus dipilih.');

        const assets = getAssetsData();
        if (!assets[type]) {
          throw new Error('Jenis aset ' + type + ' tidak terdaftar.');
        }

        const sheetData = assets[type];
        const headers = sheetData.headers;
        const rows = sheetData.rows;

        // Generate ID
        let maxNum = 0;
        rows.forEach(r => {
          const idVal = String(r[0] || '');
          if (idVal.startsWith(type + '-')) {
            const num = parseInt(idVal.split('-').pop(), 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        });
        const newId = type + '-' + (maxNum + 1);

        const now = new Date();
        const ts = now.toISOString().replace('T', ' ').slice(0, 19);
        const username = (user && user.name) || 'Demo User';

        const newRow = headers.map(h => {
          if (h === 'ID') return newId;
          if (h === 'RowIndex') return rows.length + 2;
          if (h === 'SheetName') return type;
          if (h === 'Timestamp') return ts;
          if (h === 'Diubah Oleh') return username;
          if (dataObject[h] !== undefined) return dataObject[h];
          return '';
        });

        rows.push(newRow);
        saveAssetsData(assets);

        logActivity(newId, type, 'CREATE', user, 'Aset baru berhasil dibuat');
        return { status: 'success', id: newId, message: 'Data berhasil disimpan!' };
      });
    }

    updateData(assetType, id, updatedData, user) {
      return this._async(() => {
        const assets = getAssetsData();
        if (!assets[assetType]) throw new Error('Tipe aset tidak valid.');

        const sheetData = assets[assetType];
        const headers = sheetData.headers;
        const rows = sheetData.rows;
        const idIdx = headers.indexOf('ID');

        const rowIndex = rows.findIndex(r => String(r[idIdx]) === String(id));
        if (rowIndex === -1) throw new Error('Data aset tidak ditemukan.');

        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const username = (user && user.name) || 'Demo User';

        headers.forEach((h, colIdx) => {
          if (h === 'ID' || h === 'RowIndex' || h === 'SheetName') return;
          if (h === 'Timestamp') {
            rows[rowIndex][colIdx] = now;
          } else if (h === 'Diubah Oleh') {
            rows[rowIndex][colIdx] = username;
          } else if (updatedData[h] !== undefined) {
            rows[rowIndex][colIdx] = updatedData[h];
          }
        });

        saveAssetsData(assets);
        logActivity(id, assetType, 'UPDATE', user, 'Data aset berhasil diperbarui');
        return { success: true, message: 'Berhasil diperbarui!' };
      });
    }

    updateLoanDate(assetType, id, newLoanDateString, newReturnDateString, user) {
      return this._async(() => {
        const assets = getAssetsData();
        if (!assets[assetType]) throw new Error('Tipe aset tidak valid.');

        const headers = assets[assetType].headers;
        const rows = assets[assetType].rows;
        const idIdx = headers.indexOf('ID');
        const loanIdx = headers.indexOf('Tgl Peminjaman');
        const returnIdx = headers.indexOf('Tgl Pengembalian');

        const row = rows.find(r => String(r[idIdx]) === String(id));
        if (!row) throw new Error('Aset tidak ditemukan.');

        if (loanIdx !== -1 && newLoanDateString !== undefined) row[loanIdx] = newLoanDateString;
        if (returnIdx !== -1 && newReturnDateString !== undefined) row[returnIdx] = newReturnDateString;

        saveAssetsData(assets);
        logActivity(id, assetType, 'UPDATE_DATE', user, 'Tanggal peminjaman/pengembalian diperbarui');
        return { success: true };
      });
    }

    deleteData(assetType, id, user) {
      return this._async(() => {
        const assets = getAssetsData();
        if (!assets[assetType]) throw new Error('Tipe aset tidak valid.');

        const headers = assets[assetType].headers;
        const idIdx = headers.indexOf('ID');
        const initialLen = assets[assetType].rows.length;
        assets[assetType].rows = assets[assetType].rows.filter(r => String(r[idIdx]) !== String(id));

        if (assets[assetType].rows.length === initialLen) {
          throw new Error('Aset dengan ID tersebut tidak ditemukan.');
        }

        saveAssetsData(assets);
        logActivity(id, assetType, 'DELETE', user, 'Aset dihapus dari sistem');
        return { success: true, message: 'Aset berhasil dihapus.' };
      });
    }

    importBatchData(batchData, user, dryRun = false) {
      return this._async(() => {
        if (!batchData || !Array.isArray(batchData) || batchData.length === 0) {
          throw new Error('Data impor kosong.');
        }

        if (dryRun) {
          return {
            success: true,
            summary: {
              total: batchData.length,
              valid: batchData.length,
              invalid: 0
            }
          };
        }

        const assets = getAssetsData();
        let count = 0;

        batchData.forEach(item => {
          const type = item.SheetName || item.assetType;
          if (type && assets[type]) {
            const sheet = assets[type];
            const headers = sheet.headers;
            const newId = type + '-' + (sheet.rows.length + 1);
            const row = headers.map(h => {
              if (h === 'ID') return item.ID || newId;
              if (h === 'RowIndex') return sheet.rows.length + 2;
              if (h === 'SheetName') return type;
              return item[h] || '';
            });
            sheet.rows.push(row);
            count++;
          }
        });

        saveAssetsData(assets);
        return { success: true, message: `${count} data aset demo berhasil diimpor!` };
      });
    }

    // --- ADMIN METHODS ---

    getAdminUsers(authUser) {
      return this._async(() => {
        const users = getStore('USERS', INITIAL_USERS);
        // Exclude password from view
        const safeUsers = users.map(u => ({
          username: u.username,
          name: u.name,
          role: u.role,
          status: u.status || 'Active',
          lastLogin: u.lastLogin || '-'
        }));
        return { success: true, data: safeUsers };
      });
    }

    saveAdminUser(userData, authUser) {
      return this._async(() => {
        const users = getStore('USERS', INITIAL_USERS);
        const idx = users.findIndex(u => u.username.toLowerCase() === userData.username.toLowerCase());

        if (idx !== -1) {
          // Update
          users[idx].name = userData.name || users[idx].name;
          users[idx].role = userData.role || users[idx].role;
          if (userData.password) users[idx].password = userData.password;
        } else {
          // Create
          users.push({
            username: userData.username,
            name: userData.name || userData.username,
            role: userData.role || 'User',
            password: userData.password || 'password123',
            status: 'Active',
            lastLogin: '-'
          });
        }

        setStore('USERS', users);
        return { success: true, message: 'Pengguna berhasil disimpan!' };
      });
    }

    resetUserSession(username, authUser) {
      return this._async(() => {
        return { success: true, message: `Sesi login pengguna ${username} berhasil di-reset.` };
      });
    }

    deleteAdminUser(username, authUser) {
      return this._async(() => {
        let users = getStore('USERS', INITIAL_USERS);
        users = users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
        setStore('USERS', users);
        return { success: true, message: `Pengguna ${username} berhasil dihapus.` };
      });
    }

    getUISettings() {
      return this._async(() => {
        const settings = getStore('UI_SETTINGS', {
          primaryColor: '#4f46e5',
          appName: 'Aplikasi Inventaris Demo',
          bgImageUrl: ''
        });
        return { success: true, data: settings };
      });
    }

    saveUISettings(settings, authUser) {
      return this._async(() => {
        const current = getStore('UI_SETTINGS', {});
        const updated = Object.assign({}, current, settings);
        setStore('UI_SETTINGS', updated);
        return { success: true, message: 'Pengaturan tema berhasil disimpan!' };
      });
    }

    saveAssetType(inputName, fieldConfigs, dashboardDesign, authUser) {
      return this._async(() => {
        const menuConfig = getMenuConfig();
        const assets = getAssetsData();

        const cleanName = inputName.trim();
        menuConfig[cleanName] = {
          name: cleanName,
          dashboardDesign: dashboardDesign || 'standard',
          fields: fieldConfigs,
          fieldCount: fieldConfigs.length,
          columnWidths: {}
        };

        if (!assets[cleanName]) {
          const customHeaders = fieldConfigs.map(f => f.name);
          const headers = ['ID', ...customHeaders, 'RowIndex', 'SheetName', 'Timestamp', 'Diubah Oleh'];
          assets[cleanName] = {
            headers: Array.from(new Set(headers)),
            rows: []
          };
        }

        setStore('MENU_CONFIG', menuConfig);
        saveAssetsData(assets);
        return { success: true, message: `Jenis aset ${cleanName} berhasil disimpan!` };
      });
    }

    deleteAssetType(typeName, authUser) {
      return this._async(() => {
        const menuConfig = getMenuConfig();
        const assets = getAssetsData();

        delete menuConfig[typeName];
        delete assets[typeName];

        setStore('MENU_CONFIG', menuConfig);
        saveAssetsData(assets);
        return { success: true, message: `Jenis aset ${typeName} berhasil dihapus.` };
      });
    }
  }

  // Pasang window.google.script.run jika belum ada
  if (!window.google) window.google = {};
  if (!window.google.script) window.google.script = {};

  Object.defineProperty(window.google.script, 'run', {
    get: function () {
      return new MockRunner();
    },
    configurable: true
  });

  console.log('[Demo Mode] Mock Google Apps Script backend aktif untuk GitHub Live Demo.');
})();
