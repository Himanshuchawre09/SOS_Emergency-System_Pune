<?php
// ============================================================
// backend/api_hospitals.php
// GET          → List all hospitals
// POST action=add    → Add hospital
// POST action=delete → Delete hospital
// POST action=update → Update bed counts
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
        $stmt = $db->query('SELECT * FROM hospitals ORDER BY name');
        $hospitals = $stmt->fetchAll();
        $totals = ['hospitals' => count($hospitals), 'total_beds' => 0, 'total_icu' => 0];
        foreach ($hospitals as $h) {
            $totals['total_beds'] += (int)$h['beds'];
            $totals['total_icu']  += (int)$h['icu'];
        }
        jsonSuccess(['hospitals' => $hospitals, 'totals' => $totals], 'Hospitals fetched');
    }

    // ── ADD ─────────────────────────────────────────────────
    if ($action === 'add') {
        $name     = trim($input['name']     ?? '');
        $location = trim($input['location'] ?? 'Pune');
        $beds     = max(0, (int)($input['beds']    ?? 0));
        $icu      = max(0, (int)($input['icu']     ?? 0));
        $contact  = trim($input['contact']  ?? '');

        if ($name     === '') jsonError('Field "name" is required');
        if ($location === '') jsonError('Field "location" is required');

        $stmt = $db->prepare(
            'INSERT INTO hospitals (name, beds, icu, location, contact) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$name, $beds, $icu, $location, $contact]);
        $id = $db->lastInsertId();

        $row = $db->prepare('SELECT * FROM hospitals WHERE id = ?');
        $row->execute([$id]);
        jsonSuccess($row->fetch(), 'Hospital added successfully');
    }

    // ── DELETE ──────────────────────────────────────────────
    if ($action === 'delete') {
        $id = (int)($input['id'] ?? 0);
        if ($id <= 0) jsonError('Field "id" is required');
        $db->prepare('DELETE FROM hospitals WHERE id = ?')->execute([$id]);
        jsonSuccess(['deleted_id' => $id], 'Hospital deleted');
    }

    // ── UPDATE ──────────────────────────────────────────────
    if ($action === 'update') {
        $id   = (int)($input['id']   ?? 0);
        $beds = max(0, (int)($input['beds'] ?? 0));
        $icu  = max(0, (int)($input['icu']  ?? 0));
        if ($id <= 0) jsonError('Field "id" is required');
        $db->prepare('UPDATE hospitals SET beds = ?, icu = ? WHERE id = ?')
           ->execute([$beds, $icu, $id]);
        jsonSuccess(['id' => $id, 'beds' => $beds, 'icu' => $icu], 'Hospital updated');
    }

    jsonError('Unknown action. Use: list, add, delete, update');

} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}
