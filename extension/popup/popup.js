if (
  "undefined" === typeof globalThis.chrome &&
  "undefined" !== typeof globalThis.browser
) {
  globalThis.chrome = globalThis.browser;
}

function get_asset_url(path) {
  return chrome.runtime.getURL(path);
}

const section_classes = {
  Values: "section-values",
  Trading: "section-trading",
  "Trade Notifications": "section-notifications",
  "Item Flags": "section-flags",
  Links: "section-links",
  Other: "section-other",
};

const chevron_svg =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

const option_groups = nte_filter_option_groups(
  JSON.parse(
    '["Values",{"name":"Values on Trading Window","enabledByDefault":true,"path":"values-on-trading-window"},{"name":"Values on Trade Lists","enabledByDefault":true,"path":"values-on-trade-lists"},{"name":"Values on Catalog Pages","enabledByDefault":true,"path":"values-on-catalog-pages"},{"name":"Values on User Pages","enabledByDefault":true,"path":"values-on-user-pages"},{"name":"Show Routility USD Values","enabledByDefault":false,"path":"show-usd-values"},"Trading",{"name":"Trade Win/Loss Stats","enabledByDefault":true,"path":"trade-win-loss-stats"},{"name":"Colorblind Mode","enabledByDefault":false,"path":"colorblind-profit-mode"},{"name":"Trade Window Search","enabledByDefault":true,"path":"trade-window-search"},{"name":"Duplicate Trade Warning","enabledByDefault":true,"path":"duplicate-trade-warning"},{"name":"Miss Send Warning","enabledByDefault":true,"path":"miss-send-warning"},{"name":"Show Quick Decline Button","enabledByDefault":true,"path":"show-quick-decline-button"},{"name":"Analyze Trade","enabledByDefault":true,"path":"analyze-trade"},{"name":"Counter Trade Choices","enabledByDefault":true,"path":"counter-trade-choices"},{"name":"Quick Proof","enabledByDefault":true,"path":"quick-proof"},{"name":"Reseller Trade Button","enabledByDefault":true,"path":"reseller-trade-button"},{"name":"Roblox New UI Compatible","enabledByDefault":true,"path":"roblox-new-ui-compatible"},"Trade Notifications",{"name":"Inbound Trade Notifications","enabledByDefault":false,"path":"inbound-trade-notifications"},{"name":"Declined Trade Notifications","enabledByDefault":false,"path":"declined-trade-notifications"},{"name":"Completed Trade Notifications","enabledByDefault":false,"path":"completed-trade-notifications"},"Item Flags",{"name":"Flag Rare Items","enabledByDefault":true,"path":"flag-rare-items"},{"name":"Flag Projected Items","enabledByDefault":true,"path":"flag-projected-items"},"Links",{"name":"Add Item Profile Links","enabledByDefault":true,"path":"add-item-profile-links"},{"name":"Add Item Ownership Buttons","enabledByDefault":true,"path":"add-uaid-links"},{"name":"Add User Profile Links","enabledByDefault":true,"path":"add-user-profile-links"},"Other",{"name":"Post-Tax Trade Values","enabledByDefault":true,"path":"post-tax-trade-values"},{"name":"Mobile Trade Items Button","enabledByDefault":true,"path":"mobile-trade-items-button"},{"name":"Disable Win/Loss Stats RAP","enabledByDefault":false,"path":"disable-win-loss-stats-rap"},{"name":"Quick Item Search","enabledByDefault":true,"path":"quick-item-search"},{"name":"Quick User Search","enabledByDefault":true,"path":"quick-user-search"},{"name":"Fix Rolimons Pages","enabledByDefault":true,"path":"fix-rolimons-pages"}]',
  ),
);

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".tab")
      .forEach((item) => item.classList.remove("active"));
    document
      .querySelectorAll(".panel")
      .forEach((panel) => panel.classList.add("hidden"));
    tab.classList.add("active");
    document
      .getElementById(`panel-${tab.dataset.tab}`)
      .classList.remove("hidden");
    if (tab.dataset.tab === "tradeactions") {
      render_actions_tab();
    }
    if (tab.dataset.tab === "tradeads") {
      render_trade_ads_tab();
    }
  });
});

function format_number(value) {
  return Number(value || 0).toLocaleString();
}

function format_relative_time(timestamp_ms) {
  if (!timestamp_ms) return "Never";
  let diff = Date.now() - Number(timestamp_ms);
  if (diff < 0) diff = 0;
  let seconds = Math.floor(diff / 1000);
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  let minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  let hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  let days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escape_html(value) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };
  return String(value).replace(/[&<>"'/]/g, (match) => map[match]);
}

function get_option_names() {
  return option_groups
    .filter((entry) => typeof entry !== "string")
    .map((entry) => entry.name);
}

function get_storage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) console.info(chrome.runtime.lastError);
      resolve(result || {});
    });
  });
}

function set_storage(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) console.info(chrome.runtime.lastError);
      resolve();
    });
  });
}

function set_option_value(name, value) {
  return set_storage({ [name]: value });
}

function normalize_profile_value_display_mode(value) {
  return String(value || "").toLowerCase() === "value" ? "value" : "rap";
}

function normalize_ownership_link_provider(value) {
  return String(value || "").toLowerCase() === "routility"
    ? "routility"
    : "rolimons";
}

function normalize_counter_trade_choice_mode(value) {
  return String(value || "").toLowerCase() === "buttons" ? "buttons" : "prompt";
}

const nte_roblox_tab_url_query_patterns = [
  "https://www.roblox.com/*",
  "https://roblox.com/*",
];
const extension_update_state_key = "nte_extension_update_state";
const extension_update_last_check_key = "nte_extension_update_last_check";
const extension_update_check_cooldown_ms = 4 * 60 * 60 * 1000;
const chrome_web_store_item_url =
  "https://chromewebstore.google.com/detail/nevos-trading-extension/afenbjoagijnedghjbidpbkhdmbobaid/reviews";
const firefox_addons_item_url =
  "https://addons.mozilla.org/firefox/addon/nevos-trading-extension/";
const popup_theme_storage_key = "popup_theme";
const popup_theme_default = "modern";
const trade_page_theme_enabled_key = "trade_page_theme_enabled";
const trade_page_theme_key = "trade_page_theme";
const trade_page_custom_themes_key = "trade_page_custom_themes";
const trade_page_theme_default_image_overlay = 72;
const inbound_trade_notification_min_gain_key =
  "inbound_trade_notification_min_gain_percent";
const inbound_trade_notification_min_gain_default = 0;
const inbound_trade_notification_webhook_enabled_key =
  "inbound_trade_notification_webhook_enabled";
const inbound_trade_notification_webhook_url_key =
  "inbound_trade_notification_webhook_url";
const inbound_trade_notification_webhook_ping_enabled_key =
  "inbound_trade_notification_webhook_ping_enabled";
const inbound_trade_notification_webhook_discord_id_key =
  "inbound_trade_notification_webhook_discord_id";
const duplicate_trade_warning_hours_key = "duplicate_trade_warning_hours";
const duplicate_trade_warning_hours_default = 24;
const profile_value_display_mode_key = "profile_value_display_mode";
const profile_value_display_mode_default = "rap";
const ownership_link_provider_key = "ownership_link_provider";
const ownership_link_provider_default = "rolimons";
const counter_trade_choices_option_name = "Counter Trade Choices";
const legacy_counter_trade_prompt_option_name = "Counter Trade Prompt";
const counter_trade_choice_mode_key = "counter_trade_choice_mode";
const counter_trade_choice_mode_default = "prompt";
const colorblind_mode_option_name = "Colorblind Mode";
const legacy_colorblind_mode_option_name = "Colorblind Profit Mode";
const post_tax_trade_values_option_name = "Post-Tax Trade Values";
const legacy_post_tax_trade_value_option_name = "Post-Tax Trade Value";
const colorblind_mode_profile_key = "colorblind_mode_profile";
const colorblind_mode_profile_default = "deuteranopia";
const colorblind_mode_profiles = [
  {
    value: "deuteranopia",
    label: "Deuteranopia",
    hint: "Blue + amber",
    swatches: ["#60a5fa", "#2563eb", "#f59e0b"],
  },
  {
    value: "protanopia",
    label: "Protanopia",
    hint: "Teal + rose",
    swatches: ["#2dd4bf", "#0f766e", "#f472b6"],
  },
  {
    value: "tritanopia",
    label: "Tritanopia",
    hint: "Green + violet",
    swatches: ["#4ade80", "#16a34a", "#a855f7"],
  },
  {
    value: "achromatopsia",
    label: "Achromatopsia",
    hint: "High contrast",
    swatches: ["#ffffff", "#111827", "#6b7280"],
  },
];

const trade_page_theme_presets = {
  obsidian: {
    name: "Obsidian",
    background: "#0f1117",
    accent: "#6ea8fe",
    accent2: "#a78bfa",
    effect: "nebula",
  },
  aurora: {
    name: "Aurora",
    background: "#071a18",
    accent: "#2dd4bf",
    accent2: "#a78bfa",
    effect: "aurora",
  },
  frostbyte: {
    name: "Frostbyte",
    background: "#071827",
    accent: "#67e8f9",
    accent2: "#e0f2fe",
    effect: "frost",
  },
  sakura: {
    name: "Sakura",
    background: "#211019",
    accent: "#fb7185",
    accent2: "#f9a8d4",
    effect: "petals",
  },
  circuit: {
    name: "Circuit",
    background: "#07130f",
    accent: "#22c55e",
    accent2: "#38bdf8",
    effect: "circuit",
  },
  royalty: {
    name: "Royalty",
    background: "#160f2e",
    accent: "#c084fc",
    accent2: "#facc15",
    effect: "royal",
  },
  graphite: {
    name: "Graphite",
    background: "#171717",
    accent: "#d4d4d4",
    accent2: "#8b949e",
    effect: "sheen",
  },
  storm: {
    name: "Storm",
    background: "#0a1020",
    accent: "#38bdf8",
    accent2: "#facc15",
    effect: "lightning",
  },
  solar: {
    name: "Solar",
    background: "#281a0a",
    accent: "#f59e0b",
    accent2: "#fef3c7",
    effect: "ember",
  },
  meadow: {
    name: "Meadow",
    background: "#0f2618",
    accent: "#34d399",
    accent2: "#a7f3d0",
    effect: "aurora",
  },
  glacier: {
    name: "Glacier",
    background: "#0a1a2e",
    accent: "#7dd3fc",
    accent2: "#f0f9ff",
    effect: "frost",
  },
  neon: {
    name: "Neon",
    background: "#1a0a1f",
    accent: "#e879f9",
    accent2: "#22d3ee",
    effect: "circuit",
  },
  void: {
    name: "Void",
    background: "#08080f",
    accent: "#8b5cf6",
    accent2: "#4f46e5",
    effect: "nebula",
  },
  volcano: {
    name: "Volcano",
    background: "#1f0a0a",
    accent: "#dc2626",
    accent2: "#fb923c",
    effect: "ember",
  },
  tide: {
    name: "Tide",
    background: "#0a1f2e",
    accent: "#0ea5e9",
    accent2: "#2dd4bf",
    effect: "nebula",
  },
};
const trade_page_theme_default = trade_page_theme_presets.obsidian;
const trade_page_theme_effects = new Set([
  "nebula",
  "lightning",
  "aurora",
  "ember",
  "frost",
  "petals",
  "circuit",
  "royal",
  "sheen",
  "image",
]);

function normalize_hex_color(value, fallback) {
  let color = String(value || "").trim();
  if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(color)) color = `#${color}`;
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    color = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

function is_complete_hex_color(value) {
  return /^#?[0-9a-f]{3}$|^#?[0-9a-f]{6}$/i.test(String(value || "").trim());
}

function normalize_trade_page_effect(value) {
  let effect = String(value || "")
    .trim()
    .toLowerCase();
  return trade_page_theme_effects.has(effect)
    ? effect
    : trade_page_theme_default.effect;
}

function normalize_theme_image(value) {
  let image = String(value || "").trim();
  return /^data:image\/(?:png|jpe?g|webp);base64,/i.test(image) ? image : "";
}

function normalize_image_overlay(value) {
  let amount = Number(value);
  return Number.isFinite(amount)
    ? Math.max(0, Math.min(90, Math.round(amount)))
    : trade_page_theme_default_image_overlay;
}

function hex_to_rgba(hex, alpha) {
  let color = normalize_hex_color(hex, "#000000").slice(1);
  let r = parseInt(color.slice(0, 2), 16);
  let g = parseInt(color.slice(2, 4), 16);
  let b = parseInt(color.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hex_to_rgb_tuple(hex) {
  let color = normalize_hex_color(hex, "#000000").slice(1);
  return [
    parseInt(color.slice(0, 2), 16),
    parseInt(color.slice(2, 4), 16),
    parseInt(color.slice(4, 6), 16),
  ];
}

function rgb_tuple_to_hex(parts) {
  return `#${parts
    .map((part) =>
      Math.max(0, Math.min(255, Math.round(part)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function mix_hex_color(from, to, weight) {
  let a = hex_to_rgb_tuple(from);
  let b = hex_to_rgb_tuple(to);
  return rgb_tuple_to_hex(
    a.map((part, index) => part + (b[index] - part) * weight),
  );
}

function get_color_luma(hex) {
  let [r, g, b] = hex_to_rgb_tuple(hex).map((part) => {
    let channel = part / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function build_trade_page_theme(source) {
  let background = normalize_hex_color(
    source.background,
    trade_page_theme_default.background,
  );
  let accent = normalize_hex_color(
    source.accent,
    trade_page_theme_default.accent,
  );
  let accent2 = normalize_hex_color(
    source.accent2,
    mix_hex_color(accent, background, 0.35),
  );
  let image = normalize_theme_image(source.image);
  let effect = image ? "image" : normalize_trade_page_effect(source.effect);
  let is_dark = get_color_luma(background) < 0.45;
  let shade = is_dark ? "#ffffff" : "#000000";
  let text = is_dark ? "#f8fafc" : "#111827";
  return {
    name:
      String(source.name || trade_page_theme_default.name)
        .trim()
        .slice(0, 32) || trade_page_theme_default.name,
    background,
    surface: mix_hex_color(background, shade, is_dark ? 0.08 : 0.035),
    surface2: mix_hex_color(background, shade, is_dark ? 0.14 : 0.07),
    text,
    muted: mix_hex_color(text, background, is_dark ? 0.42 : 0.48),
    accent,
    accent2,
    border: mix_hex_color(background, shade, is_dark ? 0.22 : 0.14),
    effect,
    image,
    image_overlay: image
      ? normalize_image_overlay(source.image_overlay)
      : trade_page_theme_default_image_overlay,
  };
}

function normalize_trade_page_theme(value) {
  let source = value && typeof value === "object" ? value : {};
  return build_trade_page_theme(source);
}

function pack_trade_page_theme(value) {
  let theme = normalize_trade_page_theme(value);
  return {
    name: theme.name,
    background: theme.background,
    accent: theme.accent,
    accent2: theme.accent2,
    effect: theme.effect,
    ...(theme.image ? { image: theme.image } : {}),
    ...(theme.image ? { image_overlay: theme.image_overlay } : {}),
  };
}

function normalize_custom_trade_page_themes(value) {
  return (Array.isArray(value) ? value : [])
    .map((theme) => pack_trade_page_theme(theme))
    .filter((theme) => theme.name && (theme.effect !== "image" || theme.image))
    .slice(0, 16);
}

function normalize_colorblind_mode_profile(value) {
  let normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (colorblind_mode_profiles.some((profile) => profile.value === normalized))
    return normalized;
  return colorblind_mode_profile_default;
}

function get_saved_colorblind_mode_value(saved) {
  if (saved[colorblind_mode_option_name] !== undefined)
    return !!saved[colorblind_mode_option_name];
  if (saved[legacy_colorblind_mode_option_name] !== undefined)
    return !!saved[legacy_colorblind_mode_option_name];
  return false;
}

async function ensure_colorblind_mode_settings(saved = null) {
  let snapshot =
    saved ||
    (await get_storage([
      colorblind_mode_option_name,
      legacy_colorblind_mode_option_name,
      colorblind_mode_profile_key,
    ]));

  let enabled = get_saved_colorblind_mode_value(snapshot);
  let profile = normalize_colorblind_mode_profile(
    snapshot[colorblind_mode_profile_key],
  );
  let updates = {};

  if (snapshot[colorblind_mode_option_name] !== enabled)
    updates[colorblind_mode_option_name] = enabled;
  if (snapshot[legacy_colorblind_mode_option_name] !== enabled)
    updates[legacy_colorblind_mode_option_name] = enabled;
  if (snapshot[colorblind_mode_profile_key] !== profile)
    updates[colorblind_mode_profile_key] = profile;

  if (Object.keys(updates).length) {
    await set_storage(updates);
    snapshot = { ...snapshot, ...updates };
  }

  return snapshot;
}

async function ensure_counter_trade_choices_settings(saved = null) {
  let snapshot =
    saved ||
    (await get_storage([
      counter_trade_choices_option_name,
      legacy_counter_trade_prompt_option_name,
      counter_trade_choice_mode_key,
      ownership_link_provider_key,
    ]));

  let updates = {};
  if (
    snapshot[counter_trade_choices_option_name] === undefined &&
    snapshot[legacy_counter_trade_prompt_option_name] !== undefined
  ) {
    updates[counter_trade_choices_option_name] =
      !!snapshot[legacy_counter_trade_prompt_option_name];
  }
  let mode = normalize_counter_trade_choice_mode(
    snapshot[counter_trade_choice_mode_key],
  );
  if (snapshot[counter_trade_choice_mode_key] !== mode)
    updates[counter_trade_choice_mode_key] = mode;
  let provider = normalize_ownership_link_provider(
    snapshot[ownership_link_provider_key],
  );
  if (snapshot[ownership_link_provider_key] !== provider)
    updates[ownership_link_provider_key] = provider;

  if (Object.keys(updates).length) {
    await set_storage(updates);
    snapshot = { ...snapshot, ...updates };
  }

  return snapshot;
}

function normalize_inbound_trade_notification_min_gain(value) {
  let parsed = Number(
    String(value ?? "")
      .replace(/%/g, "")
      .trim(),
  );
  if (!Number.isFinite(parsed))
    parsed = inbound_trade_notification_min_gain_default;
  parsed = Math.max(0, parsed);
  return Math.round(parsed * 100) / 100;
}

function format_inbound_trade_notification_min_gain(value) {
  let normalized = normalize_inbound_trade_notification_min_gain(value);
  return Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toFixed(2).replace(/\.?0+$/, "");
}

function get_inbound_trade_notification_note(value) {
  return "Click to open settings";
}

function normalize_duplicate_trade_warning_hours(value) {
  let parsed = Number(
    String(value ?? "")
      .replace(/h/gi, "")
      .trim(),
  );
  if (!Number.isFinite(parsed)) parsed = duplicate_trade_warning_hours_default;
  parsed = Math.round(parsed);
  return Math.max(1, Math.min(168, parsed));
}

function format_duplicate_trade_warning_hours(value) {
  let normalized = normalize_duplicate_trade_warning_hours(value);
  return normalized % 24 === 0 ? `${normalized / 24}d` : `${normalized}h`;
}

function get_duplicate_trade_warning_note(value) {
  return `Warn if already traded within: ${format_duplicate_trade_warning_hours(value)}. Click to edit.`;
}

async function prompt_inbound_trade_notification_min_gain() {
  let saved = await get_storage([
    inbound_trade_notification_min_gain_key,
    inbound_trade_notification_webhook_enabled_key,
    inbound_trade_notification_webhook_url_key,
    inbound_trade_notification_webhook_ping_enabled_key,
    inbound_trade_notification_webhook_discord_id_key,
  ]);
  let current = normalize_inbound_trade_notification_min_gain(
    saved[inbound_trade_notification_min_gain_key],
  );
  let webhook_enabled = !!saved[inbound_trade_notification_webhook_enabled_key];
  let webhook_url = normalize_inbound_trade_notification_webhook_url(
    saved[inbound_trade_notification_webhook_url_key],
  );
  let ping_enabled =
    !!saved[inbound_trade_notification_webhook_ping_enabled_key];
  let discord_id = normalize_inbound_trade_notification_discord_id(
    saved[inbound_trade_notification_webhook_discord_id_key],
  );

  let next = await open_inbound_trade_notification_settings_modal({
    min_gain: current,
    webhook_enabled,
    webhook_url,
    ping_enabled,
    discord_id,
  });
  if (!next) return current;

  await set_storage({
    [inbound_trade_notification_min_gain_key]: next.min_gain,
    [inbound_trade_notification_webhook_enabled_key]: next.webhook_enabled,
    [inbound_trade_notification_webhook_url_key]: next.webhook_url,
    [inbound_trade_notification_webhook_ping_enabled_key]: next.ping_enabled,
    [inbound_trade_notification_webhook_discord_id_key]: next.discord_id,
  });
  return next.min_gain;
}

function normalize_inbound_trade_notification_webhook_url(value) {
  let raw = String(value || "").trim();
  if (!raw) return "";
  try {
    let parsed = new URL(raw);
    let host = String(parsed.hostname || "").toLowerCase();
    let valid_host =
      host === "discord.com" ||
      host === "www.discord.com";
    if (!valid_host) return "";
    if (parsed.protocol !== "https:") return "";
    if (!String(parsed.pathname || "").startsWith("/api/webhooks/")) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function normalize_inbound_trade_notification_discord_id(value) {
  let normalized = String(value || "")
    .trim()
    .replace(/[<@!>\s]/g, "");
  return /^\d{5,30}$/.test(normalized) ? normalized : "";
}

function escape_html_attr(value) {
  return escape_html(value).replace(/"/g, "&quot;");
}

function open_inbound_trade_notification_settings_modal(current) {
  return new Promise((resolve) => {
    let existing = document.getElementById("inbound-notif-settings-overlay");
    if (existing) existing.remove();
    let lite = typeof nte_is_lite === "function" && nte_is_lite();

    let overlay = document.createElement("div");
    overlay.id = "inbound-notif-settings-overlay";
    overlay.className = "inbound-notif-settings-overlay";
    let webhook_block = lite
      ? `<div class="inbound-notif-settings-group inbound-notif-lite-note">
            <span class="inbound-notif-settings-label">Discord webhooks</span>
            <p class="inbound-notif-settings-subtitle">Not included in LITE. Browser notifications still work.</p>
          </div>`
      : `<div class="inbound-notif-settings-group">
            <label class="inbound-notif-switch-row">
              <span>Notify to a Discord webhook</span>
              <input id="inbound-notif-webhook-enabled" type="checkbox" ${current.webhook_enabled ? "checked" : ""} />
            </label>
            <input id="inbound-notif-webhook-url" class="inbound-notif-text-input" type="url" placeholder="https://discord.com/api/webhooks/..." value="${escape_html_attr(current.webhook_url)}" />

            <label class="inbound-notif-switch-row inbound-notif-switch-row-sub">
              <span>Ping the user</span>
              <input id="inbound-notif-ping-enabled" type="checkbox" ${current.ping_enabled ? "checked" : ""} />
            </label>
            <input id="inbound-notif-discord-id" class="inbound-notif-text-input" type="text" inputmode="numeric" placeholder="Discord user ID" value="${escape_html_attr(current.discord_id)}" />
          </div>`;
    overlay.innerHTML = `
      <div class="inbound-notif-settings-card" role="dialog" aria-modal="true" aria-labelledby="inbound-settings-title">
        <div class="inbound-notif-settings-head">
          <div>
            <h3 id="inbound-settings-title" class="inbound-notif-settings-title">Inbound Alert Settings</h3>
            <p class="inbound-notif-settings-subtitle">${lite ? "Choose your minimum gain for browser alerts." : "Choose your minimum gain and optional Discord alerts."}</p>
          </div>
          <button type="button" class="inbound-notif-settings-close" aria-label="Close settings">✕</button>
        </div>
        <div class="inbound-notif-settings-body">
          <div class="inbound-notif-settings-group">
            <span class="inbound-notif-settings-label">Minimum alert gain (%)</span>
            <div class="inbound-notif-pills">
              <button type="button" class="inbound-notif-pill" data-gain="0">Any</button>
              <button type="button" class="inbound-notif-pill" data-gain="1">+1%</button>
              <button type="button" class="inbound-notif-pill" data-gain="3">+3%</button>
              <button type="button" class="inbound-notif-pill" data-gain="5">+5%</button>
              <button type="button" class="inbound-notif-pill" data-gain="10">+10%</button>
            </div>
            <label class="inbound-notif-input-wrap">
              <span>Custom</span>
              <input id="inbound-notif-min-gain" type="number" min="0" max="9999" step="0.01" value="${escape_html_attr(format_inbound_trade_notification_min_gain(current.min_gain))}" />
            </label>
          </div>
          ${webhook_block}
        </div>
        <div class="inbound-notif-settings-actions">
          <button type="button" class="inbound-notif-btn inbound-notif-btn-cancel" data-role="cancel">Cancel</button>
          <button type="button" class="inbound-notif-btn inbound-notif-btn-save" data-role="save">Save</button>
          ${lite ? "" : `<button type="button" class="inbound-notif-btn inbound-notif-btn-test" data-role="test">
            <span class="inbound-notif-btn-test-icon" aria-hidden="true">▶</span>
            <span class="inbound-notif-btn-test-label" data-role="test-label">Test webhook</span>
          </button>`}
        </div>
      </div>
    `;
    document.body.append(overlay);

    let card = overlay.querySelector(".inbound-notif-settings-card");
    let close_btn = overlay.querySelector(".inbound-notif-settings-close");
    let cancel_btn = overlay.querySelector('[data-role="cancel"]');
    let save_btn = overlay.querySelector('[data-role="save"]');
    let test_btn = overlay.querySelector('[data-role="test"]');
    let min_gain_input = overlay.querySelector("#inbound-notif-min-gain");
    let webhook_enabled_input = overlay.querySelector(
      "#inbound-notif-webhook-enabled",
    );
    let webhook_url_input = overlay.querySelector("#inbound-notif-webhook-url");
    let ping_enabled_input = overlay.querySelector(
      "#inbound-notif-ping-enabled",
    );
    let discord_id_input = overlay.querySelector("#inbound-notif-discord-id");
    let gain_pills = Array.from(
      overlay.querySelectorAll(".inbound-notif-pill"),
    );

    function close(result = null) {
      overlay.remove();
      resolve(result);
    }

    function sync_webhook_fields() {
      if (!webhook_enabled_input || !webhook_url_input || !ping_enabled_input || !discord_id_input)
        return;
      let webhook_enabled = !!webhook_enabled_input.checked;
      let ping_enabled = webhook_enabled && !!ping_enabled_input.checked;
      webhook_url_input.disabled = !webhook_enabled;
      ping_enabled_input.disabled = !webhook_enabled;
      discord_id_input.disabled = !ping_enabled;
      if (!webhook_enabled) {
        ping_enabled_input.checked = false;
      }
    }

    function normalize_min_gain_input() {
      let normalized = normalize_inbound_trade_notification_min_gain(
        min_gain_input.value,
      );
      min_gain_input.value =
        format_inbound_trade_notification_min_gain(normalized);
      return normalized;
    }

    function sync_pills() {
      let current_value = normalize_inbound_trade_notification_min_gain(
        min_gain_input.value,
      );
      gain_pills.forEach((pill) => {
        let gain = normalize_inbound_trade_notification_min_gain(
          pill.getAttribute("data-gain"),
        );
        pill.classList.toggle("is-active", gain === current_value);
      });
    }

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(null);
    });
    card.addEventListener("click", (event) => event.stopPropagation());
    close_btn.addEventListener("click", () => close(null));
    cancel_btn.addEventListener("click", () => close(null));

    gain_pills.forEach((pill) => {
      pill.addEventListener("click", () => {
        let gain = normalize_inbound_trade_notification_min_gain(
          pill.getAttribute("data-gain"),
        );
        min_gain_input.value = format_inbound_trade_notification_min_gain(gain);
        sync_pills();
      });
    });

    min_gain_input.addEventListener("input", () => {
      sync_pills();
    });
    min_gain_input.addEventListener("blur", () => {
      normalize_min_gain_input();
      sync_pills();
    });

    if (webhook_enabled_input)
      webhook_enabled_input.addEventListener("change", sync_webhook_fields);
    if (ping_enabled_input)
      ping_enabled_input.addEventListener("change", sync_webhook_fields);

    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(null);
      }
    });

    save_btn.addEventListener("click", () => {
      let min_gain = normalize_min_gain_input();
      if (lite) {
        close({
          min_gain,
          webhook_enabled: false,
          webhook_url: "",
          ping_enabled: false,
          discord_id: "",
        });
        return;
      }
      let webhook_enabled = !!webhook_enabled_input.checked;
      let webhook_url = normalize_inbound_trade_notification_webhook_url(
        webhook_url_input.value,
      );
      let ping_enabled = webhook_enabled && !!ping_enabled_input.checked;
      let discord_id = normalize_inbound_trade_notification_discord_id(
        discord_id_input.value,
      );

      if (webhook_enabled && !webhook_url) {
        window.alert("Enter a valid Discord webhook URL.");
        webhook_url_input.focus();
        return;
      }
      if (ping_enabled && !discord_id) {
        window.alert("Enter a valid Discord user ID.");
        discord_id_input.focus();
        return;
      }

      close({
        min_gain,
        webhook_enabled,
        webhook_url,
        ping_enabled,
        discord_id,
      });
    });

    if (test_btn) {
      let test_btn_label = test_btn.querySelector('[data-role="test-label"]');
      let test_btn_icon = test_btn.querySelector(".inbound-notif-btn-test-icon");
      function set_test_btn_state(label, show_icon = false) {
        if (test_btn_label) test_btn_label.textContent = label;
        if (test_btn_icon) test_btn_icon.hidden = !show_icon;
      }

      test_btn.addEventListener("click", async () => {
        let webhook_url = normalize_inbound_trade_notification_webhook_url(
          webhook_url_input.value,
        );
        if (!webhook_url) {
          window.alert("Enter a Discord webhook URL first.");
          webhook_url_input.focus();
          return;
        }
        let webhook_enabled = !!webhook_enabled_input.checked;
        let ping_enabled = webhook_enabled && !!ping_enabled_input.checked;
        let discord_id = normalize_inbound_trade_notification_discord_id(
          discord_id_input.value,
        );
        if (ping_enabled && !discord_id) {
          window.alert("Enter a valid Discord user ID to test a ping.");
          discord_id_input.focus();
          return;
        }

        test_btn.disabled = true;
        set_test_btn_state("Sending…");
        try {
          let result = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: "send_test_webhook",
                webhook_url,
                ping_enabled,
                discord_id,
              },
              resolve,
            );
          });
          set_test_btn_state(result?.ok ? "Sent!" : "Failed");
          test_btn.style.color = result?.ok ? "#22c55e" : "#ef4444";
          if (!result?.ok && result?.error) window.alert(result.error);
        } catch {
          set_test_btn_state("Error");
          test_btn.style.color = "#ef4444";
        } finally {
          setTimeout(() => {
            test_btn.disabled = false;
            set_test_btn_state("Test webhook", true);
            test_btn.style.color = "";
          }, 3000);
        }
      });
    }

    sync_webhook_fields();
    sync_pills();
    setTimeout(() => min_gain_input.focus(), 0);
  });
}

async function prompt_duplicate_trade_warning_hours() {
  let saved = await get_storage([duplicate_trade_warning_hours_key]);
  let current = normalize_duplicate_trade_warning_hours(
    saved[duplicate_trade_warning_hours_key],
  );

  while (true) {
    let response = window.prompt(
      "Warn if you already sent this person a trade within how many hours?\nExamples: 1, 12, 24, 72",
      String(current),
    );

    if (response === null) return current;

    let trimmed = String(response || "").trim();
    if (!trimmed) {
      current = duplicate_trade_warning_hours_default;
      break;
    }

    let parsed = Number(trimmed.replace(/h/gi, ""));
    if (!Number.isFinite(parsed) || parsed < 1) {
      window.alert("Enter a whole number of hours like 1, 12, 24, or 72.");
      continue;
    }

    current = normalize_duplicate_trade_warning_hours(parsed);
    break;
  }

  await set_storage({ [duplicate_trade_warning_hours_key]: current });
  return current;
}

function normalize_popup_theme(value) {
  return String(value || "")
    .trim()
    .toLowerCase() === "retro"
    ? "retro"
    : popup_theme_default;
}

function apply_popup_theme(theme) {
  let normalized = normalize_popup_theme(theme);
  document.body.classList.toggle("theme-retro", normalized === "retro");
  document.querySelectorAll(".about-style-btn").forEach((btn) => {
    btn.classList.toggle(
      "active",
      String(btn.getAttribute("data-popup-theme") || "").trim() === normalized,
    );
  });
  return normalized;
}

async function init_popup_theme_switcher() {
  let buttons = Array.from(document.querySelectorAll(".about-style-btn"));
  if (!buttons.length) return;
  apply_popup_theme(popup_theme_default);
  let saved = await get_storage([popup_theme_storage_key]);
  apply_popup_theme(saved[popup_theme_storage_key]);
  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      let next_theme = normalize_popup_theme(
        btn.getAttribute("data-popup-theme"),
      );
      apply_popup_theme(next_theme);
      await set_storage({ [popup_theme_storage_key]: next_theme });
    });
  });
}

function send_option_update(name) {
  chrome.tabs.query(
    { url: nte_roblox_tab_url_query_patterns },
    (tabs_result) => {
      tabs_result.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, name, {}, () => {
          chrome.runtime.lastError;
        });
      });
    },
  );
}

function send_colorblind_mode_update() {
  send_option_update(colorblind_mode_option_name);
  send_option_update(legacy_colorblind_mode_option_name);
  send_option_update(colorblind_mode_profile_key);
}

function compare_extension_versions(a, b) {
  let a_parts = String(a || "").split(".");
  let b_parts = String(b || "").split(".");
  let part_count = Math.max(a_parts.length, b_parts.length);

  for (let i = 0; i < part_count; i++) {
    let a_part = String(a_parts[i] ?? "");
    let b_part = String(b_parts[i] ?? "");
    let a_num = Number.parseInt(a_part, 10);
    let b_num = Number.parseInt(b_part, 10);
    let a_has_num = Number.isFinite(a_num);
    let b_has_num = Number.isFinite(b_num);

    if (a_has_num && b_has_num) {
      if (a_num !== b_num) return a_num - b_num;
      continue;
    }

    let cmp = a_part.localeCompare(b_part, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (cmp !== 0) return cmp;
  }

  return 0;
}

function normalize_extension_update_state(raw) {
  if (!raw || typeof raw !== "object") return null;
  let version = String(raw.version || "").trim();
  if (!version) return null;
  let detected_at = Number(raw.detected_at) || 0;
  return { version, detected_at };
}

function get_extension_runtime_scheme() {
  try {
    return new URL(chrome.runtime.getURL("")).protocol;
  } catch {
    return "";
  }
}

function is_firefox_extension_runtime() {
  return get_extension_runtime_scheme() === "moz-extension:";
}

function is_chromium_extension_runtime() {
  return get_extension_runtime_scheme() === "chrome-extension:";
}

const nte_discord_banner_dismissed_key = "nte_discord_banner_dismissed";
const nte_rate_banner_dismissed_key = "nte_rate_banner_dismissed";

function get_extension_store_review_info() {
  if (is_firefox_extension_runtime()) {
    return { label: "Firefox Add-ons", url: firefox_addons_item_url };
  }
  if (is_chromium_extension_runtime()) {
    return { label: "Chrome Web Store", url: chrome_web_store_item_url };
  }
  return null;
}

async function append_options_prompt_banner(container, config) {
  let storage_key = config.storageKey;
  let dismissed = await get_storage([storage_key]);
  if (dismissed?.[storage_key]) return;

  let banner = document.createElement("div");
  banner.className = config.className;
  banner.innerHTML = config.html;
  banner
    .querySelector(config.closeSelector)
    .addEventListener("click", async () => {
      await set_storage({ [storage_key]: true });
      banner.remove();
    });
  container.append(banner);
}

function get_update_notice_copy(next_version = "") {
  let next = String(next_version || "").trim();
  if (is_firefox_extension_runtime()) {
    return {
      kicker: "Add-on update ready",
      title: "New version downloaded",
      copy: next
        ? `Firefox has v${next} ready. Click Update to restart with the new version.`
        : "A newer Firefox add-on build is ready. Click Update to restart with it.",
      status: "Restart applies the pending add-on update.",
    };
  }

  return {
    kicker: "Extension update ready",
    title: "New version downloaded",
    copy: next
      ? `v${next} is ready to install. Click Update to restart with the new version.`
      : "A newer store build is ready. Click Update to restart with it.",
    status: "Restart applies the pending store update.",
  };
}

function can_apply_extension_update() {
  return typeof chrome.runtime?.reload === "function";
}

async function apply_extension_update(next_version = "") {
  if (!can_apply_extension_update()) {
    return {
      ok: false,
      error: "This browser cannot apply updates from the extension popup.",
    };
  }

  let current_version = String(chrome.runtime.getManifest()?.version || "").trim();
  let pending_version = String(next_version || "").trim();
  let has_pending =
    pending_version &&
    (!current_version ||
      compare_extension_versions(pending_version, current_version) > 0);

  let result = await request_extension_update_check();
  let can_reload =
    result?.status === "update_available" ||
    has_pending ||
    result?.status === "throttled";

  if (!can_reload) {
    if (result?.status === "no_update") {
      return {
        ok: false,
        error:
          "No pending update is ready yet. The browser may still be downloading it.",
      };
    }
    return {
      ok: false,
      error:
        result?.error ||
        "Could not verify the pending update. Try again in a few minutes.",
    };
  }

  try {
    chrome.runtime.reload();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

function paint_about_update_status(state) {
  let status_el = document.getElementById("aboutUpdateStatus");
  if (!status_el) return;
  let current_version = String(
    chrome.runtime.getManifest()?.version || "",
  ).trim();
  let current_label = current_version ? `v${current_version}` : "dev build";
  let has_update =
    state?.version &&
    (!current_version ||
      compare_extension_versions(state.version, current_version) > 0);
  if (has_update) {
    status_el.textContent = `${current_label} · v${state.version} available`;
    status_el.classList.add("is-update");
    return;
  }
  status_el.textContent = current_label;
  status_el.classList.remove("is-update");
}

function render_about_review_cta() {
  let root = document.getElementById("aboutReviewRoot");
  if (!root) return;
  let store = get_extension_store_review_info();
  if (!store) {
    root.innerHTML = "";
    root.classList.add("hidden");
    return;
  }
  let store_label = store.label;
  let store_url = store.url;
  root.classList.remove("hidden");
  root.innerHTML = `
    <a href="${store_url}" data-open-new-tab="true" rel="noopener noreferrer" class="review-cta">
      <div class="review-cta-kicker">${store_label}</div>
      <div class="review-cta-title">Please rate the extension 5* and leave a review</div>
      <div class="review-cta-copy">If this extension helps, a quick review helps too.</div>
    </a>
  `;
  bind_popup_external_links();
}

function bind_popup_external_links() {
  let links = document.querySelectorAll(
    '[data-open-new-tab="true"], .discord-btn, .about-group-link',
  );
  for (let link of links) {
    if (link.dataset.new_tab_bound === "true") continue;
    link.dataset.new_tab_bound = "true";
    link.addEventListener("click", (event) => {
      let url = link.getAttribute("href");
      if (!url) return;
      event.preventDefault();
      if (globalThis.browser?.tabs?.create) {
        globalThis.browser.tabs.create({ url });
      } else if (chrome.tabs?.create) {
        chrome.tabs.create({ url });
      } else {
        globalThis.open(url, "_blank", "noopener,noreferrer");
      }
    });
  }
}

function open_extension_tab(path = "popup/popup.html") {
  let url = chrome.runtime.getURL(path);
  if (globalThis.browser?.tabs?.create) {
    globalThis.browser.tabs.create({ url });
  } else if (chrome.tabs?.create) {
    chrome.tabs.create({ url });
  } else {
    globalThis.open(url, "_blank", "noopener,noreferrer");
  }
}

function open_extension_popup(path = "popup/popup.html") {
  let url = chrome.runtime.getURL(path);
  let options = { url, type: "popup", width: 430, height: 720 };
  try {
    if (globalThis.browser?.windows?.create) {
      globalThis.browser.windows
        .create(options)
        .catch(() => open_extension_tab(path));
    } else if (chrome.windows?.create) {
      chrome.windows.create(options, () => {
        if (chrome.runtime.lastError) open_extension_tab(path);
      });
    } else {
      open_extension_tab(path);
    }
  } catch {
    open_extension_tab(path);
  }
}

function get_theme_upload_target_tab_id() {
  return new Promise((resolve) => {
    try {
      if (!chrome.tabs?.query) {
        resolve("");
        return;
      }
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        let trade_tab = (tabs || []).find(
          (tab) =>
            tab.active &&
            /^https:\/\/(?:www\.)?roblox\.com\/(?:[a-z]{2}\/)?trades/i.test(
              tab.url || "",
            ),
        );
        if (!trade_tab)
          trade_tab = (tabs || []).find((tab) =>
            /^https:\/\/(?:www\.)?roblox\.com\/(?:[a-z]{2}\/)?trades/i.test(
              tab.url || "",
            ),
          );
        resolve(trade_tab?.id ? String(trade_tab.id) : "");
      });
    } catch {
      resolve("");
    }
  });
}

async function send_theme_upload_to_active_page(payload) {
  let tab_id = await get_theme_upload_target_tab_id();
  if (!tab_id) return false;
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(
        Number(tab_id),
        { type: "nte_open_trade_theme_upload", ...payload },
        (response) => {
          resolve(!chrome.runtime.lastError && response?.ok === true);
        },
      );
    } catch {
      resolve(false);
    }
  });
}

function clear_extension_update_state_popup() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([extension_update_state_key], () => {
      if (chrome.runtime.lastError) console.info(chrome.runtime.lastError);
      resolve();
    });
  });
}

function set_extension_update_state_popup(version, detected_at = Date.now()) {
  return set_storage({
    [extension_update_state_key]: {
      version: String(version || "").trim(),
      detected_at,
    },
  });
}

async function request_extension_update_check() {
  if (globalThis.browser?.runtime?.requestUpdateCheck) {
    try {
      let result = await globalThis.browser.runtime.requestUpdateCheck();
      return result && typeof result === "object" ? result : { status: result };
    } catch (error) {
      return { status: "error", error: error?.message || String(error) };
    }
  }

  return new Promise((resolve) => {
    if (!chrome.runtime?.requestUpdateCheck) {
      resolve({ status: "error", error: "requestUpdateCheck unavailable" });
      return;
    }

    try {
      chrome.runtime.requestUpdateCheck((status, details) => {
        if (chrome.runtime.lastError) {
          resolve({ status: "error", error: chrome.runtime.lastError.message });
          return;
        }

        if (status && typeof status === "object") {
          resolve(status);
          return;
        }

        resolve({
          status: typeof status === "string" ? status : "",
          version: details?.version,
        });
      });
    } catch (error) {
      resolve({ status: "error", error: error?.message || String(error) });
    }
  });
}

function paint_update_banner(state) {
  let root = document.getElementById("update-banner-root");
  if (!root) return;

  let current_version = String(chrome.runtime.getManifest()?.version || "");
  if (
    !state?.version ||
    (current_version &&
      compare_extension_versions(state.version, current_version) <= 0)
  ) {
    paint_about_update_status(null);
    root.innerHTML = "";
    return;
  }

  paint_about_update_status(state);
  let next_version = escape_html(state.version);
  let current_version_label = current_version
    ? `v${escape_html(current_version)}`
    : "your current build";
  let copy = get_update_notice_copy(state.version);
  let apply_button = can_apply_extension_update()
    ? `<button type="button" class="update-banner-btn update-banner-btn-primary" data-update-action="apply">Update</button>`
    : "";

  root.innerHTML = `
    <div class="update-banner">
      <div class="update-banner-inner">
        <div class="update-banner-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
        </div>
        <div class="update-banner-text">
          <div class="update-banner-kicker">${copy.kicker} <span class="update-banner-pill">v${next_version}</span></div>
          <div class="update-banner-title">${copy.title}</div>
          <div class="update-banner-copy">You're on ${current_version_label}. ${copy.copy}</div>
          <div class="update-banner-actions">
            ${apply_button}
            <button type="button" class="update-banner-btn update-banner-btn-secondary" data-update-action="dismiss">Dismiss</button>
          </div>
          <div class="update-banner-status" data-update-status>${copy.status}</div>
        </div>
      </div>
    </div>
  `;

  root
    .querySelector('[data-update-action="apply"]')
    ?.addEventListener("click", async () => {
      let apply_btn = root.querySelector('[data-update-action="apply"]');
      let dismiss_btn = root.querySelector('[data-update-action="dismiss"]');
      let status_el = root.querySelector("[data-update-status]");
      if (apply_btn) {
        apply_btn.disabled = true;
        apply_btn.textContent = "Updating…";
      }
      if (dismiss_btn) dismiss_btn.disabled = true;
      if (status_el) {
        status_el.textContent =
          "Applying update and restarting the extension…";
      }

      let result = await apply_extension_update(state.version);
      if (result.ok) return;

      if (apply_btn) {
        apply_btn.disabled = false;
        apply_btn.textContent = "Update";
      }
      if (dismiss_btn) dismiss_btn.disabled = false;
      if (status_el) {
        status_el.textContent =
          result.error || "Could not apply the update. Try again shortly.";
      }
    });

  root
    .querySelector('[data-update-action="dismiss"]')
    ?.addEventListener("click", () => {
      root.innerHTML = "";
    });
}

async function render_update_banner(force_check = false) {
  let current_version = String(chrome.runtime.getManifest()?.version || "");
  let stored = await get_storage([
    extension_update_state_key,
    extension_update_last_check_key,
  ]);
  let cached = normalize_extension_update_state(
    stored[extension_update_state_key],
  );

  if (
    cached &&
    current_version &&
    compare_extension_versions(cached.version, current_version) <= 0
  ) {
    cached = null;
    await clear_extension_update_state_popup();
  }

  paint_update_banner(cached);

  let last_check = Number(stored[extension_update_last_check_key]) || 0;
  if (
    !force_check &&
    last_check &&
    Date.now() - last_check < extension_update_check_cooldown_ms
  )
    return;

  let result = await request_extension_update_check();
  if (result?.status) {
    await set_storage({ [extension_update_last_check_key]: Date.now() });
  }

  if (result?.status === "update_available") {
    let next_version = String(result.version || cached?.version || "").trim();
    if (
      next_version &&
      (!current_version ||
        compare_extension_versions(next_version, current_version) > 0)
    ) {
      let detected_at = Date.now();
      await set_extension_update_state_popup(next_version, detected_at);
      paint_update_banner({ version: next_version, detected_at });
      return;
    }
  }

  if (result?.status === "no_update") {
    await clear_extension_update_state_popup();
    paint_update_banner(null);
  }
}

function show_test_notification(name) {
  if (!chrome.notifications?.create) return;
  chrome.notifications.create(
    `nru_test_notification_${Date.now()}`,
    {
      type: "basic",
      iconUrl: chrome.runtime.getURL("assets/icons/logo128.png"),
      title: "Nevos Trading Extension",
      message: `${name} enabled`,
      priority: 2,
    },
    () => {
      if (chrome.runtime.lastError) {
        console.info(
          "Nevos Trading Extension: notification create failed",
          chrome.runtime.lastError,
        );
      }
    },
  );
}

function is_mobile_browser() {
  const agent = navigator.userAgent || navigator.vendor || window.opera || "";
  return /android|iphone|ipod|iemobile|mobile/i.test(agent);
}

function sync_mobile_popup_class() {
  const mobile = is_mobile_browser();
  document.documentElement.classList.toggle("is-mobile-browser", mobile);
  document.body.classList.toggle("is-mobile-browser", mobile);
}

async function maybe_request_notifications() {
  if (!chrome.notifications?.create) return false;
  let manifest_permissions = chrome.runtime?.getManifest?.()?.permissions;
  if (
    Array.isArray(manifest_permissions) &&
    manifest_permissions.includes("notifications")
  ) {
    return true;
  }
  if (!chrome.permissions?.contains || !chrome.permissions?.request)
    return true;
  return new Promise((resolve) => {
    chrome.permissions.contains({ permissions: ["notifications"] }, (has) => {
      if (chrome.runtime.lastError) {
        console.info(
          "Nevos Trading Extension: notifications permission check failed",
          chrome.runtime.lastError,
        );
        resolve(false);
        return;
      }
      if (has) {
        resolve(true);
        return;
      }

      chrome.permissions.request(
        { permissions: ["notifications"] },
        (granted) => {
          if (chrome.runtime.lastError) {
            console.info(
              "Nevos Trading Extension: notifications permission request failed",
              chrome.runtime.lastError,
            );
            resolve(false);
            return;
          }
          resolve(!!granted);
        },
      );
    });
  });
}

function create_toggle(option, checked) {
  const id = `toggle-${option.name.replace(/\s/g, "")}`;
  const label = document.createElement("label");
  label.className = "toggle";
  label.setAttribute("for", id);

  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = checked;

  const track = document.createElement("span");
  track.className = "toggle-track";
  const thumb = document.createElement("span");
  thumb.className = "toggle-thumb";

  label.append(input, track, thumb);

  input.addEventListener("change", async () => {
    if (option.name === colorblind_mode_option_name) {
      let saved = await ensure_colorblind_mode_settings();
      let profile = normalize_colorblind_mode_profile(
        saved[colorblind_mode_profile_key],
      );
      await set_storage({
        [colorblind_mode_option_name]: input.checked,
        [legacy_colorblind_mode_option_name]: input.checked,
        [colorblind_mode_profile_key]: profile,
      });
      send_colorblind_mode_update();
      await refresh_all_panels();
      return;
    }

    if (option.name === "Duplicate Trade Warning" && input.checked) {
      await set_option_value(option.name, true);
      await prompt_duplicate_trade_warning_hours();
      send_option_update(option.name);
      await refresh_all_panels();
      return;
    }

    if (option.name === "Inbound Trade Notifications" && input.checked) {
      let has_notifications = await maybe_request_notifications();
      if (has_notifications) {
        show_test_notification(option.name);
        await set_option_value(option.name, true);
        await prompt_inbound_trade_notification_min_gain();
        send_option_update(option.name);
        await refresh_all_panels();
      } else {
        input.checked = false;
        await set_option_value(option.name, false);
      }
      return;
    }

    if (option.name.includes("Notifications") && input.checked) {
      let has_notifications = await maybe_request_notifications();
      if (has_notifications) {
        show_test_notification(option.name);
        await set_option_value(option.name, true);
        send_option_update(option.name);
      } else {
        input.checked = false;
        await set_option_value(option.name, false);
      }
      return;
    }

    await set_option_value(option.name, input.checked);
    send_option_update(option.name);
  });

  return label;
}

function create_colorblind_mode_selector(current_profile) {
  let active_profile = normalize_colorblind_mode_profile(current_profile);
  const picker = document.createElement("div");
  picker.className = "colorblind-profile-picker";

  const kicker = document.createElement("div");
  kicker.className = "colorblind-profile-kicker";
  kicker.textContent = "Palette profile";

  const grid = document.createElement("div");
  grid.className = "colorblind-profile-grid";

  function sync_active_state() {
    grid.querySelectorAll(".colorblind-profile-btn").forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.dataset.profile === active_profile,
      );
    });
  }

  colorblind_mode_profiles.forEach((profile) => {
    let button = document.createElement("button");
    button.type = "button";
    button.className = "colorblind-profile-btn";
    button.dataset.profile = profile.value;
    button.innerHTML = `
      <span class="colorblind-profile-copy">
        <span class="colorblind-profile-title">${escape_html(profile.label)}</span>
        <span class="colorblind-profile-subtitle">${escape_html(profile.hint)}</span>
      </span>
      <span class="colorblind-profile-swatches">
        ${profile.swatches.map((color) => `<span class="colorblind-profile-swatch" style="--swatch:${color}"></span>`).join("")}
      </span>
    `;
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (active_profile === profile.value) return;
      active_profile = profile.value;
      sync_active_state();
      await set_storage({ [colorblind_mode_profile_key]: active_profile });
      send_colorblind_mode_update();
    });
    grid.append(button);
  });

  picker.append(kicker, grid);
  sync_active_state();
  return picker;
}

function create_option_row(option, checked, extra = {}) {
  const row = document.createElement("div");
  row.className = "option-row";
  row.dataset.optionSearch = build_option_search_text(option.name, option.path);

  const label_el = document.createElement("div");
  label_el.className = "option-label";

  let display_name = option.name;

  if (display_name.includes("(Beta)")) {
    display_name = display_name.replace("(Beta)", "");
    label_el.innerHTML = `${escape_html(display_name.trim())}<span class="beta-tag">Beta</span>`;
  } else {
    label_el.textContent = display_name;
  }

  if (option.name === colorblind_mode_option_name && checked) {
    row.classList.add("option-row--stacked");
    label_el.append(
      create_colorblind_mode_selector(extra.colorblind_mode_profile),
    );
  }

  if (option.name === "Inbound Trade Notifications") {
    let note_btn = document.createElement("button");
    note_btn.type = "button";
    note_btn.className = "option-note-btn";
    note_btn.textContent = get_inbound_trade_notification_note(
      extra.inbound_trade_min_gain,
    );
    note_btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await prompt_inbound_trade_notification_min_gain();
      await refresh_all_panels();
    });
    label_el.append(note_btn);
  }

  if (option.name === "Duplicate Trade Warning") {
    let note_btn = document.createElement("button");
    note_btn.type = "button";
    note_btn.className = "option-note-btn";
    note_btn.textContent = get_duplicate_trade_warning_note(
      extra.duplicate_trade_warning_hours,
    );
    note_btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await prompt_duplicate_trade_warning_hours();
      send_option_update(option.name);
      await refresh_all_panels();
    });
    label_el.append(note_btn);
  }

  if (option.name === "Values on User Pages") {
    row.classList.add("profile-value-option-row");
    const controls = document.createElement("div");
    controls.className = "profile-value-option-controls";
    controls.append(
      create_profile_value_display_toggle(extra.profile_value_display_mode),
      create_toggle(option, checked),
    );
    row.append(label_el, controls);
    return row;
  }

  if (option.name === "Add Item Ownership Buttons") {
    row.classList.add("profile-value-option-row");
    const controls = document.createElement("div");
    controls.className = "profile-value-option-controls";
    controls.append(
      create_ownership_link_provider_toggle(extra.ownership_link_provider),
      create_toggle(option, checked),
    );
    row.append(label_el, controls);
    return row;
  }

  if (option.name === counter_trade_choices_option_name) {
    row.classList.add("profile-value-option-row");
    const controls = document.createElement("div");
    controls.className = "profile-value-option-controls";
    controls.append(
      create_counter_trade_choice_mode_toggle(extra.counter_trade_choice_mode),
      create_toggle(option, checked),
    );
    row.append(label_el, controls);
    return row;
  }

  row.append(label_el, create_toggle(option, checked));
  return row;
}

function create_profile_value_display_toggle(mode) {
  return create_option_mode_menu({
    aria_label: "Profile stat display",
    active: normalize_profile_value_display_mode(mode),
    choices: [
      { value: "rap", label: "RAP" },
      { value: "value", label: "Value" },
    ],
    on_change: async (value) => {
      await set_option_value(profile_value_display_mode_key, value);
      send_option_update("Values");
    },
  });
}

function create_option_mode_menu({ aria_label, active, choices, on_change }) {
  let active_mode = active;
  let open = false;
  const root = document.createElement("div");
  root.className = "option-mode-menu";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "option-mode-menu-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", aria_label);

  const trigger_label = document.createElement("span");
  trigger_label.className = "option-mode-menu-label";

  const trigger_chevron = document.createElement("span");
  trigger_chevron.className = "option-mode-menu-chevron";
  trigger_chevron.setAttribute("aria-hidden", "true");
  trigger_chevron.innerHTML =
    '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.2 3.6L5 6.4l2.8-2.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  trigger.append(trigger_label, trigger_chevron);

  const panel = document.createElement("div");
  panel.className = "option-mode-menu-panel";
  panel.setAttribute("role", "listbox");
  panel.setAttribute("aria-label", aria_label);
  panel.hidden = true;

  function choice_label(value) {
    return choices.find((choice) => choice.value === value)?.label || value;
  }

  function sync_trigger() {
    trigger_label.textContent = choice_label(active_mode);
    panel.querySelectorAll("button").forEach((button) => {
      let selected = button.dataset.mode === active_mode;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
  }

  function place_panel() {
    let rect = trigger.getBoundingClientRect();
    let gap = 6;
    let panel_width = Math.max(panel.offsetWidth || 132, 132);
    let left = Math.min(
      Math.max(8, rect.right - panel_width),
      window.innerWidth - panel_width - 8,
    );
    let top = rect.bottom + gap;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.minWidth = `${Math.max(Math.round(rect.width), 132)}px`;
    // Flip up if the second option would be clipped by the popup bottom.
    requestAnimationFrame(() => {
      let panel_rect = panel.getBoundingClientRect();
      if (panel_rect.bottom > window.innerHeight - 8) {
        panel.style.top = `${Math.round(rect.top - panel_rect.height - gap)}px`;
      }
    });
  }

  function close_menu() {
    if (!open) return;
    open = false;
    panel.hidden = true;
    if (panel.parentElement === document.body) panel.remove();
    root.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", on_doc_down, true);
    document.removeEventListener("keydown", on_key_down, true);
    window.removeEventListener("resize", place_panel, true);
    window.removeEventListener("scroll", place_panel, true);
  }

  function open_menu() {
    if (open) return;
    document.querySelectorAll(".option-mode-menu.is-open").forEach((menu) => {
      if (menu !== root) menu.classList.remove("is-open");
    });
    document
      .querySelectorAll(".option-mode-menu-panel:not([hidden])")
      .forEach((el) => {
        if (el !== panel) {
          el.hidden = true;
          if (el.parentElement === document.body) el.remove();
        }
      });
    open = true;
    document.body.appendChild(panel);
    panel.hidden = false;
    root.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    place_panel();
    document.addEventListener("mousedown", on_doc_down, true);
    document.addEventListener("keydown", on_key_down, true);
    window.addEventListener("resize", place_panel, true);
    window.addEventListener("scroll", place_panel, true);
  }

  function on_doc_down(event) {
    if (!root.contains(event.target) && !panel.contains(event.target))
      close_menu();
  }

  function on_key_down(event) {
    if (event.key === "Escape") close_menu();
  }

  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-mode-menu-item";
    button.dataset.mode = choice.value;
    button.setAttribute("role", "option");
    button.textContent = choice.label;
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      let next = choice.value;
      close_menu();
      if (active_mode === next) return;
      active_mode = next;
      sync_trigger();
      await on_change(active_mode);
    });
    panel.append(button);
  });

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (open) close_menu();
    else open_menu();
  });

  sync_trigger();
  root.append(trigger);
  return root;
}

function create_ownership_link_provider_toggle(mode) {
  return create_option_mode_menu({
    aria_label: "Ownership link provider",
    active: normalize_ownership_link_provider(mode),
    choices: [
      { value: "rolimons", label: "Rolimons" },
      { value: "routility", label: "Routility" },
    ],
    on_change: async (value) => {
      await set_option_value(ownership_link_provider_key, value);
      send_option_update("Add Item Ownership Buttons");
      send_option_update(ownership_link_provider_key);
    },
  });
}

function create_counter_trade_choice_mode_toggle(mode) {
  return create_option_mode_menu({
    aria_label: "Counter trade choice mode",
    active: normalize_counter_trade_choice_mode(mode),
    choices: [
      { value: "prompt", label: "Prompt" },
      { value: "buttons", label: "Button" },
    ],
    on_change: async (value) => {
      await set_option_value(counter_trade_choice_mode_key, value);
      send_option_update(counter_trade_choices_option_name);
      send_option_update(counter_trade_choice_mode_key);
    },
  });
}

const trade_ads_verify_storage_key = "trade_ads_verify_ui";
const trade_ads_config_storage_key = "trade_ads_config";

const trade_ads_thumb_placeholder_src =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect fill="%231a1d26" width="72" height="72"/></svg>',
  );

function trade_ads_attach_thumb_error_handler(img) {
  img.onerror = function trade_ads_thumb_onerror() {
    img.onerror = null;
    let aid = Number(img.dataset.thumbAid);
    if (!Number.isFinite(aid)) return;
    if (img.dataset.taThumbRefetched === "1") {
      img.src = trade_ads_thumb_placeholder_src;
      return;
    }
    img.dataset.taThumbRefetched = "1";
    chrome.runtime.sendMessage(
      {
        type: "trade_ads_refetch_thumb",
        assetId: aid,
        thumbKind: img.dataset.thumbKind || "",
      },
      (res) => {
        if (chrome.runtime.lastError || !res?.ok || !res.url) {
          img.src = trade_ads_thumb_placeholder_src;
          return;
        }
        img.onerror = function trade_ads_thumb_second_fail() {
          img.onerror = null;
          img.src = trade_ads_thumb_placeholder_src;
        };
        img.src = res.url;
      },
    );
  };
}

async function trade_ads_fill_thumbnails(scope_el) {
  if (!scope_el) return;
  let imgs = scope_el.querySelectorAll("img[data-thumb-pending='1']");
  if (!imgs.length) return;
  let thumb_requests = [];
  let seen = new Set();
  for (let img of imgs) {
    let id = Number(img.dataset.thumbAid);
    if (!Number.isFinite(id) || id <= 0) continue;
    let key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    let kind = String(img.dataset.thumbKind || "").toLowerCase();
    thumb_requests.push({
      id,
      thumbType: kind === "bundle" ? "Bundle" : "Asset",
    });
  }
  if (!thumb_requests.length) return;
  let res = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "trade_ads_resolve_thumbs",
        thumbRequests: thumb_requests,
        assetIds: thumb_requests.map((row) => row.id),
      },
      resolve,
    );
  });
  if (!res?.ok || !res.urls) return;
  for (let img of imgs) {
    if (!img.isConnected) continue;
    let u = res.urls[String(img.dataset.thumbAid)];
    if (u) {
      trade_ads_attach_thumb_error_handler(img);
      img.src = u;
      img.removeAttribute("data-thumb-pending");
    }
  }
}

async function trade_ads_merge_verify_ui(patch) {
  let prev =
    (await get_storage([trade_ads_verify_storage_key]))[
      trade_ads_verify_storage_key
    ] || {};
  let next = {
    step: "idle",
    phrase: "",
    error: "",
    userId: null,
    ...prev,
    ...patch,
  };
  await set_storage({ [trade_ads_verify_storage_key]: next });
  return next;
}

const trade_ads_alarm_name_popup = "tradeAdsAutoPost";
const trade_ads_interval_min_popup = 15;
const trade_ads_interval_max_popup = 43200;

let trade_ads_inventory_session_items = null;
let trade_ads_inventory_session_promise = null;

function trade_ads_reset_inventory_session() {
  trade_ads_inventory_session_items = null;
  trade_ads_inventory_session_promise = null;
}

async function trade_ads_load_inventory_session() {
  if (trade_ads_inventory_session_items != null)
    return trade_ads_inventory_session_items;
  if (trade_ads_inventory_session_promise)
    return trade_ads_inventory_session_promise;
  trade_ads_inventory_session_promise = (async () => {
    let res = await new Promise((resolve) =>
      chrome.runtime.sendMessage({ type: "trade_ads_inventory" }, resolve),
    );
    trade_ads_inventory_session_promise = null;
    if (!res?.ok) throw new Error(res?.error || "Could not load inventory");
    trade_ads_inventory_session_items = res.items || [];
    return trade_ads_inventory_session_items;
  })();
  return trade_ads_inventory_session_promise;
}

function trade_ads_default_local_config() {
  return {
    offer_slots: [null, null, null, null],
    request_slots: [null, null, null, null],
    offer_random: false,
    request_random: true,
    request_demand_min: 2,
    offer_robux: 0,
    notify_on_post: true,
    posting_paused: true,
    auto_interval_minutes: 15,
    request_tags: [],
    presets: [null, null, null, null],
    preset_rotation_enabled: false,
    preset_rotation_index: 0,
    preset_editor_index: 0,
  };
}

function trade_ads_normalize_slots_local(slots) {
  let out = Array.isArray(slots) ? slots.slice(0, 4) : [];
  while (out.length < 4) out.push(null);
  return out.map((x) => {
    if (typeof x === "string" && x.startsWith("tag:")) return x;
    let n = Number(x);
    return Number.isFinite(n) && n > 0 ? n : null;
  });
}

function trade_ads_normalize_preset_local(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  let name = String(raw.name || `Preset ${index + 1}`).trim();
  let p = {
    name: name.slice(0, 28) || `Preset ${index + 1}`,
    offer_slots: trade_ads_normalize_slots_local(raw.offer_slots),
    request_slots: trade_ads_normalize_slots_local(raw.request_slots),
    offer_random: raw.offer_random === true,
    request_random: raw.request_random !== false,
    request_demand_min: Math.max(0, Math.min(4, Number(raw.request_demand_min) || 0)),
    offer_robux: Math.max(0, Math.floor(Number(raw.offer_robux) || 0)),
    request_tags: Array.isArray(raw.request_tags)
      ? raw.request_tags.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 4)
      : [],
  };
  let has_offer =
    p.offer_random || p.offer_robux > 0 || p.offer_slots.some((x) => x != null);
  let has_request =
    p.request_random ||
    p.request_slots.some((x) => x != null) ||
    p.request_tags.length > 0;
  return has_offer || has_request ? p : null;
}

function trade_ads_normalize_presets_local(input) {
  let raw = Array.isArray(input) ? input : [];
  let out = [];
  for (let i = 0; i < 4; i++) out.push(trade_ads_normalize_preset_local(raw[i], i));
  return out;
}

function trade_ads_preset_from_config(cfg, index) {
  return trade_ads_normalize_preset_local(
    {
      name: `Preset ${index + 1}`,
      offer_slots: cfg.offer_slots,
      request_slots: cfg.request_slots,
      offer_random: cfg.offer_random,
      request_random: cfg.request_random,
      request_demand_min: cfg.request_demand_min,
      offer_robux: cfg.offer_robux,
      request_tags: cfg.request_tags,
    },
    index,
  );
}

function format_trade_ads_duration(total_minutes) {
  let m = Math.max(0, Math.floor(Number(total_minutes) || 0));
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  let h = Math.floor(m / 60);
  let r = m % 60;
  if (m < 1440) {
    if (r === 0) return `${h} hour${h === 1 ? "" : "s"}`;
    return `${h}h ${r}m`;
  }
  let d = Math.floor(m / 1440);
  let rem = m % 1440;
  if (rem === 0) return `${d} day${d === 1 ? "" : "s"}`;
  let rh = Math.floor(rem / 60);
  let rm = rem % 60;
  let parts = [`${d}d`];
  if (rh > 0) parts.push(`${rh}h`);
  if (rm > 0) parts.push(`${rm}m`);
  return parts.join(" ");
}

function clear_trade_ads_countdown_timer() {
  if (globalThis.__nte_trade_ads_cd_timer) {
    clearInterval(globalThis.__nte_trade_ads_cd_timer);
    globalThis.__nte_trade_ads_cd_timer = null;
  }
}

function format_trade_ad_countdown(ms_remaining) {
  let ms = Number(ms_remaining);
  if (!Number.isFinite(ms) || ms <= 0) return "Posting an ad momentarily";
  if (ms < 1000) return "Posting an ad in less than a second";

  let totalSec = Math.floor(ms / 1000);

  if (totalSec < 60) {
    return `Posting an ad in ${totalSec} second${totalSec === 1 ? "" : "s"}`;
  }

  let m = Math.floor(totalSec / 60);
  let s = totalSec % 60;

  if (totalSec < 3600) {
    if (s === 0) return `Posting an ad in ${m} minute${m === 1 ? "" : "s"}`;
    return `Posting an ad in ${m} minute${m === 1 ? "" : "s"} ${s} second${s === 1 ? "" : "s"}`;
  }

  let h = Math.floor(totalSec / 3600);
  let rem = totalSec % 3600;
  m = Math.floor(rem / 60);
  s = rem % 60;
  let parts = [`${h} hour${h === 1 ? "" : "s"}`];
  if (m > 0) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (s > 0) parts.push(`${s} second${s === 1 ? "" : "s"}`);
  return "Posting an ad in " + parts.join(" ");
}

async function trade_ads_save_merged_config(patch) {
  let prev =
    (await get_storage([trade_ads_config_storage_key]))[
      trade_ads_config_storage_key
    ] || {};
  let next = { ...trade_ads_default_local_config(), ...prev, ...patch };
  delete next.auto_post;
  if (typeof next.posting_paused !== "boolean") next.posting_paused = true;
  if (typeof next.notify_on_post !== "boolean")
    next.notify_on_post = trade_ads_default_local_config().notify_on_post;
  next.offer_slots = trade_ads_normalize_slots_local(next.offer_slots);
  next.request_slots = trade_ads_normalize_slots_local(next.request_slots);
  next.presets = trade_ads_normalize_presets_local(next.presets);
  next.preset_rotation_enabled = next.preset_rotation_enabled === true;
  next.preset_rotation_index = Math.max(
    0,
    Math.min(3, Math.floor(Number(next.preset_rotation_index)) || 0),
  );
  next.preset_editor_index = Math.max(
    0,
    Math.min(3, Math.floor(Number(next.preset_editor_index)) || 0),
  );
  let mins = Math.floor(Number(next.auto_interval_minutes));
  if (!Number.isFinite(mins))
    mins = trade_ads_default_local_config().auto_interval_minutes;
  next.auto_interval_minutes = Math.max(
    trade_ads_interval_min_popup,
    Math.min(trade_ads_interval_max_popup, mins),
  );
  await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "trade_ads_save_config", config: next },
      () => {
        chrome.runtime.lastError;
        resolve();
      },
    );
  });
  return next;
}

async function trade_ads_fetch_status_light_from_bg() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "trade_ads_get_status" }, (r) => {
      chrome.runtime.lastError;
      resolve(r && typeof r === "object" ? r : null);
    });
  });
}

async function trade_ads_fetch_status_from_bg() {
  await new Promise((resolve) => {
    chrome.runtime.sendMessage("getData", () => {
      chrome.runtime.lastError;
      resolve();
    });
  });
  return trade_ads_fetch_status_light_from_bg();
}

function trade_ads_request_tag_used_in_slots(slots, tag, exclude_index) {
  if (!tag || !Array.isArray(slots)) return false;
  let key = "tag:" + tag;
  return slots.some(
    (s, i) =>
      i !== exclude_index && typeof s === "string" && s === key,
  );
}

function trade_ads_attach_picker(root, opts) {
  let {
    side,
    inventory,
    inventoryPromise,
    onPick,
    onInventoryError,
    requestSlots,
    slotIndex,
    allowTags,
  } = opts;
  let pick_request_slots = Array.isArray(requestSlots) ? requestSlots : [];
  let pick_slot_index =
    Number.isFinite(Number(slotIndex)) ? Number(slotIndex) : -1;
  let show_tags = side === "request" && allowTags !== false;
  let overlay = document.createElement("div");
  overlay.className = "ta-overlay";
  let ph =
    side === "offer"
      ? "Filter by name or acronym…"
      : "Search name, acronym, or words…";
  overlay.innerHTML = `
    <div class="ta-sheet ta-sheet-picker">
      <div class="ta-sheet-head">
        <button type="button" class="ta-sheet-close" aria-label="Close">×</button>
        <input type="search" class="ta-search-input" placeholder="${escape_html(ph)}" />
      </div>
      ${
        show_tags
          ? `<div class="ta-tag-strip">${[
              ["demand", "Demand"],
              ["rares", "Rares"],
              ["robux", "Robux"],
              ["any", "Any"],
              ["upgrade", "Upgrade"],
              ["downgrade", "Downgrade"],
              ["rap", "RAP"],
              ["wishlist", "Wishlist"],
              ["projecteds", "Projecteds"],
              ["adds", "Adds"],
            ]
              .map(([tag, label]) => {
                let img = `https://www.rolimons.com/images/tradetag${tag}-420.png`;
                let used = trade_ads_request_tag_used_in_slots(
                  pick_request_slots,
                  tag,
                  pick_slot_index,
                );
                let used_note = used ? " (already used)" : "";
                return `<button type="button" class="ta-tag-cell${used ? " is-used" : ""}" data-tag="${tag}" title="${label}${used_note}"${used ? " disabled" : ""}><img src="${img}" alt="${label}" loading="lazy" decoding="async" /></button>`;
              })
              .join("")}</div>`
          : ""
      }
      <div class="ta-sheet-body ta-sheet-body-strip">
        <div class="ta-strip-scroll" tabindex="0" role="listbox" aria-label="${side === "offer" ? "Your items" : "Catalog items"}"></div>
        <div class="ta-strip-footer" aria-live="polite"></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let strip = overlay.querySelector(".ta-strip-scroll");
  let footer = overlay.querySelector(".ta-strip-footer");
  let input = overlay.querySelector(".ta-search-input");

  strip.addEventListener(
    "wheel",
    (e) => {
      if (strip.scrollWidth <= strip.clientWidth + 1) return;
      let delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      e.preventDefault();
      strip.scrollLeft += delta;
    },
    { passive: false },
  );

  let tag_strip = overlay.querySelector(".ta-tag-strip");
  if (tag_strip) {
    tag_strip.addEventListener(
      "wheel",
      (e) => {
        if (tag_strip.scrollWidth <= tag_strip.clientWidth + 1) return;
        let delta =
          Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (delta === 0) return;
        e.preventDefault();
        tag_strip.scrollLeft += delta;
      },
      { passive: false },
    );
  }

  function close() {
    overlay.remove();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector(".ta-sheet-close").addEventListener("click", close);

  if (show_tags) {
    overlay.querySelectorAll(".ta-tag-cell:not(.is-used)").forEach((cell) => {
      cell.addEventListener("click", async () => {
        let tag = cell.dataset.tag;
        if (!tag) return;
        if (
          trade_ads_request_tag_used_in_slots(
            pick_request_slots,
            tag,
            pick_slot_index,
          )
        ) {
          set_footer(
            `<span class="ta-strip-hint ta-strip-hint-warn">That tag is already in another slot.</span>`,
          );
          return;
        }
        close();
        await onPick("tag:" + tag);
      });
    });
  }

  function set_footer(html) {
    footer.innerHTML = html;
  }

  function pick_hold_badge_el(item) {
    let held = Math.max(0, Math.floor(Number(item?.onHoldCount) || 0));
    if (!(held > 0) && item?.isOnHold !== true) return null;
    if (!(held > 0)) held = 1;
    let total = Math.max(held, Math.floor(Number(item?.copyCount) || 0));
    let partial = total > held;
    let badge = document.createElement("div");
    badge.className = "ta-pick-hold-tag";
    badge.setAttribute("aria-label", partial ? `${held} of ${total} on hold` : "On hold");
    badge.title = partial ? `${held} of ${total} on hold` : "On hold";
    badge.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' +
      (partial
        ? `<span class="ta-pick-hold-count">x${held}</span>`
        : "");
    return badge;
  }

  function pick_cell_el(item) {
    let id = item.assetId ?? item.id;
    if (!Number.isFinite(Number(id))) return null;
    let cell = document.createElement("button");
    cell.type = "button";
    cell.className = "ta-pick-strip-cell";
    cell.setAttribute("role", "option");
    let nm = item.name || `#${id}`;
    let ac = item.acronym ? String(item.acronym).trim() : "";
    cell.title = ac ? `${nm} (${ac})` : nm;
    let thumb_wrap = document.createElement("div");
    thumb_wrap.className = "ta-pick-thumb-wrap";
    let img = document.createElement("img");
    img.alt = nm;
    img.src = trade_ads_thumb_placeholder_src;
    img.decoding = "async";
    img.dataset.thumbAid = String(id);
    let thumb_kind = item.thumbType || item.thumbKind || "";
    if (thumb_kind) img.dataset.thumbKind = thumb_kind;
    img.dataset.thumbPending = "1";
    thumb_wrap.appendChild(img);
    let hold_badge = pick_hold_badge_el(item);
    if (hold_badge) thumb_wrap.appendChild(hold_badge);
    let copies = Math.max(0, Math.floor(Number(item?.copyCount) || 0));
    if (copies > 1) {
      let qty = document.createElement("div");
      qty.className = "ta-pick-copy-count";
      qty.textContent = `x${copies}`;
      qty.setAttribute("aria-label", `${copies} copies`);
      qty.title = `${copies} copies`;
      thumb_wrap.appendChild(qty);
    }
    let tradable = item.tradable !== false;
    if (!tradable) {
      cell.classList.add("is-on-hold");
      cell.disabled = true;
      cell.title = (ac ? `${nm} (${ac})` : nm) + " — on hold";
    }
    let rv =
      item.valueLine != null
        ? Number(item.valueLine)
        : item.rolimonsValue != null
          ? Number(item.rolimonsValue)
          : null;
    let rp = item.rap != null ? Number(item.rap) : null;
    if (rv === null && rp === null && item.value != null) {
      rv = Number(item.value);
      rp = 0;
    }
    let meta = document.createElement("div");
    meta.className = "ta-pick-cell-meta";
    meta.innerHTML = `<div class="ta-pick-metric"><span>Value</span><b>${rv != null ? format_number(rv) : "—"}</b></div>
      <div class="ta-pick-metric"><span>RAP</span><b>${rp != null ? format_number(rp) : "—"}</b></div>`;
    cell.append(thumb_wrap, meta);
    if (tradable) {
      cell.addEventListener("click", () => {
        onPick(Number(id), nm);
        close();
      });
    }
    return cell;
  }

  async function render_offer_strip_from(list) {
    strip.textContent = "";
    let n = 0;
    for (let item of list) {
      let el = pick_cell_el(item);
      if (el) {
        strip.appendChild(el);
        n++;
      }
    }
    if (!n) {
      let d = document.createElement("div");
      d.className = "ta-strip-empty";
      d.textContent = "Nothing matches.";
      strip.appendChild(d);
      set_footer("");
      return;
    }
    set_footer("");
    await trade_ads_fill_thumbnails(strip);
  }

  if (side === "offer") {
    let live_inv = Array.isArray(inventory) ? inventory : [];
    let q = "";
    function filter_inv() {
      let qq = q.trim().toLowerCase();
      if (!qq) return live_inv;
      let tokens = qq.split(/\s+/).filter(Boolean);
      return live_inv.filter((x) => {
        let hay = `${String(x.name || "").toLowerCase()} ${String(x.acronym || "").toLowerCase()}`;
        return tokens.every((t) => hay.includes(t));
      });
    }
    async function refresh_offer_display() {
      await render_offer_strip_from(filter_inv());
    }
    input.addEventListener("input", () => {
      q = input.value;
      void refresh_offer_display();
    });
    if (inventoryPromise && typeof inventoryPromise.then === "function") {
      strip.textContent = "";
      let load_msg = document.createElement("div");
      load_msg.className = "ta-strip-empty";
      load_msg.textContent = "Loading your items…";
      strip.appendChild(load_msg);
      set_footer(`<span class="ta-strip-hint">Loading…</span>`);
      let set_load_text = (text) => {
        let msg = String(text || "Loading your items…");
        if (load_msg.isConnected) load_msg.textContent = msg;
        set_footer(
          `<span class="ta-strip-hint">${escape_html(msg)}</span>`,
        );
      };
      let on_inv_status = (msg) => {
        if (msg?.type !== "nte_inventory_load_status") return;
        if (!load_msg.isConnected) return;
        if (msg.text) set_load_text(msg.text);
      };
      try {
        chrome.runtime.onMessage.addListener(on_inv_status);
      } catch {}
      inventoryPromise
        .then((inv) => {
          live_inv = Array.isArray(inv) ? inv : [];
          if (!live_inv.length) {
            strip.textContent = "";
            let em = document.createElement("div");
            em.className = "ta-strip-empty";
            em.textContent = "No tradeable items found.";
            strip.appendChild(em);
            set_footer("");
            return;
          }
          void refresh_offer_display();
        })
        .catch((e) => {
          let msg = e?.message || String(e);
          strip.textContent = "";
          let em = document.createElement("div");
          em.className = "ta-strip-empty";
          em.textContent = msg;
          strip.appendChild(em);
          set_footer("");
          if (typeof onInventoryError === "function") onInventoryError(msg);
        })
        .finally(() => {
          try {
            chrome.runtime.onMessage.removeListener(on_inv_status);
          } catch {}
        });
    } else {
      void refresh_offer_display();
    }
  } else {
    let request_offset = 0;
    let request_has_more = false;
    let request_loading = false;
    let request_query = "";
    let page_limit = 100;

    async function fetch_catalog_page(append) {
      if (request_loading) return;
      if (append && !request_has_more) return;
      request_loading = true;
      let offset = append ? request_offset : 0;
      if (!append) {
        strip.textContent = "";
        set_footer(`<span class="ta-strip-hint">Loading…</span>`);
      } else {
        set_footer(`<span class="ta-strip-hint">Loading more…</span>`);
      }
      let res = await new Promise((resolve) =>
        chrome.runtime.sendMessage(
          {
            type: "trade_ads_search_items",
            query: request_query,
            limit: page_limit,
            offset,
          },
          resolve,
        ),
      );
      request_loading = false;
      if (!res?.ok) {
        strip.textContent = "";
        let d = document.createElement("div");
        d.className = "ta-strip-empty";
        d.textContent = res?.error || "Could not load items.";
        strip.appendChild(d);
        set_footer("");
        request_has_more = false;
        return;
      }
      for (let x of res.items || []) {
        let el = pick_cell_el({
          id: x.id,
          name: x.name,
          assetId: x.id,
          acronym: x.acronym,
          value: x.value,
          valueLine: x.valueLine,
          rap: x.rap,
          thumbType: x.thumbType,
        });
        if (el) strip.appendChild(el);
      }
      request_offset = offset + (res.items?.length || 0);
      request_has_more = !!res.hasMore;
      if (!strip.querySelector(".ta-pick-strip-cell")) {
        strip.textContent = "";
        let d = document.createElement("div");
        d.className = "ta-strip-empty";
        d.textContent = request_query
          ? "No items match that search."
          : "No valued items in catalog.";
        strip.appendChild(d);
        set_footer("");
        return;
      }
      await trade_ads_fill_thumbnails(strip);
      if (request_has_more) {
        let t = res.total != null ? `${request_offset} / ${res.total} · ` : "";
        set_footer(
          `<span class="ta-strip-hint">${t}Scroll right for more</span>`,
        );
      } else {
        set_footer("");
      }
      requestAnimationFrame(() => {
        if (
          request_has_more &&
          !request_loading &&
          strip.scrollWidth <= strip.clientWidth + 8
        ) {
          fetch_catalog_page(true);
        }
      });
    }

    let debounce;
    function schedule_search() {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        request_query = input.value.trim();
        request_offset = 0;
        request_has_more = false;
        fetch_catalog_page(false);
      }, 200);
    }
    input.addEventListener("input", schedule_search);
    strip.addEventListener(
      "scroll",
      () => {
        if (!request_has_more || request_loading) return;
        if (strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 72) {
          fetch_catalog_page(true);
        }
      },
      { passive: true },
    );
    schedule_search();
  }
}

function trade_ads_get_active_category(root) {
  if (root?.dataset?.taActiveCategory === "notifs") return "notifs";
  if (root?.dataset?.taActiveCategory === "posting") return "posting";
  return globalThis.__nte_ads_active_category === "notifs"
    ? "notifs"
    : "posting";
}

function trade_ads_set_active_category(root, category) {
  if (!root) return;
  let cat = category === "notifs" ? "notifs" : "posting";
  globalThis.__nte_ads_active_category = cat;
  root.dataset.taActiveCategory = cat;
  root.querySelectorAll(".ta-category-pick").forEach((btn) => {
    let on = btn.dataset.taCategory === cat;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  root.querySelectorAll("[data-ta-category-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.taCategoryPanel !== cat;
  });
}

function trade_ads_get_layout_root(root) {
  if (root?.id === "trade-ads-root") return root;
  return document.getElementById("trade-ads-root");
}

function trade_ads_ensure_category_layout(layout_root, active_category) {
  if (!layout_root) return null;
  let cat = active_category === "notifs" ? "notifs" : "posting";
  if (!layout_root.querySelector("#ta-posting-inner")) {
    layout_root.innerHTML = `
    <div class="ta-category-bar" role="tablist" aria-label="Ads sections">
      <button type="button" class="ta-category-pick is-active" data-ta-category="posting" role="tab" aria-selected="true" aria-controls="ta-posting-panel">
        <span class="ta-category-pick-label">Trade Ad Posting</span>
        <span class="ta-category-pick-note">Post Rolimons trade ads</span>
      </button>
      <button type="button" class="ta-category-pick" data-ta-category="notifs" role="tab" aria-selected="false" aria-controls="ta-notifs-panel">
        <span class="ta-category-pick-label">Trade Ad Notifications</span>
        <span class="ta-category-pick-note">Alerts for trade ads</span>
      </button>
    </div>
    <div class="ta-category-panel" id="ta-posting-panel" data-ta-category-panel="posting" role="tabpanel">
      <div id="ta-posting-inner" class="ta-posting-inner"></div>
    </div>
    <div class="ta-category-panel" id="ta-notifs-panel" data-ta-category-panel="notifs" role="tabpanel" hidden>
      <div id="ta-notifs-root" class="ta-notifs-root"></div>
    </div>`;
    layout_root.dataset.taActiveCategory = cat;
    trade_ads_bind_category_picks(layout_root);
  }
  trade_ads_set_active_category(layout_root, cat);
  if (cat === "notifs") trade_ads_mount_notifications_panel(layout_root);
  return layout_root.querySelector("#ta-posting-inner");
}

function trade_ads_resolve_posting_panel(root) {
  let layout_root = trade_ads_get_layout_root(root) || root;
  return trade_ads_ensure_category_layout(
    layout_root,
    trade_ads_get_active_category(layout_root),
  );
}

function trade_ads_mount_notifications_panel(root) {
  let mount = root?.querySelector("#ta-notifs-root");
  if (!mount) return;
  if (typeof nte_is_lite === "function" && nte_is_lite()) {
    mount.innerHTML = `<div class="ta-notifs-empty-card ta-notifs-lite-card"><div class="ta-notifs-lite-badge">LITE</div><p class="ta-notifs-empty-title">Trade ad alerts need Full</p><p class="ta-notifs-empty-copy">LITE stays fully client-side. Grab the full extension for live trade ad matching.</p><a class="ta-notifs-lite-link" href="https://nevos-extension.com" target="_blank" rel="noopener noreferrer" data-open-new-tab="true">Get Full on nevos-extension.com</a></div>`;
    return;
  }
  if (typeof trade_ad_notif_render_into !== "function") {
    mount.innerHTML = `<div class="ta-notifs-empty-card"><p class="ta-notifs-empty-title">Trade ad alerts unavailable</p><p class="ta-notifs-empty-copy">Reload the extension to load the notifications module.</p></div>`;
    return;
  }
  if (mount.__taNotifMounted) {
    if (typeof trade_ad_notif_refresh_ui === "function") {
      trade_ad_notif_refresh_ui(mount).catch(() => {});
    }
    return;
  }
  mount.__taNotifMounted = true;
  trade_ad_notif_render_into(mount);
  if (typeof trade_ad_notif_bind_storage_refresh === "function") {
    trade_ad_notif_bind_storage_refresh(mount);
  }
}

function trade_ads_bind_category_picks(root) {
  let active = trade_ads_get_active_category(root);
  root.querySelectorAll(".ta-category-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      trade_ads_set_active_category(root, btn.dataset.taCategory);
      if (btn.dataset.taCategory === "notifs") {
        trade_ads_mount_notifications_panel(root);
      }
    });
  });
  trade_ads_set_active_category(root, active);
  if (active === "notifs") trade_ads_mount_notifications_panel(root);
}

async function render_trade_ads_composer(root, status) {
  clear_trade_ads_countdown_timer();
  let layout_root = trade_ads_get_layout_root(root) || root;
  let panel = trade_ads_resolve_posting_panel(layout_root);
  if (!panel) return;
  let saved_category = trade_ads_get_active_category(layout_root);
  let cfg = { ...trade_ads_default_local_config(), ...(status.config || {}) };
  delete cfg.auto_post;
  if (typeof cfg.posting_paused !== "boolean") cfg.posting_paused = true;
  cfg.offer_slots = trade_ads_normalize_slots_local(cfg.offer_slots);
  cfg.request_slots = trade_ads_normalize_slots_local(cfg.request_slots);
  cfg.presets = trade_ads_normalize_presets_local(cfg.presets);
  cfg.preset_editor_index = Math.max(
    0,
    Math.min(3, Math.floor(Number(cfg.preset_editor_index)) || 0),
  );
  cfg.preset_rotation_index = Math.max(
    0,
    Math.min(3, Math.floor(Number(cfg.preset_rotation_index)) || 0),
  );
  let im = Math.floor(Number(cfg.auto_interval_minutes));
  cfg.auto_interval_minutes = Math.max(
    trade_ads_interval_min_popup,
    Math.min(
      trade_ads_interval_max_popup,
      Number.isFinite(im)
        ? im
        : trade_ads_default_local_config().auto_interval_minutes,
    ),
  );
  let last_err = status.last_auto_error;
  let last_auto = status.last_auto_post_at;
  let slot_metrics =
    status.slot_item_metrics && typeof status.slot_item_metrics === "object"
      ? status.slot_item_metrics
      : {};

  function trade_ads_metric_value_for_display(m) {
    if (!m) return 0;
    if (m.valueLine != null) return Number(m.valueLine) || 0;
    let raw = Number(m.rolimonsValue);
    if (Number.isFinite(raw) && raw > 0) return raw;
    return Number(m.rap) || 0;
  }

  function slot_metrics_html(aid) {
    let m = slot_metrics[String(aid)];
    let val = m ? format_number(trade_ads_metric_value_for_display(m)) : "—";
    let rap = m ? format_number(Number(m.rap) || 0) : "—";
    return `<div class="ta-slot-metrics">
      <div class="ta-slot-metric-row"><span class="ta-metric-k">Value</span><span class="ta-metric-v">${val}</span></div>
      <div class="ta-slot-metric-row"><span class="ta-metric-k">RAP</span><span class="ta-metric-v">${rap}</span></div>
    </div>`;
  }

  function sum_offer_items_value() {
    if (cfg.offer_random) return null;
    let s = 0;
    for (let id of cfg.offer_slots || []) {
      if (id == null) continue;
      let m = slot_metrics[String(id)];
      if (m) s += trade_ads_metric_value_for_display(m);
    }
    return s;
  }

  function sum_request_items_value() {
    if (cfg.request_random) return null;
    let s = 0;
    for (let id of cfg.request_slots || []) {
      if (id == null) continue;
      let m = slot_metrics[String(id)];
      if (m) s += trade_ads_metric_value_for_display(m);
    }
    return s;
  }

  let robuxOffer = Math.floor(Number(cfg.offer_robux) || 0);
  let offerItemsSum = sum_offer_items_value();
  let requestItemsSum = sum_request_items_value();
  let offerGrand = offerItemsSum != null ? offerItemsSum + robuxOffer : null;
  let roli_icon_url = escape_html(get_asset_url("assets/rolimons.png"));

  function offer_has_any_pick() {
    return (cfg.offer_slots || []).some((id) => id != null);
  }

  function request_has_any_pick() {
    return (cfg.request_slots || []).some((id) => id != null);
  }

  function preview_side_label_line(title, opts, extraClass) {
    let { randomMode, showTotal, totalNum } = opts;
    let mod = extraClass ? ` ${extraClass}` : "";
    if (randomMode || !showTotal) {
      return `<div class="ta-preview-label${mod}">${escape_html(title)}</div>`;
    }
    return `<div class="ta-preview-label ta-preview-label-with-total${mod}">
      <span class="ta-preview-label-text">${escape_html(title)}</span>
      <span class="ta-preview-label-total" title="Rolimons-side total">
        <img class="ta-preview-label-roli" src="${roli_icon_url}" width="15" height="15" alt="" decoding="async" />
        <span class="ta-preview-label-value">${escape_html(format_number(totalNum))}</span>
      </span>
    </div>`;
  }

  function slot_html(side, i, id, random_each_post) {
    if (random_each_post) {
      let hint =
        side === "offer" ? "Random offers each post" : "Random each post";
      return `<div class="ta-slot" data-side="${side}" data-index="${i}" data-random="1"><span class="ta-slot-random" title="${escape_html(hint)}">🎲</span></div>`;
    }
    if (id != null) {
      if (typeof id === "string" && id.startsWith("tag:")) {
        let tag = id.slice(4);
        let img = `https://www.rolimons.com/images/tradetag${tag}-420.png`;
        return `<div class="ta-slot ta-slot-tag" data-side="${side}" data-index="${i}" data-tag="${tag}"><div class="ta-slot-tag-img-wrap"><img src="${img}" alt="${tag}" decoding="async" /></div><button type="button" class="ta-slot-clear" data-side="${side}" data-index="${i}" aria-label="Clear">×</button></div>`;
      }
      let aid = Number(id);
      return `<div class="ta-slot" data-side="${side}" data-index="${i}"><div class="ta-slot-thumb-wrap"><img src="${escape_html(trade_ads_thumb_placeholder_src)}" alt="" data-thumb-aid="${aid}" data-thumb-pending="1" decoding="async" /><button type="button" class="ta-slot-clear" data-side="${side}" data-index="${i}" aria-label="Clear">×</button></div></div>`;
    }
    return `<div class="ta-slot ta-slot-is-empty" data-side="${side}" data-index="${i}"><span class="ta-slot-empty">${side === "offer" ? "Offer" : "Want"}</span></div>`;
  }

  let rows = "";
  rows += preview_side_label_line("You offer", {
    randomMode: !!cfg.offer_random,
    showTotal: !cfg.offer_random && (offer_has_any_pick() || robuxOffer > 0),
    totalNum: offerGrand != null ? offerGrand : 0,
  });
  rows += `<div class="ta-slot-row">`;
  for (let i = 0; i < 4; i++)
    rows += slot_html("offer", i, cfg.offer_slots[i], cfg.offer_random);
  rows += `</div>`;
  rows += preview_side_label_line(
    "You request",
    {
      randomMode: !!cfg.request_random,
      showTotal: !cfg.request_random && request_has_any_pick(),
      totalNum: requestItemsSum != null ? requestItemsSum : 0,
    },
    "ta-preview-label-section-gap",
  );
  rows += `<div class="ta-slot-row">`;
  for (let i = 0; i < 4; i++)
    rows += slot_html("request", i, cfg.request_slots[i], cfg.request_random);
  rows += `</div>`;

  let recent_posts = status.recent_posts || [];
  let recent_items = "";
  if (recent_posts.length > 0) {
    recent_items = recent_posts
      .map((p) => {
        let url = p.player_id
          ? `https://www.rolimons.com/playertrades/${encodeURIComponent(String(p.player_id))}`
          : "https://www.rolimons.com/tradeads";
        let time = escape_html(format_relative_time(Number(p.at)));
        let offers = Array.isArray(p.offers) ? p.offers : [];
        let requests = Array.isArray(p.requests) ? p.requests : [];
        function thumb_tag(it) {
          if (!it || it.id == null) return "";
          return `<img src="${escape_html(trade_ads_thumb_placeholder_src)}" alt="" data-thumb-aid="${it.id}" data-thumb-pending="1" decoding="async" class="ta-recent-thumb" />`;
        }
        function side_html(label, items, old_count) {
          let thumbs = items.map(thumb_tag).join("");
          if (!thumbs) {
            if (old_count != null && old_count > 0) {
              return `<div class="ta-recent-side"><span class="ta-recent-side-label">${label}</span><span class="ta-recent-no-items">${old_count} items</span></div>`;
            }
            return `<div class="ta-recent-side"><span class="ta-recent-side-label">${label}</span><span class="ta-recent-no-items">—</span></div>`;
          }
          let total = items.reduce((s, it) => s + (Number(it.value) || 0), 0);
          let total_str = total > 0 ? format_number(total) : "";
          return `<div class="ta-recent-side"><span class="ta-recent-side-label">${label}</span><div class="ta-recent-thumbs">${thumbs}</div>${total_str ? `<span class="ta-recent-total">${total_str}</span>` : ""}</div>`;
        }
        if (
          offers.length === 0 &&
          requests.length === 0 &&
          (p.offer_count != null || p.request_count != null)
        ) {
          let line = `${p.offer_count || 0} offer · ${p.request_count || 0} request`;
          return `<div class="ta-recent-item"><div class="ta-recent-top"><span class="ta-recent-meta">${time}</span><a href="${url}" target="_blank" rel="noopener noreferrer" class="ta-recent-link">View</a></div><div class="ta-recent-side" style="justify-content:center;padding:4px 0"><span class="ta-recent-no-items">${escape_html(line)}</span></div></div>`;
        }
        return `<div class="ta-recent-item"><div class="ta-recent-top"><span class="ta-recent-meta">${time}</span><a href="${url}" target="_blank" rel="noopener noreferrer" class="ta-recent-link">View</a></div>${side_html("Offered", offers, p.offer_count)}${side_html("Requested", requests, p.request_count)}</div>`;
      })
      .join("");
  } else {
    recent_items = `<div class="ta-recent-empty">No trade ads posted yet.</div>`;
  }
  let recent_posts_html = `
    <div class="ta-recent-posts">
      <button type="button" class="ta-recent-toggle" id="ta-recent-toggle">
        <span>Recent posts</span>
        <svg class="ta-recent-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      <div class="ta-recent-list" id="ta-recent-list">${recent_items}</div>
    </div>
  `;

  function preset_summary(preset) {
    if (!preset) return "Empty";
    let offer_count = preset.offer_random
      ? "random offer"
      : `${preset.offer_slots.filter((x) => x != null).length} offer`;
    let request_count = preset.request_random
      ? "random want"
      : `${preset.request_slots.filter((x) => x != null).length} want`;
    let robux = Number(preset.offer_robux) > 0 ? ` + ${format_number(preset.offer_robux)} R$` : "";
    return `${offer_count}${robux} · ${request_count}`;
  }

  let selected_preset = cfg.preset_editor_index;
  let filled_preset_count = cfg.presets.filter(Boolean).length;
  let preset_chips = cfg.presets
    .map((preset, index) => {
      let active = index === selected_preset;
      let next = index === cfg.preset_rotation_index && cfg.preset_rotation_enabled;
      return `<button type="button" class="ta-preset-chip${active ? " is-active" : ""}${next ? " is-next" : ""}" data-preset-index="${index}">
        <span class="ta-preset-chip-name">${escape_html(preset?.name || `Slot ${index + 1}`)}</span>
        <span class="ta-preset-chip-note">${escape_html(preset_summary(preset))}</span>
      </button>`;
    })
    .join("");
  let presets_html = `
    <div class="ta-presets${cfg.preset_rotation_enabled ? " is-live" : ""}">
      <div class="ta-presets-head">
        <div>
          <div class="ta-presets-title">Auto ad presets</div>
          <div class="ta-presets-sub">${filled_preset_count ? `${filled_preset_count}/4 saved · ` : ""}Save ad presets.</div>
        </div>
        <label class="ta-preset-rotate-wrap" title="Rotate through saved presets">
          <span class="ta-switch">
            <input type="checkbox" id="ta-preset-rotate" ${cfg.preset_rotation_enabled ? "checked" : ""} />
            <span class="ta-switch-knob" aria-hidden="true"></span>
          </span>
        </label>
      </div>
      <div class="ta-preset-strip">${preset_chips}</div>
      <div class="ta-preset-actions">
        <button type="button" class="ta-btn ta-btn-secondary" id="ta-preset-save">Save to slot ${selected_preset + 1}</button>
        <button type="button" class="ta-btn ta-btn-ghost" id="ta-preset-load" ${cfg.presets[selected_preset] ? "" : "disabled"}>Load</button>
        <button type="button" class="ta-btn ta-btn-ghost" id="ta-preset-clear" ${cfg.presets[selected_preset] ? "" : "disabled"}>Clear</button>
      </div>
    </div>
  `;

  panel.innerHTML = `
    <div class="ta-card">
      <div class="ta-card-head">
        <div>
          <div class="ta-card-title">Ad preview</div>
          <div class="ta-card-sub">Tap a square to fill slots, or randomize them.</div>
        </div>
      </div>
      ${rows}
      ${presets_html}
      <div class="ta-divider"></div>
      <div class="ta-row">
        <label class="ta-toggle-pill"><input type="checkbox" id="ta-offer-random" ${cfg.offer_random ? "checked" : ""}/> Randomize offers each ad</label>
      </div>
      <div class="ta-row">
        <label class="ta-toggle-pill"><input type="checkbox" id="ta-req-random" ${cfg.request_random ? "checked" : ""}/> Randomize requests each ad</label>
      </div>
      <div class="ta-row">
        <label class="ta-field">
          <span>Min demand (random)</span>
          <select id="ta-demand">
            <option value="0"${cfg.request_demand_min === 0 ? " selected" : ""}>Any</option>
            <option value="1"${cfg.request_demand_min === 1 ? " selected" : ""}>Low+</option>
            <option value="2"${cfg.request_demand_min === 2 ? " selected" : ""}>Normal+</option>
            <option value="3"${cfg.request_demand_min === 3 ? " selected" : ""}>High+</option>
            <option value="4"${cfg.request_demand_min === 4 ? " selected" : ""}>Amazing</option>
          </select>
        </label>
        <label class="ta-field">
          <span>Offer Robux</span>
          <input type="number" id="ta-robux" min="0" step="1" value="${Number(cfg.offer_robux) || 0}" />
        </label>
      </div>
      <div class="ta-row">
        <label class="ta-toggle-pill"><input type="checkbox" id="ta-notify-post" ${cfg.notify_on_post !== false ? "checked" : ""}/> Windows notification when a trade ad posts</label>
      </div>
    </div>

    <div class="ta-schedule-card ${cfg.posting_paused ? "is-paused" : "is-live"}">
      <div class="ta-schedule-top">
        <div class="ta-schedule-copy">
          <div class="ta-schedule-status-label" id="ta-schedule-status-text">Automatic posting (${cfg.posting_paused ? "off" : "on"})</div>
          <p class="ta-schedule-next" id="ta-next-run" aria-live="polite"></p>
        </div>
        <label class="ta-schedule-switch-wrap" title="Turn automatic posting on or off">
          <span class="ta-switch">
            <input type="checkbox" id="ta-schedule-live" ${!cfg.posting_paused ? "checked" : ""} />
            <span class="ta-switch-knob" aria-hidden="true"></span>
          </span>
        </label>
      </div>

      <div class="ta-stepper-block">
        <div class="ta-stepper-label-row">
          <span class="ta-stepper-title">Minutes between posts</span>
        </div>
        <div class="ta-interval-bar">
          <button type="button" class="ta-interval-bar-btn" id="ta-min-interval" aria-label="Subtract one minute">−</button>
          <input type="number" class="ta-interval-bar-input" id="ta-interval-val" min="15" max="43200" value="${cfg.auto_interval_minutes}" inputmode="numeric" aria-label="Minutes between posts (editable)" />
          <button type="button" class="ta-interval-bar-btn" id="ta-plus-interval" aria-label="Add one minute">+</button>
        </div>
        <div class="ta-interval-caption" id="ta-interval-human"><button type="button" class="ta-caption-post-btn" id="ta-post-now">Post now</button><span class="ta-caption-duration" id="ta-interval-human-text">${escape_html(format_trade_ads_duration(cfg.auto_interval_minutes))}</span><span class="ta-caption-post-btn ta-caption-spacer" aria-hidden="true" style="visibility:hidden;pointer-events:none;">Post now</span></div>
      </div>
    </div>

    ${recent_posts_html}

    <div class="ta-row ta-final-actions" style="margin-top:14px">
      <button type="button" class="ta-btn ta-btn-ghost" id="ta-disconnect">Disconnect Rolimons</button>
    </div>
    <div class="ta-status-line" id="ta-post-status"></div>
    ${
      last_err
        ? `<div class="ta-status-line ta-err" id="ta-auto-post-err">Auto-post: ${escape_html(String(last_err).slice(0, 200))}</div>`
        : ""
    }
    <div class="ta-status-line" id="ta-last-post-at"${!last_auto ? ' style="display:none"' : ""}>${
      last_auto
        ? `Last post: ${escape_html(format_relative_time(Number(last_auto)))}`
        : ""
    }</div>
  `;

  async function trade_ads_save_and_render(patch) {
    await trade_ads_save_merged_config(patch);
    let fresh = await trade_ads_fetch_status_from_bg();
    if (fresh?.verified) await render_trade_ads_composer(root, fresh);
    else await render_trade_ads_tab();
  }

  function sync_preset_editor_ui(editor_index) {
    cfg.preset_editor_index = editor_index;
    panel.querySelectorAll(".ta-preset-chip").forEach((chip) => {
      let i = Number(chip.dataset.presetIndex) || 0;
      chip.classList.toggle("is-active", i === editor_index);
    });
    let save_btn = panel.querySelector("#ta-preset-save");
    if (save_btn) save_btn.textContent = `Save to slot ${editor_index + 1}`;
    let has_preset = !!cfg.presets[editor_index];
    let load_btn = panel.querySelector("#ta-preset-load");
    let clear_btn = panel.querySelector("#ta-preset-clear");
    if (load_btn) load_btn.disabled = !has_preset;
    if (clear_btn) clear_btn.disabled = !has_preset;
  }

  function sync_preset_rotate_ui(enabled) {
    cfg.preset_rotation_enabled = enabled;
    panel.querySelector(".ta-presets")?.classList.toggle("is-live", enabled);
    panel.querySelectorAll(".ta-preset-chip").forEach((chip) => {
      let i = Number(chip.dataset.presetIndex) || 0;
      chip.classList.toggle(
        "is-next",
        enabled && i === cfg.preset_rotation_index,
      );
    });
  }

  panel.querySelectorAll(".ta-preset-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      let index = Math.max(0, Math.min(3, Number(btn.dataset.presetIndex) || 0));
      if (index === cfg.preset_editor_index) return;
      sync_preset_editor_ui(index);
      void trade_ads_save_merged_config({ preset_editor_index: index });
    });
  });

  panel.querySelector("#ta-preset-rotate")?.addEventListener("change", (e) => {
    sync_preset_rotate_ui(e.target.checked);
    void trade_ads_save_merged_config({
      preset_rotation_enabled: e.target.checked,
    });
  });

  panel.querySelector("#ta-preset-save")?.addEventListener("click", async () => {
    let presets = trade_ads_normalize_presets_local(cfg.presets);
    presets[cfg.preset_editor_index] = trade_ads_preset_from_config(
      cfg,
      cfg.preset_editor_index,
    );
    await trade_ads_save_and_render({
      presets,
      preset_editor_index: cfg.preset_editor_index,
      preset_rotation_index: filled_preset_count
        ? cfg.preset_rotation_index
        : cfg.preset_editor_index,
    });
  });

  panel.querySelector("#ta-preset-load")?.addEventListener("click", async () => {
    let preset = cfg.presets[cfg.preset_editor_index];
    if (!preset) return;
    await trade_ads_save_and_render({
      offer_slots: preset.offer_slots,
      request_slots: preset.request_slots,
      offer_random: preset.offer_random,
      request_random: preset.request_random,
      request_demand_min: preset.request_demand_min,
      offer_robux: preset.offer_robux,
      request_tags: preset.request_tags || [],
      preset_editor_index: cfg.preset_editor_index,
    });
  });

  panel.querySelector("#ta-preset-clear")?.addEventListener("click", async () => {
    let presets = trade_ads_normalize_presets_local(cfg.presets);
    presets[cfg.preset_editor_index] = null;
    let next_rotation = presets[cfg.preset_rotation_index]
      ? cfg.preset_rotation_index
      : presets.findIndex(Boolean);
    await trade_ads_save_and_render({
      presets,
      preset_editor_index: cfg.preset_editor_index,
      preset_rotation_index: next_rotation >= 0 ? next_rotation : 0,
    });
  });

  panel
    .querySelectorAll('.ta-slot[data-side="offer"]:not([data-random="1"])')
    .forEach((el) => {
      el.addEventListener("click", () => {
        if (cfg.offer_random) return;
        let idx = Number(el.dataset.index);
        let status_line = panel.querySelector("#ta-post-status");
        let pick_opts = {
          side: "offer",
          index: idx,
          onInventoryError: (msg) => {
            status_line.textContent = msg;
            status_line.className = "ta-status-line ta-err";
          },
          onPick: async (id) => {
            let slots = cfg.offer_slots.slice();
            slots[idx] = id;
            void render_trade_ads_composer(root, {
              ...status,
              config: { ...(status.config || {}), offer_slots: slots },
              slot_item_metrics: { ...(status.slot_item_metrics || {}) },
              last_auto_error: null,
            });
            await trade_ads_save_merged_config({ offer_slots: slots });
            let fresh = await trade_ads_fetch_status_from_bg();
            if (!fresh?.verified) {
              await render_trade_ads_tab();
              return;
            }
            await render_trade_ads_composer(root, {
              ...fresh,
              last_auto_error: null,
            });
          },
        };
        if (trade_ads_inventory_session_items != null) {
          pick_opts.inventory = trade_ads_inventory_session_items;
        } else {
          pick_opts.inventoryPromise = trade_ads_load_inventory_session();
        }
        trade_ads_attach_picker(root, pick_opts);
      });
    });

  root
    .querySelectorAll('.ta-slot[data-side="request"]:not([data-random="1"])')
    .forEach((el) => {
      el.addEventListener("click", async () => {
        if (cfg.request_random) return;
        let idx = Number(el.dataset.index);
        trade_ads_attach_picker(root, {
          side: "request",
          index: idx,
          inventory: [],
          requestSlots: cfg.request_slots || [],
          slotIndex: idx,
          onPick: async (id) => {
            if (
              typeof id === "string" &&
              id.startsWith("tag:") &&
              trade_ads_request_tag_used_in_slots(
                cfg.request_slots || [],
                id.slice(4),
                idx,
              )
            ) {
              let status_line = panel.querySelector("#ta-post-status");
              if (status_line) {
                status_line.textContent =
                  "Each tag can only be used once (Rolimons allows one per ad).";
                status_line.className = "ta-status-line ta-err";
              }
              return;
            }
            let slots = cfg.request_slots.slice();
            slots[idx] = id;
            void render_trade_ads_composer(root, {
              ...status,
              config: { ...(status.config || {}), request_slots: slots },
              slot_item_metrics: { ...(status.slot_item_metrics || {}) },
            });
            await trade_ads_save_merged_config({ request_slots: slots });
            let fresh = await trade_ads_fetch_status_from_bg();
            if (!fresh?.verified) {
              await render_trade_ads_tab();
              return;
            }
            await render_trade_ads_composer(root, fresh);
          },
        });
      });
    });

  panel.querySelectorAll(".ta-slot-clear").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      let side = btn.dataset.side;
      let idx = Number(btn.dataset.index);
      if (side === "offer") {
        let slots = cfg.offer_slots.slice();
        let prevId = slots[idx];
        slots[idx] = null;
        let sm = { ...(status.slot_item_metrics || {}) };
        if (prevId != null) delete sm[String(prevId)];
        void render_trade_ads_composer(root, {
          ...status,
          config: { ...(status.config || {}), offer_slots: slots },
          slot_item_metrics: sm,
        });
        void trade_ads_save_merged_config({ offer_slots: slots }).then(
          async () => {
            let fresh = await trade_ads_fetch_status_light_from_bg();
            if (!fresh?.verified) {
              await render_trade_ads_tab();
              return;
            }
            await render_trade_ads_composer(root, fresh);
          },
        );
      } else {
        let slots = cfg.request_slots.slice();
        let prevId = slots[idx];
        slots[idx] = null;
        let sm = { ...(status.slot_item_metrics || {}) };
        if (prevId != null) delete sm[String(prevId)];
        void render_trade_ads_composer(root, {
          ...status,
          config: { ...(status.config || {}), request_slots: slots },
          slot_item_metrics: sm,
        });
        void trade_ads_save_merged_config({ request_slots: slots }).then(
          async () => {
            let fresh = await trade_ads_fetch_status_light_from_bg();
            if (!fresh?.verified) {
              await render_trade_ads_tab();
              return;
            }
            await render_trade_ads_composer(root, fresh);
          },
        );
      }
    });
  });

  root
    .querySelector("#ta-offer-random")
    .addEventListener("change", async (e) => {
      await trade_ads_save_merged_config({ offer_random: e.target.checked });
      let fresh = await trade_ads_fetch_status_from_bg();
      if (fresh?.verified) await render_trade_ads_composer(root, fresh);
      else await render_trade_ads_tab();
    });

  panel
    .querySelector("#ta-req-random")
    .addEventListener("change", async (e) => {
      await trade_ads_save_merged_config({ request_random: e.target.checked });
      let fresh = await trade_ads_fetch_status_from_bg();
      if (fresh?.verified) await render_trade_ads_composer(root, fresh);
      else await render_trade_ads_tab();
    });

  panel.querySelector("#ta-demand").addEventListener("change", async (e) => {
    await trade_ads_save_merged_config({
      request_demand_min: Number(e.target.value),
    });
    let fresh = await trade_ads_fetch_status_from_bg();
    if (fresh?.verified) await render_trade_ads_composer(root, fresh);
    else await render_trade_ads_tab();
  });

  panel.querySelector("#ta-robux").addEventListener("change", async (e) => {
    await trade_ads_save_merged_config({
      offer_robux: Math.max(0, Number(e.target.value) || 0),
    });
    let fresh = await trade_ads_fetch_status_from_bg();
    if (fresh?.verified)
      await render_trade_ads_composer(root, {
        ...fresh,
        last_auto_error: null,
      });
    else await render_trade_ads_tab();
  });

  root
    .querySelector("#ta-notify-post")
    .addEventListener("change", async (e) => {
      if (e.target.checked) {
        let granted = await maybe_request_notifications();
        if (!granted) {
          e.target.checked = false;
          cfg = await trade_ads_save_merged_config({ notify_on_post: false });
          return;
        }
      }
      cfg = await trade_ads_save_merged_config({
        notify_on_post: e.target.checked,
      });
    });

  function refresh_trade_ads_next_run(root_el, paused, initial_due_at) {
    clear_trade_ads_countdown_timer();
    let el = root_el.querySelector("#ta-next-run");
    if (!el) return;
    if (paused) {
      el.textContent = "";
      globalThis.__nte_trade_ads_due_at = null;
      return;
    }

    globalThis.__nte_trade_ads_due_at =
      typeof initial_due_at === "number" && Number.isFinite(initial_due_at)
        ? initial_due_at
        : null;

    function tick() {
      let due = globalThis.__nte_trade_ads_due_at;
      if (typeof due === "number" && Number.isFinite(due) && due > Date.now()) {
        el.textContent = format_trade_ad_countdown(due - Date.now());
        return;
      }
      chrome.alarms.get(trade_ads_alarm_name_popup, (a) => {
        if (chrome.runtime.lastError || !a?.scheduledTime) {
          el.textContent = "";
          return;
        }
        let ms = a.scheduledTime - Date.now();
        el.textContent = format_trade_ad_countdown(ms);
      });
    }

    tick();
    globalThis.__nte_trade_ads_cd_timer = setInterval(tick, 1000);
  }

  function sync_schedule_ui() {
    let paused = !!cfg.posting_paused;
    let card = panel.querySelector(".ta-schedule-card");
    if (card) {
      card.classList.toggle("is-paused", paused);
      card.classList.toggle("is-live", !paused);
    }
    let status_lbl = panel.querySelector("#ta-schedule-status-text");
    if (status_lbl)
      status_lbl.textContent = paused
        ? "Automatic posting (off)"
        : "Automatic posting (on)";
    let sw = panel.querySelector("#ta-schedule-live");
    if (sw) sw.checked = !paused;
    let v = panel.querySelector("#ta-interval-val");
    if (v) v.value = String(cfg.auto_interval_minutes);
    let hum = panel.querySelector("#ta-interval-human-text");
    if (hum)
      hum.textContent = format_trade_ads_duration(cfg.auto_interval_minutes);
    let minus = panel.querySelector("#ta-min-interval");
    if (minus)
      minus.disabled =
        cfg.auto_interval_minutes <= trade_ads_interval_min_popup;
    refresh_trade_ads_next_run(root, paused, status.next_auto_post_due_at);
  }

  sync_schedule_ui();

  root
    .querySelector("#ta-schedule-live")
    .addEventListener("change", async (e) => {
      cfg = await trade_ads_save_merged_config({
        posting_paused: !e.target.checked,
      });
      sync_schedule_ui();
    });

  async function bump_interval(delta) {
    let next = Math.max(
      trade_ads_interval_min_popup,
      Math.min(trade_ads_interval_max_popup, cfg.auto_interval_minutes + delta),
    );
    if (next === cfg.auto_interval_minutes) return;
    cfg = await trade_ads_save_merged_config({ auto_interval_minutes: next });
    sync_schedule_ui();
  }

  root
    .querySelector("#ta-min-interval")
    .addEventListener("click", () => bump_interval(-1));
  root
    .querySelector("#ta-plus-interval")
    .addEventListener("click", () => bump_interval(1));

  let interval_input = panel.querySelector("#ta-interval-val");
  interval_input.addEventListener("focus", () => interval_input.select());
  interval_input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      interval_input.blur();
    }
  });
  interval_input.addEventListener("blur", async () => {
    let n = Math.floor(Number(interval_input.value));
    if (!Number.isFinite(n)) {
      interval_input.value = String(cfg.auto_interval_minutes);
      return;
    }
    n = Math.max(
      trade_ads_interval_min_popup,
      Math.min(trade_ads_interval_max_popup, n),
    );
    if (n === cfg.auto_interval_minutes) {
      interval_input.value = String(n);
      return;
    }
    cfg = await trade_ads_save_merged_config({ auto_interval_minutes: n });
    sync_schedule_ui();
  });

  panel.querySelector("#ta-post-now").addEventListener("click", async () => {
    let btn = panel.querySelector("#ta-post-now");
    let line = panel.querySelector("#ta-post-status");
    btn.disabled = true;
    line.textContent = "Posting…";
    line.className = "ta-status-line";
    if (cfg.notify_on_post !== false) await maybe_request_notifications();
    let res = await new Promise((resolve) =>
      chrome.runtime.sendMessage({ type: "trade_ads_post" }, resolve),
    );
    btn.disabled = false;
    if (res?.ok) {
      let pid = res.player_id ?? res.body?.player_id;
      let url = pid
        ? `https://www.rolimons.com/playertrades/${encodeURIComponent(String(pid))}`
        : "https://www.rolimons.com/tradeads";
      let fresh = await trade_ads_fetch_status_from_bg();
      if (fresh?.verified) {
        await render_trade_ads_composer(root, fresh);
      }
      requestAnimationFrame(() => {
        let line2 = panel.querySelector("#ta-post-status");
        if (line2) {
          line2.innerHTML = `Posted. <a href="${url}" target="_blank" rel="noopener noreferrer">View trade ad</a>`;
          line2.className = "ta-status-line ta-ok";
        }
      });
    } else {
      line.textContent = res?.error || "Failed";
      line.className = "ta-status-line ta-err";
    }
  });

  panel.querySelector("#ta-disconnect").addEventListener("click", async () => {
    trade_ads_reset_inventory_session();
    await new Promise((resolve) =>
      chrome.runtime.sendMessage({ type: "trade_ads_disconnect" }, resolve),
    );
    await trade_ads_merge_verify_ui({ step: "idle", phrase: "", error: "" });
    render_trade_ads_tab();
  });

  let recent_toggle = panel.querySelector("#ta-recent-toggle");
  if (recent_toggle) {
    recent_toggle.addEventListener("click", () => {
      let list = panel.querySelector("#ta-recent-list");
      let chevron = recent_toggle.querySelector(".ta-recent-chevron");
      if (!list) return;
      let open = list.classList.toggle("is-open");
      if (chevron) chevron.style.transform = open ? "rotate(180deg)" : "";
    });
  }

  layout_root.dataset.taActiveCategory = saved_category;
  trade_ads_bind_category_picks(layout_root);
  if (saved_category === "notifs") {
    trade_ads_mount_notifications_panel(layout_root);
  }

  {
    let prev = globalThis.__nte_trade_ads_storage_listener;
    if (prev) {
      try {
        chrome.storage.onChanged.removeListener(prev);
      } catch {}
    }
    function nte_trade_ads_storage_sync(changes, area) {
      if (area !== "local") return;
      if (changes.trade_ads_last_auto_error) {
        let nv = changes.trade_ads_last_auto_error.newValue;
        if (nv == null || nv === "")
          document.getElementById("ta-auto-post-err")?.remove();
      }
      if (changes.trade_ads_last_auto_post_at?.newValue) {
        let lp = document.getElementById("ta-last-post-at");
        let at = changes.trade_ads_last_auto_post_at.newValue;
        if (lp && at) {
          lp.style.display = "";
          lp.textContent = `Last post: ${format_relative_time(Number(at))}`;
        }
      }
      if (
        changes.trade_ads_last_auto_post_at ||
        changes[trade_ads_config_storage_key] ||
        changes.trade_ads_schedule_anchor_at
      ) {
        chrome.runtime.sendMessage({ type: "trade_ads_get_next_due" }, (r) => {
          if (chrome.runtime.lastError) return;
          if (
            r &&
            typeof r.next_auto_post_due_at === "number" &&
            Number.isFinite(r.next_auto_post_due_at)
          ) {
            globalThis.__nte_trade_ads_due_at = r.next_auto_post_due_at;
          }
        });
      }
    }
    globalThis.__nte_trade_ads_storage_listener = nte_trade_ads_storage_sync;
    chrome.storage.onChanged.addListener(nte_trade_ads_storage_sync);
  }

  void trade_ads_fill_thumbnails(root);
}

async function render_trade_ads_verify_flow(root, status, vu) {
  let layout_root = trade_ads_get_layout_root(root) || root;
  let panel = trade_ads_resolve_posting_panel(layout_root);
  if (!panel) return;
  let step = vu.step || "idle";

  if (step === "loading") {
    panel.innerHTML = `
      <p class="ta-lede">Verifying…</p>
      <div class="ta-shimmer"></div>
    `;
    let r = await new Promise((resolve) =>
      chrome.runtime.sendMessage({ type: "trade_ads_auto_verify" }, resolve),
    );
    if (!r?.ok) {
      let err = r?.error || "Verification failed";
      let phrase = String(r?.phrase || "");
      if (/sign in/i.test(err)) {
        await trade_ads_merge_verify_ui({
          step: "idle",
          error: err,
          phrase: "",
        });
      } else {
        if (!phrase) {
          let p = await new Promise((resolve) =>
            chrome.runtime.sendMessage({ type: "trade_ads_get_phrase" }, resolve),
          );
          if (p?.ok) phrase = String(p.phrase || "");
        }
        await trade_ads_merge_verify_ui({
          step: "manual",
          error: err,
          phrase,
        });
      }
      vu = (await get_storage([trade_ads_verify_storage_key]))[
        trade_ads_verify_storage_key
      ];
      return render_trade_ads_verify_flow(root, status, vu);
    }
    await trade_ads_merge_verify_ui({ step: "idle", error: "" });
    return render_trade_ads_tab();
  }

  let name = escape_html(status.roblox?.name || "");
  let phrase = String(vu.phrase || "");
  if (step === "manual" || (vu.error && phrase)) {
    panel.innerHTML = `
      <div class="ta-card">
        <div class="ta-card-head" style="align-items:center;margin-bottom:14px;">
          <div class="ta-card-title">Rolimons Trade Ads</div>
          ${name ? `<div class="ta-user-pill">${name}</div>` : ""}
        </div>
        ${vu.error ? `<div class="ta-status-line ta-err" style="margin-bottom:10px">${escape_html(vu.error)}</div>` : ""}
        <p class="ta-lede">Add this phrase to your Roblox profile About, save, wait a few seconds, then check.</p>
        ${
          phrase
            ? `<div class="ta-phrase-box" id="ta-phrase-text">${escape_html(phrase)}</div>
        <div class="ta-verify-actions">
          <button type="button" class="ta-btn ta-btn-secondary" id="ta-copy-phrase">Copy phrase</button>
          <a class="ta-btn ta-btn-secondary" id="ta-open-profile" href="https://www.roblox.com/users/profile" target="_blank" rel="noopener">Open profile</a>
        </div>`
            : ""
        }
        <button type="button" class="ta-btn ta-btn-primary" id="ta-verify-now" style="width:100%;margin-top:10px;">I've added it</button>
        <button type="button" class="ta-btn ta-btn-secondary" id="ta-auto-verify" style="width:100%;margin-top:8px;">Try auto again</button>
      </div>
    `;
    let copy_btn = panel.querySelector("#ta-copy-phrase");
    if (copy_btn) {
      copy_btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(phrase);
          copy_btn.textContent = "Copied";
          setTimeout(() => {
            copy_btn.textContent = "Copy phrase";
          }, 1200);
        } catch {}
      });
    }
    panel.querySelector("#ta-verify-now")?.addEventListener("click", async () => {
      let btn = panel.querySelector("#ta-verify-now");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Checking…";
      }
      let r = await new Promise((resolve) =>
        chrome.runtime.sendMessage({ type: "trade_ads_verify_now" }, resolve),
      );
      if (!r?.ok) {
        await trade_ads_merge_verify_ui({
          step: "manual",
          error: r?.error || "Verification failed",
          phrase,
        });
        vu = (await get_storage([trade_ads_verify_storage_key]))[
          trade_ads_verify_storage_key
        ];
        return render_trade_ads_verify_flow(root, status, vu);
      }
      await trade_ads_merge_verify_ui({
        step: "idle",
        error: "",
        phrase: "",
      });
      return render_trade_ads_tab();
    });
    panel.querySelector("#ta-auto-verify")?.addEventListener("click", async () => {
      await trade_ads_merge_verify_ui({ step: "loading", error: "" });
      render_trade_ads_verify_flow(layout_root, status, { step: "loading" });
    });
    return;
  }

  panel.innerHTML = `
    <div class="ta-card">
      <div class="ta-card-head" style="align-items:center;margin-bottom:14px;">
        <div class="ta-card-title">Rolimons Trade Ads</div>
        ${name ? `<div class="ta-user-pill">${name}</div>` : ""}
      </div>
      ${vu.error ? `<div class="ta-status-line ta-err" style="margin-bottom:10px">${escape_html(vu.error)}</div>` : ""}
      <button type="button" class="ta-btn ta-btn-primary" id="ta-auto-verify" style="width:100%;">Start Posting</button>
    </div>
  `;
  panel.querySelector("#ta-auto-verify").addEventListener("click", async () => {
    await trade_ads_merge_verify_ui({ step: "loading", error: "" });
    render_trade_ads_verify_flow(layout_root, status, { step: "loading" });
  });
}

async function render_trade_ads_tab() {
  const layout_root = document.getElementById("trade-ads-root");
  if (!layout_root) return;

  clear_trade_ads_countdown_timer();
  layout_root.innerHTML = `<p class="ta-lede">Loading…</p>`;
  chrome.runtime.sendMessage("getData", () => {
    chrome.runtime.lastError;
  });

  let status = await new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: "trade_ads_get_status" }, resolve),
  );

  let active = trade_ads_get_active_category(layout_root);
  if (!status?.roblox) {
    trade_ads_ensure_category_layout(layout_root, active);
    let panel = layout_root.querySelector("#ta-posting-inner");
    if (panel) {
      panel.innerHTML = `<p class="ta-lede">Sign in to Roblox in this browser, then reopen this tab.</p>`;
    }
    return;
  }

  trade_ads_ensure_category_layout(layout_root, active);

  if (status.verified) {
    await render_trade_ads_composer(layout_root, status);
    return;
  }

  let vu =
    (await get_storage([trade_ads_verify_storage_key]))[
      trade_ads_verify_storage_key
    ] || {};
  await render_trade_ads_verify_flow(layout_root, status, vu);
}

async function refresh_all_panels() {
  await render_options();
  await render_trade_ads_tab();
}

function build_option_search_text(...parts) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[()]/g, " ");
}

function apply_options_search(query = "") {
  let needle = String(query || "")
    .trim()
    .toLowerCase();
  let empty = !needle;
  let any_visible = false;
  for (let section of document.querySelectorAll(
    "#options-container .option-section",
  )) {
    let section_title = section.dataset.sectionTitle || "";
    let section_match = !empty && section_title.includes(needle);
    let visible_rows = 0;
    for (let row of section.querySelectorAll(".option-row")) {
      let hay = row.dataset.optionSearch || "";
      let match = empty || section_match || hay.includes(needle);
      row.hidden = !match;
      if (match) visible_rows++;
    }
    let show_section = empty || section_match || visible_rows > 0;
    section.hidden = !show_section;
    if (!empty && show_section) {
      let header = section.querySelector(".section-header");
      let options_el = section.querySelector(".section-options");
      header?.classList.remove("collapsed");
      options_el?.classList.remove("collapsed");
    }
    if (show_section && (empty || visible_rows > 0 || section_match))
      any_visible = true;
  }
  for (let card of document.querySelectorAll(
    "#options-container .nte-totp-card, #options-container .nte-theme-card",
  )) {
    let hay = card.dataset.optionSearch || "";
    let match = empty || hay.includes(needle);
    card.hidden = !match;
    if (match) any_visible = true;
  }
  let empty_el = document.getElementById("options-search-empty");
  if (empty_el) empty_el.hidden = empty || any_visible;
}

function ensure_options_search_bar() {
  let input = document.getElementById("options-search");
  if (!input || input.dataset.bound === "1") return;
  input.dataset.bound = "1";
  let timer = 0;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => apply_options_search(input.value), 80);
  });
  input.addEventListener("search", () => apply_options_search(input.value));
}

const ROBLOX_TOTP_ENABLED_KEY = "roblox_totp_autofill_enabled";
const ROBLOX_TOTP_SECRET_KEY = "roblox_totp_secret_b32";
const ROBLOX_TOTP_MODE_KEY = "roblox_totp_storage_mode";
const ROBLOX_TOTP_ENC_KEY = "roblox_totp_encrypted_blob";
const ROBLOX_TOTP_ENC_VERSION = 1;
const ROBLOX_TOTP_PBKDF2_ITER = 210000;

function totp_bytes_to_b64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function totp_b64_to_bytes(s) {
  const bin = atob(String(s).replace(/\s/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function totp_derive_aes_key(password, salt_bytes, usages) {
  const enc = new TextEncoder();
  const key_material = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt_bytes,
      iterations: ROBLOX_TOTP_PBKDF2_ITER,
      hash: "SHA-256",
    },
    key_material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

async function totp_encrypt_secret(plain_secret, password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aes_key = await totp_derive_aes_key(password, salt, ["encrypt"]);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aes_key,
    enc.encode(String(plain_secret).trim()),
  );
  return {
    v: ROBLOX_TOTP_ENC_VERSION,
    saltB64: totp_bytes_to_b64(salt),
    ivB64: totp_bytes_to_b64(iv),
    ctB64: totp_bytes_to_b64(new Uint8Array(ct)),
  };
}

async function totp_decrypt_secret(blob, password) {
  if (
    !blob ||
    blob.v !== ROBLOX_TOTP_ENC_VERSION ||
    !blob.saltB64 ||
    !blob.ivB64 ||
    !blob.ctB64
  )
    throw new Error("bad blob");
  const salt = totp_b64_to_bytes(blob.saltB64);
  const iv = totp_b64_to_bytes(blob.ivB64);
  const ct = totp_b64_to_bytes(blob.ctB64);
  const aes_key = await totp_derive_aes_key(password, salt, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aes_key, ct);
  return new TextDecoder().decode(pt).trim();
}

function totp_snapshot_is_encrypted(snap) {
  const b = snap[ROBLOX_TOTP_ENC_KEY];
  if (snap[ROBLOX_TOTP_MODE_KEY] === "encrypted") return true;
  return !!(
    b &&
    b.v === ROBLOX_TOTP_ENC_VERSION &&
    b.saltB64 &&
    b.ivB64 &&
    b.ctB64
  );
}

async function render_options() {
  const container = document.getElementById("options-container");
  container.innerHTML = "";

  await append_options_prompt_banner(container, {
    storageKey: nte_discord_banner_dismissed_key,
    className: "nte-discord-banner",
    closeSelector: ".nte-discord-banner-close",
    html: `
      <div class="nte-discord-banner-text">
        <svg width="16" height="12" viewBox="0 0 71 55" fill="currentColor"><path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2886 15.4057 2.8184 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5132 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5856C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2784 53.4831 44.2897 53.5502 44.3432C53.9057 44.6362 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5856C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9047 48.4172 48.969 48.5383C50.039 50.6034 51.2564 52.5699 52.5951 54.435C52.6519 54.5132 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.98527C60.1772 4.94286 60.1436 4.91469 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1346 26.2524 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7637 23.0133 47.3178 23.0133C50.9 23.0133 53.7266 26.2524 53.6985 30.1693C53.6985 34.1136 50.9 37.3253 47.3178 37.3253Z"/></svg>
        <span>Join our <a href="https://discord.gg/4XWE7yy2uE" target="_blank" rel="noopener noreferrer">Discord</a> for support and updates</span>
      </div>
      <button type="button" class="nte-discord-banner-close" title="Dismiss">×</button>
    `,
  });

  let store = get_extension_store_review_info();
  if (store) {
    await append_options_prompt_banner(container, {
      storageKey: nte_rate_banner_dismissed_key,
      className: "nte-rate-banner",
      closeSelector: ".nte-rate-banner-close",
      html: `
        <div class="nte-rate-banner-text">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          <span>Enjoying the extension? <a href="${escape_html_attr(store.url)}" data-open-new-tab="true" rel="noopener noreferrer">Leave a quick review</a> on the ${escape_html(store.label)} if you like it.</span>
        </div>
        <button type="button" class="nte-rate-banner-close" title="Dismiss">×</button>
      `,
    });
  }

  const option_names = [
    ...get_option_names(),
    profile_value_display_mode_key,
    ownership_link_provider_key,
    counter_trade_choice_mode_key,
    legacy_counter_trade_prompt_option_name,
  ];
  let saved = await get_storage([
    ...option_names,
    legacy_colorblind_mode_option_name,
    legacy_post_tax_trade_value_option_name,
    colorblind_mode_profile_key,
    inbound_trade_notification_min_gain_key,
    inbound_trade_notification_webhook_enabled_key,
    inbound_trade_notification_webhook_url_key,
    inbound_trade_notification_webhook_ping_enabled_key,
    inbound_trade_notification_webhook_discord_id_key,
    duplicate_trade_warning_hours_key,
    trade_page_theme_enabled_key,
    trade_page_theme_key,
    trade_page_custom_themes_key,
  ]);
  saved = await ensure_colorblind_mode_settings(saved);
  saved = await ensure_counter_trade_choices_settings(saved);
  const totp_snapshot = await new Promise((resolve) => {
    chrome.storage.local.get(
      [
        ROBLOX_TOTP_ENABLED_KEY,
        ROBLOX_TOTP_SECRET_KEY,
        ROBLOX_TOTP_MODE_KEY,
        ROBLOX_TOTP_ENC_KEY,
      ],
      (r) => {
        resolve(r && typeof r === "object" ? r : {});
      },
    );
  });

  let current_section = null;
  let current_options_el = null;
  let section_option_count = 0;

  for (const item of option_groups) {
    if (typeof item === "string") {
      if (current_section) {
        const badge = current_section.querySelector(".section-count");
        if (badge) badge.textContent = section_option_count;
      }

      section_option_count = 0;
      const section = document.createElement("div");
      section.className = `option-section ${section_classes[item] || ""}`;
      section.dataset.sectionTitle = String(item).toLowerCase();

      const header = document.createElement("div");
      header.className = "section-header";
      header.innerHTML = `
        <span class="section-title">${escape_html(item)}</span>
        <span class="section-count">0</span>
        <span class="section-chevron">${chevron_svg}</span>
      `;

      const options_el = document.createElement("div");
      options_el.className = "section-options";

      header.addEventListener("click", () => {
        header.classList.toggle("collapsed");
        options_el.classList.toggle("collapsed");
      });

      section.append(header, options_el);
      container.append(section);

      current_section = section;
      current_options_el = options_el;
      continue;
    }

    if (item.name === "Mobile Trade Items Button" && !is_mobile_browser())
      continue;
    let value =
      item.name === colorblind_mode_option_name
        ? get_saved_colorblind_mode_value(saved)
        : saved[item.name];
    if (
      item.name === post_tax_trade_values_option_name &&
      value === undefined &&
      saved[legacy_post_tax_trade_value_option_name] !== undefined
    ) {
      value = saved[legacy_post_tax_trade_value_option_name];
    }
    if (
      item.name === counter_trade_choices_option_name &&
      value === undefined &&
      saved[legacy_counter_trade_prompt_option_name] !== undefined
    ) {
      value = saved[legacy_counter_trade_prompt_option_name];
    }
    if (value === undefined) value = item.enabledByDefault;

    current_options_el.append(
      create_option_row(item, value, {
        colorblind_mode_profile: saved[colorblind_mode_profile_key],
        inbound_trade_min_gain: saved[inbound_trade_notification_min_gain_key],
        duplicate_trade_warning_hours: saved[duplicate_trade_warning_hours_key],
        profile_value_display_mode: saved[profile_value_display_mode_key],
        ownership_link_provider: saved[ownership_link_provider_key],
        counter_trade_choice_mode: saved[counter_trade_choice_mode_key],
      }),
    );
    section_option_count++;
  }

  if (current_section) {
    const badge = current_section.querySelector(".section-count");
    if (badge) badge.textContent = section_option_count;
  }

  append_roblox_totp_card(container, totp_snapshot);
  append_trade_page_theme_card(container, {
    enabled: saved[trade_page_theme_enabled_key],
    theme: saved[trade_page_theme_key],
    custom_themes: saved[trade_page_custom_themes_key],
  });
  ensure_options_search_bar();
  apply_options_search(document.getElementById("options-search")?.value || "");
}

function append_roblox_totp_card(container, totp_snapshot = {}) {
  const card = document.createElement("div");
  card.className = "nte-totp-card";

  card.innerHTML = `
    <div class="nte-totp-header">
      <button type="button" class="nte-totp-expand collapsed" id="nte-totp-expand" aria-expanded="false" aria-controls="nte-totp-expanded">
        <span class="nte-totp-heading-copy">
          <span class="nte-totp-title">Roblox 2FA Autofill</span>
          <span class="nte-totp-sub">Autofill the authenticator 2FA Prompts</span>
        </span>
        <span class="nte-totp-expand-chev" aria-hidden="true"></span>
      </button>
    </div>
    <div class="nte-totp-expanded" id="nte-totp-expanded" hidden>
      <div class="nte-totp-enable-row">
        <span>Enable autofill</span>
        <label class="toggle nte-totp-enable-toggle" title="Enable Roblox 2FA Autofill">
          <input type="checkbox" id="nte-totp-enabled" />
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </label>
      </div>
      <p class="nte-totp-hint">Paste your Roblox 2FA <strong>secret</strong> to auto-fill 2FA challenges. Treat it like a password - do not share it with anybody.</p>
      <div id="nte-totp-pw-toggle-row" class="nte-totp-pw-toggle-row" hidden>
        <button type="button" class="nte-totp-pw-reveal-btn" id="nte-totp-pw-toggle" aria-expanded="false">
          <span class="nte-totp-pw-reveal-icon" aria-hidden="true"></span>
          <span class="nte-totp-pw-reveal-text">
            <span class="nte-totp-pw-reveal-label" id="nte-totp-pw-reveal-label">Set lock password</span>
            <span class="nte-totp-pw-reveal-hint" id="nte-totp-pw-reveal-hint">Tap to enter passwords - not shown until you open this</span>
          </span>
          <span class="nte-totp-pw-reveal-chev" aria-hidden="true"></span>
        </button>
      </div>
      <div id="nte-totp-pw-panel" class="nte-totp-pw-panel" hidden>
        <div id="nte-totp-curpw-wrap" class="nte-totp-pw-block" hidden>
          <label class="nte-totp-label" for="nte-totp-curpw">Current lock password</label>
          <input type="password" id="nte-totp-curpw" class="nte-totp-input" autocomplete="off" spellcheck="false" placeholder="Required to remove lock or change lock password" />
        </div>
        <div id="nte-totp-newpw-wrap" class="nte-totp-pw-block" hidden>
          <label class="nte-totp-label" for="nte-totp-newpw">New lock password</label>
          <input type="password" id="nte-totp-newpw" class="nte-totp-input" autocomplete="off" spellcheck="false" placeholder="Choose a strong password" />
          <label class="nte-totp-label" for="nte-totp-newpw2">Confirm new lock password</label>
          <input type="password" id="nte-totp-newpw2" class="nte-totp-input" autocomplete="off" spellcheck="false" placeholder="Same as above" />
        </div>
      </div>
      <label class="nte-totp-label" for="nte-totp-secret">Secret (Base32)</label>
      <input type="password" id="nte-totp-secret" class="nte-totp-input" autocomplete="off" spellcheck="false" placeholder="Leave blank to keep saved secret" />
      <div id="nte-totp-protect-prompt" class="nte-totp-protect-prompt" hidden>
        <span>Protect this secret with a password?</span>
        <button type="button" class="nte-totp-btn" id="nte-totp-protect-yes">Save with password</button>
        <button type="button" class="nte-totp-btn nte-totp-btn-ghost" id="nte-totp-protect-no">Save without password</button>
      </div>
      <div class="nte-totp-actions">
        <button type="button" class="nte-totp-btn" id="nte-totp-save">Save</button>
        <button type="button" class="nte-totp-btn nte-totp-btn-ghost" id="nte-totp-clear">Clear secret</button>
      </div>
      <p class="nte-totp-status" id="nte-totp-status" aria-live="polite"></p>
    </div>
  `;

  container.append(card);
  card.dataset.optionSearch = build_option_search_text(
    "roblox 2fa autofill totp secret authenticator",
  );

  const enabled_el = card.querySelector("#nte-totp-enabled");
  const expand_btn = card.querySelector("#nte-totp-expand");
  const expanded_el = card.querySelector("#nte-totp-expanded");
  const pw_toggle_row = card.querySelector("#nte-totp-pw-toggle-row");
  const pw_toggle_btn = card.querySelector("#nte-totp-pw-toggle");
  const pw_panel = card.querySelector("#nte-totp-pw-panel");
  const pw_reveal_label = card.querySelector("#nte-totp-pw-reveal-label");
  const pw_reveal_hint = card.querySelector("#nte-totp-pw-reveal-hint");
  const cur_pw_wrap = card.querySelector("#nte-totp-curpw-wrap");
  const new_pw_wrap = card.querySelector("#nte-totp-newpw-wrap");
  const cur_pw_el = card.querySelector("#nte-totp-curpw");
  const new_pw_el = card.querySelector("#nte-totp-newpw");
  const new_pw2_el = card.querySelector("#nte-totp-newpw2");
  const secret_el = card.querySelector("#nte-totp-secret");
  const protect_prompt = card.querySelector("#nte-totp-protect-prompt");
  const protect_yes_btn = card.querySelector("#nte-totp-protect-yes");
  const protect_no_btn = card.querySelector("#nte-totp-protect-no");
  const save_btn = card.querySelector("#nte-totp-save");
  const clear_btn = card.querySelector("#nte-totp-clear");
  const status_el = card.querySelector("#nte-totp-status");

  let pw_panel_open = false;
  let pending_secret = "";
  let pending_protect = false;
  let pending_encrypt = false;

  let enc_blob = totp_snapshot[ROBLOX_TOTP_ENC_KEY];
  let is_encrypted = totp_snapshot_is_encrypted(totp_snapshot);

  let has_plain =
    typeof totp_snapshot[ROBLOX_TOTP_SECRET_KEY] === "string" &&
    totp_snapshot[ROBLOX_TOTP_SECRET_KEY].trim().length > 0;
  const has_secret = has_plain || is_encrypted;
  const stored_on = totp_snapshot[ROBLOX_TOTP_ENABLED_KEY] === true;
  const stored_off = totp_snapshot[ROBLOX_TOTP_ENABLED_KEY] === false;
  enabled_el.checked = stored_on || (!stored_off && has_secret);

  function set_totp_expanded(open) {
    expanded_el.hidden = !open;
    expand_btn.setAttribute("aria-expanded", open ? "true" : "false");
    expand_btn.classList.toggle("collapsed", !open);
    card.classList.toggle("is-expanded", open);
  }

  expand_btn.addEventListener("click", () => {
    set_totp_expanded(expanded_el.hidden);
  });

  function update_pw_copy() {
    if (pending_encrypt) {
      pw_reveal_label.textContent = "Set lock password";
      pw_reveal_hint.textContent =
        "Enter a password, then Save to store encrypted";
    } else if (is_encrypted) {
      pw_reveal_label.textContent = "Change lock password";
      pw_reveal_hint.textContent =
        "Open to enter current password and a new one, or replace the 2FA secret";
    } else {
      pw_reveal_label.textContent = "Set lock password";
      pw_reveal_hint.textContent =
        "Open to choose a password - it is never stored by the extension";
    }
  }

  function sync_pw_ui() {
    const need_pw_ui = is_encrypted || pending_encrypt;
    pw_toggle_row.hidden = !need_pw_ui;
    if (!need_pw_ui) {
      pw_panel_open = false;
    }
    cur_pw_wrap.hidden = !is_encrypted || pending_encrypt;
    new_pw_wrap.hidden = !need_pw_ui;
    pw_panel.hidden = !need_pw_ui || !pw_panel_open;
    pw_toggle_btn.setAttribute(
      "aria-expanded",
      pw_panel_open ? "true" : "false",
    );
    pw_toggle_btn.classList.toggle(
      "nte-totp-pw-reveal-btn-open",
      pw_panel_open,
    );
    update_pw_copy();
  }

  function open_pw_panel() {
    pw_panel_open = true;
    sync_pw_ui();
    requestAnimationFrame(() => {
      if (is_encrypted && !pending_encrypt) cur_pw_el.focus();
      else new_pw_el.focus();
    });
  }

  function close_pw_panel() {
    pw_panel_open = false;
    sync_pw_ui();
  }

  pw_toggle_btn.addEventListener("click", () => {
    if (pw_panel_open) close_pw_panel();
    else open_pw_panel();
  });

  function refresh_hints() {
    if (is_encrypted) {
      secret_el.placeholder =
        "Optional: type a new secret to replace the encrypted one";
    } else if (has_plain) {
      secret_el.placeholder = "Leave blank to keep current secret";
    } else {
      secret_el.placeholder = "e.g. JBSWY3DPEHPK3PXP";
    }
  }

  refresh_hints();
  sync_pw_ui();
  status_el.textContent = is_encrypted
    ? "Secret is saved encrypted (password-protected)."
    : has_plain
      ? "A secret is saved."
      : "";

  function set_status(msg) {
    status_el.textContent = msg || "";
  }

  enabled_el.addEventListener("change", () => {
    const enabled = enabled_el.checked;
    chrome.storage.local.set({ [ROBLOX_TOTP_ENABLED_KEY]: enabled }, () => {
      if (chrome.runtime.lastError) {
        enabled_el.checked = !enabled;
        set_status("Could not save.");
        return;
      }
      if (expanded_el.hidden) return;
      if (enabled && !has_plain && !is_encrypted) {
        set_status("Enabled. Add a secret to autofill.");
      } else {
        set_status(enabled ? "Autofill enabled." : "Autofill disabled.");
      }
    });
  });

  function wipe_pw_fields() {
    cur_pw_el.value = "";
    new_pw_el.value = "";
    new_pw2_el.value = "";
  }

  function clear_protect_prompt() {
    pending_secret = "";
    pending_protect = false;
    pending_encrypt = false;
    protect_prompt.hidden = true;
    sync_pw_ui();
  }

  function ask_protect_secret(secret, enabled) {
    pending_secret = secret;
    pending_protect = enabled;
    pending_encrypt = false;
    protect_prompt.hidden = false;
    close_pw_panel();
    set_status("Choose how to save this secret.");
  }

  function save_plain_secret(secret, enabled, message = "Saved.") {
    const patch = { [ROBLOX_TOTP_ENABLED_KEY]: enabled };
    if (secret) patch[ROBLOX_TOTP_SECRET_KEY] = secret;
    chrome.storage.local.remove(
      [ROBLOX_TOTP_ENC_KEY, ROBLOX_TOTP_MODE_KEY],
      () => {
        if (chrome.runtime.lastError) {
          set_status("Could not save.");
          return;
        }
        chrome.storage.local.set(patch, () => {
          if (chrome.runtime.lastError) {
            set_status("Could not save.");
            return;
          }
          enabled_el.checked = enabled;
          secret_el.value = "";
          wipe_pw_fields();
          clear_protect_prompt();
          close_pw_panel();
          set_status(message);
          after_save_reload_state();
        });
      },
    );
  }

  function after_save_reload_state() {
    chrome.storage.local.get(
      [
        ROBLOX_TOTP_ENABLED_KEY,
        ROBLOX_TOTP_SECRET_KEY,
        ROBLOX_TOTP_MODE_KEY,
        ROBLOX_TOTP_ENC_KEY,
      ],
      (r2) => {
        if (chrome.runtime.lastError) return;
        const snap = r2 && typeof r2 === "object" ? r2 : {};
        enc_blob = snap[ROBLOX_TOTP_ENC_KEY];
        is_encrypted = totp_snapshot_is_encrypted(snap);
        has_plain =
          typeof snap[ROBLOX_TOTP_SECRET_KEY] === "string" &&
          snap[ROBLOX_TOTP_SECRET_KEY].trim().length > 0;
        clear_protect_prompt();
        close_pw_panel();
        sync_pw_ui();
        refresh_hints();
        setTimeout(() => {
          if (is_encrypted)
            set_status("Secret is saved encrypted (password-protected).");
          else if (has_plain) set_status("A secret is saved.");
          else if (snap[ROBLOX_TOTP_ENABLED_KEY])
            set_status("Enabled. Add a secret to autofill.");
          else set_status("");
        }, 1600);
      },
    );
  }

  protect_yes_btn.addEventListener("click", () => {
    if (!pending_secret) return;
    pending_encrypt = true;
    protect_prompt.hidden = true;
    set_status("Enter a password, then Save.");
    open_pw_panel();
  });

  protect_no_btn.addEventListener("click", () => {
    if (!pending_secret) return;
    save_plain_secret(
      pending_secret,
      pending_protect,
      "Saved without password.",
    );
  });

  secret_el.addEventListener("input", () => {
    if (!pending_encrypt) clear_protect_prompt();
  });

  save_btn.addEventListener("click", async () => {
    const secret_trim = (secret_el.value || "").trim();
    let enabled = enabled_el.checked;
    if (secret_trim) enabled = true;

    const cur_pw = cur_pw_el.value || "";
    const new_pw = new_pw_el.value || "";
    const new_pw2 = new_pw2_el.value || "";

    try {
      if (!pending_encrypt && !protect_prompt.hidden && pending_secret) {
        set_status("Choose Save with password or Save without password.");
        return;
      }

      if (pending_encrypt) {
        const plain = secret_trim || pending_secret;
        if (!plain) {
          clear_protect_prompt();
          set_status("Enter your 2FA secret.");
          return;
        }
        if (new_pw !== new_pw2) {
          open_pw_panel();
          set_status("New passwords don't match.");
          return;
        }
        if (!new_pw) {
          open_pw_panel();
          set_status("Enter a password to protect this secret.");
          return;
        }
        const blob = await totp_encrypt_secret(plain, new_pw);
        chrome.storage.local.set(
          {
            [ROBLOX_TOTP_ENABLED_KEY]: pending_protect,
            [ROBLOX_TOTP_MODE_KEY]: "encrypted",
            [ROBLOX_TOTP_ENC_KEY]: blob,
            [ROBLOX_TOTP_SECRET_KEY]: "",
          },
          () => {
            if (chrome.runtime.lastError) {
              set_status("Could not save.");
              return;
            }
            enabled_el.checked = pending_protect;
            enc_blob = blob;
            is_encrypted = true;
            secret_el.value = "";
            wipe_pw_fields();
            clear_protect_prompt();
            close_pw_panel();
            sync_pw_ui();
            set_status("Saved encrypted. Password is not stored.");
            after_save_reload_state();
          },
        );
        return;
      }

      if (secret_trim) {
        ask_protect_secret(secret_trim, enabled);
        return;
      }

      if (!is_encrypted) {
        save_plain_secret("", enabled, "Saved.");
        return;
      }

      if (is_encrypted) {
        if (!cur_pw && !new_pw && !new_pw2) {
          chrome.storage.local.set(
            { [ROBLOX_TOTP_ENABLED_KEY]: enabled },
            () => {
              if (chrome.runtime.lastError) {
                set_status("Could not save.");
                return;
              }
              enabled_el.checked = enabled;
              set_status("Saved.");
              after_save_reload_state();
            },
          );
          return;
        }
        if (new_pw !== new_pw2) {
          open_pw_panel();
          set_status("New passwords don't match.");
          return;
        }
        if (!new_pw) {
          open_pw_panel();
          set_status(
            "Open above and enter a new lock password (you can reuse the same one).",
          );
          return;
        }
        let plain;
        if (!cur_pw) {
          open_pw_panel();
          set_status(
            "Open above and enter your current lock password to change the lock.",
          );
          return;
        }
        try {
          plain = await totp_decrypt_secret(enc_blob, cur_pw);
        } catch {
          open_pw_panel();
          set_status("Wrong current password.");
          return;
        }
        const blob = await totp_encrypt_secret(plain, new_pw);
        chrome.storage.local.set(
          {
            [ROBLOX_TOTP_ENABLED_KEY]: enabled,
            [ROBLOX_TOTP_MODE_KEY]: "encrypted",
            [ROBLOX_TOTP_ENC_KEY]: blob,
            [ROBLOX_TOTP_SECRET_KEY]: "",
          },
          () => {
            if (chrome.runtime.lastError) {
              set_status("Could not save.");
              return;
            }
            enabled_el.checked = enabled;
            enc_blob = blob;
            secret_el.value = "";
            wipe_pw_fields();
            close_pw_panel();
            set_status("Saved.");
            after_save_reload_state();
          },
        );
      }
    } catch {
      set_status("Could not encrypt or decrypt - try again.");
    }
  });

  clear_btn.addEventListener("click", () => {
    chrome.storage.local.remove(
      [ROBLOX_TOTP_SECRET_KEY, ROBLOX_TOTP_ENC_KEY, ROBLOX_TOTP_MODE_KEY],
      () => {
        chrome.storage.local.set({ [ROBLOX_TOTP_ENABLED_KEY]: false }, () => {
          if (chrome.runtime.lastError) {
            set_status("Could not clear.");
            return;
          }
          secret_el.value = "";
          wipe_pw_fields();
          enabled_el.checked = false;
          enc_blob = null;
          is_encrypted = false;
          has_plain = false;
          clear_protect_prompt();
          close_pw_panel();
          sync_pw_ui();
          refresh_hints();
          set_status("Secret removed.");
          setTimeout(() => set_status(""), 2000);
        });
      },
    );
  });
}

function append_trade_page_theme_card(container, snapshot = {}) {
  const card = document.createElement("div");
  card.className = "nte-theme-card";

  let theme = normalize_trade_page_theme(snapshot.theme);
  let enabled = snapshot.enabled === true;
  let custom_themes = normalize_custom_trade_page_themes(
    snapshot.custom_themes,
  );
  let force_theme_upload_page = location.hash === "#theme-upload";
  let color_fields = [
    ["background", "Base"],
    ["accent", "Accent"],
  ];

  card.innerHTML = `
    <div class="nte-theme-head">
      <div>
        <span class="nte-theme-title">Trade page theme</span>
        <span class="nte-theme-sub">Recolor the trades page.</span>
      </div>
      <label class="nte-theme-toggle" title="Enable trade page theme">
        <input type="checkbox" id="nte-theme-enabled" />
        <span></span>
      </label>
    </div>
    <div class="nte-theme-expanded" id="nte-theme-expanded" hidden>
      <div class="nte-theme-preview" id="nte-theme-preview">
        <div class="nte-theme-preview-top">
          <span></span><span></span><span></span>
        </div>
        <div class="nte-theme-preview-row">
          <i></i>
          <div><b></b><em></em></div>
        </div>
      </div>
      <div class="nte-theme-presets" id="nte-theme-presets"></div>
      <div class="nte-theme-color-grid">
        ${color_fields
          .map(
            ([key, label]) => `
              <label class="nte-theme-color">
                <span>${escape_html(label)}</span>
                <div class="nte-theme-color-controls">
                  <button type="button" class="nte-theme-swatch" data-theme-picker="${escape_html(key)}" aria-label="Pick ${escape_html(label)} color"><i></i></button>
                  <input type="text" class="nte-theme-hex" data-theme-hex="${escape_html(key)}" maxlength="7" spellcheck="false" />
                  <button type="button" class="nte-theme-rgb-toggle" data-theme-picker="${escape_html(key)}" aria-label="Show ${escape_html(label)} RGB sliders">RGB</button>
                </div>
              </label>
            `,
          )
          .join("")}
      </div>
      <div class="nte-theme-color-picker" id="nte-theme-color-picker" hidden>
        <div class="nte-theme-color-picker-head">
          <span id="nte-theme-color-picker-title">Base color</span>
          <button type="button" id="nte-theme-color-picker-close" aria-label="Close color picker">x</button>
        </div>
        <div class="nte-theme-color-sample" id="nte-theme-color-sample"></div>
        <label class="nte-theme-picker-slider is-red">
          <span>Red <b data-picker-value="r">0</b></span>
          <input type="range" min="0" max="255" step="1" data-picker-slider="r" />
        </label>
        <label class="nte-theme-picker-slider">
          <span>Green <b data-picker-value="g">0</b></span>
          <input type="range" min="0" max="255" step="1" data-picker-slider="g" />
        </label>
        <label class="nte-theme-picker-slider">
          <span>Blue <b data-picker-value="b">0</b></span>
          <input type="range" min="0" max="255" step="1" data-picker-slider="b" />
        </label>
      </div>
      <label class="nte-theme-slider" id="nte-theme-image-overlay-wrap" hidden>
        <span>Image shade <b id="nte-theme-image-overlay-value">72%</b></span>
        <input type="range" id="nte-theme-image-overlay" min="0" max="90" step="1" />
      </label>
      <div class="nte-theme-actions">
        <button type="button" class="nte-theme-upload-btn" id="nte-theme-upload-btn">Upload theme</button>
        <input type="file" id="nte-theme-upload" accept=".json,application/json,image/png,image/jpeg,image/webp" hidden />
      </div>
      <div class="nte-theme-name-panel" id="nte-theme-name-panel" hidden>
        <span>Name this theme</span>
        <input type="text" id="nte-theme-name-input" maxlength="32" spellcheck="false" />
        <div>
          <button type="button" class="nte-totp-btn" id="nte-theme-name-save">Save upload</button>
          <button type="button" class="nte-totp-btn nte-totp-btn-ghost" id="nte-theme-name-cancel">Cancel</button>
        </div>
      </div>
    </div>
    <p class="nte-totp-status" id="nte-theme-status" aria-live="polite" hidden></p>
  `;

  container.append(card);
  card.dataset.optionSearch = build_option_search_text(
    "trade page theme recolor trades upload custom",
  );

  const enabled_el = card.querySelector("#nte-theme-enabled");
  const expanded_el = card.querySelector("#nte-theme-expanded");
  const preview_el = card.querySelector("#nte-theme-preview");
  const presets_el = card.querySelector("#nte-theme-presets");
  const status_el = card.querySelector("#nte-theme-status");
  const upload_btn = card.querySelector("#nte-theme-upload-btn");
  const upload_el = card.querySelector("#nte-theme-upload");
  const name_panel = card.querySelector("#nte-theme-name-panel");
  const name_input = card.querySelector("#nte-theme-name-input");
  const name_save_btn = card.querySelector("#nte-theme-name-save");
  const name_cancel_btn = card.querySelector("#nte-theme-name-cancel");
  const image_overlay_wrap = card.querySelector(
    "#nte-theme-image-overlay-wrap",
  );
  const image_overlay_input = card.querySelector("#nte-theme-image-overlay");
  const image_overlay_value = card.querySelector(
    "#nte-theme-image-overlay-value",
  );
  const picker_buttons = [...card.querySelectorAll("[data-theme-picker]")];
  const color_picker = card.querySelector("#nte-theme-color-picker");
  const color_picker_title = card.querySelector(
    "#nte-theme-color-picker-title",
  );
  const color_picker_close = card.querySelector(
    "#nte-theme-color-picker-close",
  );
  const color_sample = card.querySelector("#nte-theme-color-sample");
  const picker_sliders = [...card.querySelectorAll("[data-picker-slider]")];
  const picker_values = [...card.querySelectorAll("[data-picker-value]")];
  const hex_inputs = [...card.querySelectorAll("[data-theme-hex]")];
  let save_timer = null;
  let pending_upload = null;
  let active_color_key = "";

  function set_status(message) {
    status_el.textContent = message || "";
    status_el.hidden = !message;
  }

  function get_preset_button_html(key, preset, custom_index = null) {
    let theme = normalize_trade_page_theme(preset);
    let image_style = theme.image
      ? `background-image:url(&quot;${escape_html(theme.image)}&quot;);background-size:cover;background-position:center;`
      : "";
    let gradient_style = `background: linear-gradient(135deg, ${escape_html(theme.background)} 0%, ${escape_html(theme.accent)} 50%, ${escape_html(theme.accent2)} 100%);`;
    if (custom_index === null) {
      return `<button type="button" class="nte-theme-preset" data-theme-preset="${escape_html(key)}" title="${escape_html(theme.name)}"><span class="nte-theme-preset-swatch" style="${gradient_style}${image_style}"></span></button>`;
    }
    return `<button type="button" class="nte-theme-preset is-custom" data-custom-theme="${custom_index}" title="${escape_html(theme.name)}"><span class="nte-theme-preset-swatch" style="${gradient_style}${image_style}"></span><span class="nte-theme-preset-delete" data-delete-custom-theme="${custom_index}" title="Delete theme" aria-label="Delete ${escape_html(theme.name)} theme">x</span></button>`;
  }

  function is_same_theme(left, right) {
    let a = pack_trade_page_theme(left);
    let b = pack_trade_page_theme(right);
    return [
      "background",
      "accent",
      "accent2",
      "effect",
      "image",
      "image_overlay",
    ].every((key) => (a[key] || "") === (b[key] || ""));
  }

  function render_presets() {
    presets_el.innerHTML = [
      ...Object.entries(trade_page_theme_presets).map(([key, preset]) =>
        get_preset_button_html(key, preset),
      ),
      ...custom_themes.map((preset, index) =>
        get_preset_button_html("", preset, index),
      ),
    ].join("");
  }

  function read_theme_from_inputs() {
    let next = { ...theme };
    for (let input of hex_inputs) {
      let key = input.getAttribute("data-theme-hex");
      if (!is_complete_hex_color(input.value)) continue;
      next[key] = normalize_hex_color(input.value, next[key]);
    }
    if (next.image)
      next.image_overlay = normalize_image_overlay(image_overlay_input.value);
    return normalize_trade_page_theme(next);
  }

  function update_theme_color(key, value) {
    theme = normalize_trade_page_theme({
      ...theme,
      [key]: normalize_hex_color(value, theme[key]),
    });
    paint_inputs(theme);
  }

  function update_image_overlay(value) {
    theme = normalize_trade_page_theme({
      ...theme,
      image_overlay: normalize_image_overlay(value),
    });
    paint_inputs(theme);
  }

  function get_color_label(key) {
    let field = color_fields.find(([field_key]) => field_key === key);
    return field ? field[1] : "Color";
  }

  function get_picker_rgb() {
    let parts = {};
    for (let input of picker_sliders)
      parts[input.getAttribute("data-picker-slider")] =
        Number(input.value) || 0;
    return [parts.r || 0, parts.g || 0, parts.b || 0];
  }

  function sync_color_picker() {
    if (!active_color_key) return;
    let color = theme[active_color_key] || theme.background;
    let rgb = hex_to_rgb_tuple(color);
    color_picker_title.textContent = `${get_color_label(active_color_key)} color`;
    color_sample.style.background = color;
    color_picker.style.setProperty("--picker-color", color);
    for (let input of picker_sliders) {
      let key = input.getAttribute("data-picker-slider");
      input.value = String(rgb[{ r: 0, g: 1, b: 2 }[key]]);
    }
    for (let value of picker_values) {
      let key = value.getAttribute("data-picker-value");
      value.textContent = String(rgb[{ r: 0, g: 1, b: 2 }[key]]);
    }
  }

  function open_color_picker(key) {
    active_color_key = key;
    color_picker.hidden = false;
    paint_inputs(theme);
  }

  function close_color_picker() {
    active_color_key = "";
    color_picker.hidden = true;
    paint_inputs(theme);
  }

  function commit_picker_color(instant = false) {
    if (!active_color_key) return;
    update_theme_color(active_color_key, rgb_tuple_to_hex(get_picker_rgb()));
    if (instant) {
      clearTimeout(save_timer);
      save_theme(theme, enabled_el.checked, "");
      return;
    }
    queue_theme_save();
  }

  function paint_inputs(next_theme = theme) {
    theme = normalize_trade_page_theme(next_theme);
    enabled_el.checked = enabled;
    expanded_el.hidden = !enabled && !force_theme_upload_page;
    card.classList.toggle("is-enabled", enabled || force_theme_upload_page);
    for (let button of picker_buttons) {
      let key = button.getAttribute("data-theme-picker");
      button.style.setProperty("--picked", theme[key]);
      button.classList.toggle(
        "is-active",
        key === active_color_key && !color_picker.hidden,
      );
    }
    for (let input of hex_inputs) {
      let key = input.getAttribute("data-theme-hex");
      input.value = theme[key];
    }
    preview_el.style.setProperty("--theme-bg", theme.background);
    preview_el.style.setProperty("--theme-surface", theme.surface);
    preview_el.style.setProperty("--theme-surface2", theme.surface2);
    preview_el.style.setProperty("--theme-text", theme.text);
    preview_el.style.setProperty("--theme-muted", theme.muted);
    preview_el.style.setProperty("--theme-accent", theme.accent);
    preview_el.style.setProperty("--theme-accent2", theme.accent2);
    preview_el.style.setProperty(
      "--theme-image",
      theme.image ? `url("${theme.image}")` : "none",
    );
    preview_el.style.setProperty(
      "--theme-image-tint",
      hex_to_rgba(theme.background, theme.image_overlay / 100),
    );
    preview_el.style.setProperty(
      "--theme-image-tint-strong",
      hex_to_rgba(
        theme.background,
        Math.min(0.96, (theme.image_overlay / 100) * 1.22),
      ),
    );
    preview_el.style.setProperty(
      "--theme-image-accent-soft",
      hex_to_rgba(
        theme.accent,
        Math.min(0.24, (theme.image_overlay / 100) * 0.2),
      ),
    );
    preview_el.style.setProperty("--theme-border", theme.border);
    preview_el.dataset.themeEffect = theme.effect;
    image_overlay_wrap.hidden = theme.effect !== "image" || !theme.image;
    image_overlay_input.value = String(theme.image_overlay);
    image_overlay_value.textContent = `${theme.image_overlay}%`;
    sync_color_picker();
    for (let button of card.querySelectorAll(".nte-theme-preset")) {
      let preset = button.hasAttribute("data-theme-preset")
        ? trade_page_theme_presets[button.getAttribute("data-theme-preset")]
        : custom_themes[Number(button.getAttribute("data-custom-theme"))];
      button.classList.toggle(
        "is-active",
        !!preset && is_same_theme(preset, theme),
      );
    }
  }

  function save_theme(
    next_theme = read_theme_from_inputs(),
    next_enabled = enabled_el.checked,
    message = "Theme saved.",
  ) {
    theme = normalize_trade_page_theme(next_theme);
    enabled = !!next_enabled;
    paint_inputs(theme);
    set_storage({
      [trade_page_theme_enabled_key]: enabled,
      [trade_page_theme_key]: pack_trade_page_theme(theme),
    }).then(() => set_status(message));
  }

  function queue_theme_save() {
    clearTimeout(save_timer);
    save_timer = setTimeout(
      () => save_theme(read_theme_from_inputs(), enabled_el.checked, ""),
      120,
    );
  }

  enabled_el.addEventListener("change", () => {
    save_theme(read_theme_from_inputs(), enabled_el.checked, "");
  });

  image_overlay_input.addEventListener("input", () => {
    update_image_overlay(image_overlay_input.value);
    queue_theme_save();
  });

  image_overlay_input.addEventListener("change", () => {
    clearTimeout(save_timer);
    update_image_overlay(image_overlay_input.value);
    save_theme(theme, enabled_el.checked, "");
  });

  for (let button of picker_buttons) {
    button.addEventListener("click", () =>
      open_color_picker(button.getAttribute("data-theme-picker")),
    );
  }

  color_picker_close.addEventListener("click", close_color_picker);

  for (let input of picker_sliders) {
    input.addEventListener("input", () => commit_picker_color());
    input.addEventListener("change", () => commit_picker_color(true));
  }

  for (let input of hex_inputs) {
    input.addEventListener("input", () => {
      if (!is_complete_hex_color(input.value)) return;
      update_theme_color(input.getAttribute("data-theme-hex"), input.value);
      queue_theme_save();
    });
    input.addEventListener("change", () => {
      clearTimeout(save_timer);
      if (is_complete_hex_color(input.value))
        update_theme_color(input.getAttribute("data-theme-hex"), input.value);
      else paint_inputs(theme);
      save_theme(theme, enabled_el.checked, "");
    });
  }

  presets_el.addEventListener("click", (event) => {
    let delete_btn = event.target.closest("[data-delete-custom-theme]");
    if (delete_btn) {
      let index = Number(delete_btn.getAttribute("data-delete-custom-theme"));
      let removed = custom_themes[index];
      if (!removed) return;
      custom_themes = custom_themes.filter(
        (_, theme_index) => theme_index !== index,
      );
      let deleted_active = is_same_theme(removed, theme);
      if (deleted_active)
        theme = normalize_trade_page_theme(trade_page_theme_default);
      set_storage({
        [trade_page_custom_themes_key]: custom_themes,
        ...(deleted_active
          ? { [trade_page_theme_key]: pack_trade_page_theme(theme) }
          : {}),
      }).then(() => {
        render_presets();
        paint_inputs(theme);
        set_status(`${removed.name} deleted.`);
      });
      return;
    }
    let button = event.target.closest(".nte-theme-preset");
    if (!button) return;
    let preset = button.hasAttribute("data-theme-preset")
      ? trade_page_theme_presets[button.getAttribute("data-theme-preset")]
      : custom_themes[Number(button.getAttribute("data-custom-theme"))];
    if (!preset) return;
    save_theme(preset, true, "");
  });

  function open_theme_upload() {
    if (force_theme_upload_page) {
      upload_el.click();
      return;
    }
    send_theme_upload_to_active_page({ open_picker: false }).then((opened) => {
      if (opened) {
        set_status("Choose a file on the trades page.");
        return;
      }
      open_extension_popup("popup/popup.html#theme-upload");
      set_status("Open the trades page, then try again.");
    });
  }

  upload_btn.addEventListener("click", open_theme_upload);

  function clear_pending_upload() {
    pending_upload = null;
    name_input.value = "";
    name_panel.hidden = true;
    upload_el.value = "";
  }

  function show_name_panel(uploaded, file) {
    let fallback_name = String(
      uploaded.name || file.name.replace(/\.[^.]+$/, "") || "Custom theme",
    )
      .trim()
      .slice(0, 32);
    pending_upload = uploaded;
    name_input.value = fallback_name;
    name_panel.hidden = false;
    set_status("");
    name_input.focus();
    name_input.select();
  }

  function save_pending_upload() {
    if (!pending_upload) return;
    let name = name_input.value.trim();
    if (!name) {
      set_status("Name the theme first.");
      name_input.focus();
      return;
    }
    let packed = pack_trade_page_theme({ ...pending_upload, name });
    custom_themes = [
      packed,
      ...custom_themes.filter(
        (item) => item.name.toLowerCase() !== packed.name.toLowerCase(),
      ),
    ].slice(0, 16);
    set_storage({ [trade_page_custom_themes_key]: custom_themes }).then(() => {
      render_presets();
      save_theme(packed, true, `${packed.name} saved.`);
      clear_pending_upload();
    });
  }

  name_save_btn.addEventListener("click", save_pending_upload);
  name_cancel_btn.addEventListener("click", clear_pending_upload);
  name_input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") save_pending_upload();
    if (event.key === "Escape") clear_pending_upload();
  });

  upload_el.addEventListener("change", () => {
    let file = upload_el.files?.[0];
    if (!file) return;
    let is_image =
      file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name);
    if (is_image && file.size > 3 * 1024 * 1024) {
      set_status("Theme image must be under 3 MB.");
      upload_el.value = "";
      return;
    }
    let reader = new FileReader();
    reader.onload = () => {
      try {
        let uploaded = is_image
          ? {
              name: "",
              background: theme.background,
              accent: theme.accent,
              accent2: theme.accent2,
              effect: "image",
              image: String(reader.result || ""),
              image_overlay: trade_page_theme_default_image_overlay,
            }
          : JSON.parse(String(reader.result || "{}"));
        if (is_image && !normalize_theme_image(uploaded.image)) {
          set_status("Theme image must be PNG, JPG, or WebP.");
          upload_el.value = "";
          return;
        }
        show_name_panel(uploaded, file);
      } catch {
        set_status("Theme file must be valid JSON.");
        upload_el.value = "";
      }
    };
    reader.onerror = () => {
      set_status("Could not read theme file.");
      upload_el.value = "";
    };
    if (is_image) reader.readAsDataURL(file);
    else reader.readAsText(file);
  });

  render_presets();
  paint_inputs(theme);
  set_status("");
  if (force_theme_upload_page) {
    set_status("Click Upload theme to choose a file.");
    setTimeout(() => card.scrollIntoView({ block: "center" }), 0);
  }

  bind_popup_external_links();
}

function restore_defaults() {
  return new Promise((resolve) => {
    const updates = {};
    option_groups.forEach((option) => {
      if (typeof option === "string") return;
      updates[option.name] = option.enabledByDefault;
    });
    updates[legacy_colorblind_mode_option_name] = false;
    updates[colorblind_mode_profile_key] = colorblind_mode_profile_default;
    updates[inbound_trade_notification_min_gain_key] =
      inbound_trade_notification_min_gain_default;
    updates[inbound_trade_notification_webhook_enabled_key] = false;
    updates[inbound_trade_notification_webhook_url_key] = "";
    updates[inbound_trade_notification_webhook_ping_enabled_key] = false;
    updates[inbound_trade_notification_webhook_discord_id_key] = "";
    updates[duplicate_trade_warning_hours_key] =
      duplicate_trade_warning_hours_default;
    updates[profile_value_display_mode_key] =
      profile_value_display_mode_default;
    updates[ownership_link_provider_key] = ownership_link_provider_default;
    updates[counter_trade_choice_mode_key] = counter_trade_choice_mode_default;
    updates[legacy_counter_trade_prompt_option_name] = true;
    updates[ROBLOX_TOTP_ENABLED_KEY] = false;
    updates[ROBLOX_TOTP_SECRET_KEY] = "";
    updates[popup_theme_storage_key] = popup_theme_default;
    updates[trade_page_theme_enabled_key] = false;
    updates[trade_page_theme_key] = { ...trade_page_theme_default };
    updates[trade_page_custom_themes_key] = [];
    chrome.storage.local.remove(
      [ROBLOX_TOTP_ENC_KEY, ROBLOX_TOTP_MODE_KEY],
      () => {
        chrome.storage.local.set(updates, () => {
          if (chrome.runtime.lastError) console.info(chrome.runtime.lastError);
          resolve();
        });
      },
    );
  });
}

function get_settings_backup_keys() {
  return [
    ...get_option_names(),
    legacy_colorblind_mode_option_name,
    legacy_post_tax_trade_value_option_name,
    colorblind_mode_profile_key,
    inbound_trade_notification_min_gain_key,
    inbound_trade_notification_webhook_enabled_key,
    inbound_trade_notification_webhook_url_key,
    inbound_trade_notification_webhook_ping_enabled_key,
    inbound_trade_notification_webhook_discord_id_key,
    duplicate_trade_warning_hours_key,
    profile_value_display_mode_key,
    ownership_link_provider_key,
    counter_trade_choice_mode_key,
    legacy_counter_trade_prompt_option_name,
    popup_theme_storage_key,
    trade_page_theme_enabled_key,
    trade_page_theme_key,
    trade_page_custom_themes_key,
    trade_ads_config_storage_key,
    trade_ads_verify_storage_key,
    nte_discord_banner_dismissed_key,
    nte_rate_banner_dismissed_key,
  ];
}

function get_settings_backup_defaults() {
  let defaults = {};
  option_groups.forEach((option) => {
    if (typeof option !== "string") defaults[option.name] = option.enabledByDefault;
  });
  defaults[legacy_colorblind_mode_option_name] = false;
  defaults[legacy_post_tax_trade_value_option_name] = false;
  defaults[colorblind_mode_profile_key] = colorblind_mode_profile_default;
  defaults[inbound_trade_notification_min_gain_key] =
    inbound_trade_notification_min_gain_default;
  defaults[inbound_trade_notification_webhook_enabled_key] = false;
  defaults[inbound_trade_notification_webhook_url_key] = "";
  defaults[inbound_trade_notification_webhook_ping_enabled_key] = false;
  defaults[inbound_trade_notification_webhook_discord_id_key] = "";
  defaults[duplicate_trade_warning_hours_key] =
    duplicate_trade_warning_hours_default;
  defaults[profile_value_display_mode_key] = profile_value_display_mode_default;
  defaults[ownership_link_provider_key] = ownership_link_provider_default;
  defaults[counter_trade_choice_mode_key] = counter_trade_choice_mode_default;
  defaults[popup_theme_storage_key] = popup_theme_default;
  defaults[trade_page_theme_enabled_key] = false;
  defaults[trade_page_theme_key] = pack_trade_page_theme(trade_page_theme_default);
  defaults[trade_page_custom_themes_key] = [];
  return defaults;
}

function normalize_imported_setting(key, value) {
  if (get_option_names().includes(key)) return value === true;
  if (
    [
      legacy_colorblind_mode_option_name,
      legacy_post_tax_trade_value_option_name,
      inbound_trade_notification_webhook_enabled_key,
      inbound_trade_notification_webhook_ping_enabled_key,
      trade_page_theme_enabled_key,
      nte_discord_banner_dismissed_key,
      nte_rate_banner_dismissed_key,
    ].includes(key)
  )
    return value === true;
  if (key === colorblind_mode_profile_key)
    return normalize_colorblind_mode_profile(value);
  if (key === inbound_trade_notification_min_gain_key)
    return normalize_inbound_trade_notification_min_gain(value);
  if (key === inbound_trade_notification_webhook_url_key)
    return normalize_inbound_trade_notification_webhook_url(value);
  if (key === inbound_trade_notification_webhook_discord_id_key)
    return normalize_inbound_trade_notification_discord_id(value);
  if (key === duplicate_trade_warning_hours_key)
    return normalize_duplicate_trade_warning_hours(value);
  if (key === profile_value_display_mode_key)
    return normalize_profile_value_display_mode(value);
  if (key === ownership_link_provider_key)
    return normalize_ownership_link_provider(value);
  if (key === counter_trade_choice_mode_key)
    return normalize_counter_trade_choice_mode(value);
  if (key === legacy_counter_trade_prompt_option_name) return value === true;
  if (key === popup_theme_storage_key) return normalize_popup_theme(value);
  if (key === trade_page_theme_key) return pack_trade_page_theme(value);
  if (key === trade_page_custom_themes_key)
    return normalize_custom_trade_page_themes(value);
  return value;
}

function set_settings_status(message, kind = "") {
  let status = document.getElementById("settingsImportExportStatus");
  if (!status) return;
  status.textContent = message || "";
  status.classList.toggle("is-ok", kind === "ok");
  status.classList.toggle("is-error", kind === "error");
}

async function export_settings_backup() {
  let keys = get_settings_backup_keys();
  let saved = await get_storage(keys);
  let defaults = get_settings_backup_defaults();
  let settings = {};
  for (let key of keys) {
    if (saved[key] !== undefined) settings[key] = saved[key];
    else if (defaults[key] !== undefined) settings[key] = defaults[key];
  }
  let payload = {
    type: "nevos-trading-extension-settings",
    version: 1,
    exportedAt: new Date().toISOString(),
    extensionVersion: chrome.runtime.getManifest().version,
    excludes: ["roblox_totp_secret_b32", "roblox_totp_encrypted_blob"],
    settings,
  };
  let blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  let url = URL.createObjectURL(blob);
  let date = new Date().toISOString().slice(0, 10);
  let link = document.createElement("a");
  link.href = url;
  link.download = `nevos-extension-settings-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  set_settings_status("Settings exported. TOTP secrets are not included.", "ok");
}

async function import_settings_backup(file) {
  if (!file) return;
  let text = await file.text();
  let parsed = JSON.parse(text);
  let raw_settings =
    parsed?.type === "nevos-trading-extension-settings"
      ? parsed.settings
      : parsed?.settings || parsed;
  if (!raw_settings || typeof raw_settings !== "object" || Array.isArray(raw_settings))
    throw new Error("Invalid settings file.");

  let allowed = new Set(get_settings_backup_keys());
  let patch = {};
  for (let [key, value] of Object.entries(raw_settings)) {
    if (!allowed.has(key)) continue;
    patch[key] = normalize_imported_setting(key, value);
  }
  if (!Object.keys(patch).length) throw new Error("No importable settings found.");

  await set_storage(patch);
  apply_popup_theme(patch[popup_theme_storage_key]);
  await refresh_all_panels();
  for (let option of option_groups) {
    if (typeof option !== "string" && option.name in patch)
      send_option_update(option.name);
  }
  if (
    colorblind_mode_profile_key in patch ||
    legacy_colorblind_mode_option_name in patch
  )
    send_colorblind_mode_update();
  if (profile_value_display_mode_key in patch) send_option_update("Values");
  if (
    ownership_link_provider_key in patch ||
    "Add Item Ownership Buttons" in patch
  ) {
    send_option_update("Add Item Ownership Buttons");
    send_option_update(ownership_link_provider_key);
  }
  if (
    counter_trade_choice_mode_key in patch ||
    counter_trade_choices_option_name in patch ||
    legacy_counter_trade_prompt_option_name in patch
  ) {
    send_option_update(counter_trade_choices_option_name);
    send_option_update(counter_trade_choice_mode_key);
  }
  set_settings_status("Settings imported.", "ok");
}

function init_settings_import_export() {
  let export_btn = document.getElementById("exportSettingsBtn");
  let import_btn = document.getElementById("importSettingsBtn");
  let import_file = document.getElementById("importSettingsFile");
  if (!export_btn || !import_btn || !import_file) return;

  export_btn.addEventListener("click", async () => {
    export_btn.disabled = true;
    try {
      await export_settings_backup();
    } catch {
      set_settings_status("Could not export settings.", "error");
    } finally {
      export_btn.disabled = false;
    }
  });

  import_btn.addEventListener("click", () => {
    import_file.value = "";
    import_file.click();
  });

  import_file.addEventListener("change", async () => {
    let file = import_file.files?.[0];
    if (!file) return;
    import_btn.disabled = true;
    try {
      await import_settings_backup(file);
    } catch {
      set_settings_status("Could not import settings. Use a valid JSON backup.", "error");
    } finally {
      import_btn.disabled = false;
      import_file.value = "";
    }
  });
}

const restore_btn = document.getElementById("restoreDefaultSettings");
restore_btn.addEventListener("click", async () => {
  restore_btn.disabled = true;
  await restore_defaults();
  apply_popup_theme(popup_theme_default);
  await refresh_all_panels();

  restore_btn.classList.add("btn-restore-done");
  restore_btn.querySelector(".btn-restore-label").textContent = "Restored!";

  setTimeout(() => {
    restore_btn.classList.remove("btn-restore-done");
    restore_btn.querySelector(".btn-restore-label").textContent =
      "Reset to Defaults";
    restore_btn.disabled = false;
  }, 1400);
});

const required_origins = (() => {
  let core = [
    "https://api.rolimons.com/*",
    "https://www.rolimons.com/*",
    "https://rolimons.com/*",
    "https://nevos-extension.com/*",
    "https://www.nevos-extension.com/*",
    "https://www.roblox.com/*",
    "https://roblox.com/*",
    "https://auth.roblox.com/*",
    "https://trades.roblox.com/*",
    "https://users.roblox.com/*",
    "https://inventory.roblox.com/*",
    "https://catalog.roblox.com/*",
    "https://economy.roblox.com/*",
    "https://apis.roblox.com/*",
    "https://thumbnails.roblox.com/*",
  ];
  let manifest_origins = chrome.runtime?.getManifest?.()?.host_permissions;
  if (!Array.isArray(manifest_origins) || !manifest_origins.length) return core;
  let granted_set = new Set(
    manifest_origins.map((x) => String(x || "").trim()),
  );
  let filtered = core.filter((x) => granted_set.has(x));
  return filtered.length ? filtered : core;
})();

function check_host_permissions() {
  if (!chrome.permissions?.contains || !chrome.permissions?.request)
    return Promise.resolve(true);
  return new Promise((resolve) => {
    try {
      chrome.permissions.contains({ origins: required_origins }, (has) => {
        if (chrome.runtime.lastError) {
          console.info(
            "Nevos Trading Extension: host permission check failed",
            chrome.runtime.lastError,
          );
          resolve(false);
          return;
        }
        resolve(!!has);
      });
    } catch (error) {
      console.info(
        "Nevos Trading Extension: host permission API unavailable",
        error,
      );
      resolve(true);
    }
  });
}

async function render_permissions_banner() {
  let existing = document.getElementById("nte-permissions-banner");
  if (!chrome.permissions?.contains || !chrome.permissions?.request) {
    if (existing) existing.remove();
    return;
  }
  let granted = await check_host_permissions();
  if (granted) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return;

  let banner = document.createElement("div");
  banner.id = "nte-permissions-banner";
  banner.className = "permissions-banner";
  banner.innerHTML = `
    <div class="permissions-banner-inner">
      <svg class="permissions-banner-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <div class="permissions-banner-text">
        <strong>Permissions required</strong>
        <span>Grant access to Roblox & Rolimons so the extension can work properly.</span>
      </div>
      <button class="permissions-banner-btn" id="nte-grant-permissions">Grant</button>
    </div>
  `;

  let content = document.getElementById("content");
  content.parentNode.insertBefore(banner, content);

  document
    .getElementById("nte-grant-permissions")
    .addEventListener("click", async () => {
      let result = await new Promise((resolve) => {
        try {
          chrome.permissions.request({ origins: required_origins }, (ok) => {
            if (chrome.runtime.lastError) {
              console.info(
                "Nevos Trading Extension: host permission request failed",
                chrome.runtime.lastError,
              );
              resolve(false);
              return;
            }
            resolve(!!ok);
          });
        } catch (error) {
          console.info(
            "Nevos Trading Extension: host permission API unavailable",
            error,
          );
          resolve(false);
        }
      });
      if (result) {
        banner.remove();
      }
    });
}

const ta_actions = [
  {
    id: "cancel_inbound_overpaying",
    label: "Cancel inbound trades you're overpaying in",
    section: "inbound",
  },
  {
    id: "cancel_inbound_unowned",
    label: "Cancel inbound trades with unowned items",
    section: "inbound",
  },
  {
    id: "cancel_inbound_all",
    label: "Cancel all inbound trades",
    section: "inbound",
  },
  {
    id: "cancel_outbound_overpaying",
    label: "Cancel outbound trades you're overpaying in",
    section: "outbound",
  },
  {
    id: "cancel_outbound_unowned",
    label: "Cancel outbound trades with unowned items",
    section: "outbound",
  },
  {
    id: "cancel_outbound_all",
    label: "Cancel all outbound trades",
    section: "outbound",
  },
  {
    id: "cancel_outbound_older_than",
    label: "Cancel outbound trades older than…",
    section: "outbound",
  },
];

let ta_poll_timer = null;
const ta_locked_trade_ids_key = "nteLockedTradeIds";

function ta_send(type, extra) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...extra }, (r) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(r);
    });
  });
}

function ta_normalize_locked_trade_ids(ids) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
}

async function ta_get_locked_trade_count() {
  let saved = await get_storage([ta_locked_trade_ids_key]);
  return ta_normalize_locked_trade_ids(saved[ta_locked_trade_ids_key]).length;
}

function ta_locked_count_html(count) {
  if (!(count > 0)) return "";
  return `<br>${count} locked trade${count === 1 ? "" : "s"} will be skipped.`;
}

async function ta_show_confirm(action_label, on_confirm) {
  let existing = document.querySelector(".ta-confirm-overlay");
  if (existing) existing.remove();
  let locked_count = await ta_get_locked_trade_count();

  let overlay = document.createElement("div");
  overlay.className = "ta-confirm-overlay";
  overlay.innerHTML = `
    <div class="ta-confirm-box">
      <div class="ta-confirm-title">Are you sure?</div>
      <div class="ta-confirm-msg">${escape_html(action_label)}.<br>You can stop it at any time.${ta_locked_count_html(locked_count)}</div>
      <div class="ta-confirm-actions">
        <button class="ta-confirm-btn ta-confirm-cancel">Cancel</button>
        <button class="ta-confirm-btn ta-confirm-go">Do it</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay
    .querySelector(".ta-confirm-cancel")
    .addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector(".ta-confirm-go").addEventListener("click", () => {
    overlay.remove();
    on_confirm();
  });
}

function ta_parse_duration_ms(amount, unit) {
  let value = Math.max(0, parseFloat(amount) || 0);
  if (!(value > 0)) return 0;
  if (unit === "minutes") return Math.round(value * 60 * 1000);
  if (unit === "days") return Math.round(value * 24 * 60 * 60 * 1000);
  return Math.round(value * 60 * 60 * 1000);
}

function ta_format_duration_ms(ms) {
  let minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  let hours = Math.round(ms / 3600000);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  let days = Math.round(ms / 86400000);
  return `${days} day${days === 1 ? "" : "s"}`;
}

async function ta_show_duration_config(action_label, on_confirm) {
  let existing = document.querySelector(".ta-confirm-overlay");
  if (existing) existing.remove();
  let locked_count = await ta_get_locked_trade_count();

  let overlay = document.createElement("div");
  overlay.className = "ta-confirm-overlay";
  overlay.innerHTML = `
    <div class="ta-confirm-box">
      <div class="ta-confirm-title">Configure duration</div>
      <div class="ta-confirm-msg">${escape_html(action_label)}.${ta_locked_count_html(locked_count)}</div>
      <div class="ta-filter-row">
        <span class="ta-filter-label">Cancel outbound trades older than</span>
        <span class="ta-filter-input-wrap">
          <input class="ta-filter-input" type="number" min="1" max="9999" step="1" value="24" id="ta-duration-input">
          <select class="ta-filter-unit-select" id="ta-duration-unit">
            <option value="minutes">minutes</option>
            <option value="hours" selected>hours</option>
            <option value="days">days</option>
          </select>
        </span>
      </div>
      <div class="ta-confirm-actions">
        <button class="ta-confirm-btn ta-confirm-cancel">Cancel</button>
        <button class="ta-confirm-btn ta-confirm-go">Do it</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let input = overlay.querySelector("#ta-duration-input");
  let unit = overlay.querySelector("#ta-duration-unit");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") overlay.querySelector(".ta-confirm-go").click();
  });
  requestAnimationFrame(() => input.focus());

  overlay
    .querySelector(".ta-confirm-cancel")
    .addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector(".ta-confirm-go").addEventListener("click", () => {
    let max_trade_age_ms = ta_parse_duration_ms(input.value, unit.value);
    if (!(max_trade_age_ms > 0)) {
      input.focus();
      return;
    }
    overlay.remove();
    on_confirm(max_trade_age_ms);
  });
}

async function ta_show_overpay_config(action_label, on_confirm) {
  let existing = document.querySelector(".ta-confirm-overlay");
  if (existing) existing.remove();
  let locked_count = await ta_get_locked_trade_count();

  let overlay = document.createElement("div");
  overlay.className = "ta-confirm-overlay";
  overlay.innerHTML = `
    <div class="ta-confirm-box">
      <div class="ta-confirm-title">Configure filter</div>
      <div class="ta-confirm-msg">${escape_html(action_label)}.${ta_locked_count_html(locked_count)}</div>
      <div class="ta-filter-row">
        <span class="ta-filter-label">Only cancel if overpaying by more than</span>
        <span class="ta-filter-input-wrap">
          <input class="ta-filter-input" type="number" min="0" max="9999" step="1" value="0" id="ta-pct-input">
          <span class="ta-filter-unit">%</span>
        </span>
      </div>
      <div class="ta-confirm-actions">
        <button class="ta-confirm-btn ta-confirm-cancel">Cancel</button>
        <button class="ta-confirm-btn ta-confirm-go">Do it</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  let input = overlay.querySelector("#ta-pct-input");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") overlay.querySelector(".ta-confirm-go").click();
  });
  requestAnimationFrame(() => input.focus());

  overlay
    .querySelector(".ta-confirm-cancel")
    .addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.querySelector(".ta-confirm-go").addEventListener("click", () => {
    let pct = Math.max(0, parseFloat(input.value) || 0);
    overlay.remove();
    on_confirm(pct);
  });
}

function ta_update_buttons(progress) {
  let root = document.getElementById("trade-actions-root");
  if (!root) return;

  for (let action of ta_actions) {
    let btn = root.querySelector(`[data-ta-action="${action.id}"]`);
    if (!btn) continue;

    let status_el = btn.querySelector(".ta-btn-status");
    let icon_wrap = btn.querySelector(".ta-btn-icon");

    let stop_btn = btn.querySelector(".ta-stop-btn");

    if (progress?.running && progress.action === action.id) {
      btn.disabled = false;
      btn.classList.add("ta-running");
      btn.classList.remove("ta-done", "ta-error");
      let wait_sec = progress.wait_until
        ? Math.max(0, Math.ceil((progress.wait_until - Date.now()) / 1000))
        : 0;
      let wait_suffix =
        wait_sec > 0 ? ` \u2014 rate limit, resuming in ${wait_sec}s` : "";
      let status_text = "Starting...";
      if (progress.phase === "fetching") {
        status_text =
          (progress.total > 0
            ? `Fetching trades... ${progress.total} found (page ${progress.fetched_pages})`
            : `Fetching trades... (page ${progress.fetched_pages || 1})`) +
          wait_suffix;
      } else if (progress.phase === "checking") {
        status_text =
          `Checking ${progress.checked}/${progress.total} \u2014 ${progress.done} declined, ${progress.skipped} skipped` +
          wait_suffix;
      } else if (progress.phase === "declining") {
        status_text =
          `Declining ${progress.done}/${progress.total}...` + wait_suffix;
      }
      status_el.textContent = status_text;
      if (!btn.querySelector(".ta-spinner")) {
        let existing_svg = icon_wrap.querySelector("svg");
        if (existing_svg) existing_svg.style.display = "none";
        let spinner = document.createElement("div");
        spinner.className = "ta-spinner";
        icon_wrap.appendChild(spinner);
      }
      if (!stop_btn) {
        stop_btn = document.createElement("button");
        stop_btn.className = "ta-stop-btn";
        stop_btn.textContent = "Stop";
        stop_btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          stop_btn.disabled = true;
          status_el.textContent = "Stopping...";
          await ta_send("ta_stop");
          let next = await ta_send("ta_progress");
          ta_update_buttons(next);
          if (!next?.running && ta_poll_timer) {
            clearInterval(ta_poll_timer);
            ta_poll_timer = null;
          }
        });
        btn.appendChild(stop_btn);
      }
    } else if (progress?.running) {
      btn.disabled = true;
      status_el.textContent = "Another action is running...";
      if (stop_btn) stop_btn.remove();
    } else {
      btn.disabled = false;
      btn.classList.remove("ta-running");
      if (stop_btn) stop_btn.remove();
      let spinner = btn.querySelector(".ta-spinner");
      if (spinner) {
        spinner.remove();
        let svg = icon_wrap.querySelector("svg");
        if (svg) svg.style.display = "";
      }

      if (
        !progress?.running &&
        progress?.action === action.id &&
        (progress?.total > 0 || progress?.error)
      ) {
        if (progress.error) {
          btn.classList.add("ta-error");
          status_el.textContent = `Stopped: ${progress.error} (${progress.done}/${progress.total})`;
        } else {
          btn.classList.add("ta-done");
          status_el.textContent =
            progress.skipped > 0
              ? `Done! ${progress.done} declined, ${progress.skipped} skipped.`
              : `Done! ${progress.done} trades declined.`;
        }
      } else if (!progress?.running && progress?.action !== action.id) {
        status_el.textContent = "";
        btn.classList.remove("ta-done", "ta-error");
      }
    }
  }
}

async function ta_start_polling() {
  if (ta_poll_timer) return;
  ta_poll_timer = setInterval(async () => {
    let progress = await ta_send("ta_progress");
    if (!progress) return;
    ta_update_buttons(progress);
    if (!progress.running) {
      clearInterval(ta_poll_timer);
      ta_poll_timer = null;
    }
  }, 800);
}

async function render_actions_tab() {
  let root = document.getElementById("trade-actions-root");
  if (!root) return;

  let layout = actions_ensure_category_layout(root);
  let bulk_inner = layout.querySelector("#actions-bulk-inner");
  let ms_root = layout.querySelector("#actions-ms-root");
  if (!bulk_inner || !ms_root) return;

  let progress = await ta_send("ta_progress");
  if (!bulk_inner.querySelector(".ta-section")) {
    render_bulk_cancel_into(bulk_inner);
  } else {
    ta_update_buttons(progress);
  }
  if (progress?.running) ta_start_polling();

  let active = actions_get_active_category(layout);
  if (active === "mass" || ms_root.dataset.msMounted === "1") {
    await render_mass_send_panel(ms_root);
  }
}

function actions_get_active_category(root) {
  if (root?.dataset?.actionsActiveCategory === "mass") return "mass";
  if (root?.dataset?.actionsActiveCategory === "bulk") return "bulk";
  return globalThis.__nte_actions_active_category === "mass" ? "mass" : "bulk";
}

function actions_set_active_category(root, category) {
  if (!root) return;
  let cat = category === "mass" ? "mass" : "bulk";
  globalThis.__nte_actions_active_category = cat;
  root.dataset.actionsActiveCategory = cat;
  root.querySelectorAll(".ta-category-pick").forEach((btn) => {
    let on = btn.dataset.actionsCategory === cat;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  root.querySelectorAll("[data-actions-category-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.actionsCategoryPanel !== cat;
  });
}

function actions_bind_category_picks(root) {
  root.querySelectorAll(".ta-category-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      actions_set_active_category(root, btn.dataset.actionsCategory);
      if (btn.dataset.actionsCategory === "mass") {
        let ms_root = root.querySelector("#actions-ms-root");
        if (ms_root) void render_mass_send_panel(ms_root);
      }
    });
  });
  actions_set_active_category(root, actions_get_active_category(root));
}

function actions_ensure_category_layout(root) {
  if (!root) return null;
  let cat = actions_get_active_category(root);
  if (!root.querySelector("#actions-bulk-inner")) {
    root.innerHTML = `
    <div class="ta-category-bar" role="tablist" aria-label="Actions sections">
      <button type="button" class="ta-category-pick is-active" data-actions-category="bulk" role="tab" aria-selected="true" aria-controls="actions-bulk-panel">
        <span class="ta-category-pick-label">Bulk Cancel</span>
        <span class="ta-category-pick-note">Decline trades in bulk</span>
      </button>
      <button type="button" class="ta-category-pick" data-actions-category="mass" role="tab" aria-selected="false" aria-controls="actions-ms-panel">
        <span class="ta-category-pick-label">Mass Sending</span>
        <span class="ta-category-pick-note">Send trades in bulk</span>
      </button>
    </div>
    <div class="ta-category-panel" id="actions-bulk-panel" data-actions-category-panel="bulk" role="tabpanel">
      <div id="actions-bulk-inner" class="actions-bulk-inner"></div>
    </div>
    <div class="ta-category-panel" id="actions-ms-panel" data-actions-category-panel="mass" role="tabpanel" hidden>
      <div id="actions-ms-root" class="actions-ms-root"></div>
    </div>`;
    root.dataset.actionsActiveCategory = cat;
    actions_bind_category_picks(root);
  }
  actions_set_active_category(root, cat);
  return root;
}

function render_bulk_cancel_into(bulk_inner) {
  if (!bulk_inner) return;
  let cancel_icon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6"/><path d="M15 9l-6 6"/></svg>';
  let inbound_icon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3H10L8 12H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>';
  let outbound_icon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  bulk_inner.innerHTML = `
    <div class="ta-section ta-section-inbound">
      <div class="ta-section-title">
        <span class="ta-section-icon">${inbound_icon}</span>
        Inbound Trades
      </div>
      <div class="ta-buttons">
        ${ta_actions
          .filter((a) => a.section === "inbound")
          .map(
            (a) => `
          <button class="ta-btn" data-ta-action="${a.id}">
            <span class="ta-btn-icon">${cancel_icon}</span>
            <span class="ta-btn-text">
              <span class="ta-btn-label">${escape_html(a.label)}</span>
              <span class="ta-btn-status"></span>
            </span>
          </button>
        `,
          )
          .join("")}
      </div>
    </div>
    <div class="ta-section ta-section-outbound">
      <div class="ta-section-title">
        <span class="ta-section-icon">${outbound_icon}</span>
        Outbound Trades
      </div>
      <div class="ta-buttons">
        ${ta_actions
          .filter((a) => a.section === "outbound")
          .map(
            (a) => `
          <button class="ta-btn" data-ta-action="${a.id}">
            <span class="ta-btn-icon">${cancel_icon}</span>
            <span class="ta-btn-text">
              <span class="ta-btn-label">${escape_html(a.label)}</span>
              <span class="ta-btn-status"></span>
            </span>
          </button>
        `,
          )
          .join("")}
      </div>
    </div>
  `;

  for (let action of ta_actions) {
    let btn = bulk_inner.querySelector(`[data-ta-action="${action.id}"]`);
    btn.addEventListener("click", () => {
      if (btn.disabled || btn.classList.contains("ta-running")) return;
      let is_overpay = action.id.endsWith("_overpaying");
      let is_duration = action.id === "cancel_outbound_older_than";
      let show = is_overpay
        ? ta_show_overpay_config
        : is_duration
          ? ta_show_duration_config
          : ta_show_confirm;
      show(action.label, async (param = 0) => {
        let payload = { action: action.id };
        if (is_overpay) payload.min_overpay_pct = param;
        if (is_duration) payload.max_trade_age_ms = param;
        await ta_send("ta_start", payload);
        ta_start_polling();
        let p = await ta_send("ta_progress");
        ta_update_buttons(p);
      });
    });
  }

  void ta_send("ta_progress").then((p) => {
    ta_update_buttons(p);
    if (p?.running) ta_start_polling();
  });
}

const mass_send_config_key = "mass_send_config";
const mass_send_rate_unlocked_key = "mass_send_rate_unlocked";
const mass_send_rate_store_opened_key = "mass_send_rate_store_opened";
let ms_poll_timer = null;
let ms_inventory_session_items = null;
let ms_inventory_session_promise = null;
let ms_blocklist_io_flash = null;

function ms_reset_inventory_session() {
  ms_inventory_session_items = null;
  ms_inventory_session_promise = null;
}

async function ms_load_inventory_session() {
  if (ms_inventory_session_items != null) return ms_inventory_session_items;
  if (ms_inventory_session_promise) return ms_inventory_session_promise;
  ms_inventory_session_promise = (async () => {
    let res = await new Promise((resolve) =>
      chrome.runtime.sendMessage({ type: "ms_inventory" }, resolve),
    );
    ms_inventory_session_promise = null;
    if (!res?.ok) throw new Error(res?.error || "Could not load inventory");
    ms_inventory_session_items = res.items || [];
    return ms_inventory_session_items;
  })();
  return ms_inventory_session_promise;
}

function open_totp_autofill_from_mass_send() {
  let tab = document.querySelector('.tab[data-tab="options"]');
  tab?.click();
  requestAnimationFrame(() => {
    let expand = document.getElementById("nte-totp-expand");
    if (expand && expand.getAttribute("aria-expanded") !== "true") {
      expand.click();
    }
    document.querySelector(".nte-totp-card")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  });
}

async function maybe_focus_mass_send_2fa() {
  let progress = await ms_send("ms_progress");
  let st = await get_storage(["nte_ms_focus_2fa"]);
  let needs =
    !!(progress?.running && progress?.prompt?.kind) || !!st?.nte_ms_focus_2fa;
  if (!needs) return;
  if (st?.nte_ms_focus_2fa) {
    try {
      await set_storage({ nte_ms_focus_2fa: false });
    } catch {}
  }
  globalThis.__nte_actions_active_category = "mass";
  let tab = document.querySelector('.tab[data-tab="tradeactions"]');
  let actions_root = document.getElementById("trade-actions-root");
  let on_mass =
    tab?.classList.contains("active") &&
    actions_get_active_category(actions_root) === "mass";
  if (on_mass) {
    let ms_root = actions_root?.querySelector("#actions-ms-root");
    if (ms_root) {
      ms_update_progress_ui(ms_root, progress);
      if (progress?.running) ms_start_polling(ms_root);
    }
    return;
  }
  if (tab && !tab.classList.contains("active")) {
    tab.click();
    return;
  }
  if (!actions_root) return;
  actions_set_active_category(actions_root, "mass");
  let ms_root = actions_root.querySelector("#actions-ms-root");
  if (ms_root) await render_mass_send_panel(ms_root);
}

function ms_send(type, extra) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...extra }, (r) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(r);
    });
  });
}

function ms_default_config() {
  return {
    offer_slots: [null, null, null, null],
    request_slots: [null, null, null, null],
    offer_robux: 0,
    request_robux: 0,
    presets: [null, null, null, null],
    preset_editor_index: 0,
    online_hours: 24,
    max_trades: 25,
    avoid_recent_days: 2,
    max_owned_days: 0,
    blocked_users: [],
    config_open: false,
    blocklist_open: false,
  };
}

function ms_normalize_slots(slots) {
  let out = Array.isArray(slots) ? slots.slice(0, 4) : [];
  while (out.length < 4) out.push(null);
  return out.map((x) => {
    let n = Number(x);
    return Number.isFinite(n) && n > 0 ? n : null;
  });
}

function ms_clamp_robux(value) {
  let n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(1_000_000_000, n);
}

function ms_normalize_preset(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  let name = String(raw.name || `Preset ${index + 1}`).trim();
  let p = {
    name: name.slice(0, 28) || `Preset ${index + 1}`,
    offer_slots: ms_normalize_slots(raw.offer_slots),
    request_slots: ms_normalize_slots(raw.request_slots),
    offer_robux: ms_clamp_robux(raw.offer_robux),
    request_robux: ms_clamp_robux(raw.request_robux),
  };
  let has_offer = p.offer_slots.some((x) => x != null) || p.offer_robux > 0;
  let has_request =
    p.request_slots.some((x) => x != null) || p.request_robux > 0;
  return has_offer || has_request ? p : null;
}

function ms_normalize_presets(input) {
  let raw = Array.isArray(input) ? input : [];
  let out = [];
  for (let i = 0; i < 4; i++) out.push(ms_normalize_preset(raw[i], i));
  return out;
}

const ms_online_hours_max = 8760; // 1 year; 0 = filter off

function ms_clamp_hours(value) {
  let n = Math.floor(Number(value));
  if (!Number.isFinite(n)) n = 24;
  return Math.max(0, Math.min(ms_online_hours_max, n));
}

function ms_clamp_max_trades(value, cap) {
  let n = Math.floor(Number(value));
  if (!Number.isFinite(n)) n = 25;
  let hard = 100;
  let limit = Math.floor(Number(cap));
  if (Number.isFinite(limit) && limit >= 0) hard = Math.min(hard, limit);
  if (hard <= 0) return 0;
  return Math.max(1, Math.min(hard, n));
}

function ms_trade_limit_hint_text(limit) {
  let max = Math.max(1, Number(limit?.max) || 100);
  if (!Number.isFinite(Number(limit?.remaining))) {
    return "Trade limit unavailable";
  }
  let remaining = Math.max(0, Number(limit.remaining));
  let count = Number.isFinite(Number(limit?.count))
    ? Math.max(0, Number(limit.count))
    : max - remaining;
  if (remaining <= 0) return `0/${max} left today`;
  return `${remaining} left today · ${count}/${max}`;
}

function ms_clamp_avoid_days(value) {
  let n = Math.floor(Number(value));
  if (!Number.isFinite(n)) n = 2;
  return Math.max(0, Math.min(365, n));
}

function ms_clamp_max_owned_days(value) {
  let n = Math.floor(Number(value));
  if (!Number.isFinite(n)) n = 0;
  return Math.max(0, Math.min(3650, n));
}

function ms_normalize_blocked_users(raw) {
  let out = [];
  let seen = new Set();
  for (let row of Array.isArray(raw) ? raw : []) {
    let user_id = Number(row?.user_id) || 0;
    if (!(user_id > 0) || seen.has(user_id)) continue;
    seen.add(user_id);
    out.push({
      user_id,
      name: String(row?.name || `User ${user_id}`).trim().slice(0, 40),
    });
  }
  return out;
}

function ms_blocked_user_from_import_row(row) {
  if (row == null) return null;
  if (typeof row === "number" || (typeof row === "string" && /^\d+$/.test(row.trim()))) {
    let user_id = Number(row);
    if (!(user_id > 0)) return null;
    return { user_id, name: `User ${user_id}` };
  }
  if (typeof row === "string") {
    let name = row.trim().slice(0, 40);
    if (!name) return null;
    return { user_id: 0, name, pending_name: name };
  }
  if (typeof row !== "object") return null;
  let user_id =
    Number(row.user_id) ||
    Number(row.userId) ||
    Number(row.id) ||
    Number(row.userid) ||
    0;
  let name = String(
    row.name || row.username || row.userName || row.displayName || "",
  )
    .trim()
    .slice(0, 40);
  if (user_id > 0) {
    return { user_id, name: name || `User ${user_id}` };
  }
  if (name) return { user_id: 0, name, pending_name: name };
  return null;
}

function ms_extract_blocklist_import_rows(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid blocklist file.");
  }
  if (Array.isArray(parsed.users)) return parsed.users;
  if (Array.isArray(parsed.blocked_users)) return parsed.blocked_users;
  if (Array.isArray(parsed.blocklist)) return parsed.blocklist;
  throw new Error("Invalid blocklist file.");
}

async function ms_resolve_blocklist_usernames(names) {
  let unique = [];
  let seen = new Set();
  for (let name of names || []) {
    let key = String(name || "")
      .trim()
      .toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(String(name).trim());
  }
  let map = new Map();
  for (let i = 0; i < unique.length; i += 100) {
    let batch = unique.slice(i, i + 100);
    let res = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        usernames: batch,
        excludeBannedUsers: false,
      }),
    });
    if (!res.ok) continue;
    let data = await res.json().catch(() => null);
    for (let row of Array.isArray(data?.data) ? data.data : []) {
      let user_id = Number(row?.id) || 0;
      let requested = String(row?.requestedUsername || row?.name || "")
        .trim()
        .toLowerCase();
      if (!(user_id > 0) || !requested) continue;
      map.set(requested, {
        user_id,
        name: String(row?.name || row?.requestedUsername || `User ${user_id}`)
          .trim()
          .slice(0, 40),
      });
    }
  }
  return map;
}

async function ms_parse_blocklist_import(parsed) {
  let raw_rows = ms_extract_blocklist_import_rows(parsed);
  let staged = [];
  let pending_names = [];
  for (let row of raw_rows) {
    let item = ms_blocked_user_from_import_row(row);
    if (!item) continue;
    if (item.pending_name) {
      pending_names.push(item.pending_name);
      staged.push(item);
      continue;
    }
    staged.push(item);
  }
  let resolved = pending_names.length
    ? await ms_resolve_blocklist_usernames(pending_names)
    : new Map();
  let out = [];
  let unresolved = 0;
  for (let item of staged) {
    if (item.pending_name) {
      let hit = resolved.get(item.pending_name.toLowerCase());
      if (!hit) {
        unresolved += 1;
        continue;
      }
      out.push(hit);
      continue;
    }
    out.push({ user_id: item.user_id, name: item.name });
  }
  return {
    users: ms_normalize_blocked_users(out),
    unresolved,
  };
}

function ms_merge_blocked_users(existing, incoming) {
  let base = ms_normalize_blocked_users(existing);
  let seen = new Set(base.map((row) => row.user_id));
  let added = 0;
  let skipped_dupes = 0;
  for (let row of ms_normalize_blocked_users(incoming)) {
    if (seen.has(row.user_id)) {
      skipped_dupes += 1;
      continue;
    }
    seen.add(row.user_id);
    base.push(row);
    added += 1;
  }
  return {
    users: base,
    added,
    skipped_dupes,
  };
}

function ms_export_blocklist_file(users) {
  let payload = {
    type: "extension-mass-send-blocklist",
    version: 1,
    exported_at: new Date().toISOString(),
    users: ms_normalize_blocked_users(users),
  };
  let blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  let url = URL.createObjectURL(blob);
  let date = new Date().toISOString().slice(0, 10);
  let link = document.createElement("a");
  link.href = url;
  link.download = `never-send-blocklist-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ms_normalize_config(raw) {
  let base = ms_default_config();
  let cfg = raw && typeof raw === "object" ? raw : {};
  let avoid_days =
    cfg.avoid_recent === false
      ? 0
      : cfg.avoid_recent_days != null
        ? cfg.avoid_recent_days
        : base.avoid_recent_days;
  let offer_robux = ms_clamp_robux(
    cfg.offer_robux != null ? cfg.offer_robux : base.offer_robux,
  );
  let request_robux = ms_clamp_robux(
    cfg.request_robux != null ? cfg.request_robux : base.request_robux,
  );
  return {
    offer_slots: ms_normalize_slots(cfg.offer_slots),
    request_slots: ms_normalize_slots(cfg.request_slots),
    offer_robux,
    request_robux,
    presets: ms_normalize_presets(cfg.presets),
    preset_editor_index: Math.max(
      0,
      Math.min(3, Math.floor(Number(cfg.preset_editor_index)) || 0),
    ),
    online_hours: ms_clamp_hours(
      cfg.online_hours != null ? cfg.online_hours : base.online_hours,
    ),
    max_trades: ms_clamp_max_trades(
      cfg.max_trades != null ? cfg.max_trades : base.max_trades,
    ),
    avoid_recent_days: ms_clamp_avoid_days(avoid_days),
    max_owned_days: ms_clamp_max_owned_days(
      cfg.max_owned_days != null ? cfg.max_owned_days : base.max_owned_days,
    ),
    blocked_users: ms_normalize_blocked_users(
      cfg.blocked_users != null ? cfg.blocked_users : base.blocked_users,
    ),
    config_open: cfg.config_open === true,
    blocklist_open: cfg.blocklist_open === true,
  };
}

async function ms_load_config() {
  let saved = await get_storage([mass_send_config_key]);
  return ms_normalize_config(saved[mass_send_config_key]);
}

async function ms_save_config(next) {
  let cfg = ms_normalize_config(next);
  await set_storage({ [mass_send_config_key]: cfg });
  return cfg;
}

function ms_preset_summary(preset) {
  if (!preset) return "Empty";
  let offer_count = preset.offer_slots.filter((x) => x != null).length;
  let request_count = preset.request_slots.filter((x) => x != null).length;
  let offer_rbx =
    Number(preset.offer_robux) > 0
      ? ` + ${format_number(preset.offer_robux)} R$`
      : "";
  let request_rbx =
    Number(preset.request_robux) > 0
      ? ` + ${format_number(preset.request_robux)} R$`
      : "";
  return `${offer_count}${offer_rbx} offer · ${request_count}${request_rbx} want`;
}

function ms_slot_html(side, i, id) {
  if (id != null) {
    let aid = Number(id);
    return `<div class="ta-slot" data-ms-side="${side}" data-index="${i}"><div class="ta-slot-thumb-wrap"><img src="${escape_html(trade_ads_thumb_placeholder_src)}" alt="" data-thumb-aid="${aid}" data-thumb-pending="1" decoding="async" /><button type="button" class="ta-slot-clear" data-ms-side="${side}" data-index="${i}" aria-label="Clear">×</button></div></div>`;
  }
  return `<div class="ta-slot ta-slot-is-empty" data-ms-side="${side}" data-index="${i}"><span class="ta-slot-empty">${side === "offer" ? "Offer" : "Want"}</span></div>`;
}

function ms_sum_slot_metrics(slots, metrics) {
  let value = 0;
  let count = 0;
  for (let id of slots || []) {
    if (id == null) continue;
    let m = metrics[String(id)];
    if (!m) continue;
    let value_line =
      m.valueLine != null
        ? Number(m.valueLine) || 0
        : Number(m.rolimonsValue) || 0;
    if (!(value_line > 0)) value_line = Number(m.rap) || 0;
    value += value_line;
    count += 1;
  }
  return { value, count };
}

function ms_side_label_html(title, totals, extra_class, robux_input) {
  let mod = extra_class ? ` ${extra_class}` : "";
  let value =
    (Number(totals?.value) || 0) + (Number(totals?.robux) || 0);
  let has_total = value > 0 || (totals?.count || 0) > 0;
  let roli_icon_url = escape_html(get_asset_url("assets/rolimons.png"));
  let total_html = has_total
    ? `<span class="ta-preview-label-total" title="Items + Robux">
        <img class="ta-preview-label-roli" src="${roli_icon_url}" width="15" height="15" alt="" decoding="async" />
        <span class="ta-preview-label-value">${escape_html(format_number(value))}</span>
      </span>`
    : "";
  let robux_html = "";
  if (robux_input?.id) {
    let amount = ms_clamp_robux(robux_input.value);
    let aria = escape_html(robux_input.aria || "Robux");
    robux_html = `<label class="ms-robux-chip${amount > 0 ? " is-active" : ""}" title="${aria}">
      <span class="ms-robux-chip-prefix" aria-hidden="true">R$</span>
      <input type="number" id="${escape_html(robux_input.id)}" min="0" step="1" inputmode="numeric" value="${amount}" aria-label="${aria}" />
    </label>`;
  }
  return `<div class="ta-preview-label ms-side-head${mod}">
    <span class="ta-preview-label-text">${escape_html(title)}</span>
    <span class="ms-side-head-right">${robux_html}${total_html}</span>
  </div>`;
}

async function ms_fetch_slot_metrics(cfg) {
  let ids = [
    ...(cfg?.offer_slots || []),
    ...(cfg?.request_slots || []),
  ]
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
  ids = [...new Set(ids)];
  if (!ids.length) return {};
  let res = await ms_send("ms_item_metrics", { asset_ids: ids });
  return res?.metrics && typeof res.metrics === "object" ? res.metrics : {};
}

async function ms_fill_user_avatars(scope_el) {
  if (!scope_el) return;
  let imgs = [
    ...scope_el.querySelectorAll("img[data-ms-avatar]:not([data-ms-avatar-done])"),
  ];
  if (!imgs.length) return;
  let ids = [];
  let seen = new Set();
  for (let img of imgs) {
    let id = String(img.dataset.msAvatar || "").trim();
    if (!/^\d+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  if (!ids.length) return;
  let url_map = {};
  for (let i = 0; i < ids.length; i += 100) {
    let chunk = ids.slice(i, i + 100);
    try {
      let res = await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${chunk.join(",")}&size=48x48&format=Png&isCircular=true`,
      );
      if (!res.ok) continue;
      let data = await res.json().catch(() => null);
      for (let row of data?.data || []) {
        if (row?.targetId != null && row?.imageUrl) {
          url_map[String(row.targetId)] = row.imageUrl;
        }
      }
    } catch {}
  }
  for (let img of imgs) {
    if (!img.isConnected) continue;
    let u = url_map[String(img.dataset.msAvatar || "")];
    if (u) img.src = u;
    img.setAttribute("data-ms-avatar-done", "1");
  }
}

function ms_config_summary(cfg) {
  let hours = ms_clamp_hours(cfg?.online_hours);
  let sends = ms_clamp_max_trades(cfg?.max_trades);
  let days = ms_clamp_avoid_days(cfg?.avoid_recent_days);
  let owned = ms_clamp_max_owned_days(cfg?.max_owned_days);
  let blocked = ms_normalize_blocked_users(cfg?.blocked_users).length;
  let online = hours > 0 ? `${hours}h` : "online off";
  let skip = days > 0 ? `skip ${days}d` : "skip off";
  let parts = [online, `${sends} sends`, skip];
  if (owned > 0) parts.push(`own ≤${owned}d`);
  if (blocked > 0) parts.push(`${blocked} blocked`);
  return parts.join(" · ");
}

function ms_field_help_html(aria, tip) {
  return `<span class="ms-field-help" tabindex="0" role="button" aria-label="${escape_html(aria)}">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    <span class="ms-field-tooltip" role="tooltip">${escape_html(tip)}</span>
  </span>`;
}

function ms_progress_text(progress) {
  if (!progress) return "Idle";
  if (progress.running) {
    let status = String(progress.status || "");
    if (/ratelimited waiting \d+s/i.test(status)) return status;
    if (/waiting for new 2fa code/i.test(status)) return status;
    if (progress.prompt?.kind === "code") {
      if (progress.prompt.error) return progress.prompt.error;
      if (progress.prompt.busy) return "Checking 2FA…";
      return "Waiting for 2FA code…";
    }
    if (progress.prompt?.kind === "unlock") return "Unlock 2FA secret…";
    let wait_sec = progress.wait_until
      ? Math.max(0, Math.ceil((progress.wait_until - Date.now()) / 1000))
      : 0;
    if (wait_sec > 0) return `Ratelimited waiting ${wait_sec}s`;
    return (
      status ||
      `Sending… ${progress.sent || 0} sent, ${progress.skipped || 0} skipped, ${progress.failed || 0} failed`
    );
  }
  if (progress.error) return `Stopped: ${progress.error}`;
  if (progress.total > 0 || progress.sent > 0 || progress.failed > 0) {
    return `Done — ${progress.sent || 0} sent, ${progress.skipped || 0} skipped, ${progress.failed || 0} failed`;
  }
  return progress.status || "Idle";
}

function ms_sync_2fa_box(root, progress) {
  let box = root.querySelector("#ms-2fa-box");
  if (!box) return;
  let awaiting =
    !!progress?.running &&
    progress?.phase === "awaiting_2fa" &&
    !!progress?.prompt?.kind;
  let was_hidden = box.hidden;
  box.hidden = !awaiting;
  if (!awaiting) {
    box.dataset.ms2faKind = "";
    return;
  }
  let unlock = progress.prompt.kind === "unlock";
  box.classList.toggle("is-unlock", unlock);
  let title = box.querySelector("#ms-2fa-title");
  let copy = box.querySelector("#ms-2fa-copy");
  let input = box.querySelector("#ms-2fa-input");
  let hint = box.querySelector("#ms-2fa-hint");
  let err = box.querySelector("#ms-2fa-error");
  let submit = box.querySelector("#ms-2fa-submit");
  if (title)
    title.textContent = unlock ? "Unlock 2FA secret" : "Enter 2FA code";
  if (copy) {
    copy.textContent = unlock
      ? "Your saved 2FA secret is password-locked. Enter the lock password so Mass Sending can continue."
      : "Mass Sending needs your Roblox authenticator code to keep sending.";
  }
  if (input) {
    input.type = unlock ? "password" : "text";
    input.inputMode = unlock ? "text" : "numeric";
    input.maxLength = unlock ? 128 : 8;
    input.placeholder = unlock ? "Lock password" : "6-digit code";
    input.autocomplete = unlock ? "off" : "one-time-code";
  }
  if (hint) hint.hidden = unlock;
  let prompt_err = String(progress.prompt?.error || "").trim();
  let busy = progress.prompt?.busy === true;
  let status_key = `${progress.prompt.kind}:${prompt_err || (busy ? "busy" : "wait")}`;
  let first = was_hidden || box.dataset.ms2faKey !== status_key;
  if (err) {
    if (prompt_err) {
      err.hidden = false;
      err.textContent = prompt_err;
    } else if (first) {
      err.hidden = true;
      err.textContent = "";
    }
  }
  if (submit) {
    submit.disabled = busy;
    submit.textContent = busy
      ? "Checking…"
      : unlock
        ? "Unlock"
        : "Continue";
  }
  if (input) input.disabled = busy;
  if (input && first && !busy) {
    input.value = "";
    input.focus();
  }
  box.dataset.ms2faKey = status_key;
  box.dataset.ms2faKind = progress.prompt.kind;
}

function ms_update_progress_ui(root, progress) {
  if (!root) return;
  let line = root.querySelector("#ms-progress-line");
  let run_btn = root.querySelector("#ms-run");
  if (line) line.textContent = ms_progress_text(progress);
  let running = !!progress?.running;
  root.classList.toggle("is-running", running);
  if (run_btn) {
    run_btn.disabled = false;
    run_btn.classList.toggle("is-stop", running);
    run_btn.setAttribute("aria-label", running ? "Stop" : "Start");
    let label = run_btn.querySelector(".ms-action-label");
    if (label) label.textContent = running ? "Stop" : "Start";
  }
  ms_sync_2fa_box(root, progress);
}

function ms_start_polling(root) {
  if (ms_poll_timer) clearInterval(ms_poll_timer);
  ms_poll_timer = setInterval(async () => {
    let progress = await ms_send("ms_progress");
    ms_update_progress_ui(root, progress);
    if (!progress?.running) {
      clearInterval(ms_poll_timer);
      ms_poll_timer = null;
    }
  }, 800);
}

async function render_mass_send_panel(root) {
  if (!root) return;
  if (typeof nte_is_lite === "function" && nte_is_lite()) {
    root.dataset.msMounted = "1";
    root.innerHTML = `<div class="ta-notifs-empty-card ta-notifs-lite-card"><div class="ta-notifs-lite-badge">LITE</div><p class="ta-notifs-empty-title">Mass Sending needs Full</p><p class="ta-notifs-empty-copy">LITE stays fully client-side. Grab the full extension to mass-send trades to recent owners.</p><a class="ta-notifs-lite-link" href="https://nevos-extension.com" target="_blank" rel="noopener noreferrer" data-open-new-tab="true">Get Full on nevos-extension.com</a></div>`;
    return;
  }

  let store = get_extension_store_review_info();
  let unlock_st = await get_storage([
    mass_send_rate_unlocked_key,
    mass_send_rate_store_opened_key,
  ]);
  let rate_unlocked = !!unlock_st[mass_send_rate_unlocked_key];
  let store_opened = !!unlock_st[mass_send_rate_store_opened_key];
  if (!store) {
    // No store page for this runtime — don't brick Mass Sending.
    if (!rate_unlocked) {
      await set_storage({ [mass_send_rate_unlocked_key]: true });
      rate_unlocked = true;
    }
  } else if (!rate_unlocked) {
    root.dataset.msMounted = "1";
    root.innerHTML = `<div class="ms-rate-gate">
      <div class="ms-rate-gate-glow" aria-hidden="true"></div>
      <div class="ms-rate-gate-stars" aria-hidden="true">
        <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
      </div>
      <div class="ms-rate-gate-kicker">${escape_html(store.label)}</div>
      <h3 class="ms-rate-gate-title">Unlock Mass Sending</h3>
      <p class="ms-rate-gate-copy">Rate the extension <strong>5 stars</strong> and leave a short review. Then come back here.</p>
      <a href="${escape_html_attr(store.url)}" data-open-new-tab="true" rel="noopener noreferrer" class="ms-rate-gate-cta" id="ms-rate-open">
        <span class="ms-rate-gate-cta-star" aria-hidden="true">★</span>
        Rate 5 stars on ${escape_html(store.label)}
      </a>
      <button type="button" class="ms-rate-gate-unlock${store_opened ? " is-shown" : ""}" id="ms-rate-unlock" aria-hidden="${store_opened ? "false" : "true"}">I've rated 5 stars</button>
    </div>`;
    bind_popup_external_links();
    let open_btn = root.querySelector("#ms-rate-open");
    let unlock_btn = root.querySelector("#ms-rate-unlock");
    open_btn?.addEventListener("click", () => {
      void set_storage({ [mass_send_rate_store_opened_key]: true });
      if (!unlock_btn) return;
      unlock_btn.classList.add("is-shown");
      unlock_btn.setAttribute("aria-hidden", "false");
    });
    unlock_btn?.addEventListener("click", async () => {
      await set_storage({
        [mass_send_rate_unlocked_key]: true,
        [mass_send_rate_store_opened_key]: true,
      });
      await render_mass_send_panel(root);
    });
    return;
  }

  let cfg = await ms_load_config();
  let progress = await ms_send("ms_progress");
  let recent = await ms_send("ms_recent");
  let trade_limit = await ms_send("ms_trade_limit");
  if (!trade_limit || typeof trade_limit !== "object") {
    trade_limit = {
      ok: false,
      remaining: null,
      max: 100,
      count: null,
      at_limit: false,
    };
  }
  let trades_left = Number.isFinite(Number(trade_limit.remaining))
    ? Math.max(0, Number(trade_limit.remaining))
    : null;
  let max_trades_cap =
    trades_left != null && trades_left > 0 ? trades_left : 0;
  if (max_trades_cap > 0 && cfg.max_trades > max_trades_cap) {
    cfg = await ms_save_config({
      ...cfg,
      max_trades: ms_clamp_max_trades(cfg.max_trades, max_trades_cap),
    });
  }
  let recent_rows = Array.isArray(recent?.sends) ? recent.sends : [];
  let slot_metrics = await ms_fetch_slot_metrics(cfg);
  let offer_totals = ms_sum_slot_metrics(cfg.offer_slots, slot_metrics);
  let request_totals = ms_sum_slot_metrics(cfg.request_slots, slot_metrics);
  offer_totals.robux = ms_clamp_robux(cfg.offer_robux);
  request_totals.robux = ms_clamp_robux(cfg.request_robux);
  root.dataset.msMounted = "1";
  root._ms_trade_limit = trade_limit;

  let selected_preset = cfg.preset_editor_index;
  let filled_preset_count = cfg.presets.filter(Boolean).length;
  let preset_chips = cfg.presets
    .map((preset, index) => {
      let active = index === selected_preset;
      return `<button type="button" class="ta-preset-chip${active ? " is-active" : ""}" data-ms-preset-index="${index}">
        <span class="ta-preset-chip-name">${escape_html(preset?.name || `Slot ${index + 1}`)}</span>
        <span class="ta-preset-chip-note">${escape_html(ms_preset_summary(preset))}</span>
      </button>`;
    })
    .join("");

  let rows = "";
  rows += ms_side_label_html("You offer", offer_totals, "", {
    id: "ms-offer-robux",
    value: offer_totals.robux,
    aria: "Offer Robux",
  });
  rows += `<div class="ta-slot-row">`;
  for (let i = 0; i < 4; i++) rows += ms_slot_html("offer", i, cfg.offer_slots[i]);
  rows += `</div>`;
  rows += ms_side_label_html(
    "You request",
    request_totals,
    "ta-preview-label-section-gap",
    {
      id: "ms-request-robux",
      value: request_totals.robux,
      aria: "Request Robux",
    },
  );
  rows += `<div class="ta-slot-row">`;
  for (let i = 0; i < 4; i++)
    rows += ms_slot_html("request", i, cfg.request_slots[i]);
  rows += `</div>`;

  let recent_items = "";
  if (recent_rows.length) {
    recent_items = recent_rows
      .map((row, index) => {
        let name = String(row?.name || `User ${row?.user_id || "?"}`).trim();
        let profile = row?.user_id
          ? `https://www.roblox.com/users/${encodeURIComponent(String(row.user_id))}/profile`
          : "";
        let sent = escape_html(format_relative_time(Number(row?.at) || 0));
        let online_label = "";
        let lo = Number(row?.last_online);
        if (Number.isFinite(lo) && lo > 0) {
          let ms = lo > 1e12 ? lo : lo * 1000;
          online_label = `online ${format_relative_time(ms)}`;
        }
        let name_html = profile
          ? `<a href="${profile}" target="_blank" rel="noopener noreferrer" class="ms-recent-link">${escape_html(name)}</a>`
          : `<span class="ms-recent-name">${escape_html(name)}</span>`;
        let offers = Array.isArray(row?.offer_items) ? row.offer_items : [];
        let requests = Array.isArray(row?.request_items) ? row.request_items : [];
        let offer_rbx = ms_clamp_robux(row?.offer_robux);
        let request_rbx = ms_clamp_robux(row?.request_robux);
        let has_items =
          offers.length > 0 ||
          requests.length > 0 ||
          offer_rbx > 0 ||
          request_rbx > 0;
        let expand_btn = has_items
          ? `<button type="button" class="ms-recent-expand" data-ms-recent-index="${index}" aria-expanded="false" aria-label="Show trade items"><span aria-hidden="true">›</span></button>`
          : "";
        let avatar_html = row?.user_id
          ? `<img class="ms-recent-avatar" src="${escape_html(trade_ads_thumb_placeholder_src)}" alt="" data-ms-avatar="${escape_html(String(row.user_id))}" width="32" height="32" decoding="async" />`
          : `<span class="ms-recent-avatar ms-recent-avatar-empty" aria-hidden="true"></span>`;
        function thumb_tag(it) {
          if (!it || it.id == null) return "";
          let aid = Number(it.id) || 0;
          if (!(aid > 0)) return "";
          let href = `https://www.rolimons.com/item/${aid}`;
          return `<a href="${escape_html_attr(href)}" data-open-new-tab="true" rel="noopener noreferrer" class="ta-recent-thumb-link" title="Open on Rolimons"><img src="${escape_html(trade_ads_thumb_placeholder_src)}" alt="" data-thumb-aid="${aid}" data-thumb-pending="1" decoding="async" class="ta-recent-thumb" /></a>`;
        }
        function side_html(label, items, robux) {
          let thumbs = items.map(thumb_tag).join("");
          let rbx = ms_clamp_robux(robux);
          if (!thumbs && !(rbx > 0)) {
            return `<div class="ta-recent-side"><span class="ta-recent-side-label">${label}</span><span class="ta-recent-no-items">—</span></div>`;
          }
          let total =
            items.reduce((s, it) => s + (Number(it.value) || 0), 0) + rbx;
          let total_str = total > 0 ? format_number(total) : "";
          let rbx_html =
            rbx > 0
              ? `<span class="ms-recent-robux">+${escape_html(format_number(rbx))} R$</span>`
              : "";
          return `<div class="ta-recent-side"><span class="ta-recent-side-label">${label}</span><div class="ta-recent-thumbs">${thumbs}${rbx_html}</div>${total_str ? `<span class="ta-recent-total">${total_str}</span>` : ""}</div>`;
        }
        let detail = has_items
          ? `<div class="ms-recent-detail" hidden>
              ${side_html("Offered", offers, offer_rbx)}
              ${side_html("Requested", requests, request_rbx)}
            </div>`
          : "";
        let meta = online_label
          ? `${sent} · ${escape_html(online_label)}`
          : sent;
        return `<div class="ms-recent-item${has_items ? " has-detail" : ""}">
          <div class="ms-recent-row">
            ${avatar_html}
            <div class="ms-recent-copy">
              <div class="ms-recent-main">${name_html}</div>
              <div class="ms-recent-meta">${meta}</div>
            </div>
            ${expand_btn}
          </div>
          ${detail}
        </div>`;
      })
      .join("");
  } else {
    recent_items = `<div class="ta-recent-empty">No mass sends yet.</div>`;
  }

  root.innerHTML = `
    <p class="ta-lede">Send the same offer to recent owners of your requested items. Runs in the background even if you close this popup.</p>
    <div class="ta-card">
      <div class="ta-card-head">
        <div>
          <div class="ta-card-title">Mass send preview</div>
          <div class="ta-card-sub">Tap a square to fill offer and request slots.</div>
        </div>
      </div>
      ${rows}
      <div class="ta-presets">
        <div class="ta-presets-head">
          <div>
            <div class="ta-presets-title">Mass send presets</div>
            <div class="ta-presets-sub">${filled_preset_count ? `${filled_preset_count}/4 saved · ` : ""}Separate from Trade Ads.</div>
          </div>
        </div>
        <div class="ta-preset-strip">${preset_chips}</div>
        <div class="ta-preset-actions">
          <button type="button" class="ta-btn ta-btn-secondary" id="ms-preset-save">Save to slot ${selected_preset + 1}</button>
          <button type="button" class="ta-btn ta-btn-ghost" id="ms-preset-load" ${cfg.presets[selected_preset] ? "" : "disabled"}>Load</button>
          <button type="button" class="ta-btn ta-btn-ghost" id="ms-preset-clear" ${cfg.presets[selected_preset] ? "" : "disabled"}>Clear</button>
        </div>
      </div>
      <div class="ta-divider"></div>
      <div class="ms-config${cfg.config_open ? " is-open" : ""}">
        <button type="button" class="ms-config-toggle" id="ms-config-toggle" aria-expanded="${cfg.config_open ? "true" : "false"}" aria-controls="ms-config-body">
          <span class="ms-config-toggle-copy">
            <span class="ms-config-toggle-title">Config</span>
            <span class="ms-config-toggle-summary" id="ms-config-summary">${escape_html(ms_config_summary(cfg))}</span>
          </span>
          <svg class="ms-config-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        <div class="ms-config-body" id="ms-config-body"${cfg.config_open ? "" : " hidden"}>
          <label class="ms-config-row">
            <span class="ms-config-row-label">
              Online within
              ${ms_field_help_html(
                "About online within hours",
                "Only send to owners last seen online within this many hours (from Rolimons). Set 0 to turn off.",
              )}
            </span>
            <span class="ms-config-row-control">
              <input type="number" id="ms-online-hours" min="0" max="${ms_online_hours_max}" step="1" value="${cfg.online_hours}" />
              <span class="ms-config-suffix">hours</span>
            </span>
          </label>
          <label class="ms-config-row">
            <span class="ms-config-row-label">
              Trades to send
              ${ms_field_help_html(
                "About trades to send",
                "How many successful sends to complete. Failed or privacy-blocked people are skipped and don’t count — it keeps going until this many succeed or no one is left. Capped by Roblox’s 100 trades / 24 hours limit.",
              )}
            </span>
            <span class="ms-config-row-control">
              <input type="number" id="ms-max-trades" min="1" max="${trades_left != null && trades_left > 0 ? trades_left : 100}" step="1" value="${cfg.max_trades}" ${trades_left === 0 ? "disabled" : ""} />
              <span class="ms-config-suffix">trades</span>
            </span>
          </label>
          <div class="ms-trade-limit-hint${trades_left === 0 ? " is-empty" : trades_left != null && trades_left <= 10 ? " is-low" : ""}" id="ms-trade-limit-hint">${escape_html(ms_trade_limit_hint_text(trade_limit))}</div>
          <label class="ms-config-row">
            <span class="ms-config-row-label">
              Skip recent
              ${ms_field_help_html(
                "About skip recent recipients",
                "Don’t send again to people you already mass-sent to within this many days. Set 0 to turn off.",
              )}
            </span>
            <span class="ms-config-row-control">
              <input type="number" id="ms-avoid-days" min="0" max="365" step="1" value="${cfg.avoid_recent_days}" />
              <span class="ms-config-suffix">days</span>
            </span>
          </label>
          <label class="ms-config-row">
            <span class="ms-config-row-label">
              Max owned
              ${ms_field_help_html(
                "About max owned days",
                "Skip people who have owned the requested item(s) longer than this many days (Rolimons Owned Since). 0 = off.",
              )}
            </span>
            <span class="ms-config-row-control">
              <input type="number" id="ms-max-owned-days" min="0" max="3650" step="1" value="${cfg.max_owned_days}" />
              <span class="ms-config-suffix">days</span>
            </span>
          </label>
          <div class="ms-blocklist${cfg.blocklist_open ? " is-open" : ""}">
            <button type="button" class="ms-blocklist-toggle" id="ms-blocklist-toggle" aria-expanded="${cfg.blocklist_open ? "true" : "false"}" aria-controls="ms-blocklist-body">
              <span class="ms-blocklist-toggle-copy">
                <span class="ms-blocklist-title">Never send to</span>
                <span class="ms-blocklist-sub">${
                  cfg.blocked_users.length
                    ? `${cfg.blocked_users.length} blocked`
                    : "None blocked"
                }</span>
              </span>
              <svg class="ms-blocklist-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div class="ms-blocklist-body" id="ms-blocklist-body"${cfg.blocklist_open ? "" : " hidden"}>
              <div class="ms-blocklist-add">
                <input type="text" id="ms-block-input" placeholder="Username or user ID" autocomplete="off" spellcheck="false" />
                <button type="button" class="ms-blocklist-add-btn" id="ms-block-add">Add</button>
              </div>
              <div class="ms-blocklist-io">
                <button type="button" class="ms-blocklist-io-btn" id="ms-block-import" title="Import blocked users from a JSON file">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span>Import</span>
                </button>
                <button type="button" class="ms-blocklist-io-btn" id="ms-block-export" title="Export blocked users as a JSON file">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span>Export</span>
                </button>
                <input type="file" id="ms-block-import-file" class="ms-blocklist-file" accept="application/json,.json" />
              </div>
              <div class="ms-blocklist-io-status" id="ms-block-io-status" hidden></div>
              <div class="ms-blocklist-list" id="ms-block-list">${
              cfg.blocked_users.length
                ? cfg.blocked_users
                    .map((user) => {
                      let uid = Number(user.user_id) || 0;
                      let name = escape_html(user.name || `User ${uid}`);
                      return `<div class="ms-block-row" data-ms-block-id="${uid}">
                        <img class="ms-block-avatar" src="${escape_html(trade_ads_thumb_placeholder_src)}" alt="" data-ms-avatar="${uid}" width="28" height="28" decoding="async" />
                        <div class="ms-block-copy">
                          <div class="ms-block-name">${name}</div>
                          <div class="ms-block-id">${uid}</div>
                        </div>
                        <button type="button" class="ms-block-remove" data-ms-block-id="${uid}" aria-label="Remove ${name}">×</button>
                      </div>`;
                    })
                    .join("")
                : `<div class="ms-blocklist-empty">No blocked users</div>`
            }</div>
            </div>
          </div>
        </div>
      </div>
      <div class="ms-2fa-box" id="ms-2fa-box" hidden>
        <div class="ms-2fa-title" id="ms-2fa-title">Enter 2FA code</div>
        <p class="ms-2fa-copy" id="ms-2fa-copy">Mass Sending needs your Roblox authenticator code to keep sending.</p>
        <div class="ms-2fa-error" id="ms-2fa-error" hidden></div>
        <input id="ms-2fa-input" class="ms-2fa-input" type="text" inputmode="numeric" maxlength="8" autocomplete="one-time-code" spellcheck="false" placeholder="6-digit code" />
        <button type="button" class="ms-2fa-submit" id="ms-2fa-submit">Continue</button>
        <p class="ms-2fa-hint" id="ms-2fa-hint">Want this done automatically next time? Set it up in <button type="button" class="ms-2fa-autofill-link" id="ms-2fa-open-autofill">Roblox 2FA Autofill</button>.</p>
      </div>
      <div class="ms-actions">
        <button type="button" class="ms-action-run" id="ms-run">
          <span class="ms-action-label">Start</span>
        </button>
      </div>
      <div class="ta-status-line" id="ms-progress-line">${escape_html(ms_progress_text(progress))}</div>
    </div>
    <div class="ta-recent-posts ms-recent-posts">
      <button type="button" class="ta-recent-toggle" id="ms-recent-toggle">
        <span>Recent sends</span>
        <svg class="ta-recent-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      <div class="ta-recent-list" id="ms-recent-list">${recent_items}</div>
    </div>
  `;

  ms_update_progress_ui(root, progress);
  if (progress?.running) ms_start_polling(root);
  void trade_ads_fill_thumbnails(root);
  void ms_fill_user_avatars(root);
  if (typeof init_tap_tooltips === "function") init_tap_tooltips(root);
  bind_popup_external_links();

  async function ms_submit_2fa() {
    let box = root.querySelector("#ms-2fa-box");
    let input = root.querySelector("#ms-2fa-input");
    let err = root.querySelector("#ms-2fa-error");
    let submit = root.querySelector("#ms-2fa-submit");
    if (!input || box?.hidden) return;
    let kind = box.dataset.ms2faKind === "unlock" ? "unlock" : "code";
    let value = String(input.value || "");
    if (submit) submit.disabled = true;
    let res = await ms_send("ms_2fa_submit", { kind, value });
    if (!res?.ok) {
      if (submit) submit.disabled = false;
      if (err) {
        err.hidden = false;
        err.textContent = res?.error || "Could not submit 2FA.";
      }
      return;
    }
    input.value = "";
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }
    let next = await ms_send("ms_progress");
    ms_update_progress_ui(root, next);
  }

  root.querySelector("#ms-2fa-submit")?.addEventListener("click", () => {
    void ms_submit_2fa();
  });
  root.querySelector("#ms-2fa-input")?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      void ms_submit_2fa();
    }
  });
  root.querySelector("#ms-2fa-open-autofill")?.addEventListener("click", () => {
    open_totp_autofill_from_mass_send();
  });

  root.querySelector("#ms-recent-toggle")?.addEventListener("click", () => {
    let list = root.querySelector("#ms-recent-list");
    let chevron = root.querySelector("#ms-recent-toggle .ta-recent-chevron");
    if (!list) return;
    let open = list.classList.toggle("is-open");
    if (chevron) chevron.style.transform = open ? "rotate(180deg)" : "";
  });

  root.querySelectorAll(".ms-recent-expand").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      let item = btn.closest(".ms-recent-item");
      if (!item) return;
      let detail = item.querySelector(".ms-recent-detail");
      if (!detail) return;
      let open = detail.hasAttribute("hidden");
      if (open) detail.removeAttribute("hidden");
      else detail.setAttribute("hidden", "");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      item.classList.toggle("is-open", open);
      if (open) {
        void trade_ads_fill_thumbnails(detail);
        bind_popup_external_links();
      }
    });
  });

  async function refresh(next_cfg) {
    cfg = await ms_save_config(next_cfg || cfg);
    await render_mass_send_panel(root);
  }

  function sync_preset_editor_ui(editor_index) {
    cfg.preset_editor_index = editor_index;
    root.querySelectorAll(".ta-preset-chip").forEach((chip) => {
      let i = Number(chip.dataset.msPresetIndex) || 0;
      chip.classList.toggle("is-active", i === editor_index);
    });
    let save_btn = root.querySelector("#ms-preset-save");
    if (save_btn) save_btn.textContent = `Save to slot ${editor_index + 1}`;
    let has_preset = !!cfg.presets[editor_index];
    let load_btn = root.querySelector("#ms-preset-load");
    let clear_btn = root.querySelector("#ms-preset-clear");
    if (load_btn) load_btn.disabled = !has_preset;
    if (clear_btn) clear_btn.disabled = !has_preset;
  }

  root.querySelectorAll(".ta-preset-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      let index = Math.max(0, Math.min(3, Number(btn.dataset.msPresetIndex) || 0));
      if (index === cfg.preset_editor_index) return;
      sync_preset_editor_ui(index);
      void ms_save_config({ ...cfg, preset_editor_index: index });
    });
  });

  root.querySelector("#ms-preset-save")?.addEventListener("click", async () => {
    let presets = ms_normalize_presets(cfg.presets);
    presets[cfg.preset_editor_index] = ms_normalize_preset(
      {
        name: `Preset ${cfg.preset_editor_index + 1}`,
        offer_slots: cfg.offer_slots,
        request_slots: cfg.request_slots,
        offer_robux: cfg.offer_robux,
        request_robux: cfg.request_robux,
      },
      cfg.preset_editor_index,
    );
    await refresh({ ...cfg, presets });
  });

  root.querySelector("#ms-preset-load")?.addEventListener("click", async () => {
    let preset = cfg.presets[cfg.preset_editor_index];
    if (!preset) return;
    await refresh({
      ...cfg,
      offer_slots: preset.offer_slots,
      request_slots: preset.request_slots,
      offer_robux: preset.offer_robux,
      request_robux: preset.request_robux,
    });
  });

  root.querySelector("#ms-preset-clear")?.addEventListener("click", async () => {
    let presets = ms_normalize_presets(cfg.presets);
    presets[cfg.preset_editor_index] = null;
    await refresh({ ...cfg, presets });
  });

  root.querySelector("#ms-config-toggle")?.addEventListener("click", async () => {
    let next_open = !cfg.config_open;
    cfg = await ms_save_config({ ...cfg, config_open: next_open });
    let wrap = root.querySelector(".ms-config");
    let body = root.querySelector("#ms-config-body");
    let toggle = root.querySelector("#ms-config-toggle");
    if (wrap) wrap.classList.toggle("is-open", next_open);
    if (body) {
      if (next_open) body.removeAttribute("hidden");
      else body.setAttribute("hidden", "");
    }
    if (toggle) toggle.setAttribute("aria-expanded", next_open ? "true" : "false");
    if (next_open && typeof init_tap_tooltips === "function") {
      init_tap_tooltips(root);
    }
  });

  function ms_sync_trade_limit_ui(limit, opts = {}) {
    let has_left = Number.isFinite(Number(limit?.remaining));
    let left = has_left ? Math.max(0, Number(limit.remaining)) : null;
    root._ms_trade_limit = limit || root._ms_trade_limit;
    let max_el = root.querySelector("#ms-max-trades");
    let hint = root.querySelector("#ms-trade-limit-hint");
    if (max_el) {
      max_el.max = String(left != null && left > 0 ? left : 100);
      max_el.disabled = left === 0;
      if (left != null && left > 0) {
        let next = ms_clamp_max_trades(max_el.value, left);
        if (String(next) !== String(max_el.value)) max_el.value = String(next);
      }
    }
    if (hint) {
      hint.textContent = ms_trade_limit_hint_text(limit);
      hint.classList.toggle("is-empty", left === 0);
      hint.classList.toggle("is-low", left != null && left > 0 && left <= 10);
      hint.classList.toggle("is-clamped", !!opts.clamped);
    }
  }

  async function persist_filters() {
    let limit = root._ms_trade_limit;
    let left = Number.isFinite(Number(limit?.remaining))
      ? Math.max(0, Number(limit.remaining))
      : null;
    let hours = ms_clamp_hours(root.querySelector("#ms-online-hours")?.value);
    let raw_max = root.querySelector("#ms-max-trades")?.value;
    let max_trades =
      left != null && left > 0
        ? ms_clamp_max_trades(raw_max, left)
        : ms_clamp_max_trades(raw_max);
    let clamped =
      left != null && left > 0 && Math.floor(Number(raw_max)) > left;
    let avoid_recent_days = ms_clamp_avoid_days(
      root.querySelector("#ms-avoid-days")?.value,
    );
    let max_owned_days = ms_clamp_max_owned_days(
      root.querySelector("#ms-max-owned-days")?.value,
    );
    let offer_robux = ms_clamp_robux(
      root.querySelector("#ms-offer-robux")?.value,
    );
    let request_robux = ms_clamp_robux(
      root.querySelector("#ms-request-robux")?.value,
    );
    cfg = await ms_save_config({
      ...cfg,
      online_hours: hours,
      max_trades: max_trades > 0 ? max_trades : cfg.max_trades,
      avoid_recent_days,
      max_owned_days,
      offer_robux,
      request_robux,
    });
    let hours_el = root.querySelector("#ms-online-hours");
    let max_el = root.querySelector("#ms-max-trades");
    let days_el = root.querySelector("#ms-avoid-days");
    let owned_el = root.querySelector("#ms-max-owned-days");
    let offer_rbx_el = root.querySelector("#ms-offer-robux");
    let request_rbx_el = root.querySelector("#ms-request-robux");
    let summary_el = root.querySelector("#ms-config-summary");
    if (hours_el) hours_el.value = String(cfg.online_hours);
    if (max_el && cfg.max_trades > 0) max_el.value = String(cfg.max_trades);
    if (days_el) days_el.value = String(cfg.avoid_recent_days);
    if (owned_el) owned_el.value = String(cfg.max_owned_days);
    if (offer_rbx_el) offer_rbx_el.value = String(cfg.offer_robux);
    if (request_rbx_el) request_rbx_el.value = String(cfg.request_robux);
    if (summary_el) summary_el.textContent = ms_config_summary(cfg);
    ms_sync_trade_limit_ui(limit, { clamped });
    if (clamped) {
      let hint = root.querySelector("#ms-trade-limit-hint");
      if (hint) {
        hint.textContent = `Capped to ${left} left today`;
        setTimeout(() => {
          if (root.querySelector("#ms-trade-limit-hint") === hint) {
            ms_sync_trade_limit_ui(root._ms_trade_limit);
          }
        }, 1600);
      }
    }
  }

  async function persist_robux() {
    let offer_robux = ms_clamp_robux(
      root.querySelector("#ms-offer-robux")?.value,
    );
    let request_robux = ms_clamp_robux(
      root.querySelector("#ms-request-robux")?.value,
    );
    await refresh({ ...cfg, offer_robux, request_robux });
  }

  async function ms_resolve_block_query(raw) {
    let query = String(raw || "").trim();
    if (!query) throw new Error("Enter a username or user ID.");
    if (/^\d+$/.test(query)) {
      let id = Number(query);
      let res = await fetch(`https://users.roblox.com/v1/users/${id}`, {
        credentials: "omit",
      });
      if (!res.ok) throw new Error("Could not find that user ID.");
      let data = await res.json().catch(() => null);
      let user_id = Number(data?.id) || id;
      let name = String(data?.name || data?.displayName || `User ${user_id}`).trim();
      return { user_id, name };
    }
    let res = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        usernames: [query],
        excludeBannedUsers: false,
      }),
    });
    if (!res.ok) throw new Error("Could not look up that username.");
    let data = await res.json().catch(() => null);
    let row = Array.isArray(data?.data) ? data.data[0] : null;
    let user_id = Number(row?.id) || 0;
    if (!(user_id > 0)) throw new Error("Could not find that username.");
    return {
      user_id,
      name: String(row?.name || query).trim(),
    };
  }

  root.querySelector("#ms-online-hours")?.addEventListener("change", () => {
    void persist_filters();
  });
  root.querySelector("#ms-max-trades")?.addEventListener("change", () => {
    void persist_filters();
  });
  root.querySelector("#ms-avoid-days")?.addEventListener("change", () => {
    void persist_filters();
  });
  root.querySelector("#ms-max-owned-days")?.addEventListener("change", () => {
    void persist_filters();
  });
  root.querySelector("#ms-offer-robux")?.addEventListener("change", () => {
    void persist_robux();
  });
  root.querySelector("#ms-request-robux")?.addEventListener("change", () => {
    void persist_robux();
  });

  root.querySelector("#ms-blocklist-toggle")?.addEventListener("click", async () => {
    let next_open = !cfg.blocklist_open;
    cfg = await ms_save_config({ ...cfg, blocklist_open: next_open });
    let wrap = root.querySelector(".ms-blocklist");
    let body = root.querySelector("#ms-blocklist-body");
    let toggle = root.querySelector("#ms-blocklist-toggle");
    if (wrap) wrap.classList.toggle("is-open", next_open);
    if (body) {
      if (next_open) body.removeAttribute("hidden");
      else body.setAttribute("hidden", "");
    }
    if (toggle) toggle.setAttribute("aria-expanded", next_open ? "true" : "false");
    if (next_open) void ms_fill_user_avatars(root);
  });

  function set_blocklist_io_status(message, kind = "") {
    let status = root.querySelector("#ms-block-io-status");
    if (!status) return;
    if (!message) {
      status.textContent = "";
      status.hidden = true;
      status.classList.remove("is-ok", "is-error");
      return;
    }
    status.hidden = false;
    status.textContent = message;
    status.classList.toggle("is-ok", kind === "ok");
    status.classList.toggle("is-error", kind === "error");
  }

  if (ms_blocklist_io_flash) {
    let flash = ms_blocklist_io_flash;
    ms_blocklist_io_flash = null;
    set_blocklist_io_status(flash.message, flash.kind);
  }

  root.querySelector("#ms-block-export")?.addEventListener("click", () => {
    let users = ms_normalize_blocked_users(cfg.blocked_users);
    ms_export_blocklist_file(users);
    set_blocklist_io_status(
      users.length
        ? `Exported ${users.length} blocked user${users.length === 1 ? "" : "s"}.`
        : "Exported empty blocklist.",
      "ok",
    );
  });

  root.querySelector("#ms-block-import")?.addEventListener("click", () => {
    root.querySelector("#ms-block-import-file")?.click();
  });

  root.querySelector("#ms-block-import-file")?.addEventListener("change", async (ev) => {
    let file_input = ev.target;
    let file = file_input?.files?.[0];
    if (file_input) file_input.value = "";
    if (!file) return;
    set_blocklist_io_status("Importing…");
    try {
      let parsed = JSON.parse(await file.text());
      let imported = await ms_parse_blocklist_import(parsed);
      if (!imported.users.length) {
        throw new Error(
          imported.unresolved
            ? "Could not resolve any usernames in that file."
            : "No blocked users found in that file.",
        );
      }
      let merged = ms_merge_blocked_users(cfg.blocked_users, imported.users);
      if (!merged.added && merged.skipped_dupes === 0) {
        throw new Error("No blocked users found in that file.");
      }
      let parts = [];
      if (merged.added) parts.push(`Added ${merged.added}`);
      else if (merged.skipped_dupes) parts.push("No new users");
      if (merged.skipped_dupes) {
        parts.push(
          `skipped ${merged.skipped_dupes} duplicate${merged.skipped_dupes === 1 ? "" : "s"}`,
        );
      }
      if (imported.unresolved) {
        parts.push(
          `could not resolve ${imported.unresolved} name${imported.unresolved === 1 ? "" : "s"}`,
        );
      }
      ms_blocklist_io_flash = {
        message: parts.join(" · ") + ".",
        kind: "ok",
      };
      await refresh({
        ...cfg,
        blocked_users: merged.users,
        config_open: true,
        blocklist_open: true,
      });
    } catch (err) {
      let msg = err?.message || "Could not import that file.";
      if (err instanceof SyntaxError) msg = "That file is not valid JSON.";
      set_blocklist_io_status(msg, "error");
    }
  });

  async function add_blocked_user() {
    let input = root.querySelector("#ms-block-input");
    let line = root.querySelector("#ms-progress-line");
    let query = input?.value || "";
    try {
      let user = await ms_resolve_block_query(query);
      let blocked = ms_normalize_blocked_users(cfg.blocked_users);
      if (blocked.some((row) => row.user_id === user.user_id)) {
        if (line) {
          line.textContent = `${user.name} is already blocked.`;
          line.classList.add("ta-err");
        }
        return;
      }
      blocked.push(user);
      if (input) input.value = "";
      await refresh({
        ...cfg,
        blocked_users: blocked,
        config_open: true,
        blocklist_open: true,
      });
    } catch (err) {
      if (line) {
        line.textContent = err?.message || "Could not add that user.";
        line.classList.add("ta-err");
      }
    }
  }

  root.querySelector("#ms-block-add")?.addEventListener("click", () => {
    void add_blocked_user();
  });
  root.querySelector("#ms-block-input")?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      void add_blocked_user();
    }
  });
  root.querySelectorAll(".ms-block-remove").forEach((btn) => {
    btn.addEventListener("click", async () => {
      let id = Number(btn.dataset.msBlockId) || 0;
      let blocked = ms_normalize_blocked_users(cfg.blocked_users).filter(
        (row) => row.user_id !== id,
      );
      await refresh({
        ...cfg,
        blocked_users: blocked,
        config_open: true,
        blocklist_open: true,
      });
    });
  });

  root.querySelectorAll('.ta-slot[data-ms-side="offer"]').forEach((el) => {
    el.addEventListener("click", async () => {
      let idx = Number(el.dataset.index);
      let pick_opts = {
        side: "offer",
        allowTags: false,
        onInventoryError: (msg) => {
          let line = root.querySelector("#ms-progress-line");
          if (line) {
            line.textContent = msg;
            line.classList.add("ta-err");
          }
        },
        onPick: async (id) => {
          let slots = cfg.offer_slots.slice();
          slots[idx] = Number(id) || null;
          await refresh({ ...cfg, offer_slots: slots });
        },
      };
      if (ms_inventory_session_items != null) {
        pick_opts.inventory = ms_inventory_session_items;
      } else {
        pick_opts.inventoryPromise = ms_load_inventory_session();
      }
      trade_ads_attach_picker(root, pick_opts);
    });
  });

  root.querySelectorAll('.ta-slot[data-ms-side="request"]').forEach((el) => {
    el.addEventListener("click", () => {
      let idx = Number(el.dataset.index);
      trade_ads_attach_picker(root, {
        side: "request",
        allowTags: false,
        inventory: [],
        onPick: async (id) => {
          let slots = cfg.request_slots.slice();
          slots[idx] = Number(id) || null;
          await refresh({ ...cfg, request_slots: slots });
        },
      });
    });
  });

  root.querySelectorAll(".ta-slot-clear").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      let side = btn.dataset.msSide;
      let idx = Number(btn.dataset.index);
      if (side === "offer") {
        let slots = cfg.offer_slots.slice();
        slots[idx] = null;
        void refresh({ ...cfg, offer_slots: slots });
      } else {
        let slots = cfg.request_slots.slice();
        slots[idx] = null;
        void refresh({ ...cfg, request_slots: slots });
      }
    });
  });

  root.querySelector("#ms-run")?.addEventListener("click", async () => {
    let progress_now = await ms_send("ms_progress");
    if (progress_now?.running) {
      await ms_send("ms_stop");
      let next = await ms_send("ms_progress");
      ms_update_progress_ui(root, next);
      return;
    }

    await persist_filters();
    let offer_count = cfg.offer_slots.filter((x) => x != null).length;
    let request_count = cfg.request_slots.filter((x) => x != null).length;
    if (!offer_count || !request_count) {
      let line = root.querySelector("#ms-progress-line");
      if (line) {
        line.textContent = "Add at least one offer and one request item.";
        line.classList.add("ta-err");
      }
      return;
    }
    let fresh_limit = await ms_send("ms_trade_limit");
    if (fresh_limit && Number.isFinite(Number(fresh_limit.remaining))) {
      ms_sync_trade_limit_ui(fresh_limit);
      let left = Math.max(0, Number(fresh_limit.remaining));
      if (left <= 0) {
        let line = root.querySelector("#ms-progress-line");
        if (line) {
          line.textContent = `Roblox 24h trade limit reached (0/${Number(fresh_limit.max) || 100} left).`;
          line.classList.add("ta-err");
        }
        return;
      }
      if (cfg.max_trades > left) {
        cfg = await ms_save_config({
          ...cfg,
          max_trades: ms_clamp_max_trades(cfg.max_trades, left),
        });
        let max_el = root.querySelector("#ms-max-trades");
        if (max_el) max_el.value = String(cfg.max_trades);
        let hint = root.querySelector("#ms-trade-limit-hint");
        if (hint) {
          hint.textContent = `Capped to ${left} left today`;
          hint.classList.add("is-clamped");
        }
      }
    }
    let start_res = await ms_send("ms_start", {
      config: {
        offer_slots: cfg.offer_slots,
        request_slots: cfg.request_slots,
        offer_robux: cfg.offer_robux,
        request_robux: cfg.request_robux,
        online_hours: cfg.online_hours,
        max_trades: cfg.max_trades,
        avoid_recent_days: cfg.avoid_recent_days,
        max_owned_days: cfg.max_owned_days,
        blocked_users: cfg.blocked_users,
      },
    });
    if (start_res && start_res.ok === false) {
      let line = root.querySelector("#ms-progress-line");
      if (line) {
        line.textContent =
          start_res.error ||
          "Rate the extension 5 stars to unlock Mass Sending.";
        line.classList.add("ta-err");
      }
      return;
    }
    let next = await ms_send("ms_progress");
    ms_update_progress_ui(root, next);
    ms_start_polling(root);
  });
}


sync_mobile_popup_class();
init_popup_theme_switcher();
init_settings_import_export();
ensure_options_search_bar();
refresh_all_panels().then(() => maybe_focus_mass_send_2fa());
try {
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "ms_2fa_needed") void maybe_focus_mass_send_2fa();
  });
} catch {}
render_permissions_banner();
document.getElementById("brandImage").src = get_asset_url(
  "assets/icons/logo128.png",
);
let about_logo_el = document.getElementById("aboutLogo");
if (about_logo_el) {
  about_logo_el.src = get_asset_url("assets/icons/logo64.png");
}

const manifest = chrome.runtime.getManifest();
const version_el = document.getElementById("extensionVersion");
if (version_el && manifest.version) {
  let lite_tag =
    typeof nte_is_lite === "function" && nte_is_lite() ? " LITE" : "";
  version_el.textContent = `v${manifest.version}${lite_tag}`;
}

if (typeof nte_is_lite === "function" && nte_is_lite()) {
  document.body.classList.add("nte-lite");
  // Hide Full-only contributor credits (proofs / analyzer / history backends).
  document.querySelectorAll(".about-thanks-card").forEach((card) => {
    let role = (card.querySelector(".about-thanks-role")?.textContent || "")
      .toLowerCase();
    if (
      role.includes("proof") ||
      role.includes("analyzer") ||
      role.includes("trade history")
    ) {
      card.hidden = true;
    }
  });
}

render_about_review_cta();
bind_popup_external_links();
paint_about_update_status(null);
render_update_banner();

if (typeof init_tap_tooltips === "function") {
  init_tap_tooltips(document);
}
