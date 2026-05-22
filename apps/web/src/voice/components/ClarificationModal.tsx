import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { VoiceDraft } from "../useVoiceStore";

type Props = {
  draft: VoiceDraft | null;
  onSubmit: (extra: string) => void | Promise<void>;
  onCancel: () => void;
};

/**
 * Clarification modal triggered when Gemini returns confidence < 0.6.
 * Captures a free-text reply that's concatenated with the original transcript
 * and re-routed through the parse-intent endpoint (PRD section 21 example).
 */
export function ClarificationModal({ draft, onSubmit, onCancel }: Props) {
  const { t } = useTranslation("assistant");
  const [value, setValue] = useState("");
  const open = !!draft && draft.kind === "clarify";
  const question = draft?.intent.clarification ?? draft?.intent.spokenReply ?? "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setValue("");
          onCancel();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("clarification.title")}</DialogTitle>
          {question ? <DialogDescription>{question}</DialogDescription> : null}
        </DialogHeader>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("clarification.placeholder")}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) {
              void onSubmit(value.trim());
              setValue("");
            }
          }}
        />
        <DialogFooter>
          <Button
            onClick={() => {
              if (!value.trim()) return;
              void onSubmit(value.trim());
              setValue("");
            }}
          >
            {t("clarification.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
