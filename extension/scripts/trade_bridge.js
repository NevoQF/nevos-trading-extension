(function () {
  if (window.__nru_trade_bridge_loaded) return;
  window.__nru_trade_bridge_loaded = true;

  let bridge_script =
    document.currentScript || document.getElementById("nruTradeBridgeScript");
  if (bridge_script) bridge_script.dataset.nruReady = "true";
  document.dispatchEvent(new CustomEvent("nruTradeBridgeReady"));

  let cached_trade_items = new Map();
  let cancelled_request_ids = new Set();
  const cancelled_request_ids_max = 64;

  function remember_cancelled_request(request_id) {
    let id = String(request_id || "");
    if (!id) return;
    cancelled_request_ids.add(id);
    if (cancelled_request_ids.size <= cancelled_request_ids_max) return;
    let drop = cancelled_request_ids.size - cancelled_request_ids_max;
    for (let old_id of cancelled_request_ids) {
      cancelled_request_ids.delete(old_id);
      drop -= 1;
      if (drop <= 0) break;
    }
  }

  function clear_side_cache(side_index) {
    cached_trade_items.delete(String(Number(side_index) || 0));
  }

  function get_side_cache(side_index) {
    let cache_key = String(Number(side_index) || 0);
    if (!cached_trade_items.has(cache_key)) {
      cached_trade_items.set(cache_key, new Map());
    }
    return cached_trade_items.get(cache_key);
  }
  function cache_trade_item(side_index, item) {
    let instance_id = item?.collectibleItemInstanceId;
    if (!instance_id) return item || null;
    get_side_cache(side_index).set(instance_id, item);
    return item;
  }

  function resolve_click_handler(candidate) {
    if (!candidate) return null;

    for (let owner of [
      candidate,
      candidate.root,
      candidate.$ctrl,
      candidate.vm,
      candidate.inventory,
      candidate.tradeInventory,
      candidate.tradeInventoryController,
    ]) {
      if (owner && "function" == typeof owner.onItemCardClick) return owner;
    }

    return null;
  }

  function get_candidate_owners(candidate) {
    return [
      candidate,
      candidate?.root,
      candidate?.$ctrl,
      candidate?.vm,
      candidate?.inventory,
      candidate?.tradeInventory,
      candidate?.tradeInventoryController,
    ].filter(Boolean);
  }

  function resolve_inventory_data(candidate) {
    for (let owner of get_candidate_owners(candidate)) {
      let items = owner?.inventoryData?.tradableItems;
      if (Array.isArray(items)) return owner.inventoryData;
    }
    return null;
  }

  function resolve_cursor_paging(candidate) {
    for (let owner of get_candidate_owners(candidate)) {
      let paging = owner?.cursorPaging;
      if (
        paging &&
        "function" == typeof paging.getCurrentPageNumber &&
        "function" == typeof paging.loadNextPage &&
        "function" == typeof paging.loadPreviousPage
      ) {
        return paging;
      }
    }
    return null;
  }

  function get_inventory_root(side_index) {
    if (!window.angular?.element) return null;

    let panels = document.querySelectorAll(".trade-inventory-panel");
    let panel = panels?.[side_index];
    if (!panel) return null;

    let nodes = [
      panel,
      panel.firstElementChild,
      panel.parentElement,
      panel.closest(".inventory-panel-holder"),
      document.querySelector(".trade-request-window"),
    ].filter(Boolean);

    let seen_scopes = new Set();
    let queue = [];
    let binding = {
      root: null,
      scope: null,
      inventoryData: null,
      cursorPaging: null,
      panel,
    };

    function push_scope(scope) {
      if (!scope || seen_scopes.has(scope)) return;
      seen_scopes.add(scope);
      queue.push(scope);
    }

    for (let node of nodes) {
      let element = window.angular.element(node);
      push_scope(element.scope?.());
      push_scope(element.isolateScope?.());
    }

    while (queue.length) {
      let scope = queue.shift();
      if (!binding.root) {
        binding.root = resolve_click_handler(scope);
        if (binding.root) binding.scope = scope;
      }
      if (!binding.inventoryData) binding.inventoryData = resolve_inventory_data(scope);
      if (!binding.cursorPaging) binding.cursorPaging = resolve_cursor_paging(scope);

      if (binding.root && (binding.inventoryData || binding.cursorPaging)) {
        return binding;
      }

      push_scope(scope?.$parent);
    }

    return binding.root ? binding : null;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function is_request_cancelled(request_id) {
    return !!request_id && cancelled_request_ids.has(String(request_id));
  }
  function ensure_request_active(request_id) {
    if (is_request_cancelled(request_id)) throw Error("Cancelled");
  }

  async function run_in_scope(scope, task) {
    return await new Promise((resolve, reject) => {
      let run_task = () => {
        try {
          resolve(task());
        } catch (error) {
          reject(error);
        }
      };

      try {
        if (scope?.$evalAsync) scope.$evalAsync(run_task);
        else if (scope?.$applyAsync) scope.$applyAsync(run_task);
        else run_task();
      } catch (error) {
        reject(error);
      }
    });
  }

  function get_visible_trade_items(binding) {
    return Array.isArray(binding?.inventoryData?.tradableItems)
      ? binding.inventoryData.tradableItems
      : [];
  }

  function cache_visible_trade_items(binding, side_index) {
    if (!binding?.root) return 0;

    let count = 0;
    for (let item of get_visible_trade_items(binding)) {
      cache_trade_item(side_index, item) && count++;
    }
    return count;
  }

  function get_cached_trade_item(side_index, collectible_item_instance_id) {
    if (!collectible_item_instance_id) return null;
    return get_side_cache(side_index).get(collectible_item_instance_id) || null;
  }

  function get_trade_item_by_instance(binding, collectible_item_instance_id) {
    if (!collectible_item_instance_id) return null;
    return (
      get_visible_trade_items(binding).find(
        (item) => item?.collectibleItemInstanceId === collectible_item_instance_id,
      ) || null
    );
  }
  function normalize_instance_id(value) {
    return String(value || "").trim().toLowerCase();
  }
  function get_scope_candidates_for_node(node) {
    if (!window.angular?.element || !node) return [];

    let candidates = [];
    let seen = new Set();
    for (let candidate of [
      node,
      node.closest?.("[trade-item-card]"),
      node.closest?.("[ng-repeat]"),
      node.parentElement,
      node.closest?.(".trade-list-detail-offer"),
    ]) {
      if (!candidate) continue;
      let element = window.angular.element(candidate);
      for (let scope of [element.scope?.(), element.isolateScope?.()]) {
        if (!scope || seen.has(scope)) continue;
        seen.add(scope);
        candidates.push(scope);
      }
    }
    return candidates;
  }
  function looks_like_trade_detail_item(candidate, wanted_instance_id) {
    if (!candidate || "object" != typeof candidate) return false;
    let instance_id = normalize_instance_id(
      candidate?.collectibleItemInstanceId ||
      candidate?.collectibleItemInstance?.collectibleItemInstanceId ||
      candidate?.collectibleItemInstance?.id,
    );
    return !!instance_id && instance_id === wanted_instance_id;
  }
  function find_trade_detail_item_in_value(value, wanted_instance_id, depth = 0, seen = new WeakSet()) {
    if (!value || "object" != typeof value || depth > 4) return null;
    if (seen.has(value)) return null;
    seen.add(value);

    if (Array.isArray(value)) {
      for (let entry of value) {
        let hit = find_trade_detail_item_in_value(entry, wanted_instance_id, depth + 1, seen);
        if (hit) return hit;
      }
      return null;
    }

    for (let key of ["tradableItem", "item", "data", "$ctrl", "vm", "offer", "root"]) {
      let hit = find_trade_detail_item_in_value(value?.[key], wanted_instance_id, depth + 1, seen);
      if (hit) return hit;
    }

    if (looks_like_trade_detail_item(value, wanted_instance_id)) return value;

    for (let key of Object.keys(value)) {
      if (key.startsWith("$")) continue;
      let entry = value[key];
      if (!entry || "object" != typeof entry) continue;
      let hit = find_trade_detail_item_in_value(entry, wanted_instance_id, depth + 1, seen);
      if (hit) return hit;
    }

    return null;
  }
  // New trades UI: item cards no longer carry the collectible instance id as a
  // DOM attribute, so read it off the React props and stamp it back on. Every
  // reader downstream already keys off that attribute.
  function read_react_trade_item(card) {
    let key =
      card && Object.keys(card).find((k) => k.startsWith("__reactFiber$"));
    let fiber = key ? card[key] : null;
    for (let i = 0; i < 12 && fiber; i++) {
      let item = fiber.memoizedProps?.item;
      if (item?.collectibleItemInstanceId) return item;
      fiber = fiber.return;
    }
    return null;
  }
  function find_react_inventory_click_handler(panel) {
    let card = panel?.querySelector?.(".item-card-container");
    if (!card) return null;
    let key = Object.keys(card).find((k) => k.startsWith("__reactFiber$"));
    let fiber = key ? card[key] : null;
    for (let i = 0; i < 28 && fiber; i++) {
      let props = fiber.memoizedProps || {};
      if (typeof props.onItemClick === "function") return props.onItemClick;
      fiber = fiber.return;
    }
    return null;
  }
  function build_react_toggle_item(tradable_item, collectible_item_instance_id) {
    if (!tradable_item && !collectible_item_instance_id) return null;
    let instance_id =
      tradable_item?.collectibleItemInstanceId ||
      collectible_item_instance_id ||
      null;
    if (!instance_id) return null;
    let item_type =
      tradable_item?.itemTarget?.itemType ||
      tradable_item?.itemType ||
      "Asset";
    let target_id = String(
      tradable_item?.itemTarget?.targetId ||
        tradable_item?.targetId ||
        tradable_item?.assetId ||
        tradable_item?.bundleId ||
        "",
    );
    let item_name =
      tradable_item?.itemName || tradable_item?.name || "Unknown";
    return {
      collectibleItemInstanceId: instance_id,
      itemTarget: {
        ...(tradable_item?.itemTarget || {}),
        itemType: item_type,
        targetId: target_id,
      },
      itemName: item_name,
      serialNumber: tradable_item?.serialNumber ?? null,
      originalPrice: tradable_item?.originalPrice ?? null,
      recentAveragePrice:
        parseInt(
          tradable_item?.recentAveragePrice ?? tradable_item?.rap ?? 0,
          10,
        ) || 0,
      assetStock: parseInt(tradable_item?.assetStock ?? 0, 10) || 0,
      isOnHold: !!tradable_item?.isOnHold,
      id: instance_id,
      userId: parseInt(tradable_item?.userId ?? 0, 10) || 0,
    };
  }
  function get_react_inventory_panel(side_index) {
    return (
      document.querySelectorAll(".trade-inventory-panel")[
        Number(side_index) || 0
      ] || null
    );
  }
  function stamp_inventory_item_ids(panel) {
    let root = panel || document;
    for (let card of root.querySelectorAll(
      ".trade-inventory-panel .item-card-container:not([data-collectibleiteminstanceid]), .inventory-panel-holder .item-card-container:not([data-collectibleiteminstanceid])",
    )) {
      let item = read_react_trade_item(card);
      if (!item?.collectibleItemInstanceId) continue;
      card.setAttribute(
        "data-collectibleiteminstanceid",
        item.collectibleItemInstanceId,
      );
      card.__nte_react_item = item;
    }
  }
  function find_react_inventory_card(side_index, collectible_item_instance_id) {
    let panel = get_react_inventory_panel(side_index);
    if (!panel || !collectible_item_instance_id) return null;
    stamp_inventory_item_ids(panel);
    let wanted = normalize_instance_id(collectible_item_instance_id);
    for (let card of panel.querySelectorAll(".item-card-container")) {
      let attr = normalize_instance_id(
        card.getAttribute("data-collectibleiteminstanceid"),
      );
      if (attr === wanted) return card;
      let item = read_react_trade_item(card);
      if (normalize_instance_id(item?.collectibleItemInstanceId) === wanted) {
        card.setAttribute(
          "data-collectibleiteminstanceid",
          item.collectibleItemInstanceId,
        );
        card.__nte_react_item = item;
        return card;
      }
    }
    return null;
  }
  function toggle_react_inventory_item(
    side_index,
    collectible_item_instance_id,
    tradable_item,
  ) {
    let panel = get_react_inventory_panel(side_index);
    if (!panel) return false;
    let handler = find_react_inventory_click_handler(panel);
    if (!handler) return false;
    let live_card = find_react_inventory_card(
      side_index,
      collectible_item_instance_id,
    );
    let item =
      (live_card &&
        (live_card.__nte_react_item || read_react_trade_item(live_card))) ||
      build_react_toggle_item(tradable_item, collectible_item_instance_id);
    if (!item?.collectibleItemInstanceId) return false;
    handler(item);
    return true;
  }
  function get_react_pager_button(panel, direction) {
    let pager = panel?.querySelector(".trade-inventory-pager");
    if (!pager) return null;
    if ("next" === direction) {
      return (
        pager.querySelector('button[aria-label="Next"]:not([disabled])') ||
        pager.querySelector(".btn-generic-right-sm:not([disabled])")
      );
    }
    return (
      pager.querySelector('button[aria-label="Back"]:not([disabled])') ||
      pager.querySelector(".btn-generic-left-sm:not([disabled])")
    );
  }
  function get_react_page_number(panel) {
    let text =
      panel?.querySelector(".trade-inventory-pager-label")?.textContent || "";
    let match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) || 1 : 1;
  }
  function get_react_page_fingerprint(panel) {
    stamp_inventory_item_ids(panel);
    return [...panel.querySelectorAll(".item-card-container")]
      .map(
        (card) =>
          card.getAttribute("data-collectibleiteminstanceid") ||
          read_react_trade_item(card)?.collectibleItemInstanceId ||
          "",
      )
      .join("|");
  }
  async function step_react_inventory_page(panel, direction, request_id = "") {
    let button = get_react_pager_button(panel, direction);
    if (!button) return false;
    ensure_request_active(request_id);
    let before = get_react_page_fingerprint(panel);
    button.click();
    let started = Date.now();
    while (Date.now() - started < 2500) {
      ensure_request_active(request_id);
      await delay(50);
      if (get_react_page_fingerprint(panel) !== before) return true;
    }
    return false;
  }
  async function select_react_inventory_item_by_instance_id(
    side_index,
    collectible_item_instance_id,
    target_page,
    request_id = "",
  ) {
    let panel = get_react_inventory_panel(side_index);
    if (!panel) throw Error("Trade inventory controller not found");
    if (!collectible_item_instance_id)
      throw Error("Missing collectibleItemInstanceId");
    ensure_request_active(request_id);

    let try_click_visible = () => {
      let card = find_react_inventory_card(
        side_index,
        collectible_item_instance_id,
      );
      if (!card) return false;
      let handler = find_react_inventory_click_handler(panel);
      let item = card.__nte_react_item || read_react_trade_item(card);
      if (handler && item) {
        handler(item);
        return true;
      }
      let clickable =
        card.querySelector('[role="button"]') ||
        card.querySelector(".item-card-thumb-container") ||
        card;
      clickable.click();
      return true;
    };

    send_progress(request_id, {
      phase: "seeking",
      current_page: get_react_page_number(panel),
      target_page,
    });
    if (try_click_visible()) {
      send_progress(request_id, {
        phase: "clicking",
        current_page: get_react_page_number(panel),
        target_page,
      });
      return;
    }

    let current_page = get_react_page_number(panel);
    if (
      Number.isFinite(Number(target_page)) &&
      Number.isFinite(Number(current_page))
    ) {
      let desired_page = Number(target_page);
      let direction = current_page < desired_page ? "next" : "prev";
      for (
        let steps = Math.abs(desired_page - current_page);
        steps > 0;
        steps--
      ) {
        ensure_request_active(request_id);
        if (!(await step_react_inventory_page(panel, direction, request_id)))
          break;
        send_progress(request_id, {
          phase: "seeking",
          current_page: get_react_page_number(panel),
          target_page,
        });
        if (try_click_visible()) {
          send_progress(request_id, {
            phase: "clicking",
            current_page: get_react_page_number(panel),
            target_page,
          });
          return;
        }
      }
    }

    for (let direction of ["next", "prev"]) {
      for (let i = 0; i < 8; i++) {
        ensure_request_active(request_id);
        if (!(await step_react_inventory_page(panel, direction, request_id)))
          break;
        send_progress(request_id, {
          phase: "seeking",
          current_page: get_react_page_number(panel),
          target_page,
        });
        if (try_click_visible()) {
          send_progress(request_id, {
            phase: "clicking",
            current_page: get_react_page_number(panel),
            target_page,
          });
          return;
        }
      }
    }

    throw Error("Could not locate the searched trade item in Roblox inventory");
  }
  function stamp_trade_detail_item_ids() {
    for (let card of document.querySelectorAll(
      ".trade-list-detail-offer .item-card-container:not([data-collectibleiteminstanceid]), .trade-request-window-offer .item-card-container:not([data-collectibleiteminstanceid]), .trade-request-item:not([data-collectibleiteminstanceid])",
    )) {
      let item = read_react_trade_item(card);
      if (!item?.collectibleItemInstanceId) continue;
      card.setAttribute(
        "data-collectibleiteminstanceid",
        item.collectibleItemInstanceId,
      );
      card.__nte_react_item = item;
    }
    stamp_inventory_item_ids();
  }
  let trade_detail_stamp_queued = false;
  function watch_trade_detail_items() {
    if (!document.body) return;
    stamp_trade_detail_item_ids();
    new MutationObserver(() => {
      if (trade_detail_stamp_queued) return;
      trade_detail_stamp_queued = true;
      requestAnimationFrame(() => {
        trade_detail_stamp_queued = false;
        stamp_trade_detail_item_ids();
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) watch_trade_detail_items();
  else
    document.addEventListener("DOMContentLoaded", watch_trade_detail_items, {
      once: true,
    });

  function read_trade_detail_item_from_card(card) {
    let wanted_instance_id = normalize_instance_id(
      card?.getAttribute?.("data-collectibleiteminstanceid"),
    );
    if (!wanted_instance_id) return null;

    for (let scope of get_scope_candidates_for_node(card)) {
      let hit = find_trade_detail_item_in_value(scope, wanted_instance_id);
      if (hit) return clone_trade_item_value(hit);
    }

    let react_item = card.__nte_react_item || read_react_trade_item(card);
    return react_item ? clone_trade_item_value(react_item) : null;
  }
  function get_trade_detail_items_snapshot() {
    let items = [];
    for (let offer of document.querySelectorAll(".trade-list-detail-offer")) {
      let header = offer.querySelector(".trade-list-detail-offer-header")?.textContent?.trim() || "";
      for (let card of offer.querySelectorAll(".item-card-container[data-collectibleiteminstanceid]")) {
        let instance_id = normalize_instance_id(card.getAttribute("data-collectibleiteminstanceid"));
        if (!instance_id) continue;
        let item = read_trade_detail_item_from_card(card);
        items.push({
          offerHeader: header,
          collectibleItemInstanceId: instance_id,
          item,
          userAssetId:
            parseInt(item?.userAssetId ?? 0, 10) ||
            parseInt(item?.userAsset?.id ?? 0, 10) ||
            parseInt(item?.userAsset?.userAssetId ?? 0, 10) ||
            parseInt(item?.id ?? 0, 10) ||
            0,
        });
      }
    }
    return items;
  }
  function clone_trade_item_value(value, seen = new WeakMap()) {
    if (null == value || "object" != typeof value) return value;
    if (seen.has(value)) return seen.get(value);
    if (Array.isArray(value)) {
      let arr = [];
      seen.set(value, arr);
      for (let entry of value) arr.push(clone_trade_item_value(entry, seen));
      return arr;
    }
    let out = {};
    seen.set(value, out);
    for (let key of Object.keys(value)) {
      let entry = value[key];
      if ("function" == typeof entry) continue;
      out[key] = clone_trade_item_value(entry, seen);
    }
    return out;
  }
  function get_trade_item_template(binding, tradable_item) {
    let visible_items = get_visible_trade_items(binding);
    if (!visible_items.length) return null;
    let desired_type =
        tradable_item?.itemTarget?.itemType ||
        tradable_item?.itemType ||
        null,
      wants_unique =
        null != tradable_item?.serialNumber ||
        tradable_item?.layoutOptions?.isUnique === !0;
    return (
      visible_items.find((item) => {
        let item_type = item?.itemTarget?.itemType || item?.itemType || null,
          item_unique =
            null != item?.serialNumber || item?.layoutOptions?.isUnique === !0;
        return (!desired_type || item_type === desired_type) && item_unique === wants_unique;
      }) ||
      visible_items.find((item) => {
        let item_type = item?.itemTarget?.itemType || item?.itemType || null;
        return !desired_type || item_type === desired_type;
      }) ||
      visible_items[0] ||
      null
    );
  }
  function materialize_trade_item(
    binding,
    tradable_item,
    collectible_item_instance_id,
  ) {
    if (!tradable_item) return null;
    let template = get_trade_item_template(binding, tradable_item),
      clone = template ? clone_trade_item_value(template) : {},
      item_type =
        tradable_item?.itemTarget?.itemType ||
        tradable_item?.itemType ||
        clone?.itemTarget?.itemType ||
        clone?.itemType ||
        "Asset",
      target_id =
        parseInt(
          tradable_item?.targetId ??
            tradable_item?.itemTarget?.targetId ??
            tradable_item?.assetId ??
            tradable_item?.bundleId ??
            clone?.targetId ??
            clone?.itemTarget?.targetId ??
            0,
          10,
        ) || 0,
      instance_id =
        tradable_item?.collectibleItemInstanceId ||
        collectible_item_instance_id ||
        clone?.collectibleItemInstanceId ||
        null,
      collectible_item_id =
        tradable_item?.collectibleItemId ?? clone?.collectibleItemId ?? null,
      item_name =
        tradable_item?.itemName ||
        tradable_item?.name ||
        clone?.itemName ||
        clone?.name ||
        "Unknown",
      serial_number =
        null != tradable_item?.serialNumber
          ? tradable_item.serialNumber
          : clone?.serialNumber ?? null,
      recent_average_price =
        parseInt(
          tradable_item?.recentAveragePrice ??
            tradable_item?.rap ??
            clone?.recentAveragePrice ??
            clone?.rap ??
            0,
          10,
        ) || 0,
      original_price =
        tradable_item?.originalPrice ?? clone?.originalPrice ?? null,
      asset_stock =
        parseInt(tradable_item?.assetStock ?? clone?.assetStock ?? 0, 10) || 0,
      user_asset_id =
        parseInt(
          tradable_item?.userAssetId ??
            tradable_item?.userAsset?.id ??
            tradable_item?.userAsset?.userAssetId ??
            tradable_item?.id ??
            clone?.userAssetId ??
            clone?.userAsset?.id ??
            clone?.userAsset?.userAssetId ??
            clone?.id ??
            0,
          10,
        ) || 0,
      user_id =
        parseInt(tradable_item?.userId ?? tradable_item?.user?.id ?? clone?.userId ?? 0, 10) || 0,
      item_target = {
        ...(clone?.itemTarget || {}),
        ...(tradable_item?.itemTarget || {}),
        itemType: item_type,
        targetId: String(target_id),
      },
      layout_options = {
        ...(clone?.layoutOptions || {}),
        ...(tradable_item?.layoutOptions || {}),
        isUnique: null != serial_number,
        limitedNumber: serial_number,
        isLimitedNumberShown: null != serial_number,
        isIconDisabled: !1,
      },
      out = {
        ...clone,
        ...tradable_item,
        collectibleItemId: collectible_item_id,
        collectibleItemInstanceId: instance_id,
        itemTarget: item_target,
        itemType: item_type,
        targetId: target_id,
        itemName: item_name,
        name: item_name,
        serialNumber: serial_number,
        originalPrice: original_price,
        recentAveragePrice: recent_average_price,
        rap: recent_average_price,
        assetStock: asset_stock,
        isOnHold: !!(tradable_item?.isOnHold ?? clone?.isOnHold),
        userAssetId: user_asset_id,
        userId: user_id || clone?.userId,
        id:
          tradable_item?.id ??
          instance_id ??
          user_asset_id ??
          target_id,
        layoutOptions: layout_options,
        __nteSyntheticDirectItem: !0,
      };
    if ("Asset" === item_type) out.assetId = target_id;
    if ("Bundle" === item_type) out.bundleId = target_id;
    instance_id &&
      (out.collectibleItemInstance =
        out.collectibleItemInstance &&
        "object" == typeof out.collectibleItemInstance
          ? { ...out.collectibleItemInstance, collectibleItemInstanceId: instance_id }
          : { collectibleItemInstanceId: instance_id });
    return out;
  }

  async function wait_for_trade_item(
    side_index,
    collectible_item_instance_id,
    timeout = 1200,
    request_id = "",
  ) {
    let started = Date.now();
    while (Date.now() - started < timeout) {
      ensure_request_active(request_id);
      let binding = get_inventory_root(side_index);
      let native_item = get_trade_item_by_instance(
        binding,
        collectible_item_instance_id,
      );

      binding?.root && cache_visible_trade_items(binding, side_index);
      if (binding?.root && native_item) return { binding, native_item };
      await delay(60);
    }
    return null;
  }

  function get_current_page_number(binding) {
    try {
      let page_number = binding?.cursorPaging?.getCurrentPageNumber?.();
      if (Number.isFinite(Number(page_number))) return Number(page_number);
    } catch {}

    let pager_text = binding?.panel?.querySelector(".pager span")?.textContent || "";
    let match = pager_text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) || 1 : 1;
  }

  function get_visible_page_fingerprint(binding) {
    let items = get_visible_trade_items(binding);
    if (!items.length) return "";

    return items
      .map(
        (item) =>
          item?.collectibleItemInstanceId ||
          item?.collectibleItemId ||
          item?.itemName ||
          "",
      )
      .join("|");
  }

  async function wait_for_page_change(
    side_index,
    previous_page,
    previous_fingerprint,
    timeout = 2500,
    request_id = "",
  ) {
    let started = Date.now();
    while (Date.now() - started < timeout) {
      ensure_request_active(request_id);
      let binding = get_inventory_root(side_index);
      if (binding?.root) {
        let next_page = get_current_page_number(binding);
        let next_fingerprint = get_visible_page_fingerprint(binding);
        if (
          next_page !== previous_page ||
          (next_fingerprint && next_fingerprint !== previous_fingerprint)
        ) {
          return binding;
        }
      }
      await delay(40);
    }
    return null;
  }

  async function wait_for_inventory_settle(side_index, timeout = 700, request_id = "") {
    let started = Date.now();
    let last_fingerprint = "";

    while (Date.now() - started < timeout) {
      ensure_request_active(request_id);
      let binding = get_inventory_root(side_index);
      if (binding?.root) {
        let fingerprint = get_visible_page_fingerprint(binding);
        if (fingerprint && fingerprint === last_fingerprint) return binding;
        last_fingerprint = fingerprint;
      }
      await delay(60);
    }

    return get_inventory_root(side_index);
  }

  async function step_inventory_page(
    binding,
    side_index,
    direction,
    should_settle = true,
    request_id = "",
  ) {
    let paging = binding?.cursorPaging;
    if (!paging) return null;
    ensure_request_active(request_id);

    if (
      ("next" === direction &&
        "function" == typeof paging.canLoadNextPage &&
        !paging.canLoadNextPage()) ||
      ("prev" === direction &&
        "function" == typeof paging.canLoadPreviousPage &&
        !paging.canLoadPreviousPage())
    ) {
      return null;
    }

    let previous_page = get_current_page_number(binding);
    let previous_fingerprint = get_visible_page_fingerprint(binding);

    await run_in_scope(binding.scope, () =>
      "next" === direction ? paging.loadNextPage() : paging.loadPreviousPage(),
    );

    let next_binding = await wait_for_page_change(
      side_index,
      previous_page,
      previous_fingerprint,
      2500,
      request_id,
    );

    if (!next_binding?.root) return next_binding;
    if (!should_settle) return next_binding;

    await delay(180);
    ensure_request_active(request_id);
    return (await wait_for_inventory_settle(side_index, 700, request_id)) || next_binding;
  }

  async function click_trade_item(binding, native_item) {
    await run_in_scope(binding.scope, () => {
      binding.root.onItemCardClick.call(binding.root, native_item);
    });
  }

  function resolve_filter_owner(candidate) {
    for (let owner of get_candidate_owners(candidate)) {
      if (owner && "function" == typeof owner.onFilterClick && owner.layout) {
        return owner;
      }
    }
    if (
      candidate &&
      "function" == typeof candidate.onFilterClick &&
      candidate.layout
    ) {
      return candidate;
    }
    return null;
  }

  function get_inventory_filter_binding(side_index) {
    if (!window.angular?.element) return null;

    let panels = document.querySelectorAll(".trade-inventory-panel");
    let panel = panels?.[side_index];
    if (!panel) return null;

    let nodes = [
      panel,
      panel.firstElementChild,
      panel.parentElement,
      panel.closest(".inventory-panel-holder"),
      panel.querySelector(".inventory-type-dropdown"),
    ].filter(Boolean);

    let seen_scopes = new Set();
    let queue = [];

    function push_scope(scope) {
      if (!scope || seen_scopes.has(scope)) return;
      seen_scopes.add(scope);
      queue.push(scope);
    }

    for (let node of nodes) {
      let element = window.angular.element(node);
      push_scope(element.scope?.());
      push_scope(element.isolateScope?.());
    }

    while (queue.length) {
      let scope = queue.shift();
      let owner = resolve_filter_owner(scope);
      if (owner) return { scope, owner, panel };
      push_scope(scope?.$parent);
    }

    return { scope: null, owner: null, panel };
  }

  function reload_inventory_via_dom(panel) {
    let dropdown = panel?.querySelector(".inventory-type-dropdown");
    if (!dropdown) return false;

    let current =
      dropdown
        .querySelector(".rbx-selection-label")
        ?.getAttribute("title")
        ?.trim() ||
      dropdown.querySelector(".rbx-selection-label")?.textContent?.trim() ||
      "";
    let links = Array.from(dropdown.querySelectorAll(".dropdown-menu a"));
    if (!links.length) return false;

    let current_link =
      links.find((a) => a.textContent.trim() === current) ||
      links.find((a) => "All" === a.textContent.trim()) ||
      links[0];

    // Re-click current only. Do not bounce to another category — that can
    // leave the panel stuck (e.g. Hats) and hide faces/bundles.
    current_link.click();
    return true;
  }

  function get_react_inventory_filter_controls(side_index) {
    let panel = get_react_inventory_panel(side_index);
    let combo = panel?.querySelector(
      '.inventory-type-dropdown button[role="combobox"]',
    );
    if (!panel || !combo) return null;
    let key = Object.keys(combo).find((k) => k.startsWith("__reactFiber$"));
    let fiber = key ? combo[key] : null;
    let on_select = null;
    let filter_value = null;
    let select_value = null;
    for (let i = 0; i < 45 && fiber; i++) {
      let props = fiber.memoizedProps || {};
      let type = fiber.type?.displayName || fiber.type?.name || "";
      if (
        !on_select &&
        Array.isArray(props.options) &&
        typeof props.onSelect === "function"
      ) {
        on_select = props.onSelect;
        if (null != props.value) filter_value = props.value;
      }
      if (
        "Select" === type &&
        typeof props.onValueChange === "function" &&
        null != props.value
      ) {
        select_value = props.value;
      }
      fiber = fiber.return;
    }
    if (!on_select) return null;
    let value = null != filter_value ? filter_value : select_value;
    if ("__all__" === value || null == value) value = "";
    return { panel, on_select, value };
  }

  function is_react_inventory_busy(panel) {
    if (!panel) return false;
    return !!panel.querySelector(
      '.spinner:not([hidden]), .spinner-default:not(.ng-hide), [aria-busy="true"], [class*="Spinner"]',
    );
  }

  async function wait_for_react_inventory_reload(panel, timeout = 5000) {
    let started = Date.now();
    let saw_busy = false;
    // Allow the reload request to start.
    await delay(80);
    while (Date.now() - started < timeout) {
      let busy = is_react_inventory_busy(panel);
      if (busy) saw_busy = true;
      if (saw_busy && !busy) {
        await delay(150);
        if (!is_react_inventory_busy(panel)) return true;
      }
      await delay(60);
    }
    // Same-filter reloads often never show a spinner; give XHR time to finish.
    await delay(350);
    return true;
  }

  async function reload_react_inventory(side_index) {
    let controls = get_react_inventory_filter_controls(side_index);
    if (!controls?.on_select) return null;
    // Re-select the current category. React's setFilter(same) still refetches
    // tradableItems (unlike a no-op Select onValueChange).
    controls.on_select(controls.value);
    await wait_for_react_inventory_reload(controls.panel);
    stamp_inventory_item_ids(controls.panel);
    return { method: "react-filter", filter: controls.value || "All" };
  }

  function is_inventory_busy(side_index) {
    let binding = get_inventory_filter_binding(side_index);
    let owner = binding?.owner;
    let scope = binding?.scope;
    if (owner?.loading === true || scope?.loading === true) return true;
    let panel =
      binding?.panel || get_react_inventory_panel(side_index) || null;
    if (!panel) return false;
    if (is_react_inventory_busy(panel)) return true;
    return !!panel.querySelector(
      ".spinner.spinner-default:not(.ng-hide), .spinner:not(.ng-hide)",
    );
  }

  async function wait_for_inventory_idle(side_index, timeout = 5000) {
    let started = Date.now();
    // Allow the reload request to start.
    await delay(80);
    while (Date.now() - started < timeout) {
      if (!is_inventory_busy(side_index)) {
        await delay(120);
        if (!is_inventory_busy(side_index)) {
          return get_inventory_filter_binding(side_index);
        }
      }
      await delay(60);
    }
    return get_inventory_filter_binding(side_index);
  }

  function find_direct_reload(owner, scope) {
    let candidates = [owner, scope, owner?.$ctrl, scope?.$ctrl].filter(Boolean);

    for (let candidate of candidates) {
      if ("function" == typeof candidate.loadInventory) {
        return () => candidate.loadInventory();
      }

      let paging = candidate.cursorPaging || candidate.pager;
      if (paging) {
        if ("function" == typeof paging.loadFirstPage) {
          return () => paging.loadFirstPage();
        }
        if ("function" == typeof paging.reload) {
          return () => paging.reload();
        }
      }
    }

    return null;
  }

  function same_filter(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.label && b.label && a.label === b.label) return true;
    if (
      void 0 !== a.assetType &&
      void 0 !== b.assetType &&
      a.assetType === b.assetType
    ) {
      return true;
    }
    return false;
  }

  async function reload_inventory(side_index) {
    clear_side_cache(side_index);
    let binding = get_inventory_filter_binding(side_index);
    let owner = binding?.owner;
    let scope = binding?.scope;

    if (!(owner && "function" == typeof owner.onFilterClick)) {
      let react_reload = await reload_react_inventory(side_index);
      if (react_reload) return react_reload;
    }

    if (owner && "function" == typeof owner.onFilterClick) {
      let selected = owner.layout?.selectedFilter;

      if (selected) {
        // Force a same-filter reload without visiting another category.
        // Clearing selectedFilter bypasses Roblox's same-filter no-op.
        // (Toggling Hats→All was leaving panels stuck / missing faces.)
        await run_in_scope(scope, () => {
          try {
            if ("loadFailed" in owner) owner.loadFailed = false;
          } catch {}
          owner.layout.selectedFilter = null;
          owner.onFilterClick(selected);
        });
        await wait_for_inventory_idle(side_index);

        binding = get_inventory_filter_binding(side_index);
        owner = binding?.owner;
        scope = binding?.scope;
        if (
          owner &&
          selected &&
          !same_filter(owner.layout?.selectedFilter, selected)
        ) {
          await run_in_scope(scope, () => owner.onFilterClick(selected));
          await wait_for_inventory_idle(side_index);
        }

        return { method: "filter-force" };
      }

      let direct = find_direct_reload(owner, scope);
      if (direct) {
        await run_in_scope(scope, () => {
          try {
            if ("loadFailed" in owner) owner.loadFailed = false;
          } catch {}
          direct();
        });
        await wait_for_inventory_idle(side_index);
        return { method: "direct" };
      }

      let filters = Array.isArray(owner.layout?.filters)
        ? owner.layout.filters
        : [];
      if (filters[0]) {
        await run_in_scope(scope, () => owner.onFilterClick(filters[0]));
        await wait_for_inventory_idle(side_index);
        return { method: "filter-first" };
      }
    }

    if (reload_inventory_via_dom(binding?.panel)) {
      await wait_for_inventory_idle(side_index);
      return { method: "dom" };
    }

    let react_reload = await reload_react_inventory(side_index);
    if (react_reload) return react_reload;

    throw Error("Could not reload trade inventory");
  }

  function send_result(request_id, ok, error, payload) {
    document.dispatchEvent(
      new CustomEvent("nruTradeBridgeResult", {
        detail: { request_id, ok, error: error || null, ...(payload || {}) },
      }),
    );
  }

  function send_progress(request_id, progress) {
    document.dispatchEvent(
      new CustomEvent("nruTradeBridgeProgress", {
        detail: { request_id, ...(progress || {}) },
      }),
    );
  }

  async function select_trade_item_by_instance_id(
    side_index,
    collectible_item_instance_id,
    target_page,
    request_id = "",
  ) {
    let binding = get_inventory_root(side_index);
    if (!binding?.root) {
      await select_react_inventory_item_by_instance_id(
        side_index,
        collectible_item_instance_id,
        target_page,
        request_id,
      );
      return;
    }
    if (!collectible_item_instance_id) throw Error("Missing collectibleItemInstanceId");
    ensure_request_active(request_id);

    cache_visible_trade_items(binding, side_index);
    send_progress(request_id, {
      phase: "seeking",
      current_page: get_current_page_number(binding),
      target_page,
    });

    let native_item = get_trade_item_by_instance(binding, collectible_item_instance_id);
    if (native_item) {
      ensure_request_active(request_id);
      send_progress(request_id, {
        phase: "clicking",
        current_page: get_current_page_number(binding),
        target_page,
      });
      await click_trade_item(binding, native_item);
      return;
    }

    let current_page = get_current_page_number(binding);
    if (
      Number.isFinite(Number(target_page)) &&
      Number.isFinite(Number(current_page)) &&
      binding.cursorPaging
    ) {
      let desired_page = Number(target_page);
      let direction = current_page < desired_page ? "next" : "prev";

      for (let steps = Math.abs(desired_page - current_page); steps > 0; steps--) {
        ensure_request_active(request_id);
        binding = await step_inventory_page(
          binding,
          side_index,
          direction,
          steps <= 2,
          request_id,
        );
        if (!binding?.root) break;

        cache_visible_trade_items(binding, side_index);
        send_progress(request_id, {
          phase: "seeking",
          current_page: get_current_page_number(binding),
          target_page,
        });
      }
    }

    let final_match = await wait_for_trade_item(
      side_index,
      collectible_item_instance_id,
      1400,
      request_id,
    );
    if (final_match?.native_item) {
      ensure_request_active(request_id);
      send_progress(request_id, {
        phase: "clicking",
        current_page: get_current_page_number(final_match.binding),
        target_page,
      });
      await delay(160);
      await click_trade_item(final_match.binding, final_match.native_item);
      return;
    }

    for (let direction of ["next", "prev"]) {
      ensure_request_active(request_id);
      binding = get_inventory_root(side_index);
      if (!binding?.root) continue;

      cache_visible_trade_items(binding, side_index);
      let stepped = await step_inventory_page(binding, side_index, direction, true, request_id);
      if (!stepped?.root) continue;

      cache_visible_trade_items(stepped, side_index);
      send_progress(request_id, {
        phase: "seeking",
        current_page: get_current_page_number(stepped),
        target_page,
      });

      let match = await wait_for_trade_item(
        side_index,
        collectible_item_instance_id,
        900,
        request_id,
      );
      if (match?.native_item) {
        ensure_request_active(request_id);
        send_progress(request_id, {
          phase: "clicking",
          current_page: get_current_page_number(match.binding),
          target_page,
        });
        await delay(160);
        await click_trade_item(match.binding, match.native_item);
        return;
      }
    }

    throw Error("Could not locate the searched trade item in Roblox inventory");
  }

  function find_trade_list_scope() {
    if (!window.angular?.element) return null;

    let nodes = [
      document.querySelector(".trade-row-list"),
      document.querySelector(".trades-header"),
      document.querySelector("#trade-row-scroll-container"),
      document.querySelector(".trades-header .trade-list-dropdown"),
    ].filter(Boolean);

    let seen = new Set();
    let queue = [];

    function push_scope(scope) {
      if (!scope || seen.has(scope)) return;
      seen.add(scope);
      queue.push(scope);
    }

    for (let node of nodes) {
      let element = window.angular.element(node);
      push_scope(element.scope?.());
      push_scope(element.isolateScope?.());
    }

    while (queue.length) {
      let scope = queue.shift();
      if (
        typeof scope?.onTabClick === "function" ||
        typeof scope?.loadTrades === "function" ||
        typeof scope?.loadTradeList === "function" ||
        typeof scope?.getTrades === "function" ||
        typeof scope?.data?.tradesList?.load === "function"
      ) {
        return scope;
      }
      push_scope(scope?.$parent);
    }

    return null;
  }

  let TRADE_TAB_NAMES = ["Inbound", "Outbound", "Completed", "Inactive"];

  function get_react_trade_tab() {
    let tab = new URL(location.href).searchParams.get("tab") || "";
    return (
      TRADE_TAB_NAMES.find((name) => name.toLowerCase() === tab.toLowerCase()) ||
      "Inbound"
    );
  }

  // New trades UI: the list component memoises its tab-change handler, which
  // resets the cursor and refetches page one regardless of whether the tab
  // actually changed. Re-running it reloads just the trade rows.
  function find_react_trade_list_reloader() {
    let host = document.getElementById("trades-web-app");
    let key =
      host && Object.keys(host).find((k) => k.startsWith("__reactContainer$"));
    if (!key) return null;
    let seen = new Set();
    let stack = [host[key]];
    while (stack.length) {
      let fiber = stack.pop();
      if (!fiber || seen.has(fiber)) continue;
      seen.add(fiber);
      let hook = fiber.memoizedState;
      for (let i = 0; i < 80 && hook; i++) {
        let value = Array.isArray(hook.memoizedState)
          ? hook.memoizedState[0]
          : null;
        if (
          typeof value === "function" &&
          value.length === 1 &&
          /loadFirstPage/.test(String(value))
        )
          return value;
        hook = hook.next;
      }
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }
    return null;
  }

  async function reload_trade_list() {
    let scope = find_trade_list_scope();
    if (!scope) {
      let reload = find_react_trade_list_reloader();
      if (!reload) throw Error("Trade list controller not found");
      reload(get_react_trade_tab());
      return { reloaded: true };
    }

    await run_in_scope(scope, () => {
      let tab = scope.layout?.selectedTab;
      let trades_list = scope.data?.tradesList;

      if (typeof scope.loadTrades === "function") {
        scope.loadTrades(tab?.value || tab);
        return;
      }
      if (typeof scope.loadTradeList === "function") {
        scope.loadTradeList(tab?.value || tab);
        return;
      }
      if (typeof scope.getTrades === "function") {
        scope.getTrades(tab?.value || tab);
        return;
      }
      if (typeof trades_list?.load === "function") {
        trades_list.load();
        return;
      }
      if (typeof scope.onTabClick === "function" && tab) {
        // Same-tab clicks can no-op; clear then re-select to force a reload.
        if (scope.layout) scope.layout.selectedTab = null;
        if (Array.isArray(scope.data?.trades)) scope.data.trades = [];
        if (trades_list) {
          trades_list.loading = true;
          trades_list.noResults = false;
        }
        scope.onTabClick(tab);
        return;
      }
      throw Error("Trade list reload method not found");
    });

    return { reloaded: true };
  }

  document.addEventListener("nruTradeBridgeAction", (event) => {
    let raw = event.detail;
    let detail = raw;
    if (typeof raw === "string") {
      try { detail = JSON.parse(raw); } catch(e) { detail = {}; }
    }
    detail = detail || {};
    let request_id = detail.request_id;
    let action = detail.action;

    (async () => {
      try {
        if ("toggleItem" === action) {
          let side_index = Number(detail.side_index) || 0;
          let tradable_item = detail.tradable_item;
          let collectible_item_instance_id =
            detail.collectible_item_instance_id ||
            tradable_item?.collectibleItemInstanceId;
          let binding = get_inventory_root(side_index);

          if (!collectible_item_instance_id) {
            return send_result(
              request_id,
              false,
              "Tradable item payload is missing collectibleItemInstanceId",
            );
          }

          if (!binding?.root) {
            if (
              toggle_react_inventory_item(
                side_index,
                collectible_item_instance_id,
                tradable_item,
              )
            ) {
              return send_result(request_id, true);
            }
            return send_result(
              request_id,
              false,
              "Trade inventory controller not found",
            );
          }

          cache_visible_trade_items(binding, side_index);
          let native_item =
            get_trade_item_by_instance(binding, collectible_item_instance_id) ||
            get_cached_trade_item(side_index, collectible_item_instance_id);
          native_item ||
            (native_item = cache_trade_item(
              side_index,
              materialize_trade_item(
                binding,
                tradable_item,
                collectible_item_instance_id,
              ),
            ));
          if (!native_item) {
            return send_result(request_id, false, "Trade item could not be materialized");
          }

          await click_trade_item(binding, native_item);
          return send_result(request_id, true);
        }

        if ("primeVisibleItems" === action) {
          let side_index = Number(detail.side_index) || 0;
          let binding = get_inventory_root(side_index);
          if (!binding?.root) {
            return send_result(request_id, false, "Trade inventory controller not found");
          }
          cache_visible_trade_items(binding, side_index);
          return send_result(request_id, true);
        }

        if ("selectItemByInstanceId" === action) {
          await select_trade_item_by_instance_id(
            Number(detail.side_index) || 0,
            detail.collectible_item_instance_id,
            detail.target_page,
            request_id,
          );
          cancelled_request_ids.delete(String(request_id));
          return send_result(request_id, true);
        }
        if ("cancelRequest" === action) {
          let cancel_request_id = String(detail.cancel_request_id || "");
          cancel_request_id && remember_cancelled_request(cancel_request_id);
          return send_result(request_id, true);
        }
        if ("getDetailTradeItems" === action) {
          return send_result(request_id, true, null, {
            items: get_trade_detail_items_snapshot(),
          });
        }

        if ("reloadInventory" === action) {
          let result = await reload_inventory(Number(detail.side_index) || 0);
          return send_result(request_id, true, null, result);
        }

        if ("reloadTradeList" === action) {
          let result = await reload_trade_list();
          return send_result(request_id, true, null, result);
        }

        send_result(request_id, false, `Unknown action: ${action}`);
      } catch (error) {
        "Cancelled" === error?.message && request_id && cancelled_request_ids.delete(String(request_id));
        send_result(request_id, false, error?.message || String(error));
      }
    })();
  });
})();
