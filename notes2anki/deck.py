# ponytail: build a .apkg deck from Q&A pairs.
import os
import tempfile
import time

import genanki

_MODEL_ID = 1607392319
_DECK_ID = 2059400110


def _model() -> genanki.Model:
    return genanki.Model(
        _MODEL_ID,
        "Notes2Anki Basic",
        fields=[{"name": "Question"}, {"name": "Answer"}],
        templates=[
            {
                "name": "Card 1",
                "qfmt": "{{Question}}",
                "afmt": '{{FrontSide}}<hr id="answer">{{Answer}}',
            }
        ],
    )


def build_deck(pairs: list[dict], deck_name: str = "Notes2Anki") -> bytes:
    deck = genanki.Deck(_DECK_ID, deck_name)
    model = _model()
    for i, p in enumerate(pairs):
        guid = genanki.guid_for(f"{time.time_ns()}-{i}")
        deck.add_note(genanki.Note(model=model, fields=[p["question"], p["answer"]], guid=guid))

    pkg = genanki.Package(deck)
    fd, path = tempfile.mkstemp(suffix=".apkg")
    os.close(fd)
    try:
        pkg.write_to_file(path)
        with open(path, "rb") as f:
            return f.read()
    finally:
        os.unlink(path)