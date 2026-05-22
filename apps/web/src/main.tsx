import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import "./index.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { registerMapProtocols } from "./maps/maplibreSetup";
import { i18nReady } from "./i18n";
import { App } from "./App";
import { ErrorBoundary } from "./ui/ErrorBoundary";

registerMapProtocols();

void i18nReady.then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
        <Toaster richColors position="top-center" />
      </ErrorBoundary>
    </StrictMode>,
  );
});
