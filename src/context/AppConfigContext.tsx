import { createContext, useContext } from "react";

export interface AppConfig {
  homeDir: string;
  shortenPaths: boolean;
  setShortenPaths: (value: boolean) => void;
  formatPath: (path: string) => string;
}

const DEFAULT_APP_CONFIG: AppConfig = {
  homeDir: "",
  shortenPaths: true,
  setShortenPaths: () => {},
  formatPath: (rawPath) => rawPath,
};

export const AppConfigContext = createContext<AppConfig>({
  ...DEFAULT_APP_CONFIG,
});

export function useAppConfig(): AppConfig {
  return useContext(AppConfigContext);
}
