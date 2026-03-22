<?php
// ============================================================
// backend/api_teams.php
// GET          → List all teams
// POST action=add    → Add new team
// POST action=delete → Delete team
// POST action=update_status → Change team status
// ============================================================


require_once __DIR__ . '/config.php';
requireAuth('admin'); // Admin only


$method = $_SERVER['REQUEST_METHOD'];
$input  = ($method === 'POST') ? getInput() : [];
$action = $input['action'] ?? $_GET['action'] ?? 'list';

try {
    $db = getDB();

    // ── LIST ────────────────────────────────────────────────
    if ($method === 'GET' || $action === 'list') {
        $where  = ['1=1'];
        $binds  = [];
        $status = $_GET['status'] ?? '';
        $type   = $_GET['type']   ?? '';

        if ($status !== '') { $where[] = 'status = ?'; $binds[] = strtoupper($status); }
        if ($type   !== '') { $where[] = 'type = ?';   $binds[] = strtolower($type);   }

        $stmt = $db->prepare(
            'SELECT * FROM rescue_team WHERE ' . implode(' AND ', $where) . ' ORDER BY name'
        );
        $stmt->execute($binds);
        $teams = $stmt->fetchAll();

        $counts = ['AVAILABLE' => 0, 'BUSY' => 0, 'TOTAL' => count($teams)];
        foreach ($teams as $t) $counts[$t['status']]++;

        jsonSuccess(['teams' => $teams, 'counts' => $counts], 'Teams fetched');
    }

    // ── ADD ─────────────────────────────────────────────────
    if ($action === 'add') {
        $name     = trim($input['name']     ?? '');
        $type     = trim($input['type']     ?? 'general');
        $location = trim($input['location'] ?? 'Pune');
        $contact  = trim($input['contact']  ?? '');

        if ($name === '') jsonError('Field "name" is required');

        $valid = ['fire','flood','accident','medical','general'];
        if (!in_array($type, $valid, true)) $type = 'general';

        $stmt = $db->prepare(
            'INSERT INTO rescue_team (name, type, status, location, contact) VALUES (?, ?, "AVAILABLE", ?, ?)'
        );
        $stmt->execute([$name, $type, $location, $contact]);
        $id = $db->lastInsertId();

        $row = $db->prepare('SELECT * FROM rescue_team WHERE id = ?');
        $row->execute([$id]);
        jsonSuccess($row->fetch(), 'Team added successfully');
    }

    // ── DELETE ──────────────────────────────────────────────
    if ($action === 'delete') {
        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) jsonError('Field "id" is required');

        // Check not currently on active assignment
        $check = $db->prepare(
            'SELECT id FROM assignments WHERE team_id = ? AND released_at IS NULL'
        );
        $check->execute([$id]);
        if ($check->fetch()) {
            jsonError('Team is currently assigned to an incident. Release it first.');
        }

        $db->prepare('DELETE FROM rescue_team WHERE id = ?')->execute([$id]);
        jsonSuccess(['deleted_id' => $id], 'Team deleted');
    }

    // ── UPDATE STATUS ────────────────────────────────────────
    if ($action === 'update_status') {
        $id     = (int)($input['id']     ?? 0);
        $status = strtoupper(trim($input['status'] ?? ''));
        if ($id <= 0) jsonError('Field "id" is required');
        if (!in_array($status, ['AVAILABLE','BUSY'], true)) {
            jsonError('Status must be AVAILABLE or BUSY');
        }
        $db->prepare('UPDATE rescue_team SET status = ? WHERE id = ?')->execute([$status, $id]);
        jsonSuccess(['id' => $id, 'status' => $status], 'Team status updated');
    }

    jsonError('Unknown action. Use: list, add, delete, update_status');

} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}
