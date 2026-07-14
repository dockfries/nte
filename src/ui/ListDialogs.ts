import { Dialog, DialogStylesEnum } from "@infernus/core";
import type { Player } from "@infernus/core";
import { TextDrawManager } from "../managers/TextDrawManager";
import { HudManager } from "../managers/HudManager";
import { UndoRedoManager } from "../managers/UndoRedoManager";
import { DeletedManager } from "../managers/DeletedManager";
import { msgError, msgInfo, maxPage, pagePos1, pagePos2, restoreMouse } from "../utils/helpers";
import { CONFIG } from "../constants/config";
import { COLORS } from "../constants/colors";
import { startArrowSelect, startIndexSwap } from "../features/interactive";
import { $t } from "../i18n";
import { getPlayerLocale } from "../features/spawn";
import { getState } from "../state";

// ===========================================================================
//  showListMenu — TABLIST_HEADERS dialog with paginated textdraw list
// ===========================================================================
export async function showListMenu(player: Player, page: number): Promise<void> {
  const locale = getPlayerLocale(player);
  const total = TextDrawManager.count;

  if (total === 0) {
    msgError(player, $t("grouping.error", null, locale));
    return;
  }

  const maxPg = maxPage(total, CONFIG.HUD_LIST_ITEMS);
  const p1 = pagePos1(page, CONFIG.HUD_LIST_ITEMS);
  const p2 = pagePos2(page, total, CONFIG.HUD_LIST_ITEMS);
  const ids = TextDrawManager.getIds();

  // Build TABLIST_HEADERS content
  const lines: string[] = [];

  // Header row
  lines.push(
    `${$t("list.header_1", null, locale)}\t${$t("list.header_2", null, locale)}\t${$t("list.header_3", null, locale)}\t${$t("list.header_4", null, locale)}`,
  );

  // Navigation rows
  lines.push(">>\t\t\t");
  lines.push("<<\t\t\t");
  lines.push(`${$t("list.go_page", null, locale)}\t\t\t`);
  lines.push(`${$t("list.reorder", null, locale)}\t\t\t`);
  lines.push(" \t\t\t");

  const s = getState(player);
  s.listPageArr = [];
  s.listPage = page;

  // TextDraw rows
  for (let i = p1; i < p2; i++) {
    const id = ids[i];
    const data = TextDrawManager.getData(id);
    if (!data) continue;

    s.listPageArr.push(id);

    const varName = TextDrawManager.getVarName(id);
    const txt = data.string.substring(0, 20) + (data.string.length > 20 ? "..." : "");
    const type =
      data.globalPlayer === 0
        ? $t("td_type.global", null, locale)
        : $t("td_type.player", null, locale);

    if (id === TextDrawManager.selectedId) {
      lines.push(`{f9ca24}${id}\t{f9ca24}${varName}\t{f9ca24}${txt}\t{f9ca24}${type}`);
    } else {
      lines.push(`${id}\t${varName}\t${txt}\t${type}`);
    }
  }

  const dlg = new Dialog({
    style: DialogStylesEnum.TABLIST_HEADERS,
    caption: $t("list.title", [String(page), String(maxPg)], locale),
    info: lines.join("\n"),
    button1: $t("list.btn1", null, locale),
    button2: $t("list.btn2", null, locale),
  });

  try {
    const { response, listItem } = await dlg.show(player);
    if (!response) {
      // PAWN: SetMouse(playerid, true, TEXTMODE_NORMAL)
      restoreMouse(player);
      return;
    }

    switch (listItem) {
      case 0: {
        const nextPage = Math.min(page + 1, maxPg);
        await showListMenu(player, nextPage);
        break;
      }
      case 1: {
        const prevPage = Math.max(page - 1, 1);
        await showListMenu(player, prevPage);
        break;
      }
      case 2: {
        await showPageInputInternal(player, page);
        break;
      }
      case 3: {
        await showReindexConfirm(player);
        break;
      }
      case 4: {
        await showListMenu(player, page);
        break;
      }
      default: {
        s.listListItem = listItem - 5;
        if (s.listListItem >= 0 && s.listListItem < s.listPageArr!.length) {
          const selectedId = s.listPageArr![s.listListItem];
          await showListAction(player, selectedId, page);
        } else {
          await showListMenu(player, page);
        }
        break;
      }
    }
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showListAction — LIST dialog with 7 options for a textdraw
// ===========================================================================
export async function showListAction(player: Player, id: number, page: number): Promise<void> {
  const locale = getPlayerLocale(player);
  const dlg = new Dialog({
    style: DialogStylesEnum.LIST,
    caption: $t("list_action.title", null, locale),
    info: [
      $t("list_action.content_1", null, locale),
      $t("list_action.content_2", null, locale),
      $t("list_action.content_3", null, locale),
      $t("list_action.content_4", null, locale),
      $t("list_action.content_5", null, locale),
      $t("list_action.content_6", null, locale),
      $t("list_action.content_7", null, locale),
    ].join("\n"),
    button1: $t("list_action.btn1", null, locale),
    button2: $t("list_action.btn2", null, locale),
  });

  try {
    const { response, listItem } = await dlg.show(player);
    if (!response) {
      // PAWN: return ListMenu(playerid)
      await showListMenu(player, page);
      return;
    }

    const locale = getPlayerLocale(player);

    switch (listItem) {
      case 0: {
        TextDrawManager.selectedId = id;
        HudManager.rebuild(true);
        TextDrawManager.previewSelect(id);
        getState(player).mouseEnabled = true;
        player.selectTextDraw(COLORS.MOUSE_DEFAULT);
        msgInfo(player, $t("td_info.select", [String(id)], locale));
        setTimeout(() => TextDrawManager.previewReset(id), CONFIG.TEXT_SELECT_TIMER);
        break;
      }
      case 1: {
        TextDrawManager.selectedId = id;
        startArrowSelect(player, id);
        break;
      }
      case 2: {
        // PAWN: adds to deleted, removes from list, deletes from DB + undo_redo
        DeletedManager.add(id);
        UndoRedoManager.deleteForTextDraw(id);
        TextDrawManager.delete(id);
        HudManager.rebuild(true);
        msgInfo(player, $t("td_info.delete", [String(id)], locale));
        if (TextDrawManager.count > 0) {
          const maxPg = maxPage(TextDrawManager.count, CONFIG.HUD_LIST_ITEMS);
          const adjustedPage = page > maxPg ? maxPg : page;
          await showListMenu(player, adjustedPage);
        }
        break;
      }
      case 3: {
        const newId = TextDrawManager.copy(id);
        msgInfo(player, $t("td_info.copy", [String(newId)], locale));
        await showListMenu(player, page);
        break;
      }
      case 4: {
        const newCloneId = TextDrawManager.copy(id);
        TextDrawManager.selectedId = newCloneId;
        HudManager.rebuild(true);
        msgInfo(player, $t("td_info.copy2", [String(newCloneId)], locale));
        // PAWN: gListPage = TextdrawFindPage() — navigate to page containing the new TD
        const allIds = TextDrawManager.getIds();
        const newIdx = allIds.indexOf(newCloneId);
        const newPage = newIdx >= 0 ? Math.floor(newIdx / CONFIG.HUD_LIST_ITEMS) + 1 : 1;
        await showListMenu(player, newPage);
        break;
      }
      case 5: {
        startIndexSwap(player, id);
        break;
      }
      case 6: {
        await showVarNameEdit(player, id);
        break;
      }
    }
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showReindexConfirm — MSGBOX confirming reindex
// ===========================================================================
export async function showReindexConfirm(player: Player): Promise<void> {
  const locale = getPlayerLocale(player);
  const dlg = new Dialog({
    style: DialogStylesEnum.MSGBOX,
    caption: $t("reindex.title", null, locale),
    info: `${$t("reindex.content_1", null, locale)}\n${$t("reindex.content_2", null, locale)}`,
    button1: $t("reindex.btn_1", null, locale),
    button2: $t("reindex.btn_2", null, locale),
  });

  try {
    const { response } = await dlg.show(player);
    if (!response) {
      // PAWN: return ListMenu(playerid)
      await showListMenu(player, getState(player).listPage ?? 1);
      return;
    }

    TextDrawManager.reindex();
    msgInfo(player, $t("reindex.info", null, locale));
    HudManager.rebuild(true);
    // PAWN: return to editor, no dialog shown after reindex
    getState(player).mouseEnabled = true;
    player.selectTextDraw(COLORS.MOUSE_DEFAULT);
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showVarNameEdit — INPUT dialog to set/clear variable name
// ===========================================================================
export async function showVarNameEdit(player: Player, id: number): Promise<void> {
  const locale = getPlayerLocale(player);
  const data = TextDrawManager.getData(id);
  if (!data) return;

  const dlg = new Dialog({
    style: DialogStylesEnum.INPUT,
    caption: $t("var_name.title", null, locale),
    info: `${$t("var_name.content_1", null, locale)}\n${$t("var_name.content_2", null, locale)}`,
    button1: $t("var_name.btn1", null, locale),
    button2: $t("var_name.btn2", null, locale),
  });

  try {
    const { response, inputText } = await dlg.show(player);
    if (!response) {
      // PAWN: return ListAction(playerid)
      await showListAction(player, id, getState(player).listPage ?? 1);
      return;
    }

    UndoRedoManager.add(id);

    TextDrawManager.updateProperty(id, (td) => {
      td.varName = inputText || "";
    });

    if (inputText) {
      msgInfo(player, $t("var_name.info", [inputText], locale));
    } else {
      msgInfo(player, $t("var_name.info2", null, locale));
    }
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  showIndexSwapManual — INPUT dialog for manual index swap
// ===========================================================================
export async function showIndexSwapManual(player: Player, currentId: number): Promise<void> {
  const locale = getPlayerLocale(player);
  const maxIndex = TextDrawManager.count - 1;

  const dlg = new Dialog({
    style: DialogStylesEnum.INPUT,
    caption: $t("swap_index.title", null, locale),
    info: $t("swap_index.content", [String(maxIndex)], locale),
    button1: $t("swap_index.btn1", null, locale),
    button2: $t("swap_index.btn2", null, locale),
  });

  try {
    const { response, inputText } = await dlg.show(player);
    if (!response) return;

    if (!inputText) {
      msgError(player, $t("swap_index.error", null, locale));
      return;
    }

    const targetId = parseInt(inputText.trim(), 10);
    if (isNaN(targetId) || targetId < 0) {
      msgError(player, $t("swap_index.error", null, locale));
      return;
    }

    if (!TextDrawManager.has(targetId)) {
      msgError(player, $t("swap_index.error", null, locale));
      return;
    }

    if (targetId === currentId) {
      msgError(player, $t("swap_index.error", null, locale));
      return;
    }

    TextDrawManager.swapIndex(currentId, targetId);
    msgInfo(player, $t("swap_index.info", [String(currentId), String(targetId)], locale));
    HudManager.rebuild(true);
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  Internal: Page Input (Go to Page) for the list
// ===========================================================================
async function showPageInputInternal(player: Player, currentPage: number): Promise<void> {
  const locale = getPlayerLocale(player);
  const maxP = maxPage(TextDrawManager.count, CONFIG.HUD_LIST_ITEMS);

  const dlg = new Dialog({
    style: DialogStylesEnum.INPUT,
    caption: $t("page.title", null, locale),
    info: $t("page.content", [String(maxP)], locale),
    button1: $t("page.btn1", null, locale),
    button2: $t("page.btn2", null, locale),
  });

  try {
    const { response, inputText } = await dlg.show(player);
    if (!response) {
      await showListMenu(player, currentPage);
      return;
    }

    const pageNum = parseInt(inputText.trim(), 10);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > maxP) {
      msgError(player, $t("page.error", null, locale));
      await showPageInputInternal(player, currentPage);
      return;
    }

    await showListMenu(player, pageNum);
  } catch {
    // DialogException
  }
}
