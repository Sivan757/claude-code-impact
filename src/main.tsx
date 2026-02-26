import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { loader } from "@monaco-editor/react";
import { invoke } from "@tauri-apps/api/core";
import { AppRouter } from "./router";
import { initializeUiPreferences } from "./lib/uiPreferences";
import { getConfiguredLaunchDraftRetentionSeconds } from "./lib/launchDraftRetention";
import "./index.css";
import "./i18n";

// Configure Monaco Editor to use local bundled version (avoid CDN issues)
loader.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs" } });

// Disable browser context menu in production (no reload/inspect-element)
if (import.meta.env.PROD) {
  document.addEventListener("contextmenu", (e) => e.preventDefault());
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

async function bootstrap() {
  try {
    await initializeUiPreferences();
  } catch {
    // Ignore preference initialization errors to avoid blocking startup.
  }

  try {
    await invoke<number>("cleanup_launch_settings", {
      retention_secs: getConfiguredLaunchDraftRetentionSeconds(),
    });
  } catch {
    // Ignore launch artifact cleanup errors to avoid blocking startup.
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>,
  );
}

void bootstrap();
