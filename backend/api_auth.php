<?php
// ============================================================
// backend/api_auth.php
// Actions: login | logout | check
// ============================================================
require_once __DIR__ . '/config.php';

$input  = getInput();
$action = $input['action'] ?? $_GET['action'] ?? '';

// ── Safe GET / info ───────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === '') {
    jsonSuccess(['api' => 'api_auth.php', 'actions' => ['login','logout','check']], 'Auth API');
}

// ── CHECK session ─────────────────────────────────────────
if ($action === 'check') {
    $u = sessionUser();
    $u ? jsonSuccess($u, 'Authenticated') : jsonError('Not authenticated', 401);
}

// ── LOGOUT ────────────────────────────────────────────────
if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    jsonSuccess(null, 'Logged out');
}

// ── LOGIN ─────────────────────────────────────────────────
if ($action === 'login') {
    $phone = trim($input['phone']    ?? '');
    $pass  = $input['password']      ?? '';
    $role  = trim($input['role']     ?? 'user');

    if ($phone === '') jsonError('Phone number is required.');
    if ($pass  === '') jsonError('Password is required.');
    if (!in_array($role, ['admin','user'], true)) jsonError('Invalid role selected.');

    try {
        $db   = getDB();
        $stmt = $db->prepare(
            'SELECT id, name, phone, password, role FROM users WHERE phone = ? LIMIT 1'
        );
        $stmt->execute([$phone]);
        $user = $stmt->fetch();

        // Check user exists, role matches, and password is correct
        if (!$user || $user['role'] !== $role || !password_verify($pass, $user['password'])) {
            jsonError('Invalid phone number or password.', 401);
        }

        // Create session — never store password
        $userData = [
            'id'    => (int)$user['id'],
            'name'  => $user['name'],
            'phone' => $user['phone'],
            'role'  => $user['role'],
        ];
        $_SESSION['sos_user'] = $userData;

        jsonSuccess($userData, 'Login successful');

    } catch (PDOException $e) {
        jsonError('Database error: ' . $e->getMessage(), 500);
    }
}

// Default fallback
jsonSuccess(['api' => 'api_auth.php', 'actions' => ['login','logout','check']], 'Auth API');
