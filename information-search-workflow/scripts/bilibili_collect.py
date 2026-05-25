# -*- coding: utf-8 -*-
"""Collect Bilibili search results into the unified source schema."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
BILIBILI_SCRIPT_DIR = (
    REPO_ROOT
    / "bilibili-all-in-one-2026-04-18-v2"
    / "scripts"
    / "bilibili-opencli"
    / "scripts"
)

if str(BILIBILI_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(BILIBILI_SCRIPT_DIR))

from bilibili_utils import normalize_video_info, search_videos  # noqa: E402


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def as_int(value: Any) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    text = str(value or "").strip().replace(",", "")
    if not text:
        return 0
    try:
        return int(float(text))
    except ValueError:
        return 0


def normalize_item(raw: dict[str, Any], rank: int, query: str) -> dict[str, Any]:
    item = normalize_video_info(raw) or raw
    bvid = item.get("bvid") or ""
    url = item.get("url") or (f"https://www.bilibili.com/video/{bvid}/" if bvid else "")
    plays = as_int(item.get("plays") or item.get("play") or item.get("views"))
    return {
        "platform": "bilibili",
        "type": "video",
        "rank": rank,
        "query": query,
        "id": bvid,
        "title": item.get("title") or "",
        "url": url,
        "author": item.get("author") or "",
        "publishedAt": item.get("date") or "",
        "retrievedAt": utc_now(),
        "snippet": item.get("description") or item.get("desc") or "",
        "metrics": {
            "plays": plays,
            "score": as_int(item.get("score")),
        },
        "source": item.get("source") or raw.get("source") or "bilibili_search",
        "raw": raw,
    }


def build_payload(query: str, limit: int, page: int) -> dict[str, Any]:
    captured_at = utc_now()
    try:
        raw_items = search_videos(query, limit=limit, page=page)
        items = [normalize_item(raw, index + 1, query) for index, raw in enumerate(raw_items)]
        return {
            "ok": True,
            "platform": "bilibili",
            "mode": "search",
            "query": query,
            "capturedAt": captured_at,
            "count": len(items),
            "items": items,
        }
    except Exception as error:  # pragma: no cover - exercised by live smoke tests.
        return {
            "ok": False,
            "platform": "bilibili",
            "mode": "search",
            "query": query,
            "capturedAt": captured_at,
            "error": str(error),
            "items": [],
        }


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Collect Bilibili search evidence as JSON.")
    parser.add_argument("--query", required=True)
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--page", type=int, default=1)
    parser.add_argument("--out-json", default="")
    args = parser.parse_args()

    payload = build_payload(args.query, args.limit, args.page)
    text = json.dumps(payload, ensure_ascii=False, indent=2)

    if args.out_json:
        out_path = Path(args.out_json)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(text + "\n", encoding="utf-8")
    else:
        print(text)

    return 0 if payload.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
