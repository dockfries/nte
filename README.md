# Nexor's TextDraw Editor

This repository ports the [nexquery/samp-textdraw-editor](https://github.com/nexquery/samp-textdraw-editor), written using [infernus-starter](https://github.com/dockfries/infernus-starter).

## Get Started

```sh
# if you are using the x86 version of samp-node
export npm_config_arch=ia32
export npm_config_target_arch=ia32

# powershell env
# $env:npm_config_arch="ia32";
# $env:npm_config_target_arch="ia32";

# cmd env
# set npm_config_arch=ia32
# set npm_config_target_arch=ia32

pnpm dlx @infernus/create-app@latest install

pnpm install --dev # ensure node-gyp install first

pnpm install

pnpm build
pnpm serve
```

> **Note:** Uses 0.3DL-only assets — see [0.3DL Required](#-03dl-required) below.

---

## ⚠️ 0.3DL Required

This editor uses `mdl-2000` sprite textures for its HUD toolbar and sprite browser, loaded via `AddSimpleModel(-1, 19379, -2000, "tde.dff", "tde.txd")`. These custom textures are streamed from the server automatically.

**Clients must connect using SA:MP 0.3.DL** (or an open.mp launcher that supports 0.3DL assets). Regular 0.3.7 clients will see missing / invisible HUD sprites because they cannot download custom `.txd` / `.dff` files.

> Why 0.3DL only? The original PAWN version required players to manually copy `NexTDE.txd` and `NexTDE.dff` into their GTA `models/` folder — a tedious setup step. By switching to 0.3DL's server-side asset streaming, the editor **works out of the box** with zero client-side file copying.

---

## 📦 Database Compatibility

| Format                   | Compatible?             | Notes                                                                                                                                                                                                    |
| ------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.db` (SQLite)           | ❌ **Not compatible**   | The PAWN version used SQLite via `db_open` / `db_query`. This TypeScript port also uses SQLite (`better-sqlite3`), but the schema and data layout differ. Old `.db` files **cannot** be opened directly. |
| `.txt` (Import / Export) | ✅ **Fully compatible** | Both versions use the same PAWN `TextDrawCreate(...)` / `CreatePlayerTextDraw(...)` text format for import and export.                                                                                   |

### Migration from the PAWN version

1. Open your old project in the **original PAWN gamemode** and use the **Export** function to save a `.txt` file.
2. Start a **new project** in this TypeScript editor.
3. Use the **Import** menu to load the `.txt` file.

All textdraw properties (position, size, font, color, preview models, etc.) are preserved.

---

## License

[MIT](./LICENSE) License © 2026-PRESENT Carl You
