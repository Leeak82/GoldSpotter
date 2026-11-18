import type { ScanType } from '../../shared/scanTypes';
import { SCAN_TYPES } from '../../shared/scanTypes';
import type { Analysis } from '../../shared/types';

const KEY = 'goldspotter.history.v1';
const MAX_ITEMS = 8;

export type HistoryItem = {
  id: string;
  createdAt: number;
  imageDataUrl: string;
  analysis: Analysis;
  scanTypes: ScanType[];
};

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === 'string' && item.analysis && typeof item.imageDataUrl === 'string')
      .map((item) => ({ ...item, scanTypes: Array.isArray(item.scanTypes) ? item.scanTypes : [...SCAN_TYPES] }));
  } catch {
    return [];
  }
}

export function saveHistory(item: Omit<HistoryItem, 'id' | 'createdAt'>): HistoryItem | null {
  const next: HistoryItem = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    imageDataUrl: item.imageDataUrl,
    analysis: item.analysis,
    scanTypes: item.scanTypes,
  };
  const items = [next, ...loadHistory()].slice(0, MAX_ITEMS);
  return write(items) ? next : null;
}

export function updateHistoryAnalysis(id: string, analysis: Analysis): HistoryItem[] {
  const items = loadHistory().map((item) => (item.id === id ? { ...item, analysis } : item));
  write(items);
  return items;
}

export function exportHistoryJson(items: HistoryItem[]): void {
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'goldspotter-history.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function deleteHistory(id: string): HistoryItem[] {
  const items = loadHistory().filter((item) => item.id !== id);
  write(items);
  return items;
}

export function clearHistory(): void {
  localStorage.removeItem(KEY);
}

function write(items: HistoryItem[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    if (items.length > 1) return write(items.slice(0, Math.ceil(items.length / 2)));
    return false;
  }
}
