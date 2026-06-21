# Plan: Improve OCR + AI Q/A for HF Space

## Context

Two issues reported by user:

1. **OCR fails on printed book pages** — EasyOCR (current) is tuned for scene text / handwriting. Printed book pages (small font, justified columns, mixed density) need a different approach.

2. **AI Q/A generation unreliable** — heuristic regex too narrow (only "adalah/merupakan/is/are" patterns). Misses cause-effect, lists, dates, and produces no word-limit enforcement.

## Constraints

- HF Space free tier: 50GB storage, 16GB RAM
- CPU-only (no GPU)
- Avoid heavy LLM dependencies (user preference)
- Keep OpenAI fallback in Node side for paying users

## Approach

### Issue 1: Dynamic OCR routing

Add a second OCR engine and route per-image based on a cheap heuristic.

| Engine | Best for | Cost |
|---|---|---|
| `easyocr` (current) | handwriting, scene text, low-light photos | ~200MB cache |
| `trocr-base-printed` (new) | printed text, book pages, clean docs | ~500MB on first download, ~500MB RAM |

**Heuristic router** (no ML, just image analysis):
- Compute: text density (white pixel ratio), edge sharpness (Laplacian variance), aspect ratio
- If `density > 0.4` AND `sharpness > threshold` AND `aspect_ratio in (0.6, 0.85)` → book page → TrOCR
- Otherwise → EasyOCR

**Why heuristic, not LLM**: classify-image models add 100MB+ and latency. Image stats give 80% accuracy with 0 cost.

### Issue 2: Better Q/A heuristic

Expand pattern coverage + structural enforcement.

**New patterns** (alongside existing):
- Definition: `X adalah/merupakan/yaitu Y`
- Cause-effect: `X karena/sebab Y`, `Y disebabkan/akibat X`
- List: numbered/bulleted enumerations
- Date/year: `1945`, `tahun XXXX`, `pada tahun`
- Comparison: `X lebih Y daripada Z`
- Process: numbered steps

**Structural rules** (matches `wordLimits.ts`):
- Front: max 20 words, 120 chars
- Back: max 100 words, 500 chars
- Drop cards that exceed limits
- Deduplicate by (front normalized)

**Why no LLM**: user preference + free tier. Heuristic improvements give 2-3x pattern coverage with same cost.

## Files

| File | Action |
|---|---|
| `hf-space-source/requirements.txt` | add `transformers`, `Pillow` |
| `hf-space-source/ocr_router.py` | NEW: heuristic + dual-engine dispatch |
| `hf-space-source/generator.py` | modify: import from `ocr_router`, keep `extract_text_from_image` as facade |
| `hf-space-source/qa_heuristic.py` | NEW: expanded patterns + structural rules |
| `hf-space-source/app.py` | modify: use `qa_heuristic.generate()` |

## Verification

1. Test images:
   - `test/3729717568.jpg` (existing, low-light scene)
   - `test/unnamed.jpg` (existing)
   - NEW: scanned book page (user will provide)
2. Compare OCR output: EasyOCR vs TrOCR vs routed
3. Test Q/A: same input text → count cards generated, check word limits, check dedup
4. Manual review: do generated Q/A make sense for book content?

## Out of scope

- LLM-based Q/A (deferred — user prefers heuristic)
- Multi-column detection (deferred — needs OpenCV geometry)
- Layout detection (LayoutLM, etc.) — heavy, not needed yet
- Streaming/async OCR — not needed at this scale
