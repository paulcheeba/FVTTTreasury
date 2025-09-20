/* FVTTTreasury v13.0.0.17 — Group Coin Tab (dynamic coins + 2-row form)
   - Column separators, multi-line text fields, inline edit/delete
   - Two-row entry form (coins can wrap, supports up to 10 currencies)
   - Dynamic currencies from Settings; backward compatible with cp/sp/ep/gp/pp legacy
*/

import { State } from "../state.js";
import { isEditor, getCurrenciesEffective } from "../settings.js";

const NS = "groupCoin";

/* ----------------------------- Helpers ----------------------------- */

function parseInt0(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; }
function rid() { return globalThis.foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2); }
function todayStr(d = new Date()) {
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function ensureNS(tab) {
  tab = tab && typeof tab === "object" ? tab : {};
  if (!Array.isArray(tab.log)) tab.log = [];
  return tab;
}

function coinsFromEntry(entry, coinKeys) {
  const out = {};
  for (const k of coinKeys) {
    // prefer object form then legacy field
    out[k] = parseInt0(entry?.coins?.[k] ?? entry?.[k]);
  }
  return out;
}

function computeTotals(log, coinDefs, anchorKey) {
  // totals per currency and total in anchor
  const totals = {};
  for (const { key } of coinDefs) totals[key] = 0;

  let baseTotal = 0;                          // in smallest unit (assume rate=1 is smallest)
  const rateMap = Object.fromEntries(coinDefs.map(c => [c.key, Number(c.rate || 1)]));

  for (const e of log) {
    const sign = (e.direction === "remove") ? -1 : 1;
    const coins = coinsFromEntry(e, coinDefs.map(c => c.key));
    for (const k of Object.keys(coins)) {
      const amt = parseInt0(coins[k]) * sign;
      totals[k] += amt;
      baseTotal += amt * (rateMap[k] || 1);
    }
  }
  const anchorRate = rateMap[anchorKey] || 1;
  const totalInAnchor = baseTotal / anchorRate;

  return { totals, totalInAnchor };
}

function mapDisplay(log, coinDefs, anchorKey) {
  const rateMap = Object.fromEntries(coinDefs.map(c => [c.key, Number(c.rate || 1)]));
  const coinKeys = coinDefs.map(c => c.key);
  const anchorRate = rateMap[anchorKey] || 1;

  return log.map(e => {
    const sign = (e.direction === "remove") ? -1 : 1;
    const coins = coinsFromEntry(e, coinKeys);

    let base = 0;
    for (const k of coinKeys) base += parseInt0(coins[k]) * (rateMap[k] || 1);
    const signedBase = base * sign;
    const anchorVal = signedBase / anchorRate;

    return {
      ...e,
      coins,
      sign,
      anchorVal
    };
  });
}

/* ----------------------------- Rendering ----------------------------- */

export async function mountGroupCoin(app, el /*, ctx */) {
  const canEdit = isEditor(game.user);
  const coinDefs = getCurrenciesEffective(); // [{key,label,rate}, ...] up to 10
  const coinKeys = coinDefs.map(c => c.key);

  // Anchor for "in X" column: prefer gp, else the highest-rate currency
  const gp = coinDefs.find(c => c.key.toLowerCase() === "gp");
  const anchor = gp ?? coinDefs.reduce((a,b)=> (Number(a.rate||1) > Number(b.rate||1) ? a : b));
  const anchorKey = anchor.key;
  const anchorLabel = anchor.label || anchor.key;

  let editingId = null;

  const render = async () => {
    const tab = ensureNS(State.getTab(NS));
    const rows = mapDisplay(tab.log, coinDefs, anchorKey);
    const agg = computeTotals(tab.log, coinDefs, anchorKey);

    const html = await renderTemplate("modules/fvtt-treasury/scripts/handlebars/tabs/group-coin.hbs", {
      canEdit,
      rows,
      coinDefs,
      anchorKey,
      anchorLabel,
      totals: agg.totals,
      totalInAnchor: agg.totalInAnchor,
      editingId,
      today: todayStr(),
      directions: [
        { value: "add",    label: "Add (+)" },
        { value: "remove", label: "Remove (−)" }
      ]
    });
    el.innerHTML = html;

    bindHandlers();
  };

  const bindHandlers = () => {
    /* ----- Export log ----- */
    el.querySelector('[data-action="gc-export"]')?.addEventListener("click", () => {
      const tab = ensureNS(State.getTab(NS));
      const content = JSON.stringify({ [NS]: { log: tab.log } }, null, 2);
      const name = `fvtt-treasury-groupcoin-log-${new Date().toISOString().replace(/[:.]/g,"-")}.json`;
      saveDataToFile(content, "application/json", name);
    });

    /* ----- Add entry form (two-row layout) ----- */
    const form = el.querySelector("#gc-entry-form");
    if (canEdit && form) {
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const fd = new FormData(form);

        // Build coins object from dynamic keys
        const coins = {};
        for (const def of coinDefs) coins[def.key] = parseInt0(fd.get(`coin:${def.key}`));

        // Quick emptiness check
        const sumCoins = Object.values(coins).reduce((a,b)=>a+Math.abs(parseInt0(b)),0);

        const entry = {
          id: rid(),
          ts: String(fd.get("date") || todayStr()),
          direction: String(fd.get("direction") || "add"),
          object: String(fd.get("object") || "").trim(),
          takenBy: String(fd.get("takenBy") || "").trim(),
          note: String(fd.get("note") || "").trim(),
          coins
        };

        if (!entry.object && !entry.note && sumCoins === 0) {
          ui.notifications.warn("Enter some coin values or an object/note.");
          return;
        }

        // Back-compat: also mirror legacy fields for the classic 5 coins if present
        const legacyKeys = ["cp","sp","ep","gp","pp"];
        for (const k of legacyKeys) if (k in coins) entry[k] = coins[k];

        await State.updateTab(NS, (draft) => {
          draft = ensureNS(draft);
          draft.log.push(entry);
          return draft;
        });

        // Reset light fields
        for (const def of coinDefs) form.querySelector(`[name="coin:${def.key}"]`).value = "";
        form.querySelector('[name="object"]').value = "";
        form.querySelector('[name="takenBy"]').value = "";
        form.querySelector('[name="note"]').value = "";
      });
    }

    /* ----- Row actions (edit/delete) ----- */
    if (canEdit) {
      el.querySelectorAll('[data-action="row-edit"]').forEach(btn => {
        btn.addEventListener("click", (ev) => {
          const id = ev.currentTarget.closest("[data-id]")?.dataset.id;
          editingId = id || null;
          render();
        });
      });

      el.querySelectorAll('[data-action="row-cancel"]').forEach(btn => {
        btn.addEventListener("click", () => {
          editingId = null;
          render();
        });
      });

      el.querySelectorAll('[data-action="row-save"]').forEach(btn => {
        btn.addEventListener("click", async (ev) => {
          const row = ev.currentTarget.closest("tr[data-id]");
          const id = row?.dataset.id;
          if (!id) return;

          const pick = (name) => row.querySelector(`[name="${name}"]`)?.value ?? "";

          // Collect coins dynamically
          const coins = {};
          for (const def of coinDefs) coins[def.key] = parseInt0(pick(`coin:${def.key}`));
          const legacyKeys = ["cp","sp","ep","gp","pp"];
          const legacy = {};
          for (const k of legacyKeys) if (k in coins) legacy[k] = coins[k];

          const updated = {
            ts:        String(pick("ts") || todayStr()),
            direction: String(pick("direction") || "add"),
            object:    String(pick("object") || "").trim(),
            takenBy:   String(pick("takenBy") || "").trim(),
            note:      String(pick("note") || "").trim(),
            coins,
            ...legacy
          };

          await State.updateTab(NS, (draft) => {
            draft = ensureNS(draft);
            const i = draft.log.findIndex(e => e.id === id);
            if (i >= 0) draft.log[i] = { id, ...updated };
            return draft;
          });

          editingId = null;
          render();
        });
      });

      el.querySelectorAll('[data-action="row-del"]').forEach(btn => {
        btn.addEventListener("click", async (ev) => {
          const id = ev.currentTarget.closest("[data-id]")?.dataset.id;
          if (!id) return;
          await State.updateTab(NS, (draft) => {
            draft = ensureNS(draft);
            draft.log = draft.log.filter(e => e.id !== id);
            return draft;
          });
        });
      });
    }
  };

  await render();
}
