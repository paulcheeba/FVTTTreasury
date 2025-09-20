/* global game, ui, Handlebars, foundry */
import { getState, isEditor, getTheme } from "./settings.js";
import { State } from "./state.js";
import { ItemsLinking } from "./items.js";
import { IO } from "./io.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const BaseApp = HandlebarsApplicationMixin(ApplicationV2);

export class FVTTTreasuryApp extends BaseApp {
  static instance;

  /** Persisted active tab per group */
  tabGroups = { main: "ledger" };

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
      addLedger:   (ev, target) => FVTTTreasuryApp.instance?._actAddLedger(ev, target),
      delLedger:   (ev, target) => FVTTTreasuryApp.instance?._actDelById(ev, target, "ledger"),
      delItem:     (ev, target) => FVTTTreasuryApp.instance?._actDelById(ev, target, "item"),
      toggleCheck: (ev, target) => FVTTTreasuryApp.instance?._actToggleCheck(ev, target),
      importJSON:  () => FVTTTreasuryApp.instance?._openImport(),
      exportJSON:  () => IO.exportJSON(),
      setTheme:    (ev, target) => FVTTTreasuryApp.instance?._actSetTheme(ev, target)
    }
  };

  static PARTS = {
    body: { template: "modules/fvtt-treasury/scripts/handlebars/app.hbs" }
  };

  constructor(options = {}) {
    super(options);
    FVTTTreasuryApp.instance = this;
    this._tabsCtl = null; // Tabs controller instance (rebuilt each render)
  }

  /* ------------------------------ RENDERING -------------------------------- */

  async _prepareContext() {
    const st = getState();
    const editor = isEditor(game.user);
    const actors = game.actors?.contents?.map(a => ({ id: a.id, name: a.name })) ?? [];
    const nameOf = new Map(actors.map(a => [a.id, a.name]));

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
   * After each render: (re)bind Foundry's Tabs controller to the fresh DOM and activate current tab.
   * No timed refresh; re-render only after actions/state updates.
   */
  async _onRender() {
    // Always create a fresh Tabs controller after render because the DOM was patched.
    this._tabsCtl = new foundry.applications.ux.Tabs({
      navSelector: 'nav.tabs[data-group="main"]',
      contentSelector: '.ft-tabs[data-group="main"]',
      initial: this.tabGroups.main ?? "ledger",
      callback: (tabId) => {
        // Keep state in sync so reopening shows same tab
        this.tabGroups.main = tabId;
        // Also tell ApplicationV2 (optional, but aligns with API expectations)
        try { this.changeTab(tabId, "main", { updatePosition: false }); } catch {}
        // Visually ensure activation (in case of timing)
        try { this._tabsCtl?.activate(tabId, false); } catch {}
      }
    });
    this._tabsCtl.bind(this.element);
    // Immediately activate current tab for the freshly-rendered DOM
    try { this._tabsCtl.activate(this.tabGroups.main ?? "ledger", false); } catch {}

    // Drag/drop target for Items tab
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
    this._tabsCtl = null; // deref; old listeners go away with DOM
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
