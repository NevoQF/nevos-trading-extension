(() => {
  const option_name = "Reseller Trade Button";
  const roseal_defer_ms = 400;
  let sync_timer = 0;
  let resellers_seen_at = 0;
  let last_url = location.href;
  const can_trade_cache = {};

  function get_option(name) {
    return new Promise((resolve) => {
      chrome.storage.local.get([name], (result) => resolve(result?.[name]));
    });
  }

  function get_auth_user_id() {
    let raw = document.querySelector('meta[name="user-data"]')?.getAttribute("data-userid");
    let id = parseInt(String(raw || ""), 10);
    return Number.isFinite(id) ? id : 0;
  }

  function get_seller_id(row) {
    let buy = row.querySelector(".reseller-purchase-button[data-expected-seller-id]");
    let from_buy = buy?.getAttribute("data-expected-seller-id");
    if (from_buy) return String(from_buy).trim();

    let profile = row.querySelector('a[href*="/users/"][href*="/profile"]');
    let match = String(profile?.getAttribute("href") || "").match(/\/users\/(\d+)\//i);
    if (match) return match[1];

    let thumb = row.querySelector("[thumbnail-target-id]");
    let from_thumb = thumb?.getAttribute("thumbnail-target-id");
    return from_thumb ? String(from_thumb).trim() : "";
  }

  function build_trade_url(seller_id, instance_id) {
    let url = `https://www.roblox.com/users/${encodeURIComponent(seller_id)}/trade`;
    if (instance_id) url += `?ritems=${encodeURIComponent(instance_id)}`;
    return url;
  }

  function button_label(node) {
    return String(node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function is_buy_or_remove_button(node) {
    let label = button_label(node);
    if (label === "buy" || label === "remove") return true;
    let ng_bind = String(node.getAttribute("ng-bind") || "");
    return /Action\.Buy|Action\.Remove/i.test(ng_bind);
  }

  function is_trade_or_offer_button(node) {
    if (node.dataset.nteResellerTrade === "1") return false;
    if (node.classList.contains("reseller-offer-btn")) return true;
    let label = button_label(node);
    if (label === "trade" || label === "offer") return true;
    let ng_bind = String(node.getAttribute("ng-bind") || "");
    if (/Action\.Trade|avatarItem\.resellers\.item\.offer/i.test(ng_bind)) return true;
    let href = String(node.getAttribute("href") || "");
    return /\/users\/\d+\/trade/i.test(href);
  }

  function row_is_own_listing(row) {
    let remove_btn = row.querySelector(".remove-sale");
    if (remove_btn && !remove_btn.classList.contains("ng-hide")) return true;
    let seller_id = get_seller_id(row);
    let auth_id = get_auth_user_id();
    return seller_id && auth_id && String(seller_id) === String(auth_id);
  }

  function row_has_existing_trade_button(row) {
    let container = row.querySelector(".reseller-buttons-container");
    if (!container) return false;
    for (let node of container.querySelectorAll("button, a")) {
      if (is_buy_or_remove_button(node)) continue;
      if (is_trade_or_offer_button(node)) return true;
    }
    return false;
  }

  async function can_trade_with(user_id) {
    let key = String(user_id || "");
    if (!key) return false;
    if (can_trade_cache[key] !== undefined) return can_trade_cache[key];
    try {
      let resp = await fetch(`https://trades.roblox.com/v1/users/${encodeURIComponent(key)}/can-trade-with`, {
        credentials: "include",
      });
      if (!resp.ok) {
        can_trade_cache[key] = false;
        return false;
      }
      let data = await resp.json();
      can_trade_cache[key] = !!data?.canTrade;
    } catch {
      can_trade_cache[key] = true;
    }
    return can_trade_cache[key];
  }

  function remove_trade_buttons() {
    for (let btn of document.querySelectorAll('[data-nte-reseller-trade="1"]')) btn.remove();
    for (let row of document.querySelectorAll(".reseller-item[data-nte-reseller-trade-row]")) {
      row.removeAttribute("data-nte-reseller-trade-row");
      row.removeAttribute("data-nte-reseller-trade-pending");
    }
  }

  function dedupe_trade_buttons(row) {
    let ours = row.querySelectorAll('[data-nte-reseller-trade="1"]');
    for (let i = 1; i < ours.length; i++) ours[i].remove();
  }

  function yield_roseal_trade_button(node) {
    let row = node.closest?.(".reseller-item");
    if (!row) return;
    row.querySelector('[data-nte-reseller-trade="1"]')?.remove();
    row.removeAttribute("data-nte-reseller-trade-row");
    row.removeAttribute("data-nte-reseller-trade-pending");
  }

  function create_trade_button(seller_id, instance_id, can_trade) {
    let link = document.createElement("a");
    link.href = build_trade_url(seller_id, instance_id);
    link.className = "reseller-purchase-button btn-min-width btn-buy-md nte-reseller-trade-btn";
    link.dataset.nteResellerTrade = "1";
    link.textContent = "Trade";
    link.style.display = "flex";
    link.style.alignItems = "center";
    link.style.justifyContent = "center";
    link.style.float = "right";
    link.style.marginTop = "12px";
    link.style.marginRight = "6px";

    if (!can_trade) {
      link.classList.add("disabled");
      link.setAttribute("aria-disabled", "true");
      link.addEventListener("click", (event) => event.preventDefault());
    }
    return link;
  }

  async function inject_trade_button(row) {
    dedupe_trade_buttons(row);

    if (row.dataset.nteResellerTradePending === "1") return;
    if (row.querySelector('[data-nte-reseller-trade="1"]')) return;
    if (row_has_existing_trade_button(row)) return;
    if (row_is_own_listing(row)) return;

    let seller_id = get_seller_id(row);
    if (!seller_id) return;

    let container = row.querySelector(".reseller-buttons-container");
    if (!container) return;

    row.dataset.nteResellerTradePending = "1";
    try {
      if (row_has_existing_trade_button(row)) return;

      let instance_id = String(row.getAttribute("data-instance-id") || "").trim();
      let can_trade = await can_trade_with(seller_id);

      if (row_has_existing_trade_button(row)) return;

      let link = create_trade_button(seller_id, instance_id, can_trade);
      container.prepend(link);
      container.classList.add("has-trade-btn");
      row.dataset.nteResellerTradeRow = "1";
    } finally {
      row.removeAttribute("data-nte-reseller-trade-pending");
    }
  }

  async function sync() {
    if (!(await get_option(option_name))) {
      remove_trade_buttons();
      return;
    }

    let resellers = document.querySelector("#resellers");
    if (!resellers) {
      remove_trade_buttons();
      return;
    }

    if (!resellers.querySelector(".reseller-item")) return;

    if (!resellers_seen_at) resellers_seen_at = Date.now();
    if (Date.now() - resellers_seen_at < roseal_defer_ms) {
      schedule_sync();
      return;
    }

    for (let row of resellers.querySelectorAll(".reseller-item")) {
      if (row.querySelector(".reseller-offer-btn") || row_has_existing_trade_button(row)) {
        row.querySelector('[data-nte-reseller-trade="1"]')?.remove();
        row.removeAttribute("data-nte-reseller-trade-row");
        continue;
      }
      dedupe_trade_buttons(row);
      await inject_trade_button(row);
    }
  }

  function schedule_sync() {
    clearTimeout(sync_timer);
    sync_timer = setTimeout(() => {
      sync_timer = 0;
      sync().catch(() => {});
    }, 80);
  }

  function on_url_change() {
    if (location.href === last_url) return;
    last_url = location.href;
    resellers_seen_at = 0;
    remove_trade_buttons();
    schedule_sync();
  }

  schedule_sync();
  new MutationObserver((records) => {
    on_url_change();
    for (let record of records) {
      for (let node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.(".reseller-offer-btn")) yield_roseal_trade_button(node);
        node.querySelectorAll?.(".reseller-offer-btn").forEach(yield_roseal_trade_button);
        if (
          (node.matches?.("button, a") || node.querySelector?.("button, a")) &&
          node.closest?.(".reseller-buttons-container, .reseller-item")
        ) {
          let row = node.closest?.(".reseller-item") || node.querySelector?.(".reseller-item");
          if (row && row_has_existing_trade_button(row)) {
            row.querySelector('[data-nte-reseller-trade="1"]')?.remove();
            row.removeAttribute("data-nte-reseller-trade-row");
          }
        }
        if (node.matches?.(".reseller-item, .reseller-buttons-container")) {
          let row = node.matches(".reseller-item") ? node : node.closest(".reseller-item");
          if (row && row_has_existing_trade_button(row)) {
            row.querySelector('[data-nte-reseller-trade="1"]')?.remove();
            row.removeAttribute("data-nte-reseller-trade-row");
          }
        }
      }
    }
    schedule_sync();
  }).observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });

  setInterval(on_url_change, 500);

  chrome.runtime.onMessage.addListener((message) => {
    if (message === option_name || message === "Trading") schedule_sync();
  });
})();
