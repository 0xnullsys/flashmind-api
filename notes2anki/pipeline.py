# ponytail: pipeline shared by web upload and /v1/cards. OCR -> Q&A -> (optional) deck.
from __future__ import annotations

import os
import tempfile
from typing import Iterable

from flask import Request

from deck import build_deck
from ocr import ocr_image
from qa import generate


class PipelineError(Exception):
    """User-fixable input problem (no OCR text, no facts, unreadable file)."""

    def __init__(self, message: str, status: int = 422):
        super().__init__(message)
        self.status = status


def _save_all(files: Iterable) -> list[str]:
    paths: list[str] = []
    for f in files:
        if not f or not f.filename:
            continue
        fd, path = tempfile.mkstemp(suffix=os.path.splitext(f.filename)[1] or ".png")
        os.close(fd)
        f.save(path)
        paths.append(path)
    return paths


def cleanup(paths: list[str]) -> None:
    for p in paths:
        try:
            os.unlink(p)
        except OSError:
            pass


def run(files, deck_name: str = "Notes2Anki") -> tuple[list[dict], bytes | None]:
    """OCR + Q&A. Returns (pairs, deck_bytes). deck_bytes is None if deck_name is empty.

    Raises PipelineError on user-fixable input failures.
    """
    paths = _save_all(files)
    try:
        chunks: list[str] = []
        for path in paths:
            try:
                t = ocr_image(path)
            except ValueError as e:
                raise PipelineError(f"File tidak bisa diproses: {e}") from e
            if t.strip():
                chunks.append(t)

        text = "\n".join(chunks)
        if not text.strip():
            raise PipelineError("OCR returned empty text — coba foto lebih jelas")
        pairs = generate(text)
        if not pairs:
            raise PipelineError("Tidak ada kalimat fact-like terdeteksi")

        deck_bytes = build_deck(pairs, deck_name=deck_name) if deck_name else None
        return pairs, deck_bytes
    finally:
        cleanup(paths)


def files_from_request(req: Request) -> list:
    # ponytail: form key 'image' (web + API agree) keeps one source of truth.
    return [f for f in req.files.getlist("image") if f and f.filename]
