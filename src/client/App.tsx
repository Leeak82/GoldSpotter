import { useCallback, useEffect, useRef, useState } from 'react';
import { componentVisible, type ScanType } from '../shared/scanTypes';
import type { Analysis, ReviewState } from '../shared/types';
import { Logo } from './components/Logo';
import { analyzePhoto } from './lib/api';
import { compressImage } from './lib/compress';
import {
  clearHistory,
  deleteHistory,
  exportHistoryJson,
  loadHistory,
  saveHistory,
  updateHistoryAnalysis,
  type HistoryItem,
} from './lib/history';
import { changeScanType, loadScanTypes } from './lib/preferences';
import { buildShareCard, shareCard } from './lib/share';
import { CameraView } from './views/CameraView';
import { ErrorView } from './views/ErrorView';
import { GuideView } from './views/GuideView';
import { HistoryView } from './views/HistoryView';
import { HomeView } from './views/HomeView';
import { ResultsView } from './views/ResultsView';
import { SettingsView } from './views/SettingsView';
import { WorkingView } from './views/WorkingView';

const CONSENT_KEY = 'goldspotter.consent.v1';
const SUPPORT_URL = 'https://buymeacoffee.com/anthonyleebuilds';

type Screen = 'landing' | 'camera' | 'working' | 'results' | 'error';

function usePath() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const go = useCallback((to: string) => {
    if (window.location.pathname !== to) window.history.pushState(null, '', to);
    setPath(to);
  }, []);
  const replace = useCallback((to: string) => {
    if (window.location.pathname !== to) window.history.replaceState(null, '', to);
    setPath(to);
  }, []);
  return { path, go, replace };
}

export function App() {
  const { path, go, replace } = usePath();
  const [screen, setScreen] = useState<Screen>('landing');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [scanTypes, setScanTypes] = useState<ScanType[]>(() => loadScanTypes());
  const [scannedTypes, setScannedTypes] = useState<ScanType[]>(() => loadScanTypes());
  const [typeHint, setTypeHint] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const runRef = useRef(0);
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (path === '/scan' && screen === 'landing') {
      if (localStorage.getItem(CONSENT_KEY) === 'yes') setScreen('camera');
      else replace('/');
    }
    if (path !== '/scan' && screen === 'camera') setScreen('landing');
  }, [path, screen, replace]);

  useEffect(() => {
    const titles: Record<string, string> = {
      '/guide': 'Gold reference · GoldSpotter',
      '/history': 'Past scans · GoldSpotter',
      '/settings': 'Scan types · GoldSpotter',
    };
    document.title = titles[path] ?? 'GoldSpotter — Find the gold on a circuit board';
  }, [path]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function gate(action: () => void) {
    if (localStorage.getItem(CONSENT_KEY) === 'yes') {
      action();
      return;
    }
    pending.current = action;
    setConsentOpen(true);
  }

  function acceptConsent() {
    localStorage.setItem(CONSENT_KEY, 'yes');
    setConsentOpen(false);
    const action = pending.current;
    pending.current = null;
    action?.();
  }

  function home() {
    abortRef.current?.abort();
    setScreen('landing');
    setError(null);
    go('/');
  }

  function toggleType(id: ScanType) {
    const result = changeScanType(scanTypes, id);
    if (result.blocked) {
      setTypeHint('Leave at least one type on.');
      return;
    }
    setTypeHint(null);
    setScanTypes(result.types);
  }

  async function runFile(file: Blob) {
    const id = runRef.current + 1;
    runRef.current = id;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const sent = scanTypes;
    setError(null);
    setScreen('working');
    replace('/scan');
    try {
      const uploaded = await compressImage(file);
      if (controller.signal.aborted || id !== runRef.current) return;
      setPreviewUrl(uploaded.dataUrl);
      const thumb = await compressImage(uploaded.blob, { maxEdge: 720, quality: 0.6, maxBytes: 160_000 });
      const result = await analyzePhoto(uploaded.base64, uploaded.mimeType, controller.signal, sent);
      if (id !== runRef.current) return;
      setAnalysis(result);
      setScannedTypes(sent);
      const saved = saveHistory({ imageDataUrl: thumb.dataUrl, analysis: result, scanTypes: sent });
      setHistory(loadHistory());
      setHistoryId(saved?.id ?? null);
      setScreen('results');
      replace('/');
      if (!saved) setToast('Scan finished. This browser could not keep it in history.');
    } catch (caught) {
      if (id !== runRef.current) return;
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setScreen('landing');
        replace('/');
        return;
      }
      setError(caught instanceof Error ? caught.message : 'The scan failed.');
      setScreen('error');
      replace('/');
    }
  }

  function openCamera() {
    gate(() => {
      setError(null);
      setScreen('camera');
      go('/scan');
    });
  }

  function closeCamera() {
    setScreen('landing');
    replace('/');
  }

  function reviewPart(partId: string, review: ReviewState) {
    if (!analysis) return;
    const index = Number(partId.replace('part-', ''));
    if (!analysis.components[index]) return;
    const next: Analysis = {
      ...analysis,
      components: analysis.components.map((component, componentIndex) =>
        componentIndex === index ? { ...component, review } : component,
      ),
    };
    setAnalysis(next);
    if (historyId) setHistory(updateHistoryAnalysis(historyId, next));
  }

  async function share() {
    if (!analysis || !previewUrl || sharing) return;
    setSharing(true);
    try {
      const card: Analysis = {
        ...analysis,
        components: analysis.components.filter(
          (component) => component.review !== 'rejected' && componentVisible(component, scanTypes),
        ),
      };
      const blob = await buildShareCard(previewUrl, card);
      const gradeBit = analysis.grade ? `${analysis.grade} grade ` : '';
      const outcome = await shareCard(
        blob,
        `${gradeBit}${analysis.board_type}. ${analysis.verdict} Scanned with GoldSpotter`,
      );
      setToast(outcome === 'shared' ? 'Share card is ready.' : 'Share card saved to your downloads.');
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setToast('Could not build the share card on this device.');
    } finally {
      setSharing(false);
    }
  }

  const page = path === '/guide' ? 'guide' : path === '/history' ? 'history' : path === '/settings' ? 'settings' : 'app';
  const cameraOpen = page === 'app' && screen === 'camera';

  return (
    <>
      {cameraOpen ? null : (
        <header className="top">
          <button type="button" className="brand" onClick={home}>
            <Logo />
            <span>GoldSpotter</span>
          </button>
          <nav>
            <button type="button" className={path === '/guide' ? 'nav is-on' : 'nav'} onClick={() => go('/guide')}>
              Guide
            </button>
            <button type="button" className={path === '/history' ? 'nav is-on' : 'nav'} onClick={() => go('/history')}>
              History
            </button>
            <button type="button" className={path === '/settings' ? 'nav is-on' : 'nav'} onClick={() => go('/settings')}>
              Settings
            </button>
          </nav>
        </header>
      )}
      <main className="shell">
        {page === 'guide' ? <GuideView /> : null}
        {page === 'settings' ? <SettingsView types={scanTypes} hint={typeHint} onToggle={toggleType} /> : null}
        {page === 'history' ? (
          <HistoryView
            items={history}
            onOpen={(item) => {
              setPreviewUrl(item.imageDataUrl);
              setAnalysis(item.analysis);
              setHistoryId(item.id);
              setScannedTypes(item.scanTypes);
              setScreen('results');
              go('/');
            }}
            onDelete={(id) => setHistory(deleteHistory(id))}
            onClear={() => {
              clearHistory();
              setHistory([]);
              setHistoryId(null);
            }}
            onExport={() => exportHistoryJson(history)}
          />
        ) : null}
        {page === 'app' && screen === 'landing' ? (
          <HomeView
            types={scanTypes}
            typeHint={typeHint}
            onToggleType={toggleType}
            onScan={openCamera}
            onUpload={(file) => gate(() => void runFile(file))}
          />
        ) : null}
        {page === 'app' && screen === 'camera' ? (
          <CameraView onCapture={(blob) => void runFile(blob)} onClose={closeCamera} onUpload={(file) => void runFile(file)} />
        ) : null}
        {page === 'app' && screen === 'working' ? (
          <WorkingView
            imageUrl={previewUrl}
            onCancel={() => {
              abortRef.current?.abort();
            }}
          />
        ) : null}
        {page === 'app' && screen === 'results' && analysis && previewUrl ? (
          <ResultsView
            imageUrl={previewUrl}
            analysis={analysis}
            scanTypes={scanTypes}
            scannedTypes={scannedTypes}
            typeHint={typeHint}
            onToggleType={toggleType}
            onReview={reviewPart}
            onShare={() => void share()}
            onAgain={openCamera}
            sharing={sharing}
          />
        ) : null}
        {page === 'app' && screen === 'error' ? (
          <ErrorView
            message={error ?? 'The scan failed.'}
            onRetry={openCamera}
            onUpload={(file) => gate(() => void runFile(file))}
          />
        ) : null}
      </main>
      {cameraOpen ? null : (
        <footer className="foot">
          <p>Educational tool. The model can be wrong, and a photo is not an assay.</p>
          <a className="support" href={SUPPORT_URL} target="_blank" rel="noreferrer">
            Support GoldSpotter
          </a>
          <p>© 2026 Anthony Lee</p>
        </footer>
      )}
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
      {consentOpen ? (
        <div className="consent" role="dialog" aria-modal="true" aria-labelledby="consent-title">
          <div className="consent-card">
            <p className="eyebrow">Before the first scan</p>
            <h2 id="consent-title">This photo is sent to an AI provider.</h2>
            <p>
              GoldSpotter sends the picture to Google Gemini, or to Groq if that is the configured backup, for one analysis. The server does not store it. Scans you keep stay in this browser. You can clear that history or export it as JSON.
            </p>
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={acceptConsent}>
                Continue
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  pending.current = null;
                  setConsentOpen(false);
                }}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
