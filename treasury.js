/* global game, Hooks, Handlebars */
import { registerSettings, onReadySettings } from "./scripts/settings.js";
import { State } from "./scripts/state.js";
import { FVTTTreasuryApp } from "./scripts/app.js";

export const MODULE_ID = "fvtt-treasury";

Hooks.once("init", () => {
  // Template helpers
  try { Handlebars.registerHelper("eq", (a, b) => a === b); } catch (e) {}
  registerSettings();
});

Hooks.once("ready", async () => {
  // Initialize world state (GM authoritative container)
  await State.init();

  // Global opener for macro/console
  game.fvttTreasury = {
    open: () => {
      const app = FVTTTreasuryApp.instance ?? new FVTTTreasuryApp();
      app.render(true);
      return app;
    }
  };

  // Socket: GM applies mutations
  const eventName = `module.${MODULE_ID}`;
  game.socket?.on(eventName, async (payload) => {
    if (!game.user.isGM) return;
    await State.handleSocket(payload);
  });

  // Re-render on state updates
  Hooks.on(`${MODULE_ID}:state-updated`, () => {
    FVTTTreasuryApp.instance?.render(false);
  });

  onReadySettings();

  // Toolbar button intentionally disabled (will add toolbar.js later per your request)
  // Hooks.on("getSceneControlButtons", () => {});
});
