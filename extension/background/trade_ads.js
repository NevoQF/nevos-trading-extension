const trade_ads_notification_prefix = "nte_trade_ads_post_";
const trade_ads_config_key = "trade_ads_config";
const trade_ads_last_random_request_ids_key =
  "trade_ads_last_random_request_ids";
const trade_ads_roli_key = "trade_ads_roli_verification";
const trade_ads_verify_ui_key = "trade_ads_verify_ui";
const trade_ads_popup_tab_key = "nte_popup_last_tab";
const trade_ads_alarm_name = "tradeAdsAutoPost";
const trade_ads_clear_error_alarm_name = "tradeAdsClearAutoError";
const trade_ads_schedule_anchor_key = "trade_ads_schedule_anchor_at";
const trade_ads_recent_posts_key = "trade_ads_recent_posts";
const trade_ads_interval_min = 15;
const trade_ads_interval_max = 43200;

function trade_ads_default_config() {
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

function trade_ads_normalize_config(raw) {
  let o = {
    ...trade_ads_default_config(),
    ...(raw && typeof raw === "object" ? raw : {}),
  };
  if (
    raw &&
    typeof raw === "object" &&
    Object.prototype.hasOwnProperty.call(raw, "auto_post") &&
    !Object.prototype.hasOwnProperty.call(raw, "posting_paused")
  ) {
    o.posting_paused = raw.auto_post !== true;
  }
  delete o.auto_post;
  if (typeof o.posting_paused !== "boolean") o.posting_paused = true;
  if (typeof o.offer_random !== "boolean")
    o.offer_random = trade_ads_default_config().offer_random;
  if (typeof o.request_random !== "boolean")
    o.request_random = trade_ads_default_config().request_random;
  if (typeof o.notify_on_post !== "boolean")
    o.notify_on_post = trade_ads_default_config().notify_on_post;
  o.notify_on_post = o.notify_on_post !== false;
  let mins = Math.floor(Number(o.auto_interval_minutes));
  if (!Number.isFinite(mins))
    mins = trade_ads_default_config().auto_interval_minutes;
  o.auto_interval_minutes = Math.max(
    trade_ads_interval_min,
    Math.min(trade_ads_interval_max, mins),
  );
  return o;
}

async function trade_ads_get_config_merged() {
  let raw = await get_local_value(trade_ads_config_key);
  let normalized = trade_ads_normalize_config(raw);
  if (
    raw &&
    typeof raw === "object" &&
    Object.prototype.hasOwnProperty.call(raw, "auto_post")
  ) {
    await set_local_value(trade_ads_config_key, normalized);
    await trade_ads_sync_alarm();
  }
  return normalized;
}

function trade_ads_effective_value(row) {
  if (!Array.isArray(row)) return 0;
  let rap = Number(row[2]) || 0;
  let v = Number(row[3]);
  let raw = Number.isFinite(v) ? v : 0;
  return raw > 0 ? raw : rap;
}

function trade_ads_row_ui_metrics(row) {
  if (!Array.isArray(row)) return { valueLine: 0, rap: 0 };
  let rap = Number(row[2]) || 0;
  let v = Number(row[3]);
  let raw = Number.isFinite(v) ? v : 0;
  let valueLine = raw > 0 ? raw : rap;
  return { valueLine, rap };
}

function trade_ads_item_summaries(ids, item_data) {
  return (ids || []).slice(0, 4).map((id) => {
    let row = get_rolimons_item(item_data, Number(id));
    if (!Array.isArray(row))
      return { id: Number(id), name: null, value: null, rap: null };
    let rap = Number(row[2]) || 0;
    let v = Number(row[3]);
    let value = Number.isFinite(v) && v > 0 ? v : rap > 0 ? rap : 0;
    return { id: Number(id), name: String(row[0] || ""), value, rap };
  });
}

function trade_ads_random_int_below(n) {
  if (n <= 0) return 0;
  try {
    if (globalThis.crypto?.getRandomValues) {
      let buf = new Uint32Array(1);
      globalThis.crypto.getRandomValues(buf);
      return buf[0] % n;
    }
  } catch {}
  return Math.floor(Math.random() * n);
}

function trade_ads_shuffle(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return arr;
  for (let i = arr.length - 1; i > 0; i--) {
    let j = trade_ads_random_int_below(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function trade_ads_pick_random_requests(
  offer_ids,
  item_data,
  demand_min,
  exclude_extra,
) {
  let items = item_data?.items || {};
  let offer_set = new Set((offer_ids || []).map((x) => String(x)));
  let exclude = new Set((exclude_extra || []).map((x) => String(x)));
  let get_val = (id) => trade_ads_effective_value(items[String(id)]);

  let offer_sum = (offer_ids || []).reduce((s, id) => s + get_val(id), 0);
  let cap = Math.max(0, Math.floor(offer_sum * 1.8));

  let pool = Object.entries(items)
    .map(([id, row]) => ({
      id: Number(id),
      value: trade_ads_effective_value(row),
      demand: Array.isArray(row) ? Number(row[5]) : -1,
    }))
    .filter((x) => Number.isFinite(x.id) && x.id > 0 && x.value > 0)
    .filter((x) => !offer_set.has(String(x.id)) && !exclude.has(String(x.id)))
    .filter(
      (x) =>
        demand_min <= 0 ||
        (Number.isFinite(x.demand) && x.demand >= demand_min),
    );

  if (!pool.length) {
    return { requestItemIds: [], request_tags: [] };
  }

  trade_ads_shuffle(pool);

  let picked = [];
  let picked_set = new Set();
  let total = 0;
  let max_attempts = Math.min(8000, Math.max(400, pool.length * 16));
  for (
    let attempts = 0;
    picked.length < 4 && attempts < max_attempts;
    attempts++
  ) {
    let p = pool[trade_ads_random_int_below(pool.length)];
    if (picked_set.has(p.id)) continue;
    if (total + p.value > cap) continue;
    picked.push(p.id);
    picked_set.add(p.id);
    total += p.value;
  }

  if (!picked.length && pool.length) {
    let by_val = pool.slice().sort((a, b) => a.value - b.value);
    let min_v = by_val[0].value;
    let ties = by_val.filter((p) => p.value === min_v);
    trade_ads_shuffle(ties);
    picked = [ties[0].id];
    picked_set = new Set(picked);
    total = ties[0].value;
  }

  let rest = pool.filter((p) => !picked_set.has(p.id));
  trade_ads_shuffle(rest);
  for (let p of rest) {
    if (picked.length >= 4) break;
    if (total + p.value <= cap) {
      picked.push(p.id);
      picked_set.add(p.id);
      total += p.value;
    }
  }

  let request_tags = picked.length > 0 && picked.length < 4 ? ["any"] : [];
  return { requestItemIds: picked.slice(0, 4), request_tags: request_tags };
}

function trade_ads_clamp_requests(offer_ids, request_ids, item_data) {
  let items = item_data?.items || {};
  let get_val = (id) => trade_ads_effective_value(items[String(id)]);
  let offer_sum = (offer_ids || []).reduce((s, id) => s + get_val(id), 0);
  let cap = Math.max(0, Math.floor(offer_sum * 1.8));
  let ids = (request_ids || [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  let sum = ids.reduce((s, id) => s + get_val(id), 0);
  if (sum <= cap)
    return {
      ids: ids.slice(0, 4),
      tags: ids.length < 4 && ids.length > 0 ? ["any"] : [],
    };

  let by_asc = ids.slice().sort((a, b) => get_val(a) - get_val(b));
  let kept = [];
  let running = 0;
  for (let id of by_asc) {
    let v = get_val(id);
    if (kept.length < 4 && running + v <= cap) {
      kept.push(id);
      running += v;
    }
  }
  if (!kept.length && by_asc.length) {
    kept = [by_asc[0]];
    running = get_val(by_asc[0]);
  }
  return {
    ids: kept.slice(0, 4),
    tags: kept.length < 4 && kept.length > 0 ? ["any"] : [],
  };
}

async function trade_ads_get_cookie_header_value() {
  for (let url of [
    "https://www.rolimons.com/",
    "https://rolimons.com/",
    "https://api.rolimons.com/",
  ]) {
    let c = await chrome.cookies.get({ url, name: "_RoliVerification" });
    if (c?.value) return `_RoliVerification=${c.value}`;
  }
  let all = await chrome.cookies.getAll({ name: "_RoliVerification" });
  let hit = all.find((x) => String(x.domain || "").includes("rolimons"));
  if (hit?.value) return `_RoliVerification=${hit.value}`;
  return null;
}

async function trade_ads_resolve_cookie_header() {
  let from_jar = await trade_ads_get_cookie_header_value();
  if (from_jar) return from_jar;
  let stored = await get_local_value(trade_ads_roli_key);
  if (stored?.cookieHeader) return stored.cookieHeader;
  return null;
}

function trade_ads_extract_verification_cookie_from_response(response) {
  try {
    let get_set = response.headers.getSetCookie;
    if (typeof get_set === "function") {
      for (let c of get_set.call(response.headers) || []) {
        let m = String(c).match(/^(_RoliVerification=[^;]+)/);
        if (m) return m[1];
      }
    }
  } catch {}
  let raw = response.headers.get("set-cookie");
  if (raw) {
    let m = String(raw).match(/(_RoliVerification=[^;]+)/);
    if (m) return m[1];
  }
  return null;
}

async function trade_ads_fetch_phrase(user_id) {
  let response = await fetch(
    `https://api.rolimons.com/auth/v1/getphrase/${user_id}`,
    {
      headers: {
        accept: "*/*",
        Referer: "https://www.rolimons.com/",
      },
    },
  );
  let data = await response.json().catch(() => ({}));
  if (!data.success || !data.phrase) {
    throw new Error(data.error || "Could not get verification phrase");
  }
  return data.phrase;
}

async function trade_ads_verify_via_api(user_id) {
  let response = await fetch(
    `https://api.rolimons.com/auth/v1/verifyphrase/${user_id}`,
    {
      method: "POST",
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        Referer: "https://www.rolimons.com/",
      },
    },
  );
  let data = await response.json().catch(() => ({}));
  if (!data.success) {
    throw new Error(
      data.error ||
        "Verification failed. Add the phrase to your Roblox profile About, save, wait a few seconds, then try again.",
    );
  }

  let cookie_header =
    trade_ads_extract_verification_cookie_from_response(response);
  if (cookie_header) {
    await set_local_value(trade_ads_roli_key, {
      userId: user_id,
      cookieHeader: cookie_header,
      at: Date.now(),
    });
    return { ok: true, cookieHeader: cookie_header };
  }

  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 100));
    cookie_header = await trade_ads_get_cookie_header_value();
    if (cookie_header) {
      await set_local_value(trade_ads_roli_key, {
        userId: user_id,
        cookieHeader: cookie_header,
        at: Date.now(),
      });
      return { ok: true, cookieHeader: cookie_header };
    }
  }

  throw new Error(
    "Rolimons accepted the phrase, but the extension could not read the session cookie. Reload the extension and confirm host access to api.rolimons.com, then try again.",
  );
}

async function trade_ads_get_roblox_bio(user_id) {
  let res = await fetch(`https://users.roblox.com/v1/users/${user_id}`);
  let data = await res.json().catch(() => ({}));
  return data.description || "";
}

async function trade_ads_update_roblox_bio(description) {
  let body = new URLSearchParams({ description });
  let res = await fetch("https://users.roblox.com/v1/description", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (res.status === 403) {
    let csrf = res.headers.get("x-csrf-token");
    if (!csrf) throw new Error("Could not get CSRF token");
    res = await fetch("https://users.roblox.com/v1/description", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-csrf-token": csrf,
      },
      body: body.toString(),
    });
  }
  if (!res.ok) {
    let data = await res.json().catch(() => ({}));
    throw new Error(
      data?.message || data?.error || `Bio update failed (${res.status})`,
    );
  }
}

async function trade_ads_auto_verify(user_id) {
  let phrase = await trade_ads_fetch_phrase(user_id);
  let original_bio = await trade_ads_get_roblox_bio(user_id);
  let new_bio = original_bio ? `${original_bio}\n${phrase}` : phrase;
  await trade_ads_update_roblox_bio(new_bio);
  await trade_ads_verify_via_api(user_id);
  await trade_ads_update_roblox_bio(original_bio);
}

async function trade_ads_fetch_inventory_collectibles(user_id) {
  let all = [];
  let cursor = "";
  for (let page = 0; page < 40; page++) {
    let url = `https://inventory.roblox.com/v1/users/${user_id}/assets/collectibles?limit=100&sortOrder=Asc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    let res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      if (res.status === 403)
        throw new Error(
          "Inventory is private or unavailable. Open your Roblox privacy settings.",
        );
      throw new Error(`Inventory request failed (${res.status})`);
    }
    let data = await res.json();
    let chunk = Array.isArray(data?.data) ? data.data : [];
    for (let row of chunk) {
      if (row?.assetId != null)
        all.push({ assetId: Number(row.assetId), name: row?.name || "" });
    }
    cursor = data?.nextPageCursor || "";
    if (!cursor) break;
  }
  return all;
}

const trade_ads_roblox_catalog_item_asset = 1;
const trade_ads_random_offer_accessory_asset_types = new Set([
  8, 41, 42, 43, 44, 45, 46, 47, 57, 58, 61, 65, 66, 67, 68, 69, 70, 71, 72, 79,
  80,
]);

const trade_ads_catalog_detail_cache_key =
  "trade_ads_catalog_item_detail_cache";
let trade_ads_catalog_detail_mem;
let trade_ads_catalog_csrf = "";
let trade_ads_catalog_mutex = Promise.resolve();

async function trade_ads_catalog_locked(fn) {
  let release;
  let next = new Promise((r) => {
    release = r;
  });
  let prev = trade_ads_catalog_mutex;
  trade_ads_catalog_mutex = next;
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function trade_ads_catalog_cache_ensure() {
  if (trade_ads_catalog_detail_mem !== undefined) return;
  let raw = await get_local_value(trade_ads_catalog_detail_cache_key);
  trade_ads_catalog_detail_mem =
    raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
}

function trade_ads_catalog_row_to_detail(item) {
  if (!item || item.id == null) return null;
  let at = Number(item.assetType);
  if (Number.isFinite(at)) return { kind: "asset", assetType: at };
  return null;
}

function trade_ads_random_offer_detail_eligible(d) {
  if (!d || d.kind !== "asset") return false;
  return trade_ads_random_offer_accessory_asset_types.has(d.assetType);
}

async function trade_ads_roblox_catalog_items_details(items) {
  let url = "https://catalog.roblox.com/v1/catalog/items/details";
  let do_fetch = async (csrf) => {
    let headers = { "content-type": "application/json" };
    if (csrf) headers["x-csrf-token"] = csrf;
    return fetch(url, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ items }),
    });
  };
  let res = await do_fetch(trade_ads_catalog_csrf);
  if (res.status === 403) {
    let t = res.headers.get("x-csrf-token");
    if (t) {
      trade_ads_catalog_csrf = t;
      await res.text().catch(() => "");
      res = await do_fetch(trade_ads_catalog_csrf);
    }
  }
  if (!res.ok) {
    let err_body = await res.text().catch(() => "");
    throw new Error(`Roblox catalog ${res.status}: ${err_body.slice(0, 160)}`);
  }
  let json = await res.json().catch(() => ({}));
  return json;
}

async function trade_ads_resolve_catalog_details_for_ids(numeric_ids) {
  return trade_ads_catalog_locked(async () => {
    await trade_ads_catalog_cache_ensure();
    let ids = [
      ...new Set(
        (numeric_ids || [])
          .map(Number)
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    ];
    let out = {};
    let need_asset = [];
    let cache_dirty = false;
    for (let id of ids) {
      let s = String(id);
      let row = trade_ads_catalog_detail_mem[s];
      if (row && row.kind === "bundle") {
        delete trade_ads_catalog_detail_mem[s];
        cache_dirty = true;
        need_asset.push(id);
        continue;
      }
      if (row && row.kind === "asset") {
        out[s] = row;
      } else {
        need_asset.push(id);
      }
    }
    let flush = async () => {
      await set_local_value(
        trade_ads_catalog_detail_cache_key,
        trade_ads_catalog_detail_mem,
      );
    };
    if (cache_dirty) await flush();
    async function run_batch(id_chunk, item_type) {
      if (!id_chunk.length) return;
      let items = id_chunk.map((id) => ({ id, itemType: item_type }));
      let json = await trade_ads_roblox_catalog_items_details(items);
      let wrote = false;
      for (let item of json.data || []) {
        let d = trade_ads_catalog_row_to_detail(item);
        if (!d) continue;
        let s = String(item.id);
        trade_ads_catalog_detail_mem[s] = d;
        out[s] = d;
        wrote = true;
      }
      if (wrote) await flush();
    }
    for (let i = 0; i < need_asset.length; i += 100) {
      await run_batch(
        need_asset.slice(i, i + 100),
        trade_ads_roblox_catalog_item_asset,
      );
    }
    return out;
  });
}

async function trade_ads_pick_random_offer_ids(inv_raw, item_data, owned_set) {
  let seen = new Set();
  let candidates = [];
  for (let row of inv_raw || []) {
    let id = row?.assetId;
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    if (!owned_set.has(id)) continue;
    let rol = get_rolimons_item(item_data, id);
    if (!rol || trade_ads_effective_value(rol) <= 0) continue;
    candidates.push(id);
  }
  if (!candidates.length) {
    throw new Error(
      "No valued tradable items in your inventory for random offers.",
    );
  }
  let details = await trade_ads_resolve_catalog_details_for_ids(candidates);
  let pool = candidates.filter((id) =>
    trade_ads_random_offer_detail_eligible(details[String(id)]),
  );
  if (!pool.length) {
    throw new Error(
      "Random offers only pick accessory items from your inventory. Add some or turn random offers off.",
    );
  }
  trade_ads_shuffle(pool);
  return pool.slice(0, 4);
}

async function trade_ads_resolve_thumb_image_urls(asset_ids) {
  let ids = [
    ...new Set(
      (asset_ids || []).map(Number).filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
  if (!ids.length) return {};
  let out = {};
  for (let i = 0; i < ids.length; i += 100) {
    let chunk = ids.slice(i, i + 100);
    let url = `https://thumbnails.roblox.com/v1/assets?assetIds=${chunk.join(",")}&size=150x150&format=Png&isCircular=false`;
    let res = await fetch(url);
    let data = await res.json().catch(() => ({}));
    if (!res.ok) continue;
    for (let row of data.data || []) {
      let tid = row.targetId;
      if (tid != null && row.imageUrl) out[String(tid)] = row.imageUrl;
    }
  }
  return out;
}

const trade_ads_thumb_cache_storage_key = "trade_ads_thumb_url_cache";
let trade_ads_thumb_cache_mem;
let trade_ads_thumb_cache_mutex = Promise.resolve();

async function trade_ads_thumb_cache_locked(fn) {
  let release;
  let next = new Promise((r) => {
    release = r;
  });
  let prev = trade_ads_thumb_cache_mutex;
  trade_ads_thumb_cache_mutex = next;
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

async function trade_ads_thumb_cache_ensure_loaded() {
  if (trade_ads_thumb_cache_mem !== undefined) return;
  let raw = await get_local_value(trade_ads_thumb_cache_storage_key);
  trade_ads_thumb_cache_mem =
    raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
}

async function trade_ads_thumb_cache_persist() {
  await set_local_value(
    trade_ads_thumb_cache_storage_key,
    trade_ads_thumb_cache_mem,
  );
}

async function trade_ads_thumb_resolve_with_cache(asset_ids) {
  return trade_ads_thumb_cache_locked(async () => {
    await trade_ads_thumb_cache_ensure_loaded();
    let ids = [
      ...new Set(
        (asset_ids || [])
          .map(Number)
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    ];
    if (!ids.length) return {};
    let need_fetch = [];
    let out = {};
    for (let id of ids) {
      let s = String(id);
      let hit = trade_ads_thumb_cache_mem[s];
      if (typeof hit === "string" && hit.length > 0) out[s] = hit;
      else need_fetch.push(id);
    }
    if (need_fetch.length) {
      let fresh = await trade_ads_resolve_thumb_image_urls(need_fetch);
      let wrote = false;
      for (let [k, v] of Object.entries(fresh)) {
        if (typeof v === "string" && v.length > 0) {
          trade_ads_thumb_cache_mem[k] = v;
          wrote = true;
        }
      }
      if (wrote) await trade_ads_thumb_cache_persist();
      for (let id of ids) {
        let s = String(id);
        let u = trade_ads_thumb_cache_mem[s];
        if (typeof u === "string" && u.length > 0) out[s] = u;
      }
    }
    return out;
  });
}

async function trade_ads_thumb_refetch_one(asset_id) {
  let id = Number(asset_id);
  if (!Number.isFinite(id) || id <= 0) return "";
  return trade_ads_thumb_cache_locked(async () => {
    await trade_ads_thumb_cache_ensure_loaded();
    let s = String(id);
    delete trade_ads_thumb_cache_mem[s];
    await trade_ads_thumb_cache_persist();
    let fresh = await trade_ads_resolve_thumb_image_urls([id]);
    let url = fresh[s] || "";
    if (url) trade_ads_thumb_cache_mem[s] = url;
    await trade_ads_thumb_cache_persist();
    return url;
  });
}

function trade_ads_match_item_query(row, q) {
  if (!q) return true;
  let nameLower = String(row[0] || "").toLowerCase();
  let acronym = String(row[1] || "").toLowerCase();
  let hay = `${nameLower} ${acronym}`;
  let tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  return tokens.every((t) => hay.includes(t));
}

async function trade_ads_search_items(item_data, query, limit, offset) {
  limit = Math.max(1, Math.min(200, Number(limit) || 100));
  offset = Math.max(0, Number(offset) || 0);
  let q = String(query || "")
    .trim()
    .toLowerCase();
  let items = item_data?.items || {};
  let rows = [];
  for (let [id, row] of Object.entries(items)) {
    if (!Array.isArray(row)) continue;
    let v = trade_ads_effective_value(row);
    if (v <= 0) continue;
    if (!trade_ads_match_item_query(row, q)) continue;
    let ui = trade_ads_row_ui_metrics(row);
    rows.push({
      id: Number(id),
      name: String(row[0] || ""),
      acronym: String(row[1] || ""),
      value: v,
      valueLine: ui.valueLine,
      rap: ui.rap,
    });
  }
  rows.sort((a, b) => b.value - a.value);
  let total = rows.length;
  let slice = rows.slice(offset, offset + limit);
  return {
    items: slice,
    hasMore: offset + slice.length < total,
    total,
  };
}

async function trade_ads_build_post_body(
  config,
  item_data,
  owned_set,
  inv_raw,
) {
  let offer_ids;
  if (config.offer_random) {
    offer_ids = await trade_ads_pick_random_offer_ids(
      inv_raw || [],
      item_data,
      owned_set,
    );
    if (!offer_ids.length) {
      throw new Error(
        "Random offers could not pick any items. Add accessories or turn random offers off.",
      );
    }
  } else {
    let offer_slots = (config.offer_slots || []).map((x) =>
      x != null ? Number(x) : null,
    );
    offer_ids = offer_slots
      .filter((id) => id != null && owned_set.has(id))
      .slice(0, 4);
    if (!offer_ids.length) {
      throw new Error("Pick at least one item you own in the offering row.");
    }
  }

  let request_item_ids;
  let request_tags;
  if (config.request_random) {
    let exclude = [];
    let prev = await get_local_value(trade_ads_last_random_request_ids_key);
    if (Array.isArray(prev) && prev.length) {
      exclude = prev.map(Number).filter((n) => Number.isFinite(n) && n > 0);
    }
    let roll = trade_ads_pick_random_requests(
      offer_ids,
      item_data,
      Number(config.request_demand_min) || 0,
      exclude,
    );
    if (
      (!roll.requestItemIds || !roll.requestItemIds.length) &&
      exclude.length
    ) {
      roll = trade_ads_pick_random_requests(
        offer_ids,
        item_data,
        Number(config.request_demand_min) || 0,
        [],
      );
    }
    request_item_ids = roll.requestItemIds;
    request_tags = roll.request_tags;
  } else {
    let manual = (config.request_slots || [])
      .map((x) => (x != null ? Number(x) : null))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!manual.length) {
      throw new Error(
        'Choose wanted items, or turn on "Randomize requests each ad".',
      );
    }
    let clamped = trade_ads_clamp_requests(offer_ids, manual, item_data);
    request_item_ids = clamped.ids;
    request_tags = clamped.tags;
  }

  let body = {
    player_id: Number(config.runtime_user_id),
    offer_item_ids: offer_ids,
    request_item_ids: request_item_ids || [],
    request_tags: Array.isArray(request_tags) ? request_tags : [],
  };
  let robux = Math.floor(Number(config.offer_robux) || 0);
  if (robux > 0) body.offer_robux = robux;
  return body;
}

function trade_ads_sum_side_roli_value(asset_ids, item_data) {
  let items = item_data?.items || {};
  let s = 0;
  for (let id of asset_ids || []) {
    let row = items[String(id)];
    if (row) s += trade_ads_effective_value(row);
  }
  return s;
}

async function trade_ads_notify_post_success(_config, body, item_data) {
  let prefs = await trade_ads_get_config_merged();
  if (prefs.notify_on_post === false) return;
  ensure_notification_click_handler();
  if (!chrome.notifications?.create) return;

  let offerItemsVal = trade_ads_sum_side_roli_value(
    body?.offer_item_ids,
    item_data,
  );
  let requestVal = trade_ads_sum_side_roli_value(
    body?.request_item_ids,
    item_data,
  );
  let robux = Math.floor(Number(body?.offer_robux) || 0);
  let offerPart = format_number(offerItemsVal);
  if (robux > 0) offerPart = `${offerPart} + ${format_number(robux)} Robux`;
  let message = `Offering ${offerPart}\nRequesting ${format_number(requestVal)}`;

  let playerId = Math.floor(Number(body?.player_id));
  let nid =
    Number.isFinite(playerId) && playerId > 0
      ? `${trade_ads_notification_prefix}u${playerId}_${Date.now()}`
      : `${trade_ads_notification_prefix}_${Date.now()}`;

  let iconUrl = extension_notification_icon_url("assets/icons/logo128.png");
  await new Promise((resolve) => {
    chrome.notifications.create(
      nid,
      {
        type: "basic",
        iconUrl,
        title: "Posted a trade ad",
        message,
        contextMessage: "Tap to open on Rolimons",
        priority: 2,
      },
      () => {
        let err = chrome.runtime.lastError;
        if (err)
          console.info(
            "Nevos Trading Extension: trade ad notification failed:",
            err.message || err,
          );
        resolve();
      },
    );
  });
}

async function trade_ads_post_now(options) {
  let auth_res = await fetch(
    "https://users.roblox.com/v1/users/authenticated",
    { credentials: "include" },
  );
  if (!auth_res.ok) throw new Error("Sign in to Roblox in this browser first.");
  let me = await auth_res.json();
  if (me.id == null)
    throw new Error("Sign in to Roblox in this browser first.");

  let cookie_header = await trade_ads_resolve_cookie_header();
  if (!cookie_header)
    throw new Error(
      "Rolimons is not connected yet. Finish verification in the Trade ads tab.",
    );

  let stored = await get_local_value(trade_ads_roli_key);
  if (stored?.userId && Number(stored.userId) !== Number(me.id)) {
    throw new Error(
      "Verified Rolimons account does not match the signed-in Roblox user. Verify again on this account.",
    );
  }

  let inv = await trade_ads_fetch_inventory_collectibles(me.id);
  let owned_set = new Set(
    inv.map((x) => x.assetId).filter((n) => Number.isFinite(n)),
  );

  let config = await trade_ads_get_config_merged();
  config.runtime_user_id = me.id;

  let item_data = await get_cached_item_data();
  if (!item_data?.items)
    throw new Error(
      "Item values are still loading. Open the extension again in a few seconds.",
    );

  let body = await trade_ads_build_post_body(config, item_data, owned_set, inv);

  let response = await fetch("https://api.rolimons.com/tradeads/v1/createad", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      cookie: cookie_header.startsWith("_RoliVerification=")
        ? cookie_header
        : `_RoliVerification=${cookie_header}`,
      Referer: "https://www.rolimons.com/",
    },
    body: JSON.stringify(body),
  });
  let data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.error || data?.message || `Post failed (${response.status})`,
    );
  }
  if (
    config.request_random &&
    Array.isArray(body.request_item_ids) &&
    body.request_item_ids.length
  ) {
    await set_local_value(
      trade_ads_last_random_request_ids_key,
      body.request_item_ids
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0),
    );
  } else {
    await set_local_value(trade_ads_last_random_request_ids_key, null);
  }
  await set_local_value("trade_ads_last_auto_post_at", Date.now());
  await set_local_value(trade_ads_schedule_anchor_key, null);
  await set_local_value("trade_ads_last_auto_error", null);
  try {
    await chrome.alarms.clear(trade_ads_clear_error_alarm_name);
  } catch {}
  let out = { ok: true, data, body, player_id: body.player_id };
  try {
    let recent = (await get_local_value(trade_ads_recent_posts_key)) || [];
    let offer_summaries = trade_ads_item_summaries(
      body.offer_item_ids,
      item_data,
    );
    let request_summaries = trade_ads_item_summaries(
      body.request_item_ids,
      item_data,
    );
    console.log("NTE recent post saving:", {
      offer_ids: body.offer_item_ids?.slice(0, 4),
      request_ids: body.request_item_ids?.slice(0, 4),
      offer_summaries: offer_summaries?.slice(0, 4),
      request_summaries: request_summaries?.slice(0, 4),
    });
    recent.unshift({
      at: Date.now(),
      player_id: body.player_id,
      offers: offer_summaries,
      requests: request_summaries,
    });
    if (recent.length > 5) recent = recent.slice(0, 5);
    await set_local_value(trade_ads_recent_posts_key, recent);
  } catch (e) {
    console.error("NTE recent post save failed:", e);
  }
  await trade_ads_notify_post_success(config, body, item_data);
  return out;
}

async function trade_ads_schedule_auto_error_clear() {
  try {
    await chrome.alarms.clear(trade_ads_clear_error_alarm_name);
    await chrome.alarms.create(trade_ads_clear_error_alarm_name, {
      delayInMinutes: 1,
    });
  } catch {}
}

async function trade_ads_auto_post_tick() {
  let cfg = await trade_ads_get_config_merged();
  if (cfg.posting_paused) return;
  let need = cfg.auto_interval_minutes * 60 * 1000;
  let now = Date.now();
  let last = await get_local_value("trade_ads_last_auto_post_at");
  let lastN = typeof last === "number" && Number.isFinite(last) ? last : null;
  if (lastN != null) {
    if (now - lastN < need) return;
  } else {
    let anc = await get_local_value(trade_ads_schedule_anchor_key);
    let ancN = typeof anc === "number" && Number.isFinite(anc) ? anc : null;
    if (ancN == null) {
      await set_local_value(trade_ads_schedule_anchor_key, now);
      return;
    }
    if (now - ancN < need) return;
  }
  try {
    await trade_ads_post_now({ source: "auto" });
  } catch (e) {
    await set_local_value("trade_ads_last_auto_error", String(e?.message || e));
    await trade_ads_schedule_auto_error_clear();
  }
}

async function trade_ads_compute_next_auto_post_due_at() {
  let cfg = await trade_ads_get_config_merged();
  if (cfg.posting_paused) return null;
  let need = cfg.auto_interval_minutes * 60 * 1000;
  let last = await get_local_value("trade_ads_last_auto_post_at");
  let lastN = typeof last === "number" && Number.isFinite(last) ? last : null;
  if (lastN != null) return lastN + need;
  let anc = await get_local_value(trade_ads_schedule_anchor_key);
  let ancN = typeof anc === "number" && Number.isFinite(anc) ? anc : null;
  if (ancN != null) return ancN + need;
  return Date.now() + need;
}

async function trade_ads_sync_alarm() {
  await new Promise((resolve) =>
    chrome.alarms.clear(trade_ads_alarm_name, resolve),
  );
  let raw = await get_local_value(trade_ads_config_key);
  let cfg = trade_ads_normalize_config(raw);
  if (cfg.posting_paused) {
    return;
  }
  let last = await get_local_value("trade_ads_last_auto_post_at");
  let lastN = typeof last === "number" && Number.isFinite(last) ? last : null;
  if (lastN == null) {
    let anc = await get_local_value(trade_ads_schedule_anchor_key);
    let ancN = typeof anc === "number" && Number.isFinite(anc) ? anc : null;
    if (ancN == null) {
      await set_local_value(trade_ads_schedule_anchor_key, Date.now());
    }
  }
  chrome.alarms.create(trade_ads_alarm_name, {
    delayInMinutes: 1,
    periodInMinutes: 1,
  });
}

// Message handlers
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === "trade_ads_get_status") {
    (async () => {
      let auth_res = await fetch(
        "https://users.roblox.com/v1/users/authenticated",
        { credentials: "include" },
      );
      let me = auth_res.ok ? await auth_res.json().catch(() => ({})) : {};
      let roli = await get_local_value(trade_ads_roli_key);
      let verify_ui = (await get_local_value(trade_ads_verify_ui_key)) || {};
      let config = await trade_ads_get_config_merged();
      let cookie_ok = !!(await trade_ads_get_cookie_header_value());
      let verified = false;
      if (
        me?.id != null &&
        roli?.userId != null &&
        Number(roli.userId) === Number(me.id)
      ) {
        verified = !!(roli.cookieHeader || cookie_ok);
      }
      let item_data = await get_cached_item_data();
      let slot_item_metrics = {};
      for (let slot of [
        ...(config.offer_slots || []),
        ...(config.request_slots || []),
      ]) {
        if (slot == null || !Number.isFinite(Number(slot))) continue;
        let aid = Number(slot);
        let row = get_rolimons_item(item_data, aid);
        if (Array.isArray(row))
          slot_item_metrics[String(aid)] = trade_ads_row_ui_metrics(row);
      }
      respond({
        roblox: me?.id != null ? { id: me.id, name: me.name || "" } : null,
        verified,
        roliStored: !!roli?.cookieHeader,
        verify_ui,
        config,
        slot_item_metrics,
        last_auto_error: await get_local_value("trade_ads_last_auto_error"),
        last_auto_post_at: await get_local_value("trade_ads_last_auto_post_at"),
        next_auto_post_due_at: await trade_ads_compute_next_auto_post_due_at(),
        recent_posts: (await get_local_value(trade_ads_recent_posts_key)) || [],
      });
    })();
    return true;
  }

  if (message?.type === "trade_ads_get_next_due") {
    (async () => {
      respond({
        next_auto_post_due_at: await trade_ads_compute_next_auto_post_due_at(),
      });
    })();
    return true;
  }

  if (
    message?.type === "trade_ads_save_config" &&
    message.config &&
    typeof message.config === "object"
  ) {
    (async () => {
      let next = trade_ads_normalize_config(message.config);
      await set_local_value(trade_ads_config_key, next);
      await trade_ads_sync_alarm();
      respond({ ok: true });
    })();
    return true;
  }

  if (message?.type === "trade_ads_get_phrase") {
    (async () => {
      try {
        let auth_res = await fetch(
          "https://users.roblox.com/v1/users/authenticated",
          { credentials: "include" },
        );
        if (!auth_res.ok)
          return respond({ ok: false, error: "Sign in to Roblox first." });
        let me = await auth_res.json();
        if (me.id == null)
          return respond({ ok: false, error: "Sign in to Roblox first." });
        let phrase = await trade_ads_fetch_phrase(me.id);
        respond({ ok: true, phrase, userId: me.id });
      } catch (err) {
        respond({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message?.type === "trade_ads_verify_now") {
    (async () => {
      try {
        let auth_res = await fetch(
          "https://users.roblox.com/v1/users/authenticated",
          { credentials: "include" },
        );
        if (!auth_res.ok)
          return respond({ ok: false, error: "Sign in to Roblox first." });
        let me = await auth_res.json();
        if (me.id == null)
          return respond({ ok: false, error: "Sign in to Roblox first." });
        await trade_ads_verify_via_api(me.id);
        respond({ ok: true });
      } catch (err) {
        respond({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message?.type === "trade_ads_auto_verify") {
    (async () => {
      try {
        let auth_res = await fetch(
          "https://users.roblox.com/v1/users/authenticated",
          { credentials: "include" },
        );
        if (!auth_res.ok)
          return respond({ ok: false, error: "Sign in to Roblox first." });
        let me = await auth_res.json();
        if (me.id == null)
          return respond({ ok: false, error: "Sign in to Roblox first." });
        await trade_ads_auto_verify(me.id);
        respond({ ok: true });
      } catch (err) {
        respond({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message?.type === "trade_ads_disconnect") {
    (async () => {
      await set_local_value(trade_ads_roli_key, null);
      for (let url of [
        "https://www.rolimons.com/",
        "https://rolimons.com/",
        "https://api.rolimons.com/",
      ]) {
        await chrome.cookies.remove({ url, name: "_RoliVerification" });
      }
      respond({ ok: true });
    })();
    return true;
  }

  if (message?.type === "trade_ads_inventory") {
    (async () => {
      try {
        let auth_res = await fetch(
          "https://users.roblox.com/v1/users/authenticated",
          { credentials: "include" },
        );
        if (!auth_res.ok)
          return respond({
            ok: false,
            error: "Sign in to Roblox first.",
            items: [],
          });
        let me = await auth_res.json();
        if (me.id == null)
          return respond({
            ok: false,
            error: "Sign in to Roblox first.",
            items: [],
          });
        let raw = await trade_ads_fetch_inventory_collectibles(me.id);
        let item_data = await get_cached_item_data();
        let enriched = raw.map((x) => {
          let row = get_rolimons_item(item_data, x.assetId);
          let acronym = Array.isArray(row) ? String(row[1] || "") : "";
          let v = row ? trade_ads_effective_value(row) : 0;
          let ui = trade_ads_row_ui_metrics(row);
          return {
            assetId: x.assetId,
            name: x.name || "",
            value: v,
            valueLine: ui.valueLine,
            rap: ui.rap,
            acronym,
          };
        });
        enriched.sort((a, b) => b.value - a.value);
        let seen_ids = new Set();
        let deduped = [];
        for (let x of enriched) {
          let aid = x.assetId;
          if (!Number.isFinite(aid)) continue;
          if (seen_ids.has(aid)) continue;
          seen_ids.add(aid);
          deduped.push(x);
        }
        respond({ ok: true, items: deduped, userId: me.id });
      } catch (err) {
        respond({ ok: false, error: err?.message || String(err), items: [] });
      }
    })();
    return true;
  }

  if (message?.type === "trade_ads_resolve_thumbs") {
    (async () => {
      try {
        let ids = Array.isArray(message.assetIds) ? message.assetIds : [];
        let urls = await trade_ads_thumb_resolve_with_cache(ids);
        respond({ ok: true, urls });
      } catch (err) {
        respond({ ok: false, error: err?.message || String(err), urls: {} });
      }
    })();
    return true;
  }

  if (message?.type === "trade_ads_refetch_thumb") {
    (async () => {
      try {
        let url = await trade_ads_thumb_refetch_one(message.assetId);
        respond({ ok: !!url, url: url || "" });
      } catch (err) {
        respond({ ok: false, error: err?.message || String(err), url: "" });
      }
    })();
    return true;
  }

  if (message?.type === "trade_ads_search_items") {
    (async () => {
      try {
        let item_data = await get_cached_item_data();
        if (!item_data?.items) {
          respond({
            ok: false,
            error: "Item catalog not loaded yet. Wait a moment and try again.",
            items: [],
            hasMore: false,
            total: 0,
          });
          return;
        }
        let limit = Math.min(200, Math.max(16, Number(message.limit) || 100));
        let offset = Math.max(0, Number(message.offset) || 0);
        let result = await trade_ads_search_items(
          item_data,
          message.query,
          limit,
          offset,
        );
        respond({
          ok: true,
          items: result.items,
          hasMore: result.hasMore,
          total: result.total,
        });
      } catch (err) {
        respond({
          ok: false,
          error: err?.message || String(err),
          items: [],
          hasMore: false,
          total: 0,
        });
      }
    })();
    return true;
  }

  if (message?.type === "trade_ads_post") {
    (async () => {
      try {
        let result = await trade_ads_post_now();
        respond({ ok: true, ...result });
      } catch (err) {
        respond({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (
    message?.type === "trade_ads_save_popup_tab" &&
    typeof message.tab === "string"
  ) {
    set_local_value(trade_ads_popup_tab_key, message.tab).then(() =>
      respond({ ok: true }),
    );
    return true;
  }

  if (message?.type === "trade_ads_get_popup_tab") {
    get_local_value(trade_ads_popup_tab_key).then((tab) =>
      respond({ tab: tab || "options" }),
    );
    return true;
  }

  return false;
});

// Alarm handlers
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === trade_ads_clear_error_alarm_name) {
    await set_local_value("trade_ads_last_auto_error", null);
    return;
  }
  if (alarm.name === trade_ads_alarm_name) {
    await trade_ads_auto_post_tick();
    return;
  }
});

// Storage listener
chrome.storage.onChanged.addListener((changes, area_name) => {
  if (area_name !== "local") return;
  if (changes[trade_ads_config_key]) {
    trade_ads_sync_alarm();
  }
});

// Init
chrome.runtime.onInstalled.addListener(async () => {
  await trade_ads_sync_alarm();
});
chrome.runtime.onStartup?.addListener(async () => {
  await trade_ads_sync_alarm();
});
(async () => {
  await trade_ads_sync_alarm();
})();
