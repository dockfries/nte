import type { TextDrawData } from "../types";
import { TextDrawManager } from "./TextDrawManager";
import * as DB from "../services/DatabaseService";

interface UndoEntry {
  sid: number;
  td: TextDrawData;
}

export class UndoRedoManager {
  private static _entries: UndoEntry[] = [];
  private static _currentIndex = 0;

  static get currentIndex() {
    return UndoRedoManager._currentIndex;
  }
  static get total() {
    return UndoRedoManager._entries.length;
  }
  static get currentEntry(): UndoEntry | undefined {
    return UndoRedoManager._entries[UndoRedoManager._currentIndex];
  }

  static add(id: number) {
    const data = TextDrawManager.getData(id);
    if (!data) return;

    // Save current state before change
    DB.insertUndoRedo(id, data);
  }

  static load(id: number) {
    UndoRedoManager._entries = DB.loadUndoRedo(id);
    UndoRedoManager._currentIndex = 0;
  }

  static goNext() {
    if (UndoRedoManager._currentIndex < UndoRedoManager._entries.length - 1) {
      UndoRedoManager._currentIndex++;
    }
  }

  static goPrev() {
    if (UndoRedoManager._currentIndex > 0) {
      UndoRedoManager._currentIndex--;
    }
  }

  static goTo(index: number) {
    if (index >= 0 && index < UndoRedoManager._entries.length) {
      UndoRedoManager._currentIndex = index;
    }
  }

  static applyToTextDraw(id: number): TextDrawData | undefined {
    if (UndoRedoManager._entries.length === 0) return undefined;
    UndoRedoManager._entries[UndoRedoManager._currentIndex].td.id = id;
    return UndoRedoManager._entries[UndoRedoManager._currentIndex].td;
  }

  static confirm(_id: number) {
    const entry = UndoRedoManager._entries[UndoRedoManager._currentIndex];
    if (!entry) return;
    DB.deleteUndoRedoSid(entry.sid);
  }

  static deleteForTextDraw(id: number) {
    DB.deleteUndoRedo(id);
    UndoRedoManager._entries = [];
  }
}
