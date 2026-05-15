(function (root) {
  "use strict";

  // Allow all want tags except Any/Adds.
  const WANT_BLOCKED_TAGS = new Set([4, 10]);
  const OVERPAY_MIN_RATIO = 1.025;
  const OVERPAY_MAX_RATIO = 1.75;
  const OVERPAY_MIN_DIFF = 2000;

  function effective_value_from_row(row) {
    if (!Array.isArray(row)) return 0;
    let rap = Number(row[2]) || 0;
    let v = Number(row[3]);
    let raw = Number.isFinite(v) ? v : 0;
    return raw > 0 ? raw : rap;
  }

  function item_summary_from_row(id, row) {
    if (!Array.isArray(row)) {
      return {
        id: Number(id),
        name: "",
        acronym: "",
        value: 0,
        rap: 0,
      };
    }
    let rap = Number(row[2]) || 0;
    let v = Number(row[3]);
    let value = Number.isFinite(v) && v > 0 ? v : rap > 0 ? rap : 0;
    return {
      id: Number(id),
      name: String(row[0] || ""),
      acronym: String(row[1] || ""),
      value,
      rap,
    };
  }

  function is_blocked_want_tag(tag) {
    let num = Number(tag);
    if (Number.isFinite(num) && WANT_BLOCKED_TAGS.has(num)) return true;
    let txt = String(tag || "").trim().toLowerCase();
    return txt === "any" || txt === "adds";
  }

  function passes_single_item_want_filter(ad) {
    if (!ad || typeof ad !== "object") return false;
    let want = ad.want;
    if (!want || typeof want !== "object") return false;
    let want_ids = Array.isArray(want.itemIds) ? want.itemIds : [];
    if (want_ids.length !== 1) return false;
    if (Number(want.robux) > 0) return false;
    let want_tags = Array.isArray(want.tags) ? want.tags : [];
    let top_tags = Array.isArray(ad?.tags) ? ad.tags : [];
    let all_tags = [...want_tags, ...top_tags];
    if (all_tags.length > 0) {
      for (let tag of all_tags) {
        if (is_blocked_want_tag(tag)) return false;
      }
    }
    return true;
  }

  function summarize_ad_values(ad, get_row) {
    let have_ids = Array.isArray(ad?.have?.itemIds) ? ad.have.itemIds : [];
    let want_ids = Array.isArray(ad?.want?.itemIds) ? ad.want.itemIds : [];
    let offer_items = have_ids.map((id) =>
      item_summary_from_row(id, get_row(Number(id))),
    );
    let wanted_item = want_ids.length
      ? item_summary_from_row(want_ids[0], get_row(Number(want_ids[0])))
      : null;
    let have_total = offer_items.reduce((sum, it) => sum + (it.value || 0), 0);
    let want_total = wanted_item ? wanted_item.value || 0 : 0;
    let have_robux = Math.max(0, Number(ad?.have?.robux) || 0);
    if (have_robux > 0) have_total += have_robux;
    return { offer_items, wanted_item, have_total, want_total, have_robux };
  }

  function is_overpay_trade(have_total, want_total) {
    if (!(want_total > 0) || !(have_total > 0)) return false;
    if (have_total <= want_total * OVERPAY_MIN_RATIO) return false;
    if (have_total > want_total * OVERPAY_MAX_RATIO) return false;
    if (have_total - want_total < OVERPAY_MIN_DIFF) return false;
    return true;
  }

  function build_match(ad, owned_ids, get_row, viewer_user_id) {
    if (!passes_single_item_want_filter(ad)) return null;
    if (
      viewer_user_id != null &&
      String(ad.userId) === String(viewer_user_id)
    ) {
      return null;
    }

    let wanted_id = Number(ad.want.itemIds[0]);
    if (!Number.isFinite(wanted_id) || wanted_id <= 0) return null;
    if (!owned_ids.has(String(wanted_id))) return null;

    let { offer_items, wanted_item, have_total, want_total, have_robux } =
      summarize_ad_values(ad, get_row);
    if (!wanted_item || want_total <= 0) return null;
    if (!is_overpay_trade(have_total, want_total)) return null;

    let overpay_amount = have_total - want_total;
    let overpay_percent =
      want_total > 0 ? Math.round((overpay_amount / want_total) * 100) : 0;

    return {
      adId: ad.id,
      createdAt: ad.createdAt,
      username: String(ad.username || ""),
      userId: ad.userId,
      wantedItemId: wanted_id,
      wantedItem: wanted_item,
      offerItems: offer_items,
      haveRobux: have_robux,
      wantTags: Array.isArray(ad?.want?.tags) ? ad.want.tags.slice() : [],
      requestTags: Array.isArray(ad?.tags) ? ad.tags.slice() : [],
      haveTotal: have_total,
      wantTotal: want_total,
      overpayAmount: overpay_amount,
      overpayPercent: overpay_percent,
      matchedAt: Date.now(),
    };
  }

  function scan_ads_for_matches(ads, owned_ids, get_row, viewer_user_id) {
    let matches = [];
    if (!Array.isArray(ads)) return matches;
    for (let ad of ads) {
      let match = build_match(ad, owned_ids, get_row, viewer_user_id);
      if (match) matches.push(match);
    }
    matches.sort((a, b) => {
      let ca = Number(a.createdAt) || 0;
      let cb = Number(b.createdAt) || 0;
      if (cb !== ca) return cb - ca;
      return Number(b.overpayAmount) - Number(a.overpayAmount);
    });
    return matches;
  }

  root.TradeAdNotificationsCore = {
    WANT_BLOCKED_TAGS,
    is_blocked_want_tag,
    OVERPAY_MIN_RATIO,
    OVERPAY_MAX_RATIO,
    OVERPAY_MIN_DIFF,
    effective_value_from_row,
    item_summary_from_row,
    passes_single_item_want_filter,
    summarize_ad_values,
    is_overpay_trade,
    build_match,
    scan_ads_for_matches,
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
