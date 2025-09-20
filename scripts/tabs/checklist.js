/* global renderTemplate */
import { State } from "../state.js";
import { getState } from "../state_helpers.js";

export async function mountChecklist(app, el, ctx) {
  const st = getState();
  const html = await renderTemplate("modules/fvtt-treasury/scripts/handlebars/tabs/checklist.hbs", {
    checklist: st.checklist ?? []
  });
  el.innerHTML = html;

  // Placeholder buttons (future): add/remove/toggle could be wired here
}
