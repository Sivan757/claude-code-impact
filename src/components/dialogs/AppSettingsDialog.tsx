import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { useAppConfig } from "@/context";

type SettingsSection = "display";

const settingsSections: { id: SettingsSection; labelKey: string }[] = [
  { id: "display", labelKey: "settings_dialog.sections.display" },
];

export function AppSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { shortenPaths, setShortenPaths } = useAppConfig();
  const [activeSection, setActiveSection] = useState<SettingsSection>("display");

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
          </div>
        </div>
      </div>
    </div>
  );
}
