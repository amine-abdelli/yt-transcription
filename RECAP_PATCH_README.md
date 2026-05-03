# Recap — install patch

This folder contains 5 files that upgrade your YouTube Transcript Downloader extension with the **Recap** inline panel + per-claim fact-checking.

## What's new

| File                     | Action  | Why                                                  |
|--------------------------|---------|------------------------------------------------------|
| `panel.css`              | **add** | Recap visual system (dark + light tokens, animations, claim/quote/verdict styling). |
| `panel.js`               | **add** | Inline panel renderer — idle, loading, streaming, result, error states. |
| `recap-api.js`           | **add** | OpenAI helpers: `detectVideoCategory`, `extractClaimsAndQuotes`, `factCheckClaim`. |
| `recap-orchestrator.js`  | **add** | Wires the panel to your existing `getTranscript` / `generateSummary` and to the new claim helpers. |
| `manifest.json`          | replace | Adds the 4 new scripts + the panel CSS to the content-script entry. Bumped to v1.1.0. |

**Nothing else changes.** Your `content.js`, `openai-summary.js`, `i18n.js`, `popup.*`, settings modal, sponsor-skip, and transcript-download flows are all untouched. The orchestrator overrides `window.handleSummarize` so the existing dropdown still works — clicks just route through the new panel.

## Install

1. Drop these 5 files into your extension folder (overwriting `manifest.json`).
2. Reload the extension in `chrome://extensions`.
3. Open any YouTube video — you should see the Recap panel mounted in the right rail, above the existing transcript-download bar.

## How it works

- **Idle**: shows length picker (TL;DR / Normal / Detailed) + "Summarize video" CTA.
- **On click**: reads the transcript with timestamps, runs three OpenAI calls in parallel (category classify, summary, claims+quotes extract), then streams the summary into the panel.
- **Auto-detect**: only news / review / lecture / opinion / interview videos get fact-checkable claims. Tutorials, recipes, vlogs, etc. show summary + quotes only.
- **Per-claim fact-check**: each claim has its own pill — click it to verify just that claim, or "Fact-check all" to run the whole list. Verdicts: ✓ verified, ⚠ disputed, ✗ inaccurate, ? unverified. Click a verdict to expand the source list.
- **Timestamps**: every claim and quote has a clickable timecode that seeks the YouTube player.
- **Footer actions**: Copy / Save / Translate the summary; Regenerate the whole thing.

## Files I left alone

- `content.js` — your transcript scraper, sponsor skipper, settings modal, dropdown bar.
- `openai-summary.js` — your existing `generateSummary` and `detectSponsorSegments`.
- `i18n.js`, `popup.*`, icons.

## Notes / possible follow-ups

- The orchestrator currently translates via `prompt()` for target language — replace with a proper modal when ready.
- Fact-check uses the model's training data only (no live search). To add real-time citations, swap `factCheckClaim` for a search-augmented call.
- The "Save" button downloads the summary as a `.txt`. If you want the History library, persist to `chrome.storage.local`.
