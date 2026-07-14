import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { CONFIG } from "../constants/config";
import type { TextDrawData, ProjectData } from "../types";

const DATA_DIR = path.resolve("scriptfiles");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");

let projectListDb: Database.Database | null = null;
let projectDb: Database.Database | null = null;

interface CountRow {
  total: number;
}
interface SettingsRow {
  hour: number;
  hud_y: number;
  global_name: string;
  player_name: string;
}
interface TextDrawRow {
  id: number;
  content: string;
  posX: number;
  posY: number;
  lettersizeX: number;
  lettersizeY: number;
  textsizeX: number;
  textsizeY: number;
  alignment: number;
  color: number;
  usebox: number;
  boxcolor: number;
  shadow: number;
  outline: number;
  bgcolor: number;
  font: number;
  proportional: number;
  selectable: number;
  previewModel: number;
  previewX: number;
  previewY: number;
  previewZ: number;
  previewZoom: number;
  previewVC1: number;
  previewVC2: number;
  globalPlayer: number;
  varname: string;
  group_id: number;
}
interface UndoRow extends TextDrawRow {
  sid: number;
}
interface DeletedRow extends TextDrawRow {
  date: number;
  previewVC1: number;
  previewVC2: number;
}

function ensureDirs(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  if (!fs.existsSync(path.join(DATA_DIR, "import")))
    fs.mkdirSync(path.join(DATA_DIR, "import"), { recursive: true });
  if (!fs.existsSync(path.join(DATA_DIR, "export")))
    fs.mkdirSync(path.join(DATA_DIR, "export"), { recursive: true });
}

export function initDatabase(): void {
  ensureDirs();
  projectListDb = new Database(path.join(DATA_DIR, CONFIG.FILE_PROJECTS.replace("data/", "")));
  projectListDb!.exec(`CREATE TABLE IF NOT EXISTS projects (name TEXT, date INTEGER)`);
}

export function closeDatabases(): void {
  if (projectDb) {
    projectDb.close();
    projectDb = null;
  }
  if (projectListDb) {
    projectListDb.close();
    projectListDb = null;
  }
}

function getProjectListDb(): Database.Database {
  if (!projectListDb) throw new Error("Database not initialized");
  return projectListDb;
}

export function projectNameExists(name: string): boolean {
  const stmt = getProjectListDb().prepare("SELECT name FROM projects WHERE LOWER(name) = LOWER(?)");
  return !!stmt.get(name);
}

export function insertProject(name: string): void {
  getProjectListDb()
    .prepare("INSERT INTO projects (name, date) VALUES (?, ?)")
    .run(name, Math.floor(Date.now() / 1000));
}

export function deleteProject(name: string): void {
  getProjectListDb().prepare("DELETE FROM projects WHERE LOWER(name) = LOWER(?)").run(name);
}

export function listProjects(page: number): {
  rows: { name: string; date: number }[];
  total: number;
} {
  const countRow = getProjectListDb()
    .prepare("SELECT COUNT(*) as total FROM projects")
    .get() as CountRow;
  const rows = getProjectListDb()
    .prepare("SELECT name, date FROM projects ORDER BY date DESC LIMIT ? OFFSET ?")
    .all(CONFIG.PROJECT_MAX_ITEMS, page * CONFIG.PROJECT_MAX_ITEMS) as {
    name: string;
    date: number;
  }[];
  return { rows, total: countRow.total };
}

export function openProjectDb(projectName: string): void {
  if (projectDb) projectDb.close();
  const dbPath = path.join(PROJECTS_DIR, `${projectName}.db`);
  projectDb = new Database(dbPath);
  projectDb.exec(
    `CREATE TABLE IF NOT EXISTS settings (version TEXT, hour INTEGER, hud_y REAL, global_name TEXT, player_name TEXT)`,
  );
  projectDb.exec(
    `CREATE TABLE IF NOT EXISTS textdraws (id INTEGER PRIMARY KEY, content TEXT, posX REAL, posY REAL, lettersizeX REAL, lettersizeY REAL, textsizeX REAL, textsizeY REAL, alignment INTEGER, color INTEGER, usebox INTEGER, boxcolor INTEGER, shadow INTEGER, outline INTEGER, bgcolor INTEGER, font INTEGER, proportional INTEGER, selectable INTEGER, previewModel INTEGER, previewX REAL, previewY REAL, previewZ REAL, previewZoom REAL, previewVC1 INTEGER, previewVC2 INTEGER, globalPlayer INTEGER, varname TEXT, group_id INTEGER)`,
  );
  projectDb.exec(
    `CREATE TABLE IF NOT EXISTS undo_redo (sid INTEGER PRIMARY KEY AUTOINCREMENT, id INTEGER, content TEXT, posX REAL, posY REAL, lettersizeX REAL, lettersizeY REAL, textsizeX REAL, textsizeY REAL, alignment INTEGER, color INTEGER, usebox INTEGER, boxcolor INTEGER, shadow INTEGER, outline INTEGER, bgcolor INTEGER, font INTEGER, proportional INTEGER, selectable INTEGER, previewModel INTEGER, previewX REAL, previewY REAL, previewZ REAL, previewZoom REAL, previewVC1 INTEGER, previewVC2 INTEGER, globalPlayer INTEGER, varname TEXT, group_id INTEGER)`,
  );
  projectDb.exec(
    `CREATE TABLE IF NOT EXISTS deleted (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT, posX REAL, posY REAL, lettersizeX REAL, lettersizeY REAL, textsizeX REAL, textsizeY REAL, alignment INTEGER, color INTEGER, usebox INTEGER, boxcolor INTEGER, shadow INTEGER, outline INTEGER, bgcolor INTEGER, font INTEGER, proportional INTEGER, selectable INTEGER, previewModel INTEGER, previewX REAL, previewY REAL, previewZ REAL, previewZoom REAL, previewVC1 INTEGER, previewVC2 INTEGER, globalPlayer INTEGER, varname TEXT, group_id INTEGER, date INTEGER)`,
  );
}

export function closeProjectDb(): void {
  if (projectDb) {
    projectDb.close();
    projectDb = null;
  }
}

export function getProjectDb(): Database.Database {
  if (!projectDb) throw new Error("Project database not open");
  return projectDb;
}

export function saveSettings(data: ProjectData): void {
  getProjectDb()
    .prepare(
      `INSERT OR REPLACE INTO settings (version, hour, hud_y, global_name, player_name) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(CONFIG.VERSION, data.hour, data.hudY, data.globalName, data.playerName);
}

export function loadSettings(): ProjectData | null {
  const row = getProjectDb().prepare("SELECT * FROM settings").get() as SettingsRow | undefined;
  if (!row) return null;
  return {
    name: "",
    hour: row.hour ?? 12,
    hudY: row.hud_y ?? CONFIG.DEFAULT_HUD_Y,
    globalName: row.global_name ?? "Text_Global",
    playerName: row.player_name ?? "Text_Player",
  };
}

export function updateSettingHour(hour: number): void {
  getProjectDb().prepare("UPDATE settings SET hour = ?").run(hour);
}

export function updateSettingHudY(hudY: number): void {
  getProjectDb().prepare("UPDATE settings SET hud_y = ?").run(hudY);
}

export function updateSettingGlobalName(name: string): void {
  getProjectDb().prepare("UPDATE settings SET global_name = ?").run(name);
}

export function updateSettingPlayerName(name: string): void {
  getProjectDb().prepare("UPDATE settings SET player_name = ?").run(name);
}

function rowToTextDraw(r: TextDrawRow): TextDrawData {
  return {
    id: r.id,
    string: r.content ?? "_",
    pos: [r.posX ?? 0, r.posY ?? 0] as [number, number],
    letterSize: [r.lettersizeX ?? 0, r.lettersizeY ?? 0] as [number, number],
    textSize: [r.textsizeX ?? 0, r.textsizeY ?? 0] as [number, number],
    alignment: r.alignment ?? 1,
    color: r.color ?? 0xffffffff,
    useBox: r.usebox ?? 0,
    boxColor: r.boxcolor ?? 0,
    shadow: r.shadow ?? 0,
    outline: r.outline ?? 0,
    bgColor: r.bgcolor ?? 0,
    font: r.font ?? 1,
    proportional: r.proportional ?? 1,
    selectable: r.selectable ?? 0,
    previewModel: r.previewModel ?? 0,
    previewRot: [r.previewX ?? 0, r.previewY ?? 0, r.previewZ ?? 0, r.previewZoom ?? 1] as [
      number,
      number,
      number,
      number,
    ],
    previewVc: [r.previewVC1 ?? 0, r.previewVC2 ?? 0] as [number, number],
    globalPlayer: r.globalPlayer ?? 0,
    varName: r.varname ?? "",
    group: r.group_id ?? 0,
  };
}

export function insertTextDraw(td: TextDrawData): void {
  getProjectDb()
    .prepare(
      `INSERT INTO textdraws (id, content, posX, posY, lettersizeX, lettersizeY, textsizeX, textsizeY, alignment, color, usebox, boxcolor, shadow, outline, bgcolor, font, proportional, selectable, previewModel, previewX, previewY, previewZ, previewZoom, previewVC1, previewVC2, globalPlayer, varname, group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      td.id,
      td.string,
      td.pos[0],
      td.pos[1],
      td.letterSize[0],
      td.letterSize[1],
      td.textSize[0],
      td.textSize[1],
      td.alignment,
      td.color,
      td.useBox,
      td.boxColor,
      td.shadow,
      td.outline,
      td.bgColor,
      td.font,
      td.proportional,
      td.selectable,
      td.previewModel,
      td.previewRot[0],
      td.previewRot[1],
      td.previewRot[2],
      td.previewRot[3],
      td.previewVc[0],
      td.previewVc[1],
      td.globalPlayer,
      td.varName,
      td.group,
    );
}

export function updateTextDraw(td: TextDrawData): void {
  getProjectDb()
    .prepare(
      `UPDATE textdraws SET content=?, posX=?, posY=?, lettersizeX=?, lettersizeY=?, textsizeX=?, textsizeY=?, alignment=?, color=?, usebox=?, boxcolor=?, shadow=?, outline=?, bgcolor=?, font=?, proportional=?, selectable=?, previewModel=?, previewX=?, previewY=?, previewZ=?, previewZoom=?, previewVC1=?, previewVC2=?, globalPlayer=?, varname=?, group_id=? WHERE id=?`,
    )
    .run(
      td.string,
      td.pos[0],
      td.pos[1],
      td.letterSize[0],
      td.letterSize[1],
      td.textSize[0],
      td.textSize[1],
      td.alignment,
      td.color,
      td.useBox,
      td.boxColor,
      td.shadow,
      td.outline,
      td.bgColor,
      td.font,
      td.proportional,
      td.selectable,
      td.previewModel,
      td.previewRot[0],
      td.previewRot[1],
      td.previewRot[2],
      td.previewRot[3],
      td.previewVc[0],
      td.previewVc[1],
      td.globalPlayer,
      td.varName,
      td.group,
      td.id,
    );
}

export function deleteTextDraw(id: number): void {
  getProjectDb().prepare("DELETE FROM textdraws WHERE id = ?").run(id);
}

export function loadTextDraws(): TextDrawData[] {
  const rows = getProjectDb().prepare("SELECT * FROM textdraws ORDER BY id").all() as TextDrawRow[];
  return rows.map(rowToTextDraw);
}

export function updateTextDrawGroupWhere(group: number, condition: string, _value: unknown): void {
  getProjectDb().prepare(`UPDATE textdraws SET group_id = ? WHERE ${condition}`).run(group);
}

export function insertUndoRedo(id: number, td: TextDrawData): void {
  const db = getProjectDb();
  const count = (
    db.prepare("SELECT COUNT(*) as total FROM undo_redo WHERE id = ?").get(id) as CountRow
  ).total;
  if (count >= CONFIG.MAX_UNDO_REDO) {
    const oldest = db
      .prepare("SELECT sid FROM undo_redo WHERE id = ? ORDER BY sid LIMIT 1")
      .get(id) as { sid: number } | undefined;
    if (oldest) db.prepare("DELETE FROM undo_redo WHERE sid = ?").run(oldest.sid);
  }
  db.prepare(
    `INSERT INTO undo_redo (id, content, posX, posY, lettersizeX, lettersizeY, textsizeX, textsizeY, alignment, color, usebox, boxcolor, shadow, outline, bgcolor, font, proportional, selectable, previewModel, previewX, previewY, previewZ, previewZoom, previewVC1, previewVC2, globalPlayer, varname, group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    td.string,
    td.pos[0],
    td.pos[1],
    td.letterSize[0],
    td.letterSize[1],
    td.textSize[0],
    td.textSize[1],
    td.alignment,
    td.color,
    td.useBox,
    td.boxColor,
    td.shadow,
    td.outline,
    td.bgColor,
    td.font,
    td.proportional,
    td.selectable,
    td.previewModel,
    td.previewRot[0],
    td.previewRot[1],
    td.previewRot[2],
    td.previewRot[3],
    td.previewVc[0],
    td.previewVc[1],
    td.globalPlayer,
    td.varName,
    td.group,
  );
}

export function deleteUndoRedo(id: number): void {
  getProjectDb().prepare("DELETE FROM undo_redo WHERE id = ?").run(id);
}

export function loadUndoRedo(id: number): { sid: number; td: TextDrawData }[] {
  const rows = getProjectDb()
    .prepare("SELECT * FROM undo_redo WHERE id = ? ORDER BY sid DESC")
    .all(id) as UndoRow[];
  return rows.map((r) => ({ sid: r.sid, td: { ...rowToTextDraw(r), group: 0 } }));
}

export function deleteUndoRedoSid(sid: number): void {
  getProjectDb().prepare("DELETE FROM undo_redo WHERE sid = ?").run(sid);
}

export function insertDeleted(td: TextDrawData): void {
  getProjectDb()
    .prepare(
      `INSERT INTO deleted (content, posX, posY, lettersizeX, lettersizeY, textsizeX, textsizeY, alignment, color, usebox, boxcolor, shadow, outline, bgcolor, font, proportional, selectable, previewModel, previewX, previewY, previewZ, previewZoom, previewVC1, previewVC2, globalPlayer, varname, group_id, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      td.string,
      td.pos[0],
      td.pos[1],
      td.letterSize[0],
      td.letterSize[1],
      td.textSize[0],
      td.textSize[1],
      td.alignment,
      td.color,
      td.useBox,
      td.boxColor,
      td.shadow,
      td.outline,
      td.bgColor,
      td.font,
      td.proportional,
      td.selectable,
      td.previewModel,
      td.previewRot[0],
      td.previewRot[1],
      td.previewRot[2],
      td.previewRot[3],
      td.previewVc[0],
      td.previewVc[1],
      td.globalPlayer,
      td.varName,
      0,
      Math.floor(Date.now() / 1000),
    );
}

export function loadDeleted(page: number): { rows: DeletedRow[]; total: number } {
  const countRow = getProjectDb()
    .prepare("SELECT COUNT(*) as total FROM deleted")
    .get() as CountRow;
  const rows = getProjectDb()
    .prepare("SELECT * FROM deleted ORDER BY id DESC LIMIT ? OFFSET ?")
    .all(CONFIG.MAX_DELETED_ITEMS, page * CONFIG.MAX_DELETED_ITEMS) as DeletedRow[];
  return { rows, total: countRow.total };
}

export function getDeletedItem(id: number): DeletedRow | undefined {
  return getProjectDb().prepare("SELECT * FROM deleted WHERE id = ?").get(id) as
    | DeletedRow
    | undefined;
}

export function deleteDeletedItem(id: number): void {
  getProjectDb().prepare("DELETE FROM deleted WHERE id = ?").run(id);
}

export function clearDeleted(): void {
  getProjectDb().prepare("DELETE FROM deleted").run();
}

export function getAllDeleted(): DeletedRow[] {
  return getProjectDb().prepare("SELECT * FROM deleted ORDER BY id DESC").all() as DeletedRow[];
}

export function deleteAllTextDraws(): void {
  getProjectDb().prepare("DELETE FROM textdraws").run();
}

export function deleteAllUndoRedo(): void {
  getProjectDb().prepare("DELETE FROM undo_redo").run();
}
