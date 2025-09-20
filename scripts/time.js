/* global game */

export class Time {
  static nowISO() {
    return new Date().toISOString();
  }

  /**
   * If a world calendar is configured (via modules), you could adapt to use it.
   * For now, return a plain ISO timestamp. Extend to read game.time.components if desired.
   */
  static fromProviderOrNow() {
    // Example (disabled by default):
    // const comp = game.time?.components;
    // if (comp) return `${comp.year}-${String(comp.month).padStart(2,"0")}-${String(comp.day).padStart(2,"0")} ${String(comp.hour).padStart(2,"0")}:${String(comp.minute).padStart(2,"0")}`;
    return this.nowISO();
  }
}
