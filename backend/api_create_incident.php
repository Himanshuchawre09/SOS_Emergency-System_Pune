<?php
// ============================================================
// backend/api_create_incident.php
// POST → Convert a call into a formal incident
// GET  → Return API info
// ============================================================


require_once __DIR__ . '/config.php';
requireAuth('admin'); // Admin only


if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    jsonSuccess([
        'api'      => 'api_create_incident.php',
        'method'   => 'POST',
        'required' => ['call_id'],
        'optional' => ['severity (1-5)', 'location', 'notes'],
    ], 'Create Incident API ready');
}

$input    = getInput();
$callId   = (int)($input['call_id']  ?? 0);
$severity = (int)($input['severity'] ?? 3);
$location = trim($input['location']  ?? '');
$notes    = trim($input['notes']     ?? '');

if ($callId <= 0) {
    jsonError('Field "call_id" is required');
}
if ($severity < 1 || $severity > 5) {
    $severity = 3; // default to moderate
}

try {
    $db = getDB();

    // Get the call
    $stmt = $db->prepare('SELECT * FROM emergency_call WHERE id = ?');
    $stmt->execute([$callId]);
    $call = $stmt->fetch();

    if (!$call) {
        jsonError('Emergency call #' . $callId . ' not found', 404);
    }
    if ($call['status'] === 'CANCELLED') {
        jsonError('Cannot create incident from a CANCELLED call');
    }
    if ($call['status'] === 'PROCESSED') {
        jsonError('Call #' . $callId . ' already has an incident');
    }

    // Check no existing incident for this call
    $check = $db->prepare('SELECT id FROM incidents WHERE call_id = ?');
    $check->execute([$callId]);
    if ($check->fetch()) {
        jsonError('An incident already exists for call #' . $callId);
    }

    // Use call data if location not provided
    $incLocation = $location ?: ($call['address'] ?: ('Lat: ' . $call['latitude'] . ', Lng: ' . $call['longitude']));

    $db->beginTransaction();

    // Insert incident
    $stmt = $db->prepare(
        'INSERT INTO incidents (call_id, type, severity, location, latitude, longitude, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, "ACTIVE", ?)'
    );
    $stmt->execute([
        $callId,
        $call['type'],
        $severity,
        $incLocation,
        $call['latitude'],
        $call['longitude'],
        $notes,
    ]);
    $incidentId = $db->lastInsertId();

    // Mark call as PROCESSED
    $db->prepare('UPDATE emergency_call SET status = "PROCESSED" WHERE id = ?')
       ->execute([$callId]);

    $db->commit();

    // Return the new incident
    $row = $db->prepare('SELECT * FROM incidents WHERE id = ?');
    $row->execute([$incidentId]);

    jsonSuccess($row->fetch(), 'Incident created successfully');

} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    jsonError('Database error: ' . $e->getMessage(), 500);
}
