<?php
// ============================================================
// backend/api_log_call.php
// POST → Insert a new SOS call into emergency_call
// GET  → Return API info (never crashes in browser)
// ============================================================

require_once __DIR__ . '/config.php';
requireAuth(); // Any logged-in user can submit SOS

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Safe browser access — return info, not an error
    jsonSuccess([
        'api'      => 'api_log_call.php',
        'method'   => 'POST',
        'fields'   => ['type', 'latitude', 'longitude', 'caller_name', 'caller_phone', 'address'],
        'required' => ['type', 'latitude', 'longitude'],
    ], 'SOS Log API ready');
}

// ── POST: log the SOS ─────────────────────────────────────
$input = getInput();

// Validate required fields
$type = trim($input['type'] ?? '');
$lat  = $input['latitude']  ?? null;
$lng  = $input['longitude'] ?? null;

if (!$type) {
    jsonError('Field "type" is required (fire, accident, flood, medical)');
}

$validTypes = ['fire', 'accident', 'flood', 'medical'];
if (!in_array($type, $validTypes, true)) {
    jsonError('Invalid type. Must be one of: fire, accident, flood, medical');
}

if ($lat === null || $lng === null) {
    jsonError('Fields "latitude" and "longitude" are required');
}

$lat  = (float) $lat;
$lng  = (float) $lng;
$name = trim($input['caller_name']  ?? 'Anonymous');
$phone= trim($input['caller_phone'] ?? '');
$addr = trim($input['address']      ?? '');

// Fallback to Pune centre if invalid coords
if ($lat === 0.0 && $lng === 0.0) {
    $lat = 18.5204;
    $lng = 73.8567;
}

try {
    $db   = getDB();
    $stmt = $db->prepare(
        'INSERT INTO emergency_call
            (caller_name, caller_phone, type, latitude, longitude, address, status)
         VALUES (?, ?, ?, ?, ?, ?, "ACTIVE")'
    );
    $stmt->execute([$name, $phone, $type, $lat, $lng, $addr]);
    $id = $db->lastInsertId();

    // Return the newly created call
    $row = $db->prepare('SELECT * FROM emergency_call WHERE id = ?');
    $row->execute([$id]);
    $call = $row->fetch();

    jsonSuccess($call, 'SOS call logged successfully');

} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}
