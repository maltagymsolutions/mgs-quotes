export function normalizePackageContents(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

export function parsePackageContentsText(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function packageContentsToText(value: unknown): string {
  return normalizePackageContents(value).join("\n");
}
