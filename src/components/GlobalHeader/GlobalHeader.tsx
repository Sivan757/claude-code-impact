import { type ReactNode, useEffect } from "react";
import { useAtom } from "jotai";
import { motion } from "framer-motion";
import {
  PersonIcon,
  CounterClockwiseClockIcon, GearIcon,
} from "@radix-ui/react-icons";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { profileAtom, primaryFeatureAtom } from "@/store";
import { useTranslation } from "react-i18next";

import type { View, FeatureType } from "@/types";

interface GlobalHeaderProps {
  currentFeature: FeatureType | null;
  onNavigate: (view: View) => void;
  onFeatureClick: (feature: FeatureType) => void;
  onShowProfileDialog: () => void;
  onShowSettings: () => void;
}

export function GlobalHeader({
  currentFeature,
  onNavigate,
  onFeatureClick,
  onShowProfileDialog,
  // onShowSettings, // Kept in interface but removed from used props to avoid lint error.
}: GlobalHeaderProps) {
  const { t } = useTranslation();
  const [profile] = useAtom(profileAtom);

  const [primaryFeature, setPrimaryFeature] = useAtom(primaryFeatureAtom);




  // Main nav features - use primaryFeature for active state (not affected by profile menu clicks)
  const mainNavFeatures = ["chat", "settings"] as const;
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

  return (
    <div data-tauri-drag-region className="h-[52px] shrink-0 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center pl-[80px]">
        <div className="flex items-center gap-0.5">
          <NavButton
            isActive={primaryFeature === null}
            onClick={() => { setPrimaryFeature(null); onNavigate({ type: "home" }); }}
            icon={<img src="/logo.png" alt="Claude Code Impact" className="w-4 h-4" />}
            label="Claude Code Impact"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <NavButton
          isActive={primaryFeature === "chat"}
          onClick={() => handleMainNavClick("chat")}
          icon={<CounterClockwiseClockIcon className="w-4 h-4" />}
          label={t('features.history')}
        />
        <NavButton
          isActive={primaryFeature === "settings"}
          onClick={() => handleMainNavClick("settings")}
          icon={<GearIcon className="w-4 h-4" />}
          label={t('features.common_settings')}
        />
        <ProfileMenu
          profile={profile}
          onShowProfileDialog={onShowProfileDialog}
        />
      </div>
    </div>
  );
}

function ProfileMenu({
  profile,
  onShowProfileDialog,
}: {
  profile: { nickname: string; avatarUrl: string };
  onShowProfileDialog: () => void;
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
    </motion.button>
  );
}
