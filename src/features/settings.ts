import { Dialog, DialogStylesEnum, KeysEnum } from "@infernus/core";
import type { Player } from "@infernus/core";
import * as DB from "../services/DatabaseService";
import { ProjectManager } from "../managers/ProjectManager";
import { HudManager } from "../managers/HudManager";
import { msgInfo, restoreMouse } from "../utils/helpers";
import { COLORS } from "../constants/colors";
import { getState, setMode, type PlayerState } from "../state";
import { getPlayerLocale } from "./spawn";
import { $t } from "../i18n";

export async function showSettingsMenu(player: Player) {
  const locale = getPlayerLocale(player);
  try {
    const dlg = new Dialog({
      style: DialogStylesEnum.TABLIST_HEADERS,
      caption: $t("settings.title", null, locale),
      info: `${$t("settings.header_1", null, locale)}\t${$t("settings.header_2", null, locale)}\n{A3CB38}${$t("settings.content_1", null, locale)}\t${String(ProjectManager.hour).padStart(2, "0")}:00\n{A3CB38}${$t("settings.content_2", null, locale)}\t${ProjectManager.hudY.toFixed(1)}\n{A3CB38}${$t("settings.content_3", null, locale)}\t${ProjectManager.globalName}\n{A3CB38}${$t("settings.content_4", null, locale)}\t${ProjectManager.playerName}`,
      button1: $t("settings.btn1", null, locale),
      button2: $t("settings.btn2", null, locale),
    });
    const { response, listItem } = await dlg.show(player);
    if (!response) {
      // PAWN: return SetMouse(playerid, true, TEXTMODE_NORMAL)
      restoreMouse(player);
      return;
    }
    switch (listItem) {
      case 0:
        await showTimeMenu(player);
        break;
      case 1:
        startHudMove(player);
        break;
      case 2:
        await showGlobalVarName(player);
        break;
      case 3:
        await showPlayerVarName(player);
        break;
    }
  } catch {
    void 0;
  }
}

export async function showTimeMenu(player: Player) {
  const locale = getPlayerLocale(player);
  try {
    let content = "";
    for (let i = 0; i <= 23; i++) content += `${String(i).padStart(2, "0")}:00\n`;
    const dlg = new Dialog({
      style: DialogStylesEnum.LIST,
      caption: $t("time.title", null, locale),
      info: content,
      button1: $t("time.btn1", null, locale),
      button2: $t("time.btn2", null, locale),
    });
    const { response, listItem } = await dlg.show(player);
    if (!response) {
      // PAWN: return SettingsMenu(playerid)
      await showSettingsMenu(player);
      return;
    }
    ProjectManager.hour = listItem;
    player.setTime(ProjectManager.hour, 0);
    DB.updateSettingHour(ProjectManager.hour);
    msgInfo(player, $t("time.info", [String(ProjectManager.hour).padStart(2, "0")], locale));
  } catch {
    void 0;
  }
}

export async function showGlobalVarName(player: Player) {
  const locale = getPlayerLocale(player);
  try {
    const dlg = new Dialog({
      style: DialogStylesEnum.INPUT,
      caption: $t("var_global.title", null, locale),
      info: `${$t("var_global.content_1", null, locale)}\n${$t("var_global.content_2", null, locale)}`,
      button1: $t("var_global.btn1", null, locale),
      button2: $t("var_global.btn2", null, locale),
    });
    const { response, inputText } = await dlg.show(player);
    if (!response) {
      // PAWN: return SettingsMenu(playerid)
      await showSettingsMenu(player);
      return;
    }
    if (inputText) {
      ProjectManager.globalName = inputText;
      DB.updateSettingGlobalName(ProjectManager.globalName);
      msgInfo(player, $t("var_global.info", [ProjectManager.globalName], locale));
    } else {
      ProjectManager.globalName = "Text_Global";
      DB.updateSettingGlobalName(ProjectManager.globalName);
      msgInfo(player, $t("var_global.info", ["Text_Global"], locale));
    }
  } catch {
    void 0;
  }
}

export async function showPlayerVarName(player: Player) {
  const locale = getPlayerLocale(player);
  try {
    const dlg = new Dialog({
      style: DialogStylesEnum.INPUT,
      caption: $t("var_global.title", null, locale),
      info: `${$t("var_global.content_1", null, locale)}\n${$t("var_global.content_2", null, locale)}`,
      button1: $t("var_global.btn1", null, locale),
      button2: $t("var_global.btn2", null, locale),
    });
    const { response, inputText } = await dlg.show(player);
    if (!response) {
      // PAWN: return SettingsMenu(playerid)
      await showSettingsMenu(player);
      return;
    }
    if (inputText) {
      ProjectManager.playerName = inputText;
      DB.updateSettingPlayerName(ProjectManager.playerName);
      msgInfo(player, $t("var_global.info", [ProjectManager.playerName], locale));
    } else {
      ProjectManager.playerName = "Text_Player";
      DB.updateSettingPlayerName(ProjectManager.playerName);
      msgInfo(player, $t("var_global.info", ["Text_Player"], locale));
    }
  } catch {
    void 0;
  }
}

export function startHudMove(player: Player) {
  if (!ProjectManager.isOpen) return;
  const s = getState(player);
  setMode(player, "hud");
  // PAWN: TogglePlayerControllable(playerid, 0) for world mode
  if (s.spawnMode === 1) {
    player.toggleControllable(false);
  }
  // Mark mouse as disabled BEFORE cancelling, so if cancelSelectTextDraw
  // triggers OnPlayerClickTextDraw(INVALID_TEXT_DRAW), our ESC handler won't re-enable it.
  HudManager.rebuild(true);
  s.mouseEnabled = false;
  player.cancelSelectTextDraw();
  msgInfo(player, $t("hud_position.content", null, getPlayerLocale(player)));
  s.interval = setInterval(() => {
    HudManager.hideInfoText();
    if (s.mode !== "hud") return;
    const keys = player.getKeys();
	    const speed = (keys.keys & KeysEnum.SPRINT) !== 0 ? 10 : 1;
    if (keys.upDown < -1) {
      ProjectManager.hudY = Math.max(0, ProjectManager.hudY - speed);
      HudManager.rebuild(true);
      HudManager.setInfoText(`HUD Y: ${ProjectManager.hudY.toFixed(1)}`);
    }
    if (keys.upDown > 1) {
      ProjectManager.hudY = Math.min(413, ProjectManager.hudY + speed);
      HudManager.rebuild(true);
      HudManager.setInfoText(`HUD Y: ${ProjectManager.hudY.toFixed(1)}`);
    }
  }, 20);
}

export function confirmHudMove(player: Player, s: PlayerState) {
  setMode(player, "none");
  DB.updateSettingHudY(ProjectManager.hudY);
  msgInfo(player, $t("hud_position.info", null, getPlayerLocale(player)));
  HudManager.rebuild(true);
  // PAWN: TogglePlayerControllable(playerid, 1) for world mode
  if (s.spawnMode === 1) {
    player.toggleControllable(true);
  }
  // Re-enable mouse (PAWN: SetMouse(playerid, true, TEXTMODE_NORMAL))
  s.mouseEnabled = true;
  player.selectTextDraw(COLORS.MOUSE_DEFAULT);
}
