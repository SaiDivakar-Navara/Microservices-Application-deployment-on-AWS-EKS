<?php
declare(strict_types=1);

function env(string $key, string $fallback): string
{
    $value = getenv($key);
    return ($value === false || $value === '') ? $fallback : $value;
}

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
    exit;
}

function json_input(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw === false ? '' : $raw, true);
    if (!is_array($data)) {
        respond(400, ['error' => 'request body is not valid JSON']);
    }
    return $data;
}
