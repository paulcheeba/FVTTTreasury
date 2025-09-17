# FVTTTreasury (v13.0.0.1)

System-agnostic party treasury for Foundry VTT v13+. Features:

- AppV2 UI with tabs (Ledger / Items / Actors / Checklist / Settings)
- GM + Treasurer permissions
- Drag items from compendiums or the Items sidebar — we store their UUID link like journals do
- Read-only verification that an actor owns a linked item via `flags.core.sourceId` match
- Live verify on open, auto-refresh every 10s
- JSON export/import to migrate between worlds
- Themeable CSS (plain, 5e, cyberpunk)

> Requires Foundry VTT v13+.

## Install

Copy this folder to your Foundry `Data/modules` directory or install via manifest URL. Enable the module in your world.

## Usage

- Scene Toolbar → Token controls → **coin** tool to open FVTTTreasury.
- GM can assign *Treasurers* in Settings and lock down who may edit.
- Drag items into the **Items** tab from compendium or Items sidebar.
- Use **Export JSON** / **Import JSON** in Settings to migrate between worlds.

## Notes

- Item verification is system-agnostic and relies on `flags.core.sourceId` on actor items.
- Time provider is pluggable (Simple Calendar / About Time Next stubs); timestamps can be edited by the treasurer.

## License

MIT
