const fs = require('fs');
const path = require('path');

function buildDemo() {
  console.log('Building standalone demo (index.html)...');
  
  const rootDir = __dirname;
  let indexHtml = fs.readFileSync(path.join(rootDir, 'Index.html'), 'utf8');
  const styleCss = fs.readFileSync(path.join(rootDir, 'Style.css.html'), 'utf8');
  const mockBackend = fs.readFileSync(path.join(rootDir, 'mock-backend.js'), 'utf8');

  // 1. Replace Style.css
  indexHtml = indexHtml.replace(
    /<\?!= include\('Style\.css'\); \?>/g,
    '<style>\n' + styleCss.replace(/<\/?style>/gi, '') + '\n</style>'
  );

  // 2. Replace Template Variables
  indexHtml = indexHtml.replace(/<\?=\s*appName\s*(\/\/[^?]*)?\?>/g, 'Inventaris Demo');
  indexHtml = indexHtml.replace(/<\?=\s*appName\s*\|\|\s*'Inventaris'\s*\?>/g, 'Inventaris Demo');
  indexHtml = indexHtml.replace(/<\?=\s*primaryColor\s*\|\|\s*'#4f46e5'\s*\?>/g, '#4f46e5');
  indexHtml = indexHtml.replace(/<\?!= bgImageUrl \? 'has-custom-bg' : '' \?>/g, '');
  indexHtml = indexHtml.replace(/<\?!=\s*bgImageUrl\s*\?[\s\S]*?: '' \?>/g, '');

  // 3. Insert mock-backend.js right before JS_Globals include
  const mockScriptTag = '<script>\n' + mockBackend + '\n</script>\n';
  indexHtml = indexHtml.replace(
    /<\?!= include\('JS_Globals'\); \?>/,
    mockScriptTag + "<?!= include('JS_Globals'); ?>"
  );

  // 4. Inject all JS module files
  const jsFiles = [
    'JS_Globals',
    'JS_Utils',
    'JS_Templates',
    'JS_Scanner',
    'JS_Dashboard_Calculations',
    'JS_Dashboard_AssetRenderers_1',
    'JS_Dashboard_AssetRenderers_2',
    'JS_Dashboard_Render',
    'JS_Actions',
    'JS_Forms',
    'JS_Navigation',
    'JS_Admin',
    'JS_App'
  ];

  jsFiles.forEach(name => {
    const filePath = path.join(rootDir, name + '.html');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const tag = new RegExp('<\\?!= include\\(\'' + name + '\'\\); \\?>', 'g');
      indexHtml = indexHtml.replace(tag, content);
    } else {
      console.warn('Warning: file not found:', filePath);
    }
  });

  // 5. Add Live Demo Notice Banner & Quick Login Helper on Login Box
  const demoBanner = `
      <!-- Live Demo Quick Fill Login Helper -->
      <div class="mt-4 p-3 bg-indigo-50 dark:bg-gray-700/60 border border-indigo-200 dark:border-gray-600 rounded-xl text-xs space-y-2">
        <p class="font-semibold text-indigo-900 dark:text-indigo-200 flex items-center">
          <i class="fas fa-info-circle mr-1.5 text-indigo-600 dark:text-indigo-400"></i> Akun Dummy Demo:
        </p>
        <div class="flex gap-2">
          <button type="button" id="quick-login-admin" class="flex-1 py-1 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-center transition font-medium">
            Role: Admin
          </button>
          <button type="button" id="quick-login-user" class="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-center transition font-medium">
            Role: User
          </button>
        </div>
        <p class="text-gray-500 dark:text-gray-400 text-[11px] text-center">
          Admin: <b>admin / admin123</b> &bull; User: <b>user / user123</b>
        </p>
      </div>
  `;

  // Insert after </form> in login-section
  indexHtml = indexHtml.replace('</form>', '</form>\n' + demoBanner);

  // Script to hook the quick login buttons
  const quickLoginScript = `
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      var btnAdmin = document.getElementById('quick-login-admin');
      var btnUser = document.getElementById('quick-login-user');
      var inputUser = document.getElementById('username');
      var inputPass = document.getElementById('password');
      var loginForm = document.getElementById('login-form');

      if (btnAdmin) {
        btnAdmin.addEventListener('click', function() {
          inputUser.value = 'admin';
          inputPass.value = 'admin123';
          loginForm.dispatchEvent(new Event('submit'));
        });
      }
      if (btnUser) {
        btnUser.addEventListener('click', function() {
          inputUser.value = 'user';
          inputPass.value = 'user123';
          loginForm.dispatchEvent(new Event('submit'));
        });
      }
    });
  </script>
  `;

  indexHtml = indexHtml.replace('</body>', quickLoginScript + '\n</body>');

  // Verify no unparsed scriptlets remain
  const remaining = indexHtml.match(/<\?[\s\S]*?\?>/g);
  if (remaining && remaining.length > 0) {
    console.warn('Warning: unparsed scriptlets remaining:', remaining);
  }

  // Write out index.html (root for GitHub Pages)
  const outputPath = path.join(rootDir, 'index.html');
  fs.writeFileSync(outputPath, indexHtml, 'utf8');

  console.log('Successfully created standalone demo:', outputPath);
  console.log('File size:', (indexHtml.length / 1024).toFixed(2), 'KB');
}

buildDemo();
