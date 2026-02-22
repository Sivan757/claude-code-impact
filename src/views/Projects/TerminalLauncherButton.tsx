import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { ExternalLinkIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu";
import { useTerminalLauncher } from "../../hooks/useTerminalLauncher";
import { profileAtom } from "@/store";
import { getPreferredTerminalApp } from "@/lib/terminalPreference";

interface TerminalLauncherButtonProps {
  cwd: string;
  envVars?: Record<string, string>;
  onOpenInApp?: () => void;
}

export function TerminalLauncherButton({
  cwd,
  envVars,
  onOpenInApp,
}: TerminalLauncherButtonProps) {
  const { t } = useTranslation();
  const launchMutation = useTerminalLauncher();
  const [profile] = useAtom(profileAtom);
  const preferredTerminalApp = getPreferredTerminalApp(profile);

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

  const handleLaunch = (terminalApp?: string) => {
    launchMutation.mutate({ cwd, envVars, terminalApp: terminalApp ?? preferredTerminalApp });
  };

  return (
    <div className="flex items-center">
      {/* Primary button */}
      <Button
        size="sm"
        variant="outline"
        className="h-8 rounded-l-xl rounded-r-none border-r-0 gap-1.5 text-xs"
        onClick={() => onOpenInApp?.() ?? handleLaunch()}
        disabled={launchMutation.isPending}
      >
        <ExternalLinkIcon className="w-3.5 h-3.5" />
        {t("common.terminal")}
      </Button>

      {/* Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-r-xl rounded-l-none px-1.5"
          >
            <ChevronDownIcon className="w-3.5 h-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onOpenInApp && (
            <>
              <DropdownMenuItem onClick={onOpenInApp}>
                In-App Terminal
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {systemTerminals.map(({ app, label }) => (
            <DropdownMenuItem key={app} onClick={() => handleLaunch(app)}>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
