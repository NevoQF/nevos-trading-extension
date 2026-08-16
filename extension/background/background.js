if (
  "undefined" === typeof globalThis.chrome &&
  "undefined" !== typeof globalThis.browser
) {
  globalThis.chrome = globalThis.browser;
}

function nte_mark_roblox_request_url(value) {
  try {
    let url = new URL(String(value), "https://www.roblox.com/");
    if (url.hostname === "roblox.com" || url.hostname.endsWith(".roblox.com")) {
      url.searchParams.set("NTERequest", "1");
      return url.toString();
    }
  } catch {}
  return value;
}

function nte_mark_roblox_request_input(input) {
  if ("string" === typeof input || input instanceof URL)
    return nte_mark_roblox_request_url(input);
  if ("undefined" !== typeof Request && input instanceof Request) {
    let url = nte_mark_roblox_request_url(input.url);
    return url === input.url ? input : new Request(url, input);
  }
  return input;
}

if (
  "function" === typeof globalThis.fetch &&
  !globalThis.fetch.__nte_request_marked
) {
  let native_fetch = globalThis.fetch.bind(globalThis);
  let marked_fetch = (input, init) =>
    native_fetch(nte_mark_roblox_request_input(input), init);
  Object.defineProperty(marked_fetch, "__nte_request_marked", { value: true });
  globalThis.fetch = marked_fetch;
}

const nte_api_client_token = "nte-x7Km2Qp9Wv4s";
function nte_api_headers(extra) {
  let headers = {
    Accept: "application/json",
    "X-NTE-Client": nte_api_client_token,
    "From-Extension": "1",
  };
  if (extra && typeof extra === "object") {
    for (let key of Object.keys(extra)) headers[key] = extra[key];
  }
  return headers;
}

if (typeof importScripts === "function") {
  importScripts("../shared/build_variant.js");
  importScripts("../shared/rolimons_item_details.js");
  importScripts("trade_ads.js");
  if (typeof nte_is_lite !== "function" || !nte_is_lite()) {
    importScripts("../shared/trade_ad_notifications_core.js");
    importScripts("trade_ad_notifications.js");
    importScripts("inbound_trade_webhook_preview.js");
    importScripts("mass_send.js");
  }
}

const option_groups = nte_filter_option_groups(
  JSON.parse(
    '["Values",{"name":"Values on Trading Window","enabledByDefault":true,"path":"values-on-trading-window"},{"name":"Values on Trade Lists","enabledByDefault":true,"path":"values-on-trade-lists"},{"name":"Values on Catalog Pages","enabledByDefault":true,"path":"values-on-catalog-pages"},{"name":"Values on User Pages","enabledByDefault":true,"path":"values-on-user-pages"},{"name":"Show Routility USD Values","enabledByDefault":false,"path":"show-usd-values"},"Trading",{"name":"Trade Win/Loss Stats","enabledByDefault":true,"path":"trade-win-loss-stats"},{"name":"Colorblind Mode","enabledByDefault":false,"path":"colorblind-profit-mode"},{"name":"Trade Window Search","enabledByDefault":true,"path":"trade-window-search"},{"name":"Duplicate Trade Warning","enabledByDefault":true,"path":"duplicate-trade-warning"},{"name":"Miss Send Warning","enabledByDefault":true,"path":"miss-send-warning"},{"name":"Show Quick Decline Button","enabledByDefault":true,"path":"show-quick-decline-button"},{"name":"Analyze Trade","enabledByDefault":true,"path":"analyze-trade"},{"name":"Counter Trade Choices","enabledByDefault":true,"path":"counter-trade-choices"},{"name":"Quick Proof","enabledByDefault":true,"path":"quick-proof"},{"name":"Reseller Trade Button","enabledByDefault":true,"path":"reseller-trade-button"},"Trade Notifications",{"name":"Inbound Trade Notifications","enabledByDefault":false,"path":"inbound-trade-notifications"},{"name":"Declined Trade Notifications","enabledByDefault":false,"path":"declined-trade-notifications"},{"name":"Completed Trade Notifications","enabledByDefault":false,"path":"completed-trade-notifications"},"Item Flags",{"name":"Flag Rare Items","enabledByDefault":true,"path":"flag-rare-items"},{"name":"Flag Projected Items","enabledByDefault":true,"path":"flag-projected-items"},"Links",{"name":"Add Item Profile Links","enabledByDefault":true,"path":"add-item-profile-links"},{"name":"Add Item Ownership Buttons","enabledByDefault":true,"path":"add-uaid-links"},{"name":"Add User Profile Links","enabledByDefault":true,"path":"add-user-profile-links"},"Other",{"name":"Post-Tax Trade Values","enabledByDefault":true,"path":"post-tax-trade-values"},{"name":"Mobile Trade Items Button","enabledByDefault":true,"path":"mobile-trade-items-button"},{"name":"Disable Win/Loss Stats RAP","enabledByDefault":false,"path":"disable-win-loss-stats-rap"},{"name":"Quick Item Search","enabledByDefault":true,"path":"quick-item-search"},{"name":"Quick User Search","enabledByDefault":true,"path":"quick-user-search"},{"name":"Fix Rolimons Pages","enabledByDefault":true,"path":"fix-rolimons-pages"}]',
  ),
);
const legacy_show_usd_values_option_name = "Show USD Values";
const show_routility_usd_values_option_name = "Show Routility USD Values";
const colorblind_mode_option_name = "Colorblind Mode";
const legacy_colorblind_mode_option_name = "Colorblind Profit Mode";
const post_tax_trade_values_option_name = "Post-Tax Trade Values";
const legacy_post_tax_trade_value_option_name = "Post-Tax Trade Value";
const add_item_ownership_buttons_option_name = "Add Item Ownership Buttons";
const legacy_add_item_ownership_uaid_links_option_name =
  "Add Item Ownership History (UAID) Links";
const ownership_link_provider_key = "ownership_link_provider";
const ownership_link_provider_default = "rolimons";
const counter_trade_choices_option_name = "Counter Trade Choices";
const legacy_counter_trade_prompt_option_name = "Counter Trade Prompt";
const counter_trade_choice_mode_key = "counter_trade_choice_mode";
const counter_trade_choice_mode_default = "prompt";
const colorblind_mode_profile_key = "colorblind_mode_profile";
const colorblind_mode_profile_default = "deuteranopia";
const colorblind_mode_profiles = [
  "deuteranopia",
  "protanopia",
  "tritanopia",
  "achromatopsia",
];

function normalize_ownership_link_provider(value) {
  return String(value || "").toLowerCase() === "routility"
    ? "routility"
    : "rolimons";
}

function normalize_counter_trade_choice_mode(value) {
  return String(value || "").toLowerCase() === "buttons" ? "buttons" : "prompt";
}

const trade_cache_alarm_name = "cachingSystem";
const trade_notification_prefix = "nru_trade_notification_";
const cached_trades_key = "cachedTrades";
const item_data_key = "data";
const item_data_time_key = "lastRequestForData";
const item_data_url = RolimonsItemDetails.ROLIMONS_ITEM_DETAILS_URL;
const server_item_data_url = "https://nevos-extension.com/api/rolimons/items";
const trade_ad_item_data_max_age_ms = 180000;
const routility_data_key = "routilityData";
const routility_data_time_key = "lastRoutilityRequest";
const routility_data_url = "https://routility.io/api/public/items";
const extension_update_state_key = "nte_extension_update_state";
const nte_roblox_tab_url_query_patterns = [
  "https://www.roblox.com/*",
  "https://roblox.com/*",
];
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
const trade_cache_ttl_ms = 5 * 24 * 60 * 60 * 1000;
const trade_cache_max_entries = 2000;
const trade_notification_sent_key = "nte_trade_notification_sent_ids";
const trade_notification_sent_ttl_ms = 7 * 24 * 60 * 60 * 1000;
const trade_notification_sent_max_entries = 1000;

let notification_click_handler_registered = false;
let trade_notification_sent_memory = null;
let trade_notification_pending_keys = new Set();

function normalize_colorblind_mode_profile(value) {
  let normalized = String(value || "")
    .trim()
    .toLowerCase();
  return colorblind_mode_profiles.includes(normalized)
    ? normalized
    : colorblind_mode_profile_default;
}

function extension_notification_icon_url(icon_url) {
  if (!icon_url) return chrome.runtime.getURL("assets/icons/logo128.png");
  if (/^https?:\/\//i.test(icon_url)) return icon_url;
  return chrome.runtime.getURL(String(icon_url).replace(/^\//, ""));
}

const TRADE_API_RATE_LIMIT_BUFFER = 10;
const TRADE_API_RATE_LIMIT_RESET_PAD_MS = 1000;
const TRADE_API_RATE_LIMIT_DEFAULT_PAUSE_MS = 60000;
const TRADE_API_RATE_LIMIT_RESUME_KEY = "tradeApiRateLimitResumeAt";
let trade_api_rate_limit_resume_at = 0;
let trade_api_rate_limit_queue = Promise.resolve();

function trade_api_delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function get_shared_trade_api_resume_at() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([TRADE_API_RATE_LIMIT_RESUME_KEY], (result) => {
        let value = Number(result?.[TRADE_API_RATE_LIMIT_RESUME_KEY]) || 0;
        resolve(Number.isFinite(value) ? value : 0);
      });
    } catch {
      resolve(0);
    }
  });
}

function set_shared_trade_api_resume_at(value) {
  try {
    chrome.storage.local.set(
      { [TRADE_API_RATE_LIMIT_RESUME_KEY]: value },
      () => {},
    );
  } catch {}
}

const TRADE_API_WINDOW_MS = 60000;
const TRADE_API_WINDOW_LIMIT = 40;
const TRADE_API_TIMES_KEY = "tradeApiRequestTimes";
let trade_api_request_times = [];

function prune_trade_api_times(now) {
  let cutoff = now - TRADE_API_WINDOW_MS;
  while (
    trade_api_request_times.length &&
    trade_api_request_times[0] < cutoff
  ) {
    trade_api_request_times.shift();
  }
}

function get_shared_trade_api_times() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([TRADE_API_TIMES_KEY], (result) => {
        let value = result?.[TRADE_API_TIMES_KEY];
        resolve(Array.isArray(value) ? value.filter(Number.isFinite) : []);
      });
    } catch {
      resolve([]);
    }
  });
}

function set_shared_trade_api_times(times) {
  try {
    chrome.storage.local.set({ [TRADE_API_TIMES_KEY]: times }, () => {});
  } catch {}
}

function parse_trade_api_header_number(response, name) {
  let value = response?.headers?.get?.(name);
  if (value === null || value === undefined || value === "") return null;
  let parsed = Number.parseFloat(String(value).split(",")[0].trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function get_trade_api_reset_delay_ms(response) {
  let reset = parse_trade_api_header_number(response, "x-ratelimit-reset");
  if (reset === null)
    reset = parse_trade_api_header_number(response, "retry-after");
  if (reset === null) return TRADE_API_RATE_LIMIT_DEFAULT_PAUSE_MS;
  if (reset > 1000000000)
    return (
      Math.max(0, reset * 1000 - Date.now()) + TRADE_API_RATE_LIMIT_RESET_PAD_MS
    );
  return Math.max(0, reset * 1000) + TRADE_API_RATE_LIMIT_RESET_PAD_MS;
}

function update_trade_api_rate_limit(response) {
  let pause = response?.status === 429;
  let remaining = parse_trade_api_header_number(
    response,
    "x-ratelimit-remaining",
  );
  if (remaining !== null && remaining <= TRADE_API_RATE_LIMIT_BUFFER)
    pause = true;
  if (!pause) return;

  trade_api_rate_limit_resume_at = Math.max(
    trade_api_rate_limit_resume_at,
    Date.now() + get_trade_api_reset_delay_ms(response),
  );
  set_shared_trade_api_resume_at(trade_api_rate_limit_resume_at);
}

async function fetch_trade_api(url, init) {
  let run = trade_api_rate_limit_queue.then(async () => {
    trade_api_rate_limit_resume_at = Math.max(
      trade_api_rate_limit_resume_at,
      await get_shared_trade_api_resume_at(),
    );
    let wait_ms = trade_api_rate_limit_resume_at - Date.now();
    if (wait_ms > 0) await trade_api_delay(wait_ms);

    let shared = await get_shared_trade_api_times();
    let now = Date.now();
    let merged = trade_api_request_times.concat(shared);
    let seen = new Set();
    trade_api_request_times = merged
      .filter((t) => !seen.has(t) && seen.add(t))
      .sort((a, b) => a - b);
    prune_trade_api_times(now);
    if (trade_api_request_times.length >= TRADE_API_WINDOW_LIMIT) {
      let oldest = trade_api_request_times[0];
      let window_wait =
        oldest + TRADE_API_WINDOW_MS + TRADE_API_RATE_LIMIT_RESET_PAD_MS - now;
      if (window_wait > 0) await trade_api_delay(window_wait);
      prune_trade_api_times(Date.now());
    }

    trade_api_request_times.push(Date.now());
    prune_trade_api_times(Date.now());
    set_shared_trade_api_times(
      trade_api_request_times.slice(-TRADE_API_WINDOW_LIMIT * 2),
    );

    let response = await fetch(url, init);
    update_trade_api_rate_limit(response);
    return response;
  });
  trade_api_rate_limit_queue = run.catch(() => {});
  return run;
}

const NTE_INVENTORY_RATE_LIMIT_FALLBACK_MS = 15000;
const NTE_INVENTORY_RATE_LIMIT_MAX_WAIT_MS = 120000;
const NTE_INVENTORY_RATE_LIMIT_ATTEMPTS = 8;

function nte_inventory_load_status(source, text, extra) {
  try {
    chrome.runtime.sendMessage(
      {
        type: "nte_inventory_load_status",
        source: source || "",
        text: String(text || ""),
        ...(extra && typeof extra === "object" ? extra : {}),
      },
      () => {
        void chrome.runtime.lastError;
      },
    );
  } catch {}
}

function nte_inventory_rate_limit_wait_ms(response) {
  let ms = get_trade_api_reset_delay_ms(response);
  if (!Number.isFinite(ms) || ms <= 0) ms = NTE_INVENTORY_RATE_LIMIT_FALLBACK_MS;
  return Math.min(
    Math.max(ms, 1000),
    NTE_INVENTORY_RATE_LIMIT_MAX_WAIT_MS,
  );
}

async function nte_fetch_inventory_with_retries(url, init, options = {}) {
  let source = String(options.source || "inventory");
  let silent = options.silent === true;
  let max_attempts = Math.max(
    1,
    Number(options.maxAttempts) || NTE_INVENTORY_RATE_LIMIT_ATTEMPTS,
  );
  let res = null;
  for (let attempt = 0; attempt < max_attempts; attempt++) {
    try {
      res = await fetch(url, init);
    } catch {
      res = null;
    }
    if (!res) {
      if (attempt >= max_attempts - 1) return null;
      if (!silent) nte_inventory_load_status(source, "Network error. Retrying…");
      await trade_api_delay(400 * (attempt + 1));
      continue;
    }
    let retryable = res.status === 429 || (res.status >= 500 && res.status < 600);
    if (!retryable) return res;
    if (attempt >= max_attempts - 1) return res;
    let wait_ms =
      res.status === 429
        ? nte_inventory_rate_limit_wait_ms(res)
        : Math.min(1500 * (attempt + 1), 20000);
    let until = Date.now() + wait_ms;
    while (Date.now() < until) {
      if (!silent) {
        let left = Math.max(1, Math.ceil((until - Date.now()) / 1000));
        let text =
          res.status === 429
            ? `Rate limited (429). Retrying in ${left}s…`
            : `Server error (${res.status}). Retrying in ${left}s…`;
        nte_inventory_load_status(source, text, {
          status: res.status,
          retryAfterMs: Math.max(0, until - Date.now()),
        });
      }
      await trade_api_delay(Math.min(1000, Math.max(0, until - Date.now())));
    }
    if (!silent) nte_inventory_load_status(source, "Loading your items…");
  }
  return res;
}

async function fetch_trade_api_priority(url, init) {
  let response = await fetch(url, init);
  update_trade_api_rate_limit(response);
  return response;
}

function get_local_value(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) console.info(chrome.runtime.lastError);
      resolve(result[key]);
    });
  });
}

function get_local_values(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) console.info(chrome.runtime.lastError);
      resolve(result || {});
    });
  });
}

function set_local_value(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) console.info(chrome.runtime.lastError);
      resolve();
    });
  });
}

function set_local_values(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) console.info(chrome.runtime.lastError);
      resolve();
    });
  });
}

function parse_trade_cache_time(value) {
  if (value === undefined || value === null || value === "") return 0;
  let numeric =
    typeof value === "number" ||
    (typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim()));
  let time = numeric ? Number(value) : new Date(value).getTime();
  if (numeric && time > 0 && time < 10000000000) time *= 1000;
  return Number.isFinite(time) ? time : 0;
}

function get_trade_cache_expire_at(trade) {
  if (!trade || typeof trade !== "object") return 0;
  let actual_expire_at = parse_trade_cache_time(
    trade.expiration || trade.expires || trade.expiresAt,
  );
  let stored_expire_at = parse_trade_cache_time(trade.__nte_expires_at);
  if (actual_expire_at && stored_expire_at)
    return Math.min(actual_expire_at, stored_expire_at);
  if (actual_expire_at) return actual_expire_at;
  if (stored_expire_at) return stored_expire_at;

  let created_at = parse_trade_cache_time(trade.created || trade.createdAt);
  if (created_at) return created_at + trade_cache_ttl_ms;

  let cached_at = parse_trade_cache_time(trade.__nte_cached_at);
  if (cached_at) return cached_at + trade_cache_ttl_ms;

  return 0;
}

function normalize_cached_trade_value(
  trade,
  now = Date.now(),
  previous_trade = null,
) {
  if (!trade || typeof trade !== "object") return null;

  let cached_at =
    parse_trade_cache_time(previous_trade?.__nte_cached_at) ||
    parse_trade_cache_time(trade.__nte_cached_at) ||
    now;

  let normalized_trade = {
    ...trade,
    __nte_cached_at: cached_at,
  };

  normalized_trade.__nte_expires_at =
    get_trade_cache_expire_at(normalized_trade) ||
    cached_at + trade_cache_ttl_ms;

  return normalized_trade;
}

function prune_cached_trades(cached_trades, now = Date.now()) {
  let next_cached_trades = {};
  let dirty = false;

  for (let [trade_id, trade] of Object.entries(cached_trades || {})) {
    let normalized_trade = normalize_cached_trade_value(trade, now, trade);
    if (!normalized_trade) {
      dirty = true;
      continue;
    }

    if ((Number(normalized_trade.__nte_expires_at) || 0) <= now) {
      dirty = true;
      continue;
    }

    let normalized_trade_id = String(trade_id);
    next_cached_trades[normalized_trade_id] = normalized_trade;
    if (normalized_trade_id !== trade_id) dirty = true;
    if (trade?.__nte_cached_at !== normalized_trade.__nte_cached_at)
      dirty = true;
    if (trade?.__nte_expires_at !== normalized_trade.__nte_expires_at)
      dirty = true;
  }

  return { cached_trades: next_cached_trades, dirty };
}

async function get_pruned_cached_trades() {
  let cached_trades = (await get_local_value(cached_trades_key)) || {};
  let result = prune_cached_trades(cached_trades);
  if (result.dirty)
    await set_local_value(cached_trades_key, result.cached_trades);
  return result.cached_trades;
}

async function save_cached_trades(cached_trades) {
  let pruned_cached_trades = prune_cached_trades(cached_trades).cached_trades;
  await set_local_value(cached_trades_key, pruned_cached_trades);
  return pruned_cached_trades;
}

function cache_trade_detail(cached_trades, trade_id, trade, now = Date.now()) {
  let normalized_trade_id = String(trade_id || "").trim();
  if (!normalized_trade_id || !trade || typeof trade !== "object") return false;

  if (
    !(normalized_trade_id in cached_trades) &&
    Object.keys(cached_trades).length >= trade_cache_max_entries
  ) {
    return false;
  }

  let previous_trade = cached_trades[normalized_trade_id];
  let merged_trade =
    previous_trade && typeof previous_trade === "object"
      ? { ...previous_trade, ...trade }
      : trade;
  cached_trades[normalized_trade_id] = normalize_cached_trade_value(
    merged_trade,
    now,
    previous_trade,
  );
  return true;
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

function clear_extension_update_state_bg() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([extension_update_state_key], () => {
      if (chrome.runtime.lastError) console.info(chrome.runtime.lastError);
      resolve();
    });
  });
}

async function remember_extension_update(version) {
  let next_version = String(version || "").trim();
  if (!next_version) return;
  await set_local_value(extension_update_state_key, {
    version: next_version,
    detected_at: Date.now(),
  });
}

async function clear_stale_extension_update_state() {
  let current_version = String(chrome.runtime.getManifest()?.version || "");
  let stored = normalize_extension_update_state(
    (await get_local_values([extension_update_state_key]))[
      extension_update_state_key
    ],
  );
  if (!stored) return;
  if (
    !current_version ||
    compare_extension_versions(stored.version, current_version) <= 0
  ) {
    await clear_extension_update_state_bg();
  }
}

function format_number(value) {
  return Number(value || 0).toLocaleString();
}

function normalize_inbound_trade_notification_min_gain(value) {
  let parsed = Number(value);
  if (!Number.isFinite(parsed))
    parsed = inbound_trade_notification_min_gain_default;
  parsed = Math.max(0, parsed);
  return Math.round(parsed * 100) / 100;
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

async function parse_json_response_safe(response, label) {
  let text;
  try {
    text = await response.text();
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let body = String(text || "").trim();
  if (!body) return null;

  let content_type = response.headers.get("content-type") || "";
  if (!/json|javascript/i.test(content_type) && body.startsWith("<")) {
    console.warn(
      `Nevos Trading Extension: ${label} returned HTML instead of JSON.`,
    );
    return null;
  }

  try {
    return JSON.parse(body);
  } catch {
    console.warn(`Nevos Trading Extension: ${label} returned invalid JSON.`);
    return null;
  }
}

async function fetch_item_data() {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let response = await fetch(item_data_url, {
        headers: { "From-Extension": true },
        cache: "no-store",
      });
      if (response.status !== 200) continue;
      let parsed = await parse_json_response_safe(response, "Rolimons item data");
      if (!parsed) continue;
      let data =
        RolimonsItemDetails.normalize_rolimons_item_details_payload(parsed);
      if (has_item_data(data)) return data;
    } catch {}
    if (attempt < 2) await sleep_for(750 * (attempt + 1));
  }
  return null;
}

let item_data_retry_promise = null;
let trade_row_decline_csrf = "";
let trade_row_decline_csrf_promise = null;

function sleep_for(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function has_item_data(data) {
  return !!(data?.items && Object.keys(data.items).length);
}

function item_data_has_bundle_ids(data) {
  return !!(data?.bundleIds && Object.keys(data.bundleIds).length);
}

function coerce_item_data(data) {
  if (!data || typeof data !== "object") return null;
  if (
    typeof RolimonsItemDetails !== "undefined" &&
    RolimonsItemDetails.normalize_rolimons_item_details_payload
  ) {
    let normalized =
      RolimonsItemDetails.normalize_rolimons_item_details_payload(data);
    if (has_item_data(normalized)) return normalized;
  }
  if (!has_item_data(data)) return null;
  return {
    success: data.success !== false,
    items: data.items,
    bundleIds:
      data.bundleIds && typeof data.bundleIds === "object"
        ? data.bundleIds
        : {},
  };
}

async function cache_item_data(data) {
  let normalized = coerce_item_data(data);
  if (!has_item_data(normalized)) return null;
  await set_local_values({
    [item_data_key]: normalized,
    [item_data_time_key]: Date.now(),
  });
  return normalized;
}

function retry_item_data_until_success() {
  if (item_data_retry_promise) return item_data_retry_promise;
  item_data_retry_promise = (async () => {
    try {
      for (;;) {
        let data = null;
        try {
          data = await fetch_item_data();
        } catch {}
        if (has_item_data(data)) {
          return await cache_item_data(data);
        }
        if (typeof nte_is_lite !== "function" || !nte_is_lite()) {
          let server_data = await sync_item_data_from_server();
          if (has_item_data(server_data)) return server_data;
        }
        await sleep_for(1000);
      }
    } finally {
      item_data_retry_promise = null;
    }
  })();
  return item_data_retry_promise;
}

async function fetch_routility_data() {
  if (typeof nte_is_lite === "function" && nte_is_lite()) return null;
  let response;
  try {
    response = await fetch(routility_data_url, {
      headers: { "From-Extension": true },
    });
  } catch {
    return null;
  }
  if (response.status !== 200) return null;
  let parsed = await parse_json_response_safe(response, "Routility item data");
  if (!parsed) return null;
  let list = Array.isArray(parsed.items) ? parsed.items : [];
  let items = {};
  for (let item of list) {
    if (item && item.id !== undefined && item.id !== null)
      items[String(item.id)] = item;
  }
  return { items };
}

async function sync_item_data_from_server() {
  if (typeof nte_is_lite === "function" && nte_is_lite()) return null;
  try {
    let response = await fetch(server_item_data_url, {
      headers: nte_api_headers(),
      cache: "no-store",
    });
    if (!response.ok) return null;
    let body = await parse_json_response_safe(response, "Server Rolimons items");
    if (!body?.ok) return null;

    let server_at = Number(body.fetchedAt) || 0;
    let payload = coerce_item_data(body);
    if (!has_item_data(payload)) return null;
    // Flattened item lists without bundleIds break catalog/bundle links
    // (e.g. Tattletale → /catalog/{bundleId} 404). Prefer Rolimons v3 then.
    if (!item_data_has_bundle_ids(payload)) return null;

    let { [item_data_time_key]: local_at } = await get_local_values([
      item_data_time_key,
    ]);
    if (server_at > 0 && server_at < Number(local_at || 0)) return null;

    await set_local_values({
      [item_data_key]: payload,
      [item_data_time_key]: server_at > 0 ? server_at : Date.now(),
    });
    return payload;
  } catch {
    return null;
  }
}

let item_data_refresh_promise = null;

async function get_cached_item_data(max_age_ms = 300000) {
  if (item_data_refresh_promise) return item_data_refresh_promise;

  let { [item_data_key]: data, [item_data_time_key]: last_request } =
    await get_local_values([item_data_key, item_data_time_key]);
  data = coerce_item_data(data);

  if (
    has_item_data(data) &&
    item_data_has_bundle_ids(data) &&
    last_request &&
    Date.now() - last_request < max_age_ms
  ) {
    return data;
  }

  if (item_data_refresh_promise) return item_data_refresh_promise;

  item_data_refresh_promise = (async () => {
    let fresh_data = null;
    if (typeof nte_is_lite !== "function" || !nte_is_lite()) {
      fresh_data = await sync_item_data_from_server();
    }
    if (!fresh_data) {
      try {
        fresh_data = await fetch_item_data();
      } catch {}
    }
    // Server/cache without bundle metadata → force Rolimons v3 normalize.
    if (fresh_data && !item_data_has_bundle_ids(fresh_data)) {
      try {
        let roli = await fetch_item_data();
        if (has_item_data(roli) && item_data_has_bundle_ids(roli))
          fresh_data = roli;
      } catch {}
    }
    if (fresh_data) {
      return cache_item_data(fresh_data);
    }

    let stored = await get_local_values([item_data_key]);
    let stored_data = coerce_item_data(stored?.[item_data_key]);
    if (has_item_data(stored_data)) {
      start_item_data_retry();
      return stored_data;
    }

    start_item_data_retry();
    return null;
  })().finally(() => {
    item_data_refresh_promise = null;
  });

  return item_data_refresh_promise;
}

async function get_trade_ad_notification_item_data() {
  if (typeof nte_is_lite !== "function" || !nte_is_lite()) {
    await sync_item_data_from_server();
  }
  return get_cached_item_data(trade_ad_item_data_max_age_ms);
}

async function get_ui_item_data(max_age_ms = 300000) {
  let data = await get_cached_item_data(max_age_ms);
  if (has_item_data(data)) return data;
  return retry_item_data_until_success();
}

async function trade_row_get_csrf(force_refresh = false) {
  if (trade_row_decline_csrf && !force_refresh) return trade_row_decline_csrf;
  if (trade_row_decline_csrf_promise && !force_refresh)
    return trade_row_decline_csrf_promise;
  trade_row_decline_csrf_promise = fetch("https://auth.roblox.com/v2/logout", {
    method: "POST",
    credentials: "include",
  })
    .then((resp) => {
      trade_row_decline_csrf = resp.headers.get("x-csrf-token") || "";
      return trade_row_decline_csrf;
    })
    .catch(() => "")
    .finally(() => {
      trade_row_decline_csrf_promise = null;
    });
  return trade_row_decline_csrf_promise;
}

async function trade_row_decline_trade(trade_id) {
  let numeric_trade_id = parseInt(trade_id, 10);
  if (!(numeric_trade_id > 0)) {
    return { ok: false, status: 0, error: "Invalid trade." };
  }

  try {
    let csrf = await trade_row_get_csrf();
    if (!csrf) {
      return { ok: false, status: 0, error: "Could not get Roblox token." };
    }

    let do_decline = (token) =>
      fetch_trade_api_priority(
        `https://trades.roblox.com/v1/trades/${numeric_trade_id}/decline`,
        {
          method: "POST",
          credentials: "include",
          headers: { "x-csrf-token": token },
        },
      );

    let resp = await do_decline(csrf);
    if (resp.status === 403) {
      let next_csrf = resp.headers.get("x-csrf-token");
      if (next_csrf) {
        trade_row_decline_csrf = next_csrf;
        resp = await do_decline(next_csrf);
      }
    }
    if (resp.status === 429) {
      resp = await do_decline(trade_row_decline_csrf || csrf);
    }

    if (!resp.ok) {
      let body = await resp.text().catch(() => "");
      return {
        ok: false,
        status: resp.status,
        error: body?.slice(0, 160) || `Trade decline failed (${resp.status}).`,
      };
    }

    let cached_trades = await get_pruned_cached_trades();
    delete cached_trades[numeric_trade_id];
    delete cached_trades[String(numeric_trade_id)];
    await save_cached_trades(cached_trades);
    await mark_self_declined_trade(numeric_trade_id);
    return { ok: true, status: resp.status };
  } catch (err) {
    return { ok: false, status: 0, error: err?.message || String(err) };
  }
}

function start_item_data_retry() {
  retry_item_data_until_success().catch(() => {});
}

function normalize_rolimons_item_name(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[#,()\-:'`"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function get_rolimons_item(item_data, asset_id, item_name) {
  let item =
    item_data?.items?.[String(asset_id)] ||
    item_data?.items?.[asset_id] ||
    null;
  if (item) return item;

  let normalized_name = normalize_rolimons_item_name(item_name);
  if (!normalized_name || !item_data?.items) return null;

  if (!item_data.__nte_name_cache) {
    let cache = {};
    for (let [id, row] of Object.entries(item_data.items)) {
      if (!Array.isArray(row) || typeof row[0] !== "string") continue;
      let normalized = normalize_rolimons_item_name(row[0]);
      if (normalized && cache[normalized] === undefined)
        cache[normalized] = row;
    }
    Object.defineProperty(item_data, "__nte_name_cache", {
      value: cache,
      enumerable: false,
    });
  }

  return item_data.__nte_name_cache[normalized_name] || null;
}

function ensure_notification_click_handler() {
  if (notification_click_handler_registered) return;
  try {
    let api = chrome.notifications;
    if (!api) return;
    let on_clicked = api.onClicked;
    if (!on_clicked || typeof on_clicked.addListener !== "function") return;

    on_clicked.addListener((notification_id) => {
      if (notification_id.startsWith(trade_notification_prefix)) {
        chrome.tabs.create({ url: "https://www.roblox.com/trades" });
        return;
      }
      if (notification_id.startsWith(trade_ads_notification_prefix)) {
        let rest = notification_id.slice(trade_ads_notification_prefix.length);
        let m = /^u(\d+)_/.exec(rest);
        if (m) {
          chrome.tabs.create({
            url: `https://www.rolimons.com/playertrades/${m[1]}`,
          });
        } else {
          chrome.tabs.create({ url: "https://www.rolimons.com/tradeads" });
        }
        return;
      }
    });

    notification_click_handler_registered = true;
  } catch (e) {
    console.info("Nevos Trading Extension: notifications API unavailable", e);
  }
}

async function can_use_notifications() {
  if (!chrome.notifications?.create) return false;
  let manifest_permissions = chrome.runtime?.getManifest?.()?.permissions;
  if (
    Array.isArray(manifest_permissions) &&
    manifest_permissions.includes("notifications")
  )
    return true;
  if (!chrome.permissions?.contains) return true;
  return new Promise((resolve) => {
    try {
      chrome.permissions.contains(
        { permissions: ["notifications"] },
        (enabled) => {
          if (chrome.runtime.lastError) {
            console.info(
              "Nevos Trading Extension: notifications permission check failed",
              chrome.runtime.lastError,
            );
            resolve(false);
            return;
          }
          resolve(!!enabled);
        },
      );
    } catch (error) {
      console.info(
        "Nevos Trading Extension: notifications permission API unavailable",
        error,
      );
      resolve(true);
    }
  });
}

function get_trade_item_name(item) {
  return (
    item?.name ||
    item?.itemName ||
    item?.assetName ||
    item?.collectibleItemName ||
    item?.itemTarget?.name ||
    item?.itemTarget?.targetName ||
    item?.asset?.name ||
    item?.item?.name ||
    item?.collectibleItem?.name ||
    ""
  );
}

const TRADE_OFFER_ITEM_KEYS = [
  "userAssets",
  "assets",
  "userItems",
  "items",
  "userCollectibles",
  "collectibles",
];

function get_trade_asset_id(item) {
  let id =
    item?.assetId ??
    item?.itemTarget?.targetId ??
    item?.targetId ??
    item?.itemId ??
    item?.asset?.id ??
    item?.item?.id ??
    item?.id;
  if (id == null) return null;
  let parsed = parseInt(id, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function patch_trade_asset_pricing(item, item_data) {
  if (!item || typeof item !== "object" || !item_data) return item;

  let asset_id = get_trade_asset_id(item);
  let entry = get_rolimons_item(
    item_data,
    asset_id,
    get_trade_item_name(item),
  );
  if (!Array.isArray(entry)) return item;

  let rap =
    typeof entry[2] === "number" && Number.isFinite(entry[2]) ? entry[2] : null;
  if (rap === null) return item;

  return {
    ...item,
    recentAveragePrice: rap,
    rap,
  };
}

function patch_trade_offer_pricing(offer, item_data) {
  if (!offer || typeof offer !== "object") return offer;
  let next = { ...offer };

  for (let key of TRADE_OFFER_ITEM_KEYS) {
    if (!Array.isArray(next[key])) continue;
    next[key] = next[key].map((item) =>
      patch_trade_asset_pricing(item, item_data),
    );
  }

  if (Array.isArray(next.items)) {
    next.items = next.items.map((item) =>
      patch_trade_asset_pricing(item, item_data),
    );
  }

  return next;
}

function apply_fresh_pricing_to_trade(trade, item_data) {
  if (!trade || typeof trade !== "object") return trade;
  if (!item_data?.items) return trade;

  let next = { ...trade };

  if (Array.isArray(next.offers)) {
    next.offers = next.offers.map((offer) =>
      patch_trade_offer_pricing(offer, item_data),
    );
  }
  if (next.participantAOffer) {
    next.participantAOffer = patch_trade_offer_pricing(
      next.participantAOffer,
      item_data,
    );
  }
  if (next.participantBOffer) {
    next.participantBOffer = patch_trade_offer_pricing(
      next.participantBOffer,
      item_data,
    );
  }

  return next;
}

async function get_priced_cached_trade(trade) {
  if (!trade) return trade;
  let item_data = await get_cached_item_data();
  return apply_fresh_pricing_to_trade(trade, item_data);
}

function get_item_value_from_data(item_data, asset_id, rap, item_name) {
  let entry = get_rolimons_item(item_data, asset_id, item_name);
  if (Array.isArray(entry)) {
    if (RolimonsItemDetails?.get_item_value) {
      let value = RolimonsItemDetails.get_item_value(entry);
      if (value > 0) return value;
    } else if (typeof entry[4] === "number" && entry[4] > 0) {
      return entry[4];
    } else if (typeof entry[3] === "number" && entry[3] > 0) {
      return entry[3];
    }
  }
  return parseInt(rap, 10) || 0;
}

function compute_offer_value(offer, item_data, use_post_tax_robux = false) {
  let robux_total = Number(offer?.robux) || 0;
  let total = use_post_tax_robux ? Math.round(robux_total * 0.7) : robux_total;
  let items =
    offer?.userAssets ||
    offer?.assets ||
    offer?.userItems ||
    offer?.items ||
    offer?.userCollectibles ||
    offer?.collectibles ||
    [];
  if (!Array.isArray(items)) items = [];
  for (let item of items) {
    let id =
      item?.assetId ??
      item?.itemTarget?.targetId ??
      item?.targetId ??
      item?.itemId ??
      item?.asset?.id ??
      item?.item?.id ??
      item?.id;
    let rap = item?.recentAveragePrice ?? 0;
    total += get_item_value_from_data(
      item_data,
      id,
      rap,
      get_trade_item_name(item),
    );
  }
  return total;
}

function count_offer_items(offer) {
  let items =
    offer?.userAssets ||
    offer?.assets ||
    offer?.userItems ||
    offer?.items ||
    offer?.userCollectibles ||
    offer?.collectibles ||
    [];
  return Array.isArray(items) ? items.length : 0;
}

function get_trade_detail_offers(trade_detail) {
  let offers = trade_detail?.offers;
  if (
    !Array.isArray(offers) &&
    (trade_detail?.participantAOffer || trade_detail?.participantBOffer)
  ) {
    offers = [
      trade_detail.participantAOffer || {},
      trade_detail.participantBOffer || {},
    ];
  }
  return Array.isArray(offers) ? offers : null;
}

const authenticated_user_cache_ttl_ms = 5 * 60 * 1000;
let authenticated_user_cache = {
  value: null,
  expires_at: 0,
  pending: null,
};

async function get_authenticated_user_cached() {
  let now = Date.now();
  if (
    authenticated_user_cache.value &&
    authenticated_user_cache.expires_at > now
  ) {
    return authenticated_user_cache.value;
  }
  if (authenticated_user_cache.pending) return authenticated_user_cache.pending;
  authenticated_user_cache.pending = fetch_authenticated_user()
    .then((user) => {
      authenticated_user_cache.value = user;
      authenticated_user_cache.expires_at =
        Date.now() + authenticated_user_cache_ttl_ms;
      authenticated_user_cache.pending = null;
      return user;
    })
    .catch((error) => {
      authenticated_user_cache.pending = null;
      throw error;
    });
  return authenticated_user_cache.pending;
}

function get_trade_notification_offer_pair(trade_detail, my_user_id = 0) {
  let offers = get_trade_detail_offers(trade_detail);
  if (!offers || offers.length < 2) return null;
  if (my_user_id > 0) {
    let your_offer = offers.find(
      (offer) => Number(offer?.user?.id) === my_user_id,
    );
    let their_offer = offers.find(
      (offer) => Number(offer?.user?.id) !== my_user_id,
    );
    if (your_offer && their_offer) {
      return {
        your_offer,
        their_offer,
      };
    }
  }
  return {
    your_offer: offers[0],
    their_offer: offers[1],
  };
}

async function get_post_tax_trade_values_enabled() {
  let saved = await get_local_values([
    post_tax_trade_values_option_name,
    legacy_post_tax_trade_value_option_name,
  ]);
  if (saved[post_tax_trade_values_option_name] !== undefined)
    return !!saved[post_tax_trade_values_option_name];
  if (saved[legacy_post_tax_trade_value_option_name] !== undefined)
    return !!saved[legacy_post_tax_trade_value_option_name];
  return true;
}

async function get_trade_notification_value_stats(
  trade_detail,
  my_user_id = 0,
) {
  let offer_pair = get_trade_notification_offer_pair(trade_detail, my_user_id);
  if (!offer_pair) return null;
  let item_data = await get_cached_item_data(600000);
  let use_post_tax_robux = await get_post_tax_trade_values_enabled();
  let your_value = compute_offer_value(
    offer_pair.your_offer,
    item_data,
    false,
  );
  let their_value = compute_offer_value(
    offer_pair.their_offer,
    item_data,
    use_post_tax_robux,
  );
  let diff = their_value - your_value;
  let diff_pct_raw =
    your_value > 0
      ? (diff / your_value) * 100
      : diff > 0
        ? Number.POSITIVE_INFINITY
        : 0;

  return {
    your_value,
    their_value,
    your_count: count_offer_items(offer_pair.your_offer),
    their_count: count_offer_items(offer_pair.their_offer),
    diff,
    diff_pct_raw,
    diff_pct_display: Number.isFinite(diff_pct_raw)
      ? Math.round(diff_pct_raw)
      : null,
  };
}

const TRADE_NOTIFICATION_MAX_AGE_MS = 5 * 60 * 1000;
const TRADE_NOTIFICATION_CLOCK_SKEW_MS = 5000;

function get_trade_timestamp_ms(trade, trade_type = "") {
  let candidates =
    trade_type === "inbound"
      ? [
          trade?.created,
          trade?.createdAt,
          trade?.createdTime,
          trade?.timestamp,
        ]
      : trade_type === "outbound"
        ? [
            trade?.created,
            trade?.createdAt,
            trade?.createdTime,
            trade?.timestamp,
            trade?.updated,
            trade?.updatedAt,
            trade?.updatedTime,
          ]
        : [
            trade?.completed,
            trade?.completedAt,
            trade?.completedTime,
            trade?.timestamp,
            trade?.updated,
            trade?.updatedAt,
            trade?.updatedTime,
            trade?.created,
            trade?.createdAt,
            trade?.createdTime,
          ];
  for (let value of candidates) {
    if (value === undefined || value === null || value === "") continue;
    let numeric_string =
      typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim());
    let timestamp =
      typeof value === "number" || numeric_string
        ? Number(value)
        : new Date(value).getTime();
    if (
      (typeof value === "number" || numeric_string) &&
      timestamp > 0 &&
      timestamp < 10000000000
    )
      timestamp *= 1000;
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}

function is_trade_recent_for_notification(
  trade,
  now = Date.now(),
  trade_type = "",
) {
  let timestamp = get_trade_timestamp_ms(trade, trade_type);
  return (
    timestamp !== null &&
    timestamp <= now + TRADE_NOTIFICATION_CLOCK_SKEW_MS &&
    now - timestamp <= TRADE_NOTIFICATION_MAX_AGE_MS
  );
}

function trade_notification_sent_id(trade, trade_type) {
  let id = String(trade?.id || "").trim();
  if (!id) return "";
  return `${String(trade_type || "trade").toLowerCase()}:${id}`;
}

function prune_trade_notification_sent_map(raw, now = Date.now()) {
  let out = {};
  if (raw && typeof raw === "object") {
    for (let [key, timestamp] of Object.entries(raw)) {
      let ts = Number(timestamp) || 0;
      if (!key || ts <= 0) continue;
      if (now - ts <= trade_notification_sent_ttl_ms) out[key] = ts;
    }
  }
  let entries = Object.entries(out).sort((a, b) => Number(a[1]) - Number(b[1]));
  if (entries.length > trade_notification_sent_max_entries) {
    out = Object.fromEntries(entries.slice(-trade_notification_sent_max_entries));
  }
  return out;
}

async function get_trade_notification_sent_map() {
  if (trade_notification_sent_memory) return trade_notification_sent_memory;
  trade_notification_sent_memory = prune_trade_notification_sent_map(
    await get_local_value(trade_notification_sent_key),
  );
  return trade_notification_sent_memory;
}

async function save_trade_notification_sent_map(map) {
  trade_notification_sent_memory = prune_trade_notification_sent_map(map);
  await set_local_value(trade_notification_sent_key, trade_notification_sent_memory);
}

async function reserve_trade_notification(trade, trade_type) {
  let key = trade_notification_sent_id(trade, trade_type);
  if (!key) return false;
  if (trade_notification_pending_keys.has(key)) return false;
  trade_notification_pending_keys.add(key);
  try {
    let sent = await get_trade_notification_sent_map();
    if (sent[key]) return false;
    sent[key] = Date.now();
    await save_trade_notification_sent_map(sent);
    return true;
  } finally {
    trade_notification_pending_keys.delete(key);
  }
}

async function show_trade_notification(
  trade,
  trade_type,
  trade_detail,
  trade_stats = null,
  my_user_id = 0,
) {
  let title = null;

  switch (trade_type) {
    case "inbound":
      if (!(await get_local_value("Inbound Trade Notifications"))) return false;
      title = `Trade from ${trade.user.displayName}`;
      break;
    case "inactive":
      if (!(await get_local_value("Declined Trade Notifications"))) return false;
      title = `Trade to ${trade.user.displayName} declined`;
      break;
    case "completed":
      if (!(await get_local_value("Completed Trade Notifications"))) return false;
      title = `Trade with ${trade.user.displayName} accepted`;
      break;
    default:
      return false;
  }

  if (!chrome.notifications?.create) return false;
  if (!(await can_use_notifications())) return false;
  if (!(await reserve_trade_notification(trade, trade_type))) return false;

  let icon_url = "assets/icons/logo128.png";

  try {
    let thumbnail_response = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${trade.user.id}&size=48x48&format=Png&isCircular=true`,
      { credentials: "include" },
    );
    let thumbnail_data = await thumbnail_response.json();
    if (thumbnail_data?.data?.[0]?.imageUrl) {
      icon_url = thumbnail_data.data[0].imageUrl;
    }
  } catch {}

  let message = title;

  if (trade_detail) {
    if (!my_user_id) {
      try {
        my_user_id = Number((await get_authenticated_user_cached())?.id) || 0;
      } catch {}
    }
    trade_stats =
      trade_stats ||
      (await get_trade_notification_value_stats(trade_detail, my_user_id));
    if (trade_stats) {
      let {
        your_value,
        their_value,
        your_count,
        their_count,
        diff,
        diff_pct_raw,
        diff_pct_display,
      } = trade_stats;
      let indicator = diff > 0 ? "W" : diff < 0 ? "L" : "=";
      let diff_str = diff > 0 ? `+${format_number(diff)}` : format_number(diff);
      let diff_pct_str = Number.isFinite(diff_pct_raw)
        ? `${diff_pct_display > 0 ? "+" : ""}${diff_pct_display}%`
        : diff > 0
          ? "+INF%"
          : "0%";

      message =
        `${indicator} ${diff_str} (${diff_pct_str})\n` +
        `Yours: ${format_number(your_value)} (${your_count} item${your_count !== 1 ? "s" : ""})\n` +
        `Theirs: ${format_number(their_value)} (${their_count} item${their_count !== 1 ? "s" : ""})`;
    }
  }

  let notification_id = `${trade_notification_prefix}${trade_type}_${trade.id}`;
  chrome.notifications.create(
    notification_id,
    {
      type: "basic",
      iconUrl: extension_notification_icon_url(icon_url),
      title: title,
      message: message,
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
  return true;
}

async function get_inbound_trade_webhook_settings() {
  let saved = await get_local_values([
    inbound_trade_notification_webhook_enabled_key,
    inbound_trade_notification_webhook_url_key,
    inbound_trade_notification_webhook_ping_enabled_key,
    inbound_trade_notification_webhook_discord_id_key,
  ]);
  let enabled = !!saved[inbound_trade_notification_webhook_enabled_key];
  let webhook_url = normalize_inbound_trade_notification_webhook_url(
    saved[inbound_trade_notification_webhook_url_key],
  );
  let ping_enabled =
    enabled && !!saved[inbound_trade_notification_webhook_ping_enabled_key];
  let discord_id = normalize_inbound_trade_notification_discord_id(
    saved[inbound_trade_notification_webhook_discord_id_key],
  );
  if (!enabled || !webhook_url) return null;
  if (ping_enabled && !discord_id) ping_enabled = false;
  return {
    webhook_url,
    ping_enabled,
    discord_id,
  };
}

let inbound_poll_running = false;
const INBOUND_POLL_INTERVAL_MS = 3000;
const INBOUND_POLL_MAX_NOTIFIED = 200;
const TRADE_STATUS_SEED_MAX_IDS = 200;
const TRADE_STATUS_POLL_INTERVAL_MS = 15000;
const TRADE_STATUS_DETAIL_DELAY_MS = 500;
const TRADE_CACHE_ALARM_DELAY_MINUTES = 0.1;
const TRADE_CACHE_ALARM_PERIOD_MINUTES = 0.5;
const inbound_poll_alarm_name = "inboundPollAlarm";
const inbound_poll_state_key = "inboundPollState";
const trade_status_seed_key = "tradeStatusNotificationSeed";
const self_declined_trade_ids_key = "selfDeclinedTradeIds";
const locked_trade_ids_key = "nteLockedTradeIds";
const INBOUND_POLL_STALE_GAP_MS = 15 * 60 * 1000;
const SELF_DECLINED_TRADE_ID_TTL_MS = 24 * 60 * 60 * 1000;
const SELF_DECLINED_TRADE_ID_MAX = 300;

async function get_inbound_poll_state() {
  let state = await get_local_value(inbound_poll_state_key);
  if (!state || typeof state !== "object")
    return { last_seen_time: 0, last_checked_at: 0, notified_ids: [] };
  return {
    last_seen_time: state.last_seen_time || 0,
    last_checked_at: state.last_checked_at || 0,
    notified_ids: Array.isArray(state.notified_ids) ? state.notified_ids : [],
  };
}

async function save_inbound_poll_state(
  last_seen_time,
  notified_ids_arr,
  last_checked_at = Date.now(),
) {
  if (notified_ids_arr.length > INBOUND_POLL_MAX_NOTIFIED)
    notified_ids_arr = notified_ids_arr.slice(notified_ids_arr.length - 100);
  await set_local_value(inbound_poll_state_key, {
    last_seen_time,
    last_checked_at,
    notified_ids: notified_ids_arr,
  });
}

async function get_self_declined_trade_ids() {
  let raw = await get_local_value(self_declined_trade_ids_key);
  let now = Date.now();
  let out = {};
  if (Array.isArray(raw)) {
    for (let id of raw) out[String(id)] = now;
  } else if (raw && typeof raw === "object") {
    for (let [id, time] of Object.entries(raw)) {
      let ts = Number(time) || 0;
      if (ts > 0 && now - ts <= SELF_DECLINED_TRADE_ID_TTL_MS)
        out[String(id)] = ts;
    }
  }
  let entries = Object.entries(out).sort((a, b) => Number(a[1]) - Number(b[1]));
  if (entries.length > SELF_DECLINED_TRADE_ID_MAX)
    out = Object.fromEntries(entries.slice(-SELF_DECLINED_TRADE_ID_MAX));
  return out;
}

async function save_self_declined_trade_ids(ids) {
  await set_local_value(self_declined_trade_ids_key, ids || {});
}

async function mark_self_declined_trade(trade_id) {
  let id = String(trade_id || "").trim();
  if (!id) return;
  let ids = await get_self_declined_trade_ids();
  ids[id] = Date.now();
  await save_self_declined_trade_ids(ids);
}

async function consume_self_declined_trade(trade_id) {
  let id = String(trade_id || "").trim();
  if (!id) return false;
  let ids = await get_self_declined_trade_ids();
  if (!ids[id]) return false;
  delete ids[id];
  await save_self_declined_trade_ids(ids);
  return true;
}

async function get_locked_trade_ids() {
  let raw = await get_local_value(locked_trade_ids_key);
  let ids = Array.isArray(raw) ? raw : [];
  return new Set(
    ids
      .map((id) => String(id || "").trim())
      .filter((id) => id && /^\d+$/.test(id)),
  );
}

async function get_trade_status_seed_state() {
  let state = await get_local_value(trade_status_seed_key);
  if (!state || typeof state !== "object")
    return { inactive: [], completed: [] };
  return {
    inactive: Array.isArray(state.inactive) ? state.inactive.map(String) : [],
    completed: Array.isArray(state.completed)
      ? state.completed.map(String)
      : [],
  };
}

async function save_trade_status_seed_state(state) {
  await set_local_value(trade_status_seed_key, {
    inactive: Array.isArray(state?.inactive)
      ? state.inactive.slice(-TRADE_STATUS_SEED_MAX_IDS).map(String)
      : [],
    completed: Array.isArray(state?.completed)
      ? state.completed.slice(-TRADE_STATUS_SEED_MAX_IDS).map(String)
      : [],
  });
}

let trade_status_seed_running = false;
async function prime_trade_status_seed(trade_types) {
  if (trade_status_seed_running) return;
  trade_status_seed_running = true;
  try {
    let next_state = await get_trade_status_seed_state();
    let dirty = false;
    for (let trade_type of Array.isArray(trade_types) ? trade_types : []) {
      if (trade_type !== "inactive" && trade_type !== "completed") continue;
      try {
        let response = await fetch_trade_api(
          `https://trades.roblox.com/v1/trades/${trade_type}?limit=100&sortOrder=Desc`,
          { credentials: "include" },
        );
        if (!response.ok) continue;
        let payload = await response.json();
        next_state[trade_type] = (payload?.data || [])
          .map((trade) => String(trade?.id || ""))
          .filter(Boolean)
          .slice(-TRADE_STATUS_SEED_MAX_IDS);
        dirty = true;
      } catch (error) {
        console.info(
          "Nevos Trading Extension: trade status seed failed",
          trade_type,
          error,
        );
      }
    }
    if (dirty) await save_trade_status_seed_state(next_state);
  } finally {
    trade_status_seed_running = false;
  }
}

async function poll_inbound_trades() {
  if (inbound_poll_running) return;
  if (!(await get_local_value("Inbound Trade Notifications"))) return;

  inbound_poll_running = true;
  try {
    let min_gain_pct = normalize_inbound_trade_notification_min_gain(
      await get_local_value(inbound_trade_notification_min_gain_key),
    );
    let resp = await fetch_trade_api(
      "https://trades.roblox.com/v1/trades/inbound?limit=10&sortOrder=Desc",
      {
        credentials: "include",
      },
    );
    if (!resp.ok) return;

    let data = await resp.json();
    let trades = data?.data || [];
    if (!trades.length) return;

    let state = await get_inbound_poll_state();
    let last_seen_time = state.last_seen_time;
    let last_checked_at = state.last_checked_at || 0;
    let notified_ids = new Set(state.notified_ids);
    let now = Date.now();
    let stale_poll =
      last_seen_time > 0 &&
      (last_checked_at
        ? now - last_checked_at > INBOUND_POLL_STALE_GAP_MS
        : now - last_seen_time > INBOUND_POLL_STALE_GAP_MS);

    if (last_seen_time === 0) {
      let first_time = get_trade_timestamp_ms(trades[0], "inbound");
      let newest =
        first_time && first_time <= now + TRADE_NOTIFICATION_CLOCK_SKEW_MS
          ? first_time
          : now;
      for (let t of trades) notified_ids.add(String(t.id));
      await save_inbound_poll_state(newest, [...notified_ids], now);
      return;
    }

    let newest_time = last_seen_time;
    for (let t of trades) {
      let ct = get_trade_timestamp_ms(t, "inbound");
      if (
        ct !== null &&
        ct <= now + TRADE_NOTIFICATION_CLOCK_SKEW_MS &&
        ct > newest_time
      )
        newest_time = ct;
    }

    let new_trades = trades.filter((t) => {
      let created = get_trade_timestamp_ms(t, "inbound");
      return (
        created !== null &&
        created > last_seen_time &&
        is_trade_recent_for_notification(t, now, "inbound") &&
        !notified_ids.has(String(t.id))
      );
    });

    if (stale_poll) {
      for (let t of trades) notified_ids.add(String(t.id));
      new_trades = new_trades.slice(0, 1);
    }

    if (!new_trades.length) {
      await save_inbound_poll_state(
        Math.max(newest_time, last_seen_time),
        [...notified_ids],
        now,
      );
      return;
    }

    let cached_trades = await get_pruned_cached_trades();
    let my_user_id = 0;
    let webhook_settings =
      typeof nte_is_lite === "function" && nte_is_lite()
        ? null
        : await get_inbound_trade_webhook_settings();
    try {
      my_user_id = Number((await get_authenticated_user_cached())?.id) || 0;
    } catch {}

    for (let trade of new_trades) {
      notified_ids.add(String(trade.id));

      let detail =
        cached_trades[trade.id] || cached_trades[String(trade.id)] || null;
      let trade_stats = null;

      let has_offers =
        detail &&
        (Array.isArray(detail.offers) ||
          detail.participantAOffer ||
          detail.participantBOffer);
      if (!has_offers) {
        try {
          let detail_resp = await fetch_trade_api(
            `https://trades.roblox.com/v2/trades/${trade.id}`,
            {
              credentials: "include",
            },
          );
          if (detail_resp.ok) {
            detail = await detail_resp.json();
            detail.status = trade.status || "Open";
            detail.tradeType = "inbound";
            cache_trade_detail(cached_trades, trade.id, detail);
          } else {
            console.info(
              "NTE inbound poll: detail fetch failed",
              trade.id,
              detail_resp.status,
            );
          }
        } catch (fe) {
          console.info("NTE inbound poll: detail fetch error", trade.id, fe);
        }
      }

      if (detail) {
        detail = await get_priced_cached_trade(detail);
        trade_stats = await get_trade_notification_value_stats(
          detail,
          my_user_id,
        );
        if (
          min_gain_pct > 0 &&
          trade_stats &&
          trade_stats.diff_pct_raw < min_gain_pct
        )
          continue;
      }

      let notification_shown = await show_trade_notification(
        trade,
        "inbound",
        detail,
        trade_stats,
        my_user_id,
      );
      if (notification_shown && webhook_settings) {
        await send_inbound_trade_webhook_notification(
          trade,
          detail,
          trade_stats,
          my_user_id,
          webhook_settings,
        );
      }
    }

    await save_cached_trades(cached_trades);
    await save_inbound_poll_state(newest_time, [...notified_ids], now);
  } catch (e) {
    console.info("Nevos Trading Extension: inbound poll error", e);
  } finally {
    inbound_poll_running = false;
  }
}

let inbound_poll_timer = null;
function ensure_inbound_poll_timer() {
  if (inbound_poll_timer) return;
  inbound_poll_timer = setInterval(
    poll_inbound_trades,
    INBOUND_POLL_INTERVAL_MS,
  );
  poll_inbound_trades();
}

chrome.alarms.create(inbound_poll_alarm_name, {
  delayInMinutes: 0.1,
  periodInMinutes: 0.5,
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "nte-keepalive") {
    ensure_inbound_poll_timer();
    ensure_trade_status_poll_timer();
    port.onDisconnect.addListener(() => {
      if (inbound_poll_timer) {
        clearInterval(inbound_poll_timer);
        inbound_poll_timer = null;
      }
      if (trade_status_poll_timer) {
        clearInterval(trade_status_poll_timer);
        trade_status_poll_timer = null;
      }
    });
  }
});

async function fetch_trade_page(
  trade_type,
  cached_trades,
  sent_notifications,
  trade_status_seed_state,
) {
  let response = await fetch_trade_api(
    `https://trades.roblox.com/v1/trades/${trade_type}?limit=100&sortOrder=Desc`,
    { credentials: "include" },
  );
  if (response.status !== 200) return;

  let payload = await response.json();
  let dirty = false;
  for (let trade of payload.data || []) {
    if (sent_notifications.count >= 20) break;

    let existing = cached_trades[trade.id];
    let previous_type = existing?.tradeType;
    let known_status = existing?.status;
    let should_refresh =
      !existing ||
      (known_status !== undefined && trade.status !== known_status);
    if (!should_refresh) {
      if (!existing.status) {
        existing.status = trade.status;
        dirty = true;
      }
      if (!existing.tradeType) {
        existing.tradeType = trade_type;
        dirty = true;
      }
      continue;
    }

    let notification_checked_at = Date.now();
    await new Promise((r) => setTimeout(r, TRADE_STATUS_DETAIL_DELAY_MS));
    let full_response = await fetch_trade_api(
      `https://trades.roblox.com/v1/trades/${trade.id}`,
      {
        credentials: "include",
      },
    );
    if (full_response.status === 429) {
      await new Promise((r) => setTimeout(r, 15000));
      continue;
    }
    if (full_response.status !== 200) continue;

    let full_trade = await full_response.json();
    full_trade.tradeType = trade_type;
    cache_trade_detail(cached_trades, trade.id, full_trade);
    dirty = true;

    if (trade_type === "inbound") continue;

    let self_declined =
      trade_type === "inactive" && (await consume_self_declined_trade(trade.id));
    let should_notify =
      trade_type === "inactive"
        ? previous_type === "outbound" && !self_declined
        : (previous_type && previous_type !== trade_type) ||
          trade_type !== "inactive";

    if (
      should_notify &&
      Array.isArray(trade_status_seed_state?.[trade_type]) &&
      trade_status_seed_state[trade_type].includes(String(trade.id))
    ) {
      should_notify = false;
      trade_status_seed_state[trade_type] = trade_status_seed_state[
        trade_type
      ].filter((id) => id !== String(trade.id));
      trade_status_seed_state.__dirty = true;
    }

    if (
      trade_type === "completed" &&
      !is_trade_recent_for_notification(
        { ...full_trade, ...trade },
        notification_checked_at,
        "completed",
      )
    ) {
      should_notify = false;
    }

    if (should_notify) {
      let detail_v2 = null;
      if (full_trade.offers && Array.isArray(full_trade.offers)) {
        detail_v2 = full_trade;
      } else if (full_trade.participantAOffer || full_trade.participantBOffer) {
        detail_v2 = {
          offers: [
            full_trade.participantAOffer || {},
            full_trade.participantBOffer || {},
          ],
        };
      }
      if (await show_trade_notification(trade, trade_type, detail_v2)) {
        sent_notifications.count++;
      }
    }
  }

  if (dirty) await save_cached_trades(cached_trades);
}

async function refresh_trade_cache() {
  if (trade_status_poll_running || trade_status_seed_running) return;
  trade_status_poll_running = true;
  try {
    let declined_notifs = await get_local_value("Declined Trade Notifications");
    let completed_notifs = await get_local_value(
      "Completed Trade Notifications",
    );

    if (!declined_notifs && !completed_notifs) return;

    let cached_trades = await get_pruned_cached_trades();
    let trade_status_seed_state = await get_trade_status_seed_state();
    let sent_notifications = { count: 0 };
    let trade_types = [];
    if (completed_notifs) trade_types.push("completed");
    if (declined_notifs) trade_types.push("inactive");

    for (let trade_type of trade_types) {
      if (sent_notifications.count >= 20) break;
      await fetch_trade_page(
        trade_type,
        cached_trades,
        sent_notifications,
        trade_status_seed_state,
      );
    }
    if (trade_status_seed_state.__dirty) {
      delete trade_status_seed_state.__dirty;
      await save_trade_status_seed_state(trade_status_seed_state);
    }
  } finally {
    trade_status_poll_running = false;
  }
}

let trade_status_poll_running = false;
let trade_status_poll_timer = null;
function ensure_trade_status_poll_timer() {
  if (trade_status_poll_timer) return;
  trade_status_poll_timer = setInterval(
    refresh_trade_cache,
    TRADE_STATUS_POLL_INTERVAL_MS,
  );
  refresh_trade_cache();
}

function ensure_default_options() {
  let option_names = option_groups
    .filter((entry) => typeof entry !== "string")
    .map((entry) => entry.name);
  option_names.push(legacy_show_usd_values_option_name);
  option_names.push(legacy_colorblind_mode_option_name);
  option_names.push(legacy_post_tax_trade_value_option_name);
  option_names.push(legacy_add_item_ownership_uaid_links_option_name);
  option_names.push(legacy_counter_trade_prompt_option_name);
  option_names.push(ownership_link_provider_key);
  option_names.push(counter_trade_choice_mode_key);
  option_names.push(colorblind_mode_profile_key);
  option_names.push(inbound_trade_notification_min_gain_key);
  option_names.push(inbound_trade_notification_webhook_enabled_key);
  option_names.push(inbound_trade_notification_webhook_url_key);
  option_names.push(inbound_trade_notification_webhook_ping_enabled_key);
  option_names.push(inbound_trade_notification_webhook_discord_id_key);
  option_names.push(duplicate_trade_warning_hours_key);

  chrome.storage.local.get(option_names, (saved_values) => {
    let colorblind_enabled =
      saved_values[colorblind_mode_option_name] !== undefined
        ? !!saved_values[colorblind_mode_option_name]
        : !!saved_values[legacy_colorblind_mode_option_name];

    option_groups.forEach((entry) => {
      if (typeof entry === "string") return;
      if (saved_values[entry.name] !== undefined) return;
      if (
        entry.name === show_routility_usd_values_option_name &&
        saved_values[legacy_show_usd_values_option_name] !== undefined
      ) {
        chrome.storage.local.set({
          [entry.name]: saved_values[legacy_show_usd_values_option_name],
        });
        return;
      }
      if (
        entry.name === colorblind_mode_option_name &&
        saved_values[legacy_colorblind_mode_option_name] !== undefined
      ) {
        chrome.storage.local.set({ [entry.name]: colorblind_enabled });
        return;
      }
      if (
        entry.name === post_tax_trade_values_option_name &&
        saved_values[legacy_post_tax_trade_value_option_name] !== undefined
      ) {
        chrome.storage.local.set({
          [entry.name]: saved_values[legacy_post_tax_trade_value_option_name],
        });
        return;
      }
      if (
        entry.name === add_item_ownership_buttons_option_name &&
        saved_values[legacy_add_item_ownership_uaid_links_option_name] !==
          undefined
      ) {
        chrome.storage.local.set({
          [entry.name]:
            saved_values[legacy_add_item_ownership_uaid_links_option_name],
        });
        return;
      }
      if (
        entry.name === counter_trade_choices_option_name &&
        saved_values[legacy_counter_trade_prompt_option_name] !== undefined
      ) {
        chrome.storage.local.set({
          [entry.name]: !!saved_values[legacy_counter_trade_prompt_option_name],
        });
        return;
      }
      chrome.storage.local.set({ [entry.name]: entry.enabledByDefault });
    });
    if (
      saved_values[legacy_colorblind_mode_option_name] !== colorblind_enabled
    ) {
      chrome.storage.local.set({
        [legacy_colorblind_mode_option_name]: colorblind_enabled,
      });
    }
    let ownership_provider = normalize_ownership_link_provider(
      saved_values[ownership_link_provider_key],
    );
    if (saved_values[ownership_link_provider_key] !== ownership_provider) {
      chrome.storage.local.set({
        [ownership_link_provider_key]: ownership_provider,
      });
    }
    let counter_mode = normalize_counter_trade_choice_mode(
      saved_values[counter_trade_choice_mode_key],
    );
    if (saved_values[counter_trade_choice_mode_key] !== counter_mode) {
      chrome.storage.local.set({
        [counter_trade_choice_mode_key]: counter_mode,
      });
    }
    let colorblind_profile = normalize_colorblind_mode_profile(
      saved_values[colorblind_mode_profile_key],
    );
    if (saved_values[colorblind_mode_profile_key] !== colorblind_profile) {
      chrome.storage.local.set({
        [colorblind_mode_profile_key]: colorblind_profile,
      });
    }
    if (saved_values[inbound_trade_notification_min_gain_key] === undefined) {
      chrome.storage.local.set({
        [inbound_trade_notification_min_gain_key]:
          inbound_trade_notification_min_gain_default,
      });
    }
    if (saved_values[inbound_trade_notification_webhook_enabled_key] === undefined) {
      chrome.storage.local.set({
        [inbound_trade_notification_webhook_enabled_key]: false,
      });
    }
    if (saved_values[inbound_trade_notification_webhook_url_key] === undefined) {
      chrome.storage.local.set({
        [inbound_trade_notification_webhook_url_key]: "",
      });
    }
    if (
      saved_values[inbound_trade_notification_webhook_ping_enabled_key] ===
      undefined
    ) {
      chrome.storage.local.set({
        [inbound_trade_notification_webhook_ping_enabled_key]: false,
      });
    }
    if (
      saved_values[inbound_trade_notification_webhook_discord_id_key] ===
      undefined
    ) {
      chrome.storage.local.set({
        [inbound_trade_notification_webhook_discord_id_key]: "",
      });
    }
    if (saved_values[duplicate_trade_warning_hours_key] === undefined) {
      chrome.storage.local.set({
        [duplicate_trade_warning_hours_key]:
          duplicate_trade_warning_hours_default,
      });
    }
  });
}

const ROLIMONS_HTML_FETCH_INIT = {
  credentials: "omit",
  cache: "no-store",
  redirect: "follow",
  headers: {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  },
};

async function fetch_rolimons_html(url) {
  return fetch(url, ROLIMONS_HTML_FETCH_INIT);
}

async function fetch_authenticated_user() {
  let response = await fetch(
    "https://users.roblox.com/v1/users/authenticated",
    {
      credentials: "include",
    },
  );
  if (!response.ok)
    throw new Error("Could not determine the authenticated Roblox user.");
  let data = await response.json();
  return {
    id: Number(data?.id) || 0,
    name: String(data?.name || data?.displayName || "You"),
  };
}

const trade_history_api_url = "https://nevos-extension.com/api/trades/history";
const trade_analysis_api_url =
  "https://nevos-extension.com/api/tradecheck/evaluate";
const trade_history_cache_ttl_ms = 120000;
const trade_history_user_cache_ttl_ms = 6 * 60 * 60 * 1000;
const trade_history_ciiid_cache_ttl_ms = 6 * 60 * 60 * 1000;
const trade_history_thumb_cache_ttl_ms = 6 * 60 * 60 * 1000;
const trade_history_cache_max_entries = 256;
const trade_history_user_cache_max_entries = 512;
const trade_history_ciiid_cache_max_entries = 1024;
const trade_history_thumb_cache_max_entries = 2048;
const item_proofs_api_url = "https://nevos-extension.com/api/proofs/search";
const item_proofs_cache_ttl_ms = 10 * 60 * 1000;
const item_proofs_cache_max_entries = 256;
const item_proofs_max_results = 12;
const item_proofs_max_attachments = 4;
const item_proof_image_cache_ttl_ms = 30 * 60 * 1000;
const item_proof_image_cache_max_entries = 128;
const discord_snowflake_epoch_ms = 1420070400000;
let trade_history_api_cache = new Map();
let trade_history_user_cache = new Map();
let trade_history_ciiid_cache = new Map();
let trade_history_thumb_cache = new Map();
let item_proofs_cache = new Map();
let item_proof_image_cache = new Map();

function trim_trade_history_cache(map, max_entries) {
  while (map.size > max_entries) {
    let first = map.keys().next();
    if (first.done) break;
    map.delete(first.value);
  }
}

function get_trade_history_cached_value(map, key) {
  let hit = map.get(key);
  if (!hit) return null;
  if ((Number(hit.expires_at) || 0) <= Date.now()) {
    map.delete(key);
    return null;
  }
  map.delete(key);
  map.set(key, hit);
  return hit.value;
}

function set_trade_history_cached_value(map, key, value, ttl_ms, max_entries) {
  map.set(key, { value, expires_at: Date.now() + ttl_ms });
  trim_trade_history_cache(map, max_entries);
  return value;
}

function normalize_trade_history_uaid(value) {
  let uaid = String(value || "").trim();
  return /^\d+$/.test(uaid) ? uaid : "";
}

function normalize_trade_history_asset_id(value) {
  let asset_id = String(value || "").trim();
  return /^\d+$/.test(asset_id) ? asset_id : "";
}

function normalize_trade_history_ciiid(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalize_item_proofs_search_term(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

function parse_item_proof_timestamp_from_id(value) {
  let id = String(value || "").trim();
  if (!/^\d{17,20}$/.test(id)) return 0;
  try {
    let timestamp = Number(
      (BigInt(id) >> 22n) + BigInt(discord_snowflake_epoch_ms),
    );
    return timestamp > 1451606400000 && timestamp < 4102444800000
      ? timestamp
      : 0;
  } catch {
    return 0;
  }
}

function parse_item_proof_timestamp_from_content(content) {
  let text = String(content || "");
  let match = text.match(
    /(?:^|\n)\s*d(?:ate)?\s*:\s*([0-9]{1,2}[\/.-][0-9]{1,2}[\/.-][0-9]{2,4})(?:\s|$)/i,
  );
  if (!match) return 0;
  let parts = match[1].split(/[\/.-]/).map((part) => Number(part));
  if (
    parts.length !== 3 ||
    parts.some((part) => !Number.isFinite(part) || part <= 0)
  )
    return 0;
  let [first, second, year] = parts;
  if (year < 100) year += year < 70 ? 2000 : 1900;
  let month = first;
  let day = second;
  if (first > 12 && second <= 12) {
    month = second;
    day = first;
  } else if (second > 12 && first <= 12) {
    month = first;
    day = second;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return 0;
  let timestamp = new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalize_item_proof_result(raw) {
  let attachments = Array.isArray(raw?.attachments)
    ? raw.attachments
        .map((entry) => String(entry || "").trim())
        .filter((entry) => /^https:\/\/[^ ]+/i.test(entry))
    : [];
  let api_timestamp = Number(raw?.timestamp || 0);
  let timestamp =
    (Number.isFinite(api_timestamp) && api_timestamp > 0 ? api_timestamp : 0) ||
    parse_item_proof_timestamp_from_id(raw?.id) ||
    parse_item_proof_timestamp_from_content(raw?.content);
  return {
    id: String(raw?.id || ""),
    content: String(raw?.content || "").trim(),
    attachments: attachments.slice(0, item_proofs_max_attachments),
    attachmentCount: attachments.length,
    timestamp,
  };
}

function normalize_item_proof_image_url(value) {
  let url = String(value || "").trim();
  return /^https:\/\/nevos-extension\.com\/api\/proofs\/images\/[0-9]{5,32}$/i.test(
    url,
  )
    ? url
    : "";
}

function base64_from_uint8(bytes) {
  let chunk_size = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk_size) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk_size),
    );
  }
  return btoa(binary);
}

async function fetch_item_proofs_api(search_term) {
  let normalized_term = normalize_item_proofs_search_term(search_term);
  if (!normalized_term) {
    return {
      searchTerm: "",
      itemId: "",
      itemName: "",
      acronym: "",
      count: 0,
      results: [],
    };
  }

  let cache_key = normalized_term.toLowerCase();
  let cached = get_trade_history_cached_value(item_proofs_cache, cache_key);
  if (cached !== null) return cached;

  let response = await fetch(
    `${item_proofs_api_url}/${encodeURIComponent(normalized_term)}`,
    {
      method: "POST",
      headers: nte_api_headers({ "Content-Type": "application/json" }),
    },
  );

  let normalized = {
    searchTerm: normalized_term,
    itemId: "",
    itemName: "",
    acronym: "",
    count: 0,
    results: [],
  };

  if (response.status === 404) {
    return set_trade_history_cached_value(
      item_proofs_cache,
      cache_key,
      normalized,
      item_proofs_cache_ttl_ms,
      item_proofs_cache_max_entries,
    );
  }

  if (!response.ok) {
    throw new Error(`Proof search failed (${response.status}).`);
  }

  let data = await response.json().catch(() => null);
  if (!data || typeof data !== "object") {
    throw new Error("Proof search returned invalid data.");
  }

  let results = Array.isArray(data.results)
    ? data.results.map(normalize_item_proof_result)
    : [];
  results.sort(
    (a, b) =>
      (Number(b?.timestamp) || 0) - (Number(a?.timestamp) || 0) ||
      String(b?.id || "").localeCompare(String(a?.id || "")),
  );
  normalized = {
    searchTerm: String(data.search_term || normalized_term),
    itemId: normalize_trade_history_asset_id(data.item_id),
    itemName: normalize_item_proofs_search_term(data.item_name),
    acronym: normalize_item_proofs_search_term(data.acronym),
    count: Math.max(Number(data.count || 0), results.length),
    results: results.slice(0, item_proofs_max_results),
  };

  return set_trade_history_cached_value(
    item_proofs_cache,
    cache_key,
    normalized,
    item_proofs_cache_ttl_ms,
    item_proofs_cache_max_entries,
  );
}

async function get_item_proofs(message) {
  let item_name = normalize_item_proofs_search_term(message?.itemName);
  let asset_id = normalize_trade_history_asset_id(message?.assetId);
  let candidates = [];

  // Prefer asset id so Rolimons meta resolves to the canonical name + acronym.
  if (asset_id) candidates.push({ term: asset_id, mode: "asset" });
  if (item_name && item_name !== asset_id)
    candidates.push({ term: item_name, mode: "name" });
  if (!candidates.length) {
    return {
      success: false,
      error: "Missing item name or asset id.",
    };
  }

  let best_empty = null;
  let last_error = "";

  for (let candidate of candidates) {
    try {
      let data = await fetch_item_proofs_api(candidate.term);
      let response = {
        success: true,
        source: "nevos-extension",
        searchMode: candidate.mode,
        searchTerm: data.searchTerm || candidate.term,
        itemId: data.itemId || asset_id,
        itemName: data.itemName || item_name,
        acronym: data.acronym || "",
        count: Number(data.count || 0),
        results: Array.isArray(data.results) ? data.results : [],
      };
      if (response.results.length > 0) return response;
      if (!best_empty) best_empty = response;
      // Asset id already resolved to the same name/acronym tokens — don't
      // burn another search request for an identical empty result.
      if (
        candidate.mode === "asset" &&
        (data.itemName || data.acronym || data.itemId)
      )
        break;
    } catch (err) {
      last_error = err?.message || "Proofs could not be loaded right now.";
    }
  }

  return (
    best_empty || {
      success: false,
      error: last_error || "Proofs could not be loaded right now.",
    }
  );
}

async function fetch_item_proof_image_data(url) {
  let normalized_url = normalize_item_proof_image_url(url);
  if (!normalized_url) {
    throw new Error("Invalid proof image url.");
  }

  let cached = get_trade_history_cached_value(
    item_proof_image_cache,
    normalized_url,
  );
  if (cached !== null) return cached;

  let response = await fetch(normalized_url, {
    headers: nte_api_headers({
      Accept: "image/*,*/*;q=0.8",
    }),
  });

  if (!response.ok) {
    throw new Error(`Proof image failed (${response.status}).`);
  }

  let bytes = new Uint8Array(await response.arrayBuffer());
  let content_type = String(response.headers.get("content-type") || "").trim();
  if (!/^image\//i.test(content_type)) content_type = "image/jpeg";
  let data_url = `data:${content_type};base64,${base64_from_uint8(bytes)}`;
  return set_trade_history_cached_value(
    item_proof_image_cache,
    normalized_url,
    data_url,
    item_proof_image_cache_ttl_ms,
    item_proof_image_cache_max_entries,
  );
}

async function get_item_proof_images(message) {
  let attachments = Array.isArray(message?.attachments)
    ? message.attachments
        .map(normalize_item_proof_image_url)
        .filter(Boolean)
        .slice(0, item_proofs_max_attachments)
    : [];

  if (!attachments.length) {
    return {
      success: false,
      error: "Missing proof image urls.",
    };
  }

  let images = await Promise.all(
    attachments.map(async (source_url) => {
      try {
        return {
          sourceUrl: source_url,
          dataUrl: await fetch_item_proof_image_data(source_url),
        };
      } catch (err) {
        return {
          sourceUrl: source_url,
          dataUrl: "",
          error: err?.message || "Could not load proof image.",
        };
      }
    }),
  );

  return {
    success: true,
    images,
  };
}

function resolve_trade_history_item_asset_id(raw_item) {
  return normalize_trade_history_asset_id(
    raw_item?.assetId ??
      raw_item?.asset_id ??
      raw_item?.targetId ??
      raw_item?.itemTarget?.targetId ??
      raw_item?.asset?.id ??
      raw_item?.item?.id,
  );
}

function extract_trade_history_uaid_from_url(value) {
  let match = String(value || "").match(/\/uaid\/(\d+)(?:[/?#]|$)/i);
  return normalize_trade_history_uaid(match?.[1] || "");
}

async function resolve_trade_history_uaid_from_ciiid(ciiid) {
  let key = normalize_trade_history_ciiid(ciiid);
  if (!key) return "";

  let cached = get_trade_history_cached_value(trade_history_ciiid_cache, key);
  if (cached !== null) return cached;

  let url = `https://www.rolimons.com/ciiid/${encodeURIComponent(key)}`;
  let uaid = "";

  try {
    let response = await fetch(url, {
      ...ROLIMONS_HTML_FETCH_INIT,
      redirect: "manual",
    });
    uaid =
      extract_trade_history_uaid_from_url(
        response.headers.get("location") || "",
      ) || extract_trade_history_uaid_from_url(response.url || "");
  } catch {}

  if (!uaid) {
    try {
      let response = await fetch_rolimons_html(url);
      uaid =
        extract_trade_history_uaid_from_url(response.url || "") ||
        extract_trade_history_uaid_from_url(
          response.headers.get("location") || "",
        );
    } catch {}
  }

  return set_trade_history_cached_value(
    trade_history_ciiid_cache,
    key,
    uaid,
    trade_history_ciiid_cache_ttl_ms,
    trade_history_ciiid_cache_max_entries,
  );
}

function normalize_trade_history_items(raw_items) {
  let items = [];
  let seen = new Set();
  for (let item of Array.isArray(raw_items) ? raw_items : []) {
    let uaid =
      normalize_trade_history_uaid(item?.userAssetId) ||
      normalize_trade_history_uaid(item?.uaid) ||
      normalize_trade_history_uaid(item?.userAsset?.userAssetId) ||
      normalize_trade_history_uaid(item?.userAsset?.id);
    let ciiid = normalize_trade_history_ciiid(item?.ciiid);
    let asset_id = resolve_trade_history_item_asset_id(item);
    let dedupe_key = ciiid
      ? `ciiid:${ciiid}`
      : uaid
        ? `uaid:${uaid}`
        : `missing:${String(item?.name || "")}`;
    if (seen.has(dedupe_key)) continue;
    seen.add(dedupe_key);
    items.push({
      name: String(item?.name || "Unknown Item"),
      thumb: String(item?.thumb || ""),
      ciiid,
      uaid,
      assetId: asset_id,
    });
  }
  return items;
}

function merge_trade_history_items_by_asset(items) {
  let out = [];
  let by_key = new Map();

  for (let item of Array.isArray(items) ? items : []) {
    let asset_id = normalize_trade_history_asset_id(item?.assetId);
    let key =
      asset_id ||
      `missing:${String(item?.name || "")}|${String(item?.thumb || "")}`;
    let existing = by_key.get(key);
    if (existing) {
      existing.tradeItemCount += 1;
      if (!existing.assetId) existing.assetId = asset_id;
      if (!existing.uaid && item?.uaid)
        existing.uaid = normalize_trade_history_uaid(item.uaid);
      if (!existing.ciiid && item?.ciiid)
        existing.ciiid = normalize_trade_history_ciiid(item.ciiid);
      continue;
    }
    let next = {
      ...item,
      assetId: asset_id,
      tradeItemCount: 1,
    };
    by_key.set(key, next);
    out.push(next);
  }

  return out;
}

async function resolve_trade_history_items_uaids(items) {
  return Promise.all(
    (Array.isArray(items) ? items : []).map(async (item) => {
      if (item?.uaid) return item;
      if (!item?.ciiid) return item;
      let resolved_uaid = await resolve_trade_history_uaid_from_ciiid(
        item.ciiid,
      ).catch(() => "");
      return resolved_uaid ? { ...item, uaid: resolved_uaid } : item;
    }),
  );
}

function normalize_trade_history_trade_items(raw_items) {
  let items = [];
  for (let item of Array.isArray(raw_items) ? raw_items : []) {
    let asset_id = normalize_trade_history_asset_id(
      item?.asset_id ?? item?.assetId,
    );
    if (!asset_id) continue;
    items.push({
      assetId: asset_id,
      uaid: normalize_trade_history_uaid(item?.uaid),
      value: Math.max(0, parseInt(item?.value ?? 0, 10) || 0),
      rap: Math.max(0, parseInt(item?.rap ?? 0, 10) || 0),
    });
  }
  return items;
}

function get_trade_history_item_name(item_data, asset_id) {
  let row = get_rolimons_item(item_data, asset_id, "");
  return Array.isArray(row) && row[0] ? String(row[0]) : `Asset ${asset_id}`;
}

function is_usable_trade_history_thumb_url(url) {
  let image_url = String(url || "").trim();
  return (
    !!image_url && !/\/(BrokenImage|UnknownImage)\//i.test(image_url)
  );
}

function classify_trade_history_thumb_id(asset_id, item_data, face_map) {
  let key = String(asset_id || "").trim();
  let target =
    typeof RolimonsItemDetails !== "undefined" &&
    RolimonsItemDetails.resolve_roblox_catalog_target
      ? RolimonsItemDetails.resolve_roblox_catalog_target(
          item_data,
          key,
          face_map,
        )
      : null;
  if (target?.isBundle && target.id)
    return { original: key, fetchId: String(target.id), isBundle: true };
  if (item_data?.bundleIds?.[key])
    return { original: key, fetchId: key, isBundle: true };
  return { original: key, fetchId: key, isBundle: false };
}

async function fetch_trade_history_thumb_chunk(ids, is_bundle) {
  let out = {};
  let chunk = [
    ...new Set((ids || []).map(normalize_trade_history_asset_id).filter(Boolean)),
  ];
  if (!chunk.length) return out;
  try {
    let response = await fetch(
      is_bundle
        ? `https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${chunk.join(",")}&size=150x150&format=Png&isCircular=false`
        : `https://thumbnails.roblox.com/v1/assets?assetIds=${chunk.join(",")}&size=150x150&format=Png&isCircular=false`,
      {
        cache: "no-store",
        credentials: "omit",
      },
    );
    let payload = await parse_json_response_safe(
      response,
      is_bundle ? "Roblox bundle thumbnails" : "Roblox asset thumbnails",
    );
    for (let row of payload?.data || []) {
      let target_id = normalize_trade_history_asset_id(row?.targetId);
      let image_url = String(row?.imageUrl || "").trim();
      if (!target_id || !is_usable_trade_history_thumb_url(image_url)) continue;
      out[target_id] = image_url;
    }
  } catch {}
  return out;
}

async function fetch_trade_history_asset_thumbnails(asset_ids) {
  let out = {};
  let wanted = [
    ...new Set(
      (asset_ids || []).map(normalize_trade_history_asset_id).filter(Boolean),
    ),
  ];
  let missing = [];

  for (let asset_id of wanted) {
    let cached = get_trade_history_cached_value(
      trade_history_thumb_cache,
      asset_id,
    );
    if (is_usable_trade_history_thumb_url(cached)) out[asset_id] = cached;
    else missing.push(asset_id);
  }
  if (!missing.length) return out;

  let item_data = await get_cached_item_data(600000).catch(() => null);
  let face_map = await fetch_rolimons_player_face_map().catch(() => ({}));
  let classified = missing.map((id) =>
    classify_trade_history_thumb_id(id, item_data, face_map),
  );
  let fetch_to_originals = {};
  let asset_fetch_ids = [];
  let bundle_fetch_ids = [];
  for (let row of classified) {
    (row.isBundle ? bundle_fetch_ids : asset_fetch_ids).push(row.fetchId);
    if (!fetch_to_originals[row.fetchId]) fetch_to_originals[row.fetchId] = [];
    if (!fetch_to_originals[row.fetchId].includes(row.original))
      fetch_to_originals[row.fetchId].push(row.original);
  }

  function remember_thumb(original, image_url) {
    if (!original || !is_usable_trade_history_thumb_url(image_url)) return;
    if (out[original]) return;
    out[original] = image_url;
    set_trade_history_cached_value(
      trade_history_thumb_cache,
      original,
      image_url,
      trade_history_thumb_cache_ttl_ms,
      trade_history_thumb_cache_max_entries,
    );
  }

  async function apply_fetched(fetched) {
    for (let [fetch_id, image_url] of Object.entries(fetched || {})) {
      let originals = fetch_to_originals[fetch_id] || [fetch_id];
      for (let original of originals) remember_thumb(original, image_url);
    }
  }

  async function fetch_kind(ids, is_bundle) {
    let list = [
      ...new Set((ids || []).map(normalize_trade_history_asset_id).filter(Boolean)),
    ];
    for (let i = 0; i < list.length; i += 50) {
      await apply_fetched(
        await fetch_trade_history_thumb_chunk(list.slice(i, i + 50), is_bundle),
      );
    }
  }

  await Promise.all([
    fetch_kind(asset_fetch_ids, false),
    fetch_kind(bundle_fetch_ids, true),
  ]);

  let leftover = missing.filter(
    (id) => !is_usable_trade_history_thumb_url(out[id]),
  );
  if (leftover.length) {
    let retry_assets = [];
    let retry_bundles = [];
    for (let id of leftover) {
      let row = classified.find((entry) => entry.original === id);
      let fetch_id = row?.fetchId || id;
      if (!fetch_to_originals[id]) fetch_to_originals[id] = [];
      if (!fetch_to_originals[id].includes(id)) fetch_to_originals[id].push(id);
      if (row?.isBundle) retry_assets.push(id);
      else retry_bundles.push(fetch_id === id ? id : fetch_id);
      if (fetch_id !== id) {
        if (!fetch_to_originals[fetch_id]) fetch_to_originals[fetch_id] = [];
        if (!fetch_to_originals[fetch_id].includes(id))
          fetch_to_originals[fetch_id].push(id);
      }
    }
    await Promise.all([
      fetch_kind(retry_assets, false),
      fetch_kind(retry_bundles, true),
    ]);
  }

  return out;
}

function enrich_trade_history_trade_item(item, item_data, thumb_map) {
  let asset_id = normalize_trade_history_asset_id(item?.assetId);
  let value = Math.max(0, parseInt(item?.value ?? 0, 10) || 0);
  let rap = Math.max(0, parseInt(item?.rap ?? 0, 10) || 0);
  return {
    assetId: asset_id,
    uaid: normalize_trade_history_uaid(item?.uaid),
    name: get_trade_history_item_name(item_data, asset_id),
    thumb: String(thumb_map?.[asset_id] || ""),
    value,
    rap,
  };
}

function get_trade_history_trade_total(items) {
  let total = 0;
  for (let item of Array.isArray(items) ? items : []) {
    total += Math.max(0, Number(item?.value) || Number(item?.rap) || 0);
  }
  return total;
}

async function resolve_trade_history_trade_map(raw_trades) {
  let trades = {};
  let asset_ids = [];

  for (let [trade_id, trade] of Object.entries(raw_trades || {})) {
    let offer = normalize_trade_history_trade_items(trade?.offer);
    let request = normalize_trade_history_trade_items(trade?.request);
    trades[String(trade_id)] = {
      tradeId: Number(trade?.trade_id || trade_id) || 0,
      offer,
      request,
    };
    for (let item of offer) asset_ids.push(item.assetId);
    for (let item of request) asset_ids.push(item.assetId);
  }

  if (!Object.keys(trades).length) return {};

  let [item_data, thumb_map] = await Promise.all([
    get_cached_item_data(600000).catch(() => null),
    fetch_trade_history_asset_thumbnails(asset_ids).catch(() => ({})),
  ]);

  let out = {};
  for (let [trade_id, trade] of Object.entries(trades)) {
    let offer = trade.offer.map((item) =>
      enrich_trade_history_trade_item(item, item_data, thumb_map),
    );
    let request = trade.request.map((item) =>
      enrich_trade_history_trade_item(item, item_data, thumb_map),
    );
    out[trade_id] = {
      tradeId: trade.tradeId,
      offer,
      request,
      offerTotal: get_trade_history_trade_total(offer),
      requestTotal: get_trade_history_trade_total(request),
    };
  }

  return out;
}

async function fetch_trade_history_api(query, limit = 6) {
  let mode = query?.mode === "asset" ? "asset" : "uaid";
  let normalizer =
    mode === "asset"
      ? normalize_trade_history_asset_id
      : normalize_trade_history_uaid;
  let values =
    mode === "asset" ? (query?.assetIds ?? query?.asset_ids) : query?.uaids;
  let normalized_values = [
    ...new Set((values || []).map(normalizer).filter(Boolean)),
  ].slice(0, 8);
  if (!normalized_values.length)
    return { ok: true, items: [], generated_at: Date.now(), trades: {} };

  let safe_limit = Math.max(1, Math.min(20, Number(limit) || 6));
  let ciiid = mode === "asset" ? normalize_trade_history_ciiid(query?.ciiid || "") : "";
  let cache_key = `${mode}:${normalized_values.join(",")}|${safe_limit}${ciiid ? `|ciiid:${ciiid}` : ""}`;
  let cached = get_trade_history_cached_value(
    trade_history_api_cache,
    cache_key,
  );
  if (cached) return cached;

  let url = new URL(trade_history_api_url);
  url.searchParams.set(
    mode === "asset" ? "asset_ids" : "uaids",
    normalized_values.join(","),
  );
  url.searchParams.set("limit", String(safe_limit));
  if (ciiid) url.searchParams.set("ciiid", ciiid);

  let response = await fetch(url.toString(), {
    headers: nte_api_headers(),
    cache: "no-store",
    credentials: "omit",
  });
  let payload = await parse_json_response_safe(response, "NTE trade history");

  if (response.status === 429) {
    let retry_after = parse_trade_api_header_number(response, "retry-after");
    let wait_seconds =
      retry_after !== null ? Math.max(1, Math.ceil(retry_after)) : 60;
    throw new Error(
      `Trade history is rate limited right now. Try again in about ${wait_seconds}s.`,
    );
  }
  if (!response.ok || !payload?.ok) {
    throw new Error(
      payload?.error || `Trade history API returned ${response.status}.`,
    );
  }

  return set_trade_history_cached_value(
    trade_history_api_cache,
    cache_key,
    payload,
    trade_history_cache_ttl_ms,
    trade_history_cache_max_entries,
  );
}

function normalize_trade_analysis_item_ids(raw_items) {
  return (Array.isArray(raw_items) ? raw_items : [])
    .map(
      (item) =>
        parseInt(item?.asset_id ?? item?.assetId ?? item?.id ?? item, 10) || 0,
    )
    .filter((id) => id > 0)
    .slice(0, 4);
}

function normalize_trade_analysis_robux(value) {
  let parsed = parseInt(value, 10) || 0;
  return Math.max(0, Math.min(1000000000, parsed));
}

function normalize_trade_analysis_direction(value) {
  let direction = String(value || "").toLowerCase();
  return ["inbound", "outbound"].includes(direction) ? direction : "";
}

async function evaluate_trade_analysis(message) {
  let direction = normalize_trade_analysis_direction(message?.direction);
  let body = {
    give_item_ids: normalize_trade_analysis_item_ids(message?.give_item_ids),
    receive_item_ids: normalize_trade_analysis_item_ids(
      message?.receive_item_ids,
    ),
    give_robux: normalize_trade_analysis_robux(message?.give_robux),
    receive_robux: normalize_trade_analysis_robux(message?.receive_robux),
    engine: "v4",
  };
  if (direction) body.direction = direction;
  if (!body.give_item_ids.length && body.give_robux <= 0)
    throw new Error("Could not read what you give from this trade.");
  if (!body.receive_item_ids.length && body.receive_robux <= 0)
    throw new Error("Could not read what you receive from this trade.");

  let response = await fetch(trade_analysis_api_url, {
    method: "POST",
    headers: nte_api_headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "omit",
  });
  let text = await response.text().catch(() => "");
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {}

  if (response.status === 429) {
    let retry_after = parse_trade_api_header_number(response, "retry-after");
    let wait_seconds =
      retry_after !== null ? Math.max(1, Math.ceil(retry_after)) : 60;
    throw new Error(
      `Trade analysis is rate limited right now. Try again in about ${wait_seconds}s.`,
    );
  }
  if (!response.ok || !payload?.ok) {
    let api_error = String(payload?.error || "").trim();
    if (
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504 ||
      /unavailable|returned an error|returned \d+/i.test(api_error)
    ) {
      throw new Error(
        "Trade analysis is down for a bit and will be back soon.",
      );
    }
    throw new Error(
      api_error || "Trade analysis is down for a bit and will be back soon.",
    );
  }

  return { success: true, ...payload };
}

function get_cached_trade_history_user(user_id) {
  let key = String(user_id || "");
  return key
    ? get_trade_history_cached_value(trade_history_user_cache, key)
    : null;
}

function set_cached_trade_history_user(user) {
  let id = String(user?.id || "");
  if (!id) return;
  set_trade_history_cached_value(
    trade_history_user_cache,
    id,
    user,
    trade_history_user_cache_ttl_ms,
    trade_history_user_cache_max_entries,
  );
}

async function resolve_trade_history_users(user_ids) {
  let out = {};
  let missing = [];

  for (let id of [
    ...new Set(
      (user_ids || []).map((x) => String(x || "").trim()).filter(Boolean),
    ),
  ]) {
    let numeric_id = Number(id);
    if (!(numeric_id > 0)) continue;
    let cached = get_cached_trade_history_user(id);
    if (cached) {
      out[id] = cached;
    } else {
      missing.push(numeric_id);
    }
  }

  if (missing.length) {
    let response = await fetch("https://users.roblox.com/v1/users", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userIds: missing,
        excludeBannedUsers: false,
      }),
      credentials: "omit",
    });
    let payload = await parse_json_response_safe(response, "Roblox user batch");
    for (let row of payload?.data || []) {
      let user = {
        id: String(row?.id || ""),
        name: String(row?.name || ""),
        display_name: String(row?.displayName || row?.name || ""),
      };
      if (!user.id) continue;
      set_cached_trade_history_user(user);
      out[user.id] = user;
    }
  }

  return out;
}

function get_trade_history_display_name(user_map, user_id, fallback_name = "") {
  let named = String(fallback_name || "").trim();
  if (named) return named;
  let key = String(user_id || "").trim();
  if (!key) return "";
  let user = user_map?.[key];
  return String(user?.name || user?.display_name || "").trim() || (/^\d+$/.test(key) ? `User ${key}` : key);
}

async function get_trade_history(message) {
  let scope = message?.scope === "asset" ? "asset" : "uaid";
  let items = normalize_trade_history_items(message?.offerItems);
  if (!items.length) {
    throw new Error("Could not read the trade items for this row.");
  }

  if (scope === "asset") {
    items = merge_trade_history_items_by_asset(items);
  } else {
    items = await resolve_trade_history_items_uaids(items);
  }

  // Recent item history now comes from Void itemtrades (asset-level).
  let asset_ids = [
    ...new Set(items.map((item) => item.assetId).filter(Boolean)),
  ];
  let ciiid = normalize_trade_history_ciiid(message?.ciiid || "");
  if (scope === "uaid" && !ciiid) {
    ciiid = [...new Set(items.map((item) => item.ciiid).filter(Boolean))]
      .join(",")
      .toLowerCase();
  }
  let payload = asset_ids.length
    ? await fetch_trade_history_api(
        { mode: "asset", asset_ids, ciiid },
        message?.limit || 6,
      )
    : { ok: true, items: [], trades: {} };
  let by_asset = {};

  for (let item of payload?.items || []) {
    let asset_id = normalize_trade_history_asset_id(
      item?.asset_id ?? item?.assetId,
    );
    if (!asset_id) continue;
    by_asset[asset_id] = item;
  }

  let user_ids = [];
  for (let item of payload?.items || []) {
    for (let entry of item?.history || []) {
      user_ids.push(
        entry?.offerer_id,
        entry?.requester_id,
        entry?.owner_before_id,
        entry?.owner_after_id,
      );
    }
  }

  let user_map = await resolve_trade_history_users(user_ids).catch(() => ({}));
  let trade_map = await resolve_trade_history_trade_map(
    payload?.trades || {},
  ).catch(() => ({}));

  function map_history_rows(history_item) {
    let history_rows = Array.isArray(history_item?.history)
      ? history_item.history
      : [];
    return history_rows.map((entry) => {
      let offerer_name = String(
        entry?.offerer_name || entry?.offererName || "",
      ).trim();
      let requester_name = String(
        entry?.requester_name || entry?.requesterName || "",
      ).trim();
      let owner_before_name = String(
        entry?.owner_before_name || entry?.ownerBeforeName || "",
      ).trim();
      let owner_after_name = String(
        entry?.owner_after_name || entry?.ownerAfterName || "",
      ).trim();
      let offerer_id = String(entry?.offerer_id || entry?.offererId || "").trim();
      let requester_id = String(
        entry?.requester_id || entry?.requesterId || "",
      ).trim();
      let owner_before_id = String(
        entry?.owner_before_id || entry?.ownerBeforeId || "",
      ).trim();
      let owner_after_id = String(
        entry?.owner_after_id || entry?.ownerAfterId || "",
      ).trim();
      let offerer_label = get_trade_history_display_name(
        user_map,
        offerer_id,
        offerer_name,
      );
      let requester_label = get_trade_history_display_name(
        user_map,
        requester_id,
        requester_name,
      );
      let owner_before_label = get_trade_history_display_name(
        user_map,
        owner_before_id,
        owner_before_name || offerer_name,
      );
      let owner_after_label = get_trade_history_display_name(
        user_map,
        owner_after_id,
        owner_after_name || requester_name,
      );
      return {
        tradeId: Number(entry?.trade_id || 0),
        timestamp: Number(entry?.timestamp || 0),
        side: String(entry?.side || ""),
        kind: String(entry?.kind || ""),
        // Void only returns usernames (no Roblox ids). Keep numeric ids when
        // present; otherwise stash the username so older UI still has a label.
        offererId: offerer_id || offerer_label,
        requesterId: requester_id || requester_label,
        ownerBeforeId: owner_before_id || owner_before_label,
        ownerAfterId: owner_after_id || owner_after_label,
        copyCount: Math.max(1, Number(entry?.copy_count || 0)),
        offererName: offerer_label || "Unknown",
        requesterName: requester_label || "Unknown",
        ownerBeforeName: owner_before_label || "Unknown",
        ownerAfterName: owner_after_label || "Unknown",
        trade: trade_map[String(entry?.trade_id || "")] || null,
      };
    });
  }

  return {
    success: true,
    scope,
    generatedAt: Number(payload?.generated_at) || Date.now(),
    source: String(payload?.source || ""),
    items: items.map((item) => {
      let history_item = item.assetId ? by_asset[item.assetId] : null;
      return {
        name: item.name,
        thumb: item.thumb,
        ciiid: item.ciiid,
        uaid: item.uaid,
        assetId: item.assetId,
        tradeItemCount: Number(item.tradeItemCount || 1),
        missingAssetId: !item.assetId,
        missingUaid: scope !== "asset" && !item.uaid,
        known: scope !== "asset" ? !!item.uaid : undefined,
        tradeCount: Number(history_item?.trade_count || 0),
        history: map_history_rows(history_item),
      };
    }),
  };
}

async function send_test_webhook_notification(webhook_override = null) {
  let settings = webhook_override || (await get_inbound_trade_webhook_settings());
  if (!settings?.webhook_url) {
    return {
      ok: false,
      error: "No webhook URL configured. Enter your Discord webhook URL first.",
    };
  }

  let my_user_id = 0;
  let my_name = "You";
  try {
    let user = await get_authenticated_user_cached();
    my_user_id = Number(user?.id) || 0;
    my_name = String(user?.name || "You").trim() || "You";
  } catch {}

  let demo_detail = {
    id: 999999,
    user: {
      id: 12345,
      name: "TestUser",
      displayName: "Test User",
    },
    status: "Open",
    tradeType: "inbound",
    offers: [
      {
        user: {
          id: my_user_id,
          name: my_name,
          displayName: my_name,
        },
        robux: 10000,
        userAssets: [
          {
            assetId: 250394771,
            name: "Green Sidewinder",
            itemType: "Asset",
            recentAveragePrice: 2333,
          },
          {
            assetId: 250394771,
            name: "Green Sidewinder",
            itemType: "Asset",
            recentAveragePrice: 2333,
          },
          {
            assetId: 250394771,
            name: "Green Sidewinder",
            itemType: "Asset",
            recentAveragePrice: 2333,
          },
        ],
      },
      {
        user: {
          id: 12345,
          name: "TestUser",
          displayName: "Test User",
        },
        robux: 10000,
        userAssets: [
          {
            assetId: 250394771,
            name: "Green Sidewinder",
            itemType: "Asset",
            recentAveragePrice: 2333,
            serialNumber: 42,
          },
          {
            assetId: 250394771,
            name: "Green Sidewinder",
            itemType: "Asset",
            recentAveragePrice: 2333,
            serialNumber: 187,
          },
          {
            assetId: 250394771,
            name: "Green Sidewinder",
            itemType: "Asset",
            recentAveragePrice: 2333,
          },
        ],
      },
    ],
  };

  let trade = {
    id: demo_detail.id,
    user: demo_detail.user,
    status: demo_detail.status,
    created: Date.now(),
  };

  try {
    demo_detail = await get_priced_cached_trade(demo_detail);
  } catch {}

  let trade_stats = null;
  try {
    trade_stats = await get_trade_notification_value_stats(
      demo_detail,
      my_user_id,
    );
  } catch {}

  try {
    await send_inbound_trade_webhook_notification(
      trade,
      demo_detail,
      trade_stats,
      my_user_id,
      settings,
    );
  } catch (error) {
    return {
      ok: false,
      error: `Send failed: ${error?.message || String(error)}`,
    };
  }

  return { ok: true };
}

let rolimons_player_info_cache = new Map();
let rolimons_player_info_inflight = new Map();
const rolimons_player_info_ttl_ms = 15 * 60 * 1000;
const rolimons_player_info_cache_max = 200;

function prune_rolimons_player_info_cache() {
  if (rolimons_player_info_cache.size <= rolimons_player_info_cache_max) return;
  let drop = rolimons_player_info_cache.size - rolimons_player_info_cache_max;
  for (let key of rolimons_player_info_cache.keys()) {
    rolimons_player_info_cache.delete(key);
    drop -= 1;
    if (drop <= 0) break;
  }
}

async function fetch_rolimons_player_info(user_id) {
  let id = String(user_id || "").trim();
  if (!/^\d+$/.test(id)) return { ok: false, error: "bad_id" };

  let cached = rolimons_player_info_cache.get(id);
  if (cached && Date.now() - cached.at < rolimons_player_info_ttl_ms) {
    return { ok: true, ...cached };
  }
  if (rolimons_player_info_inflight.has(id)) {
    return rolimons_player_info_inflight.get(id);
  }

  let job = (async () => {
    try {
      let res = await fetch(`https://www.rolimons.com/player/${id}`, {
        cache: "no-store",
        credentials: "omit",
        headers: {
          "From-Extension": true,
          Accept: "text/html",
        },
      });
      if (!res.ok) return { ok: false, error: `http_${res.status}` };
      let html = await res.text();
      let m = html.match(
        /"num_points":\d+,"nominal_scan_time":\[[\d,]+\],"value":\[([\d,]+)\],"rap":\[([\d,]+)\]/,
      );
      if (!m) return { ok: false, error: "bad_payload" };
      let values = m[1].split(",");
      let raps = m[2].split(",");
      let value = Number(values[values.length - 1]) || 0;
      let rap = Number(raps[raps.length - 1]) || 0;
      let name_m = html.match(/"player_name":"([^"]*)"/);
      let name = name_m ? name_m[1] : "";
      let terminated = /terminated/i.test(html.slice(0, 8000));
      let rec = {
        ok: true,
        value,
        rap,
        rank: 0,
        privacy_enabled: false,
        terminated,
        premium: false,
        name,
        data: {
          success: true,
          value,
          rap,
          name,
          terminated,
          privacy_enabled: false,
        },
        at: Date.now(),
      };
      rolimons_player_info_cache.set(id, rec);
      prune_rolimons_player_info_cache();
      return rec;
    } catch {
      return { ok: false, error: "exception" };
    } finally {
      rolimons_player_info_inflight.delete(id);
    }
  })();

  rolimons_player_info_inflight.set(id, job);
  return job;
}

let roblox_friends_cache = null;
let roblox_friends_cache_at = 0;
let roblox_friends_inflight = null;
const roblox_friends_ttl_ms = 30 * 60 * 1000;

async function hydrate_roblox_friend_names(friends) {
  let list = Array.isArray(friends) ? friends.slice() : [];
  let need = list.filter((row) => row.userId > 0 && !String(row.name || "").trim());
  if (!need.length) {
    return list.filter((row) => row.userId > 0 && String(row.name || "").trim());
  }

  let by_id = new Map(list.map((row) => [row.userId, { ...row, isFriend: true }]));
  for (let i = 0; i < need.length; i += 100) {
    let ids = need.slice(i, i + 100).map((row) => row.userId);
    let filled = false;
    try {
      let res = await fetch(
        "https://apis.roblox.com/user-profile-api/v1/user/profiles/get-profiles",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            userIds: ids,
            fields: ["names.username", "names.displayName"],
          }),
        },
      );
      if (res.ok) {
        let json = await res.json().catch(() => null);
        for (let profile of json?.profileDetails || []) {
          let id = Number(profile.userId) || 0;
          let prev = by_id.get(id);
          if (!prev) continue;
          let name = String(profile.names?.username || "");
          if (!name) continue;
          by_id.set(id, {
            ...prev,
            name,
            displayName: String(profile.names?.displayName || name),
            isFriend: true,
          });
          filled = true;
        }
      }
    } catch {}

    if (filled) continue;

    try {
      let res = await fetch("https://users.roblox.com/v1/users", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          userIds: ids,
          excludeBannedUsers: false,
        }),
      });
      if (!res.ok) continue;
      let json = await res.json().catch(() => null);
      for (let row of json?.data || []) {
        let id = Number(row.id) || 0;
        let prev = by_id.get(id);
        if (!prev) continue;
        let name = String(row.name || "");
        if (!name) continue;
        by_id.set(id, {
          ...prev,
          name,
          displayName: String(row.displayName || name),
          isFriend: true,
        });
      }
    } catch {}
  }

  return [...by_id.values()].filter(
    (row) => row.userId > 0 && String(row.name || "").trim(),
  );
}

async function fetch_roblox_friends_list() {
  if (
    roblox_friends_cache?.length &&
    roblox_friends_cache.every((row) => row.userId > 0 && String(row.name || "").trim()) &&
    Date.now() - roblox_friends_cache_at < roblox_friends_ttl_ms
  ) {
    return { ok: true, friends: roblox_friends_cache };
  }
  if (roblox_friends_inflight) return roblox_friends_inflight;

  roblox_friends_inflight = (async () => {
    try {
      let me = await fetch("https://users.roblox.com/v1/users/authenticated", {
        credentials: "include",
        cache: "no-store",
      });
      if (!me.ok) return { ok: false, friends: [], error: `me_${me.status}` };
      let me_json = await me.json().catch(() => null);
      let my_id = Number(me_json?.id) || 0;
      if (!my_id) return { ok: false, friends: [], error: "no_user" };

      let res = await fetch(
        `https://friends.roblox.com/v1/users/${my_id}/friends`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) {
        return { ok: false, friends: [], error: `friends_${res.status}` };
      }
      let json = await res.json().catch(() => null);
      let friends = await hydrate_roblox_friend_names(
        (Array.isArray(json?.data) ? json.data : [])
          .map((row) => ({
            userId: Number(row.id) || 0,
            name: String(row.name || ""),
            displayName: String(row.displayName || row.name || ""),
            isFriend: true,
          }))
          .filter((row) => row.userId > 0),
      );
      roblox_friends_cache = friends;
      roblox_friends_cache_at = Date.now();
      return { ok: true, friends };
    } catch {
      return { ok: false, friends: [], error: "exception" };
    } finally {
      roblox_friends_inflight = null;
    }
  })();

  return roblox_friends_inflight;
}

async function fetch_rolimons_player_tradable(user_id) {
  let id = String(user_id || "").trim();
  if (!/^\d+$/.test(id)) {
    return { ok: false, complete: false, items: [], error: "invalid_user" };
  }
  let items = [];
  let cursor = "";
  let limit = "100";
  for (let page = 0; page < 100; page++) {
    let params = new URLSearchParams({
      sortBy: "CreationTime",
      limit,
      sortOrder: "Desc",
    });
    if (cursor) params.set("cursor", cursor);
    let url = `https://trades.roblox.com/v2/users/${id}/tradableitems?${params.toString()}`;
    let res = await nte_fetch_inventory_with_retries(
      url,
      { credentials: "include" },
      {
        source: "rolimons_player_tradable",
        silent: true,
        maxAttempts: NTE_INVENTORY_RATE_LIMIT_ATTEMPTS,
      },
    );
    if (!res) {
      return {
        ok: false,
        complete: false,
        items,
        error: "network",
        page,
      };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        complete: false,
        items,
        error: "auth",
        status: res.status,
      };
    }
    if (res.status === 500 && limit === "100") {
      limit = "50";
      page -= 1;
      continue;
    }
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      return {
        ok: false,
        complete: false,
        items,
        error: "rate_limited",
        status: res.status,
        page,
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        complete: false,
        items,
        error: "http",
        status: res.status,
        page,
      };
    }
    let data = await res.json().catch(() => null);
    if (!data) {
      return {
        ok: false,
        complete: false,
        items,
        error: "parse",
        page,
      };
    }
    items = items.concat(Array.isArray(data.items) ? data.items : []);
    cursor = data.nextPageCursor || "";
    if (!cursor) {
      return { ok: true, complete: true, items };
    }
  }
  // Hit page safety cap with a cursor still pending — treat as incomplete.
  return {
    ok: false,
    complete: false,
    items,
    error: "truncated",
  };
}

let rolimons_player_face_map_cache = null;
let rolimons_player_face_map_at = 0;

async function fetch_rolimons_player_face_map() {
  let now = Date.now();
  if (
    rolimons_player_face_map_cache &&
    now - rolimons_player_face_map_at < 30 * 60 * 1000
  ) {
    return rolimons_player_face_map_cache;
  }
  let res = await fetch(
    "https://api.rolimons.com/items/v1/faceassetbundlemap",
    { cache: "no-store" },
  );
  if (!res.ok) return rolimons_player_face_map_cache || {};
  let data = await res.json().catch(() => null);
  let map =
    data?.face_asset_bundle_map && typeof data.face_asset_bundle_map === "object"
      ? data.face_asset_bundle_map
      : {};
  rolimons_player_face_map_cache = map;
  rolimons_player_face_map_at = now;
  return map;
}

async function fetch_rolimons_player_thumbs(ids, is_bundles) {
  let list = [
    ...new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => String(id || "").trim())
        .filter((id) => /^\d+$/.test(id)),
    ),
  ];
  let out = {};
  if (!list.length) return out;
  for (let i = 0; i < list.length; i += 100) {
    let chunk = list.slice(i, i + 100);
    let url = is_bundles
      ? `https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${chunk.join(",")}&size=150x150&format=Png&isCircular=false`
      : `https://thumbnails.roblox.com/v1/assets?assetIds=${chunk.join(",")}&size=150x150&format=Png&isCircular=false`;
    let res = await fetch(url).catch(() => null);
    if (!res?.ok) continue;
    let data = await res.json().catch(() => ({}));
    for (let row of data.data || []) {
      let tid = String(row?.targetId || "");
      let image_url = String(row?.imageUrl || "").trim();
      if (tid && image_url) out[tid] = image_url;
    }
  }
  return out;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (typeof trade_ad_notif_handle_message === "function") {
    let handled = trade_ad_notif_handle_message(message, respond);
    if (handled) return handled;
  }
  if (typeof mass_send_handle_message === "function") {
    let handled = mass_send_handle_message(message, respond);
    if (handled) return handled;
  }

  if (message === "getTradeListData") {
    (async () => respond(await get_pruned_cached_trades()))();
    return true;
  }

  if (message?.type === "getCachedTrade") {
    (async () => {
      let id = String(message.tradeId || "").trim();
      if (!id) return respond(null);
      let cached = await get_pruned_cached_trades();
      let trade = cached[id] || null;
      respond(trade ? await get_priced_cached_trade(trade) : null);
    })();
    return true;
  }

  if (message?.type === "quickProofFetchImage") {
    (async () => {
      try {
        let url = String(message.url || "");
        let ext_base = chrome.runtime.getURL("");
        if (
          !url.startsWith(ext_base) &&
          !/^https:\/\/(tr\.rbxcdn\.com|[^/]+\.rbxcdn\.com|[^/]+\.roblox\.com)\//i.test(
            url,
          )
        )
          return respond({ ok: false });
        let response = await fetch(url, { credentials: "omit" });
        if (!response.ok) return respond({ ok: false });
        let blob = await response.blob();
        try {
          if (
            typeof createImageBitmap === "function" &&
            typeof OffscreenCanvas !== "undefined" &&
            /^image\//i.test(blob.type || "")
          ) {
            let image = await createImageBitmap(blob),
              canvas = new OffscreenCanvas(
                Math.max(1, image.width),
                Math.max(1, image.height),
              ),
              ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0);
            image.close?.();
            blob = await canvas.convertToBlob({ type: "image/png" });
          }
        } catch {}
        let content_type =
          blob.type || response.headers.get("content-type") || "image/png";
        let bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192)
          binary += String.fromCharCode(...bytes.slice(i, i + 8192));
        respond({
          ok: true,
          dataUrl: `data:${content_type};base64,${btoa(binary)}`,
        });
      } catch {
        respond({ ok: false });
      }
    })();
    return true;
  }

  if (message?.type === "quickProofCaptureTab") {
    (async () => {
      try {
        let window_id = sender?.tab?.windowId;
        let tab_id = sender?.tab?.id;
        if (
          (!chrome.tabs?.captureVisibleTab &&
            !globalThis.browser?.tabs?.captureTab) ||
          window_id === undefined
        )
          return respond({ ok: false, error: "Screenshot API unavailable." });
        let capture_tab = () =>
          new Promise((resolve) => {
            let sent = false;
            let timer = setTimeout(
              () => done("", "Screenshot request timed out."),
              10000,
            );
            let done = (dataUrl, error_message = "") => {
              if (sent) return;
              sent = true;
              clearTimeout(timer);
              let err = chrome.runtime.lastError;
              if (err || !dataUrl)
                return resolve({
                  ok: false,
                  error:
                    error_message ||
                    err?.message ||
                    "Could not capture the current tab.",
                });
              resolve({ ok: true, dataUrl });
            };
            try {
              let capture =
                globalThis.browser?.tabs?.captureTab && tab_id !== undefined
                  ? globalThis.browser.tabs.captureTab(tab_id, {
                      format: "png",
                    })
                  : chrome.tabs.captureVisibleTab(
                      window_id,
                      { format: "png" },
                      done,
                    );
              if (capture?.then)
                capture
                  .then(done)
                  .catch((err) =>
                    done(
                      "",
                      err?.message || "Could not capture the current tab.",
                    ),
                  );
            } catch (err) {
              done("", err?.message || "Could not capture the current tab.");
            }
          });
        let has_host_access = await check_host_permissions();
        if (!has_host_access)
          has_host_access = await request_host_permissions();
        let captured = await capture_tab();
        if (captured?.ok) return respond(captured);
        if (is_quick_proof_capture_permission_error(captured?.error)) {
          if (await open_first_roblox_popup(sender)) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            captured = await capture_tab();
            if (captured?.ok) return respond(captured);
          }
          return respond({
            ok: false,
            error: quick_proof_capture_permission_message,
          });
        }
        if (!has_host_access)
          return respond({
            ok: false,
            error: "Grant Roblox site access for Quick Proof, then try again.",
          });
        await request_host_permissions();
        captured = await capture_tab();
        if (
          !captured?.ok &&
          is_quick_proof_capture_permission_error(captured?.error)
        ) {
          if (await open_first_roblox_popup(sender)) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            captured = await capture_tab();
            if (captured?.ok) return respond(captured);
          }
          return respond({
            ok: false,
            error: quick_proof_capture_permission_message,
          });
        }
        respond(captured);
      } catch (err) {
        respond({
          ok: false,
          error: err?.message || "Could not capture the current tab.",
        });
      }
    })();
    return true;
  }

  if (message === "getData" || message === "getDataPeriodic") {
    let max_age = message === "getDataPeriodic" ? 300000 : 59000;
    get_ui_item_data(max_age)
      .then((data) => respond(data))
      .catch(() => respond(null));
    return true;
  }

  if (
    message === "getRoutilityData" ||
    message === "getRoutilityDataPeriodic"
  ) {
    if (typeof nte_is_lite === "function" && nte_is_lite()) {
      respond(null);
      return true;
    }
    chrome.storage.local.get(
      [routility_data_key, routility_data_time_key],
      async (result) => {
        let max_age = message === "getRoutilityDataPeriodic" ? 300000 : 59000;
        if (
          result[routility_data_key] !== undefined &&
          Date.now() - result[routility_data_time_key] < max_age
        ) {
          respond(result[routility_data_key]);
          return;
        }
        await set_local_value(routility_data_time_key, Date.now());
        let data = await fetch_routility_data();
        if (data !== null) {
          chrome.storage.local.set({ [routility_data_key]: data }, () =>
            respond(data),
          );
        } else {
          respond(result[routility_data_key] ?? null);
        }
      },
    );
    return true;
  }

  if (message?.title === "getUserProfileData") {
    (async () => {
      try {
        let info = await fetch_rolimons_player_info(message.userId);
        respond(info?.ok ? info.data : {});
      } catch {
        respond({});
      }
    })();
    return true;
  }

  if (message?.type === "cacheTrade") {
    (async () => {
      let id = String(message.tradeId);
      let trade = message.trade;
      if (!id || !trade) return respond({ ok: false });
      let cached = await get_pruned_cached_trades();
      let ok = cache_trade_detail(cached, id, trade);
      if (ok) await save_cached_trades(cached);
      respond({ ok });
    })();
    return true;
  }

  if (message?.type === "prefetchTrades") {
    (async () => {
      let ids = message.tradeIds;
      let trade_type = message.tradeType;
      let status_map = message.statusMap || {};
      if (!Array.isArray(ids) || !ids.length)
        return respond({ ok: true, fetched: 0 });
      let cached = await get_pruned_cached_trades();
      let missing = ids.map(String).filter((id) => !(id in cached));
      if (!missing.length) return respond({ ok: true, fetched: 0 });
      let fetched = 0;
      let dirty = false;
      for (let id of missing) {
        try {
          let resp = await fetch_trade_api(
            `https://trades.roblox.com/v2/trades/${id}`,
            { credentials: "include" },
          );
          if (200 === resp.status) {
            let trade = await resp.json();
            if (status_map[id]) trade.status = status_map[id];
            if (trade_type) trade.tradeType = trade_type;
            if (cache_trade_detail(cached, id, trade)) {
              dirty = true;
              fetched++;
            }
          } else if (429 === resp.status) {
            await new Promise((r) => setTimeout(r, 15000));
            continue;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (dirty) await save_cached_trades(cached);
      respond({ ok: true, fetched });
    })();
    return true;
  }

  if (message?.type === "getTradeHistory") {
    if (typeof nte_is_lite === "function" && nte_is_lite()) {
      respond({
        success: false,
        error: "Trade history is not available in LITE.",
      });
      return true;
    }
    (async () => {
      try {
        respond(await get_trade_history(message));
      } catch (err) {
        respond({
          success: false,
          error: err?.message || "Trade history could not be loaded right now.",
        });
      }
    })();
    return true;
  }

  if (message?.type === "analyzeTrade") {
    if (typeof nte_is_lite === "function" && nte_is_lite()) {
      respond({
        success: false,
        error: "Trade analysis is not available in LITE.",
      });
      return true;
    }
    (async () => {
      try {
        respond(await evaluate_trade_analysis(message));
      } catch (err) {
        respond({
          success: false,
          error:
            err?.message || "Trade analysis could not be loaded right now.",
        });
      }
    })();
    return true;
  }

  if (message?.type === "getItemProofs") {
    if (typeof nte_is_lite === "function" && nte_is_lite()) {
      respond({
        success: false,
        error: "Item proofs are not available in LITE.",
      });
      return true;
    }
    (async () => {
      try {
        respond(await get_item_proofs(message));
      } catch (err) {
        respond({
          success: false,
          error: err?.message || "Proofs could not be loaded right now.",
        });
      }
    })();
    return true;
  }

  if (message?.type === "getItemProofImages") {
    if (typeof nte_is_lite === "function" && nte_is_lite()) {
      respond({
        success: false,
        error: "Item proofs are not available in LITE.",
      });
      return true;
    }
    (async () => {
      try {
        respond(await get_item_proof_images(message));
      } catch (err) {
        respond({
          success: false,
          error: err?.message || "Proof images could not be loaded right now.",
        });
      }
    })();
    return true;
  }

  if (message?.type === "ta_start") {
    ta_run_action(
      message.action,
      message.min_overpay_pct || 0,
      message.max_trade_age_ms || 0,
    );
    respond({ ok: true });
    return false;
  }

  if (message?.type === "ta_progress") {
    respond({ ...ta_state });
    return false;
  }

  if (message?.type === "ta_stop") {
    ta_stop_now();
    respond({ ok: true });
    return false;
  }

  if (message?.type === "check_host_permissions") {
    check_host_permissions().then((granted) => respond({ granted }));
    return true;
  }

  if (message?.type === "request_host_permissions") {
    request_host_permissions().then((granted) => respond({ granted }));
    return true;
  }

  if (message?.type === "mark_self_declined_trade") {
    mark_self_declined_trade(message.trade_id || message.tradeId).then(() =>
      respond({ ok: true }),
    );
    return true;
  }

  if (message?.type === "open_extension_settings") {
    (async () => {
      try {
        if (chrome.runtime?.openOptionsPage) {
          await chrome.runtime.openOptionsPage();
          respond({ ok: true });
          return;
        }
      } catch (err) {
        respond({
          ok: false,
          error: err?.message || "Could not open extension settings.",
        });
        return;
      }
      respond({ ok: false, error: "openOptionsPage unavailable." });
    })();
    return true;
  }

  if (message?.type === "open_first_roblox_popup") {
    open_first_roblox_popup(sender).then((ok) => respond({ ok }));
    return true;
  }

  if (message?.type === "trade_row_prepare_decline") {
    trade_row_get_csrf().then((csrf) => respond({ ok: !!csrf }));
    return true;
  }

  if (message?.type === "trade_row_decline") {
    trade_row_decline_trade(message.trade_id || message.tradeId).then(
      (result) => respond(result),
    );
    return true;
  }

  if (message?.type === "send_test_webhook") {
    if (typeof nte_is_lite === "function" && nte_is_lite()) {
      respond({ ok: false, error: "Discord webhooks are not available in LITE." });
      return true;
    }
    (async () => {
      try {
        let override = null;
        let webhook_url = normalize_inbound_trade_notification_webhook_url(
          message.webhook_url,
        );
        if (webhook_url) {
          override = {
            webhook_url,
            ping_enabled: !!message.ping_enabled,
            discord_id: normalize_inbound_trade_notification_discord_id(
              message.discord_id,
            ),
          };
        }
        respond(await send_test_webhook_notification(override));
      } catch (error) {
        respond({
          ok: false,
          error: error?.message || String(error),
        });
      }
    })();
    return true;
  }

  if (message?.type === "rolimons_player_info") {
    (async () => {
      try {
        respond(await fetch_rolimons_player_info(message.user_id));
      } catch (error) {
        respond({
          ok: false,
          error: error?.message || String(error),
        });
      }
    })();
    return true;
  }

  if (message?.type === "roblox_friends_list") {
    (async () => {
      try {
        respond(await fetch_roblox_friends_list());
      } catch (error) {
        respond({
          ok: false,
          friends: [],
          error: error?.message || String(error),
        });
      }
    })();
    return true;
  }

  if (message?.type === "rolimons_player_auth_user") {
    (async () => {
      try {
        let user = await get_authenticated_user_cached();
        respond({ ok: true, id: user?.id ? String(user.id) : "" });
      } catch {
        respond({ ok: false, id: "" });
      }
    })();
    return true;
  }

  if (message?.type === "rolimons_player_tradable") {
    (async () => {
      try {
        let result = await fetch_rolimons_player_tradable(message.user_id);
        respond({
          ok: !!result?.ok,
          complete: !!result?.complete,
          items: Array.isArray(result?.items) ? result.items : [],
          error: result?.error || null,
          status: result?.status || null,
        });
      } catch (error) {
        respond({
          ok: false,
          complete: false,
          items: [],
          error: error?.message || String(error),
        });
      }
    })();
    return true;
  }

  if (message?.type === "rolimons_player_face_map") {
    (async () => {
      try {
        respond({ ok: true, map: await fetch_rolimons_player_face_map() });
      } catch {
        respond({ ok: false, map: {} });
      }
    })();
    return true;
  }

  if (message?.type === "rolimons_player_thumbs") {
    (async () => {
      try {
        respond({
          ok: true,
          thumbs: await fetch_rolimons_player_thumbs(
            message.ids,
            !!message.is_bundles,
          ),
        });
      } catch {
        respond({ ok: false, thumbs: {} });
      }
    })();
    return true;
  }

  return false;
});

chrome.alarms.create(trade_cache_alarm_name, {
  delayInMinutes: TRADE_CACHE_ALARM_DELAY_MINUTES,
  periodInMinutes: TRADE_CACHE_ALARM_PERIOD_MINUTES,
});
ensure_notification_click_handler();
ensure_inbound_poll_timer();
ensure_trade_status_poll_timer();

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === trade_cache_alarm_name) {
    try {
      await get_pruned_cached_trades();
    } catch {}

    refresh_trade_cache();
    chrome.tabs.query(
      { url: nte_roblox_tab_url_query_patterns },
      (tabs_result) => {
        tabs_result.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, "Values", {}, () => {
            chrome.runtime.lastError;
          });
        });
      },
    );
    return;
  }

  if (alarm.name === inbound_poll_alarm_name) {
    poll_inbound_trades();
    return;
  }
});

chrome.storage.onChanged.addListener((changes, area_name) => {
  if (area_name !== "local") return;

  if (changes["Inbound Trade Notifications"]?.newValue === true) {
    (async () => {
      await set_local_value(inbound_poll_state_key, {
        last_seen_time: 0,
        notified_ids: [],
      });
      await poll_inbound_trades();
    })();
  }

  let trade_types_to_prime = [];
  if (changes["Declined Trade Notifications"]?.newValue === true)
    trade_types_to_prime.push("inactive");
  if (changes["Completed Trade Notifications"]?.newValue === true)
    trade_types_to_prime.push("completed");
  if (trade_types_to_prime.length) {
    (async () => {
      await prime_trade_status_seed(trade_types_to_prime);
      await refresh_trade_cache();
    })();
  }
});

const required_host_origins = (() => {
  // Quick Proof only needs Roblox page access for tab capture flow.
  let quick_proof = ["https://www.roblox.com/*", "https://roblox.com/*"];
  let manifest_origins = chrome.runtime?.getManifest?.()?.host_permissions;
  if (!Array.isArray(manifest_origins) || !manifest_origins.length)
    return quick_proof;
  let granted_set = new Set(manifest_origins.map((x) => String(x || "").trim()));
  let filtered = quick_proof.filter((x) => granted_set.has(x));
  return filtered.length ? filtered : quick_proof;
})();

const quick_proof_capture_permission_message =
  "Quick Proof needs one-time tab access. I opened the extension popup for you. If Proof still fails, open Roblox settings, click the extension settings entry, then try Proof again.";

function is_quick_proof_capture_permission_error(error) {
  return /'<all_urls>'|<all_urls>|activeTab/i.test(String(error || ""));
}

async function open_first_roblox_popup(sender) {
  if (
    /firefox/i.test(navigator.userAgent || "") ||
    !chrome.action?.openPopup
  )
    return false;
  try {
    let options =
      sender?.tab?.windowId === undefined
        ? undefined
        : { windowId: sender.tab.windowId };
    await chrome.action.openPopup(options);
    return true;
  } catch {
    return false;
  }
}

async function check_host_permissions() {
  if (!chrome.permissions?.contains) return true;
  return new Promise((resolve) => {
    try {
      chrome.permissions.contains(
        { origins: required_host_origins },
        (granted) => {
          if (chrome.runtime.lastError) {
            console.info(
              "Nevos Trading Extension: host permission check failed",
              chrome.runtime.lastError,
            );
            resolve(false);
            return;
          }
          resolve(!!granted);
        },
      );
    } catch (error) {
      console.info(
        "Nevos Trading Extension: host permission API unavailable",
        error,
      );
      resolve(true);
    }
  });
}

async function request_host_permissions() {
  if (!chrome.permissions?.request) return false;
  return new Promise((resolve) => {
    try {
      chrome.permissions.request(
        { origins: required_host_origins },
        (granted) => {
          if (chrome.runtime.lastError) {
            console.info(
              "Nevos Trading Extension: host permission request failed",
              chrome.runtime.lastError,
            );
            resolve(false);
            return;
          }
          resolve(!!granted);
        },
      );
    } catch (error) {
      console.info(
        "Nevos Trading Extension: host permission API unavailable",
        error,
      );
      resolve(false);
    }
  });
}

let ta_state = {
  running: false,
  action: "",
  phase: "",
  done: 0,
  total: 0,
  checked: 0,
  skipped: 0,
  fetched_pages: 0,
  error: "",
  wait_until: 0,
};
let ta_abort = false;
let ta_wake = null;
const TA_RATE_LIMIT_BUFFER = 2;
const TA_RATE_LIMIT_RESET_PAD_MS = 1000;
const TA_RATE_LIMIT_FALLBACK_WAIT_MS = 15000;

function ta_sleep(ms) {
  return new Promise((resolve) => {
    let done = false;
    let finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (ta_wake === finish) ta_wake = null;
      resolve();
    };
    let timer = setTimeout(finish, ms);
    ta_wake = finish;
    if (ta_abort) finish();
  });
}

function ta_stop_now() {
  ta_abort = true;
  if (ta_state.running) {
    ta_state.wait_until = 0;
    ta_state.error = "Cancelled by user";
    ta_state.running = false;
  }
  if (ta_wake) {
    ta_wake();
    ta_wake = null;
  }
}

async function ta_wait_for_rate_limit(resp) {
  if (!resp || ta_abort) return;
  let remaining = parse_trade_api_header_number(resp, "x-ratelimit-remaining");
  if (
    resp.status !== 429 &&
    (remaining === null || remaining > TA_RATE_LIMIT_BUFFER)
  )
    return;

  let reset = parse_trade_api_header_number(resp, "x-ratelimit-reset");
  let wait_ms = TA_RATE_LIMIT_FALLBACK_WAIT_MS;
  if (reset !== null) {
    wait_ms =
      reset > 1000000000
        ? Math.max(0, reset * 1000 - Date.now())
        : Math.max(0, reset * 1000);
    wait_ms += TA_RATE_LIMIT_RESET_PAD_MS;
  }
  ta_state.wait_until = Date.now() + wait_ms;
  await ta_sleep(wait_ms);
  ta_state.wait_until = 0;
}

async function ta_get_csrf() {
  let resp = await fetch("https://auth.roblox.com/v2/logout", {
    method: "POST",
    credentials: "include",
  });
  return resp.headers.get("x-csrf-token") || "";
}

async function ta_fetch(url, init) {
  if (ta_abort) return { ok: false, status: 0, headers: { get: () => null } };
  let resp = await fetch(url, init);
  if (resp.status === 429 && !ta_abort) {
    await ta_wait_for_rate_limit(resp);
    if (ta_abort) return resp;
    resp = await fetch(url, init);
  }
  await ta_wait_for_rate_limit(resp);
  return resp;
}

async function ta_get_trade_detail(trade_id, cache) {
  if (cache[trade_id] || cache[String(trade_id)])
    return cache[trade_id] || cache[String(trade_id)];
  let resp = await ta_fetch(`https://trades.roblox.com/v1/trades/${trade_id}`, {
    credentials: "include",
  });
  if (ta_abort) return null;
  if (!resp.ok) return null;
  let trade = await resp.json();
  cache_trade_detail(cache, trade_id, trade);
  return trade;
}

async function ta_decline_trade(trade_id, csrf) {
  let do_decline = async (token) => {
    if (ta_abort) return { ok: false, status: 0, headers: { get: () => null } };
    return fetch(`https://trades.roblox.com/v1/trades/${trade_id}/decline`, {
      method: "POST",
      credentials: "include",
      headers: { "x-csrf-token": token },
    });
  };
  let resp = await do_decline(csrf);
  if (resp.status === 403) {
    let new_csrf = resp.headers.get("x-csrf-token");
    if (new_csrf) {
      await ta_wait_for_rate_limit(resp);
      if (ta_abort) return { ok: false, csrf, status: 0 };
      csrf = new_csrf;
      resp = await do_decline(csrf);
    }
  }
  if (resp.status === 429 && !ta_abort) {
    await ta_wait_for_rate_limit(resp);
    if (ta_abort) return { ok: false, csrf, status: 0 };
    resp = await do_decline(csrf);
  }
  await ta_wait_for_rate_limit(resp);
  if (ta_abort) return { ok: false, csrf, status: 0 };
  if (resp.ok) await mark_self_declined_trade(trade_id);
  return { ok: resp.ok, csrf, status: resp.status };
}

async function ta_fetch_user_collectibles(user_id) {
  let ids = new Set();
  let cursor = "";
  for (let page = 0; page < 40; page++) {
    if (ta_abort) break;
    let url = `https://inventory.roblox.com/v1/users/${user_id}/assets/collectibles?limit=100&sortOrder=Asc`;
    if (cursor) url += `&cursor=${cursor}`;
    let resp = await ta_fetch(url, { credentials: "include" });
    if (ta_abort) break;
    if (!resp.ok) return null;
    let json = await resp.json();
    if (json.data)
      for (let item of json.data) {
        if (item.userAssetId) ids.add(item.userAssetId);
      }
    cursor = json.nextPageCursor;
    if (!cursor) break;
  }
  return ids;
}

function ta_get_trade_item_target_id(item) {
  return (
    parseInt(
      item?.assetId ??
        item?.itemTarget?.targetId ??
        item?.targetId ??
        item?.itemId ??
        item?.asset?.id ??
        item?.asset?.assetId ??
        item?.item?.id ??
        0,
      10,
    ) || 0
  );
}

async function ta_user_owns_asset(user_id, target_id) {
  if (!user_id || !(Number(target_id) > 0)) return null;
  try {
    let resp = await ta_fetch(
      `https://inventory.roblox.com/v1/users/${user_id}/items/Asset/${target_id}/is-owned`,
      { credentials: "include" },
    );
    if (!resp.ok) return null;
    let value = await resp.json().catch(() => null);
    return typeof value === "boolean"
      ? value
      : !!(value?.isOwned ?? value?.owned);
  } catch {
    return null;
  }
}

function ta_trade_is_older_than(trade, max_age_ms, list_trade_type) {
  if (!(max_age_ms > 0)) return true;
  let ts = get_trade_timestamp_ms(trade, list_trade_type);
  if (!ts) return false;
  return ts <= Date.now() - max_age_ms;
}

async function ta_run_action(action, min_overpay_pct = 0, max_trade_age_ms = 0) {
  if (ta_state.running) return;
  ta_state = {
    running: true,
    action,
    phase: "fetching",
    done: 0,
    total: 0,
    checked: 0,
    skipped: 0,
    fetched_pages: 0,
    error: "",
    wait_until: 0,
    min_overpay_pct,
    max_trade_age_ms,
  };
  ta_abort = false;

  try {
    let is_inbound = action.startsWith("cancel_inbound");
    let overpaying_only = action.endsWith("_overpaying");
    let unowned_check = action.endsWith("_unowned");
    let age_filter = action === "cancel_outbound_older_than";
    let trade_type = is_inbound ? "inbound" : "outbound";
    let list_trade_type = is_inbound ? "inbound" : "outbound";

    let csrf = await ta_get_csrf();

    let trades = [];
    let cursor = "";
    for (let page = 0; page < 50; page++) {
      if (ta_abort) break;
      let url = `https://trades.roblox.com/v1/trades/${trade_type}?limit=100&sortOrder=Desc`;
      if (cursor) url += `&cursor=${cursor}`;
      let resp = await ta_fetch(url, { credentials: "include" });
      if (ta_abort) break;
      if (!resp.ok) break;
      let json = await resp.json();
      if (json.data) trades.push(...json.data);
      ta_state.fetched_pages++;
      ta_state.total = trades.length;
      cursor = json.nextPageCursor;
      if (!cursor) break;
    }

    if (ta_abort) {
      ta_state.error = "Cancelled by user";
      ta_state.running = false;
      return;
    }

    ta_state.total = trades.length;
    let trade_cache = await get_pruned_cached_trades();
    let locked_trade_ids = await get_locked_trade_ids();
    let is_locked_trade = (trade) =>
      locked_trade_ids.has(String(trade?.id || "").trim());

    if (overpaying_only) {
      ta_state.phase = "checking";
      let item_data = await get_cached_item_data();
      let auth_resp = await fetch(
        "https://users.roblox.com/v1/users/authenticated",
        { credentials: "include" },
      );
      let auth_json = auth_resp.ok ? await auth_resp.json() : {};
      let my_user_id = auth_json.id;

      for (let trade of trades) {
        if (ta_abort) {
          ta_state.error = "Cancelled by user";
          break;
        }
        ta_state.checked++;
        if (is_locked_trade(trade)) {
          ta_state.skipped++;
          continue;
        }

        let detail = await ta_get_trade_detail(trade.id, trade_cache);
        if (ta_abort) {
          ta_state.error = "Cancelled by user";
          break;
        }
        if (!detail) {
          ta_state.skipped++;
          continue;
        }
        let my_offer, their_offer;
        if (detail.offers) {
          my_offer = detail.offers.find((o) => o.user?.id === my_user_id);
          their_offer = detail.offers.find((o) => o.user?.id !== my_user_id);
        } else {
          let a = detail.participantAOffer;
          let b = detail.participantBOffer;
          if (a?.user?.id === my_user_id) {
            my_offer = a;
            their_offer = b;
          } else if (b?.user?.id === my_user_id) {
            my_offer = b;
            their_offer = a;
          }
        }
        if (!my_offer || !their_offer) {
          ta_state.skipped++;
          continue;
        }
        let my_val = compute_offer_value(my_offer, item_data);
        let their_val = compute_offer_value(their_offer, item_data);
        if (my_val <= their_val) {
          ta_state.skipped++;
          continue;
        }
        if (
          min_overpay_pct > 0 &&
          their_val > 0 &&
          ((my_val - their_val) / their_val) * 100 < min_overpay_pct
        ) {
          ta_state.skipped++;
          continue;
        }
        if (min_overpay_pct > 0 && their_val === 0 && my_val === 0) {
          ta_state.skipped++;
          continue;
        }

        let result = await ta_decline_trade(trade.id, csrf);
        if (ta_abort) {
          ta_state.error = "Cancelled by user";
          break;
        }
        if (result.csrf) csrf = result.csrf;
        ta_state.done++;
      }
    } else if (unowned_check) {
      ta_state.phase = "checking";
      let auth_resp = await fetch(
        "https://users.roblox.com/v1/users/authenticated",
        { credentials: "include" },
      );
      let auth_json = auth_resp.ok ? await auth_resp.json() : {};
      let my_user_id = auth_json.id;
      let collectibles_cache = {};
      let asset_ownership_cache = {};

      for (let trade of trades) {
        if (ta_abort) {
          ta_state.error = "Cancelled by user";
          break;
        }
        ta_state.checked++;
        if (is_locked_trade(trade)) {
          ta_state.skipped++;
          continue;
        }

        let detail = await ta_get_trade_detail(trade.id, trade_cache);
        if (ta_abort) {
          ta_state.error = "Cancelled by user";
          break;
        }
        if (!detail) {
          ta_state.skipped++;
          continue;
        }

        let my_offer, their_offer;
        if (detail.offers) {
          my_offer = detail.offers.find((o) => o.user?.id === my_user_id);
          their_offer = detail.offers.find((o) => o.user?.id !== my_user_id);
        } else {
          let a = detail.participantAOffer;
          let b = detail.participantBOffer;
          if (a?.user?.id === my_user_id) {
            my_offer = a;
            their_offer = b;
          } else if (b?.user?.id === my_user_id) {
            my_offer = b;
            their_offer = a;
          }
        }
        if (!my_offer || !their_offer) {
          ta_state.skipped++;
          continue;
        }

        let get_items = (offer) =>
          offer?.userAssets ||
          offer?.assets ||
          offer?.userItems ||
          offer?.items ||
          offer?.userCollectibles ||
          offer?.collectibles ||
          [];
        let get_user_asset_id = (item) =>
          item?.userAssetId ??
          item?.userAsset?.userAssetId ??
          item?.userAsset?.id;

        let has_unowned = false;
        let sides = [
          { user_id: my_offer.user?.id, items: get_items(my_offer) },
          { user_id: their_offer.user?.id, items: get_items(their_offer) },
        ];

        for (let side of sides) {
          if (!side.user_id || !side.items.length) continue;
          if (ta_abort) break;
          if (!collectibles_cache[side.user_id]) {
            collectibles_cache[side.user_id] = await ta_fetch_user_collectibles(
              side.user_id,
            );
          }
          let owned = collectibles_cache[side.user_id];
          if (!owned) continue;
          for (let item of side.items) {
            let ua_id = get_user_asset_id(item);
            if (ua_id && owned.has(ua_id)) continue;
            let target_id = ta_get_trade_item_target_id(item);
            let cache_key = `${side.user_id}:${target_id}`;
            let asset_owned = asset_ownership_cache[cache_key];
            if (asset_owned === undefined) {
              asset_owned = await ta_user_owns_asset(side.user_id, target_id);
              asset_ownership_cache[cache_key] = asset_owned;
            }
            if (asset_owned === true) continue;
            if (asset_owned === false) {
              has_unowned = true;
              break;
            }
          }
          if (has_unowned) break;
        }

        if (ta_abort) {
          ta_state.error = "Cancelled by user";
          break;
        }
        if (!has_unowned) {
          ta_state.skipped++;
          continue;
        }

        let result = await ta_decline_trade(trade.id, csrf);
        if (ta_abort) {
          ta_state.error = "Cancelled by user";
          break;
        }
        if (result.csrf) csrf = result.csrf;
        ta_state.done++;
      }
    } else if (age_filter) {
      ta_state.phase = "checking";
      for (let trade of trades) {
        if (ta_abort) {
          ta_state.error = "Cancelled by user";
          break;
        }
        ta_state.checked++;
        if (is_locked_trade(trade)) {
          ta_state.skipped++;
          continue;
        }
        if (!ta_trade_is_older_than(trade, max_trade_age_ms, list_trade_type)) {
          ta_state.skipped++;
          continue;
        }
        let result = await ta_decline_trade(trade.id, csrf);
        if (ta_abort) {
          ta_state.error = "Cancelled by user";
          break;
        }
        if (result.csrf) csrf = result.csrf;
        ta_state.done++;
      }
    } else {
      ta_state.phase = "declining";
      for (let trade of trades) {
        if (ta_abort) {
          ta_state.error = "Cancelled by user";
          break;
        }
        if (is_locked_trade(trade)) {
          ta_state.skipped++;
          continue;
        }
        let result = await ta_decline_trade(trade.id, csrf);
        if (ta_abort) {
          ta_state.error = "Cancelled by user";
          break;
        }
        if (result.csrf) csrf = result.csrf;
        ta_state.done++;
      }
    }
  } catch (err) {
    ta_state.error = err?.message || String(err);
  }

  ta_state.running = false;
}

chrome.runtime.onInstalled.addListener(async () => {
  ensure_default_options();
  await clear_stale_extension_update_state();
});

chrome.runtime.onUpdateAvailable?.addListener((details) => {
  remember_extension_update(details?.version);
});

(async () => {
  ensure_default_options();
  await clear_stale_extension_update_state();
})();
