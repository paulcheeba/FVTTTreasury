/* global game, ui, foundry */
import { getThemeSetting } from "./settings.js";
import { mountGroupCoin } from "./tabs/group-coin.js";
import { mountItemsFound } from "./tabs/items-found.js";
import { mountChecklist } from "./tabs/checklist.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const BaseApp = HandlebarsApplicationMixin(ApplicationV2);

export class FVTTTreasuryApp extends BaseApp {
  static instance;

  /** Persist active tab */
  tabGroups = { main: "group-coin" };

  static TABS = {
    main: {
      initial: "group-coin",
      tabs: [
        { id: "group-coin", icon: "fas fa-coins",       label: "Group Coin" },
        { id: "items-found", icon: "fas fa-box-open",    label: "Items Found" },
        { id: "checklist",   icon: "fas fa-list-check",  label: "Checklist" }
      ]
    }
  };

  static DEFAULT_OPTIONS = {
    id: "fvtt-treasury",
    classes: ["fvtt-treasury"],
    position: { width: 900, height: 650 },
    window: { title: "FVTTTreasury", icon: "fas fa-coins" },
    actions: {
      // No tab-local actions here; tabs mount their own listeners.
    }
  };

  static PARTS = {
    body: { template: "modules/fvtt-treasury/scripts/handlebars/app.hbs" }
  };

  constructor(options = {}) {
    super(options);
    FVTTTreasuryApp.instance = this;
    this._tabsCtl = null;
  }

  async _prepareContext() {
    const theme = getThemeSetting();
    const tabs = FVTTTreasuryApp.TABS.main.tabs;
    const activeTab = this.tabGroups.main ?? FVTTTreasuryApp.TABS.main.initial;
    return { theme, tabs, activeTab };
  }

  async _onRender() {
    // Apply theme class
    try {
      const el = this.element;
      const theme = getThemeSetting();
      const themes = ["plain", "dnd5e", "5e", "cyberpunk"];
      for (const t of themes) el.classList.remove(`theme-${t}`);
      if (theme) el.classList.add(`theme-${theme}`);
    } catch {}

    // Bind Foundry Tabs controller
    this._tabsCtl = new foundry.applications.ux.Tabs({
      navSelector: 'nav.tabs[data-group="main"]',
      contentSelector: '.ft-tabs[data-group="main"]',
      initial: this.tabGroups.main ?? "group-coin",
      callback: (tabId) => {
        this.tabGroups.main = tabId;
        try { this.changeTab(tabId, "main", { updatePosition: false }); } catch {}
        try { this._tabsCtl?.activate(tabId, false); } catch {}
      }
    });
    this._tabsCtl.bind(this.element);
    try { this._tabsCtl.activate(this.tabGroups.main ?? "group-coin", false); } catch {}

    // Mount each tab’s content (from its own module + HBS)
    await this._mountTabs();
  }

  async _mountTabs() {
    const root = this.element;
    const ctx = {}; // future shared context if needed
    // Each tab module handles its own rendering + listeners.
    const gc = root.querySelector('.tab[data-tab="group-coin"] .ft-panel');
    if (gc) await mountGroupCoin(this, gc, ctx);

    const it = root.querySelector('.tab[data-tab="items-found"] .ft-panel');
    if (it) await mountItemsFound(this, it, ctx);

    const cl = root.querySelector('.tab[data-tab="checklist"] .ft-panel');
    if (cl) await mountChecklist(this, cl, ctx);
  }

  async close(options = {}) {
    this._tabsCtl = null;
    return super.close(options);
  }
}
