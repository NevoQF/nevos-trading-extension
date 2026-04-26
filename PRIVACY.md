# Privacy

The extension runs in the browser and uses local browser extension storage for settings and feature state.

The active manifests request:

- `storage`
- `alarms`
- `notifications`

The manifests do not request `cookies`.

Stored data may include settings, cached item data, UI state, and optional 2FA autofill data.

When the optional 2FA secret lock is used, the secret is encrypted with a password-derived key before storage. The password is not stored.
