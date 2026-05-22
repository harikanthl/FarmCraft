import type { FarmDotsDatabase } from "@/db/types";
import { useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useVoiceStore } from "../useVoiceStore";
import { useVoiceWorkflow } from "../useVoiceWorkflow";
import { ClarificationModal } from "./ClarificationModal";
import { MicButton } from "./MicButton";
import { VoiceDraftCard } from "./VoiceDraftCard";
import { VoiceTranscriptStrip } from "./VoiceTranscriptStrip";

type Props = {
  db: FarmDotsDatabase;
};

/**
 * Fixed-position mic + draft surface for mobile breakpoints. Hidden on `sm+`
 * because the workspace and calendar render the mic inline in their headers
 * (`ai.md` section 8). Picks up the farm id from the URL so a tap inherits
 * workspace context even when the user navigates between farms.
 */
export function VoiceFloatingDock({ db }: Props) {
  const params = useParams<{ farmId?: string }>();
  const location = useLocation();
  const setSelection = useVoiceStore((s) => s.setSelection);
  const workflow = useVoiceWorkflow(db);

  useEffect(() => {
    setSelection({ farmId: params.farmId ?? null });
  }, [params.farmId, setSelection, location.pathname]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex flex-col items-center gap-2 px-4 sm:hidden">
      {workflow.transcript ? (
        <VoiceTranscriptStrip className="pointer-events-auto w-full max-w-md" />
      ) : null}
      {workflow.draft && workflow.draft.kind !== "clarify" ? (
        <VoiceDraftCard
          draft={workflow.draft}
          onConfirm={workflow.confirmDraft}
          onDiscard={workflow.discardDraft}
          className="pointer-events-auto w-full max-w-md"
        />
      ) : null}
      <MicButton onToggle={workflow.toggle} size="lg" className="pointer-events-auto" />
      <ClarificationModal
        draft={workflow.draft}
        onSubmit={workflow.submitClarification}
        onCancel={workflow.discardDraft}
      />
    </div>
  );
}
