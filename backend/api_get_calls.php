<?php
// ============================================================
// backend/api_get_calls.php
// GET → Fetch all emergency calls (with optional filters)
// ============================================================


require_once __DIR__ . '/config.php';
requireAuth(); // Logged-in users only


// Works on GET (browser) and POST (frontend fetch)
$params = ($_SERVER['REQUEST_METHOD'] === 'POST') ? getInput() : $_GET;

$status = trim($params['status'] ?? '');
$type   = trim($params['type']   ?? '');
$limit  = max(1, min(200, (int)($params['limit']  ?? 100)));
$offset = max(0,          (int)($params['offset'] ?? 0));

try {
    $db     = getDB();
    $where  = ['1=1'];
    $binds  = [];

    if ($status !== '') {
        $where[]  = 'ec.status = ?';
        $binds[]  = strtoupper($status);
    }
    if ($type !== '') {
        $where[]  = 'ec.type = ?';
        $binds[]  = strtolower($type);
    }

    $sql = 'SELECT
                ec.*,
                i.id         AS incident_id,
                i.status     AS incident_status,
                rt.name      AS team_name
            FROM emergency_call ec
            LEFT JOIN incidents   i  ON i.call_id    = ec.id
            LEFT JOIN assignments a  ON a.incident_id = i.id AND a.released_at IS NULL
            LEFT JOIN rescue_team rt ON rt.id         = a.team_id
            WHERE ' . implode(' AND ', $where) . '
            ORDER BY ec.created_at DESC
            LIMIT ? OFFSET ?';

    $binds[] = $limit;
    $binds[] = $offset;

    $stmt = $db->prepare($sql);
    $stmt->execute($binds);
    $calls = $stmt->fetchAll();

    // Count by status
    $countStmt = $db->query(
        'SELECT status, COUNT(*) AS cnt FROM emergency_call GROUP BY status'
    );
    $counts = ['ACTIVE' => 0, 'PROCESSED' => 0, 'CANCELLED' => 0, 'TOTAL' => 0];
    foreach ($countStmt->fetchAll() as $row) {
        $counts[$row['status']] = (int)$row['cnt'];
        $counts['TOTAL'] += (int)$row['cnt'];
    }

    jsonSuccess([
        'calls'  => $calls,
        'counts' => $counts,
        'total'  => count($calls),
    ], 'Calls fetched');

} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}
