import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FlashcardEditor from './FlashcardEditor';

// ponytail: mock the API to avoid network calls during test
vi.mock('../lib/api', () => ({
  testAI: vi.fn(),
  uploadImage: vi.fn(),
  createFlashcard: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { testAI, uploadImage, createFlashcard } from '../lib/api';

describe('FlashcardEditor (Issue #21: no title input, AI integrated)', () => {
  const onClose = vi.fn();
  const onCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('renders dialog with AI-focused title (not "Manual Card")', () => {
    render(<FlashcardEditor isOpen={true} onClose={onClose} onCreated={onCreated} />);
    // ponytail: header now reflects AI-first flow
    expect(screen.getByText(/\+ Kartu Baru/i)).toBeInTheDocument();
  });

  it('does NOT render a "Judul" (title) input field', () => {
    // ponytail: user explicitly removed manual title input
    const { container } = render(<FlashcardEditor isOpen={true} onClose={onClose} onCreated={onCreated} />);
    const allInputs = container.querySelectorAll('input[type="text"]');
    // No text input fields at all (only hidden file inputs)
    const visibleInputs = Array.from(allInputs).filter((input) => {
      const style = window.getComputedStyle(input as HTMLElement);
      return style.display !== 'none';
    });
    expect(visibleInputs).toHaveLength(0);
  });

  it('renders textarea for notes input (not split title/notes fields)', () => {
    render(<FlashcardEditor isOpen={true} onClose={onClose} onCreated={onCreated} />);
    const textarea = screen.getByPlaceholderText(/Mitosis adalah/i);
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('renders "Hasilkan Kartu" button (not "Simpan" as primary action initially)', () => {
    render(<FlashcardEditor isOpen={true} onClose={onClose} onCreated={onCreated} />);
    expect(screen.getByRole('button', { name: /Hasilkan Kartu/i })).toBeInTheDocument();
  });

  it('does not render "Simpan N Kartu" button in initial state (only after AI generates)', () => {
    render(<FlashcardEditor isOpen={true} onClose={onClose} onCreated={onCreated} />);
    expect(screen.queryByRole('button', { name: /Simpan \d+ Kartu/i })).not.toBeInTheDocument();
  });

  it('shows error when generating without text or images', async () => {
    const user = userEvent.setup();
    render(<FlashcardEditor isOpen={true} onClose={onClose} onCreated={onCreated} />);
    const btn = screen.getByRole('button', { name: /Hasilkan Kartu/i });
    await user.click(btn);
    expect(await screen.findByText(/Tempel catatan atau unggah gambar dulu/i)).toBeInTheDocument();
  });

  it('calls testAI with text input and saves using AI question as title', async () => {
    const user = userEvent.setup();
    vi.mocked(testAI).mockResolvedValue({
      cards: [
        { judul: 'Apa definisi Mitosis?', catatan: 'Mitosis adalah pembelahan sel...', category: 'Biologi' },
        { judul: 'Apa itu Fotosintesis?', catatan: 'Fotosintesis mengubah cahaya...', category: 'Biologi' },
      ],
    });
    vi.mocked(createFlashcard).mockResolvedValue({} as any);

    render(<FlashcardEditor isOpen={true} onClose={onClose} onCreated={onCreated} />);
    const textarea = screen.getByPlaceholderText(/Mitosis adalah/i);
    await user.type(textarea, 'Mitosis adalah pembelahan sel. Fotosintesis mengubah cahaya.');

    const generateBtn = screen.getByRole('button', { name: /Hasilkan Kartu/i });
    await user.click(generateBtn);

    // Wait for cards to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Apa definisi Mitosis/i)).toBeInTheDocument();
    });

    // ponytail: verify AI question is used as the title in display
    expect(screen.getByText(/Apa definisi Mitosis/i)).toBeInTheDocument();
    expect(screen.getByText(/Apa itu Fotosintesis/i)).toBeInTheDocument();

    // Click save all
    const saveBtn = screen.getByRole('button', { name: /Simpan 2 Kartu/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(createFlashcard).toHaveBeenCalledTimes(2);
    });

    // Verify createFlashcard called with AI question as title (no manual title input)
    expect(createFlashcard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Apa definisi Mitosis?',
        notes: 'Mitosis adalah pembelahan sel...',
        category: 'Biologi',
        source: 'ai',
      })
    );
    expect(createFlashcard).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Apa itu Fotosintesis?',
        notes: 'Fotosintesis mengubah cahaya...',
        category: 'Biologi',
        source: 'ai',
      })
    );

    // After save, onCreated + onClose called
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('displays error when AI returns empty cards', async () => {
    const user = userEvent.setup();
    vi.mocked(testAI).mockResolvedValue({ cards: [] });

    render(<FlashcardEditor isOpen={true} onClose={onClose} onCreated={onCreated} />);
    const textarea = screen.getByPlaceholderText(/Mitosis adalah/i);
    await user.type(textarea, 'Random text without facts');
    await user.click(screen.getByRole('button', { name: /Hasilkan Kartu/i }));

    expect(await screen.findByText(/AI tidak menghasilkan kartu/i)).toBeInTheDocument();
  });

  it('does not render when isOpen=false', () => {
    const { container } = render(<FlashcardEditor isOpen={false} onClose={onClose} onCreated={onCreated} />);
    expect(container.firstChild).toBeNull();
  });
});
