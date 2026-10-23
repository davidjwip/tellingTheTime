#!/usr/bin/env python3
"""Generate every audio clip the app can ask for.

Reads `data/phrases.json` (the single source of truth the app also reads) and writes
`public/audio/<locale>/<key>.mp3` for both languages, then records the sha256 of each file in the
manifest so the test can prove the clip matches the wording.

Re-run after changing a phrase: a clip whose stored text no longer matches the manifest is
regenerated, and a clip whose bytes no longer match its stored hash is reported.

    python3 scripts/generate_audio.py            # only what is missing or out of date
    python3 scripts/generate_audio.py --force    # regenerate everything
    python3 scripts/generate_audio.py --only yue # one language

Why pre-recorded rather than spoken at runtime: iOS will not start audio until the child has tapped
something, the voice must be the same every time, and it has to work with no network at all.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import pathlib
import sys

try:
    import edge_tts
except ImportError:  # pragma: no cover - the operator needs to know how to fix it
    sys.exit("edge-tts is not installed. Run: uv run --with edge-tts python3 scripts/generate_audio.py")

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "data" / "phrases.json"
OUTPUT = ROOT / "public" / "audio"


def phrases(manifest: dict) -> list[dict]:
    return [*manifest["ui"], *manifest["chrono"]]


def digest(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


async def synth(text: str, voice: str, rate: str, target: pathlib.Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(str(target))


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="regenerate clips that already exist")
    parser.add_argument("--only", choices=["en", "yue"], help="one language only")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    voices = manifest["voices"]
    rate = manifest["rate"]
    locales = [args.only] if args.only else ["en", "yue"]

    # locale -> key -> {"text": ..., "sha256": ...}. Written back, so the test can recompute.
    clips: dict[str, dict[str, dict[str, str]]] = manifest.get("clips") or {"en": {}, "yue": {}}
    for locale in ("en", "yue"):
        clips.setdefault(locale, {})

    made = kept = stale = 0
    for phrase in phrases(manifest):
        for locale in locales:
            target = OUTPUT / locale / f"{phrase['key']}.mp3"
            recorded = clips[locale].get(phrase["key"])
            up_to_date = (
                target.exists()
                and recorded is not None
                and recorded.get("text") == phrase[locale]
                and recorded.get("sha256") == digest(target)
            )

            if up_to_date and not args.force:
                kept += 1
                continue
            if target.exists() and not args.force:
                stale += 1

            await synth(phrase[locale], voices[locale], rate, target)
            clips[locale][phrase["key"]] = {
                "text": phrase[locale],
                "sha256": digest(target),
            }
            made += 1
            print(f"  {locale}/{phrase['key']}.mp3  <- {phrase[locale]}")

    if not args.only:
        manifest["clips"] = {locale: clips[locale] for locale in ("en", "yue")}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"\n{made} generated, {kept} already current, {stale} replaced because the wording changed")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
