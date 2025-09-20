/* global renderTemplate, ui, game */
import { State } from "../state.js";
import { isEditor } from "../settings.js";

/** Convert column index to letters: 0->A, 25->Z, 26->AA ... */
function colToLabel(n) {
  let s = "";
  n = Number(n);
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}
/** Convert A1, AB12 → {r,c} (0-based). Returns null if invalid. */
function refToRC(ref) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) return null;
  const [, letters, num] = m;
  let c = 0;
  for (let i = 0; i < letters.length; i++) c = c * 26 + (letters.charCodeAt(i) - 64);
  c -= 1;
  const r = parseInt(num, 10) - 1;
  return (r >= 0 && c >= 0) ? { r, c } : null;
}

/** Build evaluator over a given sheet {rows, cols, data[{raw}][][]} */
function buildEvaluator(sheet) {
  const rows = sheet.rows, cols = sheet.cols;
  const raw = sheet.data;

  const cache = new Map();
  const visiting = new Set();

  const getVal = (r, c) => {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return 0;
    const key = `${r},${c}`;
    if (cache.has(key)) return cache.get(key);
    if (visiting.has(key)) return NaN; // circular
    visiting.add(key);
    const cellRaw = String(raw[r][c]?.raw ?? "").trim();
    let out = 0;
    if (cellRaw.startsWith("=")) {
      out = evalFormula(cellRaw.slice(1));
    } else {
      out = Number(cellRaw.replace(/,/g,""));
      if (!Number.isFinite(out)) out = 0;
    }
    visiting.delete(key);
    cache.set(key, out);
    return out;
  };

  const sumRange = (aRef, bRef) => {
    const a = refToRC(aRef), b = refToRC(bRef);
    if (!a || !b) return 0;
    const r0 = Math.min(a.r, b.r), r1 = Math.max(a.r, b.r);
    const c0 = Math.min(a.c, b.c), c1 = Math.max(a.c, b.c);
    let s = 0;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) s += getVal(r, c);
    return s;
  };

  function evalFormula(expr) {
    const safe = expr.toUpperCase();

    let replaced = safe.replace(/SUM\(\s*([A-Z]+\d+)\s*:\s*([A-Z]+\d+)\s*\)/g, (_, a, b) => {
      return `${sumRange(a,b)}`;
    });

    replaced = replaced.replace(/\b([A-Z]+)(\d+)\b/g, (m, Ls, Ns) => {
      const rc = refToRC(Ls + Ns);
      if (!rc) return "0";
      const v = getVal(rc.r, rc.c);
      return Number.isFinite(v) ? String(v) : "NaN";
    });

    replaced = replaced.replace(/ROUND\(\s*([^,()]+)\s*,\s*([^)]+)\)/g, (_, x, n) => {
      const xv = Number(evalArith(x));
      const nv = Math.max(0, Number(evalArith(n))|0);
      if (!Number.isFinite(xv)) return "NaN";
      const f = Math.pow(10, nv);
      return String(Math.round(xv * f) / f);
    });

    replaced = replaced.replace(/FLOOR\(\s*([^)]+)\)/g, (_, x) => {
      const v = Number(evalArith(x));
      return Number.isFinite(v) ? String(Math.floor(v)) : "NaN";
    });
    replaced = replaced.replace(/CEIL\(\s*([^)]+)\)/g, (_, x) => {
      const v = Number(evalArith(x));
      return Number.isFinite(v) ? String(Math.ceil(v)) : "NaN";
    });

    return Number(evalArith(replaced));
  }

  function evalArith(expr) {
    const ok = /^[0-9+\-*/().,\sNa]+$/i.test(expr);
    if (!ok) return "NaN";
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function(`return (${expr});`);
      const v = fn();
      return Number.isFinite(v) ? String(v) : "NaN";
    } catch {
      return "NaN";
    }
  }

  return { getVal };
}

function computeDisplays(sheet) {
  const ev = buildEvaluator(sheet);
  const out = Array.from({ length: sheet.rows }, () => Array(sheet.cols).fill(""));
  for (let r = 0; r < sheet.rows; r++) {
    for (let c = 0; c < sheet.cols; c++) {
      const raw = String(sheet.data[r][c]?.raw ?? "").trim();
      let disp = raw;
      if (raw.startsWith("=")) {
        const v = ev.getVal(r, c);
        disp = Number.isFinite(v) ? String(v) : "ERR";
      } else if (raw === "") {
        disp = "";
      } else {
        const v = Number(raw.replace(/,/g,""));
        disp = Number.isFinite(v) ? String(v) : raw;
      }
      out[r][c] = disp;
    }
  }
  return out;
}

export async function mountGroupCoin(app, el /*, ctx */) {
  const editor = isEditor(game.user);

  // Tab-owned state lives under namespace "groupCoin"
  const ns = "groupCoin";
  const tabState = State.getTab(ns);
  const sheet = tabState.coinSheet;

  // Build headers + display values
  const headers = Array.from({ length: sheet.cols }, (_, c) => colToLabel(c));
  const displays = computeDisplays(sheet);

  const html = await renderTemplate("modules/fvtt-treasury/scripts/handlebars/tabs/group-coin.hbs", {
    editor,
    rows: sheet.rows,
    cols: sheet.cols,
    headers,
    cells: sheet.data,
    displays,
    help: [
      `Type numbers or formulas starting with "="`,
      `Examples: =A1+B2  |  =SUM(A1:A5)  |  =ROUND(B3*1.5,2)`
    ]
  });
  el.innerHTML = html;

  // Local live preview: recompute displays as you type (no state write yet)
  const table = el.querySelector(".gc-grid");
  const recompute = () => {
    const local = {
      rows: sheet.rows,
      cols: sheet.cols,
      data: Array.from({ length: sheet.rows }, (_, r) =>
        Array.from({ length: sheet.cols }, (_, c) => {
          const inp = el.querySelector(`.gc-cell[data-r="${r}"][data-c="${c}"] .gc-input`);
          return { raw: inp ? inp.value : sheet.data[r][c].raw };
        })
      )
    };
    const disps = computeDisplays(local);
    for (let r = 0; r < local.rows; r++) {
      for (let c = 0; c < local.cols; c++) {
        const valEl = el.querySelector(`.gc-cell[data-r="${r}"][data-c="${c}"] .gc-value`);
        if (valEl) valEl.textContent = disps[r][c];
      }
    }
  };

  if (editor) {
    table?.addEventListener("input", (ev) => {
      const tgt = ev.target;
      if (!(tgt instanceof HTMLInputElement)) return;
      recompute();
    });

    // Save a single cell on Enter/Blur via updateTab (no state.js changes needed)
    const commit = async (inp) => {
      const r = Number(inp.dataset.r), c = Number(inp.dataset.c);
      const raw = inp.value;
      await State.updateTab(ns, (draft) => {
        const sh = draft.coinSheet;
        if (!sh || r < 0 || c < 0 || r >= sh.rows || c >= sh.cols) return draft;
        sh.data[r][c] = { raw: String(raw ?? "") };
        return draft;
      });
    };

    table?.addEventListener("keydown", async (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        const inp = ev.target;
        if (inp instanceof HTMLInputElement) await commit(inp);
      }
    });
    table?.addEventListener("focusout", async (ev) => {
      const inp = ev.target;
      if (inp instanceof HTMLInputElement) await commit(inp);
    });

    // Row/Col ops owned entirely by this tab
    el.querySelector('[data-action="gc-add-row"]')?.addEventListener("click", async () => {
      await State.updateTab(ns, (draft) => {
        const sh = draft.coinSheet;
        const cols = sh.cols;
        sh.data.push(Array.from({ length: cols }, () => ({ raw: "" })));
        sh.rows += 1;
        return draft;
      });
    });
    el.querySelector('[data-action="gc-add-col"]')?.addEventListener("click", async () => {
      await State.updateTab(ns, (draft) => {
        const sh = draft.coinSheet;
        for (const row of sh.data) row.push({ raw: "" });
        sh.cols += 1;
        return draft;
      });
    });
    el.querySelector('[data-action="gc-del-row"]')?.addEventListener("click", async () => {
      const r = Number(prompt("Delete which row? (1-based)") || "0") - 1;
      if (!Number.isInteger(r) || r < 0) return;
      await State.updateTab(ns, (draft) => {
        const sh = draft.coinSheet;
        if (sh.rows > 1 && r >= 0 && r < sh.rows) {
          sh.data.splice(r, 1);
          sh.rows -= 1;
        }
        return draft;
      });
    });
    el.querySelector('[data-action="gc-del-col"]')?.addEventListener("click", async () => {
      const c = Number(prompt("Delete which column? (A=1, B=2, ...)") || "0") - 1;
      if (!Number.isInteger(c) || c < 0) return;
      await State.updateTab(ns, (draft) => {
        const sh = draft.coinSheet;
        if (sh.cols > 1 && c >= 0 && c < sh.cols) {
          for (const row of sh.data) row.splice(c, 1);
          sh.cols -= 1;
        }
        return draft;
      });
    });
  } else {
    // Viewers: disable inputs
    el.querySelectorAll(".gc-input").forEach(inp => inp.setAttribute("disabled", "true"));
  }
}
