import React, { useState, useEffect, useCallback } from 'react';
import { t } from '../lib/id';
import { useAuth } from '../lib/auth';
import { getFlashcards, deleteFlashcard, FlashCardData } from '../lib/api';
import { ApiError } from '../lib/api';
import Flashcard from '../components/Flashcard';
import FlashcardEditor from '../components/FlashcardEditor';
import AICreate from '../components/AICreate';
import AuthDialog from '../components/AuthDialog';

export default function Dashboard() {
  const { user, role, logout } = useAuth();
  const [cards, setCards] = useState<FlashCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [error, setError] = useState('');
  // ponytail: client-side category filter (no extra backend query)
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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
    } else if (role === 'guest') {
      // ponytail: guests have no cards to load — show empty state immediately
      setLoading(false);
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

  const isGuest = role === 'guest';

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
          {isGuest && (
            <span className="dashboard-user dashboard-guest-badge">
              {t('dashboard.guestBadge')}
            </span>
          )}
        </div>
        <div className="dashboard-header-right">
          {isGuest && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => setShowAuth(true)}
              >
                {t('dashboard.newManual')}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowAI(true)}
              >
                {t('dashboard.aiGen')}
              </button>
            </>
          )}
          {!isGuest && (
            <>
              <button className="btn btn-primary" onClick={() => setShowEditor(true)}>
                {t('dashboard.newManual')}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowAI(true)}>
                {t('dashboard.aiGen')}
              </button>
            </>
          )}
          <button className="btn btn-outline" onClick={handleLogout}>
            Keluar
          </button>
        </div>
      </header>

      {error && <div className="dashboard-error">{error}</div>}

      {isGuest && (
        <div className="dashboard-guest-banner">
          <p>{t('dashboard.guestBanner')}</p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowAuth(true)}
          >
            {t('dashboard.guestCta')}
          </button>
        </div>
      )}

      <main className="dashboard-cards">
        {loading ? (
          <div className="dashboard-loading">{t('ai.loading')}</div>
        ) : isGuest ? (
          <div className="dashboard-empty">{t('dashboard.guestEmpty')}</div>
        ) : cards.length === 0 ? (
          <div className="dashboard-empty">{t('dashboard.empty')}</div>
        ) : (
          <>
            {(() => {
              // ponytail: derive category list + filtered cards in one pass
              const categories = Array.from(
                new Set(cards.map((c) => c.category).filter((c): c is string => !!c))
              ).sort();
              const filtered = activeCategory
                ? cards.filter((c) => c.category === activeCategory)
                : cards;
              return (
                <>
                  {categories.length > 0 && (
                    <div className="category-filter">
                      <button
                        className={`category-chip ${activeCategory === null ? 'active' : ''}`}
                        onClick={() => setActiveCategory(null)}
                      >
                        Semua ({cards.length})
                      </button>
                      {categories.map((cat) => {
                        const count = cards.filter((c) => c.category === cat).length;
                        return (
                          <button
                            key={cat}
                            className={`category-chip ${activeCategory === cat ? 'active' : ''}`}
                            onClick={() => setActiveCategory(cat)}
                          >
                            {cat} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="card-grid">
                    {filtered.length === 0 ? (
                      <div className="dashboard-empty">Tidak ada kartu dalam kategori ini</div>
                    ) : (
                      filtered.map((card) => (
                        <Flashcard key={card.id} card={card} onDelete={handleDelete} />
                      ))
                    )}
                  </div>
                </>
              );
            })()}
          </>
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

      <AuthDialog
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
      />
    </div>
  );
}