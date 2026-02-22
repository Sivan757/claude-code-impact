
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { useInvokeQuery, useSettingsPath, useSettingsScope } from "@/hooks";
import { useAppConfig } from "@/context";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { getUiPreference, setUiPreference } from "@/lib/uiPreferences";
import type { Project } from "@/types";

export function WorkspaceSelector() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { formatPath } = useAppConfig();
    const settingsPath = useSettingsPath();
    const { scopeKey } = useSettingsScope(settingsPath);
    const { data: projects = [], isLoading: loadingProjects } = useInvokeQuery<Project[]>(
        ["projects"],
        "list_projects"
    );

    const WORKSPACE_PREF_KEY = "claudecodeimpact:workspaces";
    const GLOBAL_WORKSPACE_VALUE = "__global__";
    const ADD_WORKSPACE_VALUE = "__add__";
    const REMOVE_WORKSPACE_VALUE = "__remove__";

    const [savedWorkspaces, setSavedWorkspaces] = useState<string[]>(() => {
        const stored = getUiPreference<string[]>(WORKSPACE_PREF_KEY);
        if (!Array.isArray(stored)) return [];
        return stored
            .filter((path) => typeof path === "string")
            .map((path) => path.trim())
            .filter(Boolean);
    });

    const persistWorkspaces = (next: string[]) => {
        const normalized = Array.from(
            new Set(
                next
                    .filter((path) => typeof path === "string")
                    .map((path) => path.trim())
                    .filter(Boolean)
            )
        );
        setSavedWorkspaces(normalized);
        setUiPreference(WORKSPACE_PREF_KEY, normalized);
        return normalized;
    };

    const updateWorkspace = (nextPath?: string) => {
        const params = new URLSearchParams(location.search);
        if (nextPath) {
            params.set("path", nextPath);
        } else {
            params.delete("path");
            params.set("scope", "global");
        }
        const search = params.toString();
        navigate(
            {
                pathname: location.pathname,
                search: search ? `?${search}` : "",
            },
            { replace: true }
        );
    };

    const handleWorkspaceChange = async (value: string) => {
        if (value === ADD_WORKSPACE_VALUE) {
            const manualPath = prompt(t('settings.enter_path'));
            if (!manualPath?.trim()) return;
            try {
                const resolved = await invoke<string>("resolve_user_path", { path: manualPath.trim() });
                const normalized = resolved || manualPath.trim();
                persistWorkspaces([...savedWorkspaces, normalized]);
                updateWorkspace(normalized);
            } catch {
                const normalized = manualPath.trim();
                persistWorkspaces([...savedWorkspaces, normalized]);
                updateWorkspace(normalized);
            }
            return;
        }

        if (value === REMOVE_WORKSPACE_VALUE) {
            if (!settingsPath) return;
            const updated = savedWorkspaces.filter((path) => path !== settingsPath);
            persistWorkspaces(updated);
            updateWorkspace(undefined);
            return;
        }

        if (value === GLOBAL_WORKSPACE_VALUE) {
            updateWorkspace(undefined);
            return;
        }

        updateWorkspace(value);
    };

    const savedWorkspaceSet = useMemo(
        () => new Set(savedWorkspaces),
        [savedWorkspaces]
    );

    const recentWorkspacePaths = useMemo(
        () =>
            projects
                .map((project) => project.path)
                .filter((path) => !savedWorkspaceSet.has(path)),
        [projects, savedWorkspaceSet]
    );

    const customWorkspacePath =
        settingsPath &&
            !savedWorkspaceSet.has(settingsPath) &&
            !projects.some((project) => project.path === settingsPath)
            ? settingsPath
            : undefined;

    const handleScopeChange = (value: string) => {
        if (value === "project" && !settingsPath) {
            return;
        }
        const params = new URLSearchParams(location.search);
        params.set("scope", value);
        navigate(
            {
                pathname: location.pathname,
                search: `?${params.toString()}`,
            },
            { replace: true }
        );
    };

    return (
        <div className="flex items-center gap-2 drag-none">
            {/* Workspace Selector */}
            <Select
                value={settingsPath ?? GLOBAL_WORKSPACE_VALUE}
                onValueChange={handleWorkspaceChange}
            >
                <SelectTrigger className="h-7 rounded-md bg-background/50 hover:bg-card/80 border-border/40 text-xs min-w-[120px] max-w-[200px] shadow-sm transition-colors focus:ring-0">
                    <SelectValue>
                        <span className="truncate block max-w-[180px]">
                            {settingsPath ? formatPath(settingsPath) : t('settings.workspace_global', 'Global')}
                        </span>
                    </SelectValue>
                </SelectTrigger>
                <SelectContent align="start" className="rounded-lg">
                    <SelectItem value={GLOBAL_WORKSPACE_VALUE}>
                        {t('settings.workspace_global', 'Global')}
                    </SelectItem>
                    {customWorkspacePath ? (
                        <>
                            <SelectSeparator />
                            <SelectGroup>
                                <SelectLabel>{t('settings.workspace_current', 'Current')}</SelectLabel>
                                <SelectItem value={customWorkspacePath} title={customWorkspacePath}>
                                    {formatPath(customWorkspacePath)}
                                </SelectItem>
                            </SelectGroup>
                        </>
                    ) : null}

                    <SelectSeparator />
                    <SelectGroup>
                        <SelectLabel>{t('settings.workspace_saved', 'Saved')}</SelectLabel>
                        {savedWorkspaces.length > 0 ? (
                            savedWorkspaces.map((path) => (
                                <SelectItem key={path} value={path} title={path}>
                                    {formatPath(path)}
                                </SelectItem>
                            ))
                        ) : (
                            <SelectItem value="__saved_empty" disabled>
                                {t('settings.workspace_saved_empty', 'No saved workspaces')}
                            </SelectItem>
                        )}
                    </SelectGroup>

                    <SelectSeparator />
                    <SelectGroup>
                        <SelectLabel>{t('settings.workspace_recent', 'Recent')}</SelectLabel>
                        {loadingProjects ? (
                            <SelectItem value="__loading" disabled>
                                {t('common.loading', 'Loading...')}
                            </SelectItem>
                        ) : recentWorkspacePaths.length > 0 ? (
                            recentWorkspacePaths.map((path) => (
                                <SelectItem key={path} value={path} title={path}>
                                    {formatPath(path)}
                                </SelectItem>
                            ))
                        ) : (
                            <SelectItem value="__empty" disabled>
                                {t('settings.workspace_empty', 'No recent projects')}
                            </SelectItem>
                        )}
                    </SelectGroup>

                    <SelectSeparator />
                    <SelectItem value={ADD_WORKSPACE_VALUE}>
                        {t('settings.workspace_add', 'Add workspace...')}
                    </SelectItem>
                    <SelectItem
                        value={REMOVE_WORKSPACE_VALUE}
                        disabled={!settingsPath || !savedWorkspaceSet.has(settingsPath)}
                    >
                        {t('settings.workspace_remove', 'Remove workspace')}
                    </SelectItem>
                </SelectContent>
            </Select>

            {/* Scope Selector - Simplified */}
            <Select value={scopeKey} onValueChange={handleScopeChange}>
                <SelectTrigger
                    className={cn(
                        "h-7 w-auto px-2 gap-1 rounded-md border-transparent hover:bg-muted/50 text-xs shadow-none focus:ring-0 transition-colors",
                        scopeKey === "project"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                    )}
                >
                    <SelectValue>
                        <span className="flex items-center gap-1.5">
                            <span
                                className={cn(
                                    "h-1.5 w-1.5 rounded-full shrink-0",
                                    scopeKey === "project" ? "bg-emerald-500" : "bg-sky-500"
                                )}
                            />
                            <span className="opacity-90">
                                {scopeKey === "project"
                                    ? t('settings.scope_project', 'Project')
                                    : t('settings.scope_global', 'Global')}
                            </span>
                        </span>
                    </SelectValue>
                </SelectTrigger>
                <SelectContent align="end" className="rounded-lg min-w-[100px]">
                    <SelectItem value="global">
                        <span className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                            {t('settings.scope_global', 'Global')}
                        </span>
                    </SelectItem>
                    <SelectItem value="project" disabled={!settingsPath}>
                        <span className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {t('settings.scope_project', 'Project')}
                        </span>
                    </SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
}
