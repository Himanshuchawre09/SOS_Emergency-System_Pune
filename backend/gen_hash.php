<?php
// ============================================================
// gen_hash.php — ONE-TIME HELPER to generate bcrypt hashes
// Usage: http://localhost/sos_project/backend/gen_hash.php?p=YourPassword
// DELETE this file in production!
// ============================================================
header('Content-Type: text/plain');

$pass = $_GET['p'] ?? 'Admin@2026';
$hash = password_hash($pass, PASSWORD_BCRYPT);

echo "Password : " . htmlspecialchars($pass) . PHP_EOL;
echo "Hash     : " . $hash . PHP_EOL;
echo PHP_EOL;
echo "SQL to update admin:" . PHP_EOL;
echo "UPDATE users SET password = '" . $hash . "' WHERE phone = '9000000000';" . PHP_EOL;
echo PHP_EOL;
echo "Verify test: " . (password_verify($pass, $hash) ? "PASS" : "FAIL") . PHP_EOL;
echo PHP_EOL;
echo "DELETE THIS FILE IN PRODUCTION!";
