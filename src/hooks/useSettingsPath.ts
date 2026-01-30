import { useLocation } from "react-router-dom";

export function useSettingsPath(): string | undefined {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const value = params.get("path");
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
