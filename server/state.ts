import fs from 'node:fs';
import path from 'node:path';
import type { Tournament } from '../src/types';

const DATA_FILE = process.env.DATA_FILE
  ? path.resolve(process.env.DATA_FILE)
  : path.resolve('data/tournament.json');

export function loadState(): Tournament | null {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw) as Tournament;
  } catch (e) {
    console.error('[state] load failed:', e);
    return null;
  }
}

export function saveState(t: Tournament | null): void {
  try {
    const dir = path.dirname(DATA_FILE);
    fs.mkdirSync(dir, { recursive: true });
    if (t === null) {
      if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
      return;
    }
    // Atomic-ish write: write to temp then rename.
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(t, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) {
    console.error('[state] save failed:', e);
  }
}

export function dataFilePath(): string {
  return DATA_FILE;
}
