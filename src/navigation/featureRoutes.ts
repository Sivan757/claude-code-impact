import type { FeatureType } from "@/types";

export const FEATURE_ROUTES: Record<FeatureType, string> = {
  "basic-env": "/settings/env",
  "basic-llm": "/settings/llm",
  "basic-version": "/settings/version",
  chat: "/chat",
  commands: "/commands",
  config: "/config",
  context: "/context",
  extensions: "/extensions",
  features: "/settings",
  "kb-distill": "/knowledge/distill",
  "kb-reference": "/knowledge/reference",
  marketplace: "/marketplace",
  mcp: "/mcp",
  settings: "/settings",
  skills: "/skills",
  "sub-agents": "/agents",
  "output-styles": "/output-styles",
  statusline: "/statusline",
  hooks: "/settings/hooks",
};

export const featureToPath = (feature: FeatureType): string => FEATURE_ROUTES[feature];

export function featureFromPath(pathname: string): FeatureType | null {
  const path = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  if (!path) return null;

  const [segment, sub] = path.split("/");

  if (segment === "settings") {
    switch (sub) {
      case "env":
        return "basic-env";
      case "llm":
        return "basic-llm";
      case "version":
        return "basic-version";
      case "hooks":
        return "hooks";
      case "context":
        return "context";
      default:
        return "settings";
    }
  }

  if (segment === "knowledge") {
    if (sub === "distill") return "kb-distill";
    if (sub === "reference") return "kb-reference";
  }

  if (segment === "agents") return "sub-agents";
  if (segment === "output-styles") return "output-styles";
  if (segment === "statusline") return "statusline";
  if (segment === "commands") return "commands";
  if (segment === "config") return "config";
  if (segment === "context") return "context";
  if (segment === "chat") return "chat";
  if (segment === "skills") return "skills";
  if (segment === "hooks") return "hooks";
  if (segment === "mcp") return "mcp";
  if (segment === "marketplace") return "marketplace";
  if (segment === "extensions") return "extensions";
  if (segment === "features") return "features";

  return null;
}
