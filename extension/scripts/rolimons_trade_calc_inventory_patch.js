(() => {
  if (window.__nte_roli_tc_inventory_patch) return;
  window.__nte_roli_tc_inventory_patch = true;

  const BRIDGE_ID = "nte-roli-tc-bridge";
  const SLOT_LIMIT = Number.MAX_SAFE_INTEGER;

  function ensure_bridge() {
    let el = document.getElementById(BRIDGE_ID);
    if (el && el.tagName === "SCRIPT") {
      el.remove();
      el = null;
    }
    if (el) return el;
    el = document.createElement("div");
    el.id = BRIDGE_ID;
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
    el.textContent = "{}";
    (document.documentElement || document.head || document.body).appendChild(
      el,
    );
    return el;
  }

  function ensure_bundle_keys() {
    if (
      typeof item_details !== "object" ||
      !item_details ||
      typeof asset_id_item_key_map !== "object" ||
      !asset_id_item_key_map
    ) {
      return;
    }
    for (let key of Object.keys(item_details)) {
      let row = item_details[key];
      if (!Array.isArray(row) || row[24] !== 2) continue;
      let id = String(row[25] || "");
      if (!id || asset_id_item_key_map[id] != null) continue;
      asset_id_item_key_map[id] = key;
    }
  }

  function redraw_inventory() {
    if (typeof page_number !== "undefined") page_number = 1;
    if (typeof filter_control_handler === "function") filter_control_handler();
    if (typeof pagination_initialized !== "undefined" && pagination_initialized) {
      try {
        if (window.jQuery) {
          window.jQuery("#pagination_control_top").pagination("drawPage", page_number);
          window
            .jQuery("#pagination_control_bottom")
            .pagination("drawPage", page_number);
        }
      } catch {}
    }
  }

  function status_text() {
    let el = document.getElementById("inventory-filter-status-message");
    return String(el?.textContent || "").trim();
  }

  function inventory_mode_from_status(text) {
    let t = String(text || "").toLowerCase();
    if (!t) return "";
    if (t.includes("showing your inventory")) return "mine";
    if (/showing .+['’]s inventory/.test(t)) return "other";
    return "";
  }

  function asset_qty_from_live() {
    let qty = Object.create(null);
    let assets =
      typeof live_player_assets === "object" &&
      live_player_assets &&
      live_player_assets.playerAssets &&
      typeof live_player_assets.playerAssets === "object"
        ? live_player_assets.playerAssets
        : null;
    if (!assets) return qty;
    for (let [raw_id, uaids] of Object.entries(assets)) {
      let id = String(raw_id || "").trim();
      if (!/^\d+$/.test(id)) continue;
      let count = Array.isArray(uaids) ? uaids.length : 0;
      if (!(count > 0)) count = 1;
      qty[id] = count;
    }
    return qty;
  }

  function sync_source_select(mode) {
    let select = document.getElementById("inventory-source-select");
    if (!select || (mode !== "mine" && mode !== "other")) return;
    if (select.value === mode) return;
    // Update the dropdown to match status without firing change (avoids
    // Rolimons wiping assets when other_player_assets is briefly null).
    select.value = mode;
  }

  function expand_face_asset_keys(next, old) {
    if (typeof asset_id_item_key_map !== "object" || !asset_id_item_key_map) {
      return next;
    }
    let owned_keys = new Set();
    for (let id of Object.keys(next)) {
      let key = asset_id_item_key_map[id];
      if (key) owned_keys.add(key);
      if (item_details?.["1:" + id]) owned_keys.add("1:" + id);
      if (item_details?.["2:" + id]) owned_keys.add("2:" + id);
    }
    let out = { ...next };
    for (let [asset_id, key] of Object.entries(asset_id_item_key_map)) {
      if (!owned_keys.has(key)) continue;
      if (!out[asset_id]) out[asset_id] = old[asset_id] || [1];
    }
    return out;
  }

  function read_state() {
    ensure_bundle_keys();
    let select = document.getElementById("inventory-source-select");
    let source = select ? String(select.value || "all") : "all";
    let status = status_text();
    let status_mode = inventory_mode_from_status(status);
    // After a scan, status is ground truth even if the select lagged on "all".
    if (status_mode) source = status_mode;
    let hide =
      typeof hide_unowned_items !== "undefined" ? !!hide_unowned_items : false;
    if (!hide && status_mode) hide = true;

    let live_id = null;
    if (
      typeof live_player_assets === "object" &&
      live_player_assets &&
      live_player_assets.playerId != null &&
      live_player_assets.playerId !== ""
    ) {
      live_id = String(live_player_assets.playerId);
    }

    // Never fall back to jwt for Other Player — that races mid-scan and
    // applies the logged-in user's inventory over the scanned player.
    let player_id = live_id;
    if (
      !player_id &&
      source === "mine" &&
      typeof jwt_player_id !== "undefined" &&
      jwt_player_id != null
    ) {
      player_id = String(jwt_player_id);
    }

    let asset_qty = asset_qty_from_live();
    let asset_count = Object.keys(asset_qty).length;

    return {
      source,
      hide,
      player_id,
      asset_count,
      asset_qty,
      status,
      select: select ? String(select.value || "all") : "all",
      trade: read_trade_sides(),
      ready:
        typeof item_details === "object" &&
        !!item_details &&
        Object.keys(item_details).length > 0,
    };
  }

  const TRADE_STAMP_ID = "nte-roli-tc-trade";

  function parse_labeled_number(text) {
    let n = parseInt(String(text || "").replace(/,/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function parse_total_el(id) {
    return parse_labeled_number(document.getElementById(id)?.textContent);
  }

  function parse_robux_el(id) {
    return parse_labeled_number(document.getElementById(id)?.value);
  }

  function item_key_from_value(v) {
    if (v == null || v === false || v === "") return "";
    if (typeof v === "number") {
      if (!(v > 0) || !Number.isFinite(v)) return "";
      return "1:" + String(Math.floor(v));
    }
    if (typeof v === "string") {
      let s = v.trim();
      if (/^\d+:\d+$/.test(s)) return s;
      if (/^\d+$/.test(s) && Number(s) > 0) return "1:" + s;
      return "";
    }
    if (typeof v !== "object" || v.nodeType) return "";
    if (typeof v.key === "string") return item_key_from_value(v.key);
    let id = v.item_id || v.itemId || v.asset_id || v.assetId || v.id;
    if (id == null || id === "") return "";
    let type = v.item_type || v.itemType || v.type || v.asset_type;
    let prefix =
      type === 2 || type === "2" || type === "Bundle" || type === "bundle"
        ? "2"
        : "1";
    return prefix + ":" + String(id);
  }

  function keys_from_list(v) {
    if (Array.isArray(v)) return v.map(item_key_from_value);
    if (!v || typeof v !== "object" || v.nodeType) return [];
    let keys = [];
    for (let val of Object.values(v)) {
      let key = item_key_from_value(val);
      if (key) keys.push(key);
    }
    return keys;
  }

  function item_rap_value(key) {
    if (typeof item_details !== "object" || !item_details) return [0, 0];
    let row = item_details[key];
    if (!Array.isArray(row)) {
      let id = String(key || "").split(":")[1] || String(key || "");
      row = item_details["1:" + id] || item_details["2:" + id];
    }
    if (!Array.isArray(row)) return [0, 0];
    let rap = Number(row[2]) || 0;
    let value = Number(row[3]) || 0;
    if (!(value > 0)) value = rap;
    return [rap, value];
  }

  function sum_keys(keys) {
    let rap = 0;
    let value = 0;
    for (let key of keys) {
      if (!key) continue;
      let pair = item_rap_value(key);
      rap += pair[0];
      value += pair[1];
    }
    return { rap, value };
  }

  function sums_match(keys, prefix) {
    let got = sum_keys(keys.filter(Boolean));
    let rap = parse_total_el(prefix + "_rap_total_textbox");
    let robux = parse_robux_el(prefix + "_robux_textbox");
    let value = parse_total_el(prefix + "_value_total_textbox");
    if (Math.abs(got.rap - rap) <= 1) return true;
    if (Math.abs(got.rap - Math.max(0, rap - robux)) <= 1) return true;
    if (Math.abs(got.value - value) <= 1) return true;
    if (Math.abs(got.value - Math.max(0, value - robux)) <= 1) return true;
    return false;
  }

  function entry_from_key(key) {
    if (!key) return null;
    let parts = String(key).split(":");
    let id = parts.length === 2 ? parts[1] : String(key);
    let row =
      typeof item_details === "object" && item_details
        ? item_details[key] ||
          item_details["1:" + id] ||
          item_details["2:" + id]
        : null;
    if (Array.isArray(row) && row[24] === 2 && row[25]) id = String(row[25]);
    return {
      id: String(id || ""),
      name: Array.isArray(row) ? String(row[0] || "") : "",
    };
  }

  function entries_from_keys(keys) {
    let out = [];
    for (let key of keys) {
      let entry = entry_from_key(key);
      if (entry?.id) out.push(entry);
    }
    return out;
  }

  function consider_list(lists, name, raw) {
    if (raw == null || typeof raw !== "object" || raw.nodeType) return;
    if (typeof raw === "function") return;
    let keys = keys_from_list(raw);
    if (!keys.length) return;
    if (keys.length > 100000) return;
    lists.push({ name, keys, raw: Array.isArray(raw) ? raw : null });
  }

  function collect_item_lists() {
    let lists = [];
    let named = [
      "added_items",
      "trade_items",
      "tradeItems",
      "calculator_items",
      "items_in_trade",
      "current_trade_items",
      "trade_slot_items",
      "trade_slots",
      "offer_item_ids",
      "request_item_ids",
      "offer_items_ids",
      "request_items_ids",
      "added_item_ids",
      "selected_items",
      "trade_offer",
      "trade_request",
      "offer_uaids",
      "request_uaids",
    ];
    for (let name of named) {
      try {
        consider_list(lists, name, window[name]);
      } catch {}
    }
    let re = /item|trade|slot|offer|request|added|calc|uaid|asset/i;
    let names = [];
    try {
      names = Object.getOwnPropertyNames(window);
    } catch {
      names = [];
    }
    for (let name of names) {
      if (name.length > 64) continue;
      try {
        let v = window[name];
        if (Array.isArray(v) && v.length >= 4 && v.length <= 16)
          consider_list(lists, name, v);
        else if (re.test(name)) consider_list(lists, name, v);
      } catch {}
    }
    return lists;
  }

  function read_trade_object_sides() {
    let t = window.trade_object;
    if (!t || !Array.isArray(t.item_slots)) return null;
    let n = Number(t.num_offers);
    if (!(n > 0)) n = 4;
    let offer_keys = [];
    let request_keys = [];
    for (let i = 0; i < t.item_slots.length; i++) {
      let key = item_key_from_value(t.item_slots[i]);
      if (!key) continue;
      if (i < n) offer_keys.push(key);
      else request_keys.push(key);
    }
    return {
      offer: entries_from_keys(offer_keys),
      request: entries_from_keys(request_keys),
    };
  }

  function read_trade_sides() {
    let from_obj = read_trade_object_sides();
    if (from_obj) return from_obj;
    let offer_n =
      document.querySelectorAll("#offer_items .trade-item").length || 4;
    let request_n =
      document.querySelectorAll("#request_items .trade-item").length || 4;
    let lists = collect_item_lists();
    for (let list of lists) {
      if (!list.raw || list.raw.length !== offer_n + request_n) continue;
      let offer_keys = list.keys.slice(0, offer_n);
      let request_keys = list.keys.slice(offer_n);
      if (
        sums_match(offer_keys, "offer") &&
        sums_match(request_keys, "request")
      ) {
        return {
          offer: entries_from_keys(offer_keys),
          request: entries_from_keys(request_keys),
        };
      }
    }
    let offer_hit = null;
    let request_hit = null;
    for (let list of lists) {
      let filled = list.keys.filter(Boolean);
      if (!offer_hit && sums_match(filled, "offer")) offer_hit = filled;
      else if (!request_hit && sums_match(filled, "request"))
        request_hit = filled;
    }
    if (offer_hit || request_hit) {
      return {
        offer: entries_from_keys(offer_hit || []),
        request: entries_from_keys(request_hit || []),
      };
    }
    return { offer: [], request: [] };
  }

  function raise_trade_slot_limit() {
    try {
      if (typeof slot_limit === "number") slot_limit = SLOT_LIMIT;
    } catch {}
    for (let id of ["offer_slots_textbox", "request_slots_textbox"]) {
      let el = document.getElementById(id);
      if (!el) continue;
      el.removeAttribute("max");
    }
    if (
      typeof get_trade_slot_count_from_input === "function" &&
      !get_trade_slot_count_from_input.__nte_unlim
    ) {
      let original = get_trade_slot_count_from_input;
      function wrapped(sel) {
        try {
          if (typeof slot_limit === "number") slot_limit = SLOT_LIMIT;
        } catch {}
        return original.apply(this, arguments);
      }
      wrapped.__nte_unlim = true;
      get_trade_slot_count_from_input = wrapped;
    }
  }

  function stamp_trade_sides() {
    let sides = read_trade_sides();
    let json = JSON.stringify(sides);
    let el = document.getElementById(TRADE_STAMP_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = TRADE_STAMP_ID;
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
      (document.documentElement || document.head || document.body).appendChild(
        el,
      );
    }
    if (el.textContent === json) return;
    el.textContent = json;
  }

  // mode "replace": rebuild from ids (My Inventory).
  // mode "merge": keep Rolimons scan assets, add ids + face keys (Other Player).
  function apply_owned_ids(ids, mode = "replace") {
    ensure_bundle_keys();
    let merge = mode === "merge";
    if (!merge && (!Array.isArray(ids) || !ids.length)) return false;
    if (typeof live_player_assets !== "object" || !live_player_assets) {
      live_player_assets = {};
    }
    let old =
      live_player_assets.playerAssets &&
      typeof live_player_assets.playerAssets === "object"
        ? live_player_assets.playerAssets
        : {};
    let next = merge ? { ...old } : {};
    if (Array.isArray(ids)) {
      for (let raw of ids) {
        let id = String(raw || "").trim();
        if (!/^\d+$/.test(id)) continue;
        if (!next[id]) next[id] = old[id] || [1];
      }
    }
    next = expand_face_asset_keys(next, old);
    if (!Object.keys(next).length) return false;

    live_player_assets.playerAssets = next;
    if (typeof hide_unowned_items !== "undefined") hide_unowned_items = true;
    let status_mode = inventory_mode_from_status(status_text());
    if (status_mode) sync_source_select(status_mode);
    redraw_inventory();
    return true;
  }

  function write_response(payload) {
    let bridge = ensure_bridge();
    bridge.setAttribute("data-nte-res", String(Date.now()));
    bridge.textContent = JSON.stringify(payload || {});
  }

  function handle_command(raw) {
    let data = null;
    try {
      data = JSON.parse(raw || "{}");
    } catch {
      return;
    }
    if (!data || data.to !== "page") return;
    if (data.type === "query") {
      write_response({ to: "content", type: "state", state: read_state() });
      return;
    }
    if (data.type === "apply") {
      let ok = apply_owned_ids(data.ids, data.mode === "merge" ? "merge" : "replace");
      write_response({
        to: "content",
        type: "applied",
        ok,
        count: Array.isArray(data.ids) ? data.ids.length : 0,
        state: read_state(),
      });
    }
  }

  let bridge = ensure_bridge();
  let last_bridge_cmd = "";
  let on_bridge_command = () => {
    let cmd = bridge.getAttribute("data-nte-cmd");
    if (!cmd || cmd === last_bridge_cmd) return;
    last_bridge_cmd = cmd;
    handle_command(bridge.textContent);
  };
  let obs = new MutationObserver(on_bridge_command);
  obs.observe(bridge, {
    attributes: true,
    attributeFilter: ["data-nte-cmd"],
    characterData: true,
    childList: true,
    subtree: true,
  });

  // Also wrap filter so bundle ids stay mapped after Rolimons rebuilds state.
  let wrap_tries = 0;
  let wrap_timer = setInterval(() => {
    wrap_tries += 1;
    raise_trade_slot_limit();
    ensure_bundle_keys();
    if (typeof filter_control_handler === "function" && !filter_control_handler.__nte_wrapped) {
      let original = filter_control_handler;
      function wrapped() {
        ensure_bundle_keys();
        return original.apply(this, arguments);
      }
      wrapped.__nte_wrapped = true;
      filter_control_handler = wrapped;
    }
    if (
      typeof calculate_trade_object_totals === "function" &&
      !calculate_trade_object_totals.__nte_usd_stamp
    ) {
      let original_totals = calculate_trade_object_totals;
      function wrapped_totals() {
        let result = original_totals.apply(this, arguments);
        try {
          stamp_trade_sides();
        } catch {}
        return result;
      }
      wrapped_totals.__nte_usd_stamp = true;
      calculate_trade_object_totals = wrapped_totals;
    }
    if (
      (typeof item_details === "object" &&
        item_details &&
        Object.keys(item_details).length > 0 &&
        typeof filter_control_handler === "function" &&
        filter_control_handler.__nte_wrapped &&
        typeof calculate_trade_object_totals === "function" &&
        calculate_trade_object_totals.__nte_usd_stamp) ||
      wrap_tries > 80
    ) {
      clearInterval(wrap_timer);
    }
  }, 250);

  setInterval(() => {
    try {
      raise_trade_slot_limit();
      stamp_trade_sides();
    } catch {}
  }, 400);
  try {
    raise_trade_slot_limit();
    stamp_trade_sides();
  } catch {}
})();
