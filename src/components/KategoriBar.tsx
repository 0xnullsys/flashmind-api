/**
 * KategoriBar — top-of-dashboard category switcher.
 * - Search filter
 * - Toggle pills (limit based on viewport)
 * - < > overflow buttons if more than limit
 * - No sticky positioning (per design)
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';

interface KategoriBarProps {
  categories: Array<{ name: string; count: number; color: string }>;
  activeCategory: string | null;
  totalCount: number;
  onChange: (cat: string | null) => void;
}

export default function KategoriBar({
  categories,
  activeCategory,
  totalCount,
  onChange,
}: KategoriBarProps) {
  const [search, setSearch] = useState('');
  const [pageStart, setPageStart] = useState(0);
  const [limit, setLimit] = useState(5);
  const containerRef = useRef<HTMLDivElement>(null);

  // ponytail: responsive limit — 4K TV gets more chips than smartphone
  useEffect(() => {
    const updateLimit = () => {
      const w = window.innerWidth;
      if (w >= 1920) setLimit(10);
      else if (w >= 1024) setLimit(7);
      else if (w >= 640) setLimit(5);
      else setLimit(3);
      setPageStart(0);
    };
    updateLimit();
    window.addEventListener('resize', updateLimit);
    return () => window.removeEventListener('resize', updateLimit);
  }, []);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search) return categories;
    const q = search.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, search]);

  // Slice to current page window
  const visible = useMemo(() => {
    const start = Math.min(pageStart, Math.max(0, filtered.length - limit));
    return filtered.slice(start, start + limit);
  }, [filtered, pageStart, limit]);

  const canPrev = pageStart > 0;
  const canNext = pageStart + limit < filtered.length;

  return (
    <div className="kategori-bar" ref={containerRef}>
      <div className="kategori-bar-row">
        <input
          type="text"
          className="kategori-search"
          placeholder="Cari kategori..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPageStart(0);
          }}
          aria-label="Cari kategori"
        />
        <div className="kategori-toggle-group">
          {canPrev && (
            <button
              type="button"
              className="kategori-nav-btn"
              onClick={() => setPageStart((p) => Math.max(0, p - limit))}
              aria-label="Sebelumnya"
            >
              {'<'}
            </button>
          )}
          <button
            type="button"
            className={`kategori-pill ${activeCategory === null ? 'active' : ''}`}
            onClick={() => onChange(null)}
          >
            <span className="kategori-pill-label">Semua</span>
            <span className="kategori-pill-count">{totalCount}</span>
          </button>
          {visible.map((c) => (
            <button
              key={c.name}
              type="button"
              className={`kategori-pill ${activeCategory === c.name ? 'active' : ''}`}
              onClick={() => onChange(c.name)}
              style={{ ['--cat-color' as any]: c.color }}
            >
              <span
                className="kategori-pill-dot"
                style={{ background: c.color }}
              />
              <span className="kategori-pill-label">{c.name}</span>
              <span className="kategori-pill-count">{c.count}</span>
            </button>
          ))}
          {canNext && (
            <button
              type="button"
              className="kategori-nav-btn"
              onClick={() => setPageStart((p) => p + limit)}
              aria-label="Selanjutnya"
            >
              {'>'}
            </button>
          )}
        </div>
        {filtered.length > limit && (
          <span className="kategori-pager-info">
            {pageStart + 1}-{Math.min(pageStart + limit, filtered.length)} dari {filtered.length}
          </span>
        )}
      </div>
    </div>
  );
}
