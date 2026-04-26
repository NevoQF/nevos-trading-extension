(function () {
  if (window.__nru_trade_bridge_loaded) return;
  window.__nru_trade_bridge_loaded = true;

  let bridge_script =
    document.currentScript || document.getElementById("nruTradeBridgeScript");
  if (bridge_script) bridge_script.dataset.nruReady = "true";
  document.dispatchEvent(new CustomEvent("nruTradeBridgeReady"));

  let cached_trade_items = new Map();
  let cancelled_request_ids = new Set();

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
  function read_trade_detail_item_from_card(card) {
    let wanted_instance_id = normalize_instance_id(
      card?.getAttribute?.("data-collectibleiteminstanceid"),
    );
    if (!wanted_instance_id) return null;

    for (let scope of get_scope_candidates_for_node(card)) {
      let hit = find_trade_detail_item_in_value(scope, wanted_instance_id);
      if (hit) return clone_trade_item_value(hit);
    }

    return null;
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
    if (!binding?.root) throw Error("Trade inventory controller not found");
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

          if (!binding?.root) {
            return send_result(request_id, false, "Trade inventory controller not found");
          }
          if (!collectible_item_instance_id) {
            return send_result(
              request_id,
              false,
              "Tradable item payload is missing collectibleItemInstanceId",
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
          cancel_request_id && cancelled_request_ids.add(cancel_request_id);
          return send_result(request_id, true);
        }
        if ("getDetailTradeItems" === action) {
          return send_result(request_id, true, null, {
            items: get_trade_detail_items_snapshot(),
          });
        }

        send_result(request_id, false, `Unknown action: ${action}`);
      } catch (error) {
        "Cancelled" === error?.message && request_id && cancelled_request_ids.delete(String(request_id));
        send_result(request_id, false, error?.message || String(error));
      }
    })();
  });
})();
