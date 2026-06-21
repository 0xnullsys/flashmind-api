import React, { useState, useRef, useEffect } from 'react';
import { t } from '../lib/id';
import { createFlashcard, testAI, uploadImage, ApiError } from '../lib/api';
import { countChars, checkFrontLimit, checkBackLimit, MAX_FRONT_CHARS, MAX_BACK_CHARS } from '../lib/charLimits';

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
  // ponytail: camera states — null (unchecked), 'checking', true (available), false (no camera)
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [generatedCards, setGeneratedCards] = useState<Array<{ question: string; answer: string; category?: string }>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ponytail: reset camera state when dialog opens
  useEffect(() => {
    if (isOpen) setCameraStatus('idle');
  }, [isOpen]);

  // ponytail: trigger camera detection when user clicks "Ambil foto" first time.
  // Detection uses getUserMedia({video:true}) to actually request OS-level camera
  // permission — this is what triggers the native "Allow camera?" prompt.
  // We immediately stop the stream after detection to free the camera.
  const detectCamera = async () => {
    setCameraStatus('checking');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('unavailable');
        return;
      }
      // ponytail: probe by requesting a short-lived stream
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setCameraStatus('available');
    } catch {
      setCameraStatus('unavailable');
    }
  };

  const handleCameraClick = () => {
    // ponytail: only open picker after camera confirmed available
    if (cameraStatus === 'available') {
      cameraInputRef.current?.click();
    } else if (cameraStatus === 'idle' || cameraStatus === 'checking') {
      detectCamera();
    }
    // unavailable: button is disabled, click is a no-op
  };

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
    // ponytail: reject save if any AI card exceeds word limits
    const overLimit = generatedCards.filter(
      (c) => !checkFrontLimit(c.question).ok || !checkBackLimit(c.answer).ok
    );
    if (overLimit.length > 0) {
      const front = overLimit.filter((c) => !checkFrontLimit(c.question).ok).length;
      const back = overLimit.filter((c) => !checkBackLimit(c.answer).ok).length;
      setError(`${overLimit.length} kartu melebihi batas (${front} depan, ${back} belakang). Maks ${MAX_FRONT_CHARS}/${MAX_BACK_CHARS} karakter.`);
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Buat Kartu dengan AI</h2>
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
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
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
                  📎 Unggah gambar ({files.length}/{MAX_FILES})
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCameraClick}
                  disabled={cameraStatus === 'unavailable'}
                  title={
                    cameraStatus === 'unavailable'
                      ? 'Kamera tidak terdeteksi pada perangkat ini'
                      : cameraStatus === 'checking'
                      ? 'Mendeteksi kamera…'
                      : cameraStatus === 'available'
                      ? 'Buka kamera untuk mengambil foto catatan'
                      : 'Klik untuk mendeteksi kamera'
                  }
                >
                  {cameraStatus === 'checking' ? '📷 Memeriksa…' : '📷 Ambil foto'}
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
                {loading ? t('ai.loading') : '✨ Hasilkan Kartu'}
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
                const frontCheck = checkFrontLimit(card.question);
                const backCheck = checkBackLimit(card.answer);
                const overLimit = !frontCheck.ok || !backCheck.ok;
                return (
                <div key={i} className={`ai-card-item selected ${overLimit ? 'over-limit' : ''}`}>
                  <div className="ai-card-content">
                    <div className="ai-card-question">
                      <span className="ai-card-label">Depan</span>
                      <p>{card.question}</p>
                      <span className={`word-counter ${!frontCheck.ok ? 'word-counter-over' : ''}`}>
                        {frontCheck.count}/{frontCheck.max} karakter
                      </span>
                    </div>
                    <div className="ai-card-answer">
                      <span className="ai-card-label">Belakang</span>
                      <p>{card.answer}</p>
                      <span className={`word-counter ${!backCheck.ok ? 'word-counter-over' : ''}`}>
                        {backCheck.count}/{backCheck.max} karakter
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
                    {overLimit && (
                      <div className="word-limit-warning">
                        ⚠️ Melebihi batas karakter — tidak bisa disimpan sampai dipendekkan
                      </div>
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
                {loading ? t('ai.loading') : `💾 Simpan ${generatedCards.length} Kartu`}
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
    </div>
  );
}
