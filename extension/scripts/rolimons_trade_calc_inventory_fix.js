(() => {
  if (window.__nte_roli_tc_inventory_patch) return;
  window.__nte_roli_tc_inventory_patch = true;

  const MSG = "nte-roli-tc";

  function ensure_bundle_keys() {
    if (
      typeof item_details !== "object" ||
      !item_details ||
      typeof asset_id_item_key_map !== "object" ||
      !asset_id_item_key_map
    ) {
      return 0;
    }
    let added = 0;
    for (let key of Object.keys(item_details)) {
      let row = item_details[key];
      if (!Array.isArray(row) || row[24] !== 2) continue;
      let id = String(row[25] || "");
      if (!id || asset_id_item_key_map[id] != null) continue;
      asset_id_item_key_map[id] = key;
      added += 1;
    }
    return added;
  }

  function redraw_inventory() {
    if (typeof page_number !== "undefined") page_number = 1;
    if (typeof filter_control_handler === "function") filter_control_handler();
    if (typeof pagination_initialized !== "undefined" && pagination_initialized) {
      try {
        $("#pagination_control_top").pagination("drawPage", page_number);
        $("#pagination_control_bottom").pagination("drawPage", page_number);
      } catch {}
    }
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
    live_player_assets.playerAssets = next;
    if (typeof hide_unowned_items !== "undefined") hide_unowned_items = true;
    redraw_inventory();
    return true;
  }

  function read_state() {
    let select = document.getElementById("inventory-source-select");
    let source = select ? String(select.value || "all") : "all";
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
      hide: typeof hide_unowned_items !== "undefined" ? !!hide_unowned_items : false,
      player_id,
      asset_count,
      ready: typeof item_details === "object" && !!item_details,
    };
  }

  function reply(type, detail) {
    window.postMessage({ source: MSG, type, ...(detail || {}) }, "*");
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    let data = event.data;
    if (!data || data.source !== MSG || data.to !== "page") return;
    if (data.type === "query") {
      reply({ type: "state", to: "content", state: read_state() });
      return;
    }
    if (data.type === "apply") {
      let ok = apply_owned_ids(data.ids);
      reply({
        type: "applied",
        to: "content",
        ok,
        count: Array.isArray(data.ids) ? data.ids.length : 0,
      });
    }
  });

  // Fix reply helper misuse - postMessage needs flat object
  function reply(payload) {
    window.postMessage({ source: MSG, ...payload }, "*");
  }

  let tries = 0;
  let timer = setInterval(() => {
    tries += 1;
    ensure_bundle_keys();
    if (
      (typeof item_details === "object" &&
        item_details &&
        Object.keys(item_details).length > 0) ||
      tries > 60
    ) {
      clearInterval(timer);
    }
  }, 250);
})();
