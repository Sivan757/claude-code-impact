/**
 * Root Layout - wraps all pages
 *
 * This is the shared layout for all routes.
 * Contains header, sidebar, and renders child routes via Outlet.
 */
import { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { GlobalHeader } from "../components/GlobalHeader";
import { StatusBar } from "../components/StatusBar";
import { AppSettingsDialog } from "@/components/dialogs/AppSettingsDialog";
import { ProfileDialog } from "@/components/dialogs/ProfileDialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAtom } from "jotai";
import { shortenPathsAtom, profileAtom } from "../store";
import { AppConfigContext, type AppConfig } from "../context";
import { featureFromPath, featureToPath } from "@/navigation/featureRoutes";
import type { FeatureType } from "../types";

// ============================================================================
// Layout Component
// ============================================================================

export default function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Derive current feature from URL
  const currentFeature = featureFromPath(location.pathname);

  // App state (non-routing)

  const [homeDir, setHomeDir] = useState("");
  const [shortenPaths, setShortenPaths] = useAtom(shortenPathsAtom);
  const [showSettings, setShowSettings] = useState(false);
  const [profile, setProfile] = useAtom(profileAtom);
  const [showProfileDialog, setShowProfileDialog] = useState(false);



  useEffect(() => {
    invoke<string>("get_home_dir").then(setHomeDir).catch(() => { });
  }, []);

  useEffect(() => {
    const unlisten = listen("menu-settings", () => setShowSettings(true));
    return () => { unlisten.then(fn => fn()); };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        window.dispatchEvent(new Event("app:before-reload"));
        setTimeout(() => window.location.reload(), 50);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Restore last visited path on load
  useEffect(() => {
    const LAST_PATH_KEY = "claudecodeimpact:lastPath";
    // Only attempt restore if we are at root (fresh load default)
    if (location.pathname === "/") {
      const saved = localStorage.getItem(LAST_PATH_KEY);
      if (saved && saved !== "/") {
        navigate(saved, { replace: true });
      }
    }
  }, []); // Run once on mount

  // Save current path on change
  useEffect(() => {
    const LAST_PATH_KEY = "claudecodeimpact:lastPath";
    localStorage.setItem(LAST_PATH_KEY, location.pathname + location.search);
  }, [location]);

  const formatPath = useCallback((path: string) => {
    if (shortenPaths && homeDir) {
      // Case-insensitive comparison for Windows paths
      const normalizedPath = path.toLowerCase();
      const normalizedHome = homeDir.toLowerCase();
      if (normalizedPath.startsWith(normalizedHome)) {
        return "~" + path.slice(homeDir.length);
      }
    }
    return path;
  }, [shortenPaths, homeDir]);

  const appConfig: AppConfig = { homeDir, shortenPaths, setShortenPaths, formatPath };

  // URL-based navigation
  const handleFeatureClick = (feature: FeatureType) => {
    const path = featureToPath(feature);
    if (path) navigate(path);
  };

  return (
    <AppConfigContext.Provider value={appConfig}>
      <div className="h-screen bg-canvas flex flex-col">
        <GlobalHeader
          currentFeature={currentFeature}
          canGoBack={window.history.length > 1}
          canGoForward={false}
          onGoBack={() => navigate(-1)}
          onGoForward={() => navigate(1)}
          onNavigate={(view) => {
            if (view.type === "home") navigate("/");
          }}
          onFeatureClick={handleFeatureClick}
          onShowProfileDialog={() => setShowProfileDialog(true)}
          onShowSettings={() => setShowSettings(true)}
        />
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
        <StatusBar />
      </div>
      <AppSettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      <ProfileDialog open={showProfileDialog} onClose={() => setShowProfileDialog(false)} profile={profile} onSave={setProfile} />
    </AppConfigContext.Provider>
  );
}
