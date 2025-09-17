export class Time {
  static nowISO() {
    return new Date().toISOString();
  }

  static fromProviderOrNow() {
    // Stubs — integrate Simple Calendar / About Time Next here if present
    return this.nowISO();
  }
}
