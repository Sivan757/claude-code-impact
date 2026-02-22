import { useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

interface LaunchTerminalArgs {
  cwd: string;
  envVars?: Record<string, string>;
  terminalApp?: string;
  command?: string;
}

/** Launch a system terminal at a given directory */
export function useTerminalLauncher() {
  return useMutation<string, string, LaunchTerminalArgs>({
    mutationFn: ({ cwd, envVars, terminalApp, command }) =>
      invoke<string>("launch_system_terminal", {
        cwd,
        envVars,
        terminalApp,
        command,
      }),
  });
}
