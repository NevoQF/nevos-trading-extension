<p align="center">
  <img src="extension/assets/icons/logo128.png" width="92" alt="nevos trading extension logo">
</p>

<h1 align="center">nevos trading extension</h1>

<p align="center">
  Readable source for the Roblox trading browser extension.
</p>

<p align="center">
  <a href="https://nevos-extension.com">Website</a> -
  <a href="https://www.youtube.com/watch?v=_KB9yUQk95I">YouTube</a> -
  <a href="https://discord.gg/tHReJPn2q5">Discord</a>
</p>

<p align="center">
  <a href="https://discord.gg/tHReJPn2q5">
    <img alt="Discord online" src="https://img.shields.io/badge/dynamic/json?style=for-the-badge&logo=discord&label=Discord&color=5865F2&query=$.approximate_presence_count&suffix=%20online&url=https%3A%2F%2Fdiscord.com%2Fapi%2Fv10%2Finvites%2FtHReJPn2q5%3Fwith_counts%3Dtrue">
  </a>
  <a href="https://discord.gg/tHReJPn2q5">
    <img alt="Discord members" src="https://img.shields.io/badge/dynamic/json?style=for-the-badge&logo=discord&label=Members&color=2f3136&query=$.approximate_member_count&suffix=%20total&url=https%3A%2F%2Fdiscord.com%2Fapi%2Fv10%2Finvites%2FtHReJPn2q5%3Fwith_counts%3Dtrue">
  </a>
</p>

Release builds stay minified. This repo keeps the readable source, manifests, and assets.

## What It Is

nevos trading extension is a Roblox trading extension for Chrome, Brave, Edge, Opera, Firefox, and Safari. It adds trading tools directly into Roblox pages so traders can check values, inspect trades, search faster, flag risky items, generate proofs, and generally just makes trading easier.

## Clone

```powershell
git clone https://github.com/NevoQF/nevos-trading-extension.git
cd nevos-trading-extension
```

## Features

### Values

- Rolimons values on trade windows, trade lists, catalog pages, and user pages.
- Optional Routility USD values.
- Profile inventory pill with a RAP or Value display toggle.
- Profile inventory overview with total value, total RAP, item count, item flags, demand, serials, and search/sort controls.
- Improved profile inventory loading so temporary Roblox fetch failures are not shown as private inventories.
- Post-tax trade value and Robux tax difference helpers.
- Sale data button on trade items.
- RAP raise/drop indicators for items sitting over or under nearby value tiers.

### Trade Pages

- Trade win/loss stats with value and RAP deltas.
- Trade list values and color indicators.
- Trade list filters for all trades, overpay, equal, underpay, upgrade, downgrade, Robux, and item search.
- Hide-others button that focuses the selected trade while keeping the rest of the trade list available again with one click.
- Quick decline button on trade rows.
- Trade window item search.
- Duplicate trade warning.
- Counter trade prompt.
- Mobile trade items button.

### Trade Review

- Analyze Trade button for deeper trade review.
- Quick Proof button for completed trades. (couldn't figure out how to get an image on firefox)
- Proof preview popup with image and text copy actions.
- Proof text includes biggest item names, values, sender, receiver, completion date, and item acronyms when available.

### Notifications

- Inbound trade notifications.
- Declined trade notifications.
- Completed trade notifications.

### Items And Profiles

- Rare item flags.
- Projected item flags.
- Item profile links.
- Item ownership history links.
- User profile links.
- User badge display.
- Quick item search from the Roblox navbar.

### Extra Tools

- Colorblind mode.
- Optional Roblox 2FA autofill with password-protected encrypted storage.
- Option to disable RAP in win/loss stats.
- Extension-originated Roblox requests are marked with `NTERequest=1` for easier network debugging.
- Direct manual install builds for supported browsers.
- Settings stored locally through browser storage.

## Demos

<table>
  <tr>
    <td align="center">
      <a href="docs/media/trade-review-tools.mp4">
        <img src="docs/media/trade-review-tools.gif" width="260" alt="Trade review and filters demo">
      </a>
      <br>
      Trade review and filters
    </td>
    <td align="center">
      <a href="docs/media/inventory-overview.mp4">
        <img src="docs/media/inventory-overview.gif" width="260" alt="Inventory values and item flags demo">
      </a>
      <br>
      Inventory values and flags
    </td>
    <td align="center">
      <a href="docs/media/trade-window-search.mp4">
        <img src="docs/media/trade-window-search.gif" width="260" alt="Trade window search demo">
      </a>
      <br>
      Trade window search
    </td>
  </tr>
</table>

## YouTube Demo

GitHub README pages do not play YouTube embeds inline. Use the thumbnail link.

[![YouTube demo](https://img.youtube.com/vi/_KB9yUQk95I/hqdefault.jpg)](https://www.youtube.com/watch?v=_KB9yUQk95I)

## Source

The readable extension source is in `extension/`. Internal release packaging tools are intentionally excluded from this public source repo.

## Layout

```text
extension/            extension source
docs/media/           demo previews and videos
```

## License

Source is shared for review and verification only. Official builds are free for personal use. Reuploading, rebranding, reselling, or claiming authorship is not allowed. See `LICENSE`.

## Star

If this source helps you verify the extension or you like the project, a star on the repo helps.
