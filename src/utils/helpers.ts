import type { Player } from "@infernus/core";
import { COLORS } from "../constants/colors";
import { CONFIG } from "../constants/config";
import { getState } from "../state";

/** Restore textdraw selection mode after dialog cancel (PAWN: SetMouse(playerid, true, TEXTMODE_NORMAL)) */
export function restoreMouse(player: Player) {
  getState(player).mouseEnabled = true;
  player.selectTextDraw(COLORS.MOUSE_DEFAULT);
}

export function clearChat(player: Player, lines = 50) {
  for (let i = 0; i < lines; i++) {
    player.sendClientMessage(-1, " ");
  }
}

export function msgError(player: Player, msg: string) {
  clearChat(player);
  player.sendClientMessage(COLORS.MSG_ERROR, `[!] {FFFFFF}${msg}`);
}

export function msgInfo(player: Player, msg: string) {
  clearChat(player);
  player.sendClientMessage(COLORS.MSG_INFO, `[!] {FFFFFF}${msg}`);
}

export function fileNameCheck(name: string): boolean {
  return /[\\/:*?"<>|]/.test(name);
}

export function pagePos1(page: number, limit: number): number {
  if (page <= 0) page = 1;
  return (page - 1) * limit;
}

export function pagePos2(page: number, total: number, limit: number): number {
  const pos = page * limit;
  return pos >= total ? total : pos;
}

export function maxPage(total: number, limit: number): number {
  if (total <= 0) return 1;
  return Math.floor((total - 1) / limit) + 1;
}

export function pageIndexArray(page: number, limit: number, index: number): number {
  return (page - 1) * limit + index;
}

export function getDateString(epoch: number): string {
  const d = new Date(epoch * 1000);
  d.setHours(d.getHours() + CONFIG.GMT_TIME);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  const hr = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day}.${mon}.${year}, ${hr}:${min}`;
}

export function formatHex(input: string): { hex: number; error?: string } {
  // Strip # or 0x prefix
  let buffer = input.trim().toUpperCase();
  if (buffer.startsWith("0X")) buffer = buffer.slice(2);
  else if (buffer.startsWith("#")) buffer = buffer.slice(1);

  // Validate hex characters only
  if (!/^[0-9A-F]+$/.test(buffer)) return { hex: 0, error: "Invalid hex characters" };

  const len = buffer.length;
  if (len === 6) {
    // RRGGBB → RRGGBBFF (full alpha)
    buffer += "FF";
  } else if (len === 8) {
    // RRGGBBAA → use as-is
  } else {
    return { hex: 0, error: "Hex must be 6 (RRGGBB) or 8 (RRGGBBAA) characters" };
  }

  const hex = parseInt(buffer, 16);
  if (isNaN(hex) || hex < 0) return { hex: 0, error: "Invalid hex value" };
  return { hex };
}

export function rgbaToHex(r: number, g: number, b: number, a: number): number {
  return ((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff);
}

export function hexToRgba(color: number): [number, number, number, number] {
  return [(color >>> 24) & 0xff, (color >>> 16) & 0xff, (color >>> 8) & 0xff, color & 0xff];
}

// Font and alignment helpers for open.mp export
export function ompAlignmentString(align: number): string {
  switch (align) {
    case 1:
      return "TEXT_DRAW_ALIGN_LEFT";
    case 2:
      return "TEXT_DRAW_ALIGN_CENTER";
    case 3:
      return "TEXT_DRAW_ALIGN_RIGHT";
    default:
      return "TEXT_DRAW_ALIGN_LEFT";
  }
}

export function ompAlignmentInt(str: string): number {
  if (str === "TEXT_DRAW_ALIGN_LEFT") return 1;
  if (str === "TEXT_DRAW_ALIGN_CENTER") return 2;
  if (str === "TEXT_DRAW_ALIGN_RIGHT") return 3;
  return 1;
}

export function ompFontString(font: number): string {
  switch (font) {
    case 0:
      return "TEXT_DRAW_FONT_0";
    case 1:
      return "TEXT_DRAW_FONT_1";
    case 2:
      return "TEXT_DRAW_FONT_2";
    case 3:
      return "TEXT_DRAW_FONT_3";
    case 4:
      return "TEXT_DRAW_FONT_SPRITE_DRAW";
    case 5:
      return "TEXT_DRAW_FONT_MODEL_PREVIEW";
    default:
      return "TEXT_DRAW_FONT_0";
  }
}

export function ompFontInt(str: string): number {
  if (str === "TEXT_DRAW_FONT_0") return 0;
  if (str === "TEXT_DRAW_FONT_1") return 1;
  if (str === "TEXT_DRAW_FONT_2") return 2;
  if (str === "TEXT_DRAW_FONT_3") return 3;
  if (str === "TEXT_DRAW_FONT_SPRITE_DRAW") return 4;
  if (str === "TEXT_DRAW_FONT_MODEL_PREVIEW") return 5;
  return 0;
}
