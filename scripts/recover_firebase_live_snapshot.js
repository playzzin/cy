#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const SITE_URL = (process.argv[2] || "https://cyee-9c1e4.web.app").replace(/\/+$/, "");
const OUTPUT_DIR = process.argv[3] || path.join("recovery", "firebase-live-20260224-0946");

if (typeof fetch !== "function") {
  throw new Error("This script requires a Node.js runtime that supports global fetch.");
}

function normalizeSourcePath(rawPath) {
  if (typeof rawPath !== "string" || !rawPath.trim()) return null;

  let p = rawPath.trim().replace(/\\/g, "/");
  p = p.split("?")[0].split("#")[0];

  try {
    p = decodeURIComponent(p);
  } catch {
    // Keep original path if URI decoding fails.
  }

  p = p.replace(/^webpack:\/\//, "");
  p = p.replace(/^file:\/+/, "");
  p = p.replace(/^[A-Za-z]:\//, "");
  p = p.replace(/^\/+/, "");

  while (p.startsWith("./")) p = p.slice(2);
  while (p.startsWith("../")) p = p.slice(3);

  p = p.replace(/^src\/\.\//, "src/");
  p = p.replace(/^cy\//, "");

  if (!p) return null;
  if (p.startsWith("<")) return null;
  if (p.startsWith("webpack/runtime")) return null;
  if (p.startsWith("webpack/bootstrap")) return null;
  if (p.startsWith("../webpack/")) return null;
  if (p.includes("node_modules/")) return null;
  if (p.startsWith("webpack/")) return null;

  return p;
}

function mapToTargetPath(normalizedPath) {
  if (!normalizedPath) return null;
  if (normalizedPath.startsWith("src/")) return normalizedPath;
  if (normalizedPath.startsWith("public/")) return normalizedPath;
  if (normalizedPath.startsWith("dataconnect-generated/")) return normalizedPath;

  if (
    /^(components|pages|services|utils|hooks|contexts|types|constants|features|config|store|lib|styles|assets|routes|providers|widgets|data|schemas|generated|models|theme)\//.test(
      normalizedPath,
    )
  ) {
    return `src/${normalizedPath}`;
  }

  if (/^[^/]+\.(tsx?|jsx?|css|scss|sass|less|json|d\.ts)$/.test(normalizedPath)) {
    return `src/${normalizedPath}`;
  }

  return null;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function writeFileSafe(baseDir, targetPath, content) {
  const absolutePath = path.join(baseDir, targetPath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
}

async function main() {
  const startedAt = new Date().toISOString();
  const manifestUrl = `${SITE_URL}/asset-manifest.json`;
  const manifest = await fetchJson(manifestUrl);

  const mapFiles = Array.from(
    new Set(Object.values(manifest.files || {}).filter((p) => typeof p === "string" && p.endsWith(".js.map"))),
  );

  if (mapFiles.length === 0) {
    throw new Error("No JS source maps found in asset-manifest.json.");
  }

  const restored = new Map();
  const conflictStats = { total: 0, keptLonger: 0 };
  const mapErrors = [];
  let missingSourceContentCount = 0;
  let skippedUnmappedCount = 0;

  for (const mapPath of mapFiles) {
    const mapUrl = `${SITE_URL}${mapPath}`;
    try {
      const mapText = await fetchText(mapUrl);
      const sourcemap = JSON.parse(mapText);
      const sources = Array.isArray(sourcemap.sources) ? sourcemap.sources : [];
      const contents = Array.isArray(sourcemap.sourcesContent) ? sourcemap.sourcesContent : [];

      for (let i = 0; i < sources.length; i += 1) {
        const normalized = normalizeSourcePath(sources[i]);
        if (!normalized) continue;

        const targetPath = mapToTargetPath(normalized);
        if (!targetPath) {
          skippedUnmappedCount += 1;
          continue;
        }

        const sourceContent = contents[i];
        if (typeof sourceContent !== "string") {
          missingSourceContentCount += 1;
          continue;
        }

        const existing = restored.get(targetPath);
        if (!existing) {
          restored.set(targetPath, {
            content: sourceContent,
            mapPath,
            sourcePath: sources[i],
          });
          continue;
        }

        if (existing.content === sourceContent) continue;

        conflictStats.total += 1;
        if (sourceContent.length > existing.content.length) {
          restored.set(targetPath, {
            content: sourceContent,
            mapPath,
            sourcePath: sources[i],
          });
          conflictStats.keptLonger += 1;
        }
      }
    } catch (error) {
      mapErrors.push({ mapPath, error: error instanceof Error ? error.message : String(error) });
    }
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const [targetPath, entry] of restored.entries()) {
    await writeFileSafe(OUTPUT_DIR, targetPath, entry.content);
  }

  await fs.writeFile(
    path.join(OUTPUT_DIR, "asset-manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    siteUrl: SITE_URL,
    manifestUrl,
    outputDir: OUTPUT_DIR,
    mapFileCount: mapFiles.length,
    recoveredFileCount: restored.size,
    missingSourceContentCount,
    skippedUnmappedCount,
    conflictStats,
    mapErrors,
    sampleRecoveredFiles: Array.from(restored.keys()).slice(0, 50),
  };

  const reportJson = JSON.stringify(report, null, 2);
  await fs.writeFile(path.join(OUTPUT_DIR, "recovery-report.json"), reportJson, "utf8");

  const digest = crypto.createHash("sha256").update(reportJson).digest("hex");
  console.log(
    JSON.stringify(
      {
        recoveredFileCount: report.recoveredFileCount,
        mapFileCount: report.mapFileCount,
        outputDir: OUTPUT_DIR,
        reportDigest: digest,
        mapErrors: report.mapErrors.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
