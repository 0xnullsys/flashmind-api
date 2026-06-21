import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FlashcardEditor from './FlashcardEditor';

// ponytail: test camera detection flow with mocked mediaDevices
describe('FlashcardEditor camera flow (auto-detect on mount)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-detects camera on dialog open — available', async () => {
    // ponytail: mock getUserMedia to return fake stream (camera available)
    const stop = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop }],
        }),
      },
    });

    render(<FlashcardEditor isOpen={true} onClose={() => {}} onCreated={() => {}} />);

    // Initially shows "Memeriksa…" (checking state)
    expect(screen.getByText(/Memeriksa/i)).toBeInTheDocument();

    // Wait for detection to complete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '📷 Ambil foto' })).toBeInTheDocument();
    });

    // Button should be enabled (camera available)
    // ponytail: use exact button name to avoid matching hint text
    const cameraBtn = screen.getByRole('button', { name: '📷 Ambil foto' });
    expect(cameraBtn).not.toBeDisabled();

    // Stream should have been stopped
    expect(stop).toHaveBeenCalled();

    // Should show "Kamera siap" hint
    expect(screen.getByText(/Kamera siap/i)).toBeInTheDocument();
  });

  it('auto-detects camera on dialog open — unavailable (no camera)', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError')),
      },
    });

    render(<FlashcardEditor isOpen={true} onClose={() => {}} onCreated={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Kamera tidak terdeteksi/i)).toBeInTheDocument();
    });

    const cameraBtn = screen.getByRole('button', { name: '📷 Ambil foto' });
    expect(cameraBtn).toBeDisabled();
  });

  it('auto-detects camera on dialog open — API not supported', async () => {
    // ponytail: remove mediaDevices entirely
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });

    render(<FlashcardEditor isOpen={true} onClose={() => {}} onCreated={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Kamera tidak terdeteksi/i)).toBeInTheDocument();
    });

    const cameraBtn = screen.getByRole('button', { name: '📷 Ambil foto' });
    expect(cameraBtn).toBeDisabled();
  });

  it('camera button click opens WebRTC live preview when available', async () => {
    const stop = vi.fn();
    const getUserMediaSpy = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop }],
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: getUserMediaSpy },
    });

    const user = userEvent.setup();
    render(<FlashcardEditor isOpen={true} onClose={() => {}} onCreated={() => {}} />);

    // Wait for detection
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '📷 Ambil foto' })).toBeInTheDocument();
    });

    // Click camera button — should call getUserMedia again to open live preview
    const cameraBtn = screen.getByRole('button', { name: '📷 Ambil foto' });
    await user.click(cameraBtn);

    // ponytail: getUserMedia called twice (once for detection, once for preview)
    await waitFor(() => {
      expect(getUserMediaSpy).toHaveBeenCalledTimes(2);
    });

    // Video preview element rendered
    expect(document.querySelector('.camera-preview-video')).toBeTruthy();

    // Capture button + close button appear
    expect(screen.getByRole('button', { name: /📸 Ambil foto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tutup kamera/i })).toBeInTheDocument();
  });

  it('camera button click does NOTHING when unavailable', async () => {
    const getUserMediaSpy = vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: getUserMediaSpy },
    });

    render(<FlashcardEditor isOpen={true} onClose={() => {}} onCreated={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Kamera tidak terdeteksi/i)).toBeInTheDocument();
    });

    // Button should be disabled
    const cameraBtn = screen.getByRole('button', { name: '📷 Ambil foto' });
    expect(cameraBtn).toBeDisabled();
  });

  it('re-detects when dialog re-opens', async () => {
    const stop = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop }],
        }),
      },
    });

    const { rerender } = render(<FlashcardEditor isOpen={false} onClose={() => {}} onCreated={() => {}} />);
    // Close — no camera check
    expect(screen.queryByText(/Memeriksa|Ambil foto|Kamera/i)).not.toBeInTheDocument();

    // Open — triggers detection
    rerender(<FlashcardEditor isOpen={true} onClose={() => {}} onCreated={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '📷 Ambil foto' })).toBeInTheDocument();
    });
  });
});
