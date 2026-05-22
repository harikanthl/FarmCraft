import { FarmAssistantPanel } from "@/ai/FarmAssistantPanel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { FarmDotsDatabase } from "@/db/types";
import { FarmHealthCard } from "@/intelligence/FarmHealthBadge";
import { useFarmHealthScore } from "@/intelligence/useFarmHealthScore";
import { computeFarmPolygonMetrics } from "@/geo/farmMetrics";
import type { Farm } from "@farmdots/shared";
import { CalendarDays } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

type Props = {
  db: FarmDotsDatabase;
  farmId: string;
};

export function WorkspaceSidebar({ db, farmId }: Props) {
  const { t } = useTranslation("workspace");
  const [rows, setRows] = useState(0);
  const [plants, setPlants] = useState(0);
  const [valves, setValves] = useState(0);
  const [healthAlerts, setHealthAlerts] = useState(0);
  const [diseaseEvents, setDiseaseEvents] = useState(0);
  const [farm, setFarm] = useState<Farm | null>(null);

  useEffect(() => {
    const sub = db.farms.findOne(farmId).$.subscribe((doc) => {
      if (!doc) {
        setFarm(null);
        return;
      }
      try {
        const j = doc.toJSON() as { polygonJson: string } & Record<string, unknown>;
        setFarm({ ...j, polygon: JSON.parse(j.polygonJson) } as unknown as Farm);
      } catch {
        setFarm(null);
      }
    });
    return () => sub.unsubscribe();
  }, [db, farmId]);

  const centroid = useMemo(() => {
    if (!farm) return null;
    try {
      const m = computeFarmPolygonMetrics(farm.polygon);
      return { lat: m.centroidLat, lng: m.centroidLng };
    } catch {
      return null;
    }
  }, [farm]);

  const healthScore = useFarmHealthScore({ db, farmId, centroid });

  useEffect(() => {
    const qR = db.rows.find({ selector: { farmId } });
    const qP = db.plants.find({ selector: { farmId } });
    const qV = db.valves.find({ selector: { farmId } });

    const subR = qR.$.subscribe((docs) => setRows(docs.length));
    const subP = qP.$.subscribe((docs) => {
      const list = docs.map((d) => d.toJSON() as { healthStatus: string });
      setPlants(list.length);
      setHealthAlerts(
        list.filter((p) => p.healthStatus !== "healthy" && p.healthStatus !== "unknown").length,
      );
    });
    const subV = qV.$.subscribe((docs) => setValves(docs.length));

    async function countDiseases() {
      const plantDocs = await db.plants.find({ selector: { farmId } }).exec();
      const ids = new Set(plantDocs.map((d) => (d.toJSON() as { id: string }).id));
      const dis = await db.disease_events.find().exec();
      setDiseaseEvents(dis.filter((d) => ids.has((d.toJSON() as { plantId: string }).plantId)).length);
    }

    const subD = db.disease_events.find().$.subscribe(() => void countDiseases());
    void countDiseases();

    return () => {
      subR.unsubscribe();
      subP.unsubscribe();
      subV.unsubscribe();
      subD.unsubscribe();
    };
  }, [db, farmId]);

  return (
    <aside className="flex w-72 flex-none flex-col gap-3 overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-inner dark:border-slate-800 dark:bg-slate-900">
      <Link
        to={`/farm/${farmId}/calendar`}
        className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
      >
        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
        {t("sidebar.farmCalendar")}
      </Link>
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t("sidebar.farmOverview")}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("sidebar.liveCountsHint")}</p>
      </div>
      <Separator />
      <FarmHealthCard score={healthScore} />
      <FarmAssistantPanel farmId={farmId} />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("sidebar.geometry")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">{t("sidebar.rows")}</span>
            <Badge variant="secondary">{rows}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">{t("sidebar.plants")}</span>
            <Badge variant="secondary">{plants}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">{t("sidebar.valves")}</span>
            <Badge variant="secondary">{valves}</Badge>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("sidebar.alerts")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">{t("sidebar.plantHealthFlags")}</span>
            <Badge variant={healthAlerts > 0 ? "destructive" : "secondary"}>{healthAlerts}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">{t("sidebar.diseaseEvents")}</span>
            <Badge variant={diseaseEvents > 0 ? "destructive" : "secondary"}>{diseaseEvents}</Badge>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
