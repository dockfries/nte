import type { Player } from "@infernus/core";
import { TextDrawManager } from "../managers/TextDrawManager";
import { HudManager } from "../managers/HudManager";
import { UndoRedoManager } from "../managers/UndoRedoManager";
import { DeletedManager } from "../managers/DeletedManager";
import { msgInfo } from "../utils/helpers";
import { $t } from "../i18n";

export function copyTD(player: Player) {
  if (TextDrawManager.selectedId < 0) return;
  const newId = TextDrawManager.copy(TextDrawManager.selectedId);
  TextDrawManager.selectedId = newId;
  msgInfo(player, $t("td_info.copy", [String(newId)]));
}

export function deleteTD(player: Player) {
  if (TextDrawManager.selectedId < 0) return;
  const id = TextDrawManager.selectedId;
  // PAWN: reset group before deleting
  TextDrawManager.updateProperty(id, (td) => {
    td.group = 0;
  });
  DeletedManager.add(id);
  UndoRedoManager.deleteForTextDraw(id);
  TextDrawManager.delete(id);
  HudManager.rebuild(true);
  msgInfo(player, $t("td_info.delete", [String(id)]));
}

export function cycleFont(_player: Player) {
  const id = TextDrawManager.selectedId;
  if (id < 0) return;
  UndoRedoManager.add(id);
  TextDrawManager.updateProperty(id, (td) => {
    td.font = td.font >= 3 ? 0 : td.font + 1;
  });
  HudManager.rebuild(true);
}

export function cycleAlignment(_player: Player) {
  const id = TextDrawManager.selectedId;
  if (id < 0) return;
  UndoRedoManager.add(id);
  TextDrawManager.updateProperty(id, (td) => {
    td.alignment = td.alignment >= 3 ? 1 : td.alignment + 1;
  });
  HudManager.rebuild(true);
}

export function toggleProportional(_player: Player) {
  const id = TextDrawManager.selectedId;
  if (id < 0) return;
  UndoRedoManager.add(id);
  TextDrawManager.updateProperty(id, (td) => {
    td.proportional = td.proportional ? 0 : 1;
  });
  HudManager.rebuild(true);
}

export function toggleBox(_player: Player) {
  const id = TextDrawManager.selectedId;
  if (id < 0) return;
  UndoRedoManager.add(id);
  TextDrawManager.updateProperty(id, (td) => {
    td.useBox = td.useBox ? 0 : 1;
  });
  HudManager.rebuild(true);
}

export function toggleSelectable(_player: Player) {
  const id = TextDrawManager.selectedId;
  if (id < 0) return;
  UndoRedoManager.add(id);
  TextDrawManager.updateProperty(id, (td) => {
    td.selectable = td.selectable ? 0 : 1;
  });
  HudManager.rebuild(true);
}

export function toggleGlobalPlayer(_player: Player) {
  const id = TextDrawManager.selectedId;
  if (id < 0) return;
  UndoRedoManager.add(id);
  TextDrawManager.updateProperty(id, (td) => {
    td.globalPlayer = td.globalPlayer ? 0 : 1;
  });
  HudManager.rebuild(true);
}
