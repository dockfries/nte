import {
  TextDraw,
  TextDrawFontsEnum,
  TextDrawAlignEnum,
  TextDrawEvent,
  InvalidEnum,
} from "@infernus/core";
import type { Player } from "@infernus/core";
import { TextDrawManager } from "../managers/TextDrawManager";
import { HudManager } from "../managers/HudManager";
import { maxPage, pagePos1, pagePos2, pageIndexArray } from "../utils/helpers";
import { getSpriteLibs, type SpriteLib } from "../constants/sprites";
import { COLORS } from "../constants/colors";

// ---------------------------------------------------------------------------
//  Constants (matching PAWN #define)
// ---------------------------------------------------------------------------

const SPRITE_BROWSER_MAX_LIB = 10 as const;
const SPRITE_BROWSER_MAX_ICERIK = 12 as const;

// ---------------------------------------------------------------------------
//  Module-level state
// ---------------------------------------------------------------------------

/** The 33 GUI TextDraw references (same indices as the PAWN original). */
const gui: (TextDraw | null)[] = new Array(33).fill(null);

/** Unique library names extracted from SPRITE_DATA, filled once. */
let spriteLibNames: string[] = [];

/** Items of the currently selected library (set when a library is clicked). */
let spriteLibItems: string[] = [];

/** Count of items in the current library. */
let spriteLibItemsCount = 0;

/** Current left-panel page (1-based). */
let leftPage = 1;

/** Current right-panel page (1-based). */
let rightPage = 1;

/** Cached sprite string returned by SpriteCacheGet(). */
let cachedSelection = "";

/** Flag indicating the browser GUI is currently active. */
let isOpen = false;

/** Optional callback invoked when the browser closes (PAWN: calls NewMenu). */
let closeCallback: (() => void) | null = null;

/** Return value of TextDrawEvent.onPlayerClickGlobal, used to unregister. */
let unsubscribeClick: (() => number | undefined) | null = null;

// ---------------------------------------------------------------------------
//  Helper — create a single GUI TextDraw with common boilerplate
// ---------------------------------------------------------------------------

function createGui(
  index: number,
  x: number,
  y: number,
  text: string,
  font: number,
  letterW: number,
  letterH: number,
  color: number,
  outline: number,
  proportional: boolean,
  shadow: number,
  useBox: boolean,
  boxColor: number,
  bgColor: number,
  textW: number,
  textH: number,
  selectable: boolean,
  alignment = TextDrawAlignEnum.LEFT,
): TextDraw {
  const td = new TextDraw({ x, y, text });
  td.create();
  td.setFont(font as TextDrawFontsEnum);
  td.setLetterSize(letterW, letterH);
  td.setColor(color);
  td.setOutline(outline);
  td.setProportional(proportional);
  td.setShadow(shadow);
  td.useBox(useBox);
  td.setBoxColors(boxColor);
  td.setBackgroundColors(bgColor);
  // Set text size for sprite textdraws (font 4) or boxed text (font 1 with useBox).
  // Boxed text without textSize has no clickable/hover area, causing hover glitches.
  // Title and page counters (font 1, no box) are left auto-sized to avoid wrapping.
  if (font === 4 || useBox) {
    td.setTextSize(textW, textH);
  }
  td.setSelectable(selectable);
  td.setAlignment(alignment);
  gui[index] = td;
  return td;
}

// ---------------------------------------------------------------------------
//  Panel updates
// ---------------------------------------------------------------------------

function updateLeftPanel(): void {
  // Hide all library-name slots [5..14]
  for (let i = 5; i <= 14; i++) {
    if (gui[i]) gui[i]!.hideAll();
  }

  const p1 = pagePos1(leftPage, SPRITE_BROWSER_MAX_LIB);
  const p2 = pagePos2(leftPage, spriteLibNames.length, SPRITE_BROWSER_MAX_LIB);

  for (let i = p1, j = 5; i < p2 && j <= 14; i++, j++) {
    if (gui[j]) {
      gui[j]!.setString(spriteLibNames[i] ?? "");
      gui[j]!.showAll();
    }
  }

  // Update page counter (index 17)
  const maxPg = maxPage(spriteLibNames.length, SPRITE_BROWSER_MAX_LIB);
  if (gui[17]) {
    gui[17]!.setString(`${leftPage} / ${maxPg}`);
    gui[17]!.showAll();
  }
}

function updateRightPanel(): void {
  // Hide all sprite slots [18..29]
  for (let i = 18; i <= 29; i++) {
    if (gui[i]) gui[i]!.hideAll();
  }

  const p1 = pagePos1(rightPage, SPRITE_BROWSER_MAX_ICERIK);
  const p2 = pagePos2(rightPage, spriteLibItemsCount, SPRITE_BROWSER_MAX_ICERIK);

  for (let i = p1, j = 18; i < p2 && j <= 29; i++, j++) {
    if (gui[j]) {
      gui[j]!.setString(spriteLibItems[i] ?? "");
      gui[j]!.showAll();
    }
  }

  // Update page counter (index 32)
  const maxPg = maxPage(spriteLibItemsCount, SPRITE_BROWSER_MAX_ICERIK);
  if (gui[32]) {
    gui[32]!.setString(`${rightPage} / ${maxPg}`);
    gui[32]!.showAll();
  }

  // Show right-panel navigation & page text
  for (const idx of [30, 31, 32] as const) {
    if (gui[idx]) gui[idx]!.showAll();
  }
}

// ---------------------------------------------------------------------------
//  Load a library's sprite items into the right panel
// ---------------------------------------------------------------------------

function loadLibrary(libIndex: number): void {
  const libs = getSpriteLibs();
  if (libIndex < 0 || libIndex >= libs.length) return;
  const lib = libs[libIndex];

  // Copy items
  spriteLibItems = [...lib.items];
  spriteLibItemsCount = lib.items.length;

  // Update header
  if (gui[2]) {
    gui[2]!.setString(`Sprite Browser :: ${lib.name}`);
    gui[2]!.showAll();
  }

  rightPage = 1;
  updateRightPanel();
}

// ---------------------------------------------------------------------------
//  Build all 33 GUI TextDraws
// ---------------------------------------------------------------------------

function createAllGuiElements(): void {
  const sprite = (name: string): string => `mdl-2000:${name}`;

  // ── Top panel ──────────────────────────────────────────────────────────
  // [0]  Background
  createGui(
    0,
    130,
    100,
    "LD_SPAC:white",
    4,
    0.5,
    1,
    1213489407,
    0,
    true,
    1,
    true,
    255,
    255,
    350,
    250,
    false,
  );
  // [1]  Header bar (blue accent)
  createGui(
    1,
    130,
    100,
    "LD_SPAC:white",
    4,
    0.5,
    1,
    153,
    1,
    true,
    0,
    true,
    255,
    -16776961,
    350,
    16,
    false,
  );
  // [2]  Title
  createGui(
    2,
    135,
    103,
    "Sprite Browser",
    1,
    0.17,
    1,
    -136866561,
    1,
    true,
    0,
    false,
    0,
    0,
    195,
    10,
    false,
  );
  // [3]  Close button
  createGui(3, 466, 101, sprite("kapat"), 4, 0.5, 1, -1, 0, true, 1, true, 255, 255, 11, 15, true);

  // ── Left panel ─────────────────────────────────────────────────────────
  // [4]  Left panel background
  createGui(
    4,
    130,
    116,
    "LD_SPAC:white",
    4,
    0.5,
    1,
    80,
    1,
    true,
    0,
    true,
    255,
    -16776961,
    70,
    234,
    false,
  );

  // [5..14]  Library name slots
  const libSlotY = [125, 145, 165, 185, 205, 225, 245, 265, 285, 305];
  for (let i = 0; i < 10; i++) {
    createGui(
      5 + i,
      135,
      libSlotY[i],
      "LOADSC11",
      1,
      0.2,
      1,
      -1,
      1,
      true,
      0,
      true,
      0,
      64,
      195,
      10,
      true,
    );
  }

  // [15]  Left prev page button
  createGui(
    15,
    135,
    332,
    sprite("sol"),
    4,
    0.5,
    1,
    -104192769,
    0,
    true,
    1,
    true,
    255,
    255,
    9,
    15,
    true,
  );
  // [16]  Left next page button
  createGui(
    16,
    188,
    332,
    sprite("sag"),
    4,
    0.5,
    1,
    -104192769,
    0,
    true,
    1,
    true,
    255,
    255,
    9,
    15,
    true,
  );
  // [17]  Left page counter
  createGui(
    17,
    165,
    333,
    "1 / 1",
    1,
    0.21,
    1,
    -846925313,
    1,
    true,
    0,
    false,
    0,
    53,
    0,
    0,
    false,
    TextDrawAlignEnum.CENTER,
  );

  // ── Right panel (sprite slots) ─────────────────────────────────────────
  // [18..29]  4 × 3 grid, each 32×32
  const gridX = [230, 290, 350, 410];
  const gridY = [130, 190, 250];
  let slotIdx = 18;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      createGui(
        slotIdx,
        gridX[col],
        gridY[row],
        "LD_CARD:cd8s",
        4,
        0.5,
        1,
        -1,
        0,
        true,
        1,
        true,
        255,
        255,
        32,
        32,
        true,
      );
      slotIdx++;
    }
  }

  // [30]  Right prev page button
  createGui(
    30,
    295,
    332,
    sprite("sol"),
    4,
    0.5,
    1,
    -104192769,
    0,
    true,
    1,
    true,
    255,
    255,
    9,
    15,
    true,
  );
  // [31]  Right next page button
  createGui(
    31,
    368,
    332,
    sprite("sag"),
    4,
    0.5,
    1,
    -104192769,
    0,
    true,
    1,
    true,
    255,
    255,
    9,
    15,
    true,
  );
  // [32]  Right page counter
  createGui(
    32,
    335,
    333,
    "1 / 5",
    1,
    0.21,
    1,
    -846925313,
    1,
    true,
    0,
    false,
    0,
    53,
    0,
    0,
    false,
    TextDrawAlignEnum.CENTER,
  );
}

// ---------------------------------------------------------------------------
//  Destroy all 33 GUI TextDraws
// ---------------------------------------------------------------------------

function destroyAllGuiElements(): void {
  for (let i = 0; i < gui.length; i++) {
    if (gui[i]) {
      gui[i]!.destroy();
      gui[i] = null;
    }
  }
}

// ---------------------------------------------------------------------------
//  Show/hide all 33 GUI elements
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
//  Global click handler
// ---------------------------------------------------------------------------

function handleClick({
  player: _player,
  textDraw,
  next,
}: {
  player: Player;
  textDraw: InvalidEnum | TextDraw;
  next: () => void;
}): void {
  // If browser is not open, let other handlers process the click
  if (!isOpen) {
    next();
    return;
  }

  // ESC pressed (cancelled selection)
  if (textDraw === InvalidEnum.TEXT_DRAW) {
    SpriteClose();
    if (closeCallback) closeCallback();
    return;
  }

  const td = textDraw as TextDraw;

  // Close button [3]
  if (td === gui[3]) {
    SpriteClose();
    if (closeCallback) closeCallback();
    return;
  }

  // Left panel — prev page [15]
  if (td === gui[15]) {
    if (--leftPage < 1) leftPage = 1;
    updateLeftPanel();
    return;
  }

  // Left panel — next page [16]
  if (td === gui[16]) {
    const maxPg = maxPage(spriteLibNames.length, SPRITE_BROWSER_MAX_LIB);
    if (++leftPage > maxPg) leftPage = maxPg;
    updateLeftPanel();
    return;
  }

  // Left panel — library slots [5..14]
  for (let i = 5, j = 0; i <= 14; i++, j++) {
    if (td === gui[i]) {
      const index = pageIndexArray(leftPage, SPRITE_BROWSER_MAX_LIB, j);
      if (index >= 0 && index < spriteLibNames.length) {
        loadLibrary(index);
      }
      return;
    }
  }

  // Right panel — prev page [30]
  if (td === gui[30]) {
    if (--rightPage < 1) rightPage = 1;
    updateRightPanel();
    return;
  }

  // Right panel — next page [31]
  if (td === gui[31]) {
    const maxPg = maxPage(spriteLibItemsCount, SPRITE_BROWSER_MAX_ICERIK);
    if (++rightPage > maxPg) rightPage = maxPg;
    updateRightPanel();
    return;
  }

  // Right panel — sprite slots [18..29]
  for (let i = 18, j = 0; i <= 29; i++, j++) {
    if (td === gui[i]) {
      const index = pageIndexArray(rightPage, SPRITE_BROWSER_MAX_ICERIK, j);
      if (index >= 0 && index < spriteLibItemsCount) {
        // Cache the selected sprite, create it, then close the browser.
        // PAWN: SpriteCreate → SpriteClose → NewMenu. Closing after creation
        // ensures the HUD rebuild in SpriteClose reflects the new selection.
        cachedSelection = spriteLibItems[index];
        _player.selectTextDraw(COLORS.MOUSE_DEFAULT);
        TextDrawManager.createSprite(cachedSelection);
        SpriteClose();
      }
      return;
    }
  }
}

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

/**
 * Opens the sprite browser for a player, creating all 33 GUI TextDraw elements
 * and entering textdraw selection mode.
 * @param onClose Optional callback invoked when the browser is closed (PAWN: invokes NewMenu)
 */
export function openSpriteBrowser(player: Player, onClose?: () => void): void {
  // Ensure sprite library is initialised
  const libs = getSpriteLibs();
  spriteLibNames = libs.map((l: SpriteLib) => l.name);

  // Remove existing HUD and textdraws
  HudManager.removeAll();
  TextDrawManager.removeAll();

  // Destroy any leftover GUI elements (defensive)
  destroyAllGuiElements();

  // Reset state
  leftPage = 1;
  rightPage = 1;
  spriteLibItems = [];
  spriteLibItemsCount = 0;
  cachedSelection = "";

  // Create all 33 GUI TextDraws
  createAllGuiElements();

  // Populate left panel with libraries
  updateLeftPanel();

  // Show only the left panel (0-17); right panel (18-32) stays hidden
  // until a library is selected (PAWN: for(new i = 0; i <= 17; i++) TextDrawShowForAll)
  for (let i = 0; i <= 17; i++) {
    if (gui[i]) gui[i]!.showAll();
  }

  // Enter selection mode so the player can click GUI elements
  player.selectTextDraw(COLORS.MOUSE_DEFAULT);

  // Mark as open
  isOpen = true;
  closeCallback = onClose ?? null;

  // Register the click handler if not already registered
  if (!unsubscribeClick) {
    const handler: Parameters<typeof TextDrawEvent.onPlayerClickGlobal>[0] = (ret) => {
      handleClick({
        player: ret.player,
        textDraw: ret.textDraw,
        next: () => ret.next(),
      });
    };
    unsubscribeClick = TextDrawEvent.onPlayerClickGlobal(handler);
  }
}

/**
 * Destroys the sprite browser GUI, restores the HUD and textdraws,
 * and exits selection mode.
 */
export function SpriteClose(): void {
  if (!isOpen) return;
  isOpen = false;
  closeCallback = null;

  // Unregister click handler
  if (unsubscribeClick) {
    unsubscribeClick();
    unsubscribeClick = null;
  }

  // Destroy all GUI TextDraws
  destroyAllGuiElements();

  // Clear loaded item state
  spriteLibItems = [];
  spriteLibItemsCount = 0;
  leftPage = 1;
  rightPage = 1;

  // Restore HUD and textdraws
  HudManager.rebuild(true);
  TextDrawManager.showAll();

  // Show info text again
  HudManager.createInfoText();
}

/**
 * Returns the last selected sprite string (e.g. "LD_SPAC:white").
 */
export function SpriteCacheGet(): string {
  return cachedSelection;
}
