<?php
// ============================================================
// backend/api_update_incident.php
// POST → Update incident status
// GET  → Return API info
// ============================================================


require_once __DIR__ . '/config.php';
requireAuth('admin'); // Admin only


if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    jsonSuccess([
        'api'      => 'api_update_incident.php',
        'method'   => 'POST',
        'required' => ['id', 'status'],
        'statuses' => ['ACTIVE', 'ASSIGNED', 'CONTROLLED', 'CLOSED'],
    ], 'Update Incident API ready');
}

$input  = getInput();
$id     = (int)($input['id']     ?? 0);
$status = strtoupper(trim($input['status'] ?? ''));

if ($id <= 0) {
    jsonError('Field "id" is required');
}

$valid = ['ACTIVE', 'ASSIGNED', 'CONTROLLED', 'CLOSED'];
if (!in_array($status, $valid, true)) {
    jsonError('Invalid status. Must be one of: ' . implode(', ', $valid));
}

try {
    $db   = getDB();

    $check = $db->prepare('SELECT id FROM incidents WHERE id = ?');
    $check->execute([$id]);
    if (!$check->fetch()) {
        jsonError('Incident #' . $id . ' not found', 404);
    }

    $db->beginTransaction();

    $db->prepare('UPDATE incidents SET status = ? WHERE id = ?')->execute([$status, $id]);

    // When closing — release all assigned teams back to AVAILABLE
    if ($status === 'CLOSED') {
        $teamStmt = $db->prepare(
            'SELECT team_id FROM assignments WHERE incident_id = ? AND released_at IS NULL'
        );
        $teamStmt->execute([$id]);
        foreach ($teamStmt->fetchAll(PDO::FETCH_COLUMN) as $teamId) {
            $db->prepare('UPDATE rescue_team SET status = "AVAILABLE" WHERE id = ?')
               ->execute([$teamId]);
        }
        $db->prepare('UPDATE assignments SET released_at = NOW() WHERE incident_id = ? AND released_at IS NULL')
           ->execute([$id]);
    }

    $db->commit();

    jsonSuccess(['incident_id' => $id, 'new_status' => $status], 'Incident updated');

} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    jsonError('Database error: ' . $e->getMessage(), 500);
}
