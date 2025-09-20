/* FVTTTreasury v13.0.0.16 — Group Coin Tab (self-contained)
   Features:
   - Persistent transaction log (coins/items) with (+/-), date, object, takenBy, note
   - Inline edit & delete per row (GM/Treasurers)
   - Running totals by currency and as total in GP
   - Entry form to add transactions
   - Export log (namespaced export only)
*/

import { State } from "../state.js";
import { isEditor } from "../settings.js";

/* ----------------------------- Helpers ----------------------------- */

const NS = "groupCoin";

/** Convert coin bundle to base copper */
function toCp({ cp=0, sp=0, ep=0, gp=0, pp=0 } = {}) {
  const n = (v) => Number.isFinite(+v) ? +v : 0;
  return n(cp) + n(sp)*10 + n(ep)*50 + n(gp)*100 + n(pp)*1000;
}
/** Convert cp to a human-friendly GP float */
function cpToGp(cp) {
  return (Number(cp) || 0) / 100;
}
/** Parse integer from input (blank -> 0) */
function parseInt0(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}
/** Generate id */
function rid() { return globalThis.foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2); }

/** Format ISO date to YYYY-MM-DD (local) */
function todayStr(d = new Date()) {
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

/** Ensure namespace shape exists */
function ensureNS(tab) {
  tab = tab && typeof tab === "object" ? tab : {};
  if (!Array.isArray(tab.log)) tab.log = [];
  return tab;
}

/** Compute running totals (currency breakdown and GP total) */
function computeTotals(log) {
  const totals = { cp:0, sp:0, ep:0, gp:0, pp:0 };
  for (const e of log) {
    const sign = (e.direction === "remove") ? -1 : 1;
    totals.cp += sign * parseInt0(e.cp);
    totals.sp += sign * parseInt0(e.sp);
    totals.ep += sign * parseInt0(e.ep);
    totals.gp += sign * parseInt0(e.gp);
    totals.pp += sign * parseInt0(e.pp);
  }
  const totalCP = toCp(totals);
  return { ...totals, totalGP: cpToGp(totalCP) };
}

/** Map raw entries for display */
function mapDisplay(log) {
  return log.map(e => {
    const cp = parseInt0(e.cp), sp = parseInt0(e.sp), ep = parseInt0(e.ep), gp = parseInt0(e.gp), pp = parseInt0(e.pp);
    const sign = (e.direction === "remove") ? -1 : 1;
    const rowCp = toCp({cp,sp,ep,gp,pp}) * sign;
    return {
      ...e,
      cp, sp, ep, gp, pp,
      sign,
      gpValue: cpToGp(Math.abs(rowCp)),          // absolute value in GP for row
      gpValueSigned: cpToGp(rowCp)               // signed value in GP for row
    };
  });
}

/* ----------------------------- Rendering ----------------------------- */

export async function mountGroupCoin(app, el /*, ctx */) {
  const canEdit = isEditor(game.user);
  let editingId = null;

  const render = async () => {
    const tab = ensureNS(State.getTab(NS));
    const rows = mapDisplay(tab.log);
    const totals = computeTotals(tab.log);

    const html = await renderTemplate("modules/fvtt-treasury/scripts/handlebars/tabs/group-coin.hbs", {
      canEdit,
      rows,
      totals,
      editingId,
      today: todayStr(),
      kinds: [
        { value: "coins", label: "Coins" },
        { value: "item",  label: "Item Value" }
      ],
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
      const blob = new Blob([JSON.stringify({ [NS]: { log: tab.log } }, null, 2)], { type: "application/json" });
      const name = `fvtt-treasury-groupcoin-log-${new Date().toISOString().replace(/[:.]/g,"-")}.json`;
      saveDataToFile(blob, "application/json", name);
    });

    /* ----- Add entry form (GM/Treasurers) ----- */
    const form = el.querySelector("#gc-entry-form");
    if (canEdit && form) {
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const fd = new FormData(form);
        const entry = {
          id: rid(),
          ts: String(fd.get("date") || todayStr()),
          type: String(fd.get("kind") || "coins"),                // "coins" | "item"
          direction: String(fd.get("direction") || "add"),        // "add" | "remove"
          object: String(fd.get("object") || "").trim(),          // item/loot name or blank
          takenBy: String(fd.get("takenBy") || "").trim(),
          note: String(fd.get("note") || "").trim(),
          cp: parseInt0(fd.get("cp")),
          sp: parseInt0(fd.get("sp")),
          ep: parseInt0(fd.get("ep")),
          gp: parseInt0(fd.get("gp")),
          pp: parseInt0(fd.get("pp"))
        };

        // Gentle guard: if everything is zero and no object/note, do nothing
        if (!entry.object && !entry.note && entry.cp+entry.sp+entry.ep+entry.gp+entry.pp === 0) {
          ui.notifications.warn("Enter some coin values or an object/note.");
          return;
        }

        await State.updateTab(NS, (draft) => {
          draft = ensureNS(draft);
          draft.log.push(entry);
          return draft;
        });

        // Reset light fields: keep kind/direction/date
        form.querySelector('[name="object"]').value = "";
        form.querySelector('[name="takenBy"]').value = "";
        form.querySelector('[name="note"]').value = "";
        ["cp","sp","ep","gp","pp"].forEach(n => form.querySelector(`[name="${n}"]`).value = "");
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
          const updated = {
            ts:        String(pick("ts") || todayStr()),
            type:      String(pick("type") || "coins"),
            direction: String(pick("direction") || "add"),
            object:    String(pick("object") || "").trim(),
            takenBy:   String(pick("takenBy") || "").trim(),
            note:      String(pick("note") || "").trim(),
            cp: parseInt0(pick("cp")),
            sp: parseInt0(pick("sp")),
            ep: parseInt0(pick("ep")),
            gp: parseInt0(pick("gp")),
            pp: parseInt0(pick("pp"))
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
