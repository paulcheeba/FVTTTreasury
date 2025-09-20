/* global Hooks, Handlebars, game */
import { registerSettings, onReadySettings } from "./scripts/settings.js";
import { State } from "./scripts/state.js";
import { FVTTTreasuryApp } from "./scripts/app.js";

export const MODULE_ID = "fvtt-treasury";

/** Preload tab templates up-front so partial renders are fast. */
async function preloadTemplates() {
  const paths = [
    "modules/fvtt-treasury/scripts/handlebars/app.hbs",
    "modules/fvtt-treasury/scripts/handlebars/tabs/group-coin.hbs",
    "modules/fvtt-treasury/scripts/handlebars/tabs/items-found.hbs",
    "modules/fvtt-treasury/scripts/handlebars/tabs/checklist.hbs",
    "modules/fvtt-treasury/scripts/handlebars/settings.hbs"
  ];
  return loadTemplates(paths);
}

Hooks.once("init", () => {
  
  try { 
    Handlebars.registerHelper("eq", (a, b) => a === b); 
    Handlebars.registerHelper("inc", (n)=>Number(n)+1); 
    Handlebars.registerHelper("length", (arr)=>Array.isArray(arr)?arr.length:0);
    Handlebars.registerHelper("add", (a,b)=>Number(a)+Number(b));
  } catch (e) {}
  registerSettings();
});

Hooks.once("ready", async () => {
  await preloadTemplates();
  await State.init();

  game.fvttTreasury = {
    open: () => {
      const app = FVTTTreasuryApp.instance ?? new FVTTTreasuryApp();
      app.render(true);
      return app;
    }
  };

  // GM applies mutations; all clients re-render via settings onChange hook
  const eventName = `module.${MODULE_ID}`;
  game.socket?.on(eventName, async (payload) => {
    if (!game.user.isGM) return;
    await State.handleSocket(payload);
  });

  // app rerender on state change (broadcasted by settings onChange)
  Hooks.on(`${MODULE_ID}:state-updated`, () => {
    FVTTTreasuryApp.instance?.render(false);
  });

  onReadySettings();
});
