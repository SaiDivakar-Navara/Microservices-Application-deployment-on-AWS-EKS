<?php
declare(strict_types=1);

const EVENT_TYPES = ['product_view', 'add_to_cart', 'checkout_started', 'search'];

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $dsn = sprintf(
        'pgsql:host=%s;port=%s;dbname=%s;sslmode=%s',
        env('DB_HOST', 'localhost'),
        env('DB_PORT', '5432'),
        env('DB_NAME', 'analytics_db'),
        env('DB_SSLMODE', 'disable')
    );

    for ($attempt = 1; ; $attempt++) {
        try {
            $pdo = new PDO($dsn, env('DB_USER', 'verve'), env('DB_PASSWORD', 'verve_pass'), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            break;
        } catch (PDOException $e) {
            if ($attempt >= 30) {
                throw $e;
            }
            error_log("waiting for database ($attempt/30): " . $e->getMessage());
            sleep(2);
        }
    }

    $pdo->exec('
        CREATE TABLE IF NOT EXISTS events (
            id          BIGSERIAL PRIMARY KEY,
            type        VARCHAR(30) NOT NULL,
            product_id  BIGINT,
            session_id  VARCHAR(64),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    ');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_events_type ON events (type, created_at)');
    return $pdo;
}

function record_event(array $data): void
{
    $type = (string)($data['type'] ?? '');
    if (!in_array($type, EVENT_TYPES, true)) {
        respond(400, ['error' => 'type must be one of: ' . implode(', ', EVENT_TYPES)]);
    }
    $productId = isset($data['product_id']) && is_numeric($data['product_id']) ? (int)$data['product_id'] : null;
    $sessionId = isset($data['session_id']) ? substr((string)$data['session_id'], 0, 64) : null;

    $stmt = db()->prepare('INSERT INTO events (type, product_id, session_id) VALUES (:type, :product_id, :session_id)');
    $stmt->bindValue(':type', $type);
    $stmt->bindValue(':product_id', $productId, $productId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    $stmt->bindValue(':session_id', $sessionId, $sessionId === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
    $stmt->execute();
}
