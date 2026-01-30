import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { getAutoCopyOnSelect, setAutoCopyOnSelect } from "@/components/Terminal";
import { useAppConfig } from "@/context";

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

export function AppSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { shortenPaths, setShortenPaths } = useAppConfig();
  const [autoCopy, setAutoCopy] = useState(getAutoCopyOnSelect);
  const [statusBarEnabled, setStatusBarEnabled] = useState(false);
  const [statusBarScript, setStatusBarScript] = useState("~/.claudecodeimpact/claudecodeimpact/statusbar/default.sh");
  const [activeSection, setActiveSection] = useState<SettingsSection>("display");

  // Load statusbar settings on open
  useEffect(() => {
    if (!open) return;
    invoke<StatusBarSettings | null>("get_statusbar_settings").then((settings) => {
      if (settings) {
        setStatusBarEnabled(settings.enabled);
        setStatusBarScript(settings.scriptPath || "~/.claudecodeimpact/claudecodeimpact/statusbar/default.sh");
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
          <h2 className="text-lg font-semibold text-ink">{t("settings_dialog.title")}</h2>
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
                    <p className="text-sm font-medium text-ink">{t("settings_dialog.display.shorten_paths")}</p>
                    <p className="text-xs text-muted-foreground">{t("settings_dialog.display.shorten_paths_desc")}</p>
                  </div>
                  <Switch checked={shortenPaths} onCheckedChange={setShortenPaths} />
                </div>
              </div>
            )}
            {activeSection === "terminal" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{t("settings_dialog.terminal.auto_copy")}</p>
                    <p className="text-xs text-muted-foreground">{t("settings_dialog.terminal.auto_copy_desc")}</p>
                  </div>
                  <Switch checked={autoCopy} onCheckedChange={handleAutoCopyChange} />
                </div>
              </div>
            )}
            {activeSection === "statusbar" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{t("settings_dialog.statusbar.custom_script")}</p>
                    <p className="text-xs text-muted-foreground">{t("settings_dialog.statusbar.custom_script_desc")}</p>
                  </div>
                  <Switch checked={statusBarEnabled} onCheckedChange={handleStatusBarEnabledChange} />
                </div>
                {statusBarEnabled && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-ink">{t("settings_dialog.statusbar.script_path")}</label>
                    <Input
                      className="text-xs font-mono"
                      placeholder="~/.claudecodeimpact/claudecodeimpact/statusbar/default.sh"
                      value={statusBarScript}
                      onChange={(e) => handleStatusBarScriptChange(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {t("settings_dialog.statusbar.script_desc")}
                      <br />
                      <span className="text-muted-foreground/70">{t("settings_dialog.statusbar.ansi_support")}</span>
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
