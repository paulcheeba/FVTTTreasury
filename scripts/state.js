/* global game, Hooks, foundry */
import { MODULE_ID } from "../treasury.js";
import { getState, saveState } from "./settings.js";

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
      case "set-treasurers": {
        st.treasurers = Array.from(new Set(data.ids || []));
        break;
      }
      case "set-theme": {
        st.theme = data.theme;
        break;
      }
      case "import-json": {
        // Replace content, keeping current treasurers and theme unless provided
        const keep = { treasurers: st.treasurers, theme: st.theme };
        const next = Object.assign({}, st, data.state);
        next.treasurers = keep.treasurers;
        next.theme = keep.theme;
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

  // Client helper to send a mutation; GM applies
  static async mutate(action, data) {
    if (game.user.isGM) {
      await this.handleSocket({ action, data, sender: game.user.id });
    } else {
      const ev = `module.${MODULE_ID}`;
      await game.socket?.emit(ev, { action, data, sender: game.user.id });
    }
  }
}
