/* global foundry */
export class Ledger {
  static normalizeAmount(amount) {
    const n = Number(amount ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  static totalByCurrency(entries) {
    const totals = {};
    for (const e of entries) {
      const a = this.normalizeAmount(e.amount);
      const cur = e.currency || "gp";
      totals[cur] = (totals[cur] ?? 0) + a;
    }
    return totals;
  }

  static toBaseUnits(totals, currencies) {
    // currencies: [{key, rate}], rate is relative to base (cp=1 by default)
    const map = Object.fromEntries(currencies.map(c => [c.key, c.rate]));
    return Object.entries(totals).reduce((sum, [k,v]) => sum + (v * (map[k] ?? 1)), 0);
  }

  static splitEven(amount, count) {
    amount = this.normalizeAmount(amount);
    count = Math.max(1, Number(count ?? 1));
    const base = Math.floor((amount / count) * 100) / 100;
    const parts = Array(count).fill(base);
    let remainder = Math.round((amount - base * count) * 100);
    for (let i=0; remainder>0; i=(i+1)%count) { parts[i]+=0.01; remainder--; }
    return parts;
  }
}
