/* FVTTTreasury v13.0.0.15
   Tab-agnostic world state manager:
   - No module version stored in world state.
   - Namespaces each tab fully owns:
       groupCoin   -> { coinSheet: { rows, cols, data[{raw}][][] } }
       itemsFound  -> { items: [...] }
       checklist   -> { entries: [...] }
*/

import { MODULE_ID } from "../treasury.js";
import { getState, saveState } from "./state_helpers.js";

/** Namespaces that tabs control exclusively */
const TAB_NAMESPACES = ["groupCoin", "itemsFound", "checklist"];

/* ---------- helpers ---------- */

function ensureObject(o) {
  return (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
}

function ensureArray(a) {
  return Array.isArray(a) ? a : [];
}

function ensureCoinSheet(obj) {
  // obj should be the namespace object (e.g., st.groupCoin)
  obj.coinSheet = obj.coinSheet && typeof obj.coinSheet === "object" ? obj.coinSheet : {};
  let { rows, cols, data } = obj.coinSheet;

  rows = Number.isInteger(rows) && rows > 0 ? rows : 10;
  cols = Number.isInteger(cols) && cols > 0 ? cols : 6;

  // Build 2D data with {raw} cells
  const out = Array.from({ length: rows }, (_, r) => {
    const row = Array.isArray(data?.[r]) ? data[r] : [];
    return Array.from({ length: cols }, (_, c) => {
      const cell = row[c];
      const raw = (cell && typeof cell === "object" && "raw" in cell) ? String(cell.raw ?? "") : "";
      return { raw };
    });
  });

  obj.coinSheet.rows = rows;
  obj.coinSheet.cols = cols;
  obj.coinSheet.data = out;
}

/** Normalize current saved state and migrate legacy shapes safely (no versioning). */
function normalizeAndMigrate(st) {
  st = st && typeof st === "object" ? st : {};

  // Ensure namespaces exist as plain objects
  st.groupCoin = ensureObject(st.groupCoin);
  st.itemsFound = ensureObject(st.itemsFound);
  // If st.checklist was previously an array, convert to object form
  if (Array.isArray(st.checklist)) st.checklist = { entries: st.checklist };
  st.checklist = ensureObject(st.checklist);

  // ---- Legacy migrations (defensive) ----

  // Legacy top-level coinSheet -> groupCoin.coinSheet
  if (st.coinSheet && typeof st.coinSheet === "object" && !st.groupCoin.coinSheet) {
    st.groupCoin.coinSheet = st.coinSheet;
    delete st.coinSheet;
  }

  // Legacy top-level items array -> itemsFound.items
  if (Array.isArray(st.items) && !Array.isArray(st.itemsFound.items)) {
    st.itemsFound.items = st.items;
    delete st.items;
  }

  // Legacy top-level checklist array -> checklist.entries
  if (Array.isArray(st.checklist)) {
    // already handled above, but keep defensive
    st.checklist = { entries: st.checklist };
  } else if (st.checklist && Array.isArray(st.checklist.entries) === false) {
    // if checklist exists but entries missing or invalid, seed as empty array
    st.checklist.entries = ensureArray(st.checklist.entries);
  }

  // Seed defaults for namespaces
  ensureCoinSheet(st.groupCoin);
  st.itemsFound.items = ensureArray(st.itemsFound.items);
  st.checklist.entries = ensureArray(st.checklist.entries);

  return st;
}

/* ---------- API ---------- */

export class State {
  /** Initialize world state (create namespaces, migrate legacy fields) */
  static async init() {
    const st = normalizeAndMigrate(getState() || {});
    await saveState(st);
  }

  /** Read normalized whole state (tabs should prefer getTab) */
  static read() {
    return normalizeAndMigrate(getState() || {});
  }

  /** Get a deep-cloned namespace for a tab */
  static getTab(ns) {
    const st = this.read();
    if (!TAB_NAMESPACES.includes(ns)) return {};
    return foundry.utils.deepClone(st[ns] || {});
  }

  /** Set a whole namespace (GM-authoritative) */
  static async setTab(ns, value) {
    if (!TAB_NAMESPACES.includes(ns)) return;
    if (game.user.isGM) {
      await this.#applySetTab(ns, value);
    } else {
      await game.socket?.emit(`module.${MODULE_ID}`, { action: "set-tab", ns, value, sender: game.user.id });
    }
  }

  /** Update a namespace via mutator callback; returns updated namespace */
  static async updateTab(ns, updater) {
    const current = this.getTab(ns);
    const next = typeof updater === "function" ? updater(foundry.utils.deepClone(current)) : current;
    await this.setTab(ns, next);
    return next;
  }

  /** GM-side socket handler */
  static async handleSocket(payload) {
    if (!game.user.isGM) return;
    const { action } = payload || {};
    switch (action) {
      case "set-tab": {
        const { ns, value } = payload;
        if (!TAB_NAMESPACES.includes(ns)) return;
        await this.#applySetTab(ns, value);
        return;
      }

      case "import-json": {
        const incoming = payload?.state || {};
        const st = this.read();

        // Accept namespaced shapes directly
        for (const ns of TAB_NAMESPACES) {
          if (incoming[ns] && typeof incoming[ns] === "object") {
            st[ns] = incoming[ns];
          }
        }

        // Legacy keys for convenience
        if (incoming.coinSheet) {
          st.groupCoin ??= {};
          st.groupCoin.coinSheet = incoming.coinSheet;
        }
        if (Array.isArray(incoming.items)) {
          st.itemsFound ??= {};
          st.itemsFound.items = incoming.items;
        }
        if (Array.isArray(incoming.checklist)) {
          st.checklist = { entries: incoming.checklist };
        }

        await saveState(normalizeAndMigrate(st));
        Hooks.callAll(`${MODULE_ID}:state-updated`);
        return;
      }

      default:
        return;
    }
  }

  /** INTERNAL: write namespace + broadcast */
  static async #applySetTab(ns, value) {
    const st = this.read();
    st[ns] = value && typeof value === "object" ? value : {};
    const normalized = normalizeAndMigrate(st);
    await saveState(normalized);
    Hooks.callAll(`${MODULE_ID}:state-updated`);
  }
}
