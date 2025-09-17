/* global game */
import { MODULE_ID } from "../treasury.js";

export function registerSettings() {
  game.settings.register(MODULE_ID, "state", {
    scope: "world",
    config: false,
    type: Object,
    default: {
      version: "13.0.0.1",
      ledger: [],        // {id, ts, label, amount, currency, payerUserId, participantsActorIds[], notes}
      items: [],         // {id, ts, label, uuid, assignedActorId, notes}
      checklist: [],     // {id, done, label}
      theme: "plain",    // "plain" | "dnd5e" | "cyberpunk"
      treasurers: [],    // Array of user IDs
      currencies: [      // System-agnostic; you can edit in Settings later
        {key:"cp", label:"Copper",  rate:1},
        {key:"sp", label:"Silver",  rate:10},
        {key:"gp", label:"Gold",    rate:100},
        {key:"pp", label:"Platinum",rate:1000}
      ]
    }
  });

  game.settings.register(MODULE_ID, "refreshSec", {
    scope: "client",
    config: true,
    name: "Auto-Refresh Seconds",
    hint: "How frequently the UI should refresh while open.",
    type: Number, default: 10, range: {min: 5, max: 120, step: 1}
  });
}

export function onReadySettings() {
  // placeholder for future migrations
}

export function getState() {
  return game.settings.get(MODULE_ID, "state");
}

export async function saveState(next) {
  await game.settings.set(MODULE_ID, "state", next);
}

export function getTheme() {
  return getState().theme || "plain";
}

export async function setTheme(theme) {
  const st = getState();
  st.theme = theme;
  await saveState(st);
}

export function getTreasurers() {
  return getState().treasurers ?? [];
}

export async function setTreasurers(ids) {
  const st = getState();
  st.treasurers = Array.from(new Set(ids));
  await saveState(st);
}

export function isEditor(user) {
  if (user?.isGM) return true;
  const treasurers = getTreasurers();
  return treasurers.includes(user?.id);
}

export function getRefreshSec() {
  return game.settings.get(MODULE_ID, "refreshSec") || 10;
}
