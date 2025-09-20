/* global game */
import { MODULE_ID } from "../treasury.js";

export function getState() {
  return game.settings.get(MODULE_ID, "state");
}
export async function saveState(next) {
  await game.settings.set(MODULE_ID, "state", next);
}
