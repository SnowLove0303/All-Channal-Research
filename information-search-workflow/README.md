# Unified Information Search Workflow

This folder coordinates the existing Bilibili and Zhihu collectors into one evidence-first search workflow.

It does not replace the platform skills:

- Bilibili remains in `bilibili-all-in-one-2026-04-18-v2/`.
- Zhihu remains in `zhihu-search-info/`.

The workflow adds a shared run shape for cross-platform research:

1. Collect from every enabled platform.
2. Preserve each platform's raw JSON/Markdown snapshot.
3. Normalize results into one `sources.json`.
4. Deduplicate and rank the sources.
5. Write a short operator report with platform status and blockers.

## Why This Exists

The two current platform skills are strong at their own jobs, but they return different result formats and fail differently:

- Bilibili can often search through public API fallback even without a browser session.
- Zhihu depends on a logged-in Chrome/ChromeDidy CDP session.
- Both channels need a visible status report so an agent does not confuse "zero results" with "collector could not run."

External reference points used for this workflow:

- OpenCLI's Zhihu browser adapter exposes `hot`, `search`, `question`, and `download` commands, plus authenticated browser actions.
- OpenCLI's adapter registry treats both Zhihu and Bilibili as browser-backed information channels.
- `SocialSisterYi/bilibili-API-collect` documents Bilibili web API patterns, including WBI signing.
- Bilibili MCP-style tools commonly expose video info plus subtitles, danmaku, and comments as separate evidence layers.
- `yt-dlp` supports Bilibili extraction, but it should be treated as a download backend, not the only metadata source.

## Quick Start

From the repository root:

```powershell
node .\information-search-workflow\scripts\collect_sources.mjs `
  --query "AI Agent 日报" `
  --limit 10 `
  --out-dir .\.runtime\information-search\ai-agent-daily
```

Use only one platform:

```powershell
node .\information-search-workflow\scripts\collect_sources.mjs `
  --query "AI Agent 日报" `
  --platforms bilibili `
  --limit 10
```

Use a specific Zhihu CDP URL:

```powershell
node .\information-search-workflow\scripts\collect_sources.mjs `
  --query "AI Agent 日报" `
  --zhihu-cdp-url http://127.0.0.1:9222
```

If `--zhihu-cdp-url` is omitted, the Zhihu wrapper probes the current ChromeDidy environment and common local CDP ports. A stale `CHROME_DIDY_CDP_URL` no longer has to block a run when another logged-in ChromeDidy port is reachable.

Before diagnosing Zhihu as "not logged in", collect port evidence:

```powershell
powershell -ExecutionPolicy Bypass -File .\zhihu-search-info\scripts\discover_cdp_ports.ps1
```

Use `CHROME_DIDY_CDP_URL` first, then `CHROME_DIDY_CHROME_PORT`, then the common ports `9222`, `9223`, `9224`, `9225`, and `9333`. A `zhihu.com` tab in `/json/list` means the port is a candidate, but the workflow still verifies it by running `zhihu_cdp.ps1`; logged-out walls are blockers, not empty search results. Bilibili login state must be checked separately with `bilibili-expander` `cookie-status` / `cookie-from-chrome`.

## Outputs

Each run writes:

- `raw/bilibili.json`: raw normalized Bilibili collector output.
- `raw/zhihu.json`: raw Zhihu CDP collector output, when the CDP session is reachable.
- `raw/zhihu.md`: Zhihu evidence Markdown, when available.
- `sources.json`: unified cross-platform results and channel status.
- `report.md`: human-readable operator report.

## Operational Notes

- Start Bilibili with public search first; escalate to login/cookie-backed download only when a video must be transcribed.
- Start Zhihu with `-Mode observe` if the user already has the relevant page open; use search only when query discovery is needed.
- Do not pass `--zhihu-cdp-url` unless you intentionally want to pin one port; leaving it empty lets the Zhihu wrapper fall through to another reachable logged-in profile when the environment port is stale or logged out.
- Keep generated evidence under `.runtime/`; the folder is intentionally ignored by Git.
- A failed platform should be recorded as `error`, not silently omitted.
- A successful run with no items is different from a blocked collector and should be reviewed separately.
- Bilibili public fallback can be slower than Zhihu CDP checks; tune `--bilibili-timeout-ms` and `--zhihu-timeout-ms` independently.

## Recommended Expansion

The next useful additions are:

- Bilibili comment/danmaku collection beside subtitles for social signal analysis.
- Zhihu collections and comment extraction, mirroring OpenCLI's authenticated action surface.
- Web/GitHub ingest adapters that accept JSON exports from `gh search`, Tavily, or browser search.
- A daily-report writer that consumes `sources.json` and writes a clean Notion-ready digest.
