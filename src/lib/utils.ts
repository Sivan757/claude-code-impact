import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".bmp",
  ".tiff",
  ".avif",
]);

export function isImageFile(filename: string): boolean {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex < 0) return false;
  const ext = filename.slice(lastDotIndex).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}
