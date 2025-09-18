//v13.0.0.4
/* global foundry, game, TextEditor */

/**
 * ItemsLinking
 * - Parse drops from compendia or the Items directory (we store only a UUID + label).
 * - Determine which actors own an item originating from a given UUID.
 *
 * v13 change: `core.sourceId` is deprecated. Prefer `_stats.compendiumSource`.
 * We avoid `getFlag("core","sourceId")` (which logs a deprecation warning)
 * and instead read `item.flags?.core?.sourceId` directly as a quiet fallback.
 */
export class ItemsLinking {
  static async parseDrop(event) {
    const data = TextEditor.getDragEventData(event);
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
   *  2) item.flags.core.sourceId      (deprecated fallback, read directly)
   * Returns null if neither exists.
   */
  static sourceUUID(item) {
    // Preferred (no warnings)
    const compSrc = item?._stats?.compendiumSource ?? null;

    // Quiet fallback (do not call getFlag to avoid warnings)
    const legacy = item?.flags?.core?.sourceId ?? null;

    return compSrc ?? legacy ?? null;
  }

  static actorHasItemFromSource(actor, sourceUuid) {
    if (!actor || !sourceUuid) return false;
    const items = actor.items ?? [];
    for (const i of items) {
      const src = this.sourceUUID(i);
      if (!src) continue;
      if (src === sourceUuid) return true;
      // Extra tolerance: sometimes compendiumSource includes full UUID while
      // older flags might differ only by lowercase/uppercase. Normalize.
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
