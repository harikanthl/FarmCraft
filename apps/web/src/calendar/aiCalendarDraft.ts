/** Ask Worker for draft FarmEvent-shaped suggestions (user must save locally). */

import i18n from "@/i18n";
import { normalizeLanguage } from "@/i18n/languages";

export type DraftFarmEvent = {
  title: string;
  type: string;
  startIso: string;
  endIso: string;
  allDay?: boolean;
  description?: string;
};

export async function fetchCalendarDrafts(prompt: string, farmContext?: unknown): Promise<{ drafts: DraftFarmEvent[] }> {
  const locale = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const res = await fetch("/api/v1/ai/calendar-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, farmContext, locale }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ drafts: DraftFarmEvent[] }>;
}
