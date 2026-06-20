#!/usr/bin/env python3
"""Parse an .apkg file and emit cards as JSON array to stdout."""
import json
import sys
import zipfile
import tempfile
import os
import re


def parse_apkg(path: str) -> list:
    """Extract cards from an .apkg file using stdlib only (no genanki)."""
    cards = []
    with zipfile.ZipFile(path, 'r') as z:
        # Find collection.anki2 (SQLite) or collection.anki21b
        sqlite_files = [n for n in z.namelist() if n.startswith('collection.')]
        if not sqlite_files:
            raise ValueError('No collection file found in .apkg')

        # Use Python stdlib sqlite3 — file is small and read-only
        import sqlite3
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp:
            tmp_path = tmp.name
            tmp.write(z.read(sqlite_files[0]))
            tmp.close()

        try:
            conn = sqlite3.connect(tmp_path)
            try:
                cur = conn.cursor()
                # Anki schema: notes table holds front/back fields
                rows = cur.execute(
                    'SELECT flds FROM notes'
                ).fetchall()
                for (flds,) in rows:
                    # flds joined by \x1f (unit separator)
                    parts = flds.split('\x1f')
                    if len(parts) >= 2:
                        front = strip_html(parts[0])
                        back = strip_html(parts[1])
                        cards.append({'judul': front, 'catatan': back})
            finally:
                conn.close()
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    return cards


def strip_html(s: str) -> str:
    """Minimal HTML stripper — remove tags, decode entities."""
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    # Common entity decode (no need for full html.parser)
    replacements = {
        '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
        '&quot;': '"', '&#39;': "'", '&apos;': "'",
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    return s


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: anki_parse.py <path-to-apkg>', file=sys.stderr)
        sys.exit(2)

    apkg_path = sys.argv[1]
    try:
        cards = parse_apkg(apkg_path)
        print(json.dumps({'cards': cards}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)