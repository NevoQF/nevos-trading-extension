# Privacy Policy

Last updated: Nov 13, 2026

The extension is designed to run in the browser and keep ordinary settings and feature state in local browser extension storage.

## Data stored locally

The extension uses local browser extension storage for settings, feature preferences, cached item data, UI state, notification settings, and optional 2FA autofill data.

## Optional 2FA autofill

If you choose to save a 2FA secret, it is stored in your browser extension storage. When the password lock option is used, the secret is encrypted with a password-derived key before storage. The password itself is not stored.

## Remote requests

The extension contacts Roblox, Rolimons, Routility, and nevos-extension.com APIs over HTTPS to provide item values, trade analysis, item proof lookup, trade history features, update checks, and related extension functionality.

## Trade history and analysis

If trade history or trade analysis features are used, trade-related data may be sent to nevos-extension.com endpoints so the feature can evaluate or store trade information. These requests are used to provide the requested extension features.

## Problem reports

The popup's "Report a problem" sends a report only when you press Send. It contains what you typed plus the parts you leave ticked:

- **Diagnostics:** Extension version, browser, settings you changed, and the Extension's last errors and failed requests, each with the kind of page it happened on. Addresses are cut to host and path, with names and long IDs removed.
- **Screenshot:** the current tab, offered only on Roblox and Rolimons tabs.
- **Page details:** page address and title, window size.

The popup shows exactly what will be sent first. Diagnostics never include passwords, cookies or 2FA codes. A screenshot shows whatever is on screen, so the popup unticks it when a 2FA code box or account settings may be visible.

Until you send a report, the Extension keeps its last errors and failed requests in browser session storage, which the browser clears when it closes.

A sent report is stored on nevos-extension.com and posted to a private staff channel on our Discord server. Both copies are deleted after 30 days. Your IP address only limits spam and is not stored with the report.

The LITE build never sends reports; it only copies them for you to paste.

## No sale of user data

We do not sell user data. We do not use extension data for advertising or unrelated profiling.

## Cookies

The extension manifest does not request cookie permissions. The website may be served as a static site and does not require cookies for the extension download pages.

## Permissions

The extension requests permissions needed for its features, including storage, alarms, notifications, and access to the supported Roblox and trading-data domains declared in the extension manifest.

## Contact

For privacy questions, support, or removal requests, contact us through the official Discord linked on the website.
