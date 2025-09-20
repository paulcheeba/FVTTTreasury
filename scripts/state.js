/* global game, Hooks, foundry */
import { MODULE_ID } from "../treasury.js";
import { getState, saveState } from "./state_helpers.js";

/**
 * Namespaces owned by tabs. Each tab can set/read ONLY inside its namespace.
 * - "groupCoin"   : { coinSheet: { rows, cols, data[{raw}][][] } , ...future }
 * - "itemsFound"  : { items: [] , ...future }
 * - "checklist"   : { entries: [] , ...future }
 *
 * state.js does NOT contain tab-specific business logic.
 * Tabs should call State.getTab/State.setTab/State.updateTab and fully manage their data shape.
 */
const TAB_NAMESPACES = ["groupCoin", "itemsFound", "checklist"];

/** Ensure the root shape exists and migrate any legacy fields into tab namespaces. */
function normalizeAndMigrate(st) {
  // Ensure root object
  if (!st || typeof st !== "object") return { version: "13.0.0.13" };

  st.version ??= "13.0.0.13";

  // Ensure namespaces exist
  for (const ns of TAB_NAMESPACES) st[ns] ??= {};

  // ---- Migrations from earlier builds ----

  // coinSheet (legacy top-level) -> groupCoin.coinSheet
  if (st.coinSheet && !st.groupCoin.coinSheet) {
    st.groupCoin.coinSheet = st.coinSheet;
    delete st.coinSheet;
  }
  // items (legacy top-level) -> itemsFound.items
  if (Array.isArray(st.items) && !Array.isArray(st.itemsFound.items)) {
    st.itemsFound.items = st.items;
    delete st.items;
  }
  // checklist (legacy top-level) -> checklist.entries
  if (Array.isArray(st.checklist) && !Array.isArray(st.checklist.entries)) {
    st.checklist.entries = st.checklist;
    delete st.checklist;
  }

  // Seed defaults if missing
  if (!st.groupCoin.coinSheet) {
    const rows = 10, cols = 6;
    const data = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ raw: "" }))
    );
    st.groupCoin.coinSheet = { rows, cols, data };
  }
  if (!Array.isArray(st.itemsFound.items)) st.itemsFound.items = [];
  if (!Array.isArray(st.checklist.entries)) st.checklist.entries = [];

  return st;
}

export class State {
  /** Initialize module world state and apply migrations. */
  static async init() {
    const st = normalizeAndMigrate(getState() || {});
    await saveState(st);
  }

  /** Read entire state (for advanced tasks). Prefer getTab for tab code. */
  static read() {
    return normalizeAndMigrate(getState() || {});
  }

  /** Get a single tab namespace object (safe copy). */
  static getTab(ns) {
    const st = this.read();
    if (!TAB_NAMESPACES.includes(ns)) return {};
    // Return a deep clone so tabs can mutate freely before setTab
    return foundry.utils.deepClone(st[ns] || {});
  }

  /**
   * Set a tab namespace atomically (GM-authoritative).
   * Tabs should construct the full namespace object and pass it here.
   */
  static async setTab(ns, value) {
    if (!TAB_NAMESPACES.includes(ns)) return;

    if (game.user.isGM) {
      await this.#applySetTab(ns, value);
    } else {
      await game.socket?.emit(`module.${MODULE_ID}`, { action: "set-tab", ns, value, sender: game.user.id });
    }
  }

  /**
   * Update a tab namespace via a mutator callback (receives a draft object).
   * Returns the updated object.
   */
  static async updateTab(ns, updater) {
    const current = this.getTab(ns);
    const next = typeof updater === "function" ? updater(foundry.utils.deepClone(current)) : current;
    await this.setTab(ns, next);
    return next;
  }

  /** Handle socket payloads (GM only). */
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
        // Accept either the new namespaced shape or legacy keys
        const st = this.read();
        const incoming = payload?.state || {};
        // Namespaced direct copy (only known namespaces)
        for (const ns of TAB_NAMESPACES) {
          if (incoming[ns] && typeof incoming[ns] === "object") {
            st[ns] = incoming[ns];
          }
        }
        // Legacy convenience: { coinSheet } -> groupCoin.coinSheet
        if (incoming.coinSheet) {
          st.groupCoin ??= {};
          st.groupCoin.coinSheet = incoming.coinSheet;
        }
        await saveState(normalizeAndMigrate(st));
        Hooks.callAll(`${MODULE_ID}:state-updated`);
        return;
      }
      default:
        return;
    }
  }

  /** INTERNAL: GM-side write + broadcast hook */
  static async #applySetTab(ns, value) {
    const st = this.read();
    st[ns] = value || {};
    await saveState(normalizeAndMigrate(st));
    Hooks.callAll(`${MODULE_ID}:state-updated`);
  }
}
