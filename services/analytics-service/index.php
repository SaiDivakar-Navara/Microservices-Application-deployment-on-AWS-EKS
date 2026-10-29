<?php
declare(strict_types=1);

// Entry point for PHP's built-in web server: php -S 0.0.0.0:8087 index.php
require __DIR__ . '/src/helpers.php';
require __DIR__ . '/src/database.php';
require __DIR__ . '/src/peers.php';
require __DIR__ . '/src/summary.php';

header('Content-Type: application/json');

$path = rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/') ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET' && ($path === '/health' || $path === '/api/analytics/health')) {
        db()->query('SELECT 1');
        respond(200, ['service' => 'analytics-service', 'status' => 'UP', 'language' => 'PHP']);
    }

    // Storefront events (product views, add-to-cart, ...). Public and fire-and-forget.
    if ($method === 'POST' && $path === '/api/analytics/events') {
        record_event(json_input());
        respond(202, ['status' => 'accepted']);
    }

    // Dashboard numbers for the admin area.
    if ($method === 'GET' && $path === '/api/analytics/summary') {
        require_admin();
        respond(200, build_summary());
    }

    respond(404, ['error' => "no route for $method $path"]);
} catch (Throwable $e) {
    error_log('analytics-service error: ' . $e->getMessage());
    respond(500, ['error' => 'internal server error']);
}
