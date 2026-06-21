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
  // ponytail: camera states — 'checking' (probing), 'available' (ready to capture), 'unavailable', 'capturing' (live preview open)
  const [cameraStatus, setCameraStatus] = useState<'checking' | 'available' | 'unavailable' | 'capturing'>('checking');
  const [generatedCards, setGeneratedCards] = useState<Array<{ question: string; answer: string; category?: string }>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);

  // ponytail: auto-detect camera on dialog mount via getUserMedia({video:true}).
  // This is the OS-level probe that triggers the native camera permission prompt.
  // Detection runs once per dialog open; result drives button enabled/disabled.
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
    return () => {
      cancelled = true;
      // ponytail: ensure any live stream is stopped when dialog closes
      stopLiveStream();
    };
  }, [isOpen]);

  const stopLiveStream = () => {
    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach((t) => t.stop());
      liveStreamRef.current = null;
    }
  };

  // ponytail: open live camera preview using WebRTC — works on all platforms
  // (mobile + desktop). User can click "Ambil foto" button to capture a frame.
  const openCameraPreview = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // prefer rear camera on mobile
      });
      liveStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraStatus('capturing');
    } catch (err) {
      console.error('Camera open failed:', err);
      setError('Tidak dapat membuka kamera');
      setCameraStatus('available'); // fall back so user can retry or use upload
    }
  };

  // ponytail: capture current frame from video → canvas → File → add to files list
  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0) {
      setError('Kamera belum siap');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Tidak dapat memproses frame');
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError('Gagal mengambil foto');
        return;
      }
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      // add to files
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
      // close preview
      closeCameraPreview();
    }, 'image/jpeg', 0.92);
  };

  const closeCameraPreview = () => {
    stopLiveStream();
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStatus('available');
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
                  📎 Unggah gambar ({files.length}/{MAX_FILES})
                </button>
                {cameraStatus === 'capturing' ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={captureFrame}
                    >
                      📸 Ambil foto
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={closeCameraPreview}
                    >
                      ✕ Tutup kamera
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={openCameraPreview}
                    disabled={cameraStatus !== 'available'}
                    title={
                      cameraStatus === 'unavailable'
                        ? 'Kamera tidak terdeteksi pada perangkat ini'
                        : cameraStatus === 'checking'
                        ? 'Mendeteksi kamera…'
                        : 'Buka kamera untuk mengambil foto catatan'
                    }
                  >
                    {cameraStatus === 'checking' ? '📷 Memeriksa…' : '📷 Ambil foto'}
                  </button>
                )}
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

              {cameraStatus === 'capturing' && (
                <div className="camera-preview">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="camera-preview-video"
                  />
                </div>
              )}

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
