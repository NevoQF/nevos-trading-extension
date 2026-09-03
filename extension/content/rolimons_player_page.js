(() => {
  const OPTION_NAME = "Fix Rolimons Pages";
  const DEMAND_LABELS = ["Terrible", "Low", "Normal", "High", "Amazing"];
  const UAID_BTN_CLASS =
    "btn btn-light-blue border-primary btn-sm btn-very-sharp";
  const OWNED_COPIES_BTN_CLASS =
    "btn btn-bricky-green border-primary btn-sm btn-very-sharp";
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
        let copies = instances
          .map((inst) => ({
            ciiid: String(inst?.collectibleItemInstanceId || "").trim(),
            serial: inst?.serialNumber ?? item?.serialNumber ?? null,
          }))
          .filter((copy) => copy.ciiid);
        let ciiid = copies[0]?.ciiid || "";
        let held = instances.filter((inst) =>
          !!(inst?.isOnHold ?? item?.isOnHold),
        ).length;
        let name = String(
          (roli && roli[0]) || item.itemName || item.name || "Bundle",
        ).trim();
        let serials = unique_sorted_serials(
          instances.map((inst) => inst?.serialNumber ?? item?.serialNumber),
        );
        return {
          bundle_id,
          face_id,
          name,
          rap,
          value,
          demand,
          serial: serials[0] ?? instances[0]?.serialNumber ?? null,
          serials,
          ciiid,
          copies,
          quantity: Math.max(1, copies.length || instances.length || 1),
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
        card.querySelector(
          'a.btn[href*="/uaid/"], a.btn[href*="/ciiid/"], button.btn[data-target^="#modal-div-"]',
        ),
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

  function get_item_copies(item) {
    if (Array.isArray(item?.copies) && item.copies.length) {
      return item.copies.filter((copy) => copy?.ciiid);
    }
    if (item?.ciiid) {
      return [{ ciiid: item.ciiid, serial: item.serial ?? null }];
    }
    return [];
  }

  function append_total_stat_rows(details, item, href) {
    let quantity = Math.max(1, Number(item?.quantity) || 1);
    if (quantity <= 1) return;
    let total_rap = (Number(item?.rap) || 0) * quantity;
    let total_value = (Number(item?.value) || 0) * quantity;
    let wrap = document.createElement("a");
    wrap.href = href;
    wrap.innerHTML =
      `<div class="d-flex justify-content-between"><div class="item_card_stat_header">Total RAP</div>` +
      `<div class="text-info text-truncate">${total_rap.toLocaleString()}</div></div>` +
      `<div class="d-flex justify-content-between"><div class="item_card_stat_header">Total Value</div>` +
      `<div class="text-info text-truncate">${total_value.toLocaleString()}</div></div>`;
    details.appendChild(wrap);
  }

  function append_single_copy_footer(details, item, href) {
    let serials = unique_sorted_serials(
      item.serials?.length ? item.serials : [item.serial],
    );
    let serial = serials.length
      ? `#${serials[0]}`
      : item.serial
        ? `#${item.serial}`
        : "N/A";

    let serial_row = document.createElement("div");
    serial_row.className = "d-flex justify-content-between";
    serial_row.innerHTML =
      `<a href="${href}"><div class="item_card_stat_header">Serial</div></a>` +
      `<div><span class="text-warning text-truncate">${serial}</span></div>`;
    details.appendChild(serial_row);
    if (serials.length > 1) {
      let serial_el = serial_row.querySelector(".text-warning");
      if (serial_el) bind_serials_tip(serial_el, serials);
    }

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
    let copy = get_item_copies(item)[0];
    if (copy?.ciiid) {
      let btn = document.createElement("a");
      btn.href = `/ciiid/${encodeURIComponent(copy.ciiid)}`;
      btn.className = UAID_BTN_CLASS;
      btn.setAttribute("role", "button");
      btn.setAttribute("aria-pressed", "true");
      btn.textContent = "UAID Page";
      btn_wrap.appendChild(btn);
    }
    details.appendChild(btn_wrap);
  }

  function append_owned_copies_footer(details, item, copies) {
    let modal_key = String(item.face_id || item.bundle_id || "").trim();
    if (!modal_key || !copies.length) {
      append_single_copy_footer(details, item, bundle_href(item));
      return;
    }

    let btn_wrap = document.createElement("div");
    btn_wrap.className = "pt-1 d-flex justify-content-between";

    let btn = document.createElement("button");
    btn.type = "button";
    btn.className = OWNED_COPIES_BTN_CLASS;
    btn.setAttribute("data-toggle", "modal");
    btn.setAttribute("data-target", `#modal-div-${modal_key}`);
    btn.textContent = "Owned Copies";
    btn_wrap.appendChild(btn);

    let modal = document.createElement("div");
    modal.id = `modal-div-${modal_key}`;
    modal.className = "modal fade";
    modal.tabIndex = -1;
    modal.setAttribute("role", "dialog");

    let dialog = document.createElement("div");
    dialog.className = "modal-dialog";
    dialog.setAttribute("role", "document");

    let content = document.createElement("div");
    content.className = "modal-content";

    let header = document.createElement("div");
    header.className = "modal-header";
    header.innerHTML =
      `<h5 class="modal-title">${item.name || "Owned Copies"}</h5>` +
      `<button type="button" class="close" data-dismiss="modal" aria-label="Close">` +
      `<span aria-hidden="true">&times;</span></button>`;

    let body = document.createElement("div");
    body.className = "modal-body";
    let body_inner = document.createElement("span");
    for (let copy of copies) {
      let wrap = document.createElement("span");
      let link = document.createElement("a");
      link.href = `/ciiid/${encodeURIComponent(copy.ciiid)}`;
      link.className = `${UAID_BTN_CLASS} uaid_list_button`;
      link.setAttribute("role", "button");
      let serial = parse_serial_number(copy.serial);
      link.textContent = serial != null ? `#${serial}` : "Copy";
      wrap.appendChild(link);
      body_inner.appendChild(wrap);
    }
    body.appendChild(body_inner);

    let footer = document.createElement("div");
    footer.className = "modal-footer";
    footer.innerHTML =
      `<button type="button" class="btn btn-primary btn-very-sharp" data-dismiss="modal">Close</button>`;

    content.append(header, body, footer);
    dialog.appendChild(content);
    modal.appendChild(dialog);
    btn_wrap.appendChild(modal);
    details.appendChild(btn_wrap);
  }

  function append_native_footer(details, item, href) {
    let copies = get_item_copies(item);
    let quantity = Math.max(
      1,
      Number(item?.quantity) || 0,
      copies.length || 0,
    );
    if (quantity > 1 && copies.length) {
      append_owned_copies_footer(details, item, copies);
      return;
    }
    append_single_copy_footer(details, item, href);
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
      append_total_stat_rows(details, item, href);
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

    let hold_map = hold_map_from_tradable(
      tradable,
      face_to_bundle,
      bundle_to_face,
    );

    let missing_bundles = tradable.filter((item) => {
      let target = item?.itemTarget;
      if (!target || target.itemType !== "Bundle") return false;
      let id = String(target.targetId || "");
      if (!id) return false;
      return !set_has_related(shown_ids, id, face_to_bundle, bundle_to_face);
    });
    if (missing_bundles.length) {
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
      let template = enriched.length ? pick_template(grid) : null;
      if (template) {
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
    }

    paint_player_serial_tips(grid, hold_map);
    sync_player_limiteds_count(grid);
  }

  function sync_player_limiteds_count(grid) {
    if (!(grid instanceof Element)) return;
    let count_el = document.getElementById("player_num_limiteds");
    if (!count_el) return;
    count_el.textContent = String(grid.querySelectorAll(".mix_item").length);
  }

 function is_trade_calculator() {
    return /\/tradecalculator\/?$/i.test(location.pathname || "");
  }

  function is_trade_ads_page() {
    let path = location.pathname || "";
    return (
      /^\/trades\/?$/i.test(path) ||
      /^\/tradead\/\d+\/?$/i.test(path) ||
      /^\/playertrades(?:\/\d+)?\/?$/i.test(path) ||
      /^\/itemtrades(?:\/\d+)?\/?$/i.test(path)
    );
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

  async function ensure_trade_calc_page_script() {
    if (document.getElementById("nte-roli-tc-inventory-patch")) return true;
    for (let delay of [0, 400, 1200, 3000, 6000]) {
      if (delay) await sleep(delay);
      if (await inject_trade_calc_page_script()) return true;
    }
    return false;
  }

  function ensure_trade_calc_bridge() {
    let el = document.getElementById(TRADE_CALC_BRIDGE_ID);
    if (el && el.tagName === "SCRIPT") {
      el.remove();
      el = null;
    }
    if (el) return el;
    el = document.createElement("div");
    el.id = TRADE_CALC_BRIDGE_ID;
    el.hidden = true;
    el.setAttribute("aria-hidden", "true");
    el.textContent = "{}";
    (document.documentElement || document.head || document.body).appendChild(
      el,
    );
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

  function apply_trade_calc_owned_ids(ids, mode = "replace") {
    return call_trade_calc_page(
      { type: "apply", ids, mode },
      "applied",
    ).then((data) => !!data?.ok);
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

  function parse_serial_number(raw) {
    if (raw == null || raw === "") return null;
    let n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
  }

  function unique_sorted_serials(list) {
    let out = [];
    for (let raw of Array.isArray(list) ? list : []) {
      let n = parse_serial_number(raw);
      if (n == null || out.includes(n)) continue;
      out.push(n);
    }
    out.sort((a, b) => a - b);
    return out;
  }

  function empty_hold_row() {
    return { count: 0, held: 0, serial: null, serials: [] };
  }

  function add_hold_serial(row, serial) {
    serial = parse_serial_number(serial);
    if (serial == null) return;
    if (!row.serials.includes(serial)) {
      row.serials = [...row.serials, serial].sort((a, b) => a - b);
    }
    if (row.serial == null || serial < row.serial) row.serial = serial;
  }

  let serials_tip_el = null;
  let serials_tip_listening = false;

  function hide_serials_tip() {
    serials_tip_el?.remove();
    serials_tip_el = null;
  }

  function ensure_serials_tip_style() {
    if (document.getElementById("nte-serials-tip-style")) return;
    let style = document.createElement("style");
    style.id = "nte-serials-tip-style";
    style.textContent = `
.nte-serials-tip{
  position:fixed;z-index:2147483646;
  max-width:min(260px,calc(100vw - 16px));
  max-height:min(220px,calc(100vh - 16px));
  overflow:auto;padding:8px 10px;border-radius:10px;
  background:rgba(15,23,42,.96);
  border:1px solid rgba(248,250,252,.16);
  box-shadow:0 10px 28px rgba(0,0,0,.45);
  color:#f8fafc;font-size:12px;font-weight:700;line-height:1.35;
  letter-spacing:.01em;font-variant-numeric:tabular-nums;
  pointer-events:none;white-space:normal;
}
.mix_item .nte-tc-serial-tag.nte-serials-more{
  pointer-events:auto;cursor:help;
}
.mix_item .nte-serials-more{cursor:help}
`;
    (document.head || document.documentElement).appendChild(style);
  }

  function format_serials_tip(serials) {
    return unique_sorted_serials(serials)
      .map((n) => `#${n}`)
      .join(", ");
  }

  function show_serials_tip(anchor, serials) {
    hide_serials_tip();
    let text = format_serials_tip(serials);
    if (!anchor || !text) return;
    ensure_serials_tip_style();
    let tip = document.createElement("div");
    tip.className = "nte-serials-tip";
    tip.textContent = text;
    document.body.appendChild(tip);
    serials_tip_el = tip;
    let r = anchor.getBoundingClientRect();
    let tw = tip.offsetWidth;
    let th = tip.offsetHeight;
    let left = Math.min(
      Math.max(8, r.right - tw),
      window.innerWidth - tw - 8,
    );
    let top = r.top - th - 8;
    if (top < 8) top = Math.min(r.bottom + 8, window.innerHeight - th - 8);
    if (top < 8) top = 8;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  }

  function bind_serials_tip(el, serials) {
    let list = unique_sorted_serials(serials);
    if (!el || list.length <= 1) return;
    if (el.getAttribute("data-nte-serials-bound") === "1") return;
    el.setAttribute("data-nte-serials-bound", "1");
    el.classList.add("nte-serials-more");
    el.setAttribute("aria-label", `Serials ${format_serials_tip(list)}`);
    el.removeAttribute("title");
    if (!serials_tip_listening) {
      serials_tip_listening = true;
      window.addEventListener("scroll", hide_serials_tip, true);
      window.addEventListener("resize", hide_serials_tip);
    }
    el.addEventListener("mouseenter", () => show_serials_tip(el, list));
    el.addEventListener("mouseleave", hide_serials_tip);
  }

  function serial_value_el(card) {
    for (let row of card.querySelectorAll(".d-flex.justify-content-between")) {
      let header = row.querySelector(".item_card_stat_header");
      if (header?.textContent.trim() !== "Serial") continue;
      return (
        row.querySelector(".text-warning, .text-info, .text-light") ||
        row.lastElementChild
      );
    }
    return null;
  }

  function paint_player_serial_tips(grid, map) {
    ensure_serials_tip_style();
    if (!grid || !map) return;
    for (let card of grid.querySelectorAll(".mix_item")) {
      let id = card_item_id(card);
      let serials = id && map[id] ? map[id].serials : null;
      if (!serials || serials.length <= 1) continue;
      let el = serial_value_el(card);
      if (el) bind_serials_tip(el, serials);
    }
  }

  function bump_hold_row(map, id, held, serial) {
    id = String(id || "").trim();
    if (!/^\d+$/.test(id)) return;
    let row = map[id] || (map[id] = empty_hold_row());
    row.count += 1;
    if (held) row.held += 1;
    add_hold_serial(row, serial);
  }

  function hold_map_from_tradable(tradable, face_to_bundle, bundle_to_face) {
    let map = Object.create(null);
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
        let serial = parse_serial_number(
          inst?.serialNumber ?? item?.serialNumber,
        );
        bump_hold_row(map, id, held, serial);
        if (type === "Bundle") {
          let face = bundle_to_face[id];
          if (face) bump_hold_row(map, face, held, serial);
        } else {
          let bundle = face_to_bundle[id];
          if (bundle) bump_hold_row(map, bundle, held, serial);
        }
      }
    }
    return map;
  }

  function hold_map_from_asset_qty(asset_qty, face_to_bundle, bundle_to_face) {
    let map = Object.create(null);
    if (!asset_qty || typeof asset_qty !== "object") return map;
    function set_count(id, count) {
      id = String(id || "").trim();
      if (!/^\d+$/.test(id)) return;
      count = Math.max(1, Math.floor(Number(count) || 0));
      let row = map[id] || (map[id] = empty_hold_row());
      if (count > row.count) row.count = count;
    }
    for (let [raw_id, raw_count] of Object.entries(asset_qty)) {
      let id = String(raw_id || "").trim();
      let count = Math.max(1, Math.floor(Number(raw_count) || 0));
      set_count(id, count);
      let face = bundle_to_face[id];
      if (face) set_count(face, count);
      let bundle = face_to_bundle[id];
      if (bundle) set_count(bundle, count);
    }
    return map;
  }

  function merge_hold_maps(base, overlay) {
    let out = Object.create(null);
    for (let src of [base, overlay]) {
      if (!src) continue;
      for (let [id, info] of Object.entries(src)) {
        let row = out[id] || (out[id] = empty_hold_row());
        let count = Math.max(0, Math.floor(Number(info?.count) || 0));
        let held = Math.max(0, Math.floor(Number(info?.held) || 0));
        if (count > row.count) row.count = count;
        if (held > row.held) row.held = held;
        add_hold_serial(row, info?.serial);
        for (let serial of unique_sorted_serials(info?.serials)) {
          add_hold_serial(row, serial);
        }
      }
    }
    return out;
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
.mix_item .nte-tc-meta-row{
  position:absolute;bottom:4px;right:4px;z-index:3;
  display:inline-flex;align-items:center;gap:4px;
  pointer-events:none;
}
.mix_item .nte-tc-serial-tag.nte-serials-more{
  pointer-events:auto;cursor:help;
}
.mix_item .nte-tc-qty-tag,
.mix_item .nte-tc-serial-tag{
  display:inline-flex;align-items:center;justify-content:center;
  min-width:20px;height:18px;padding:0 6px;
  border-radius:999px;
  background:rgba(15,23,42,.82);
  border:1px solid rgba(248,250,252,.18);
  box-shadow:0 2px 8px rgba(0,0,0,.35);
  color:#f8fafc;
  font-size:10px;font-weight:800;letter-spacing:.02em;line-height:1;
  font-variant-numeric:tabular-nums;
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

  function build_trade_calc_qty_tag(count) {
    count = Math.max(0, Math.floor(Number(count) || 0));
    if (!(count > 1)) return null;
    let tag = document.createElement("div");
    tag.className = "nte-tc-qty-tag";
    tag.setAttribute("aria-label", `${count} owned`);
    tag.title = `${count} owned`;
    tag.textContent = `x${count}`;
    return tag;
  }

  function build_trade_calc_serial_tag(serial, serials) {
    let list = unique_sorted_serials(
      serials?.length ? serials : [serial],
    );
    serial = parse_serial_number(serial);
    if (serial == null) serial = list[0] ?? null;
    if (serial == null) return null;
    let tag = document.createElement("div");
    tag.className = "nte-tc-serial-tag";
    tag.setAttribute("aria-label", `Serial #${serial}`);
    tag.title = `Serial #${serial}`;
    tag.textContent = `#${serial}`;
    if (list.length > 1) bind_serials_tip(tag, list);
    return tag;
  }

  function clear_trade_calc_hold_badges() {
    hide_serials_tip();
    for (let tag of document.querySelectorAll(
      ".nte-tc-hold-tag, .nte-tc-meta-row, .nte-tc-qty-tag, .nte-tc-serial-tag",
    ))
      tag.remove();
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
        if (!info) continue;
        let wrap = card.querySelector(".position-relative");
        if (!wrap) continue;
        if (info.held > 0) {
          let tag = build_trade_calc_hold_tag(info.held, info.count);
          if (tag) {
            wrap.appendChild(tag);
            if (info.held >= info.count) card.classList.add("nte-tc-is-hold");
          }
        }
        let serial = build_trade_calc_serial_tag(info.serial, info.serials);
        let qty = build_trade_calc_qty_tag(info.count);
        if (serial || qty) {
          let row = document.createElement("div");
          row.className = "nte-tc-meta-row";
          if (serial) row.appendChild(serial);
          if (qty) row.appendChild(qty);
          wrap.appendChild(row);
        }
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
  let trade_calc_pending = false;
  let trade_calc_retry_after = 0;

  async function run_trade_calculator_fix(force = false) {
    if (trade_calc_inflight) {
      trade_calc_pending = true;
      return;
    }
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
    // Other Player: wait until Rolimons finishes the scan and sets playerId.
    // Do not fall back to the logged-in user — that overwrites the scan.
    if (!/^\d+$/.test(user_id) && source === "mine") {
      user_id = await fetch_authenticated_user_id();
    }
    if (!/^\d+$/.test(user_id)) return;
    let asset_qty =
      state.asset_qty && typeof state.asset_qty === "object"
        ? state.asset_qty
        : Object.create(null);
    let token = `${source}:${user_id}:${state.asset_count}`;
    if (!force && trade_calc_ran_for === token) {
      schedule_trade_calc_hold_paint();
      return;
    }

    trade_calc_inflight = true;
    try {
      let face_map = await fetch_face_map();
      let { face_to_bundle, bundle_to_face } = build_face_maps(face_map);
      let roli_map = hold_map_from_asset_qty(
        asset_qty,
        face_to_bundle,
        bundle_to_face,
      );

      let tradable_res = await fetch_tradable(user_id);
      // Never overwrite Rolimons inventory with a partial fetch. VPN users often
      // hit 429 mid-pagination; applying that list drops missing items.
      if (!tradable_res?.complete) {
        if (source === "other" && Object.keys(roli_map).length) {
          // Keep Rolimons scan assets; expand face keys + force hide/filter.
          await apply_trade_calc_owned_ids([], "merge");
          set_trade_calc_hold_map(roli_map);
          trade_calc_ran_for = token;
          schedule_trade_calc_hold_paint();
          setTimeout(() => schedule_trade_calc_hold_paint(), 400);
          setTimeout(() => schedule_trade_calc_hold_paint(), 1200);
          let wait_ms = tradable_res?.status === 429 ? 30000 : 15000;
          trade_calc_retry_after = Date.now() + wait_ms;
          return;
        }
        let wait_ms = tradable_res?.status === 429 ? 30000 : 15000;
        trade_calc_retry_after = Date.now() + wait_ms;
        return;
      }
      trade_calc_retry_after = 0;
      let tradable = tradable_res.items;
      if (!tradable.length) {
        if (source === "other" && Object.keys(roli_map).length) {
          await apply_trade_calc_owned_ids([], "merge");
          set_trade_calc_hold_map(roli_map);
          trade_calc_ran_for = token;
          schedule_trade_calc_hold_paint();
        }
        return;
      }
      let ids = owned_ids_from_tradable(
        tradable,
        face_to_bundle,
        bundle_to_face,
      );
      if (!ids.length) {
        if (source === "other" && Object.keys(roli_map).length) {
          await apply_trade_calc_owned_ids([], "merge");
          set_trade_calc_hold_map(roli_map);
          trade_calc_ran_for = token;
          schedule_trade_calc_hold_paint();
        }
        return;
      }
      let hold_map = merge_hold_maps(
        roli_map,
        hold_map_from_tradable(tradable, face_to_bundle, bundle_to_face),
      );
      set_trade_calc_hold_map(hold_map);
      // Other Player: merge into Rolimons scan assets (preserve UAIDs / hold
      // copies) and expand face keys so Mix filters to real owned items.
      // My Inventory: replace with the full tradable set.
      let ok = await apply_trade_calc_owned_ids(
        ids,
        source === "other" ? "merge" : "replace",
      );
      if (ok) {
        let after = await query_trade_calc_state();
        trade_calc_ran_for = `${source}:${user_id}:${after?.asset_count || ids.length}`;
      }
      schedule_trade_calc_hold_paint();
      setTimeout(() => schedule_trade_calc_hold_paint(), 400);
      setTimeout(() => schedule_trade_calc_hold_paint(), 1200);
    } finally {
      trade_calc_inflight = false;
      if (trade_calc_pending) {
        trade_calc_pending = false;
        setTimeout(() => {
          run_trade_calculator_fix(true).catch(() => {});
        }, 250);
      }
    }
  }

  function watch_trade_calculator() {
    let select = document.getElementById("inventory-source-select");
    let status = document.getElementById("inventory-filter-status-message");
    let scan = document.getElementById("hide-player-items-scan");
    let kick = (delay_ms = 600) => {
      trade_calc_ran_for = "";
      setTimeout(() => {
        run_trade_calculator_fix(true).catch(() => {});
      }, delay_ms);
    };
    if (select) select.addEventListener("change", () => kick(400));
    // Scan is async — don't race at 600ms. Status text / mix grid updates
    // are the real completion signals; a long fallback covers slow scans.
    if (scan)
      scan.addEventListener("click", () => {
        trade_calc_ran_for = "";
        kick(2500);
      });
    if (status) {
      let last_status = String(status.textContent || "").trim();
      let obs = new MutationObserver(() => {
        let next = String(status.textContent || "").trim();
        if (next === last_status) return;
        last_status = next;
        // Inventory is ready when status shows mine/other player inventory.
        if (/showing .+inventory/i.test(next)) kick(300);
        else kick(800);
      });
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

  const TC_USD_OPTION = "Show Routility USD Values";
  const TC_TRADE_STAMP_ID = "nte-roli-tc-trade";
  let tc_usd_roli = null;
  let tc_usd_routility = null;
  let tc_usd_enabled = false;
  let tc_usd_timer = 0;
  let tc_usd_observer = null;
  let tc_usd_last_key = "";
  let ad_usd_timer = 0;
  let ad_usd_observer = null;
  let usd_storage_hooked = false;

  function tc_normalize_label(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[#,()\-:'`"]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tc_get_usd(item_id, name) {
    let item = tc_usd_routility?.items?.[String(item_id)];
    // Known Routility id: never name-fallback to a different item
    // (e.g. Bling face vs Bling $$ Necklace acronym).
    if (item) return typeof item.usd === "number" ? item.usd : 0;
    let labels = [];
    let from_name = tc_normalize_label(name);
    if (from_name) labels.push(from_name);
    let row = tc_usd_roli?.items?.[String(item_id)];
    if (Array.isArray(row)) {
      let row_name = tc_normalize_label(row[0]);
      let row_acr = tc_normalize_label(row[1]);
      if (row_name) labels.push(row_name);
      if (row_acr) labels.push(row_acr);
    }
    if (!labels.length || !tc_usd_routility?.items) return 0;
    if (!tc_usd_routility.__nte_by_name) {
      let map = Object.create(null);
      let entries = Object.values(tc_usd_routility.items);
      for (let entry of entries) {
        if (!entry || typeof entry.usd !== "number" || !(entry.usd > 0))
          continue;
        let key = tc_normalize_label(entry.name);
        if (key && map[key] == null) map[key] = entry.usd;
      }
      for (let entry of entries) {
        if (!entry || typeof entry.usd !== "number" || !(entry.usd > 0))
          continue;
        let key = tc_normalize_label(entry.acr);
        if (key && map[key] == null) map[key] = entry.usd;
      }
      tc_usd_routility.__nte_by_name = map;
    }
    for (let label of labels) {
      if (tc_usd_routility.__nte_by_name[label] != null)
        return tc_usd_routility.__nte_by_name[label];
    }
    return 0;
  }

  function format_tc_usd(value) {
    let numeric = Number(value) || 0;
    let whole = Math.abs(numeric - Math.round(numeric)) < 0.005;
    return `$${numeric.toLocaleString(undefined, {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function read_stamped_trade() {
    let el = document.getElementById(TC_TRADE_STAMP_ID);
    if (!el) return { offer: [], request: [] };
    try {
      let data = JSON.parse(el.textContent || "null");
      if (!data || !Array.isArray(data.offer) || !Array.isArray(data.request))
        return { offer: [], request: [] };
      return data;
    } catch {
      return { offer: [], request: [] };
    }
  }

  function parse_tc_item_from_el(el) {
    if (!(el instanceof Element)) return null;
    let onclick = el.getAttribute("onclick") || "";
    let match = onclick.match(/item_select_handler\s*\(\s*(\d+)/);
    if (match) {
      let title = el.getAttribute("data-original-title") || el.getAttribute("title") || "";
      let name = title.split(/<br\s*\/?>/i)[0].replace(/<[^>]+>/g, "").trim();
      return { id: match[1], name };
    }
    for (let attr of [
      "data-item-id",
      "data-itemid",
      "data-asset-id",
      "data-assetid",
    ]) {
      let id = String(el.getAttribute(attr) || "").trim();
      if (/^\d+$/.test(id)) return { id, name: "" };
    }
    let href =
      el.getAttribute("href") ||
      el.querySelector("a[href*='/item/'], a[href*='/bundle/']")?.getAttribute(
        "href",
      ) ||
      "";
    match = String(href).match(/\/(?:item|bundle)\/(\d+)/i);
    if (match) return { id: match[1], name: "" };
    return null;
  }

  function read_trade_side_from_dom(container_id) {
    let root = document.getElementById(container_id);
    if (!root) return [];
    let items = [];
    let slots = root.querySelectorAll(".trade-item");
    if (slots.length) {
      for (let slot of slots) {
        let parsed =
          parse_tc_item_from_el(
            slot.querySelector("img[onclick*='item_select']"),
          ) ||
          parse_tc_item_from_el(slot.querySelector("img")) ||
          parse_tc_item_from_el(slot);
        if (parsed?.id) items.push(parsed);
      }
      if (items.length) return items;
    }
    for (let el of root.querySelectorAll(
      ".trade-item img, img[onclick*='item_select'], img.ad_item_img, [data-item-id], [data-asset-id]",
    )) {
      let parsed = parse_tc_item_from_el(el);
      if (parsed?.id) items.push(parsed);
    }
    return items;
  }

  function read_trade_from_dom() {
    let offer = read_trade_side_from_dom("offer_items");
    let request = read_trade_side_from_dom("request_items");
    if (!offer.length && !request.length) return null;
    return { offer, request };
  }

  function parse_tc_total(id) {
    return (
      parseInt(
        String(document.getElementById(id)?.textContent || "").replace(/,/g, ""),
        10,
      ) || 0
    );
  }

  function tc_side_has_activity(prefix) {
    return (
      parse_tc_total(prefix + "_rap_total_textbox") > 0 ||
      parse_tc_total(prefix + "_value_total_textbox") > 0 ||
      parse_tc_total(prefix + "_robux_textbox") > 0
    );
  }

  function tc_trade_has_visible_totals() {
    return tc_side_has_activity("offer") || tc_side_has_activity("request");
  }

  async function resolve_trade_for_usd() {
    let trade = read_stamped_trade();
    if (trade.offer.length || trade.request.length) return trade;
    let dom_trade = read_trade_from_dom();
    if (dom_trade) return dom_trade;
    if (!tc_trade_has_visible_totals()) return trade;
    try {
      let state = await query_trade_calc_state();
      if (
        state?.trade &&
        (state.trade.offer?.length || state.trade.request?.length)
      ) {
        return state.trade;
      }
    } catch {}
    return trade;
  }

  function sum_side_usd(items) {
    let total = 0;
    for (let item of items || []) {
      total += Number(tc_get_usd(item?.id, item?.name) || 0);
    }
    return total;
  }

  function ensure_tc_usd_styles() {
    let style = document.getElementById("nte-tc-usd-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "nte-tc-usd-style";
      (document.head || document.documentElement).appendChild(style);
    }
    if (style.dataset.nteVer === "usd-tc-6") return;
    style.dataset.nteVer = "usd-tc-6";
    style.textContent = `
.nte-tc-usd-label{
  padding-top:11px;
}
.nte-tc-usd-number{
  font-variant-numeric:tabular-nums;
  white-space:nowrap;
}
.trade-delta-card.nte-has-usd-delta{
  grid-template-columns:1fr 1fr 1fr!important;
  max-width:760px!important;
}
#usd_delta_row.trade-delta-segment{
  min-width:0;
}
.trade-delta-card.nte-has-usd-delta .trade-delta-amount,
.trade-delta-card.nte-has-usd-delta .trade-delta-value{
  white-space:nowrap;
}
#usd_delta_row .nte-tc-usd-delta-icon,
.nte-tc-usd-number img{
  display:none!important;
}
`;
  }

  function ensure_side_usd_row(prefix) {
    let num = document.getElementById(prefix + "_usd_total_textbox");
    if (num) {
      num.querySelectorAll("img").forEach((el) => el.remove());
      num.classList.add("text-success", "d-block", "nte-tc-usd-number");
      return num;
    }
    let rap = document.getElementById(prefix + "_rap_total_textbox");
    if (!rap) return null;
    let num_col = rap.parentElement;
    let label_col = num_col?.previousElementSibling;
    if (!(num_col instanceof Element) || !(label_col instanceof Element))
      return null;
    let label = document.createElement("span");
    label.className = "trade-total-label mr-2 text-right d-block nte-tc-usd-label";
    label.textContent = "USD";
    label_col.appendChild(label);
    num = document.createElement("span");
    num.id = prefix + "_usd_total_textbox";
    num.className = "trade-total-number text-success d-block nte-tc-usd-number";
    num.textContent = "$0";
    num_col.appendChild(num);
    return num;
  }

  function sync_usd_delta_arrow(row, even) {
    let arrow = row.querySelector(".trade-delta-arrow");
    if (!arrow) return;
    if (even) {
      arrow.innerHTML = "";
      return;
    }
    let source =
      document.querySelector("#rap_delta_row .trade-delta-arrow") ||
      document.querySelector("#value_delta_row .trade-delta-arrow");
    if (source && source.innerHTML.trim()) arrow.innerHTML = source.innerHTML;
  }

  function ensure_usd_delta_row() {
    let row = document.getElementById("usd_delta_row");
    if (!row) {
      let rap = document.getElementById("rap_delta_row");
      if (!rap) return null;
      row = rap.cloneNode(true);
      row.id = "usd_delta_row";
      row.classList.remove("trade-delta-even");
      let label = row.querySelector(".trade-delta-label");
      if (label) label.textContent = "USD";
      let badge = row.querySelector(".trade-delta-badge");
      if (badge) badge.id = "usd_delta_badge";
      let amount = row.querySelector(".trade-delta-amount");
      if (amount) amount.id = "usd_delta_amount";
      rap.after(row);
    }
    row.querySelectorAll(".nte-tc-usd-delta-icon").forEach((el) => el.remove());
    let value = row.querySelector(".trade-delta-value");
    if (value) {
      value.id = "usd_delta_value";
      value.style.removeProperty("display");
      value.style.removeProperty("gap");
      value.style.removeProperty("color");
      value.querySelectorAll("img, .nte-tc-usd-text").forEach((el) => el.remove());
    }
    return row;
  }

  function set_side_usd_row(prefix, amount, show) {
    let num = ensure_side_usd_row(prefix);
    if (!num) return;
    let label = num.parentElement?.previousElementSibling?.querySelector(
      ".nte-tc-usd-label",
    );
    num.querySelectorAll("img, .nte-tc-usd-text").forEach((el) => el.remove());
    num.textContent = format_tc_usd(amount);
    num.classList.add("d-block");
    num.style.removeProperty("display");
    num.style.display = show ? "" : "none";
    if (label) label.style.display = show ? "" : "none";
  }

  async function paint_trade_calculator_usd() {
    ensure_tc_usd_styles();
    let show = tc_usd_enabled && !!tc_usd_routility?.items;
    let trade = show ? await resolve_trade_for_usd() : { offer: [], request: [] };
    let offer = sum_side_usd(trade.offer);
    let request = sum_side_usd(trade.request);
    let has_items = !!(trade.offer.length || trade.request.length);
    let has_totals = tc_trade_has_visible_totals();
    let show_rows = show && (has_items || has_totals);
    let rap_row = document.getElementById("rap_delta_row");
    let rap_visible =
      rap_row instanceof Element &&
      getComputedStyle(rap_row).display !== "none";
    let show_delta = show_rows && (has_items || rap_visible);
    let key = `${show ? 1 : 0}|${show_rows ? 1 : 0}|${show_delta ? 1 : 0}|${offer}|${request}|${trade.offer.length}|${trade.request.length}`;
    if (key === tc_usd_last_key) return;
    set_side_usd_row("offer", offer, show_rows);
    set_side_usd_row("request", request, show_rows);
    let delta_row = ensure_usd_delta_row();
    if (!delta_row) return;
    tc_usd_last_key = key;
    delta_row.style.display = show_delta ? "" : "none";
    let card = document.getElementById("trade_delta_card");
    if (card) card.classList.toggle("nte-has-usd-delta", show_delta);
    if (!show_delta) return;
    let diff = request - offer;
    let gain = diff > 0;
    let even = Math.abs(diff) < 0.005;
    delta_row.classList.toggle("trade-delta-even", even);
    delta_row.classList.toggle("trade-delta-underpay", gain && !even);
    delta_row.classList.toggle("trade-delta-overpay", !gain && !even);
    sync_usd_delta_arrow(delta_row, even);
    let badge = document.getElementById("usd_delta_badge");
    if (badge) badge.textContent = even ? "Even" : gain ? "You Gain" : "You Lose";
    let value = document.getElementById("usd_delta_value");
    if (!value) return;
    value.querySelectorAll("img, .nte-tc-usd-text").forEach((el) => el.remove());
    value.textContent = format_tc_usd(Math.abs(diff));
  }

  function schedule_trade_calculator_usd() {
    clearTimeout(tc_usd_timer);
    tc_usd_timer = setTimeout(() => {
      paint_trade_calculator_usd().catch(() => {});
    }, 60);
  }

  async function refresh_tc_usd_data() {
    tc_usd_enabled = (await get_option(TC_USD_OPTION)) === true;
    if (!tc_usd_enabled) {
      tc_usd_last_key = "";
      paint_usd_for_current_page();
      return;
    }
    try {
      tc_usd_routility = await send_message("getRoutilityData");
    } catch {
      tc_usd_routility = null;
    }
    try {
      tc_usd_roli =
        (await send_message("getDataPeriodic")) ||
        (await send_message("getData"));
    } catch {
      tc_usd_roli = null;
    }
    tc_usd_last_key = "";
    paint_usd_for_current_page();
  }

  function watch_trade_stamp_el() {
    let stamp = document.getElementById(TC_TRADE_STAMP_ID);
    if (!stamp || stamp.dataset.nteUsdObs === "1") return;
    stamp.dataset.nteUsdObs = "1";
    new MutationObserver(() => schedule_trade_calculator_usd()).observe(stamp, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    schedule_trade_calculator_usd();
  }

  function watch_trade_calculator_usd() {
    if (tc_usd_observer) return;
    let root =
      document.querySelector(".trade-totals-grid") ||
      document.querySelector(".trade_container_grid") ||
      document.body;
    tc_usd_observer = new MutationObserver(() => {
      watch_trade_stamp_el();
      schedule_trade_calculator_usd();
    });
    tc_usd_observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    watch_trade_stamp_el();
    watch_usd_storage();
    setInterval(() => {
      watch_trade_stamp_el();
      schedule_trade_calculator_usd();
    }, 400);
  }

  function watch_usd_storage() {
    if (usd_storage_hooked) return;
    usd_storage_hooked = true;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes[TC_USD_OPTION] || changes.data || changes.routility_data)
        refresh_tc_usd_data().catch(() => {});
    });
  }

  function paint_usd_for_current_page() {
    if (is_trade_calculator()) paint_trade_calculator_usd();
    else if (is_trade_ads_page()) paint_trade_ads_usd();
  }

  function ad_side_items(side) {
    let items = [];
    if (!side) return items;
    for (let img of side.querySelectorAll("img.ad_item_img")) {
      let onclick = img.getAttribute("onclick") || "";
      let match = onclick.match(/item_select_handler\s*\(\s*(\d+)/);
      if (!match) continue;
      let title = img.getAttribute("data-original-title") || "";
      let name = title.split(/<br\s*\/?>/i)[0].replace(/<[^>]+>/g, "").trim();
      items.push({ id: match[1], name });
    }
    return items;
  }

  function ensure_ad_usd_styles() {
    let style = document.getElementById("nte-ad-usd-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "nte-ad-usd-style";
      (document.head || document.documentElement).appendChild(style);
    }
    if (style.dataset.nteVer === "usd-ad-2") return;
    style.dataset.nteVer = "usd-ad-2";
    style.textContent = `
.nte-ad-usd-label{
  color:#e8c36a;
}
.stat_value.nte-ad-usd-value{
  color:#e8c36a;
}
`;
  }

  function ensure_ad_side_usd(details) {
    let label = details.querySelector(":scope > .nte-ad-usd-label");
    let num = details.querySelector(":scope > .nte-ad-usd-value");
    if (!label) {
      label = document.createElement("div");
      label.textContent = "USD";
    }
    if (!num) {
      num = document.createElement("div");
    }
    label.className = "stat_title nte-ad-usd-label";
    num.className = "stat_value nte-ad-usd-value";
    let rap = details.querySelector(":scope > .stat_rap");
    if (rap) {
      rap.after(label);
      label.after(num);
    } else if (!label.isConnected) {
      details.appendChild(label);
      details.appendChild(num);
    }
    return { label, num };
  }

  function paint_ad_side_usd(side, show) {
    let details = side?.querySelector(".ad_side_details");
    if (!details) return;
    if (!show) {
      details.querySelector(":scope > .nte-ad-usd-label")?.remove();
      details.querySelector(":scope > .nte-ad-usd-value")?.remove();
      return;
    }
    let items = ad_side_items(side);
    let row = ensure_ad_side_usd(details);
    row.num.textContent = items.length
      ? format_tc_usd(sum_side_usd(items))
      : "-";
  }

  function paint_trade_ads_usd() {
    ensure_ad_usd_styles();
    let show = tc_usd_enabled && !!tc_usd_routility?.items;
    for (let card of document.querySelectorAll(".mix_item")) {
      paint_ad_side_usd(card.querySelector(".ad_side_left"), show);
      paint_ad_side_usd(card.querySelector(".ad_side_right"), show);
    }
  }

  function schedule_trade_ads_usd() {
    clearTimeout(ad_usd_timer);
    ad_usd_timer = setTimeout(() => {
      paint_trade_ads_usd();
    }, 80);
  }

  function watch_trade_ads_usd() {
    if (ad_usd_observer) return;
    let root =
      document.querySelector(".mix_container") ||
      document.querySelector(".trade_ads_container") ||
      document.body;
    ad_usd_observer = new MutationObserver(() => schedule_trade_ads_usd());
    ad_usd_observer.observe(root, {
      childList: true,
      subtree: true,
    });
    watch_usd_storage();
    window.addEventListener("hashchange", schedule_trade_ads_usd);
  }

  async function boot_trade_ads_usd() {
    try {
      await wait_for(".mix_item .ad_side_details, .ad_side_details", 20000);
    } catch {
      return;
    }
    watch_trade_ads_usd();
    await refresh_tc_usd_data();
    setTimeout(() => schedule_trade_ads_usd(), 500);
    setTimeout(() => schedule_trade_ads_usd(), 1500);
  }

  async function boot_trade_calculator_usd() {
    try {
      await wait_for(".trade-totals-grid, #offer_rap_total_textbox", 20000);
    } catch {
      return;
    }
    ensure_trade_calc_bridge();
    await ensure_trade_calc_page_script();
    watch_trade_calculator_usd();
    await refresh_tc_usd_data();
    setTimeout(() => schedule_trade_calculator_usd(), 500);
    setTimeout(() => schedule_trade_calculator_usd(), 1500);
    setTimeout(async () => {
      await ensure_trade_calc_page_script();
      schedule_trade_calculator_usd();
    }, 3000);
  }

  async function boot_trade_calculator() {
    if (!(await is_enabled())) return;
    try {
      await wait_for("#inventory-source-select", 20000);
    } catch {
      return;
    }
    ensure_trade_calc_bridge();
    let injected = await ensure_trade_calc_page_script();
    if (!injected) return;
    await sleep(400);
    watch_trade_calculator();
    await run_trade_calculator_fix(true);
  }

  async function boot() {
    if (is_trade_calculator()) {
      boot_trade_calculator_usd().catch(() => {});
      if (await is_enabled()) await boot_trade_calculator();
      return;
    }
    if (is_trade_ads_page()) {
      boot_trade_ads_usd().catch(() => {});
      return;
    }
    if (!(await is_enabled())) return;
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
