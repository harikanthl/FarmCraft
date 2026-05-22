import { matchPath } from "react-router-dom";

import type { I18nNamespace } from "./index";

export const ROUTE_PATTERNS = {
  workspace: "/farm/:farmId/workspace",
  calendar: "/farm/:farmId/calendar",
  sim: "/farm/:farmId/sim",
  map: "/",
} as const;

/** Namespaces beyond `common` for each top-level route. */
const ROUTE_EXTRA_NAMESPACES: Record<keyof typeof ROUTE_PATTERNS, readonly I18nNamespace[]> = {
  map: ["weather", "crops"],
  workspace: ["workspace", "calendar", "weather", "crops"],
  calendar: ["calendar"],
  sim: [],
};

/** Voice dock + mic UI + global sign-in dialog on every routed screen. */
const SHELL_NAMESPACES: readonly I18nNamespace[] = ["assistant", "auth"];

function routeKeyForPath(pathname: string): keyof typeof ROUTE_PATTERNS {
  if (matchPath(ROUTE_PATTERNS.workspace, pathname)) return "workspace";
  if (matchPath(ROUTE_PATTERNS.calendar, pathname)) return "calendar";
  if (matchPath(ROUTE_PATTERNS.sim, pathname)) return "sim";
  return "map";
}

/** `common` is always the default namespace loaded at i18n init. */
export function namespacesForPath(pathname: string): I18nNamespace[] {
  const route = routeKeyForPath(pathname);
  return [...new Set([...SHELL_NAMESPACES, ...ROUTE_EXTRA_NAMESPACES[route]])];
}
