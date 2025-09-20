# FVTTTreasury (v13.0.0.12)

System-agnostic party treasury for Foundry VTT v13+. Features:

- AppV2 UI with tabs (Ledger / Items / Actors / Checklist / Settings)
- GM + Treasurer permissions
- Drag items from compendiums or the Items sidebar — we store their UUID link like journals do
- Read-only verification that an actor owns a linked item via `_stats.compendiumSource` (fallback to `flags.core.sourceId` without deprecation warnings)
- Live verify on open, auto-refresh (default 10s) — full-window refresh that preserves the active tab
- JSON export/import to migrate between worlds
- Themeable CSS (plain, 5e, cyberpunk)

> Requires Foundry VTT **v13+**.

## Install

Copy this folder to your Foundry `Data/modules` directory or install via manifest URL. Enable the module in your world.

## Usage

- Run the macro (see below) or from console: `game.fvttTreasury.open()`.
- GM can assign *Treasurers* (to be added as a UI picker; use console or settings edit for now).
- Drag items into the **Items** tab from a compendium or the Items sidebar.
- Use **Export JSON** / **Import JSON** in Settings to migrate between worlds.

## Macro

```js
// Open FVTTTreasury app
const MODULE_ID = "fvtt-treasury";
if (!game.modules.get(MODULE_ID)?.active) return ui.notifications.error("FVTTTreasury is not enabled.");
if (game.fvttTreasury?.open) game.fvttTreasury.open();
else ui.notifications.error("FVTTTreasury app not found. Make sure the module is up to date.");
