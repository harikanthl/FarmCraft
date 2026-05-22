import type { FarmDotsDatabase } from "@/db/types";

import { AUTH_TOKEN_KEY, UnauthorizedError } from "@/auth/authClient";

export { UnauthorizedError };

const API_BASE = "/api/v1";

const COLLECTIONS = [
  "farms",
  "rows",
  "plants",
  "valves",
  "irrigation_events",
  "disease_events",
  "farm_events",
] as const;

function authHeaders(): HeadersInit {
  const t = typeof localStorage !== "undefined" ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

async function ensureOk(res: Response, name: string, op: "push" | "pull"): Promise<void> {
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`${name} ${op}: ${await res.text()}`);
}

export async function pushLocalToCloud(db: FarmDotsDatabase): Promise<void> {
  for (const name of COLLECTIONS) {
    const col = db[name];
    const docs = await col.find().exec();
    const payload = docs.map((d) => d.toJSON());
    const res = await fetch(`${API_BASE}/sync/push`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ collection: name, docs: payload }),
    });
    await ensureOk(res, name, "push");
  }
}

export async function pullCloudToLocal(db: FarmDotsDatabase): Promise<void> {
  for (const name of COLLECTIONS) {
    const res = await fetch(`${API_BASE}/sync/pull?collection=${encodeURIComponent(name)}`, {
      headers: authHeaders(),
    });
    await ensureOk(res, name, "pull");
    const body = (await res.json()) as { docs: Record<string, unknown>[] };
    const col = db[name];
    for (const doc of body.docs) {
      const id = doc.id as string | undefined;
      if (!id) continue;
      await col.upsert(doc as never);
    }
  }
}
