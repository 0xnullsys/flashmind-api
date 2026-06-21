import React, { useState, useEffect } from 'react';
import { t } from '../lib/id';
import { updateFlashcard, ApiError, FlashCardData } from '../lib/api';
import { checkFrontLimit, checkBackLimit, MAX_FRONT_CHARS, MAX_BACK_CHARS } from '../lib/charLimits';

interface EditCardModalProps {
  card: FlashCardData | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditCardModal({ card, onClose, onUpdated }: EditCardModalProps) {
  // ponytail: useEffect syncs local state when card prop changes (parent sets null→card)
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('');
  useEffect(() => {
    if (card) {
      setTitle(card.title || '');
      setNotes(card.notes || '');
      setCategory(card.category || '');
    }
  }, [card?.id]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!card) return null;

  const frontCheck = checkFrontLimit(title);
  const backCheck = checkBackLimit(notes);
  const overLimit = !frontCheck.ok || !backCheck.ok;

  const handleSave = async () => {
    setError('');
    if (overLimit) {
      setError(`Melebihi batas karakter. Maks ${MAX_FRONT_CHARS}/${MAX_BACK_CHARS} karakter.`);
      return;
    }
    setLoading(true);
    try {
      await updateFlashcard(card.id, {
        title,
        notes,
        category: category.trim() || null,
      });
      onUpdated();
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
          <h2>Edit Kartu</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="form-field">
            <label>
              Depan (pertanyaan)
              <span className={`word-counter ${!frontCheck.ok ? 'word-counter-over' : ''}`}>
                {frontCheck.count}/{frontCheck.max}
              </span>
            </label>
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Pertanyaan untuk kartu depan"
              rows={3}
            />
          </div>

          <div className="form-field">
            <label>
              Belakang (jawaban)
              <span className={`word-counter ${!backCheck.ok ? 'word-counter-over' : ''}`}>
                {backCheck.count}/{backCheck.max}
              </span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jawaban / catatan untuk kartu belakang"
              rows={5}
            />
          </div>

          <div className="form-field">
            <label>Kategori (opsional)</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="mis. Biologi, Matematika"
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

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading || overLimit}>
              {loading ? t('ai.loading') : 'Simpan'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
