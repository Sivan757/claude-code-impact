import { useMemo, useState } from "react";
import type { PluginScanResult, ScannedMarketplace, ScannedPlugin } from "../../types";
import { useInvokeMutation, useInvokeQuery } from "../../hooks";

export type PluginStatusFilter = "all" | "installed" | "not_installed";


interface PluginStats {
  total: number;
  installed: number;
  notInstalled: number;
}

const EMPTY_SCAN: PluginScanResult = {
  marketplaces: [],
  plugins: [],
  errors: [],
};

export function usePluginLibrary() {
  const scanQuery = useInvokeQuery<PluginScanResult>(["pluginScan"], "scan_plugins");
  const scanResult = scanQuery.data ?? EMPTY_SCAN;

  const [activeMarketplace, setActiveMarketplace] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<PluginStatusFilter>("all");

  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const [actionPluginId, setActionPluginId] = useState<string | null>(null);
  const [togglingPluginId, setTogglingPluginId] = useState<string | null>(null);
  const [updatingPluginId, setUpdatingPluginId] = useState<string | null>(null);
  const [updatingMarketplaceId, setUpdatingMarketplaceId] = useState<string | null>(null);
  const [pendingToggle, setPendingToggle] = useState<Record<string, boolean>>({});

  const installMutation = useInvokeMutation<string, { pluginId: string }>("install_plugin", [["pluginScan"]]);
  const uninstallMutation = useInvokeMutation<string, { pluginId: string }>("uninstall_plugin", [["pluginScan"]]);
  const enableMutation = useInvokeMutation<string, { pluginId: string }>("enable_plugin", [["pluginScan"]]);
  const disableMutation = useInvokeMutation<string, { pluginId: string }>("disable_plugin", [["pluginScan"]]);
  const updateMutation = useInvokeMutation<string, { pluginId: string }>("update_plugin", [["pluginScan"]]);
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

  const isNotInstalledError = (message: string) => {
    const lower = message.toLowerCase();
    return (
      lower.includes("not found in installed plugins") ||
      lower.includes("not found in installed") ||
      lower.includes("not installed")
    );
  };

  const plugins = useMemo(() => {
    if (Object.keys(pendingToggle).length === 0) {
      return scanResult.plugins;
    }
    return scanResult.plugins.map((plugin) =>
      pendingToggle[plugin.id] === undefined
        ? plugin
        : { ...plugin, isEnabled: pendingToggle[plugin.id] }
    );
  }, [pendingToggle, scanResult.plugins]);

  const scopedPlugins = useMemo(() => {
    const query = search.trim().toLowerCase();
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
  }, [activeMarketplace, plugins, search]);

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
      // Always sort by name
      return a.name.localeCompare(b.name);
    });
  }, [scopedPlugins, statusFilter]);

  const isScanning = scanQuery.isLoading || scanQuery.isFetching;
  const scanError = scanQuery.error ? String(scanQuery.error) : null;

  const installPlugin = async (pluginId: string) => {
    setActionPluginId(pluginId);
    setActionError(null);
    try {
      await installMutation.mutateAsync({ pluginId });
    } catch (error) {
      setActionError(normalizeError(error));
    } finally {
      setActionPluginId(null);
    }
  };

  const uninstallPlugin = async (pluginId: string) => {
    setActionPluginId(pluginId);
    setActionError(null);
    try {
      await uninstallMutation.mutateAsync({ pluginId });
    } catch (error) {
      const message = normalizeError(error);
      if (isNotInstalledError(message)) {
        try {
          await installMutation.mutateAsync({ pluginId });
          await uninstallMutation.mutateAsync({ pluginId });
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
      if (enabled) {
        await enableMutation.mutateAsync({ pluginId });
      } else {
        await disableMutation.mutateAsync({ pluginId });
      }
    } catch (error) {
      const message = normalizeError(error);
      if (isNotInstalledError(message)) {
        try {
          await installMutation.mutateAsync({ pluginId });
          if (enabled) {
            await enableMutation.mutateAsync({ pluginId });
          } else {
            await disableMutation.mutateAsync({ pluginId });
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
    setUpdatingPluginId(pluginId);
    setActionError(null);
    try {
      await updateMutation.mutateAsync({ pluginId });
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

export type PluginLibraryState = ReturnType<typeof usePluginLibrary>;
export type PluginListItem = ScannedPlugin;
export type MarketplaceListItem = ScannedMarketplace;
