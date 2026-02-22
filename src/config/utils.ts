import { ConfigFileKind, ConfigScope } from "./types";

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const toDebugCase = (value: string) =>
  value
    .split("_")
    .map((segment) => capitalize(segment))
    .join("");

export const getSettingsFileKindForScope = (scope: ConfigScope): ConfigFileKind => {
  switch (scope) {
    case ConfigScope.UserLocal:
    case ConfigScope.ProjectLocal:
      return ConfigFileKind.SettingsLocal;
    default:
      return ConfigFileKind.Settings;
  }
};

export const getConfigPathKey = (scope: ConfigScope, kind: ConfigFileKind) =>
  `${toDebugCase(scope)}_${toDebugCase(kind)}`;

export const getConfigPathFor = (
  paths: Record<string, string> | undefined,
  scope: ConfigScope,
  kind: ConfigFileKind
) => paths?.[getConfigPathKey(scope, kind)];
