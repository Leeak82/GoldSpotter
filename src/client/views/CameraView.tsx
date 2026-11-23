import { useEffect, useRef, useState } from 'react';
import { CameraGuide } from '../components/CameraGuide';

function cameraMessage(caught: unknown): string {
  const name = caught instanceof DOMException ? caught.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'Camera access is blocked. Allow the camera for this site in your browser settings, or choose a photo below.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return 'No usable camera was found on this device. Choose a photo below.';
  }
  return "This browser can't open a live camera. Choose a photo below.";
}

function PhotoFallback({ onUpload, prominent }: { onUpload: (file: File) => void; prominent?: boolean }) {
  return (
    <label className={prominent ? 'btn btn-primary camera-upload' : 'btn btn-ghost camera-upload'}>
      Upload / choose photo
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (file) onUpload(file);
        }}
      />
    </label>
  );
}

export function CameraView({ onCapture, onClose, onUpload }: { onCapture: (blob: Blob) => void; onClose: () => void; onUpload: (file: File) => void }) {
  const rootRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const viewport = window.visualViewport;
    if (!root || !viewport) return;
    const fit = () => {
      root.style.height = `${viewport.height}px`;
      root.style.top = `${viewport.offsetTop}px`;
    };
    fit();
    viewport.addEventListener('resize', fit);
    viewport.addEventListener('scroll', fit);
    return () => {
      viewport.removeEventListener('resize', fit);
      viewport.removeEventListener('scroll', fit);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    async function start() {
      setError(null);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setError(cameraMessage(new DOMException('unsupported', 'NotSupportedError')));
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
      } catch (caught) {
        if (!cancelled) setError(cameraMessage(caught));
      }
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [facing]);

  async function snap() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
      } catch {
        // Capture still uses the current frame when the preview cannot play.
      }
    }
    if (!video.videoWidth) return;
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, 'image/jpeg', 0.9);
  }

  return (
    <section className="camera" ref={rootRef}>
      <div className="camera-top">
        <button type="button" className="text-btn" onClick={onClose}>
          Close
        </button>
        <button type="button" className="text-btn" onClick={() => setFacing((side) => (side === 'environment' ? 'user' : 'environment'))}>
          Flip
        </button>
      </div>
      <div className="camera-frame">
        <video ref={videoRef} playsInline muted autoPlay />
        {error ? (
          <p className="camera-denied" role="alert">
            {error}
          </p>
        ) : (
          <>
            <div className="scanline" />
            <CameraGuide />
          </>
        )}
      </div>
      <div className="camera-controls">
        <PhotoFallback onUpload={onUpload} prominent={Boolean(error)} />
        {error ? null : <button type="button" className="shutter" onClick={() => void snap()} aria-label="Take photo" />}
      </div>
    </section>
  );
}
