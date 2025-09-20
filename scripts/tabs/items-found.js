/* global renderTemplate, game */
import { ItemsLinking } from "../items.js";
import { State } from "../state.js";

export async function mountItemsFound(app, el, ctx) {
  const html = await renderTemplate("modules/fvtt-treasury/scripts/handlebars/tabs/items-found.hbs", {});
  el.innerHTML = html;

  // Drag-and-drop enable on its drop zone
  const drop = el.querySelector(".ft-items-drop");
  if (drop && !drop._ftBound) {
    drop._ftBound = true;
    drop.addEventListener("dragover", ev => ev.preventDefault());
    drop.addEventListener("drop", async (ev) => {
      ev.preventDefault();
      const parsed = await ItemsLinking.parseDrop(ev);
      if (!parsed) return;
      await State.mutate("add-item", {
        ts: new Date().toISOString(),
        label: parsed.label,
        uuid: parsed.uuid,
        notes: ""
      });
    });
  }
}
