/**
 * Auth subsystem (r.md §6) — passwordless email + 6-digit code.
 *
 * Storage lives entirely in D1:
 *   - `users`         canonical identity
 *   - `sessions`      one row per signed-in device (token PK)
 *   - `login_codes`   short-lived one-time codes
 *   - `farm_members`  farm-scoped role assignments
 *
 * Email delivery uses Cloudflare-native Mailchannels when `EMAIL_FROM` is
 * configured; otherwise (or when `AUTH_DEV_MODE=true`) the code is returned in
 * the JSON response so local-dev keeps working.
 */
import type { Env } from "./repo.js";

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

const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const DEV_USER_ID = "dev-user";
const DEV_USER_EMAIL = "dev@local.farmdots";

/** Random URL-safe token using the Web Crypto APIs available in Workers. */
export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomLoginCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

function normaliseEmail(input: string): string | null {
  const v = input.trim().toLowerCase();
  if (v.length < 3 || v.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
}

/** Strip expired sessions / codes opportunistically. Safe to call from any request. */
async function gc(env: Env, nowMs: number): Promise<void> {
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(nowMs).run();
  await env.DB.prepare("DELETE FROM login_codes WHERE expires_at < ?").bind(nowMs).run();
}

export async function requestLogin(
  env: Env,
  email: string,
): Promise<{ ok: true; devCode?: string } | { ok: false; error: string; status: number }> {
  const e = normaliseEmail(email);
  if (!e) return { ok: false, error: "invalid email", status: 400 };
  const nowMs = Date.now();
  await gc(env, nowMs);
  const code = randomLoginCode();
  await env.DB.prepare(
    `INSERT INTO login_codes (email, code, created_at, expires_at, attempts) VALUES (?, ?, ?, ?, 0)`,
  )
    .bind(e, code, nowMs, nowMs + CODE_TTL_MS)
    .run();

  const devMode = env.AUTH_DEV_MODE === "true" || env.AUTH_DEV_MODE === "1";
  const sender = env.EMAIL_FROM;
  let emailed = false;
  if (sender) {
    try {
      await sendLoginCodeEmail(sender, e, code);
      emailed = true;
    } catch (err) {
      if (!devMode) {
        return {
          ok: false,
          error: `failed to send email: ${err instanceof Error ? err.message : String(err)}`,
          status: 502,
        };
      }
    }
  }
  if (devMode || (!emailed && !sender)) return { ok: true, devCode: code };
  return { ok: true };
}

export async function verifyLogin(
  env: Env,
  email: string,
  code: string,
  deviceLabel?: string,
): Promise<
  | { ok: true; token: string; user: AuthUser }
  | { ok: false; error: string; status: number }
> {
  const e = normaliseEmail(email);
  if (!e) return { ok: false, error: "invalid email", status: 400 };
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "invalid code", status: 400 };

  const nowMs = Date.now();
  await gc(env, nowMs);

  const row = await env.DB.prepare(
    `SELECT email, code, expires_at, attempts FROM login_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(e)
    .first<{ email: string; code: string; expires_at: number; attempts: number }>();
  if (!row) return { ok: false, error: "no pending code", status: 400 };
  if (row.expires_at < nowMs) {
    await env.DB.prepare("DELETE FROM login_codes WHERE email = ?").bind(e).run();
    return { ok: false, error: "code expired", status: 400 };
  }
  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    await env.DB.prepare("DELETE FROM login_codes WHERE email = ?").bind(e).run();
    return { ok: false, error: "too many attempts", status: 429 };
  }
  if (row.code !== code) {
    await env.DB.prepare(
      `UPDATE login_codes SET attempts = attempts + 1 WHERE email = ? AND code = ?`,
    )
      .bind(e, row.code)
      .run();
    return { ok: false, error: "wrong code", status: 401 };
  }

  await env.DB.prepare("DELETE FROM login_codes WHERE email = ?").bind(e).run();

  let user = await env.DB.prepare(
    `SELECT id, email, name, locale FROM users WHERE email = ?`,
  )
    .bind(e)
    .first<{ id: string; email: string; name: string | null; locale: string | null }>();
  if (!user) {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, locale, created_at, updated_at) VALUES (?, ?, NULL, NULL, ?, ?)`,
    )
      .bind(id, e, nowMs, nowMs)
      .run();
    user = { id, email: e, name: null, locale: null };
  }

  const token = randomToken(32);
  await env.DB.prepare(
    `INSERT INTO sessions (token, user_id, created_at, expires_at, last_used_at) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(token, user.id, nowMs, nowMs + SESSION_TTL_MS, nowMs)
    .run();

  void deviceLabel;
  return { ok: true, token, user };
}

export async function getUserBySession(env: Env, token: string): Promise<AuthUser | null> {
  if (!token) return null;
  const nowMs = Date.now();
  const row = await env.DB.prepare(
    `SELECT s.token, s.expires_at, u.id, u.email, u.name, u.locale
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`,
  )
    .bind(token)
    .first<{
      token: string;
      expires_at: number;
      id: string;
      email: string;
      name: string | null;
      locale: string | null;
    }>();
  if (!row) return null;
  if (row.expires_at < nowMs) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return null;
  }
  await env.DB.prepare("UPDATE sessions SET last_used_at = ? WHERE token = ?")
    .bind(nowMs, token)
    .run();
  return { id: row.id, email: row.email, name: row.name, locale: row.locale };
}

export async function logout(env: Env, token: string): Promise<void> {
  if (!token) return;
  await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

export async function listMemberships(env: Env, userId: string): Promise<FarmMembership[]> {
  const res = await env.DB.prepare(
    `SELECT farm_id, role FROM farm_members WHERE user_id = ?`,
  )
    .bind(userId)
    .all();
  return (res.results ?? []).map((r) => ({
    farmId: String((r as Record<string, unknown>).farm_id),
    role: String((r as Record<string, unknown>).role) as FarmMembership["role"],
  }));
}

export async function recordFarmOwnership(
  env: Env,
  farmId: string,
  userId: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO farm_members (farm_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)`,
  )
    .bind(farmId, userId, Date.now())
    .run();
}

const ROLE_RANK: Record<FarmMembership["role"], number> = {
  viewer: 0,
  worker: 1,
  manager: 2,
  owner: 3,
};

export async function assertFarmAccess(
  env: Env,
  userId: string,
  farmId: string,
  minRole: FarmMembership["role"] = "viewer",
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (userId === DEV_USER_ID) return { ok: true };
  const member = await env.DB.prepare(
    `SELECT role FROM farm_members WHERE farm_id = ? AND user_id = ?`,
  )
    .bind(farmId, userId)
    .first<{ role: FarmMembership["role"] }>();
  if (!member) {
    const owner = await env.DB.prepare(
      `SELECT owner_id FROM farms WHERE id = ?`,
    )
      .bind(farmId)
      .first<{ owner_id: string }>();
    if (!owner) return { ok: false, status: 404, error: "farm not found" };
    if (owner.owner_id !== userId) return { ok: false, status: 403, error: "forbidden" };
    return { ok: true };
  }
  if (ROLE_RANK[member.role] < ROLE_RANK[minRole]) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true };
}

/** Resolve the authenticated user from a request. Returns the synthetic dev user
 * id when `AUTH_DEV_TOKEN` is configured and matches the bearer header. */
export async function resolveRequestUser(
  env: Env,
  authHeader: string | undefined,
): Promise<AuthUser | null> {
  const raw = authHeader?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!raw) return null;
  const devToken = env.AUTH_DEV_TOKEN;
  if (devToken && raw === devToken) {
    return { id: DEV_USER_ID, email: DEV_USER_EMAIL, name: "Dev", locale: null };
  }
  return getUserBySession(env, raw);
}

export const DEV_USER = { id: DEV_USER_ID, email: DEV_USER_EMAIL } as const;

async function sendLoginCodeEmail(from: string, to: string, code: string): Promise<void> {
  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from, name: "FarmDots" },
    subject: `FarmDots sign-in code: ${code}`,
    content: [
      {
        type: "text/plain",
        value: `Your FarmDots sign-in code is ${code}. It expires in 15 minutes.\n\nIf you didn't request this, you can ignore this email.`,
      },
    ],
  };
  const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`mailchannels ${res.status}: ${await res.text()}`);
  }
}
