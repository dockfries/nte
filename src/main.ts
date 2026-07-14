import { logger } from "./logger";
import {
  GameMode,
  PlayerEvent,
  TextDrawEvent,
  Vehicle,
  TextDraw,
  KeysEnum,
  InvalidEnum,
  isPressed,
} from "@infernus/core";
import type { Player } from "@infernus/core";
import { CONFIG } from "./constants/config";
import { COLORS } from "./constants/colors";
import * as DB from "./services/DatabaseService";
import { $t } from "./i18n";
import { getPlayerLocale } from "./features/spawn";
import { ProjectManager } from "./managers/ProjectManager";
import { TextDrawManager } from "./managers/TextDrawManager";
import { HudManager } from "./managers/HudManager";
import { msgError } from "./utils/helpers";
import { getState, cleanup } from "./state";
import { showLanguageSelect } from "./features/spawn";
import { showProjectMenu } from "./ui/ProjectDialogs";
import { showColorMenu } from "./ui/ColorPicker";
import { showListMenu } from "./ui/ListDialogs";
import {
  showTextEdit,
  showPreviewModels,
  showStorageMenu,
  showNewMenu,
} from "./ui/TextDrawDialogs";
import { showSettingsMenu, confirmHudMove } from "./features/settings";
import {
  startPos,
  startTS,
  startLS,
  startOL,
  startSH,
  startUndo,
  confirmMode,
  manualMode,
  confirmGroup,
} from "./features/interactive";
import {
  copyTD,
  deleteTD,
  cycleFont,
  cycleAlignment,
  toggleProportional,
  toggleBox,
  toggleSelectable,
  toggleGlobalPlayer,
} from "./features/actions";
import { showGroupingMenu } from "./ui/TextDrawDialogs";

// ─── GameMode Lifecycle ───

GameMode.onInit(({ next }) => {
  GameMode.supportAllNickname();
  GameMode.addSimpleModel(-1, 19379, -2000, "tde.dff", "tde.txd");
  GameMode.setGameModeText(`${CONFIG.HOSTNAME} ${CONFIG.VERSION}`);

  // Server banner (matching PAWN main())
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  logger.info("");
  logger.info("\t=================================");
  logger.info("\t|                               |");
  logger.info(`\t|      ${CONFIG.HOSTNAME} ${CONFIG.VERSION}      |`);
  logger.info("\t|                               |");
  logger.info("\t|  Coding:                      |");
  logger.info("\t|                               |");
  logger.info("\t|  Burak (Nexor)                |");
  logger.info("\t|                               |");
  logger.info("\t|  Loaded Date:                 |");
  logger.info("\t|                               |");
  logger.info(
    `\t|  ${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}            |`,
  );
  logger.info("\t|                               |");
  logger.info("\t|  Github:                      |");
  logger.info("\t|                               |");
  logger.info("\t|  github.com/nexquery          |");
  logger.info("\t|                               |");
  logger.info("\t|  Discord:                     |");
  logger.info("\t|                               |");
  logger.info("\t|  Nexor#4730                   |");
  logger.info("\t|                               |");
  logger.info("\t=================================");
  logger.info("");

  DB.initDatabase();
  HudManager.rebuild(false);
  return next();
});

GameMode.onExit(({ next }) => {
  DB.closeDatabases();
  return next();
});

// ─── Player Events ───

PlayerEvent.onConnect(({ player, next }) => {
  player.charset = "iso-8859-1"; // Set to your charset
  player.toggleSpectating(true);
  // PAWN: SetPlayerTime(playerid, gProjectHour, 00)
  player.setTime(ProjectManager.hour, 0);
  showLanguageSelect(player);
  return next();
});

PlayerEvent.onSpawn(({ player, next }) => {
  const s = getState(player);

  // Default to mode 0 (empty screen) if spawnMode was never set
  if (s.spawnMode === undefined) s.spawnMode = 0;

  if (s.spawnMode === 0) {
    // Empty screen / color background: freeze + camera + enable mouse (to click HUD toolbar)
    player.toggleControllable(false);
    // PAWN: SetPlayerCameraPos(KORDINAT_BOS_1 - 20.0) → Z = 13.5469 - 20.0 = -6.4531
    player.setCameraPos(CONFIG.EMPTY_COORDS.x, CONFIG.EMPTY_COORDS.y, CONFIG.EMPTY_COORDS.z - 20.0);
    // PAWN: SetPlayerCameraLookAt(KORDINAT_BOS_1 - 25.0) → Z = 13.5469 - 25.0 = -11.4531
    player.setCameraLookAt(
      CONFIG.EMPTY_COORDS.x,
      CONFIG.EMPTY_COORDS.y,
      CONFIG.EMPTY_COORDS.z - 25.0,
    );
    // Enable mouse for HUD interaction (matching PAWN: Hud_Tumunu_Yukle → Mouse(true))
    s.mouseEnabled = true;
    player.selectTextDraw(COLORS.MOUSE_DEFAULT);
  } else if (s.spawnMode === 1) {
    // World mode: disable mouse so player can move freely (use /mouse to enable)
    s.mouseEnabled = false;
    player.cancelSelectTextDraw();
  }

  HudManager.rebuild(true);
  HudManager.createInfoText();
  return next();
});

PlayerEvent.onDisconnect(({ player, next }) => {
  cleanup(player);
  return next();
});

// ─── Keyboard ───

PlayerEvent.onKeyStateChange(({ player, newKeys, oldKeys, next }) => {
  const s = getState(player);

  const KEY_ENTER = KeysEnum.SECONDARY_ATTACK; // = 16, main keyboard ENTER
  const KEY_N = KeysEnum.NO; // = 131072, N key

  if (isPressed(newKeys, oldKeys, KEY_ENTER) && s.mode !== "none" && s.mode !== "hud") {
    if (s.mode === "gpos" || s.mode === "gts") {
      confirmGroup(player, s);
      // PAWN: return to grouping menu after confirming group edits
      showGroupingMenu(player).catch(() => {});
    } else {
      confirmMode(player, s);
    }
    return next();
  }
  if (isPressed(newKeys, oldKeys, KEY_N) && s.mode !== "none") {
    manualMode(player, s);
    return next();
  }
  if (isPressed(newKeys, oldKeys, KEY_ENTER) && s.mode === "hud") {
    confirmHudMove(player, s);
    return next();
  }

  return next();
});

// ─── HUD Toolbar ───

TextDrawEvent.onPlayerClickGlobal(({ player, textDraw, next }) => {
  const btns = HudManager.getButtons() as TextDraw[];

  // ESC: re-enable mouse only when mouse was previously enabled (PAWN: gTextMode == TEXTMODE_NORMAL)
  if (textDraw === InvalidEnum.TEXT_DRAW) {
    const s = getState(player);
    if (s.mouseEnabled !== false) {
      player.selectTextDraw(COLORS.MOUSE_DEFAULT);
    }
    return next();
  }
  if (!btns) return next();

  const idx = btns.indexOf(textDraw as TextDraw);
  if (idx < 0) return next();
  handleClick(player, idx);
  return next();
});

function cancelMouse(player: Player) {
  // PAWN: SetMouse(false) → CancelSelectTextDraw immediately, before any action
  player.cancelSelectTextDraw();
}

function handleClick(player: Player, idx: number) {

  switch (idx) {
    // ─── Dialog actions (PAWN: SetMouse(false) + dialog) ───
    case 1:
      cancelMouse(player);
      showProjectMenu(player);
      break;
    case 2:
      if (ProjectManager.isOpen) {
        cancelMouse(player);
        showSettingsMenu(player);
      }
      break;
    case 3:
      if (ProjectManager.isOpen && TextDrawManager.count > 0) {
        cancelMouse(player);
        showListMenu(player, 1);
      }
      break;
    case 4:
      if (ProjectManager.isOpen) {
        cancelMouse(player);
        showStorageMenu(player);
      }
      break;
    case 5:
      if (ProjectManager.isOpen) {
        cancelMouse(player);
        showNewMenu(player);
      }
      break;
    case 11:
      if (ProjectManager.isOpen && TextDrawManager.selectedId >= 0) {
        cancelMouse(player);
        showTextEdit(player);
      }
      break;
    case 17:
      if (ProjectManager.isOpen && TextDrawManager.selectedId >= 0) {
        cancelMouse(player);
        showColorMenu(player, 0);
      }
      break;
    case 18:
      if (ProjectManager.isOpen && TextDrawManager.selectedId >= 0) {
        cancelMouse(player);
        showColorMenu(player, 1);
      }
      break;
    case 19:
      if (ProjectManager.isOpen && TextDrawManager.selectedId >= 0) {
        cancelMouse(player);
        showColorMenu(player, 2);
      }
      break;
    case 22:
      if (ProjectManager.isOpen && TextDrawManager.selectedId >= 0) {
        cancelMouse(player);
        showPreviewModels(player);
      }
      break;

    // ─── Interactive modes (PAWN: SetMouse(false) + action, enterInteractive cancels again) ───
    case 8:
      if (ProjectManager.isOpen && TextDrawManager.selectedId >= 0) {
        cancelMouse(player);
        startPos(player);
      }
      break;
    case 9:
      if (ProjectManager.isOpen && TextDrawManager.selectedId >= 0) {
        cancelMouse(player);
        startTS(player);
      }
      break;
    case 10:
      if (ProjectManager.isOpen && TextDrawManager.selectedId >= 0) {
        cancelMouse(player);
        startLS(player);
      }
      break;
    case 15:
      if (ProjectManager.isOpen && TextDrawManager.selectedId >= 0) {
        cancelMouse(player);
        startOL(player);
      }
      break;
    case 16:
      if (ProjectManager.isOpen && TextDrawManager.selectedId >= 0) {
        cancelMouse(player);
        startSH(player);
      }
      break;
    case 24:
      if (ProjectManager.isOpen && TextDrawManager.selectedId >= 0) {
        cancelMouse(player);
        startUndo(player);
      }
      break;

    // ─── Toggle actions (PAWN: no SetMouse call, mouse stays on) ───
    case 6:
      if (ProjectManager.isOpen && TextDrawManager.selectedId >= 0) copyTD(player);
      break;
    case 7:
      if (ProjectManager.isOpen && TextDrawManager.selectedId >= 0) deleteTD(player);
      break;
    case 12:
      if (ProjectManager.isOpen) cycleFont(player);
      break;
    case 13:
      if (ProjectManager.isOpen) cycleAlignment(player);
      break;
    case 14:
      if (ProjectManager.isOpen) toggleProportional(player);
      break;
    case 20:
      if (ProjectManager.isOpen) toggleBox(player);
      break;
    case 21:
      if (ProjectManager.isOpen) toggleSelectable(player);
      break;
    case 23:
      if (ProjectManager.isOpen) toggleGlobalPlayer(player);
      break;
  }
}

// ─── Commands ───

PlayerEvent.onCommandText("mouse", ({ player, next }) => {
  const s = getState(player);
  if (s.mouseEnabled !== false) {
    player.cancelSelectTextDraw();
    s.mouseEnabled = false;
  } else {
    player.selectTextDraw(COLORS.MOUSE_DEFAULT);
    s.mouseEnabled = true;
  }
  return next();
});

PlayerEvent.onCommandText("veh", ({ player, next, subcommand }) => {
  const modelId = parseInt(subcommand[0]);
  if (isNaN(modelId) || modelId < 411 || modelId > 611) {
    msgError(player, $t("veh.usage", null, getPlayerLocale(player)));
    return next();
  }
  const pos = player.getPos();
  const facing = player.getFacingAngle();
  const veh = new Vehicle({
    modelId,
    x: pos.x,
    y: pos.y,
    z: pos.z,
    zAngle: facing.angle,
    color: [-1, -1] as [number, number],
  });
  veh.create();
  veh.putPlayerIn(player, 0);
  return next();
});
