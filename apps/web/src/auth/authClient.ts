/**
 * Thin HTTP wrappers for the worker auth subsystem (r.md §6).
 *
 * All endpoints live under /api/v1/auth. Tokens persist in localStorage under
 * `AUTH_TOKEN_KEY` so existing sync helpers can pick them up without changes.
 */

export const AUTH_TOKEN_KEY = "farmdots_token";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  locale: string | null;
};

export type FarmMembership = {
  farmId: string;
  role: "owner" | "manager" | "worker" | "viewer";
};

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

export function loadStoredToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function storeToken(token: string | null): void {
  if (typeof localStorage === "undefined") return;
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
}

function authHeaders(token: string | null): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function requestLoginCode(email: string): Promise<{ ok: true; devCode?: string }> {
  const res = await fetch("/api/v1/auth/request-login", {
    method: "POST",
    headers: authHeaders(null),
    body: JSON.stringify({ email }),
  });
  return jsonOrThrow(res);
}

export async function verifyLoginCode(
  email: string,
  code: string,
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch("/api/v1/auth/verify", {
    method: "POST",
    headers: authHeaders(null),
    body: JSON.stringify({ email, code }),
  });
  return jsonOrThrow(res);
}

export async function fetchMe(
  token: string,
): Promise<{ user: AuthUser; memberships: FarmMembership[] }> {
  const res = await fetch("/api/v1/auth/me", {
    headers: authHeaders(token),
  });
  return jsonOrThrow(res);
}

export async function endSession(token: string): Promise<void> {
  await fetch("/api/v1/auth/logout", {
    method: "POST",
    headers: authHeaders(token),
  });
}
