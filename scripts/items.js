//v13.0.0.6
/* global foundry, game */

/**
 * ItemsLinking
 * - Parse drops from compendia or the Items directory (we store only a UUID + label).
 * - Determine which actors own an item originating from a given UUID.
 *
 * v13 changes:
 *  - Global TextEditor is deprecated. Use foundry.applications.ux.TextEditor.implementation
 *  - core.sourceId is deprecated. Prefer _stats.compendiumSource; quietly fall back to flags.core.sourceId
 */
export class ItemsLinking {
  static get TextEditorImpl() {
    // v13+ location; falls back if an older system provides global (kept for safety)
    return foundry?.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  }

  static async parseDrop(event) {
    const TE = this.TextEditorImpl;
    const data = TE?.getDragEventData ? TE.getDragEventData(event) : null;
    const uuid = data?.uuid;
    if (!uuid) return null;

    // Confirm it's an Item-like doc, but tolerate unresolved UUID (leave a label)
    let label = data?.text || "Linked Item";
    try {
      const doc = await foundry.utils.fromUuid(uuid);
      if (doc?.documentName === "Item") label = doc.name;
    } catch {
      // keep default label
    }
    return { uuid, label };
  }

  /**
   * Safely read the "source UUID" of an embedded Item.
   * Priority:
   *  1) item._stats.compendiumSource  (v12+, preferred)
   *  2) item.flags.core.sourceId      (deprecated fallback, read directly; do not call getFlag)
   */
  static sourceUUID(item) {
    const compSrc = item?._stats?.compendiumSource ?? null;
    const legacy  = item?.flags?.core?.sourceId ?? null; // quiet fallback
    return compSrc ?? legacy ?? null;
  }

  static actorHasItemFromSource(actor, sourceUuid) {
    if (!actor || !sourceUuid) return false;
    const items = actor.items ?? [];
    for (const i of items) {
      const src = this.sourceUUID(i);
      if (!src) continue;
      if (src === sourceUuid) return true;
      if (typeof src === "string" && typeof sourceUuid === "string") {
        if (src.toLowerCase() === sourceUuid.toLowerCase()) return true;
      }
    }
    return false;
  }

  /**
   * Return array of actor IDs that own an item whose source uuid matches.
   */
  static whoOwns(uuid) {
    const owners = [];
    for (const a of game.actors.contents) {
      if (this.actorHasItemFromSource(a, uuid)) owners.push(a.id);
    }
    return owners;
  }
}

