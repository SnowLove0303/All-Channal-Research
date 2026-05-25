#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workflowRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(workflowRoot, "..");

function parseArgs(argv) {
  const args = {
    limit: 10,
    platforms: "bilibili,zhihu",
    timeoutMs: 30000,
    bilibiliTimeoutMs: 70000,
    zhihuTimeoutMs: 30000,
    query: "",
    outDir: "",
    bilibiliPython: process.env.BILIBILI_PYTHON || "python",
    zhihuCdpUrl: process.env.CHROME_DIDY_CDP_URL || "",
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index] || "";
    if (arg === "--query") args.query = next();
    else if (arg === "--limit") args.limit = Number(next());
    else if (arg === "--platforms") args.platforms = next();
    else if (arg === "--out-dir") args.outDir = next();
    else if (arg === "--timeout-ms") args.timeoutMs = Number(next());
    else if (arg === "--bilibili-timeout-ms") args.bilibiliTimeoutMs = Number(next());
    else if (arg === "--zhihu-timeout-ms") args.zhihuTimeoutMs = Number(next());
    else if (arg === "--bilibili-python") args.bilibiliPython = next();
    else if (arg === "--zhihu-cdp-url") args.zhihuCdpUrl = next();
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(args.limit) || args.limit < 1) args.limit = 10;
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 5000) args.timeoutMs = 30000;
  if (!Number.isFinite(args.bilibiliTimeoutMs) || args.bilibiliTimeoutMs < 5000) args.bilibiliTimeoutMs = args.timeoutMs;
  if (!Number.isFinite(args.zhihuTimeoutMs) || args.zhihuTimeoutMs < 5000) args.zhihuTimeoutMs = args.timeoutMs;
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node information-search-workflow/scripts/collect_sources.mjs --query <text> [--limit 10]",
    "",
    "Options:",
    "  --platforms bilibili,zhihu",
    "  --out-dir .runtime/information-search/run-name",
    "  --bilibili-python python",
    "  --zhihu-cdp-url http://127.0.0.1:9222",
    "  --timeout-ms 30000",
    "  --bilibili-timeout-ms 70000",
    "  --zhihu-timeout-ms 30000",
  ].join("\n");
}

function safeRunName(query) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "query";
  return `${stamp}-${slug}`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function parseJsonOutput(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function extractEmbeddedError(text) {
  const raw = String(text || "");
  const match = raw.match(/"error"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (!match) return "";
  try {
    return JSON.parse(`"${match[1]}"`).replace(/\u001b\[[0-9;]*m/g, "").trim();
  } catch {
    return match[1].replace(/\\n/g, "\n").replace(/\u001b\[[0-9;]*m/g, "").trim();
  }
}

async function runCommand(command, args, options) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: repoRoot,
      timeout: options.timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
      },
      windowsHide: true,
    });
    return { ok: true, stdout: result.stdout, stderr: result.stderr, code: 0 };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      code: error.code || 1,
      error: error.message || String(error),
    };
  }
}

function normalizeText(value, maxLength = 500) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return text.replace(/\/$/, "");
  }
}

function numeric(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function scoreSource(item) {
  const metrics = item.metrics || {};
  if (item.platform === "bilibili") return numeric(metrics.plays) + numeric(metrics.score);
  if (item.platform === "zhihu") return numeric(metrics.votes) * 10 + numeric(metrics.comments);
  return 0;
}

function normalizeBilibiliItems(payload) {
  return (payload.items || []).map((item, index) => ({
    platform: "bilibili",
    type: item.type || "video",
    rank: item.rank || index + 1,
    title: normalizeText(item.title, 240),
    url: item.url || (item.id ? `https://www.bilibili.com/video/${item.id}/` : ""),
    author: normalizeText(item.author, 100),
    publishedAt: item.publishedAt || "",
    retrievedAt: item.retrievedAt || payload.capturedAt || "",
    snippet: normalizeText(item.snippet, 800),
    metrics: {
      plays: numeric(item.metrics?.plays),
      score: numeric(item.metrics?.score),
    },
    evidence: {
      collector: "bilibili_collect.py",
      source: item.source || payload.source || "bilibili_search",
    },
  }));
}

function normalizeZhihuItems(payload) {
  return (payload.items || []).map((item, index) => ({
    platform: "zhihu",
    type: item.type || "item",
    rank: index + 1,
    title: normalizeText(item.title, 240),
    url: item.url || "",
    author: normalizeText(item.author, 100),
    publishedAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
    retrievedAt: payload.capturedAt || "",
    snippet: normalizeText(item.snippet || item.description || item.visibleText, 900),
    metrics: {
      votes: numeric(item.votes),
      comments: numeric(item.comments),
      heat: normalizeText(item.heat, 80),
    },
    evidence: {
      collector: "zhihu_cdp.ps1",
      source: payload.source || "zhihu_cdp",
    },
  }));
}

function dedupeAndRank(items) {
  const seen = new Map();
  for (const item of items) {
    const key = normalizeUrl(item.url) || `${item.platform}:${item.type}:${item.title.toLowerCase()}`;
    const score = scoreSource(item);
    const existing = seen.get(key);
    if (!existing || score > scoreSource(existing)) seen.set(key, item);
  }
  return [...seen.values()].sort((a, b) => scoreSource(b) - scoreSource(a));
}

async function collectBilibili(args, rawDir) {
  const outJson = path.join(rawDir, "bilibili.json");
  const collector = path.join(workflowRoot, "scripts", "bilibili_collect.py");
  const run = await runCommand(
    args.bilibiliPython,
    [collector, "--query", args.query, "--limit", String(args.limit), "--out-json", outJson],
    { ...args, timeoutMs: args.bilibiliTimeoutMs },
  );
  let payload = null;
  try {
    payload = await readJson(outJson);
  } catch {
    const combinedOutput = `${run.stdout}\n${run.stderr}\n${run.error || ""}`;
    payload = parseJsonOutput(combinedOutput) || {
      ok: false,
      platform: "bilibili",
      error: extractEmbeddedError(combinedOutput) || run.error || run.stderr || "bilibili_output_missing",
      items: [],
    };
  }

  return {
    status: {
      platform: "bilibili",
      ok: Boolean(run.ok && payload.ok),
      rawPath: path.relative(repoRoot, outJson),
      count: Array.isArray(payload.items) ? payload.items.length : 0,
      error: payload.error || (!run.ok ? run.error || run.stderr : ""),
    },
    items: payload.ok ? normalizeBilibiliItems(payload) : [],
  };
}

async function collectZhihu(args, rawDir) {
  const outJson = path.join(rawDir, "zhihu.json");
  const outMarkdown = path.join(rawDir, "zhihu.md");
  const script = path.join(repoRoot, "zhihu-search-info", "scripts", "zhihu_cdp.ps1");
  const psArgs = [
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    script,
    "-Mode",
    "search",
    "-Query",
    args.query,
    "-Type",
    "all",
    "-Limit",
    String(args.limit),
    "-TimeoutMs",
    String(args.zhihuTimeoutMs),
    "-OutJson",
    outJson,
    "-OutMarkdown",
    outMarkdown,
    "-NewTab",
  ];
  if (args.zhihuCdpUrl) psArgs.push("-CdpUrl", args.zhihuCdpUrl);

  const run = await runCommand("powershell", psArgs, { ...args, timeoutMs: args.zhihuTimeoutMs + 5000 });
  let payload = null;
  try {
    payload = await readJson(outJson);
  } catch {
    const combinedOutput = `${run.stdout}\n${run.stderr}\n${run.error || ""}`;
    payload = parseJsonOutput(combinedOutput) || {
      ok: false,
      platform: "zhihu",
      error: extractEmbeddedError(combinedOutput) || run.error || run.stderr || "zhihu_output_missing",
      items: [],
    };
  }

  const ok = Boolean(run.ok && payload && payload.ok !== false && !payload.error && !payload.blocker);
  return {
    status: {
      platform: "zhihu",
      ok,
      rawPath: path.relative(repoRoot, outJson),
      markdownPath: path.relative(repoRoot, outMarkdown),
      count: Array.isArray(payload.items) ? payload.items.length : 0,
      error: payload.error || payload.blocker || (!run.ok ? run.error || run.stderr : ""),
    },
    items: ok ? normalizeZhihuItems(payload) : [],
  };
}

function renderReport(payload) {
  const lines = [];
  lines.push("# Information Search Report");
  lines.push("");
  lines.push(`- Query: ${payload.query}`);
  lines.push(`- Generated: ${payload.generatedAt}`);
  lines.push(`- Source count: ${payload.sources.length}`);
  lines.push("");
  lines.push("## Channel Status");
  lines.push("");
  lines.push("| Platform | OK | Count | Raw | Error |");
  lines.push("| --- | --- | ---: | --- | --- |");
  for (const status of payload.channels) {
    lines.push(
      `| ${status.platform} | ${status.ok ? "yes" : "no"} | ${status.count || 0} | ${status.rawPath || ""} | ${normalizeText(status.error, 180)} |`,
    );
  }
  lines.push("");
  lines.push("## Ranked Sources");
  lines.push("");
  for (const [index, item] of payload.sources.entries()) {
    const metricText = Object.entries(item.metrics || {})
      .filter(([, value]) => value !== "" && value !== 0)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
    lines.push(`### ${index + 1}. [${item.platform}] ${item.title || item.url}`);
    if (item.url) lines.push(`- URL: ${item.url}`);
    if (item.author) lines.push(`- Author: ${item.author}`);
    if (item.publishedAt) lines.push(`- Published: ${item.publishedAt}`);
    if (metricText) lines.push(`- Metrics: ${metricText}`);
    if (item.snippet) lines.push(`- Snippet: ${item.snippet}`);
    lines.push("");
  }
  if (payload.sources.length === 0) {
    lines.push("No normalized sources were collected. Check channel errors above before changing the query.");
    lines.push("");
  }
  lines.push("## Next Handling");
  lines.push("");
  lines.push("- Use Bilibili items for video transcription or daily-report source discovery.");
  lines.push("- Use Zhihu items for community discussion, answer/article extraction, and follow-up fetches.");
  lines.push("- Treat any failed channel as a workflow blocker, not as evidence that the platform has no matching content.");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.query) {
    console.log(usage());
    process.exit(args.query ? 0 : 2);
  }

  const outDir = path.resolve(repoRoot, args.outDir || path.join(".runtime", "information-search", safeRunName(args.query)));
  const rawDir = path.join(outDir, "raw");
  await mkdir(rawDir, { recursive: true });

  const platforms = args.platforms
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const runs = [];
  if (platforms.includes("bilibili")) runs.push(collectBilibili(args, rawDir));
  if (platforms.includes("zhihu")) runs.push(collectZhihu(args, rawDir));

  const results = await Promise.all(runs);
  const channels = results.map((result) => result.status);
  const sources = dedupeAndRank(results.flatMap((result) => result.items));
  const payload = {
    query: args.query,
    generatedAt: new Date().toISOString(),
    outputDir: path.relative(repoRoot, outDir),
    channels,
    sources,
  };

  await writeFile(path.join(outDir, "sources.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(path.join(outDir, "report.md"), renderReport(payload), "utf8");

  console.log(JSON.stringify({
    ok: channels.some((channel) => channel.ok),
    outputDir: payload.outputDir,
    channels,
    sourceCount: sources.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
