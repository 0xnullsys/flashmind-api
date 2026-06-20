import React, { useState, useRef, useEffect } from 'react';
import { t } from '../lib/id';
import { testAI, createFlashcard, ApiError } from '../lib/api';

interface AICreateProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function AICreate({ isOpen, onClose, onCreated }: AICreateProps) {
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [generatedCards, setGeneratedCards] = useState<Array<{ judul: string; catatan: string }>>([]);
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ponytail: detect camera availability once when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      setCameraAvailable(false);
      return;
    }
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const hasCamera = devices.some((d) => d.kind === 'videoinput');
        setCameraAvailable(hasCamera);
      })
      .catch(() => setCameraAvailable(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const next = [...files];
    const nextPreviews = [...previews];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      next.push(file);
      nextPreviews.push(URL.createObjectURL(file));
    }
    setFiles(next);
    setPreviews(nextPreviews);
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
    if (!notes && files.length === 0) {
      setError(t('error.required'));
      return;
    }

    setError('');
    setLoading(true);
    setGeneratedCards([]);

    try {
      const result = await testAI(notes, files);
      setGeneratedCards(result.cards);
      setSelectedCards(new Set(result.cards.map((_c: { judul: string; catatan: string }, i: number) => i)));
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

  const toggleCard = (index: number) => {
    setSelectedCards((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const cardsToSave = generatedCards.filter((_, i) => selectedCards.has(i));
      for (const card of cardsToSave) {
        await createFlashcard({
          title: card.judul,
          notes: card.catatan,
          source: 'ai',
        });
      }
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // ponytail: guests can't save cards — prompt to register
        setError('Daftar atau masuk untuk menyimpan kartu');
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t('error.serverError'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('dashboard.aiGen')}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="ai-input-section">
          <label>{t('ai.promptLabel')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tempel catatan Anda di sini..."
            rows={6}
          />

          <div className="ai-upload-section">
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
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div className="ai-upload-buttons">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                📎 Unggah gambar
              </button>
              {cameraAvailable === true && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  📷 Ambil foto
                </button>
              )}
              {cameraAvailable === false && (
                <span className="ai-upload-hint">Kamera tidak terdeteksi</span>
              )}
              {cameraAvailable === null && (
                <span className="ai-upload-hint">Mendeteksi kamera…</span>
              )}
            </div>

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

          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? t('ai.loading') : t('ai.generate')}
          </button>
        </div>

        {generatedCards.length > 0 && (
          <div className="ai-results">
            <h3>Hasil ({generatedCards.length} kartu)</h3>
            <div className="ai-card-list">
              {generatedCards.map((card, i) => (
                <div
                  key={i}
                  className={`ai-card-item ${selectedCards.has(i) ? 'selected' : ''}`}
                  onClick={() => toggleCard(i)}
                >
                  <div className="ai-card-check">
                    {selectedCards.has(i) ? '✓' : ''}
                  </div>
                  <div className="ai-card-content">
                    <strong>{card.judul}</strong>
                    <p>{card.catatan}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="form-actions">
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || selectedCards.size === 0}
              >
                {saving ? t('ai.loading') : `Simpan ${selectedCards.size} kartu`}
              </button>
              <button className="btn btn-secondary" onClick={onClose}>
                {t('flashcard.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}