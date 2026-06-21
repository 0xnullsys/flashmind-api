import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { t } from '../lib/id';
import { useAuth } from '../lib/auth';
import { getFlashcards, deleteFlashcard, FlashCardData } from '../lib/api';
import { ApiError } from '../lib/api';
import Flashcard from '../components/Flashcard';
import FlashcardEditor from '../components/FlashcardEditor';
import EditCardModal from '../components/EditCardModal';
import AuthDialog from '../components/AuthDialog';
import KategoriBar from '../components/KategoriBar';
import { timeAgo } from '../lib/timeAgo';

export default function Dashboard() {
  const { user, role, logout } = useAuth();
  const [cards, setCards] = useState<FlashCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [editingCard, setEditingCard] = useState<FlashCardData | null>(null);
  const [error, setError] = useState('');
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

  // ponytail: group cards by category once, derive counts in same pass
  const { groups, total } = useMemo(() => {
    const map = new Map<string, FlashCardData[]>();
    const noCat: FlashCardData[] = [];
    for (const c of cards) {
      if (c.category) {
        if (!map.has(c.category)) map.set(c.category, []);
        map.get(c.category)!.push(c);
      } else {
        noCat.push(c);
      }
    }
    if (noCat.length > 0) map.set('Tanpa Kategori', noCat);
    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, 'id'));
    return { groups: sorted, total: cards.length };
  }, [cards]);

  // ponytail: deterministic color per category
  const categoryColor = (cat: string) => {
    let hash = 0;
    for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 45%)`;
  };

  // ponytail: build list for KategoriBar
  const kategoriOptions = useMemo(() => {
    return groups.map(([name, items]) => ({
      name,
      count: items.length,
      color: categoryColor(name),
    }));
  }, [groups]);

  // ponytail: filter cards by active category, already sorted by last_studied ASC
  const visibleCards = useMemo(() => {
    if (activeCategory === null) return cards;
    return cards.filter((c) => (c.category || 'Tanpa Kategori') === activeCategory);
  }, [cards, activeCategory]);

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
          <button
            className="btn btn-primary"
            onClick={() => (isGuest ? setShowAuth(true) : setShowEditor(true))}
          >
            {t('dashboard.newManual')}
          </button>
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

      {/* ponytail: kategori bar (top, NOT sticky) */}
      {!isGuest && cards.length > 0 && (
        <KategoriBar
          categories={kategoriOptions}
          activeCategory={activeCategory}
          totalCount={total}
          onChange={setActiveCategory}
        />
      )}

      <main className="dashboard-timeline">
        {loading ? (
          <div className="dashboard-loading">{t('ai.loading')}</div>
        ) : isGuest ? (
          <div className="dashboard-empty">{t('dashboard.guestEmpty')}</div>
        ) : cards.length === 0 ? (
          <div className="dashboard-empty">
            <p>{t('dashboard.empty')}</p>
            <button
              className="btn btn-primary"
              onClick={() => setShowEditor(true)}
            >
              {t('dashboard.newManual')}
            </button>
          </div>
        ) : (
          <div className="timeline-list">
            {visibleCards.map((card) => (
              <article key={card.id} className="timeline-item">
                <div className="timeline-meta">
                  <span className="timeline-category-tag" style={{ background: categoryColor(card.category || 'Tanpa Kategori') }}>
                    {card.category || 'Tanpa Kategori'}
                  </span>
                  <span className="timeline-time">{timeAgo(card.lastStudiedAt)}</span>
                </div>
                <Flashcard card={card} onDelete={handleDelete} onEdit={setEditingCard} />
              </article>
            ))}
          </div>
        )}
      </main>

      <FlashcardEditor
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        onCreated={loadCards}
      />

      <EditCardModal
        card={editingCard}
        onClose={() => setEditingCard(null)}
        onUpdated={loadCards}
      />

      <AuthDialog
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
      />
    </div>
  );
}
