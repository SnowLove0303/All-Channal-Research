# All-Channal Research Skills

This private repo packages the current local Codex research skills as a ready-to-run project.

It includes the skill instructions, Bilibili search/download/transcription scripts, Zhihu logged-in Chrome/CDP extraction, Chrome login-state helpers, Juya daily workflow scripts, hot-video report tools, unified information-search evidence workflow, smoke checks, and install scripts.

## What Is Included

- `bilibili-all-in-one-2026-04-18-v2/SKILL.md`: Codex skill entry.
- `zhihu-search-info/SKILL.md`: Zhihu search and information retrieval skill entry.
- `information-search-workflow/`: shared Bilibili + Zhihu evidence collection workflow.
- `bilibili-all-in-one-2026-04-18-v2/quick-ref.md`: quick command reference.
- `bilibili-all-in-one-2026-04-18-v2/scripts/bilibili-opencli`: Bilibili search, metadata lookup, video/audio download, ASR transcription, and note generation.
- `bilibili-all-in-one-2026-04-18-v2/scripts/bilibili-expander`: Chrome login-state reuse, cookie bridge, evidence pack, danmaku/subtitle export, content radar, subscriptions, live snapshot, and download backend checks.
- `bilibili-all-in-one-2026-04-18-v2/scripts/juya-daily`: Juya AI daily lookup, transcription flow, Notion publishing flow.
- `bilibili-all-in-one-2026-04-18-v2/scripts/notion`: generic markdown/transcript to Notion publisher.
- `bilibili-all-in-one-2026-04-18-v2/scripts/bilibili-hot-monitor`: hot video report and email report workflow.
- `bilibili-all-in-one-2026-04-18-v2/scripts/setup.ps1`, `check_env.ps1`, `smoke_test.ps1`: install, environment check, and smoke validation.
- `TRANSCRIBE_AND_NOTION.md`: operator and agent runbook for transcription and Notion publishing.

Local login state, generated environment files, caches, and secrets are intentionally not committed.

## Quick Start On Windows

Open PowerShell at the repository root:

```powershell
$Skill = ".\bilibili-all-in-one-2026-04-18-v2"
& "$Skill\scripts\setup.ps1" -RunSmokeTest
```

The installer creates:

- Python venv: `E:\MorenAnzhuangLujing\Huangjingdajian\python-venvs\bilibili-all-in-one`
- pip cache: `E:\MorenAnzhuangLujing\Huangjingdajian\tool-caches\pip\bilibili-all-in-one`
- model cache: `E:\MorenAnzhuangLujing\Huangjingdajian\tool-caches\huggingface\bilibili-all-in-one`
- OpenCLI install: `E:\MorenAnzhuangLujing\Huangjingdajian\node-tools\opencli`
- Bilibili output: `E:\MorenAnzhuangLujing\Huangjingdajian\downloads\bilibili`
- local env file: `bilibili-all-in-one-2026-04-18-v2\.env.generated.ps1`

Use a different install root when needed:

```powershell
& "$Skill\scripts\setup.ps1" -InstallRoot "F:\AIAPP\Codex\tooling\bilibili" -RunSmokeTest
```

Load the generated environment in later shells:

```powershell
. "$Skill\.env.generated.ps1"
```

## Required System Tools

- Windows PowerShell 5+ or PowerShell 7+
- Python 3.10+
- Node.js and npm, for installing `@jackwener/opencli`
- ffmpeg on `PATH`
- Chrome or Edge, for QR login and login-state reuse

Optional download backends:

- `BBDown`
- `yutto`
- `yt-dlp` CLI

The Python package `yt-dlp` is installed by `setup.ps1` even if the `yt-dlp` CLI is not already on `PATH`.

## Environment Check

```powershell
& "$Skill\scripts\check_env.ps1"
```

This reports Python, venv, OpenCLI, ffmpeg, optional download backends, Chrome/Edge, cookie state, output directory, and ASR package availability.

## Bilibili Login State

Start QR login and persist reusable cookie state:

```powershell
$Py = "E:\MorenAnzhuangLujing\Huangjingdajian\python-venvs\bilibili-all-in-one\Scripts\python.exe"
$Expander = "$Skill\scripts\bilibili-expander\cli.py"

& $Py $Expander chrome-login --port 9222 --wait-login 180
& $Py $Expander cookie-from-chrome --cdp-url http://127.0.0.1:9222 --wait-login 30
& $Py $Expander cookie-status
```

Cookie state is written under `.runtime/` and is ignored by Git.

## Common Commands

Run a unified Bilibili + Zhihu search and keep evidence under `.runtime/`:

```powershell
node .\information-search-workflow\scripts\collect_sources.mjs `
  --query "AI Agent daily report" `
  --limit 10 `
  --out-dir .\.runtime\information-search\ai-agent-daily
```

Run Bilibili only:

```powershell
node .\information-search-workflow\scripts\collect_sources.mjs `
  --query "AI Agent daily report" `
  --platforms bilibili `
  --limit 10
```

Run Zhihu search through the logged-in ChromeDidy/CDP profile:

```powershell
powershell -ExecutionPolicy Bypass -File .\zhihu-search-info\scripts\zhihu_cdp.ps1 `
  -Mode search `
  -Query "AI Agent daily report" `
  -Type all `
  -Limit 8 `
  -OutJson .\.runtime\zhihu\search.json `
  -OutMarkdown .\.runtime\zhihu\search.md
```

When login state is uncertain, inspect the current browser ports first:

```powershell
powershell -ExecutionPolicy Bypass -File .\zhihu-search-info\scripts\discover_cdp_ports.ps1
```

`zhihu_cdp.ps1` auto-discovers CDP in this order: explicit `-CdpUrl`, `CHROME_DIDY_CDP_URL`, `CHROME_DIDY_CHROME_PORT`, local Codex Chrome config, then common local debug ports `9222`, `9223`, `9224`, `9225`, and `9333`. If no explicit `-CdpUrl` is provided and the first reachable port shows a logged-out Zhihu page, the wrapper tries the next reachable port instead of treating that as an empty result.

Bilibili login state is not inferred from Zhihu tabs. Confirm it with the Bilibili expander:

```powershell
& $Py "$Skill\scripts\bilibili-expander\cli.py" cookie-status --no-validate
& $Py "$Skill\scripts\bilibili-expander\cli.py" cookie-from-chrome --cdp-url http://127.0.0.1:9223 --wait-login 5
```

Find a specific video without downloading:

```powershell
$Py = "E:\MorenAnzhuangLujing\Huangjingdajian\python-venvs\bilibili-all-in-one\Scripts\python.exe"
$Run = "$Skill\scripts\bilibili-opencli\scripts\run.py"

& $Py $Run --find-video "OpenAI OpenClaw AI日报 2026-05-03" --author "Juya" --limit 10 --strict-find --dry-run
```

Process a known BV:

```powershell
& $Py $Run --bvid BVxxxxxxxxxx --engine auto --keep-cache
```

`--keep-cache` is important when the transcript needs to be published to Notion after transcription. See `TRANSCRIBE_AND_NOTION.md` for the full BV-to-Notion workflow.

Search by keyword:

```powershell
& $Py $Run --search "AI Agent 日报" --limit 10 --dry-run
```

Run Juya daily full flow:

```powershell
& "$Skill\scripts\juya-daily\run-juya-today-fullflow.ps1"
```

Publish Juya result to Notion requires one of these environment variables:

- `NOTION_KEY`
- `NOTION_TOKEN`
- `NOTION_API_KEY`

Set the target database when needed:

```powershell
$env:BILIBILI_DAILY_NOTION_DATABASE_ID = "34d003b6-8bec-8027-a6ea-fd8b918c72c5"
```

Publish any generated markdown note and transcript to Notion:

```powershell
node "$Skill\scripts\notion\publish-note-to-notion.mjs" `
  --title "Juya AI 2026-05-19 BVxxxxxxxxxx" `
  --bvid BVxxxxxxxxxx `
  --note ".\.runtime\notes\Juya AI 2026-05-19 BVxxxxxxxxxx.md" `
  --transcript "E:\MorenAnzhuangLujing\Huangjingdajian\downloads\bilibili\BVxxxxxxxxxx_transcript.txt"
```

## Fresh Clone Checklist

1. Clone this private repo.
2. Ensure Python, Node.js/npm, ffmpeg, and Chrome/Edge are installed.
3. Run `.\bilibili-all-in-one-2026-04-18-v2\scripts\setup.ps1 -RunSmokeTest`.
4. Load `.env.generated.ps1`.
5. Run `check_env.ps1`.
6. For account-gated videos, run the Chrome login-state commands above.
7. Run `run.py --dry-run` before full download/transcription jobs.

## Files Not Committed

- `.runtime/`
- `.env.generated.ps1`
- `.env`
- local cookies
- model caches
- downloaded videos/audio
- generated reports
