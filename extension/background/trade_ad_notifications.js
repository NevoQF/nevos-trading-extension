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
    get_row: (id) => get_rolimons_item(item_data, id),
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
  state.matches = trade_ad_notif_filter_matches_by_ignored_users(
    TradeAdNotificationsCore.rescore_stored_matches(
      state.matches,
      viewer.owned,
      get_row,
      viewer.userId,
    ),
    ignored_users,
  );

  let new_matches = TradeAdNotificationsCore.scan_ads_for_matches(
    batch,
    viewer.owned,
    get_row,
    viewer.userId,
  );
  new_matches = trade_ad_notif_filter_matches_by_ignored_users(
    new_matches,
    ignored_users,
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
  for (let row of items) {
    let asset_id = trade_ad_notif_asset_id_from_tradable_row(row);
    if (asset_id > 0) owned.add(String(asset_id));
  }
  return { owned, slotCount: items.length };
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
      slotCount: Number(cache.slotCount) || cache.owned.size,
    };
  }

  let inv = await trade_ad_notif_fetch_tradable_inventory(me.id);
  let owned = inv.owned;
  let slot_count = inv.slotCount;

  trade_ad_notif_inventory_cache = {
    userId: me.id,
    owned,
    slotCount: slot_count,
    fetchedAt: Date.now(),
  };
  return { userId: me.id, owned, slotCount: slot_count };
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
      state.matches = trade_ad_notif_filter_matches_by_ignored_users(
        TradeAdNotificationsCore.rescore_stored_matches(
          state.matches,
          viewer.owned,
          get_row,
          viewer.userId,
        ),
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
      state.matches = trade_ad_notif_filter_matches_by_ignored_users(
        state.matches,
        state.ignoredUsers,
      );
      respond({ ok: true, state });
    })();
    return true;
  }

  if (message?.type === "trade_ad_notifications_poll_now") {
    (async () => {
      try {
        let state = await trade_ad_notif_poll_once({
          force: message.force === true,
        });
        respond({ ok: true, state });
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
      await trade_ad_notif_save_state(next);
      if (next_enabled) {
        let state = await trade_ad_notif_backfill_feed(next);
        respond({ ok: true, state });
        return;
      }
      respond({ ok: true, state: next });
    })().catch((err) => {
      respond({ ok: false, error: err?.message || String(err) });
    });
    return true;
  }

  if (message?.type === "trade_ad_notifications_load_more") {
    (async () => {
      try {
        let state = await trade_ad_notif_load_more_once();
        respond({ ok: true, state });
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
      respond({ ok: true, state: next });
    })().catch((err) => {
      respond({ ok: false, error: err?.message || String(err) });
    });
    return true;
  }

  return false;
}

trade_ad_notif_init_monitor();
