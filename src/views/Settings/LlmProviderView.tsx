import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { FlaskConical } from "lucide-react";
import { useInvokeQuery, useQueryClient } from "../../hooks";
import {
  Cross2Icon,
  EyeOpenIcon,
  EyeClosedIcon,
  RocketIcon,
  ExternalLinkIcon,
} from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import {
  LoadingState,
  SearchInput,
  PageHeader,
  ConfigPage,
  type MarketplaceItem,
} from "../../components/config";
import { useAtom } from "jotai";
import { routerTestStatusAtom, routerTestMessageAtom } from "../../store";
import type { ClaudeSettings } from "../../types";
import { trackProviderEvent } from "../../lib/analytics";

function ResponsiveActions({
  variant,
  icon,
  text,
  className = "",
}: {
  variant: "env" | "router";
  icon: ReactNode;
  text: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-nowrap items-center gap-2 whitespace-nowrap justify-end ${className}`}>
      <div className={`${variant}-actions--icon flex flex-nowrap items-center gap-2`}>{icon}</div>
      <div className={`${variant}-actions--text flex flex-nowrap items-center gap-2`}>{text}</div>
    </div>
  );
}


export function LlmProviderView() {
  const { t } = useTranslation();



  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useInvokeQuery<ClaudeSettings>(["settings"], "get_settings");

  const [search, setSearch] = useState("");
  const [applyStatus, setApplyStatus] = useState<Record<string, "idle" | "loading" | "success" | "error">>({});
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyHint, setApplyHint] = useState<Record<string, string>>({});
  const [testStatus, setTestStatus] = useAtom(routerTestStatusAtom);
  const [testMessage, setTestMessage] = useAtom(routerTestMessageAtom);
  const [testMissingKeys, setTestMissingKeys] = useState<Record<string, string[]>>({});
  const [testMissingValues, setTestMissingValues] = useState<Record<string, Record<string, string>>>({});
  const [expandedPresetKey, setExpandedPresetKey] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({
    univibe: "claude-sonnet-4-5-20250929",
    siliconflow: "moonshotai/Kimi-K2-Instruct-0905",
  });


  useEffect(() => {
    if (!settings) return;
    const envValue = settings.raw && typeof settings.raw === "object" ? (settings.raw as Record<string, unknown>).env : null;
    if (envValue && typeof envValue === "object") {
      const currentModel = (envValue as Record<string, unknown>).ANTHROPIC_MODEL;
      if (typeof currentModel === "string" && currentModel) {
        setSelectedModels((prev) => ({ ...prev, univibe: currentModel }));
      }
    }
  }, [settings]);

  if (isLoading) return <LoadingState message={t('llm.loading')} />;

  const getActiveProvider = (value: ClaudeSettings | null | undefined): string | null => {
    const lovcode =
      value?.raw && typeof value.raw === "object"
        ? (value.raw as Record<string, unknown>).lovcode
        : null;
    if (!lovcode || typeof lovcode !== "object") return null;
    const activeProvider = (lovcode as Record<string, unknown>).activeProvider;
    return typeof activeProvider === "string" ? activeProvider : null;
  };

  const activeProvider = getActiveProvider(settings);

  const getRawEnvFromSettings = (value: ClaudeSettings | null | undefined) => {
    const envValue =
      value?.raw && typeof value.raw === "object"
        ? (value.raw as Record<string, unknown>).env
        : null;
    if (!envValue || typeof envValue !== "object" || Array.isArray(envValue)) return {};
    return Object.fromEntries(
      Object.entries(envValue as Record<string, unknown>).map(([key, v]) => [key, String(v ?? "")])
    );
  };

  const rawEnv = getRawEnvFromSettings(settings);

  const providerModels: Record<string, { id: string; label: string }[]> = {
    univibe: [
      { id: "claude-sonnet-4-5-20250929", label: t('llm.models.claude_sonnet') },
      { id: "claude-opus-4-5-20251101", label: t('llm.models.claude_opus') },
      { id: "claude-haiku-4-5-20251001", label: t('llm.models.claude_haiku') },
    ],
    siliconflow: [
      { id: "moonshotai/Kimi-K2-Instruct-0905", label: t('llm.models.kimi_k2') },
      { id: "moonshotai/Kimi-K2-Thinking", label: t('llm.models.kimi_k2_thinking') },
      { id: "deepseek-ai/DeepSeek-V3.2", label: t('llm.models.deepseek_v3') },
      { id: "deepseek-ai/DeepSeek-V3.1-Terminus", label: t('llm.models.deepseek_v3_terminus') },
      { id: "deepseek-ai/DeepSeek-R1", label: t('llm.models.deepseek_r1') },
      { id: "Qwen/Qwen3-Coder-480B-A35B-Instruct", label: t('llm.models.qwen3_coder') },
      { id: "Qwen/Qwen3-235B-A22B", label: t('llm.models.qwen3_235b') },
      { id: "Qwen/QwQ-32B", label: t('llm.models.qwq_32b') },
      { id: "zai-org/GLM-4.7", label: t('llm.models.glm_4_7') },
      { id: "THUDM/GLM-Z1-32B-0414", label: t('llm.models.glm_z1') },
      { id: "MiniMaxAI/MiniMax-M2", label: t('llm.models.minimax_m2') },
    ],
  };

  const proxyPresets = useMemo(() => [
    {
      key: "anthropic-subscription",
      label: t('llm.providers.anthropic-subscription'),
      description: t('llm.providers.anthropic-subscription_desc'),
      templateName: "anthropic-subscription",
    },
    {
      key: "modelgate",
      label: t('llm.providers.modelgate'),
      description: t('llm.providers.modelgate_desc'),
      templateName: "modelgate-anthropic-proxy",
      docsUrl: "https://docs.modelgate.net/guide/tools/claude-code.html",
    },
    {
      key: "native",
      label: t('llm.providers.native'),
      description: t('llm.providers.native_desc'),
      templateName: "anthropic-native-endpoint",
    },
    {
      key: "qiniu",
      label: t('llm.providers.qiniu'),
      description: t('llm.providers.qiniu_desc'),
      templateName: "qiniu-anthropic-proxy",
      docsUrl: "https://developer.qiniu.com/aitokenapi/13085/claude-code-configuration-instructions",
    },
    {
      key: "siliconflow",
      label: t('llm.providers.siliconflow'),
      description: t('llm.providers.siliconflow_desc'),
      templateName: "siliconflow-anthropic-proxy",
      docsUrl: "https://docs.siliconflow.com/en/userguide/quickstart",
    },
    {
      key: "univibe",
      label: t('llm.providers.univibe'),
      description: t('llm.providers.univibe_desc'),
      templateName: "univibe-anthropic-proxy",
      docsUrl: "https://www.univibe.cc/console/docs/claudecode",
    },
    {
      key: "zenmux",
      label: t('llm.providers.zenmux'),
      description: t('llm.providers.zenmux_desc'),
      templateName: "zenmux-anthropic-proxy",
      docsUrl: "https://docs.zenmux.ai/best-practices/claude-code.html",
    },
  ], [t]);

  const presetFallbacks: Record<string, MarketplaceItem> = {
    "anthropic-subscription": {
      name: "anthropic-subscription",
      path: "fallback/anthropic-subscription.json",
      description: t('llm.providers.anthropic-subscription_desc'),
      downloads: null,
      content: JSON.stringify({ env: { CLAUDE_CODE_USE_OAUTH: "1" } }, null, 2),
    },
    native: {
      name: "anthropic-native-endpoint",
      path: "fallback/anthropic-native-endpoint.json",
      description: t('llm.providers.native_desc'),
      downloads: null,
      content: JSON.stringify({ env: { ANTHROPIC_API_KEY: "your_anthropic_api_key_here" } }, null, 2),
    },
    zenmux: {
      name: "zenmux-anthropic-proxy",
      path: "fallback/zenmux-anthropic-proxy.json",
      description: t('llm.providers.zenmux_desc'),
      downloads: null,
      content: JSON.stringify({ env: { ZENMUX_API_KEY: "sk-ai-v1-xxxxx" } }, null, 2),
    },
    qiniu: {
      name: "qiniu-anthropic-proxy",
      path: "fallback/qiniu-anthropic-proxy.json",
      description: t('llm.providers.qiniu_desc'),
      downloads: null,
      content: JSON.stringify({ env: { QINIU_API_KEY: "your_qiniu_api_key_here" } }, null, 2),
    },
    univibe: {
      name: "univibe-anthropic-proxy",
      path: "fallback/univibe-anthropic-proxy.json",
      description: t('llm.providers.univibe_desc'),
      downloads: null,
      content: JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: "cr_xxxxxxxxxxxxxxxxxx" } }, null, 2),
    },
    modelgate: {
      name: "modelgate-anthropic-proxy",
      path: "fallback/modelgate-anthropic-proxy.json",
      description: t('llm.providers.modelgate_desc'),
      downloads: null,
      content: JSON.stringify({ env: { MODELGATE_API_KEY: "your_modelgate_api_key" } }, null, 2),
    },
    siliconflow: {
      name: "siliconflow-anthropic-proxy",
      path: "fallback/siliconflow-anthropic-proxy.json",
      description: t('llm.providers.siliconflow_desc'),
      downloads: null,
      content: JSON.stringify({ env: { SILICONFLOW_API_KEY: "sk-xxxxx" } }, null, 2),
    },
  };

  const filteredPresets = proxyPresets.filter(
    (preset) =>
      preset.label.toLowerCase().includes(search.toLowerCase()) ||
      preset.description.toLowerCase().includes(search.toLowerCase())
  );

  const getPresetTemplate = (presetKey: string) => {
    const preset = proxyPresets.find((p) => p.key === presetKey);
    if (!preset) return null;
    const fallbackTemplate = presetFallbacks[presetKey] ?? null;
    return { preset, template: fallbackTemplate };
  };

  const isPlaceholderValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    return /(xxxxx|<.*?>|your[_\s-]?key|replace[_\s-]?me)/i.test(trimmed);
  };

  const handleTogglePresetPreview = (presetKey: string) => {
    setExpandedPresetKey((prev) => (prev === presetKey ? null : presetKey));
  };

  const getPresetPreviewConfig = (presetKey: string) => {
    const resolved = getPresetTemplate(presetKey);
    const templateContent = resolved?.template?.content;
    if (!templateContent) {
      return { env: {}, note: t('llm.template_not_available') };
    }

    try {
      const parsed = JSON.parse(templateContent) as Record<string, unknown>;
      const templateEnv =
        parsed.env && typeof parsed.env === "object" && !Array.isArray(parsed.env)
          ? (parsed.env as Record<string, unknown>)
          : {};
      const previewEnv = Object.fromEntries(
        Object.keys(templateEnv).map((key) => [key, rawEnv[key] || ""])
      );
      return { env: previewEnv, note: null };
    } catch {
      return { env: {}, note: t('llm.template_invalid') };
    }
  };

  const handleTestPreset = async (presetKey: string, envOverride?: Record<string, string>) => {
    const resolved = getPresetTemplate(presetKey);
    if (!resolved?.template?.content) {
      setTestStatus((prev) => ({ ...prev, [presetKey]: "error" }));
      setTestMessage((prev) => ({ ...prev, [presetKey]: t('llm.template_not_available') }));
      setTestMissingKeys((prev) => ({ ...prev, [presetKey]: [] }));
      return;
    }

    setTestStatus((prev) => ({ ...prev, [presetKey]: "loading" }));

    if (presetKey === "anthropic-subscription") {
      setTestStatus((prev) => ({ ...prev, [presetKey]: "success" }));
      setTestMessage((prev) => ({ ...prev, [presetKey]: t('llm.login_hint') }));
      setTestMissingKeys((prev) => ({ ...prev, [presetKey]: [] }));
      return;
    }

    const envSource = envOverride ?? rawEnv;

    try {
      const parsed = JSON.parse(resolved.template.content) as { env?: Record<string, string> };
      const requiredKeys = parsed.env ? Object.keys(parsed.env) : [];
      const missing = requiredKeys.filter((key) => isPlaceholderValue(envSource[key] || ""));

      if (missing.length > 0) {
        setTestStatus((prev) => ({ ...prev, [presetKey]: "error" }));
        setTestMessage((prev) => ({ ...prev, [presetKey]: t('llm.missing_or_placeholder', { keys: missing.join(", ") }) }));
        setTestMissingKeys((prev) => ({ ...prev, [presetKey]: missing }));
        setTestMissingValues((prev) => ({
          ...prev,
          [presetKey]: Object.fromEntries(missing.map((key) => [key, envSource[key] || ""])),
        }));
        return;
      }

      setTestMissingKeys((prev) => ({ ...prev, [presetKey]: [] }));

      if (presetKey === "univibe") {
        const authToken = (envSource.ANTHROPIC_AUTH_TOKEN || "").trim();
        const baseUrl = envSource.ANTHROPIC_BASE_URL || "https://api.univibe.cc/anthropic";

        try {
          const result = await invoke<{ ok: boolean; code: number; stdout: string; stderr: string }>("test_claude_cli", {
            baseUrl,
            authToken,
          });

          if (!result.ok) {
            setTestStatus((prev) => ({ ...prev, [presetKey]: "error" }));
            setTestMessage((prev) => ({
              ...prev,
              [presetKey]: `UniVibe test failed (${result.code}): ${result.stderr || result.stdout || "No output"}`,
            }));
            trackProviderEvent({ action: "test", provider: presetKey, success: false, error_message: `${result.code}` });
            return;
          }
          setTestStatus((prev) => ({ ...prev, [presetKey]: "success" }));
          setTestMessage((prev) => ({ ...prev, [presetKey]: t('llm.connected') }));
          trackProviderEvent({ action: "test", provider: presetKey, success: true });
          return;
        } catch (e) {
          setTestStatus((prev) => ({ ...prev, [presetKey]: "error" }));
          setTestMessage((prev) => ({ ...prev, [presetKey]: `UniVibe test error: ${String(e)}` }));
          trackProviderEvent({ action: "test", provider: presetKey, success: false, error_message: String(e) });
          return;
        }
      }

      if (presetKey === "siliconflow") {
        const apiKey = (envSource.SILICONFLOW_API_KEY || envSource.ANTHROPIC_API_KEY || "").trim();
        const baseUrl = envSource.ANTHROPIC_BASE_URL || "https://api.siliconflow.com/v1";

        try {
          const result = await invoke<{ ok: boolean; status: number; body: string }>("test_openai_connection", {
            baseUrl,
            apiKey,
          });

          if (!result.ok) {
            setTestStatus((prev) => ({ ...prev, [presetKey]: "error" }));
            setTestMessage((prev) => ({
              ...prev,
              [presetKey]: `SiliconFlow test failed (${result.status}): ${result.body || "No response body"}`,
            }));
            trackProviderEvent({ action: "test", provider: presetKey, success: false, error_message: `${result.status}` });
            return;
          }

          let modelCount = 0;
          try {
            const parsed = JSON.parse(result.body);
            modelCount = parsed.data?.length || 0;
          } catch { }

          setTestStatus((prev) => ({ ...prev, [presetKey]: "success" }));
          setTestMessage((prev) => ({ ...prev, [presetKey]: t('llm.connected_models', { count: modelCount }) }));
          trackProviderEvent({ action: "test", provider: presetKey, success: true });
          return;
        } catch (e) {
          setTestStatus((prev) => ({ ...prev, [presetKey]: "error" }));
          setTestMessage((prev) => ({ ...prev, [presetKey]: `SiliconFlow test error: ${String(e)}` }));
          trackProviderEvent({ action: "test", provider: presetKey, success: false, error_message: String(e) });
          return;
        }
      }

      if (presetKey === "zenmux" || presetKey === "modelgate") {
        const authToken = (
          envSource.ZENMUX_API_KEY ||
          envSource.MODELGATE_API_KEY ||
          envSource.ANTHROPIC_AUTH_TOKEN ||
          ""
        ).trim();
        const defaultBaseUrl = presetKey === "zenmux"
          ? "https://zenmux.ai/api/anthropic"
          : "https://mg.aid.pub/claude-proxy";
        const baseUrl = envSource.ANTHROPIC_BASE_URL || defaultBaseUrl;
        const model = envSource.ANTHROPIC_MODEL || envSource.ANTHROPIC_DEFAULT_SONNET_MODEL || "anthropic/claude-sonnet-4.5";
        const label = presetKey === "zenmux" ? "ZenMux" : "ModelGate";

        try {
          const result = await invoke<{ ok: boolean; status: number; body: string }>("test_anthropic_connection", {
            baseUrl,
            authToken,
            model,
          });

          if (!result.ok) {
            setTestStatus((prev) => ({ ...prev, [presetKey]: "error" }));
            setTestMessage((prev) => ({
              ...prev,
              [presetKey]: `${label} test failed (${result.status}): ${result.body || "No response body"}`,
            }));
            trackProviderEvent({ action: "test", provider: presetKey, model, success: false, error_message: `${result.status}` });
            return;
          }
          setTestStatus((prev) => ({ ...prev, [presetKey]: "success" }));
          setTestMessage((prev) => ({ ...prev, [presetKey]: t('llm.connected') }));
          trackProviderEvent({ action: "test", provider: presetKey, model, success: true });
          return;
        } catch (e) {
          setTestStatus((prev) => ({ ...prev, [presetKey]: "error" }));
          setTestMessage((prev) => ({ ...prev, [presetKey]: `${label} test error: ${String(e)}` }));
          trackProviderEvent({ action: "test", provider: presetKey, model, success: false, error_message: String(e) });
          return;
        }
      }

      setTestStatus((prev) => ({ ...prev, [presetKey]: "success" }));
      setTestMessage((prev) => ({ ...prev, [presetKey]: "" }));
      if (!["univibe", "siliconflow", "zenmux", "modelgate"].includes(presetKey)) {
        trackProviderEvent({ action: "test", provider: presetKey, success: true });
      }
    } catch (e) {
      setTestStatus((prev) => ({ ...prev, [presetKey]: "error" }));
      setTestMessage((prev) => ({ ...prev, [presetKey]: t('llm.template_invalid') + ": " + String(e) }));
      setTestMissingKeys((prev) => ({ ...prev, [presetKey]: [] }));
    }
  };

  const presetEnvKeyMappings: Record<string, Record<string, string>> = {
    zenmux: { ZENMUX_API_KEY: "ANTHROPIC_AUTH_TOKEN" },
    qiniu: { QINIU_API_KEY: "ANTHROPIC_AUTH_TOKEN" },
    modelgate: { MODELGATE_API_KEY: "ANTHROPIC_AUTH_TOKEN" },
    siliconflow: { SILICONFLOW_API_KEY: "ANTHROPIC_API_KEY" },
  };

  const presetExtraEnv: Record<string, Record<string, string>> = {
    zenmux: {
      ANTHROPIC_BASE_URL: "https://zenmux.ai/api/anthropic",
      ANTHROPIC_API_KEY: "",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    },
    qiniu: { ANTHROPIC_BASE_URL: "https://api.qnaigc.com" },
    univibe: {
      ANTHROPIC_BASE_URL: "https://api.univibe.cc/anthropic",
      ANTHROPIC_API_KEY: "",
    },
    modelgate: {
      ANTHROPIC_BASE_URL: "https://mg.aid.pub/claude-proxy",
      ANTHROPIC_API_KEY: "",
    },
    siliconflow: {
      ANTHROPIC_BASE_URL: "https://api.siliconflow.com/v1",
    },
  };

  const handleApplyPreset = async (presetKey: string) => {
    const resolved = getPresetTemplate(presetKey);
    if (!resolved?.template || !resolved.template.content) {
      setApplyError(t('llm.template_not_available'));
      setApplyStatus((prev) => ({ ...prev, [presetKey]: "error" }));
      return;
    }

    setApplyStatus((prev) => ({ ...prev, [presetKey]: "loading" }));
    setApplyError(null);
    setApplyHint((prev) => ({ ...prev, [presetKey]: "" }));

    try {
      const parsed = JSON.parse(resolved.template.content);
      const keyMapping = presetEnvKeyMappings[presetKey] || {};
      const extraEnv = presetExtraEnv[presetKey] || {};

      if (presetKey === "anthropic-subscription") {
        parsed.env = { CLAUDE_CODE_USE_OAUTH: "1" };
      } else if (parsed.env) {
        const templateKeys = Object.keys(parsed.env);
        for (const key of templateKeys) {
          if (rawEnv[key]) {
            parsed.env[key] = rawEnv[key];
          }
        }
        for (const [fromKey, toKey] of Object.entries(keyMapping)) {
          if (fromKey in parsed.env) {
            parsed.env[toKey] = parsed.env[fromKey];
            delete parsed.env[fromKey];
          }
        }
        Object.assign(parsed.env, extraEnv);
        if (selectedModels[presetKey]) {
          parsed.env.ANTHROPIC_MODEL = selectedModels[presetKey];
        }
      }

      parsed.lovcode = { activeProvider: presetKey };

      await invoke("install_setting_template", { config: JSON.stringify(parsed, null, 2) });
      refreshSettings();
      setApplyStatus((prev) => ({ ...prev, [presetKey]: "success" }));
      trackProviderEvent({ action: "apply", provider: presetKey, model: selectedModels[presetKey], success: true });

      if (presetKey === "anthropic-subscription") {
        setApplyHint((prev) => ({
          ...prev,
          [presetKey]: t('llm.login_hint'),
        }));
      }

      setTimeout(() => {
        setApplyStatus((prev) => ({ ...prev, [presetKey]: "idle" }));
      }, 1500);
    } catch (e) {
      setApplyStatus((prev) => ({ ...prev, [presetKey]: "error" }));
      setApplyError(String(e));
      trackProviderEvent({ action: "apply", provider: presetKey, model: selectedModels[presetKey], success: false, error_message: String(e) });
    }
  };

  const refreshSettings = () => {
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  };

  const handleMissingValueChange = (presetKey: string, key: string, value: string) => {
    setTestMissingValues((prev) => ({
      ...prev,
      [presetKey]: { ...(prev[presetKey] || {}), [key]: value },
    }));
  };

  const handleSaveMissingAndRetest = async (presetKey: string) => {
    const missingKeys = testMissingKeys[presetKey] || [];
    if (missingKeys.length === 0) return;
    const values = testMissingValues[presetKey] || {};
    await Promise.all(
      missingKeys.map((key) => invoke("update_settings_env", { envKey: key, envValue: values[key] ?? "" }))
    );
    refreshSettings();
    const updated = await invoke<ClaudeSettings>("get_settings");
    const updatedEnv = getRawEnvFromSettings(updated);
    await handleTestPreset(presetKey, updatedEnv);
  };

  const getMissingEnvPlaceholder = (key: string) => {
    if (/proxy/i.test(key)) return "http://localhost:7890";
    return t('llm.value');
  };

  const officialProviderKeys = new Set(["anthropic-subscription", "native"]);
  const officialPresets = filteredPresets.filter((preset) => officialProviderKeys.has(preset.key));
  const partnerPresets = filteredPresets.filter((preset) => !officialProviderKeys.has(preset.key));



  const activePresets = [...officialPresets, ...partnerPresets];

  const renderPresetCard = (preset: {
    key: string;
    label: string;
    description: string;
    docsUrl?: string;
  }) => {
    const status = applyStatus[preset.key] || "idle";
    const isLoading = status === "loading";
    const isSuccess = status === "success";
    const testState = testStatus[preset.key] || "idle";
    const isTestSuccess = testState === "success";
    const isTestError = testState === "error";
    const missingKeys = testMissingKeys[preset.key] || [];
    const missingValues = testMissingValues[preset.key] || {};
    const isActive = activeProvider === preset.key;

    return (
      <div
        key={preset.key}
        className={`rounded-lg border-2 p-3 flex flex-col gap-2 w-full ${isActive
          ? "border-primary bg-primary/10"
          : isTestSuccess
            ? "border-primary/60 bg-primary/5"
            : isTestError
              ? "border-destructive/60 bg-destructive/5"
              : "border-border bg-card-alt"
          }`}
      >
        <div className="flex w-full flex-nowrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-ink truncate">{preset.label}</p>
              {isActive && (
                <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary text-primary-foreground">
                  {t('llm.active')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground line-clamp-2">{preset.description}</p>
              {preset.docsUrl && (
                <button
                  className="text-muted-foreground hover:text-primary shrink-0"
                  title={t('llm.documentation')}
                  onClick={(e) => {
                    e.stopPropagation();
                    openUrl(preset.docsUrl!);
                  }}
                >
                  <ExternalLinkIcon className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <ResponsiveActions
            variant="router"
            className="shrink-0"
            icon={
              <>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9"
                  onClick={() => handleTogglePresetPreview(preset.key)}
                  title={expandedPresetKey === preset.key ? t('llm.hide_config') : t('llm.show_config')}
                >
                  {expandedPresetKey === preset.key ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className={`h-9 w-9 ${isTestSuccess ? "border-primary text-primary" : isTestError ? "border-destructive text-destructive" : ""}`}
                  onClick={() => handleTestPreset(preset.key)}
                  title={t('llm.test')}
                >
                  <FlaskConical className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  className="h-9 w-9 bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isLoading}
                  onClick={() => handleApplyPreset(preset.key)}
                  title={isLoading ? t('llm.applying') : isSuccess ? t('llm.applied') : t('llm.apply')}
                >
                  <RocketIcon />
                </Button>
              </>
            }
            text={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="max-w-[8.5rem]"
                  onClick={() => handleTogglePresetPreview(preset.key)}
                >
                  <span className="block truncate">{expandedPresetKey === preset.key ? t('llm.hide_config') : t('llm.show_config')}</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`max-w-[6rem] ${isTestSuccess ? "border-primary text-primary" : isTestError ? "border-destructive text-destructive" : ""}`}
                  onClick={() => handleTestPreset(preset.key)}
                >
                  <span className="block truncate">{t('llm.test')}</span>
                </Button>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 max-w-[6.5rem]"
                  disabled={isLoading}
                  onClick={() => handleApplyPreset(preset.key)}
                >
                  <span className="block truncate">{isLoading ? t('llm.applying') : isSuccess ? t('llm.applied') : t('llm.apply')}</span>
                </Button>
              </>
            }
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-right">
          {isSuccess && <span className="text-xs text-green-600">{t('llm.saved')}</span>}
          {status === "error" && <span className="text-xs text-red-600">{t('llm.failed')}</span>}
          {applyHint[preset.key] && (
            <span className="inline-flex items-center gap-1">
              <span className="text-xs text-amber-600">{applyHint[preset.key]}</span>
              <button
                className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-ink"
                onClick={() => setApplyHint((prev) => ({ ...prev, [preset.key]: "" }))}
                title={t('llm.dismiss')}
              >
                <Cross2Icon className="w-3 h-3" />
              </button>
            </span>
          )}
          {testStatus[preset.key] === "loading" && <span className="text-xs text-muted-foreground">{t('llm.testing')}</span>}
          {(testStatus[preset.key] === "success" || testStatus[preset.key] === "error") && (
            <span className="inline-flex items-center gap-1">
              <span className={`text-xs ${testStatus[preset.key] === "success" ? "text-green-600" : "text-red-600"}`}>
                {testMessage[preset.key] || (testStatus[preset.key] === "error" ? "Failed" : "")}
              </span>
              <button
                className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-ink"
                onClick={() => {
                  setTestStatus((prev) => ({ ...prev, [preset.key]: "idle" }));
                  setTestMessage((prev) => ({ ...prev, [preset.key]: "" }));
                  setTestMissingKeys((prev) => ({ ...prev, [preset.key]: [] }));
                }}
                title={t('llm.clear_test')}
              >
                <Cross2Icon className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
        {expandedPresetKey === preset.key && (
          <div className="rounded-lg border border-border bg-canvas/70 p-2">
            {(() => {
              const preview = getPresetPreviewConfig(preset.key);
              const envKeys = Object.keys(preview.env);
              return (
                <>
                  {preview.note && <p className="text-xs text-muted-foreground mb-2">{preview.note}</p>}
                  {envKeys.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {envKeys.map((key) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono min-w-[10rem] shrink-0">{key}</span>
                          <input
                            className="text-xs px-2 py-1 rounded bg-canvas border border-border text-ink flex-1 font-mono"
                            placeholder={t('llm.enter_value')}
                            value={rawEnv[key] || ""}
                            onChange={async (e) => {
                              await invoke("update_settings_env", { envKey: key, envValue: e.target.value });
                              await refreshSettings();
                            }}
                          />
                        </div>
                      ))}
                      {providerModels[preset.key] && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono min-w-[10rem] shrink-0">ANTHROPIC_MODEL</span>
                          <select
                            className="text-xs px-2 py-1 rounded bg-canvas border border-border text-ink flex-1 font-mono"
                            value={selectedModels[preset.key] || providerModels[preset.key][0]?.id}
                            onChange={(e) => setSelectedModels((prev) => ({ ...prev, [preset.key]: e.target.value }))}
                          >
                            {providerModels[preset.key].map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('llm.no_config_required')}</p>
                  )}
                </>
              );
            })()}
          </div>
        )}
        {missingKeys.length > 0 && (
          <div className="rounded-lg border border-dashed border-border bg-canvas/60 p-2">
            <p className="text-xs text-muted-foreground mb-2">{t('llm.fill_missing')}</p>
            <p className="text-xs text-muted-foreground mb-2">{t('llm.press_tab_hint')}</p>
            <div className="flex flex-col gap-2">
              {missingKeys.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono min-w-[6rem]">{key}</span>
                  <input
                    className="text-xs px-2 py-1 rounded bg-canvas border border-border text-ink flex-1"
                    placeholder={getMissingEnvPlaceholder(key)}
                    value={missingValues[key] ?? ""}
                    onChange={(e) => handleMissingValueChange(preset.key, key, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveMissingAndRetest(preset.key);
                      if (e.key === "Tab" && !(missingValues[key] ?? "").trim()) {
                        const placeholder = getMissingEnvPlaceholder(key);
                        if (placeholder !== "value") {
                          e.preventDefault();
                          handleMissingValueChange(preset.key, key, placeholder);
                        }
                      }
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => handleSaveMissingAndRetest(preset.key)}>
                {t('llm.save_retest')}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <ConfigPage>
      <PageHeader
        title={t('llm.title')}
        subtitle={t('llm.subtitle')}
        action={applyError && <p className="text-xs text-red-600">{applyError}</p>}
      />

      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        <SearchInput placeholder={t('llm.search_placeholder')} value={search} onChange={setSearch} />

        <p className="text-xs text-muted-foreground">
          {t('llm.subtitle')}
        </p>

        <div className="flex-1 mt-3 flex flex-col gap-3 overflow-y-auto min-h-0">
          {activePresets.length > 0 ? (
            activePresets.map((preset) => renderPresetCard(preset))
          ) : (
            <p className="text-xs text-muted-foreground">{t('llm.no_match')}</p>
          )}
        </div>


      </div>
    </ConfigPage>
  );
}
