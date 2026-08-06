(() => {
  const OPTION_NAME = "Fix Rolimons Pages";
  const DEMAND_LABELS = ["Terrible", "Low", "Normal", "High", "Amazing"];
  const UAID_BTN_CLASS =
    "btn btn-light-blue border-primary btn-sm btn-very-sharp";
  let ran_for_user = "";
  let player_fix_retry_timer = 0;

  function get_option(name) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([name], (result) => {
          resolve(result?.[name]);
        });
      } catch {
        resolve(undefined);
      }
    });
  }

  async function is_enabled() {
    let value = await get_option(OPTION_NAME);
    return value !== false;
  }

  function send_message(msg) {
    return new Promise((resolve) => {
      try {
        let result = chrome.runtime.sendMessage(msg, (response) => {
          resolve(response);
        });
        if (result && typeof result.then === "function") {
          result.then(resolve, () => resolve(null));
        }
      } catch {
        resolve(null);
      }
    });
  }

  function player_id_from_path() {
    let match = String(location.pathname || "").match(/\/player\/(\d+)/i);
    return match ? match[1] : "";
  }

  function wait_for(selector, ms = 15000) {
    return new Promise((resolve, reject) => {
      let existing = document.querySelector(selector);
      if (existing) return resolve(existing);
      let obs = new MutationObserver(() => {
        let el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        obs.disconnect();
        reject(new Error("timeout"));
      }, ms);
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function parse_stat_number(text) {
    let n = parseInt(String(text || "").replace(/,/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function card_item_id(card) {
    let link = card.querySelector("a[href*='/item/'], a[href*='/bundle/']");
    let match = link?.href?.match(/\/(?:item|bundle)\/(\d+)/i);
    return match ? match[1] : "";
  }

  function read_card_stat(card, label) {
    for (let row of card.querySelectorAll(".d-flex.justify-content-between")) {
      let header = row.querySelector(".item_card_stat_header");
      let value = row.querySelector(".text-light, .text-truncate, .text-info");
      if (header?.textContent.trim() === label && value) {
        return parse_stat_number(value.textContent);
      }
    }
    return 0;
  }

  function card_value_for_total(card) {
    let value = read_card_stat(card, "Value");
    if (value > 0) return value;
    return read_card_stat(card, "RAP");
  }

  // Match Rolimons player totals: assigned value, else RAP.
  function item_value_for_total(item) {
    if (item.value > 0) return item.value;
    return item.rap || 0;
  }

  // Match Rolimons default "Highest Value" sort: value, else RAP.
  function card_sort_score(card) {
    let value = read_card_stat(card, "Value");
    if (value > 0) return value;
    return read_card_stat(card, "RAP");
  }

  function face_sort_score(face) {
    if (face.value > 0) return face.value;
    return face.rap || 0;
  }

  function build_face_maps(face_map) {
    let face_to_bundle = {};
    let bundle_to_face = {};
    for (let [face_id, bundle_id] of Object.entries(face_map || {})) {
      let face = String(face_id || "");
      let bundle = String(bundle_id || "");
      if (!face || !bundle) continue;
      face_to_bundle[face] = bundle;
      bundle_to_face[bundle] = face;
    }
    return { face_to_bundle, bundle_to_face };
  }

  function related_ids(id, face_to_bundle, bundle_to_face) {
    let out = new Set();
    let base = String(id || "");
    if (!base) return out;
    out.add(base);
    if (face_to_bundle[base]) out.add(face_to_bundle[base]);
    if (bundle_to_face[base]) out.add(bundle_to_face[base]);
    return out;
  }

  function set_has_related(set, id, face_to_bundle, bundle_to_face) {
    for (let rid of related_ids(id, face_to_bundle, bundle_to_face)) {
      if (set.has(rid)) return true;
    }
    return false;
  }

  function adjust_sidebar_stat(id, delta, title) {
    if (!delta) return;
    let el = document.getElementById(id);
    if (!el) return;
    let cur = parse_stat_number(el.textContent);
    el.textContent = Math.max(0, cur + delta).toLocaleString();
    el.style.borderBottom = "1px dashed rgba(108, 92, 231, 0.7)";
    el.title = title;
  }

  function roli_value(row) {
    if (!Array.isArray(row)) return null;
    let value = Number(row[3]);
    return value > 0 ? value : null;
  }

  async function fetch_tradable(user_id) {
    let res = await send_message({
      type: "rolimons_player_tradable",
      user_id,
    });
    let items = Array.isArray(res?.items) ? res.items : [];
    return {
      ok: !!res?.ok,
      complete: !!res?.complete,
      items,
      error: res?.error || null,
      status: res?.status || null,
    };
  }

  async function fetch_face_map() {
    let res = await send_message({ type: "rolimons_player_face_map" });
    return res?.map && typeof res.map === "object" ? res.map : {};
  }

  async function fetch_thumbs(ids, is_bundles) {
    if (!ids.length) return {};
    let res = await send_message({
      type: "rolimons_player_thumbs",
      ids,
      is_bundles: !!is_bundles,
    });
    return res?.thumbs && typeof res.thumbs === "object" ? res.thumbs : {};
  }

  async function fetch_item_data() {
    let data = await send_message("getData");
    return data?.items && typeof data.items === "object" ? data.items : {};
  }

  function enrich_missing_bundles(missing, bundle_to_face, roli_items, thumbs) {
    return missing
      .map((item) => {
        let bundle_id = String(item?.itemTarget?.targetId || "");
        if (!bundle_id) return null;
        let face_id = bundle_to_face[bundle_id] || "";
        // v3 itemdetails keys limited bundles (and faces) by bundle id
        let roli = Array.isArray(roli_items[bundle_id])
          ? roli_items[bundle_id]
          : Array.isArray(roli_items[face_id])
            ? roli_items[face_id]
            : null;
        let rap = Number(roli?.[2]) || Number(item.recentAveragePrice) || 0;
        let value = roli_value(roli);
        let demand =
          Number(roli?.[5]) >= 0 && Number(roli?.[5]) < DEMAND_LABELS.length
            ? DEMAND_LABELS[Number(roli[5])]
            : null;
        let instances = Array.isArray(item.instances) ? item.instances : [];
        if (!instances.length) instances = [item];
        let ciiid = String(
          instances[0]?.collectibleItemInstanceId || "",
        ).trim();
        let held = instances.filter((inst) =>
          !!(inst?.isOnHold ?? item?.isOnHold),
        ).length;
        let name = String(
          (roli && roli[0]) || item.itemName || item.name || "Bundle",
        ).trim();
        return {
          bundle_id,
          face_id,
          name,
          rap,
          value,
          demand,
          serial: instances[0]?.serialNumber || null,
          ciiid,
          quantity: Math.max(1, instances.length || 1),
          held,
          thumb: thumbs[bundle_id] || "",
        };
      })
      .filter(Boolean)
      .sort((a, b) => face_sort_score(b) - face_sort_score(a));
  }

  function set_row_label_value(row, label, text, color) {
    let header = row.querySelector(".item_card_stat_header");
    let value = row.querySelector(".text-light, .text-truncate, .text-info");
    if (!header || !value) return false;
    if (header.textContent.trim() !== label) return false;
    value.textContent = text;
    if (color) {
      value.classList.remove(
        "text-success",
        "text-info",
        "text-danger",
        "text-warning",
        "text-primary",
        "text-light",
      );
      value.style.setProperty("color", color, "important");
    }
    return true;
  }

  function pick_template(grid) {
    let cards = Array.from(grid.querySelectorAll(".mix_item"));
    return (
      cards.find((card) =>
        card.querySelector("a.btn[href*='/uaid/'], a.btn[href*='/ciiid/']"),
      ) ||
      cards[0] ||
      null
    );
  }

  function bundle_href(item) {
    return `/bundle/${item.bundle_id}`;
  }

  function clear_tag_containers(clone) {
    clone
      .querySelectorAll(
        ".hold_item_tag_container, .system_item_tag_container, .asking_value_item_tag_container",
      )
      .forEach((el) => {
        el.innerHTML = "";
      });
    clone
      .querySelectorAll(
        ".item-hold-quantity, .modal, .item_quantity_tag, .quantity-label, .nte-rolimons-face-badge",
      )
      .forEach((el) => el.remove());
  }

  function apply_native_hold_tag(clone, held) {
    held = Math.max(0, Math.floor(Number(held) || 0));
    if (!(held > 0)) return;
    let img_container = clone.querySelector(".item_card_img_container");
    if (!img_container) return;
    let container = clone.querySelector(".hold_item_tag_container");
    if (!container) {
      container = document.createElement("div");
      container.className = "hold_item_tag_container";
      img_container.prepend(container);
    }
    let title = held > 1 ? `${held} On Hold` : "On Hold";
    let icon = document.createElement("div");
    icon.className = "hold_item_tag_icon hold_tag_icon";
    icon.setAttribute("data-toggle", "tooltip");
    icon.setAttribute("title", "");
    icon.setAttribute("data-original-title", title);
    container.appendChild(icon);
    try {
      if (typeof window.$ === "function" && typeof window.$.fn?.tooltip === "function") {
        window.$(icon).tooltip();
      }
    } catch {
      // Rolimons tooltip init is optional.
    }
  }

  function keep_rap_value_block(details) {
    let keep = [];
    for (let child of Array.from(details.children)) {
      let headers = [
        ...child.querySelectorAll(".item_card_stat_header"),
      ].map((el) => el.textContent.trim());
      if (headers.includes("RAP") || headers.includes("Value")) {
        keep.push(child);
        continue;
      }
      child.remove();
    }
    return keep;
  }

  function append_native_footer(details, face, href) {
    let serial = face.serial ? `#${face.serial}` : "N/A";

    let serial_row = document.createElement("div");
    serial_row.className = "d-flex justify-content-between";
    serial_row.innerHTML =
      `<a href="${href}"><div class="item_card_stat_header">Serial</div></a>` +
      `<div><span class="text-warning text-truncate">${serial}</span></div>`;
    details.appendChild(serial_row);

    let since_wrap = document.createElement("a");
    since_wrap.href = href;
    since_wrap.innerHTML =
      `<div class="d-flex justify-content-between">` +
      `<div class="item_card_stat_header">Owner Since</div>` +
      `<div><small class="inv_owner_since_time text-success text-truncate">Unknown</small></div>` +
      `</div>`;
    details.appendChild(since_wrap);

    let btn_wrap = document.createElement("div");
    btn_wrap.className = "pt-1 d-flex justify-content-between";
    if (face.ciiid) {
      let btn = document.createElement("a");
      btn.href = `/ciiid/${encodeURIComponent(face.ciiid)}`;
      btn.className = UAID_BTN_CLASS;
      btn.setAttribute("role", "button");
      btn.setAttribute("aria-pressed", "true");
      btn.textContent = "UAID Page";
      btn_wrap.appendChild(btn);
    }
    details.appendChild(btn_wrap);
  }

  function inject_bundle_card(grid, template, item) {
    let clone = template.cloneNode(true);
    clone.dataset.nteBundleInjected = "true";
    clone.style.opacity = "";
    clone.style.filter = "";
    clone.style.display = "";
    clone.title = "";
    delete clone.dataset.nteUnowned;
    delete clone.dataset.nteFaceInjected;

    let href = bundle_href(item);
    clone.querySelectorAll("a[href*='/item/'], a[href*='/bundle/']").forEach((a) => {
      if (a.classList.contains("btn")) return;
      a.href = href;
    });

    let name_el = clone.querySelector(".item_card_name");
    if (name_el) {
      name_el.textContent = item.name;
      name_el.title = item.name;
      name_el.style.background = "";
      name_el.style.color = "";
    }

    let img = clone.querySelector("img");
    if (img) {
      img.classList.add("lazyload", "inventory_item_image");
      img.removeAttribute("data-src");
      if (item.thumb) {
        img.src = item.thumb;
        img.setAttribute("data-src", item.thumb);
      }
    }

    clear_tag_containers(clone);
    apply_native_hold_tag(clone, item.held);

    let details = clone.querySelector(".item_card_details_container");
    if (details) {
      keep_rap_value_block(details);
      details.querySelectorAll(".d-flex.justify-content-between").forEach((row) => {
        let header = row.querySelector(".item_card_stat_header");
        if (!header) return;
        let label = header.textContent.trim();
        if (label === "RAP") {
          set_row_label_value(
            row,
            "RAP",
            item.rap ? item.rap.toLocaleString() : "-",
          );
        } else if (label === "Value") {
          set_row_label_value(
            row,
            "Value",
            item.value ? item.value.toLocaleString() : "-",
          );
        }
      });
      append_native_footer(details, item, href);
    }

    let img_container = clone.querySelector(".item_card_img_container");
    let qty_el = clone.querySelector(".player-item-quantity");
    if (item.quantity > 1) {
      if (!qty_el && img_container) {
        qty_el = document.createElement("span");
        qty_el.className = "player-item-quantity";
        img_container.appendChild(qty_el);
      }
      if (qty_el) {
        qty_el.textContent = `x${item.quantity}`;
        qty_el.style.display = "";
      }
    } else if (qty_el) {
      qty_el.remove();
    }

    let score = face_sort_score(item);
    let insert_before = Array.from(grid.querySelectorAll(".mix_item")).find(
      (card) => card_sort_score(card) < score,
    );
    if (insert_before) grid.insertBefore(clone, insert_before);
    else grid.appendChild(clone);
  }

  async function run_for_player(user_id) {
    if (!user_id || ran_for_user === user_id) return;
    ran_for_user = user_id;

    try {
      await wait_for("#mix_container .mix_item", 15000);
    } catch {
      return;
    }
    await sleep(800);

    let grid = document.querySelector("#mix_container");
    if (!grid) return;

    let [tradable_res, face_map, roli_items] = await Promise.all([
      fetch_tradable(user_id),
      fetch_face_map(),
      fetch_item_data(),
    ]);
    // Incomplete fetches (VPN 429s mid-pagination) must not mutate the page —
    // that would strip owned items that never made it into the partial list.
    if (!tradable_res?.complete) {
      ran_for_user = "";
      if (!player_fix_retry_timer) {
        let wait_ms = tradable_res?.status === 429 ? 30000 : 15000;
        player_fix_retry_timer = setTimeout(() => {
          player_fix_retry_timer = 0;
          run_for_player(user_id).catch(() => {});
        }, wait_ms);
      }
      return;
    }
    if (player_fix_retry_timer) {
      clearTimeout(player_fix_retry_timer);
      player_fix_retry_timer = 0;
    }
    let tradable = tradable_res.items;
    let { face_to_bundle, bundle_to_face } = build_face_maps(face_map);

    let shown_ids = new Set();
    grid
      .querySelectorAll(
        ".mix_item a[href*='/item/'], .mix_item a[href*='/bundle/']",
      )
      .forEach((a) => {
        let match = a.href.match(/\/(?:item|bundle)\/(\d+)/i);
        if (match) shown_ids.add(match[1]);
      });

    let owned_ids = new Set(
      tradable
        .map((item) => String(item?.itemTarget?.targetId || ""))
        .filter(Boolean),
    );

    let removed_rap = 0;
    let removed_value = 0;
    if (owned_ids.size > 0) {
      Array.from(grid.querySelectorAll(".mix_item")).forEach((card) => {
        let id = card_item_id(card);
        if (!id) return;
        if (set_has_related(owned_ids, id, face_to_bundle, bundle_to_face)) {
          return;
        }
        removed_rap += read_card_stat(card, "RAP");
        removed_value += card_value_for_total(card);
        card.remove();
      });
      if (removed_rap > 0) {
        adjust_sidebar_stat(
          "player_rap",
          -removed_rap,
          `-${removed_rap.toLocaleString()} RAP from items no longer owned`,
        );
      }
      if (removed_value > 0) {
        adjust_sidebar_stat(
          "player_value",
          -removed_value,
          `-${removed_value.toLocaleString()} value from items no longer owned`,
        );
      }
    }

    let missing_bundles = tradable.filter((item) => {
      let target = item?.itemTarget;
      if (!target || target.itemType !== "Bundle") return false;
      let id = String(target.targetId || "");
      if (!id) return false;
      return !set_has_related(shown_ids, id, face_to_bundle, bundle_to_face);
    });
    if (!missing_bundles.length) return;

    let bundle_ids = [
      ...new Set(
        missing_bundles
          .map((item) => String(item?.itemTarget?.targetId || ""))
          .filter(Boolean),
      ),
    ];
    let thumbs = await fetch_thumbs(bundle_ids, true);
    let missing_thumbs = bundle_ids.filter((id) => !thumbs[id]);
    if (missing_thumbs.length) {
      Object.assign(thumbs, await fetch_thumbs(missing_thumbs, false));
    }

    let enriched = enrich_missing_bundles(
      missing_bundles,
      bundle_to_face,
      roli_items,
      thumbs,
    );
    if (!enriched.length) return;

    let template = pick_template(grid);
    if (!template) return;
    for (let item of enriched) {
      inject_bundle_card(grid, template, item);
    }

    let total_bundle_value = enriched.reduce(
      (sum, item) => sum + item_value_for_total(item) * item.quantity,
      0,
    );
    let total_bundle_rap = enriched.reduce(
      (sum, item) => sum + (item.rap || 0) * item.quantity,
      0,
    );
    if (total_bundle_value > 0) {
      adjust_sidebar_stat(
        "player_value",
        total_bundle_value,
        `+${total_bundle_value.toLocaleString()} from ${enriched.length} unlisted bundle(s)`,
      );
    }
    if (total_bundle_rap > 0) {
      adjust_sidebar_stat(
        "player_rap",
        total_bundle_rap,
        `+${total_bundle_rap.toLocaleString()} RAP from ${enriched.length} unlisted bundle(s)`,
      );
    }
  }

 function is_trade_calculator() {
    return /\/tradecalculator\/?$/i.test(location.pathname || "");
  }

  const TRADE_CALC_BRIDGE_ID = "nte-roli-tc-bridge";

  function inject_trade_calc_page_script() {
    if (document.getElementById("nte-roli-tc-inventory-patch")) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      let script = document.createElement("script");
      script.id = "nte-roli-tc-inventory-patch";
      script.src = chrome.runtime.getURL(
        "scripts/rolimons_trade_calc_inventory_patch.js",
      );
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      (document.head || document.documentElement).appendChild(script);
    });
  }

  function ensure_trade_calc_bridge() {
    let el = document.getElementById(TRADE_CALC_BRIDGE_ID);
    if (el) return el;
    el = document.createElement("script");
    el.id = TRADE_CALC_BRIDGE_ID;
    el.type = "application/json";
    el.textContent = "{}";
    (document.documentElement || document.head).appendChild(el);
    return el;
  }

  function call_trade_calc_page(payload, expect_type, timeout_ms = 2500) {
    return new Promise((resolve) => {
      let bridge = ensure_trade_calc_bridge();
      let done = false;
      let finish = (value) => {
        if (done) return;
        done = true;
        obs.disconnect();
        resolve(value);
      };
      let obs = new MutationObserver(() => {
        let data = null;
        try {
          data = JSON.parse(bridge.textContent || "{}");
        } catch {
          return;
        }
        if (!data || data.to !== "content" || data.type !== expect_type) return;
        finish(data);
      });
      obs.observe(bridge, {
        characterData: true,
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-nte-res"],
      });
      bridge.textContent = JSON.stringify({ to: "page", ...payload });
      bridge.setAttribute("data-nte-cmd", String(Date.now()));
      setTimeout(() => finish(null), timeout_ms);
    });
  }

  function query_trade_calc_state() {
    return call_trade_calc_page({ type: "query" }, "state").then(
      (data) => data?.state || null,
    );
  }

  function apply_trade_calc_owned_ids(ids) {
    return call_trade_calc_page({ type: "apply", ids }, "applied").then(
      (data) => !!data?.ok,
    );
  }

  async function fetch_authenticated_user_id() {
    let res = await send_message({ type: "rolimons_player_auth_user" });
    let id = String(res?.id || "").trim();
    return /^\d+$/.test(id) ? id : "";
  }

  function owned_ids_from_tradable(tradable, face_to_bundle, bundle_to_face) {
    let ids = new Set();
    for (let item of tradable) {
      let target = item?.itemTarget;
      if (!target) continue;
      let id = String(target.targetId || "").trim();
      if (!/^\d+$/.test(id)) continue;
      ids.add(id);
      if (target.itemType === "Bundle") {
        let face = bundle_to_face[id];
        if (face) ids.add(String(face));
      } else if (target.itemType === "Asset") {
        let bundle = face_to_bundle[id];
        if (bundle) ids.add(String(bundle));
      }
    }
    return [...ids];
  }

  function hold_map_from_tradable(tradable, face_to_bundle, bundle_to_face) {
    let map = Object.create(null);
    function bump(id, held) {
      id = String(id || "").trim();
      if (!/^\d+$/.test(id)) return;
      let row = map[id] || (map[id] = { count: 0, held: 0 });
      row.count += 1;
      if (held) row.held += 1;
    }
    for (let item of tradable) {
      let target = item?.itemTarget || {};
      let base_id = String(target.targetId || "").trim();
      let item_type = String(target.itemType || "");
      let instances =
        Array.isArray(item?.instances) && item.instances.length
          ? item.instances
          : [item];
      for (let inst of instances) {
        let id = String(
          inst?.itemTarget?.targetId || base_id || "",
        ).trim();
        let type = String(inst?.itemTarget?.itemType || item_type || "");
        let held = !!(inst?.isOnHold ?? item?.isOnHold);
        bump(id, held);
        if (type === "Bundle") {
          let face = bundle_to_face[id];
          if (face) bump(face, held);
        } else {
          let bundle = face_to_bundle[id];
          if (bundle) bump(bundle, held);
        }
      }
    }
    return map;
  }

  let trade_calc_hold_by_id = Object.create(null);
  let trade_calc_hold_observer = null;
  let trade_calc_hold_paint_timer = 0;
  let trade_calc_hold_painting = false;

  function ensure_trade_calc_hold_styles() {
    if (document.getElementById("nte-tc-hold-style")) return;
    let style = document.createElement("style");
    style.id = "nte-tc-hold-style";
    style.textContent = `
.mix_item .nte-tc-hold-tag{
  position:absolute;top:4px;left:4px;z-index:3;
  display:inline-flex;align-items:center;gap:3px;
  pointer-events:none;color:#f8fafc;line-height:1;
}
.mix_item .nte-tc-hold-tag svg{
  width:18px;height:18px;display:block;flex:0 0 auto;
  filter:drop-shadow(0 2px 8px rgba(0,0,0,.65));
}
.mix_item .nte-tc-hold-count{
  font-size:9px;font-weight:800;letter-spacing:.02em;
  text-shadow:0 2px 8px rgba(0,0,0,.65);
}
.mix_item.nte-tc-is-hold{opacity:.72}
.mix_item.nte-tc-is-hold .item_thumbnail{filter:grayscale(.28)}
`;
    (document.head || document.documentElement).appendChild(style);
  }

  function trade_calc_card_asset_id(card) {
    let onclick = card?.getAttribute?.("onclick") || "";
    let m = onclick.match(/['"](\d+):(\d+)['"]/);
    return m ? m[2] : "";
  }

  function build_trade_calc_hold_tag(held, count) {
    held = Math.max(0, Math.floor(Number(held) || 0));
    count = Math.max(held, Math.floor(Number(count) || 0));
    if (!(held > 0)) return null;
    let partial = count > held;
    let title = partial ? `${held} of ${count} on hold` : "On hold";
    let tag = document.createElement("div");
    tag.className = "nte-tc-hold-tag";
    tag.setAttribute("aria-label", title);
    tag.title = title;
    tag.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' +
      (partial ? `<span class="nte-tc-hold-count">x${held}</span>` : "");
    return tag;
  }

  function clear_trade_calc_hold_badges() {
    for (let tag of document.querySelectorAll(".nte-tc-hold-tag")) tag.remove();
    for (let card of document.querySelectorAll(".mix_item.nte-tc-is-hold"))
      card.classList.remove("nte-tc-is-hold");
  }

  function paint_trade_calc_hold_badges() {
    ensure_trade_calc_hold_styles();
    trade_calc_hold_painting = true;
    try {
      clear_trade_calc_hold_badges();
      let ids = trade_calc_hold_by_id;
      if (!ids || !Object.keys(ids).length) return;
      for (let card of document.querySelectorAll(".mix_item")) {
        let asset_id = trade_calc_card_asset_id(card);
        let info = asset_id ? ids[asset_id] : null;
        if (!info || !(info.held > 0)) continue;
        let wrap = card.querySelector(".position-relative");
        if (!wrap) continue;
        let tag = build_trade_calc_hold_tag(info.held, info.count);
        if (!tag) continue;
        wrap.appendChild(tag);
        if (info.held >= info.count) card.classList.add("nte-tc-is-hold");
      }
    } finally {
      trade_calc_hold_painting = false;
    }
  }

  function schedule_trade_calc_hold_paint() {
    clearTimeout(trade_calc_hold_paint_timer);
    trade_calc_hold_paint_timer = setTimeout(() => {
      paint_trade_calc_hold_badges();
    }, 80);
  }

  function set_trade_calc_hold_map(map) {
    trade_calc_hold_by_id =
      map && typeof map === "object" ? map : Object.create(null);
    schedule_trade_calc_hold_paint();
  }

  function watch_trade_calc_hold_grid() {
    if (trade_calc_hold_observer) return;
    let root =
      document.getElementById("inventory_grid") ||
      document.querySelector(".inventory_grid, #page_content, .mix_container") ||
      document.body;
    if (!root) return;
    trade_calc_hold_observer = new MutationObserver(() => {
      if (trade_calc_hold_painting) return;
      if (!Object.keys(trade_calc_hold_by_id).length) return;
      schedule_trade_calc_hold_paint();
    });
    trade_calc_hold_observer.observe(root, {
      childList: true,
      subtree: true,
    });
  }

  let trade_calc_ran_for = "";
  let trade_calc_inflight = false;
  let trade_calc_retry_after = 0;

  async function run_trade_calculator_fix(force = false) {
    if (trade_calc_inflight) return;
    if (!force && Date.now() < trade_calc_retry_after) return;
    let state = await query_trade_calc_state();
    if (!state?.ready) return;
    let source = String(state.source || "all");
    let hide = !!state.hide;
    if (!hide || (source !== "mine" && source !== "other")) {
      trade_calc_ran_for = "";
      set_trade_calc_hold_map(null);
      return;
    }
    let user_id = String(state.player_id || "").trim();
    if (!/^\d+$/.test(user_id) && source === "mine") {
      user_id = await fetch_authenticated_user_id();
    }
    if (!/^\d+$/.test(user_id)) return;
    let token = `${source}:${user_id}:${state.asset_count}`;
    if (!force && trade_calc_ran_for === token) {
      schedule_trade_calc_hold_paint();
      return;
    }

    trade_calc_inflight = true;
    try {
      let [tradable_res, face_map] = await Promise.all([
        fetch_tradable(user_id),
        fetch_face_map(),
      ]);
      // Never overwrite Rolimons inventory with a partial fetch. VPN users often
      // hit 429 mid-pagination; applying that list drops missing items.
      if (!tradable_res?.complete) {
        let wait_ms = tradable_res?.status === 429 ? 30000 : 15000;
        trade_calc_retry_after = Date.now() + wait_ms;
        return;
      }
      trade_calc_retry_after = 0;
      let tradable = tradable_res.items;
      if (!tradable.length) return;
      let { face_to_bundle, bundle_to_face } = build_face_maps(face_map);
      let ids = owned_ids_from_tradable(
        tradable,
        face_to_bundle,
        bundle_to_face,
      );
      if (!ids.length) return;
      let hold_map = hold_map_from_tradable(
        tradable,
        face_to_bundle,
        bundle_to_face,
      );
      set_trade_calc_hold_map(hold_map);
      let ok = await apply_trade_calc_owned_ids(ids);
      if (ok) {
        let after = await query_trade_calc_state();
        trade_calc_ran_for = `${source}:${user_id}:${after?.asset_count || ids.length}`;
      }
      schedule_trade_calc_hold_paint();
      setTimeout(() => schedule_trade_calc_hold_paint(), 400);
      setTimeout(() => schedule_trade_calc_hold_paint(), 1200);
    } finally {
      trade_calc_inflight = false;
    }
  }

  function watch_trade_calculator() {
    let select = document.getElementById("inventory-source-select");
    let status = document.getElementById("inventory-filter-status-message");
    let scan = document.getElementById("hide-player-items-scan");
    let kick = () => {
      trade_calc_ran_for = "";
      setTimeout(() => {
        run_trade_calculator_fix(true).catch(() => {});
      }, 600);
    };
    if (select) select.addEventListener("change", kick);
    if (scan) scan.addEventListener("click", kick);
    if (status) {
      let obs = new MutationObserver(kick);
      obs.observe(status, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
    watch_trade_calc_hold_grid();
    document
      .querySelectorAll("#pagination_control_top, #pagination_control_bottom")
      .forEach((el) => {
        el.addEventListener("click", () => schedule_trade_calc_hold_paint());
      });
    setInterval(() => {
      run_trade_calculator_fix(false).catch(() => {});
    }, 1500);
  }

  async function boot_trade_calculator() {
    if (!(await is_enabled())) return;
    try {
      await wait_for("#inventory-source-select", 20000);
    } catch {
      return;
    }
    ensure_trade_calc_bridge();
    let injected = await inject_trade_calc_page_script();
    if (!injected) return;
    await sleep(400);
    watch_trade_calculator();
    await run_trade_calculator_fix(true);
  }

  async function boot() {
    if (!(await is_enabled())) return;
    if (is_trade_calculator()) {
      await boot_trade_calculator();
      return;
    }
    let user_id = player_id_from_path();
    if (!user_id) return;
    await run_for_player(user_id);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      boot().catch(() => {});
    });
  } else {
    boot().catch(() => {});
  }

  let last_path = location.pathname;
  setInterval(() => {
    if (location.pathname === last_path) return;
    last_path = location.pathname;
    ran_for_user = "";
    trade_calc_ran_for = "";
    boot().catch(() => {});
  }, 1000);
})();
