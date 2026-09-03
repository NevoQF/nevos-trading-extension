(() => {
  const style_id = "nte-friends-value-style";
  const option_name = "Values on User Pages";
  const profile_value_mode_key = "profile_value_display_mode";
  const values_to_use_key = "values_to_use";
  const inventory_cache = {};
  const inventory_pending = {};
  const totals_cache = {};
  let rolimons_data = null;
  let rolimons_loading = null;
  let routility_data = null;
  let routility_loading = null;
  let values_to_use_cache = "rolimons";
  let enabled = false;
  let sync_timer = null;
  let click_bound = false;

  function send_message(msg) {
    return new Promise((resolve) => {
      try {
        const result = chrome.runtime.sendMessage(msg, (response) => {
          resolve(response);
        });
        if (result && typeof result.then === "function") {
          result.then(resolve, () => resolve(null));
        }
      } catch {
        resolve(null);
      }
    });
  }

  function get_option(name) {
    return new Promise((resolve) => {
      chrome.storage.local.get([name], (result) => {
        resolve(result?.[name]);
      });
    });
  }

  function commafy(num) {
    return Math.round(Number(num) || 0)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function is_friends_value_view() {
    const hash = String(location.hash || "").toLowerCase();
    const path = String(location.pathname || "").toLowerCase();
    if (!/\/users(?:\/\d+)?\/friends\/?$/i.test(path)) return false;
    if (/^#!\/?(friends|following|followers|trusted-friends)$/i.test(hash))
      return true;
    if (/friend-requests/i.test(hash)) return true;
    return (
      /\/users\/friends\/?$/i.test(path) &&
      (!hash || hash === "#" || hash === "#!")
    );
  }

  async function ensure_rolimons_data() {
    if (rolimons_data) return rolimons_data;
    if (rolimons_loading) return rolimons_loading;
    rolimons_loading = send_message(
      rolimons_data ? "getDataPeriodic" : "getData",
    ).then((data) => {
      if (data) rolimons_data = data;
      rolimons_loading = null;
      return rolimons_data;
    });
    return rolimons_loading;
  }

  async function ensure_routility_data() {
    if (routility_data) return routility_data;
    if (routility_loading) return routility_loading;
    routility_loading = send_message(
      routility_data ? "getRoutilityDataPeriodic" : "getRoutilityData",
    ).then((data) => {
      if (data) routility_data = data;
      routility_loading = null;
      return routility_data;
    });
    return routility_loading;
  }

  function sync_values_to_use_cache(value) {
    values_to_use_cache =
      String(value || "").toLowerCase() === "routility"
        ? "routility"
        : "rolimons";
  }

  try {
    chrome.storage.local.get([values_to_use_key], (result) => {
      sync_values_to_use_cache(result?.[values_to_use_key]);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[values_to_use_key]) return;
      sync_values_to_use_cache(changes[values_to_use_key].newValue);
      Object.keys(totals_cache).forEach((key) => delete totals_cache[key]);
    });
  } catch {}

  function get_rolimons_item(item_id, item_name) {
    if (
      typeof RolimonsItemDetails !== "undefined" &&
      RolimonsItemDetails.find_item_row
    ) {
      return (
        RolimonsItemDetails.find_item_row(rolimons_data, {
          robloxId: item_id,
          name: item_name,
        }) || null
      );
    }
    return rolimons_data?.items?.[item_id] || null;
  }

  function normalize_routility_label(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[#,()\-:'`"]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function get_routility_value(item_id, item_name) {
    let item = routility_data?.items?.[String(item_id)];
    if (item)
      return typeof item.value === "number" && item.value > 0 ? item.value : 0;
    let labels = [];
    let from_name = normalize_routility_label(item_name);
    if (from_name) labels.push(from_name);
    let row = get_rolimons_item(item_id, item_name);
    if (Array.isArray(row)) {
      let row_name = normalize_routility_label(row[0]);
      let row_acr = normalize_routility_label(row[1]);
      if (row_name) labels.push(row_name);
      if (row_acr) labels.push(row_acr);
    }
    if (!labels.length || !routility_data?.items) return 0;
    if (!routility_data.__nte_by_value_name) {
      let map = Object.create(null);
      let entries = Object.values(routility_data.items);
      for (let entry of entries) {
        if (!entry || typeof entry.value !== "number" || !(entry.value > 0))
          continue;
        let key = normalize_routility_label(entry.name);
        if (key && map[key] == null) map[key] = entry.value;
      }
      for (let entry of entries) {
        if (!entry || typeof entry.value !== "number" || !(entry.value > 0))
          continue;
        let key = normalize_routility_label(entry.acr);
        if (key && map[key] == null) map[key] = entry.value;
      }
      routility_data.__nte_by_value_name = map;
    }
    for (let label of labels) {
      if (routility_data.__nte_by_value_name[label] != null)
        return routility_data.__nte_by_value_name[label];
    }
    return 0;
  }

  function get_value_or_rap(item_id, item_name, fallback_rap) {
    if (values_to_use_cache === "routility") {
      let rout = get_routility_value(item_id, item_name);
      if (rout > 0) return rout;
      return get_rap(item_id, item_name, fallback_rap);
    }
    const row = get_rolimons_item(item_id, item_name);
    if (row) return row[4];
    const parsed = parseInt(fallback_rap, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  function get_rap(item_id, item_name, fallback_rap) {
    const row = get_rolimons_item(item_id, item_name);
    if (row) return row[2];
    const parsed = parseInt(fallback_rap, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  function normalize_tradeable_inventory_items(items) {
    const normalized = [];
    for (const item of Array.isArray(items) ? items : []) {
      const instances =
        Array.isArray(item?.instances) && item.instances.length
          ? item.instances
          : [item];
      for (const instance of instances) {
        const target_id = parseInt(
          instance?.itemTarget?.targetId ??
            item?.itemTarget?.targetId ??
            instance?.assetId ??
            item?.assetId,
          10,
        );
        normalized.push({
          assetId: isNaN(target_id) ? undefined : target_id,
          name:
            instance?.itemName ||
            item?.itemName ||
            instance?.name ||
            item?.name ||
            "Unknown",
          recentAveragePrice:
            instance?.recentAveragePrice ?? item?.recentAveragePrice ?? 0,
        });
      }
    }
    return normalized;
  }

  function inventory_fetch_delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function fetch_user_inventory(user_id) {
    if (inventory_cache[user_id] !== undefined) return inventory_cache[user_id];
    if (inventory_pending[user_id]) return inventory_pending[user_id];

    inventory_pending[user_id] = (async () => {
      let cursor = "";
      let items = [];
      let limit = "100";

      while (true) {
        const params = new URLSearchParams({
          sortBy: "CreationTime",
          limit,
          sortOrder: "Desc",
        });
        if (cursor) params.set("cursor", cursor);

        const url = `https://trades.roblox.com/v2/users/${user_id}/tradableitems?${params.toString()}`;
        let resp = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            resp = await fetch(url, { credentials: "include" });
          } catch {
            resp = null;
          }
          if (resp && resp.status !== 429 && resp.status < 500) break;
          if (attempt < 2) await inventory_fetch_delay(350 * (attempt + 1));
        }

        if (!resp) {
          const partial = items.length
            ? normalize_tradeable_inventory_items(items)
            : null;
          inventory_cache[user_id] = partial;
          return partial;
        }
        if (resp.status === 401 || resp.status === 403) {
          inventory_cache[user_id] = false;
          return false;
        }
        if (resp.status === 500 && limit === "100") {
          limit = "50";
          continue;
        }
        if (resp.status !== 200) {
          const partial = items.length
            ? normalize_tradeable_inventory_items(items)
            : null;
          inventory_cache[user_id] = partial;
          return partial;
        }

        const data = await resp.json().catch(() => null);
        if (!data) {
          const partial = items.length
            ? normalize_tradeable_inventory_items(items)
            : null;
          inventory_cache[user_id] = partial;
          return partial;
        }

        items = items.concat(Array.isArray(data?.items) ? data.items : []);
        cursor = data?.nextPageCursor || "";
        if (!cursor) break;
      }

      const normalized = normalize_tradeable_inventory_items(items);
      inventory_cache[user_id] = normalized;
      return normalized;
    })().finally(() => {
      delete inventory_pending[user_id];
    });

    return inventory_pending[user_id];
  }

  async function get_user_totals(user_id) {
    if (totals_cache[user_id]) return totals_cache[user_id];
    await ensure_rolimons_data();
    if (values_to_use_cache === "routility") await ensure_routility_data();
    const inventory = await fetch_user_inventory(user_id);
    if (inventory === false) {
      totals_cache[user_id] = { private: true };
      return totals_cache[user_id];
    }
    if (!Array.isArray(inventory)) {
      totals_cache[user_id] = { error: true };
      return totals_cache[user_id];
    }

    let total_value = 0;
    let total_rap = 0;
    for (const item of inventory) {
      total_value += get_value_or_rap(
        item.assetId,
        item.name,
        item.recentAveragePrice,
      );
      total_rap +=
        item.recentAveragePrice ||
        get_rap(item.assetId, item.name, item.recentAveragePrice);
    }

    totals_cache[user_id] = {
      value: total_value,
      rap: total_rap,
      items: inventory.length,
    };
    return totals_cache[user_id];
  }

  function format_value_label(totals) {
    if (totals.private) return "Inventory private";
    if (totals.error) return "Could not load";
    return `Value ${commafy(totals.value)}`;
  }

  function set_menu_btn_loading(btn) {
    btn.disabled = true;
    btn.classList.add("is-loading");
    btn.classList.remove("is-done", "is-error");
    btn.replaceChildren();
    const spinner = document.createElement("span");
    spinner.className = "nte-friend-value-spinner";
    spinner.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = "Checking";
    btn.append(spinner, label);
  }

  function set_menu_btn_result(btn, totals) {
    btn.disabled = false;
    btn.classList.remove("is-loading");
    btn.classList.add("is-done");
    btn.classList.toggle("is-error", !!(totals.private || totals.error));
    btn.textContent = format_value_label(totals);
  }

  async function check_value_from_menu(btn, user_id) {
    if (btn.classList.contains("is-loading")) return;
    set_menu_btn_loading(btn);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const totals = await get_user_totals(user_id);
    if (!btn.isConnected) return;
    set_menu_btn_result(btn, totals);
  }

  function inject_styles() {
    if (document.getElementById(style_id)) return;
    const style = document.createElement("style");
    style.id = style_id;
    style.textContent = `
      .nte-friend-check-value{
        display:inline-flex;align-items:center;justify-content:center;gap:6px;
        max-width:100%;white-space:normal;text-align:left;line-height:1.25
      }
      .nte-friend-check-value.is-loading{opacity:1;cursor:default;justify-content:flex-start}
      .nte-friend-check-value.is-done:not(.is-error){font-weight:600;color:#67e8f9}
      .light-theme .nte-friend-check-value.is-done:not(.is-error){color:#0891b2}
      .nte-friend-check-value.is-error{opacity:.78}
      .nte-friend-value-spinner{
        display:inline-block;width:14px;height:14px;flex:0 0 14px;border-radius:50%;
        border:2px solid rgba(160,160,160,.45);border-top-color:#67e8f9;
        animation:nte-friend-value-spin .7s linear infinite
      }
      .light-theme .nte-friend-value-spinner{border-color:rgba(80,80,80,.25);border-top-color:#0891b2}
      @keyframes nte-friend-value-spin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(style);
  }

  function get_friend_request_cards() {
    const content = document.querySelector(".friends-content");
    if (!content) return [];
    const list = content.querySelector(":scope > ul.avatar-cards");
    if (!list) return [];
    return [...list.querySelectorAll(":scope > li.avatar-card")];
  }

  function find_card_menu(card) {
    return (
      card.querySelector(".avatar-card-menu .dropdown-menu") ||
      card.querySelector(".avatar-card-menu .popover-content .dropdown-menu")
    );
  }

  function inject_menu_item(card) {
    if (!enabled) return;
    const user_id = parseInt(card.id, 10);
    if (!user_id) return;

    const menu = find_card_menu(card);
    if (!menu || menu.querySelector(".nte-friend-check-value")) return;

    const li = document.createElement("li");
    li.className = "nte-friend-value-menu-item";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nte-friend-check-value";
    btn.textContent = "Check Value";
    li.appendChild(btn);
    menu.insertBefore(li, menu.firstChild);
  }

  function cleanup() {
    for (const item of document.querySelectorAll(".nte-friend-value-menu-item")) {
      item.remove();
    }
  }

  function on_friends_click(event) {
    const btn = event.target.closest(".nte-friend-check-value");
    if (!btn) return;
    const card = btn.closest("li.avatar-card");
    if (!card || !card.closest(".friends-content")) return;
    const user_id = parseInt(card.id, 10);
    if (!user_id) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void check_value_from_menu(btn, user_id);
  }

  function bind_click_handler() {
    if (click_bound) return;
    click_bound = true;
    document.addEventListener("click", on_friends_click, true);
  }

  function sync_cards() {
    if (!enabled || !is_friends_value_view()) {
      cleanup();
      return;
    }
    inject_styles();
    bind_click_handler();
    for (const card of get_friend_request_cards()) inject_menu_item(card);
  }

  function schedule_sync() {
    clearTimeout(sync_timer);
    sync_timer = setTimeout(sync_cards, 80);
  }

  async function refresh_enabled() {
    enabled = !!(await get_option(option_name));
    schedule_sync();
  }

  function boot() {
    void refresh_enabled();
    schedule_sync();

    const observer = new MutationObserver(schedule_sync);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("hashchange", schedule_sync);
    window.addEventListener("popstate", schedule_sync);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (
        option_name in changes ||
        profile_value_mode_key in changes ||
        values_to_use_key in changes
      ) {
        if (profile_value_mode_key in changes || values_to_use_key in changes) {
          for (const key of Object.keys(totals_cache)) delete totals_cache[key];
        }
        void refresh_enabled();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
