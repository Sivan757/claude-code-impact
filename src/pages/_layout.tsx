/**
 * Root Layout - wraps all pages
 *
 * This is the shared layout for all routes.
 * Contains header, sidebar, and renders child routes via Outlet.
 */
import { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { PersonIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { GlobalHeader, VerticalFeatureTabs } from "../components/GlobalHeader";
import { StatusBar } from "../components/StatusBar";
import { setAutoCopyOnSelect, getAutoCopyOnSelect } from "../components/Terminal";
import { Switch } from "../components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { shortenPathsAtom, profileAtom, featureTabsLayoutAtom, workspaceDataAtom, dashboardSessionsVisibleAtom } from "../store";
import { AppConfigContext, useAppConfig, type AppConfig } from "../context";
import type { FeatureType, UserProfile } from "../types";

// ============================================================================
// Route to Feature mapping
// ============================================================================

function getFeatureFromPath(pathname: string): FeatureType | null {
  const path = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const segment = path.split("/")[0];

  const featureMap: Record<string, FeatureType> = {
    "": null as unknown as FeatureType,
    "workspace": "workspace",
    "features": "features",
    "chat": "chat",
    "skills": "skills",
    "commands": "commands",
    "mcp": "mcp",
    "hooks": "hooks",
    "agents": "sub-agents",
    "output-styles": "output-styles",
    "statusline": "statusline",
    "settings": "settings",
    "knowledge": "kb-distill",
    "marketplace": "marketplace",
  };

  // Handle settings sub-routes
  if (path.startsWith("settings/")) {
    const sub = path.split("/")[1];
    if (sub === "env") return "basic-env";
    if (sub === "llm") return "basic-llm";
    if (sub === "version") return "basic-version";
    if (sub === "context") return "context";
    return "settings";
  }

  // Handle knowledge sub-routes
  if (path.startsWith("knowledge/")) {
    const sub = path.split("/")[1];
    if (sub === "distill") return "kb-distill";
    if (sub === "reference") return "kb-reference";
  }

  return featureMap[segment] ?? null;
}

// ============================================================================
// Layout Component
// ============================================================================

export default function RootLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  // Derive current feature from URL
  const currentFeature = getFeatureFromPath(location.pathname);

  // App state (non-routing)
  const [featureTabsLayout] = useAtom(featureTabsLayoutAtom);
  const [workspace] = useAtom(workspaceDataAtom);
  const [dashboardSidebarVisible, setDashboardSidebarVisible] = useAtom(dashboardSessionsVisibleAtom);
  const [homeDir, setHomeDir] = useState("");
  const [shortenPaths, setShortenPaths] = useAtom(shortenPathsAtom);
  const [showSettings, setShowSettings] = useState(false);
  const [profile, setProfile] = useAtom(profileAtom);
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  // Check if currently in workspace (Dashboard) view
  const isInWorkspace = location.pathname === "/workspace";

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

  const formatPath = useCallback((path: string) => {
    if (shortenPaths && homeDir && path.startsWith(homeDir)) {
      return "~" + path.slice(homeDir.length);
    }
    return path;
  }, [shortenPaths, homeDir]);

  const appConfig: AppConfig = { homeDir, shortenPaths, setShortenPaths, formatPath };

  // URL-based navigation
  const handleFeatureClick = (feature: FeatureType) => {
    const routes: Record<FeatureType, string> = {
      "chat": "/chat",
      "basic-env": "/settings/env",
      "basic-llm": "/settings/llm",
      "basic-version": "/settings/version",
      "context": "/settings/context",
      "settings": "/settings",
      "commands": "/commands",
      "mcp": "/mcp",
      "skills": "/skills",
      "hooks": "/hooks",
      "sub-agents": "/agents",
      "output-styles": "/output-styles",
      "statusline": "/statusline",
      "kb-distill": "/knowledge/distill",
      "kb-reference": "/knowledge/reference",
      "workspace": "/workspace",
      "features": "/features",
      "marketplace": "/marketplace",
      "extensions": "/extensions",
    };
    const path = routes[feature];
    if (path) {
      navigate(path);
    }
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
          {featureTabsLayout === "vertical" && workspace && isInWorkspace && dashboardSidebarVisible && <VerticalFeatureTabs />}
          {/* Show expand button when sidebar is hidden in workspace */}
          {featureTabsLayout === "vertical" && isInWorkspace && !dashboardSidebarVisible && (
            <button
              onClick={() => setDashboardSidebarVisible(true)}
              className="shrink-0 w-6 flex items-center justify-center border-r border-border bg-card hover:bg-muted transition-colors"
              title={t('layout.show_sidebar')}
            >
              <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
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

// ============================================================================
// Dialogs
// ============================================================================

interface StatusBarSettings {
  enabled: boolean;
  scriptPath?: string;
}

type SettingsSection = "display" | "terminal" | "statusbar";

const settingsSections: { id: SettingsSection; labelKey: string }[] = [
  { id: "display", labelKey: "settings_dialog.sections.display" },
  { id: "terminal", labelKey: "settings_dialog.sections.terminal" },
  { id: "statusbar", labelKey: "settings_dialog.sections.statusbar" },
];

function AppSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { shortenPaths, setShortenPaths } = useAppConfig();
  const [autoCopy, setAutoCopy] = useState(getAutoCopyOnSelect);
  const [featureTabsLayout, setFeatureTabsLayout] = useAtom(featureTabsLayoutAtom);
  const [statusBarEnabled, setStatusBarEnabled] = useState(false);
  const [statusBarScript, setStatusBarScript] = useState("~/.lovstudio/lovcode/statusbar/default.sh");
  const [activeSection, setActiveSection] = useState<SettingsSection>("display");

  // Load statusbar settings on open
  useEffect(() => {
    if (!open) return;
    invoke<StatusBarSettings | null>("get_statusbar_settings").then((settings) => {
      if (settings) {
        setStatusBarEnabled(settings.enabled);
        setStatusBarScript(settings.scriptPath || "~/.lovstudio/lovcode/statusbar/default.sh");
      }
    }).catch(() => { });
  }, [open]);

  const handleAutoCopyChange = (checked: boolean) => {
    setAutoCopy(checked);
    setAutoCopyOnSelect(checked);
  };

  const handleStatusBarEnabledChange = async (checked: boolean) => {
    setStatusBarEnabled(checked);
    try {
      await invoke("save_statusbar_settings", {
        settings: { enabled: checked, scriptPath: statusBarScript },
      });
    } catch (e) {
      console.error("Failed to save statusbar settings:", e);
    }
  };

  const handleStatusBarScriptChange = async (path: string) => {
    setStatusBarScript(path);
    if (statusBarEnabled) {
      try {
        await invoke("save_statusbar_settings", {
          settings: { enabled: true, scriptPath: path },
        });
      } catch (e) {
        console.error("Failed to save statusbar settings:", e);
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-xl border border-border shadow-xl w-[38rem] max-w-[90vw] h-[28rem] max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-ink">{t('settings_dialog.title')}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-ink text-xl leading-none">&times;</button>
        </div>
        {/* Two-column layout */}
        <div className="flex flex-1 min-h-0">
          {/* Left sidebar */}
          <div className="w-40 shrink-0 border-r border-border bg-muted/30 p-2 space-y-1">
            {settingsSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${activeSection === section.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-ink hover:bg-muted"
                  }`}
              >
                {t(section.labelKey)}
              </button>
            ))}
          </div>
          {/* Right content */}
          <div className="flex-1 p-5 overflow-y-auto">
            {activeSection === "display" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{t('settings_dialog.display.shorten_paths')}</p>
                    <p className="text-xs text-muted-foreground">{t('settings_dialog.display.shorten_paths_desc')}</p>
                  </div>
                  <Switch checked={shortenPaths} onCheckedChange={setShortenPaths} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{t('settings_dialog.display.tabs_layout')}</p>
                    <p className="text-xs text-muted-foreground">{t('settings_dialog.display.tabs_layout_desc')}</p>
                  </div>
                  <div className="flex gap-0.5 p-0.5 bg-muted rounded-lg">
                    <button
                      onClick={() => setFeatureTabsLayout("horizontal")}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${featureTabsLayout === "horizontal" ? "bg-background text-ink shadow-sm" : "text-muted-foreground hover:text-ink"
                        }`}
                    >
                      {t('settings_dialog.display.horizontal')}
                    </button>
                    <button
                      onClick={() => setFeatureTabsLayout("vertical")}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${featureTabsLayout === "vertical" ? "bg-background text-ink shadow-sm" : "text-muted-foreground hover:text-ink"
                        }`}
                    >
                      {t('settings_dialog.display.vertical')}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {activeSection === "terminal" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{t('settings_dialog.terminal.auto_copy')}</p>
                    <p className="text-xs text-muted-foreground">{t('settings_dialog.terminal.auto_copy_desc')}</p>
                  </div>
                  <Switch checked={autoCopy} onCheckedChange={handleAutoCopyChange} />
                </div>
              </div>
            )}
            {activeSection === "statusbar" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{t('settings_dialog.statusbar.custom_script')}</p>
                    <p className="text-xs text-muted-foreground">{t('settings_dialog.statusbar.custom_script_desc')}</p>
                  </div>
                  <Switch checked={statusBarEnabled} onCheckedChange={handleStatusBarEnabledChange} />
                </div>
                {statusBarEnabled && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-ink">{t('settings_dialog.statusbar.script_path')}</label>
                    <Input
                      className="text-xs font-mono"
                      placeholder="~/.lovstudio/lovcode/statusbar/default.sh"
                      value={statusBarScript}
                      onChange={(e) => handleStatusBarScriptChange(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {t('settings_dialog.statusbar.script_desc')}
                      <br />
                      <span className="text-muted-foreground/70">{t('settings_dialog.statusbar.ansi_support')}</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileDialog({ open, onClose, profile, onSave }: { open: boolean; onClose: () => void; profile: UserProfile; onSave: (p: UserProfile) => void }) {
  const { t } = useTranslation();
  const [nickname, setNickname] = useState(profile.nickname);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || "");

  useEffect(() => {
    setNickname(profile.nickname);
    setAvatarUrl(profile.avatarUrl || "");
  }, [profile]);

  const handleSave = () => {
    onSave({ nickname, avatarUrl: avatarUrl || "" });
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('profile_dialog.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xl">
                {nickname ? nickname[0].toUpperCase() : <PersonIcon className="w-8 h-8" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Label htmlFor="nickname">{t('profile_dialog.name_label')}</Label>
              <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t('profile_dialog.name_placeholder')} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{t('profile_dialog.cancel')}</Button>
          <Button onClick={handleSave}>{t('profile_dialog.save')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
