import { Dialog, DialogStylesEnum } from "@infernus/core";
import type { Player } from "@infernus/core";
import { ProjectManager } from "../managers/ProjectManager";
import { TextDrawManager } from "../managers/TextDrawManager";
import { HudManager } from "../managers/HudManager";
import * as DB from "../services/DatabaseService";
import { logger } from "../logger";
import {
  msgError,
  msgInfo,
  maxPage,
  getDateString,
  fileNameCheck,
  restoreMouse,
  ompAlignmentString,
  ompFontString,
} from "../utils/helpers";
import { CONFIG } from "../constants/config";
import type { TextDrawData } from "../types";
import fs from "node:fs";
import path from "node:path";
import { $t } from "../i18n";
import { getPlayerLocale } from "../features/spawn";
import { getState } from "../state";

// ===========================================================================
//  Project Main Menu
// ===========================================================================
export async function showProjectMenu(player: Player) {
  const locale = getPlayerLocale(player);
  const dlg = new Dialog({
    style: DialogStylesEnum.LIST,
    caption: $t("project.title", null, locale),
    info: [
      $t("project.content_1", null, locale),
      $t("project.content_2", null, locale),
      $t("project.content_3", null, locale),
      $t("project.content_4", null, locale),
      $t("project.content_5", null, locale),
    ].join("\n"),
    button1: $t("project.btn_1", null, locale),
    button2: $t("project.btn_2", null, locale),
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
        await showCreateProject(player);
        break;
      }
      case 1: {
        getState(player).projectsPage = 0;
        await showProjectsList(player, 0);
        break;
      }
      case 2: {
        await showImportMenu(player);
        break;
      }
      case 3: {
        await showExportMenu(player);
        break;
      }
      case 4: {
        await showCloseProject(player);
        break;
      }
    }
  } catch {
    // DialogException – dialog closed unexpectedly
  }
}

// ===========================================================================
//  Create Project
// ===========================================================================
export async function showCreateProject(player: Player) {
  const locale = getPlayerLocale(player);
  if (ProjectManager.isOpen) {
    msgError(player, $t("project_new.error_5", null, locale));
    await showProjectMenu(player);
    return;
  }

  const dlg = new Dialog({
    style: DialogStylesEnum.INPUT,
    caption: $t("project_new.title", null, locale),
    info: $t("project_new.text", null, locale),
    button1: $t("project_new.btn_1", null, locale),
    button2: $t("project_new.btn_2", null, locale),
  });

  try {
    const { response, inputText } = await dlg.show(player);
    if (!response) {
      await showProjectMenu(player);
      return;
    }

    const name = inputText.trim();

    if (!name) {
      msgError(player, $t("project_new.error_1", null, locale));
      await showCreateProject(player);
      return;
    }

    if (name.length > CONFIG.PROJECT_MAX_NAME) {
      msgError(player, $t("project_new.error_2", null, locale));
      await showCreateProject(player);
      return;
    }

    if (fileNameCheck(name)) {
      msgError(player, $t("project_new.error_3", null, locale));
      await showCreateProject(player);
      return;
    }

    if (DB.projectNameExists(name)) {
      msgError(player, $t("project_new.error_4", null, locale));
      await showCreateProject(player);
      return;
    }

    ProjectManager.create(player, name);
    // ProjectManager.create() already calls msgInfo on success
  } catch (e) {
    logger.error("[ProjectDialogs] showCreateProject error", e);
  }
}

// ===========================================================================
//  Projects List (Tablist Headers)
// ===========================================================================
export async function showProjectsList(player: Player, page: number) {
  const locale = getPlayerLocale(player);

  // Fetch paginated data
  const { rows, total } = DB.listProjects(page);
  getState(player).projectsTotal = total;

  if (rows.length === 0 && total === 0) {
    msgError(player, $t("projects.error", null, locale));
    await showProjectMenu(player);
    return;
  }

  if (rows.length === 0 && page > 0) {
    // If page is out of bounds, go back to first page
    getState(player).projectsPage = 0;
    await showProjectsList(player, 0);
    return;
  }

  // Build tablist_headers content
  const lines: string[] = [];

  // Header row (not selectable in TABLIST_HEADERS)
  lines.push(`${$t("projects.header_1", null, locale)}\t${$t("projects.header_2", null, locale)}`);

  // Navigation rows
  lines.push(">>\t");
  lines.push("<<\t");
  lines.push(`${$t("projects.go_page", null, locale)}\t`);
  lines.push(" \t");

  // Store project names for later lookup
  getState(player).projectsList = rows.map((r) => r.name);

  // Project rows
  for (const row of rows) {
    lines.push(`${row.name}\t${getDateString(row.date)}`);
  }

  const totalPages = maxPage(total, CONFIG.PROJECT_MAX_ITEMS);
  const displayPage = page + 1;

  const dlg = new Dialog({
    style: DialogStylesEnum.TABLIST_HEADERS,
    caption: $t("projects.title", [String(displayPage), String(totalPages)], locale),
    info: lines.join("\n"),
    button1: $t("projects.btn_1", null, locale),
    button2: $t("projects.btn_2", null, locale),
  });

  try {
    const { response, listItem } = await dlg.show(player);
    if (!response) {
      await showProjectMenu(player);
      return;
    }

    const s = getState(player);
    switch (listItem) {
      case 0: {
        // >> next page
        s.projectsPage = (s.projectsPage ?? 0) + 1;
        if (s.projectsPage >= totalPages) s.projectsPage = totalPages - 1;
        await showProjectsList(player, s.projectsPage);
        break;
      }
      case 1: {
        // << prev page
        s.projectsPage = (s.projectsPage ?? 0) - 1;
        if (s.projectsPage < 0) s.projectsPage = 0;
        await showProjectsList(player, s.projectsPage);
        break;
      }
      case 2: {
        // Go to Page
        await showPageInput(player, "project");
        break;
      }
      case 3: {
        // Refresh (empty space)
        await showProjectsList(player, s.projectsPage ?? 0);
        break;
      }
      default: {
        // A project was selected – listItem starts at 4 for first project
        s.projectsListItem = listItem - 4;
        const list = s.projectsList;
        if (s.projectsListItem >= 0 && list && s.projectsListItem < list.length) {
          await showProjectAction(player, list[s.projectsListItem]);
        } else {
          await showProjectsList(player, s.projectsPage ?? 0);
        }
        break;
      }
    }
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  Project Action (Load / Delete)
// ===========================================================================
export async function showProjectAction(player: Player, projectName: string) {
  const locale = getPlayerLocale(player);
  const dlg = new Dialog({
    style: DialogStylesEnum.LIST,
    caption: $t("project_action.title", null, locale),
    info: `${$t("project_action.content_1", null, locale)}\n${$t("project_action.content_2", null, locale)}`,
    button1: $t("project_action.btn_1", null, locale),
    button2: $t("project_action.btn_2", null, locale),
  });

  try {
    const { response, listItem } = await dlg.show(player);
    if (!response) {
      await showProjectsList(player, getState(player).projectsPage ?? 0);
      return;
    }

    if (listItem === 0) {
      // Load
      const success = ProjectManager.load(player, projectName);
      if (success) {
        HudManager.rebuild(true);
      }
      // ProjectManager.load() already sends error messages on failure
    } else if (listItem === 1) {
      // Delete – show confirmation
      await showDeleteConfirm(player, projectName);
    }
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  Delete Confirmation
// ===========================================================================
async function showDeleteConfirm(player: Player, projectName: string) {
  const locale = getPlayerLocale(player);

  // Prevent deleting the currently open project
  if (ProjectManager.isOpen && ProjectManager.name === projectName) {
    msgError(player, $t("project_action.warn_error", null, locale));
    await showProjectAction(player, projectName);
    return;
  }

  const dlg = new Dialog({
    style: DialogStylesEnum.MSGBOX,
    caption: $t("project_action.warn_title", null, locale),
    info: $t("project_action.warn_content", null, locale),
    button1: $t("project_action.warn_btn1", null, locale),
    button2: $t("project_action.warn_btn2", null, locale),
  });

  try {
    const { response } = await dlg.show(player);
    if (!response) {
      await showProjectAction(player, projectName);
      return;
    }

    ProjectManager.deleteProject(player, projectName);
    getState(player).projectsPage = 0;
    await showProjectsList(player, 0);
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  Close Project
// ===========================================================================
async function showCloseProject(player: Player) {
  ProjectManager.close(player);
  // ProjectManager.close() sends msgInfo, resets HUD etc.
  await showProjectMenu(player);
}

// ===========================================================================
//  Page Input (Go to Page)
// ===========================================================================
async function showPageInput(player: Player, mode: "project" | "list") {
  const locale = getPlayerLocale(player);
  const maxP =
    mode === "project"
      ? maxPage(getState(player).projectsTotal ?? 0, CONFIG.PROJECT_MAX_ITEMS)
      : maxPage(TextDrawManager.count, CONFIG.HUD_LIST_ITEMS);

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
      if (mode === "project") {
        await showProjectsList(player, getState(player).projectsPage ?? 0);
      }
      return;
    }

    const pageNum = parseInt(inputText.trim(), 10);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > maxP) {
      msgError(player, $t("page.error", null, locale));
      await showPageInput(player, mode);
      return;
    }

    if (mode === "project") {
      getState(player).projectsPage = pageNum - 1;
      await showProjectsList(player, getState(player).projectsPage ?? 0);
    }
  } catch {
    // DialogException
  }
}

// ===========================================================================
//  Import Menu
// ===========================================================================
export async function showImportMenu(player: Player) {
  const locale = getPlayerLocale(player);
  if (!ProjectManager.isOpen) {
    msgError(player, $t("import.error_1", null, locale));
    await showProjectMenu(player);
    return;
  }

  const dlg = new Dialog({
    style: DialogStylesEnum.INPUT,
    caption: $t("import.title", null, locale),
    info: `${$t("import.content_1", null, locale)}\n${$t("import.content_2", null, locale)}`,
    button1: $t("import.btn1", null, locale),
    button2: $t("import.btn2", null, locale),
  });

  try {
    const { response, inputText } = await dlg.show(player);
    if (!response) {
      await showProjectMenu(player);
      return;
    }

    const filename = inputText.trim();
    if (!filename) {
      msgError(player, $t("import.error_2", null, locale));
      await showImportMenu(player);
      return;
    }

    const importPath = CONFIG.FILE_IMPORT.replace("%s", filename);
    const resolvedPath = path.resolve(importPath);

    if (!fs.existsSync(resolvedPath)) {
      msgError(player, $t("import.error_3", [filename], locale));
      await showImportMenu(player);
      return;
    }

    const imported = importFile(player, resolvedPath);
    if (imported > 0) {
      const g = TextDrawManager.getGlobalCount();
      const p = TextDrawManager.getPlayerCount();
      msgInfo(player, $t("import.info", [filename, String(g), String(p), String(g + p)], locale));
      HudManager.rebuild(true);
    } else {
      msgError(player, $t("import.error_5", null, locale));
      await showImportMenu(player);
    }
  } catch {
    // DialogException
  }
}

// ---------------------------------------------------------------------------
//  Internal import logic (parses PAWN TextDrawCreate / CreatePlayerTextDraw)
// ---------------------------------------------------------------------------
const IMPORT_NONE = 0;
const IMPORT_GLOBAL = 1;
const IMPORT_PLAYER = 2;

function importFile(player: Player, filePath: string): number {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/);

  let currentId = -1;
  let mod = IMPORT_NONE;
  let g = 0;
  let p = 0;

  for (let raw of lines) {
    // Strip trailing newline/carriage return
    raw = raw.replace(/[\r\n]+$/, "");

    // ---- Check for TextDrawCreate (Global) ----
    const tdcPos = raw.indexOf("TextDrawCreate");
    if (tdcPos !== -1) {
      let buffer = raw;
      // Find the opening parenthesis and delete up to after it
      const pos = buffer.indexOf("(");
      if (pos !== -1) {
        buffer = buffer.substring(pos + 1);
        // Skip possible space
        if (buffer.startsWith(" ")) buffer = buffer.substring(1);
      }

      // Extract x, y
      const parts = splitByComma(buffer);
      const x = parseFloat(parts[0]?.trim() ?? "0");
      const y = parseFloat(parts[1]?.trim() ?? "0");

      // Extract text between quotes
      const quoteStart = buffer.indexOf('"');
      if (quoteStart !== -1) {
        buffer = buffer.substring(quoteStart + 1);
        const quoteEnd = buffer.indexOf('"');
        if (quoteEnd !== -1) {
          buffer = buffer.substring(0, quoteEnd);
        }
      }

      let textContent = buffer;
      if (textContent.length === 0 || textContent === '")' || textContent === ")") {
        textContent = "_";
      }

      const newId = TextDrawManager.allocId();

      const data: TextDrawData = {
        id: newId,
        string: textContent,
        pos: [x, y],
        letterSize: [0, 0],
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

      TextDrawManager.addLoaded(data);
      TextDrawManager.renderAndShow(newId);
      DB.insertTextDraw(data);

      currentId = newId;
      mod = IMPORT_GLOBAL;
      g++;
      continue;
    }

    // ---- Check for CreatePlayerTextDraw (Player) ----
    const cptdPos = raw.indexOf("CreatePlayerTextDraw");
    if (cptdPos !== -1) {
      let buffer = raw;
      // Find the first comma (after playerid), delete up to after it
      const pos = buffer.indexOf(",");
      if (pos !== -1) {
        buffer = buffer.substring(pos + 1);
        if (buffer.startsWith(" ")) buffer = buffer.substring(1);
      }

      // Extract x, y
      const parts = splitByComma(buffer);
      const x = parseFloat(parts[0]?.trim() ?? "0");
      const y = parseFloat(parts[1]?.trim() ?? "0");

      // Extract text between quotes
      const quoteStart = buffer.indexOf('"');
      if (quoteStart !== -1) {
        buffer = buffer.substring(quoteStart + 1);
        const quoteEnd = buffer.indexOf('"');
        if (quoteEnd !== -1) {
          buffer = buffer.substring(0, quoteEnd);
        }
      }

      let textContent = buffer;
      if (textContent.length === 0 || textContent === '")' || textContent === ")") {
        textContent = "_";
      }

      const newId = TextDrawManager.allocId();

      const data: TextDrawData = {
        id: newId,
        string: textContent,
        pos: [x, y],
        letterSize: [0, 0],
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
        globalPlayer: 1,
        varName: "",
        group: 0,
      };

      TextDrawManager.addLoaded(data);
      TextDrawManager.renderAndShow(newId);
      DB.insertTextDraw(data);

      currentId = newId;
      mod = IMPORT_PLAYER;
      p++;
      continue;
    }

    // ---- Apply properties based on current mode ----
    if (mod === IMPORT_GLOBAL && currentId !== -1) {
      applyGlobalProperty(raw, currentId);
      // Empty line or line with just whitespace finalizes?
      // In original: if(isnull(buffer) && mod != MODE_NONE) → add to list, insert to DB
      // But in our flow, the TD is already added. We don't need to re-add.
      // The "finalize" in the original is just adding to the iterator and inserting.
      // Since we already inserted on creation, we just continue.
      if (raw.trim().length === 0) {
        mod = IMPORT_NONE;
      }
    } else if (mod === IMPORT_PLAYER && currentId !== -1) {
      applyPlayerProperty(raw, currentId);
      if (raw.trim().length === 0) {
        mod = IMPORT_NONE;
      }
    }
  }

  return g + p;
}

function splitByComma(str: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of str) {
    if (ch === '"') depth ^= 1; // toggle inside-quotes flag
    if (ch === "," && depth === 0) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.length > 0) result.push(current);
  return result;
}

/** Extract the value part from a PAWN function call like "TextDrawLetterSize(td, x, y)" */
function extractValueArgs(line: string): string {
  const pos = line.indexOf("(");
  if (pos === -1) return "";
  const rest = line.substring(pos + 1);
  // Find the matching closing paren
  let depth = 0;
  let end = -1;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "(") depth++;
    else if (rest[i] === ")") {
      if (depth === 0) {
        end = i;
        break;
      }
      depth--;
    }
  }
  if (end === -1) return "";
  return rest.substring(0, end);
}

/** Extract comma-separated numeric args after skipping the first parameter (the variable name) */
function extractNumericArgsAfterFirst(line: string): string[] {
  const args = extractValueArgs(line);
  if (!args) return [];
  // Skip the first argument (variable name / array access)
  const parts = splitByComma(args);
  if (parts.length <= 1) return [];
  return parts.slice(1).map((s) => s.trim());
}

/** Extract the last single numeric value from a function call */
function extractSingleArg(line: string): string {
  const args = extractValueArgs(line);
  if (!args) return "";
  const parts = splitByComma(args);
  return parts[parts.length - 1]?.trim() ?? "";
}

function parseHexOrDec(str: string): number {
  const s = str.trim();
  if (s.startsWith("0x") || s.startsWith("0X")) {
    return parseInt(s, 16);
  }
  return parseInt(s, 10);
}

function applyGlobalProperty(line: string, id: number) {
  const data = TextDrawManager.getData(id);
  if (!data) return;

  if (line.includes("TextDrawLetterSize")) {
    const args = extractNumericArgsAfterFirst(line);
    if (args.length >= 2) {
      const x = parseFloat(args[0]);
      const y = parseFloat(args[1]);
      if (!isNaN(x) && !isNaN(y)) {
        data.letterSize = [x, y];
      }
    }
  } else if (line.includes("TextDrawTextSize")) {
    const args = extractNumericArgsAfterFirst(line);
    if (args.length >= 2) {
      const x = parseFloat(args[0]);
      const y = parseFloat(args[1]);
      if (!isNaN(x) && !isNaN(y)) {
        data.textSize = [x, y];
      }
    }
  } else if (line.includes("TextDrawAlignment")) {
    const val = extractSingleArg(line);
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      data.alignment = num;
    } else {
      // Try string-based alignment from open.mp
      data.alignment = ompAlignmentToInt(val);
    }
  } else if (line.includes("TextDrawColor") || line.includes("TextDrawColour")) {
    const val = extractSingleArg(line);
    data.color = parseHexOrDec(val);
  } else if (line.includes("TextDrawUseBox")) {
    const val = extractSingleArg(line);
    data.useBox = val === "true" || val === "1" ? 1 : 0;
  } else if (line.includes("TextDrawBoxColor") || line.includes("TextDrawBoxColour")) {
    const val = extractSingleArg(line);
    data.boxColor = parseHexOrDec(val);
  } else if (line.includes("TextDrawSetShadow")) {
    const val = extractSingleArg(line);
    const num = parseInt(val, 10);
    if (!isNaN(num)) data.shadow = num;
  } else if (line.includes("TextDrawSetOutline")) {
    const val = extractSingleArg(line);
    const num = parseInt(val, 10);
    if (!isNaN(num)) data.outline = num;
  } else if (
    line.includes("TextDrawBackgroundColor") ||
    line.includes("TextDrawBackgroundColour")
  ) {
    const val = extractSingleArg(line);
    data.bgColor = parseHexOrDec(val);
  } else if (line.includes("TextDrawFont")) {
    const val = extractSingleArg(line);
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      data.font = num;
    } else {
      data.font = ompFontToInt(val);
    }
  } else if (line.includes("TextDrawSetProportional")) {
    const val = extractSingleArg(line);
    data.proportional = val === "true" || val === "1" ? 1 : 0;
  } else if (line.includes("TextDrawSetSelectable")) {
    const val = extractSingleArg(line);
    data.selectable = val === "true" || val === "1" ? 1 : 0;
  } else if (line.includes("TextDrawSetPreviewModel")) {
    const val = extractSingleArg(line);
    const num = parseInt(val, 10);
    if (!isNaN(num)) data.previewModel = num;
  } else if (line.includes("TextDrawSetPreviewRot")) {
    const args = extractNumericArgsAfterFirst(line);
    if (args.length >= 4) {
      data.previewRot = [
        parseFloat(args[0]),
        parseFloat(args[1]),
        parseFloat(args[2]),
        parseFloat(args[3]),
      ] as [number, number, number, number];
    }
  } else if (
    line.includes("TextDrawSetPreviewVehCol") ||
    line.includes("TextDrawSetPreviewVehicleColours")
  ) {
    const args = extractNumericArgsAfterFirst(line);
    if (args.length >= 2) {
      data.previewVc = [parseInt(args[0], 10) || 0, parseInt(args[1], 10) || 0] as [number, number];
    }
  }

  // Re-render after applying properties
  TextDrawManager.updateProperty(id, () => {});
}

function applyPlayerProperty(line: string, id: number) {
  const data = TextDrawManager.getData(id);
  if (!data) return;

  if (line.includes("PlayerTextDrawLetterSize")) {
    const args = extractNumericArgsAfterFirst(line);
    if (args.length >= 2) {
      const x = parseFloat(args[0]);
      const y = parseFloat(args[1]);
      if (!isNaN(x) && !isNaN(y)) data.letterSize = [x, y];
    }
  } else if (line.includes("PlayerTextDrawTextSize")) {
    const args = extractNumericArgsAfterFirst(line);
    if (args.length >= 2) {
      const x = parseFloat(args[0]);
      const y = parseFloat(args[1]);
      if (!isNaN(x) && !isNaN(y)) data.textSize = [x, y];
    }
  } else if (line.includes("PlayerTextDrawAlignment")) {
    const val = extractSingleArg(line);
    const num = parseInt(val, 10);
    if (!isNaN(num)) data.alignment = num;
    else data.alignment = ompAlignmentToInt(val);
  } else if (line.includes("PlayerTextDrawColor") || line.includes("PlayerTextDrawColour")) {
    const val = extractSingleArg(line);
    data.color = parseHexOrDec(val);
  } else if (line.includes("PlayerTextDrawUseBox")) {
    const val = extractSingleArg(line);
    data.useBox = val === "true" || val === "1" ? 1 : 0;
  } else if (line.includes("PlayerTextDrawBoxColor") || line.includes("PlayerTextDrawBoxColour")) {
    const val = extractSingleArg(line);
    data.boxColor = parseHexOrDec(val);
  } else if (line.includes("PlayerTextDrawSetShadow")) {
    const val = extractSingleArg(line);
    const num = parseInt(val, 10);
    if (!isNaN(num)) data.shadow = num;
  } else if (line.includes("PlayerTextDrawSetOutline")) {
    const val = extractSingleArg(line);
    const num = parseInt(val, 10);
    if (!isNaN(num)) data.outline = num;
  } else if (
    line.includes("PlayerTextDrawBackgroundColor") ||
    line.includes("PlayerTextDrawBackgroundColour")
  ) {
    const val = extractSingleArg(line);
    data.bgColor = parseHexOrDec(val);
  } else if (line.includes("PlayerTextDrawFont")) {
    const val = extractSingleArg(line);
    const num = parseInt(val, 10);
    if (!isNaN(num)) data.font = num;
    else data.font = ompFontToInt(val);
  } else if (line.includes("PlayerTextDrawSetProportional")) {
    const val = extractSingleArg(line);
    data.proportional = val === "true" || val === "1" ? 1 : 0;
  } else if (line.includes("PlayerTextDrawSetSelectable")) {
    const val = extractSingleArg(line);
    data.selectable = val === "true" || val === "1" ? 1 : 0;
  } else if (line.includes("PlayerTextDrawSetPreviewModel")) {
    const val = extractSingleArg(line);
    const num = parseInt(val, 10);
    if (!isNaN(num)) data.previewModel = num;
  } else if (line.includes("PlayerTextDrawSetPreviewRot")) {
    const args = extractNumericArgsAfterFirst(line);
    if (args.length >= 4) {
      data.previewRot = [
        parseFloat(args[0]),
        parseFloat(args[1]),
        parseFloat(args[2]),
        parseFloat(args[3]),
      ] as [number, number, number, number];
    }
  } else if (
    line.includes("PlayerTextDrawSetPreviewVehCol") ||
    line.includes("PlayerTextDrawSetPreviewVehicleColours")
  ) {
    const args = extractNumericArgsAfterFirst(line);
    if (args.length >= 2) {
      data.previewVc = [parseInt(args[0], 10) || 0, parseInt(args[1], 10) || 0] as [number, number];
    }
  }

  TextDrawManager.updateProperty(id, () => {});
}

function ompAlignmentToInt(str: string): number {
  const s = str.trim();
  if (s === "TEXT_DRAW_ALIGN_LEFT") return 1;
  if (s === "TEXT_DRAW_ALIGN_CENTER") return 2;
  if (s === "TEXT_DRAW_ALIGN_RIGHT") return 3;
  return 1;
}

function ompFontToInt(str: string): number {
  const s = str.trim();
  if (s === "TEXT_DRAW_FONT_0") return 0;
  if (s === "TEXT_DRAW_FONT_1") return 1;
  if (s === "TEXT_DRAW_FONT_2") return 2;
  if (s === "TEXT_DRAW_FONT_3") return 3;
  if (s === "TEXT_DRAW_FONT_SPRITE_DRAW") return 4;
  if (s === "TEXT_DRAW_FONT_MODEL_PREVIEW") return 5;
  return 0;
}

// ===========================================================================
//  Export Menu
// ===========================================================================
export async function showExportMenu(player: Player) {
  const locale = getPlayerLocale(player);
  if (!ProjectManager.isOpen) {
    msgError(player, $t("export.error2", null, locale));
    await showProjectMenu(player);
    return;
  }

  if (TextDrawManager.count === 0) {
    msgError(player, $t("export.error", null, locale));
    await showProjectMenu(player);
    return;
  }

  const dlg = new Dialog({
    style: DialogStylesEnum.INPUT,
    caption: $t("export.title", null, locale),
    info: `${$t("export.content_1", null, locale)}\n${$t("export.content_2", [ProjectManager.name], locale)}`,
    button1: $t("export.btn1", null, locale),
    button2: $t("export.btn2", null, locale),
  });

  try {
    const { response, inputText } = await dlg.show(player);
    if (!response) {
      await showProjectMenu(player);
      return;
    }

    let filename = inputText.trim();
    if (!filename) {
      filename = ProjectManager.name;
    } else {
      // Strip .txt extension if present
      const txtIdx = filename.toLowerCase().indexOf(".txt");
      if (txtIdx !== -1) {
        filename = filename.substring(0, txtIdx);
      }
    }

    const exportPath = CONFIG.FILE_EXPORT.replace("%s", filename);
    const resolvedPath = path.resolve(exportPath);

    const totalExported = exportFile(player, resolvedPath, filename);
    if (totalExported > 0) {
      const g = TextDrawManager.getGlobalCount();
      const p = TextDrawManager.getPlayerCount();
      msgInfo(player, $t("export.info", [filename, String(g), String(p), String(g + p)], locale));

      // Also write open.mp version
      const ompSuffix = "open.mp";
      const dotIndex = exportPath.lastIndexOf(".");
      const ompPath =
        dotIndex !== -1
          ? exportPath.substring(0, dotIndex) + "-" + ompSuffix + exportPath.substring(dotIndex)
          : exportPath + "-" + ompSuffix;
      exportFileOmp(player, path.resolve(ompPath));
    }
  } catch {
    // DialogException
  }
}

// ---------------------------------------------------------------------------
//  Internal export logic (SA:MP format)
// ---------------------------------------------------------------------------
function exportFile(player: Player, filePath: string, _baseName: string): number {

  const ids = TextDrawManager.getIds();
  const gCount = TextDrawManager.getGlobalNoVarCount();
  const pCount = TextDrawManager.getPlayerNoVarCount();

  if (ids.length === 0) return 0;

  let output = "";

  // ---- Global TDs without var names ----
  if (gCount > 0) {
    output += `new Text: ${ProjectManager.globalName}[${gCount}];\r\n\r\n`;

    let idx = 0;
    for (const id of ids) {
      const data = TextDrawManager.getData(id);
      if (!data || data.globalPlayer !== 0 || data.varName.length > 0) continue;

      output += `${ProjectManager.globalName}[${idx}] = TextDrawCreate(${fmt3(data.pos[0])}, ${fmt3(data.pos[1])}, "${escapePawnString(data.string)}");\r\n`;

      if (data.letterSize[0] !== 0 || data.letterSize[1] !== 0) {
        output += `TextDrawLetterSize(${ProjectManager.globalName}[${idx}], ${fmt3(data.letterSize[0])}, ${fmt3(data.letterSize[1])});\r\n`;
      }
      if (data.textSize[0] !== 0 || data.textSize[1] !== 0) {
        output += `TextDrawTextSize(${ProjectManager.globalName}[${idx}], ${fmt3(data.textSize[0])}, ${fmt3(data.textSize[1])});\r\n`;
      }
      output += `TextDrawAlignment(${ProjectManager.globalName}[${idx}], ${data.alignment});\r\n`;
      output += `TextDrawColor(${ProjectManager.globalName}[${idx}], ${data.color});\r\n`;

      if (data.useBox === 1) {
        output += `TextDrawUseBox(${ProjectManager.globalName}[${idx}], ${data.useBox});\r\n`;
        output += `TextDrawBoxColor(${ProjectManager.globalName}[${idx}], ${data.boxColor});\r\n`;
      }
      output += `TextDrawSetShadow(${ProjectManager.globalName}[${idx}], ${data.shadow});\r\n`;
      output += `TextDrawSetOutline(${ProjectManager.globalName}[${idx}], ${data.outline});\r\n`;
      output += `TextDrawBackgroundColor(${ProjectManager.globalName}[${idx}], ${data.bgColor});\r\n`;
      output += `TextDrawFont(${ProjectManager.globalName}[${idx}], ${data.font});\r\n`;
      output += `TextDrawSetProportional(${ProjectManager.globalName}[${idx}], ${data.proportional});\r\n`;

      if (data.selectable === 1) {
        output += `TextDrawSetSelectable(${ProjectManager.globalName}[${idx}], ${data.selectable});\r\n`;
      }
      if (data.font === 5) {
        output += `TextDrawSetPreviewModel(${ProjectManager.globalName}[${idx}], ${data.previewModel});\r\n`;
        output += `TextDrawSetPreviewRot(${ProjectManager.globalName}[${idx}], ${fmt3(data.previewRot[0])}, ${fmt3(data.previewRot[1])}, ${fmt3(data.previewRot[2])}, ${fmt3(data.previewRot[3])});\r\n`;
        output += `TextDrawSetPreviewVehCol(${ProjectManager.globalName}[${idx}], ${data.previewVc[0]}, ${data.previewVc[1]});\r\n`;
      }

      output += "\r\n";
      idx++;
    }
  }

  // ---- Player TDs without var names ----
  if (pCount > 0) {
    output +=
      "####################################################################################################\r\n\r\n";
    output += `new PlayerText: ${ProjectManager.playerName}[MAX_PLAYERS][${pCount}];\r\n\r\n`;

    let idx = 0;
    for (const id of ids) {
      const data = TextDrawManager.getData(id);
      if (!data || data.globalPlayer !== 1 || data.varName.length > 0) continue;

      output += `${ProjectManager.playerName}[playerid][${idx}] = CreatePlayerTextDraw(playerid, ${fmt3(data.pos[0])}, ${fmt3(data.pos[1])}, "${escapePawnString(data.string)}");\r\n`;

      if (data.letterSize[0] !== 0 || data.letterSize[1] !== 0) {
        output += `PlayerTextDrawLetterSize(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${fmt3(data.letterSize[0])}, ${fmt3(data.letterSize[1])});\r\n`;
      }
      if (data.textSize[0] !== 0 || data.textSize[1] !== 0) {
        output += `PlayerTextDrawTextSize(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${fmt3(data.textSize[0])}, ${fmt3(data.textSize[1])});\r\n`;
      }
      output += `PlayerTextDrawAlignment(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.alignment});\r\n`;
      output += `PlayerTextDrawColor(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.color});\r\n`;

      if (data.useBox === 1) {
        output += `PlayerTextDrawUseBox(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.useBox});\r\n`;
        output += `PlayerTextDrawBoxColor(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.boxColor});\r\n`;
      }
      output += `PlayerTextDrawSetShadow(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.shadow});\r\n`;
      output += `PlayerTextDrawSetOutline(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.outline});\r\n`;
      output += `PlayerTextDrawBackgroundColor(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.bgColor});\r\n`;
      output += `PlayerTextDrawFont(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.font});\r\n`;
      output += `PlayerTextDrawSetProportional(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.proportional});\r\n`;

      if (data.selectable === 1) {
        output += `PlayerTextDrawSetSelectable(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.selectable});\r\n`;
      }
      if (data.font === 5) {
        output += `PlayerTextDrawSetPreviewModel(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.previewModel});\r\n`;
        output += `PlayerTextDrawSetPreviewRot(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${fmt3(data.previewRot[0])}, ${fmt3(data.previewRot[1])}, ${fmt3(data.previewRot[2])}, ${fmt3(data.previewRot[3])});\r\n`;
        output += `PlayerTextDrawSetPreviewVehCol(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.previewVc[0]}, ${data.previewVc[1]});\r\n`;
      }

      output += "\r\n";
      idx++;
    }
  }

  // ---- Global TDs with var names ----
  const varGCount = TextDrawManager.getVarGlobalCount();
  if (varGCount > 0) {
    output +=
      "####################################################################################################\r\n\r\n";

    // Declarations
    for (const id of ids) {
      const data = TextDrawManager.getData(id);
      if (!data || data.globalPlayer !== 0 || data.varName.length === 0) continue;
      output += `new Text: ${data.varName};\r\n`;
    }
    output += "\r\n";

    // Definitions
    for (const id of ids) {
      const data = TextDrawManager.getData(id);
      if (!data || data.globalPlayer !== 0 || data.varName.length === 0) continue;
      const vn = data.varName;

      output += `${vn} = TextDrawCreate(${fmt3(data.pos[0])}, ${fmt3(data.pos[1])}, "${escapePawnString(data.string)}");\r\n`;

      if (data.letterSize[0] !== 0 || data.letterSize[1] !== 0) {
        output += `TextDrawLetterSize(${vn}, ${fmt3(data.letterSize[0])}, ${fmt3(data.letterSize[1])});\r\n`;
      }
      if (data.textSize[0] !== 0 || data.textSize[1] !== 0) {
        output += `TextDrawTextSize(${vn}, ${fmt3(data.textSize[0])}, ${fmt3(data.textSize[1])});\r\n`;
      }
      output += `TextDrawAlignment(${vn}, ${data.alignment});\r\n`;
      output += `TextDrawColor(${vn}, ${data.color});\r\n`;

      if (data.useBox === 1) {
        output += `TextDrawUseBox(${vn}, ${data.useBox});\r\n`;
        output += `TextDrawBoxColor(${vn}, ${data.boxColor});\r\n`;
      }
      output += `TextDrawSetShadow(${vn}, ${data.shadow});\r\n`;
      output += `TextDrawSetOutline(${vn}, ${data.outline});\r\n`;
      output += `TextDrawBackgroundColor(${vn}, ${data.bgColor});\r\n`;
      output += `TextDrawFont(${vn}, ${data.font});\r\n`;
      output += `TextDrawSetProportional(${vn}, ${data.proportional});\r\n`;

      if (data.selectable === 1) {
        output += `TextDrawSetSelectable(${vn}, ${data.selectable});\r\n`;
      }
      if (data.font === 5) {
        output += `TextDrawSetPreviewModel(${vn}, ${data.previewModel});\r\n`;
        output += `TextDrawSetPreviewRot(${vn}, ${fmt3(data.previewRot[0])}, ${fmt3(data.previewRot[1])}, ${fmt3(data.previewRot[2])}, ${fmt3(data.previewRot[3])});\r\n`;
        output += `TextDrawSetPreviewVehCol(${vn}, ${data.previewVc[0]}, ${data.previewVc[1]});\r\n`;
      }

      output += "\r\n";
    }
  }

  // ---- Player TDs with var names ----
  const varPCount = TextDrawManager.getVarPlayerCount();
  if (varPCount > 0) {
    output +=
      "####################################################################################################\r\n\r\n";

    for (const id of ids) {
      const data = TextDrawManager.getData(id);
      if (!data || data.globalPlayer !== 1 || data.varName.length === 0) continue;
      const vn = data.varName;

      output += `new PlayerText: ${vn}[MAX_PLAYERS];\r\n`;
    }
    output += "\r\n";

    for (const id of ids) {
      const data = TextDrawManager.getData(id);
      if (!data || data.globalPlayer !== 1 || data.varName.length === 0) continue;
      const vn = data.varName;

      output += `${vn}[playerid] = CreatePlayerTextDraw(playerid, ${fmt3(data.pos[0])}, ${fmt3(data.pos[1])}, "${escapePawnString(data.string)}");\r\n`;

      if (data.letterSize[0] !== 0 || data.letterSize[1] !== 0) {
        output += `PlayerTextDrawLetterSize(playerid, ${vn}[playerid], ${fmt3(data.letterSize[0])}, ${fmt3(data.letterSize[1])});\r\n`;
      }
      if (data.textSize[0] !== 0 || data.textSize[1] !== 0) {
        output += `PlayerTextDrawTextSize(playerid, ${vn}[playerid], ${fmt3(data.textSize[0])}, ${fmt3(data.textSize[1])});\r\n`;
      }
      output += `PlayerTextDrawAlignment(playerid, ${vn}[playerid], ${data.alignment});\r\n`;
      output += `PlayerTextDrawColor(playerid, ${vn}[playerid], ${data.color});\r\n`;

      if (data.useBox === 1) {
        output += `PlayerTextDrawUseBox(playerid, ${vn}[playerid], ${data.useBox});\r\n`;
        output += `PlayerTextDrawBoxColor(playerid, ${vn}[playerid], ${data.boxColor});\r\n`;
      }
      output += `PlayerTextDrawSetShadow(playerid, ${vn}[playerid], ${data.shadow});\r\n`;
      output += `PlayerTextDrawSetOutline(playerid, ${vn}[playerid], ${data.outline});\r\n`;
      output += `PlayerTextDrawBackgroundColor(playerid, ${vn}[playerid], ${data.bgColor});\r\n`;
      output += `PlayerTextDrawFont(playerid, ${vn}[playerid], ${data.font});\r\n`;
      output += `PlayerTextDrawSetProportional(playerid, ${vn}[playerid], ${data.proportional});\r\n`;

      if (data.selectable === 1) {
        output += `PlayerTextDrawSetSelectable(playerid, ${vn}[playerid], ${data.selectable});\r\n`;
      }
      if (data.font === 5) {
        output += `PlayerTextDrawSetPreviewModel(playerid, ${vn}[playerid], ${data.previewModel});\r\n`;
        output += `PlayerTextDrawSetPreviewRot(playerid, ${vn}[playerid], ${fmt3(data.previewRot[0])}, ${fmt3(data.previewRot[1])}, ${fmt3(data.previewRot[2])}, ${fmt3(data.previewRot[3])});\r\n`;
        output += `PlayerTextDrawSetPreviewVehCol(playerid, ${vn}[playerid], ${data.previewVc[0]}, ${data.previewVc[1]});\r\n`;
      }

      output += "\r\n";
    }
  }

  fs.writeFileSync(filePath, output, "utf-8");
  return ids.length;
}

// ---------------------------------------------------------------------------
//  Internal export logic (open.mp format)
// ---------------------------------------------------------------------------
function exportFileOmp(player: Player, filePath: string): number {

  const ids = TextDrawManager.getIds();
  const gCount = TextDrawManager.getGlobalNoVarCount();
  const pCount = TextDrawManager.getPlayerNoVarCount();

  if (ids.length === 0) return 0;

  let output = "";

  // ---- Global TDs without var names (open.mp) ----
  if (gCount > 0) {
    output += `new Text: ${ProjectManager.globalName}[${gCount}];\r\n\r\n`;

    let idx = 0;
    for (const id of ids) {
      const data = TextDrawManager.getData(id);
      if (!data || data.globalPlayer !== 0 || data.varName.length > 0) continue;

      output += `${ProjectManager.globalName}[${idx}] = TextDrawCreate(${fmt3(data.pos[0])}, ${fmt3(data.pos[1])}, "${escapePawnString(data.string)}");\r\n`;

      if (data.letterSize[0] !== 0 || data.letterSize[1] !== 0) {
        output += `TextDrawLetterSize(${ProjectManager.globalName}[${idx}], ${fmt3(data.letterSize[0])}, ${fmt3(data.letterSize[1])});\r\n`;
      }
      if (data.textSize[0] !== 0 || data.textSize[1] !== 0) {
        output += `TextDrawTextSize(${ProjectManager.globalName}[${idx}], ${fmt3(data.textSize[0])}, ${fmt3(data.textSize[1])});\r\n`;
      }
      // open.mp uses enum names for alignment
      output += `TextDrawAlignment(${ProjectManager.globalName}[${idx}], ${ompAlignmentString(data.alignment)});\r\n`;
      // open.mp uses "Colour" spelling
      output += `TextDrawColour(${ProjectManager.globalName}[${idx}], ${data.color});\r\n`;

      if (data.useBox === 1) {
        const boolStr = data.useBox ? "true" : "false";
        output += `TextDrawUseBox(${ProjectManager.globalName}[${idx}], ${boolStr});\r\n`;
        output += `TextDrawBoxColour(${ProjectManager.globalName}[${idx}], ${data.boxColor});\r\n`;
      }
      output += `TextDrawSetShadow(${ProjectManager.globalName}[${idx}], ${data.shadow});\r\n`;
      output += `TextDrawSetOutline(${ProjectManager.globalName}[${idx}], ${data.outline});\r\n`;
      output += `TextDrawBackgroundColour(${ProjectManager.globalName}[${idx}], ${data.bgColor});\r\n`;
      output += `TextDrawFont(${ProjectManager.globalName}[${idx}], ${ompFontString(data.font)});\r\n`;
      const propBool = data.proportional ? "true" : "false";
      output += `TextDrawSetProportional(${ProjectManager.globalName}[${idx}], ${propBool});\r\n`;

      if (data.selectable === 1) {
        output += `TextDrawSetSelectable(${ProjectManager.globalName}[${idx}], true);\r\n`;
      }
      if (data.font === 5) {
        output += `TextDrawSetPreviewModel(${ProjectManager.globalName}[${idx}], ${data.previewModel});\r\n`;
        output += `TextDrawSetPreviewRot(${ProjectManager.globalName}[${idx}], ${fmt3(data.previewRot[0])}, ${fmt3(data.previewRot[1])}, ${fmt3(data.previewRot[2])}, ${fmt3(data.previewRot[3])});\r\n`;
        output += `TextDrawSetPreviewVehicleColours(${ProjectManager.globalName}[${idx}], ${data.previewVc[0]}, ${data.previewVc[1]});\r\n`;
      }

      output += "\r\n";
      idx++;
    }
  }

  // ---- Player TDs without var names (open.mp) ----
  if (pCount > 0) {
    output +=
      "####################################################################################################\r\n\r\n";
    output += `new PlayerText: ${ProjectManager.playerName}[MAX_PLAYERS][${pCount}];\r\n\r\n`;

    let idx = 0;
    for (const id of ids) {
      const data = TextDrawManager.getData(id);
      if (!data || data.globalPlayer !== 1 || data.varName.length > 0) continue;

      output += `${ProjectManager.playerName}[playerid][${idx}] = CreatePlayerTextDraw(playerid, ${fmt3(data.pos[0])}, ${fmt3(data.pos[1])}, "${escapePawnString(data.string)}");\r\n`;

      if (data.letterSize[0] !== 0 || data.letterSize[1] !== 0) {
        output += `PlayerTextDrawLetterSize(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${fmt3(data.letterSize[0])}, ${fmt3(data.letterSize[1])});\r\n`;
      }
      if (data.textSize[0] !== 0 || data.textSize[1] !== 0) {
        output += `PlayerTextDrawTextSize(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${fmt3(data.textSize[0])}, ${fmt3(data.textSize[1])});\r\n`;
      }
      output += `PlayerTextDrawAlignment(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${ompAlignmentString(data.alignment)});\r\n`;
      output += `PlayerTextDrawColour(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.color});\r\n`;

      if (data.useBox === 1) {
        const boolStr = data.useBox ? "true" : "false";
        output += `PlayerTextDrawUseBox(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${boolStr});\r\n`;
        output += `PlayerTextDrawBoxColour(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.boxColor});\r\n`;
      }
      output += `PlayerTextDrawSetShadow(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.shadow});\r\n`;
      output += `PlayerTextDrawSetOutline(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.outline});\r\n`;
      output += `PlayerTextDrawBackgroundColour(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.bgColor});\r\n`;
      output += `PlayerTextDrawFont(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${ompFontString(data.font)});\r\n`;
      const propBool = data.proportional ? "true" : "false";
      output += `PlayerTextDrawSetProportional(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${propBool});\r\n`;

      if (data.selectable === 1) {
        output += `PlayerTextDrawSetSelectable(playerid, ${ProjectManager.playerName}[playerid][${idx}], true);\r\n`;
      }
      if (data.font === 5) {
        output += `PlayerTextDrawSetPreviewModel(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.previewModel});\r\n`;
        output += `PlayerTextDrawSetPreviewRot(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${fmt3(data.previewRot[0])}, ${fmt3(data.previewRot[1])}, ${fmt3(data.previewRot[2])}, ${fmt3(data.previewRot[3])});\r\n`;
        output += `PlayerTextDrawSetPreviewVehicleColours(playerid, ${ProjectManager.playerName}[playerid][${idx}], ${data.previewVc[0]}, ${data.previewVc[1]});\r\n`;
      }

      output += "\r\n";
      idx++;
    }
  }

  // ---- Global TDs with var names (open.mp) ----
  const varGCount = TextDrawManager.getVarGlobalCount();
  if (varGCount > 0) {
    output +=
      "####################################################################################################\r\n\r\n";

    for (const id of ids) {
      const data = TextDrawManager.getData(id);
      if (!data || data.globalPlayer !== 0 || data.varName.length === 0) continue;
      output += `new Text: ${data.varName};\r\n`;
    }
    output += "\r\n";

    for (const id of ids) {
      const data = TextDrawManager.getData(id);
      if (!data || data.globalPlayer !== 0 || data.varName.length === 0) continue;
      const vn = data.varName;

      output += `${vn} = TextDrawCreate(${fmt3(data.pos[0])}, ${fmt3(data.pos[1])}, "${escapePawnString(data.string)}");\r\n`;

      if (data.letterSize[0] !== 0 || data.letterSize[1] !== 0) {
        output += `TextDrawLetterSize(${vn}, ${fmt3(data.letterSize[0])}, ${fmt3(data.letterSize[1])});\r\n`;
      }
      if (data.textSize[0] !== 0 || data.textSize[1] !== 0) {
        output += `TextDrawTextSize(${vn}, ${fmt3(data.textSize[0])}, ${fmt3(data.textSize[1])});\r\n`;
      }
      output += `TextDrawAlignment(${vn}, ${ompAlignmentString(data.alignment)});\r\n`;
      output += `TextDrawColour(${vn}, ${data.color});\r\n`;

      if (data.useBox === 1) {
        output += `TextDrawUseBox(${vn}, true);\r\n`;
        output += `TextDrawBoxColour(${vn}, ${data.boxColor});\r\n`;
      }
      output += `TextDrawSetShadow(${vn}, ${data.shadow});\r\n`;
      output += `TextDrawSetOutline(${vn}, ${data.outline});\r\n`;
      output += `TextDrawBackgroundColour(${vn}, ${data.bgColor});\r\n`;
      output += `TextDrawFont(${vn}, ${ompFontString(data.font)});\r\n`;
      output += `TextDrawSetProportional(${vn}, ${data.proportional ? "true" : "false"});\r\n`;

      if (data.selectable === 1) {
        output += `TextDrawSetSelectable(${vn}, true);\r\n`;
      }
      if (data.font === 5) {
        output += `TextDrawSetPreviewModel(${vn}, ${data.previewModel});\r\n`;
        output += `TextDrawSetPreviewRot(${vn}, ${fmt3(data.previewRot[0])}, ${fmt3(data.previewRot[1])}, ${fmt3(data.previewRot[2])}, ${fmt3(data.previewRot[3])});\r\n`;
        output += `TextDrawSetPreviewVehicleColours(${vn}, ${data.previewVc[0]}, ${data.previewVc[1]});\r\n`;
      }

      output += "\r\n";
    }
  }

  // ---- Player TDs with var names (open.mp) ----
  const varPCount = TextDrawManager.getVarPlayerCount();
  if (varPCount > 0) {
    output +=
      "####################################################################################################\r\n\r\n";

    for (const id of ids) {
      const data = TextDrawManager.getData(id);
      if (!data || data.globalPlayer !== 1 || data.varName.length === 0) continue;
      const vn = data.varName;
      output += `new PlayerText: ${vn}[MAX_PLAYERS];\r\n`;
    }
    output += "\r\n";

    for (const id of ids) {
      const data = TextDrawManager.getData(id);
      if (!data || data.globalPlayer !== 1 || data.varName.length === 0) continue;
      const vn = data.varName;

      output += `${vn}[playerid] = CreatePlayerTextDraw(playerid, ${fmt3(data.pos[0])}, ${fmt3(data.pos[1])}, "${escapePawnString(data.string)}");\r\n`;

      if (data.letterSize[0] !== 0 || data.letterSize[1] !== 0) {
        output += `PlayerTextDrawLetterSize(playerid, ${vn}[playerid], ${fmt3(data.letterSize[0])}, ${fmt3(data.letterSize[1])});\r\n`;
      }
      if (data.textSize[0] !== 0 || data.textSize[1] !== 0) {
        output += `PlayerTextDrawTextSize(playerid, ${vn}[playerid], ${fmt3(data.textSize[0])}, ${fmt3(data.textSize[1])});\r\n`;
      }
      output += `PlayerTextDrawAlignment(playerid, ${vn}[playerid], ${ompAlignmentString(data.alignment)});\r\n`;
      output += `PlayerTextDrawColour(playerid, ${vn}[playerid], ${data.color});\r\n`;

      if (data.useBox === 1) {
        output += `PlayerTextDrawUseBox(playerid, ${vn}[playerid], true);\r\n`;
        output += `PlayerTextDrawBoxColour(playerid, ${vn}[playerid], ${data.boxColor});\r\n`;
      }
      output += `PlayerTextDrawSetShadow(playerid, ${vn}[playerid], ${data.shadow});\r\n`;
      output += `PlayerTextDrawSetOutline(playerid, ${vn}[playerid], ${data.outline});\r\n`;
      output += `PlayerTextDrawBackgroundColour(playerid, ${vn}[playerid], ${data.bgColor});\r\n`;
      output += `PlayerTextDrawFont(playerid, ${vn}[playerid], ${ompFontString(data.font)});\r\n`;
      output += `PlayerTextDrawSetProportional(playerid, ${vn}[playerid], ${data.proportional ? "true" : "false"});\r\n`;

      if (data.selectable === 1) {
        output += `PlayerTextDrawSetSelectable(playerid, ${vn}[playerid], true);\r\n`;
      }
      if (data.font === 5) {
        output += `PlayerTextDrawSetPreviewModel(playerid, ${vn}[playerid], ${data.previewModel});\r\n`;
        output += `PlayerTextDrawSetPreviewRot(playerid, ${vn}[playerid], ${fmt3(data.previewRot[0])}, ${fmt3(data.previewRot[1])}, ${fmt3(data.previewRot[2])}, ${fmt3(data.previewRot[3])});\r\n`;
        output += `PlayerTextDrawSetPreviewVehicleColours(playerid, ${vn}[playerid], ${data.previewVc[0]}, ${data.previewVc[1]});\r\n`;
      }

      output += "\r\n";
    }
  }

  fs.writeFileSync(filePath, output, "utf-8");
  return ids.length;
}

// ---------------------------------------------------------------------------
//  Utility helpers
// ---------------------------------------------------------------------------
function fmt3(v: number): string {
  return v.toFixed(3);
}

function escapePawnString(str: string): string {
  // Escape backslashes first, then double quotes
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
