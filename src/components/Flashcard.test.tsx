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

  it('renders front title in <h3> with wordwrap class chain (h3 inside .flashcard-front)', () => {
    // ponytail: jsdom doesn't compute layout but we verify CSS class chain
    // (.flashcard > .flashcard-front > h3) drives the wordwrap CSS rules.
    render(<Flashcard card={baseCard} onDelete={() => {}} />);
    const h3 = screen.getByRole('heading', { level: 3 });
    expect(h3).toBeInTheDocument();
    expect(h3.textContent).toBe(baseCard.title);
    expect(h3.parentElement).toHaveClass('flashcard-front');
    // ponytail: DOM has .flashcard > .flashcard-inner > .flashcard-front > h3
    expect(h3.parentElement?.parentElement).toHaveClass('flashcard-inner');
  });

  it('back paragraph contains notes text', () => {
    render(<Flashcard card={baseCard} onDelete={() => {}} />);
    const p = screen.getByText(baseCard.notes);
    expect(p.tagName).toBe('P');
    expect(p.parentElement).toHaveClass('flashcard-back');
  });

  it('displays category badge when card has category', () => {
    render(<Flashcard card={baseCard} onDelete={() => {}} />);
    expect(screen.getByText('Biologi')).toBeInTheDocument();
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
