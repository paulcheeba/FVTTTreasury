/* global foundry, game */

/**
 * ItemsLinking
 * - Parse drops (UUIDs) from compendia or Items directory
 * - Find owners by comparing _stats.compendiumSource (preferred) or legacy flags.core.sourceId
 */
export class ItemsLinking {
  static get TextEditorImpl() {
    // v13 namespaced TextEditor
    return foundry?.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  }

  static async parseDrop(event) {
    const TE = this.TextEditorImpl;
    const data = TE?.getDragEventData ? TE.getDragEventData(event) : null;
    const uuid = data?.uuid;
    if (!uuid) return null;

    let label = data?.text || "Linked Item";
    try {
      const doc = await foundry.utils.fromUuid(uuid);
      if (doc?.documentName === "Item") label = doc.name;
    } catch {}
    return { uuid, label };
  }

  static sourceUUID(item) {
    const compSrc = item?._stats?.compendiumSource ?? null;
    const legacy  = item?.flags?.core?.sourceId ?? null; // quiet fallback
    return compSrc ?? legacy ?? null;
  }

  static actorHasItemFromSource(actor, sourceUuid) {
    if (!actor || !sourceUuid) return false;
    for (const i of (actor.items ?? [])) {
      const src = this.sourceUUID(i);
      if (!src) continue;
      if (src === sourceUuid) return true;
      if (typeof src === "string" && typeof sourceUuid === "string") {
        if (src.toLowerCase() === sourceUuid.toLowerCase()) return true;
      }
    }
    return false;
  }

  static whoOwns(uuid) {
    const owners = [];
    for (const a of game.actors.contents) {
      if (this.actorHasItemFromSource(a, uuid)) owners.push(a.id);
    }
    return owners;
  }
}
