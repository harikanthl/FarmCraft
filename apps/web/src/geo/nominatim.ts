/** OpenStreetMap Nominatim search — follow https://operations.osmfoundation.org/policies/nominatim/ */

function compactForCompare(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

/** Levenshtein distance for short place tokens (≤64 chars). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length]!;
}

/**
 * Nominatim `display_name` often lists the same locality twice under different spellings
 * (e.g. "Pulivendula, Pulivendla"). Collapse consecutive segments that are the same or
 * trivial spelling variants so the navbar location reads once.
 */
export function simplifyNominatimDisplayName(displayName: string): string {
  const parts = displayName.split(",").map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    if (last === undefined) {
      out.push(p);
      continue;
    }
    const a = compactForCompare(last);
    const b = compactForCompare(p);
    if (a === b) continue;
    const minLen = Math.min(a.length, b.length);
    const maxLen = Math.max(a.length, b.length);
    let isVariant = false;
    if (minLen >= 5 && (a.includes(b) || b.includes(a)) && maxLen - minLen <= 2) {
      isVariant = true;
    } else if (minLen >= 8) {
      const d = levenshtein(a, b);
      const threshold = Math.max(1, Math.floor(maxLen * 0.15));
      if (d <= threshold) isVariant = true;
    }
    if (isVariant) {
      if (p.trim().length > last.trim().length) out[out.length - 1] = p;
      continue;
    }
    out.push(p);
  }
  return out.join(", ");
}

export type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
  place_id?: number;
};

export async function searchNominatim(query: string): Promise<NominatimHit[]> {
  const q = query.trim();
  if (!q) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "8");
  url.searchParams.set("addressdetails", "0");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
      /** Required by Nominatim usage policy — identifies this app to OSM operators */
      "User-Agent": "FarmDots/1.0 (local farm mapping PWA)",
    },
  });

  if (!res.ok) {
    throw new Error(`Place search failed (${res.status})`);
  }

  const data = (await res.json()) as NominatimHit[];
  if (!Array.isArray(data)) return [];
  return data.map((hit) => ({
    ...hit,
    display_name: simplifyNominatimDisplayName(hit.display_name),
  }));
}

/** Reverse geocode (call sparingly; respect https://operations.osmfoundation.org/policies/nominatim/). */
export async function reverseNominatim(lat: number, lng: number): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
      "User-Agent": "FarmDots/1.0 (local farm mapping PWA)",
    },
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { display_name?: string };
  const raw = data.display_name;
  if (!raw) return null;
  return simplifyNominatimDisplayName(raw);
}
