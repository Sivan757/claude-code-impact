import { type ReactNode, useEffect } from "react";
import { useAtom } from "jotai";
import { motion, AnimatePresence } from "framer-motion";
import {
  PersonIcon, ChevronLeftIcon, ChevronRightIcon,
  CounterClockwiseClockIcon, LayersIcon,
} from "@radix-ui/react-icons";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { sidebarCollapsedAtom, profileAtom, primaryFeatureAtom } from "@/store";
import { useTranslation } from "react-i18next";

import type { View, FeatureType } from "@/types";

interface GlobalHeaderProps {
  currentFeature: FeatureType | null;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onNavigate: (view: View) => void;
  onFeatureClick: (feature: FeatureType) => void;
  onShowProfileDialog: () => void;
  onShowSettings: () => void;
}

export function GlobalHeader({
  currentFeature,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onNavigate,
  onFeatureClick,
  onShowProfileDialog,
  onShowSettings,
}: GlobalHeaderProps) {
  const { t } = useTranslation();
  const [sidebarCollapsed] = useAtom(sidebarCollapsedAtom);
  const [profile] = useAtom(profileAtom);

  const [primaryFeature, setPrimaryFeature] = useAtom(primaryFeatureAtom);




  // Main nav features - use primaryFeature for active state (not affected by profile menu clicks)
  const mainNavFeatures = ["chat"] as const;
  const isMainNavFeature = (f: string | null) => f && (mainNavFeatures.includes(f as typeof mainNavFeatures[number]) || f.startsWith("kb-"));

  // Handle main nav click - updates primaryFeature
  const handleMainNavClick = (feature: FeatureType) => {
    setPrimaryFeature(feature);
    onFeatureClick(feature);
  };

  // Sync primaryFeature when navigating to main features via other means (sidebar, back/forward)
  useEffect(() => {
    if (isMainNavFeature(currentFeature)) {
      setPrimaryFeature(currentFeature);
    }
  }, [currentFeature]);

  if (sidebarCollapsed) {
    // Collapsed layout - full nav in header
    return (
      <div data-tauri-drag-region className="h-[52px] shrink-0 flex items-center justify-between border-b border-border bg-card">
        <div className="flex items-center pl-[80px]">
          <div className="flex items-center gap-0.5">
            <NavButton
              isActive={primaryFeature === null}
              onClick={() => { setPrimaryFeature(null); onNavigate({ type: "home" }); }}
              icon={<img src="/logo.png" alt="Claude Code Impact" className="w-4 h-4" />}
              label="Claude Code Impact"
            />

            <NavButton
              isActive={primaryFeature === "features"}
              onClick={() => handleMainNavClick("features")}
              icon={<LayersIcon className="w-4 h-4" />}
              label={t('features.general')}
            />
            <NavButton
              isActive={primaryFeature === "chat"}
              onClick={() => handleMainNavClick("chat")}
              icon={<CounterClockwiseClockIcon className="w-4 h-4" />}
              label={t('features.history')}
            />

          </div>
          <div className="h-4 border-l border-border mx-2" />
          <div className="flex items-center gap-0.5">
            <button
              onClick={onGoBack}
              disabled={!canGoBack}
              className="p-1.5 rounded-md text-muted-foreground hover:text-ink hover:bg-card-alt disabled:opacity-30 disabled:pointer-events-none"
              title={t('common.go_back')}
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              onClick={onGoForward}
              disabled={!canGoForward}
              className="p-1.5 rounded-md text-muted-foreground hover:text-ink hover:bg-card-alt disabled:opacity-30 disabled:pointer-events-none"
              title={t('common.go_forward')}
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>

        </div>
        <ProfileMenu
          profile={profile}
          onShowProfileDialog={onShowProfileDialog}
          onShowSettings={onShowSettings}
        />
      </div>
    );
  }

  // Expanded layout - minimal header (nav is in sidebar)
  return (
    <div data-tauri-drag-region className="h-[52px] shrink-0 flex items-center justify-between border-b border-border bg-card">
      <div className="flex items-center gap-0.5 pl-3">
        <button
          onClick={onGoBack}
          disabled={!canGoBack}
          className="p-1.5 rounded-md text-muted-foreground hover:text-ink hover:bg-card-alt disabled:opacity-30 disabled:pointer-events-none"
          title={t('common.go_back')}
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <button
          onClick={onGoForward}
          disabled={!canGoForward}
          className="p-1.5 rounded-md text-muted-foreground hover:text-ink hover:bg-card-alt disabled:opacity-30 disabled:pointer-events-none"
          title={t('common.go_forward')}
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>


      </div>
      <ProfileMenu
        profile={profile}
        onShowProfileDialog={onShowProfileDialog}
        onShowSettings={onShowSettings}
      />
    </div>
  );
}

function ProfileMenu({
  profile,
  onShowProfileDialog,
  onShowSettings,
}: {
  profile: { nickname: string; avatarUrl: string };
  onShowProfileDialog: () => void;
  onShowSettings: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="pr-4">
      <Popover>
        <PopoverTrigger className="rounded-full hover:ring-2 hover:ring-primary/50 transition-all">
          <Avatar className="h-6 w-6 cursor-pointer">
            {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt={profile.nickname || "User"} /> : null}
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {profile.nickname ? profile.nickname.charAt(0).toUpperCase() : <PersonIcon className="w-4 h-4" />}
            </AvatarFallback>
          </Avatar>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-2">
          <div className="space-y-1">
            {profile.nickname && (
              <p className="px-2 py-1.5 text-sm font-medium text-ink truncate">{profile.nickname}</p>
            )}
            <button
              onClick={onShowProfileDialog}
              className="w-full text-left px-2 py-1.5 text-sm text-muted-foreground hover:text-ink hover:bg-card-alt rounded-md transition-colors"
            >
              {t('profile_dialog.title')}
            </button>
            <button
              onClick={onShowSettings}
              className="w-full text-left px-2 py-1.5 text-sm text-muted-foreground hover:text-ink hover:bg-card-alt rounded-md transition-colors"
            >
              {t('settings_dialog.title')}
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Animated nav button with expanding label
function NavButton({
  isActive,
  onClick,
  icon,
  label,
}: {
  isActive: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={`px-2 py-1.5 rounded flex items-center gap-1.5 overflow-hidden ${isActive
        ? "bg-primary/10 text-primary [&_img]:opacity-100"
        : "text-primary/50 hover:text-primary/70 hover:bg-card-alt [&_img]:opacity-50 hover:[&_img]:opacity-70"
        }`}
      title={label}
      layout
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {icon}
      <AnimatePresence mode="wait">
        {isActive && (
          <motion.span
            key={label}
            className="text-sm whitespace-nowrap"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
