<?php
// Quick connectivity test — open in browser to verify PHP works
// http://localhost/sos_project/backend/ping.php
header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'message' => 'PHP is working!',
    'php'     => PHP_VERSION,
    'time'    => date('Y-m-d H:i:s'),
    'db_test' => (function() {
        try {
            $pdo = new PDO('mysql:host=localhost;dbname=sos_pune;charset=utf8mb4','root','',
                [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
            $count = $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
            return 'Connected! Users in DB: ' . $count;
        } catch (Exception $e) {
            return 'DB Error: ' . $e->getMessage();
        }
    })(),
]);
