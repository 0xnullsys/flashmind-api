import React, { useState, useRef, useEffect } from 'react';
import { t } from '../lib/id';
import { createFlashcard, testAI, ApiError } from '../lib/api';

interface FlashcardEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const MAX_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = /^image\/(png|jpe?g|webp|gif)$/;

export default function FlashcardEditor({ isOpen, onClose, onCreated }: FlashcardEditorProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ponytail: detect camera once when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      setCameraAvailable(false);
      return;
    }
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => setCameraAvailable(devices.some((d) => d.kind === 'videoinput')))
      .catch(() => setCameraAvailable(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const next = [...files];
    const nextPreviews = [...previews];
    const nextAttachments = [...attachments];
    for (let i = 0; i < list.length; i++) {
      if (next.length >= MAX_FILES) break;
      const file = list[i];
      if (!ALLOWED_TYPES.test(file.type)) continue;
      if (file.size > MAX_FILE_BYTES) continue;
      next.push(file);
      nextPreviews.push(URL.createObjectURL(file));
    }
    setFiles(next);
    setPreviews(nextPreviews);
    // keep attachments in sync for base64 (created lazily on save)
    void nextAttachments;
  };

  const removeFile = (idx: number) => {
    const next = files.slice();
    const nextPreviews = previews.slice();
    URL.revokeObjectURL(nextPreviews[idx]);
    next.splice(idx, 1);
    nextPreviews.splice(idx, 1);
    setFiles(next);
    setPreviews(nextPreviews);
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // ponytail: AI auto-fill title+notes from image(s); categories pulled from HF response when present
  const handleAiFromImages = async () => {
    if (files.length === 0) {
      setError('Unggah atau ambil foto catatan dulu');
      return;
    }
    setError('');
    setAiLoading(true);
    try {
      const result = await testAI('', files);
      if (result.cards && result.cards.length > 0) {
        // ponytail: take first card as title+notes, ignore the rest (user can use AI dialog for batch)
        setTitle(result.cards[0].judul);
        setNotes(result.cards[0].catatan);
        if ((result.cards[0] as any).category) {
          setCategory((result.cards[0] as any).category);
        }
      } else {
        setError('AI tidak menghasilkan kartu dari gambar');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t('ai.failed'));
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // ponytail: if images uploaded but no text, auto-generate via AI first
    let finalTitle = title;
    let finalNotes = notes;
    let finalCategory = category;
    if (files.length > 0 && (!finalTitle || !finalNotes)) {
      try {
        setAiLoading(true);
        const result = await testAI('', files);
        if (result.cards && result.cards.length > 0) {
          finalTitle = finalTitle || result.cards[0].judul;
          finalNotes = finalNotes || result.cards[0].catatan;
          if (!finalCategory && (result.cards[0] as any).category) {
            finalCategory = (result.cards[0] as any).category;
          }
        }
      } catch (err) {
        // fall through to validation below
      } finally {
        setAiLoading(false);
      }
    }

    if (!finalTitle || !finalNotes) {
      setError(t('error.required'));
      return;
    }

    setLoading(true);
    try {
      // ponytail: convert files to base64 attachments on save (lazy OCR already done above)
      const atts: string[] = [];
      for (const f of files) {
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(f);
        });
        atts.push(b64);
      }
      await createFlashcard({
        title: finalTitle,
        notes: finalNotes,
        category: finalCategory || undefined,
        attachments: atts,
        source: 'manual',
      });
      setTitle('');
      setNotes('');
      setCategory('');
      setAttachments([]);
      setFiles([]);
      setPreviews((prev) => {
        prev.forEach(URL.revokeObjectURL);
        return [];
      });
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('dashboard.newManual')}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-field">
            <label>{t('flashcard.front')}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('flashcard.front')}
            />
          </div>

          <div className="form-field">
            <label>{t('flashcard.back')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('flashcard.back')}
              rows={5}
            />
          </div>

          <div className="form-field">
            <label>Kategori (opsional)</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="mis. Biologi, Matematika, Bahasa Inggris"
              list="kategori-saran"
            />
            <datalist id="kategori-saran">
              <option value="Biologi" />
              <option value="Fisika" />
              <option value="Kimia" />
              <option value="Matematika" />
              <option value="Bahasa Inggris" />
              <option value="Bahasa Indonesia" />
              <option value="Sejarah" />
              <option value="Geografi" />
              <option value="Ekonomi" />
              <option value="Pemrograman" />
            </datalist>
          </div>

          <div className="form-field">
            <label>Lampiran Gambar (maks {MAX_FILES}, opsional — akan di-OCR otomatis)</label>
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
                onClick={() => cameraInputRef.current?.click()}
                disabled={cameraAvailable === false}
                title={
                  cameraAvailable === false
                    ? 'Kamera tidak terdeteksi pada perangkat ini'
                    : 'Buka kamera perangkat untuk mengambil foto catatan'
                }
              >
                {cameraAvailable === null ? '📷 Kamera…' : '📷 Ambil foto'}
              </button>
            </div>
            {cameraAvailable === false && (
              <div className="ai-upload-hint">Kamera tidak terdeteksi pada perangkat ini</div>
            )}

            {previews.length > 0 && (
              <div className="attachment-previews">
                {previews.map((src, idx) => (
                  <div key={idx} className="attachment-preview">
                    <img src={src} alt={`Lampiran ${idx + 1}`} />
                    <button type="button" onClick={() => removeFile(idx)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAiFromImages}
              disabled={aiLoading || files.length === 0}
              title="Otomatis isi judul dan catatan dari gambar yang diunggah"
            >
              {aiLoading ? t('ai.loading') : '✨ Hasilkan dari gambar'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || aiLoading}>
              {loading ? t('ai.loading') : t('flashcard.save')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('flashcard.close')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
