// Image card for trade desktop notifications: what you give / what you get,
// value totals and the gain/loss pill. Drawn on an OffscreenCanvas and handed
// to chrome.notifications as a data: URL (remote image URLs are unreliable
// there). Returns null when anything is missing so callers fall back to text.

function nte_blob_to_data_url(blob) {
  return blob.arrayBuffer().then((buffer) => {
    let bytes = new Uint8Array(buffer);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return `data:${blob.type || "image/png"};base64,${btoa(bin)}`;
  });
}

async function nte_fetch_data_url(url) {
  try {
    let res = await fetch(url);
    return res.ok ? await nte_blob_to_data_url(await res.blob()) : null;
  } catch {
    return null;
  }
}

// Rich notifications (image + buttons) are Chromium-only; Firefox rejects them.
function nte_rich_notifications_supported() {
  let ua = String(globalThis.navigator?.userAgent || "");
  return /Chrome\//.test(ua) && !/Firefox\//.test(ua);
}

async function nte_card_thumb_bitmaps(items) {
  let out = new Map();
  let groups = { Asset: [], Bundle: [] };
  for (let item of items) {
    let id = get_trade_asset_id(item);
    if (!id) continue;
    let kind = item?.itemTarget?.itemType === "Bundle" ? "Bundle" : "Asset";
    groups[kind].push(id);
  }
  let urls = [];
  for (let [kind, ids] of Object.entries(groups)) {
    if (!ids.length) continue;
    let list = [...new Set(ids)].slice(0, 30).join(",");
    let api =
      kind === "Bundle"
        ? `https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${list}&size=150x150&format=Png&isCircular=false`
        : `https://thumbnails.roblox.com/v1/assets?assetIds=${list}&size=150x150&format=Png&isCircular=false`;
    let data = await fetch(api)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    for (let row of data?.data || [])
      if (row?.imageUrl) urls.push([Number(row.targetId), row.imageUrl]);
  }
  await Promise.all(
    urls.map(async ([id, url]) => {
      try {
        let res = await fetch(url);
        if (res.ok) out.set(id, await createImageBitmap(await res.blob()));
      } catch {}
    }),
  );
  return out;
}

function get_trade_offer_item_list(offer) {
  let items =
    offer?.userAssets ||
    offer?.assets ||
    offer?.userItems ||
    offer?.items ||
    offer?.userCollectibles ||
    offer?.collectibles ||
    [];
  return Array.isArray(items) ? items : [];
}

function nte_card_round_rect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function nte_card_offer_rap(offer) {
  return get_trade_offer_item_list(offer).reduce(
    (sum, item) =>
      sum + (Number(item?.recentAveragePrice ?? item?.rap ?? 0) || 0),
    0,
  );
}

function nte_card_signed(diff, base, unit) {
  let pct =
    base > 0
      ? ` (${diff > 0 ? "+" : diff < 0 ? "−" : ""}${Math.round((Math.abs(diff) / base) * 100)}%)`
      : "";
  if (diff === 0) return `Even ${unit}`;
  return `${diff > 0 ? "+" : "−"}${format_number(Math.abs(diff))} ${unit}${pct}`;
}

// 2:1 like a Windows toast hero image, so nothing gets cropped.
async function build_trade_notification_card(offer_pair, stats) {
  if (typeof OffscreenCanvas === "undefined" || !offer_pair || !stats)
    return null;
  try {
    let give = get_trade_offer_item_list(offer_pair.your_offer);
    let get = get_trade_offer_item_list(offer_pair.their_offer);
    if (!give.length && !get.length) return null;
    let bitmaps = await nte_card_thumb_bitmaps([...give, ...get]);

    const W = 800;
    const H = 400;
    let canvas = new OffscreenCanvas(W, H);
    let g = canvas.getContext("2d");
    let font = (weight, size) =>
      `${weight} ${size}px "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif`;
    let ink = (a) => `rgba(255, 255, 255, ${a})`;
    let green = ["rgba(0, 176, 111, 0.2)", "#3ddc97"];
    let red = ["rgba(229, 72, 77, 0.2)", "#ff7b80"];
    let even = [ink(0.08), ink(0.8)];
    let tone = (diff) => (diff > 0 ? green : diff < 0 ? red : even);

    g.fillStyle = "#16181c";
    g.fillRect(0, 0, W, H);

    let your_rap = nte_card_offer_rap(offer_pair.your_offer);
    let their_rap = nte_card_offer_rap(offer_pair.their_offer);

    // One side: label, up to 4 tiles (3 + "+N" when more), value, RAP, Robux.
    let column = (items, value, rap, robux, x0, label) => {
      let cx = x0 + 180;
      g.textAlign = "center";
      g.fillStyle = ink(0.5);
      g.font = font(600, 17);
      g.fillText(label, cx, 40);
      let size = 74;
      let gap = 8;
      let shown = items.length > 4 ? 3 : items.length;
      let tiles = Math.max(1, shown + (items.length > 4 ? 1 : 0));
      let x = cx - (tiles * size + (tiles - 1) * gap) / 2;
      for (let i = 0; i < tiles; i++) {
        g.fillStyle = ink(0.07);
        nte_card_round_rect(g, x, 58, size, size, 16);
        g.fill();
        if (i < shown) {
          let bmp = bitmaps.get(get_trade_asset_id(items[i]));
          if (bmp) g.drawImage(bmp, x + 6, 64, size - 12, size - 12);
        } else if (items.length > 4) {
          g.fillStyle = ink(0.8);
          g.font = font(700, 24);
          g.fillText(`+${items.length - shown}`, x + size / 2, 104);
        }
        x += size + gap;
      }
      g.fillStyle = ink(0.45);
      g.font = font(600, 15);
      g.fillText("VALUE", cx, 166);
      g.fillStyle = ink(0.96);
      g.font = font(700, 34);
      g.fillText(format_number(value), cx, 202);
      g.fillStyle = ink(0.55);
      g.font = font(600, 18);
      let sub = `RAP ${format_number(rap)}`;
      if (robux > 0) sub += `  ·  R$ ${format_number(robux)}`;
      g.fillText(sub, cx, 232);
    };
    column(
      give,
      stats.your_value,
      your_rap,
      Number(offer_pair.your_offer?.robux) || 0,
      20,
      "YOU GIVE",
    );
    column(
      get,
      stats.their_value,
      their_rap,
      Number(offer_pair.their_offer?.robux) || 0,
      420,
      "YOU GET",
    );

    // Divider with the swap arrows.
    let mx = W / 2;
    g.fillStyle = ink(0.07);
    g.fillRect(mx - 0.5, 40, 1, 200);
    g.fillStyle = "#16181c";
    g.beginPath();
    g.arc(mx, 95, 26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = ink(0.08);
    g.beginPath();
    g.arc(mx, 95, 22, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = ink(0.75);
    g.lineWidth = 3;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(mx - 9, 90);
    g.lineTo(mx + 9, 90);
    g.moveTo(mx + 4, 85);
    g.lineTo(mx + 9, 90);
    g.lineTo(mx + 4, 95);
    g.moveTo(mx + 9, 100);
    g.lineTo(mx - 9, 100);
    g.moveTo(mx - 4, 95);
    g.lineTo(mx - 9, 100);
    g.lineTo(mx - 4, 105);
    g.stroke();

    // Gain/loss pills: value (big) and RAP (smaller) side by side.
    let value_diff = Number(stats.diff) || 0;
    let rap_diff = their_rap - your_rap;
    let pills = [
      [nte_card_signed(value_diff, stats.your_value, "value"), tone(value_diff), 24, 52],
      [nte_card_signed(rap_diff, your_rap, "RAP"), tone(rap_diff), 19, 44],
    ];
    let widths = pills.map(([text, , size]) => {
      g.font = font(700, size);
      return g.measureText(text).width + 44;
    });
    let x = mx - (widths[0] + widths[1] + 14) / 2;
    pills.forEach(([text, [bg, fg], size, h], i) => {
      let y = 286 + (52 - h) / 2;
      g.fillStyle = bg;
      nte_card_round_rect(g, x, y, widths[i], h, h / 2);
      g.fill();
      g.fillStyle = fg;
      g.font = font(700, size);
      g.textAlign = "center";
      g.fillText(text, x + widths[i] / 2, y + h / 2 + size * 0.36);
      x += widths[i] + 14;
    });

    return await nte_blob_to_data_url(
      await canvas.convertToBlob({ type: "image/png" }),
    );
  } catch {
    return null;
  }
}
