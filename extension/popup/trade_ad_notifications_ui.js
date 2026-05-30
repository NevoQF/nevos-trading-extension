(function () {
  "use strict";
  const trade_ad_notif_poll_ms = 60000;
  const trade_ad_notif_scroll_load_threshold_px = 48;
  const trade_ad_notif_tag_slug_by_code = {
    1: "demand",
    2: "rares",
    3: "robux",
    4: "any",
    5: "upgrade",
    6: "downgrade",
    7: "rap",
    9: "wishlist",
    10: "adds",
  };

  function trade_ad_notif_send(type, payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type, ...(payload || {}) }, (r) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(r || { ok: false });
        });
      } catch (err) {
        resolve({ ok: false, error: err?.message || String(err) });
      }
    });
  }

  function trade_ad_notif_format_number(n) {
    let v = Number(n);
    if (!Number.isFinite(v)) return "—";
    if (typeof format_number === "function") return format_number(v);
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return String(Math.round(v));
  }

  function trade_ad_notif_format_relative(ms) {
    if (typeof format_relative_time === "function") {
      return format_relative_time(Number(ms));
    }
    let diff = Date.now() - Number(ms);
    if (!Number.isFinite(diff) || diff < 0) return "just now";
    let m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    let h = Math.floor(m / 60);
    if (h < 48) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function trade_ad_notif_asset_id_from_tradable_row(row) {
    let target_id = parseInt(
      row?.itemTarget?.targetId ?? row?.assetId ?? row?.id ?? 0,
      10,
    );
    return Number.isFinite(target_id) && target_id > 0 ? target_id : 0;
  }

  function trade_ad_notif_collect_uaids_from_tradable_row(row) {
    let out = [];
    let seen = new Set();
    let push_id = (raw) => {
      let value = String(raw || "").trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      out.push(value);
    };

    // Legacy/single-instance shapes.
    push_id(row?.collectibleItemInstanceId);
    push_id(row?.collectibleItemInstance?.collectibleItemInstanceId);

    // Current tradableitems response shape: item -> instances[].
    let instances = Array.isArray(row?.instances) ? row.instances : [];
    for (let inst of instances) {
      if (inst?.isOnHold === true) continue;
      push_id(inst?.collectibleItemInstanceId);
    }
    return out;
  }

  async function trade_ad_notif_fetch_tradable_uaids(user_id, wanted_asset_ids) {
    let wanted_list = Array.from(wanted_asset_ids || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
      .map((id) => String(id));
    let need_counts = new Map();
    for (let key of wanted_list) {
      need_counts.set(key, (need_counts.get(key) || 0) + 1);
    }
    let need = new Set(
      Array.from(wanted_asset_ids || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
        .map((id) => String(id)),
    );
    let by_asset = new Map(); // assetId -> string[] of ciiids
    if (!need.size) return by_asset;

    let cursor = "";
    let limit = "100";
    for (let page = 0; page < 120; page++) {
      let params = new URLSearchParams({
        sortBy: "CreationTime",
        sortOrder: "Desc",
        limit,
      });
      if (cursor) params.set("cursor", cursor);
      let url = `https://trades.roblox.com/v2/users/${user_id}/tradableitems?${params.toString()}`;
      let res = await fetch(url, { credentials: "include" }).catch(() => null);
      if (!res) break;
      if (res.status === 500 && limit === "100") {
        limit = "50";
        continue;
      }
      if (!res.ok) break;
      let body = await res.json().catch(() => null);
      let rows = Array.isArray(body?.items) ? body.items : [];
      for (let row of rows) {
        let asset_id = trade_ad_notif_asset_id_from_tradable_row(row);
        if (!(asset_id > 0)) continue;
        let key = String(asset_id);
        if (!need.has(key)) continue;
        let bucket = by_asset.get(key) || [];
        let need_count = Number(need_counts.get(key) || 0);
        if (bucket.length >= need_count) continue;
        let uaids = trade_ad_notif_collect_uaids_from_tradable_row(row);
        if (!uaids.length) continue;
        for (let uaid of uaids) {
          if (bucket.length >= need_count) break;
          if (!bucket.includes(uaid)) bucket.push(uaid);
        }
        by_asset.set(key, bucket);
      }
      cursor = body?.nextPageCursor || "";
      let complete = true;
      for (let [key, count] of need_counts.entries()) {
        let bucket = by_asset.get(key) || [];
        if (bucket.length < count) {
          complete = false;
          break;
        }
      }
      if (complete) return by_asset;
      if (!cursor) break;
    }
    return by_asset;
  }

  async function trade_ad_notif_get_authenticated_user_id() {
    let res = await fetch("https://users.roblox.com/v1/users/authenticated", {
      credentials: "include",
    }).catch(() => null);
    if (!res?.ok) return 0;
    let body = await res.json().catch(() => null);
    let user_id = Number(body?.id);
    return Number.isFinite(user_id) && user_id > 0 ? user_id : 0;
  }

  async function trade_ad_notif_build_send_trade_url(
    partner_id,
    wanted_id,
    offer_ids,
  ) {
    let pid = Number(partner_id);
    let wid = Number(wanted_id);
    let offers = Array.from(offer_ids || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    let base = `https://www.roblox.com/users/${encodeURIComponent(String(pid || ""))}/trade`;
    if (!(pid > 0) || !(wid > 0) || !offers.length) return base;

    let my_user_id = await trade_ad_notif_get_authenticated_user_id();
    if (!(my_user_id > 0)) return base;

    let my_map = await trade_ad_notif_fetch_tradable_uaids(my_user_id, [wid]);
    let partner_map = await trade_ad_notif_fetch_tradable_uaids(pid, offers);

    let my_bucket = my_map.get(String(wid)) || [];
    let my_uaid = my_bucket[0];
    if (!my_uaid) return base;
    let offer_uaids = [];
    for (let id of offers) {
      let key = String(id);
      let bucket = (partner_map.get(key) || []).slice();
      let uaid = bucket.shift();
      if (!uaid) return base;
      partner_map.set(key, bucket);
      offer_uaids.push(uaid);
    }
    // Roblox trade URL expects your offered UAIDs in oitems, requested UAIDs in ritems.
    return `${base}?oitems=${String(my_uaid)}&ritems=${offer_uaids.join(",")}`;
  }

  function trade_ad_notif_slot_html(item, extra_class) {
    let cls = extra_class ? ` ${extra_class}` : "";
    if (!item) {
      return `<div class="ta-notif-slot ta-notif-slot-empty${cls}">
        <div class="ta-notif-thumb ta-notif-thumb-empty" aria-hidden="true"></div>
      </div>`;
    }
    let item_id = Number(item.id);
    if (!Number.isFinite(item_id) || item_id <= 0) {
      return `<div class="ta-notif-slot ta-notif-slot-empty${cls}">
        <div class="ta-notif-thumb ta-notif-thumb-empty" aria-hidden="true"></div>
      </div>`;
    }
    let item_url = `https://www.rolimons.com/item/${encodeURIComponent(String(item_id))}`;
    return `<a class="ta-notif-slot${cls}" href="${item_url}" target="_blank" rel="noopener noreferrer" title="Open item on Rolimons">
      ${trade_ad_notif_thumb_html(item_id)}
    </a>`;
  }

  function trade_ad_notif_tag_slot_html(tag_slug, extra_class) {
    let cls = extra_class ? ` ${extra_class}` : "";
    if (!tag_slug) return trade_ad_notif_slot_html(null, cls);
    let src = `https://www.rolimons.com/images/tradetag${tag_slug}-420.png`;
    return `<div class="ta-notif-slot ta-notif-slot-tag${cls}">
      <img class="ta-notif-thumb ta-notif-thumb-tag" src="${src}" alt="${escape_html(tag_slug)}" loading="lazy" decoding="async" />
    </div>`;
  }

  function trade_ad_notif_thumb_html(asset_id, extra_class) {
    let cls = extra_class ? ` ${extra_class}` : "";
    return `<img class="ta-notif-thumb${cls}" src="${escape_html(trade_ads_thumb_placeholder_src)}" alt="" data-thumb-aid="${Number(asset_id)}" data-thumb-pending="1" decoding="async" />`;
  }

  async function trade_ad_notif_resolve_thumbs(root) {
    if (!root || typeof trade_ads_fill_thumbnails !== "function") return;
    await trade_ads_fill_thumbnails(root);
  }

  function trade_ad_notif_card_html(match) {
    let user = escape_html(match.username || "Trader");
    let partner_id = Number(match.userId);
    let roli = `https://www.rolimons.com/player/${encodeURIComponent(String(match.userId))}`;
    let trades = `https://www.rolimons.com/playertrades/${encodeURIComponent(String(match.userId))}`;
    let wanted = match.wantedItem || {};
    let offers = Array.isArray(match.offerItems) ? match.offerItems : [];
    let want_tags = [
      ...(Array.isArray(match.wantTags) ? match.wantTags : []),
      ...(Array.isArray(match.requestTags) ? match.requestTags : []),
    ];
    let seen_tags = new Set();
    let want_tag_slots = want_tags
      .map((tag) => Number(tag))
      .filter((tag) => Number.isFinite(tag))
      .filter((tag) => {
        if (seen_tags.has(tag)) return false;
        seen_tags.add(tag);
        return true;
      })
      .map((tag) => trade_ad_notif_tag_slug_by_code[tag] || "")
      .filter((slug) => slug && slug !== "any" && slug !== "adds")
      .slice(0, 3)
      .map((slug) => trade_ad_notif_tag_slot_html(slug));
    let offered_ids = offers
      .map((it) => Number(it?.id))
      .filter((id) => Number.isFinite(id) && id > 0)
      .join(",");
    let wanted_id = Number(wanted?.id);
    let send_trade_fallback_url = `https://www.roblox.com/users/${encodeURIComponent(String(match.userId || ""))}/trade`;
    let offer_slots = offers
      .slice(0, 4)
      .concat([null, null, null, null])
      .slice(0, 4)
      .map((it) => trade_ad_notif_slot_html(it))
      .join("");
    let want_slots = [
      trade_ad_notif_slot_html(wanted || null, wanted ? "ta-notif-slot-wanted" : ""),
      ...want_tag_slots,
    ]
      .concat([
        trade_ad_notif_slot_html(null),
        trade_ad_notif_slot_html(null),
        trade_ad_notif_slot_html(null),
        trade_ad_notif_slot_html(null),
      ])
      .slice(0, 4)
      .join("");
    let offer_total = trade_ad_notif_format_number(match.haveTotal);
    let want_total = trade_ad_notif_format_number(match.wantTotal);
    let overpay = trade_ad_notif_format_number(match.overpayAmount);
    let created_ms =
      Number(match.createdAt) > 1e12
        ? Number(match.createdAt)
        : Number(match.createdAt) * 1000;
    let when = trade_ad_notif_format_relative(created_ms);

    return `<article class="ta-notif-card" data-ad-id="${escape_html(String(match.adId))}">
      <div class="ta-notif-card-top">
        <div class="ta-notif-user">
          <span class="ta-notif-username">${user}</span>
          <span class="ta-notif-time">${escape_html(when)}</span>
        </div>
        <div class="ta-notif-overpay-badge" title="Offer total vs your item value">
          <span class="ta-notif-overpay-v">+${escape_html(overpay)}</span>
        </div>
      </div>
      <div class="ta-notif-trade-grid">
        <div class="ta-notif-side-head ta-notif-side-head-offer">
          <span class="ta-notif-side-label">They offer</span>
          <span class="ta-notif-side-value">${escape_html(offer_total)}</span>
        </div>
        <div class="ta-notif-side-head ta-notif-side-head-want">
          <span class="ta-notif-side-label">For your</span>
          <span class="ta-notif-side-value">${escape_html(want_total)}</span>
        </div>
        <div class="ta-notif-slot-row ta-notif-slot-row-offer">${offer_slots}</div>
        <div class="ta-notif-arrow" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
        </div>
        <div class="ta-notif-slot-row ta-notif-slot-row-want">
          ${want_slots}
        </div>
      </div>
      <div class="ta-notif-card-foot">
        <button
          type="button"
          class="ta-notif-send-trade ta-notif-link"
          data-partner-id="${escape_html(String(Number.isFinite(partner_id) ? partner_id : 0))}"
          data-wanted-id="${escape_html(String(Number.isFinite(wanted_id) ? wanted_id : 0))}"
          data-offer-ids="${escape_html(offered_ids)}"
          data-fallback-url="${escape_html(send_trade_fallback_url)}"
        >Send Trade</button>
        <a class="ta-notif-link ta-notif-link-muted" href="${roli}" target="_blank" rel="noopener noreferrer">Rolimons Profile</a>
      </div>
    </article>`;
  }

  function trade_ad_notif_countdown_label(state) {
    if (state?.enabled !== true) return "Auto refresh: off";
    let last = Number(state?.lastPollAt || 0);
    if (!Number.isFinite(last) || last <= 0) return "Next refresh: --:--";
    let next = last + trade_ad_notif_poll_ms;
    let remain = Math.max(0, next - Date.now());
    if (remain <= 1200) return "Refreshing soon...";
    let sec = Math.ceil(remain / 1000);
    let mm = Math.floor(sec / 60);
    let ss = sec % 60;
    return `Next refresh: ${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }

  function trade_ad_notif_normalize_ignore_names(list) {
    let out = [];
    let seen = new Set();
    for (let raw of Array.isArray(list) ? list : []) {
      let value = String(raw || "").trim();
      if (!value) continue;
      let key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
    return out.slice(0, 200);
  }

  function trade_ad_notif_open_ignore_modal(current_names) {
    return new Promise((resolve) => {
      let existing = document.getElementById("ta-notif-ignore-overlay");
      if (existing) existing.remove();

      let overlay = document.createElement("div");
      overlay.id = "ta-notif-ignore-overlay";
      overlay.className = "ta-notif-ignore-overlay";
      let initial_value = trade_ad_notif_normalize_ignore_names(current_names).join("\n");
      overlay.innerHTML = `
        <div class="ta-notif-ignore-card" role="dialog" aria-modal="true" aria-labelledby="ta-notif-ignore-title">
          <div class="ta-notif-ignore-head">
            <div>
              <h3 id="ta-notif-ignore-title" class="ta-notif-ignore-title">Ignore List</h3>
              <p class="ta-notif-ignore-subtitle">One username per line. Ignored users ads will not show up.</p>
            </div>
            <button type="button" class="ta-notif-ignore-close" aria-label="Close ignore list">✕</button>
          </div>
          <div class="ta-notif-ignore-body">
            <textarea id="ta-notif-ignore-input" class="ta-notif-ignore-input" spellcheck="false" placeholder="TraderOne&#10;TraderTwo">${escape_html(initial_value)}</textarea>
            <div class="ta-notif-ignore-hint">Case-insensitive. Duplicates are removed automatically.</div>
          </div>
          <div class="ta-notif-ignore-actions">
            <button type="button" class="ta-notif-ignore-btn ta-notif-ignore-btn-cancel" data-role="cancel">Cancel</button>
            <button type="button" class="ta-notif-ignore-btn ta-notif-ignore-btn-save" data-role="save">Save List</button>
          </div>
        </div>
      `;
      document.body.append(overlay);

      let card = overlay.querySelector(".ta-notif-ignore-card");
      let input = overlay.querySelector("#ta-notif-ignore-input");
      let close_btn = overlay.querySelector(".ta-notif-ignore-close");
      let cancel_btn = overlay.querySelector('[data-role="cancel"]');
      let save_btn = overlay.querySelector('[data-role="save"]');

      let finish = (result) => {
        overlay.remove();
        resolve(result);
      };

      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) finish(null);
      });
      card.addEventListener("click", (event) => event.stopPropagation());
      close_btn.addEventListener("click", () => finish(null));
      cancel_btn.addEventListener("click", () => finish(null));
      overlay.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish(null);
        }
      });

      save_btn.addEventListener("click", () => {
        let lines = String(input.value || "")
          .split(/\r?\n/g)
          .map((s) => s.trim())
          .filter(Boolean);
        finish(trade_ad_notif_normalize_ignore_names(lines));
      });

      setTimeout(() => input.focus(), 0);
    });
  }

  function trade_ad_notif_start_countdown(root, state) {
    if (!root) return;
    if (root.__taNotifCountdownTimer) {
      clearInterval(root.__taNotifCountdownTimer);
      root.__taNotifCountdownTimer = null;
    }
    let el = root.querySelector("#ta-notif-next");
    if (!el) return;
    let update = () => {
      el.textContent = trade_ad_notif_countdown_label(state);
    };
    update();
    if (state?.enabled !== true) return;
    root.__taNotifCountdownTimer = setInterval(update, 1000);
  }

  async function trade_ad_notif_fetch_state() {
    let res = await trade_ad_notif_send("trade_ad_notifications_get_state");
    if (!res?.ok) throw new Error(res?.error || "Could not load alerts.");
    return res.state || {};
  }

  function trade_ad_notif_dedupe_matches(matches) {
    let seen = new Set();
    let out = [];
    for (let row of Array.isArray(matches) ? matches : []) {
      let id = row?.adId != null ? String(row.adId) : "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(row);
    }
    return out;
  }

  function trade_ad_notif_feed_progress_label(state) {
    if (state?.enabled !== true) return "";
    let total = Math.max(0, Number(state?.feedAdCount) || 0);
    let checked = Math.max(
      Number(state?.feedAdsChecked) || 0,
      Number(state?.feedScanOffset) || 0,
    );
    if (total > 0) checked = Math.min(total, checked);
    let total_label = total > 0 ? String(total) : "?";
    if (state?.feedExhausted === true && total > 0 && checked >= total) {
      return `Checked all ${total_label} ads`;
    }
    return `Checked ${checked} of ${total_label} ads`;
  }

  function trade_ad_notif_update_status(root, state, loading = false) {
    let status = root?.querySelector("#ta-notif-status");
    if (!status) return;
    if (state?.enabled !== true) {
      status.hidden = true;
      return;
    }
    status.hidden = false;
    let text_el = status.querySelector(".ta-notif-status-text");
    let btn = status.querySelector("#ta-notif-load-more-btn");
    let label = trade_ad_notif_feed_progress_label(state);
    if (text_el) text_el.textContent = label;
    if (btn) {
      let show_btn =
        state?.enabled === true &&
        state?.feedExhausted !== true &&
        !loading;
      btn.hidden = !show_btn;
      btn.disabled = !!root?.__taNotifLoadMoreInFlight;
    }
    if (state?.lastError && text_el) {
      text_el.textContent = `${label} · ${String(state.lastError)}`;
    }
  }

  function trade_ad_notif_bind_send_trade_buttons(scope) {
    if (!scope) return;
    scope.querySelectorAll(".ta-notif-send-trade").forEach((btn) => {
      if (btn.dataset.taSendBound === "1") return;
      btn.dataset.taSendBound = "1";
      btn.addEventListener("click", async () => {
        let partner_id = Number(btn.dataset.partnerId || 0);
        let wanted_id = Number(btn.dataset.wantedId || 0);
        let offer_ids = String(btn.dataset.offerIds || "")
          .split(",")
          .map((v) => Number(v.trim()))
          .filter((v) => Number.isFinite(v) && v > 0);
        let fallback_url = String(btn.dataset.fallbackUrl || "").trim();
        let open_url =
          fallback_url ||
          `https://www.roblox.com/users/${encodeURIComponent(String(partner_id || ""))}/trade`;
        let prev = btn.textContent || "Send Trade";
        btn.disabled = true;
        btn.textContent = "Opening...";
        try {
          let resolved = await trade_ad_notif_build_send_trade_url(
            partner_id,
            wanted_id,
            offer_ids,
          );
          if (resolved) open_url = resolved;
        } catch {}
        try {
          window.open(open_url, "_blank", "noopener,noreferrer");
        } catch {}
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = prev;
        }, 700);
      });
    });
  }

  function trade_ad_notif_list_is_near_bottom(list) {
    if (!list) return false;
    return (
      list.scrollTop + list.clientHeight >=
      list.scrollHeight - trade_ad_notif_scroll_load_threshold_px
    );
  }

  function trade_ad_notif_restore_list_scroll(list, at_bottom, previous_top = 0) {
    if (!list) return;
    let can_scroll = list.scrollHeight > list.clientHeight + 1;
    if (at_bottom && can_scroll) {
      list.scrollTop = Math.max(0, list.scrollHeight - list.clientHeight);
      return;
    }
    if (!at_bottom) {
      list.scrollTop = Math.max(0, previous_top);
    }
  }

  function trade_ad_notif_update_list_footer(root, state, loading = false) {
    trade_ad_notif_update_status(root, state, loading);
  }

  async function trade_ad_notif_ensure_feed_scanned(root) {
    if (!root || root.__taNotifScanAllInFlight) return;
    let state = globalThis.__taNotifLastState;
    if (!state?.enabled || state.feedExhausted === true) return;
    root.__taNotifScanAllInFlight = true;
    try {
      await trade_ad_notif_try_load_more(root);
    } finally {
      root.__taNotifScanAllInFlight = false;
    }
  }

  function trade_ad_notif_append_matches(root, state, from_index = 0) {
    let list = root?.querySelector("#ta-notif-list");
    if (!list) return 0;
    let matches = trade_ad_notif_dedupe_matches(state?.matches);
    let start = Math.max(0, Number(from_index) || 0);
    if (start >= matches.length) return start;
    let chunk = matches.slice(start);
    if (!chunk.length) return start;
    let at_bottom = trade_ad_notif_list_is_near_bottom(list);
    let previous_top = list.scrollTop;
    list.querySelector(".ta-notifs-empty-card")?.remove();
    list.insertAdjacentHTML(
      "beforeend",
      chunk.map(trade_ad_notif_card_html).join(""),
    );
    trade_ad_notif_bind_send_trade_buttons(list);
    void trade_ad_notif_resolve_thumbs(list);
    trade_ad_notif_restore_list_scroll(list, at_bottom, previous_top);
    return matches.length;
  }

  function trade_ad_notif_sync_open_panel(mount, state) {
    let panel = mount?.querySelector(".ta-notif-panel");
    if (!panel) return false;
    globalThis.__taNotifLastState = state;

    let err = state?.lastError ? String(state.lastError) : "";
    let err_el = mount.querySelector(".ta-notif-error");
    if (err) {
      if (!err_el) {
        let list = mount.querySelector("#ta-notif-list");
        if (list) {
          list.insertAdjacentHTML(
            "beforebegin",
            `<p class="ta-notif-error">${escape_html(err)}</p>`,
          );
        }
      } else {
        err_el.textContent = err;
      }
    } else {
      err_el?.remove();
    }

    let enabled_input = mount.querySelector("#ta-notif-enabled");
    if (enabled_input) enabled_input.checked = state?.enabled === true;
    trade_ad_notif_start_countdown(mount, state);
    return true;
  }

  async function trade_ad_notif_try_load_more(root, chain_depth = 0) {
    if (!root || root.__taNotifLoadMoreInFlight) return;
    let state = globalThis.__taNotifLastState;
    if (!state || state.enabled !== true) return;
    if (state.feedExhausted === true) return;

    root.__taNotifLoadMoreInFlight = true;
    root.__taNotifSuppressStorageRefresh = true;
    trade_ad_notif_update_list_footer(root, state, true);
    try {
      let res = await trade_ad_notif_send("trade_ad_notifications_load_more");
      if (!res?.ok) throw new Error(res?.error || "Could not load more ads.");
      state = res.state || state;
      globalThis.__taNotifLastState = state;
      let prev_count = Number(root.__taNotifRenderedCount) || 0;
      let next_count = trade_ad_notif_append_matches(root, state, prev_count);
      root.__taNotifRenderedCount = next_count;
      trade_ad_notif_update_list_footer(root, state, false);

      let added = next_count - prev_count;
      if (
        !state.feedExhausted &&
        added === 0 &&
        chain_depth < 24 &&
        state.enabled === true
      ) {
        await trade_ad_notif_try_load_more(root, chain_depth + 1);
      }
    } catch (err) {
      state = globalThis.__taNotifLastState || state;
      state.lastError = err?.message || "Could not load more ads.";
      globalThis.__taNotifLastState = state;
      trade_ad_notif_update_list_footer(root, state, false);
    } finally {
      root.__taNotifLoadMoreInFlight = false;
      setTimeout(() => {
        root.__taNotifSuppressStorageRefresh = false;
      }, 100);
    }
  }

  function trade_ad_notif_bind_list_scroll(root) {
    let list = root?.querySelector("#ta-notif-list");
    if (!list) return;
    if (!list.__taNotifScrollBound) {
      list.__taNotifScrollBound = true;
      let scroll_timer = null;
      list.addEventListener(
        "scroll",
        () => {
          if (scroll_timer) clearTimeout(scroll_timer);
          scroll_timer = setTimeout(() => {
            if (root.__taNotifLoadMoreInFlight) return;
            let state = globalThis.__taNotifLastState;
            if (!state || state.enabled !== true || state.feedExhausted === true) {
              return;
            }
            if (!trade_ad_notif_list_is_near_bottom(list)) return;
            trade_ad_notif_try_load_more(root).catch(() => {});
          }, 100);
        },
        { passive: true },
      );
    }
    let load_btn = root.querySelector("#ta-notif-load-more-btn");
    if (load_btn && load_btn.dataset.taLoadBound !== "1") {
      load_btn.dataset.taLoadBound = "1";
      load_btn.addEventListener("click", () => {
        trade_ad_notif_try_load_more(root).catch(() => {});
      });
    }
  }

  function trade_ad_notif_render_shell(root, state) {
    let matches = trade_ad_notif_dedupe_matches(state?.matches);
    let err = state?.lastError ? String(state.lastError) : "";
    let enabled = state?.enabled === true;
    let list =
      !enabled
        ? `<div class="ta-notifs-empty-card"><p class="ta-notifs-empty-title">Notifications are off</p><p class="ta-notifs-empty-copy">Enable alerts to start scanning trade ads.</p></div>`
        : matches.length > 0
        ? matches.map(trade_ad_notif_card_html).join("")
        : `<div class="ta-notifs-empty-card"><p class="ta-notifs-empty-title">Nothing yet</p><p class="ta-notifs-empty-copy">Shows ads that want one of your items and offer at least 2.5% overpay (2,000+ value). Multi-item wants and Any/Adds tags are skipped.</p></div>`;
    root.__taNotifRenderedCount = matches.length;
    root.innerHTML = `
      <div class="ta-notif-panel">
        <div class="ta-notif-head">
          <div class="ta-notif-head-copy">
            <div class="ta-notif-title">Overpay alerts</div>
            <span class="ta-notif-next" id="ta-notif-next"></span>
          </div>
          <div class="ta-notif-head-actions">
            <button type="button" class="ta-notif-ignore-btn-head" id="ta-notif-ignore-btn">Ignore List</button>
            <label class="ta-notif-toggle" title="Enable trade ad notifications">
              <input type="checkbox" id="ta-notif-enabled" ${enabled ? "checked" : ""} />
              <span class="ta-notif-toggle-track"><span class="ta-notif-toggle-knob"></span></span>
            </label>
          </div>
        </div>
        ${err ? `<p class="ta-notif-error">${escape_html(err)}</p>` : ""}
        <div class="ta-notif-list" id="ta-notif-list">${list}</div>
        <div class="ta-notif-status" id="ta-notif-status">
          <span class="ta-notif-status-text"></span>
          <button type="button" class="ta-notif-load-more-btn" id="ta-notif-load-more-btn" hidden>Load more</button>
        </div>
      </div>`;

    root.querySelector("#ta-notif-enabled")?.addEventListener("change", async (ev) => {
      let on = ev.currentTarget?.checked === true;
      let res = await trade_ad_notif_send("trade_ad_notifications_set_enabled", {
        enabled: on,
      });
      if (res?.ok && res.state) {
        trade_ad_notif_render_shell(root, res.state);
      } else {
        trade_ad_notif_refresh_ui(root).catch(() => {});
      }
    });

    root.querySelector("#ta-notif-ignore-btn")?.addEventListener("click", async () => {
      let next_names = await trade_ad_notif_open_ignore_modal(state?.ignoredUsers || []);
      if (!next_names) return;
      let res = await trade_ad_notif_send("trade_ad_notifications_set_ignored_users", {
        ignoredUsers: next_names,
      });
      if (res?.ok && res.state) {
        trade_ad_notif_render_shell(root, res.state);
      } else {
        trade_ad_notif_refresh_ui(root).catch(() => {});
      }
    });

    trade_ad_notif_bind_send_trade_buttons(root);
    trade_ad_notif_bind_list_scroll(root);
    trade_ad_notif_update_status(root, state, false);
    trade_ad_notif_start_countdown(root, state);
    globalThis.__taNotifLastState = state;
    void trade_ad_notif_resolve_thumbs(root);
    if (enabled && state.feedExhausted !== true) {
      trade_ad_notif_ensure_feed_scanned(root).catch(() => {});
    }
  }

  async function trade_ad_notif_refresh_ui(mount) {
    if (!mount) return;
    if (mount.__taNotifLoadMoreInFlight || mount.__taNotifSuppressStorageRefresh) {
      return;
    }
    try {
      let state = await trade_ad_notif_fetch_state();
      globalThis.__taNotifLastState = state;
      let list = mount.querySelector("#ta-notif-list");
      if (list && !mount.querySelector("#ta-notif-status")) {
        trade_ad_notif_render_shell(mount, state);
        return;
      }
      if (list) {
        let prev_rendered = Number(mount.__taNotifRenderedCount) || 0;
        let match_count = Array.isArray(state?.matches) ? state.matches.length : 0;
        if (match_count > prev_rendered) {
          mount.__taNotifRenderedCount = trade_ad_notif_append_matches(
            mount,
            state,
            prev_rendered,
          );
        }
        trade_ad_notif_update_list_footer(mount, state, false);
        trade_ad_notif_sync_open_panel(mount, state);
        trade_ad_notif_bind_list_scroll(mount);
        return;
      }
      trade_ad_notif_render_shell(mount, state);
    } catch (err) {
      mount.innerHTML = `<div class="ta-notifs-empty-card"><p class="ta-notifs-empty-title">Could not load alerts</p><p class="ta-notifs-empty-copy">${escape_html(err?.message || String(err))}</p></div>`;
    }
  }

  async function trade_ad_notif_render_into(mount) {
    if (!mount) return;
    if (mount.__taNotifRendering) return;
    mount.__taNotifRendering = true;
    try {
      let cached_state = globalThis.__taNotifLastState;
      if (cached_state && typeof cached_state === "object") {
        trade_ad_notif_render_shell(mount, cached_state);
      } else {
        mount.innerHTML = `<div class="ta-notif-loading">Loading alerts…</div>`;
      }
      await trade_ad_notif_refresh_ui(mount);
    } finally {
      mount.__taNotifRendering = false;
    }
  }

  function trade_ad_notif_bind_storage_refresh(mount) {
    if (!mount || mount.__taNotifStorageBound) return;
    mount.__taNotifStorageBound = true;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (!changes.trade_ad_notifications_state) return;
      if (mount.closest("[data-ta-category-panel='notifs']")?.hidden) return;
      if (mount.__taNotifLoadMoreInFlight || mount.__taNotifSuppressStorageRefresh) {
        return;
      }
      trade_ad_notif_refresh_ui(mount).catch(() => {});
    });
  }

  globalThis.trade_ad_notif_render_into = trade_ad_notif_render_into;
  globalThis.trade_ad_notif_refresh_ui = trade_ad_notif_refresh_ui;
  globalThis.trade_ad_notif_bind_storage_refresh =
    trade_ad_notif_bind_storage_refresh;
})();
