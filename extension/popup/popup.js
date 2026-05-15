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

const option_groups = JSON.parse(
  '["Values",{"name":"Values on Trading Window","enabledByDefault":true,"path":"values-on-trading-window"},{"name":"Values on Trade Lists","enabledByDefault":true,"path":"values-on-trade-lists"},{"name":"Values on Catalog Pages","enabledByDefault":true,"path":"values-on-catalog-pages"},{"name":"Values on User Pages","enabledByDefault":true,"path":"values-on-user-pages"},{"name":"Show Routility USD Values","enabledByDefault":false,"path":"show-usd-values"},"Trading",{"name":"Trade Win/Loss Stats","enabledByDefault":true,"path":"trade-win-loss-stats"},{"name":"Colorblind Mode","enabledByDefault":false,"path":"colorblind-profit-mode"},{"name":"Trade Window Search","enabledByDefault":true,"path":"trade-window-search"},{"name":"Duplicate Trade Warning","enabledByDefault":true,"path":"duplicate-trade-warning"},{"name":"Show Quick Decline Button","enabledByDefault":true,"path":"show-quick-decline-button"},{"name":"Analyze Trade","enabledByDefault":true,"path":"analyze-trade"},{"name":"Counter Trade Prompt","enabledByDefault":true,"path":"counter-trade-prompt"},{"name":"Quick Proof","enabledByDefault":true,"path":"quick-proof"},"Trade Notifications",{"name":"Inbound Trade Notifications","enabledByDefault":false,"path":"inbound-trade-notifications"},{"name":"Declined Trade Notifications","enabledByDefault":false,"path":"declined-trade-notifications"},{"name":"Completed Trade Notifications","enabledByDefault":false,"path":"completed-trade-notifications"},"Item Flags",{"name":"Flag Rare Items","enabledByDefault":true,"path":"flag-rare-items"},{"name":"Flag Projected Items","enabledByDefault":true,"path":"flag-projected-items"},"Links",{"name":"Add Item Profile Links","enabledByDefault":true,"path":"add-item-profile-links"},{"name":"Add Item Ownership History (UAID) Links","enabledByDefault":true,"path":"add-uaid-links"},{"name":"Add User Profile Links","enabledByDefault":true,"path":"add-user-profile-links"},"Other",{"name":"Post-Tax Trade Values","enabledByDefault":true,"path":"post-tax-trade-values"},{"name":"Mobile Trade Items Button","enabledByDefault":true,"path":"mobile-trade-items-button"},{"name":"Disable Win/Loss Stats RAP","enabledByDefault":false,"path":"disable-win-loss-stats-rap"},{"name":"Quick Item Search","enabledByDefault":true,"path":"quick-item-search"}]',
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

const nte_roblox_tab_url_query_patterns = [
  "https://*.roblox.com/*",
  "https://roblox.com/*",
];
const extension_update_state_key = "nte_extension_update_state";
const extension_update_last_check_key = "nte_extension_update_last_check";
const extension_update_check_cooldown_ms = 4 * 60 * 60 * 1000;
const chrome_web_store_item_url =
  "https://chromewebstore.google.com/detail/dmgmmbmbfdgkdeacblplamhipbgjfidl";
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
const duplicate_trade_warning_hours_key = "duplicate_trade_warning_hours";
const duplicate_trade_warning_hours_default = 24;
const profile_value_display_mode_key = "profile_value_display_mode";
const profile_value_display_mode_default = "rap";
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
  let normalized = normalize_inbound_trade_notification_min_gain(value);
  if (normalized > 0)
    return `Min alert gain: +${format_inbound_trade_notification_min_gain(normalized)}%. Click to edit.`;
  return "Min alert gain: any inbound trade. Click to edit.";
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
  let saved = await get_storage([inbound_trade_notification_min_gain_key]);
  let current = normalize_inbound_trade_notification_min_gain(
    saved[inbound_trade_notification_min_gain_key],
  );

  while (true) {
    let response = window.prompt(
      "Minimum % gain for inbound trade alerts?\n0 = notify every inbound.\nExample: 5 means +5% or better only.",
      format_inbound_trade_notification_min_gain(current),
    );

    if (response === null) return current;

    let trimmed = String(response || "").trim();
    if (!trimmed) {
      current = inbound_trade_notification_min_gain_default;
      break;
    }

    let parsed = Number(trimmed.replace(/%/g, ""));
    if (!Number.isFinite(parsed) || parsed < 0) {
      window.alert("Enter a number like 0, 5, or 12.5.");
      continue;
    }

    current = normalize_inbound_trade_notification_min_gain(parsed);
    break;
  }

  await set_storage({ [inbound_trade_notification_min_gain_key]: current });
  return current;
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

function get_update_notice_copy(next_version = "") {
  let next = String(next_version || "").trim();
  if (is_firefox_extension_runtime()) {
    return {
      kicker: "Add-on update spotted",
      title: "Firefox handles the install",
      copy: next
        ? `Firefox noticed v${next}. Store installs update automatically, so the extension can only surface the notice here.`
        : "Firefox store installs update automatically.",
      status: "Notice only.",
    };
  }

  return {
    kicker: "Store update spotted",
    title: "Chrome Web Store handles the install",
    copy: next
      ? `Chrome noticed v${next}. Store installs update automatically, so the extension can only surface the notice here.`
      : "Chrome Web Store installs update automatically.",
    status: "Notice only.",
  };
}

function paint_about_update_status(state) {
  let status_el = document.getElementById("aboutUpdateStatus");
  if (!status_el) return;
  let current_version = String(
    chrome.runtime.getManifest()?.version || "",
  ).trim();
  let current_label = current_version
    ? `v${escape_html(current_version)}`
    : "this build";
  if (
    state?.version &&
    (!current_version ||
      compare_extension_versions(state.version, current_version) > 0)
  ) {
    let next_label = `v${escape_html(state.version)}`;
    status_el.innerHTML = is_firefox_extension_runtime()
      ? `Current version ${current_label}.<br>Firefox has a newer store build queued: ${next_label}.`
      : `Current version ${current_label}.<br>Chrome has a newer store build queued: ${next_label}.`;
    return;
  }
  status_el.innerHTML = is_firefox_extension_runtime()
    ? `Current version ${current_label}.<br>Firefox store installs update automatically.`
    : `Current version ${current_label}.<br>Chrome Web Store installs update automatically.`;
}

function render_about_review_cta() {
  let root = document.getElementById("aboutReviewRoot");
  if (!root) return;
  let store_label = "";
  let store_url = "";
  if (is_firefox_extension_runtime()) {
    store_label = "Firefox Add-ons";
    store_url = firefox_addons_item_url;
  } else if (is_chromium_extension_runtime()) {
    store_label = "Chrome Web Store";
    store_url = chrome_web_store_item_url;
  } else {
    root.innerHTML = "";
    root.classList.add("hidden");
    return;
  }
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
    '[data-open-new-tab="true"], .discord-btn',
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
            <button type="button" class="update-banner-btn update-banner-btn-secondary" data-update-action="dismiss">Dismiss</button>
          </div>
          <div class="update-banner-status">${copy.status}</div>
        </div>
      </div>
    </div>
  `;

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

  row.append(label_el, create_toggle(option, checked));
  return row;
}

function create_profile_value_display_toggle(mode) {
  let active_mode = normalize_profile_value_display_mode(mode);
  const toggle = document.createElement("div");
  toggle.className = "profile-value-mode-toggle";
  toggle.setAttribute("role", "group");
  toggle.setAttribute("aria-label", "Profile stat display");

  function sync() {
    toggle.querySelectorAll("button").forEach((button) => {
      let active = button.dataset.mode === active_mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  [
    { value: "rap", label: "RAP" },
    { value: "value", label: "Value" },
  ].forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.mode = option.value;
    button.textContent = option.label;
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (active_mode === option.value) return;
      active_mode = option.value;
      sync();
      await set_option_value(profile_value_display_mode_key, active_mode);
      send_option_update("Values");
    });
    toggle.append(button);
  });

  sync();
  return toggle;
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
      { type: "trade_ads_refetch_thumb", assetId: aid },
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
  let ids = [
    ...new Set(
      [...imgs]
        .map((i) => Number(i.dataset.thumbAid))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
  if (!ids.length) return;
  let res = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "trade_ads_resolve_thumbs", assetIds: ids },
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
  };
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

function trade_ads_attach_picker(root, opts) {
  let { side, inventory, inventoryPromise, onPick, onInventoryError } = opts;
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

  function close() {
    overlay.remove();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector(".ta-sheet-close").addEventListener("click", close);

  function set_footer(html) {
    footer.innerHTML = html;
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
    let img = document.createElement("img");
    img.alt = nm;
    img.src = trade_ads_thumb_placeholder_src;
    img.decoding = "async";
    img.dataset.thumbAid = String(id);
    img.dataset.thumbPending = "1";
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
    cell.append(img, meta);
    cell.addEventListener("click", () => {
      onPick(Number(id), nm);
      close();
    });
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

async function render_trade_ads_composer(root, status) {
  clear_trade_ads_countdown_timer();
  let cfg = { ...trade_ads_default_local_config(), ...(status.config || {}) };
  delete cfg.auto_post;
  if (typeof cfg.posting_paused !== "boolean") cfg.posting_paused = true;
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
      return `
        <div class="ta-slot" data-side="${side}" data-index="${i}" data-random="1">
          <span class="ta-slot-random" title="${escape_html(hint)}">🎲</span>
        </div>`;
    }
    if (id) {
      let aid = Number(id);
      return `
        <div class="ta-slot" data-side="${side}" data-index="${i}">
          <div class="ta-slot-thumb-wrap">
            <img src="${escape_html(trade_ads_thumb_placeholder_src)}" alt="" data-thumb-aid="${aid}" data-thumb-pending="1" decoding="async" />
            <button type="button" class="ta-slot-clear" data-side="${side}" data-index="${i}" aria-label="Clear">×</button>
          </div>
          ${slot_metrics_html(aid)}
        </div>`;
    }
    return `
      <div class="ta-slot ta-slot-is-empty" data-side="${side}" data-index="${i}">
        <span class="ta-slot-empty">${side === "offer" ? "Offer" : "Want"}</span>
      </div>`;
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

  root.innerHTML = `
    <div class="ta-card">
      <div class="ta-card-head">
        <div>
          <div class="ta-card-title">Ad preview</div>
          <div class="ta-card-sub">Tap a square to fill slots, or randomize them.</div>
        </div>
      </div>
      ${rows}
      <div class="ta-divider"></div>
      <div class="ta-row">
        <label class="ta-toggle-pill"><input type="checkbox" id="ta-offer-random" ${cfg.offer_random ? "checked" : ""}/> Randomize offers each ad</label>
      </div>
      <div class="ta-row">
        <label class="ta-toggle-pill"><input type="checkbox" id="ta-req-random" ${cfg.request_random ? "checked" : ""}/> Randomize requests each ad</label>
      </div>
      ${
        !cfg.request_random
          ? `<div class="ta-row ta-tags-row" id="ta-tags-row"><span class="ta-tags-label">Tags</span>${[
              ["any", "🏷️", "Any"],
              ["rap", "📊", "RAP"],
              ["value", "💎", "Value"],
              ["overpay", "📈", "Overpay"],
              ["downgrade", "📉", "Downgrade"],
              ["upgrade", "⬆️", "Upgrade"],
              ["rares", "⭐", "Rares"],
            ]
              .map(([tag, emo, label]) => {
                let active = (cfg.request_tags || []).includes(tag);
                return `<button type="button" class="ta-tag-pill${active ? " is-on" : ""}" data-tag="${tag}" id="ta-tag-${tag}">${emo} ${label}</button>`;
              })
              .join("")}</div>`
          : ""
      }
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

  root
    .querySelectorAll('.ta-slot[data-side="offer"]:not([data-random="1"])')
    .forEach((el) => {
      el.addEventListener("click", () => {
        if (cfg.offer_random) return;
        let idx = Number(el.dataset.index);
        let status_line = root.querySelector("#ta-post-status");
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
          onPick: async (id) => {
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

  root.querySelectorAll(".ta-slot-clear").forEach((btn) => {
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

  root.querySelector("#ta-req-random").addEventListener("change", async (e) => {
    await trade_ads_save_merged_config({ request_random: e.target.checked });
    let fresh = await trade_ads_fetch_status_from_bg();
    if (fresh?.verified) await render_trade_ads_composer(root, fresh);
    else await render_trade_ads_tab();
  });

  root.querySelectorAll(".ta-tag-pill").forEach((btn) => {
    btn.addEventListener("click", async () => {
      let tag = btn.dataset.tag;
      if (!tag) return;
      let tags = (cfg.request_tags || []).slice();
      let idx = tags.indexOf(tag);
      if (idx >= 0) tags.splice(idx, 1);
      else tags.push(tag);
      cfg = await trade_ads_save_merged_config({ request_tags: tags });
      btn.classList.toggle("is-on", tags.includes(tag));
    });
  });

  root.querySelector("#ta-demand").addEventListener("change", async (e) => {
    await trade_ads_save_merged_config({
      request_demand_min: Number(e.target.value),
    });
    let fresh = await trade_ads_fetch_status_from_bg();
    if (fresh?.verified) await render_trade_ads_composer(root, fresh);
    else await render_trade_ads_tab();
  });

  root.querySelector("#ta-robux").addEventListener("change", async (e) => {
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
    let card = root.querySelector(".ta-schedule-card");
    if (card) {
      card.classList.toggle("is-paused", paused);
      card.classList.toggle("is-live", !paused);
    }
    let status_lbl = root.querySelector("#ta-schedule-status-text");
    if (status_lbl)
      status_lbl.textContent = paused
        ? "Automatic posting (off)"
        : "Automatic posting (on)";
    let sw = root.querySelector("#ta-schedule-live");
    if (sw) sw.checked = !paused;
    let v = root.querySelector("#ta-interval-val");
    if (v) v.value = String(cfg.auto_interval_minutes);
    let hum = root.querySelector("#ta-interval-human-text");
    if (hum)
      hum.textContent = format_trade_ads_duration(cfg.auto_interval_minutes);
    let minus = root.querySelector("#ta-min-interval");
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

  let interval_input = root.querySelector("#ta-interval-val");
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

  root.querySelector("#ta-post-now").addEventListener("click", async () => {
    let btn = root.querySelector("#ta-post-now");
    let line = root.querySelector("#ta-post-status");
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
        let line2 = root.querySelector("#ta-post-status");
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

  root.querySelector("#ta-disconnect").addEventListener("click", async () => {
    trade_ads_reset_inventory_session();
    await new Promise((resolve) =>
      chrome.runtime.sendMessage({ type: "trade_ads_disconnect" }, resolve),
    );
    await trade_ads_merge_verify_ui({ step: "idle", phrase: "", error: "" });
    render_trade_ads_tab();
  });

  let recent_toggle = root.querySelector("#ta-recent-toggle");
  if (recent_toggle) {
    recent_toggle.addEventListener("click", () => {
      let list = root.querySelector("#ta-recent-list");
      let chevron = recent_toggle.querySelector(".ta-recent-chevron");
      if (!list) return;
      let open = list.classList.toggle("is-open");
      if (chevron) chevron.style.transform = open ? "rotate(180deg)" : "";
    });
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
  let step = vu.step || "idle";

  if (step === "loading") {
    root.innerHTML = `
      <p class="ta-lede">Verifying…</p>
      <div class="ta-shimmer"></div>
    `;
    let r = await new Promise((resolve) =>
      chrome.runtime.sendMessage({ type: "trade_ads_auto_verify" }, resolve),
    );
    if (!r?.ok) {
      await trade_ads_merge_verify_ui({
        step: "idle",
        error: r?.error || "Verification failed",
      });
      vu = (await get_storage([trade_ads_verify_storage_key]))[
        trade_ads_verify_storage_key
      ];
      return render_trade_ads_verify_flow(root, status, vu);
    }
    await trade_ads_merge_verify_ui({ step: "idle", error: "" });
    return render_trade_ads_tab();
  }

  let name = escape_html(status.roblox?.name || "");
  root.innerHTML = `
    <div class="ta-card">
      <div class="ta-card-head" style="align-items:center;margin-bottom:14px;">
        <div class="ta-card-title">Rolimons Trade Ads</div>
        ${name ? `<div class="ta-user-pill">${name}</div>` : ""}
      </div>
      ${vu.error ? `<div class="ta-status-line ta-err" style="margin-bottom:10px">${escape_html(vu.error)}</div>` : ""}
      <button type="button" class="ta-btn ta-btn-primary" id="ta-auto-verify" style="width:100%;">Start Posting</button>
    </div>
  `;
  root.querySelector("#ta-auto-verify").addEventListener("click", async () => {
    await trade_ads_merge_verify_ui({ step: "loading", error: "" });
    render_trade_ads_verify_flow(root, status, { step: "loading" });
  });
}

async function render_trade_ads_tab() {
  const root = document.getElementById("trade-ads-root");
  if (!root) return;

  clear_trade_ads_countdown_timer();
  root.innerHTML = `<p class="ta-lede">Loading…</p>`;
  chrome.runtime.sendMessage("getData", () => {
    chrome.runtime.lastError;
  });

  let status = await new Promise((resolve) =>
    chrome.runtime.sendMessage({ type: "trade_ads_get_status" }, resolve),
  );

  if (!status?.roblox) {
    root.innerHTML = `<p class="ta-lede">Sign in to Roblox in this browser, then reopen this tab.</p>`;
    return;
  }

  if (status.verified) {
    render_trade_ads_composer(root, status);
    return;
  }

  let vu =
    (await get_storage([trade_ads_verify_storage_key]))[
      trade_ads_verify_storage_key
    ] || {};
  await render_trade_ads_verify_flow(root, status, vu);
}

async function refresh_all_panels() {
  await render_options();
  await render_trade_ads_tab();
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

  const option_names = [...get_option_names(), profile_value_display_mode_key];
  let saved = await get_storage([
    ...option_names,
    legacy_colorblind_mode_option_name,
    legacy_post_tax_trade_value_option_name,
    colorblind_mode_profile_key,
    inbound_trade_notification_min_gain_key,
    duplicate_trade_warning_hours_key,
    trade_page_theme_enabled_key,
    trade_page_theme_key,
    trade_page_custom_themes_key,
  ]);
  saved = await ensure_colorblind_mode_settings(saved);
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
    if (value === undefined) value = item.enabledByDefault;

    current_options_el.append(
      create_option_row(item, value, {
        colorblind_mode_profile: saved[colorblind_mode_profile_key],
        inbound_trade_min_gain: saved[inbound_trade_notification_min_gain_key],
        duplicate_trade_warning_hours: saved[duplicate_trade_warning_hours_key],
        profile_value_display_mode: saved[profile_value_display_mode_key],
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
}

function append_roblox_totp_card(container, totp_snapshot = {}) {
  const card = document.createElement("div");
  card.className = "nte-totp-card";

  card.innerHTML = `
    <div class="nte-totp-header">
      <span class="nte-totp-title">Roblox 2-step code</span>
    </div>
    <p class="nte-totp-hint">Paste your Roblox 2FA <strong>secret</strong> to auto-fill 2FA challenges. Treat it like a password - do not share it with anybody.</p>
    <label class="nte-totp-row">
      <input type="checkbox" id="nte-totp-enabled" />
      <span>Enable autofill on roblox.com</span>
    </label>
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
  `;

  container.append(card);

  const enabled_el = card.querySelector("#nte-totp-enabled");
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
    updates[duplicate_trade_warning_hours_key] =
      duplicate_trade_warning_hours_default;
    updates[profile_value_display_mode_key] =
      profile_value_display_mode_default;
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

const required_origins = [
  "https://api.rolimons.com/*",
  "https://www.rolimons.com/*",
  "https://rolimons.com/*",
  "https://routility.io/*",
  "https://roautotrade.com/*",
  "https://nevos-extension.com/*",
  "https://www.nevos-extension.com/*",
  "https://*.roblox.com/*",
  "https://roblox.com/*",
  "https://thumbnails.roblox.com/*",
];

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
];

let ta_poll_timer = null;

function ta_send(type, extra) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...extra }, (r) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(r);
    });
  });
}

function ta_show_confirm(action_label, on_confirm) {
  let existing = document.querySelector(".ta-confirm-overlay");
  if (existing) existing.remove();

  let overlay = document.createElement("div");
  overlay.className = "ta-confirm-overlay";
  overlay.innerHTML = `
    <div class="ta-confirm-box">
      <div class="ta-confirm-title">Are you sure?</div>
      <div class="ta-confirm-msg">${escape_html(action_label)}.<br>You can stop it at any time.</div>
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

function ta_show_overpay_config(action_label, on_confirm) {
  let existing = document.querySelector(".ta-confirm-overlay");
  if (existing) existing.remove();

  let overlay = document.createElement("div");
  overlay.className = "ta-confirm-overlay";
  overlay.innerHTML = `
    <div class="ta-confirm-box">
      <div class="ta-confirm-title">Configure filter</div>
      <div class="ta-confirm-msg">${escape_html(action_label)}.</div>
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

  let progress = await ta_send("ta_progress");
  let already_rendered = root.querySelector(".ta-section");
  if (already_rendered) {
    ta_update_buttons(progress);
    if (progress?.running) ta_start_polling();
    return;
  }

  let cancel_icon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6"/><path d="M15 9l-6 6"/></svg>';
  let inbound_icon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3H10L8 12H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>';
  let outbound_icon =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  root.innerHTML = `
    <p class="ta-lede">Bulk decline trades directly from Roblox. Actions run in the background even if you close this popup.</p>
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
    let btn = root.querySelector(`[data-ta-action="${action.id}"]`);
    btn.addEventListener("click", () => {
      if (btn.disabled || btn.classList.contains("ta-running")) return;
      let is_overpay = action.id.endsWith("_overpaying");
      let show = is_overpay ? ta_show_overpay_config : ta_show_confirm;
      show(action.label, async (min_overpay_pct = 0) => {
        await ta_send("ta_start", { action: action.id, min_overpay_pct });
        ta_start_polling();
        let p = await ta_send("ta_progress");
        ta_update_buttons(p);
      });
    });
  }

  ta_update_buttons(progress);
  if (progress?.running) ta_start_polling();
}

sync_mobile_popup_class();
init_popup_theme_switcher();
refresh_all_panels();
render_permissions_banner();
document.getElementById("brandImage").src = get_asset_url(
  "assets/icons/logo128.png",
);

const manifest = chrome.runtime.getManifest();
const version_el = document.getElementById("extensionVersion");
if (version_el && manifest.version) {
  version_el.textContent = `v${manifest.version}`;
}

render_about_review_cta();
bind_popup_external_links();
paint_about_update_status(null);
render_update_banner();
