import React, { useState, useRef, useEffect } from 'react';
import { t } from '../lib/id';
import { createFlashcard, testAI, uploadImage, ApiError } from '../lib/api';
import { countChars, checkFrontLimit, checkBackLimit, MAX_FRONT_CHARS, MAX_BACK_CHARS } from '../lib/charLimits';
import CameraCaptureModal from './CameraCaptureModal';

interface FlashcardEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const MAX_FILES = 5;

export default function FlashcardEditor({ isOpen, onClose, onCreated }: FlashcardEditorProps) {
  // ponytail: single input (text + optional images); AI auto-formats Q/A and category
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  // ponytail: camera detection — button enabled/disabled based on availability
  const [cameraStatus, setCameraStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<Array<{ question: string; answer: string; category?: string }>>([]);
  // ponytail: inline edit state — null = view, number = card index being edited
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editError, setEditError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ponytail: auto-detect camera on dialog mount — determines button enabled state.
  // When user clicks the button, we open CameraCaptureModal which manages its own stream.
  useEffect(() => {
    if (!isOpen) return;
    setCameraStatus('checking');
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          if (!cancelled) setCameraStatus('unavailable');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        if (!cancelled) setCameraStatus('available');
      } catch {
        if (!cancelled) setCameraStatus('unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const next = [...files];
    const nextPreviews = [...previews];
    let rejected = 0;
    for (let i = 0; i < list.length; i++) {
      if (next.length >= MAX_FILES) {
        rejected++;
        continue;
      }
      const file = list[i];
      next.push(file);
      nextPreviews.push(URL.createObjectURL(file));
    }
    setFiles(next);
    setPreviews(nextPreviews);
    if (rejected > 0) setError(`Maksimal ${MAX_FILES} gambar — ${rejected} dilewati`);
  };

  const removeFile = (idx: number) => {
    const next = files.slice();
    const nextPreviews = previews.slice();
    URL.revokeObjectURL(nextPreviews[idx]);
    next.splice(idx, 1);
    nextPreviews.splice(idx, 1);
    setFiles(next);
    setPreviews(nextPreviews);
  };

  const handleGenerate = async () => {
    if (!text.trim() && files.length === 0) {
      setError('Tempel catatan atau unggah gambar dulu');
      return;
    }
    setError('');
    setLoading(true);
    setGeneratedCards([]);

    try {
      // upload images to Cloudinary first; backend downloads URLs for HF OCR
      const urls: string[] = [];
      for (const f of files) {
        try {
          const r = await uploadImage(f);
          urls.push(r.url);
        } catch (err) {
          // skip individual upload failure
        }
      }
      const result = await testAI(text, urls);
      const cards = (result.cards || []).map((c: any) => ({
        question: c.judul || c.question || '',
        answer: c.catatan || c.answer || '',
        category: c.category,
      })).filter((c) => c.question && c.answer);
      setGeneratedCards(cards);
      if (cards.length === 0) setError('AI tidak menghasilkan kartu. Coba tambah catatan lebih jelas.');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t('ai.failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    if (generatedCards.length === 0) return;
    // ponytail: cancel any active edit before save
    if (editingIndex !== null) {
      setError('Selesaikan edit kartu terlebih dahulu (simpan atau batal).');
      return;
    }
    // ponytail: reject save if any AI card exceeds word limits
    const overLimit = generatedCards.filter(
      (c) => !checkFrontLimit(c.question).ok || !checkBackLimit(c.answer).ok
    );
    if (overLimit.length > 0) {
      const front = overLimit.filter((c) => !checkFrontLimit(c.question).ok).length;
      const back = overLimit.filter((c) => !checkBackLimit(c.answer).ok).length;
      setError(`${overLimit.length} kartu melebihi batas (${front} depan, ${back} belakang). Klik kartu untuk mengedit. Maks ${MAX_FRONT_CHARS}/${MAX_BACK_CHARS} karakter.`);
      return;
    }
    setError('');
    setLoading(true);
    try {
      for (const card of generatedCards) {
        await createFlashcard({
          title: card.question,
          notes: card.answer,
          category: card.category,
          source: 'ai',
        });
      }
      setText('');
      setFiles([]);
      setPreviews([]);
      setGeneratedCards([]);
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t('error.network'));
      }
    } finally {
      setLoading(false);
    }
  };

  const categoryColor = (cat?: string) => {
    if (!cat) return 'var(--text-dim)';
    // ponytail: deterministic color from category string hash
    let hash = 0;
    for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 45%)`;
  };

  // ponytail: inline edit handlers — edit AI-generated cards before save
  const startEdit = (i: number) => {
    const card = generatedCards[i];
    if (!card) return;
    setEditingIndex(i);
    setEditQuestion(card.question);
    setEditAnswer(card.answer);
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditQuestion('');
    setEditAnswer('');
    setEditError('');
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const frontCheck = checkFrontLimit(editQuestion);
    const backCheck = checkBackLimit(editAnswer);
    if (!frontCheck.ok || !backCheck.ok) {
      setEditError(`Melebihi batas karakter. Maks ${MAX_FRONT_CHARS}/${MAX_BACK_CHARS} karakter.`);
      return;
    }
    if (!editQuestion.trim() || !editAnswer.trim()) {
      setEditError('Pertanyaan dan jawaban tidak boleh kosong.');
      return;
    }
    setGeneratedCards((prev) =>
      prev.map((c, idx) =>
        idx === editingIndex
          ? { ...c, question: editQuestion.trim(), answer: editAnswer.trim() }
          : c
      )
    );
    cancelEdit();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('dashboard.newManual')}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {generatedCards.length === 0 ? (
          <>
            <p className="form-hint">
              Tempel catatan atau unggah foto catatan. AI akan otomatis memformat
              pertanyaan (depan) dan jawaban (belakang), lalu mengelompokkannya per kategori.
            </p>

            <div className="form-field">
              <label>Catatan Anda</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="mis. Mitosis adalah proses pembelahan sel yang menghasilkan dua sel anak identik. Fotosintesis mengubah cahaya matahari menjadi energi kimia."
                rows={6}
              />
            </div>

            <div className="form-field">
              <label>Lampiran Gambar (maks {MAX_FILES}, opsional)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <div className="ai-upload-buttons">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Unggah gambar ({files.length}/{MAX_FILES})
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => cameraStatus === 'available' && setShowCameraModal(true)}
                  disabled={cameraStatus !== 'available'}
                  title={
                    cameraStatus === 'unavailable'
                      ? 'Kamera tidak terdeteksi pada perangkat ini'
                      : cameraStatus === 'checking'
                      ? 'Mendeteksi kamera…'
                      : 'Buka kamera untuk mengambil foto catatan'
                  }
                >
                  {cameraStatus === 'checking' ? 'Memeriksa kamera…' : 'Ambil foto'}
                </button>
                {cameraStatus === 'unavailable' && (
                  <span className="ai-upload-hint">Kamera tidak terdeteksi pada perangkat ini</span>
                )}
                {cameraStatus === 'available' && (
                  <span className="ai-upload-hint">Kamera siap — klik Ambil foto untuk membuka kamera</span>
                )}
                {cameraStatus === 'checking' && (
                  <span className="ai-upload-hint">Meminta izin kamera…</span>
                )}
              </div>

              {previews.length > 0 && (
                <div className="attachment-previews">
                  {previews.map((src, idx) => (
                    <div key={idx} className="attachment-preview">
                      <img src={src} alt={`Lampiran ${idx + 1}`} />
                      <button type="button" onClick={() => removeFile(idx)}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <p className="form-hint">
                Tips: OCR membaca tulisan tangan dengan akurasi terbatas. Untuk hasil terbaik
                gunakan foto catatan yang jelas dan terang.
              </p>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? t('ai.loading') : 'Hasilkan Kartu'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Batal
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="form-hint">
              {generatedCards.length} kartu dihasilkan. Pilih untuk menyimpan atau
              buat ulang dengan catatan berbeda.
            </p>

            <div className="ai-card-list">
              {generatedCards.map((card, i) => {
                const isEditing = editingIndex === i;
                const viewFrontCheck = checkFrontLimit(card.question);
                const viewBackCheck = checkBackLimit(card.answer);
                const viewOverLimit = !viewFrontCheck.ok || !viewBackCheck.ok;
                const editFrontCheck = checkFrontLimit(editQuestion);
                const editBackCheck = checkBackLimit(editAnswer);
                return (
                <div key={i} className={`ai-card-item selected ${viewOverLimit && !isEditing ? 'over-limit' : ''}`}>
                  <div className="ai-card-content">
                    {isEditing ? (
                      <>
                        <div className="ai-card-question">
                          <span className="ai-card-label">Depan (edit)</span>
                          <textarea
                            value={editQuestion}
                            onChange={(e) => setEditQuestion(e.target.value)}
                            rows={2}
                            className="ai-card-edit-textarea"
                            autoFocus
                          />
                          <span className={`word-counter ${!editFrontCheck.ok ? 'word-counter-over' : ''}`}>
                            {editFrontCheck.count}/{editFrontCheck.max} karakter
                          </span>
                        </div>
                        <div className="ai-card-answer">
                          <span className="ai-card-label">Belakang (edit)</span>
                          <textarea
                            value={editAnswer}
                            onChange={(e) => setEditAnswer(e.target.value)}
                            rows={4}
                            className="ai-card-edit-textarea"
                          />
                          <span className={`word-counter ${!editBackCheck.ok ? 'word-counter-over' : ''}`}>
                            {editBackCheck.count}/{editBackCheck.max} karakter
                          </span>
                        </div>
                        {editError && <div className="form-error">{editError}</div>}
                        <div className="ai-card-edit-actions">
                          <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit}>
                            Simpan
                          </button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEdit}>
                            Batal
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="ai-card-question">
                          <span className="ai-card-label">Depan</span>
                          <p>{card.question}</p>
                          <span className={`word-counter ${!viewFrontCheck.ok ? 'word-counter-over' : ''}`}>
                            {viewFrontCheck.count}/{viewFrontCheck.max} karakter
                          </span>
                        </div>
                        <div className="ai-card-answer">
                          <span className="ai-card-label">Belakang</span>
                          <p>{card.answer}</p>
                          <span className={`word-counter ${!viewBackCheck.ok ? 'word-counter-over' : ''}`}>
                            {viewBackCheck.count}/{viewBackCheck.max} karakter
                          </span>
                        </div>
                        {card.category && (
                          <span
                            className="card-category-tag"
                            style={{ background: `color-mix(in srgb, ${categoryColor(card.category)} 20%, transparent)`, color: categoryColor(card.category), borderColor: `color-mix(in srgb, ${categoryColor(card.category)} 50%, transparent)` }}
                          >
                            {card.category}
                          </span>
                        )}
                        {viewOverLimit && (
                          <div className="word-limit-warning">
                            Melebihi batas karakter — klik Edit untuk memperpendek
                          </div>
                        )}
                        <div className="ai-card-edit-actions">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEdit(i)}>
                            Edit
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveAll}
                disabled={loading}
              >
                {loading ? t('ai.loading') : `Simpan ${generatedCards.length} Kartu`}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setGeneratedCards([])}
                disabled={loading}
              >
                ← Kembali
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                Batal
              </button>
            </div>
          </>
        )}
      </div>

      {/* ponytail: full-size camera capture modal — opens when user clicks "Ambil foto" */}
      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={(file) => {
          const next = [...files];
          const nextPreviews = [...previews];
          if (next.length < MAX_FILES) {
            next.push(file);
            nextPreviews.push(URL.createObjectURL(file));
            setFiles(next);
            setPreviews(nextPreviews);
          } else {
            setError(`Maksimal ${MAX_FILES} gambar`);
          }
        }}
      />
    </div>
  );
}
