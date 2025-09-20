/* global renderTemplate */
import { getCurrenciesEffective } from "../settings.js";
import { State } from "../state.js";

export async function mountGroupCoin(app, el, ctx) {
  const currencies = getCurrenciesEffective();
  // Placeholder: Simple static message and upcoming UI hook points.
  const html = await renderTemplate("modules/fvtt-treasury/scripts/handlebars/tabs/group-coin.hbs", {
    currencies
  });
  el.innerHTML = html;

  // Example future handler (save coin split, etc.)
  // el.querySelector('[data-action="save"]')?.addEventListener("click", async () => {...});
}
