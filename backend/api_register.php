<?php
// ============================================================
// backend/api_register.php
// POST: Register a new citizen
// GET:  Return API info (safe browser access)
// ============================================================
require_once __DIR__ . '/config.php';

// Safe browser direct access
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    jsonSuccess([
        'api'    => 'api_register.php',
        'method' => 'POST',
        'fields' => ['name', 'phone', 'password', 'confirm_password'],
    ], 'Register API ready');
}

$input = getInput();

$name    = trim($input['name']             ?? '');
$phone   = trim($input['phone']            ?? '');
$pass    = $input['password']              ?? '';
$confirm = $input['confirm_password']      ?? '';

// ── Server-side validation ────────────────────────────────
if ($name === '')          jsonError('Full name is required.');
if (strlen($name) < 2)    jsonError('Name must be at least 2 characters.');
if ($phone === '')         jsonError('Phone number is required.');
if (!preg_match('/^[6-9]\d{9}$/', $phone))
    jsonError('Enter a valid 10-digit Indian mobile number (starting with 6–9).');
if ($pass === '')          jsonError('Password is required.');
if (strlen($pass) < 6)    jsonError('Password must be at least 6 characters.');
if ($pass !== $confirm)    jsonError('Passwords do not match.');

try {
    $db = getDB();

    // Check for duplicate phone
    $chk = $db->prepare('SELECT id FROM users WHERE phone = ? LIMIT 1');
    $chk->execute([$phone]);
    if ($chk->fetch()) {
        jsonError('This phone number is already registered. Please log in instead.');
    }

    // Hash and insert
    $hash = password_hash($pass, PASSWORD_BCRYPT);
    $ins  = $db->prepare(
        'INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, "user")'
    );
    $ins->execute([$name, $phone, $hash]);
    $userId = (int) $db->lastInsertId();

    // Auto-login: store in session
    $userData = [
        'id'    => $userId,
        'name'  => $name,
        'phone' => $phone,
        'role'  => 'user',
    ];
    $_SESSION['sos_user'] = $userData;

    jsonSuccess($userData, 'Account created successfully! Welcome, ' . $name);

} catch (PDOException $e) {
    jsonError('Registration failed: ' . $e->getMessage(), 500);
}
