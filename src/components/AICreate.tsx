import React, { useState } from 'react';
import { t } from '../lib/id';
import { testAI, createFlashcard, ApiError } from '../lib/api';

interface AICreateProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function AICreate({ isOpen, onClose, onCreated }: AICreateProps) {
  const [notes, setNotes] = useState('');
  const [generatedCards, setGeneratedCards] = useState<Array<{ judul: string; catatan: string }>>([]);
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!notes) {
      setError(t('error.required'));
      return;
    }

    setError('');
    setLoading(true);
    setGeneratedCards([]);

    try {
      const result = await testAI(notes);
      setGeneratedCards(result.cards);
      setSelectedCards(new Set(result.cards.map((_, i) => i)));
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
      if (err instanceof ApiError) {
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