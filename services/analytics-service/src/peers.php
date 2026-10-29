<?php
declare(strict_types=1);

/**
 * GET a JSON document from another service.
 * Returns [httpStatus, decodedBody|null]. Status 0 means the service could not be reached.
 */
function http_get_json(string $url, array $headers = []): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => array_merge(['Accept: application/json'], $headers),
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($body === false) {
        return [0, null];
    }
    return [$status, json_decode((string)$body, true)];
}

function internal_headers(): array
{
    return ['X-Internal-Key: ' . env('INTERNAL_API_KEY', 'verve-internal-dev-key')];
}

/** Fetches a list from a sibling service with the internal key; throws if it is unavailable. */
function fetch_list(string $service, string $url): array
{
    [$status, $data] = http_get_json($url, internal_headers());
    if ($status !== 200 || !is_array($data)) {
        throw new RuntimeException("$service returned status $status");
    }
    return $data;
}

/** Stops the request unless the caller is a signed-in ADMIN. */
function require_admin(): void
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if ($header === '') {
        respond(401, ['error' => 'sign in required']);
    }
    [$status, $user] = http_get_json(env('AUTH_URL', 'http://localhost:8081') . '/api/auth/me', ['Authorization: ' . $header]);
    if ($status === 0) {
        respond(503, ['error' => 'auth-service unavailable']);
    }
    if ($status !== 200 || !is_array($user)) {
        respond(401, ['error' => 'sign in required']);
    }
    if (($user['role'] ?? '') !== 'ADMIN') {
        respond(403, ['error' => 'admin access required']);
    }
}
