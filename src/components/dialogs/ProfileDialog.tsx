import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAppConfig } from "@/context";
import {
  DEFAULT_TERMINAL_PREFERENCE,
  detectTerminalPlatform,
  getTerminalAppOptions,
  normalizeTerminalPreference,
  resolveTerminalAppLabel,
} from "@/lib/terminalPreference";
import type { UserProfile } from "@/types";

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
}

export function ProfileDialog({ open, onClose, profile, onSave }: ProfileDialogProps) {
  const { t } = useTranslation();
  const { shortenPaths, setShortenPaths } = useAppConfig();
  const [terminalMode, setTerminalMode] = useState<"system" | "custom">(
    normalizeTerminalPreference(profile.terminalPreference).mode,
  );
  const [terminalCustomPath, setTerminalCustomPath] = useState(
    normalizeTerminalPreference(profile.terminalPreference).customPath,
  );
  const [shortenPathsDraft, setShortenPathsDraft] = useState(shortenPaths);
  const [terminalPickerError, setTerminalPickerError] = useState<string | null>(null);
  const platform = useMemo(() => detectTerminalPlatform(), []);
  const presetTerminalOptions = useMemo(() => getTerminalAppOptions(platform), [platform]);
  const terminalOptions = useMemo(() => {
    const selected = terminalCustomPath.trim();
    if (!selected) return presetTerminalOptions;
    if (presetTerminalOptions.some((option) => option.value === selected)) {
      return presetTerminalOptions;
    }
    return [
      {
        value: selected,
        labelKey: "",
        fallbackLabel: resolveTerminalAppLabel(
          selected,
          platform,
          (key, fallback) => t(key, fallback),
        ),
      },
      ...presetTerminalOptions,
    ];
  }, [platform, presetTerminalOptions, t, terminalCustomPath]);

  useEffect(() => {
    const normalizedTerminalPreference = normalizeTerminalPreference(profile.terminalPreference);
    setTerminalMode(normalizedTerminalPreference.mode);
    setTerminalCustomPath(normalizedTerminalPreference.customPath);
    setShortenPathsDraft(shortenPaths);
    setTerminalPickerError(null);
  }, [profile, shortenPaths]);

  const handlePickTerminalApp = async () => {
    try {
      let selected: string | string[] | null = null;
      if (platform === "macos") {
        selected = await openDialog({
          directory: true,
          multiple: false,
          defaultPath: "/Applications",
        });
      } else if (platform === "windows") {
        selected = await openDialog({
          directory: false,
          multiple: false,
          filters: [{ name: "Applications", extensions: ["exe", "cmd", "bat", "com"] }],
        });
      } else {
        selected = await openDialog({
          directory: false,
          multiple: false,
        });
      }

      if (typeof selected !== "string" || selected.trim().length === 0) {
        return;
      }

      if (platform === "macos" && !selected.toLowerCase().endsWith(".app")) {
        setTerminalPickerError(
          t("profile_dialog.terminal_picker_invalid_macos", "Please select a .app terminal application"),
        );
        return;
      }

      setTerminalPickerError(null);
      setTerminalMode("custom");
      setTerminalCustomPath(selected);
    } catch (error) {
      setTerminalPickerError(
        t("common.failed_with", { error: String(error) }),
      );
    }
  };

  const handleSave = () => {
    const trimmedPath = terminalCustomPath.trim();
    const terminalPreference = terminalMode === "custom"
      ? { mode: "custom" as const, customPath: trimmedPath }
      : DEFAULT_TERMINAL_PREFERENCE;

    setShortenPaths(shortenPathsDraft);
    onSave({
      ...profile,
      terminalPreference,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px] rounded-2xl border-border/60 bg-background p-0 overflow-hidden shadow-xl">
        <DialogHeader className="px-6 py-5 border-b border-border/40">
          <DialogTitle>{t("profile_dialog.title")}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t("profile_dialog.subtitle", "Configure app-level preferences")}
          </p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <section className="rounded-2xl border border-border/50 bg-card/40 p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t("profile_dialog.terminal_section_title", "Terminal")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("profile_dialog.terminal_mode_desc")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="terminal-mode">{t("profile_dialog.terminal_mode_label")}</Label>
              <Select
                value={terminalMode}
                onValueChange={(value: "system" | "custom") => {
                  setTerminalMode(value);
                  setTerminalPickerError(null);
                }}
              >
                <SelectTrigger id="terminal-mode" className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">{t("profile_dialog.terminal_mode_system")}</SelectItem>
                  <SelectItem value="custom">{t("profile_dialog.terminal_mode_custom")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {terminalMode === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="terminal-app">{t("profile_dialog.terminal_app_label", "Terminal application")}</Label>
                <Select
                  value={terminalCustomPath}
                  onValueChange={(value) => {
                    setTerminalCustomPath(value);
                    setTerminalPickerError(null);
                  }}
                >
                  <SelectTrigger id="terminal-app" className="w-full rounded-xl">
                    <SelectValue placeholder={t("profile_dialog.terminal_app_placeholder", "Select terminal app")} />
                  </SelectTrigger>
                  <SelectContent>
                    {terminalOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.labelKey ? t(option.labelKey, option.fallbackLabel) : option.fallbackLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-9"
                    onClick={handlePickTerminalApp}
                  >
                    {t("profile_dialog.terminal_picker_button", "Choose App")}
                  </Button>
                  {terminalCustomPath.trim().length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl h-9"
                      onClick={() => {
                        setTerminalCustomPath("");
                        setTerminalPickerError(null);
                      }}
                    >
                      {t("common.reset")}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("profile_dialog.terminal_app_desc", "Choose a terminal app instead of manually typing a path")}
                </p>
                {terminalPickerError && (
                  <p className="text-xs text-destructive">{terminalPickerError}</p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border/50 bg-card/40 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("profile_dialog.display_section_title", "Display")}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("profile_dialog.shorten_paths_desc", "Show home directory as ~ in project paths")}
                </p>
              </div>
              <Switch
                checked={shortenPathsDraft}
                onCheckedChange={setShortenPathsDraft}
              />
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border/40">
          <Button variant="outline" className="rounded-xl" onClick={onClose}>{t("profile_dialog.cancel")}</Button>
          <Button
            className="rounded-xl"
            onClick={handleSave}
            disabled={terminalMode === "custom" && terminalCustomPath.trim().length === 0}
          >
            {t("profile_dialog.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
