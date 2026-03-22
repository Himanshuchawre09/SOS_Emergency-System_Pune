<?php
// ============================================================
// backend/api_stats.php
// GET → Return all dashboard statistics from real DB data
// ============================================================


require_once __DIR__ . '/config.php';
requireAuth('admin'); // Admin only


// Works on any HTTP method — always returns stats
try {
    $db = getDB();

    // ── Calls summary ────────────────────────────────────
    $calls = $db->query(
        'SELECT
            COUNT(*)                           AS total,
            SUM(status = "ACTIVE")             AS active,
            SUM(status = "PROCESSED")          AS processed,
            SUM(status = "CANCELLED")          AS cancelled,
            SUM(type   = "fire")               AS fire,
            SUM(type   = "accident")           AS accident,
            SUM(type   = "flood")              AS flood,
            SUM(type   = "medical")            AS medical
         FROM emergency_call'
    )->fetch();

    // ── Incidents summary ─────────────────────────────────
    $incidents = $db->query(
        'SELECT
            COUNT(*)                           AS total,
            SUM(status = "ACTIVE")             AS active,
            SUM(status = "ASSIGNED")           AS assigned,
            SUM(status = "CONTROLLED")         AS controlled,
            SUM(status = "CLOSED")             AS closed
         FROM incidents'
    )->fetch();

    // ── Teams summary ─────────────────────────────────────
    $teams = $db->query(
        'SELECT
            COUNT(*)                           AS total,
            SUM(status = "AVAILABLE")          AS available,
            SUM(status = "BUSY")               AS busy
         FROM rescue_team'
    )->fetch();

    // ── Casualties summary ────────────────────────────────
    $casualties = $db->query(
        'SELECT
            COUNT(*)                           AS total,
            SUM(triage = "red")                AS red,
            SUM(triage = "yellow")             AS yellow,
            SUM(triage = "green")              AS green,
            SUM(triage = "black")              AS black
         FROM casualties'
    )->fetch();

    // ── Hospitals summary ─────────────────────────────────
    $hospitals = $db->query(
        'SELECT COUNT(*) AS total, COALESCE(SUM(beds),0) AS total_beds, COALESCE(SUM(icu),0) AS total_icu FROM hospitals'
    )->fetch();

    // ── Calls by type (for chart) ─────────────────────────
    $callsByType = $db->query(
        'SELECT type, COUNT(*) AS cnt FROM emergency_call GROUP BY type ORDER BY cnt DESC'
    )->fetchAll();

    // ── Calls per day (last 7 days) ───────────────────────
    $callsByDay = $db->query(
        'SELECT DATE(created_at) AS day, COUNT(*) AS cnt
         FROM emergency_call
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         GROUP BY DATE(created_at)
         ORDER BY day ASC'
    )->fetchAll();

    // ── Recent 10 events ─────────────────────────────────
    $recentCalls = $db->query(
        'SELECT id, type, status, caller_name, created_at, "call" AS event_type
         FROM emergency_call
         ORDER BY created_at DESC LIMIT 5'
    )->fetchAll();

    $recentIncidents = $db->query(
        'SELECT id, type, status, location, created_at, "incident" AS event_type
         FROM incidents
         ORDER BY created_at DESC LIMIT 5'
    )->fetchAll();

    $recent = array_merge($recentCalls, $recentIncidents);
    usort($recent, fn($a,$b) => strtotime($b['created_at']) - strtotime($a['created_at']));
    $recent = array_slice($recent, 0, 10);

    jsonSuccess([
        'calls'        => $calls,
        'incidents'    => $incidents,
        'teams'        => $teams,
        'casualties'   => $casualties,
        'hospitals'    => $hospitals,
        'calls_by_type'=> $callsByType,
        'calls_by_day' => $callsByDay,
        'recent'       => $recent,
    ], 'Statistics fetched');

} catch (PDOException $e) {
    jsonError('Database error: ' . $e->getMessage(), 500);
}
