import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import type { ClaudeCodeVersionInfo, ClaudeCodeInstallType } from "../../types";

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ClaudeCodeVersionSection() {
  const { t } = useTranslation();

  const INSTALL_TYPES: { value: ClaudeCodeInstallType; label: string; desc: string }[] = useMemo(() => [
    { value: "native", label: t('claude_code.native'), desc: t('claude_code.native_desc') },
    { value: "npm", label: t('claude_code.npm'), desc: t('claude_code.npm_desc') },
  ], [t]);

  const [versionInfo, setVersionInfo] = useState<ClaudeCodeVersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>("latest");
  const [selectedInstallType, setSelectedInstallType] = useState<ClaudeCodeInstallType>("native");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const installGenRef = useRef(0); // Track install generation to filter stale events

  const loadVersionInfo = async () => {
    // Stage 1: Fast local detection
    setError(null);
    try {
      const info = await invoke<ClaudeCodeVersionInfo>("get_claude_code_version_info");
      setVersionInfo(info);
      if (info.current_version) {
        setSelectedVersion(info.current_version);
      }
      if (info.install_type !== "none") {
        setSelectedInstallType(info.install_type);
      }
      // UI is ready to show local state
      setLoading(false);

      // Stage 2: Fetch available versions (async)
      try {
        const versions = await invoke<any[]>("get_claude_code_available_versions");
        setVersionInfo(prev => prev ? { ...prev, available_versions: versions } : null);
      } catch (e) {
        console.warn("Failed to fetch remote versions:", e);
      }

    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersionInfo();
  }, []);

  // Auto-scroll to latest log
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [installLogs]);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      unlistenRef.current?.();
    };
  }, []);

  const handleInstall = async () => {
    // Clean up any existing listener first
    unlistenRef.current?.();
    unlistenRef.current = null;

    // Increment generation to invalidate any stale events
    const currentGen = ++installGenRef.current;

    setInstalling(true);
    setError(null);
    setSuccess(null);
    setInstallLogs([]);
    setDownloadProgress(null);

    try {
      // Listen for progress events, filtering by generation
      unlistenRef.current = await listen<string>("cc-install-progress", (event) => {
        // Only process events for the current install generation
        if (installGenRef.current === currentGen) {
          const payload = event.payload;

          // Check if this is a progress update (contains percentage)
          const progressMatch = payload.match(/(\d+(?:\.\d+)?)\s*%/);
          if (progressMatch) {
            const percent = parseFloat(progressMatch[1]);
            setDownloadProgress(percent);
            return; // Don't add to logs
          }

          // Reset progress when download completes
          if (payload.includes("Setting up") || payload.includes("Done")) {
            setDownloadProgress(null);
          }

          if (payload.startsWith("\r")) {
            // Carriage return - replace last line (progress update)
            setInstallLogs((prev) => {
              const newLogs = [...prev];
              if (newLogs.length > 0) {
                newLogs[newLogs.length - 1] = payload.slice(1);
              } else {
                newLogs.push(payload.slice(1));
              }
              return newLogs;
            });
          } else {
            // Normal line - append
            setInstallLogs((prev) => [...prev, payload]);
          }
        }
      });

      await invoke<string>("install_claude_code_version", {
        version: selectedVersion,
        installType: selectedInstallType,
      });

      const typeLabel = INSTALL_TYPES.find((t) => t.value === selectedInstallType)?.label;
      setSuccess(t('claude_code.success_installed', { version: selectedVersion, type: typeLabel }));
      await loadVersionInfo();
    } catch (e) {
      setError(String(e));
    } finally {
      unlistenRef.current?.();
      unlistenRef.current = null;
      setInstalling(false);
    }
  };

  const handleCancel = async () => {
    // Increment generation to invalidate any pending events
    installGenRef.current++;

    // Clean up listener immediately
    unlistenRef.current?.();
    unlistenRef.current = null;

    try {
      await invoke("cancel_claude_code_install");
      setInstallLogs((prev) => [...prev, `[${t('claude_code.cancel')}]`]);
      setError(t('claude_code.cancel'));
    } catch (e) {
      console.error("Failed to cancel:", e);
    } finally {
      setInstalling(false);
    }
  };



  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">{t('common.loading')}...</p>
      </div>
    );
  }

  const isNotInstalled = versionInfo?.install_type === "none";
  const isCurrentVersion = versionInfo?.current_version === selectedVersion;
  const isSameInstallType = versionInfo?.install_type === selectedInstallType;
  const isLatest =
    selectedVersion === "latest" ||
    versionInfo?.available_versions[0]?.version === selectedVersion;

  // Determine button state
  const canInstall = !installing && (!isCurrentVersion || !isSameInstallType);
  const getButtonLabel = () => {
    if (installing) return t('claude_code.installing');
    if (isNotInstalled) return t('claude_code.install');
    if (!isSameInstallType) return t('claude_code.reinstall'); // Switching install type
    if (isCurrentVersion) return t('claude_code.installed');
    if (isLatest) return t('claude_code.update');
    return t('claude_code.install');
  };

  const getSelectedVersionLabel = () => {
    if (selectedVersion === "latest") return t('claude_code.latest_newest');
    const v = versionInfo?.available_versions.find((v) => v.version === selectedVersion);
    if (!v) return selectedVersion;
    const isCurrent = v.version === versionInfo?.current_version;
    return `${v.version}${isCurrent ? t('claude_code.current_marker') : ""}`;
  };

  return (
    <div className="space-y-4">
      {/* Version + Install Type + Button */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          {/* Version selector */}
          <Select value={selectedVersion} onValueChange={setSelectedVersion} disabled={installing}>
            <SelectTrigger className="flex-1">
              <SelectValue>{getSelectedVersionLabel()}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">
                <span>{t('claude_code.latest_newest')}</span>
              </SelectItem>
              {versionInfo?.available_versions.map((v) => {
                const isCurrent = v.version === versionInfo.current_version;
                return (
                  <SelectItem key={v.version} value={v.version}>
                    <span className="flex items-center justify-between w-full gap-3">
                      <span>
                        {v.version}
                        {isCurrent ? t('claude_code.current_marker') : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ↓{formatDownloads(v.downloads)}
                      </span>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Install type selector */}
          <Select
            value={selectedInstallType}
            onValueChange={(v) => setSelectedInstallType(v as ClaudeCodeInstallType)}
            disabled={installing}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INSTALL_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <span className="flex flex-col">
                    <span>{t.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Install/Cancel button */}
          {installing ? (
            <Button
              onClick={handleCancel}
              variant="ghost"
              className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {t('common.cancel')}
            </Button>
          ) : (
            <Button onClick={handleInstall} disabled={!canInstall} className="shrink-0">
              {getButtonLabel()}
            </Button>
          )}
        </div>

        {/* Install type hint */}
        <p className="text-[10px] text-muted-foreground">
          {INSTALL_TYPES.find((t) => t.value === selectedInstallType)?.desc}
          {!isSameInstallType && versionInfo?.install_type !== "none" && (
            <span className="text-amber-600 block mt-1">{t('claude_code.switcher_hint', { type: versionInfo?.install_type })}</span>
          )}
        </p>
      </div>

      {/* Download progress bar */}
      {downloadProgress !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{t('claude_code.downloading')}</span>
            <span>{downloadProgress.toFixed(1)}%</span>
          </div>
          <Progress value={downloadProgress} className="h-2" />
        </div>
      )}

      {/* Install progress logs */}
      {installLogs.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-[10px] text-muted-foreground border border-border">
          {installLogs.map((log, i) => (
            <div
              key={i}
              className={log.startsWith("[error]") || log.startsWith("[Cancelled") ? "text-amber-600" : ""}
            >
              {log}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      )}

      {/* Error/Success messages */}
      {error && <p className="text-xs text-red-600 bg-red-50/50 border border-red-100 rounded-lg p-2">{error}</p>}
      {success && <p className="text-xs text-green-600 bg-green-50/50 border border-green-100 rounded-lg p-2">{success}</p>}

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        {!isNotInstalled && (
          <p className="text-[10px] text-muted-foreground">
            {t('claude_code.tip')}
          </p>
        )}

        {/* NPM link */}
        <a
          href="https://www.npmjs.com/package/@anthropic-ai/claude-code?activeTab=versions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-primary hover:underline inline-flex items-center gap-1 ml-auto"
        >
          {t('claude_code.view_on_npm')}
        </a>
      </div>
    </div>
  );
}
