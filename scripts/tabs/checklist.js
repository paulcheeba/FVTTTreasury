/* global renderTemplate, game */
import { State } from "../state.js";
import { isEditor } from "../settings.js";

/**
 * Namespace: "checklist"
 * Shape owned by this tab (suggested):
 * { entries: [{ id, done, label }], ...future }
 */
export async function mountChecklist(app, el /*, ctx */) {
  const editor = isEditor(game.user);
  const ns = "checklist";
  const tab = State.getTab(ns);

  const html = await renderTemplate("modules/fvtt-treasury/scripts/handlebars/tabs/checklist.hbs", {
    editor,
    checklist: Array.isArray(tab.entries) ? tab.entries : []
  });
  el.innerHTML = html;

  // (Future) add/remove/toggle handlers stay here, calling State.updateTab(ns, ...)
}
