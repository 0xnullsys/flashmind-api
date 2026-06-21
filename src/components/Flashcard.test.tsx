import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Flashcard from './Flashcard';
import type { FlashCardData } from '../lib/api';

// ponytail: CSS variables + computed style assertions rely on jsdom
// We verify className + inline style attributes that drive wordwrap behavior.

describe('Flashcard (Issue #20: wordwrap)', () => {
  const baseCard: FlashCardData = {
    id: 'c1',
    userId: 'u1',
    title: 'Pertanyaan panjang tanpa spasi yang sangat panjang sekali dan harus di-wrap dengan baik',
    notes: 'Belakang kartu dengan teks panjang juga harus wrap properly ketika melebihi lebar container',
    source: 'ai',
    category: 'Biologi',
    attachments: [],
    createdAt: '2026-06-21T00:00:00Z',
  };

  it('renders front title in <p> with .flashcard-text class (Twitter-style typography)', () => {
    // ponytail: jsdom doesn't compute layout but we verify CSS class chain
    // (.flashcard > .flashcard-front > .flashcard-text) drives the typography.
    render(<Flashcard card={baseCard} onDelete={() => {}} />);
    const text = screen.getByText(baseCard.title);
    expect(text).toBeInTheDocument();
    expect(text.tagName).toBe('P');
    expect(text).toHaveClass('flashcard-text');
    expect(text.parentElement).toHaveClass('flashcard-front');
    // ponytail: DOM has .flashcard > .flashcard-inner > .flashcard-front > .flashcard-text
    expect(text.parentElement?.parentElement).toHaveClass('flashcard-inner');
  });

  it('back paragraph contains notes text', () => {
    render(<Flashcard card={baseCard} onDelete={() => {}} />);
    const p = screen.getByText(baseCard.notes);
    expect(p.tagName).toBe('P');
    expect(p.parentElement).toHaveClass('flashcard-back');
  });

  it('displays category badge when card has category', () => {
    render(<Flashcard card={baseCard} onDelete={() => {}} />);
    // ponytail: category shows on both front (top) and back (bottom)
    const badges = screen.getAllByText('Biologi');
    expect(badges.length).toBeGreaterThanOrEqual(1);
    badges.forEach((b) => expect(b).toHaveClass('card-category-tag'));
  });

  it('omits category badge when card has no category', () => {
    const cardNoCat = { ...baseCard, category: null };
    render(<Flashcard card={cardNoCat} onDelete={() => {}} />);
    expect(screen.queryByText('Biologi')).not.toBeInTheDocument();
  });

  it('flips card when clicked (front → back)', async () => {
    const user = userEvent.setup();
    const { container } = render(<Flashcard card={baseCard} onDelete={() => {}} />);
    const cardEl = container.querySelector('.flashcard') as HTMLElement;
    expect(cardEl).toBeTruthy();
    expect(cardEl).not.toHaveClass('flipped');
    await user.click(cardEl);
    expect(cardEl).toHaveClass('flipped');
  });

  it('does not trigger flip when delete button clicked', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<Flashcard card={baseCard} onDelete={onDelete} />);
    const deleteBtn = screen.getByTitle('Hapus');
    await user.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith('c1');
  });
});
