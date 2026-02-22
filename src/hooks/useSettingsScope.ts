import { useLocation } from "react-router-dom";
import { ConfigScope } from "../config/types";

export type SettingsScopeKey = "global" | "project";

export function useSettingsScope(projectPath?: string): {
  scopeKey: SettingsScopeKey;
  configScope: ConfigScope;
} {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const raw = params.get("scope");

  if (raw === "global") {
    return { scopeKey: "global", configScope: ConfigScope.User };
  }

  if (raw === "project" && projectPath) {
    return { scopeKey: "project", configScope: ConfigScope.Project };
  }

  if (projectPath) {
    return { scopeKey: "project", configScope: ConfigScope.Project };
  }

  return { scopeKey: "global", configScope: ConfigScope.User };
}
