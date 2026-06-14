/* Restored inbound trade Discord webhook + preview image. */
function get_trade_item_recent_average_price(item) {
  let rap = Number(
    item?.recentAveragePrice ??
      item?.rap ??
      item?.item?.recentAveragePrice ??
      item?.asset?.recentAveragePrice ??
      item?.collectibleItem?.recentAveragePrice,
  );
  if (Number.isFinite(rap) && rap > 0) return rap;
  let instances = Array.isArray(item?.instances) ? item.instances : [];
  for (let instance of instances) {
    let instance_rap = Number(instance?.recentAveragePrice ?? instance?.rap);
    if (Number.isFinite(instance_rap) && instance_rap > 0) return instance_rap;
  }
  let original = Number(
    item?.originalPrice ??
      item?.item?.originalPrice ??
      item?.asset?.originalPrice ??
      item?.collectibleItem?.originalPrice,
  );
  return Number.isFinite(original) && original > 0 ? original : 0;
}

function get_trade_offer_items(e) {
    let t = e?.userAssets || e?.assets || e?.userItems || e?.items || e?.userCollectibles || e?.collectibles || [];
    return Array.isArray(t) ? t : [];
}

function get_trade_item_asset_id(e) {
    let t = Number(e?.assetId ?? e?.itemTarget?.targetId ?? e?.targetId ?? e?.itemId ?? e?.asset?.id ?? e?.item?.id ?? e?.id);
    return Number.isFinite(t) && t > 0 ? t : 0;
}

function get_trade_item_user_asset_id(e) {
    let t = Number(e?.userAssetId ?? e?.userAsset?.userAssetId ?? e?.userAsset?.id);
    return Number.isFinite(t) && t > 0 ? t : 0;
}

function get_trade_item_copy_count(e) {
    let t = Array.isArray(e?.instances) ? e.instances.length : 0;
    return t > 0 ? t : 1;
}

function get_trade_offer_item_names(e, t = 4) {
    let a = get_trade_offer_items(e).map(e => {
        let t = String(get_trade_item_name(e) || "").trim();
        if (t) return t;
        let a = get_trade_item_asset_id(e);
        return a > 0 ? `Asset ${a}` : "";
    }).filter(Boolean);
    return a.length ? a.length <= t ? a.join(", ") : `${a.slice(0, t).join(", ")} (+${a.length - t} more)` : "No items";
}

function get_trade_offer_first_asset_id(e) {
    let t = get_trade_offer_items(e);
    for (let e of t) {
        let t = get_trade_item_asset_id(e);
        if (t > 0) return t;
    }
    return 0;
}

function compute_offer_rap_total(e) {
    let t = Number(e?.robux) || 0;
    for (let a of get_trade_offer_items(e)) t += get_trade_item_recent_average_price(a) * get_trade_item_copy_count(a);
    return t;
}

function get_trade_rap_stats(e, t = 0) {
    let a = get_trade_notification_offer_pair(e, t);
    if (!a) return null;
    let r = compute_offer_rap_total(a.your_offer), i = compute_offer_rap_total(a.their_offer);
    return {
        your_rap: r,
        their_rap: i,
        diff_rap: i - r
    };
}

async function get_trade_user_avatar_thumb(e) {
    let t = Number(e);
    if (!(t > 0)) return "";
    try {
        let e = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${t}&size=420x420&format=Png&isCircular=true`, {
            credentials: "include",
            cache: "no-store"
        }), a = await parse_json_response_safe(e, "Roblox avatar thumbnail");
        return String(a?.data?.[0]?.imageUrl || "").trim();
    } catch {
        return "";
    }
}

async function get_trade_asset_thumb(e) {
    let t = Number(e);
    if (!(t > 0)) return "";
    try {
        let e = await fetch_trade_history_asset_thumbnails([ t ]);
        return String(e?.[t] || e?.[String(t)] || "").trim();
    } catch {
        return "";
    }
}

function get_trade_offer_visual_items(e, t = 4) {
    let a = [];
    for (let i of get_trade_offer_items(e)) {
        let e = get_trade_item_asset_id(i);
        if (!(e > 0)) continue;
        let n = String(i?.itemTarget?.itemType || i?.itemType || i?.assetType || "Asset").toLowerCase(), o = "bundle" === n || "bundlethumbnail" === n ? "BundleThumbnail" : "Asset";
        for (let c = 0; c < get_trade_item_copy_count(i); c++) {
            if (a.push({
                assetId: e,
                name: String(get_trade_item_name(i) || `Asset ${e}`).trim(),
                thumbType: o
            }), a.length >= t) break;
        }
        if (a.length >= t) break;
    }
    return a;
}

async function fetch_trade_visual_item_thumbs(e) {
    let t = {}, a = Array.isArray(e) ? e : [];
    if (!a.length) return t;
    let r = (e = "primary") => a.map((t, a) => {
        let r = Number(t?.assetId);
        if (!(r > 0)) return null;
        let i = String(t?.thumbType || "Asset"), n = "retry" === e ? "BundleThumbnail" === i ? "Asset" : "BundleThumbnail" : i;
        return {
            requestId: `${e}:${n}:${r}:${a}`,
            type: n,
            targetId: r,
            token: "",
            format: "webp",
            size: "420x420"
        };
    }).filter(Boolean), i = async e => {
        if (e.length) try {
            let a = await fetch("https://thumbnails.roblox.com/v1/batch", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify(e),
                credentials: "omit",
                cache: "no-store"
            }), r = await parse_json_response_safe(a, "Roblox batch thumbnails");
            for (let e of r?.data || []) {
                let a = Number(e?.targetId), r = String(e?.imageUrl || "").trim();
                a > 0 && r && (t[String(a)] = r);
            }
        } catch {}
    };
    return await i(r("primary")), a.some(e => !t[String(Number(e?.assetId) || 0)]) && await i(r("retry")), 
    t;
}

async function fetch_trade_offer_visual_items_with_thumbs(e, t = 4) {
    let a = get_trade_offer_visual_items(e, t);
    if (!a.length) return [];
    let r = await fetch_trade_visual_item_thumbs(a), i = a.filter(e => !r[e.assetId]).map(e => e.assetId);
    if (i.length) {
        let e = await fetch_trade_history_asset_thumbnails(i);
        r = {
            ...e,
            ...r
        };
    }
    return a.map(e => ({
        ...e,
        thumb: String(r?.[e.assetId] || r?.[String(e.assetId)] || "")
    }));
}

async function load_image_bitmap_safe(e) {
    let t = String(e || "").trim();
    if (!t) return null;
    try {
        let e = await fetch(t, {
            cache: "no-store",
            credentials: "omit"
        });
        if (!e.ok) return null;
        let a = await e.blob();
        return !a || a.size <= 0 ? null : await createImageBitmap(a);
    } catch {
        return null;
    }
}

function draw_trade_preview_placeholder(e, t, a, r) {
    e.fillStyle = "rgba(255,255,255,0.06)", e.fillRect(t, a, r, r), e.strokeStyle = "rgba(255,255,255,0.12)", 
    e.strokeRect(t + .5, a + .5, r - 1, r - 1);
}

function draw_trade_preview_rounded_rect(e, t, a, r, i, n) {
    let o = Math.max(0, Math.min(n, Math.min(r, i) / 2));
    e.beginPath(), e.moveTo(t + o, a), e.lineTo(t + r - o, a), e.quadraticCurveTo(t + r, a, t + r, a + o), 
    e.lineTo(t + r, a + i - o), e.quadraticCurveTo(t + r, a + i, t + r - o, a + i), 
    e.lineTo(t + o, a + i), e.quadraticCurveTo(t, a + i, t, a + i - o), e.lineTo(t, a + o), 
    e.quadraticCurveTo(t, a, t + o, a), e.closePath();
}

async function build_inbound_trade_preview_blob(e, t, a) {
    if ("undefined" == typeof OffscreenCanvas) return null;
    if (!e) return null;
    let giveItems = await fetch_trade_offer_visual_items_with_thumbs(e.your_offer, 4);
    let recvItems = await fetch_trade_offer_visual_items_with_thumbs(e.their_offer, 4);
    if (!giveItems.length && !recvItems.length) return null;
    let itemData = await get_cached_item_data(6e5).catch(() => null);
    function getItemRap(id) {
        let idata = itemData?.items?.[String(id)];
        if (Array.isArray(idata)) {
            let rap = idata[2];
            if (Number.isFinite(rap) && rap > 0) return rap;
        }
        let raw = get_trade_offer_items(e.your_offer).concat(get_trade_offer_items(e.their_offer));
        for (let it of raw) if (get_trade_item_asset_id(it) === id) {
            let r = get_trade_item_recent_average_price(it);
            if (r > 0) return r;
        }
        return 0;
    }
    function getItemVal(id, name) {
        return get_item_value_from_data(itemData, id, getItemRap(id), name);
    }
    let postTaxEnabled = await get_post_tax_trade_values_enabled();
    let yourRobuxRaw = Number(e?.your_offer?.robux) || 0;
    let theirRobuxRaw = Number(e?.their_offer?.robux) || 0;
    let yourRobux = yourRobuxRaw;
    let theirRobux = postTaxEnabled ? Math.round(.7 * theirRobuxRaw) : theirRobuxRaw;
    let hasAnyRobux = yourRobux > 0 || theirRobux > 0;
    let robuxBmp = await load_image_bitmap_safe(chrome.runtime.getURL("elements/robux.png")).catch(() => null);
    let roliBmp = await load_image_bitmap_safe(chrome.runtime.getURL("assets/rolimons.png")).catch(() => null);
    let rareBadgeBmp = await load_image_bitmap_safe(chrome.runtime.getURL("assets/rare.png")).catch(() => null);
    let projectedBadgeBmp = await load_image_bitmap_safe(chrome.runtime.getURL("assets/projected.png")).catch(() => null);
    let nte_logo_bmp = await load_image_bitmap_safe(
        chrome.runtime.getURL("assets/icons/logo48.png"),
    ).catch(() => null);
    function colorize(src, sz, clr) {
        if (!src) return null;
        try {
            const o = new OffscreenCanvas(sz, sz), c = o.getContext("2d");
            c.drawImage(src, 0, 0, sz, sz);
            c.globalCompositeOperation = "source-in";
            c.fillStyle = clr;
            c.fillRect(0, 0, sz, sz);
            return o;
        } catch {
            return null;
        }
    }
    const IC = 15, IB = 17;
    const CLR = {
        gray: "#c0c4c8",
        cyan: "#22d3ee",
        red: "#ef4444",
        white: "#ffffff",
        dimgray: "#9ca3af"
    };
    const R = {
        gray: colorize(robuxBmp, IC, CLR.gray),
        white: colorize(robuxBmp, IC, CLR.white),
        gray17: colorize(robuxBmp, IB, CLR.gray),
        cyan17: colorize(robuxBmp, IB, CLR.cyan),
        red17: colorize(robuxBmp, IB, CLR.red)
    };
    const V = {
        cyan: colorize(roliBmp, IC, CLR.cyan),
        cyan17: colorize(roliBmp, IB, CLR.cyan),
        red17: colorize(roliBmp, IB, CLR.red),
        gray17: colorize(roliBmp, IB, CLR.gray)
    };
    let FR = "system-ui,-apple-system,'Segoe UI',sans-serif";
    let FB = "";
    let _fontErr = "none";
    const _loadFF = async (name, url) => {
        const buf = await fetch(url).then(r => {
            if (!r.ok) throw new Error(r.status);
            return r.arrayBuffer();
        });
        const blob = new Blob([ buf ], {
            type: "font/ttf"
        });
        const blobUrl = URL.createObjectURL(blob);
        const face = new FontFace(name, `url(${blobUrl})`);
        await face.load();
        try {
            (self.fonts || document.fonts).add(face);
        } catch {}
        return {
            face: face,
            blobUrl: blobUrl
        };
    };
    try {
        let _r, _b;
        try {
            _r = await _loadFF("NVFr", chrome.runtime.getURL("assets/dm-sans-700.woff2"));
        } catch (e) {
            throw e;
        }
        try {
            const buf900 = await fetch(chrome.runtime.getURL("assets/dm-sans-800.woff2")).then(r => {
                if (!r.ok) throw new Error(r.status);
                return r.arrayBuffer();
            });
            const f900 = new FontFace("NVFb", buf900);
            await f900.load();
            try {
                (self.fonts || document.fonts).add(f900);
            } catch {}
            _b = {
                face: f900,
                blobUrl: ""
            };
        } catch {
            _b = await _loadFF("NVFb", chrome.runtime.getURL("assets/dm-sans-800.woff2"));
        }
        const [{face: f1, blobUrl: u1}, {face: f2, blobUrl: u2}] = [ _r, _b ];
        const wu = new OffscreenCanvas(200, 30), wc = wu.getContext("2d");
        wc.font = `14px NVFr`;
        wc.fillText("Hello", 0, 20);
        wc.font = `14px NVFb`;
        wc.fillText("Hello", 0, 20);
        await new Promise(r => setTimeout(r, 150));
        URL.revokeObjectURL(u1);
        URL.revokeObjectURL(u2);
        FR = "NVFr,sans-serif";
        FB = "NVFb,sans-serif";
    } catch (e) {
        _fontErr = String(e?.message || e).slice(0, 20);
    }
    const reg = sz => `${sz}px ${FR}`;
    const bld = sz => FB ? `${sz}px ${FB}` : `bold ${sz}px ${FR}`;
    const W = 800, PAD = 28, CW = 174, CG = 16, BG = "#111315", CBG = "#2a2e33";
    const T_PAD = 10, TS = CW - 16;
    const T_BOT = T_PAD + TS;
    const NL1 = T_BOT + 20;
    const LH = 17;
    const N2R = 22;
    const R2V = 21;
    const BOT = 26;
    const CH = NL1 + LH + N2R + R2V + BOT;
    const HDR = 94, SLH = 32, TH = 72, BH = 46, SG = 24;
    const S1C = HDR + SLH, S1T = S1C + CH + 14, S1B = S1T + TH + 8;
    const S2S = S1B + BH + SG, S2C = S2S + SLH, S2T = S2C + CH + 14;
    const FOOTER_H = 58;
    const FY = S2T + TH + 12;
    const H = FY + FOOTER_H;
    const cv = new OffscreenCanvas(W, H), ctx = cv.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    function rr(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
    function wrap(txt, maxW, font) {
        ctx.font = font;
        let ws = txt.split(" "), ls = [], c = "";
        for (let w of ws) {
            let t = c ? c + " " + w : w;
            ctx.measureText(t).width <= maxW ? c = t : (c && ls.push(c), c = w);
        }
        c && ls.push(c);
        return ls;
    }
    function iconText(icon, sz, text, clr, font, ix, baseline) {
        if (icon) ctx.drawImage(icon, ix, Math.round(baseline - sz * .85), sz, sz);
        ctx.fillStyle = clr;
        ctx.font = font;
        ctx.fillText(text, ix + (icon ? sz + 5 : 0), baseline);
    }
    const myName =
      String(e?.your_offer?.user?.name || e?.your_offer?.user?.displayName || "").trim() ||
      "You";
    const theirDisplayName = String(e?.their_offer?.user?.displayName || "");
    const theirUserName = String(e?.their_offer?.user?.name || "");
    const theirName = theirDisplayName && theirUserName && theirDisplayName !== theirUserName ? theirDisplayName + " (" + theirUserName + ")" : theirDisplayName || theirUserName || "";
    ctx.fillStyle = "#d1d5db";
    ctx.font = reg(18);
    ctx.fillText(myName, PAD, 33);
    ctx.textAlign = "right";
    ctx.fillText((new Date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }), W - PAD, 33);
    ctx.textAlign = "left";
    ctx.fillStyle = CLR.white;
    ctx.font = bld(30);
    ctx.fillText(theirName ? "Trade with " + theirName : "Inbound Trade", PAD, 72);
    function secLbl(txt, sy) {
        ctx.fillStyle = CLR.white;
        ctx.font = reg(16);
        ctx.fillText(txt, PAD, sy + 21);
    }
    secLbl("Items you will give", HDR);
    secLbl("Items you will receive", S2S);
    async function drawCards(items, CY) {
        for (let i = 0; i < Math.min(4, items.length); i++) {
            const cx = PAD + i * (CW + CG), cy = CY, item = items[i];
            const idata = itemData?.items?.[String(item.assetId)] || null;
            const isRare =
              Array.isArray(idata) &&
              (typeof RolimonsItemDetails !== "undefined" &&
              RolimonsItemDetails.is_item_rare
                ? RolimonsItemDetails.is_item_rare(idata)
                : idata[9] === 1 || (idata[8] === 1 && idata.length < 11));
            const isProj = Array.isArray(idata) && idata[7] === 1;
            const irap = getItemRap(item.assetId), ival = getItemVal(item.assetId, item.name);
            ctx.fillStyle = CBG;
            rr(cx, cy, CW, CH, 12);
            ctx.fill();
            const tx = cx + T_PAD, ty = cy + T_PAD;
            if (item.thumb) {
                const b = await load_image_bitmap_safe(item.thumb);
                if (b) {
                    ctx.save();
                    rr(tx, ty, TS, TS, 6);
                    ctx.clip();
                    ctx.drawImage(b, tx, ty, TS, TS);
                    ctx.restore();
                } else {
                    ctx.fillStyle = "rgba(255,255,255,0.04)";
                    rr(tx, ty, TS, TS, 6);
                    ctx.fill();
                }
            } else {
                ctx.fillStyle = "rgba(255,255,255,0.04)";
                rr(tx, ty, TS, TS, 6);
                ctx.fill();
            }
            if (isRare || isProj) {
                let tagOffset = 20;
                const badgeY = cy + 8;
                const projX = cx + CW - 6;
                if (isProj) {
                    const projImg = projectedBadgeBmp;
                    if (projImg) {
                        ctx.drawImage(projImg, projX - 18, badgeY, 18, 18);
                    } else {
                        ctx.fillStyle = "#fbbf24";
                        ctx.beginPath();
                        ctx.moveTo(projX - 9, badgeY - 9);
                        ctx.lineTo(projX, badgeY + 7);
                        ctx.lineTo(projX - 18, badgeY + 7);
                        ctx.closePath();
                        ctx.fill();
                        ctx.fillStyle = "#1c1400";
                        ctx.font = "bold 10px Arial";
                        ctx.textAlign = "center";
                        ctx.fillText("!", projX - 9, badgeY + 7);
                        ctx.textAlign = "left";
                    }
                }
                if (isRare) {
                    const rareX = isProj ? projX - 18 - tagOffset : projX - 18;
                    const rareImg = rareBadgeBmp;
                    if (rareImg) {
                        ctx.drawImage(rareImg, rareX, badgeY, 18, 18);
                    } else {
                        ctx.fillStyle = "#3b82f6";
                        ctx.beginPath();
                        ctx.moveTo(rareX + 9, badgeY - 8);
                        ctx.lineTo(rareX + 16, badgeY);
                        ctx.lineTo(rareX + 9, badgeY + 8);
                        ctx.lineTo(rareX + 2, badgeY);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
            }
            const lx = cx + 10, mw = CW - 20, nf = reg(15);
            const nl = wrap(String(item.name || "?"), mw, nf);
            let line1 = nl[0] || "", line2 = nl[1] || "";
            if (nl.length > 2) {
                ctx.font = nf;
                let words = line2.split(" ");
                let truncated = "";
                for (const w of words) {
                    const test = (truncated ? truncated + " " + w : w) + "...";
                    if (ctx.measureText(test).width <= mw) truncated = truncated ? truncated + " " + w : w; else break;
                }
                line2 = (truncated || line2.slice(0, Math.floor(line2.length * .7))) + "...";
            }
            ctx.fillStyle = CLR.white;
            ctx.font = nf;
            ctx.fillText(line1, lx, cy + NL1);
            const has2 = line2.length > 0;
            if (has2) ctx.fillText(line2, lx, cy + NL1 + LH);
            const lastBase = cy + NL1 + (has2 ? LH : 0);
            const remaining = cy + CH - lastBase;
            const blockH = 14 + 8 + 14;
            const blockTop = lastBase + Math.round((remaining - blockH) / 2);
            iconText(R.gray, IC, format_number(irap), CLR.white, reg(14), lx, blockTop + 14);
            iconText(V.cyan, IC, format_number(ival), CLR.cyan, reg(14), lx, blockTop + 14 + 8 + 14);
        }
    }
    function drawTotals(totRap, totVal, totRobux, ty, showRobux = true) {
        ctx.fillStyle = CLR.white;
        ctx.font = reg(16);
        ctx.fillText("Totals:", PAD, ty + 19);
        ctx.textAlign = "right";
        const showRbx = showRobux && (totRobux || 0) > 0;
        const ROW_H = 24;
        let startY = ty + 19;
        const IG = 5;
        if (showRbx) {
            ctx.font = bld(16);
            const rbxY = startY;
            const rbxText = format_number(totRobux);
            const rbxW = ctx.measureText(rbxText).width;
            const rbxIX = W - PAD - rbxW - IG - IC;
            if (R.gray) ctx.drawImage(R.gray, rbxIX, Math.round(rbxY - IC * .85), IC, IC);
            ctx.fillStyle = "#8a8d91";
            ctx.fillText(rbxText, W - PAD, rbxY);
            startY += ROW_H;
        }
        ctx.font = bld(16);
        const rapY = startY;
        const rapText = format_number(totRap);
        const rapW = ctx.measureText(rapText).width;
        const rapIX = W - PAD - rapW - IG - IC;
        if (R.white) ctx.drawImage(R.white, rapIX, Math.round(rapY - IC * .85), IC, IC);
        ctx.fillStyle = CLR.white;
        ctx.fillText(rapText, W - PAD, rapY);
        startY += ROW_H;
        ctx.font = bld(16);
        const valY = startY;
        const valText = format_number(totVal);
        const valW = ctx.measureText(valText).width;
        const valIX = W - PAD - valW - IG - IC;
        if (V.cyan) ctx.drawImage(V.cyan, valIX, Math.round(valY - IC * .85), IC, IC);
        ctx.fillStyle = CLR.cyan;
        ctx.fillText(valText, W - PAD, valY);
        ctx.textAlign = "left";
    }
    function drawBars(rd, vd, by) {
        const barW = (W - PAD * 2 - CG) / 2, barH = BH;
        ctx.fillStyle = "#37393f";
        rr(PAD, by, barW, barH, 10);
        ctx.fill();
        const rs = (rd >= 0 ? "+" : "") + format_number(rd), rc = rd > 0 ? CLR.cyan : rd < 0 ? CLR.red : CLR.gray, ri = rd > 0 ? R.cyan17 : rd < 0 ? R.red17 : R.gray17;
        ctx.font = bld(20);
        const rw = ctx.measureText(rs).width + (ri ? IB + 8 : 0), rx = PAD + (barW - rw) / 2;
        const iconY = by + barH * .5 - IB * .5;
        if (ri) ctx.drawImage(ri, rx, iconY, IB, IB);
        ctx.fillStyle = rc;
        ctx.fillText(rs, rx + (ri ? IB + 8 : 0), by + barH * .5 + 7);
        ctx.fillStyle = "#37393f";
        rr(PAD + barW + CG, by, barW, barH, 10);
        ctx.fill();
        const vs = (vd >= 0 ? "+" : "") + format_number(vd), vc = vd > 0 ? CLR.cyan : vd < 0 ? CLR.red : CLR.gray, vi = vd > 0 ? V.cyan17 : vd < 0 ? V.red17 : V.gray17;
        ctx.font = bld(20);
        const vw = ctx.measureText(vs).width + (vi ? IB + 8 : 0), vx = PAD + barW + CG + (barW - vw) / 2;
        if (vi) ctx.drawImage(vi, vx, iconY, IB, IB);
        ctx.fillStyle = vc;
        ctx.fillText(vs, vx + (vi ? IB + 8 : 0), by + barH * .5 + 7);
    }
    await drawCards(giveItems, S1C);
    let giveRapSum = giveItems.reduce((s, it) => s + getItemRap(it.assetId), 0);
    let recvRapSum = recvItems.reduce((s, it) => s + getItemRap(it.assetId), 0);
    drawTotals(giveRapSum, Number(t?.your_value) || 0, yourRobux, S1T, hasAnyRobux);
    drawBars(recvRapSum - giveRapSum, Number(t?.diff) || 0, S1B);
    await drawCards(recvItems, S2C);
    drawTotals(recvRapSum, Number(t?.their_value) || 0, theirRobux, S2T, hasAnyRobux);

    function draw_nte_trade_preview_watermark() {
        const title = "nevos trading extension";
        const site = "nevos-extension.com";
        const logo_size = 30;
        const text_gap = 11;
        const footer_center_y = FY + FOOTER_H * 0.52;

        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD, FY + 6);
        ctx.lineTo(W - PAD, FY + 6);
        ctx.stroke();

        ctx.font = bld(13);
        const title_w = ctx.measureText(title).width;
        ctx.font = reg(11);
        const site_w = ctx.measureText(site).width;
        const text_w = Math.max(title_w, site_w);
        const block_w = logo_size + text_gap + text_w;
        const block_x = Math.round((W - block_w) * 0.5);
        const logo_y = Math.round(footer_center_y - logo_size * 0.5);

        if (nte_logo_bmp) {
            ctx.save();
            rr(block_x, logo_y, logo_size, logo_size, 8);
            ctx.clip();
            ctx.drawImage(nte_logo_bmp, block_x, logo_y, logo_size, logo_size);
            ctx.restore();
            ctx.strokeStyle = "rgba(167, 139, 250, 0.35)";
            ctx.lineWidth = 1;
            rr(block_x, logo_y, logo_size, logo_size, 8);
            ctx.stroke();
        } else {
            ctx.fillStyle = "rgba(129, 112, 255, 0.22)";
            rr(block_x, logo_y, logo_size, logo_size, 8);
            ctx.fill();
        }

        const text_x = block_x + logo_size + text_gap;
        const title_y = footer_center_y - 7;
        const site_y = footer_center_y + 10;

        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = bld(13);
        const title_grad = ctx.createLinearGradient(
            text_x,
            title_y - 8,
            text_x + title_w,
            title_y + 4,
        );
        title_grad.addColorStop(0, "#ddd6fe");
        title_grad.addColorStop(1, "#a78bfa");
        ctx.fillStyle = title_grad;
        ctx.fillText(title, text_x, title_y);

        ctx.font = reg(11);
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(site, text_x, site_y);
        ctx.restore();
    }

    draw_nte_trade_preview_watermark();
    try {
        return await cv.convertToBlob({
            type: "image/png"
        });
    } catch {
        return null;
    }
}
async function send_inbound_trade_webhook_notification(e, t, a, r, i) {
    if (!i?.webhook_url) return;
    let n = a;
    !n && t && (n = await get_trade_notification_value_stats(t, r));
    let o = String(e?.user?.displayName || e?.user?.name || `User ${e?.user?.id || ""}`).trim(), _ = `https://www.roblox.com/users/${encodeURIComponent(String(Number(e?.user?.id) || 0))}/profile`, s = `https://www.rolimons.com/player/${encodeURIComponent(String(Number(e?.user?.id) || 0))}`, l = get_trade_timestamp_ms(e, "inbound"), d = l ? Math.floor(l / 1e3) : 0, u = t ? get_trade_notification_offer_pair(t, r) : null, c = t ? get_trade_rap_stats(t, r) : null, m = get_trade_offer_first_asset_id(u?.their_offer) || get_trade_offer_first_asset_id(u?.your_offer), f = await get_trade_asset_thumb(m), h = i.ping_enabled && i.discord_id ? `<@${i.discord_id}>` : "";
    let myUser = null;
    try {
        myUser = await get_authenticated_user_cached();
    } catch {}
    let myName = String(myUser?.name || "").trim() || "You";
    let p = `> **${myName}** got a trade from ${`**[${o || "Unknown User"}](${_})** **[(Rolimons)](${s})**`}${h ? ` ${h}` : ""}`, g = "Inbound trade detected.";
    if (n) {
        let e = Number(n.diff) || 0, t = e > 0 ? "+" : "", a = Number.isFinite(n.diff_pct_raw) ? `${n.diff_pct_raw > 0 ? "+" : ""}${Math.round(n.diff_pct_raw)}%` : e > 0 ? "+INF%" : "0%", r = Number(c?.diff_rap) || 0;
        g = `${`${r > 0 ? "+" : ""}${format_number(r)} rap`} / ${`${t}${format_number(e)} value (${a})`}`, 
        d > 0 && (g += `\nReceived: <t:${d}:R>`);
    } else d > 0 && (g = `Received: <t:${d}:R>`);
    let y = {
        username: "nevos trading extension",
        avatar_url: "https://nevos-extension.com/assets/logo-thumb.png?v=2",
        content: p || void 0,
        allowed_mentions: i.ping_enabled && i.discord_id ? {
            parse: [],
            users: [ String(i.discord_id) ]
        } : {
            parse: []
        },
        embeds: [ {
            description: g,
            color: (Number(n?.diff) || 0) > 0 ? 5763719 : (Number(n?.diff) || 0) < 0 ? 15548997 : 9807270,
            title: void 0
        } ]
    }, b = await build_inbound_trade_preview_blob(u, n, c);
    b && b.size > 0 ? y.embeds[0].image = {
        url: "attachment://trade-preview.png"
    } : f && (y.embeds[0].image = {
        url: f
    });
    try {
        let e = JSON.stringify(y), t = null;
        if (b && b.size > 0) {
            let a = new FormData;
            a.append("payload_json", e), a.append("files[0]", b, "trade-preview.png"), t = await fetch(i.webhook_url, {
                method: "POST",
                body: a
            }).catch(() => null);
        }
        if (!t || !t.ok) {
            t && !t.ok && console.info("Nevos Trading Extension: inbound webhook multipart failed", t.status);
            let e = {
                ...y,
                embeds: Array.isArray(y.embeds) ? y.embeds.map(e => {
                    let t = {
                        ...e
                    };
                    return "attachment://trade-preview.png" === t.image?.url && (f ? t.image = {
                        url: f
                    } : delete t.image), t;
                }) : y.embeds
            };
            t = await fetch(i.webhook_url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(e)
            }).catch(() => null);
        }
        t?.ok || console.info("Nevos Trading Extension: inbound webhook request failed", t?.status || 0);
    } catch (e) {
        console.info("Nevos Trading Extension: inbound webhook send failed", e);
    }
}
