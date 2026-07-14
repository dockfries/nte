import type { Player } from "@infernus/core";
import type { TextDrawData } from "../types";
import { TextDrawManager } from "./TextDrawManager";
import { HudManager } from "./HudManager";
import * as DB from "../services/DatabaseService";
import { msgInfo } from "../utils/helpers";
import { $t } from "../i18n";
import { getPlayerLocale } from "../features/spawn";

export class DeletedManager {
  static add(id: number) {
    const data = TextDrawManager.getData(id);
    if (!data) return;
    DB.insertDeleted(data);
  }

  static restoreOne(player: Player, deletedId: number) {
    const row = DB.getDeletedItem(deletedId);
    if (!row) return;

    const td: TextDrawData = {
      id: 0,
      string: row.content ?? "_",
      pos: [row.posX ?? 0, row.posY ?? 0],
      letterSize: [row.lettersizeX ?? 0, row.lettersizeY ?? 0],
      textSize: [row.textsizeX ?? 0, row.textsizeY ?? 0],
      alignment: row.alignment ?? 1,
      color: row.color ?? 0xffffffff,
      useBox: row.usebox ?? 0,
      boxColor: row.boxcolor ?? 0,
      shadow: row.shadow ?? 0,
      outline: row.outline ?? 0,
      bgColor: row.bgcolor ?? 0,
      font: row.font ?? 1,
      proportional: row.proportional ?? 1,
      selectable: row.selectable ?? 0,
      previewModel: row.previewModel ?? 0,
      previewRot: [row.previewX ?? 0, row.previewY ?? 0, row.previewZ ?? 0, row.previewZoom ?? 1],
      previewVc: [row.previewVC1 ?? 0, row.previewVC2 ?? 0],
      globalPlayer: row.globalPlayer ?? 0,
      varName: row.varname ?? "",
      group: 0,
    };

    td.id = TextDrawManager.allocId();
    TextDrawManager.addLoaded(td);
    TextDrawManager.renderAndShow(td.id);
    DB.insertTextDraw(td);
    DB.deleteDeletedItem(deletedId);

    HudManager.rebuild(true);
    HudManager.createInfoText();

    msgInfo(player, $t("deleted.restored", [String(td.id)], getPlayerLocale(player)));
  }

  static restoreAll(player: Player) {
    const all = DB.getAllDeleted();
    let count = 0;

    for (const row of all) {
      const td: TextDrawData = {
        id: 0,
        string: row.content ?? "_",
        pos: [row.posX ?? 0, row.posY ?? 0],
        letterSize: [row.lettersizeX ?? 0, row.lettersizeY ?? 0],
        textSize: [row.textsizeX ?? 0, row.textsizeY ?? 0],
        alignment: row.alignment ?? 1,
        color: row.color ?? 0xffffffff,
        useBox: row.usebox ?? 0,
        boxColor: row.boxcolor ?? 0,
        shadow: row.shadow ?? 0,
        outline: row.outline ?? 0,
        bgColor: row.bgcolor ?? 0,
        font: row.font ?? 1,
        proportional: row.proportional ?? 1,
        selectable: row.selectable ?? 0,
        previewModel: row.previewModel ?? 0,
        previewRot: [row.previewX ?? 0, row.previewY ?? 0, row.previewZ ?? 0, row.previewZoom ?? 1],
        previewVc: [row.previewVC1 ?? 0, row.previewVC2 ?? 0],
        globalPlayer: row.globalPlayer ?? 0,
        varName: row.varname ?? "",
        group: 0,
      };
      td.id = TextDrawManager.allocId();
      TextDrawManager.addLoaded(td);
      TextDrawManager.renderAndShow(td.id);
      DB.insertTextDraw(td);
      count++;
    }

    DB.clearDeleted();
    HudManager.rebuild(true);
    msgInfo(player, $t("deleted.restored_all", [String(count)], getPlayerLocale(player)));
  }

  static clearAll() {
    DB.clearDeleted();
  }
}
