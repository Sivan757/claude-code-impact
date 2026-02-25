import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import {
  PlusIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "../../components/ui/button";
import { ConfigPage, SearchInput, LoadingState, EmptyState } from "../../components/config";
import { useInvokeQuery } from "../../hooks";
import { useMultiProjectConfig } from "../../config/hooks/useMultiProjectConfig";
import { useConfigExport } from "../../config/hooks/useConfigExport";
import { useTerminalLauncher } from "../../hooks/useTerminalLauncher";
import type { Project } from "../../types";
import { ProjectCard } from "./ProjectCard";
import { SessionLauncherDialog } from "./SessionLauncherDialog";
import { getUiPreference, setUiPreference } from "../../lib/uiPreferences";
import { profileAtom } from "@/store";
import { getPreferredTerminalApp } from "@/lib/terminalPreference";
import type { LlmProfilesState } from "../../lib/llmProfiles";

export function ProjectHubView() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [launchPath, setLaunchPath] = useState<string | null>(null);
  const [profile] = useAtom(profileAtom);
  const preferredTerminalApp = getPreferredTerminalApp(profile);

  // Load projects from Claude Code history + saved workspaces
  const { data: projects, isLoading } = useInvokeQuery<Project[]>(
    ["projects"],
    "list_projects"
  );
  const { data: llmProfilesState } = useInvokeQuery<LlmProfilesState>(
    ["llmProfilesState"],
    "get_llm_profiles_state",
  );

  // Get saved workspaces from UI preferences
  const savedWorkspaces = useMemo(() => {
    const stored = getUiPreference<string[]>("claudecodeimpact:workspaces");
    return Array.isArray(stored) ? stored : [];
  }, []);

  // Combine project paths
  const allPaths = useMemo(() => {
    const paths = new Set<string>();
    projects?.forEach((p) => paths.add(p.path));
    savedWorkspaces.forEach((w) => paths.add(w));
    return Array.from(paths);
  }, [projects, savedWorkspaces]);

  // Batch-read configs
  const { data: configs } = useMultiProjectConfig(allPaths);

  // Mutations
  const exportMutation = useConfigExport();
  const terminalMutation = useTerminalLauncher();

  // Filter
  const filtered = useMemo(() => {
    if (!search) return allPaths;
    const q = search.toLowerCase();
    return allPaths.filter((p) => p.toLowerCase().includes(q));
  }, [allPaths, search]);

  const providerProfiles = llmProfilesState?.profiles ?? [];

  const handleAddProject = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      const updated = [...savedWorkspaces, selected];
      setUiPreference("claudecodeimpact:workspaces", updated);
      window.location.reload();
    }
  };

  const handleExport = async (path: string) => {
    try {
      const json = await exportMutation.mutateAsync({
        projectPath: path,
        includeLocal: false,
      });
      await navigator.clipboard.writeText(json);
    } catch { /* user will see toast from mutation state */ }
  };

  const handleOpenLauncher = (path: string) => {
    setLaunchPath(path);
  };

  if (isLoading) return <LoadingState message={t("projects.loading")} />;

  return (
    <ConfigPage className="p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("projects.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("projects.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput
            placeholder={t("projects.search_placeholder")}
            value={search}
            onChange={setSearch}
            className="w-64 px-3.5 py-2 text-sm bg-secondary/40 border border-border/50 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-xl gap-1.5"
            onClick={handleAddProject}
          >
            <PlusIcon className="w-3.5 h-3.5" />
            {t("common.add")}
          </Button>
        </div>
      </div>

      {/* Project Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={MagnifyingGlassIcon}
          message={t("projects.no_projects")}
          hint={t("projects.add_hint")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto flex-1">
          {filtered.map((path) => (
            <ProjectCard
              key={path}
              path={path}
              config={configs?.[path]}
              providerProfiles={providerProfiles}
              onOpenLauncher={() => handleOpenLauncher(path)}
              onTerminal={() =>
                terminalMutation.mutate({
                  cwd: path,
                  terminalApp: preferredTerminalApp,
                  command: "claude",
                })
              }
              onExport={() => handleExport(path)}
            />
          ))}
        </div>
      )}

      {/* Session Launcher */}
      {launchPath && (
        <SessionLauncherDialog
          open={!!launchPath}
          onOpenChange={(v) => { if (!v) setLaunchPath(null); }}
          projectPath={launchPath}
        />
      )}
    </ConfigPage>
  );
}
