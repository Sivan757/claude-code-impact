import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";


interface ProjectLogoProps {
  projectPath: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: { icon: "w-4 h-4", img: "w-5 h-5", text: "text-[10px]" },
  md: { icon: "w-5 h-5", img: "w-6 h-6", text: "text-xs" },
  lg: { icon: "w-6 h-6", img: "w-8 h-8", text: "text-base" },
  xl: { icon: "w-8 h-8", img: "w-12 h-12", text: "text-xl" },
};

export function ProjectLogo({ projectPath, size = "sm" }: ProjectLogoProps) {
  const { t } = useTranslation();
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  const loadLogo = useCallback(() => {
    setHasError(false);
    invoke<string | null>("get_project_logo", { projectPath })
      .then(setLogoSrc)
      .catch(() => setLogoSrc(null));
  }, [projectPath]);

  useEffect(() => {
    loadLogo();

    // Listen for logo updates from LogoManager
    const handleLogoUpdate = (e: CustomEvent) => {
      if (e.detail?.projectPath === projectPath) {
        loadLogo();
      }
    };
    window.addEventListener("logo-updated", handleLogoUpdate as EventListener);
    return () => window.removeEventListener("logo-updated", handleLogoUpdate as EventListener);
  }, [projectPath, loadLogo]);

  const classes = sizeClasses[size];

  if (!logoSrc || hasError) {
    const projectName = projectPath.replace(/\/+$/, "").split("/").pop() || "P";
    const letter = projectName.charAt(0).toUpperCase();
    return (
      <div className={`${classes.img} ${classes.text} bg-primary/10 text-primary flex items-center justify-center rounded font-bold select-none flex-shrink-0`}>
        {letter}
      </div>
    );
  }

  return (
    <img
      src={logoSrc}
      alt={t('workspace.logo_manager.title')}
      className={`${classes.img} rounded object-contain flex-shrink-0`}
      onError={() => setHasError(true)}
    />
  );
}
