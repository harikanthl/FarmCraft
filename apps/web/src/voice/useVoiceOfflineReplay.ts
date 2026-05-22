import type { FarmDotsDatabase } from "@/db/types";
import type { VoiceIntent } from "@farmdots/shared";
import { voiceIntentSchema } from "@farmdots/shared";
import { useEffect } from "react";
import { toast } from "sonner";
import { voiceIntentToFarmEventDoc } from "./draftToFarmEvent";

/**
 * Drain `pending_voice_operations` rows whenever the browser reports it's
 * back online. Each queued intent is replayed via the FarmEvent mapper and
 * marked `synced`; rows that still fail keep their `queued` status for the
 * next reconnect (`ai.md` section 24).
 */
export function useVoiceOfflineReplay(db: FarmDotsDatabase | null | undefined) {
  useEffect(() => {
    if (!db || typeof window === "undefined") return;
    let replaying = false;

    async function replay() {
      if (replaying) return;
      replaying = true;
      try {
        const pending = await db!.pending_voice_operations
          .find({ selector: { status: "queued" } })
          .exec();
        for (const doc of pending) {
          const data = doc.toJSON() as { intentJson?: string; farmId?: string };
          let intent: VoiceIntent | null = null;
          try {
            intent = voiceIntentSchema.parse(JSON.parse(data.intentJson ?? ""));
          } catch {
            intent = null;
          }
          if (!intent) {
            await doc.patch({ status: "discarded", updatedAt: Date.now() });
            continue;
          }
          const farmId = intent.farmId ?? data.farmId;
          if (!farmId) continue;
          try {
            await db!.farm_events.insert(voiceIntentToFarmEventDoc(intent, farmId));
            await doc.patch({ status: "synced", updatedAt: Date.now() });
            toast.success(intent.spokenReply ?? "Saved queued voice operation.");
          } catch (e) {
            console.warn("[voice] replay still failing", e);
          }
        }
      } finally {
        replaying = false;
      }
    }

    void replay();
    window.addEventListener("online", replay);
    return () => window.removeEventListener("online", replay);
  }, [db]);
}
