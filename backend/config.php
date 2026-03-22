<?php
// ============================================================
// backend/config.php  —  SOS Emergency System, Pune 2026
// Fixed: CORS wildcard, session cookie, requireAuth
// ============================================================

// ── Session must start before any headers ────────────────
if (session_status() === PHP_SESSION_NONE) {
    // Simple session — works on plain HTTP localhost
    ini_set('session.cookie_httponly', 1);
    ini_set('session.use_strict_mode', 1);
    session_start();
}

// ── CORS: allow all origins for XAMPP localhost dev ──────
// Must use wildcard OR specific origin — not both
// Because we use credentials, we need specific origin
$origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost';
$allowed = ['http://localhost', 'http://127.0.0.1'];
$originHeader = in_array($origin, $allowed) ? $origin : 'http://localhost';

header('Access-Control-Allow-Origin: ' . $originHeader);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── Database ──────────────────────────────────────────────
define('DB_HOST',    'localhost');
define('DB_NAME',    'sos_pune');
define('DB_USER',    'root');
define('DB_PASS',    '');
define('DB_CHARSET', 'utf8mb4');

// ── PDO singleton ─────────────────────────────────────────
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            echo json_encode([
                'success' => false,
                'error'   => 'Database connection failed. Check MySQL is running. Details: ' . $e->getMessage(),
                'data'    => null,
            ]);
            exit;
        }
    }
    return $pdo;
}

// ── JSON response helpers ─────────────────────────────────
function jsonSuccess($data = null, string $message = 'OK'): void {
    echo json_encode(
        ['success' => true, 'message' => $message, 'data' => $data],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
    );
    exit;
}

function jsonError(string $message, int $code = 400): void {
    http_response_code($code);
    echo json_encode(
        ['success' => false, 'error' => $message, 'data' => null],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

// ── Input parser ──────────────────────────────────────────
function getInput(): array {
    $raw     = file_get_contents('php://input');
    $decoded = $raw ? json_decode($raw, true) : null;
    return is_array($decoded) ? $decoded : ($_POST ?: []);
}

function getField(array $data, string $field): mixed {
    if (!isset($data[$field]) || $data[$field] === '') {
        jsonError("Field '$field' is required.");
    }
    return $data[$field];
}

// ── Session helpers ───────────────────────────────────────
function sessionUser(): ?array {
    return $_SESSION['sos_user'] ?? null;
}

/**
 * requireAuth()          — any logged-in user
 * requireAuth('admin')   — admin only
 */
function requireAuth(string $role = ''): array {
    $user = sessionUser();
    if (!$user) {
        jsonError('Not authenticated. Please log in.', 401);
    }
    if ($role !== '' && $user['role'] !== $role) {
        jsonError('Access denied. Required role: ' . $role, 403);
    }
    return $user;
}
