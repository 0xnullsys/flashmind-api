import React, { useState } from 'react';
import { t } from '../lib/id';
import { FlashCardData } from '../lib/api';

interface FlashcardProps {
  card: FlashCardData;
  onDelete: (id: string) => void;
}

export default function Flashcard({ card, onDelete }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className={`flashcard ${flipped ? 'flipped' : ''}`}
      onClick={() => setFlipped(!flipped)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setFlipped(!flipped);
        }
      }}
    >
      <div className="flashcard-inner">
        <div className="flashcard-front">
          <h3>{card.title}</h3>
          <div className="flashcard-meta">
            {card.category && <span className="card-category-tag">{card.category}</span>}
            <span className="flashcard-source">{card.source === 'ai' ? 'AI' : 'Manual'}</span>
          </div>
        </div>
        <div className="flashcard-back">
          <p>{card.notes}</p>
          {card.attachments && card.attachments.length > 0 && (
            <div className="flashcard-attachments">
              {card.attachments.map((att, i) => (
                <img key={i} src={att} alt={`Lampiran ${i + 1}`} className="flashcard-img" />
              ))}
            </div>
          )}
        </div>
      </div>
      <button
        className="flashcard-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(card.id);
        }}
        title={t('flashcard.delete')}
      >
        🗑
      </button>
    </div>
  );
}