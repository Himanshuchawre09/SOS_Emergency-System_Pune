<?php
// ============================================================
// backend/api_get_incidents.php
// GET/POST → Fetch incidents with joined team/call info
// ============================================================


require_once __DIR__ . '/config.php';
requireAuth(); // Logged-in users only


$params = ($_SERVER['REQUEST_METHOD'] === 'POST') ? getInput() : $_GET;

$status = trim($params['status'] ?? '');
$type   = trim($params['type']   ?? '');
$limit  = max(1, min(200, (int)($params['limit']  ?? 100)));
$offset = max(0,          (int)($params['offset'] ?? 0));

try {
    $db    = getDB();
    $where = ['1=1'];
    $binds = [];

    if ($status !== '') {
        $where[]  = 'i.status = ?';
        $binds[]  = strtoupper($status);
    }
    if ($type !== '') {
        $where[]  = 'i.type = ?';
        $binds[]  = strtolower($type);
    }

    $sql = 'SELECT
                i.*,
                ec.caller_name,
                ec.caller_phone,
                ec.latitude   AS call_lat,
                ec.longitude  AS call_lng,
                GROUP_CONCAT(rt.name SEPARATOR ", ") AS teams
            FROM incidents i
            JOIN emergency_call ec ON ec.id = i.call_id
            LEFT JOIN assignments a  ON a.incident_id = i.id AND a.released_at IS NULL
            LEFT JOIN rescue_team rt ON rt.id = a.team_id
            WHERE ' . implode(' AND ', $where) . '
            GROUP BY i.id
            ORDER BY i.created_at DESC
            LIMIT ? OFFSET ?';

    $binds[] = $limit;
    $binds[] = $offset;

    $stmt = $db->prepare($sql);
    $stmt->execute($binds);
    $incidents = $stmt->fetchAll();

    // Status counts
    $cStmt = $db->query('SELECT status, COUNT(*) AS cnt FROM incidents GROUP BY status');
    $counts = ['ACTIVE' => 0, 'ASSIGNED' => 0, 'CONTROLLED' => 0, 'CLOSED' => 0];
    foreach ($cStmt->fetchAll() as $row) {
        $counts[$row['status']] = (int)$row['cnt'];
    }

    jsonSuccess([
        'incidents' => $incidents,
        'counts'    => $counts,
        'total'     => count($incidents),
    ], 'Incidents fetched');

} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}
