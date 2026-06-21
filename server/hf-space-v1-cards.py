# FlashMind HF Space — /v1/cards handler
# Drop-in replacement: replace your existing `v1_cards_json` with this.
# Requires `qa_heuristic.py` and `ocr_router.py` from this repo in same dir.

@app.post("/v1/cards")
def v1_cards_json():
    """JSON API untuk backend Node di Vercel.

    Request (multipart/form-data):
      - note_text: string (required)
      - files: file[] (optional, untuk OCR gambar)

    Response (application/json):
      {
        "cards": [
          {"question": "Apa definisi Active Recall?",
           "answer": "Active Recall adalah..."}
        ],
        "count": 1
      }
    """
    from qa_heuristic import generate as qa_generate  # ponytail: pattern-based Q/A (no LLM)
    from ocr_router import extract_text  # ponytail: dynamic OCR (EasyOCR or TrOCR)

    combined_text = ""

    if 'note_text' in request.form and request.form['note_text'].strip():
        combined_text += request.form['note_text'].strip() + "\n"

    if 'files' in request.files:
        files = request.files.getlist('files')
        for file in files:
            if file.filename != '':
                file_path = os.path.join(UPLOAD_FOLDER, file.filename)
                file.save(file_path)
                try:
                    extracted_text = extract_text(file_path)
                    if extracted_text:
                        combined_text += extracted_text + "\n"
                except Exception as e:
                    print(f"Error OCR: {str(e)}")
                finally:
                    if os.path.exists(file_path):
                        os.remove(file_path)

    if not combined_text.strip():
        return jsonify({"error": "empty_input"}), 400

    # ponytail: qa_heuristic returns {front, back} dicts; map to {question, answer}
    pairs = qa_generate(combined_text)
    cards = [{"question": p["front"], "answer": p["back"]} for p in pairs]

    return jsonify({"cards": cards, "count": len(cards)})
