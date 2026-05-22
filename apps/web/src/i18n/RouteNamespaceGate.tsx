import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { namespacesForPath } from "./routeNamespaces";

function useRouteNamespacesReady(): boolean {
  const { pathname } = useLocation();
  const { i18n } = useTranslation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ns = namespacesForPath(pathname);
    let cancelled = false;
    setReady(false);

    const load = () => {
      void i18n.loadNamespaces(ns).then(() => {
        if (!cancelled) setReady(true);
      });
    };

    load();
    i18n.on("languageChanged", load);
    return () => {
      cancelled = true;
      i18n.off("languageChanged", load);
    };
  }, [pathname, i18n]);

  return ready;
}

type Props = {
  children: ReactNode;
  fallback: ReactNode;
};

/** Waits until route-specific i18n namespaces are loaded before rendering children. */
export function RouteNamespaceGate({ children, fallback }: Props) {
  const ready = useRouteNamespacesReady();
  if (!ready) return fallback;
  return children;
}
