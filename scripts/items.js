/* global foundry, game, TextEditor */
import { MODULE_ID } from "../treasury.js";

export class ItemsLinking {
  static async parseDrop(event) {
    // Use Foundry helper to parse DnD payload
    const data = TextEditor.getDragEventData(event);
    // v10+ UUID links present as data.uuid
    const uuid = data?.uuid;
    if (!uuid) return null;

    // Confirm it's an Item-like doc
    const doc = await foundry.utils.fromUuid(uuid);
    if (!doc || doc.documentName !== "Item") return { uuid, label: data?.text || "Linked Item" };

    const label = doc.name;
    return { uuid, label };
  }

  static actorHasItemFromSource(actor, sourceUuid) {
    // Heuristic: match Actor-owned item with same sourceId
    const items = actor?.items ?? [];
    return items.some(i => i.getFlag("core", "sourceId") === sourceUuid);
  }

  static whoOwns(uuid) {
    // Return array of actor ids that own an item with this source uuid
    const owners = [];
    for (const a of game.actors.contents) {
      if (this.actorHasItemFromSource(a, uuid)) owners.push(a.id);
    }
    return owners;
  }
}
