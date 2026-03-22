<?php
// ============================================================
// backend/api_cancel_sos.php
// POST → Cancel an ACTIVE emergency call
// GET  → Return API info
// ============================================================


require_once __DIR__ . '/config.php';
requireAuth(); // Logged-in users only


if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    jsonSuccess([
        'api'      => 'api_cancel_sos.php',
        'method'   => 'POST',
        'required' => ['call_id'],
    ], 'Cancel SOS API ready');
}

$input  = getInput();
$callId = (int)($input['call_id'] ?? 0);

if ($callId <= 0) {
    jsonError('Field "call_id" is required and must be a positive integer');
}

try {
    $db   = getDB();

    // Check call exists and is ACTIVE
    $stmt = $db->prepare('SELECT id, status FROM emergency_call WHERE id = ?');
    $stmt->execute([$callId]);
    $call = $stmt->fetch();

    if (!$call) {
        jsonError('Call #' . $callId . ' not found', 404);
    }
    if ($call['status'] !== 'ACTIVE') {
        jsonError('Call #' . $callId . ' is already ' . $call['status'] . '. Only ACTIVE calls can be cancelled.');
    }

    $db->prepare('UPDATE emergency_call SET status = "CANCELLED" WHERE id = ?')
       ->execute([$callId]);

    jsonSuccess(['call_id' => $callId, 'status' => 'CANCELLED'], 'SOS cancelled successfully');

} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}
