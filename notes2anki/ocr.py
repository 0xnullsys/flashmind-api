# ponytail: load EasyOCR once (it downloads models on first run), reuse per request.
from __future__ import annotations

import easyocr

# ponytail: Bahasa only. EasyOCR packs 'id'. Add 'en' if mixed notes show up later.
_READER = None


def get_reader():
    global _READER
    if _READER is None:
        _READER = easyocr.Reader(["id", "en"], gpu=False)
    return _READER


def ocr_image(path: str) -> str:
    """Return plain text from an image file."""
    reader = get_reader()
    results = reader.readtext(path, detail=0, paragraph=True)
    return "\n".join(results).strip()