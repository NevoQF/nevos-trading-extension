(() => {
  if (window.__nte_roli_tc_inventory_patch) return;
  window.__nte_roli_tc_inventory_patch = true;

  const BRIDGE_ID = "nte-roli-tc-bridge";

  function ensure_bridge() {
    let el = document.getElementById(BRIDGE_ID);
    if (el) return el;
    el = document.createElement("script");
    el.id = BRIDGE_ID;
    el.type = "application/json";
    el.textContent = "{}";
    (document.documentElement || document.head || document.body).appendChild(el);
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

  function read_state() {
    ensure_bundle_keys();
    let select = document.getElementById("inventory-source-select");
    let source = select ? String(select.value || "all") : "all";
    let status_mode = inventory_mode_from_status(status_text());
    if (source === "all" && status_mode) source = status_mode;
    let hide =
      typeof hide_unowned_items !== "undefined" ? !!hide_unowned_items : false;
    if (!hide && status_mode) hide = true;

    let player_id = null;
    if (
      typeof live_player_assets === "object" &&
      live_player_assets &&
      live_player_assets.playerId
    ) {
      player_id = String(live_player_assets.playerId);
    } else if (typeof jwt_player_id !== "undefined" && jwt_player_id != null) {
      player_id = String(jwt_player_id);
    }

    let asset_count = 0;
    if (
      typeof live_player_assets === "object" &&
      live_player_assets &&
      live_player_assets.playerAssets
    ) {
      asset_count = Object.keys(live_player_assets.playerAssets).length;
    }

    return {
      source,
      hide,
      player_id,
      asset_count,
      status: status_text(),
      ready:
        typeof item_details === "object" &&
        !!item_details &&
        Object.keys(item_details).length > 0,
    };
  }

  function apply_owned_ids(ids) {
    ensure_bundle_keys();
    if (!Array.isArray(ids) || !ids.length) return false;
    if (typeof live_player_assets !== "object" || !live_player_assets) {
      live_player_assets = {};
    }
    let old =
      live_player_assets.playerAssets &&
      typeof live_player_assets.playerAssets === "object"
        ? live_player_assets.playerAssets
        : {};
    let next = {};
    for (let raw of ids) {
      let id = String(raw || "").trim();
      if (!/^\d+$/.test(id)) continue;
      next[id] = old[id] || [1];
    }
    if (!Object.keys(next).length) return false;

    // Keep Rolimons face-asset keys that map to the same owned item keys.
    if (typeof asset_id_item_key_map === "object" && asset_id_item_key_map) {
      let owned_keys = new Set();
      for (let id of Object.keys(next)) {
        let key = asset_id_item_key_map[id];
        if (key) owned_keys.add(key);
        if (item_details?.["1:" + id]) owned_keys.add("1:" + id);
        if (item_details?.["2:" + id]) owned_keys.add("2:" + id);
      }
      for (let [asset_id, key] of Object.entries(asset_id_item_key_map)) {
        if (!owned_keys.has(key)) continue;
        if (!next[asset_id]) next[asset_id] = old[asset_id] || [1];
      }
    }

    live_player_assets.playerAssets = next;
    if (typeof hide_unowned_items !== "undefined") hide_unowned_items = true;
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
      let ok = apply_owned_ids(data.ids);
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
  let obs = new MutationObserver(() => {
    let cmd = bridge.getAttribute("data-nte-cmd");
    if (!cmd) return;
    handle_command(bridge.textContent);
  });
  obs.observe(bridge, {
    attributes: true,
    attributeFilter: ["data-nte-cmd"],
  });

  // Also wrap filter so bundle ids stay mapped after Rolimons rebuilds state.
  let wrap_tries = 0;
  let wrap_timer = setInterval(() => {
    wrap_tries += 1;
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
      (typeof item_details === "object" &&
        item_details &&
        Object.keys(item_details).length > 0 &&
        typeof filter_control_handler === "function" &&
        filter_control_handler.__nte_wrapped) ||
      wrap_tries > 80
    ) {
      clearInterval(wrap_timer);
    }
  }, 250);
})();
