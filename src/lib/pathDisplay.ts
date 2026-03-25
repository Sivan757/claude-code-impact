export function getPathBaseName(path: string): string {
  const normalized = path.replace(/[\\/]+$/, "");
  if (!normalized) return path;

  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? path;
}
