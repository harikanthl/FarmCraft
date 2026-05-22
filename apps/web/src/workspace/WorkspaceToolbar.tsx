import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Hand,
  MousePointer2,
  PlusCircle,
  Sprout,
  Trash2,
} from "lucide-react";

export type WorkspaceTool = "select" | "pan" | "addPlant" | "addValve" | "delete";

type Props = {
  tool: WorkspaceTool;
  onToolChange: (t: WorkspaceTool) => void;
};

export function WorkspaceToolbar({ tool, onToolChange }: Props) {
  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-[20] flex items-center rounded-lg border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      <ToggleGroup
        type="single"
        value={tool}
        onValueChange={(v) => {
          if (v) onToolChange(v as WorkspaceTool);
        }}
        className="gap-0 border-0 bg-transparent p-0"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="select" aria-label="Select and move" className="px-2">
              <MousePointer2 className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            Select / drag · drag on empty ground to box-select · ⌫ to delete selection
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="pan" aria-label="Pan" className="px-2">
              <Hand className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Pan &amp; zoom canvas</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="addPlant" aria-label="Add plant" className="px-2">
              <Sprout className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Add plant (tap inside farm)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="addValve" aria-label="Add valve" className="px-2">
              <PlusCircle className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Add valve</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="delete" aria-label="Delete" className="px-2">
              <Trash2 className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Delete entity (tap)</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </div>
  );
}
