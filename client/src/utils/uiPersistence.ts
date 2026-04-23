import type { AppTab } from '../components/NavTabs.js';

interface DiffState {
  isOpen: boolean;
  isFullscreen: boolean;
}

const KEY_FOCUSED = 'orchestrator:focusedSessionId';
const KEY_ACTIVE_TAB = 'orchestrator:activeTab';
const KEY_DIFF_STATES = 'orchestrator:diffStates';
const KEY_EXPLORER_STATES = 'orchestrator:explorerStates';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota / private-mode errors
  }
}

export function loadFocusedSessionId(): string | null {
  const raw = safeGet(KEY_FOCUSED);
  return raw && raw.length > 0 ? raw : null;
}

export function saveFocusedSessionId(id: string | null): void {
  if (id === null) {
    try {
      localStorage.removeItem(KEY_FOCUSED);
    } catch {
      // ignore
    }
    return;
  }
  safeSet(KEY_FOCUSED, id);
}

const VALID_TABS: readonly AppTab[] = ['sessions', 'git-diff', 'explorer'];

export function loadActiveTab(): AppTab {
  const raw = safeGet(KEY_ACTIVE_TAB);
  return (VALID_TABS as readonly string[]).includes(raw ?? '') ? (raw as AppTab) : 'sessions';
}

export function saveActiveTab(tab: AppTab): void {
  safeSet(KEY_ACTIVE_TAB, tab);
}

function loadStateMap(key: string): Map<string, DiffState> {
  const raw = safeGet(key);
  if (!raw) return new Map();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return new Map();
    const entries: [string, DiffState][] = [];
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v && typeof v === 'object') {
        const obj = v as Partial<DiffState>;
        entries.push([k, { isOpen: !!obj.isOpen, isFullscreen: !!obj.isFullscreen }]);
      }
    }
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function saveStateMap(key: string, map: Map<string, DiffState>): void {
  const obj: Record<string, DiffState> = {};
  for (const [k, v] of map) obj[k] = v;
  safeSet(key, JSON.stringify(obj));
}

export function loadDiffStates(): Map<string, DiffState> {
  return loadStateMap(KEY_DIFF_STATES);
}

export function saveDiffStates(map: Map<string, DiffState>): void {
  saveStateMap(KEY_DIFF_STATES, map);
}

export function loadExplorerStates(): Map<string, DiffState> {
  return loadStateMap(KEY_EXPLORER_STATES);
}

export function saveExplorerStates(map: Map<string, DiffState>): void {
  saveStateMap(KEY_EXPLORER_STATES, map);
}
