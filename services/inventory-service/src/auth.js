const AUTH_URL = process.env.AUTH_URL || "http://localhost:8081";
export const INTERNAL_KEY = process.env.INTERNAL_API_KEY || "verve-internal-dev-key";

/** Only other services (holding the shared key) may call this route. */
export function internalOnly(req, res, next) {
  if (req.get("X-Internal-Key") !== INTERNAL_KEY) {
    return res.status(403).json({ error: "internal endpoint" });
  }
  next();
}

/** Only signed-in ADMIN users (or other services holding the key) may call this route. */
export async function adminOnly(req, res, next) {
  if (req.get("X-Internal-Key") === INTERNAL_KEY) return next();
  const header = req.get("Authorization");
  if (!header) return res.status(401).json({ error: "sign in required" });
  try {
    const resp = await fetch(`${AUTH_URL}/api/auth/me`, {
      headers: { Authorization: header },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return res.status(401).json({ error: "sign in required" });
    const user = await resp.json();
    if (user.role !== "ADMIN") return res.status(403).json({ error: "admin access required" });
    req.user = user;
    next();
  } catch {
    res.status(503).json({ error: "auth-service unavailable" });
  }
}
