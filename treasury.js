/* global game, Hooks, ui, Handlebars, foundry, mergeObject */
import { registerSettings, getState, isEditor, getTheme, setTreasurers, getTreasurers, getRefreshSec, setTheme, saveState, onReadySettings } from "./scripts/settings.js";
import { State } from "./scripts/state.js";
import { Ledger } from "./scripts/ledger.js";
import { ItemsLinking } from "./scripts/items.js";
import { Time } from "./scripts/time.js";
import { IO } from "./scripts/io.js";
import { FVTTTreasuryApp } from "./scripts/app.js";

export const MODULE_ID = "fvtt-treasury";

Hooks.once("init", () => {
  // useful helper for templates
  try { Handlebars.registerHelper('eq', (a,b)=>a===b); } catch(e) {}
  registerSettings();
});

Hooks.once("ready", async () => {
  // Prepare world state container (GM authoritative)
  await State.init();

  // Scene Controls button to open app
  Hooks.on("getSceneControlButtons", (controls) => {
    const token = controls.find(c => c.name === "token");
    if (!token) return;
    token.tools.push({
      name: "fvtt-treasury",
      title: "FVTTTreasury",
      icon: "fas fa-coins",
      button: true,
      onClick: () => {
        const app = FVTTTreasuryApp.instance ?? new FVTTTreasuryApp();
        app.render(true);
      }
    });
  });

  // Socket channel for mutations (GM applies)
  const eventName = `module.${MODULE_ID}`;
  game.socket?.on(eventName, async (payload) => {
    // Only GM processes mutations.
    if (!game.user.isGM) return;
    await State.handleSocket(payload);
  });

  // Re-render open app(s) when world state changes
  Hooks.on(`${MODULE_ID}:state-updated`, () => {
    FVTTTreasuryApp.instance?.render(false);
  });

  onReadySettings();
});

export function openTreasury() {
  const app = FVTTTreasuryApp.instance ?? new FVTTTreasuryApp();
  return app.render(true);
}
