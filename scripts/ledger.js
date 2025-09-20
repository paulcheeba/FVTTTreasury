export class Ledger {
  static normalize(n) {
    const v = Number(n ?? 0);
    return Number.isFinite(v) ? v : 0;
  }

  static totalByCurrency(entries) {
    const totals = {};
    for (const e of entries) {
      const a = this.normalize(e.amount);
      const cur = e.currency || "gp";
      totals[cur] = (totals[cur] ?? 0) + a;
    }
    return totals;
  }

  static toBaseUnits(totals, currencies) {
    const map = Object.fromEntries((currencies ?? []).map(c => [c.key, c.rate]));
    return Object.entries(totals).reduce((sum, [k, v]) => sum + (v * (map[k] ?? 1)), 0);
    // Example: cp=1, sp=10, gp=100, pp=1000
  }

  static splitEven(amount, count) {
    amount = this.normalize(amount);
    count = Math.max(1, Number(count ?? 1));
    const base = Math.floor((amount / count) * 100) / 100;
    const parts = Array(count).fill(base);
    let remainder = Math.round((amount - base * count) * 100);
    for (let i = 0; remainder > 0; i = (i + 1) % count) { parts[i] += 0.01; remainder--; }
    return parts;
  }
}
