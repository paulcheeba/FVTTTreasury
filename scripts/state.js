/* global game, Hooks, foundry */
import { MODULE_ID } from "../treasury.js";
import { getState, saveState } from "./settings.js";

export class State {
  static async init() {
    // Ensure structure exists
    const st = getState();
    if (!st.version) {
      st.version = "13.0.0.1";
      await saveState(st);
    }
  }

  static _ensureId(collection, prefix="id") {
    const id = foundry.utils.randomID();
    if (!Array.isArray(collection)) return id;
    if (collection.some(e => e.id === id)) return this._ensureId(collection, prefix);
    return `${prefix}-${id}`;
  }

  static async handleSocket(payload) {
    const { action, data } = payload || {};
    const st = getState();

    switch (action) {
      case "add-ledger": {
        st.ledger.push({...data, id: this._ensureId(st.ledger, "lg")});
        break;
      }
      case "remove-ledger": {
        st.ledger = st.ledger.filter(e => e.id !== data.id);
        break;
      }
      case "add-item": {
        st.items.push({...data, id: this._ensureId(st.items, "it")});
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
        st.treasurers = Array.from(new Set(data.ids));
        break;
      }
      case "set-theme": {
        st.theme = data.theme;
        break;
      }
      case "import-json": {
        // Full replace except treasurers and theme (keep current by default)
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
      await this.handleSocket({action, data, sender: game.user.id});
    } else {
      const ev = `module.${MODULE_ID}`;
      await game.socket?.emit(ev, {action, data, sender: game.user.id});
    }
  }
}
