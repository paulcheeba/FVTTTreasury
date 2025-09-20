/* global renderTemplate, game */
import { State } from "../state.js";
import { ItemsLinking } from "../items.js";
import { isEditor } from "../settings.js";

/**
 * Namespace: "itemsFound"
 * Shape owned by this tab (suggested):
 * { items: [{ id, ts, label, uuid, notes }], ...future }
 */
export async function mountItemsFound(app, el /*, ctx */) {
  const editor = isEditor(game.user);
  const ns = "itemsFound";
  const tab = State.getTab(ns);

  const html = await renderTemplate("modules/fvtt-treasury/scripts/handlebars/tabs/items-found.hbs", {
    editor,
    items: Array.isArray(tab.items) ? tab.items : []
  });
  el.innerHTML = html;

  // Drag-and-drop to add items
  const drop = el.querySelector(".ft-items-drop");
  if (editor && drop && !drop._ftBound) {
    drop._ftBound = true;
    drop.addEventListener("dragover", ev => ev.preventDefault());
    drop.addEventListener("drop", async (ev) => {
      ev.preventDefault();
      const parsed = await ItemsLinking.parseDrop(ev);
      if (!parsed) return;
      await State.updateTab(ns, (draft) => {
        draft.items ??= [];
        draft.items.push({
          id: foundry.utils.randomID(),
          ts: new Date().toISOString(),
          label: parsed.label,
          uuid: parsed.uuid,
          notes: ""
        });
        return draft;
      });
    });
  }

  // (Future) list actions (delete/edit) can live here entirely, via State.updateTab(ns, ...)
}
