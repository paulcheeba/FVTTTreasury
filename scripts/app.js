/* global game, ui, Handlebars, foundry */
import { getState, isEditor, getTheme } from "./settings.js";
import { State } from "./state.js";
import { ItemsLinking } from "./items.js";
import { IO } from "./io.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const BaseApp = HandlebarsApplicationMixin(ApplicationV2);

export class FVTTTreasuryApp extends BaseApp {
  static instance;

  /** Persisted active tab per group (V13 expects you to manage this). */
  tabGroups = { main: "ledger" };

  /** Optional: describe tab set for the group (not required, but nice for consistency). */
  static TABS = {
    main: {
      initial: "ledger",
      tabs: [
        { id: "ledger",   icon: "fas fa-book",        label: "Ledger" },
        { id: "items",    icon: "fas fa-box",         label: "Items" },
        { id: "actors",   icon: "fas fa-users",       label: "Actors" },
        { id: "check",    icon: "fas fa-list-check",  label: "Checklist" },
        { id: "settings", icon: "fas fa-gear",        label: "Settings" }
      ]
    }
  };

  static DEFAULT_OPTIONS = {
    id: "fvtt-treasury",
    classes: ["fvtt-treasury"],
    position: { width: 900, height: 650 },
    window: { title: "FVTTTreasury", icon: "fas fa-coins" },
    actions: {
      // Data mutations → render AFTER action (no timed refresh at all)
      addLedger:    (ev, target) => FVTTTreasuryApp.instance?._actAddLedger(ev, target),
      delLedger:    (ev, target) => FVTTTreasuryApp.instance?._actDelById(ev, target, "ledger"),
      delItem:      (ev, target) => FVTTTreasuryApp.instance?._actDelById(ev, target, "item"),
      toggleCheck:  (ev, target) => FVTTTreasuryApp.instance?._actToggleCheck(ev, target),
      importJSON:   () => FVTTTreasuryApp.instance?._openImport(),
      exportJSON:   () => IO.exportJSON(),
      setTheme:     (ev, target) => FVTTTreasuryApp.instance?._actSetTheme(ev, target)
    }
  };

  static PARTS = {
    body: { template: "modules/fvtt-treasury/scripts/handlebars/app.hbs" }
  };

  constructor(options = {}) {
    super(options);
    FVTTTreasuryApp.instance = this;
    this._tabsCtl = null; // foundry.applications.ux.Tabs instance
  }

  /* ------------------------------ RENDERING -------------------------------- */

  async _prepareContext() {
    const st = getState();
    const editor = isEditor(game.user);
    const actors = game.actors?.contents?.map(a => ({ id: a.id, name: a.name })) ?? [];
    const nameOf = new Map(actors.map(a => [a.id, a.name]));

    // Resolve owners for linked items (read-only)
    const items = (st.items ?? []).map(it => {
      const owners = ItemsLinking.whoOwns(it.uuid);
      return { ...it, owners, ownerNames: owners.map(id => nameOf.get(id) ?? id) };
    });

    const theme = getTheme();
    const tabs = FVTTTreasuryApp.TABS.main.tabs;
    const activeTab = this.tabGroups.main ?? FVTTTreasuryApp.TABS.main.initial ?? "ledger";

    return {
      st,
      editor,
      actors,
      items,
      theme,
      tabs,
      activeTab,
      treasurers: st.treasurers ?? []
    };
  }

  /**
   * After render: bind Foundry's Tabs controller once and wire other listeners.
   * We DO NOT use any timed refresh; re-renders happen after actions/state updates.
   */
  async _onRender() {
    // Bind tabs once per element lifecycle
    if (!this._tabsCtl) {
      this._tabsCtl = new foundry.applications.ux.Tabs({
        navSelector: 'nav.tabs[data-group="main"]',
        contentSelector: '.ft-tabs[data-group="main"]',
        initial: this.tabGroups.main ?? "ledger",
        callback: (tabId) => {
          // Keep AppV2 state in sync (so reopening shows last tab)
          this.tabGroups.main = tabId;
          // Also let AppV2 record the change (optional but aligns with API intent)
          try { this.changeTab(tabId, "main", { updatePosition: false }); } catch {}
        }
      });
      this._tabsCtl.bind(this.element);
    } else {
      // If the app re-rendered due to a mutation, ensure controller shows the active tab
      try { this._tabsCtl.activate(this.tabGroups.main ?? "ledger", false); } catch {}
    }

    // Drag/drop target for the Items tab
    const dropZone = this.element.querySelector(".ft-items-drop");
    if (dropZone && !dropZone._ftBound) {
      dropZone._ftBound = true;
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

    // File import
    const file = this.element.querySelector("#ft-import-file");
    if (file && !file._ftBound) {
      file._ftBound = true;
      file.addEventListener("change", async (ev) => {
        const f = ev.currentTarget.files?.[0];
        if (!f) return;
        await IO.importJSON(f);
        ev.currentTarget.value = "";
      });
    }
  }

  async close(options = {}) {
    // Tabs controller does not need manual teardown, but deref it to be tidy
    this._tabsCtl = null;
    return super.close(options);
  }

  /* ------------------------------- ACTIONS --------------------------------- */

  async _actAddLedger(ev, target) {
    if (!isEditor(game.user)) return ui.notifications.warn("Not authorized");
    const row = target.closest("[data-ft-row]");
    const get = (sel) => row?.querySelector(sel);
    const label = get('input[name="label"]')?.value?.trim();
    const amount = Number(get('input[name="amount"]')?.value ?? 0);
    const currency = get('select[name="currency"]')?.value ?? "gp";
    if (!label) return ui.notifications.warn("Enter a label");
    await State.mutate("add-ledger", {
      ts: new Date().toISOString(),
      label, amount, currency,
      participantsActorIds: [],
      notes: ""
    });
  }

  async _actDelById(ev, target, kind) {
    if (!isEditor(game.user)) return ui.notifications.warn("Not authorized");
    const id = target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    await State.mutate(kind === "item" ? "remove-item" : "remove-ledger", { id });
  }

  async _actToggleCheck(ev, target) {
    if (!isEditor(game.user)) return ui.notifications.warn("Not authorized");
    const id = target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    await State.mutate("toggle-check", { id });
  }

  _openImport() {
    this.element.querySelector("#ft-import-file")?.click();
  }

  async _actSetTheme(ev, target) {
    if (!isEditor(game.user)) return;
    const theme = target.value;
    await State.mutate("set-theme", { theme });
  }
}
