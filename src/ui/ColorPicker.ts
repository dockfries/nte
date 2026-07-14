import { Dialog, DialogStylesEnum } from "@infernus/core";
import type { Player } from "@infernus/core";
import { TextDrawManager } from "../managers/TextDrawManager";
import { UndoRedoManager } from "../managers/UndoRedoManager";
import { HudManager } from "../managers/HudManager";
import { COLOR_PALETTE } from "../constants/colors";
import { formatHex, rgbaToHex, restoreMouse } from "../utils/helpers";
import { getRgbaState, getState } from "../state";
import { getPlayerLocale } from "../features/spawn";
import { enterInteractive } from "../features/interactive";
import { $t } from "../i18n";

export async function showColorMenu(player: Player, mode: number) {
  const locale = getPlayerLocale(player);
  // mode: 0=text color, 1=bg color, 2=box color
  let lines = `${$t("grouping.content_41", null, locale)}\n${$t("grouping.content_42", null, locale)}\n${$t("grouping.content_43", null, locale)}\n${$t("color.content", null, locale)}\n-----------------------\n`;
  for (let i = 0; i < COLOR_PALETTE.length; i++) {
    const color = COLOR_PALETTE[i];
    const hex = (color >>> 8).toString(16).padStart(6, "0");
    lines += `{${hex}}${i + 1} - ##########\n`;
  }

  try {
    const dlg = new Dialog({
      style: DialogStylesEnum.LIST,
      caption: $t("color.title", null, locale),
      info: lines,
      button1: $t("color.btn1", null, locale),
      button2: $t("color.btn2", null, locale),
    });
    const { response, listItem } = await dlg.show(player);
    if (!response) {
      restoreMouse(player);
      return;
    }

    const id = TextDrawManager.selectedId;
    if (id === -1) return;

    if (listItem === 0) await showHexInput(player, mode);
    else if (listItem === 1) await showRgbInput(player, mode);
    else if (listItem === 2) await showRgbaInput(player, mode);
    else if (listItem === 3) startRgbaKeys(player, mode);
    else if (listItem === 4) await showColorMenu(player, mode);
    else {
      const color = COLOR_PALETTE[listItem - 5];
      const data = TextDrawManager.getData(id);
      if (!data) return;
      const oldVal = mode === 0 ? data.color : mode === 1 ? data.bgColor : data.boxColor;
      if (oldVal !== color) {
        UndoRedoManager.add(id);
      }
      TextDrawManager.updateProperty(id, (td) => {
        if (mode === 0) td.color = color;
        else if (mode === 1) td.bgColor = color;
        else td.boxColor = color;
      });
      HudManager.rebuild(true);
    }
  } catch {
    void 0;
  }
}

async function showHexInput(player: Player, mode: number) {
  const locale = getPlayerLocale(player);
  try {
    const dlg = new Dialog({
      style: DialogStylesEnum.INPUT,
      caption: $t("color_hex.title", null, locale),
      info: `${$t("color_hex.content_1", null, locale)}\n${$t("color_hex.content_2", null, locale)}\n${$t("color_hex.content_3", null, locale)}\n${$t("color_hex.content_4", null, locale)}\n${$t("color_hex.content_5", null, locale)}\n${$t("color_hex.content_6", null, locale)}`,
      button1: $t("color_hex.btn_1", null, locale),
      button2: $t("color_hex.btn_2", null, locale),
    });
    const { response, inputText } = await dlg.show(player);
    if (!response) return showColorMenu(player, mode);
    if (!inputText) return showHexInput(player, mode);

    const result = formatHex(inputText);
    if (result.error) return showHexInput(player, mode);

    const id = TextDrawManager.selectedId;
    if (id === -1) return;

    TextDrawManager.updateProperty(id, (td) => {
      const oldVal = mode === 0 ? td.color : mode === 1 ? td.bgColor : td.boxColor;
      if (oldVal !== result.hex) UndoRedoManager.add(id);
      if (mode === 0) td.color = result.hex;
      else if (mode === 1) td.bgColor = result.hex;
      else td.boxColor = result.hex;
    });
  } catch {
    void 0;
  }
}

async function showRgbInput(player: Player, mode: number) {
  const locale = getPlayerLocale(player);
  try {
    const dlg = new Dialog({
      style: DialogStylesEnum.INPUT,
      caption: $t("color_rgb.title", null, locale),
      info: `${$t("color_rgb.content_1", null, locale)}\n${$t("color_rgb.content_2", null, locale)}\n${$t("color_rgb.content_3", null, locale)}\n${$t("color_rgb.content_4", null, locale)}\n${$t("color_rgb.content_5", null, locale)}`,
      button1: $t("color_rgb.btn_1", null, locale),
      button2: $t("color_rgb.btn_2", null, locale),
    });
    const { response, inputText } = await dlg.show(player);
    if (!response) return showColorMenu(player, mode);
    if (!inputText) return showRgbInput(player, mode);

    let s = inputText.replace(/rgb\(/gi, "").replace(/\)/g, "").trim();
    s = s.replace(/,\s*/g, " ");
    const parts = s.split(/\s+/).map(Number);
    if (parts.length !== 3 || parts.some((p) => isNaN(p) || p < 0 || p > 255))
      return showRgbInput(player, mode);

    const color = rgbaToHex(parts[0], parts[1], parts[2], 255);
    const id = TextDrawManager.selectedId;
    if (id === -1) return;

    TextDrawManager.updateProperty(id, (td) => {
      const oldVal = mode === 0 ? td.color : mode === 1 ? td.bgColor : td.boxColor;
      if (oldVal !== color) UndoRedoManager.add(id);
      if (mode === 0) td.color = color;
      else if (mode === 1) td.bgColor = color;
      else td.boxColor = color;
    });
  } catch {
    void 0;
  }
}

async function showRgbaInput(player: Player, mode: number) {
  const locale = getPlayerLocale(player);
  try {
    const dlg = new Dialog({
      style: DialogStylesEnum.INPUT,
      caption: $t("color_rgba.title", null, locale),
      info: `${$t("color_rgba.content_1", null, locale)}\n${$t("color_rgba.content_2", null, locale)}\n${$t("color_rgba.content_3", null, locale)}\n${$t("color_rgba.content_4", null, locale)}\n${$t("color_rgba.content_5", null, locale)}\n${$t("color_rgba.content_6", null, locale)}`,
      button1: $t("color_rgba.btn_1", null, locale),
      button2: $t("color_rgba.btn_2", null, locale),
    });
    const { response, inputText } = await dlg.show(player);
    if (!response) return showColorMenu(player, mode);
    if (!inputText) return showRgbaInput(player, mode);

    let s = inputText
      .replace(/rgba\(/gi, "")
      .replace(/\)/g, "")
      .trim();
    s = s.replace(/,\s*/g, " ");
    const parts = s.split(/\s+/).map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255))
      return showRgbaInput(player, mode);

    const color = rgbaToHex(parts[0], parts[1], parts[2], parts[3]);
    const id = TextDrawManager.selectedId;
    if (id === -1) return;

    TextDrawManager.updateProperty(id, (td) => {
      const oldVal = mode === 0 ? td.color : mode === 1 ? td.bgColor : td.boxColor;
      if (oldVal !== color) UndoRedoManager.add(id);
      if (mode === 0) td.color = color;
      else if (mode === 1) td.bgColor = color;
      else td.boxColor = color;
    });
  } catch {
    void 0;
  }
}

function startRgbaKeys(player: Player, mode: number) {
  const id = TextDrawManager.selectedId;
  if (id === -1) return;
  const data = TextDrawManager.getData(id);
  if (!data) return;

  const rs = getRgbaState(player);
  // Clear any lingering RGBA timer before starting a new one
  if (rs.interval) {
    clearInterval(rs.interval);
    rs.interval = undefined;
  }
  rs.mode = mode;
  rs.index = 0;

  // Save undo before making changes
  UndoRedoManager.add(id);

  // Enter interactive mode: hides HUD, disables mouse, freezes player in world mode
  enterInteractive(player);

  const updateDisplay = () => {
    const cur =
      mode === 0
        ? TextDrawManager.getData(id)?.color
        : mode === 1
          ? TextDrawManager.getData(id)?.bgColor
          : TextDrawManager.getData(id)?.boxColor;
    if (cur === undefined) return;
    const r = (cur >>> 24) & 0xff,
      g = (cur >>> 16) & 0xff,
      b = (cur >>> 8) & 0xff,
      a = cur & 0xff;
    const idx = rs.index;
    // PAWN uses GameText ~code~ format in TextDrawSetString (font 1 supports it):
    //   ~r~~h~ = red half-bright (selected channel label)
    //   ~g~~h~ = green half-bright (other channel labels)
    //   ~w~~h~ = white half-bright (all values)
    //   separator is three spaces
    const names = ["R", "G", "B", "A"];
    const vals = [r, g, b, a];
    const info = names
      .map(
        (name, i) =>
          `${i === idx ? "~r~~h~" : "~g~~h~"}${name}: ~w~~h~${vals[i]}`,
      )
      .join("   ");
    HudManager.setInfoText(info);
  };
  updateDisplay();
  HudManager.updateInfoTick();

  // Set the mode so confirmMode/keyboard handler can dispatch correctly.
  // Store interval in s.interval so setMode() / cleanup() will clear it automatically.
  const s = getState(player);
  if (s.interval) {
    clearInterval(s.interval);
    s.interval = undefined;
  }
  s.mode = "rgba";

  let lastSwitch = 0;
  s.interval = setInterval(() => {
    const keys = player.getKeys();
    const now = Date.now();

    // LEFT/RIGHT: switch channel (with 200ms throttle)
    if (keys.leftRight < -1 && now > lastSwitch + 200) {
      lastSwitch = now;
      rs.index = rs.index <= 0 ? 0 : rs.index - 1;
    }
    if (keys.leftRight > 1 && now > lastSwitch + 200) {
      lastSwitch = now;
      rs.index = rs.index >= 3 ? 3 : rs.index + 1;
    }

    // UP/DOWN: change value
    if (keys.upDown < -1) {
      const cur =
        mode === 0
          ? TextDrawManager.getData(id)?.color
          : mode === 1
            ? TextDrawManager.getData(id)?.bgColor
            : TextDrawManager.getData(id)?.boxColor;
      if (cur === undefined) return;
      const comp = [(cur >>> 24) & 0xff, (cur >>> 16) & 0xff, (cur >>> 8) & 0xff, cur & 0xff];
      comp[rs.index] = comp[rs.index] >= 255 ? 255 : comp[rs.index] + 1;
      const newColor = rgbaToHex(comp[0], comp[1], comp[2], comp[3]);
      TextDrawManager.updatePropertyAnim(id, (td) => {
        if (mode === 0) td.color = newColor;
        else if (mode === 1) td.bgColor = newColor;
        else td.boxColor = newColor;
      });
    }
    if (keys.upDown > 1) {
      const cur =
        mode === 0
          ? TextDrawManager.getData(id)?.color
          : mode === 1
            ? TextDrawManager.getData(id)?.bgColor
            : TextDrawManager.getData(id)?.boxColor;
      if (cur === undefined) return;
      const comp = [(cur >>> 24) & 0xff, (cur >>> 16) & 0xff, (cur >>> 8) & 0xff, cur & 0xff];
      comp[rs.index] = comp[rs.index] <= 0 ? 0 : comp[rs.index] - 1;
      const newColor = rgbaToHex(comp[0], comp[1], comp[2], comp[3]);
      TextDrawManager.updatePropertyAnim(id, (td) => {
        if (mode === 0) td.color = newColor;
        else if (mode === 1) td.bgColor = newColor;
        else td.boxColor = newColor;
      });
    }

    updateDisplay();
  }, 50);
}
