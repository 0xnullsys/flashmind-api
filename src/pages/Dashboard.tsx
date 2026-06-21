import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { t } from '../lib/id';
import { useAuth } from '../lib/auth';
import { getFlashcards, deleteFlashcard, FlashCardData } from '../lib/api';
import { ApiError } from '../lib/api';
import Flashcard from '../components/Flashcard';
import FlashcardEditor from '../components/FlashcardEditor';
import AICreate from '../components/AICreate';
import EditCardModal from '../components/EditCardModal';
import AuthDialog from '../components/AuthDialog';

export default function Dashboard() {
  const { user, role, logout } = useAuth();
  const [cards, setCards] = useState<FlashCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [showAI, setShowAI] = useState(false);
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

  // ponytail: deterministic color per category — used by sidebar + chip
  const categoryColor = (cat: string) => {
    let hash = 0;
    for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) | 0;
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 45%)`;
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
          <button
            className="btn btn-secondary"
            onClick={() => (isGuest ? setShowAuth(true) : setShowAI(true))}
          >
            {t('dashboard.aiGen')}
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

      <div className="dashboard-layout">
        {/* Sidebar kategori */}
        <aside className="dashboard-sidebar">
          <h2 className="sidebar-title">Kategori</h2>
          <nav className="category-list">
            <button
              className={`category-nav-item ${activeCategory === null ? 'active' : ''}`}
              onClick={() => setActiveCategory(null)}
            >
              <span className="category-nav-icon">📚</span>
              <span className="category-nav-label">Semua</span>
              <span className="category-nav-count">{total}</span>
            </button>
            {groups.map(([cat, items]) => (
              <button
                key={cat}
                className={`category-nav-item ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
                style={{ ['--cat-color' as any]: categoryColor(cat) }}
              >
                <span
                  className="category-nav-dot"
                  style={{ background: categoryColor(cat) }}
                />
                <span className="category-nav-label">{cat}</span>
                <span className="category-nav-count">{items.length}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main area: kartu dikelompokkan per kategori */}
        <main className="dashboard-main">
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
          ) : activeCategory ? (
            // single category view
            <CategorySection
              name={activeCategory}
              cards={groups.find(([n]) => n === activeCategory)?.[1] || []}
              color={categoryColor(activeCategory)}
              onDelete={handleDelete}
              onEdit={setEditingCard}
            />
          ) : (
            // all categories, grouped
            <>
              {groups.map(([name, items]) => (
                <CategorySection
                  key={name}
                  name={name}
                  cards={items}
                  color={categoryColor(name)}
                  onDelete={handleDelete}
                  onEdit={setEditingCard}
                />
              ))}
            </>
          )}
        </main>
      </div>

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

function CategorySection({
  name,
  cards,
  color,
  onDelete,
  onEdit,
}: {
  name: string;
  cards: FlashCardData[];
  color: string;
  onDelete: (id: string) => void;
  onEdit: (card: FlashCardData) => void;
}) {
  return (
    <section className="category-section" style={{ ['--cat-color' as any]: color }}>
      <header className="category-section-header">
        <span className="category-section-dot" style={{ background: color }} />
        <h2 className="category-section-title">{name}</h2>
        <span className="category-section-count">{cards.length} kartu</span>
      </header>
      <div className="card-grid">
        {cards.map((card) => (
          <Flashcard key={card.id} card={card} onDelete={onDelete} onEdit={onEdit} />
        ))}
      </div>
    </section>
  );
}
