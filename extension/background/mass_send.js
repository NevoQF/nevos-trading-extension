const mass_send_owners_api_url =
  "https://nevos-extension.com/api/mass-send/owners";
const mass_send_send_url = "https://trades.roblox.com/v2/trades/send";
const mass_send_delay_ms = 3000;
const mass_send_rate_limit_wait_ms = 61000;
const ms_need_roblox_tab_error = "Switch to a Roblox tab to mass send.";
const ms_need_roblox_tab_wait = "Switch to a Roblox tab to keep sending.";
const mass_send_rate_unlocked_key = "mass_send_rate_unlocked";
const ms_totp_secret_key = "roblox_totp_secret_b32";
const ms_totp_mode_key = "roblox_totp_storage_mode";
const ms_totp_enc_key = "roblox_totp_encrypted_blob";
const ms_totp_enc_version = 1;
const ms_totp_pbkdf2_iters = 210000;

const ms_2fa_notification_id = "nte_ms_2fa_prompt";
const ms_2fa_focus_key = "nte_ms_focus_2fa";

let ms_state = {
  running: false,
  phase: "",
  sent: 0,
  skipped: 0,
  failed: 0,
  remaining: 0,
  total: 0,
  error: "",
  wait_until: 0,
  status: "",
  prompt: null,
};
let ms_abort = false;
let ms_wake = null;
let ms_session_secret = null;
let ms_last_used_totp = null;
let ms_2fa_waiters = [];
let ms_2fa_click_bound = false;

function ms_default_state() {
  return {
    running: false,
    phase: "",
    sent: 0,
    skipped: 0,
    failed: 0,
    remaining: 0,
    total: 0,
    error: "",
    wait_until: 0,
    status: "",
    prompt: null,
  };
}

let ms_keep_alive_timer = 0;

function ms_keep_alive_tick() {
  if (!ms_state.running) return;
  try {
    chrome.runtime.getPlatformInfo(() => {
      chrome.runtime.lastError;
    });
  } catch {}
  clearTimeout(ms_keep_alive_timer);
  ms_keep_alive_timer = setTimeout(ms_keep_alive_tick, 15000);
}

function ms_stop_keep_alive() {
  clearTimeout(ms_keep_alive_timer);
  ms_keep_alive_timer = 0;
}

function ms_sleep(ms) {
  return new Promise((resolve) => {
    let done = false;
    let timer = setTimeout(() => {
      if (done) return;
      done = true;
      ms_wake = null;
      resolve();
    }, Math.max(0, ms));
    ms_wake = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      ms_wake = null;
      resolve();
    };
    if (ms_abort) {
      if (ms_wake) ms_wake();
    }
  });
}

function ms_stop_now() {
  ms_abort = true;
  if (ms_state.running) {
    ms_state.wait_until = 0;
    ms_state.error = "Cancelled by user";
    ms_state.running = false;
    ms_state.status = "Stopped";
  }
  if (ms_wake) {
    ms_wake();
    ms_wake = null;
  }
  ms_finish_2fa_wait(null);
}

function ms_normalize_asset_ids(slots) {
  return (Array.isArray(slots) ? slots : [])
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 4);
}

function ms_instances_match_assets(asset_ids, instances) {
  let want = (asset_ids || []).length;
  if (!want || !Array.isArray(instances) || instances.length !== want)
    return false;
  let seen = new Set();
  for (let id of instances) {
    let s = String(id || "").trim();
    if (!s || s === "0" || seen.has(s)) return false;
    seen.add(s);
  }
  return seen.size === want;
}

function ms_copy_instance_ids(instances) {
  return Array.isArray(instances) ? instances.slice() : [];
}

const ms_online_hours_max = 8760; // 1 year; 0 = filter off

function ms_clamp_hours(value) {
  let n = Math.floor(Number(value));
  if (!Number.isFinite(n)) n = 24;
  return Math.max(0, Math.min(ms_online_hours_max, n));
}

function ms_clamp_max_trades(value) {
  let n = Math.floor(Number(value));
  if (!Number.isFinite(n)) n = 25;
  return Math.max(1, Math.min(100, n));
}

const ms_trade_daily_limit_max = 100;
const ms_trade_daily_limit_window_ms = 24 * 60 * 60 * 1000;
const ms_trade_daily_limit_api_max_pages = 15;
const ms_trade_daily_limit_counter_key =
  "nte_trade_daily_limit_counter_trade_ids";
const ms_trade_daily_limit_sent_key = "nte_trade_daily_limit_sent_trade_ids";
const ms_trade_daily_limit_snapshot_key = "nte_trade_daily_limit_snapshot";
const ms_trade_daily_limit_snapshot_ttl_ms = 10 * 60 * 1000;
const ms_trade_daily_limit_record_max_age_ms =
  ms_trade_daily_limit_window_ms + 3600000;

function ms_prune_trade_daily_limit_records(records, now = Date.now()) {
  let out = {};
  for (let [id, ts] of Object.entries(records || {})) {
    let key = String(id || "").trim();
    let n = Number(ts);
    if (!key || !Number.isFinite(n) || now - n > ms_trade_daily_limit_record_max_age_ms)
      continue;
    out[key] = n;
  }
  return out;
}

function ms_parse_trade_created_ms(trade) {
  let raw =
    trade?.created ||
    trade?.createdAt ||
    trade?.createdDate ||
    trade?.createdUtc ||
    trade?.createdOn;
  let parsed = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : NaN;
}

function ms_trade_daily_limit_trade_id(trade) {
  let id = trade?.id ?? trade?.tradeId;
  return id != null && String(id).trim() ? String(id).trim() : "";
}

async function ms_load_trade_daily_limit_records() {
  let raw =
    typeof get_local_values === "function"
      ? await get_local_values([
          ms_trade_daily_limit_counter_key,
          ms_trade_daily_limit_sent_key,
        ])
      : {};
  return {
    counter: ms_prune_trade_daily_limit_records(
      raw?.[ms_trade_daily_limit_counter_key],
    ),
    sent: ms_prune_trade_daily_limit_records(
      raw?.[ms_trade_daily_limit_sent_key],
    ),
  };
}

async function ms_record_trade_daily_limit_send(trade_id) {
  let id = String(trade_id ?? "").trim();
  if (!id || typeof get_local_value !== "function") return;
  let records = ms_prune_trade_daily_limit_records(
    (await get_local_value(ms_trade_daily_limit_sent_key)) || {},
  );
  if (records[id]) return;
  records[id] = Date.now();
  if (typeof set_local_value === "function") {
    await set_local_value(ms_trade_daily_limit_sent_key, records);
  }
}

async function ms_trade_api_fetch(url, init) {
  if (typeof fetch_trade_api === "function") {
    return fetch_trade_api(url, init);
  }
  return fetch(url, init);
}

async function ms_fetch_outbound_trades_for_daily_limit(cutoff) {
  let trades = [];
  let cursor = "";
  for (let page = 0; page < ms_trade_daily_limit_api_max_pages; page++) {
    let url =
      "https://trades.roblox.com/v1/trades/outbound?limit=100&sortOrder=Desc";
    if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
    let resp = await ms_trade_api_fetch(url, { credentials: "include" });
    if (!resp.ok) {
      throw new Error(`Outbound trades returned ${resp.status}.`);
    }
    let json = await resp.json().catch(() => null);
    let page_trades = Array.isArray(json?.data) ? json.data : [];
    if (!page_trades.length) break;
    let reached_cutoff = false;
    for (let trade of page_trades) {
      let created = ms_parse_trade_created_ms(trade);
      if (Number.isFinite(created) && created < cutoff) {
        reached_cutoff = true;
        break;
      }
      trades.push(trade);
    }
    if (reached_cutoff || !json?.nextPageCursor) break;
    cursor = json.nextPageCursor;
  }
  return trades;
}

async function ms_read_trade_daily_limit_snapshot() {
  if (typeof get_local_value !== "function") return null;
  let snap = await get_local_value(ms_trade_daily_limit_snapshot_key);
  if (!snap || typeof snap !== "object") return null;
  let fetched_at = Number(snap.fetched_at) || 0;
  if (
    !fetched_at ||
    Date.now() - fetched_at > ms_trade_daily_limit_snapshot_ttl_ms
  ) {
    return null;
  }
  let max = Math.max(1, Number(snap.max) || ms_trade_daily_limit_max);
  let count = Math.min(max, Math.max(0, Number(snap.count) || 0));
  let remaining = Math.max(
    0,
    Number.isFinite(Number(snap.remaining))
      ? Number(snap.remaining)
      : max - count,
  );
  return {
    ok: true,
    count,
    remaining,
    max,
    at_limit: remaining <= 0 || !!snap.at_limit,
    reset_at: snap.reset_at ?? null,
    source: "snapshot",
  };
}

async function ms_write_trade_daily_limit_snapshot(state) {
  if (typeof set_local_value !== "function" || !state) return;
  try {
    await set_local_value(ms_trade_daily_limit_snapshot_key, {
      count: state.count,
      remaining: state.remaining,
      max: state.max,
      at_limit: state.at_limit,
      reset_at: state.reset_at ?? null,
      fetched_at: Date.now(),
    });
  } catch {}
}

function ms_is_roblox_url(url) {
  try {
    let host = new URL(String(url || "")).hostname.toLowerCase();
    return host === "roblox.com" || host.endsWith(".roblox.com");
  } catch {
    return false;
  }
}

function ms_is_mobile() {
  return /android|iphone|ipod|iemobile|mobile/i.test(navigator.userAgent || "");
}

async function ms_roblox_tab_is_in_front() {
  // Mobile has no way to keep a Roblox tab in front while the extension is open.
  if (ms_is_mobile()) return true;
  if (!chrome?.windows?.getLastFocused || !chrome?.tabs?.query) return false;
  let win = null;
  try {
    win = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  } catch {
    win = null;
  }
  let tabs = [];
  try {
    if (win?.id != null) {
      tabs = await chrome.tabs.query({ active: true, windowId: win.id });
    } else {
      tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    }
  } catch {
    return false;
  }
  return ms_is_roblox_url(tabs[0]?.url || tabs[0]?.pendingUrl);
}

async function ms_wait_for_roblox_tab() {
  while (!ms_abort) {
    if (await ms_roblox_tab_is_in_front()) return;
    ms_state.status = ms_need_roblox_tab_wait;
    await ms_sleep(400);
  }
  throw new Error("Cancelled by user");
}

function ms_tab_message(tab_id, message, timeout_ms = 1500) {
  return new Promise((resolve) => {
    let settled = false;
    let timer = setTimeout(() => finish(null), timeout_ms);
    function finish(value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }
    try {
      chrome.tabs.sendMessage(tab_id, message, (res) => {
        if (chrome.runtime.lastError) finish(null);
        else finish(res ?? null);
      });
    } catch {
      finish(null);
    }
  });
}

async function ms_ask_roblox_tab_trade_daily_limit() {
  if (!chrome?.tabs?.query || !chrome?.tabs?.sendMessage) return null;
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: ["*://*.roblox.com/*"] });
  } catch {
    return null;
  }
  tabs = tabs.filter((tab) => tab.active && tab.id != null);
  for (let tab of tabs) {
    if (tab?.id == null) continue;
    try {
      let res = await ms_tab_message(tab.id, {
        type: "nte_get_trade_daily_limit",
      });
      if (!res || res.ok === false) continue;
      let max = Math.max(1, Number(res.max) || ms_trade_daily_limit_max);
      let count = Math.min(max, Math.max(0, Number(res.count) || 0));
      let remaining = Math.max(
        0,
        Number.isFinite(Number(res.remaining))
          ? Number(res.remaining)
          : max - count,
      );
      let state = {
        ok: true,
        count,
        remaining,
        max,
        at_limit: remaining <= 0 || !!res.at_limit,
        reset_at: res.reset_at ?? null,
        source: "tab",
      };
      await ms_write_trade_daily_limit_snapshot(state);
      return state;
    } catch {}
  }
  return null;
}

async function ms_compute_trade_daily_limit() {
  let now = Date.now();
  let cutoff = now - ms_trade_daily_limit_window_ms;
  let { counter, sent } = await ms_load_trade_daily_limit_records();
  let excluded = new Set(Object.keys(counter || {}));
  let created_by_id = new Map();
  let outbound = await ms_fetch_outbound_trades_for_daily_limit(cutoff);
  for (let trade of outbound) {
    let id = ms_trade_daily_limit_trade_id(trade);
    if (!id || excluded.has(id)) continue;
    let created = ms_parse_trade_created_ms(trade);
    if (!Number.isFinite(created) || created < cutoff) continue;
    let existing = created_by_id.get(id);
    if (!existing || created < existing) created_by_id.set(id, created);
  }
  for (let [id, ts] of Object.entries(sent || {})) {
    let key = String(id || "").trim();
    let created = Number(ts);
    if (
      !key ||
      !Number.isFinite(created) ||
      created < cutoff ||
      excluded.has(key) ||
      created_by_id.has(key)
    )
      continue;
    created_by_id.set(key, created);
  }
  let timestamps = [...created_by_id.values()].sort((a, b) => a - b);
  let count = Math.min(ms_trade_daily_limit_max, timestamps.length);
  let remaining = Math.max(0, ms_trade_daily_limit_max - count);
  let at_limit = remaining <= 0;
  let reset_at =
    at_limit && timestamps.length
      ? timestamps[0] + ms_trade_daily_limit_window_ms
      : null;
  return {
    ok: true,
    count,
    remaining,
    max: ms_trade_daily_limit_max,
    at_limit,
    reset_at,
    source: "api",
  };
}

async function ms_get_trade_daily_limit() {
  let from_tab = await ms_ask_roblox_tab_trade_daily_limit();
  if (from_tab) return from_tab;

  let snapshot = await ms_read_trade_daily_limit_snapshot();
  if (snapshot) return snapshot;

  try {
    let computed = await ms_compute_trade_daily_limit();
    await ms_write_trade_daily_limit_snapshot(computed);
    return computed;
  } catch (err) {
    let stale = null;
    if (typeof get_local_value === "function") {
      let snap = await get_local_value(ms_trade_daily_limit_snapshot_key);
      if (snap && typeof snap === "object") {
        let max = Math.max(1, Number(snap.max) || ms_trade_daily_limit_max);
        let count = Math.min(max, Math.max(0, Number(snap.count) || 0));
        let remaining = Math.max(0, max - count);
        stale = {
          ok: true,
          count,
          remaining,
          max,
          at_limit: remaining <= 0,
          reset_at: snap.reset_at ?? null,
          source: "stale_snapshot",
        };
      }
    }
    if (stale) return stale;
    return {
      ok: false,
      count: 0,
      remaining: ms_trade_daily_limit_max,
      max: ms_trade_daily_limit_max,
      at_limit: false,
      reset_at: null,
      error: err?.message || String(err),
    };
  }
}

function ms_tradable_target_id(item) {
  return (
    parseInt(
      item?.itemTarget?.targetId ??
        item?.itemTarget?.id ??
        item?.itemTarget?.itemId ??
        item?.itemTarget?.assetId ??
        item?.assetId ??
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

function ms_instance_id_from_row(row) {
  if (!row || typeof row !== "object") return "";
  let id =
    row.collectibleItemInstanceId ??
    row.collectibleItemInstance?.collectibleItemInstanceId ??
    row.collectibleItemInstance?.id ??
    row.instanceId ??
    row.userAssetId ??
    row.userAsset?.id ??
    row.userAsset?.userAssetId ??
    "";
  return id == null ? "" : String(id).trim();
}

function ms_collect_instance_ids(item) {
  let out = [];
  let seen = new Set();
  let push = (row) => {
    if (!row || row.isOnHold === true) return;
    let id = ms_instance_id_from_row(row);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  let instances = Array.isArray(item?.instances) ? item.instances : [];
  if (instances.length) {
    for (let inst of instances) push(inst);
  }
  // Some responses only put the instance id on the parent row.
  push(item);
  return out;
}

function ms_item_has_on_hold(item) {
  return ms_item_hold_count(item) > 0;
}

function ms_item_instance_rows(item) {
  return Array.isArray(item?.instances) && item.instances.length
    ? item.instances
    : [item];
}

function ms_item_hold_count(item) {
  let held = 0;
  for (let row of ms_item_instance_rows(item)) {
    if (row && row.isOnHold === true) held += 1;
  }
  return held;
}

function ms_item_copy_count(item) {
  let total = 0;
  for (let row of ms_item_instance_rows(item)) {
    if (row) total += 1;
  }
  return total;
}

function ms_item_display_name(item, asset_id, item_data) {
  let name =
    item?.itemName || item?.name || item?.itemTarget?.name || "";
  let roli =
    typeof get_rolimons_item === "function"
      ? get_rolimons_item(item_data, asset_id, name)
      : null;
  let acronym = Array.isArray(roli) ? String(roli[1] || "").trim() : "";
  if (acronym) return acronym;
  if (name) return String(name).trim();
  if (Array.isArray(roli) && roli[0]) return String(roli[0]).trim();
  return `#${asset_id}`;
}

function ms_item_search_terms(asset_id, item_data) {
  let terms = [];
  let push = (value) => {
    let term = String(value || "").trim();
    if (!term || terms.includes(term)) return;
    terms.push(term);
  };
  let roli =
    typeof get_rolimons_item === "function"
      ? get_rolimons_item(item_data, asset_id, "")
      : null;
  if (Array.isArray(roli)) {
    push(roli[1]);
    push(roli[0]);
    let full = String(roli[0] || "").trim();
    if (full) {
      let word = full
        .split(/\s+/)
        .map((part) => part.trim())
        .find((part) => part.length > 2 && !/^(the|and|for|of)$/i.test(part));
      push(word);
    }
  }
  return terms;
}

async function ms_fetch_tradable_items(user_id, options = {}) {
  let id = String(user_id || "").trim();
  if (!/^\d+$/.test(id)) return [];
  let search = String(options.search || "").trim();
  let max_pages = search ? 8 : 120;
  let items = [];
  let cursor = "";
  // Roblox often breaks tradableItems pagination at higher limits.
  let limit = "25";
  let status_source = options.statusSource || "ms";
  let report_status = options.reportStatus === true;
  if (report_status && typeof nte_inventory_load_status === "function") {
    nte_inventory_load_status(status_source, "Loading your items…");
  }
  for (let page = 0; page < max_pages; page++) {
    if (ms_abort) break;
    let params = new URLSearchParams({
      limit,
      sortOrder: "Desc",
    });
    if (!search) params.set("sortBy", "CreationTime");
    if (search) params.set("search", search);
    if (cursor) params.set("cursor", cursor);
    let url = `https://trades.roblox.com/v2/users/${id}/tradableitems?${params.toString()}`;
    let res = null;
    if (typeof nte_fetch_inventory_with_retries === "function") {
      res = await nte_fetch_inventory_with_retries(
        url,
        { credentials: "include" },
        { source: status_source, silent: !report_status },
      );
    } else {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (ms_abort) break;
        try {
          res = await fetch(url, { credentials: "include" });
        } catch {
          res = null;
        }
        if (res && res.status !== 429 && res.status < 500) break;
        if (attempt < 2) await ms_sleep(350 * (attempt + 1));
      }
    }
    if (!res || ms_abort) break;
    if (res.status === 401 || res.status === 403) return items;
    if (!res.ok) {
      if (res.status === 429 && !items.length) {
        throw new Error(
          "Rate limited (429). Wait a bit, then open the picker again.",
        );
      }
      break;
    }
    let data = await res.json().catch(() => null);
    if (!data) break;
    let page_items = Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.data)
        ? data.data
        : [];
    items = items.concat(page_items);
    cursor = data.nextPageCursor || "";
    if (!cursor) break;
  }
  return items;
}

function ms_resolve_instances_for_assets(items, asset_ids, options = {}) {
  let needed = {};
  for (let id of asset_ids) {
    let key = String(id);
    needed[key] = (needed[key] || 0) + 1;
  }
  let collected = [];
  let matched_rows = {};
  let used_ids = new Set(
    [...(options.used_ids || [])].map((id) => String(id || "").trim()).filter(Boolean),
  );
  for (let item of items || []) {
    let target = String(ms_tradable_target_id(item) || "");
    if (!target || !needed[target]) continue;
    if (!matched_rows[target]) matched_rows[target] = item;
    let instances = ms_collect_instance_ids(item).filter(
      (id) => !used_ids.has(String(id)),
    );
    while (needed[target] > 0 && instances.length) {
      let inst = instances.shift();
      used_ids.add(String(inst));
      collected.push(inst);
      needed[target]--;
    }
  }
  let missing = Object.keys(needed).filter((key) => needed[key] > 0);
  if (
    !missing.length &&
    ms_instances_match_assets(asset_ids, collected)
  )
    return { ok: true, instances: collected.slice(), missing: [] };
  if (!missing.length) {
    return {
      ok: false,
      missing: asset_ids.map(String),
      error: "Could not resolve a unique copy for every requested item.",
    };
  }

  let item_data = options.item_data || null;
  let on_hold_labels = [];
  let missing_labels = [];
  for (let key of missing) {
    let row = matched_rows[key] || null;
    let label = ms_item_display_name(row, key, item_data);
    if (row && ms_item_has_on_hold(row) && !ms_collect_instance_ids(row).length) {
      on_hold_labels.push(label);
    } else {
      missing_labels.push(label);
    }
  }
  if (on_hold_labels.length) {
    return {
      ok: false,
      missing,
      error:
        on_hold_labels.length === 1
          ? `${on_hold_labels[0]} is on hold.`
          : `These items are on hold: ${on_hold_labels.join(", ")}.`,
    };
  }
  return {
    ok: false,
    missing,
    error:
      missing_labels.length === 1
        ? `${missing_labels[0]} is not available to trade.`
        : `These items are not available to trade: ${missing_labels.join(", ")}.`,
  };
}

async function ms_resolve_instances_for_user(user_id, asset_ids, options = {}) {
  let item_data = options.item_data || null;
  let items = await ms_fetch_tradable_items(user_id);
  let resolved = ms_resolve_instances_for_assets(items, asset_ids, { item_data });
  if (resolved.ok || ms_abort) return resolved;

  let missing = Array.isArray(resolved.missing) ? resolved.missing : [];
  if (!missing.length) return resolved;

  let searched = new Set();
  for (let asset_id of missing) {
    if (ms_abort) break;
    for (let term of ms_item_search_terms(asset_id, item_data)) {
      let key = term.toLowerCase();
      if (!key || searched.has(key)) continue;
      searched.add(key);
      let extra = await ms_fetch_tradable_items(user_id, { search: term });
      if (extra.length) items = items.concat(extra);
    }
  }
  return ms_resolve_instances_for_assets(items, asset_ids, { item_data });
}

async function ms_fetch_outbound_user_ids() {
  let ids = new Set();
  let cursor = "";
  for (let page = 0; page < 50; page++) {
    if (ms_abort) break;
    let url =
      "https://trades.roblox.com/v1/trades/outbound?limit=100&sortOrder=Desc";
    if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
    let resp = await fetch(url, { credentials: "include" });
    if (!resp.ok || ms_abort) break;
    let json = await resp.json().catch(() => null);
    if (!json) break;
    for (let trade of json.data || []) {
      let uid =
        Number(
          trade?.user?.id ??
            trade?.opponent?.id ??
            trade?.player?.id ??
            trade?.userId ??
            0,
        ) || 0;
      if (uid > 0) ids.add(uid);
    }
    cursor = json.nextPageCursor || "";
    if (!cursor) break;
  }
  return ids;
}

async function ms_fetch_owners(asset_ids) {
  let res = await fetch(mass_send_owners_api_url, {
    method: "POST",
    headers:
      typeof nte_api_headers === "function"
        ? nte_api_headers({ "Content-Type": "application/json" })
        : {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-NTE-Client": "nte-x7Km2Qp9Wv4s",
            "From-Extension": "1",
          },
    body: JSON.stringify({ asset_ids: asset_ids.map(String) }),
    cache: "no-store",
    credentials: "omit",
  });
  let payload = await res.json().catch(() => null);
  if (
    !res.ok ||
    !payload?.ok ||
    !Array.isArray(payload.owners) ||
    (typeof is_nte_api_decoy_response === "function" &&
      is_nte_api_decoy_response(payload))
  ) {
    throw new Error(
      payload?.error || `Owners API returned ${res.status || 0}.`,
    );
  }
  return payload.owners;
}

function ms_parse_last_online(ts) {
  if (ts == null || ts === "") return null;
  let n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Rolimons uses unix seconds; tolerate ms just in case.
  if (n > 1e12) n = Math.floor(n / 1000);
  return n;
}

function ms_parse_owned_since(ts) {
  return ms_parse_last_online(ts);
}

function ms_clamp_max_owned_days(value) {
  let n = Math.floor(Number(value));
  if (!Number.isFinite(n)) n = 0;
  return Math.max(0, Math.min(3650, n));
}

function ms_filter_owners_by_hours(owners, hours, self_id) {
  let hours_n = ms_clamp_hours(hours);
  let now = Math.floor(Date.now() / 1000);
  let max_age = hours_n * 3600;
  let out = [];
  for (let row of owners || []) {
    let user_id = Number(row?.user_id) || 0;
    if (!(user_id > 0) || user_id === self_id) continue;
    let last_online = ms_parse_last_online(row?.last_online);
    // 0 hours = filter off (still skip self / invalid ids).
    if (hours_n > 0) {
      if (last_online == null || now - last_online > max_age) continue;
    }
    out.push({
      user_id,
      last_online,
      owned_since: ms_parse_owned_since(row?.owned_since),
    });
  }
  return out;
}

function ms_filter_owners_by_owned_days(candidates, max_owned_days) {
  let days = ms_clamp_max_owned_days(max_owned_days);
  if (!(days > 0) || !Array.isArray(candidates) || !candidates.length) {
    return candidates || [];
  }
  let now = Math.floor(Date.now() / 1000);
  let max_age = days * 86400;
  let out = [];
  for (let row of candidates) {
    let owned_since = ms_parse_owned_since(row?.owned_since);
    // Missing Owned Since → keep (can't verify).
    if (owned_since != null && now - owned_since > max_age) continue;
    out.push(row);
  }
  return out;
}

function ms_filter_blocked_users(candidates, blocked_users) {
  if (!Array.isArray(candidates) || !candidates.length) return candidates || [];
  let blocked = new Set();
  for (let row of blocked_users || []) {
    let id = Number(row?.user_id) || 0;
    if (id > 0) blocked.add(id);
  }
  if (!blocked.size) return candidates;
  return candidates.filter((row) => !blocked.has(Number(row?.user_id) || 0));
}

const mass_send_recent_key = "mass_send_recent";
const mass_send_recent_max = 25;
const mass_send_history_key = "mass_send_sent_history";
const mass_send_history_max = 5000;

async function ms_load_recent_sends() {
  if (typeof get_local_value !== "function") return [];
  let raw = await get_local_value(mass_send_recent_key);
  return Array.isArray(raw) ? raw : [];
}

async function ms_load_sent_history() {
  if (typeof get_local_value !== "function") return [];
  let raw = await get_local_value(mass_send_history_key);
  return Array.isArray(raw) ? raw : [];
}

async function ms_remember_sent_user(user_id, at = Date.now()) {
  if (typeof set_local_value !== "function") return;
  let id = Number(user_id) || 0;
  if (!(id > 0)) return;
  let stamp = Number(at) || Date.now();
  let list = await ms_load_sent_history();
  let out = [{ user_id: id, at: stamp }];
  let seen = new Set([id]);
  for (let row of list) {
    let uid = Number(row?.user_id) || 0;
    if (!(uid > 0) || seen.has(uid)) continue;
    seen.add(uid);
    out.push({
      user_id: uid,
      at: Number(row?.at) || 0,
    });
    if (out.length >= mass_send_history_max) break;
  }
  await set_local_value(mass_send_history_key, out);
}

function ms_filter_avoid_recent_recipients(candidates, history, days) {
  let n = Math.floor(Number(days));
  if (!(n > 0) || !Array.isArray(candidates) || !candidates.length) {
    return candidates || [];
  }
  let cutoff = Date.now() - n * 86400000;
  let blocked = new Set();
  for (let row of history || []) {
    let uid = Number(row?.user_id) || 0;
    let at = Number(row?.at) || 0;
    if (uid > 0 && at >= cutoff) blocked.add(uid);
  }
  if (!blocked.size) return candidates;
  return candidates.filter((row) => !blocked.has(Number(row?.user_id) || 0));
}

async function ms_record_recent_send(entry) {
  if (typeof set_local_value !== "function") return;
  let list = await ms_load_recent_sends();
  let offer_items = Array.isArray(entry?.offer_items)
    ? entry.offer_items.slice(0, 4)
    : [];
  let request_items = Array.isArray(entry?.request_items)
    ? entry.request_items.slice(0, 4)
    : [];
  let user_id = Number(entry?.user_id) || 0;
  let at = Number(entry?.at) || Date.now();
  list.unshift({
    user_id,
    name: String(entry?.name || "").trim().slice(0, 40),
    last_online: ms_parse_last_online(entry?.last_online),
    at,
    offer_items,
    request_items,
    offer_robux: ms_clamp_robux(entry?.offer_robux),
    request_robux: ms_clamp_robux(entry?.request_robux),
  });
  if (list.length > mass_send_recent_max) list = list.slice(0, mass_send_recent_max);
  await set_local_value(mass_send_recent_key, list);
  await ms_remember_sent_user(user_id, at);
}

function ms_item_summaries_for_assets(asset_ids, item_data) {
  if (typeof trade_ads_item_summaries === "function") {
    return trade_ads_item_summaries(asset_ids, item_data);
  }
  return (asset_ids || []).slice(0, 4).map((id) => ({
    id: Number(id),
    name: null,
    value: null,
    rap: null,
  }));
}

async function ms_fetch_username(user_id) {
  let id = Number(user_id) || 0;
  if (!(id > 0)) return "";
  try {
    let res = await fetch(`https://users.roblox.com/v1/users/${id}`, {
      credentials: "include",
    });
    if (!res.ok) return "";
    let data = await res.json().catch(() => null);
    return String(data?.name || data?.displayName || "").trim();
  } catch {
    return "";
  }
}

async function ms_inventory_for_picker() {
  let me = await (typeof get_authenticated_user_cached === "function"
    ? get_authenticated_user_cached()
    : null);
  if (!me?.id) {
    let auth_res = await fetch(
      "https://users.roblox.com/v1/users/authenticated",
      { credentials: "include" },
    );
    if (!auth_res.ok) throw new Error("Sign in to Roblox first.");
    me = await auth_res.json();
  }
  let self_id = Number(me?.id) || 0;
  if (!(self_id > 0)) throw new Error("Sign in to Roblox first.");

  let raw = await ms_fetch_tradable_items(self_id, {
    reportStatus: true,
    statusSource: "ms",
  });
  let item_data =
    typeof get_cached_item_data === "function" ? await get_cached_item_data() : null;
  let enriched = [];
  let by_asset = new Map();
  for (let row of raw || []) {
    let asset_id = ms_tradable_target_id(row);
    if (!(asset_id > 0)) continue;
    let free_ids = ms_collect_instance_ids(row);
    let on_hold_count = ms_item_hold_count(row);
    let copy_count = ms_item_copy_count(row);
    let prev = by_asset.get(asset_id);
    if (prev) {
      let seen_free = new Set(prev.free_ids);
      for (let id of free_ids) {
        if (!seen_free.has(id)) prev.free_ids.push(id);
      }
      prev.on_hold_count += on_hold_count;
      prev.copy_count += copy_count;
      continue;
    }
    by_asset.set(asset_id, {
      row,
      free_ids,
      on_hold_count,
      copy_count,
    });
  }
  for (let [asset_id, entry] of by_asset) {
    let { row, free_ids, on_hold_count, copy_count } = entry;
    // Keep fully held copies visible with a hold badge, but not selectable.
    if (!free_ids.length && !on_hold_count) continue;
    let name =
      row?.itemName ||
      row?.name ||
      row?.itemTarget?.name ||
      `#${asset_id}`;
    let roli =
      typeof get_rolimons_item === "function"
        ? get_rolimons_item(item_data, asset_id, name)
        : null;
    let acronym = Array.isArray(roli) ? String(roli[1] || "") : "";
    let value =
      typeof trade_ads_effective_value === "function" && roli
        ? trade_ads_effective_value(roli)
        : 0;
    let ui =
      typeof trade_ads_row_ui_metrics === "function"
        ? trade_ads_row_ui_metrics(roli)
        : { valueLine: value, rap: 0, projected: false };
    enriched.push({
      assetId: asset_id,
      name: name || "",
      value,
      valueLine: ui.valueLine,
      rap: ui.rap,
      projected: ui.projected,
      acronym,
      onHoldCount: on_hold_count,
      copyCount: copy_count,
      isOnHold: on_hold_count > 0,
      tradable: free_ids.length > 0,
      thumbType:
        item_data?.bundleIds?.[String(asset_id)] ? "Bundle" : "Asset",
    });
  }
  enriched.sort((a, b) => b.value - a.value);
  return { items: enriched, userId: self_id };
}

async function ms_get_csrf() {
  if (typeof ta_get_csrf === "function") return ta_get_csrf();
  let resp = await fetch("https://auth.roblox.com/v2/logout", {
    method: "POST",
    credentials: "include",
  });
  return resp.headers.get("x-csrf-token") || "";
}

async function ms_wait_rate_limit() {
  let ends = Date.now() + mass_send_rate_limit_wait_ms;
  ms_state.wait_until = ends;
  while (!ms_abort && Date.now() < ends) {
    let left = Math.max(0, Math.ceil((ends - Date.now()) / 1000));
    ms_state.status = `Ratelimited waiting ${left}s`;
    let slice = Math.min(1000, Math.max(0, ends - Date.now()));
    if (slice <= 0) break;
    await ms_sleep(slice);
  }
  ms_state.wait_until = 0;
}

function ms_clamp_robux(value) {
  let n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(1_000_000_000, n);
}

async function ms_send_trade_with_rate_limit(
  csrf,
  self_id,
  recipient_id,
  offer_instances,
  their_instances,
  offer_robux = 0,
  request_robux = 0,
) {
  let result = await ms_send_trade(
    csrf,
    self_id,
    recipient_id,
    offer_instances,
    their_instances,
    offer_robux,
    request_robux,
  );
  csrf = result.csrf || csrf;
  while (!ms_abort && result?.resp?.status === 429) {
    await ms_wait_rate_limit();
    if (ms_abort) break;
    result = await ms_send_trade(
      csrf,
      self_id,
      recipient_id,
      offer_instances,
      their_instances,
      offer_robux,
      request_robux,
    );
    csrf = result.csrf || csrf;
  }
  return { ...result, csrf };
}

function ms_is_challenge_response(resp, data) {
  if (!resp) return false;
  if (
    resp.headers?.get?.("rblx-challenge-id") ||
    resp.headers?.get?.("rblx-challenge-type")
  ) {
    return true;
  }
  let msg = String(data?.errors?.[0]?.message || "").toLowerCase();
  return (
    msg.includes("challenge is required") ||
    msg.includes("two step verification") ||
    msg.includes("2-step verification")
  );
}

function ms_is_skip_recipient_error(message) {
  let msg = String(message || "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("privacy settings") ||
    msg.includes("too strict to allow trading") ||
    msg.includes("cannot trade with") ||
    msg.includes("unable to trade with") ||
    msg.includes("does not accept trades") ||
    msg.includes("not accepting trades") ||
    msg.includes("invalid challenge id")
  );
}

function ms_has_invalid_challenge_id(data) {
  let msg = ms_trade_error_message(data).toLowerCase();
  if (msg.includes("invalid challenge id")) return true;
  try {
    return JSON.stringify(data || {})
      .toLowerCase()
      .includes("invalid challenge id");
  } catch {
    return false;
  }
}

function ms_trade_error_message(data) {
  let err = data?.errors?.[0];
  if (!err || typeof err !== "object") return "";
  return String(err.message || err.friendlyMessage || "").trim();
}

function ms_2fa_required_error() {
  return "Could not solve 2FA. Enter the code in Mass Sending, or set up Roblox 2FA Autofill.";
}

function ms_2fa_failed_error(detail) {
  let extra = String(detail || "").trim();
  if (!extra) return "Could not solve 2FA.";
  if (/2fa|two step|verification|authenticator|challenge/i.test(extra)) {
    return extra.length > 160 ? `${extra.slice(0, 157)}…` : extra;
  }
  // Roblox often returns item/asset errors after an incomplete challenge continue.
  return `Could not solve 2FA (${extra.slice(0, 100)}).`;
}

function ms_b64_json(obj) {
  return btoa(JSON.stringify(obj));
}

function ms_base32_to_bytes(b32) {
  let alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (let char of String(b32 || "")
    .toUpperCase()
    .replace(/\s/g, "")
    .replace(/=+$/, "")) {
    let val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  let bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

async function ms_make_totp(secret_b32, digits = 6, step_sec = 30) {
  let key_bytes = ms_base32_to_bytes(secret_b32);
  if (!key_bytes.length) return null;
  let crypto_key = await crypto.subtle.importKey(
    "raw",
    key_bytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  let counter = Math.floor(Date.now() / 1000 / step_sec);
  let buf = new ArrayBuffer(8);
  new DataView(buf).setBigUint64(0, BigInt(counter), false);
  let sig = await crypto.subtle.sign("HMAC", crypto_key, buf);
  let hmac = new Uint8Array(sig);
  let offset = hmac[hmac.length - 1] & 0xf;
  let code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  let mod = 10 ** digits;
  return (code % mod).toString().padStart(digits, "0");
}

function ms_totp_seconds_left(step_sec = 30) {
  let rem = step_sec - (Math.floor(Date.now() / 1000) % step_sec);
  return rem === 0 ? step_sec : rem;
}

function ms_is_totp_already_used_error(err) {
  let msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("already used") ||
    msg.includes('"code":18') ||
    msg.includes("code\":18") ||
    msg.includes("code:18")
  );
}

function ms_is_totp_invalid_code_error(err) {
  let msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("challenge code is invalid") ||
    msg.includes("code is invalid") ||
    msg.includes('"code":10') ||
    msg.includes("code\":10") ||
    msg.includes("code:10")
  );
}

function ms_is_totp_retryable_code_error(err) {
  return (
    ms_is_totp_already_used_error(err) || ms_is_totp_invalid_code_error(err)
  );
}

async function ms_wait_for_fresh_totp(secret, avoid_code, step_sec = 30) {
  let avoid = String(avoid_code || "").replace(/\D/g, "");
  while (!ms_abort) {
    let code = await ms_make_totp(secret, 6, step_sec);
    if (code && code !== avoid) return code;
    let left = ms_totp_seconds_left(step_sec);
    ms_state.phase = "awaiting_2fa";
    ms_state.status = `Waiting for new 2FA code… ${left}s`;
    await ms_sleep(Math.min(1000, Math.max(250, left * 1000)));
  }
  return null;
}

function ms_b64_to_bytes(s) {
  let bin = atob(String(s || "").replace(/\s/g, ""));
  let out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function ms_decrypt_totp_secret(blob, password) {
  if (
    !blob ||
    blob.v !== ms_totp_enc_version ||
    !blob.saltB64 ||
    !blob.ivB64 ||
    !blob.ctB64
  ) {
    throw new Error("Invalid encrypted 2FA secret.");
  }
  let enc = new TextEncoder();
  let key_material = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  let aes_key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: ms_b64_to_bytes(blob.saltB64),
      iterations: ms_totp_pbkdf2_iters,
      hash: "SHA-256",
    },
    key_material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  let pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ms_b64_to_bytes(blob.ivB64) },
    aes_key,
    ms_b64_to_bytes(blob.ctB64),
  );
  return new TextDecoder().decode(pt).trim();
}

function ms_clear_2fa_badge() {
  try {
    chrome.action?.setBadgeText?.({ text: "" });
  } catch {}
}

function ms_resolve_2fa_waiters(value) {
  let waiters = ms_2fa_waiters;
  ms_2fa_waiters = [];
  for (let w of waiters) {
    try {
      w(value);
    } catch {}
  }
}

function ms_clear_2fa_prompt() {
  ms_state.prompt = null;
  try {
    chrome.notifications?.clear?.(ms_2fa_notification_id);
  } catch {}
  ms_clear_2fa_badge();
}

function ms_finish_2fa_wait(value) {
  ms_resolve_2fa_waiters(value);
  if (value == null) ms_clear_2fa_prompt();
}

function ms_wait_for_popup_value() {
  return new Promise((resolve) => {
    if (ms_abort) {
      resolve(null);
      return;
    }
    ms_2fa_waiters.push(resolve);
  });
}

function ms_ensure_2fa_click_handler() {
  if (ms_2fa_click_bound) return;
  ms_2fa_click_bound = true;
  if (typeof ensure_notification_click_handler === "function") {
    ensure_notification_click_handler();
  }
  try {
    chrome.notifications?.onClicked?.addListener((id) => {
      if (String(id || "") !== ms_2fa_notification_id) return;
      try {
        chrome.storage.local.set({ [ms_2fa_focus_key]: true });
      } catch {}
      try {
        chrome.action?.openPopup?.();
      } catch {}
    });
  } catch {}
}

async function ms_notify_2fa(kind) {
  ms_ensure_2fa_click_handler();
  let unlock = kind === "unlock";
  try {
    chrome.storage.local.set({ [ms_2fa_focus_key]: true });
  } catch {}
  try {
    chrome.action?.setBadgeText?.({ text: "2FA" });
    chrome.action?.setBadgeBackgroundColor?.({ color: "#6c5ce7" });
  } catch {}
  try {
    await chrome.action?.openPopup?.();
  } catch {}
  try {
    chrome.runtime.sendMessage({ type: "ms_2fa_needed" }, () => {
      chrome.runtime.lastError;
    });
  } catch {}
  if (!chrome.notifications?.create) return;
  let iconUrl =
    typeof extension_notification_icon_url === "function"
      ? extension_notification_icon_url("assets/icons/logo128.png")
      : chrome.runtime.getURL("assets/icons/logo128.png");
  let notification_opts = {
    type: "basic",
    iconUrl,
    title: unlock
      ? "Mass send needs 2FA unlock"
      : "Mass send needs a 2FA code",
    message: unlock
      ? "Open the extension → Actions → Mass Sending and enter your 2FA lock password."
      : "Open the extension → Actions → Mass Sending and enter your authenticator code.",
    contextMessage: "Tap to open the extension",
    priority: 2,
  };
  if (!/firefox/i.test(navigator.userAgent || "")) {
    notification_opts.requireInteraction = true;
  }
  await new Promise((resolve) => {
    try {
      chrome.notifications.create(
        ms_2fa_notification_id,
        notification_opts,
        () => {
          chrome.runtime.lastError;
          resolve();
        },
      );
    } catch {
      resolve();
    }
  });
}

async function ms_prompt_2fa_code(opts = {}) {
  let error = String(opts.error || "");
  ms_state.status = error || "Waiting for 2FA code…";
  ms_state.phase = "awaiting_2fa";
  ms_state.prompt = { kind: "code", error, busy: false };
  if (!opts.quiet) await ms_notify_2fa("code");
  else {
    try {
      chrome.runtime.sendMessage({ type: "ms_2fa_needed" }, () => {
        chrome.runtime.lastError;
      });
    } catch {}
  }
  let value = await ms_wait_for_popup_value();
  if (!value) return null;
  return String(value).replace(/\D/g, "");
}

async function ms_prompt_unlock_password() {
  ms_state.status = "Unlock 2FA secret…";
  ms_state.phase = "awaiting_2fa";
  ms_state.prompt = { kind: "unlock", error: "" };
  await ms_notify_2fa("unlock");
  let value = await ms_wait_for_popup_value();
  if (!value) return null;
  return String(value);
}

async function ms_resolve_session_secret() {
  if (ms_session_secret) return ms_session_secret;
  let st = await chrome.storage.local.get([
    ms_totp_secret_key,
    ms_totp_mode_key,
    ms_totp_enc_key,
  ]);
  let plain =
    typeof st[ms_totp_secret_key] === "string"
      ? st[ms_totp_secret_key].trim()
      : "";
  let enc = st[ms_totp_enc_key];
  let encrypted =
    st[ms_totp_mode_key] === "encrypted" ||
    !!(
      enc &&
      enc.v === ms_totp_enc_version &&
      enc.saltB64 &&
      enc.ivB64 &&
      enc.ctB64
    );

  if (encrypted && enc) {
    let password = await ms_prompt_unlock_password();
    if (!password) return null;
    try {
      ms_session_secret = await ms_decrypt_totp_secret(enc, password);
    } catch {
      throw new Error("Wrong 2FA lock password.");
    }
    return ms_session_secret || null;
  }

  if (plain) {
    ms_session_secret = plain;
    return ms_session_secret;
  }
  return null;
}

async function ms_get_2fa_code(avoid_code = null) {
  let secret = null;
  try {
    secret = await ms_resolve_session_secret();
  } catch {
    secret = null;
  }
  let avoid = String(avoid_code || ms_last_used_totp || "").replace(/\D/g, "");
  if (secret) {
    let code = await ms_make_totp(secret);
    if (code && avoid && code === avoid) {
      code = await ms_wait_for_fresh_totp(secret, avoid);
    }
    if (code) return { code, source: "secret", secret };
  }
  let manual = await ms_prompt_2fa_code();
  if (!manual) return null;
  if (avoid && manual === avoid) {
    manual = await ms_prompt_2fa_code({
      quiet: true,
      error: "That 2FA code was already used. Enter the next one.",
    });
    if (!manual) return null;
  }
  return { code: manual, source: "manual", secret: null };
}

function ms_extract_challenge_info(resp) {
  let metadata_header = resp?.headers?.get?.("rblx-challenge-metadata") || "";
  let continue_challenge_id =
    resp?.headers?.get?.("rblx-challenge-id") || "";
  let challenge_id = "";
  let action_type = "Generic";
  if (metadata_header) {
    try {
      let decoded = JSON.parse(atob(metadata_header));
      challenge_id = String(decoded?.challengeId || "");
      if (decoded?.actionType) action_type = String(decoded.actionType);
    } catch {
      return null;
    }
  }
  if (!challenge_id || !continue_challenge_id) return null;
  return {
    challenge_id,
    continue_challenge_id,
    action_type,
  };
}

async function ms_verify_2fa({
  user_id,
  challenge_id,
  continue_challenge_id,
  csrf,
  code,
  action_type,
}) {
  let verify_resp = await fetch(
    `https://twostepverification.roblox.com/v1/users/${user_id}/challenges/authenticator/verify`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json;charset=UTF-8",
        "x-csrf-token": csrf || "",
      },
      body: JSON.stringify({
        challengeId: challenge_id,
        actionType: action_type || "Generic",
        code: String(code || ""),
      }),
    },
  );
  if (verify_resp.status === 403) {
    let next = verify_resp.headers.get("x-csrf-token");
    if (next) {
      csrf = next;
      verify_resp = await fetch(
        `https://twostepverification.roblox.com/v1/users/${user_id}/challenges/authenticator/verify`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json;charset=UTF-8",
            "x-csrf-token": csrf || "",
          },
          body: JSON.stringify({
            challengeId: challenge_id,
            actionType: action_type || "Generic",
            code: String(code || ""),
          }),
        },
      );
    }
  }
  if (!verify_resp.ok) {
    let err_text = await verify_resp.text().catch(() => "");
    let parsed = null;
    try {
      parsed = JSON.parse(err_text);
    } catch {}
    let api_msg = String(parsed?.errors?.[0]?.message || "").trim();
    let api_code = Number(parsed?.errors?.[0]?.code);
    if (
      api_code === 10 ||
      /challenge code is invalid/i.test(api_msg)
    ) {
      throw new Error("The two step verification challenge code is invalid.");
    }
    if (api_code === 18 || /already used/i.test(api_msg)) {
      throw new Error("This 2FA code was already used.");
    }
    throw new Error(
      api_msg
        ? `2FA verify failed (${verify_resp.status}): ${api_msg}`
        : `2FA verify failed (${verify_resp.status})${err_text ? `: ${err_text.slice(0, 120)}` : ""}`,
    );
  }
  let verify_data = await verify_resp.json().catch(() => ({}));
  let verification_token = verify_data?.verificationToken;
  if (!verification_token) throw new Error("2FA verify returned no token.");

  let meta_obj = {
    verificationToken: verification_token,
    rememberDevice: true,
    challengeId: challenge_id,
    actionType: action_type || "Generic",
  };

  let continue_resp = await fetch(
    "https://apis.roblox.com/challenge/v1/continue",
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json;charset=UTF-8",
        "x-csrf-token": csrf || "",
      },
      body: JSON.stringify({
        challengeId: continue_challenge_id,
        challengeType: "twostepverification",
        challengeMetadata: JSON.stringify(meta_obj),
      }),
    },
  );
  if (!continue_resp.ok) {
    let err_text = await continue_resp.text().catch(() => "");
    throw new Error(
      `2FA continue failed (${continue_resp.status})${err_text ? `: ${err_text.slice(0, 120)}` : ""}`,
    );
  }

  return {
    csrf,
    metadata: ms_b64_json(meta_obj),
    continue_challenge_id,
  };
}

async function ms_send_trade(
  csrf,
  self_id,
  recipient_id,
  offer_ids,
  request_ids,
  offer_robux = 0,
  request_robux = 0,
) {
  let offer_payload = ms_copy_instance_ids(offer_ids);
  let request_payload = ms_copy_instance_ids(request_ids);
  if (!offer_payload.length || !request_payload.length) {
    return {
      resp: { ok: false, status: 0 },
      data: {},
      csrf,
      error: "Incomplete trade payload.",
    };
  }
  if (
    offer_payload.length !== (Array.isArray(offer_ids) ? offer_ids.length : 0) ||
    request_payload.length !==
      (Array.isArray(request_ids) ? request_ids.length : 0)
  ) {
    return {
      resp: { ok: false, status: 0 },
      data: {},
      csrf,
      error: "Trade item count mismatch. Send blocked.",
    };
  }
  let body = {
    senderOffer: {
      userId: self_id,
      robux: ms_clamp_robux(offer_robux),
      collectibleItemInstanceIds: offer_payload.slice(),
    },
    recipientOffer: {
      userId: recipient_id,
      robux: ms_clamp_robux(request_robux),
      collectibleItemInstanceIds: request_payload.slice(),
    },
  };
  let do_send = async (token, challenge_headers = null) => {
    let headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-csrf-token": token || "",
    };
    if (challenge_headers?.continue_challenge_id && challenge_headers?.metadata) {
      headers["rblx-challenge-id"] = challenge_headers.continue_challenge_id;
      headers["rblx-challenge-metadata"] = challenge_headers.metadata;
      headers["rblx-challenge-type"] = "twostepverification";
      headers["x-retry-attempt"] = "1";
    }
    return fetch(mass_send_send_url, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(body),
    });
  };

  let resp = await do_send(csrf, null);
  let data = await resp.json().catch(() => ({}));
  // Challenge responses are also 403. Parse body first so a body-only
  // challenge is not mistaken for a CSRF refresh.
  if (
    resp.status === 403 &&
    !ms_is_challenge_response(resp, data)
  ) {
    let next = resp.headers.get("x-csrf-token");
    if (next) {
      csrf = next;
      resp = await do_send(csrf, null);
      data = await resp.json().catch(() => ({}));
    }
  }

  if (ms_is_challenge_response(resp, data)) {
    let info = ms_extract_challenge_info(resp);
    let challenge_csrf = resp.headers.get("x-csrf-token") || csrf;
    if (!info) {
      return {
        resp,
        data,
        csrf: challenge_csrf,
        error: ms_2fa_failed_error("missing challenge data"),
      };
    }
    ms_state.status = "Solving 2FA…";
    let code_info = null;
    try {
      code_info = await ms_get_2fa_code();
    } catch (err) {
      return {
        resp,
        data,
        csrf: challenge_csrf,
        error: ms_2fa_failed_error(err?.message || "2FA failed."),
      };
    }
    if (!code_info?.code) {
      return {
        resp,
        data,
        csrf: challenge_csrf,
        error: ms_2fa_required_error(),
      };
    }
    let verified = null;
    let code = String(code_info.code || "").replace(/\D/g, "");
    let secret = code_info.secret || ms_session_secret || null;
    while (!verified) {
      if (ms_abort) {
        return {
          resp,
          data,
          csrf: challenge_csrf,
          error: ms_2fa_required_error(),
        };
      }
      try {
        ms_state.status = "Checking 2FA…";
        ms_last_used_totp = code;
        verified = await ms_verify_2fa({
          user_id: self_id,
          challenge_id: info.challenge_id,
          continue_challenge_id: info.continue_challenge_id,
          csrf: challenge_csrf,
          code,
          action_type: info.action_type,
        });
        break;
      } catch (err) {
        if (!ms_is_totp_retryable_code_error(err)) {
          return {
            resp,
            data,
            csrf: challenge_csrf,
            error: ms_2fa_failed_error(err?.message || "2FA verification failed."),
          };
        }
        let invalid = ms_is_totp_invalid_code_error(err);
        if (secret && ms_is_totp_already_used_error(err)) {
          code = await ms_wait_for_fresh_totp(secret, code);
          if (!code) {
            return {
              resp,
              data,
              csrf: challenge_csrf,
              error: ms_2fa_required_error(),
            };
          }
          continue;
        }
        secret = null;
        let next = await ms_prompt_2fa_code({
          quiet: true,
          error: invalid
            ? "That 2FA code is invalid. Enter a new one."
            : "That 2FA code was already used. Enter the next one.",
        });
        if (!next) {
          return {
            resp,
            data,
            csrf: challenge_csrf,
            error: ms_2fa_required_error(),
          };
        }
        code = String(next).replace(/\D/g, "");
      }
    }
    if (!verified) {
      return {
        resp,
        data,
        csrf: challenge_csrf,
        error: ms_2fa_failed_error("verification failed"),
      };
    }
    ms_clear_2fa_prompt();
    ms_state.phase = "sending";
    csrf = verified.csrf || challenge_csrf;
    // Challenge headers only on the immediate retry of this request (Essentials-style).
    resp = await do_send(csrf, {
      continue_challenge_id: verified.continue_challenge_id,
      metadata: verified.metadata,
    });
    data = await resp.json().catch(() => ({}));
    if (
      resp.status === 403 &&
      !ms_is_challenge_response(resp, data)
    ) {
      let next = resp.headers.get("x-csrf-token");
      if (next) {
        csrf = next;
        resp = await do_send(csrf, {
          continue_challenge_id: verified.continue_challenge_id,
          metadata: verified.metadata,
        });
        data = await resp.json().catch(() => ({}));
      }
    }

    // Stale challenge IDs: retry once without challenge headers, then soft-fail.
    if (!resp.ok && ms_has_invalid_challenge_id(data)) {
      resp = await do_send(csrf, null);
      data = await resp.json().catch(() => ({}));
      if (
        resp.status === 403 &&
        !ms_is_challenge_response(resp, data)
      ) {
        let next = resp.headers.get("x-csrf-token");
        if (next) {
          csrf = next;
          resp = await do_send(csrf, null);
          data = await resp.json().catch(() => ({}));
        }
      }
      return { resp, data, csrf };
    }

    // Incomplete/invalid 2FA retries often come back as another challenge.
    // Other trade rejections (privacy, inventory, etc.) are normal failures.
    if (!resp.ok) {
      if (ms_has_invalid_challenge_id(data)) {
        return { resp, data, csrf };
      }
      if (ms_is_challenge_response(resp, data)) {
        return {
          resp,
          data,
          csrf,
          error: ms_2fa_failed_error(),
        };
      }
      return { resp, data, csrf };
    }
  }

  return { resp, data, csrf };
}

async function ms_run(config) {
  if (ms_state.running) return;
  ms_abort = false;
  ms_session_secret = null;
  ms_state = {
    ...ms_default_state(),
    running: true,
    phase: "preparing",
    status: "Preparing…",
  };

  ms_keep_alive_tick();
  try {
    await ms_wait_for_roblox_tab();
    let offer_assets = ms_normalize_asset_ids(config?.offer_slots);
    let request_assets = ms_normalize_asset_ids(config?.request_slots);
    let hours = ms_clamp_hours(config?.online_hours);
    let max_trades = ms_clamp_max_trades(config?.max_trades);
    let limit = await ms_get_trade_daily_limit();
    let remaining = Math.max(0, Number(limit?.remaining) || 0);
    if (remaining <= 0) {
      throw new Error(
        `Roblox 24h trade limit reached (0/${ms_trade_daily_limit_max} left).`,
      );
    }
    if (max_trades > remaining) max_trades = remaining;
    let offer_robux = ms_clamp_robux(config?.offer_robux);
    let request_robux = ms_clamp_robux(config?.request_robux);
    let max_owned_days = ms_clamp_max_owned_days(config?.max_owned_days);
    let blocked_users = Array.isArray(config?.blocked_users)
      ? config.blocked_users
      : [];

    if (!offer_assets.length) {
      throw new Error("Add at least one offer item.");
    }
    if (!request_assets.length) {
      throw new Error("Add at least one request item.");
    }

    let me = await (typeof get_authenticated_user_cached === "function"
      ? get_authenticated_user_cached()
      : null);
    if (!me?.id) {
      let auth_res = await fetch(
        "https://users.roblox.com/v1/users/authenticated",
        { credentials: "include" },
      );
      if (!auth_res.ok) throw new Error("Sign in to Roblox first.");
      me = await auth_res.json();
    }
    let self_id = Number(me?.id) || 0;
    if (!(self_id > 0)) throw new Error("Sign in to Roblox first.");

    ms_state.phase = "resolving_offer";
    ms_state.status = "Resolving your offer items…";
    let item_data =
      typeof get_cached_item_data === "function"
        ? await get_cached_item_data()
        : null;
    let offer_resolved = await ms_resolve_instances_for_user(
      self_id,
      offer_assets,
      { item_data },
    );
    if (ms_abort) throw new Error("Cancelled by user");
    if (!offer_resolved?.ok) {
      throw new Error(
        offer_resolved?.error || "One or more offer items are not available to trade.",
      );
    }
    let offer_instances = ms_copy_instance_ids(offer_resolved.instances);
    if (!ms_instances_match_assets(offer_assets, offer_instances)) {
      throw new Error("Could not resolve a unique copy for every offer item.");
    }

    ms_state.phase = "owners";
    ms_state.status = "Loading owners…";
    let owners = await ms_fetch_owners(request_assets);
    if (ms_abort) throw new Error("Cancelled by user");

    ms_state.phase = "filtering";
    ms_state.status = "Filtering recipients…";
    let candidates = ms_filter_owners_by_hours(owners, hours, self_id);
    candidates = ms_filter_owners_by_owned_days(candidates, max_owned_days);
    candidates = ms_filter_blocked_users(candidates, blocked_users);
    let outbound = await ms_fetch_outbound_user_ids();
    if (ms_abort) throw new Error("Cancelled by user");
    candidates = candidates.filter((row) => !outbound.has(row.user_id));

    let avoid_days = Math.max(
      0,
      Math.min(365, Math.floor(Number(config?.avoid_recent_days))),
    );
    if (!Number.isFinite(avoid_days)) avoid_days = 2;
    if (avoid_days > 0) {
      let history = await ms_load_sent_history();
      candidates = ms_filter_avoid_recent_recipients(
        candidates,
        history,
        avoid_days,
      );
    }

    // Keep the full filtered pool. We'll stop once we successfully send
    // `max_trades` (privacy / failed recipients just consume extras).
    let target_sends = max_trades;
    ms_state.total = target_sends;
    ms_state.remaining = target_sends;
    if (!candidates.length) {
      ms_state.status = "No matching recipients.";
      ms_state.phase = "done";
      ms_state.running = false;
      return;
    }

    let csrf = await ms_get_csrf();
    if (!csrf) throw new Error("Could not get Roblox CSRF token.");

    ms_state.phase = "sending";
    let used_offer_ids = new Set();
    for (let i = 0; i < candidates.length; i++) {
      if (ms_abort) {
        ms_state.error = "Cancelled by user";
        break;
      }
      if (ms_state.sent >= target_sends) break;
      if (used_offer_ids.size) {
        let next_offer = await ms_resolve_instances_for_user(
          self_id,
          offer_assets,
          { item_data, used_ids: used_offer_ids },
        );
        if (ms_abort) {
          ms_state.error = "Cancelled by user";
          break;
        }
        if (!next_offer?.ok) {
          throw new Error(
            next_offer?.error
              ? `Sent ${ms_state.sent}. ${next_offer.error}`
              : `Sent ${ms_state.sent}. No more free copies of your offer items.`,
          );
        }
        offer_instances = ms_copy_instance_ids(next_offer.instances);
      }

      let target = candidates[i];
      let recipient_id = target.user_id;
      ms_state.status = `Sending ${ms_state.sent + 1}/${target_sends}…`;
      ms_state.remaining = Math.max(0, target_sends - ms_state.sent);

      let their_instances_result = await ms_resolve_instances_for_user(
        recipient_id,
        request_assets,
        { item_data },
      );
      if (ms_abort) {
        ms_state.error = "Cancelled by user";
        break;
      }
      if (!their_instances_result?.ok) {
        ms_state.skipped++;
        continue;
      }
      let their_instances = ms_copy_instance_ids(
        their_instances_result.instances,
      );
      if (!ms_instances_match_assets(request_assets, their_instances)) {
        ms_state.skipped++;
        continue;
      }
      if (!ms_instances_match_assets(offer_assets, offer_instances)) {
        throw new Error("Offer items changed while sending. Stopped to avoid a bad trade.");
      }

      let result = await ms_send_trade_with_rate_limit(
        csrf,
        self_id,
        recipient_id,
        ms_copy_instance_ids(offer_instances),
        ms_copy_instance_ids(their_instances),
        offer_robux,
        request_robux,
      );
      csrf = result.csrf || csrf;
      if (ms_abort) {
        ms_state.error = "Cancelled by user";
        break;
      }

      if (result.error) {
        ms_state.error = result.error;
        ms_state.failed++;
        break;
      }

      if (ms_is_challenge_response(result.resp, result.data)) {
        ms_state.error = ms_2fa_failed_error();
        ms_state.failed++;
        break;
      }

      if (result.resp.ok) {
        ms_state.sent++;
        for (let id of offer_instances) used_offer_ids.add(String(id));
        let trade_id =
          result.data?.id ?? result.data?.tradeId ?? result.data?.trade_id;
        if (trade_id != null) {
          try {
            await ms_record_trade_daily_limit_send(trade_id);
          } catch {}
        }
        let name = await ms_fetch_username(recipient_id);
        await ms_record_recent_send({
          user_id: recipient_id,
          name: name || `User ${recipient_id}`,
          last_online: target.last_online,
          at: Date.now(),
          offer_items: ms_item_summaries_for_assets(offer_assets, item_data),
          request_items: ms_item_summaries_for_assets(
            request_assets,
            item_data,
          ),
          offer_robux,
          request_robux,
        });
      } else {
        let roblox_msg = ms_trade_error_message(result.data);
        if (ms_is_skip_recipient_error(roblox_msg)) {
          ms_state.skipped++;
          continue;
        }
        ms_state.failed++;
      }
      ms_state.remaining = Math.max(0, target_sends - ms_state.sent);

      if (ms_state.sent >= target_sends) break;
      if (i < candidates.length - 1 && !ms_abort) {
        await ms_sleep(mass_send_delay_ms);
      }
    }

    if (!ms_state.error) {
      ms_state.status = "Done";
      ms_state.phase = "done";
    } else {
      ms_state.phase = "stopped";
      ms_state.status = ms_state.error;
    }
  } catch (err) {
    ms_state.error = err?.message || String(err);
    ms_state.status = ms_state.error;
    ms_state.phase = "error";
  }

  ms_session_secret = null;
  ms_state.running = false;
  ms_stop_keep_alive();
  ms_state.wait_until = 0;
  ms_state.remaining = 0;
  ms_finish_2fa_wait(null);
}

function mass_send_handle_message(message, respond) {
  if (!message || typeof message !== "object") return false;
  if (message.type === "ms_start") {
    if (typeof nte_is_lite === "function" && nte_is_lite()) {
      respond({ ok: false, error: "Mass Sending is Full-only." });
      return false;
    }
    (async () => {
      try {
        let unlocked =
          typeof get_local_value === "function"
            ? await get_local_value(mass_send_rate_unlocked_key)
            : true;
        if (!unlocked) {
          respond({
            ok: false,
            error: "Rate the extension 5 stars to unlock Mass Sending.",
          });
          return;
        }
        if (!(await ms_roblox_tab_is_in_front())) {
          respond({
            ok: false,
            error: ms_need_roblox_tab_error,
          });
          return;
        }
        ms_run(message.config || {});
        respond({ ok: true });
      } catch (err) {
        respond({
          ok: false,
          error: err?.message || String(err),
        });
      }
    })();
    return true;
  }
  if (message.type === "ms_2fa_submit") {
    let kind = message.kind === "unlock" ? "unlock" : "code";
    let value = String(message.value || "");
    if (kind === "code") value = value.replace(/\D/g, "");
    else value = value.trim();
    if (!ms_state.running || ms_state.phase !== "awaiting_2fa") {
      respond({ ok: false, error: "Not waiting for 2FA." });
      return false;
    }
    if (ms_state.prompt?.kind && ms_state.prompt.kind !== kind) {
      respond({ ok: false, error: "Wrong 2FA step." });
      return false;
    }
    if (ms_state.prompt?.busy) {
      respond({ ok: false, error: "Checking that code…" });
      return false;
    }
    if (kind === "code" && value.length !== 6) {
      respond({ ok: false, error: "Enter the 6-digit authenticator code." });
      return false;
    }
    if (kind === "unlock" && !value) {
      respond({ ok: false, error: "Enter your password." });
      return false;
    }
    ms_state.status = "Checking 2FA…";
    if (ms_state.prompt) {
      ms_state.prompt = {
        ...ms_state.prompt,
        busy: true,
        error: "",
      };
    }
    ms_resolve_2fa_waiters(value);
    respond({ ok: true });
    return false;
  }
  if (message.type === "ms_progress") {
    respond({ ...ms_state });
    return false;
  }
  if (message.type === "ms_trade_limit") {
    (async () => {
      try {
        respond(await ms_get_trade_daily_limit());
      } catch (err) {
        respond({
          ok: false,
          count: 0,
          remaining: ms_trade_daily_limit_max,
          max: ms_trade_daily_limit_max,
          at_limit: false,
          reset_at: null,
          error: err?.message || String(err),
        });
      }
    })();
    return true;
  }
  if (message.type === "ms_stop") {
    ms_stop_now();
    respond({ ok: true });
    return false;
  }
  if (message.type === "ms_recent") {
    (async () => {
      try {
        respond({ ok: true, sends: await ms_load_recent_sends() });
      } catch (err) {
        respond({
          ok: false,
          sends: [],
          error: err?.message || String(err),
        });
      }
    })();
    return true;
  }
  if (message.type === "ms_inventory") {
    if (typeof nte_is_lite === "function" && nte_is_lite()) {
      respond({
        ok: false,
        error: "Mass Sending is Full-only.",
        items: [],
      });
      return false;
    }
    (async () => {
      try {
        let data = await ms_inventory_for_picker();
        respond({ ok: true, items: data.items, userId: data.userId });
      } catch (err) {
        respond({
          ok: false,
          error: err?.message || String(err),
          items: [],
        });
      }
    })();
    return true;
  }
  if (message.type === "ms_item_metrics") {
    (async () => {
      try {
        let item_data =
          typeof get_cached_item_data === "function"
            ? await get_cached_item_data()
            : null;
        let metrics = {};
        let ids = Array.isArray(message.asset_ids) ? message.asset_ids : [];
        for (let raw of ids) {
          let aid = Number(raw);
          if (!(aid > 0)) continue;
          let row =
            typeof get_rolimons_item === "function"
              ? get_rolimons_item(item_data, aid)
              : null;
          metrics[String(aid)] =
            typeof trade_ads_row_ui_metrics === "function"
              ? trade_ads_row_ui_metrics(row)
              : { valueLine: 0, rap: 0, projected: false, name: "" };
        }
        respond({ ok: true, metrics });
      } catch (err) {
        respond({
          ok: false,
          metrics: {},
          error: err?.message || String(err),
        });
      }
    })();
    return true;
  }
  return false;
}
