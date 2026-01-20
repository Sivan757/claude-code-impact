/**
 * StatusBar - Bottom status bar with script-based customization support
 *
 * Similar to Claude Code's statusLine, this supports:
 * - Script-based content generation (receives JSON context via stdin)
 * - ANSI color code support
 * - Fallback to built-in status bar if no script configured
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAtom } from "jotai";
import { profileAtom, workspaceDataAtom } from "../store";
import { invoke } from "@tauri-apps/api/core";
import {
  FolderIcon,
  GitBranchIcon,
  CodeIcon,
  GlobeIcon,
  ShieldCheckIcon,
  UserIcon,
  ClockIcon,
  SettingsIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { version as VERSION } from "../../package.json";



interface TodayStats {
  lines_added: number;
  lines_deleted: number;
}

interface StatusBarSettings {
  enabled: boolean;
  scriptPath?: string;
}

interface StatusBarContext {
  app_name: string;
  version: string;
  projects_count: number;
  features_count: number;
  today_lines_added: number;
  today_lines_deleted: number;
  timestamp: string;
  home_dir: string;
}

// ANSI color code to Tailwind class mapping
const ANSI_COLORS: Record<string, string> = {
  "30": "text-gray-900",
  "31": "text-red-500",
  "32": "text-green-500",
  "33": "text-yellow-500",
  "34": "text-blue-500",
  "35": "text-purple-500",
  "36": "text-cyan-500",
  "37": "text-gray-300",
  "90": "text-gray-500",
  "91": "text-red-400",
  "92": "text-green-400",
  "93": "text-yellow-400",
  "94": "text-blue-400",
  "95": "text-purple-400",
  "96": "text-cyan-400",
  "97": "text-white",
};

interface AnsiSpan {
  text: string;
  className: string;
}

/** Parse ANSI escape codes and return styled spans */
function parseAnsi(text: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  const regex = /\x1b\[([0-9;]+)m/g;
  let lastIndex = 0;
  let currentClass = "";
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before this escape code
    if (match.index > lastIndex) {
      spans.push({ text: text.slice(lastIndex, match.index), className: currentClass });
    }

    // Parse the escape code
    const codes = match[1].split(";");
    for (const code of codes) {
      if (code === "0") {
        currentClass = ""; // Reset
      } else if (code === "1") {
        currentClass += " font-bold";
      } else if (ANSI_COLORS[code]) {
        currentClass = ANSI_COLORS[code];
      }
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    spans.push({ text: text.slice(lastIndex), className: currentClass });
  }

  return spans.filter(s => s.text.length > 0);
}

interface StatusBarProps {
  onOpenSettings?: () => void;
}

export function StatusBar({ onOpenSettings }: StatusBarProps) {
  const [workspace] = useAtom(workspaceDataAtom);
  const [profile] = useAtom(profileAtom);
  const { t, i18n } = useTranslation();
  const [time, setTime] = useState(new Date());
  const [todayStats, setTodayStats] = useState<TodayStats>({ lines_added: 0, lines_deleted: 0 });
  const [proxyEnv, setProxyEnv] = useState<string | null>(null);
  const [settings, setSettings] = useState<StatusBarSettings | null>(null);
  const [scriptOutput, setScriptOutput] = useState<string | null>(null);
  const [homeDir, setHomeDir] = useState("");

  // Load statusbar settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const result = await invoke<StatusBarSettings | null>("get_statusbar_settings");
        setSettings(result);
      } catch {
        setSettings(null);
      }
    }
    loadSettings();
  }, []);

  // Get home dir
  useEffect(() => {
    invoke<string>("get_home_dir").then(setHomeDir).catch(() => { });
  }, []);

  // Clock update
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate stats from workspace
  const projectCount = workspace?.projects?.length ?? 0;
  const featCount = workspace?.projects?.reduce(
    (sum, p) => sum + (p.features?.length ?? 0),
    0
  ) ?? 0;

  // Fetch today's coding stats
  useEffect(() => {
    async function fetchTodayStats() {
      try {
        const stats = await invoke<TodayStats>("get_today_coding_stats");
        setTodayStats(stats);
      } catch {
        // Command might not exist yet
      }
    }
    fetchTodayStats();
    const timer = setInterval(fetchTodayStats, 30000);
    return () => clearInterval(timer);
  }, []);

  // Build context for script
  const context = useMemo<StatusBarContext>(() => ({
    app_name: "Claude Code Impact",
    version: VERSION,
    projects_count: projectCount,
    features_count: featCount,
    today_lines_added: todayStats.lines_added,
    today_lines_deleted: todayStats.lines_deleted,
    timestamp: time.toISOString(),
    home_dir: homeDir,
  }), [projectCount, featCount, todayStats, time, homeDir]);

  // Execute script if enabled
  useEffect(() => {
    if (!settings?.enabled || !settings?.scriptPath) {
      setScriptOutput(null);
      return;
    }

    let cancelled = false;

    async function runScript() {
      try {
        const output = await invoke<string>("execute_statusbar_script", {
          scriptPath: settings!.scriptPath,
          context,
        });
        if (!cancelled) {
          setScriptOutput(output);
        }
      } catch (e) {
        console.error("StatusBar script error:", e);
        if (!cancelled) {
          setScriptOutput(null);
        }
      }
    }

    // Throttle: run at most every 500ms
    const timer = setTimeout(runScript, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [settings, context]);



  // Check proxy environment (only for default mode)
  useEffect(() => {
    if (settings?.enabled) return;

    async function checkProxy() {
      try {
        const envProxy = await invoke<string | null>("get_env_var", { name: "HTTP_PROXY" });
        const envHttpsProxy = await invoke<string | null>("get_env_var", { name: "HTTPS_PROXY" });
        const proxy = envProxy || envHttpsProxy;
        if (proxy) {
          try {
            const url = new URL(proxy);
            setProxyEnv(url.hostname);
          } catch {
            setProxyEnv(proxy.slice(0, 20));
          }
        }
      } catch {
        // Silent fail
      }
    }
    checkProxy();
  }, [settings?.enabled]);

  const formatTime = useCallback((d: Date) => {
    return d.toLocaleTimeString(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }, [i18n.language]);

  const formatDate = useCallback((d: Date) => {
    return d.toLocaleDateString(i18n.language, {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  }, [i18n.language]);

  // Render script output with ANSI color support
  const renderedScriptOutput = useMemo(() => {
    if (!scriptOutput) return null;
    const spans = parseAnsi(scriptOutput);
    return (
      <div className="flex items-center gap-1">
        {spans.map((span, i) => (
          <span key={i} className={span.className}>{span.text}</span>
        ))}
      </div>
    );
  }, [scriptOutput]);

  // Script mode: show script output + settings gear
  if (settings?.enabled && scriptOutput !== null) {
    return (
      <div className="h-6 bg-card border-t border-border flex items-center justify-between px-3 text-xs text-muted-foreground select-none">
        <div className="flex-1 font-mono truncate">
          {renderedScriptOutput}
        </div>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="ml-2 p-0.5 rounded hover:bg-muted transition-colors"
            title={t('statusbar.settings')}
          >
            <SettingsIcon className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  // Default mode: built-in status bar
  return (
    <div className="h-6 bg-card border-t border-border flex items-center justify-between px-3 text-xs text-muted-foreground select-none">
      {/* Left: Product name & version */}
      <div className="flex items-center gap-4">
        <span className="font-medium text-ink">Claude Code Impact</span>
        <span className="text-muted-foreground">v{VERSION}</span>

        {/* Stats */}
        <div className="flex items-center gap-3 ml-2 border-l border-border/50 pl-4">
          <div className="flex items-center gap-1" title={t('statusbar.projects')}>
            <FolderIcon className="w-3 h-3" />
            <span>{projectCount}</span>
          </div>
          <div className="flex items-center gap-1" title={t('statusbar.features')}>
            <GitBranchIcon className="w-3 h-3" />
            <span>{featCount}</span>
          </div>
          {(todayStats.lines_added > 0 || todayStats.lines_deleted > 0) && (
            <div className="flex items-center gap-1" title={t('statusbar.today_changes')}>
              <CodeIcon className="w-3 h-3" />
              <span className="text-green-600">+{todayStats.lines_added}</span>
              <span className="text-red-500">-{todayStats.lines_deleted}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Time, Network, Account, Settings */}
      <div className="flex items-center gap-4">
        {/* Proxy indicator */}
        {proxyEnv && (
          <div className="flex items-center gap-1 text-amber-600" title={t('statusbar.proxy_label', { value: proxyEnv })}>
            <ShieldCheckIcon className="w-3 h-3" />
            <span>{t('statusbar.proxy_relay')}</span>
          </div>
        )}

        {/* Network region */}
        {/* Language Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1 hover:bg-muted/50 px-1.5 py-0.5 rounded transition-colors focus:outline-none"
              title={t('statusbar.select_language')}
            >
              <GlobeIcon className="w-3 h-3" />
              <span>{i18n.language.startsWith('zh') ? '中文' : 'English'}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => i18n.changeLanguage('en')}>
              English
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => i18n.changeLanguage('zh')}>
              中文
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Date & Time */}
        <div className="flex items-center gap-1 border-l border-border/50 pl-4">
          <ClockIcon className="w-3 h-3" />
          <span>{formatDate(time)}</span>
          <span className="font-mono">{formatTime(time)}</span>
        </div>

        {/* Account */}
        {profile.nickname && (
          <div className="flex items-center gap-1 border-l border-border/50 pl-4">
            <UserIcon className="w-3 h-3" />
            <span>{profile.nickname}</span>
          </div>
        )}

        {/* Settings gear */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="ml-1 p-0.5 rounded hover:bg-muted transition-colors"
            title={t('statusbar.settings')}
          >
            <SettingsIcon className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
