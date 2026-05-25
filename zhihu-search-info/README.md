# Zhihu Search Info Skill

This branch packages the local `zhihu-search-info` Codex skill next to the Bilibili skill.

The skill uses a logged-in Chrome/ChromeDidy CDP session instead of copying Zhihu cookies. It can search Zhihu, fetch questions, fetch answers, read Zhuanlan articles, capture hot lists, read recommendations, and observe the current Zhihu tab.

## Requirements

- Node.js and npm on `PATH`
- A running logged-in Chrome/ChromeDidy session with CDP enabled
- PowerShell 5+ or PowerShell 7+

The wrapper installs Playwright into a local or shared runtime if Playwright is missing.

CDP URL lookup order:

- explicit `-CdpUrl`
- `CHROME_DIDY_CDP_URL`
- `CHROME_DIDY_CHROME_PORT`
- Codex local Chrome config, when present
- common local debug ports: `9223`, `9222`, `9224`, `9333`

The wrapper probes `/json/version` and uses the first reachable CDP endpoint. This prevents a stale environment variable from making the collector fail when a newer ChromeDidy login-state port is already running.

## Quick Start

From the repository root:

```powershell
$Zhihu = ".\zhihu-search-info"

powershell -ExecutionPolicy Bypass -File "$Zhihu\scripts\zhihu_cdp.ps1" `
  -Mode search `
  -Query "AI agent daily report" `
  -Type answer `
  -Limit 8 `
  -OutJson ".\.runtime\zhihu\search.json" `
  -OutMarkdown ".\.runtime\zhihu\search.md"
```

Fetch a question:

```powershell
powershell -ExecutionPolicy Bypass -File "$Zhihu\scripts\zhihu_cdp.ps1" `
  -Mode fetch `
  -Url "https://www.zhihu.com/question/123456789" `
  -OutJson ".\.runtime\zhihu\question.json" `
  -OutMarkdown ".\.runtime\zhihu\question.md"
```

Fetch one answer:

```powershell
powershell -ExecutionPolicy Bypass -File "$Zhihu\scripts\zhihu_cdp.ps1" `
  -Mode answer `
  -Url "https://www.zhihu.com/question/123456789/answer/987654321" `
  -MaxContent 8000 `
  -OutJson ".\.runtime\zhihu\answer.json" `
  -OutMarkdown ".\.runtime\zhihu\answer.md"
```

Capture the current active Zhihu tab without navigating:

```powershell
powershell -ExecutionPolicy Bypass -File "$Zhihu\scripts\zhihu_cdp.ps1" `
  -Mode observe `
  -OutJson ".\.runtime\zhihu\observe.json" `
  -OutMarkdown ".\.runtime\zhihu\observe.md"
```

## Modes

- `search`: search Zhihu through the logged-in browser context.
- `question`: retrieve answer rows for a question.
- `answer`: retrieve full answer detail.
- `article`: extract a Zhuanlan article from the rendered page.
- `fetch`: choose the best extractor based on URL.
- `hot`: read Zhihu hot/trending.
- `recommend`: read the logged-in recommendation feed.
- `observe`: capture the active Zhihu page without navigation.

## Agent Rules

- Preserve the logged-in browser profile; do not export or paste cookies.
- Use `-Mode observe` first when the user already has the target Zhihu page open.
- Use `-NewTab` for parallel captures so one run does not navigate another run's tab.
- Stop and report the blocker if login, phone verification, slider verification, or CAPTCHA appears.
- Treat JSON/Markdown files as evidence snapshots and re-run extraction before citing fast-changing pages.

## Unified Workflow

For cross-platform research, use `information-search-workflow/scripts/collect_sources.mjs` from the repository root. It runs Bilibili and Zhihu collectors, records channel status, and writes normalized `sources.json` plus `report.md`.
