<?php
// ============================================================
// backend/test.php — CONNECTION DIAGNOSTIC TOOL
// Open: http://localhost/sos_project/backend/test.php
// DELETE this file after debugging!
// ============================================================
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head>
  <title>SOS System — Connection Test</title>
  <style>
    body { font-family: monospace; background:#0b0f1a; color:#e2e8f0; padding:2rem; }
    h1   { color:#38bdf8; margin-bottom:1.5rem; }
    .ok  { color:#34d399; }
    .err { color:#f43f5e; }
    .wrn { color:#fb923c; }
    .box { background:#161d2e; border:1px solid #1e2d47; border-radius:8px;
           padding:1rem 1.5rem; margin-bottom:1rem; }
    .box h2 { font-size:1rem; margin-bottom:.5rem; color:#38bdf8; }
    pre { margin:0; white-space:pre-wrap; font-size:.85rem; }
    .step { display:flex; gap:.75rem; align-items:baseline; padding:.3rem 0; border-bottom:1px solid #1e2d47; }
    .step:last-child { border:none; }
    .lbl { min-width:200px; color:#94a3b8; }
    .val { font-weight:bold; }
  </style>
</head>
<body>
<h1>🔧 SOS System — Connection Diagnostic</h1>

<div class="box">
  <h2>1. PHP Environment</h2>
  <div class="step"><span class="lbl">PHP Version:</span>
    <span class="val <?= version_compare(PHP_VERSION,'7.4','>=') ? 'ok':'err' ?>"><?= PHP_VERSION ?></span>
  </div>
  <div class="step"><span class="lbl">PDO Extension:</span>
    <span class="val <?= extension_loaded('pdo') ? 'ok':'err' ?>"><?= extension_loaded('pdo') ? '✓ Loaded' : '✗ Missing!' ?></span>
  </div>
  <div class="step"><span class="lbl">PDO MySQL:</span>
    <span class="val <?= extension_loaded('pdo_mysql') ? 'ok':'err' ?>"><?= extension_loaded('pdo_mysql') ? '✓ Loaded' : '✗ Missing!' ?></span>
  </div>
  <div class="step"><span class="lbl">Sessions:</span>
    <span class="val <?= function_exists('session_start') ? 'ok':'err' ?>"><?= function_exists('session_start') ? '✓ Available' : '✗ Missing!' ?></span>
  </div>
</div>

<?php
// 2. Database connection test
$dbOk = false;
try {
    $pdo = new PDO('mysql:host=localhost;dbname=sos_pune;charset=utf8mb4','root','', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    $dbOk = true;
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    $userCount = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    $hasPassword = in_array('users', $tables) &&
        $pdo->query("SHOW COLUMNS FROM users LIKE 'password'")->fetch();
} catch (PDOException $e) {
    $dbError = $e->getMessage();
}
?>

<div class="box">
  <h2>2. Database Connection</h2>
  <div class="step"><span class="lbl">MySQL Connect:</span>
    <span class="val <?= $dbOk ? 'ok' : 'err' ?>"><?= $dbOk ? '✓ Connected to sos_pune' : '✗ FAILED: ' . ($dbError ?? 'unknown') ?></span>
  </div>
  <?php if ($dbOk): ?>
  <div class="step"><span class="lbl">Tables found:</span>
    <span class="val ok"><?= implode(', ', $tables) ?: 'None — run schema.sql first!' ?></span>
  </div>
  <div class="step"><span class="lbl">Users table:</span>
    <span class="val <?= in_array('users',$tables) ? 'ok':'err' ?>"><?= in_array('users',$tables) ? '✓ Exists' : '✗ Missing! Import schema.sql' ?></span>
  </div>
  <div class="step"><span class="lbl">Password column:</span>
    <span class="val <?= $hasPassword ? 'ok':'err' ?>"><?= $hasPassword ? '✓ Present' : '✗ Missing! Drop & re-import schema.sql' ?></span>
  </div>
  <div class="step"><span class="lbl">User count:</span>
    <span class="val <?= $userCount > 0 ? 'ok':'wrn' ?>"><?= $userCount > 0 ? '✓ ' . $userCount . ' user(s) exist' : '⚠ 0 users — import schema.sql to add default admin' ?></span>
  </div>
  <?php endif; ?>
</div>

<?php
// 3. Session test
session_start();
$_SESSION['test_key'] = 'working_' . time();
?>
<div class="box">
  <h2>3. Session Test</h2>
  <div class="step"><span class="lbl">Session ID:</span>
    <span class="val ok"><?= session_id() ?: 'Failed' ?></span>
  </div>
  <div class="step"><span class="lbl">Session write:</span>
    <span class="val <?= isset($_SESSION['test_key']) ? 'ok':'err' ?>"><?= isset($_SESSION['test_key']) ? '✓ Working' : '✗ Failed' ?></span>
  </div>
  <div class="step"><span class="lbl">Session save path:</span>
    <span class="val"><?= session_save_path() ?: sys_get_temp_dir() ?></span>
  </div>
</div>

<?php
// 4. File permissions
$backendDir = __DIR__;
?>
<div class="box">
  <h2>4. File Paths</h2>
  <div class="step"><span class="lbl">Backend dir:</span><span class="val ok"><?= $backendDir ?></span></div>
  <div class="step"><span class="lbl">api_register.php:</span>
    <span class="val <?= file_exists($backendDir.'/api_register.php') ? 'ok':'err' ?>">
      <?= file_exists($backendDir.'/api_register.php') ? '✓ Exists' : '✗ MISSING' ?>
    </span>
  </div>
  <div class="step"><span class="lbl">api_auth.php:</span>
    <span class="val <?= file_exists($backendDir.'/api_auth.php') ? 'ok':'err' ?>">
      <?= file_exists($backendDir.'/api_auth.php') ? '✓ Exists' : '✗ MISSING' ?>
    </span>
  </div>
  <div class="step"><span class="lbl">config.php:</span>
    <span class="val <?= file_exists($backendDir.'/config.php') ? 'ok':'err' ?>">
      <?= file_exists($backendDir.'/config.php') ? '✓ Exists' : '✗ MISSING' ?>
    </span>
  </div>
</div>

<div class="box">
  <h2>5. Quick Fix Checklist</h2>
  <pre>
<?php if (!$dbOk): ?>
<span class="err">✗ MySQL is NOT running or sos_pune database doesn't exist.</span>
  → Open XAMPP Control Panel
  → Click START next to MySQL
  → Open phpMyAdmin → Create database "sos_pune"
  → Import database/schema.sql
<?php elseif (!in_array('users', $tables ?? [])): ?>
<span class="err">✗ Tables are missing. You need to import the schema.</span>
  → Open phpMyAdmin → select sos_pune → Import → database/schema.sql
<?php elseif (!$hasPassword): ?>
<span class="err">✗ The users table is MISSING the password column.</span>
  → The old schema is loaded. Drop the database and re-import schema.sql
  → phpMyAdmin → sos_pune → Operations → Drop database
  → Then re-import database/schema.sql
<?php elseif ($userCount == 0): ?>
<span class="wrn">⚠ No users exist yet. The schema.sql INSERT may have failed.</span>
  → Run this in phpMyAdmin SQL tab:
  INSERT INTO users (name,phone,password,role)
  VALUES ('Admin','9000000000','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','admin');
  → Default password = "password"
<?php else: ?>
<span class="ok">✓ Everything looks good! The system should work.</span>
  → Try registering at: http://localhost/sos_project/frontend/register.html
  → Admin login at:    http://localhost/sos_project/frontend/index.html
  → Admin phone: 9000000000 | Password: password
<?php endif; ?>
  </pre>
</div>

<div class="box" style="border-color:#f43f5e22">
  <h2 style="color:#f43f5e">⚠ Delete this file in production!</h2>
  <pre style="color:#94a3b8">rm /path/to/sos_project/backend/test.php</pre>
</div>
</body>
</html>
