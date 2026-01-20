import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { PluginComponents } from "../../types";

interface ComponentBadgeRowProps {
  components: PluginComponents;
}

export function ComponentBadgeRow({ components }: ComponentBadgeRowProps) {
  const { t } = useTranslation();

  const badges = useMemo(
    () => [
      {
        key: "commands",
        label: t("features.commands"),
        count: components.commands.length,
        className: "bg-sky-500/10 text-sky-700",
      },
      {
        key: "skills",
        label: t("features.skills"),
        count: components.skills.length,
        className: "bg-emerald-500/10 text-emerald-700",
      },
      {
        key: "hooks",
        label: t("features.hooks"),
        count: components.hooks.length,
        className: "bg-amber-500/10 text-amber-700",
      },
      {
        key: "agents",
        label: t("features.sub-agents"),
        count: components.agents.length,
        className: "bg-indigo-500/10 text-indigo-700",
      },
      {
        key: "mcps",
        label: t("features.mcp"),
        count: components.mcps.length,
        className: "bg-fuchsia-500/10 text-fuchsia-700",
      },
      {
        key: "lsps",
        label: t("extensions_view.lsps"),
        count: components.lsps.length,
        className: "bg-slate-500/10 text-slate-700",
      },
    ],
    [components, t]
  );

  const visibleBadges = badges.filter((badge) => badge.count > 0);

  if (visibleBadges.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visibleBadges.map((badge) => (
        <span
          key={badge.key}
          className={`text-xs px-2 py-0.5 rounded-full ${badge.className}`}
        >
          {badge.label} {badge.count}
        </span>
      ))}
    </div>
  );
}
