import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { FeatureType, TemplateCategory } from "@/types";
import { useTranslation } from "react-i18next";
import {
  GearIcon,
  CubeIcon,
  PersonIcon,
  LightningBoltIcon,
  MixIcon,
  Link2Icon,
  ReloadIcon,
  CheckIcon,
} from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "../../hooks";

type SidebarKey = TemplateCategory | "basic-env" | "basic-llm" | "basic-settings" | "extensions";

// Map sidebar key to route path
const KEY_TO_ROUTE: Record<SidebarKey, string> = {
  "basic-env": "/settings/env",
  "basic-llm": "/settings/llm",
  "basic-settings": "/settings",
  context: "/context",
  settings: "/settings",
  mcps: "/mcp",
  skills: "/skills",
  hooks: "/settings/hooks",
  agents: "/agents",
  extensions: "/extensions",
};

// Map feature type to sidebar key
const FEATURE_TO_KEY: Partial<Record<FeatureType, SidebarKey>> = {
  "basic-env": "basic-env",
  "basic-llm": "basic-llm",
  "basic-version": "settings",
  settings: "settings",
  context: "context",
  mcp: "mcps",
  skills: "skills",
  hooks: "hooks",
  "sub-agents": "agents",
  extensions: "extensions",
};

interface FeaturesLayoutProps {
  children: ReactNode;
  feature?: FeatureType;
  showTopNavigation?: boolean;
  // Legacy props for gradual migration
  currentFeature?: FeatureType | null;
  onFeatureClick?: (feature: FeatureType) => void;
}

export function FeaturesLayout({
  children,
  feature,
  showTopNavigation = true,
  currentFeature,
  onFeatureClick,
}: FeaturesLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Mimic async operation if query invalidation is synchronous, just for the visual effect
    // In reality invalidateQueries is async but returns immediately usually unless awaited?
    // invalidateQueries returns a promise.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["settings"] }),
      queryClient.invalidateQueries({ queryKey: ["hooks"] }),
      queryClient.invalidateQueries({ queryKey: ["installedPlugins"] }),
      queryClient.invalidateQueries({ queryKey: ["mcpConfigPath"] }),
      queryClient.invalidateQueries({ queryKey: ["contextFiles"] }),
      queryClient.invalidateQueries({ queryKey: ["skills"] }),
      queryClient.invalidateQueries({ queryKey: ["agents"] }),
      new Promise(resolve => setTimeout(resolve, 600)) // Ensure animation lasts at least 600ms
    ]);

    setIsRefreshing(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const groups = useMemo(() => [
    {
      items: [
        { key: "settings", label: t('features.common_settings') || "General", icon: GearIcon },
        { key: "basic-llm", label: t('features.basic-llm') || "Provider", icon: LightningBoltIcon },
        { key: "extensions", label: t('features.extensions') || "Plugins", icon: CubeIcon },
        { key: "basic-env", label: t('features.basic-env') || "Env", icon: MixIcon },
        { key: "hooks", label: t('features.hooks') || "Hooks", icon: Link2Icon },
        { key: "context", label: t('features.context'), icon: FileTextIconFallback },
        { key: "mcps", label: t('features.mcp'), icon: CubeIcon },
        { key: "skills", label: t('features.skills'), icon: LightningBoltIcon },
        { key: "agents", label: t('features.sub-agents'), icon: PersonIcon },
      ],
    },
  ], [t]);

  const activeFeature = feature ?? currentFeature;
  const activeKey = activeFeature ? FEATURE_TO_KEY[activeFeature] ?? null : null;

  const handleItemClick = (key: string) => {
    if (onFeatureClick) {
      // Legacy mode
      const keyToFeature: Record<SidebarKey, FeatureType> = {
        "basic-env": "basic-env",
        "basic-llm": "basic-llm",
        "context": "context",
        "basic-settings": "settings",
        settings: "settings",
        mcps: "mcp",
        skills: "skills",
        hooks: "hooks",
        agents: "sub-agents",
        extensions: "extensions",
      };
      onFeatureClick(keyToFeature[key as SidebarKey]);
    } else {
      // Router mode
      navigate({
        pathname: KEY_TO_ROUTE[key as SidebarKey],
        search: location.search,
      });
    }
  };

  // Floating Island Layout (Selected by User)
  return (
    <div className="flex flex-col h-full w-full bg-background relative overflow-hidden">
      {/* Decorative background gradient */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-6 left-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-foreground/90 text-background backdrop-blur-md rounded-full shadow-lg text-sm font-medium"
          >
            <CheckIcon className="w-4 h-4 text-green-400" />
            <span>{t('common.refreshed') || "Configuration refreshed"}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main
        className={cn(
          "flex-1 overflow-hidden relative p-[10px] flex gap-2",
          showTopNavigation ? "flex-col md:flex-row" : "flex-col"
        )}
      >
        {showTopNavigation && (
          <aside className="shrink-0 md:w-[220px]">
            <div className="h-full rounded-2xl border border-border/40 bg-secondary/35 backdrop-blur-sm p-2 flex md:flex-col gap-2">
              <nav
                aria-label={t('features.common_settings') || "Configuration Navigation"}
                className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible scrollbar-thin"
              >
                {groups[0].items.map((item) => {
                  const isActive = activeKey === item.key;
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => handleItemClick(item.key)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap md:w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        isActive ? "text-primary bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="feature-nav-active"
                          className="absolute inset-0 rounded-lg bg-background shadow-sm z-[-1]"
                          transition={{ type: "spring", stiffness: 320, damping: 30 }}
                        />
                      )}
                      {Icon && <Icon className="w-4 h-4 shrink-0" />}
                      <span className="z-10">{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="hidden md:block h-px bg-border/60 my-0.5" />

              <motion.button
                type="button"
                onClick={handleRefresh}
                aria-label={t('common.refresh') || "Refresh"}
                className="shrink-0 flex items-center justify-center md:justify-start gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                title={t('common.refresh') || "Refresh"}
                whileTap={{ scale: 0.97 }}
              >
                <motion.div
                  animate={{ rotate: isRefreshing ? 360 : 0 }}
                  transition={{ duration: 0.6, ease: "easeInOut", repeat: isRefreshing ? Infinity : 0 }}
                >
                  <ReloadIcon className="w-4 h-4" />
                </motion.div>
                <span className="hidden md:inline text-sm">{t('common.refresh') || "Refresh"}</span>
              </motion.button>
            </div>
          </aside>
        )}

        <div className="flex-1 min-h-0 w-full rounded-2xl overflow-hidden flex flex-col relative group z-0">
          <div className="absolute inset-0 bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl shadow-sm pointer-events-none z-[-1]" />
          {children}
        </div>
      </main>
    </div>
  );
}

// Fallback icon since FileTextIcon isn't exported from radix-ui/react-icons commonly used set, using generic
const FileTextIconFallback = (props: { className?: string }) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={props.className}
  >
    <path d="M4 1C3.44772 1 3 1.44772 3 2V13C3 13.5523 3.44772 14 4 14H11C11.5523 14 12 13.5523 12 13V4.5L8.5 1H4ZM4 2H8V4.5H11V13H4V2Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
  </svg>
)
