import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import type { PreviewInfo } from "@autopilot/shared";

const ENTRY_CANDIDATES = ["index.html", "public/index.html", "dist/index.html", "src/index.html"];

export function resolvePreviewEntry(root: string): string | undefined {
  for (const candidate of ENTRY_CANDIDATES) {
    if (existsSync(join(root, candidate))) return candidate;
  }
  return undefined;
}

export function buildPreviewInfo(missionId: string, root: string, branchId?: string, port = 4317): PreviewInfo {
  const entryPath = resolvePreviewEntry(root);
  if (!entryPath) {
    return {
      missionId,
      branchId,
      ready: false,
      reason: "No index.html yet — the site preview appears once the agent writes one."
    };
  }
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
  return {
    missionId,
    branchId,
    ready: true,
    entryPath,
    url: `/preview/${missionId}/${entryPath}${query}`
  };
}

export function readPreviewFile(root: string, requestPath: string): { path: string; content: Buffer; contentType: string } {
  const normalized = requestPath.replace(/^\/+/, "") || "index.html";
  const absolute = resolve(root, normalized);
  if (!absolute.startsWith(resolve(root))) throw new Error("Path escapes preview root");
  if (!existsSync(absolute) || statSync(absolute).isDirectory()) throw new Error("Preview file not found");
  return {
    path: relative(root, absolute).split("\\").join("/"),
    content: readFileSync(absolute),
    contentType: contentTypeFor(absolute)
  };
}

function contentTypeFor(path: string): string {
  switch (extname(path)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}
