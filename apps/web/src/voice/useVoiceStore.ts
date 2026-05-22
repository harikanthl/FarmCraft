import type { VoiceIntent } from "@farmdots/shared";
import { create } from "zustand";

/** State machine mirroring PRD section 8 ("UI States"). */
export type VoiceUiState =
  | "idle"
  | "recording"
  | "transcribing"
  | "parsing"
  | "ready"
  | "speaking"
  | "error";

export type VoiceSelectionContext = {
  farmId: string | null;
  selectedValveIds: string[];
  selectedRowIds: string[];
  selectedPlantIds: string[];
};

export type VoiceDraftKind = "auto-draft" | "needs-confirm" | "clarify" | "copilot";

export type VoiceDraft = {
  kind: VoiceDraftKind;
  intent: VoiceIntent;
  transcript: string;
  /** Detected source language code from STT (short form, e.g. `te`). */
  spokenLanguage: string;
};

type Store = {
  uiState: VoiceUiState;
  transcript: string | null;
  /** Detected STT language code (short). */
  detectedLanguage: string | null;
  draft: VoiceDraft | null;
  /** Short rolling transcript history for Phase 6 copilot continuity. */
  history: Array<{ role: "user" | "assistant"; text: string }>;
  lastError: string | null;
  selection: VoiceSelectionContext;
  setUiState: (s: VoiceUiState) => void;
  setTranscript: (text: string, language: string) => void;
  setDraft: (draft: VoiceDraft | null) => void;
  pushHistory: (entry: { role: "user" | "assistant"; text: string }) => void;
  reset: () => void;
  setError: (message: string | null) => void;
  setSelection: (next: Partial<VoiceSelectionContext>) => void;
};

const emptySelection: VoiceSelectionContext = {
  farmId: null,
  selectedValveIds: [],
  selectedRowIds: [],
  selectedPlantIds: [],
};

export const useVoiceStore = create<Store>((set) => ({
  uiState: "idle",
  transcript: null,
  detectedLanguage: null,
  draft: null,
  history: [],
  lastError: null,
  selection: emptySelection,
  setUiState: (uiState) => set({ uiState }),
  setTranscript: (transcript, detectedLanguage) => set({ transcript, detectedLanguage }),
  setDraft: (draft) => set({ draft }),
  pushHistory: (entry) =>
    set((state) => ({ history: [...state.history.slice(-9), entry] })),
  reset: () =>
    set({
      uiState: "idle",
      transcript: null,
      detectedLanguage: null,
      draft: null,
      lastError: null,
    }),
  setError: (lastError) =>
    set({ lastError, uiState: lastError ? "error" : "idle" }),
  setSelection: (next) =>
    set((state) => ({ selection: { ...state.selection, ...next } })),
}));
