import { TextDraw, TextDrawFontsEnum } from "@infernus/core";
import type { TextDrawData } from "../types";
import * as DB from "../services/DatabaseService";
import { COLORS } from "../constants/colors";
import { ProjectManager } from "./ProjectManager";

export class TextDrawManager {
  private static _data: Map<number, TextDrawData> = new Map();
  private static _instances: Map<number, TextDraw> = new Map();
  private static _selectedId = -1;

  static get selectedId() {
    return TextDrawManager._selectedId;
  }
  static set selectedId(v: number) {
    TextDrawManager._selectedId = v;
  }
  static get count() {
    return TextDrawManager._data.size;
  }
  static get data() {
    return TextDrawManager._data;
  }

  static getIds(): number[] {
    return [...TextDrawManager._data.keys()].sort((a, b) => a - b);
  }

  static getData(id: number): TextDrawData | undefined {
    return TextDrawManager._data.get(id);
  }

  static has(id: number): boolean {
    return TextDrawManager._data.has(id);
  }

  static getPrevId(id: number): number {
    const ids = TextDrawManager.getIds();
    const idx = ids.indexOf(id);
    if (idx <= 0) return ids[ids.length - 1];
    return ids[idx - 1];
  }

  static getNextId(id: number): number {
    const ids = TextDrawManager.getIds();
    const idx = ids.indexOf(id);
    if (idx >= ids.length - 1) return ids[0];
    return ids[idx + 1];
  }

  static allocId(): number {
    // PAWN: Iter_Free(Text_List) — reuse the smallest free slot
    let id = 0;
    while (TextDrawManager._data.has(id)) id++;
    return id;
  }

  private static defaultData(id: number): TextDrawData {
    return {
      id,
      string: "New TextDraw",
      pos: [270.0, 170.0],
      letterSize: [0.3, 1.5],
      textSize: [0, 0],
      alignment: 1,
      color: 0xffffffff,
      useBox: 0,
      boxColor: 0x00000096,
      shadow: 1,
      outline: 1,
      bgColor: 0x00000096,
      font: 1,
      proportional: 1,
      selectable: 0,
      previewModel: 0,
      previewRot: [0, 0, 0, 1],
      previewVc: [0, 0],
      globalPlayer: 0,
      varName: "",
      group: 0,
    };
  }

  private static applyProperties(td: TextDraw, data: TextDrawData) {
    const isPreview = data.font === 5;
    const isSprite = data.font === 4;
    const isNormal = data.font <= 3;

    if (isNormal || isSprite) {
      if (data.letterSize[0] !== 0 || data.letterSize[1] !== 0) {
        td.setLetterSize(data.letterSize[0], data.letterSize[1]);
      }
    }

    if (isNormal || isSprite || isPreview) {
      if (data.textSize[0] !== 0 || data.textSize[1] !== 0) {
        td.setTextSize(data.textSize[0], data.textSize[1]);
      }
    }

    td.setString(data.string);
    td.setAlignment(data.alignment as 1 | 2 | 3);
    td.setColor(data.color);
    td.useBox(data.useBox !== 0);
    td.setBoxColors(data.boxColor);
    td.setShadow(data.shadow);
    td.setOutline(data.outline);
    td.setBackgroundColors(data.bgColor);
    td.setFont(data.font as TextDrawFontsEnum);
    td.setProportional(data.proportional !== 0);
    td.setSelectable(data.selectable !== 0);

    if (isPreview) {
      td.setPreviewModel(data.previewModel);
      td.setPreviewRot(
        data.previewRot[0],
        data.previewRot[1],
        data.previewRot[2],
        data.previewRot[3],
      );
      td.setPreviewVehColors(data.previewVc[0], data.previewVc[1]);
    }
  }

  static render(id: number): TextDraw | undefined {
    TextDrawManager.destroy(id);
    const data = TextDrawManager._data.get(id);
    if (!data) return undefined;

    const td = new TextDraw({ x: data.pos[0], y: data.pos[1], text: data.string });
    td.create();
    TextDrawManager.applyProperties(td, data);
    TextDrawManager._instances.set(id, td);
    return td;
  }

  static renderAndShow(id: number) {
    const td = TextDrawManager.render(id);
    if (td) td.showAll();
  }

  static destroy(id: number) {
    const td = TextDrawManager._instances.get(id);
    if (td) {
      td.destroy();
      TextDrawManager._instances.delete(id);
    }
  }

  static show(id: number) {
    TextDrawManager._instances.get(id)?.showAll();
  }

  static showAll() {
    for (const [id] of TextDrawManager._data) {
      // Reuse existing instance if available (avoids unnecessary destroy+recreate)
      const inst = TextDrawManager._instances.get(id);
      if (inst) {
        inst.showAll();
      } else {
        TextDrawManager.renderAndShow(id);
      }
    }
  }

  static hideAll() {
    for (const [, td] of TextDrawManager._instances) {
      td.hideAll();
    }
  }

  static removeAll() {
    for (const [id] of TextDrawManager._instances) {
      TextDrawManager.destroy(id);
    }
  }

  static addLoaded(data: TextDrawData) {
    TextDrawManager._data.set(data.id, data);
  }

  static createDefault(): number {
    const id = TextDrawManager.allocId();
    const data = TextDrawManager.defaultData(id);
    TextDrawManager._data.set(id, data);
    TextDrawManager._selectedId = id;
    TextDrawManager.renderAndShow(id);
    DB.insertTextDraw(data);
    return id;
  }

  static createSprite(spriteName: string): number {
    const id = TextDrawManager.allocId();
    const data = TextDrawManager.defaultData(id);
    data.string = spriteName;
    data.pos = [250.0, 150.0];
    data.letterSize = [0, 0];
    data.textSize = [90.0, 90.0];
    data.font = 4;
    data.shadow = 0;
    data.outline = 0;
    data.bgColor = 0x000000ff;
    data.boxColor = 0x000000ff;
    TextDrawManager._data.set(id, data);
    TextDrawManager._selectedId = id;
    TextDrawManager.renderAndShow(id);
    DB.insertTextDraw(data);
    return id;
  }

  static createPreview(): number {
    const id = TextDrawManager.allocId();
    const data = TextDrawManager.defaultData(id);
    data.string = "_";
    data.pos = [250.0, 150.0];
    data.letterSize = [0, 0];
    data.textSize = [90.0, 90.0];
    data.font = 5;
    data.shadow = 0;
    data.outline = 0;
    data.proportional = 0;
    data.bgColor = 0x00000055;
    data.boxColor = 0x00000000;
    TextDrawManager._data.set(id, data);
    TextDrawManager._selectedId = id;
    TextDrawManager.renderAndShow(id);
    DB.insertTextDraw(data);
    return id;
  }

  static copy(id: number): number {
    const src = TextDrawManager._data.get(id);
    if (!src) return -1;
    const newId = TextDrawManager.allocId();
    // PAWN: gTextdraws[id] = gTextdraws[src]; — fully preserves varName
    const data = { ...src, id: newId, group: 0 };
    TextDrawManager._data.set(newId, data);
    TextDrawManager.renderAndShow(newId);
    DB.insertTextDraw(data);
    return newId;
  }

  static delete(id: number) {
    const data = TextDrawManager._data.get(id);
    if (!data) return;

    // PAWN: resolve next selection before removing from data
    const wasSelected = TextDrawManager._selectedId === id;
    let nextSel = TextDrawManager._selectedId;
    if (wasSelected) {
      const ids = TextDrawManager.getIds(); // includes current id
      const idx = ids.indexOf(id);
      if (ids.length <= 1) {
        nextSel = -1;
      } else if (idx > 0) {
        nextSel = ids[idx - 1]; // previous item (PAWN: Iter_Prev)
      } else {
        nextSel = ids[ids.length - 1]; // was first, wrap to last (PAWN: Iter_Last)
      }
    }

    TextDrawManager.destroy(id);
    TextDrawManager._data.delete(id);
    DB.deleteTextDraw(id);
    TextDrawManager._selectedId = nextSel;
  }

  static reindex() {
    const ids = TextDrawManager.getIds();
    const oldData = ids.map((id) => TextDrawManager._data.get(id)!);

    // Clear everything
    TextDrawManager.removeAll();
    TextDrawManager._data.clear();

    // Re-add in order
    for (const data of oldData) {
      const newId = TextDrawManager.allocId();
      TextDrawManager._data.set(newId, { ...data, id: newId });
    }

    // Rebuild DB
    DB.deleteAllTextDraws();
    DB.deleteAllUndoRedo();
    for (const [id] of TextDrawManager._data) {
      DB.insertTextDraw(TextDrawManager._data.get(id)!);
      TextDrawManager.renderAndShow(id);
    }
    TextDrawManager._selectedId = -1;
  }

  static swapIndex(from: number, to: number) {
    const a = TextDrawManager._data.get(from);
    const b = TextDrawManager._data.get(to);
    if (!a || !b) return;

    TextDrawManager._data.set(from, { ...b, id: from });
    TextDrawManager._data.set(to, { ...a, id: to });

    // Re-render both
    TextDrawManager.renderAndShow(from);
    TextDrawManager.renderAndShow(to);

    DB.updateTextDraw(TextDrawManager._data.get(from)!);
    DB.updateTextDraw(TextDrawManager._data.get(to)!);
  }

  static updateProperty(id: number, updater: (td: TextDrawData) => void) {
    const data = TextDrawManager._data.get(id);
    if (!data) return;
    updater(data);
    const inst = TextDrawManager._instances.get(id);
    if (inst) {
      TextDrawManager.applyProperties(inst, data);
      inst.showAll();
    }
    DB.updateTextDraw(data);
  }

  /** Re-render a textdraw visually (destroy + recreate) without writing to DB each tick.
   *  Used for real-time position editing; DB is updated on confirm. */
  static updatePropertyAnim(id: number, updater: (td: TextDrawData) => void) {
    const data = TextDrawManager._data.get(id);
    if (!data) return;
    updater(data);
    TextDrawManager.destroy(id);
    TextDrawManager.renderAndShow(id);
  }

  static previewSelect(id: number) {
    const inst = TextDrawManager._instances.get(id);
    if (!inst) return;
    inst.setBoxColors(COLORS.SELECTED_TEXTDRAW);
    inst.setBackgroundColors(COLORS.SELECTED_TEXTDRAW);
    inst.setColor(COLORS.SELECTED_TEXTDRAW);
    inst.showAll();
  }

  static previewReset(id: number) {
    const data = TextDrawManager._data.get(id);
    const inst = TextDrawManager._instances.get(id);
    if (!data || !inst) return;
    inst.setBoxColors(data.boxColor);
    inst.setBackgroundColors(data.bgColor);
    inst.setColor(data.color);
    inst.showAll();
  }

  static clear() {
    TextDrawManager.removeAll();
    TextDrawManager._data.clear();
    TextDrawManager._selectedId = -1;
  }

  static getGlobalCount(): number {
    let c = 0;
    for (const [, td] of TextDrawManager._data) {
      if (td.globalPlayer === 0) c++;
    }
    return c;
  }

  static getPlayerCount(): number {
    let c = 0;
    for (const [, td] of TextDrawManager._data) {
      if (td.globalPlayer === 1) c++;
    }
    return c;
  }

  static getVarGlobalCount(): number {
    let c = 0;
    for (const [, td] of TextDrawManager._data) {
      if (td.globalPlayer === 0 && td.varName.length > 0) c++;
    }
    return c;
  }

  static getVarPlayerCount(): number {
    let c = 0;
    for (const [, td] of TextDrawManager._data) {
      if (td.globalPlayer === 1 && td.varName.length > 0) c++;
    }
    return c;
  }

  static getGlobalNoVarCount(): number {
    let c = 0;
    for (const [, td] of TextDrawManager._data) {
      if (td.globalPlayer === 0 && td.varName.length === 0) c++;
    }
    return c;
  }

  static getPlayerNoVarCount(): number {
    let c = 0;
    for (const [, td] of TextDrawManager._data) {
      if (td.globalPlayer === 1 && td.varName.length === 0) c++;
    }
    return c;
  }

  static getVarName(id: number): string {
    const data = TextDrawManager._data.get(id);
    if (!data) return "";
    if (data.varName.length > 0) return data.varName;
    return data.globalPlayer === 0 ? ProjectManager.globalName : ProjectManager.playerName;
  }

  static getFontName(fontId: number): string {
    if (fontId <= 3) return "Normal TextDraw";
    if (fontId === 4) return "Sprite";
    if (fontId === 5) return "Preview Model";
    return "Unknown";
  }
}
