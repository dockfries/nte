import { Dialog, DialogStylesEnum } from "@infernus/core";
import type { Player } from "@infernus/core";
import { CONFIG } from "../constants/config";
import { getState } from "../state";
import { $t } from "../i18n";
import { LOCALES } from "../i18n/locales";
import { msgInfo } from "../utils/helpers";

/** Get the player's locale, falling back to en_US if unsupported. */
export function getPlayerLocale(player: Player): string {
  return LOCALES[player.locale] ? player.locale : "en_US";
}

export async function showLanguageSelect(player: Player) {
  try {
    const entries = Object.keys(LOCALES);
    let info = "{badc58}Language\t{badc58}File\n";
    for (const code of entries) {
      info += `${LOCALES[code]}\t${code}.json\n`;
    }
    const dlg = new Dialog({
      style: DialogStylesEnum.TABLIST_HEADERS,
      caption: "Language Selection",
      info,
      button1: "Select",
      button2: "",
    });
    const { response, listItem } = await dlg.show(player);
    if (!response) return showLanguageSelect(player);

    if (listItem >= 0 && listItem < entries.length) {
      const locale = entries[listItem];
      player.locale = locale;
      msgInfo(player, $t("editor.lang_selection", null, locale));
      showWorkEnvironment(player);
    }
  } catch {
    void 0;
  }
}

export async function showWorkEnvironment(player: Player) {
  try {
    const locale = getPlayerLocale(player);
    const dlg = new Dialog({
      style: DialogStylesEnum.LIST,
      caption: $t("work_env.title", null, locale),
      info: `${$t("work_env.content_1", null, locale)}\n${$t("work_env.content_2", null, locale)}`,
      button1: $t("work_env.button_1", null, locale),
      button2: "",
    });
    const { response, listItem } = await dlg.show(player);
    if (!response) return showWorkEnvironment(player);

    const state = getState(player);
    state.spawnMode = listItem;

	    // Set spawn info before triggering spawn (PAWN: TogglePlayerSpectating → SetSpawnInfo → SpawnPlayer)
	    if (listItem === 0) {
	      player.setSpawnInfo(
	        0,
	        299,
	        CONFIG.EMPTY_COORDS.x,
	        CONFIG.EMPTY_COORDS.y,
	        CONFIG.EMPTY_COORDS.z,
	        90.2411,
	        0,
	        0,
	        0,
	        0,
	        0,
	        0,
	      );
	      player.toggleSpectating(false);
	      msgInfo(player, $t("work_env.msg_1", null, locale));
	    } else {
	      player.setSpawnInfo(
	        0,
	        299,
	        CONFIG.SPAWN_COORDS.x,
	        CONFIG.SPAWN_COORDS.y,
	        CONFIG.SPAWN_COORDS.z,
	        89.9278,
	        0,
	        0,
	        0,
	        0,
	        0,
	        0,
	      );
	      player.toggleSpectating(false);
	      msgInfo(player, $t("work_env.msg_2", null, locale));
	    }
  } catch {
    void 0;
  }
}
