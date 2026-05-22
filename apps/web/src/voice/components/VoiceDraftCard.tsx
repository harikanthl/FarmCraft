import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import type { VoiceDraft } from "../useVoiceStore";

type VoiceDraftCardProps = {
  draft: VoiceDraft;
  onConfirm: () => void;
  onDiscard: () => void;
  /** Optional edit hook — only wired on the calendar where the editor exists. */
  onEdit?: () => void;
  /** Optional clarify entry point used when the draft is `kind: 'clarify'`. */
  onClarify?: () => void;
  className?: string;
};

const KIND_BADGE: Record<VoiceDraft["kind"], string> = {
  "auto-draft": "autoBadge",
  "needs-confirm": "needsConfirmBadge",
  clarify: "needsConfirmBadge",
  copilot: "copilot",
};

/**
 * VoiceDraftCard renders the operation summary plus confirm/edit/discard actions.
 * It's used in the workspace header and the calendar AI dialog so text and
 * voice drafts share the same surface (`ai.md` sections 10 & 21).
 */
export function VoiceDraftCard({ draft, onConfirm, onDiscard, onEdit, onClarify, className }: VoiceDraftCardProps) {
  const { t } = useTranslation(["assistant", "calendar"]);
  const intent = draft.intent;
  const tCal = (k: string, fallback: string) => t(`calendar:${k}`, { defaultValue: fallback });

  const opLabel = intent.operationType
    ? tCal(`operation.${intent.operationType}`, intent.operationType)
    : intent.type;
  const confidence = Math.round(intent.confidence * 100);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{t("assistant:draft.title")}</CardTitle>
          <Badge variant="secondary">{t(`assistant:draft.${KIND_BADGE[draft.kind]}`)}</Badge>
        </div>
        <CardDescription>{t("assistant:draft.summary")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="text-slate-700 dark:text-slate-200">
          <span className="font-medium">{opLabel}</span>
          {intent.recurrence ? <span className="ml-2 text-slate-500">• {intent.recurrence}</span> : null}
        </div>
        {intent.startIso ? (
          <div className="text-slate-600 dark:text-slate-300">
            {new Date(intent.startIso).toLocaleString()}
            {intent.endIso ? ` → ${new Date(intent.endIso).toLocaleString()}` : ""}
          </div>
        ) : null}
        {(intent.valveIds.length || intent.rowIds.length || intent.plantIds.length) ? (
          <div className="text-slate-600 dark:text-slate-300">
            {intent.valveIds.length > 0 ? <span className="mr-2">Valves: {intent.valveIds.length}</span> : null}
            {intent.rowIds.length > 0 ? <span className="mr-2">Rows: {intent.rowIds.length}</span> : null}
            {intent.plantIds.length > 0 ? <span>Plants: {intent.plantIds.length}</span> : null}
          </div>
        ) : null}
        {intent.notes ? <div className="text-slate-500 dark:text-slate-400">{intent.notes}</div> : null}
        {draft.kind === "clarify" && intent.clarification ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800 dark:border-amber-700/40 dark:bg-amber-950 dark:text-amber-200">
            {intent.clarification}
          </div>
        ) : null}
        <div className="text-xs text-slate-500 dark:text-slate-400">Confidence: {confidence}%</div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 pt-0">
        {draft.kind === "clarify" ? (
          <Button size="sm" onClick={onClarify} disabled={!onClarify}>
            {t("assistant:draft.clarify")}
          </Button>
        ) : (
          <Button size="sm" onClick={onConfirm}>
            {t("assistant:draft.confirm")}
          </Button>
        )}
        {onEdit ? (
          <Button size="sm" variant="outline" onClick={onEdit}>
            {t("assistant:draft.edit")}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          {t("assistant:draft.discard")}
        </Button>
      </CardFooter>
    </Card>
  );
}
