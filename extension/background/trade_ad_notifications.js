const trade_ad_notif_state_key = "trade_ad_notifications_state";
const trade_ad_notif_api_url = "https://nevos-extension.com/api/tradeads/recent";
const trade_ad_notif_poll_ms = 190000;
const trade_ad_notif_min_poll_ms = 180000;
const trade_ad_notif_inventory_ttl_ms = 900000;
const trade_ad_notif_max_matches = 48;
const trade_ad_notif_max_seen = 2500;

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
  };
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
    } catch (err) {
      state.lastError = err?.message || String(err);
      state.lastPollAt = Date.now();
      await trade_ad_notif_save_state(state);
      return state;
    }

    let viewer;
    try {
      viewer = await trade_ad_notif_get_viewer_inventory(force);
      state.viewerUserId = viewer.userId;
      state.ownedCount = Number(viewer.slotCount) || viewer.owned.size;
    } catch (err) {
      state.lastError = err?.message || String(err);
      state.lastPollAt = Date.now();
      await trade_ad_notif_save_state(state);
      return state;
    }

    let item_data = await get_cached_item_data();
    let get_row = (id) => get_rolimons_item(item_data, id);

    let ads = Array.isArray(feed.ads) ? feed.ads : [];
    let fresh_ads = ads.filter((ad) => ad?.id != null && !seen.has(String(ad.id)));
    let new_matches = TradeAdNotificationsCore.scan_ads_for_matches(
      fresh_ads,
      viewer.owned,
      get_row,
      viewer.userId,
    );

    if (new_matches.length) {
      state.matches = trade_ad_notif_merge_matches(state.matches, new_matches);
    }

    for (let ad of fresh_ads) {
      if (ad?.id != null) seen.add(String(ad.id));
    }
    state.seenAdIds = trade_ad_notif_trim_seen(Array.from(seen));
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
      respond({ ok: true, state: await trade_ad_notif_load_state() });
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
      if (!next_enabled) next.lastError = "";
      await trade_ad_notif_save_state(next);
      if (next_enabled) {
        let polled = await trade_ad_notif_poll_once({ force: true });
        respond({ ok: true, state: polled });
        return;
      }
      respond({ ok: true, state: next });
    })().catch((err) => {
      respond({ ok: false, error: err?.message || String(err) });
    });
    return true;
  }

  return false;
}

trade_ad_notif_init_monitor();
