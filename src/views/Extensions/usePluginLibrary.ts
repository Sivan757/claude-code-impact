import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { PluginScanResult } from "../../types";
import { useInvokeMutation, useInvokeQuery } from "../../hooks";
import { useConfirmDialog } from "@/components/dialogs/ConfirmDialogProvider";

export type PluginScope = "user" | "project" | "local";
export type PluginStatusFilter = "all" | "installed" | "not_installed";

interface PluginStats {
  total: number;
  installed: number;
  notInstalled: number;
}

interface PluginRuntimeState {
  id: string;
  scope: "user" | "project" | "local" | "managed";
  enabled: boolean;
  projectPath?: string | null;
}

const EMPTY_SCAN: PluginScanResult = {
  marketplaces: [],
  plugins: [],
  errors: [],
};

function toEnabledPluginMap(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const enabledPlugins = (raw as Record<string, unknown>).enabledPlugins;
  if (!enabledPlugins || typeof enabledPlugins !== "object" || Array.isArray(enabledPlugins)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(enabledPlugins as Record<string, unknown>).map(([key, value]) => [key, value === true]),
  );
}

function normalizePath(path?: string | null): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  return trimmed.replace(/[\\/]+$/, "");
}

function isProjectLikeScope(scope: PluginScope) {
  return scope === "project" || scope === "local";
}

function resolveEnabledOverride(
  enabledPluginsOverride: Record<string, boolean>,
  pluginId: string,
): boolean | undefined {
  const shortId = pluginId.split("@")[0];
  const candidateKeys = new Set<string>([pluginId, shortId]);
  const prefixed = `${shortId}@`;

  for (const key of Object.keys(enabledPluginsOverride)) {
    if (key.startsWith(prefixed)) {
      candidateKeys.add(key);
    }
  }

  for (const key of candidateKeys) {
    if (enabledPluginsOverride[key] === false) {
      return false;
    }
  }

  for (const key of candidateKeys) {
    if (enabledPluginsOverride[key] === true) {
      return true;
    }
  }

  return undefined;
}

export function usePluginLibrary(options?: {
  settingsPath?: string;
  scope?: PluginScope;
  projectPath?: string;
  onSettingsMutated?: (raw: Record<string, unknown>) => void;
  enabledPluginsOverride?: Record<string, boolean>;
  onToggleOverride?: (pluginId: string, enabled: boolean) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const confirmDialog = useConfirmDialog();
  const settingsPath = options?.settingsPath;
  const scope: PluginScope = options?.scope ?? "user";
  const projectPath = options?.projectPath;
  const onSettingsMutated = options?.onSettingsMutated;
  const enabledPluginsOverride = options?.enabledPluginsOverride;
  const onToggleOverride = options?.onToggleOverride;
  const normalizedProjectPath = normalizePath(projectPath);

  const scanAndRuntimeInvalidate = [["pluginScan"], ["pluginRuntimeState"]] as const;
  const runtimeOnlyInvalidate = [["pluginRuntimeState"]] as const;

  const scanQuery = useInvokeQuery<PluginScanResult>(["pluginScan"], "scan_plugins");
  const runtimeStateQuery = useInvokeQuery<PluginRuntimeState[]>(
    ["pluginRuntimeState"],
    "list_plugin_runtime_state",
  );
  const settingsQuery = useInvokeQuery<{ raw: Record<string, unknown> | null }>(
    ["pluginSettings", settingsPath ?? "__global__"],
    "get_settings",
    settingsPath ? { path: settingsPath } : undefined,
  );
  const scanResult = scanQuery.data ?? EMPTY_SCAN;

  const [activeMarketplace, setActiveMarketplace] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<PluginStatusFilter>("all");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const [actionPluginId, setActionPluginId] = useState<string | null>(null);
  const [togglingPluginId, setTogglingPluginId] = useState<string | null>(null);
  const [updatingPluginId, setUpdatingPluginId] = useState<string | null>(null);
  const [updatingMarketplaceId, setUpdatingMarketplaceId] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<Record<string, boolean>>({});

  const installMutation = useInvokeMutation<string, { pluginId: string; scope?: PluginScope; projectPath?: string }>(
    "install_plugin",
    [...scanAndRuntimeInvalidate],
  );
  const uninstallMutation = useInvokeMutation<string, { pluginId: string; scope?: PluginScope; projectPath?: string }>(
    "uninstall_plugin",
    [...scanAndRuntimeInvalidate],
  );
  const enableMutation = useInvokeMutation<string, { pluginId: string; scope?: PluginScope; projectPath?: string }>(
    "enable_plugin",
    [...runtimeOnlyInvalidate],
  );
  const disableMutation = useInvokeMutation<string, { pluginId: string; scope?: PluginScope; projectPath?: string }>(
    "disable_plugin",
    [...runtimeOnlyInvalidate],
  );
  const updateMutation = useInvokeMutation<string, { pluginId: string; scope?: PluginScope; projectPath?: string }>(
    "update_plugin",
    [...scanAndRuntimeInvalidate],
  );
  const addMarketplaceMutation = useInvokeMutation<string, { source: string }>("add_extension_marketplace", [["pluginScan"]]);
  const removeMarketplaceMutation = useInvokeMutation<string, { name: string }>(
    "remove_extension_marketplace_safe",
    [["pluginScan"]]
  );
  const updateMarketplaceMutation = useInvokeMutation<string, { name?: string }>(
    "update_extension_marketplace",
    [["pluginScan"]]
  );

  const normalizeError = (error: unknown) => {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [search]);

  const isNotInstalledError = (message: string) => {
    const lower = message.toLowerCase();
    return (
      lower.includes("not found in installed plugins") ||
      lower.includes("not found in installed") ||
      lower.includes("not installed")
    );
  };

  const ensureScopeContext = () => {
    if (!isProjectLikeScope(scope)) {
      return true;
    }
    if (normalizedProjectPath) {
      return true;
    }
    setActionError(`Scope '${scope}' requires a project path`);
    return false;
  };

  const getActionArgs = (pluginId: string) => ({
    pluginId,
    scope,
    projectPath: normalizedProjectPath ?? undefined,
  });

  const enabledFromSettings = useMemo(
    () => toEnabledPluginMap(settingsQuery.data?.raw ?? null),
    [settingsQuery.data?.raw],
  );

  const scopedRuntimeState = useMemo(() => {
    const map = new Map<string, { enabled: boolean }>();
    const states = runtimeStateQuery.data ?? [];

    for (const state of states) {
      if (state.scope !== scope) {
        continue;
      }

      if (isProjectLikeScope(scope)) {
        if (!normalizedProjectPath) {
          continue;
        }
        const itemProjectPath = normalizePath(state.projectPath ?? null);
        if (itemProjectPath && itemProjectPath !== normalizedProjectPath) {
          continue;
        }
      }

      map.set(state.id, { enabled: state.enabled });
    }

    return map;
  }, [normalizedProjectPath, runtimeStateQuery.data, scope]);

  const plugins = useMemo(() => {
    const base = scanResult.plugins.map((plugin) => {
      const state = scopedRuntimeState.get(plugin.id);
      const isInstalled = state ? true : plugin.isInstalled;
      let isEnabled = state?.enabled ?? plugin.isEnabled;

      if (enabledPluginsOverride) {
        const overrideEnabled = resolveEnabledOverride(enabledPluginsOverride, plugin.id);
        if (overrideEnabled !== undefined) {
          isEnabled = overrideEnabled;
        }
      } else if (settingsPath && enabledFromSettings[plugin.id] !== undefined) {
        isEnabled = enabledFromSettings[plugin.id] === true;
      }

      return {
        ...plugin,
        isInstalled,
        isEnabled,
      };
    });

    if (Object.keys(pendingToggle).length === 0) {
      return base;
    }

    return base.map((plugin) =>
      pendingToggle[plugin.id] === undefined
        ? plugin
        : { ...plugin, isEnabled: pendingToggle[plugin.id] }
    );
  }, [
    enabledFromSettings,
    enabledPluginsOverride,
    pendingToggle,
    scanResult.plugins,
    scopedRuntimeState,
    settingsPath,
  ]);

  const scopedPlugins = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let next = plugins;

    if (activeMarketplace !== "all") {
      next = next.filter((plugin) => plugin.marketplace === activeMarketplace);
    }

    if (query) {
      next = next.filter((plugin) => {
        return (
          plugin.name.toLowerCase().includes(query) ||
          plugin.marketplace.toLowerCase().includes(query) ||
          (plugin.description ?? "").toLowerCase().includes(query) ||
          (plugin.author ?? "").toLowerCase().includes(query)
        );
      });
    }

    return next;
  }, [activeMarketplace, debouncedSearch, plugins]);

  const stats = useMemo<PluginStats>(() => {
    const installed = scopedPlugins.filter((plugin) => plugin.isInstalled).length;
    return {
      total: scopedPlugins.length,
      installed,
      notInstalled: scopedPlugins.length - installed,
    };
  }, [scopedPlugins]);

  const filteredPlugins = useMemo(() => {
    let next = scopedPlugins;

    if (statusFilter === "installed") {
      next = next.filter((plugin) => plugin.isInstalled);
    } else if (statusFilter === "not_installed") {
      next = next.filter((plugin) => !plugin.isInstalled);
    }

    return [...next].sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
  }, [scopedPlugins, statusFilter]);

  const isScanning =
    scanQuery.isLoading || scanQuery.isFetching;
  const scanError = scanQuery.error
    ? String(scanQuery.error)
    : (runtimeStateQuery.error ? String(runtimeStateQuery.error) : null);

  const installPlugin = async (pluginId: string) => {
    if (!ensureScopeContext()) return;

    setActionPluginId(pluginId);
    setActionError(null);
    try {
      await installMutation.mutateAsync(getActionArgs(pluginId));
    } catch (error) {
      setActionError(normalizeError(error));
    } finally {
      setActionPluginId(null);
    }
  };

  const uninstallPlugin = async (pluginId: string) => {
    if (!ensureScopeContext()) return;
    const confirmed = await confirmDialog({
      title: t("extensions_view.uninstall", "Uninstall"),
      description: t("extensions_view.confirm_uninstall", {
        plugin: pluginId,
        defaultValue: `Uninstall plugin "${pluginId}"?`,
      }),
      variant: "destructive",
      confirmText: t("extensions_view.uninstall", "Uninstall"),
    });
    if (!confirmed) return;

    setActionPluginId(pluginId);
    setActionError(null);
    try {
      await uninstallMutation.mutateAsync(getActionArgs(pluginId));
    } catch (error) {
      const message = normalizeError(error);
      if (isNotInstalledError(message)) {
        try {
          await installMutation.mutateAsync(getActionArgs(pluginId));
          await uninstallMutation.mutateAsync(getActionArgs(pluginId));
          return;
        } catch (fallbackError) {
          setActionError(normalizeError(fallbackError));
          return;
        }
      }
      setActionError(message);
    } finally {
      setActionPluginId(null);
    }
  };

  const togglePlugin = async (pluginId: string, enabled: boolean) => {
    setTogglingPluginId(pluginId);
    setActionError(null);
    setPendingToggle((prev) => ({ ...prev, [pluginId]: enabled }));
    try {
      if (onToggleOverride) {
        await Promise.resolve(onToggleOverride(pluginId, enabled));
        return;
      }

      if (settingsPath) {
        await invoke<void>("toggle_plugin", {
          pluginId,
          enabled,
          path: settingsPath,
        });
        const refreshed = await settingsQuery.refetch();
        const refreshedRaw = refreshed.data?.raw;
        if (
          onSettingsMutated
          && refreshedRaw
          && typeof refreshedRaw === "object"
          && !Array.isArray(refreshedRaw)
        ) {
          onSettingsMutated(refreshedRaw as Record<string, unknown>);
        }
      } else {
        if (!ensureScopeContext()) {
          return;
        }
        if (enabled) {
          await enableMutation.mutateAsync(getActionArgs(pluginId));
        } else {
          await disableMutation.mutateAsync(getActionArgs(pluginId));
        }
      }
    } catch (error) {
      const message = normalizeError(error);
      if (onToggleOverride) {
        setActionError(message);
        return;
      }
      if (settingsPath) {
        setActionError(message);
        return;
      }
      if (isNotInstalledError(message)) {
        try {
          await installMutation.mutateAsync(getActionArgs(pluginId));
          if (enabled) {
            await enableMutation.mutateAsync(getActionArgs(pluginId));
          } else {
            await disableMutation.mutateAsync(getActionArgs(pluginId));
          }
          return;
        } catch (fallbackError) {
          setActionError(normalizeError(fallbackError));
          return;
        }
      }
      setActionError(message);
    } finally {
      setPendingToggle((prev) => {
        const next = { ...prev };
        delete next[pluginId];
        return next;
      });
      setTogglingPluginId(null);
    }
  };

  const updatePlugin = async (pluginId: string) => {
    if (!ensureScopeContext()) return;

    setUpdatingPluginId(pluginId);
    setActionError(null);
    try {
      await updateMutation.mutateAsync(getActionArgs(pluginId));
    } catch (error) {
      setActionError(normalizeError(error));
    } finally {
      setUpdatingPluginId(null);
    }
  };

  const updateMarketplace = async (name?: string) => {
    setUpdatingMarketplaceId(name ?? "all");
    setActionError(null);
    try {
      if (name) {
        await updateMarketplaceMutation.mutateAsync({ name });
      } else {
        await updateMarketplaceMutation.mutateAsync({});
      }
    } catch (error) {
      setActionError(normalizeError(error));
    } finally {
      setUpdatingMarketplaceId(null);
    }
  };

  const addMarketplace = async (source: string) => {
    if (!source.trim()) return;
    setActionError(null);
    try {
      await addMarketplaceMutation.mutateAsync({ source: source.trim() });
    } catch (error) {
      setActionError(normalizeError(error));
    }
  };

  const removeMarketplace = async (name: string) => {
    const confirmed = await confirmDialog({
      title: t("common.remove", "Remove"),
      description: t("extensions_view.confirm_remove_marketplace", {
        marketplace: name,
        defaultValue: `Remove marketplace "${name}"?`,
      }),
      variant: "destructive",
      confirmText: t("common.remove", "Remove"),
    });
    if (!confirmed) return;

    setActionError(null);
    try {
      await removeMarketplaceMutation.mutateAsync({ name });
    } catch (error) {
      setActionError(normalizeError(error));
    }
  };

  const isOperating =
    installMutation.isPending ||
    uninstallMutation.isPending ||
    enableMutation.isPending ||
    disableMutation.isPending ||
    updateMutation.isPending ||
    addMarketplaceMutation.isPending ||
    removeMarketplaceMutation.isPending ||
    updateMarketplaceMutation.isPending;

  return {
    scanResult,
    plugins,
    scopedPlugins,
    filteredPlugins,
    stats,
    activeMarketplace,
    setActiveMarketplace,
    statusFilter,
    setStatusFilter,

    scope,
    projectPath: normalizedProjectPath,

    search,
    setSearch,
    actionError,
    setActionError,
    isScanning,
    scanError,
    isOperating,
    actionPluginId,
    togglingPluginId,
    updatingPluginId,
    updatingMarketplaceId,
    installPlugin,
    uninstallPlugin,
    togglePlugin,
    updatePlugin,
    updateMarketplace,
    addMarketplace,
    removeMarketplace,
  };
}
