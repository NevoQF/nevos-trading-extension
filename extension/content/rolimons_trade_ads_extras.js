// Rolimons trade-ad pages: Offer Robux filter (page-world patch), a badge
// with each poster's trade-ad count tier, and a "$" sales panel per item.
(() => {
  const OPTION_NAME = "Fix Rolimons Pages";
  const PATCH_PATH = "scripts/rolimons_trade_ads_patch.js";
  const TIER_LABELS = { 0: "<10 ads", 10: "10+ ads", 100: "100+ ads", 1000: "1k+ ads", 10000: "10k+ ads" };
  let tiers = {};
  let pending = new Set();
  let paint_timer = 0;
  let tiers_off = false;

  function send_message(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) =>
          resolve(chrome.runtime.lastError ? null : res),
        );
      } catch {
        resolve(null);
      }
    });
  }

  function is_enabled() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([OPTION_NAME], (r) =>
          resolve(r?.[OPTION_NAME] !== false),
        );
      } catch {
        resolve(true);
      }
    });
  }

  function inject_robux_filter() {
    if (!/^\/trades\/?$/i.test(location.pathname)) return;
    if (document.getElementById("nte-roli-trade-ads-patch")) return;
    let script = document.createElement("script");
    script.id = "nte-roli-trade-ads-patch";
    script.src = chrome.runtime.getURL(PATCH_PATH);
    (document.head || document.documentElement).appendChild(script);
  }

  function ensure_styles() {
    if (document.getElementById("nte-ad-tier-style")) return;
    let style = document.createElement("style");
    style.id = "nte-ad-tier-style";
    style.textContent = `
.nte-ad-tier{display:inline-block;margin-left:8px;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600;line-height:16px;vertical-align:middle;color:rgba(255,255,255,.75);background:rgba(255,255,255,.08)}
.nte-ad-tier.is-heavy{color:#e8c36a;background:rgba(232,195,106,.14)}
.nte-sp-btn{position:absolute;top:4px;left:4px;z-index:3;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:rgba(20,22,26,.82);color:#e8c36a;font-weight:700;font-size:12px;line-height:22px;cursor:pointer;opacity:0;transition:opacity .15s}
.position-relative:hover>.nte-sp-btn,.nte-sp-btn:focus-visible{opacity:1}
@media (hover:none){.nte-sp-btn{opacity:1}}
.nte-sp-panel{position:absolute;z-index:2000;width:290px;padding:12px;border-radius:12px;background:#24262a;border:1px solid rgba(255,255,255,.1);box-shadow:0 14px 40px rgba(0,0,0,.5);color:#eee;font-size:13px}
.nte-sp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.nte-sp-name{font-size:15px;font-weight:700;line-height:1.25}
.nte-sp-close{border:0;background:rgba(255,255,255,.08);color:#ddd;width:26px;height:26px;border-radius:8px;cursor:pointer;flex:0 0 auto;line-height:26px;padding:0}
.nte-sp-tags{margin-top:4px;font-size:12px;color:rgba(255,255,255,.6)}
.nte-sp-tags b{color:#eee;font-weight:600}
.nte-sp-tags .nte-sp-warn{color:#f0ad4e}
.nte-sp-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}
.nte-sp-stat{padding:7px 9px;border-radius:8px;background:rgba(255,255,255,.05)}
.nte-sp-stat div{font-size:11px;color:rgba(255,255,255,.55)}
.nte-sp-stat b{font-size:14px;font-variant-numeric:tabular-nums}
.nte-sp-usd{color:#e8c36a}
.nte-sp-chart-head,.nte-sp-sales-head{display:flex;justify-content:space-between;margin-top:12px;font-size:11px;color:rgba(255,255,255,.55)}
.nte-sp-chart{display:block;width:100%;height:58px;margin-top:4px}
.nte-sp-sale{display:flex;justify-content:space-between;padding:3px 0;font-variant-numeric:tabular-nums}
.nte-sp-sale i{color:rgba(255,255,255,.5);font-style:normal}
.nte-sp-empty{margin-top:10px;color:rgba(255,255,255,.6);font-size:12px}
.nte-sp-link{display:inline-block;margin-top:10px;font-size:12px;color:#5bc0de}
`;
    (document.head || document.documentElement).appendChild(style);
  }

  function card_player(card) {
    let link = card.querySelector("a.ad_creator_name");
    let id = link?.getAttribute("href")?.match(/\/player\/(\d+)/)?.[1];
    return id ? { id, link } : null;
  }

  function paint() {
    for (let card of document.querySelectorAll(".mix_item")) {
      let player = card_player(card);
      if (!player) continue;
      let tier = tiers[player.id];
      let badge = card.querySelector(".nte-ad-tier");
      if (tier === undefined || tier === null) {
        badge?.remove();
        continue;
      }
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "nte-ad-tier";
        player.link.after(badge);
      }
      let label = TIER_LABELS[tier] || "";
      if (badge.textContent !== label) badge.textContent = label;
      badge.title = "Trade ads this player has created (from RoliBadges)";
      badge.classList.toggle("is-heavy", tier >= 1000);
    }
  }

  async function load_missing() {
    if (tiers_off) return paint();
    let ids = [];
    for (let card of document.querySelectorAll(".mix_item")) {
      let id = card_player(card)?.id;
      if (id && !(id in tiers) && !pending.has(id) && !ids.includes(id))
        ids.push(id);
    }
    if (!ids.length) return paint();
    ids = ids.slice(0, 30);
    ids.forEach((id) => pending.add(id));
    let res = await send_message({ type: "getPlayerAdTiers", ids });
    // No lookup (LITE build, server down): stop asking until the next page load.
    if (!res?.ok) tiers_off = true;
    let players = res?.players || {};
    for (let id of ids) {
      pending.delete(id);
      if (id in players) tiers[id] = players[id];
    }
    paint();
    // The server answers a capped batch; ask again for the rest.
    if (ids.some((id) => id in players)) schedule();
  }

  // Rolimons rewrites ad headers every second ("x seconds ago"), so repaint
  // from cache on each mutation and throttle (not debounce) the lookups.
  function schedule() {
    mount_sales_buttons();
    paint();
    if (paint_timer) return;
    paint_timer = setTimeout(() => {
      paint_timer = 0;
      load_missing().catch(() => {});
    }, 300);
  }

  // ---- Sales panel ($ on each ad item) ----
  const DEMAND = ["Terrible", "Low", "Normal", "High", "Amazing"];
  const TREND = ["Lowering", "Unstable", "Stable", "Raising", "Fluctuating"];
  let item_data = null;
  let routility = null;
  let face_to_bundle = null;
  let panel = null;

  const fmt = (n) =>
    Number.isFinite(Number(n)) && Number(n) > 0
      ? Math.round(Number(n)).toLocaleString()
      : "-";
  const esc = (text) => {
    let div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  };

  async function ensure_sales_sources() {
    if (!item_data) {
      let data = await send_message("getData");
      if (data?.items) item_data = data;
    }
    if (!routility) routility = (await send_message("getRoutilityData")) || {};
    if (!face_to_bundle) {
      let res = await send_message({ type: "rolimons_player_face_map" });
      face_to_bundle = res?.map || {};
    }
  }

  function sparkline(points) {
    let day = 864e5;
    let recent = points.filter(([t]) => Date.now() - t <= 90 * day).reverse();
    if (recent.length < 2) return "";
    let values = recent.map(([, v]) => v);
    let min = Math.min(...values);
    let max = Math.max(...values);
    let t0 = recent[0][0];
    let t1 = recent[recent.length - 1][0];
    let path = recent
      .map(([t, v], i) => {
        let x = ((t - t0) / Math.max(1, t1 - t0)) * 300;
        let y = 54 - ((v - min) / Math.max(1, max - min)) * 50;
        return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join("");
    return `<div class="nte-sp-chart-head">Sales · 90 days<span>${fmt(min)} – ${fmt(max)}</span></div>
      <svg class="nte-sp-chart" viewBox="0 0 300 58" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="#5bc0de" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }

  function render_panel(item, row, sales) {
    let summary = sales?.summary || {};
    let usd = Number(routility?.items?.[item.id]?.usd) || 0;
    let value = Number(row?.[3]) > 0 ? row[3] : row?.[2];
    let tags = [];
    if (DEMAND[row?.[5]]) tags.push(`Demand <b>${DEMAND[row[5]]}</b>`);
    if (TREND[row?.[6]]) tags.push(`Trend <b>${TREND[row[6]]}</b>`);
    if (Number(row?.[7]) === 1) tags.push(`<b class="nte-sp-warn">Projected</b>`);
    let stats = [
      ["RAP", row?.[2]],
      ["Value", value],
      ["7D avg", summary.avg_7],
      ["30D avg", summary.avg_30],
      ["Best price", sales?.lowest_price],
    ];
    let sales_rows = (summary.recent_sales || [])
      .slice(0, 6)
      .map(
        (sale) =>
          `<div class="nte-sp-sale"><span>${esc(sale.date_text)}</span><span>${fmt(sale.value)}${sale.volume > 1 ? ` <i>×${sale.volume}</i>` : ""}</span></div>`,
      )
      .join("");
    panel.innerHTML = `
      <div class="nte-sp-head"><div class="nte-sp-name">${esc(item.name || row?.[0] || "Item")}</div><button type="button" class="nte-sp-close" aria-label="Close">×</button></div>
      ${tags.length ? `<div class="nte-sp-tags">${tags.join(" · ")}</div>` : ""}
      <div class="nte-sp-grid">${stats.map(([label, n]) => `<div class="nte-sp-stat"><div>${label}</div><b>${fmt(n)}</b></div>`).join("")}${usd > 0 ? `<div class="nte-sp-stat"><div>USD</div><b class="nte-sp-usd">$${usd.toFixed(2)}</b></div>` : ""}</div>
      ${sales ? sparkline(sales.points || []) : `<div class="nte-sp-empty">Loading sales…</div>`}
      ${sales && sales_rows ? `<div class="nte-sp-sales-head">Recent sales</div>${sales_rows}` : ""}
      ${sales && !sales.ok ? `<div class="nte-sp-empty">No Roblox sales data for this item.</div>` : ""}
      <a class="nte-sp-link" href="https://www.roblox.com/${item.bundle ? "bundles" : "catalog"}/${item.roblox_id}" target="_blank" rel="noopener">Open on Roblox</a>`;
    panel.querySelector(".nte-sp-close").onclick = close_panel;
  }

  function close_panel() {
    panel?.remove();
    panel = null;
  }

  function place_panel(anchor) {
    let rect = anchor.getBoundingClientRect();
    let left = Math.min(
      window.scrollX + document.documentElement.clientWidth - 298,
      Math.max(8, rect.left + window.scrollX),
    );
    panel.style.left = `${left}px`;
    panel.style.top = `${rect.bottom + window.scrollY + 6}px`;
  }

  async function open_sales_panel(anchor, id, name) {
    close_panel();
    await ensure_sales_sources();
    let bundle_id = face_to_bundle?.[id];
    let item = {
      id,
      name,
      bundle: !!bundle_id || !!item_data?.bundleIds?.[id],
      roblox_id: bundle_id || id,
    };
    let row = item_data?.items?.[id] || item_data?.items?.[bundle_id];
    panel = document.createElement("div");
    panel.className = "nte-sp-panel";
    document.body.appendChild(panel);
    place_panel(anchor);
    render_panel(item, row, null);
    let sales = await send_message({
      type: "getItemSalesData",
      targetId: item.roblox_id,
      itemType: item.bundle ? "Bundle" : "Asset",
    });
    if (!panel) return;
    render_panel(item, row, sales || { ok: false });
  }

  function mount_sales_buttons() {
    for (let img of document.querySelectorAll(".mix_item img.ad_item_img")) {
      let host = img.parentElement;
      if (!host || host.querySelector(".nte-sp-btn")) continue;
      let id = (img.getAttribute("onclick") || "").match(
        /item_select_handler\s*\(\s*(\d+)/,
      )?.[1];
      if (!id) continue;
      let name = (img.getAttribute("data-original-title") || "")
        .split(/<br\s*\/?>/i)[0]
        .replace(/<[^>]+>/g, "")
        .trim();
      let btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nte-sp-btn";
      btn.title = "Sales data";
      btn.textContent = "$";
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        open_sales_panel(btn, id, name).catch(close_panel);
      });
      host.appendChild(btn);
    }
  }

  async function boot() {
    if (!(await is_enabled())) return;
    document.addEventListener("click", (event) => {
      if (panel && !event.target.closest(".nte-sp-panel, .nte-sp-btn"))
        close_panel();
    });
    let tries = 0;
    let wait = setInterval(() => {
      tries += 1;
      if (!document.querySelector(".mix_item") && tries < 60) return;
      clearInterval(wait);
      inject_robux_filter();
      ensure_styles();
      mount_sales_buttons();
      schedule();
      let root =
        document.querySelector(".mix_container") ||
        document.querySelector(".trade_ads_container") ||
        document.body;
      new MutationObserver(schedule).observe(root, {
        childList: true,
        subtree: true,
      });
    }, 300);
  }

  boot().catch(() => {});
})();
