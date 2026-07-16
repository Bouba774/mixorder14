import type { DeckId } from "./discdj-bridge";

export type DiscDJMatchingMode = "smart";

/**
 * Analysis flow:
 *  - "auto-sync"     : MixOrder library and DiscDJ playlist are assumed
 *                      strictly aligned. The robot reads BPMs deck-by-deck
 *                      and writes them into the library in order, without
 *                      ever returning to MixOrder or asking for
 *                      confirmation.
 *  - "verification"  : legacy behavior — identify each DiscDJ reading via
 *                      title + duration matching, ask the user when
 *                      ambiguous.
 *  - "autosync-name" : ordered flow with per-track name verification. The
 *                      robot captures the ENTIRE playlist list, detects the
 *                      currently-loaded blue row automatically, and OCRs
 *                      only that row.
 */
export type DiscDJAnalysisMode = "auto-sync" | "verification" | "autosync-name";

/**
 * Calibratable elements.
 *  - `playlistButton`, `backButton`, `playlistZoneDeck*` are used by AutoSync
 *    (name-checked). `playlistZone*` is the FULL playlist list rectangle,
 *    from which the native side detects the active blue row.
 */
export type CalibrationTarget =
  | "nextDeck1"
  | "nextDeck2"
  | "bpmDeck1"
  | "bpmDeck2"
  | "playlistButton"
  | "backButton"
  | "playlistZoneDeck1"
  | "playlistZoneDeck2";

/** Screen where a calibration target lives. Governs the contextual capture flow. */
export type CalibrationScreen = "main" | "playlist";

export const CALIBRATION_SCREEN: Record<CalibrationTarget, CalibrationScreen> = {
  nextDeck1: "main",
  nextDeck2: "main",
  bpmDeck1: "main",
  bpmDeck2: "main",
  playlistButton: "main",
  backButton: "playlist",
  playlistZoneDeck1: "playlist",
  playlistZoneDeck2: "playlist",
};

/** Returns true for calibration targets that are rectangles (zones) rather than points. */
export function isRectTarget(target: CalibrationTarget): boolean {
  return target.startsWith("bpm") || target.startsWith("playlistZone");
}


export interface CalibrationPoint {
  /** Canonical landscape X coordinate, normalized in [0, 1]. */
  x: number;
  /** Canonical landscape Y coordinate, normalized in [0, 1]. */
  y: number;
}

export interface CalibrationRect extends CalibrationPoint {
  /** Canonical landscape width, normalized in [0, 1]. */
  width: number;
  /** Canonical landscape height, normalized in [0, 1]. */
  height: number;
}

export interface DiscDJCalibration {
  nextDeck1: CalibrationPoint | null;
  nextDeck2: CalibrationPoint | null;
  bpmDeck1: CalibrationRect | null;
  bpmDeck2: CalibrationRect | null;
  /** AutoSync (name-checked): tap point on the "Playlist" button (main screen). */
  playlistButton: CalibrationPoint | null;
  /** AutoSync: tap point on the "Back to main screen" button (playlist screen). */
  backButton: CalibrationPoint | null;
  /**
   * AutoSync: full playlist list rectangle for deck 1 / 2. The native side
   * scans it for the currently-loaded blue row, isolates that row, and OCRs
   * only that row. Calibrated once per deck.
   */
  playlistZoneDeck1: CalibrationRect | null;
  playlistZoneDeck2: CalibrationRect | null;
  savedAt: number | null;
  /** Per-element last-calibration timestamps (ms epoch). */
  timestamps: Partial<Record<CalibrationTarget, number>>;
}


export interface DiscDJRobotSettings {
  calibration: DiscDJCalibration;
  /** One-shot wait applied immediately after DiscDJ is brought to the foreground. */
  waitOnOpenMs: number;
  waitBeforeReadMs: number;
  waitAfterClickMs: number;
  maxAttempts: number;
  pressDurationMs: number;
  matchingMode: DiscDJMatchingMode;
  analysisMode: DiscDJAnalysisMode;
  /** 1-based track index the auto-sync run should start on. */
  startAtIndex: number;
  /** Skip tracks that already have a BPM. */
  skipAlreadyBpm: boolean;
  /** When true, existing BPMs are overwritten (overrides `skipAlreadyBpm`). */
  replaceExisting: boolean;
  /** Save the snapshot after every processed track (auto-sync). */
  autosaveEachStep: boolean;
  /** Resume an interrupted run from the last saved track. */
  autoResume: boolean;
  /** Run the analysis inside an Android foreground service (survives app close). */
  runInBackground: boolean;
  /** Minimum delay after a Next click before the robot even attempts an OCR read. */
  minReadyDelayMs: number;
  /** Max OCR attempts per track when trying to reach a stable BPM vote. */
  bpmMaxAttempts: number;
  /** Number of identical BPM readings required to consider the vote valid. */
  bpmValidVoteCount: number;
  /** AutoSync (name-checked): similarity threshold to accept a name match. */
  nameMatchThreshold: number;
  /** AutoSync: max OCR retries when the first read fails the confidence check. */
  nameMaxOcrRetries: number;
  /** AutoSync: wait after tapping Playlist before OCR (ms). */
  waitAfterPlaylistOpenMs: number;
  /** AutoSync: wait after tapping Back before tapping Next (ms). */
  waitAfterBackMs: number;
}

// v5: replaced the "first playlist row" name zone with a "full playlist
// zone" that lets the native side auto-detect the active blue row.
// Reading the v4 key would silently reuse the old, too-small rectangles, so
// we invalidate on purpose — the user recalibrates the playlist zone once
// per deck.
const SETTINGS_KEY = "mixorder:discdj-robot:settings:v5";

export const DEFAULT_DISCDJ_SETTINGS: DiscDJRobotSettings = {
  calibration: {
    nextDeck1: null,
    nextDeck2: null,
    bpmDeck1: null,
    bpmDeck2: null,
    playlistButton: null,
    backButton: null,
    playlistZoneDeck1: null,
    playlistZoneDeck2: null,


    savedAt: null,
    timestamps: {},
  },
  waitOnOpenMs: 1000,
  waitBeforeReadMs: 800,
  waitAfterClickMs: 1200,
  maxAttempts: 3,
  pressDurationMs: 120,
  matchingMode: "smart",
  analysisMode: "auto-sync",
  startAtIndex: 1,
  skipAlreadyBpm: true,
  replaceExisting: false,
  autosaveEachStep: true,
  autoResume: true,
  runInBackground: true,
  minReadyDelayMs: 800,
  bpmMaxAttempts: 8,
  bpmValidVoteCount: 2,
  nameMatchThreshold: 0.55,
  nameMaxOcrRetries: 3,
  waitAfterPlaylistOpenMs: 900,
  waitAfterBackMs: 700,
};

export function loadDiscDJSettings(): DiscDJRobotSettings {
  const storage = safeStorage();
  if (!storage) return DEFAULT_DISCDJ_SETTINGS;
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_DISCDJ_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<DiscDJRobotSettings>;
    return normalizeSettings(parsed);
  } catch {
    return DEFAULT_DISCDJ_SETTINGS;
  }
}

export function saveDiscDJSettings(settings: DiscDJRobotSettings): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
  } catch {
    /* ignore quota / private-mode failures */
  }
}

export function isDiscDJCalibrationComplete(settings: DiscDJRobotSettings): boolean {
  const c = settings.calibration;
  return Boolean(c.nextDeck1 && c.nextDeck2 && c.bpmDeck1 && c.bpmDeck2);
}

export function isDeckCalibrated(settings: DiscDJRobotSettings, deck: DeckId): boolean {
  const c = getDeckCalibration(settings, deck);
  return Boolean(c.next && c.bpmZone);
}

export function isElementCalibrated(settings: DiscDJRobotSettings, target: CalibrationTarget): boolean {
  return Boolean(settings.calibration[target]);
}

export function getElementTimestamp(settings: DiscDJRobotSettings, target: CalibrationTarget): number | null {
  return settings.calibration.timestamps?.[target] ?? null;
}

/** Return a new settings object with a single calibration element set/cleared and timestamped. */
export function setCalibrationElement(
  settings: DiscDJRobotSettings,
  target: CalibrationTarget,
  value: CalibrationPoint | CalibrationRect | null,
): DiscDJRobotSettings {
  const now = Date.now();
  const timestamps = { ...settings.calibration.timestamps };
  const isRect = isRectTarget(target);
  const normalizedValue = isRect
    ? normalizeRect(value as CalibrationRect | null | undefined)
    : normalizePoint(value as CalibrationPoint | null | undefined);
  if (normalizedValue) timestamps[target] = now;
  else delete timestamps[target];
  return {
    ...settings,
    calibration: {
      ...settings.calibration,
      [target]: normalizedValue,
      timestamps,
      savedAt: normalizedValue ? now : settings.calibration.savedAt,
    },
  };
}

export function getDeckCalibration(settings: DiscDJRobotSettings, deck: DeckId) {
  return deck === 1
    ? { next: settings.calibration.nextDeck1, bpmZone: settings.calibration.bpmDeck1 }
    : { next: settings.calibration.nextDeck2, bpmZone: settings.calibration.bpmDeck2 };
}

/** Helper — playlist zone for a deck (AutoSync name mode). */
export function getPlaylistZone(settings: DiscDJRobotSettings, deck: DeckId): CalibrationRect | null {
  return deck === 1 ? settings.calibration.playlistZoneDeck1 : settings.calibration.playlistZoneDeck2;
}

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function normalizeSettings(input: Partial<DiscDJRobotSettings>): DiscDJRobotSettings {
  const d = DEFAULT_DISCDJ_SETTINGS;
  return {
    calibration: normalizeCalibration(input.calibration),
    waitOnOpenMs: clampNumber(input.waitOnOpenMs, 0, 10000, d.waitOnOpenMs),
    waitBeforeReadMs: clampNumber(input.waitBeforeReadMs, 150, 5000, d.waitBeforeReadMs),
    waitAfterClickMs: clampNumber(input.waitAfterClickMs, 250, 7000, d.waitAfterClickMs),
    maxAttempts: Math.round(clampNumber(input.maxAttempts, 1, 8, d.maxAttempts)),
    pressDurationMs: Math.round(clampNumber(input.pressDurationMs, 45, 900, d.pressDurationMs)),
    matchingMode: "smart",
    analysisMode:
      input.analysisMode === "verification"
        ? "verification"
        : input.analysisMode === "autosync-name"
          ? "autosync-name"
          : "auto-sync",
    startAtIndex: Math.max(1, Math.round(clampNumber(input.startAtIndex, 1, 10000, d.startAtIndex))),
    skipAlreadyBpm: typeof input.skipAlreadyBpm === "boolean" ? input.skipAlreadyBpm : d.skipAlreadyBpm,
    replaceExisting: typeof input.replaceExisting === "boolean" ? input.replaceExisting : d.replaceExisting,
    autosaveEachStep: typeof input.autosaveEachStep === "boolean" ? input.autosaveEachStep : d.autosaveEachStep,
    autoResume: typeof input.autoResume === "boolean" ? input.autoResume : d.autoResume,
    runInBackground: typeof input.runInBackground === "boolean" ? input.runInBackground : d.runInBackground,
    minReadyDelayMs: Math.round(clampNumber(input.minReadyDelayMs, 0, 10000, d.minReadyDelayMs)),
    bpmMaxAttempts: Math.round(clampNumber(input.bpmMaxAttempts, 2, 20, d.bpmMaxAttempts)),
    bpmValidVoteCount: Math.round(clampNumber(input.bpmValidVoteCount, 2, 6, d.bpmValidVoteCount)),
    nameMatchThreshold: clampNumber(input.nameMatchThreshold, 0.4, 0.99, d.nameMatchThreshold),
    nameMaxOcrRetries: Math.round(clampNumber(input.nameMaxOcrRetries, 1, 8, d.nameMaxOcrRetries)),
    waitAfterPlaylistOpenMs: Math.round(clampNumber(input.waitAfterPlaylistOpenMs, 200, 5000, d.waitAfterPlaylistOpenMs)),
    waitAfterBackMs: Math.round(clampNumber(input.waitAfterBackMs, 200, 5000, d.waitAfterBackMs)),
  };
}

function normalizeCalibration(input: Partial<DiscDJCalibration> | undefined): DiscDJCalibration {
  return {
    nextDeck1: normalizePoint(input?.nextDeck1),
    nextDeck2: normalizePoint(input?.nextDeck2),
    bpmDeck1: normalizeRect(input?.bpmDeck1),
    bpmDeck2: normalizeRect(input?.bpmDeck2),
    playlistButton: normalizePoint(input?.playlistButton),
    backButton: normalizePoint(input?.backButton),
    playlistZoneDeck1: normalizeRect(input?.playlistZoneDeck1),
    playlistZoneDeck2: normalizeRect(input?.playlistZoneDeck2),


    savedAt: typeof input?.savedAt === "number" ? input.savedAt : null,
    timestamps:
      input?.timestamps && typeof input.timestamps === "object"
        ? { ...input.timestamps }
        : {},
  };
}

function normalizePoint(input: CalibrationPoint | null | undefined): CalibrationPoint | null {
  if (!input) return null;
  return { x: clamp01(input.x), y: clamp01(input.y) };
}

function normalizeRect(input: CalibrationRect | null | undefined): CalibrationRect | null {
  if (!input) return null;
  const x = clamp01(input.x);
  const y = clamp01(input.y);
  const width = clamp01(Math.min(input.width, 1 - x));
  const height = clamp01(Math.min(input.height, 1 - y));
  if (width < 0.005 || height < 0.005) return null;
  return { x, y, width, height };
}

function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}
