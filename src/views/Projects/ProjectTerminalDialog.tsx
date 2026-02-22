import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { ExternalLinkIcon } from "@radix-ui/react-icons";
import { useTerminalLauncher } from "../../hooks/useTerminalLauncher";
import { profileAtom } from "@/store";
import { getPreferredTerminalApp } from "@/lib/terminalPreference";

interface ProjectTerminalDialogProps {
  open: boolean;
  onClose: () => void;
  cwd: string;
  envVars?: Record<string, string>;
}

export function ProjectTerminalDialog({
  open,
  onClose,
  cwd,
  envVars,
}: ProjectTerminalDialogProps) {
  const { t } = useTranslation();
  const launchMutation = useTerminalLauncher();
  const [profile] = useAtom(profileAtom);
  const preferredTerminalApp = getPreferredTerminalApp(profile);

  const shortPath = cwd.split("/").pop() ?? cwd;

  const handleLaunch = (terminalApp?: string) => {
    launchMutation.mutate({
      cwd,
      envVars,
      terminalApp: terminalApp ?? preferredTerminalApp,
      command: "claude",
    });
    onClose();
  };

  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const isWindows = navigator.platform.toUpperCase().includes("WIN");

  const systemTerminals = isMac
    ? [
        { app: "Terminal", label: "Terminal.app" },
        { app: "iTerm2", label: "iTerm2" },
      ]
    : isWindows
      ? [
          { app: "wt", label: "Windows Terminal" },
          { app: "powershell", label: "PowerShell" },
        ]
      : [
          { app: "gnome-terminal", label: "GNOME Terminal" },
          { app: "konsole", label: "Konsole" },
        ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {t("projects.launch_terminal", "Launch Terminal")}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {t("projects.launch_terminal_desc", "Open Claude Code in an external terminal for")}
          {" "}
          <span className="font-mono text-foreground">{shortPath}</span>
        </p>

        <div className="space-y-2 pt-2">
          {/* Default system terminal */}
          <Button
            className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 gap-2 justify-start"
            onClick={() => handleLaunch()}
          >
            <ExternalLinkIcon className="w-4 h-4" />
            {t("projects.launch_default_terminal", "Default Terminal")}
          </Button>

          {/* Alternative terminals */}
          {systemTerminals.map(({ app, label }) => (
            <Button
              key={app}
              variant="outline"
              className="w-full rounded-xl gap-2 justify-start"
              onClick={() => handleLaunch(app)}
            >
              <ExternalLinkIcon className="w-4 h-4" />
              {label}
            </Button>
          ))}
        </div>

        {launchMutation.isError && (
          <p className="text-xs text-destructive mt-2">
            {t("common.failed_with", { error: launchMutation.error })}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
