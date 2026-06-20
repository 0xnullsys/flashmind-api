# Notes2Anki

Licensed under MIT. See [LICENSE](LICENSE).

Upload foto catatan (Bahasa Indonesia) → dapat file `.apkg` Anki siap import.
Ada UI web dan JSON API.

## Stack

- **Flask** — web + API
- **EasyOCR** — OCR Bahasa Indonesia + English
- **Heuristic Q&A** — bikin kartu dari kalimat fact-like (regex, no LLM)
- **genanki** — build file `.apkg`

Pakai Python, CPU-only. Tidak butuh GPU.

## Cara kerja

```
image(s) → save to temp → OCR (EasyOCR, id+en)
        → concat text → split sentences
        → heuristic Q&A (regex: angka/cue kata "adalah/merupakan" + cloze)
        → genanki → .apkg
```

Pipeline di `pipeline.py`, dipake web & API.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows
pip install -r requirements.txt
python app.py
```

Buka `http://127.0.0.1:5000`.

> **Catatan:** run pertama bakal download model EasyOCR (~100 MB). Setelah itu
> cached. OCR pertama per sesi ~30-60 detik di CPU; berikutnya < 5 detik per
> gambar.

## Web UI

`/` — form upload. Drag-drop / pilih 1+ gambar, klik **Proses & Download**.
File `.apkg` otomatis ke-download. Ukuran maks 10 MB per request.

## API

### `POST /v1/cards`

Multipart form:

| Field    | Tipe           | Wajib | Keterangan                          |
|----------|----------------|-------|-------------------------------------|
| `image`  | file (1+)      | ya    | Gambar catatan                      |
| `options`| string (JSON)  | tidak | `{"deck_name": "MyDeck"}`           |

#### Response JSON (default)

```bash
curl -F "image=@note.jpg" http://127.0.0.1:5000/v1/cards
```

```json
{
  "deck_name": "Notes2Anki",
  "count": 12,
  "pairs": [
    {"question": "...?", "answer": "..."}
  ]
}
```

#### Response `.apkg` binary

```bash
curl -F "image=@note.jpg" \
     -F 'options={"deck_name":"Bio101"}' \
     -H "Accept: application/octet-stream" \
     http://127.0.0.1:5000/v1/cards -o bio101.apkg
```

Atau pakai query: `?format=apkg` / `?format=json`. `Accept` header dicek
terakhir; default JSON.

Header balasan:
- `Content-Disposition: attachment; filename="<deck_name>.apkg"`
- `X-Card-Count: <int>`

### `GET /v1/health`

```json
{"status": "ok"}
```

## Error responses

Semua error → JSON envelope:

```json
{"error": {"code": "pipeline_error", "message": "..."}}
```

| HTTP | Code               | Kapan                                                  |
|------|--------------------|--------------------------------------------------------|
| 400  | `pipeline_error`   | Tidak ada file / form key `image` kosong               |
| 413  | `file_too_large`   | Request body > 10 MB                                   |
| 422  | `pipeline_error`   | OCR kosong / tidak ada kalimat fact-like / file rusak  |
| 500  | `internal_error`   | Unhandled exception (stack di-log server-side)         |
| 500  | `no_deck`          | `deck_name` kosong saat minta `.apkg`                  |

## File map

```
app.py            # Flask app, routes, error handlers
pipeline.py       # OCR + Q&A + deck, shared by web/API
ocr.py            # EasyOCR reader (lazy-loaded singleton)
qa.py             # Heuristic Q&A generator (regex-based)
deck.py           # genanki .apkg builder
templates/
  index.html      # Web UI (vanilla JS, no build step)
requirements.txt  # Pinned deps
```

## Batasan & ekstensi ke depan

- **Heuristik Q&A, bukan LLM.** Murah dan cepat tapi miss buat kalimat
  non-fact. Swap `qa.generate()` ke prompt LLM kalau perlu kartu lebih kaya.
- **CPU only.** Nyalain `gpu=True` di `ocr.py` kalau ada CUDA → 5-10× lebih
  cepat.
- **10 MB cap.** Naikkan `MAX_CONTENT_LENGTH` di `app.py` kalau perlu.
- **Cap 50 kartu per request** (di `qa.py`). Naikkan saat konten asli scale up.
- **No auth.** API terbuka. Pasang reverse proxy + token auth sebelum expose
  publik.
- **No persistent storage.** File upload langsung ditulis ke temp, di-unlink
  di `finally`. Tambah job queue kalau latency/throughput jadi masalah.
