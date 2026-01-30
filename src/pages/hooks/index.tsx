import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSettingsPath } from "../../hooks";

export default function HooksPage() {
  const navigate = useNavigate();
  const settingsPath = useSettingsPath();

  useEffect(() => {
    const target = settingsPath ? `/settings/hooks?path=${encodeURIComponent(settingsPath)}` : "/settings/hooks";
    navigate(target, { replace: true });
  }, [navigate, settingsPath]);

  return null;
}
