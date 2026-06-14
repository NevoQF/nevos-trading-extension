(function (root) {
  "use strict";

  const ROLIMONS_ITEM_DETAILS_URL =
    "https://api.rolimons.com/items/v3/itemdetails";
  const V2_ROW_LENGTH = 11;
  const ROW_NAME = 0;
  const ROW_ACRONYM = 1;
  const ROW_RAP = 2;
  const ROW_VALUE = 3;
  const ROW_DEFAULT_VALUE = 4;
  const ROW_DEMAND = 5;
  const ROW_TREND = 6;
  const ROW_PROJECTED = 7;
  const ROW_HYPED = 8;
  const ROW_RARE = 9;

  function is_item_row(value) {
    return Array.isArray(value) && typeof value[0] === "string";
  }

  function normalize_item_row(row) {
    if (!is_item_row(row)) return null;
    let out = row.slice();
    // Rolimons v3 itemdetails uses 9-field rows with rare at index 8.
    if (
      out.length < V2_ROW_LENGTH &&
      Number(out[ROW_HYPED]) === 1 &&
      Number(out[ROW_RARE]) !== 1
    ) {
      out[ROW_RARE] = 1;
    }
    while (out.length < V2_ROW_LENGTH) out.push(-1);
    return out;
  }

  function is_item_rare(row) {
    if (!is_item_row(row)) return false;
    if (Number(row[ROW_RARE]) === 1) return true;
    if (Number(row[ROW_HYPED]) === 1 && row.length < V2_ROW_LENGTH) return true;
    // Rows cached before v3 rare migration kept rare at index 8 with padded -1 at 9.
    return (
      Number(row[ROW_HYPED]) === 1 &&
      Number(row[ROW_RARE]) === -1 &&
      Number(row[10]) === -1
    );
  }

  function is_item_hyped(row) {
    if (!is_item_row(row) || row.length < V2_ROW_LENGTH) return false;
    return Number(row[ROW_HYPED]) === 1 && Number(row[ROW_RARE]) !== 1;
  }

  function merge_item_map(target, source) {
    if (!source || typeof source !== "object") return target;
    for (let [id, row] of Object.entries(source)) {
      let normalized = normalize_item_row(row);
      if (normalized) target[String(id)] = normalized;
    }
    return target;
  }

  function build_bundle_ids(bundles) {
    let bundleIds = {};
    if (!bundles || typeof bundles !== "object") return bundleIds;
    for (let id of Object.keys(bundles)) bundleIds[String(id)] = true;
    return bundleIds;
  }

  function is_bundle_id(item_data, id) {
    if (id == null || id === "") return false;
    return !!(
      item_data?.bundleIds && item_data.bundleIds[String(id)]
    );
  }

  function normalize_item_name(name) {
    return String(name || "")
      .replace(/\s*#\d+\s*$/g, "")
      .toLowerCase()
      .replace(/[#,()\-:'`"]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function get_item_demand(row) {
    if (!is_item_row(row)) return -1;
    let demand = Number(row[ROW_DEMAND]);
    return Number.isFinite(demand) ? demand : -1;
  }

  function get_item_value(row) {
    if (!is_item_row(row)) return 0;
    let value = Number(row[ROW_VALUE]);
    if (Number.isFinite(value) && value >= 0) return value;
    let fallback = Number(row[ROW_DEFAULT_VALUE]);
    return Number.isFinite(fallback) && fallback >= 0 ? fallback : 0;
  }

  function find_item_row(item_data, options) {
    let items = item_data?.items;
    if (!items || typeof items !== "object") return null;
    let rolimons_id = options?.rolimonsId;
    let roblox_id = options?.robloxId;
    let name = options?.name;
    let is_bundle = options?.isBundle === true;

    if (rolimons_id != null && rolimons_id !== "") {
      let by_rolimons = items[String(rolimons_id)];
      if (by_rolimons) return by_rolimons;
    }

    if (!is_bundle && roblox_id != null && roblox_id !== "") {
      let by_roblox = items[String(roblox_id)];
      if (by_roblox) return by_roblox;
    }

    let normalized_name = normalize_item_name(name);
    if (!normalized_name) return null;

    for (let row of Object.values(items)) {
      if (!is_item_row(row)) continue;
      if (normalize_item_name(row[ROW_NAME]) === normalized_name) return row;
    }
    return null;
  }

  function profile_url(id, item_data, options) {
    let key = String(id ?? "").trim();
    if (!key) return "https://www.rolimons.com/";
    let is_bundle =
      options?.isBundle === true || is_bundle_id(item_data, key);
    let segment = is_bundle ? "bundle" : "item";
    return `https://www.rolimons.com/${segment}/${encodeURIComponent(key)}`;
  }

  function normalize_rolimons_item_details_payload(payload) {
    if (!payload || typeof payload !== "object") return null;

    if (payload.items && typeof payload.items === "object") {
      let items = {};
      merge_item_map(items, payload.items);
      if (!Object.keys(items).length) return null;
      let bundleIds =
        payload.bundleIds && typeof payload.bundleIds === "object"
          ? payload.bundleIds
          : {};
      return {
        success: payload.success !== false,
        item_count: Object.keys(items).length,
        items,
        bundleIds,
      };
    }

    let assets = payload.assets;
    let bundles = payload.bundles;
    if (
      (typeof assets !== "object" || !assets) &&
      (typeof bundles !== "object" || !bundles)
    ) {
      return null;
    }

    let items = {};
    merge_item_map(items, assets);
    merge_item_map(items, bundles);
    if (!Object.keys(items).length) return null;

    return {
      success: payload.success !== false,
      item_count: Object.keys(items).length,
      asset_count:
        typeof assets === "object" && assets ? Object.keys(assets).length : 0,
      bundle_count:
        typeof bundles === "object" && bundles
          ? Object.keys(bundles).length
          : 0,
      items,
      bundleIds: build_bundle_ids(bundles),
    };
  }

  root.RolimonsItemDetails = {
    ROLIMONS_ITEM_DETAILS_URL,
    ROW_DEMAND,
    ROW_VALUE,
    ROW_RAP,
    ROW_RARE,
    normalize_rolimons_item_details_payload,
    normalize_item_row,
    normalize_item_name,
    get_item_demand,
    get_item_value,
    is_item_rare,
    is_item_hyped,
    find_item_row,
    is_bundle_id,
    profile_url,
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
