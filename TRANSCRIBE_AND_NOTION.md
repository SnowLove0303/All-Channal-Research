# Transcription And Notion Workflow

This repo should be usable by a human operator or an agent without relying on chat history. The Bilibili skill can:

- reuse the Chrome/Bilibili login state;
- resolve Bilibili videos by BV id, search query, author, UID, or strict title match;
- download audio/video;
- transcribe with `faster-whisper` or FunASR through `--engine auto`;
- generate local markdown notes;
- publish generated notes and transcripts into a Notion database.

## One Command: Juya Daily To Notion

Use this when the task is "run the latest Juya AI daily report and write the result to Notion".

```powershell
$Skill = ".\bilibili-all-in-one-2026-04-18-v2"
. "$Skill\.env.generated.ps1"

$env:NOTION_TOKEN = "<secret>"
$env:BILIBILI_DAILY_NOTION_DATABASE_ID = "34d003b6-8bec-8027-a6ea-fd8b918c72c5"
$env:JUYA_WRITE_NOTION = "1"

& "$Skill\scripts\juya-daily\run-juya-today-fullflow.ps1"
```

The fullflow script keeps the transcript cache, then calls:

```text
scripts/juya-daily/publish-juya-fullflow-result-to-notion.mjs
```

Success evidence:

- PowerShell output includes `FULLFLOW_NOTION_OK`.
- PowerShell output includes `PAGE_URL=...`.
- The report JSON exists at `JUYA_FULLFLOW_REPORT` or the default workspace report path.
- The Notion page contains source validation, execution details, artifacts, note summary, and transcript summary.

## Generic BV To Transcript And Markdown

Use this when the BV id is already known.

```powershell
$Skill = ".\bilibili-all-in-one-2026-04-18-v2"
. "$Skill\.env.generated.ps1"

$Py = "E:\MorenAnzhuangLujing\Huangjingdajian\python-venvs\bilibili-all-in-one\Scripts\python.exe"
$Run = "$Skill\scripts\bilibili-opencli\scripts\run.py"
$Output = "E:\MorenAnzhuangLujing\Huangjingdajian\downloads\bilibili"
$Vault = ".\.runtime\notes"

& $Py $Run `
  --bvid BVxxxxxxxxxx `
  --output $Output `
  --vault $Vault `
  --engine auto `
  --keep-cache
```

Important:

- Use `--engine auto` so Whisper is tried first and FunASR can be used as fallback when configured.
- Use `--keep-cache` when another step needs the transcript or downloaded audio after the run.
- The transcript is written as `$Output\BVxxxxxxxxxx_transcript.txt`.
- The markdown note is written into the vault directory.

## Search Then Transcribe

Use strict search for daily report style jobs where title and author matter.

```powershell
& $Py $Run `
  --find-video "OpenAI OpenClaw AI daily report 2026-05-19" `
  --author "Juya" `
  --limit 10 `
  --strict-find `
  --engine auto `
  --keep-cache
```

Use dry run first when selecting a candidate:

```powershell
& $Py $Run --find-video "AI daily report" --author "Juya" --limit 10 --strict-find --dry-run
```

## Publish Any Generated Note To Notion

Use the generic publisher when a markdown note and transcript already exist.

```powershell
$Skill = ".\bilibili-all-in-one-2026-04-18-v2"

$env:NOTION_TOKEN = "<secret>"
$env:BILIBILI_DAILY_NOTION_DATABASE_ID = "34d003b6-8bec-8027-a6ea-fd8b918c72c5"

node "$Skill\scripts\notion\publish-note-to-notion.mjs" `
  --title "Juya AI 2026-05-19 BVxxxxxxxxxx" `
  --bvid BVxxxxxxxxxx `
  --video-url "https://www.bilibili.com/video/BVxxxxxxxxxx" `
  --author "Juya" `
  --date "2026-05-19" `
  --note ".\.runtime\notes\Juya AI 2026-05-19 BVxxxxxxxxxx.md" `
  --transcript "E:\MorenAnzhuangLujing\Huangjingdajian\downloads\bilibili\BVxxxxxxxxxx_transcript.txt"
```

Dry-run without calling Notion:

```powershell
node "$Skill\scripts\notion\publish-note-to-notion.mjs" `
  --dry-run `
  --title "Smoke Test" `
  --transcript "E:\MorenAnzhuangLujing\Huangjingdajian\downloads\bilibili\BVxxxxxxxxxx_transcript.txt"
```

The publisher accepts these token variables:

- `NOTION_TOKEN`
- `NOTION_KEY`
- `NOTION_API_KEY`

The target database can be set with either:

- `BILIBILI_DAILY_NOTION_DATABASE_ID`
- `NOTION_DATABASE_ID`

To append to an existing page instead of creating a new database row, set:

- `BILIBILI_DAILY_NOTION_PAGE_ID`
- `NOTION_PAGE_ID`
- or pass `--page-id`.

## Agent Acceptance Checklist

Before claiming success, the agent should verify:

- Bilibili account state is available with `python scripts/bilibili-expander/cli.py cookie-status --no-validate`.
- The selected video is the intended video, not just a loose search match.
- The transcript file exists and has real speech text, not HTML, an error page, or only a few characters.
- The markdown note exists and contains a concise daily-report style summary.
- The Notion API call returns an `ok: true` result or the Juya fullflow prints `FULLFLOW_NOTION_OK`.
- The final response includes the Notion page URL and the local transcript/note paths.

## Common Failure Modes

- Missing login state: run `chrome-login`, then `cookie-from-chrome`, then retry.
- Download blocked or incomplete: check `BBDown`, `yutto`, and `yt-dlp` availability with `check_env.ps1`.
- ASR model unavailable: set `WHISPER_MODEL_NAME=tiny` for a lightweight run, or configure `FUNASR_VENV` and use `--engine auto`.
- Notion write failed: confirm the token has access to the database and that the database has a title property.
- Transcript disappeared after a run: rerun with `--keep-cache`.
