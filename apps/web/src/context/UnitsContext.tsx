import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type UnitSystem = "metric" | "imperial";

const STORAGE_KEY = "farmdots.unitSystem";

let unitListeners = new Set<() => void>();

function read(): UnitSystem {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "imperial" || v === "metric") return v;
  } catch {
    /* ignore */
  }
  return "metric";
}

function subscribe(onStoreChange: () => void) {
  unitListeners.add(onStoreChange);
  const onCrossTab = () => onStoreChange();
  window.addEventListener("storage", onCrossTab);
  return () => {
    unitListeners.delete(onStoreChange);
    window.removeEventListener("storage", onCrossTab);
  };
}

function notifyUnitListeners() {
  unitListeners.forEach((fn) => fn());
}

function getSnapshot(): UnitSystem {
  return read();
}

function getServerSnapshot(): UnitSystem {
  return "metric";
}

type UnitsContextValue = {
  unitSystem: UnitSystem;
  setUnitSystem: (u: UnitSystem) => void;
  toggle: () => void;
};

const UnitsContext = createContext<UnitsContextValue | null>(null);

export function UnitsProvider({ children }: { children: ReactNode }) {
  const unitSystem = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setUnitSystem = useCallback((u: UnitSystem) => {
    try {
      localStorage.setItem(STORAGE_KEY, u);
    } catch {
      /* ignore */
    }
    notifyUnitListeners();
  }, []);

  const toggle = useCallback(() => {
    setUnitSystem(unitSystem === "metric" ? "imperial" : "metric");
  }, [setUnitSystem, unitSystem]);

  const value = useMemo(
    () => ({ unitSystem, setUnitSystem, toggle }),
    [unitSystem, setUnitSystem, toggle],
  );

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits(): UnitsContextValue {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error("useUnits must be used within UnitsProvider");
  return ctx;
}
