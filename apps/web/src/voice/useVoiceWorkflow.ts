import { askFarmQuestion, fetchFarmContextJson, summariseFarm } from "@/ai/client";
import type { FarmDotsDatabase } from "@/db/types";
import i18n from "@/i18n";
import type { VoiceIntent } from "@farmdots/shared";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { voiceIntentToFarmEventDoc } from "./draftToFarmEvent";
import { playTtsResponse } from "./ttsPlayer";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { type VoiceDraft, type VoiceSelectionContext, useVoiceStore } from "./useVoiceStore";
import { parseVoiceIntent, transcribeAudio } from "./voiceClient";

/**
 * Drive the end-to-end voice workflow described in `ai.md` sections 5, 10, 21,
 * and 22. The UI calls `toggle()` to start/stop the mic and `confirmDraft()`
 * once the user accepts a pending VoiceDraftCard.
 */
export function useVoiceWorkflow(db: FarmDotsDatabase) {
  const recorder = useVoiceRecorder();
  const store = useVoiceStore();
  const { t } = useTranslation("assistant");

  const queueOffline = useCallback(
    async (intent: VoiceIntent, transcript: string) => {
      const now = Date.now();
      try {
        await db.pending_voice_operations.insert({
          id: crypto.randomUUID(),
          farmId: store.selection.farmId ?? intent.farmId ?? undefined,
          transcript,
          locale: i18n.resolvedLanguage ?? i18n.language ?? "en",
          intentJson: JSON.stringify(intent),
          status: "queued",
          createdAt: now,
          updatedAt: now,
          version: 1,
        });
      } catch (e) {
        console.error("[voice] offline queue failed", e);
      }
    },
    [db, store.selection.farmId],
  );

  const insertEvent = useCallback(
    async (intent: VoiceIntent) => {
      const farmId = store.selection.farmId ?? intent.farmId;
      if (!farmId) {
        toast.error(t("error.noFarm"));
        return;
      }
      const doc = voiceIntentToFarmEventDoc(intent, farmId);
      try {
        await db.farm_events.insert(doc);
        const reply = intent.spokenReply ?? t("tts.scheduled");
        store.pushHistory({ role: "assistant", text: reply });
        await playTtsResponse(reply, intent.spokenLanguage);
        toast.success(reply);
      } catch (e) {
        console.error("[voice] insert farm_event failed", e);
        await queueOffline(intent, store.transcript ?? "");
        toast.error(t("error.savedOffline"));
      }
    },
    [db, queueOffline, store, t],
  );

  const runCopilot = useCallback(
    async (intent: VoiceIntent, transcript: string) => {
      const farmId = store.selection.farmId ?? intent.farmId;
      try {
        const farmContext = farmId ? await fetchFarmContextJson(farmId).catch(() => null) : null;
        let reply: string;
        if (intent.type === "summary" && farmContext) {
          const out = await summariseFarm(farmContext);
          reply = out.reply;
        } else if (farmContext) {
          const out = await askFarmQuestion(transcript, farmContext);
          reply = out.reply;
        } else {
          reply = intent.spokenReply ?? t("error.noFarm");
        }
        store.pushHistory({ role: "assistant", text: reply });
        store.setUiState("speaking");
        await playTtsResponse(reply, intent.spokenLanguage);
        toast.message(reply);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "copilot failed";
        store.setError(msg);
        toast.error(msg);
      } finally {
        store.setUiState("idle");
      }
    },
    [store, t],
  );

  const dispatchIntent = useCallback(
    async (intent: VoiceIntent, transcript: string) => {
      store.pushHistory({ role: "user", text: transcript });
      const operational = isOperational(intent);
      if (operational && intent.confidence >= 0.9) {
        const draft: VoiceDraft = {
          kind: "auto-draft",
          intent,
          transcript,
          spokenLanguage: intent.spokenLanguage ?? "en",
        };
        store.setDraft(draft);
        store.setUiState("ready");
        return;
      }
      if (operational && intent.confidence >= 0.6) {
        store.setDraft({ kind: "needs-confirm", intent, transcript, spokenLanguage: intent.spokenLanguage ?? "en" });
        store.setUiState("ready");
        return;
      }
      if (intent.type === "clarify" || intent.confidence < 0.6) {
        store.setDraft({ kind: "clarify", intent, transcript, spokenLanguage: intent.spokenLanguage ?? "en" });
        store.setUiState("ready");
        return;
      }
      if (intent.type === "query" || intent.type === "summary" || intent.type === "alert" || intent.type === "weather") {
        store.setDraft({ kind: "copilot", intent, transcript, spokenLanguage: intent.spokenLanguage ?? "en" });
        await runCopilot(intent, transcript);
        store.setDraft(null);
        return;
      }
      store.setDraft({ kind: "needs-confirm", intent, transcript, spokenLanguage: intent.spokenLanguage ?? "en" });
      store.setUiState("ready");
    },
    [runCopilot, store],
  );

  const startRecording = useCallback(async () => {
    if (recorder.recording) return;
    store.setError(null);
    store.setDraft(null);
    store.setUiState("recording");
    try {
      await recorder.start();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "mic permission denied";
      store.setError(msg);
      toast.error(t("mic.error"));
    }
  }, [recorder, store, t]);

  const stopAndProcess = useCallback(async () => {
    if (!recorder.recording) return;
    const blob = await recorder.stop();
    if (!blob || blob.size === 0) {
      store.setUiState("idle");
      return;
    }
    try {
      store.setUiState("transcribing");
      const stt = await transcribeAudio(blob, { languageCode: "auto", mode: "transcribe" });
      if (!stt.transcript.trim()) {
        store.setUiState("idle");
        toast.warning(t("error.empty"));
        return;
      }
      store.setTranscript(stt.transcript, stt.language);
      store.setUiState("parsing");
      const { intent } = await parseVoiceIntent({
        transcript: stt.transcript,
        workspaceContext: snapshotContext(store.selection),
      });
      await dispatchIntent(intent, stt.transcript);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "voice pipeline failed";
      store.setError(msg);
      toast.error(msg);
    }
  }, [dispatchIntent, recorder, store, t]);

  const toggle = useCallback(async () => {
    if (recorder.recording) {
      await stopAndProcess();
    } else {
      await startRecording();
    }
  }, [recorder.recording, startRecording, stopAndProcess]);

  const cancel = useCallback(() => {
    recorder.cancel();
    store.reset();
  }, [recorder, store]);

  const confirmDraft = useCallback(async () => {
    const draft = store.draft;
    if (!draft) return;
    store.setDraft(null);
    store.setUiState("speaking");
    await insertEvent(draft.intent);
    store.setUiState("idle");
  }, [insertEvent, store]);

  const discardDraft = useCallback(() => {
    store.setDraft(null);
    store.setUiState("idle");
  }, [store]);

  const submitClarification = useCallback(
    async (extraText: string) => {
      const draft = store.draft;
      if (!draft) return;
      try {
        store.setUiState("parsing");
        const combined = `${draft.transcript}\n${extraText}`.trim();
        const { intent } = await parseVoiceIntent({
          transcript: combined,
          workspaceContext: snapshotContext(store.selection),
        });
        store.setTranscript(combined, intent.spokenLanguage ?? draft.spokenLanguage);
        await dispatchIntent(intent, combined);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "clarification failed";
        store.setError(msg);
      }
    },
    [dispatchIntent, store],
  );

  return {
    uiState: store.uiState,
    transcript: store.transcript,
    detectedLanguage: store.detectedLanguage,
    draft: store.draft,
    history: store.history,
    error: store.lastError,
    recording: recorder.recording,
    toggle,
    cancel,
    confirmDraft,
    discardDraft,
    submitClarification,
  };
}

function isOperational(intent: VoiceIntent): boolean {
  return (
    intent.type === "create_operation" ||
    intent.type === "edit_operation" ||
    intent.type === "reschedule_operation" ||
    intent.type === "cancel_operation" ||
    intent.type === "mark_complete"
  );
}

function snapshotContext(selection: VoiceSelectionContext) {
  return {
    farmId: selection.farmId ?? undefined,
    selectedValveIds: selection.selectedValveIds,
    selectedRowIds: selection.selectedRowIds,
    selectedPlantIds: selection.selectedPlantIds,
  };
}
