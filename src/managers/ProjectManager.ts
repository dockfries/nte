import type { Player } from "@infernus/core";
import { CONFIG } from "../constants/config";
import { COLORS } from "../constants/colors";
import type { ProjectData } from "../types";
import * as DB from "../services/DatabaseService";
import { msgError, msgInfo, fileNameCheck } from "../utils/helpers";
import { $t } from "../i18n";
import { getPlayerLocale } from "../features/spawn";
import fs from "node:fs";
import path from "node:path";
import { TextDrawManager } from "./TextDrawManager";
import { HudManager } from "./HudManager";
import { getState } from "../state";

export class ProjectManager {
  private static _isOpen = false;
  private static _name = "";
  private static _hour = 12;
  private static _hudY: number = CONFIG.DEFAULT_HUD_Y;
  private static _globalName = "Text_Global";
  private static _playerName = "Text_Player";

  static get isOpen() {
    return ProjectManager._isOpen;
  }
  static get name() {
    return ProjectManager._name;
  }
  static get hour() {
    return ProjectManager._hour;
  }
  static get hudY() {
    return ProjectManager._hudY;
  }
  static get globalName() {
    return ProjectManager._globalName;
  }
  static get playerName() {
    return ProjectManager._playerName;
  }

  static set hour(v: number) {
    ProjectManager._hour = v;
  }
  static set hudY(v: number) {
    ProjectManager._hudY = v;
  }
  static set globalName(v: string) {
    ProjectManager._globalName = v;
  }
  static set playerName(v: string) {
    ProjectManager._playerName = v;
  }

  static create(player: Player, name: string): boolean {
    const locale = getPlayerLocale(player);
    if (ProjectManager._isOpen) {
      msgError(player, $t("project.error_open", null, locale));
      return false;
    }
    if (!name) {
      msgError(player, $t("project.error_name_empty", null, locale));
      return false;
    }
    if (name.length > CONFIG.PROJECT_MAX_NAME) {
      msgError(player, $t("project.error_name_long", null, locale));
      return false;
    }
    if (fileNameCheck(name)) {
      msgError(player, $t("project.error_name_invalid", null, locale));
      return false;
    }
    if (DB.projectNameExists(name)) {
      msgError(player, $t("project.error_name_exists", null, locale));
      return false;
    }

    DB.insertProject(name);
    DB.openProjectDb(name);
    DB.saveSettings({
      name,
      hour: ProjectManager._hour,
      hudY: ProjectManager._hudY,
      globalName: ProjectManager._globalName,
      playerName: ProjectManager._playerName,
    });

    ProjectManager._isOpen = true;
    ProjectManager._name = name;
    TextDrawManager.clear();
    HudManager.rebuild(true);
    // Re-enable mouse for HUD interaction (dialog closes it automatically)
    getState(player).mouseEnabled = true;
    player.selectTextDraw(COLORS.MOUSE_DEFAULT);
    msgInfo(player, $t("project.info_created", [name], locale));
    return true;
  }

  static load(player: Player, name: string): boolean {
    const locale = getPlayerLocale(player);
    if (ProjectManager._isOpen && ProjectManager._name === name) {
      msgError(player, $t("project.error_already_loaded", null, locale));
      return false;
    }
    if (ProjectManager._isOpen) {
      msgError(player, $t("project.error_open", null, locale));
      return false;
    }

    DB.openProjectDb(name);
    const settings = DB.loadSettings();
    if (!settings) {
      msgError(player, $t("project.error_load_failed", null, locale));
      return false;
    }

    ProjectManager._isOpen = true;
    ProjectManager._name = name;
    ProjectManager._hour = settings.hour;
    ProjectManager._hudY = settings.hudY;
    ProjectManager._globalName = settings.globalName;
    ProjectManager._playerName = settings.playerName;

    TextDrawManager.clear();
    const loaded = DB.loadTextDraws();
    for (const td of loaded) {
      TextDrawManager.addLoaded(td);
      try {
        TextDrawManager.renderAndShow(td.id);
      } catch {
        msgError(player, $t("project.error_textdraw_load", [String(td.id)], locale));
      }
    }

    HudManager.rebuild(true);
    // PAWN: SetPlayerTime(playerid, gProjectHour, 0)
    player.setTime(ProjectManager._hour, 0);
    // Re-enable mouse for HUD interaction (dialog closes it automatically)
    getState(player).mouseEnabled = true;
    player.selectTextDraw(COLORS.MOUSE_DEFAULT);
    const g = loaded.filter((t) => t.globalPlayer === 0).length;
    const p = loaded.filter((t) => t.globalPlayer === 1).length;
    msgInfo(player, $t("project.info", [name, String(g), String(p), String(g + p)], locale));
    return true;
  }

  static close(player: Player): boolean {
    const locale = getPlayerLocale(player);
    if (!ProjectManager._isOpen) {
      msgError(player, $t("project.error_no_open", null, locale));
      return false;
    }
    DB.closeProjectDb();
    ProjectManager._isOpen = false;
    ProjectManager._name = "";
    ProjectManager._hour = 12;
    ProjectManager._hudY = CONFIG.DEFAULT_HUD_Y;
    ProjectManager._globalName = "Text_Global";
    ProjectManager._playerName = "Text_Player";
    // PAWN: SetPlayerTime(playerid, gProjectHour = 12, 00)
    player.setTime(12, 0);
    TextDrawManager.clear();
    HudManager.rebuild(true);
    msgInfo(player, $t("project.info_closed", null, locale));
    return true;
  }

  static deleteProject(player: Player, name: string) {
    const locale = getPlayerLocale(player);
    if (ProjectManager._isOpen && ProjectManager._name === name) {
      msgError(player, $t("project.error_delete_open", null, locale));
      return false;
    }
    DB.deleteProject(name);
    try {
      const dbPath = path.resolve("scriptfiles", "projects", `${name}.db`);
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    } catch {
      void 0;
    }
    msgInfo(player, $t("project.info_deleted", [name], locale));
    return true;
  }

  static getProjectData(): ProjectData {
    return {
      name: ProjectManager._name,
      hour: ProjectManager._hour,
      hudY: ProjectManager._hudY,
      globalName: ProjectManager._globalName,
      playerName: ProjectManager._playerName,
    };
  }
}
