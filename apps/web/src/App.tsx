import { AuthProvider } from "@/auth/AuthContext";
import { SignInDialog } from "@/auth/SignInDialog";
import { UnitsProvider } from "@/context/UnitsContext";
import { GlobalMapPage } from "@/pages/GlobalMapPage";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FarmWorkspace } from "@/workspace/FarmWorkspace";
import { useDatabase } from "@/hooks/useDatabase";
import { HtmlLang } from "@/i18n/HtmlLang";
import { RouteNamespaceGate } from "@/i18n/RouteNamespaceGate";
import { VoiceFloatingDock } from "@/voice/components/VoiceFloatingDock";
import { useVoiceOfflineReplay } from "@/voice/useVoiceOfflineReplay";
import { useSyncTriggers } from "@/sync/useSyncTriggers";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

const FarmCalendarPage = lazy(async () => {
  const m = await import("@/calendar/components/FarmCalendarPage");
  return { default: m.FarmCalendarPage };
});

const SimWorkspacePage = lazy(async () => {
  const m = await import("@/sim/SimWorkspacePage");
  return { default: m.SimWorkspacePage };
});

const ConflictsPage = lazy(async () => {
  const m = await import("@/sync/ConflictsPage");
  return { default: m.ConflictsPage };
});

export function App() {
  const { db, dbError, dbLoading } = useDatabase();
  const { t } = useTranslation("common");

  if (dbError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-amber-950 p-6 text-center text-amber-50">
        <p className="max-w-md text-lg font-medium">{t("database.error.title")}</p>
        <pre className="max-w-full overflow-auto rounded-lg bg-black/30 p-4 text-left text-sm">{dbError.message}</pre>
        <p className="max-w-md text-sm text-amber-200/90">{t("database.error.hint")}</p>
        <button
          type="button"
          className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white"
          onClick={() => window.location.reload()}
        >
          {t("actions.reload")}
        </button>
      </div>
    );
  }

  if (dbLoading || !db) {
    return (
      <div className="flex h-dvh items-center justify-center bg-emerald-950 text-emerald-50">
        {t("loading.database")}
      </div>
    );
  }

  return (
    <AuthProvider>
      <UnitsProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={400}>
            <BrowserRouter>
              <HtmlLang />
              <RoutedApp db={db} />
              <SignInDialog />
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </UnitsProvider>
    </AuthProvider>
  );
}

function RoutedApp({ db }: { db: NonNullable<ReturnType<typeof useDatabase>["db"]> }) {
  const { t } = useTranslation("common");
  useVoiceOfflineReplay(db);
  useSyncTriggers(db);

  const routeLoading = (
    <div className="flex h-dvh items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
      {t("loading.generic")}
    </div>
  );

  return (
    <RouteNamespaceGate fallback={routeLoading}>
      <Suspense fallback={routeLoading}>
        <Routes>
          <Route path="/" element={<GlobalMapPage db={db} />} />
          <Route path="/farm/:farmId/workspace" element={<FarmWorkspace db={db} />} />
          <Route path="/farm/:farmId/calendar" element={<FarmCalendarPage db={db} />} />
          <Route path="/farm/:farmId/sim" element={<SimWorkspacePage db={db} />} />
          <Route path="/conflicts" element={<ConflictsPage db={db} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <VoiceFloatingDock db={db} />
    </RouteNamespaceGate>
  );
}
