/* global game, Hooks, Handlebars */
import { registerSettings, onReadySettings } from "./scripts/settings.js";
import { State } from "./scripts/state.js";
import { FVTTTreasuryApp } from "./scripts/app.js";

export const MODULE_ID = "fvtt-treasury";

Hooks.once("init", () => {
  // tiny helper used in templates
  try { Handlebars.registerHelper("eq", (a,b)=>a===b); } catch (e) {}
  registerSettings();
});

Hooks.once("ready", async () => {
  // Prepare world state container (GM authoritative)
  await State.init();

  // ---- GLOBAL OPEN HELPER (macro target) ----
  // Your macro calls game.fvttTreasury.open(), so make sure it's always defined.
  game.fvttTreasury = {
    open: () => {
      const app = FVTTTreasuryApp.instance ?? new FVTTTreasuryApp();
      app.render(true);
      return app;
    }
  };

  // ---- SOCKET: GM applies mutations ----
  const eventName = `module.${MODULE_ID}`;
  game.socket?.on(eventName, async (payload) => {
    if (!game.user.isGM) return;
    await State.handleSocket(payload);
  });

  // Re-render open app(s) when world state changes
  Hooks.on(`${MODULE_ID}:state-updated`, () => {
    FVTTTreasuryApp.instance?.render(false);
  });

  onReadySettings();

  // 🔕 Toolbar tool intentionally disabled for now, per your request.
  // Hooks.on("getSceneControlButtons", (controls) => { /* disabled */ });
});
