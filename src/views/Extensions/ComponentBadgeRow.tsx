import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { PluginComponents } from "../../types";

interface ComponentBadgeRowProps {
  components: PluginComponents;
  size?: "sm" | "md";
}

export function ComponentBadgeRow({ components, size = "md" }: ComponentBadgeRowProps) {
  const { t } = useTranslation();
  const badgeSizeClass =
    size === "sm" ? "text-[10px] px-1.5 py-0.5 leading-none" : "text-xs px-2 py-0.5";

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
        key: "claudeMd",
        label: t("extensions_view.claude_md"),
        count: components.claudeMd.length,
        className: "bg-rose-500/10 text-rose-700",
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
    <div className={size === "sm" ? "flex flex-wrap gap-1.5" : "flex flex-wrap gap-2"}>
      {visibleBadges.map((badge) => (
        <span
          key={badge.key}
          className={`${badgeSizeClass} rounded-full ${badge.className}`}
        >
          {badge.label} {badge.count}
        </span>
      ))}
    </div>
  );
}
