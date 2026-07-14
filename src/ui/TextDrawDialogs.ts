import { Dialog, DialogStylesEnum } from "@infernus/core";
import type { Player } from "@infernus/core";
import { TextDrawManager } from "../managers/TextDrawManager";
import { HudManager } from "../managers/HudManager";
import { UndoRedoManager } from "../managers/UndoRedoManager";
import { DeletedManager } from "../managers/DeletedManager";
import * as DB from "../services/DatabaseService";
import {
  msgError,
  msgInfo,
  maxPage,
  pagePos1,
  pagePos2,
  getDateString,
  rgbaToHex,
  restoreMouse,
} from "../utils/helpers";
import { CONFIG } from "../constants/config";
import { COLOR_PALETTE } from "../constants/colors";
import {
  startGroupPosition,
  startGroupTextsize,
  startPreviewModels,
} from "../features/interactive";
import { openSpriteBrowser } from "./SpriteBrowser";
import { $t } from "../i18n";
import { getState } from "../state";
import { getPlayerLocale } from "../features/spawn";

// ===========================================================================
//  showTextEdit — INPUT dialog to edit the text content of the selected TD
//  Based on: hud/text.pwn
// ===========================================================================
export async function showTextEdit(player: Player): Promise<void> {
  const locale = getPlayerLocale(player);
  const id = TextDrawManager.selectedId;
  if (id === -1) return;
  const data = TextDrawManager.getData(id);
  if (!data) return;

  const dlg = new Dialog({
    style: DialogStylesEnum.INPUT,
    caption: $t("text.title", null, locale),
    info:
      `${$t("text.content", null, locale)}\n{FFFFFF}${data.string}\n\n` +
      `${$t("text.content2", null, locale)}`,
    button1: $t("text.btn1", null, locale),
    button2: $t("text.btn2", null, locale),
  });

  try {
    const { response, inputText } = await dlg.show(player);
    if (!response) {
      // PAWN: return SetMouse(playerid, true, TEXTMODE_NORMAL)
      restoreMouse(player);
      return;
    }
    if (!inputText) {
      await showTextEdit(player);
      return;
    }

    if (data.string !== inputText) {
      UndoRedoManager.add(id);
    }

    TextDrawManager.updateProperty(id, (td) => {
      td.string = inputText;
    });

    msgInfo(player, $t("text.info", null, locale));
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showPreviewModels — LIST/TABLIST dialog showing preview model properties
//  Based on: hud/preview-models.pwn
// ===========================================================================
export async function showPreviewModels(player: Player): Promise<void> {
  const locale = getPlayerLocale(player);
  const id = TextDrawManager.selectedId;
  if (id === -1) return;
  const data = TextDrawManager.getData(id);
  if (!data) return;

  const dlg = new Dialog({
    style: DialogStylesEnum.TABLIST,
    caption: "Preview Models",
    info:
      `${$t("preview_models.model_id", null, locale)}\t${data.previewModel}\n` +
      `${$t("preview_models.rot_x", null, locale)}\t${data.previewRot[0].toFixed(2)}\n` +
      `${$t("preview_models.rot_y", null, locale)}\t${data.previewRot[1].toFixed(2)}\n` +
      `${$t("preview_models.rot_z", null, locale)}\t${data.previewRot[2].toFixed(2)}\n` +
      `${$t("preview_models.zoom", null, locale)}\t${data.previewRot[3].toFixed(2)}\n` +
      `${$t("preview_models.veh_col_1", null, locale)}\t${data.previewVc[0]}\n` +
      `${$t("preview_models.veh_col_2", null, locale)}\t${data.previewVc[1]}`,
    button1: $t("preview_models.btn_1", null, locale),
    button2: $t("preview_models.btn_2", null, locale),
  });

  try {
    const { response, listItem } = await dlg.show(player);
    if (!response) {
      // PAWN: return SetMouse(playerid, true, TEXTMODE_NORMAL)
      restoreMouse(player);
      return;
    }

    // Start interactive arrow key editing (matching PAWN behavior)
    startPreviewModels(player, listItem);
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showStorageMenu — LIST dialog for Grouping / Deleted restore
//  Based on: hud/storage.pwn
// ===========================================================================
export async function showStorageMenu(player: Player): Promise<void> {
  const locale = getPlayerLocale(player);
  const dlg = new Dialog({
    style: DialogStylesEnum.LIST,
    caption: $t("storage.title", null, locale),
    info: `${$t("storage.content_1", null, locale)}\n${$t("storage.content_2", null, locale)}`,
    button1: $t("storage.btn_1", null, locale),
    button2: $t("storage.btn_2", null, locale),
  });

  try {
    const { response, listItem } = await dlg.show(player);
    if (!response) {
      // PAWN: return SetMouse(playerid, true, TEXTMODE_NORMAL)
      restoreMouse(player);
      return;
    }

    if (listItem === 0) {
      // PAWN: reset group color mode and page before entering grouping
      getState(player).groupColorMode = 0;
      getState(player).groupPageArr = [];
      await showGroupingMenu(player);
    } else {
      await showDeletedMenu(player, 1);
    }
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showDeletedMenu — TABLIST_HEADERS with paginated deleted items
//  Based on: deleted/delete.pwn, deleted/functions.pwn
// ===========================================================================
export async function showDeletedMenu(player: Player, page: number): Promise<void> {
  const locale = getPlayerLocale(player);
  const { rows, total } = DB.loadDeleted(page - 1);
  const maxPg = maxPage(total, CONFIG.MAX_DELETED_ITEMS);

  if (rows.length === 0 && total === 0) {
    msgError(player, $t("deleted.error", null, locale));
    return;
  }

  if (rows.length === 0 && page > 1) {
    await showDeletedMenu(player, page - 1);
    return;
  }

  const lines: string[] = [];

  // Header row
  lines.push(
    `${$t("deleted.header_1", null, locale)}\t${$t("deleted.header_2", null, locale)}\t${$t("deleted.header_3", null, locale)}\t${$t("deleted.header_4", null, locale)}`,
  );

  // Navigation rows
  lines.push(">>\t\t\t");
  lines.push("<<\t\t\t");
  lines.push(`${$t("deleted.content_1", null, locale)}\t\t\t`);
  lines.push(`${$t("deleted.content_2", null, locale)}\t\t\t`);
  lines.push(`${$t("deleted.content_3", null, locale)}\t\t\t`);
  lines.push(" \t\t\t");

  // Deleted item rows
  for (const row of rows) {
    const fontName = TextDrawManager.getFontName(row.font ?? 0);
    const content = (row.content ?? "---").substring(0, 20);
    const type =
      row.globalPlayer === 0
        ? $t("td_type.global", null, locale)
        : $t("td_type.player", null, locale);
    const date = getDateString(row.date ?? 0);
    lines.push(`${content}\t${fontName}\t${type}\t${date}`);
  }

  const dlg = new Dialog({
    style: DialogStylesEnum.TABLIST_HEADERS,
    caption: $t("deleted.title", [String(page), String(maxPg)], locale),
    info: lines.join("\n"),
    button1: $t("deleted.btn1", null, locale),
    button2: $t("deleted.btn2", null, locale),
  });

  try {
    const { response, listItem } = await dlg.show(player);
    if (!response) {
      // PAWN: return StorageMenu(playerid)
      await showStorageMenu(player);
      return;
    }

    switch (listItem) {
      case 0: {
        await showDeletedMenu(player, Math.min(page + 1, maxPg));
        break;
      }
      case 1: {
        await showDeletedMenu(player, Math.max(page - 1, 1));
        break;
      }
      case 2: {
        await showPageInput(player, 2, page, (p) => showDeletedMenu(player, p));
        break;
      }
      case 3: {
        const cleared = await showDeletedClearConfirm(player);
        if (cleared) {
          // PAWN: StorageMenu(playerid) — after clearing, go back to storage menu
          await showStorageMenu(player);
        } else {
          await showDeletedMenu(player, page);
        }
        break;
      }
      case 4: {
        DeletedManager.restoreAll(player);
        break;
      }
      case 5: {
        await showDeletedMenu(player, page);
        break;
      }
      default: {
        const idx = listItem - 6;
        if (idx >= 0 && idx < rows.length) {
          DeletedManager.restoreOne(player, rows[idx].id);
        }
        break;
      }
    }
  } catch {
    // DialogException
  }
}

// Internal: confirm before clearing all deleted items. Returns true if cleared.
async function showDeletedClearConfirm(player: Player): Promise<boolean> {
  const locale = getPlayerLocale(player);
  const dlg = new Dialog({
    style: DialogStylesEnum.MSGBOX,
    caption: $t("deleted_clear.title", null, locale),
    info: `${$t("deleted_clear.content_1", null, locale)}\n${$t("deleted_clear.content_2", null, locale)}`,
    button1: $t("deleted_clear.btn1", null, locale),
    button2: $t("deleted_clear.btn2", null, locale),
  });

  try {
    const { response } = await dlg.show(player);
    if (!response) {
      // PAWN: return DeletedMenu(playerid)
      return false;
    }

    DB.clearDeleted();
    msgInfo(player, $t("deleted_clear.info", null, locale));
    return true;
  } catch {
    return false;
  }
}

// ===========================================================================
//  showNewMenu — LIST dialog for creating new textdraws
//  Based on: hud/new.pwn
// ===========================================================================
export async function showNewMenu(player: Player): Promise<void> {
  const locale = getPlayerLocale(player);
  const dlg = new Dialog({
    style: DialogStylesEnum.LIST,
    caption: $t("new_textdraw.title", null, locale),
    info: `${$t("new_textdraw.content_1", null, locale)}\n${$t("new_textdraw.content_2", null, locale)}\n${$t("new_textdraw.content_3", null, locale)}`,
    button1: $t("new_textdraw.btn1", null, locale),
    button2: $t("new_textdraw.btn2", null, locale),
  });

  try {
    const { response, listItem } = await dlg.show(player);
    if (!response) {
      // PAWN: return SetMouse(playerid, true, TEXTMODE_NORMAL)
      restoreMouse(player);
      return;
    }


    switch (listItem) {
      case 0: {
        TextDrawManager.createDefault();
        HudManager.rebuild(true);
        break;
      }
      case 1: {
        // Sprite — open sprite browser; PAWN shows NewMenu on close
        const self = showNewMenu;
        openSpriteBrowser(player, () => { self(player).catch(() => {}); });
        return;
      }
      case 2: {
        TextDrawManager.createPreview();
        HudManager.rebuild(true);
        break;
      }
    }
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showGroupingMenu — LIST dialog with many grouping operations
//  Based on: grouping/grouping.pwn
// ===========================================================================
export async function showGroupingMenu(player: Player): Promise<void> {
  const locale = getPlayerLocale(player);
  if (TextDrawManager.count === 0) {
    msgError(player, $t("grouping.error", null, locale));
    return;
  }

  const colorModeNames = [
    $t("color_mode.1", null, locale),
    $t("color_mode.2", null, locale),
    $t("color_mode.3", null, locale),
  ];
  const colorModeStr = colorModeNames[getState(player).groupColorMode ?? 0];

  const lines: string[] = [
    // Grouping
    $t("grouping.content_1", null, locale),
    $t("grouping.content_2", null, locale),
    $t("grouping.content_3", null, locale),
    $t("grouping.content_4", null, locale),
    "{FFFFFF}",
    // Quick group
    $t("grouping.content_5", null, locale),
    $t("grouping.content_6", null, locale),
    $t("grouping.content_7", null, locale),
    $t("grouping.content_8", null, locale),
    "{FFFFFF}",
    // Copying
    $t("grouping.content_9", null, locale),
    $t("grouping.content_10", null, locale),
    $t("grouping.content_11", null, locale),
    "{FFFFFF}",
    // Delete
    $t("grouping.content_12", null, locale),
    $t("grouping.content_13", null, locale),
    "{FFFFFF}",
    // Position
    $t("grouping.content_14", null, locale),
    $t("grouping.content_15", null, locale),
    "{FFFFFF}",
    // Sizing
    $t("grouping.content_16", null, locale),
    $t("grouping.content_17", null, locale),
    $t("grouping.content_18", null, locale),
    $t("grouping.content_19", null, locale),
    $t("grouping.content_20", null, locale),
    $t("grouping.content_21", null, locale),
    $t("grouping.content_22", null, locale),
    "{FFFFFF}",
    // Text
    $t("grouping.content_23", null, locale),
    $t("grouping.content_24", null, locale),
    "{FFFFFF}",
    // Font
    $t("grouping.content_25", null, locale),
    $t("grouping.content_26", null, locale),
    $t("grouping.content_27", null, locale),
    $t("grouping.content_28", null, locale),
    $t("grouping.content_29", null, locale),
    "{FFFFFF}",
    // Alignment
    $t("grouping.content_30", null, locale),
    $t("grouping.content_31", null, locale),
    $t("grouping.content_32", null, locale),
    $t("grouping.content_33", null, locale),
    "{FFFFFF}",
    // Proportional
    $t("grouping.content_34", null, locale),
    $t("grouping.content_35", null, locale),
    $t("grouping.content_36", null, locale),
    "{FFFFFF}",
    // Outline & Shadow
    $t("grouping.content_37", null, locale),
    $t("grouping.content_38", null, locale),
    $t("grouping.content_39", null, locale),
    "{FFFFFF}",
    // Color
    `${$t("grouping.content_40", null, locale)} {FFFFFF}${colorModeStr}`,
    $t("grouping.content_41", null, locale),
    $t("grouping.content_42", null, locale),
    $t("grouping.content_43", null, locale),
    $t("grouping.content_44", null, locale),
    "{FFFFFF}",
    // Box
    $t("grouping.content_45", null, locale),
    $t("grouping.content_46", null, locale),
    $t("grouping.content_47", null, locale),
    "{FFFFFF}",
    // Selectable
    $t("grouping.content_48", null, locale),
    $t("grouping.content_49", null, locale),
    $t("grouping.content_50", null, locale),
    "{FFFFFF}",
    // Global / Player
    $t("grouping.content_51", null, locale),
    $t("grouping.content_52", null, locale),
    $t("grouping.content_53", null, locale),
  ];

  const dlg = new Dialog({
    style: DialogStylesEnum.LIST,
    caption: $t("grouping.title", null, locale),
    info: lines.join("\n"),
    button1: $t("grouping.btn1", null, locale),
    button2: $t("grouping.btn2", null, locale),
  });

  try {
    const { response, listItem } = await dlg.show(player);
    if (!response) {
      // PAWN: return StorageMenu(playerid)
      await showStorageMenu(player);
      return;
    }

    // Gather currently grouped IDs for operations that need them
    const groupedIds: number[] = [];
    for (const [k, v] of TextDrawManager.data) {
      if (v.group === 1) groupedIds.push(k);
    }


    // Non-actionable items (section headers, separators) just re-show
    const nonActionable = [
      0, 4, 5, 9, 10, 13, 14, 16, 17, 19, 20, 27, 28, 30, 31, 36, 37, 41, 42, 45, 46, 49, 55, 56,
      59, 60, 63, 64,
    ];
    if (nonActionable.includes(listItem)) {
      await showGroupingMenu(player);
      return;
    }

    switch (listItem) {
      // ===== Grouping =====
      case 1: {
        await showGroupSelect(player, 1);
        break;
      }
      case 2: {
        for (const [id] of TextDrawManager.data) {
          TextDrawManager.updateProperty(id, (td) => {
            td.group = 1;
          });
        }
        DB.updateTextDrawGroupWhere(1, "1=1", null);
        msgInfo(player, $t("grouping.info_1", null, locale));
        await showGroupingMenu(player);
        break;
      }
      case 3: {
        for (const [id] of TextDrawManager.data) {
          TextDrawManager.updateProperty(id, (td) => {
            td.group = 0;
          });
        }
        DB.updateTextDrawGroupWhere(0, "1=1", null);
        msgInfo(player, $t("grouping.info_2", null, locale));
        await showGroupingMenu(player);
        break;
      }

      // ===== Quick group =====
      case 6: {
        for (const [id] of TextDrawManager.data) {
          const d = TextDrawManager.getData(id);
          if (d && d.font <= 3)
            TextDrawManager.updateProperty(id, (td) => {
              td.group = 1;
            });
        }
        DB.updateTextDrawGroupWhere(1, "font <= 3", null);
        msgInfo(player, $t("grouping.info_3", null, locale));
        await showGroupingMenu(player);
        break;
      }
      case 7: {
        for (const [id] of TextDrawManager.data) {
          const d = TextDrawManager.getData(id);
          if (d && d.font === 4)
            TextDrawManager.updateProperty(id, (td) => {
              td.group = 1;
            });
        }
        DB.updateTextDrawGroupWhere(1, "font = 4", null);
        msgInfo(player, $t("grouping.info_4", null, locale));
        await showGroupingMenu(player);
        break;
      }
      case 8: {
        for (const [id] of TextDrawManager.data) {
          const d = TextDrawManager.getData(id);
          if (d && d.font === 5)
            TextDrawManager.updateProperty(id, (td) => {
              td.group = 1;
            });
        }
        DB.updateTextDrawGroupWhere(1, "font = 5", null);
        msgInfo(player, $t("grouping.info_5", null, locale));
        await showGroupingMenu(player);
        break;
      }

      // ===== Copying =====
      case 11: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        for (const gid of groupedIds) {
          const newId = TextDrawManager.copy(gid);
          TextDrawManager.updateProperty(newId, (td) => {
            td.group = 0;
          });
        }
        msgInfo(player, $t("grouping.info_6", [String(groupedIds.length)], locale));
        await showGroupingMenu(player);
        break;
      }
      case 12: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        for (const gid of groupedIds) {
          const d = TextDrawManager.getData(gid);
          if (d)
            TextDrawManager.updateProperty(gid, (td) => {
              td.group = 0;
            });
          const newId = TextDrawManager.copy(gid);
          TextDrawManager.updateProperty(newId, (td) => {
            td.group = 1;
          });
        }
        msgInfo(player, $t("grouping.info_7", [String(groupedIds.length)], locale));
        await showGroupingMenu(player);
        break;
      }

      // ===== Delete =====
      case 15: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        // Confirm before deleting grouped items (PAWN parity)
        try {
          const confirmDlg = new Dialog({
            style: DialogStylesEnum.MSGBOX,
            caption: $t("grouping.title", null, locale),
            info: $t("grouping.info_8_confirm", [String(groupedIds.length)], locale),
            button1: $t("grouping.btn_confirm", null, locale),
            button2: $t("grouping.btn_cancel", null, locale),
          });
          const { response } = await confirmDlg.show(player);
          if (!response) {
            await showGroupingMenu(player);
            break;
          }
        } catch {
          await showGroupingMenu(player);
          break;
        }
        for (const gid of groupedIds) {
          UndoRedoManager.add(gid);
          DeletedManager.add(gid);
          TextDrawManager.delete(gid);
        }
        HudManager.rebuild(true);
        msgInfo(player, $t("grouping.info_8", [String(groupedIds.length)], locale));
        await showGroupingMenu(player);
        break;
      }

      // ===== Position =====
      case 18: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        startGroupPosition(player);
        break;
      }

      // ===== Sizing =====
      case 21: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        startGroupTextsize(player, 0);
        break;
      }
      case 22: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        startGroupTextsize(player, 1);
        break;
      }
      case 23: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        startGroupTextsize(player, 2);
        break;
      }
      case 24: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        startGroupTextsize(player, 3);
        break;
      }
      case 25: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        startGroupTextsize(player, 4);
        break;
      }
      case 26: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        startGroupTextsize(player, 5);
        break;
      }

      // ===== Text =====
      case 29: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        await showGroupTextChange(player);
        break;
      }

      // ===== Font =====
      case 32:
      case 33:
      case 34:
      case 35: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        const font = listItem - 32;
        let fontCount = 0;
        for (const gid of groupedIds) {
          const d = TextDrawManager.getData(gid);
          if (d && d.font <= 3) {
            TextDrawManager.updateProperty(gid, (td) => {
              td.font = font;
            });
            fontCount++;
          }
        }
        if (fontCount === 0) {
          msgError(player, $t("grouping.error_2", null, locale));
        } else {
          msgInfo(player, $t("grouping.info_12", [String(font)], locale));
        }
        HudManager.rebuild(true);
        await showGroupingMenu(player);
        break;
      }

      // ===== Alignment =====
      case 38:
      case 39:
      case 40: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        const align = listItem - 37; // 38->1 (Left), 39->2 (Center), 40->3 (Right)
        let alignCount = 0;
        for (const gid of groupedIds) {
          const d = TextDrawManager.getData(gid);
          if (d && d.font <= 3) {
            TextDrawManager.updateProperty(gid, (td) => {
              td.alignment = align;
            });
            alignCount++;
          }
        }
        if (alignCount === 0) {
          msgError(player, $t("grouping.error_2", null, locale));
        } else {
          msgInfo(player, $t("grouping.info_13", null, locale));
        }
        HudManager.rebuild(true);
        await showGroupingMenu(player);
        break;
      }

      // ===== Proportional =====
      case 43:
      case 44: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        const propVal = listItem === 43 ? 1 : 0;
        let propCount = 0;
        for (const gid of groupedIds) {
          const d = TextDrawManager.getData(gid);
          if (d && d.font <= 3) {
            TextDrawManager.updateProperty(gid, (td) => {
              td.proportional = propVal;
            });
            propCount++;
          }
        }
        if (propCount === 0) {
          msgError(player, $t("grouping.error_2", null, locale));
        } else {
          msgInfo(player, $t("grouping.info_14", null, locale));
        }
        HudManager.rebuild(true);
        await showGroupingMenu(player);
        break;
      }

      // ===== Outline & Shadow =====
      case 47: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        await showGroupOutline(player);
        break;
      }
      case 48: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        await showGroupShadow(player);
        break;
      }

      // ===== Color =====
      case 50: {
        // Toggle color mode
        getState(player).groupColorMode = ((getState(player).groupColorMode ?? 0) + 1) % 3;
        await showGroupingMenu(player);
        break;
      }
      case 51: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        await showGroupColorHex(player);
        break;
      }
      case 52: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        await showGroupColorRGB(player);
        break;
      }
      case 53: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        await showGroupColorRGBA(player);
        break;
      }
      case 54: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        await showGroupColorPremade(player);
        break;
      }

      // ===== Box =====
      case 57:
      case 58: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        const boxVal = listItem === 57 ? 1 : 0;
        let boxCount = 0;
        for (const gid of groupedIds) {
          const d = TextDrawManager.getData(gid);
          if (d && d.font <= 3) {
            TextDrawManager.updateProperty(gid, (td) => {
              td.useBox = boxVal;
            });
            boxCount++;
          }
        }
        if (boxCount === 0) {
          msgError(player, $t("grouping.error_2", null, locale));
        } else {
          msgInfo(player, $t("grouping.info_16", null, locale));
        }
        HudManager.rebuild(true);
        await showGroupingMenu(player);
        break;
      }

      // ===== Selectable =====
      case 61:
      case 62: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        const selVal = listItem === 61 ? 1 : 0;
        for (const gid of groupedIds) {
          TextDrawManager.updateProperty(gid, (td) => {
            td.selectable = selVal;
          });
        }
        msgInfo(player, $t("grouping.info_17", null, locale));
        HudManager.rebuild(true);
        await showGroupingMenu(player);
        break;
      }

      // ===== Global / Player =====
      case 65:
      case 66: {
        if (groupedIds.length === 0) {
          msgError(player, $t("grouping.error_1", null, locale));
          await showGroupingMenu(player);
          break;
        }
        const gpVal = listItem === 66 ? 1 : 0; // 65->0 (global), 66->1 (player)
        for (const gid of groupedIds) {
          TextDrawManager.updateProperty(gid, (td) => {
            td.globalPlayer = gpVal;
          });
        }
        msgInfo(player, $t("grouping.info_18", null, locale));
        HudManager.rebuild(true);
        await showGroupingMenu(player);
        break;
      }

      default: {
        await showGroupingMenu(player);
        break;
      }
    }
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showGroupSelect — TABLIST_HEADERS for selecting items to group
//  Based on: grouping/grouping.pwn — GroupingSelectItems
// ===========================================================================
export async function showGroupSelect(player: Player, page: number): Promise<void> {
  const locale = getPlayerLocale(player);
  const total = TextDrawManager.count;
  const limit = CONFIG.MAX_GROUP_ITEM_CONTENT;
  const maxPg = maxPage(total, limit);
  const p1 = pagePos1(page, limit);
  const p2 = pagePos2(page, total, limit);
  const ids = TextDrawManager.getIds();

  const lines: string[] = [];

  // Header row
  lines.push(
    `${$t("group_items.header_1", null, locale)}\t${$t("group_items.header_2", null, locale)}\t${$t("group_items.header_3", null, locale)}\t${$t("group_items.header_4", null, locale)}`,
  );

  // Navigation rows
  lines.push(">>\t\t\t");
  lines.push("<<\t\t\t");
  lines.push(`${$t("group_items.content_1", null, locale)}\t\t\t`);
  lines.push(`${$t("group_items.content_2", null, locale)}\t\t\t`);
  lines.push(`${$t("group_items.content_3", null, locale)}\t\t\t`);
  lines.push(" \t\t\t");

  const groupArr: number[] = [];
  getState(player).groupPageArr = groupArr;

  for (let i = p1; i < p2; i++) {
    const id = ids[i];
    const d = TextDrawManager.getData(id);
    if (!d) continue;

    groupArr.push(id);

    const varName = TextDrawManager.getVarName(id);
    const txt = d.string.substring(0, 20) + (d.string.length > 20 ? "..." : "");
    const grouped =
      d.group === 1
        ? $t("group_items.header_4_y", null, locale)
        : $t("group_items.header_4_n", null, locale);

    if (d.group === 1) {
      lines.push(`{f9ca24}${id}\t{f9ca24}${varName}\t{f9ca24}${txt}\t{f9ca24}${grouped}`);
    } else {
      lines.push(`${id}\t${varName}\t${txt}\t${grouped}`);
    }
  }

  const dlg = new Dialog({
    style: DialogStylesEnum.TABLIST_HEADERS,
    caption: $t("group_items.title", [String(page), String(maxPg)], locale),
    info: lines.join("\n"),
    button1: $t("group_items.btn1", null, locale),
    button2: $t("group_items.btn2", null, locale),
  });

  try {
    const { response, listItem } = await dlg.show(player);
    if (!response) {
      await showGroupingMenu(player);
      return;
    }

    switch (listItem) {
      case 0: {
        await showGroupSelect(player, Math.min(page + 1, maxPg));
        break;
      }
      case 1: {
        await showGroupSelect(player, Math.max(page - 1, 1));
        break;
      }
      case 2: {
        await showPageInput(player, 3, page, (p) => showGroupSelect(player, p));
        break;
      }
      case 3: {
        // Group all on this page
        for (let i = p1; i < p2; i++) {
          TextDrawManager.updateProperty(ids[i], (td) => {
            td.group = 1;
          });
        }
        await showGroupSelect(player, page);
        break;
      }
      case 4: {
        // Ungroup all on this page
        for (let i = p1; i < p2; i++) {
          TextDrawManager.updateProperty(ids[i], (td) => {
            td.group = 0;
          });
        }
        await showGroupSelect(player, page);
        break;
      }
      case 5: {
        // Refresh
        await showGroupSelect(player, page);
        break;
      }
      default: {
        // Toggle individual item
        const idx = listItem - 6;
        if (idx >= 0 && idx < getState(player).groupPageArr!.length) {
          const sid = getState(player).groupPageArr![idx];
          const d = TextDrawManager.getData(sid);
          if (d) {
            TextDrawManager.updateProperty(sid, (td) => {
              td.group = td.group ? 0 : 1;
            });
          }
        }
        await showGroupSelect(player, page);
        break;
      }
    }
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showGroupTextChange — INPUT dialog for changing text of grouped items
//  Based on: grouping/grouping.pwn — GroupingText
// ===========================================================================
export async function showGroupTextChange(player: Player): Promise<void> {
  const locale = getPlayerLocale(player);
  const dlg = new Dialog({
    style: DialogStylesEnum.INPUT,
    caption: $t("group_text.title", null, locale),
    info: $t("group_text.content", null, locale),
    button1: $t("group_text.btn1", null, locale),
    button2: $t("group_text.btn2", null, locale),
  });

  try {
    const { response, inputText } = await dlg.show(player);
    if (!response) {
      await showGroupingMenu(player);
      return;
    }
    if (!inputText) {
      await showGroupTextChange(player);
      return;
    }

    let count = 0;
    for (const [id] of TextDrawManager.data) {
      const d = TextDrawManager.getData(id);
      if (d && d.group === 1) {
        TextDrawManager.updateProperty(id, (td) => {
          td.string = inputText;
        });
        count++;
      }
    }

    msgInfo(player, $t("grouping.info_11", null, locale));
    await showGroupingMenu(player);
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showPageInput — INPUT dialog for page navigation
//  mode: 0=project list, 1=hud list, 2=deleted, 3=grouping
// ===========================================================================
export async function showPageInput(
  player: Player,
  mode: number,
  currentPage: number,
  onSelect: (page: number) => void,
): Promise<void> {
  const locale = getPlayerLocale(player);
  let max = 1;

  if (mode === 0) {
    max = maxPage(DB.listProjects(0).total, CONFIG.PROJECT_MAX_ITEMS);
  } else if (mode === 1) {
    max = maxPage(TextDrawManager.count, CONFIG.HUD_LIST_ITEMS);
  } else if (mode === 2) {
    max = maxPage(DB.loadDeleted(0).total, CONFIG.MAX_DELETED_ITEMS);
  } else if (mode === 3) {
    max = maxPage(TextDrawManager.count, CONFIG.MAX_GROUP_ITEM_CONTENT);
  }

  const dlg = new Dialog({
    style: DialogStylesEnum.INPUT,
    caption: $t("page.title", null, locale),
    info: $t("page.content", [String(max)], locale),
    button1: $t("page.btn1", null, locale),
    button2: $t("page.btn2", null, locale),
  });

  try {
    const { response, inputText } = await dlg.show(player);
    if (!response) {
      onSelect(currentPage);
      return;
    }

    const p = parseInt(inputText.trim(), 10);
    if (isNaN(p) || p < 1 || p > max) {
      msgError(player, $t("page.error", null, locale));
      await showPageInput(player, mode, currentPage, onSelect);
      return;
    }

    onSelect(p);
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  Internal: apply a color value to grouped items based on getState(player).groupColorMode
// ===========================================================================
function applyColorToGrouped(player: Player, color: number): void {
  const locale = getPlayerLocale(player);
  for (const [id] of TextDrawManager.data) {
    const d = TextDrawManager.getData(id);
    if (!d || d.group !== 1) continue;

    switch (getState(player).groupColorMode) {
      case 0: // Text color
        if (d.font <= 5) {
          TextDrawManager.updateProperty(id, (td) => {
            td.color = color;
          });
        }
        break;
      case 1: // BG color
        if (d.font <= 3 || d.font === 5) {
          TextDrawManager.updateProperty(id, (td) => {
            td.bgColor = color;
          });
        }
        break;
      case 2: // Box color
        if (d.font <= 3) {
          TextDrawManager.updateProperty(id, (td) => {
            td.boxColor = color;
          });
        }
        break;
    }
  }
  msgInfo(player, $t("grouping.info_15", null, locale));
}

// ===========================================================================
//  showGroupOutline — INPUT dialog for setting outline on grouped items
//  Based on: grouping/grouping.pwn — GroupingOutline
// ===========================================================================
export async function showGroupOutline(player: Player): Promise<void> {
  const locale = getPlayerLocale(player);
  const dlg = new Dialog({
    style: DialogStylesEnum.INPUT,
    caption: $t("group_outline.title", null, locale),
    info: $t("group_outline.content", null, locale),
    button1: $t("group_outline.btn1", null, locale),
    button2: $t("group_outline.btn2", null, locale),
  });

  try {
    const { response, inputText } = await dlg.show(player);
    if (!response) {
      await showGroupingMenu(player);
      return;
    }
    if (!inputText) {
      await showGroupOutline(player);
      return;
    }

    const val = parseInt(inputText.trim(), 10);
    if (isNaN(val) || val < 0) {
      msgError(player, $t("group_outline.error", null, locale));
      await showGroupOutline(player);
      return;
    }

    let count = 0;
    for (const [id] of TextDrawManager.data) {
      const d = TextDrawManager.getData(id);
      if (d && d.group === 1 && d.font <= 3) {
        UndoRedoManager.add(id);
        TextDrawManager.updateProperty(id, (td) => {
          td.outline = val;
        });
        count++;
      }
    }

    if (count === 0) {
      msgError(player, $t("grouping.error_2", null, locale));
    } else {
      msgInfo(player, $t("group_outline.info", [String(val)], locale));
    }
    await showGroupingMenu(player);
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showGroupShadow — INPUT dialog for setting shadow on grouped items
//  Based on: grouping/grouping.pwn — GroupingShadow
// ===========================================================================
export async function showGroupShadow(player: Player): Promise<void> {
  const locale = getPlayerLocale(player);
  const dlg = new Dialog({
    style: DialogStylesEnum.INPUT,
    caption: $t("group_shadow.title", null, locale),
    info: $t("group_shadow.content", null, locale),
    button1: $t("group_shadow.btn1", null, locale),
    button2: $t("group_shadow.btn2", null, locale),
  });

  try {
    const { response, inputText } = await dlg.show(player);
    if (!response) {
      await showGroupingMenu(player);
      return;
    }
    if (!inputText) {
      await showGroupShadow(player);
      return;
    }

    const val = parseInt(inputText.trim(), 10);
    if (isNaN(val) || val < 0) {
      msgError(player, $t("group_shadow.error", null, locale));
      await showGroupShadow(player);
      return;
    }

    let count = 0;
    for (const [id] of TextDrawManager.data) {
      const d = TextDrawManager.getData(id);
      if (d && d.group === 1 && d.font <= 3) {
        UndoRedoManager.add(id);
        TextDrawManager.updateProperty(id, (td) => {
          td.shadow = val;
        });
        count++;
      }
    }

    if (count === 0) {
      msgError(player, $t("grouping.error_2", null, locale));
    } else {
      msgInfo(player, $t("group_shadow.info", [String(val)], locale));
    }
    await showGroupingMenu(player);
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showGroupColorHex — INPUT dialog for hex color
//  Based on: grouping/grouping.pwn — GroupingColorHex
// ===========================================================================
export async function showGroupColorHex(player: Player): Promise<void> {
  const locale = getPlayerLocale(player);
  const dlg = new Dialog({
    style: DialogStylesEnum.INPUT,
    caption: $t("color_hex.title", null, locale),
    info: `${$t("color_hex.content_1", null, locale)}\n\n${$t("color_hex.content_2", null, locale)}\n${$t("color_hex.content_3", null, locale)}\n${$t("color_hex.content_4", null, locale)}\n${$t("color_hex.content_5", null, locale)}\n${$t("color_hex.content_6", null, locale)}`,
    button1: $t("color_hex.btn_1", null, locale),
    button2: $t("color_hex.btn_2", null, locale),
  });

  try {
    const { response, inputText } = await dlg.show(player);
    if (!response) {
      await showGroupingMenu(player);
      return;
    }
    if (!inputText) {
      await showGroupColorHex(player);
      return;
    }

    let hex = inputText.trim().toUpperCase();
    // Remove # if present
    if (hex.startsWith("#")) hex = hex.slice(1);
    // Remove 0x if present
    if (hex.startsWith("0X")) hex = hex.slice(2);

    // If only 6 chars (RRGGBB), append FF for alpha
    if (hex.length === 6) hex += "FF";

    if (hex.length !== 8) {
      msgError(player, $t("color_hex.error", null, locale));
      await showGroupColorHex(player);
      return;
    }

    const color = parseInt(hex, 16);
    if (isNaN(color)) {
      msgError(player, $t("color_hex.error", null, locale));
      await showGroupColorHex(player);
      return;
    }

    applyColorToGrouped(player, color);
    await showGroupingMenu(player);
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showGroupColorRGB — INPUT dialog for RGB color
//  Based on: grouping/grouping.pwn — GroupingColorRGB
// ===========================================================================
export async function showGroupColorRGB(player: Player): Promise<void> {
  const locale = getPlayerLocale(player);
  const dlg = new Dialog({
    style: DialogStylesEnum.INPUT,
    caption: $t("color_rgb.title", null, locale),
    info: `${$t("color_rgb.content_1", null, locale)}\n\n${$t("color_rgb.content_2", null, locale)}\n${$t("color_rgb.content_3", null, locale)}\n${$t("color_rgb.content_4", null, locale)}\n${$t("color_rgb.content_5", null, locale)}`,
    button1: $t("color_rgb.btn_1", null, locale),
    button2: $t("color_rgb.btn_2", null, locale),
  });

  try {
    const { response, inputText } = await dlg.show(player);
    if (!response) {
      await showGroupingMenu(player);
      return;
    }
    if (!inputText) {
      await showGroupColorRGB(player);
      return;
    }

    let str = inputText.trim();
    // Remove rgb() wrapper
    str = str.replace(/rgb\s*\(/i, "").replace(/\)/g, "");
    // Replace commas with spaces
    str = str.replace(/,/g, " ");

    const parts = str.split(/\s+/).filter((s) => s.length > 0);
    if (parts.length < 3) {
      msgError(player, $t("color_rgb.error", null, locale));
      await showGroupColorRGB(player);
      return;
    }

    const r = parseInt(parts[0], 10);
    const g = parseInt(parts[1], 10);
    const b = parseInt(parts[2], 10);

    if (
      isNaN(r) ||
      isNaN(g) ||
      isNaN(b) ||
      r < 0 ||
      r > 255 ||
      g < 0 ||
      g > 255 ||
      b < 0 ||
      b > 255
    ) {
      msgError(player, $t("color_rgb.error", null, locale));
      await showGroupColorRGB(player);
      return;
    }

    const color = rgbaToHex(r, g, b, 255);
    applyColorToGrouped(player, color);
    await showGroupingMenu(player);
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showGroupColorRGBA — INPUT dialog for RGBA color
//  Based on: grouping/grouping.pwn — GroupingColorRGBA
// ===========================================================================
export async function showGroupColorRGBA(player: Player): Promise<void> {
  const locale = getPlayerLocale(player);
  const dlg = new Dialog({
    style: DialogStylesEnum.INPUT,
    caption: $t("color_rgba.title", null, locale),
    info: `${$t("color_rgba.content_1", null, locale)}\n\n${$t("color_rgba.content_2", null, locale)}\n${$t("color_rgba.content_3", null, locale)}\n${$t("color_rgba.content_4", null, locale)}\n${$t("color_rgba.content_5", null, locale)}\n${$t("color_rgba.content_6", null, locale)}`,
    button1: $t("color_rgba.btn_1", null, locale),
    button2: $t("color_rgba.btn_2", null, locale),
  });

  try {
    const { response, inputText } = await dlg.show(player);
    if (!response) {
      await showGroupingMenu(player);
      return;
    }
    if (!inputText) {
      await showGroupColorRGBA(player);
      return;
    }

    let str = inputText.trim();
    // Remove rgba() wrapper
    str = str.replace(/rgba\s*\(/i, "").replace(/\)/g, "");
    // Replace commas with spaces
    str = str.replace(/,/g, " ");

    const parts = str.split(/\s+/).filter((s) => s.length > 0);
    if (parts.length < 4) {
      msgError(player, $t("color_rgba.error", null, locale));
      await showGroupColorRGBA(player);
      return;
    }

    const r = parseInt(parts[0], 10);
    const g = parseInt(parts[1], 10);
    const b = parseInt(parts[2], 10);
    const a = parseInt(parts[3], 10);

    if (
      isNaN(r) ||
      isNaN(g) ||
      isNaN(b) ||
      isNaN(a) ||
      r < 0 ||
      r > 255 ||
      g < 0 ||
      g > 255 ||
      b < 0 ||
      b > 255 ||
      a < 0 ||
      a > 255
    ) {
      msgError(player, $t("color_rgba.error", null, locale));
      await showGroupColorRGBA(player);
      return;
    }

    const color = rgbaToHex(r, g, b, a);
    applyColorToGrouped(player, color);
    await showGroupingMenu(player);
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showGroupColorPremade — LIST dialog for premade colors
//  Based on: grouping/grouping.pwn — GroupingColorPremade
// ===========================================================================
export async function showGroupColorPremade(player: Player): Promise<void> {
  const locale = getPlayerLocale(player);
  const colorModeNames = [
    $t("color_mode.1", null, locale),
    $t("color_mode.2", null, locale),
    $t("color_mode.3", null, locale),
  ];
  const lines: string[] = [
    // PAWN: first 3 items are color mode selectors
    colorModeNames[0],
    colorModeNames[1],
    colorModeNames[2],
  ];
  for (let i = 0; i < COLOR_PALETTE.length; i++) {
    const color = COLOR_PALETTE[i];
    const hex = (color >>> 8).toString(16).padStart(6, "0");
    lines.push(`{${hex}}${i + 1} - ##########`);
  }

  const dlg = new Dialog({
    style: DialogStylesEnum.LIST,
    caption: $t("color.title", null, locale),
    info: lines.join("\n"),
    button1: $t("color.btn1", null, locale),
    button2: $t("color.btn2", null, locale),
  });

  try {
    const { response, listItem } = await dlg.show(player);
    if (!response) {
      await showGroupingMenu(player);
      return;
    }

    // PAWN: first 3 items change the color mode
    if (listItem < 3) {
      getState(player).groupColorMode = listItem;
      await showGroupColorPremade(player);
      return;
    }

    const color = COLOR_PALETTE[listItem - 3];
    if (color === undefined) {
      await showGroupColorPremade(player);
      return;
    }

    applyColorToGrouped(player, color);
    await showGroupingMenu(player);
  } catch {
    // DialogException
  }
}
