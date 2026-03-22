<?php
// ============================================================
// backend/api_assign_team.php
// POST → Assign a rescue team to an incident
// GET  → Return API info
// ============================================================


require_once __DIR__ . '/config.php';
requireAuth('admin'); // Admin only


if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    jsonSuccess([
        'api'      => 'api_assign_team.php',
        'method'   => 'POST',
        'required' => ['incident_id', 'team_id'],
    ], 'Assign Team API ready');
}

$input      = getInput();
$incidentId = (int)($input['incident_id'] ?? 0);
$teamId     = (int)($input['team_id']     ?? 0);

if ($incidentId <= 0) jsonError('Field "incident_id" is required');
if ($teamId     <= 0) jsonError('Field "team_id" is required');

try {
    $db = getDB();

    // Validate incident
    $stmt = $db->prepare('SELECT id, status FROM incidents WHERE id = ?');
    $stmt->execute([$incidentId]);
    $incident = $stmt->fetch();
    if (!$incident)                         jsonError('Incident #' . $incidentId . ' not found', 404);
    if ($incident['status'] === 'CLOSED')   jsonError('Cannot assign team to a CLOSED incident');

    // Validate team
    $stmt = $db->prepare('SELECT id, name, status FROM rescue_team WHERE id = ?');
    $stmt->execute([$teamId]);
    $team = $stmt->fetch();
    if (!$team)                             jsonError('Team #' . $teamId . ' not found', 404);
    if ($team['status'] !== 'AVAILABLE')    jsonError('Team "' . $team['name'] . '" is not AVAILABLE (current: ' . $team['status'] . ')');

    // Check not already assigned to this incident
    $dup = $db->prepare(
        'SELECT id FROM assignments WHERE incident_id = ? AND team_id = ? AND released_at IS NULL'
    );
    $dup->execute([$incidentId, $teamId]);
    if ($dup->fetch()) {
        jsonError('Team "' . $team['name'] . '" is already assigned to incident #' . $incidentId);
    }

    $db->beginTransaction();

    // Create assignment
    $db->prepare('INSERT INTO assignments (incident_id, team_id) VALUES (?, ?)')
       ->execute([$incidentId, $teamId]);
    $assignmentId = $db->lastInsertId();

    // Mark team as BUSY
    $db->prepare('UPDATE rescue_team SET status = "BUSY" WHERE id = ?')->execute([$teamId]);

    // Mark incident as ASSIGNED
    $db->prepare('UPDATE incidents SET status = "ASSIGNED" WHERE id = ?')->execute([$incidentId]);

    $db->commit();

    // Return full assignment details
    $row = $db->prepare(
        'SELECT a.*,
                rt.name     AS team_name,
                rt.type     AS team_type,
                rt.location AS team_location,
                i.type      AS incident_type,
                i.location  AS incident_location,
                i.status    AS incident_status
         FROM assignments a
         JOIN rescue_team rt ON rt.id = a.team_id
         JOIN incidents   i  ON i.id  = a.incident_id
         WHERE a.id = ?'
    );
    $row->execute([$assignmentId]);

    jsonSuccess($row->fetch(), 'Team assigned and dispatched successfully');

} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    jsonError('Database error: ' . $e->getMessage(), 500);
}
