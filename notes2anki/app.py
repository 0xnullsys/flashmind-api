# ponytail: minimal Flask app — web UI + /v1/cards JSON/deck API.
import io
import json
import traceback

from flask import Flask, Response, render_template, request

from pipeline import PipelineError, files_from_request, run

app = Flask(__name__)

# ponytail: shared cap. 413 fires before any handler runs.
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB


# ---- web UI ---------------------------------------------------------------

@app.get("/")
def index():
    return render_template("index.html")


# ---- shared handler -------------------------------------------------------

def _handle(req):
    """Run the pipeline. Returns (pairs, deck_bytes, deck_name) or raises PipelineError."""
    files = files_from_request(req)
    if not files:
        raise PipelineError("no file", status=400)

    # ponytail: JSON in form field 'options' carries deck_name. Missing -> default.
    deck_name = "Notes2Anki"
    raw = req.form.get("options")
    if raw:
        try:
            opts = json.loads(raw)
            if isinstance(opts, dict) and isinstance(opts.get("deck_name"), str) and opts["deck_name"].strip():
                deck_name = opts["deck_name"].strip()[:80]
        except json.JSONDecodeError as e:
            raise PipelineError(f"Invalid JSON in 'options': {e}") from e

    return run(files, deck_name=deck_name)


def _wants_apkg(req) -> bool:
    # ponytail: explicit ?format=apkg wins; otherwise sniff Accept. Default = JSON.
    fmt = (req.args.get("format") or "").lower()
    if fmt == "apkg":
        return True
    if fmt == "json":
        return False
    accept = (req.headers.get("Accept") or "").lower()
    return "application/octet-stream" in accept and "application/json" not in accept


# ---- error envelopes ------------------------------------------------------

def _err_response(status: int, code: str, message: str) -> Response:
    return Response(
        response=json.dumps({"error": {"code": code, "message": message}}),
        status=status,
        mimetype="application/json",
    )


@app.errorhandler(413)
def _too_large(_e):
    return _err_response(413, "file_too_large", "File terlalu besar (max 10 MB)")


@app.errorhandler(Exception)
def _on_error(e):
    app.logger.error("unhandled: %s\n%s", e, traceback.format_exc())
    if isinstance(e, PipelineError):
        return _err_response(e.status, "pipeline_error", str(e))
    return _err_response(500, "internal_error", f"{type(e).__name__}: {e}")


# ---- routes ---------------------------------------------------------------

@app.post("/upload")
def upload():
    """Web UI: same as /v1/cards?format=apkg. Returns .apkg binary."""
    pairs, deck_bytes, deck_name = _handle(request)
    if deck_bytes is None:
        return _err_response(500, "no_deck", "deck_name missing")
    return Response(
        response=deck_bytes,
        status=200,
        mimetype="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{deck_name}.apkg"',
            "X-Card-Count": str(len(pairs)),
        },
    )


@app.post("/v1/cards")
def v1_cards():
    """JSON API.

    Request (multipart/form-data):
      - image: one or more image files (required)
      - options: JSON string, e.g. {"deck_name": "MyDeck"} (optional)

    Response (default): application/json
      {"deck_name": str, "count": int, "pairs": [{"question": str, "answer": str}, ...]}

    With ?format=apkg or Accept: application/octet-stream: returns the .apkg file
    with X-Card-Count and a JSON sidecar in X-Pairs (base64) so the client can
    log the pairs without a second request.
    """
    pairs, deck_bytes, deck_name = _handle(request)

    if _wants_apkg(request):
        if deck_bytes is None:
            return _err_response(500, "no_deck", "deck_name missing")
        return Response(
            response=deck_bytes,
            status=200,
            mimetype="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{deck_name}.apkg"',
                "X-Card-Count": str(len(pairs)),
            },
        )

    body = {"deck_name": deck_name, "count": len(pairs), "pairs": pairs}
    return Response(
        response=json.dumps(body, ensure_ascii=False),
        status=200,
        mimetype="application/json",
    )


@app.get("/v1/health")
def v1_health():
    return Response(response=json.dumps({"status": "ok"}), mimetype="application/json")


if __name__ == "__main__":
    # ponytail: dev server. Put behind gunicorn when real traffic shows up.
    app.run(host="127.0.0.1", port=5000, debug=False)
