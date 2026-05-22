import type { FarmDotsDatabase } from "@/db/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { plantMainFormSchema, type PlantMainFormValues } from "@/forms/schemas";
import { savePlantMainFieldsForMany } from "@/plants/savePlantMainFields";
import { PlantMainFieldsForm } from "@/ui/PlantMainFieldsForm";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type Props = {
  db: FarmDotsDatabase;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmName: string;
  plantIds: string[];
  onApplied: () => void;
};

export function BulkPlantDetailsDialog({ db, open, onOpenChange, farmName, plantIds, onApplied }: Props) {
  const form = useForm<PlantMainFormValues>({
    resolver: zodResolver(plantMainFormSchema),
    defaultValues: {
      yearlyYield: "",
      wateringIssues: "",
      diseaseIssues: "",
      dripIssues: "",
      notes: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (plantIds.length === 0) return;
    const { succeeded, failed } = await savePlantMainFieldsForMany(db, plantIds, values);
    if (failed.length === 0) {
      toast.success(`Updated ${succeeded.length} plant${succeeded.length === 1 ? "" : "s"}.`);
      onApplied();
      onOpenChange(false);
      return;
    }
    if (succeeded.length > 0) {
      toast.warning(`Updated ${succeeded.length} plants; ${failed.length} failed.`);
    } else {
      toast.error(failed.map((f) => f.message).join(" · ") || "Could not update plants.");
    }
    if (succeeded.length > 0) {
      onApplied();
      onOpenChange(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {plantIds.length} plants</DialogTitle>
          <DialogDescription>
            Values you save here are written to each selected plant on <strong>{farmName}</strong>. Empty text fields
            clear that field on every selected plant. Disease and irrigation events are not changed here — use the plant
            panel for those.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <PlantMainFieldsForm form={form} idPrefix="bulk-plant" />
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting || plantIds.length === 0}>
              {form.formState.isSubmitting ? "Saving…" : `Save to all (${plantIds.length})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
