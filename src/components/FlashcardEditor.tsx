import React, { useState } from 'react';
import { t } from '../lib/id';
import { createFlashcard } from '../lib/api';
import { ApiError } from '../lib/api';

interface FlashcardEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function FlashcardEditor({ isOpen, onClose, onCreated }: FlashcardEditorProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: string[] = [];
    for (let i = 0; i < files.length; i++) {
      if (attachments.length + newAttachments.length >= 5) {
        setError('Maksimal 5 lampiran');
        break;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          newAttachments.push(evt.target.result as string);
          if (newAttachments.length === files.length || attachments.length + newAttachments.length >= 5) {
            setAttachments((prev) => [...prev, ...newAttachments].slice(0, 5));
          }
        }
      };
      reader.readAsDataURL(files[i]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!title || !notes) {
        setError(t('error.required'));
        setLoading(false);
        return;
      }

      await createFlashcard({ title, notes, attachments, source: 'manual' });
      setTitle('');
      setNotes('');
      setAttachments([]);
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
            <label>Lampiran Gambar (maks 5)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
            />
            {attachments.length > 0 && (
              <div className="attachment-previews">
                {attachments.map((att, i) => (
                  <div key={i} className="attachment-preview">
                    <img src={att} alt={`Lampiran ${i + 1}`} />
                    <button type="button" onClick={() => removeAttachment(i)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
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