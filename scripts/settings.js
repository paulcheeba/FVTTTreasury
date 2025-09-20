/* global game, Hooks, FormApplication, foundry, ui */
import { MODULE_ID } from "../treasury.js";
import { IO } from "./io.js";

/* ---------------------------- Settings Storage ---------------------------- */

export function registerSettings() {
  // World data (treasury data itself)
  game.settings.register(MODULE_ID, "state", {
    scope: "world",
    config: false,
    type: Object,
    default: {
      version: "13.0.0.6",
      ledger: [],
      items: [],
      checklist: []
    },
    onChange: () => {
      try { Hooks.callAll(`${MODULE_ID}:state-updated`); } catch {}
    }
  });

  // Theme (world-wide for simplicity)
  game.settings.register(MODULE_ID, "theme", {
    scope: "world",
    config: false,
    type: String,
    default: "plain"
  });

  // Treasurers (array of user IDs) — GM editable
  game.settings.register(MODULE_ID, "treasurers", {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  // Currency mode: "dndpf" | "custom"
  game.settings.register(MODULE_ID, "currencyMode", {
    scope: "world",
    config: false,
    type: String,
    default: "dndpf"
  });

  // Custom currencies: Array of up to 10 { key, label, rate }
  game.settings.register(MODULE_ID, "customCurrencies", {
    scope: "world",
    config: false,
    type: Array,
    default: []
  });

  // GM Settings Menu (opens our custom form)
  game.settings.registerMenu(MODULE_ID, "config", {
    name: "FVTTTreasury Settings",
    label: "Open Settings",
    hint: "Configure treasurers, theme, currencies, and import/export.",
    icon: "fas fa-coins",
    type: TreasurySettingsForm,
    restricted: true
  });
}

export function onReadySettings() {}

/* ----------------------- Simple getters for the app ----------------------- */
export function getThemeSetting() {
  return game.settings.get(MODULE_ID, "theme") || "plain";
}
export function getTreasurersSetting() {
  return game.settings.get(MODULE_ID, "treasurers") ?? [];
}
export function setTreasurersSetting(ids) {
  return game.settings.set(MODULE_ID, "treasurers", Array.from(new Set(ids)));
}
export function isEditor(user) {
  if (user?.isGM) return true;
  const treasurers = getTreasurersSetting();
  return treasurers.includes(user?.id);
}
export function getCurrencyMode() {
  return game.settings.get(MODULE_ID, "currencyMode") || "dndpf";
}
export function getCustomCurrencies() {
  return game.settings.get(MODULE_ID, "customCurrencies") || [];
}
export async function setCustomCurrencies(arr) {
  await game.settings.set(MODULE_ID, "customCurrencies", arr || []);
}
export function getCurrenciesEffective() {
  const mode = getCurrencyMode();
  if (mode === "custom") {
    const arr = getCustomCurrencies().filter(Boolean).slice(0, 10);
    return arr.map(c => ({
      key: String(c.key || "").trim(),
      label: String(c.label || "").trim() || String(c.key || "").trim(),
      rate: Number(c.rate || 0) || 0
    })).filter(c => c.key && c.label && c.rate > 0);
  }
  // Default D&D/PF
  return [
    { key: "cp", label: "Copper",   rate: 1 },
    { key: "sp", label: "Silver",   rate: 10 },
    { key: "ep", label: "Electrum", rate: 50 },
    { key: "gp", label: "Gold",     rate: 100 },
    { key: "pp", label: "Platinum", rate: 1000 }
  ];
}

/* ---------------------------- Settings Form UI --------------------------- */

class TreasurySettingsForm extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "fvtt-treasury-settings",
      title: "FVTTTreasury Settings",
      template: "modules/fvtt-treasury/scripts/handlebars/settings.hbs",
      classes: ["fvtt-treasury", "fvtt-treasury-settings"],
      width: 640,
      height: "auto",
      submitOnClose: false,
      closeOnSubmit: false
    });
  }

  getData() {
    const users = game.users?.contents ?? [];
    const players = users.filter(u => !u.isGM);
    const treasurers = getTreasurersSetting();
    const theme = getThemeSetting();
    const currencyMode = getCurrencyMode();
    const custom = getCustomCurrencies();
    // pad to 10 rows
    const rows = Array.from({ length: 10 }, (_, i) => custom[i] || { key: "", label: "", rate: "" });

    return {
      players: players.map(u => ({ id: u.id, name: u.name, selected: treasurers.includes(u.id) })),
      theme,
      currencyMode,
      customRows: rows
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Theme change
    html.find('select[name="theme"]').on("change", async (ev) => {
      await game.settings.set(MODULE_ID, "theme", ev.currentTarget.value);
      ui.notifications.info("FVTTTreasury: Theme updated.");
    });

    // Currency mode change
    html.find('select[name="currencyMode"]').on("change", async (ev) => {
      await game.settings.set(MODULE_ID, "currencyMode", ev.currentTarget.value);
      this.render(true);
    });

    // Save Treasurers
    html.find('button[data-action="save-treasurers"]').on("click", async () => {
      const ids = Array.from(html[0].querySelectorAll('input[name="treasurer"]:checked')).map(i => i.value);
      await setTreasurersSetting(ids);
      ui.notifications.info("FVTTTreasury: Treasurers updated.");
    });

    // Save Custom Currencies
    html.find('button[data-action="save-currencies"]').on("click", async () => {
      const rows = Array.from(html[0].querySelectorAll(".ft-currency-row"));
      const out = rows.map(r => ({
        key: r.querySelector('[name="key"]').value.trim(),
        label: r.querySelector('[name="label"]').value.trim(),
        rate: Number(r.querySelector('[name="rate"]').value)
      })).filter(c => c.key && c.label && c.rate > 0);
      await setCustomCurrencies(out);
      ui.notifications.info("FVTTTreasury: Custom currencies saved.");
    });

    // Export / Import
    html.find('button[data-action="export-json"]').on("click", () => IO.exportJSON());
    const file = html.find('#ft-import-file');
    file.on("change", async (ev) => {
      const f = ev.currentTarget.files?.[0];
      if (!f) return;
      await IO.importJSON(f);
      ev.currentTarget.value = "";
      ui.notifications.info("FVTTTreasury: Import complete.");
    });
    html.find('button[data-action="import-json"]').on("click", () => file[0]?.click());
  }

  async _updateObject(event, formData) {
    // We’re handling updates via the individual button handlers above.
    return;
  }
}
