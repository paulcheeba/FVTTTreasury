/* global game, Hooks, foundry */
import { MODULE_ID } from "../treasury.js";
import { getState, saveState } from "./state_helpers.js";

/** Keep state_helpers small and reuse for app + settings */
export class State {
  static async init() {
    const st = getState();
    if (!st.version) {
      st.version = "13.0.0.6";
      await saveState(st);
    }
  }

  static _id(collection, prefix="id") {
    const id = foundry.utils.randomID();
    if (!Array.isArray(collection)) return `${prefix}-${id}`;
    if (collection.some(e => e.id === `${prefix}-${id}`)) return this._id(collection, prefix);
    return `${prefix}-${id}`;
  }

  static async handleSocket(payload) {
    const { action, data } = payload || {};
    const st = getState();

    switch (action) {
      case "add-ledger": {
        st.ledger.push({ ...data, id: this._id(st.ledger, "lg") });
        break;
      }
      case "remove-ledger": {
        st.ledger = st.ledger.filter(e => e.id !== data.id);
        break;
      }
      case "add-item": {
        st.items.push({ ...data, id: this._id(st.items, "it") });
        break;
      }
      case "remove-item": {
        st.items = st.items.filter(e => e.id !== data.id);
        break;
      }
      case "toggle-check": {
        const c = st.checklist.find(c => c.id === data.id);
        if (c) c.done = !c.done;
        break;
      }
      case "import-json": {
        const next = Object.assign({}, st, data.state);
        await saveState(next);
        Hooks.callAll(`${MODULE_ID}:state-updated`, next);
        return;
      }
      default:
        return;
    }

    await saveState(st);
    Hooks.callAll(`${MODULE_ID}:state-updated`, st);
  }

  static async mutate(action, data) {
    if (game.user.isGM) {
      await this.handleSocket({ action, data, sender: game.user.id });
    } else {
      await game.socket?.emit(`module.${MODULE_ID}`, { action, data, sender: game.user.id });
    }
  }
}
