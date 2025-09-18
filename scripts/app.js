//v13.0.0.5
/* global foundry, game, Handlebars, ui */
import { getState, isEditor, getRefreshSec, getTheme } from "./settings.js";
import { State } from "./state.js";
import { ItemsLinking } from "./items.js";
import { IO } from "./io.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const BaseApp = HandlebarsApplicationMixin(ApplicationV2);

export class FVTTTreasuryApp extends BaseApp {
  static instance;

  // Track active tab; AppV2 does not auto-activate tabs for you
  tabGroups = { main: "ledger" };

  static DEFAULT_OPTIONS = {
    id: "fvtt-treasury",
    classes: ["fvtt-treasury"],
    position: { width: 900, height: 650 },
    window: { title: "FVTTTreasury", icon: "fas fa-coins" },
    actions: {
      addLedger: (ev, target) => this.instance?._actionAddLedger(ev, target),
      delLedger: (ev, target) => this.instance?._actionDelLedger(ev, target),
      delItem:   (ev, target) => this.instance?._actionDelItem(ev, target),
      toggleCheck: (ev, t) => this.instance?._actionToggleCheck(ev, t),
      exportJSON: () => IO.exportJSON(),
      importJSON: (ev, target) => this.instance?._actionImport(ev, target),
      setTheme: (ev, target) => this.instance?._actionSetTheme(ev, target)
      // Built-in "tab" action handles tab clicks via data-action="tab"
    }
  };

  static PARTS = {
    body: { template: "modules/fvtt-treasury/scripts/handlebars/app.hbs" }
  };

  constructor(options = {}) {
    super(options);
    FVTTTreasuryApp.instance = this;
    this._interval = null;
  }

  async _prepareContext() {
    const st = getState();
    const editor = isEditor(game.user);
    const actors = game.actors.contents.map(a => ({ id: a.id, name: a.name }));
    const nameOf = new Map(actors.map(a => [a.id, a.name]));

    // Compute item ownership (read-only; uses v12+ compendiumSource with quiet legacy fallback)
    const items = (st.items ?? []).map(it => {
      const owners = ItemsLinking.whoOwns(it.uuid);
      return {
        ...it,
        owners,
        ownerNames: owners.map(id => nameOf.get(id) ?? id)
      };
    });

    const theme = getTheme();
    const tabs = [
      { id: "ledger",   label: "Ledger",    icon: "fas fa-book" },
      { id: "items",    label: "Items",     icon: "fas fa-box" },
      { id: "actors",   label: "Actors",    icon: "fas fa-users" },
      { id: "check",    label: "Checklist", icon: "fas fa-list-check" },
      { id: "settings", label: "Settings",  icon: "fas fa-gear" }
    ];

    return { st, editor, actors, items, theme, treasurers: st.treasurers ?? [], tabs };
  }

  /**
   * Re-apply active tab after each render and wire listeners.
   */
  async _onRender() {
    this._applyActiveTab();

    // Drop zone for Items tab
    const dropZone = this.element.querySelector(".ft-items-drop");
    if (dropZone) {
      dropZone.addEventListener("dragover", ev => ev.preventDefault());
      dropZone.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        if (!isEditor(game.user)) return ui.notifications.warn("Not authorized");
        const parsed = await ItemsLinking.parseDrop(ev);
        if (!parsed) return;
        await State.mutate("add-item", {
          ts: new Date().toISOString(),
          label: parsed.label,
          uuid: parsed.uuid,
          notes: ""
        });
      });
    }

    // Remember tab when user clicks one (so we reopen to the same tab after refresh)
    const nav = this.element.querySelector('nav.tabs[data-group="main"]');
    if (nav) {
      nav.addEventListener("click", (ev) => {
        const el = ev.target?.closest('[data-action="tab"][data-tab]');
        if (el) this.tabGroups.main = el.dataset.tab;
      });
    }

    // File import input
    const file = this.element.querySelector("#ft-import-file");
    if (file) file.addEventListener("change", async (ev) => {
      const f = ev.currentTarget.files?.[0];
      if (!f) return;
      await IO.importJSON(f);
      ev.currentTarget.value = "";
    });

    // Restart auto-refresh (avoid stacking intervals)
    clearInterval(this._interval);
    const sec = Math.max(5, Number(getRefreshSec() || 10));

    // Full-window refresh per your request: reopen the application every N seconds.
    this._interval = setInterval(() => {
      // Persist whichever tab is active right now before refresh
      const active = this.element.querySelector('.tab.active[data-group="main"]')?.dataset?.tab;
      if (active) this.tabGroups.main = active;

      // Re-render the entire window (not just parts)
      this.render(true);
    }, sec * 1000);
  }

  /**
   * Ensure the tab indicated by this.tabGroups.main is active.
   * Call twice (immediate + next frame) to avoid race conditions on first paint.
   */
  _applyActiveTab() {
    const desired = this.tabGroups?.main ?? "ledger";
    try { this.changeTab(desired, "main", { updatePosition: false }); } catch {}
    // In case the DOM hasn't fully settled yet, try again on next animation frame.
    try {
      requestAnimationFrame(() => {
        try { this.changeTab(desired, "main", { updatePosition: false }); } catch {}
      });
    } catch {}
  }

  async close(options = {}) {
    clearInterval(this._interval);
    return super.close(options);
  }

  // Actions
  async _actionAddLedger(ev, target) {
    if (!isEditor(game.user)) return ui.notifications.warn("Not authorized");
    const row = target.closest("[data-ft-row]");
    const label = row.querySelector('input[name="label"]').value.trim();
    const amount = Number(row.querySelector('input[name="amount"]').value);
    const currency = row.querySelector('select[name="currency"]').value;
    if (!label) return ui.notifications.warn("Enter a label");
    await State.mutate("add-ledger", {
      ts: new Date().toISOString(),
      label,
      amount,
      currency,
      participantsActorIds: [],
      notes: ""
    });
  }

  async _actionDelLedger(ev, target) {
    if (!isEditor(game.user)) return ui.notifications.warn("Not authorized");
    const id = target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    await State.mutate("remove-ledger", { id });
  }

  async _actionDelItem(ev, target) {
    if (!isEditor(game.user)) return ui.notifications.warn("Not authorized");
    const id = target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    await State.mutate("remove-item", { id });
  }

  async _actionToggleCheck(ev, target) {
    if (!isEditor(game.user)) return ui.notifications.warn("Not authorized");
    const id = target.closest("[data-id]")?.dataset.id;
    await State.mutate("toggle-check", { id });
  }

  async _actionImport(ev, target) {
    this.element.querySelector("#ft-import-file")?.click();
  }

  async _actionSetTheme(ev, target) {
    if (!isEditor(game.user)) return;
    const theme = target.value;
    await State.mutate("set-theme", { theme });
  }
}
