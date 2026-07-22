const mass_send_owners_api_url =
  "https://nevos-extension.com/api/mass-send/owners";
const mass_send_send_url = "https://trades.roblox.com/v2/trades/send";
const mass_send_delay_ms = 3000;
const mass_send_rate_limit_wait_ms = 61000;
const mass_send_rate_unlocked_key = "mass_send_rate_unlocked";
const ms_totp_secret_key = "roblox_totp_secret_b32";
const ms_totp_mode_key = "roblox_totp_storage_mode";
const ms_totp_enc_key = "roblox_totp_encrypted_blob";
const ms_totp_enc_version = 1;
const ms_totp_pbkdf2_iters = 210000;

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
};
let ms_abort = false;
let ms_wake = null;
let ms_session_secret = null;
let ms_last_used_totp = null;

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
  };
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
}

function ms_normalize_asset_ids(slots) {
  return (Array.isArray(slots) ? slots : [])
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 4);
}

function ms_clamp_hours(value) {
  let n = Math.floor(Number(value));
  if (!Number.isFinite(n)) n = 24;
  return Math.max(1, Math.min(168, n));
}

function ms_clamp_max_trades(value) {
  let n = Math.floor(Number(value));
  if (!Number.isFinite(n)) n = 25;
  return Math.max(1, Math.min(100, n));
}

function ms_tradable_target_id(item) {
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

function ms_collect_instance_ids(item) {
  let raw =
    Array.isArray(item?.instances) && item.instances.length
      ? item.instances
      : [item];
  return raw
    .filter((x) => x && !x.isOnHold)
    .map(
      (x) =>
        x?.collectibleItemInstanceId ??
        x?.instanceId ??
        x?.userAssetId ??
        null,
    )
    .map((x) => (x == null ? "" : String(x)))
    .filter(Boolean);
}

function ms_item_has_on_hold(item) {
  let raw =
    Array.isArray(item?.instances) && item.instances.length
      ? item.instances
      : [item];
  return raw.some((x) => x && x.isOnHold === true);
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
  return `#${asset_id}`;
}

async function ms_fetch_tradable_items(user_id) {
  let id = String(user_id || "").trim();
  if (!/^\d+$/.test(id)) return [];
  let items = [];
  let cursor = "";
  let limit = "100";
  for (let page = 0; page < 100; page++) {
    if (ms_abort) break;
    let params = new URLSearchParams({
      sortBy: "CreationTime",
      limit,
      sortOrder: "Desc",
    });
    if (cursor) params.set("cursor", cursor);
    let url = `https://trades.roblox.com/v2/users/${id}/tradableitems?${params.toString()}`;
    let res = null;
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
    if (!res || ms_abort) break;
    if (res.status === 401 || res.status === 403) return items;
    if (res.status === 500 && limit === "100") {
      limit = "50";
      continue;
    }
    if (!res.ok) break;
    let data = await res.json().catch(() => null);
    if (!data) break;
    items = items.concat(Array.isArray(data.items) ? data.items : []);
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
  for (let item of items || []) {
    let target = String(ms_tradable_target_id(item) || "");
    if (!target || !needed[target]) continue;
    if (!matched_rows[target]) matched_rows[target] = item;
    let instances = ms_collect_instance_ids(item);
    while (needed[target] > 0 && instances.length) {
      collected.push(instances.shift());
      needed[target]--;
    }
  }
  let missing = Object.keys(needed).filter((key) => needed[key] > 0);
  if (!missing.length) return { ok: true, instances: collected };

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
      error:
        on_hold_labels.length === 1
          ? `${on_hold_labels[0]} is on hold.`
          : `These items are on hold: ${on_hold_labels.join(", ")}.`,
    };
  }
  return {
    ok: false,
    error:
      missing_labels.length === 1
        ? `${missing_labels[0]} is not available to trade.`
        : `These items are not available to trade: ${missing_labels.join(", ")}.`,
  };
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
  if (!res.ok || !payload?.ok || !Array.isArray(payload.owners)) {
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

function ms_filter_owners_by_hours(owners, hours, self_id) {
  let max_age = ms_clamp_hours(hours) * 3600;
  let now = Math.floor(Date.now() / 1000);
  let out = [];
  for (let row of owners || []) {
    let user_id = Number(row?.user_id) || 0;
    if (!(user_id > 0) || user_id === self_id) continue;
    let last_online = ms_parse_last_online(row?.last_online);
    if (last_online == null || now - last_online > max_age) continue;
    out.push({ user_id, last_online });
  }
  return out;
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

  let raw = await ms_fetch_tradable_items(self_id);
  let item_data =
    typeof get_cached_item_data === "function" ? await get_cached_item_data() : null;
  let enriched = [];
  let seen = new Set();
  for (let row of raw || []) {
    let asset_id = ms_tradable_target_id(row);
    if (!(asset_id > 0) || seen.has(asset_id)) continue;
    // Skip items with no free (non-hold) copies.
    if (!ms_collect_instance_ids(row).length) continue;
    seen.add(asset_id);
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
        : { valueLine: value, rap: 0 };
    enriched.push({
      assetId: asset_id,
      name: name || "",
      value,
      valueLine: ui.valueLine,
      rap: ui.rap,
      acronym,
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

async function ms_send_trade_with_rate_limit(
  csrf,
  self_id,
  recipient_id,
  offer_instances,
  their_instances,
) {
  let result = await ms_send_trade(
    csrf,
    self_id,
    recipient_id,
    offer_instances,
    their_instances,
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

function ms_challenge_stats() {
  return {
    sent: ms_state.sent || 0,
    failed: ms_state.failed || 0,
    skipped: ms_state.skipped || 0,
    remaining: ms_state.remaining || 0,
    total: ms_state.total || 0,
  };
}

async function ms_find_roblox_tab() {
  let tabs = await chrome.tabs.query({
    url: ["*://www.roblox.com/*", "*://roblox.com/*"],
  });
  if (!tabs?.length) {
    let created = await chrome.tabs.create({
      url: "https://www.roblox.com/trades",
      active: true,
    });
    await ms_sleep(1800);
    return created;
  }
  let active = tabs.find((t) => t.active && t.id != null);
  return active || tabs.find((t) => t.id != null) || null;
}

async function ms_ask_page(message) {
  let tab = await ms_find_roblox_tab();
  if (!tab?.id) throw new Error("Open a Roblox tab to continue 2FA.");
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    await ms_sleep(1200);
    return await chrome.tabs.sendMessage(tab.id, message);
  }
}

async function ms_prompt_2fa_code() {
  ms_state.status = "Waiting for 2FA code…";
  ms_state.phase = "awaiting_2fa";
  let res = await ms_ask_page({
    type: "ms_2fa_code_prompt",
    stats: ms_challenge_stats(),
  });
  if (!res?.ok || !res.code) return null;
  return String(res.code).replace(/\D/g, "");
}

async function ms_prompt_unlock_password() {
  ms_state.status = "Unlock 2FA secret…";
  ms_state.phase = "awaiting_2fa";
  let res = await ms_ask_page({
    type: "ms_2fa_unlock_prompt",
    stats: ms_challenge_stats(),
  });
  if (!res?.ok || !res.password) return null;
  return String(res.password);
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
    ms_state.status = "That 2FA code was already used. Enter the next one…";
    manual = await ms_prompt_2fa_code();
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
    throw new Error(
      `2FA verify failed (${verify_resp.status})${err_text ? `: ${err_text.slice(0, 120)}` : ""}`,
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
) {
  let body = {
    senderOffer: {
      userId: self_id,
      robux: 0,
      collectibleItemInstanceIds: offer_ids,
    },
    recipientOffer: {
      userId: recipient_id,
      robux: 0,
      collectibleItemInstanceIds: request_ids,
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
  if (resp.status === 403) {
    let next = resp.headers.get("x-csrf-token");
    // Challenge responses are also 403; only refresh CSRF when this is not a 2FA challenge.
    if (next && !ms_is_challenge_response(resp, null)) {
      csrf = next;
      resp = await do_send(csrf, null);
    }
  }
  let data = await resp.json().catch(() => ({}));

  if (ms_is_challenge_response(resp, data)) {
    let info = ms_extract_challenge_info(resp);
    let challenge_csrf = resp.headers.get("x-csrf-token") || csrf;
    if (!info) {
      return {
        resp,
        data,
        csrf: challenge_csrf,
        error: "Could not read Roblox 2FA challenge.",
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
        error: err?.message || "2FA failed.",
      };
    }
    if (!code_info?.code) {
      return {
        resp,
        data,
        csrf: challenge_csrf,
        error: "2FA cancelled.",
      };
    }
    let verified;
    let code = String(code_info.code || "").replace(/\D/g, "");
    let secret = code_info.secret || ms_session_secret || null;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (ms_abort) {
        return {
          resp,
          data,
          csrf: challenge_csrf,
          error: "2FA cancelled.",
        };
      }
      try {
        ms_state.status = "Solving 2FA…";
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
        if (ms_is_totp_already_used_error(err) && attempt < 3) {
          if (secret) {
            code = await ms_wait_for_fresh_totp(secret, code);
            if (!code) {
              return {
                resp,
                data,
                csrf: challenge_csrf,
                error: "2FA cancelled.",
              };
            }
            continue;
          }
          ms_state.status =
            "That 2FA code was already used. Enter the next one…";
          let next = await ms_prompt_2fa_code();
          if (!next) {
            return {
              resp,
              data,
              csrf: challenge_csrf,
              error: "2FA cancelled.",
            };
          }
          code = String(next).replace(/\D/g, "");
          continue;
        }
        return {
          resp,
          data,
          csrf: challenge_csrf,
          error: err?.message || "2FA verification failed.",
        };
      }
    }
    if (!verified) {
      return {
        resp,
        data,
        csrf: challenge_csrf,
        error: "2FA verification failed.",
      };
    }
    csrf = verified.csrf || challenge_csrf;
    // Challenge headers only on the immediate retry of this request (Essentials-style).
    resp = await do_send(csrf, {
      continue_challenge_id: verified.continue_challenge_id,
      metadata: verified.metadata,
    });
    if (resp.status === 403) {
      let next = resp.headers.get("x-csrf-token");
      if (next && !ms_is_challenge_response(resp, null)) {
        csrf = next;
        resp = await do_send(csrf, {
          continue_challenge_id: verified.continue_challenge_id,
          metadata: verified.metadata,
        });
      }
    }
    data = await resp.json().catch(() => ({}));
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

  try {
    let offer_assets = ms_normalize_asset_ids(config?.offer_slots);
    let request_assets = ms_normalize_asset_ids(config?.request_slots);
    let hours = ms_clamp_hours(config?.online_hours);
    let max_trades = ms_clamp_max_trades(config?.max_trades);

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
    let my_items = await ms_fetch_tradable_items(self_id);
    if (ms_abort) throw new Error("Cancelled by user");
    let offer_resolved = ms_resolve_instances_for_assets(
      my_items,
      offer_assets,
      { item_data },
    );
    if (!offer_resolved?.ok) {
      throw new Error(
        offer_resolved?.error || "One or more offer items are not available to trade.",
      );
    }
    let offer_instances = offer_resolved.instances;

    ms_state.phase = "owners";
    ms_state.status = "Loading owners…";
    let owners = await ms_fetch_owners(request_assets);
    if (ms_abort) throw new Error("Cancelled by user");

    ms_state.phase = "filtering";
    ms_state.status = "Filtering recipients…";
    let candidates = ms_filter_owners_by_hours(owners, hours, self_id);
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
    for (let i = 0; i < candidates.length; i++) {
      if (ms_abort) {
        ms_state.error = "Cancelled by user";
        break;
      }
      if (ms_state.sent >= target_sends) break;

      let target = candidates[i];
      let recipient_id = target.user_id;
      ms_state.status = `Sending ${ms_state.sent + 1}/${target_sends}…`;
      ms_state.remaining = Math.max(0, target_sends - ms_state.sent);

      let their_items = await ms_fetch_tradable_items(recipient_id);
      if (ms_abort) {
        ms_state.error = "Cancelled by user";
        break;
      }
      let their_instances_result = ms_resolve_instances_for_assets(
        their_items,
        request_assets,
        { item_data },
      );
      if (!their_instances_result?.ok) {
        ms_state.skipped++;
        continue;
      }
      let their_instances = their_instances_result.instances;

      let result = await ms_send_trade_with_rate_limit(
        csrf,
        self_id,
        recipient_id,
        offer_instances,
        their_instances,
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
        ms_state.error = "Roblox 2FA challenge could not be completed.";
        ms_state.failed++;
        break;
      }

      if (result.resp.ok) {
        ms_state.sent++;
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
        });
      } else {
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
  ms_state.wait_until = 0;
  ms_state.remaining = 0;
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
  if (message.type === "ms_progress") {
    respond({ ...ms_state });
    return false;
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
              : { valueLine: 0, rap: 0 };
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
