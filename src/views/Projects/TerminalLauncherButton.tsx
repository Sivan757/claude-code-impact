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
import {
  detectTerminalPlatform,
  getPreferredTerminalApp,
  getTerminalAppOptions,
} from "@/lib/terminalPreference";

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
  const platform = detectTerminalPlatform();
  const systemTerminals = getTerminalAppOptions(platform);

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
                {t("projects.launch_in_app_terminal")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {systemTerminals.map(({ value, labelKey, fallbackLabel }) => (
            <DropdownMenuItem key={value} onClick={() => handleLaunch(value)}>
              {t(labelKey, fallbackLabel)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
