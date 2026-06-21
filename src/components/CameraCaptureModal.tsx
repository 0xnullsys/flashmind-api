/**
 * Camera capture modal — opens full-size live camera preview.
 * Uses WebRTC getUserMedia to access device camera directly (no file picker).
 * Captures frame to canvas → File when user clicks "Ambil foto".
 */
import React, { useEffect, useRef, useState } from 'react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export default function CameraCaptureModal({ isOpen, onClose, onCapture }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');

  // ponytail: open camera stream when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setStatus('connecting');
    setError('');
    let cancelled = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Browser tidak mendukung akses kamera');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('ready');
      } catch (err: any) {
        console.error('Camera access error:', err);
        if (!cancelled) {
          setError(err?.message || 'Tidak dapat membuka kamera');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0) {
      setError('Kamera belum siap');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Tidak dapat memproses frame');
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError('Gagal mengambil foto');
        return;
      }
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
      onClose();
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="modal-overlay camera-modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog camera-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>📷 Ambil Foto Catatan</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="camera-modal-body">
          {status === 'connecting' && (
            <div className="camera-status">Membuka kamera…</div>
          )}
          {status === 'error' && (
            <div className="camera-status camera-status-error">
              Kamera tidak dapat dibuka. Coba lagi atau gunakan tombol Unggah.
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-modal-video"
          />
        </div>

        <div className="form-actions camera-modal-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCapture}
            disabled={status !== 'ready'}
          >
            📸 Ambil foto
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
