import { useEffect, useRef, useState } from 'react';
import { CameraGuide } from '../components/CameraGuide';

export function CameraView({ onCapture, onClose, onUpload }: { onCapture: (blob: Blob) => void; onClose: () => void; onUpload: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    async function start() {
      setError(null);
      streamRef.current?.getTracks().forEach((track) => track.stop());
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
          await video.play();
        }
      } catch {
        if (!cancelled) setError('The camera did not start. You can still upload a photo or open the camera app.');
      }
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [facing]);

  function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
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
    <section className="camera">
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
        {error ? <p className="camera-error">{error}</p> : <div className="scanline" />}
      </div>
      <CameraGuide />
      <div className="camera-controls">
        <label className="text-btn">
          Upload
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = '';
              if (file) onUpload(file);
            }}
          />
        </label>
        <button type="button" className="shutter" onClick={snap} aria-label="Take photo" disabled={Boolean(error)} />
        <label className="text-btn">
          Camera app
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = '';
              if (file) onUpload(file);
            }}
          />
        </label>
      </div>
    </section>
  );
}
