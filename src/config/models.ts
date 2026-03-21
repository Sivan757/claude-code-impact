export type ModelType =
  | "opusplan"
  | "opus[1m]"
  | "opus"
  | "sonnet[1m]"
  | "sonnet"
  | "haiku"
  | "default"
  ;
  

export const MODEL_OPTIONS: ReadonlyArray<{ value: ModelType; label: string }> = [
  { value: "opusplan", label: "opusplan" },
  { value: "opus[1m]", label: "opus[1m]" },
  { value: "opus", label: "opus" },
  { value: "sonnet[1m]", label: "sonnet[1m]" },
  { value: "sonnet", label: "sonnet" },
  { value: "haiku", label: "haiku" },
  { value: "default", label: "default" },
];

const VALID_MODEL_TYPES = new Set<string>(MODEL_OPTIONS.map((option) => option.value));

export function isKnownModelType(value: string): value is ModelType {
  return VALID_MODEL_TYPES.has(value);
}

export function normalizeModelType(
  value: unknown,
  fallback: ModelType = "default",
): ModelType {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return isKnownModelType(normalized) ? normalized : fallback;
}
