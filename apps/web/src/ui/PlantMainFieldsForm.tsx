import { Input } from "@/components/ui/input";
import type { PlantMainFormValues } from "@/forms/schemas";
import type { UseFormReturn } from "react-hook-form";

type Props = {
  form: UseFormReturn<PlantMainFormValues>;
  /** Prefix for input ids when multiple forms exist on one page */
  idPrefix?: string;
};

export function PlantMainFieldsForm({ form, idPrefix = "plant" }: Props) {
  const id = (name: keyof PlantMainFormValues) => `${idPrefix}-${String(name)}`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm" htmlFor={id("yearlyYield")}>
          <span className="text-slate-600 dark:text-slate-400">Yearly yield</span>
          <Input className="mt-1" id={id("yearlyYield")} {...form.register("yearlyYield")} inputMode="decimal" />
        </label>
      </div>
      <label className="block text-sm" htmlFor={id("wateringIssues")}>
        <span className="text-slate-600 dark:text-slate-400">Watering issue</span>
        <textarea
          id={id("wateringIssues")}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          rows={2}
          {...form.register("wateringIssues")}
        />
      </label>
      <label className="block text-sm" htmlFor={id("diseaseIssues")}>
        <span className="text-slate-600 dark:text-slate-400">Disease issue (flag)</span>
        <textarea
          id={id("diseaseIssues")}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          rows={2}
          {...form.register("diseaseIssues")}
        />
      </label>
      <label className="block text-sm" htmlFor={id("dripIssues")}>
        <span className="text-slate-600 dark:text-slate-400">Drip issue</span>
        <textarea
          id={id("dripIssues")}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          rows={2}
          {...form.register("dripIssues")}
        />
      </label>
      <label className="block text-sm" htmlFor={id("notes")}>
        <span className="text-slate-600 dark:text-slate-400">Notes</span>
        <textarea
          id={id("notes")}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          rows={2}
          {...form.register("notes")}
        />
      </label>
    </div>
  );
}
