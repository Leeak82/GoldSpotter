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

type CameraCaps = MediaTrackCapabilities & {
  torch?: boolean;
  focusMode?: string[];
  pointsOfInterest?: boolean;
};

function cameraCaps(track: MediaStreamTrack): CameraCaps {
  return (track.getCapabilities?.() ?? {}) as CameraCaps;
}

async function applyExtra(track: MediaStreamTrack, constraint: Record<string, unknown>) {
  await track.applyConstraints({ advanced: [constraint] } as MediaTrackConstraints);
}

function TorchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 2h6v2.2l1.6 2.4c.3.4.4.8.4 1.3V10H7V7.9c0-.5.1-.9.4-1.3L9 4.2V2zm1.2 10h3.6V22h-3.6V12z"
      />
    </svg>
  );
}

function PhotoFallback({ onUpload, prominent }: { onUpload: (file: File) => void; prominent?: boolean }) {
  return (
    <label className={prominent ? 'btn btn-primary camera-upload' : 'btn btn-ghost camera-upload'}>
      Upload / choose photo
      <input
        type="file"
        accept="image/*"
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
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState<boolean | null>(null);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

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
      setTorchOn(false);
      setTorchSupported(null);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setError(cameraMessage(new DOMException('unsupported', 'NotSupportedError')));
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 3840 }, height: { ideal: 2160 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = track ? cameraCaps(track) : {};
        if (!cancelled) setTorchSupported(Boolean(caps.torch));
        if (track && caps.focusMode?.includes('continuous')) {
          await applyExtra(track, { focusMode: 'continuous' }).catch(() => undefined);
        }
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
      } catch (caught) {
        if (!cancelled) {
          setTorchSupported(false);
          setError(cameraMessage(caught));
        }
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
    const scale = Math.min(1, 4096 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, 'image/jpeg', 0.92);
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchSupported) return;
    const next = !torchOn;
    try {
      await applyExtra(track, { torch: next });
      setTorchOn(next);
    } catch {
      setTorchOn(false);
      setTorchSupported(false);
    }
  }

  async function focusAt(event: React.PointerEvent<HTMLVideoElement>) {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const caps = cameraCaps(track);
    if (!caps.pointsOfInterest) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    const focusMode = caps.focusMode?.includes('single-shot') ? 'single-shot' : caps.focusMode?.includes('continuous') ? 'continuous' : undefined;
    try {
      await applyExtra(track, { pointsOfInterest: [{ x, y }], ...(focusMode ? { focusMode } : {}) });
      setFocusPoint({ x, y });
    } catch {
      setFocusPoint(null);
    }
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
        <video ref={videoRef} playsInline muted autoPlay onPointerDown={(event) => void focusAt(event)} />
        {focusPoint ? <span className="focus-ring" style={{ left: `${focusPoint.x * 100}%`, top: `${focusPoint.y * 100}%` }} /> : null}
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
        {error ? null : (
          <div className="shutter-row">
            <div className="torch-slot">
              {torchSupported ? (
                <button
                  type="button"
                  className={torchOn ? 'torch is-on' : 'torch'}
                  aria-pressed={torchOn}
                  aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
                  onClick={() => void toggleTorch()}
                >
                  <TorchIcon />
                </button>
              ) : torchSupported === false ? (
                <p className="light-hint">Use good light</p>
              ) : null}
            </div>
            <button type="button" className="shutter" onClick={() => void snap()} aria-label="Take photo" />
            <div className="torch-slot" />
          </div>
        )}
      </div>
    </section>
  );
}
