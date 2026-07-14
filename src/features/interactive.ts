import { Dialog, DialogStylesEnum, KeysEnum } from "@infernus/core";
import type { Player } from "@infernus/core";
import { TextDrawManager } from "../managers/TextDrawManager";
import { HudManager } from "../managers/HudManager";
import { UndoRedoManager } from "../managers/UndoRedoManager";
import * as DB from "../services/DatabaseService";
import { msgError, msgInfo, formatHex } from "../utils/helpers";
import { COLORS } from "../constants/colors";
import { getState, setMode, getRgbaState, type PlayerState } from "../state";
import { showIndexSwapManual } from "../ui/ListDialogs";
import { $t } from "../i18n";
import { getPlayerLocale } from "./spawn";

// ─── Helpers for interactive mode lifecycle ───

export function enterInteractive(player: Player) {
  const s = getState(player);
  // Hide HUD toolbar and disable mouse (matching PAWN behavior)
  HudManager.hideAll();
  player.cancelSelectTextDraw();
  // PAWN: freeze player in world mode so keys are only processed by the mode timer
  if (s.spawnMode === 1) {
    player.toggleControllable(false);
  }
  // Save whether mouse was on, so exitInteractive can restore it
  s.backupData = { ...s.backupData, _mouseSaved: s.mouseEnabled !== false } as Record<
    string,
    unknown
  >;
  s.mouseEnabled = false;
}

function exitInteractive(player: Player) {
  const s = getState(player);
  // PAWN: unfreeze player when leaving interactive mode (world mode only)
  if (s.spawnMode === 1) {
    player.toggleControllable(true);
  }
  HudManager.rebuild(true);
  HudManager.createInfoText();
  // Restore mouse state from before entering interactive mode
  const mouseWasOn = (s.backupData?._mouseSaved as boolean | undefined) ?? true;
  s.mouseEnabled = mouseWasOn;
  if (mouseWasOn) {
    player.selectTextDraw(COLORS.MOUSE_DEFAULT);
  }
}

// ─── Single TD Interactive Modes ───

function startGeneric(player: Player, mode: PlayerState["mode"], _label: string) {
  const id = TextDrawManager.selectedId;
  if (id < 0) return;
  // Save undo BEFORE making changes (stores the current state as snapshot)
  UndoRedoManager.add(id);
  setMode(player, mode);
  enterInteractive(player);
  const locale = getPlayerLocale(player);
  msgInfo(player, $t("interactive.start", null, locale));
  return id;
}

export function startPos(player: Player) {
  const id = startGeneric(player, "pos", "move");
  if (id === undefined) return;
  const s = getState(player);
  s.interval = setInterval(() => {
    HudManager.hideInfoText();
    if (s.mode !== "pos") return;
    const keys = player.getKeys();
    const speed = (keys.keys & KeysEnum.SPRINT) !== 0 ? 10 : 1;
    let moved = false;
    // Position changes require destroy/recreate (no setPosition in SA:MP API)
    if (keys.leftRight < -1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.pos[0] -= speed;
      });
      moved = true;
    }
    if (keys.leftRight > 1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.pos[0] += speed;
      });
      moved = true;
    }
    if (keys.upDown < -1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.pos[1] -= speed;
      });
      moved = true;
    }
    if (keys.upDown > 1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.pos[1] += speed;
      });
      moved = true;
    }
    if (moved) {
      const d = TextDrawManager.getData(id);
      HudManager.setInfoText(
        `~g~~h~X: ~w~~h~${d!.pos[0].toFixed(2)}     ~g~~h~Y: ~w~~h~${d!.pos[1].toFixed(2)}`,
      );
    }
  }, 30);
}

export function startTS(player: Player) {
  const id = startGeneric(player, "ts", "size");
  if (id === undefined) return;
  const s = getState(player);
  s.interval = setInterval(() => {
    HudManager.hideInfoText();
    if (s.mode !== "ts") return;
    const keys = player.getKeys();
    const speed = (keys.keys & KeysEnum.SPRINT) !== 0 ? 10 : 1;
    let moved = false;
    if (keys.leftRight < -1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.textSize[0] -= speed;
      });
      moved = true;
    }
    if (keys.leftRight > 1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.textSize[0] += speed;
      });
      moved = true;
    }
    if (keys.upDown < -1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.textSize[1] -= speed;
      });
      moved = true;
    }
    if (keys.upDown > 1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.textSize[1] += speed;
      });
      moved = true;
    }
    if (moved) {
      const d = TextDrawManager.getData(id);
      HudManager.setInfoText(
        `~g~~h~X: ~w~~h~${d!.textSize[0].toFixed(2)}     ~g~~h~Y: ~w~~h~${d!.textSize[1].toFixed(2)}`,
      );
    }
  }, 30);
}

export function startLS(player: Player) {
  const id = startGeneric(player, "ls", "letter size");
  if (id === undefined) return;
  const s = getState(player);
  s.interval = setInterval(() => {
    HudManager.hideInfoText();
    if (s.mode !== "ls") return;
    const keys = player.getKeys();
    const sprint = (keys.keys & KeysEnum.SPRINT) !== 0;
    const sx = sprint ? 0.1 : 0.01;
    const sy = sprint ? 1.0 : 0.1;
    let moved = false;
    if (keys.leftRight < -1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.letterSize[0] -= sx;
      });
      moved = true;
    }
    if (keys.leftRight > 1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.letterSize[0] += sx;
      });
      moved = true;
    }
    if (keys.upDown < -1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.letterSize[1] -= sy;
      });
      moved = true;
    }
    if (keys.upDown > 1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.letterSize[1] += sy;
      });
      moved = true;
    }
    if (moved) {
      const d = TextDrawManager.getData(id);
      HudManager.setInfoText(
        `~g~~h~X: ~w~~h~${d!.letterSize[0].toFixed(2)}     ~g~~h~Y: ~w~~h~${d!.letterSize[1].toFixed(2)}`,
      );
    }
  }, 30);
}

export function startOL(player: Player) {
  const id = startGeneric(player, "ol", "outline");
  if (id === undefined) return;
  const s = getState(player);
  s.interval = setInterval(() => {
    HudManager.hideInfoText();
    if (s.mode !== "ol") return;
    const keys = player.getKeys();
    const speed = (keys.keys & KeysEnum.SPRINT) !== 0 ? 5 : 1;
    let moved = false;
    if (keys.leftRight < -1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.outline = Math.max(0, td.outline - speed);
      });
      moved = true;
    }
    if (keys.leftRight > 1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.outline += speed;
      });
      moved = true;
    }
    if (moved) {
      const d = TextDrawManager.getData(id);
      HudManager.setInfoText(`~g~~h~Outline: ~w~~h~${d!.outline}`);
    }
  }, 30);
}

export function startSH(player: Player) {
  const id = startGeneric(player, "sh", "shadow");
  if (id === undefined) return;
  const s = getState(player);
  s.interval = setInterval(() => {
    HudManager.hideInfoText();
    if (s.mode !== "sh") return;
    const keys = player.getKeys();
    const speed = (keys.keys & KeysEnum.SPRINT) !== 0 ? 5 : 1;
    let moved = false;
    if (keys.leftRight < -1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.shadow = Math.max(0, td.shadow - speed);
      });
      moved = true;
    }
    if (keys.leftRight > 1) {
      TextDrawManager.updatePropertyAnim(id, (td) => {
        td.shadow += speed;
      });
      moved = true;
    }
    if (moved) {
      const d = TextDrawManager.getData(id);
      HudManager.setInfoText(`~g~~h~Shadow: ~w~~h~${d!.shadow}`);
    }
  }, 30);
}

// ─── Preview Models Interactive ───

export function startPreviewModels(player: Player, propertyIndex: number) {
  const id = TextDrawManager.selectedId;
  if (id < 0) return;
  // Save undo
  UndoRedoManager.add(id);
  const s = getState(player);
  setMode(player, "pmodel");
  s.selId = propertyIndex; // reuse selId to store the property index
  enterInteractive(player);
  const locale = getPlayerLocale(player); msgInfo(player, $t("interactive.start_pmodel", null, locale));

  const data = TextDrawManager.getData(id);
  if (!data) return;

  const labels = ["Model ID", "X", "Y", "Z", "Zoom", "Vehicle Color 1", "Vehicle Color 2"];
  const label = labels[propertyIndex] ?? "Property";

  // Show initial value
  let valStr = "";
  switch (propertyIndex) {
    case 0:
      valStr = String(data.previewModel);
      break;
    case 1:
      valStr = data.previewRot[0].toFixed(2);
      break;
    case 2:
      valStr = data.previewRot[1].toFixed(2);
      break;
    case 3:
      valStr = data.previewRot[2].toFixed(2);
      break;
    case 4:
      valStr = data.previewRot[3].toFixed(2);
      break;
    case 5:
      valStr = String(data.previewVc[0]);
      break;
    case 6:
      valStr = String(data.previewVc[1]);
      break;
  }
  HudManager.setInfoText(`${label}: ${valStr}`);

  s.interval = setInterval(() => {
    HudManager.hideInfoText();
    if (s.mode !== "pmodel" || s.selId === undefined) return;
    const keys = player.getKeys();
    const sprint = (keys.keys & KeysEnum.SPRINT) !== 0;

    const doUpdate = () => {
      const d = TextDrawManager.getData(id);
      if (!d) return;
      switch (propertyIndex) {
        case 0:
          HudManager.setInfoText(`Model ID: ${d.previewModel}`);
          break;
        case 1:
          HudManager.setInfoText(`X: ${d.previewRot[0].toFixed(2)}`);
          break;
        case 2:
          HudManager.setInfoText(`Y: ${d.previewRot[1].toFixed(2)}`);
          break;
        case 3:
          HudManager.setInfoText(`Z: ${d.previewRot[2].toFixed(2)}`);
          break;
        case 4:
          HudManager.setInfoText(`Zoom: ${d.previewRot[3].toFixed(2)}`);
          break;
        case 5:
          HudManager.setInfoText(`Vehicle Color 1: ${d.previewVc[0]}`);
          break;
        case 6:
          HudManager.setInfoText(`Vehicle Color 2: ${d.previewVc[1]}`);
          break;
      }
    };

    if (keys.leftRight < -1) {
      const stepI = sprint ? 5 : 1;
      const stepF = sprint ? 5.0 : propertyIndex === 4 ? 0.1 : 1.0;
      switch (propertyIndex) {
        case 0:
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.previewModel -= stepI;
          });
          break;
        case 1:
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.previewRot[0] -= stepF;
          });
          break;
        case 2:
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.previewRot[1] -= stepF;
          });
          break;
        case 3:
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.previewRot[2] -= stepF;
          });
          break;
        case 4:
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.previewRot[3] -= stepF;
          });
          break;
        case 5:
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.previewVc[0] -= stepI;
          });
          break;
        case 6:
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.previewVc[1] -= stepI;
          });
          break;
      }
      doUpdate();
    }
    if (keys.leftRight > 1) {
      const stepI = sprint ? 5 : 1;
      const stepF = sprint ? 5.0 : propertyIndex === 4 ? 0.1 : 1.0;
      switch (propertyIndex) {
        case 0:
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.previewModel += stepI;
          });
          break;
        case 1:
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.previewRot[0] += stepF;
          });
          break;
        case 2:
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.previewRot[1] += stepF;
          });
          break;
        case 3:
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.previewRot[2] += stepF;
          });
          break;
        case 4:
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.previewRot[3] += stepF;
          });
          break;
        case 5:
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.previewVc[0] += stepI;
          });
          break;
        case 6:
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.previewVc[1] += stepI;
          });
          break;
      }
      doUpdate();
    }
  }, 30);
}

// ─── Undo Browse ───

export function startUndo(player: Player) {
  const locale = getPlayerLocale(player);
  const id = TextDrawManager.selectedId;
  if (id < 0) return;
  UndoRedoManager.load(id);
  if (UndoRedoManager.total === 0) {
    msgError(player, $t("interactive.no_undo", null, locale));
    return;
  }
  const s = getState(player);
  setMode(player, "undo");
  enterInteractive(player);
  const data = TextDrawManager.getData(id);
  s.backupData = data ? { ...data } : {};
  const entry = UndoRedoManager.applyToTextDraw(id);
  if (entry)
    TextDrawManager.updateProperty(id, (td) => {
      Object.assign(td, entry);
    });
  HudManager.setInfoText(`~g~~h~Index: ~w~~h~1 / ${UndoRedoManager.total}`);
  msgInfo(player, $t("interactive.start_undo", null, locale));
  s.interval = setInterval(() => {
    HudManager.hideInfoText();
    if (s.mode !== "undo") return;
    const keys = player.getKeys();
    if (keys.leftRight < -1) {
      UndoRedoManager.goPrev();
      const e = UndoRedoManager.applyToTextDraw(id);
      if (e)
        TextDrawManager.updatePropertyAnim(id, (td) => {
          Object.assign(td, e);
        });
      HudManager.setInfoText(`~g~~h~Index: ~w~~h~${UndoRedoManager.currentIndex + 1} / ${UndoRedoManager.total}`);
	    }
	    if (keys.leftRight > 1) {
	      UndoRedoManager.goNext();
	      const e = UndoRedoManager.applyToTextDraw(id);
	      if (e)
	        TextDrawManager.updatePropertyAnim(id, (td) => {
	          Object.assign(td, e);
	        });
	      HudManager.setInfoText(`~g~~h~Index: ~w~~h~${UndoRedoManager.currentIndex + 1} / ${UndoRedoManager.total}`);
    }
  }, 85);
}

// ─── Confirm & Manual ───

export async function confirmMode(player: Player, s: PlayerState) {
  const locale = getPlayerLocale(player);
  const id = TextDrawManager.selectedId;
  const prevMode = s.mode;
  setMode(player, "none");
  if (
    prevMode === "pos" ||
    prevMode === "ts" ||
    prevMode === "ls" ||
    prevMode === "ol" ||
    prevMode === "sh" ||
    prevMode === "rgba" ||
    prevMode === "pmodel"
  ) {
    // Save final state to DB (all tick-based modes use updatePropertyAnim
    // which doesn't write to DB on each tick; DB write happens here on confirm)
	    if (id >= 0) {
      const data = TextDrawManager.getData(id);
      if (data) DB.updateTextDraw(data);
    }
    msgInfo(player, $t("interactive.saved", null, locale));
  } else if (prevMode === "sel" && s.selId !== undefined) {
    TextDrawManager.selectedId = s.selId;
    TextDrawManager.previewReset(s.selId);
    msgInfo(player, $t("interactive.selected", [String(s.selId)], locale));
  } else if (prevMode === "swap" && s.swapIndex !== undefined) {
    TextDrawManager.selectedId = s.swapIndex;
    msgInfo(player, $t("interactive.index", [String(s.swapIndex)], locale));
  } else if (prevMode === "undo") {
    try {
      const dlg = new Dialog({
        style: DialogStylesEnum.MSGBOX,
        caption: $t("interactive.confirm_title"),
        info: $t("interactive.confirm_info"),
        button1: $t("interactive.confirm_yes"),
        button2: $t("interactive.confirm_no"),
      });
      const resp = await dlg.show(player);
      if (resp.response) {
        UndoRedoManager.confirm(id);
        // Persist the restored state to DB (the "No" branch already saves via updateProperty)
        if (id >= 0) {
          const data = TextDrawManager.getData(id);
          if (data) DB.updateTextDraw(data);
        }
        msgInfo(player, $t("interactive.saved_undo", null, locale));
      } else {
        if (s.backupData)
          TextDrawManager.updateProperty(id, (td) => {
            Object.assign(td, s.backupData);
          });
        msgInfo(player, $t("interactive.cancelled", null, locale));
      }
    } catch {
      void 0;
    }
  }
  exitInteractive(player);
}

export async function manualMode(player: Player, s: PlayerState) {
  const id = TextDrawManager.selectedId;
  if (id < 0) return;
  const locale = getPlayerLocale(player);
  try {
    if (s.mode === "pos") {
      const d = TextDrawManager.getData(id);
      const dlg = new Dialog({
        style: DialogStylesEnum.INPUT,
        caption: $t("size.title", null, locale),
        info: `X Y: ${d!.pos[0].toFixed(2)} ${d!.pos[1].toFixed(2)}`,
        button1: $t("interactive.btn_set"),
        button2: $t("interactive.btn_back"),
      });
      const resp = await dlg.show(player);
      if (resp.response && resp.inputText) {
        const parts = resp.inputText.split(/\s+/).map(Number);
        if (parts.length >= 1 && !isNaN(parts[0]))
          TextDrawManager.updateProperty(id, (td) => {
            td.pos[0] = parts[0];
            if (parts[1] !== undefined && !isNaN(parts[1])) td.pos[1] = parts[1];
          });
      }
    } else if (s.mode === "ts") {
      const d = TextDrawManager.getData(id);
      const dlg = new Dialog({
        style: DialogStylesEnum.INPUT,
        caption: $t("size.title", null, locale),
        info: `X Y: ${d!.textSize[0].toFixed(2)} ${d!.textSize[1].toFixed(2)}`,
        button1: $t("interactive.btn_set"),
        button2: $t("interactive.btn_back"),
      });
      const resp = await dlg.show(player);
      if (resp.response && resp.inputText) {
        const parts = resp.inputText.split(/\s+/).map(Number);
        if (parts.length >= 1 && !isNaN(parts[0]))
          TextDrawManager.updateProperty(id, (td) => {
            td.textSize[0] = parts[0];
            if (parts[1] !== undefined && !isNaN(parts[1])) td.textSize[1] = parts[1];
          });
      }
    } else if (s.mode === "ls") {
      const d = TextDrawManager.getData(id);
      const dlg = new Dialog({
        style: DialogStylesEnum.INPUT,
        caption: $t("size.title", null, locale),
        info: `X Y: ${d!.letterSize[0].toFixed(3)} ${d!.letterSize[1].toFixed(3)}`,
        button1: $t("interactive.btn_set"),
        button2: $t("interactive.btn_back"),
      });
      const resp = await dlg.show(player);
      if (resp.response && resp.inputText) {
        const parts = resp.inputText.split(/\s+/).map(Number);
        if (parts.length >= 1 && !isNaN(parts[0]))
          TextDrawManager.updateProperty(id, (td) => {
            td.letterSize[0] = parts[0];
            if (parts[1] !== undefined && !isNaN(parts[1])) td.letterSize[1] = parts[1];
          });
      }
    } else if (s.mode === "ol") {
      const d = TextDrawManager.getData(id);
      const dlg = new Dialog({
        style: DialogStylesEnum.INPUT,
        caption: $t("interactive.outline_title"),
        info: $t("interactive.outline_value", [String(d!.outline)]),
        button1: $t("interactive.btn_set"),
        button2: $t("interactive.btn_back"),
      });
      const resp = await dlg.show(player);
      if (resp.response && resp.inputText) {
        const v = parseInt(resp.inputText);
        if (!isNaN(v) && v >= 0)
          TextDrawManager.updateProperty(id, (td) => {
            td.outline = v;
          });
      }
    } else if (s.mode === "sh") {
      const d = TextDrawManager.getData(id);
      const dlg = new Dialog({
        style: DialogStylesEnum.INPUT,
        caption: $t("interactive.shadow_title"),
        info: $t("interactive.shadow_value", [String(d!.shadow)]),
        button1: $t("interactive.btn_set"),
        button2: $t("interactive.btn_back"),
      });
      const resp = await dlg.show(player);
      if (resp.response && resp.inputText) {
        const v = parseInt(resp.inputText);
        if (!isNaN(v) && v >= 0)
          TextDrawManager.updateProperty(id, (td) => {
            td.shadow = v;
          });
      }
    } else if (s.mode === "swap") {
      await showIndexSwapManual(player, s.swapIndex ?? id);
    } else if (s.mode === "undo") {
      const dlg = new Dialog({
        style: DialogStylesEnum.INPUT,
        caption: $t("interactive.undo_index_title"),
        info: $t("interactive.undo_index_info", [String(UndoRedoManager.total)]),
        button1: $t("interactive.undo_index_go"),
        button2: $t("interactive.btn_back"),
      });
      const resp = await dlg.show(player);
      if (resp.response && resp.inputText) {
        const idx = parseInt(resp.inputText) - 1;
        if (idx >= 0 && idx < UndoRedoManager.total) {
          UndoRedoManager.goTo(idx);
          const e = UndoRedoManager.applyToTextDraw(id);
          if (e)
            TextDrawManager.updatePropertyAnim(id, (td) => {
              Object.assign(td, e);
            });
	          HudManager.setInfoText(`~g~~h~Index: ~w~~h~${idx + 1} / ${UndoRedoManager.total}`);
        }
      }
    } else if (s.mode === "rgba") {
      const d = TextDrawManager.getData(id);
      if (!d) return;
      const rs = getRgbaState(player);
      const currentColor =
        rs.mode === 0 ? d.color : rs.mode === 1 ? d.bgColor : d.boxColor;
      const hexStr = ((currentColor >>> 8) & 0xffffff).toString(16).padStart(6, "0");
      const dlg = new Dialog({
        style: DialogStylesEnum.INPUT,
        caption: $t("color_hex.title", null, locale),
        info:
          `${$t("color_hex.content_1", null, locale)}\n\n` +
          `${$t("color_hex.content_2", null, locale)}\n` +
          `{${hexStr}}${hexStr}`,
        button1: $t("interactive.btn_set", null, locale),
        button2: $t("interactive.btn_back", null, locale),
      });
      const resp = await dlg.show(player);
      if (resp.response && resp.inputText) {
        const result = formatHex(resp.inputText);
        if (!result.error) {
          TextDrawManager.updateProperty(id, (td) => {
            if (rs.mode === 0) td.color = result.hex;
            else if (rs.mode === 1) td.bgColor = result.hex;
            else td.boxColor = result.hex;
          });
        }
      }
    } else if (s.mode === "pmodel") {
      const d = TextDrawManager.getData(id);
      if (!d) return;
      const idx = s.selId ?? 0;
      const labels = ["Model ID", "X", "Y", "Z", "Zoom", "Vehicle Color 1", "Vehicle Color 2"];
      const current = [
        String(d.previewModel),
        d.previewRot[0].toFixed(2),
        d.previewRot[1].toFixed(2),
        d.previewRot[2].toFixed(2),
        d.previewRot[3].toFixed(2),
        String(d.previewVc[0]),
        String(d.previewVc[1]),
      ][idx];
      const dlg = new Dialog({
        style: DialogStylesEnum.INPUT,
        caption: $t("interactive.pmodel_title"),
        info: `${labels[idx]}: ${current}`,
        button1: $t("interactive.btn_set"),
        button2: $t("interactive.btn_back"),
      });
      const resp = await dlg.show(player);
      if (resp.response && resp.inputText) {
        const v = resp.inputText.trim();
        switch (idx) {
          case 0: {
            const n = parseInt(v);
            if (!isNaN(n))
              TextDrawManager.updateProperty(id, (td) => {
                td.previewModel = n;
              });
            break;
          }
          case 1: {
            const n = parseFloat(v);
            if (!isNaN(n))
              TextDrawManager.updateProperty(id, (td) => {
                td.previewRot[0] = n;
              });
            break;
          }
          case 2: {
            const n = parseFloat(v);
            if (!isNaN(n))
              TextDrawManager.updateProperty(id, (td) => {
                td.previewRot[1] = n;
              });
            break;
          }
          case 3: {
            const n = parseFloat(v);
            if (!isNaN(n))
              TextDrawManager.updateProperty(id, (td) => {
                td.previewRot[2] = n;
              });
            break;
          }
          case 4: {
            const n = parseFloat(v);
            if (!isNaN(n))
              TextDrawManager.updateProperty(id, (td) => {
                td.previewRot[3] = n;
              });
            break;
          }
          case 5: {
            const n = parseInt(v);
            if (!isNaN(n))
              TextDrawManager.updateProperty(id, (td) => {
                td.previewVc[0] = n;
              });
            break;
          }
          case 6: {
            const n = parseInt(v);
            if (!isNaN(n))
              TextDrawManager.updateProperty(id, (td) => {
                td.previewVc[1] = n;
              });
            break;
          }
        }
      }
    }
  } catch {
    void 0;
  }
}

// ─── Arrow Select (for list action "select with arrow keys") ───

export function startArrowSelect(player: Player, startId: number) {
  const locale = getPlayerLocale(player);
  TextDrawManager.selectedId = startId;
  const s = getState(player);
  setMode(player, "sel");
  s.selId = startId;
  enterInteractive(player);
  TextDrawManager.previewSelect(startId);
  HudManager.setInfoText(`Select: ${startId}/${TextDrawManager.count - 1}`);
  msgInfo(player, $t("interactive.start_sel", null, locale));
  s.interval = setInterval(() => {
    HudManager.hideInfoText();
    if (s.mode !== "sel" || s.selId === undefined) return;
    const keys = player.getKeys();
    if (keys.leftRight < -1) {
      const prev = TextDrawManager.getPrevId(s.selId);
      TextDrawManager.previewReset(s.selId);
      s.selId = prev;
      TextDrawManager.previewSelect(prev);
      HudManager.setInfoText(`Select: ${prev}/${TextDrawManager.count - 1}`);
    }
    if (keys.leftRight > 1) {
      const next = TextDrawManager.getNextId(s.selId);
      TextDrawManager.previewReset(s.selId);
      s.selId = next;
      TextDrawManager.previewSelect(next);
      HudManager.setInfoText(`Select: ${next}/${TextDrawManager.count - 1}`);
    }
  }, 85);
}

// ─── Index Swap Interactive ───

export function startIndexSwap(player: Player, id: number) {
  const locale = getPlayerLocale(player);
  const s = getState(player);
  setMode(player, "swap");
  s.swapIndex = id;
  enterInteractive(player);
  TextDrawManager.previewSelect(id);
  HudManager.setInfoText(`Swap: ${id}/${TextDrawManager.count - 1}`);
  msgInfo(player, $t("interactive.start_swap", null, locale));
  s.interval = setInterval(() => {
    HudManager.hideInfoText();
    if (s.mode !== "swap" || s.swapIndex === undefined) return;
    const keys = player.getKeys();
    if (keys.leftRight < -1) {
      const prev = TextDrawManager.getPrevId(s.swapIndex);
      if (prev !== s.swapIndex) {
        TextDrawManager.swapIndex(s.swapIndex, prev);
        s.swapIndex = prev;
        HudManager.setInfoText(`Swap: ${prev}/${TextDrawManager.count - 1}`);
      }
    }
    if (keys.leftRight > 1) {
      const next = TextDrawManager.getNextId(s.swapIndex);
      if (next !== s.swapIndex) {
        TextDrawManager.swapIndex(s.swapIndex, next);
        s.swapIndex = next;
        HudManager.setInfoText(`Swap: ${next}/${TextDrawManager.count - 1}`);
      }
    }
  }, 50);
}

// ─── Group Interactive Modes ───

export function startGroupPosition(player: Player) {
  const locale = getPlayerLocale(player);
  let hasGrouped = false;
  for (const [id] of TextDrawManager.data) {
    if (TextDrawManager.getData(id)?.group === 1) {
      hasGrouped = true;
      break;
    }
  }
  if (!hasGrouped) {
    msgError(player, $t("interactive.no_grouped", null, locale));
    return;
  }
  // Save undo for all grouped items before making changes
  for (const [id] of TextDrawManager.data) {
    if (TextDrawManager.getData(id)?.group === 1) UndoRedoManager.add(id);
  }
  const s = getState(player);
  setMode(player, "gpos");
  enterInteractive(player);
  msgInfo(player, $t("interactive.start_gpos", null, locale));
  // PAWN: tracks cumulative offset from the starting position
  let offsetX = 0;
  let offsetY = 0;
  s.interval = setInterval(() => {
    HudManager.hideInfoText();
    if (s.mode !== "gpos") return;
    const keys = player.getKeys();
    const speed = (keys.keys & KeysEnum.SPRINT) !== 0 ? 10 : 1;
    let moved = false;
    for (const [id] of TextDrawManager.data) {
      const d = TextDrawManager.getData(id);
      if (d && d.group === 1) {
        if (keys.leftRight < -1) {
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.pos[0] -= speed;
          });
          moved = true;
        }
        if (keys.leftRight > 1) {
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.pos[0] += speed;
          });
          moved = true;
        }
        if (keys.upDown < -1) {
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.pos[1] -= speed;
          });
          moved = true;
        }
        if (keys.upDown > 1) {
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.pos[1] += speed;
          });
          moved = true;
        }
      }
    }
    if (moved) {
      if (keys.leftRight < -1 || keys.leftRight > 1) {
        offsetX += keys.leftRight < -1 ? -speed : speed;
      }
      if (keys.upDown < -1 || keys.upDown > 1) {
        offsetY += keys.upDown < -1 ? -speed : speed;
      }
      HudManager.setInfoText(
        `~g~~h~Offset X: ~w~~h~${offsetX.toFixed(1)}     ~g~~h~Offset Y: ~w~~h~${offsetY.toFixed(1)}`,
      );
    }
  }, 50);
}

export function startGroupTextsize(player: Player, mode: number) {
  const locale = getPlayerLocale(player);
  let hasGrouped = false;
  for (const [id] of TextDrawManager.data) {
    if (TextDrawManager.getData(id)?.group === 1) {
      hasGrouped = true;
      break;
    }
  }
  if (!hasGrouped) {
    msgError(player, $t("interactive.no_grouped", null, locale));
    return;
  }
  // Save undo for all grouped items before making changes
  for (const [id] of TextDrawManager.data) {
    if (TextDrawManager.getData(id)?.group === 1) UndoRedoManager.add(id);
  }
  const s = getState(player);
  setMode(player, "gts");
  enterInteractive(player);
  msgInfo(player, $t("interactive.start_gts", null, locale));
  // PAWN: tracks cumulative offset like gPosOffset[0/1]
  let offsetX = 0;
  let offsetY = 0;
  s.interval = setInterval(() => {
    HudManager.hideInfoText();
    if (s.mode !== "gts") return;
    const keys = player.getKeys();
    const sprint = (keys.keys & KeysEnum.SPRINT) !== 0;
    const speed = sprint ? 10 : 1;
    let moved = false;
    for (const [id] of TextDrawManager.data) {
      const d = TextDrawManager.getData(id);
      if (!d || d.group !== 1) continue;
      const isNormal = d.font <= 3;
      const matchNormal = (mode === 0 || mode === 4) && isNormal;
      const matchSprite = (mode === 1 || mode === 3) && d.font === 4;
      const matchPreview = (mode === 2 || mode === 3) && d.font === 5;
      const matchAll = mode === 4;
      const matchLS = mode === 5 && isNormal;
      if (matchNormal || matchSprite || matchPreview || matchAll) {
        if (keys.leftRight < -1) {
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.textSize[0] -= speed;
          });
          moved = true;
        }
        if (keys.leftRight > 1) {
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.textSize[0] += speed;
          });
          moved = true;
        }
        if (keys.upDown < -1) {
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.textSize[1] -= speed;
          });
          moved = true;
        }
        if (keys.upDown > 1) {
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.textSize[1] += speed;
          });
          moved = true;
        }
      }
      if (matchLS) {
        const ls = sprint ? 0.1 : 0.01;
        if (keys.leftRight < -1) {
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.letterSize[0] -= ls;
          });
          moved = true;
        }
        if (keys.leftRight > 1) {
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.letterSize[0] += ls;
          });
          moved = true;
        }
        if (keys.upDown < -1) {
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.letterSize[1] -= sprint ? 1.0 : 0.1;
          });
          moved = true;
        }
        if (keys.upDown > 1) {
          TextDrawManager.updatePropertyAnim(id, (td) => {
            td.letterSize[1] += sprint ? 1.0 : 0.1;
          });
          moved = true;
        }
      }
    }
    if (moved) {
      // PAWN: tracks cumulative offset for display
      if (keys.leftRight < -1 || keys.leftRight > 1) {
        const incX =
          mode === 5 ? (sprint ? 0.1 : 0.01) : speed;
        offsetX += keys.leftRight < -1 ? -incX : incX;
      }
      if (keys.upDown < -1 || keys.upDown > 1) {
        const incY =
          mode === 5 ? (sprint ? 1.0 : 0.1) : speed;
        offsetY += keys.upDown < -1 ? -incY : incY;
      }
      // PAWN: gGroupTSMode <= 4 → %.1f, gGroupTSMode == 5 → %.3f
      HudManager.setInfoText(
        `~g~~h~Offset X: ~w~~h~${offsetX.toFixed(mode === 5 ? 3 : 1)}     ~g~~h~Offset Y: ~w~~h~${offsetY.toFixed(mode === 5 ? 3 : 1)}`,
      );
    }
  }, 50);
}

export function confirmGroup(player: Player, _s: PlayerState) {
  const locale = getPlayerLocale(player);
  setMode(player, "none");
  for (const [id] of TextDrawManager.data) {
    const d = TextDrawManager.getData(id);
    if (d && d.group === 1) DB.updateTextDraw(d);
  }
  msgInfo(player, $t("interactive.group_saved", null, locale));
  exitInteractive(player);
}
