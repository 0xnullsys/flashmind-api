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
           "answer": "Active Recall adalah teknik..."}
        ],
        "count": 1
      }
    """
    combined_text = ""

    if 'note_text' in request.form and request.form['note_text'].strip():
        combined_text += request.form['note_text'] + "\n"

    if 'files' in request.files:
        files = request.files.getlist('files')
        for file in files:
            if file.filename != '':
                file_path = os.path.join(UPLOAD_FOLDER, file.filename)
                file.save(file_path)
                try:
                    extracted_text = extract_text_from_image(file_path)
                    combined_text += extracted_text + "\n"
                except Exception as e:
                    print(f"Error OCR: {str(e)}")
                finally:
                    if os.path.exists(file_path):
                        os.remove(file_path)

    if not combined_text.strip():
        return jsonify({"error": "empty_input"}), 400

    cards = heuristic_qa_extractor(combined_text)
    if not cards:
        return jsonify({"cards": [], "count": 0}), 200

    out = [{"question": q, "answer": a} for q, a in cards]
    return jsonify({"cards": out, "count": len(out)})