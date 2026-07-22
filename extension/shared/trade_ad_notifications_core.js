(function (root) {
  "use strict";

  // Allow all want tags except Any/Adds.
  const WANT_BLOCKED_TAGS = new Set([4, 10]);
  const OVERPAY_DEFAULT_MIN_PERCENT = 2.5;
  const OVERPAY_MAX_RATIO = 1.75;
  const OVERPAY_DEFAULT_MIN_DIFF = 2000;

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

  function normalize_thresholds(options) {
    let min_amount = Math.max(0, Number(options?.minOverpayAmount));
    let min_percent = Math.max(0, Number(options?.minOverpayPercent));
    if (!Number.isFinite(min_amount)) min_amount = OVERPAY_DEFAULT_MIN_DIFF;
    if (!Number.isFinite(min_percent)) min_percent = OVERPAY_DEFAULT_MIN_PERCENT;
    return { minOverpayAmount: min_amount, minOverpayPercent: min_percent };
  }

  function is_overpay_trade(have_total, want_total, options = null) {
    if (!(want_total > 0) || !(have_total > 0)) return false;
    if (have_total > want_total * OVERPAY_MAX_RATIO) return false;
    let overpay_amount = have_total - want_total;
    if (overpay_amount <= 0) return false;
    let thresholds = normalize_thresholds(options);
    if (
      thresholds.minOverpayPercent > 0 &&
      overpay_amount <= want_total * (thresholds.minOverpayPercent / 100)
    ) {
      return false;
    }
    if (
      thresholds.minOverpayAmount > 0 &&
      overpay_amount < thresholds.minOverpayAmount
    ) {
      return false;
    }
    return true;
  }

  function is_projected_row(row) {
    return Array.isArray(row) && Number(row[7]) === 1;
  }

  function offer_has_projected(have_ids, get_row) {
    for (let id of Array.isArray(have_ids) ? have_ids : []) {
      if (is_projected_row(get_row(Number(id)))) return true;
    }
    return false;
  }

  function build_match(ad, owned_ids, get_row, viewer_user_id, options = null) {
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

    if (options?.ignoreProjecteds === true) {
      let have_ids = Array.isArray(ad?.have?.itemIds) ? ad.have.itemIds : [];
      if (offer_has_projected(have_ids, get_row)) return null;
    }

    let { offer_items, wanted_item, have_total, want_total, have_robux } =
      summarize_ad_values(ad, get_row);
    if (!wanted_item || want_total <= 0) return null;
    if (!is_overpay_trade(have_total, want_total, options)) return null;

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

  function sort_matches(matches) {
    return (Array.isArray(matches) ? matches : []).slice().sort((a, b) => {
      let ca = Number(a.createdAt) || 0;
      let cb = Number(b.createdAt) || 0;
      if (cb !== ca) return cb - ca;
      return Number(b.overpayAmount) - Number(a.overpayAmount);
    });
  }

  function scan_ads_for_matches(ads, owned_ids, get_row, viewer_user_id, options = null) {
    let matches = [];
    if (!Array.isArray(ads)) return matches;
    for (let ad of ads) {
      let match = build_match(ad, owned_ids, get_row, viewer_user_id, options);
      if (match) matches.push(match);
    }
    return sort_matches(matches);
  }

  function stored_match_to_ad(match) {
    if (!match || match.adId == null) return null;
    let offer_ids = (Array.isArray(match.offerItems) ? match.offerItems : [])
      .map((it) => Number(it?.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    let wanted_id = Number(match.wantedItemId);
    if (!Number.isFinite(wanted_id) || wanted_id <= 0) return null;
    return {
      id: match.adId,
      createdAt: match.createdAt,
      userId: match.userId,
      username: match.username,
      have: {
        itemIds: offer_ids,
        robux: Math.max(0, Number(match.haveRobux) || 0),
        tags: [],
      },
      want: {
        itemIds: [wanted_id],
        robux: 0,
        tags: Array.isArray(match.wantTags) ? match.wantTags.slice() : [],
      },
      tags: Array.isArray(match.requestTags) ? match.requestTags.slice() : [],
    };
  }

  function rescore_stored_matches(
    matches,
    owned_ids,
    get_row,
    viewer_user_id,
    options = null,
  ) {
    let out = [];
    for (let match of Array.isArray(matches) ? matches : []) {
      let ad = stored_match_to_ad(match);
      if (!ad) continue;
      let refreshed = build_match(ad, owned_ids, get_row, viewer_user_id, options);
      if (refreshed) out.push(refreshed);
    }
    return sort_matches(out);
  }

  root.TradeAdNotificationsCore = {
    WANT_BLOCKED_TAGS,
    is_blocked_want_tag,
    OVERPAY_DEFAULT_MIN_PERCENT,
    OVERPAY_MAX_RATIO,
    OVERPAY_DEFAULT_MIN_DIFF,
    normalize_thresholds,
    effective_value_from_row,
    item_summary_from_row,
    is_projected_row,
    offer_has_projected,
    passes_single_item_want_filter,
    summarize_ad_values,
    is_overpay_trade,
    build_match,
    scan_ads_for_matches,
    rescore_stored_matches,
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
