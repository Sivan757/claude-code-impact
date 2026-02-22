export const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";

export interface ProviderProfile {
  id: string;
  name: string;
  authToken: string;
  baseUrl: string;
  updatedAt: number;
}

export interface LlmProfilesState {
  profiles: ProviderProfile[];
  viewMode: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, typeof item === "string" ? item : String(item ?? "")]),
  );
}

function inferNameFromHost(rawUrl?: string): string | null {
  if (!rawUrl) return null;

  try {
    const host = new URL(rawUrl).hostname.replace(/^api\./, "");
    const first = host.split(".")[0];
    return first || null;
  } catch {
    return null;
  }
}

function normalizeProviderHost(value?: string): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname.replace(/^api\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function getEnvFromSettings(settings: Record<string, unknown>): Record<string, string> {
  return toStringMap(settings.env);
}

export function normalizeProviderToken(value?: string): string {
  return (value ?? "").trim();
}

export function normalizeProviderBaseUrl(value?: string): string {
  const trimmed = (value ?? "").trim();
  const resolved = trimmed || DEFAULT_ANTHROPIC_BASE_URL;
  return resolved.replace(/\/+$/, "").toLowerCase();
}

export function resolveProviderNameFromProfiles(
  settings: Record<string, unknown>,
  profiles: ProviderProfile[],
): string | null {
  if (profiles.length === 0) return null;

  const cci = settings.claudecodeimpact;
  if (isRecord(cci) && typeof cci.activeProvider === "string") {
    const activeProvider = cci.activeProvider.trim();
    if (activeProvider) {
      const directMatch = profiles.find(
        (profile) => profile.id === activeProvider || profile.name === activeProvider,
      );
      if (directMatch) return directMatch.name;
    }
  }

  const env = getEnvFromSettings(settings);
  const token = normalizeProviderToken(env.ANTHROPIC_AUTH_TOKEN);
  const baseUrl = normalizeProviderBaseUrl(env.ANTHROPIC_BASE_URL);
  const baseHost = normalizeProviderHost(env.ANTHROPIC_BASE_URL);

  const normalizedProfiles = profiles.map((profile) => ({
    profile,
    token: normalizeProviderToken(profile.authToken),
    baseUrl: normalizeProviderBaseUrl(profile.baseUrl),
    host: normalizeProviderHost(profile.baseUrl),
  }));

  const exactMatch = normalizedProfiles.find(
    (item) => item.token === token && item.baseUrl === baseUrl,
  );
  if (exactMatch) return exactMatch.profile.name;

  if (token) {
    const tokenMatches = normalizedProfiles.filter((item) => item.token === token);
    if (tokenMatches.length === 1) {
      return tokenMatches[0].profile.name;
    }
  }

  const rawBaseUrl = (env.ANTHROPIC_BASE_URL ?? "").trim();
  if (rawBaseUrl) {
    const baseMatches = normalizedProfiles.filter((item) => item.baseUrl === baseUrl);
    if (baseMatches.length === 1) {
      return baseMatches[0].profile.name;
    }
  }

  if (baseHost) {
    const hostAndTokenMatches = token
      ? normalizedProfiles.filter((item) => item.host === baseHost && item.token === token)
      : [];
    if (hostAndTokenMatches.length === 1) {
      return hostAndTokenMatches[0].profile.name;
    }

    const hostMatches = normalizedProfiles.filter((item) => item.host === baseHost);
    if (hostMatches.length === 1) {
      return hostMatches[0].profile.name;
    }
  }

  return null;
}

export function inferProviderNameFromSettings(settings: Record<string, unknown>): string | null {
  const env = getEnvFromSettings(settings);

  const anthropic = inferNameFromHost(env.ANTHROPIC_BASE_URL);
  if (anthropic) return anthropic;

  const openai = inferNameFromHost(env.OPENAI_BASE_URL);
  if (openai) return openai;

  if (env.ANTHROPIC_AUTH_TOKEN) return "anthropic";
  if (env.OPENAI_API_KEY) return "openai";

  return null;
}

export function resolveProviderDisplayName(
  settings: Record<string, unknown>,
  profiles: ProviderProfile[],
  fallback?: string | null,
): string | null {
  const profileName = resolveProviderNameFromProfiles(settings, profiles);
  if (profileName) return profileName;

  const inferred = inferProviderNameFromSettings(settings);
  if (inferred) return inferred;

  return fallback ?? null;
}
