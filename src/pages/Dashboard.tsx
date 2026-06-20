import React, { useState, useEffect, useCallback } from 'react';
import { t } from '../lib/id';
import { useAuth } from '../lib/auth';
import { getFlashcards, deleteFlashcard, FlashCardData } from '../lib/api';
import { ApiError } from '../lib/api';
import Flashcard from '../components/Flashcard';
import FlashcardEditor from '../components/FlashcardEditor';
import AICreate from '../components/AICreate';

export default function Dashboard() {
  const { user, role, logout } = useAuth();
  const [cards, setCards] = useState<FlashCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [error, setError] = useState('');

  const loadCards = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getFlashcards();
      setCards(data.cards);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t('error.serverError'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role === 'user') {
      loadCards();
    }
  }, [role, loadCards]);

  const handleDelete = async (id: string) => {
    try {
      await deleteFlashcard(id);
      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <h1>{t('dashboard.title')}</h1>
          {user && (
            <span className="dashboard-user">
              {user.firstName} {user.lastName}
            </span>
          )}
        </div>
        <div className="dashboard-header-right">
          <button className="btn btn-primary" onClick={() => setShowEditor(true)}>
            {t('dashboard.newManual')}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowAI(true)}>
            {t('dashboard.aiGen')}
          </button>
          <button className="btn btn-outline" onClick={handleLogout}>
            Keluar
          </button>
        </div>
      </header>

      {error && <div className="dashboard-error">{error}</div>}

      <main className="dashboard-cards">
        {loading ? (
          <div className="dashboard-loading">{t('ai.loading')}</div>
        ) : cards.length === 0 ? (
          <div className="dashboard-empty">{t('dashboard.empty')}</div>
        ) : (
          <div className="card-grid">
            {cards.map((card) => (
              <Flashcard key={card.id} card={card} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>

      <FlashcardEditor
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        onCreated={loadCards}
      />

      <AICreate
        isOpen={showAI}
        onClose={() => setShowAI(false)}
        onCreated={loadCards}
      />
    </div>
  );
}