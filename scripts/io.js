/* global game, saveDataToFile, readTextFromFile */
import { State } from "./state.js";

export class IO {
  static async exportJSON() {
    const state = game.settings.get("fvtt-treasury", "state");
    const stamp = new Date().toISOString().replace(/[:.]/g,"-");
    const name = `fvtt-treasury-${stamp}.json`;
    await saveDataToFile(JSON.stringify(state, null, 2), "application/json", name);
  }

  static async importJSON(file) {
    const text = await readTextFromFile(file);
    const parsed = JSON.parse(text);
    await State.mutate("import-json", { state: parsed });
  }
}
