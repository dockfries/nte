import { TextDraw, TextDrawFontsEnum } from "@infernus/core";
import { COLORS } from "../constants/colors";
import { TextDrawManager } from "./TextDrawManager";
import { ProjectManager } from "./ProjectManager";

export class HudManager {
  private static _buttons: TextDraw[] = [];
  private static _infoText: TextDraw | null = null;
  private static _infoTick = 0;

  static get infoText() {
    return HudManager._infoText;
  }

  private static sprite(name: string): string {
    return `mdl-2000:${name}`;
  }

  /** Font sprites: index 0..3 = tde-12..tde-17 depending on current font value */
  private static fontSprite(font: number): string {
    const names = [
      "mdl-2000:tde-12",
      "mdl-2000:tde-13",
      "mdl-2000:tde-14",
      "mdl-2000:tde-15",
      "mdl-2000:tde-16",
      "mdl-2000:tde-17",
    ];
    return font >= 0 && font <= 5 ? names[font] : names[0];
  }

  private static alignSprite(align: number): string {
    const names = ["mdl-2000:tde-18", "mdl-2000:tde-19", "mdl-2000:tde-20"];
    return align >= 1 && align <= 3 ? names[align - 1] : names[0];
  }

  private static proportionalSprite(val: number): string {
    return val ? "mdl-2000:tde-22" : "mdl-2000:tde-21";
  }

  private static boxSprite(val: number): string {
    return val ? "mdl-2000:tde-29" : "mdl-2000:tde-28";
  }

  private static selectableSprite(val: number): string {
    return val ? "mdl-2000:tde-31" : "mdl-2000:tde-30";
  }

  private static globalPlayerSprite(val: number): string {
    return val ? "mdl-2000:tde-34" : "mdl-2000:tde-33";
  }

  static createInfoText(text = "_") {
    HudManager.destroyInfoText();
    const td = new TextDraw({ x: 310, y: 360, text });
    td.create();
    td.setLetterSize(0.219, 1.299);
    td.setAlignment(2);
    td.setColor(-1);
    td.setShadow(1);
    td.setOutline(1);
    td.setBackgroundColors(190);
    td.setFont(TextDrawFontsEnum.STANDARD); // PAWN: TextDrawFont(gInfoTextdraw, 1)
    td.setProportional(true);
    td.showAll();
    HudManager._infoText = td;
  }

  static destroyInfoText() {
    if (HudManager._infoText) {
      HudManager._infoText.destroy();
      HudManager._infoText = null;
    }
  }

  static updateInfoTick() {
    HudManager._infoTick = Date.now() + 750;
  }

  static hideInfoText() {
    // PAWN: InfoTextHide — set string to "_" instead of hiding the TextDraw
    if (HudManager._infoText && Date.now() > HudManager._infoTick) {
      HudManager._infoText.setString("_");
    }
  }

  static setInfoText(text: string) {
    // PAWN: TextDrawSetString — update text in-place, no destroy+recreate
    if (HudManager._infoText) {
      HudManager._infoText.setString(text);
      HudManager.updateInfoTick();
    }
  }

  static rebuild(destroyFirst = false) {
    HudManager.destroyAll(destroyFirst);
    HudManager.createButtons();
    HudManager.showAll();
  }

  private static destroyAll(destroyFirst: boolean) {
    if (destroyFirst) {
      for (const td of HudManager._buttons) td.destroy();
    }
    HudManager._buttons = [];
  }

  private static createButtons() {
    const hasProject = ProjectManager.isOpen;
    const hasTextDraws = TextDrawManager.count > 0;
    const hasSelected = TextDrawManager.selectedId !== -1;
    const selData = hasSelected ? TextDrawManager.getData(TextDrawManager.selectedId) : null;
    const selFont = selData?.font ?? -1;
    const selUseBox = selData?.useBox ?? 0;
    const artis = 26.5;
    let fhud = 2.5;

    // Conditions from PAWN Hud_Render
    const canLettersize = hasSelected && selFont <= 3;
    const canText = hasSelected && selFont <= 4;
    const canFontAlignProp = hasSelected && selFont <= 3;
    const canColor = hasSelected && selFont <= 5;
    const canBgColor = hasSelected && (selFont <= 3 || selFont === 5);
    const canBoxColor = hasSelected && selFont <= 3 && selUseBox === 1;
    const canBoxToggle = hasSelected && selFont <= 3;
    const canPreviewModel = hasSelected && selFont === 5;

    const bar = new TextDraw({ x: -5, y: ProjectManager.hudY, text: "LD_SPAC:white" });
    bar.create();
    bar.setFont(TextDrawFontsEnum.SPRITE_DRAW);
    bar.setLetterSize(0.5, 1);
    bar.setTextSize(650, 36);
    bar.setColor(COLORS.HUD_BAR);
    bar.setBoxColors(255);
    bar.setBackgroundColors(255);
    bar.setShadow(1);
    bar.setProportional(true);
    HudManager._buttons.push(bar);

    const addBtn = (spriteName: string, enabled: boolean, dynamicSprite?: string): TextDraw => {
      const s = dynamicSprite ?? HudManager.sprite(spriteName);
      const td = new TextDraw({ x: fhud, y: ProjectManager.hudY, text: s });
      td.create();
      td.setFont(TextDrawFontsEnum.SPRITE_DRAW);
      td.setLetterSize(0.5, 1);
      td.setTextSize(25, 35);
      td.setColor(enabled ? -1 : COLORS.HUD_DISABLED);
      td.setBoxColors(255);
      td.setBackgroundColors(255);
      td.setShadow(1);
      td.setProportional(true);
      td.setSelectable(enabled);
      fhud += artis;
      HudManager._buttons.push(td);
      return td;
    };

    addBtn("tde-1", true); // 0 bar, 1 project
    addBtn("tde-2", hasProject); // 2 settings
    addBtn("tde-3", hasProject && hasTextDraws); // 3 list
    addBtn("tde-4", hasProject); // 4 storage
    addBtn("tde-5", hasProject); // 5 new
    addBtn("tde-6", hasProject && hasSelected); // 6 copy
    addBtn("tde-7", hasProject && hasSelected); // 7 delete
    addBtn("tde-8", hasProject && hasSelected); // 8 pos
    addBtn("tde-9", hasProject && hasSelected); // 9 textsize
    addBtn("tde-10", hasProject && canLettersize); // 10 lettersize
    addBtn("tde-11", hasProject && canText); // 11 text
    addBtn(
      "tde-12",
      hasProject && canFontAlignProp,
      selFont >= 0 ? HudManager.fontSprite(selFont) : undefined,
    ); // 12 font
    addBtn(
      "tde-13",
      hasProject && canFontAlignProp,
      selFont >= 0 ? HudManager.alignSprite(selData!.alignment) : undefined,
    ); // 13 align
    addBtn(
      "tde-14",
      hasProject && canFontAlignProp,
      selFont >= 0 ? HudManager.proportionalSprite(selData!.proportional) : undefined,
    ); // 14 proportional
    addBtn("tde-23", hasProject && canFontAlignProp); // 15 outline (PAWN: tde-23)
    addBtn("tde-24", hasProject && canFontAlignProp); // 16 shadow (PAWN: tde-24)
    addBtn("tde-25", hasProject && canColor); // 17 color (PAWN: tde-25)
    addBtn("tde-26", hasProject && canBgColor); // 18 bg color (PAWN: tde-26)
    addBtn("tde-27", hasProject && canBoxColor); // 19 box color (PAWN: tde-27)
    addBtn(
      "tde-20",
      hasProject && canBoxToggle,
      selFont >= 0 ? HudManager.boxSprite(selUseBox) : undefined,
    ); // 20 box
    addBtn(
      "tde-21",
      hasProject && hasSelected,
      selFont >= 0 ? HudManager.selectableSprite(selData!.selectable) : undefined,
    ); // 21 selectable
    addBtn("tde-32", hasProject && canPreviewModel); // 22 preview model (PAWN: tde-32)
    addBtn(
      "tde-23",
      hasProject && hasSelected,
      selFont >= 0 ? HudManager.globalPlayerSprite(selData!.globalPlayer) : undefined,
    ); // 23 global/player
    addBtn("tde-35", hasProject && hasSelected); // 24 undo/redo (PAWN: tde-35)
  }

  static showAll() {
    for (const td of HudManager._buttons) td.showAll();
  }
  static hideAll() {
    for (const td of HudManager._buttons) td.hideAll();
  }

  static removeAll() {
    for (const td of HudManager._buttons) td.destroy();
    HudManager._buttons = [];
  }

  static getButton(index: number): TextDraw | undefined {
    return HudManager._buttons[index];
  }
  static getButtons(): readonly TextDraw[] {
    return HudManager._buttons;
  }
}
