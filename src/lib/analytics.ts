/**
 * Provider Analytics - Anonymized usage statistics
 *
 * Collects usage data for LLM Provider settings (test/apply actions).
 * - Default: enabled (can be disabled via settings)
 * - Data: provider, model, success status, app version
 * - No sensitive data: API keys are never collected
 *
 * Fork users can configure their own analytics endpoint.
 */

// Default claudecodeimpact Cloud endpoint
const DEFAULT_ANALYTICS_ENDPOINT = "";
const DEFAULT_ANON_KEY = "";

import { getUiPreference, setUiPreference } from "./uiPreferences";

// Storage key for opt-out preference
const ANALYTICS_ENABLED_KEY = "claudecodeimpact:analytics:enabled";
const ANALYTICS_CLIENT_ID_KEY = "claudecodeimpact:analytics:clientId";

// Get or generate a stable anonymous client ID
function getClientId(): string {
  const stored = getUiPreference<string>(ANALYTICS_CLIENT_ID_KEY);
  if (stored) {
    return stored;
  }
  const clientId = crypto.randomUUID();
  setUiPreference(ANALYTICS_CLIENT_ID_KEY, clientId);
  return clientId;
}

// Check if analytics is enabled
export function isAnalyticsEnabled(): boolean {
  const stored = getUiPreference<boolean>(ANALYTICS_ENABLED_KEY);
  // Default to enabled if not explicitly disabled
  return stored !== false;
}

// Set analytics enabled/disabled
export function setAnalyticsEnabled(enabled: boolean): void {
  setUiPreference(ANALYTICS_ENABLED_KEY, enabled);
}

// Get app version from package.json (injected at build time)
function getAppVersion(): string {
  // @ts-expect-error - injected by Vite
  return __APP_VERSION__ || "unknown";
}

interface AnalyticsEvent {
  action: "test" | "apply";
  provider: string;
  model?: string;
  success: boolean;
  error_message?: string;
}

/**
 * Track a provider analytics event
 * Silently fails on network errors to not affect user experience
 */
export async function trackProviderEvent(event: AnalyticsEvent): Promise<void> {
  if (!isAnalyticsEnabled()) {
    return;
  }

  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT || DEFAULT_ANALYTICS_ENDPOINT;
  const anonKey = import.meta.env.VITE_ANALYTICS_ANON_KEY || DEFAULT_ANON_KEY;

  const payload = {
    ...event,
    client_id: getClientId(),
    app_version: getAppVersion(),
  };

  try {
    // Use fetch with keepalive for fire-and-forget
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Silently ignore errors - analytics should never break the app
  }
}
