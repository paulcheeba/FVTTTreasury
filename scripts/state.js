/* global game, Hooks, foundry */
import { MODULE_ID } from "../treasury.js";
import { getState, saveState } from "./state_helpers.js";

function ensureCoinSheet(st) {
  if (!st.coinSheet) {
    const rows = 10, cols = 6;
    const data = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ raw: "" }))
    );
    st.coinSheet = { rows, cols, data };
  } else {
    // normalize any legacy shapes
    const r = Math.max(1, Number(st.coinSheet.rows || 1));
    const c = Math.max(1, Number(st.coinSheet.cols || 1));
    if (!Array.isArray(st.coinSheet.data)) st.coinSheet.data = [];
    for (let i = 0; i < r; i++) {
      if (!Array.isArray(st.coinSheet.data[i])) st.coinSheet.data[i] = [];
      for (let j = 0; j < c; j++) {
        if (!st.coinSheet.data[i][j]) st.coinSheet.data[i][j] = { raw: "" };
      }
    }
    st.coinSheet.rows = r; st.coinSheet.cols = c;
  }
}

export class State {
  static async init() {
    const st = getState();
    if (!st.version) st.version = "13.0.0.6";
    ensureCoinSheet(st);
    await saveState(st);
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
    ensureCoinSheet(st);

    switch (action) {
      /* ---------- legacy ledger/items/checklist (kept for future use) ---------- */
      case "add-ledger": {
        st.ledger ??= [];
        st.ledger.push({ ...data, id: this._id(st.ledger, "lg") });
        break;
      }
      case "remove-ledger": {
        st.ledger = (st.ledger ?? []).filter(e => e.id !== data.id);
        break;
      }
      case "add-item": {
        st.items ??= [];
        st.items.push({ ...data, id: this._id(st.items, "it") });
        break;
      }
      case "remove-item": {
        st.items = (st.items ?? []).filter(e => e.id !== data.id);
        break;
      }
      case "toggle-check": {
        st.checklist ??= [];
        const c = st.checklist.find(c => c.id === data.id);
        if (c) c.done = !c.done;
        break;
      }
      case "import-json": {
        const next = Object.assign({}, st, data.state);
        ensureCoinSheet(next);
        await saveState(next);
        Hooks.callAll(`${MODULE_ID}:state-updated`, next);
        return;
      }

      /* ------------------------------ Group Coin ------------------------------ */
      case "gc-set": {
        const { r, c, raw } = data;
        if (r >= 0 && c >= 0) {
          st.coinSheet.data[r][c] = { raw: String(raw ?? "") };
        }
        break;
      }
      case "gc-add-row": {
        const cols = st.coinSheet.cols;
        st.coinSheet.data.push(Array.from({ length: cols }, () => ({ raw: "" })));
        st.coinSheet.rows += 1;
        break;
      }
      case "gc-add-col": {
        for (const row of st.coinSheet.data) row.push({ raw: "" });
        st.coinSheet.cols += 1;
        break;
      }
      case "gc-del-row": {
        const { r } = data;
        if (st.coinSheet.rows > 1 && r >= 0 && r < st.coinSheet.rows) {
          st.coinSheet.data.splice(r, 1);
          st.coinSheet.rows -= 1;
        }
        break;
      }
      case "gc-del-col": {
        const { c } = data;
        if (st.coinSheet.cols > 1 && c >= 0 && c < st.coinSheet.cols) {
          for (const row of st.coinSheet.data) row.splice(c, 1);
          st.coinSheet.cols -= 1;
        }
        break;
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
      await game.socket?.emit(`module.${MODULE_ID}`, { action, data, sender: game.user.id });
    }
  }
}
