const TOKEN_KEY = "verve.token";

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode: the session simply will not survive a reload */
    }
  },
};

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

/**
 * Calls /api/<service><path>. Every service serves its routes under its own /api/<service> prefix,
 * so the same URL works in Vite dev, Docker Compose and behind the ALB on EKS.
 */
export async function api(service, path, { method = "GET", body, params, quiet = false } = {}) {
  const query = params
    ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString()
    : "";
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`/api/${service}${path}${query}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return null;
  let data = null;
  try {
    data = await response.json();
  } catch {
    /* empty or non-JSON body */
  }

  if (!response.ok) {
    if (response.status === 401 && token && !quiet) onUnauthorized();
    throw new ApiError(response.status, data?.error || `Request failed (${response.status})`, data);
  }
  return data;
}
