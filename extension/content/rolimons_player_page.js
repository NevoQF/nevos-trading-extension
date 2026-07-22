(() => {
  const OPTION_NAME = "Fix Rolimons Pages";
  const DEMAND_LABELS = ["Terrible", "Low", "Normal", "High", "Amazing"];
  const UAID_BTN_CLASS =
    "btn btn-light-blue border-primary btn-sm btn-very-sharp";
  let ran_for_user = "";

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
    return Array.isArray(res?.items) ? res.items : [];
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
        let ciiid = String(
          instances[0]?.collectibleItemInstanceId || "",
        ).trim();
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
    if (item.face_id) return `/item/${item.face_id}`;
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
      `<div><small class="inv_owner_since_time text-success text-truncate">Don't know</small></div>` +
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

    let [tradable, face_map, roli_items] = await Promise.all([
      fetch_tradable(user_id),
      fetch_face_map(),
      fetch_item_data(),
    ]);
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

  async function boot() {
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
    boot().catch(() => {});
  }, 1000);
})();
