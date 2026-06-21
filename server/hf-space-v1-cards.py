# FlashMind HF Space — /v1/cards handler
# Drop-in replacement: replace your existing `v1_cards_json` with this.
# Requires `qa.py` from notes2anki/ in same dir (it does).

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
    from qa import generate as qa_generate  # ponytail: lazy import so existing app.py keeps working

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
                    extracted_text = extract_text_from_image(file_path)
                    if extracted_text:
                        combined_text += extracted_text + "\n"
                except Exception as e:
                    print(f"Error OCR: {str(e)}")
                finally:
                    if os.path.exists(file_path):
                        os.remove(file_path)

    if not combined_text.strip():
        return jsonify({"error": "empty_input"}), 400

    # ponytail: use proper heuristic that returns real Q/A from text,
    # not hardcoded "front"/"back"
    pairs = qa_generate(combined_text)
    cards = [{"question": p["question"], "answer": p["answer"]} for p in pairs]

    return jsonify({"cards": cards, "count": len(cards)})
