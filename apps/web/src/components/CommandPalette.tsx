import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Download,
  LayoutGrid,
  MapPin,
  Plus,
  Sprout,
  RefreshCw,
  Waypoints,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farms: { id: string; name: string }[];
  activeFarmId: string | null;
  onSelectFarm: (id: string) => void;
  onGenerateGrid: () => void;
  onExport: () => void;
  onSync: () => void;
  onAddFarm: () => void;
  onPlaceValve: () => void;
};

export function CommandPalette({
  open,
  onOpenChange,
  farms,
  activeFarmId,
  onSelectFarm,
  onGenerateGrid,
  onExport,
  onSync,
  onAddFarm,
  onPlaceValve,
}: CommandPaletteProps) {
  const navigate = useNavigate();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search farms and actions…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Farms">
          {farms.map((f) => (
            <CommandItem
              key={f.id}
              value={`${f.name} ${f.id}`}
              onSelect={() => {
                onSelectFarm(f.id);
                onOpenChange(false);
              }}
            >
              <MapPin className="mr-2 h-4 w-4 text-emerald-700" />
              <span>{f.name}</span>
              {f.id === activeFarmId ? (
                <span className="ml-2 text-xs text-slate-500">(active)</span>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigate">
          <CommandItem
            disabled={!activeFarmId}
            onSelect={() => {
              if (!activeFarmId) return;
              navigate(`/farm/${activeFarmId}/workspace`);
              onOpenChange(false);
            }}
          >
            <LayoutGrid className="mr-2 h-4 w-4" />
            Open workspace
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              onAddFarm();
              onOpenChange(false);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add farm (draw boundary)
          </CommandItem>
          <CommandItem
            disabled={!activeFarmId}
            onSelect={() => {
              onGenerateGrid();
              onOpenChange(false);
            }}
          >
            <Sprout className="mr-2 h-4 w-4" />
            Fill farm (spacing)
          </CommandItem>
          <CommandItem
            disabled={!activeFarmId}
            onSelect={() => {
              onPlaceValve();
              onOpenChange(false);
            }}
          >
            <Waypoints className="mr-2 h-4 w-4" />
            Add valve (map tap)
          </CommandItem>
          <CommandItem
            disabled={!activeFarmId}
            onSelect={() => {
              void onExport();
              onOpenChange(false);
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV / XLSX
          </CommandItem>
          <CommandItem
            onSelect={() => {
              void onSync();
              onOpenChange(false);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync cloud
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
