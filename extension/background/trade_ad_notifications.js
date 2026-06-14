const trade_ad_notif_state_key = "trade_ad_notifications_state";
const trade_ad_notif_api_url = "https://nevos-extension.com/api/tradeads/recent";
const trade_ad_notif_poll_ms = 60000;
const trade_ad_notif_min_poll_ms = 60000;
const trade_ad_notif_inventory_ttl_ms = 900000;
const trade_ad_notif_max_matches = 120;
const trade_ad_notif_max_seen = 2500;
const trade_ad_notif_load_more_batch = 60;

let trade_ad_notif_poll_timer = null;
let trade_ad_notif_poll_in_flight = false;
let trade_ad_notif_inventory_cache = {
  userId: null,
  owned: null,
  itemMeta: null,
  slotCount: 0,
  fetchedAt: 0,
};

function trade_ad_notif_default_state() {
  return {
    enabled: false,
    matches: [],
    seenAdIds: [],
    lastPollAt: 0,
    lastFeedFetchedAt: 0,
    lastError: "",
    viewerUserId: null,
    ownedCount: 0,
    ignoredUsers: [],
    disabledWantItemIds: [],
    watchableItemCount: 0,
    feedScanOffset: 0,
    feedScanFetchedAt: 0,
    feedExhausted: false,
    feedAdCount: 0,
    feedAdsChecked: 0,
  };
}

function trade_ad_notif_cap_feed_checked(state) {
  let total = Math.max(0, Number(state?.feedAdCount) || 0);
  let checked = Math.max(
    Number(state?.feedAdsChecked) || 0,
    Number(state?.feedScanOffset) || 0,
  );
  state.feedAdsChecked = total > 0 ? Math.min(total, checked) : checked;
}

function trade_ad_notif_mark_feed_checked(state, count) {
  let add = Math.max(0, Number(count) || 0);
  if (!add) return;
  state.feedAdsChecked = (Number(state.feedAdsChecked) || 0) + add;
  trade_ad_notif_cap_feed_checked(state);
}

function trade_ad_notif_sync_feed_scan_complete(state, ads) {
  let total = Array.isArray(ads) ? ads.length : 0;
  if (total <= 0) return;
  if ((Number(state.feedAdsChecked) || 0) >= total) {
    state.feedScanOffset = total;
    state.feedExhausted = true;
    trade_ad_notif_cap_feed_checked(state);
  }
}

async function trade_ad_notif_get_item_data_for_scan() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      await sync_item_data_from_server();
    } catch {}
    let item_data = await get_cached_item_data(trade_ad_item_data_max_age_ms);
    if (item_data?.items && Object.keys(item_data.items).length > 0) {
      return item_data;
    }
    try {
      let fresh = await fetch_item_data();
      if (fresh?.items && Object.keys(fresh.items).length > 0) {
        return await cache_item_data(fresh);
      }
    } catch {}
    await sleep_for(500);
  }
  throw new Error(
    "Rolimons item values are not loaded yet. Wait a few seconds, then toggle alerts off and on.",
  );
}

async function trade_ad_notif_get_scan_context(force_inventory) {
  let viewer = await trade_ad_notif_get_viewer_inventory(force_inventory);
  if (!viewer.owned?.size) {
    throw new Error(
      "No tradable items found. Check that you are signed into Roblox and your inventory is visible for trading.",
    );
  }
  let item_data = await trade_ad_notif_get_item_data_for_scan();
  return {
    viewer,
    item_data,
    get_row: (id) => {
      let meta = viewer.itemMeta?.[String(id)];
      return get_rolimons_item(item_data, id, meta?.name);
    },
  };
}

function trade_ad_notif_apply_scan_results(
  state,
  ads,
  batch,
  viewer,
  get_row,
  ignored_users,
) {
  state.watchableItemCount = viewer.owned.size;
  let owned = trade_ad_notif_owned_for_scan(viewer.owned, state.disabledWantItemIds);

  state.matches = trade_ad_notif_filter_matches_by_ignored_users(
    trade_ad_notif_rescore_matches(state, viewer.owned, get_row, viewer.userId),
    ignored_users,
  );

  let new_matches = TradeAdNotificationsCore.scan_ads_for_matches(
    batch,
    owned,
    get_row,
    viewer.userId,
  );
  new_matches = trade_ad_notif_filter_matches_by_disabled_items(
    trade_ad_notif_filter_matches_by_ignored_users(new_matches, ignored_users),
    state.disabledWantItemIds,
  );
  if (new_matches.length) {
    state.matches = trade_ad_notif_filter_matches_by_ignored_users(
      trade_ad_notif_merge_matches(state.matches, new_matches),
      ignored_users,
    );
  }

  trade_ad_notif_mark_feed_checked(state, batch.length);
  trade_ad_notif_sync_feed_scan_complete(state, ads);
}

async function trade_ad_notif_backfill_feed(state, max_batches = 30) {
  for (let i = 0; i < max_batches; i++) {
    if (!state.enabled || state.feedExhausted) break;
    state = await trade_ad_notif_load_more_once();
    if (state.lastError) break;
  }
  if (state.enabled) {
    state.lastPollAt = Date.now();
    await trade_ad_notif_save_state(state);
  }
  return state;
}

async function trade_ad_notif_load_state() {
  let raw = await get_local_value(trade_ad_notif_state_key);
  if (!raw || typeof raw !== "object") return trade_ad_notif_default_state();
  return {
    ...trade_ad_notif_default_state(),
    ...raw,
    matches: Array.isArray(raw.matches) ? raw.matches : [],
    seenAdIds: Array.isArray(raw.seenAdIds) ? raw.seenAdIds : [],
  };
}

async function trade_ad_notif_save_state(state) {
  await set_local_value(trade_ad_notif_state_key, state);
}

function trade_ad_notif_normalize_ignored_users(input) {
  let out = [];
  let seen = new Set();
  let list = Array.isArray(input) ? input : [];
  for (let raw of list) {
    let value = String(raw || "").trim();
    if (!value) continue;
    let key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.slice(0, 200);
}

function trade_ad_notif_ignored_user_set(ignored_users) {
  return new Set(
    trade_ad_notif_normalize_ignored_users(ignored_users).map((name) =>
      name.toLowerCase(),
    ),
  );
}

function trade_ad_notif_filter_matches_by_ignored_users(matches, ignored_users) {
  let blocked = trade_ad_notif_ignored_user_set(ignored_users);
  if (!blocked.size) return Array.isArray(matches) ? matches : [];
  return (Array.isArray(matches) ? matches : []).filter((match) => {
    let username = String(match?.username || "")
      .trim()
      .toLowerCase();
    return username ? !blocked.has(username) : true;
  });
}

function trade_ad_notif_normalize_disabled_want_items(input) {
  let out = [];
  let seen = new Set();
  for (let raw of Array.isArray(input) ? input : []) {
    let num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) continue;
    let key = String(num);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out.slice(0, 500);
}

function trade_ad_notif_disabled_want_set(disabled_want_items) {
  return new Set(trade_ad_notif_normalize_disabled_want_items(disabled_want_items));
}

function trade_ad_notif_owned_for_scan(owned_ids, disabled_want_items) {
  let disabled = trade_ad_notif_disabled_want_set(disabled_want_items);
  if (!disabled.size || !(owned_ids instanceof Set)) return owned_ids;
  let out = new Set();
  for (let id of owned_ids) {
    if (!disabled.has(String(id))) out.add(String(id));
  }
  return out;
}

function trade_ad_notif_filter_matches_by_disabled_items(
  matches,
  disabled_want_items,
) {
  let blocked = trade_ad_notif_disabled_want_set(disabled_want_items);
  if (!blocked.size) return Array.isArray(matches) ? matches : [];
  return (Array.isArray(matches) ? matches : []).filter((match) => {
    let wanted_id = match?.wantedItemId ?? match?.wantedItem?.id;
    if (wanted_id == null) return true;
    return !blocked.has(String(wanted_id));
  });
}

function trade_ad_notif_filter_matches(state) {
  return trade_ad_notif_filter_matches_by_disabled_items(
    trade_ad_notif_filter_matches_by_ignored_users(
      state.matches,
      state.ignoredUsers,
    ),
    state.disabledWantItemIds,
  );
}

function trade_ad_notif_state_for_ui(state) {
  if (!state || typeof state !== "object") return state;
  return {
    ...state,
    matches: trade_ad_notif_filter_matches(state),
  };
}

function trade_ad_notif_rescore_matches(state, owned_ids, get_row, viewer_user_id) {
  let owned = owned_ids instanceof Set ? owned_ids : new Set();
  return TradeAdNotificationsCore.rescore_stored_matches(
    state.matches,
    owned,
    get_row,
    viewer_user_id,
  );
}

async function trade_ad_notif_rescan_feed_for_want_items(
  state,
  want_item_ids,
  viewer,
  get_row,
  ignored_users,
) {
  let targets = (Array.isArray(want_item_ids) ? want_item_ids : [])
    .map((id) => String(id))
    .filter((id) => id && id !== "0");
  if (!targets.length) return;

  let feed;
  try {
    feed = await trade_ad_notif_fetch_feed();
  } catch {
    return;
  }

  let want_set = new Set(targets);
  let ads = (Array.isArray(feed.ads) ? feed.ads : []).filter((ad) => {
    let wanted_id = ad?.want?.itemIds?.[0];
    return wanted_id != null && want_set.has(String(wanted_id));
  });
  if (!ads.length) return;

  let owned = trade_ad_notif_owned_for_scan(viewer.owned, state.disabledWantItemIds);
  let found = TradeAdNotificationsCore.scan_ads_for_matches(
    ads,
    owned,
    get_row,
    viewer.userId,
  );
  found = trade_ad_notif_filter_matches_by_ignored_users(found, ignored_users);
  if (!found.length) return;

  let seen = new Set((state.seenAdIds || []).map((id) => String(id)));
  for (let ad of ads) {
    if (ad?.id != null) seen.delete(String(ad.id));
  }
  state.seenAdIds = trade_ad_notif_trim_seen(Array.from(seen));
  state.matches = trade_ad_notif_merge_matches(state.matches, found);
}

function trade_ad_notif_normalize_label(value) {
  return String(value || "")
    .replace(/\s*#\d+\s*$/g, "")
    .toLowerCase()
    .replace(/[#,()\-:'`"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function trade_ad_notif_find_bundle_thumb_id(
  item_data,
  asset_id,
  name,
  acronym,
) {
  if (!item_data?.bundleIds || !item_data?.items) return null;
  let key = String(asset_id);
  if (item_data.bundleIds[key]) return key;

  let labels = new Set();
  for (let raw of [acronym, name]) {
    let norm = trade_ad_notif_normalize_label(raw);
    if (norm) labels.add(norm);
  }
  if (!labels.size) return null;

  for (let rid of Object.keys(item_data.bundleIds)) {
    let row = item_data.items[rid];
    if (!Array.isArray(row)) continue;
    let row_name = trade_ad_notif_normalize_label(row[0]);
    let row_acr = trade_ad_notif_normalize_label(row[1]);
    if (labels.has(row_name) || labels.has(row_acr)) return rid;
  }
  return null;
}

function trade_ad_notif_resolve_thumb_fields(
  asset_id,
  item_data,
  item_meta,
  summary,
) {
  let key = String(asset_id);
  let meta = item_meta?.[key] || {};
  let name = String(summary?.name || meta.name || "").trim();
  let acronym = String(summary?.acronym || "").trim();
  let bundle_key = trade_ad_notif_find_bundle_thumb_id(
    item_data,
    asset_id,
    name,
    acronym,
  );
  if (bundle_key) {
    return { thumbId: Number(bundle_key), thumbType: "Bundle" };
  }
  if (meta.itemType === "Bundle" || item_data?.bundleIds?.[key]) {
    return { thumbId: Number(asset_id), thumbType: "Bundle" };
  }
  return { thumbId: Number(asset_id), thumbType: "Asset" };
}

async function trade_ad_notif_get_watch_items_payload() {
  let state = await trade_ad_notif_load_state();
  let disabled = trade_ad_notif_disabled_want_set(state.disabledWantItemIds);
  let ctx = await trade_ad_notif_get_scan_context(false);
  let get_row = ctx.get_row;
  let item_data = ctx.item_data;
  let items = [];
  for (let id of ctx.viewer.owned) {
    let num = Number(id);
    if (!Number.isFinite(num) || num <= 0) continue;
    let summary = TradeAdNotificationsCore.item_summary_from_row(
      num,
      get_row(num),
    );
    let label = String(summary.acronym || summary.name || `Item ${num}`).trim();
    let thumb = trade_ad_notif_resolve_thumb_fields(
      num,
      item_data,
      ctx.viewer.itemMeta,
      summary,
    );
    items.push({
      id: num,
      name: String(summary.name || label),
      acronym: String(summary.acronym || ""),
      value: Number(summary.value) || 0,
      thumbId: thumb.thumbId,
      thumbType: thumb.thumbType,
      enabled: !disabled.has(String(num)),
    });
  }
  items.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return String(a.name).localeCompare(String(b.name));
  });
  let enabled_count = items.filter((row) => row.enabled).length;
  return {
    items,
    enabledCount: enabled_count,
    totalCount: items.length,
    disabledWantItemIds: Array.from(disabled),
  };
}

function trade_ad_notif_trim_seen(seen) {
  let list = Array.isArray(seen) ? seen.slice() : [];
  if (list.length <= trade_ad_notif_max_seen) return list;
  return list.slice(list.length - trade_ad_notif_max_seen);
}

function trade_ad_notif_merge_matches(existing, incoming) {
  let by_id = new Map();
  for (let row of Array.isArray(existing) ? existing : []) {
    if (row?.adId != null) by_id.set(String(row.adId), row);
  }
  for (let row of Array.isArray(incoming) ? incoming : []) {
    if (row?.adId == null) continue;
    let key = String(row.adId);
    let prev = by_id.get(key);
    if (!prev || Number(row.matchedAt) >= Number(prev.matchedAt)) {
      by_id.set(key, row);
    }
  }
  return Array.from(by_id.values())
    .sort((a, b) => Number(b.matchedAt) - Number(a.matchedAt))
    .slice(0, trade_ad_notif_max_matches);
}

function trade_ad_notif_asset_id_from_tradable_row(row) {
  let target_id = parseInt(
    row?.itemTarget?.targetId ?? row?.assetId ?? row?.id ?? 0,
    10,
  );
  return Number.isFinite(target_id) && target_id > 0 ? target_id : 0;
}

function trade_ad_notif_thumb_type_from_row(row) {
  let kind = String(
    row?.itemTarget?.itemType || row?.itemType || "Asset",
  ).trim();
  return kind === "Bundle" ? "Bundle" : "Asset";
}

async function trade_ad_notif_fetch_tradable_inventory(user_id) {
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

    let url = `https://trades.roblox.com/v2/users/${user_id}/tradableitems?${params.toString()}`;
    let res = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await fetch(url, { credentials: "include" });
      } catch {
        res = null;
      }
      if (res && res.status !== 429 && res.status < 500) break;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
      }
    }

    if (!res) {
      if (items.length) break;
      throw new Error("Could not load your tradable inventory.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Tradable inventory is private. Allow inventory visibility in Roblox privacy settings.",
      );
    }
    if (res.status === 500 && limit === "100") {
      limit = "50";
      continue;
    }
    if (!res.ok) {
      if (items.length) break;
      throw new Error(`Tradable inventory unavailable (${res.status}).`);
    }

    let data = await res.json().catch(() => null);
    if (!data) {
      if (items.length) break;
      throw new Error("Tradable inventory returned invalid data.");
    }

    items = items.concat(Array.isArray(data?.items) ? data.items : []);
    cursor = data?.nextPageCursor || "";
    if (!cursor) break;
  }

  let owned = new Set();
  let item_meta = {};
  for (let row of items) {
    let asset_id = trade_ad_notif_asset_id_from_tradable_row(row);
    if (asset_id > 0) {
      let key = String(asset_id);
      owned.add(key);
      item_meta[key] = {
        itemType: trade_ad_notif_thumb_type_from_row(row),
        name: String(row.itemName || row.name || "").trim(),
      };
    }
  }
  return { owned, itemMeta: item_meta, slotCount: items.length };
}

async function trade_ad_notif_get_viewer_inventory(force_refresh) {
  let auth_res = await fetch("https://users.roblox.com/v1/users/authenticated", {
    credentials: "include",
  });
  if (!auth_res.ok) throw new Error("Sign in to Roblox to scan trade ads.");
  let me = await auth_res.json();
  if (me?.id == null) throw new Error("Sign in to Roblox to scan trade ads.");

  let cache = trade_ad_notif_inventory_cache;
  let cache_fresh =
    !force_refresh &&
    cache.userId === me.id &&
    cache.owned instanceof Set &&
    cache.owned.size > 0 &&
    Number(cache.slotCount) > 0 &&
    Date.now() - Number(cache.fetchedAt) < trade_ad_notif_inventory_ttl_ms;
  if (cache_fresh) {
    return {
      userId: me.id,
      owned: cache.owned,
      itemMeta: cache.itemMeta || {},
      slotCount: Number(cache.slotCount) || cache.owned.size,
    };
  }

  let inv = await trade_ad_notif_fetch_tradable_inventory(me.id);
  let owned = inv.owned;
  let item_meta = inv.itemMeta || {};
  let slot_count = inv.slotCount;

  trade_ad_notif_inventory_cache = {
    userId: me.id,
    owned,
    itemMeta: item_meta,
    slotCount: slot_count,
    fetchedAt: Date.now(),
  };
  return { userId: me.id, owned, itemMeta: item_meta, slotCount: slot_count };
}

async function trade_ad_notif_fetch_feed() {
  let res = await fetch(trade_ad_notif_api_url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Trade ads feed unavailable (${res.status})`);
  }
  let body = await res.json();
  if (!body || body.ok === false) {
    throw new Error(body?.error || "Trade ads feed returned an error.");
  }
  return body;
}

async function trade_ad_notif_load_more_once() {
  let state = await trade_ad_notif_load_state();
  if (!state.enabled) return state;

  let feed;
  try {
    feed = await trade_ad_notif_fetch_feed();
    state.lastError = "";
  } catch (err) {
    state.lastError = err?.message || String(err);
    await trade_ad_notif_save_state(state);
    return state;
  }

  let ads = Array.isArray(feed.ads) ? feed.ads : [];
  state.feedAdCount = ads.length;
  let fetched_at = Number(feed.fetchedAt) || Date.now();
  if (fetched_at !== Number(state.feedScanFetchedAt || 0)) {
    state.feedScanFetchedAt = fetched_at;
    state.feedScanOffset = 0;
    state.feedExhausted = false;
    state.feedAdsChecked = 0;
  }

  let offset = Math.max(0, Number(state.feedScanOffset) || 0);
  if (offset >= ads.length) {
    state.feedExhausted = true;
    await trade_ad_notif_save_state(state);
    return state;
  }

  let batch = ads.slice(offset, offset + trade_ad_notif_load_more_batch);
  if (!batch.length) {
    state.feedExhausted = true;
    await trade_ad_notif_save_state(state);
    return state;
  }

  let viewer;
  let get_row;
  try {
    let ctx = await trade_ad_notif_get_scan_context(false);
    viewer = ctx.viewer;
    get_row = ctx.get_row;
    state.viewerUserId = viewer.userId;
    state.ownedCount = Number(viewer.slotCount) || viewer.owned.size;
    state.lastError = "";
  } catch (err) {
    state.lastError = err?.message || String(err);
    await trade_ad_notif_save_state(state);
    return state;
  }

  let ignored_users = trade_ad_notif_normalize_ignored_users(state.ignoredUsers);
  state.ignoredUsers = ignored_users;
  trade_ad_notif_apply_scan_results(
    state,
    ads,
    batch,
    viewer,
    get_row,
    ignored_users,
  );

  state.feedScanOffset = offset + batch.length;
  state.feedExhausted = state.feedScanOffset >= ads.length;
  trade_ad_notif_cap_feed_checked(state);

  await trade_ad_notif_save_state(state);
  return state;
}

async function trade_ad_notif_poll_once(options) {
  let force = !!(options && options.force);
  if (trade_ad_notif_poll_in_flight) return trade_ad_notif_load_state();
  let existing = await trade_ad_notif_load_state();
  if (!existing.enabled) {
    if (existing.lastError) {
      existing.lastError = "";
      await trade_ad_notif_save_state(existing);
    }
    return existing;
  }
  if (!force) {
    let since = Date.now() - Number(existing.lastPollAt || 0);
    if (since >= 0 && since < trade_ad_notif_min_poll_ms) {
      return existing;
    }
  }
  trade_ad_notif_poll_in_flight = true;
  try {
    let state = await trade_ad_notif_load_state();
    let seen = new Set((state.seenAdIds || []).map((id) => String(id)));

    let feed;
    try {
      feed = await trade_ad_notif_fetch_feed();
      state.lastError = "";
      state.lastFeedFetchedAt = Number(feed.fetchedAt) || Date.now();
      if (
        Number(state.feedScanFetchedAt || 0) !== Number(state.lastFeedFetchedAt)
      ) {
        state.feedScanFetchedAt = Number(state.lastFeedFetchedAt);
        state.feedScanOffset = 0;
        state.feedExhausted = false;
        state.feedAdsChecked = 0;
      }
    } catch (err) {
      state.lastError = err?.message || String(err);
      state.lastPollAt = Date.now();
      await trade_ad_notif_save_state(state);
      return state;
    }

    let viewer;
    let get_row;
    try {
      let ctx = await trade_ad_notif_get_scan_context(force);
      viewer = ctx.viewer;
      get_row = ctx.get_row;
      state.viewerUserId = viewer.userId;
      state.ownedCount = Number(viewer.slotCount) || viewer.owned.size;
      state.lastError = "";
    } catch (err) {
      state.lastError = err?.message || String(err);
      state.lastPollAt = Date.now();
      await trade_ad_notif_save_state(state);
      return state;
    }

    let ignored_users = trade_ad_notif_normalize_ignored_users(state.ignoredUsers);
    state.ignoredUsers = ignored_users;

    let ads = Array.isArray(feed.ads) ? feed.ads : [];
    state.feedAdCount = ads.length;
    let fresh_ads = ads.filter((ad) => ad?.id != null && !seen.has(String(ad.id)));
    if (fresh_ads.length) {
      trade_ad_notif_apply_scan_results(
        state,
        ads,
        fresh_ads,
        viewer,
        get_row,
        ignored_users,
      );
      for (let ad of fresh_ads) {
        if (ad?.id != null) seen.add(String(ad.id));
      }
      state.seenAdIds = trade_ad_notif_trim_seen(Array.from(seen));
    } else {
      state.watchableItemCount = viewer.owned.size;
      state.matches = trade_ad_notif_filter_matches_by_ignored_users(
        trade_ad_notif_rescore_matches(state, viewer.owned, get_row, viewer.userId),
        ignored_users,
      );
    }
    state.lastPollAt = Date.now();
    await trade_ad_notif_save_state(state);
    return state;
  } finally {
    trade_ad_notif_poll_in_flight = false;
  }
}

function trade_ad_notif_schedule_poll() {
  if (trade_ad_notif_poll_timer != null) {
    clearTimeout(trade_ad_notif_poll_timer);
  }
  trade_ad_notif_poll_timer = setTimeout(async () => {
    try {
      await trade_ad_notif_poll_once();
    } catch {}
    trade_ad_notif_schedule_poll();
  }, trade_ad_notif_poll_ms);
}

function trade_ad_notif_init_monitor() {
  if (globalThis.__trade_ad_notif_monitor_started) return;
  globalThis.__trade_ad_notif_monitor_started = true;
  trade_ad_notif_schedule_poll();
  setTimeout(() => {
    trade_ad_notif_poll_once().catch(() => {});
  }, 4000);
}

function trade_ad_notif_handle_message(message, respond) {
  if (message?.type === "trade_ad_notifications_get_state") {
    (async () => {
      let state = await trade_ad_notif_load_state();
      state.ignoredUsers = trade_ad_notif_normalize_ignored_users(
        state.ignoredUsers,
      );
      state.disabledWantItemIds = trade_ad_notif_normalize_disabled_want_items(
        state.disabledWantItemIds,
      );
      respond({ ok: true, state: trade_ad_notif_state_for_ui(state) });
    })();
    return true;
  }

  if (message?.type === "trade_ad_notifications_poll_now") {
    (async () => {
      try {
        let state = await trade_ad_notif_poll_once({
          force: message.force === true,
        });
        respond({
          ok: true,
          state: trade_ad_notif_state_for_ui(state),
        });
      } catch (err) {
        respond({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message?.type === "trade_ad_notifications_clear") {
    (async () => {
      let prev = await trade_ad_notif_load_state();
      let state = trade_ad_notif_default_state();
      state.enabled = prev.enabled === true;
      await trade_ad_notif_save_state(state);
      respond({ ok: true, state });
    })();
    return true;
  }

  if (message?.type === "trade_ad_notifications_set_enabled") {
    (async () => {
      let prev = await trade_ad_notif_load_state();
      let next_enabled = message.enabled === true;
      let next = {
        ...prev,
        enabled: next_enabled,
      };
      if (!next_enabled) {
        next.lastError = "";
      } else {
        next.feedScanOffset = 0;
        next.feedExhausted = false;
        next.feedAdsChecked = 0;
        next.feedScanFetchedAt = 0;
        next.seenAdIds = [];
        next.matches = [];
        next.lastError = "";
      }
      if (next_enabled) {
        next.lastPollAt = Date.now();
      }
      await trade_ad_notif_save_state(next);
      if (next_enabled) {
        let state = await trade_ad_notif_backfill_feed(next);
        respond({ ok: true, state: trade_ad_notif_state_for_ui(state) });
        return;
      }
      respond({ ok: true, state: trade_ad_notif_state_for_ui(next) });
    })().catch((err) => {
      respond({ ok: false, error: err?.message || String(err) });
    });
    return true;
  }

  if (message?.type === "trade_ad_notifications_load_more") {
    (async () => {
      try {
        let state = await trade_ad_notif_load_more_once();
        respond({ ok: true, state: trade_ad_notif_state_for_ui(state) });
      } catch (err) {
        respond({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message?.type === "trade_ad_notifications_set_ignored_users") {
    (async () => {
      let prev = await trade_ad_notif_load_state();
      let ignored_users = trade_ad_notif_normalize_ignored_users(
        message.ignoredUsers,
      );
      let next = {
        ...prev,
        ignoredUsers: ignored_users,
        matches: trade_ad_notif_filter_matches_by_ignored_users(
          prev.matches,
          ignored_users,
        ),
      };
      await trade_ad_notif_save_state(next);
      respond({ ok: true, state: trade_ad_notif_state_for_ui(next) });
    })().catch((err) => {
      respond({ ok: false, error: err?.message || String(err) });
    });
    return true;
  }

  if (message?.type === "trade_ad_notifications_get_watch_items") {
    (async () => {
      try {
        let payload = await trade_ad_notif_get_watch_items_payload();
        respond({ ok: true, ...payload });
      } catch (err) {
        respond({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message?.type === "trade_ad_notifications_set_disabled_want_items") {
    (async () => {
      let prev = await trade_ad_notif_load_state();
      let prev_disabled = trade_ad_notif_normalize_disabled_want_items(
        prev.disabledWantItemIds,
      );
      let next_disabled = trade_ad_notif_normalize_disabled_want_items(
        message.disabledWantItemIds,
      );
      let prev_set = new Set(prev_disabled);
      let next_set = new Set(next_disabled);
      let re_enabled = prev_disabled.filter((id) => !next_set.has(id));
      let ignored_users = trade_ad_notif_normalize_ignored_users(prev.ignoredUsers);

      let next = {
        ...prev,
        ignoredUsers: ignored_users,
        disabledWantItemIds: next_disabled,
      };

      if (re_enabled.length && next.enabled === true) {
        try {
          let ctx = await trade_ad_notif_get_scan_context(false);
          next.watchableItemCount = ctx.viewer.owned.size;
          await trade_ad_notif_rescan_feed_for_want_items(
            next,
            re_enabled,
            ctx.viewer,
            ctx.get_row,
            ignored_users,
          );
          next.matches = trade_ad_notif_filter_matches_by_ignored_users(
            trade_ad_notif_rescore_matches(
              next,
              ctx.viewer.owned,
              ctx.get_row,
              ctx.viewer.userId,
            ),
            ignored_users,
          );
          next.lastError = "";
        } catch (err) {
          next.lastError = err?.message || String(err);
        }
      }

      await trade_ad_notif_save_state(next);
      respond({ ok: true, state: trade_ad_notif_state_for_ui(next) });
    })().catch((err) => {
      respond({ ok: false, error: err?.message || String(err) });
    });
    return true;
  }

  return false;
}

trade_ad_notif_init_monitor();
