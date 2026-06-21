import React, { useState } from 'react';
import { t } from '../lib/id';
import { FlashCardData, markCardStudied } from '../lib/api';

interface FlashcardProps {
  card: FlashCardData;
  onDelete: (id: string) => void;
  onEdit?: (card: FlashCardData) => void;
}

export default function Flashcard({ card, onDelete, onEdit }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);

  // ponytail: on flip, mark as studied (fire-and-forget). Update local state so UI reflects it.
  const handleFlip = () => {
    const next = !flipped;
    setFlipped(next);
    if (next) {
      markCardStudied(card.id).catch((err) => {
        // ponytail: silent fail — don't disrupt UX for a non-critical side-effect
        console.warn('markCardStudied failed:', err);
      });
    }
  };

  return (
    <div
      className={`flashcard ${flipped ? 'flipped' : ''}`}
      onClick={handleFlip}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleFlip();
        }
      }}
    >
      <div className="flashcard-inner">
        <div className="flashcard-front">
          <p className="flashcard-text">{card.title}</p>
          <div className="flashcard-meta">
            {card.category && <span className="card-category-tag">{card.category}</span>}
          </div>
        </div>
        <div className="flashcard-back">
          <p className="flashcard-text">{card.notes}</p>
          {card.attachments && card.attachments.length > 0 && (
            <div className="flashcard-attachments">
              {card.attachments.map((att, i) => (
                <img key={i} src={att} alt={`Lampiran ${i + 1}`} className="flashcard-img" />
              ))}
            </div>
          )}
          {card.category && <span className="card-category-tag flashcard-back-tag">{card.category}</span>}
        </div>
      </div>
      <div className="flashcard-actions">
        {onEdit && (
          <button
            className="flashcard-edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(card);
            }}
            title="Edit kartu"
            aria-label="Edit kartu"
          >
            Edit
          </button>
        )}
        <button
          className="flashcard-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(card.id);
          }}
          title={t('flashcard.delete')}
          aria-label="Hapus kartu"
        >
          Hapus
        </button>
      </div>
    </div>
  );
}