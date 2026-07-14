import type { Player } from "@infernus/core";

export interface PlayerState {
  mode:
    | "none"
    | "pos"
    | "ts"
    | "ls"
    | "ol"
    | "sh"
    | "sel"
    | "swap"
    | "undo"
    | "gpos"
    | "gts"
    | "hud"
    | "rgba"
    | "pmodel";
  interval?: ReturnType<typeof setInterval>;
  backupData?: Record<string, unknown>;
  swapIndex?: number;
  selId?: number;
  spawnMode?: number;
  /** Per-player flag: whether the textdraw selection mouse cursor is enabled */
  mouseEnabled?: boolean;

  // ─── Pagination state (per-player to avoid multi-player conflicts) ───
  listPage?: number;
  listPageArr?: number[];
  listListItem?: number;
  projectsPage?: number;
  projectsList?: string[];
  projectsListItem?: number;
  projectsTotal?: number;
  groupPageArr?: number[];
  groupColorMode?: number;
}

export interface RgbaState {
  interval?: ReturnType<typeof setInterval>;
  mode: number;
  index: number;
}

const states = new Map<number, PlayerState>();
const rgbaStates = new Map<number, RgbaState>();

export function getState(player: Player): PlayerState {
  if (!states.has(player.id)) states.set(player.id, { mode: "none" });
  return states.get(player.id)!;
}

export function getRgbaState(player: Player): RgbaState {
  if (!rgbaStates.has(player.id)) rgbaStates.set(player.id, { mode: 0, index: 0 });
  return rgbaStates.get(player.id)!;
}

export function setMode(player: Player, mode: PlayerState["mode"]) {
  const s = getState(player);
  if (s.interval) {
    clearInterval(s.interval);
    s.interval = undefined;
  }
  s.mode = mode;
}

export function cleanup(player: Player) {
  const s = getState(player);
  if (s.interval) clearInterval(s.interval);
  const r = rgbaStates.get(player.id);
  if (r?.interval) clearInterval(r.interval);
  states.delete(player.id);
  rgbaStates.delete(player.id);
}
