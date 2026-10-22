/* Roblox resale-data math shared by the trade page sales panel and the
   background (Rolimons sales panel). Plain functions on NteSalesCore. */
(function (root) {
  "use strict";

  function parse_time(value) {
    if (null == value || "" === value) return NaN;
    if ("number" == typeof value) return value < 1e12 ? 1e3 * value : value;
    if (/^\d+$/.test(String(value))) {
      let parsed = parseInt(value, 10);
      return parsed < 1e12 ? 1e3 * parsed : parsed;
    }
    return new Date(value).getTime();
  }

  function format_date(value) {
    let time = parse_time(value);
    return Number.isFinite(time)
      ? new Intl.DateTimeFormat(void 0, {
          month: "short",
          day: "numeric",
          // Sale points are UTC day buckets; formatting them in the viewer's
          // timezone shifted every date back a day west of UTC.
          timeZone: "UTC",
        }).format(new Date(time))
      : "Unknown";
  }

  function average(values, fallback = 0) {
    let nums = values
      .map((v) => parseFloat(v))
      .filter((v) => Number.isFinite(v));
    return nums.length
      ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
      : fallback;
  }

  function median(values, fallback = 0) {
    let nums = values
      .map((v) => parseFloat(v))
      .filter((v) => Number.isFinite(v))
      .sort((a, b) => a - b);
    if (!nums.length) return fallback;
    let mid = Math.floor(nums.length / 2);
    return Math.round(
      nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2,
    );
  }

  function normalize_points(payload) {
    if (!payload) return [];
    let rows = [];
    let push = (arr) => {
      if (Array.isArray(arr)) for (let row of arr) rows.push(row);
    };
    push(payload.priceDataPoints);
    push(payload.data);
    push(payload?.resaleData?.priceDataPoints);
    push(payload?.graphData?.dataPoints);
    push(payload?.itemPriceData?.priceDataPoints);
    // Roblox reports one price point per day plus a parallel per-day volume.
    let volume_by_time = new Map();
    let push_volumes = (arr) => {
      if (!Array.isArray(arr)) return;
      for (let row of arr) {
        let time = parse_time(row?.date ?? row?.timestamp ?? row?.time);
        let count = parseInt(row?.value ?? row?.volume ?? row?.count ?? 0, 10);
        if (Number.isFinite(time) && Number.isFinite(count) && count > 0)
          volume_by_time.set(time, count);
      }
    };
    push_volumes(payload.volumeDataPoints);
    push_volumes(payload?.resaleData?.volumeDataPoints);
    return rows
      .map((row) => {
        let time_ms = parse_time(
          row?.date ??
            row?.timestamp ??
            row?.time ??
            row?.created ??
            row?.saleDate ??
            row?.soldAt,
        );
        return {
          value: parseInt(
            row?.value ?? row?.price ?? row?.robux ?? row?.amount ?? 0,
            10,
          ),
          time_ms,
          volume: volume_by_time.get(time_ms) || 0,
        };
      })
      .filter(
        (row) =>
          Number.isFinite(row.value) &&
          row.value > 0 &&
          Number.isFinite(row.time_ms),
      )
      .sort((a, b) => b.time_ms - a.time_ms);
  }

  function compute_summary(payload, fallback_rap = 0) {
    let points = normalize_points(payload);
    let rap = parseInt(payload?.recentAveragePrice ?? fallback_rap ?? 0, 10);
    if (!Number.isFinite(rap) || rap < 0) rap = points[0]?.value || 0;
    let now = Date.now(),
      day_ms = 864e5,
      values_7 = points
        .filter((p) => now - p.time_ms <= 7 * day_ms)
        .map((p) => p.value),
      values_30 = points
        .filter((p) => now - p.time_ms <= 30 * day_ms)
        .map((p) => p.value),
      values_prev_30 = points
        .filter(
          (p) =>
            now - p.time_ms > 30 * day_ms && now - p.time_ms <= 60 * day_ms,
        )
        .map((p) => p.value),
      avg_7 = average(values_7, rap),
      avg_30 = average(values_30, avg_7 || rap),
      prev_30 = average(values_prev_30, avg_30 || rap),
      median_30 = median(values_30, avg_30 || rap),
      trend_30 =
        prev_30 > 0 ? Math.round(((avg_30 - prev_30) / prev_30) * 100) : 0,
      recent_sales = points.map((point) => ({
        date_text: format_date(point.time_ms),
        value: point.value,
        volume: point.volume || 0,
      }));
    return {
      rap,
      avg_7,
      avg_30,
      median_30,
      trend_30,
      recent_sales,
      is_probably_projected: median_30 > 0 && rap / median_30 > 1.5,
    };
  }

  function asset_lowest_price(detail) {
    if (!detail) return null;
    let c = detail.CollectiblesItemDetails || detail.collectiblesItemDetails;
    let lp =
      c?.CollectibleLowestResalePrice ??
      c?.collectibleLowestResalePrice ??
      detail.CollectibleLowestResalePrice ??
      detail.collectibleLowestResalePrice;
    let n = parseInt(lp, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function bundle_lowest_price(detail) {
    if (!detail) return null;
    let c = detail.collectibleItemDetail || detail.CollectibleItemDetail;
    let lp =
      c?.lowestResalePrice ??
      c?.lowestPrice ??
      c?.LowestResalePrice ??
      c?.LowestPrice ??
      null;
    let n = parseInt(lp, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function asset_collectible_id(detail) {
    if (!detail) return null;
    let cid = detail.CollectibleItemId ?? detail.collectibleItemId ?? null;
    if (null == cid) return null;
    let s = String(cid).trim();
    return s ? s : null;
  }
  function bundle_collectible_id(detail) {
    if (!detail) return null;
    let c = detail.collectibleItemDetail || detail.CollectibleItemDetail;
    let cid = c?.collectibleItemId ?? c?.CollectibleItemId ?? null;
    if (null == cid) return null;
    let s = String(cid).trim();
    return s ? s : null;
  }

  root.NteSalesCore = {
    asset_lowest_price,
    bundle_lowest_price,
    asset_collectible_id,
    bundle_collectible_id,
    parse_time,
    format_date,
    average,
    median,
    normalize_points,
    compute_summary,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
