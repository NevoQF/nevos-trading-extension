(() => {
  function nte_send_message(msg, callback) {
    try {
      let result = chrome.runtime.sendMessage(msg);
      if (result && typeof result.then === "function") {
        result.then(
          function (r) {
            callback(r);
          },
          function () {
            callback(undefined);
          },
        );
      }
    } catch (e) {
      callback(undefined);
    }
  }


  function es_default(mod) {
    return mod && mod.__esModule ? mod.default : mod;
  }

  function define_export(obj, key, getter, setter) {
    Object.defineProperty(obj, key, {
      get: getter,
      set: setter,
      enumerable: true,
      configurable: true,
    });
  }

  var _global = globalThis,
    _cache = {},
    _pending = {};
  var _require = _global.parcelRequire94c2;

  if (_require == null) {
    _require = function (id) {
      if (id in _cache) return _cache[id].exports;
      if (id in _pending) {
        var fn = _pending[id];
        delete _pending[id];
        var mod = { id: id, exports: {} };
        _cache[id] = mod;
        fn.call(mod.exports, mod, mod.exports);
        return mod.exports;
      }
      var err = Error("Cannot find module '" + id + "'");
      err.code = "MODULE_NOT_FOUND";
      throw err;
    };
    _require.register = function (id, fn) {
      _pending[id] = fn;
    };
    _global.parcelRequire94c2 = _require;
  }

  var register = _require.register;


  register("eFyFE", function (module) {
    let rolimons_data;
    let rolimons_name_cache;
    let routility_data;

    function get_rolimons_data() {
      return rolimons_data;
    }
    function get_routility_data() {
      return routility_data;
    }
    function get_usd(item_id) {
      let item = routility_data?.items?.[String(item_id)];
      return item && typeof item.usd === "number" ? item.usd : 0;
    }
    function get_url(path) {
      if (window.__NTE_ICONS && window.__NTE_ICONS[path]) {
        var d = window.__NTE_ICONS[path];
        if (window.__NTE_resolveInlineIcon) d = window.__NTE_resolveInlineIcon(path, d);
        return d;
      }
      return chrome.runtime.getURL(path);
    }

    function wait_for_elm(selector, parent) {
      return new Promise((resolve) => {
        let root = parent !== undefined ? parent : document;
        function check() {
          let el = root.querySelector(selector);
          if (el) {
            resolve(el);
            observer.disconnect();
          }
        }
        let observer = new MutationObserver(check);
        observer.observe(parent !== undefined ? root : document.body, { childList: true, subtree: true });
        check();
      });
    }

    function nth_index(str, char, n) {
      var len = str.length,
        idx = -1;
      while (n-- && idx++ < len && !((idx = str.indexOf(char, idx)) < 0));
      return idx;
    }

    function commafy(num) {
      return num.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
    }

    function get_option(name) {
      return new Promise((resolve) => {
        chrome.storage.local.get([name], function (result) {
          if (chrome.runtime.lastError) console.info(chrome.runtime.lastError);
          resolve(result[name]);
        });
      });
    }

    function get_page_type() {
      let trade_el = document.querySelector('[ng-show="layout.view === tradesConstants.views.tradeRequest"]');
      if (trade_el) return trade_el.classList.contains("ng-hide") ? "details" : "sendOrCounter";
      if (document.querySelector(".results-container")) return "catalog";
      if (document.querySelector("[data-internal-page-name]")?.getAttribute("data-internal-page-name") === "CatalogItem") return "itemProfile";
      if (document.querySelector("[data-profileuserid]")) return "userProfile";
      if (/\/users\/\d+\/profile/.test(window.location.pathname)) return "userProfile";
      if (document.querySelector('meta[data-internal-page-name="Inventory"]')) return "userInventory";
      if (/\/users\/\d+\/inventory/.test(window.location.pathname)) return "userInventory";
      return undefined;
    }

    function normalize_rolimons_name(name) {
      return String(name || "")
        .toLowerCase()
        .replace(/[#,()\-:'`"]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function ensure_rolimons_name_cache() {
      if (rolimons_name_cache) return rolimons_name_cache;
      rolimons_name_cache = {};
      for (let [item_id, item_data] of Object.entries(rolimons_data?.items || {})) {
        if (!Array.isArray(item_data) || typeof item_data[0] !== "string") continue;
        let normalized_name = normalize_rolimons_name(item_data[0]);
        if (normalized_name && rolimons_name_cache[normalized_name] === undefined) {
          rolimons_name_cache[normalized_name] = {
            id: parseInt(item_id, 10),
            item: item_data,
          };
        }
      }
      return rolimons_name_cache;
    }

    function get_rolimons_item(item_id, item_name, resolve_bundle_by_name_only) {
      if (!resolve_bundle_by_name_only && rolimons_data?.items?.[item_id]) return rolimons_data.items[item_id];
      if (!item_name) return null;
      let normalized_name = normalize_rolimons_name(item_name);
      return ensure_rolimons_name_cache()[normalized_name]?.item || null;
    }

    function get_rolimons_item_id(item_id, item_name, resolve_bundle_by_name_only) {
      if (!resolve_bundle_by_name_only && rolimons_data?.items?.[item_id]) return parseInt(item_id, 10);
      if (!item_name) return null;
      let normalized_name = normalize_rolimons_name(item_name);
      return ensure_rolimons_name_cache()[normalized_name]?.id ?? null;
    }

    function is_unsupported_bundle(item_id, item_name) {
      let normalized_name = normalize_rolimons_name(item_name);
      return normalized_name === "signature kicks" || normalized_name === "the jade catseye";
    }

    function get_unsupported_bundle_value(item_id, item_name, fallback_rap) {
      if (!is_unsupported_bundle(item_id, item_name)) return null;
      let parsed = parseInt(fallback_rap, 10);
      return isNaN(parsed) ? 0 : parsed;
    }

    function get_value_or_rap(item_id, item_name, fallback_rap) {
      let item_data = get_rolimons_item(item_id, item_name);
      if (item_data) return item_data[4];
      let unsupported_value = get_unsupported_bundle_value(item_id, item_name, fallback_rap);
      return unsupported_value !== null ? unsupported_value : 0;
    }

    function get_rap(item_id, item_name, fallback_rap) {
      let item_data = get_rolimons_item(item_id, item_name);
      if (item_data) return item_data[2];
      let unsupported_value = get_unsupported_bundle_value(item_id, item_name, fallback_rap);
      return unsupported_value !== null ? unsupported_value : 0;
    }

    function normalize_tradeable_inventory_items(items) {
      let normalized = [];

      for (let item of Array.isArray(items) ? items : []) {
        let instances = Array.isArray(item?.instances) && item.instances.length ? item.instances : [item];

        for (let instance of instances) {
          let target_id = parseInt(instance?.itemTarget?.targetId ?? item?.itemTarget?.targetId ?? instance?.assetId ?? item?.assetId, 10);

          normalized.push({
            assetId: isNaN(target_id) ? undefined : target_id,
            collectibleItemId: item?.collectibleItemId || instance?.collectibleItemId || null,
            collectibleItemInstanceId: instance?.collectibleItemInstanceId || null,
            itemType: instance?.itemTarget?.itemType || item?.itemTarget?.itemType || null,
            itemTarget: instance?.itemTarget || item?.itemTarget || null,
            name: instance?.itemName || item?.itemName || instance?.name || item?.name || "Unknown",
            serialNumber: instance?.serialNumber ?? null,
            originalPrice: instance?.originalPrice ?? item?.originalPrice ?? null,
            recentAveragePrice: instance?.recentAveragePrice ?? item?.recentAveragePrice ?? 0,
            assetStock: instance?.assetStock ?? item?.assetStock ?? null,
            isOnHold: Boolean(instance?.isOnHold),
          });
        }
      }

      return normalized;
    }

    function get_extension_title(use_full) {
      return use_full ? chrome.runtime.getManifest().name : chrome.runtime.getManifest().short_name;
    }

    function get_color_mode() {
      if (document.getElementById("rbx-body")?.classList.contains("light-theme")) return "light";
      if (document.documentElement.classList.contains("light-theme") || document.body?.classList.contains("light-theme")) return "light";
      return "dark";
    }

    async function get_user_inventory(user_id) {
      let cursor = "";
      let items = [];

      while (true) {
        let params = new URLSearchParams({
          sortBy: "CreationTime",
          limit: "50",
          sortOrder: "Desc",
        });
        if (cursor) params.set("cursor", cursor);

        let url = `https://trades.roblox.com/v2/users/${user_id}/tradableitems?${params.toString()}`;
        let resp = await fetch(url, { credentials: "include" });
        if (resp.status !== 200) return false;
        let data = await resp.json();
        items = items.concat(Array.isArray(data?.items) ? data.items : []);
        cursor = data?.nextPageCursor || "";
        if (!cursor) break;
      }

      return normalize_tradeable_inventory_items(items);
    }

    async function get_authenticated_user_id() {
      return parseInt(document.querySelector('meta[name="user-data"]').getAttribute("data-userid"));
    }

    function add_tooltip(el, text) {
      el.setAttribute("data-toggle", "tooltip");
      el.setAttribute("title", text);
    }

    function remove_tooltips_from_class(class_name) {
      for (let el of document.querySelectorAll(`.${class_name}`)) {
        el.removeAttribute("data-toggle");
        el.removeAttribute("data-original-title");
      }
    }

    function init_tooltips() {
      if (document.getElementById("nruInitTooltipsScript")) {
        document.dispatchEvent(new CustomEvent("nru_init_tooltips"));
      } else {
        let script = document.createElement("script");
        script.id = "nruInitTooltipsScript";
        script.src = get_url("scripts/init_tooltips.js");
        script.onload = () => document.dispatchEvent(new CustomEvent("nru_init_tooltips"));
        (document.head || document.documentElement).appendChild(script);
      }
    }

    function check_if_asset_type_is_on_rolimons(id) {
      return (
        [
          8, 17, 18, 19, 27, 28, 29, 30, 31, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 61, 64, 65, 66, 67, 68, 69, 70, 71, 72,
          76, 77, 78, 79,
        ].indexOf(id) !== -1
      );
    }

    function remove_two_letter_path(path) {
      return path
        .split("/")
        .filter((s) => s.length !== 2)
        .join("/");
    }

    async function calculate_value_total_details(element, return_detail) {
      await wait_for_elm(".item-card-container");
      let containers = element.querySelectorAll(".item-card-container");
      await wait_for_elm(".item-card-price");
      let total = 0;
      for (let item of containers) {
        let p = remove_two_letter_path(item.querySelector(".item-card-price").parentElement.getElementsByTagName("a")[0].pathname);
        total += get_value_or_rap(parseInt(p.substring(nth_index(p, "/", 2) + 1, nth_index(p, "/", 3))));
      }
      let item_val = total;
      let robux_val = Math.round((parseInt(element.querySelector(".text-label.robux-line-value").innerText.replace(",", "")) || 0) / 0.7);
      total += robux_val;
      return return_detail ? [item_val, robux_val] : total;
    }

    async function calculate_value_total_send_or_counter(element, return_detail) {
      await wait_for_elm('[ng-repeat="slot in offer.slots"]', element);
      let slots = element.querySelectorAll('[ng-repeat="slot in offer.slots"]');
      let total = 0;
      for (let item of slots) {
        let id = parseInt(item.querySelector('[thumbnail-target-id][thumbnail-type="Asset"]')?.getAttribute("thumbnail-target-id"));
        if (!isNaN(id)) total += get_value_or_rap(id);
      }
      let item_val = total;
      let robux_input = element.querySelector('[name="robux"]');
      let robux_val = parseInt(robux_input.value) || 0;
      if (robux_input.parentElement.classList.contains("form-has-error")) robux_val = 0;
      total += robux_val;
      return return_detail ? [item_val, robux_val] : total;
    }

    function create_values_spans(container, options) {
      function insert(el, parent) {
        let link = parent.querySelector(".icon-link");
        link ? parent.insertBefore(el, link.parentElement) : parent.appendChild(el);
      }
      container.style.height = "44px";
      if (!options?.inline) insert(document.createElement("br"), container);
      let icon = document.createElement("span");
      icon.className = "icon icon-rolimons";
      icon.style.backgroundImage = `url(${JSON.stringify(get_url("assets/icons/logo48.png"))})`;
      icon.style.display = "inline-block";
      icon.style.backgroundSize = "cover";
      icon.style.width = options?.large ? "21px" : "19px";
      icon.style.height = icon.style.width;
      icon.style.marginTop = options?.inline ? "-4px" : "0px";
      icon.style.marginRight = options?.inline ? "3px" : "6px";
      icon.style.marginLeft = options?.inline ? "5px" : "0px";
      icon.style.verticalAlign = options?.inline && "middle";
      icon.style.transform = options?.large ? "translateY(4px)" : "translateY(2px)";
      icon.style.backgroundColor = "transparent";
      insert(icon, container);
      let span = document.createElement("span");
      span.className = `valueSpan ${options?.large ? "text-robux-lg" : "text-robux"}`;
      span.innerHTML = "";
      insert(span, container);
    }

    let username_id_cache = {};
    let username_id_pending = {};
    const username_id_cache_prefix = "nte_username_lookup:";
    const username_id_hit_ttl_ms = 6 * 60 * 60 * 1000;
    const username_id_miss_ttl_ms = 5 * 60 * 1000;
    const username_id_pending_ttl_ms = 60 * 1000;
    function get_username_id_cache(key) {
      let now = Date.now();
      let cached = username_id_cache[key];
      if (cached && cached.expires_at > now) return cached.value;
      if (cached) delete username_id_cache[key];
      try {
        cached = JSON.parse(sessionStorage.getItem(username_id_cache_prefix + key) || "null");
        if (cached && cached.expires_at > now) {
          username_id_cache[key] = cached;
          return cached.value;
        }
        sessionStorage.removeItem(username_id_cache_prefix + key);
      } catch {}
      return undefined;
    }
    function set_username_id_cache(key, value, ttl_ms) {
      let cached = { value: value || null, expires_at: Date.now() + ttl_ms };
      username_id_cache[key] = cached;
      try {
        sessionStorage.setItem(username_id_cache_prefix + key, JSON.stringify(cached));
      } catch {}
      return cached.value;
    }
    async function fetch_id_from_name(username) {
      username = String(username || "").trim();
      let key = username.toLowerCase();
      if (!key) return null;
      let cached = get_username_id_cache(key);
      if (cached !== undefined) return cached;
      if (username_id_pending[key]) return username_id_pending[key];
      username_id_pending[key] = (async () => {
        set_username_id_cache(key, null, username_id_pending_ttl_ms);
        try {
          let resp = await fetch("https://users.roblox.com/v1/usernames/users", {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json" },
            body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
          });
          if (!resp.ok) return set_username_id_cache(key, null, username_id_miss_ttl_ms);
          let id = ((await resp.json()).data || [])[0]?.id || null;
          return set_username_id_cache(key, id, id ? username_id_hit_ttl_ms : username_id_miss_ttl_ms);
        } catch {
          return set_username_id_cache(key, null, username_id_miss_ttl_ms);
        } finally {
          delete username_id_pending[key];
        }
      })();
      return username_id_pending[key];
    }


    define_export(
      module.exports,
      "refreshData",
      () =>
        function refresh_data(callback) {
          let msg = "getData";
          if (rolimons_data !== undefined) msg = "getDataPeriodic";
          let routility_msg = routility_data !== undefined ? "getRoutilityDataPeriodic" : "getRoutilityData";
          nte_send_message(routility_msg, function (data) {
            if (data) routility_data = data;
          });
          nte_send_message(msg, function (data) {
            if (chrome.runtime.lastError) return;
            rolimons_name_cache = undefined;
            rolimons_data = data;
            if (data) callback();
            setTimeout(() => refresh_data(callback), 60000);
          });
        },
    );
    define_export(module.exports, "getRolimonsData", () => get_rolimons_data);
    define_export(module.exports, "getRoutilityData", () => get_routility_data);
    define_export(module.exports, "getRolimonsItem", () => get_rolimons_item);
    define_export(module.exports, "getRolimonsItemId", () => get_rolimons_item_id);
    define_export(module.exports, "isUnsupportedBundle", () => is_unsupported_bundle);
    define_export(module.exports, "getURL", () => get_url);
    define_export(module.exports, "waitForElm", () => wait_for_elm);
    define_export(module.exports, "nthIndex", () => nth_index);
    define_export(module.exports, "commafy", () => commafy);
    define_export(module.exports, "getOption", () => get_option);
    define_export(module.exports, "getPageType", () => get_page_type);
    define_export(module.exports, "getValueOrRAP", () => get_value_or_rap);
    define_export(module.exports, "getRAP", () => get_rap);
    define_export(module.exports, "getUSD", () => get_usd);
    define_export(module.exports, "getExtensionTitle", () => get_extension_title);
    define_export(module.exports, "getColorMode", () => get_color_mode);
    define_export(module.exports, "getUserInventory", () => get_user_inventory);
    define_export(module.exports, "getAuthenticatedUserId", () => get_authenticated_user_id);
    define_export(module.exports, "addTooltip", () => add_tooltip);
    define_export(module.exports, "removeTooltipsFromClass", () => remove_tooltips_from_class);
    define_export(module.exports, "initTooltips", () => init_tooltips);
    define_export(module.exports, "checkIfAssetTypeIsOnRolimons", () => check_if_asset_type_is_on_rolimons);
    define_export(module.exports, "removeTwoLetterPath", () => remove_two_letter_path);
    define_export(module.exports, "calculateValueTotalDetails", () => calculate_value_total_details);
    define_export(module.exports, "calculateValueTotalSendOrCounter", () => calculate_value_total_send_or_counter);
    define_export(module.exports, "createValuesSpans", () => create_values_spans);
    define_export(module.exports, "fetchIDFromName", () => fetch_id_from_name);
    _require("8kQ1K");
  });


  register("8kQ1K", function (module) {
    module.exports = JSON.parse(
      '["Values",{"name":"Values on Trading Window","enabledByDefault":true,"path":"values-on-trading-window"},{"name":"Values on Trade Lists","enabledByDefault":true,"path":"values-on-trade-lists"},{"name":"Values on Catalog Pages","enabledByDefault":true,"path":"values-on-catalog-pages"},{"name":"Values on User Pages","enabledByDefault":true,"path":"values-on-user-pages"},{"name":"Show Routility USD Values","enabledByDefault":false,"path":"show-usd-values"},"Trading",{"name":"Trade Win/Loss Stats","enabledByDefault":true,"path":"trade-win-loss-stats"},{"name":"Colorblind Mode","enabledByDefault":false,"path":"colorblind-profit-mode"},{"name":"Trade Window Search","enabledByDefault":true,"path":"trade-window-search"},{"name":"Show Quick Decline Button","enabledByDefault":true,"path":"show-quick-decline-button"},"Trade Notifications",{"name":"Inbound Trade Notifications","enabledByDefault":false,"path":"inbound-trade-notifications"},{"name":"Declined Trade Notifications","enabledByDefault":false,"path":"declined-trade-notifications"},{"name":"Completed Trade Notifications","enabledByDefault":false,"path":"completed-trade-notifications"},"Item Flags",{"name":"Flag Rare Items","enabledByDefault":true,"path":"flag-rare-items"},{"name":"Flag Projected Items","enabledByDefault":true,"path":"flag-projected-items"},"Links",{"name":"Add Item Profile Links","enabledByDefault":true,"path":"add-item-profile-links"},{"name":"Add Item Ownership History (UAID) Links","enabledByDefault":true,"path":"add-uaid-links"},{"name":"Add User Profile Links","enabledByDefault":true,"path":"add-user-profile-links"},"Other",{"name":"Show User RoliBadges","enabledByDefault":true,"path":"show-user-roli-badges"},{"name":"Post-Tax Trade Value","enabledByDefault":true,"path":"post-tax-trade-value"},{"name":"Mobile Trade Items Button","enabledByDefault":true,"path":"mobile-trade-items-button"},{"name":"Disable Win/Loss Stats RAP","enabledByDefault":false,"path":"disable-win-loss-stats-rap"}]',
    );
  });


  register("98F8t", function (module) {
    define_export(module.exports, "default", () => handle_profile_links);
    var utils = _require("eFyFE");

    function remove_existing_link() {
      for (let link of document.querySelectorAll("a.nte-profile-rolimons-link, .user-profile-link")) {
        let anchor = link.tagName === "A" ? link : link.closest("a");
        anchor?.remove();
      }
    }

    function remove_stale_profile_links(container, user_id) {
      for (let link of document.querySelectorAll("a.nte-profile-rolimons-link, .user-profile-link")) {
        let anchor = link.tagName === "A" ? link : link.closest("a");
        if (!anchor) continue;
        if (anchor.parentElement === container && anchor.dataset.nteUserId === String(user_id)) continue;
        anchor.remove();
      }
    }

    function style_profile_link(link, user_id) {
      link.href = `https://www.rolimons.com/player/${user_id}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "nte-profile-rolimons-link";
      link.dataset.nteUserId = String(user_id);
      link.setAttribute("aria-label", "Open Rolimons profile");
      link.style.display = "inline-flex";
      link.style.alignItems = "center";
      link.style.justifyContent = "center";
      link.style.width = screen.width > 767 ? "32px" : "20px";
      link.style.height = link.style.width;
      link.style.marginLeft = screen.width > 767 ? "8px" : "6px";
      link.style.order = 1;
      link.style.lineHeight = "0";
      link.style.textDecoration = "none";
      utils.addTooltip(link, "Open Rolimons profile");
      link.setAttribute("data-original-title", "Open Rolimons profile");
    }

    function style_profile_icon(icon) {
      let icon_file = utils.getColorMode() === "dark" ? "rolimonsLink.svg" : "rolimonsLinkDark.svg";
      icon.style.backgroundImage = `url(${JSON.stringify(utils.getURL("assets/" + icon_file))})`;
      icon.className = "icon icon-link user-profile-link";
      icon.style.display = "inline-block";
      icon.style.backgroundSize = "cover";
      icon.style.width = "100%";
      icon.style.height = "100%";
      icon.style.cursor = "pointer";
      icon.style.transition = "filter 0.12s ease";
      icon.style.backgroundColor = "transparent";
      icon.style.pointerEvents = "none";
    }

    function get_user_id_from_page() {
      return (
        parseInt(document.querySelector("[data-profileuserid]")?.getAttribute("data-profileuserid")) ||
        parseInt(window.location.pathname.match(/\/users\/(\d+)\//)?.[1]) ||
        0
      );
    }

    async function add_profile_link() {
      let name_el = await utils.waitForElm("#profile-header-title-container-name");
      if (!name_el) return;
      let container = name_el.parentElement;
      let user_id = get_user_id_from_page();
      if (!user_id) return;

      remove_stale_profile_links(container, user_id);

      let link = container.querySelector(`a.nte-profile-rolimons-link[data-nte-user-id="${user_id}"]`);
      if (!link) link = document.createElement("a");

      style_profile_link(link, user_id);

      let icon = link.querySelector(".user-profile-link") || document.createElement("span");
      style_profile_icon(icon);
      link.onmouseenter = () => {
        icon.style.filter = "brightness(50%)";
      };
      link.onmouseleave = () => {
        icon.style.filter = "";
      };

      if (!icon.parentElement) link.appendChild(icon);
      if (!link.parentElement) container.appendChild(link);
      utils.initTooltips();
    }

    async function add_trade_page_link() {
      await utils.waitForElm(".trades-header-nowrap");
      let paired = [...document.getElementsByClassName("trades-header-nowrap")].at(-1)?.querySelector(".paired-name");
      if (!paired) return;
      let user_id = parseInt((window.location.pathname.match(/\/users\/(\d+)\/trade/) || [])[1], 10) || null;
      let existing = paired.querySelector(".user-profile-link")?.parentElement;
      let name = "";
      if (!user_id) {
        name = paired.children?.[2]?.innerText?.trim() || "";
        if (!name) return;
        if (existing?.getAttribute("data-nte-profile-name") === name) return;
        user_id = await utils.fetchIDFromName(name);
      }
      if (!user_id) return;
      let href = `https://www.rolimons.com/player/${user_id}`;
      if (existing?.href === href || existing?.getAttribute("href") === href) return;
      paired.style.position = "relative";

      let link = document.createElement("a");
      link.href = href;
      link.target = "_blank";
      if (name) link.setAttribute("data-nte-profile-name", name);
      link.rel = "noopener noreferrer";
      link.style.display = "inline-block";
      if (paired.innerText.length > 35) {
        link.style.display = "block";
        link.style.marginBottom = "5px";
      }
      link.style.paddingLeft = "4px";
      link.style.width = "28px";
      link.style.height = "28px";
      link.style.transform = "translateY(3px)";
      utils.addTooltip(link, "Open Rolimons profile");

      let icon = document.createElement("span");
      let icon_file = utils.getColorMode() === "dark" ? "rolimonsLink.svg" : "rolimonsLinkDark.svg";
      icon.style.backgroundImage = `url(${JSON.stringify(utils.getURL("assets/" + icon_file))})`;
      icon.className = "icon icon-link user-profile-link";
      icon.style.display = "inline-block";
      icon.style.position = "absolute";
      icon.style.verticalAlign = "bottom";
      icon.style.backgroundSize = "cover";
      icon.style.width = "28px";
      icon.style.height = "28px";
      icon.style.cursor = "pointer";
      icon.style.transition = "filter 0.2s";
      icon.style.backgroundColor = "transparent";
      icon.onmouseover = () => {
        icon.style.filter = "brightness(50%)";
      };
      icon.onmouseout = () => {
        icon.style.filter = "";
      };

      link.appendChild(icon);
      remove_existing_link();
      paired.appendChild(link);
      utils.initTooltips();
    }

    var handle_profile_links = async function () {
      if (!(await utils.getOption("Add User Profile Links"))) return remove_existing_link();
      let pt = utils.getPageType();
      if (pt === "details" || pt === "sendOrCounter") add_trade_page_link();
      if (pt === "userProfile") add_profile_link();
    };
  });


  register("8r981", function (module) {
    define_export(module.exports, "default", () => handle_values);
    var utils = _require("eFyFE");

    function remove_values() {
      document.querySelector(".value-price-info")?.remove();
      document.querySelector(".value-price-label")?.remove();
      for (let el of document.querySelectorAll(".valueSpan")) {
        el.parentElement.getElementsByTagName("br")[0]?.remove();
        el.parentElement.getElementsByClassName("icon-rolimons")[0]?.remove();
        el.remove();
      }
    }

    async function show_item_profile_value() {
      let item_id = window.location.pathname.match(/\/catalog\/(\d+)\//)?.[1];
      if (utils.getRolimonsData().items[item_id] === undefined) return;
      let container = await utils.waitForElm(".price-container-text");
      if (container.querySelector(".icon-rolimons") !== null) return;

      container.insertAdjacentHTML(
        "beforeend",
        '<div class="text-label field-label price-label value-price-label row-label" style="width: 150px;">Value</div>',
      );
      container.insertAdjacentHTML(
        "beforeend",
        `<div class="price-info value-price-info"><div class="icon-text-wrapper clearfix icon-robux-price-container"><span style="margin-top:0px;" class="icon-rolimons icon-robux-16x16 wait-for-i18n-format-render"></span><span class="valueSpan text-robux-lg wait-for-i18n-format-render"></span></div></div>`,
      );
      container.querySelector(".item-info-row-container").style.marginBottom = "5px";

      let icon = container.querySelector(".icon-rolimons");
      icon.style.setProperty("background-image", `url(${JSON.stringify(utils.getURL("assets/icons/logo48.png"))})`, "important");
      icon.style.backgroundSize = "cover";
      icon.style.backgroundPosition = "center";
      container.querySelector(".valueSpan").innerText = utils.commafy(utils.getValueOrRAP(item_id));
    }

    async function show_catalog_values() {
      await utils.waitForElm(".item-card-price");
      for (let div of document.getElementsByClassName("item-card-price")) {
        let path = utils.removeTwoLetterPath(div.parentElement.parentElement.pathname || div.parentElement.querySelector("a").pathname);
        let id = parseInt(path.substring(utils.nthIndex(path, "/", 2) + 1, utils.nthIndex(path, "/", 3)));
        if (utils.getRolimonsData().items[id] !== undefined) {
          if (!div.getElementsByClassName("valueSpan")[0]) utils.createValuesSpans(div);
          div.getElementsByClassName("valueSpan")[0].innerText = utils.commafy(utils.getValueOrRAP(id));
        }
      }
      for (let el of document.getElementsByClassName("list-item")) el.style.marginBottom = "35px";
    }

    var handle_values = async function () {
      let pt = utils.getPageType();
      if (pt === "catalog" || pt === "itemProfile") {
        if (!(await utils.getOption("Values on Catalog Pages"))) return remove_values();
        pt === "itemProfile" ? show_item_profile_value() : show_catalog_values();
      }
      if (pt === "userInventory") {
        if (!(await utils.getOption("Values on User Pages"))) return remove_values();
        show_catalog_values();
      }
    };
  });


  register("92Pqq", function (module) {
    let csrf_token;
    define_export(module.exports, "default", () => handle_item_links);
    var utils = _require("eFyFE");

    async function handle_item_links() {
      if (!(await utils.getOption("Add Item Profile Links"))) {
        document.querySelectorAll(".icon-link").forEach((el) => el.parentElement.remove());
        document.querySelectorAll(".hasAssetLink").forEach((el) => el.classList.remove("hasAssetLink"));
        return;
      }
      if (utils.getPageType() === "itemProfile") add_item_page_link();
      if (["details", "sendOrCounter", "catalog", "userInventory"].indexOf(utils.getPageType()) !== -1) add_catalog_item_links();
    }

    async function add_item_page_link() {
      await utils.waitForElm(".item-name-container");
      let h1 = document.querySelector(".item-name-container").getElementsByTagName("h1")[0];
      if (h1.querySelector(".icon-link") !== null) return;
      h1.style.overflow = "visible";
      let item_id = window.location.pathname.match(/\/catalog\/(\d+)\//)?.[1];
      let asset_type = parseInt(document.getElementById("asset-resale-data-container").getAttribute("data-asset-type"));
      if (!utils.checkIfAssetTypeIsOnRolimons(asset_type)) return;

      let link = document.createElement("a");
      link.href = `https://www.rolimons.com/item/${item_id}`;
      link.target = "_blank";
      link.style.display = "inline-block";
      link.style.width = "28px";
      link.style.height = "28px";
      link.style.transform = "translateY(4px)";
      utils.addTooltip(link, "Open item data page");

      let icon = document.createElement("span");
      let icon_file = utils.getColorMode() === "dark" ? "rolimonsLink.svg" : "rolimonsLinkDark.svg";
      icon.style.backgroundImage = `url(${JSON.stringify(utils.getURL("assets/" + icon_file))})`;
      icon.className = "icon icon-link";
      Object.assign(icon.style, {
        display: "inline-block",
        backgroundSize: "cover",
        width: "30px",
        height: "30px",
        cursor: "pointer",
        transition: "filter 0.2s",
        backgroundColor: "transparent",
        marginLeft: "4px",
      });
      icon.onmouseover = () => {
        icon.style.filter = "brightness(50%)";
      };
      icon.onmouseout = () => {
        icon.style.filter = "";
      };
      link.appendChild(icon);
      h1.appendChild(link);
      utils.initTooltips();
    }

    let type_cache = {},
      fetching = false;

    async function add_catalog_item_links() {
      for (let div of document.querySelectorAll(".item-card-price:not(.hasAssetLink), .item-value")) {
        for (let old of div.querySelectorAll(".icon-link")) old.parentElement.remove();
        let card = div.closest(".item-card-container, .trade-request-item");
        let path = utils.removeTwoLetterPath(div.parentElement.parentElement.pathname || div.parentElement.querySelector("a").pathname);
        let roblox_id = parseInt(path.substring(utils.nthIndex(path, "/", 2) + 1, utils.nthIndex(path, "/", 3)));
        let item_name = card?.querySelector(".item-card-name")?.textContent?.trim() || "";
        let is_bundle = /\/bundles\//i.test(path) || !!card?.querySelector('[thumbnail-type="BundleThumbnail"]');
        if (utils.isUnsupportedBundle(roblox_id, item_name)) continue;
        let rolimons_id = utils.getRolimonsItemId(roblox_id, item_name, is_bundle);
        if (!rolimons_id) continue;
        let roli_row = utils.getRolimonsData()?.items?.[rolimons_id];
        let cached = type_cache[rolimons_id];
        if (cached === "failed" && !roli_row) continue;
        let asset_ok = cached && utils.checkIfAssetTypeIsOnRolimons(cached);
        if (!(asset_ok || roli_row)) {
          if (cached === undefined) type_cache[rolimons_id] = false;
          continue;
        }
        let link = document.createElement("a");
        link.href = `https://www.rolimons.com/item/${rolimons_id}`;
        link.target = "_blank";
        Object.assign(link.style, { display: "inline-block", paddingLeft: "2px", transform: "translateY(-2px)" });
        utils.addTooltip(link, "Open item data page");
        let icon = document.createElement("span");
        let icon_file = utils.getColorMode() === "dark" ? "rolimonsLink.svg" : "rolimonsLinkDark.svg";
        icon.style.backgroundImage = `url(${JSON.stringify(utils.getURL("assets/" + icon_file))})`;
        icon.className = "icon icon-link";
        Object.assign(icon.style, {
          display: "inline-block",
          verticalAlign: "bottom",
          backgroundSize: "cover",
          width: "18px",
          height: "18px",
          cursor: "pointer",
          transition: "filter 0.2s",
          backgroundColor: "transparent",
        });
        icon.onmouseover = () => {
          icon.style.filter = "brightness(50%)";
        };
        icon.onmouseout = () => {
          icon.style.filter = "";
        };
        link.appendChild(icon);
        div.appendChild(link);
        div.style.overflow = "visible";
        div.classList.add("hasAssetLink");
        if (div.querySelector('[ng-bind="item.priceStatus"]')) {
          if (div.parentElement.querySelector(".creator-name")) {
            link.style.float = "left";
            link.style.marginTop = "-7px";
          } else {
            link.style.position = "absolute";
            link.style.bottom = "18px";
            link.style.right = "50px";
          }
        }
      }
      utils.initTooltips();

      if (Object.values(type_cache).indexOf(false) === -1 || fetching) return;
      fetching = true;
      let unknown = Object.keys(type_cache)
        .filter((k) => type_cache[k] === false)
        .map(Number);
      let body = { items: [] };
      unknown.forEach((id) => {
        if (body.items.length < 100) body.items.push({ itemType: 1, id: id });
      });
      if (csrf_token === undefined) csrf_token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("data-token");

      let resp = await fetch("https://catalog.roblox.com/v1/catalog/items/details", {
        method: "POST",
        headers: { "X-CSRF-TOKEN": csrf_token },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (resp.status === 403 && (await resp.json()).code === 0) {
        csrf_token = resp.headers.get("X-CSRF-TOKEN");
        fetching = false;
        return add_catalog_item_links();
      }
      if (resp.status === 200) {
        (await resp.json()).data.forEach((item) => {
          type_cache[item.id] = item?.assetType || "failed";
        });
      } else {
        Object.keys(type_cache).forEach((k) => {
          if (type_cache[k] === false) type_cache[k] = "failed";
        });
      }
      await handle_item_links();
      fetching = false;
      if (unknown.length > 100) return add_catalog_item_links();
    }
  });


  var utils = _require("eFyFE");
  var profile_links_mod = _require("98F8t");
  var catalog_values_mod = _require("8r981");
  var item_links_mod = _require("92Pqq");

  var PILL_CLASS =
    "relative clip group/interactable focus-visible:outline-focus disabled:outline-none cursor-pointer relative flex justify-center items-center radius-circle stroke-none padding-left-medium padding-right-medium height-800 text-label-medium bg-shift-300 content-action-utility";
  var PILL_OVERLAY =
    '<div role="presentation" class="absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none"></div>';
  var PROFILE_SUMMARY_ID = "nte-profile-summary";
  var profile_observer = null;
  var profile_render_timer = null;
  var profile_inventory_cache = {};
  var profile_inventory_pending = {};
  var profile_dominance_frame = null;

  function get_profile_user_id() {
    return (
      parseInt(document.querySelector("[data-profileuserid]")?.getAttribute("data-profileuserid")) ||
      parseInt(window.location.pathname.match(/\/users\/(\d+)\//)?.[1]) ||
      0
    );
  }

  function find_profile_stats_row() {
    return document.querySelector(".user-profile-header .flex-nowrap.gap-small.flex");
  }

  function remove_profile_summary() {
    document.getElementById(PROFILE_SUMMARY_ID)?.remove();
  }
  function ensure_profile_dominance_styles() {
    if (document.getElementById("nte-profile-dominance-style")) return;
    let style = document.createElement("style");
    style.id = "nte-profile-dominance-style";
    style.textContent = `
      .nte-profile-rolimons-link,.user-profile-link,#${PROFILE_SUMMARY_ID},.nte-discord-link,.nte-inv-hash-serial-btn{position:relative!important;z-index:2147483600!important;pointer-events:auto!important;isolation:isolate!important}
      .nte-modal-overlay{z-index:2147483646!important;pointer-events:auto!important;isolation:isolate!important}
      .nte-modal{position:relative!important;z-index:2147483647!important;pointer-events:auto!important;isolation:isolate!important}
    `;
    document.head.appendChild(style);
  }
  function mark_profile_dominant(el, z_index) {
    if (!el?.style) return;
    let position = getComputedStyle(el).position;
    if (!position || "static" === position) el.style.setProperty("position", "relative", "important");
    el.style.setProperty("z-index", String(z_index), "important");
    el.style.setProperty("pointer-events", "auto", "important");
    el.style.setProperty("isolation", "isolate", "important");
  }
  function assert_profile_dominance() {
    profile_dominance_frame && cancelAnimationFrame(profile_dominance_frame);
    profile_dominance_frame = requestAnimationFrame(() => {
      profile_dominance_frame = null;
      ensure_profile_dominance_styles();
      for (let el of document.querySelectorAll(".nte-profile-rolimons-link,.user-profile-link,#" + PROFILE_SUMMARY_ID + ",.nte-discord-link,.nte-inv-hash-serial-btn")) {
        mark_profile_dominant(el, 2147483600);
        let parent = el.parentElement;
        parent && el.classList?.contains("nte-profile-rolimons-link") && el !== parent.lastElementChild && parent.appendChild(el);
      }
      for (let overlay of document.querySelectorAll(".nte-modal-overlay")) {
        mark_profile_dominant(overlay, 2147483646);
        overlay.parentElement !== document.body && document.body.appendChild(overlay);
      }
      for (let modal of document.querySelectorAll(".nte-modal")) mark_profile_dominant(modal, 2147483647);
    });
  }

  function build_profile_pill(user_id, label_id) {
    return `<a aria-disabled="false" class="${PILL_CLASS}" href="https://www.rolimons.com/player/${user_id}" style="text-decoration: none;">${PILL_OVERLAY}<span class="text-no-wrap text-truncate-end nte-loading-dots" id="${label_id}">Loading</span></a>`;
  }

  function ensure_profile_summary_container(user_id) {
    let stats_row = find_profile_stats_row();
    if (!stats_row) return null;

    let wrapper = document.getElementById(PROFILE_SUMMARY_ID);
    if (wrapper && wrapper.parentElement !== stats_row) wrapper.remove();

    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.id = PROFILE_SUMMARY_ID;
      wrapper.className = "flex gap-small flex-nowrap";
      wrapper.style.display = "flex";
      wrapper.style.gap = "8px";
      wrapper.style.flexWrap = "nowrap";
      wrapper.style.minWidth = "0";
      wrapper.innerHTML = build_profile_pill(user_id, "totalRAP");
      stats_row.appendChild(wrapper);
    }

    return wrapper;
  }

  async function get_cached_profile_inventory(user_id) {
    if (profile_inventory_cache[user_id] !== undefined) return profile_inventory_cache[user_id];
    if (profile_inventory_pending[user_id]) return profile_inventory_pending[user_id];

    profile_inventory_pending[user_id] = utils
      .getUserInventory(user_id)
      .then((inventory) => {
        profile_inventory_cache[user_id] = inventory;
        return inventory;
      })
      .finally(() => {
        delete profile_inventory_pending[user_id];
      });

    return profile_inventory_pending[user_id];
  }

  function open_inventory_modal_click(event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    window.__nteShowModal?.();
  }


  async function show_inventory_values(user_id) {
    if (!(await utils.getOption("Values on User Pages"))) {
      remove_profile_summary();
      return;
    }

    await utils.waitForElm(".user-profile-header");
    let wrapper = ensure_profile_summary_container(user_id);
    if (!wrapper) return;

    let rap_link = document.getElementById("totalRAP")?.parentElement;
    if (rap_link && !rap_link.dataset.nteBound) {
      rap_link.dataset.nteBound = "1";
      rap_link.addEventListener("click", open_inventory_modal_click);
    }

    let rap_label = document.getElementById("totalRAP");
    if (!rap_label) return;

    rap_label.classList.add("nte-loading-dots");
    rap_label.innerText = "Loading";

    let inventory = await get_cached_profile_inventory(user_id);
    rap_label = document.getElementById("totalRAP");
    if (!rap_label) return;

    rap_label.classList.remove("nte-loading-dots");

    if (inventory) {
      let rolimons_data = utils.getRolimonsData();
      let total_value = 0;
      let total_rap = 0;

      for (let item of inventory) {
        total_value += utils.getValueOrRAP(item.assetId, item.name, item.recentAveragePrice);
        total_rap += item.recentAveragePrice || utils.getRAP(item.assetId, item.name, item.recentAveragePrice);
      }

      rap_label.innerText = utils.commafy(total_rap) + " RAP";
      utils.addTooltip(rap_label, "Click to view inventory breakdown");
      window.__nteInvData = {
        items: inventory,
        rolimonsData: rolimons_data,
        totalValue: total_value,
        totalRAP: total_rap,
      };
    } else {
      rap_label.innerText = "Private";
      utils.addTooltip(rap_label, "This user's inventory is private");
    }

    utils.initTooltips();
  }

  function start_profile_observer() {
    if (profile_observer) return;

    profile_observer = new MutationObserver(() => {
      if (profile_render_timer) clearTimeout(profile_render_timer);
      profile_render_timer = setTimeout(() => {
        profile_render_timer = null;
        if (utils.getPageType() === "userProfile") {
          let current_user_id = get_profile_user_id();
          if (!current_user_id) return;
          show_inventory_values(current_user_id);
          profile_links_mod.default();
          assert_profile_dominance();
        }
      }, 150);
    });

    profile_observer.observe(document.body, { childList: true, subtree: true });
  }


  async function add_mobile_trade_button(user_id) {
    let enabled = await utils.getOption("Mobile Trade Items Button");
    let can_trade = (await (await fetch(`https://trades.roblox.com/v1/users/${user_id}/can-trade-with`, { credentials: "include" })).json()).canTrade;
    if (!enabled || !can_trade) return;

    async function inject() {
      let el = await utils.waitForElm("#profile-block-user");
      if (el && !document.getElementById("profile-trade-items")) {
        el.parentElement.parentElement.insertAdjacentHTML(
          "afterbegin",
          `<li ng-show="profileHeaderLayout.canTrade"><button role="button" ng-click="tradeItems()" id="profile-trade-items" ng-bind="'Action.TradeItems' | translate" class="ng-binding">Trade Items</button></li>`,
        );
      }
    }
    let popover = document.getElementById("popover-link");
    if (popover) popover.onclick = () => inject();
  }


  var BADGE_KEYS = [
    "value_20m",
    "value_10m",
    "value_5m",
    "value_1m",
    "value_500k",
    "value_100k",
    "roli_award_winner",
    "roli_award_nominee",
    "own_lucky_cat_uaid",
    "own_1_serial_1",
    "own_1_serial_1337",
    "own_1_sequential_serial",
    "own_1_serial_1_to_9",
    "own_1_big_dominus",
    "own_1_dominus",
    "own_1_stf",
    "own_1_valued_federation_item",
    "own_1_immortal_sword",
    "own_epic_katana_set",
    "own_1_kotn_item",
    "own_15_noob",
    "own_5_noob",
    "own_10_rares",
    "own_3_rares",
    "own_1_rare",
    "create_10000_trade_ads",
    "create_1000_trade_ads",
    "create_100_trade_ads",
    "create_10_trade_ads",
    "own_all_asset_types",
    "own_50_pct_of_1_item",
    "own_25_pct_of_1_item",
    "own_10_pct_of_1_item",
    "own_100_of_1_item",
    "own_50_of_1_item",
    "own_10_of_1_item",
    "own_1000_items",
    "own_100_items",
    "own_10_items",
    "contributor",
    "sword_fighting_champion",
    "event_winner",
    "game_night_winner",
    "booster",
    "verified",
    "roligang",
  ];
  var BADGE_NAMES = {
    value_20m: "20M+",
    value_10m: "10M+",
    value_5m: "5M+",
    value_1m: "1M+",
    value_500k: "500K+",
    value_100k: "100K+",
    roli_award_winner: "Roli Award Winner",
    roli_award_nominee: "Roli Award Nominee",
    own_lucky_cat_uaid: "Lucky Cat",
    own_1_serial_1: "Serial #1",
    own_1_serial_1337: "L337",
    own_1_sequential_serial: "Sequential Serial",
    own_1_serial_1_to_9: "Low Serial",
    own_1_big_dominus: "Big Dominator",
    own_1_dominus: "Dominator",
    own_1_stf: "Sparkly",
    own_1_valued_federation_item: "Federated",
    own_1_immortal_sword: "Enduring",
    own_epic_katana_set: "Epic Blade Collector",
    own_1_kotn_item: "Evening Royalty",
    own_15_noob: "Noobie",
    own_5_noob: "Noob",
    own_10_rares: "Rare Supremist",
    own_3_rares: "Rare Enthusiast",
    own_1_rare: "Rare Owner",
    create_10000_trade_ads: "Boundless Trader",
    create_1000_trade_ads: "Active Trader",
    create_100_trade_ads: "Frequent Trader",
    create_10_trade_ads: "Trade Advertiser",
    own_all_asset_types: "Accessorized",
    own_50_pct_of_1_item: "Uncontrollable Addiction",
    own_25_pct_of_1_item: "Unhealthy Obsession",
    own_10_pct_of_1_item: "Modest Enthusiasm",
    own_100_of_1_item: "Mega Hoarder",
    own_50_of_1_item: "Hoarder",
    own_10_of_1_item: "Mini Hoarder",
    own_1000_items: "Incurable Collector",
    own_100_items: "Devout Collector",
    own_10_items: "Collector",
    contributor: "Contributor",
    sword_fighting_champion: "Sword Fighting Champion",
    event_winner: "Event Winner",
    game_night_winner: "Game Night Winner",
    booster: "Booster",
    verified: "Verified",
    roligang: "Roligang",
  };

  async function show_roli_badges(user_id) {
    if (!(await utils.getOption("Show User RoliBadges"))) {
      document.getElementById("roli-badges-container")?.remove();
      return;
    }
    nte_send_message({ title: "getUserProfileData", userId: user_id }, async function (resp) {
      if (!resp || !resp.rolibadges) return;
      let user_badges = Object.keys(resp.rolibadges);
      let ref = await utils.waitForElm("#roblox-badges-container");
      if (document.getElementById("roli-badges-container")) return;

      ref.insertAdjacentHTML(
        "afterend",
        `<div class="section" id="roli-badges-container"><div class="container-header"><h2>User Badges</h2><a class="btn-fixed-width btn-secondary-xs btn-more see-all-link-icon" href="https://www.rolimons.com/playerrolibadges/${user_id}">See All</a></div><div class="section-content remove-panel"><ul class="hlist badge-list"></ul></div></div>`,
      );
      let badge_list = document.querySelector("#roli-badges-container .badge-list");

      for (let key of BADGE_KEYS) {
        if (user_badges.indexOf(key) !== -1) {
          let svg = utils.getURL(`assets/roliBadges/${key}.svg`);
          let name = BADGE_NAMES[key];
          badge_list.innerHTML += `<li class="list-item asset-item"><a href="https://www.rolimons.com/playerrolibadges/${user_id}" title="${name}"><span class="thumbnail-2d-container"><img class="asset-thumb-container" src="${svg}" alt="${name}" title="${name}"></span><span class="font-header-2 text-overflow item-name">${name}</span></a></li>`;
        }
      }
    });
  }


  async function init() {
    let page_type = utils.getPageType();

    if (page_type === "userProfile") {
      let user_id = get_profile_user_id();
      if (!user_id) return;
      start_profile_observer();
      show_inventory_values(user_id);
      profile_links_mod.default();
      add_mobile_trade_button(user_id);
      show_roli_badges(user_id);
      assert_profile_dominance();
      return;
    }

    remove_profile_summary();

    if (page_type === "userInventory") {
      catalog_values_mod.default();
      item_links_mod.default();
      assert_profile_dominance();
    }
  }


  console.info(`%c${utils.getExtensionTitle()} v${chrome.runtime.getManifest().version} has started!`, "color: #0084DD");
  console.info("%cJoin our Discord: discord.gg/4XWE7yy2uE", "color: #5865F2; font-weight: bold");
  utils.refreshData(init);

  if (utils.getPageType() === "userInventory") {
    (async () => {
      new MutationObserver((mutations) => {
        for (let m of mutations) {
          if (m.type === "childList" && m.addedNodes) {
            for (let node of m.addedNodes) {
              if (node.classList?.contains("item-card-price")) return init();
            }
          }
        }
      }).observe(await utils.waitForElm("#assetsItems"), { attributes: true, childList: true, subtree: true });
    })();
  }

  chrome.runtime.onMessage.addListener(function (msg) {
    if (["Values", "Links", "Other"].indexOf(msg) !== -1) init();
  });


  (function () {
    var style = document.createElement("style");
    style.textContent = `
      .nte-loading-dots::after{content:'';animation:nteDots 1.4s steps(4,end) infinite}
      @keyframes nteDots{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
      .nte-modal-footer{text-align:center;padding:18px 0 8px;opacity:.48;transition:opacity .2s}
      .nte-modal-footer:hover{opacity:.82}
      .nte-discord-link{color:#d9dbdf;font-size:11px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:5px}
      .nte-discord-link:hover{color:#f5f5f6;text-decoration:underline}
      .nte-modal-overlay{position:fixed;inset:0;width:auto;height:auto;min-height:100vh;min-height:100dvh;padding:max(10px,env(safe-area-inset-top,0px)) max(10px,env(safe-area-inset-right,0px)) max(10px,env(safe-area-inset-bottom,0px)) max(10px,env(safe-area-inset-left,0px));box-sizing:border-box;background:rgba(6,7,9,.82);backdrop-filter:blur(18px) saturate(118%);-webkit-backdrop-filter:blur(18px) saturate(118%);z-index:99999;display:flex;align-items:center;justify-content:center;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;opacity:0;transition:opacity .25s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
      .nte-modal-overlay.active{opacity:1}
      .nte-modal{background:radial-gradient(circle at top,rgba(255,255,255,.06) 0%,transparent 34%),radial-gradient(circle at bottom left,rgba(255,255,255,.025) 0%,transparent 32%),linear-gradient(180deg,#18191c 0%,#121316 58%,#0d0e10 100%);border-radius:18px;width:min(1080px,100%);max-height:88vh;max-height:calc(100vh - 20px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));max-height:calc(100dvh - 20px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));min-height:0;display:flex;flex-direction:column;box-shadow:0 34px 110px rgba(0,0,0,.72),0 0 0 1px rgba(255,255,255,.08),inset 0 1px 0 rgba(255,255,255,.05);transform:translateY(24px) scale(.96);transition:transform .3s cubic-bezier(.16,1,.3,1);overflow:hidden}
      .nte-modal-overlay.active .nte-modal{transform:translateY(0) scale(1)}
      .nte-modal-header{padding:20px 24px 16px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0}
      .nte-modal-title{font-size:17px;font-weight:700;color:#f6f6f7;display:flex;align-items:center;gap:12px;min-width:0}
      .nte-modal-logo{width:40px;height:40px;border-radius:12px;object-fit:contain;flex-shrink:0;display:block;background:linear-gradient(145deg,#2b2d31,#17181b);box-shadow:0 10px 26px rgba(0,0,0,.34),0 0 0 1px rgba(255,255,255,.09)}
      .nte-modal-title-stack{display:flex;flex-direction:column;align-items:flex-start;gap:3px;flex:1;min-width:0}
      .nte-modal-title-text{line-height:1.2;font-size:18px;font-weight:800;letter-spacing:-.2px}
      .nte-modal-discord-sub{font-size:11px;font-weight:500;color:#999da6;text-decoration:none;line-height:1.2}
      .nte-modal-discord-sub:hover{color:#f0f2f5;text-decoration:underline}
      .nte-modal-close{width:34px;height:34px;border-radius:10px;border:none;background:rgba(255,255,255,.05);color:#b8bec8;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;line-height:1}
      .nte-modal-close:hover{background:rgba(255,255,255,.1);color:#fff;box-shadow:0 0 0 1px rgba(255,255,255,.1)}
      .nte-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;padding:18px 24px 12px;flex-shrink:0}
      .nte-stat-card{background:linear-gradient(180deg,#1c1e22,#15161a);border-radius:14px;padding:15px 16px;border:1px solid rgba(255,255,255,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 10px 24px rgba(0,0,0,.22);transition:border-color .18s,background .18s,box-shadow .18s}
      .nte-stat-card:hover{border-color:rgba(255,255,255,.14);background:linear-gradient(180deg,#22242a,#17191e);box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 14px 28px rgba(0,0,0,.3)}
      .nte-stat-card.usd-card{background:radial-gradient(circle at top right,rgba(245,215,154,.14) 0%,transparent 42%),linear-gradient(180deg,#231e17,#18140f);border-color:rgba(245,215,154,.18)}
      .nte-stat-card.routility-usd-card{background:radial-gradient(circle at top right,rgba(255,255,255,.09) 0%,transparent 42%),linear-gradient(180deg,#1d1f23,#141519);border-color:rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 10px 26px rgba(0,0,0,.24)}
      .nte-stat-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#9298a2;margin-bottom:7px;font-weight:700}
      .nte-stat-label.has-logo{display:inline-flex;align-items:center;gap:7px}
      .nte-stat-label-logo{width:13px;height:13px;display:block;object-fit:contain;flex:0 0 auto;opacity:.9}
      .nte-stat-value{font-size:24px;font-weight:800;color:#fafafa;letter-spacing:-.5px;line-height:1.1}
      .nte-stat-value.val-color{color:#fbfbfc}
      .nte-stat-value.rap-color{color:#d6d8de}
      .nte-stat-value.usd-color{color:#f6ddb1}
      .nte-stat-card.routility-usd-card .nte-stat-value.usd-color{color:#f1f3f5}
      .nte-stat-sub{font-size:11px;color:#7f8691;margin-top:4px;line-height:1.35}
      .nte-controls{padding:14px 24px;display:flex;gap:10px;align-items:center;flex-shrink:0;min-width:0}
      .nte-inv-hash-serial-btn{flex-shrink:0;min-width:40px;height:40px;padding:0 12px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,#1a1c20,#121317);color:#eceef2;font-size:16px;font-weight:800;line-height:1;cursor:pointer;font-family:inherit;transition:background .15s,border-color .15s,box-shadow .15s}
      .nte-inv-hash-serial-btn:hover{background:linear-gradient(180deg,#202329,#15181d);border-color:rgba(255,255,255,.16)}
      .nte-inv-hash-serial-btn.nte-inv-hash-serial-active{border-color:rgba(255,255,255,.22);box-shadow:0 0 0 3px rgba(255,255,255,.08)}
      #nte-inv-modal.nte-inv-blur-serials .nte-inv-serial{color:transparent!important;text-shadow:0 0 12px rgba(255,255,255,.72)!important;user-select:none!important}
      .light-theme #nte-inv-modal.nte-inv-blur-serials .nte-inv-serial{text-shadow:0 0 12px rgba(107,114,128,.35)!important}
      .light-theme .nte-inv-hash-serial-btn{border-color:rgba(17,24,39,.1);background:linear-gradient(180deg,#ffffff,#f2f3f5);color:#171a1f;box-shadow:0 1px 2px rgba(15,23,42,.04)}
      .light-theme .nte-inv-hash-serial-btn:hover{background:linear-gradient(180deg,#ffffff,#eceef1);border-color:rgba(17,24,39,.14)}
      .light-theme .nte-inv-hash-serial-btn.nte-inv-hash-serial-active{border-color:rgba(17,24,39,.18);box-shadow:0 0 0 3px rgba(17,24,39,.07)}
      .nte-search{flex:1;min-width:0;height:40px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:#14161a;color:#f7f7f8;font-size:13px;outline:none;transition:border-color .15s,background .15s,box-shadow .15s}
      .nte-search:focus{border-color:rgba(255,255,255,.18);background:#191b20;box-shadow:0 0 0 3px rgba(255,255,255,.08)}
      .nte-search::placeholder{color:#727986}
      .nte-sort{flex-shrink:0;max-width:100%;height:40px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:#14161a;color:#f7f7f8;font-size:13px;cursor:pointer;outline:none;transition:border-color .15s,background .15s}
      .nte-sort:hover{border-color:rgba(255,255,255,.14);background:#191b20}
      .nte-sort option{background:#14161a;color:#f7f7f8}
      .nte-items-container{flex:1 1 auto;min-height:0;overflow-y:auto;padding:8px 24px 20px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.14) transparent;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch}
      .nte-items-container::-webkit-scrollbar{width:6px}
      .nte-items-container::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:3px}
      .nte-items-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
      .nte-item-card{background:radial-gradient(circle at top,rgba(255,255,255,.06) 0%,transparent 44%),linear-gradient(180deg,#1b1c20 0%,#131416 100%);border-radius:14px;padding:10px;border:1px solid rgba(255,255,255,.07);cursor:pointer;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease,background .2s ease;text-decoration:none!important;display:block;position:relative;box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 10px 22px rgba(0,0,0,.24)}
      .nte-item-card::before{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(145deg,rgba(255,255,255,.09),transparent 24%,transparent 72%,rgba(255,255,255,.03));opacity:.5;pointer-events:none;transition:opacity .2s ease}
      .nte-item-card:hover{background:radial-gradient(circle at top,rgba(255,255,255,.09) 0%,transparent 48%),linear-gradient(180deg,#212329 0%,#17191d 100%);border-color:rgba(255,255,255,.14);transform:translateY(-2px);box-shadow:0 16px 34px rgba(0,0,0,.44),0 0 0 1px rgba(255,255,255,.05),inset 0 1px 0 rgba(255,255,255,.05)}
      .nte-item-card:hover::before{opacity:.85}
      .nte-item-thumb{position:relative;width:100%;aspect-ratio:1;border-radius:10px;background:radial-gradient(circle at 50% 14%,rgba(255,255,255,.16) 0%,rgba(40,42,46,.96) 54%,#0c0d10 100%);margin-bottom:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),0 14px 30px rgba(0,0,0,.22)}
      .nte-item-thumb::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,10,16,.02) 0%,rgba(8,10,16,.08) 42%,rgba(4,6,10,.48) 100%);pointer-events:none}
      .nte-item-thumb img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 12px 20px rgba(0,0,0,.28));transition:transform .32s cubic-bezier(.2,.8,.2,1),filter .32s cubic-bezier(.2,.8,.2,1)}
      .nte-item-card:hover .nte-item-thumb img{transform:scale(1.075) translateY(-1px);filter:drop-shadow(0 18px 24px rgba(0,0,0,.34))}
      .nte-thumb-tag,.nte-item-count{position:absolute;display:inline-flex;align-items:center;justify-content:center;gap:4px;line-height:1;pointer-events:none;z-index:1;white-space:nowrap;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
      .nte-thumb-tag{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:4px 8px;border-radius:999px;background:rgba(16,18,22,.82);color:#f5f6f8;border:1px solid rgba(255,255,255,.12);box-shadow:0 4px 16px rgba(0,0,0,.35)}
      .nte-thumb-tag svg{width:11px;height:11px;display:block;flex:0 0 auto}
      .nte-thumb-tag.proj{top:7px;left:7px;background:linear-gradient(180deg,rgba(89,63,30,.96),rgba(45,31,16,.92));color:#ffe3ad;border-color:rgba(255,203,124,.25);box-shadow:0 6px 18px rgba(83,52,16,.28)}
      .nte-thumb-tag.rare{bottom:7px;left:7px;width:24px;height:24px;padding:0;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.97),rgba(206,211,218,.93));color:#16181b;border-color:rgba(255,255,255,.45);box-shadow:0 8px 18px rgba(0,0,0,.2)}
      .nte-thumb-tag.serial{right:7px;bottom:7px;padding:4px 8px;font-variant-numeric:tabular-nums;font-size:9.5px;letter-spacing:0;text-transform:none;color:#eceef2;background:rgba(16,18,22,.88);border-color:rgba(255,255,255,.1)}
      .nte-thumb-tag.serial .nte-inv-serial{color:inherit!important}
      .nte-item-card.is-rare{border-color:rgba(255,255,255,.16);box-shadow:0 0 0 1px rgba(255,255,255,.05),inset 0 1px 0 rgba(255,255,255,.03),0 10px 22px rgba(0,0,0,.24)}
      .nte-item-card.is-rare:hover{border-color:rgba(255,255,255,.28);box-shadow:0 18px 38px rgba(0,0,0,.46),0 0 0 1px rgba(255,255,255,.1),inset 0 1px 0 rgba(255,255,255,.05)}
      .nte-item-card.is-proj:not(.is-rare){border-color:rgba(238,188,98,.18)}
      .nte-item-card.is-proj .nte-item-thumb{box-shadow:inset 0 0 0 1px rgba(255,203,129,.18),0 14px 30px rgba(0,0,0,.22)}
      .nte-item-name{font-size:12px;font-weight:700;color:#f3f4f6;line-height:1.32;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;min-height:32px;margin-bottom:8px}
      .nte-item-values{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
      .nte-item-val{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:7px 8px;border-radius:10px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.025));border:1px solid rgba(255,255,255,.07);min-width:0}
      .nte-item-val span:first-child{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#878d97}
      .nte-item-val .v,.nte-item-val .r{display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;line-height:1.1}
      .nte-item-val .v{color:#f7f7f8;font-weight:700}
      .nte-item-val .r{color:#d3d6dc;font-weight:650}
      .nte-item-footer{display:flex;align-items:center;justify-content:flex-start;gap:8px;margin-top:8px;min-height:28px}
      .nte-item-footer:empty{display:none}
      .nte-item-demand{display:inline-flex;align-items:center;gap:7px;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.04);font-size:10px;font-weight:650;letter-spacing:.02em;color:#f0f2f5}
      .nte-item-demand-dot{width:6px;height:6px;border-radius:50%;flex:0 0 auto;background:#8a9099}
      .nte-item-demand.demand-amazing{color:#e4f8e7;border-color:rgba(93,196,110,.3);background:rgba(36,117,57,.24)}
      .nte-item-demand.demand-amazing .nte-item-demand-dot{background:#63d779;box-shadow:0 0 10px rgba(99,215,121,.3)}
      .nte-item-demand.demand-high{color:#eefae7;border-color:rgba(122,188,96,.28);background:rgba(62,101,42,.22)}
      .nte-item-demand.demand-high .nte-item-demand-dot{background:#8ccf65;box-shadow:0 0 8px rgba(140,207,101,.28)}
      .nte-item-demand.demand-normal{color:#fff4c2;border-color:rgba(219,190,91,.28);background:rgba(110,92,28,.24)}
      .nte-item-demand.demand-normal .nte-item-demand-dot{background:#f0cb59;box-shadow:0 0 8px rgba(240,203,89,.26)}
      .nte-item-demand.demand-low{color:#ffd9cf;border-color:rgba(233,136,103,.26);background:rgba(120,66,52,.22)}
      .nte-item-demand.demand-low .nte-item-demand-dot{background:#ff936c;box-shadow:0 0 8px rgba(255,147,108,.26)}
      .nte-item-demand.demand-terrible{color:#ffd5d5;border-color:rgba(226,91,91,.28);background:rgba(116,36,36,.24)}
      .nte-item-demand.demand-terrible .nte-item-demand-dot{background:#ff6262;box-shadow:0 0 8px rgba(255,98,98,.3)}
      .nte-no-items{text-align:center;color:#8e97aa;padding:54px 20px;font-size:14px}
      .nte-item-count{top:7px;right:7px;padding:4px 8px;border-radius:999px;background:rgba(16,18,22,.86);border:1px solid rgba(255,255,255,.12);color:#f5f6f8;font-size:9px;font-weight:800;letter-spacing:.04em;box-shadow:0 4px 16px rgba(0,0,0,.35)}
      .nte-loading-modal{display:flex;align-items:center;justify-content:center;padding:64px;color:#9aa0aa;font-size:14px;gap:10px}
      .nte-loading-modal .spinner{width:20px;height:20px;border:2px solid rgba(255,255,255,.12);border-top-color:#f2f2f3;border-radius:50%;animation:nteSpin .6s linear infinite}
      @keyframes nteSpin{to{transform:rotate(360deg)}}
      .light-theme .nte-modal{background:radial-gradient(circle at top,rgba(255,255,255,.92) 0%,transparent 28%),linear-gradient(180deg,#ffffff 0%,#f3f4f6 100%);box-shadow:0 30px 90px rgba(12,18,34,.12),0 0 0 1px rgba(15,23,42,.08)}
      .light-theme .nte-modal-header{border-color:rgba(17,24,39,.08)}
      .light-theme .nte-modal-title{color:#101215}
      .light-theme .nte-modal-discord-sub{color:#707782}
      .light-theme .nte-modal-discord-sub:hover{color:#1f2937}
      .light-theme .nte-modal-logo{background:linear-gradient(145deg,#ffffff,#eceef1);box-shadow:0 6px 18px rgba(35,52,87,.08),0 0 0 1px rgba(17,24,39,.08)}
      .light-theme .nte-modal-close{background:rgba(17,24,39,.05);color:#646b76}
      .light-theme .nte-modal-close:hover{background:rgba(17,24,39,.1);color:#111827}
      .light-theme .nte-stat-card{background:linear-gradient(180deg,#ffffff,#f4f4f5);border-color:rgba(17,24,39,.08);box-shadow:0 10px 20px rgba(15,23,42,.04)}
      .light-theme .nte-stat-card:hover{border-color:rgba(17,24,39,.12);background:linear-gradient(180deg,#ffffff,#f0f1f3)}
      .light-theme .nte-stat-card.usd-card{background:radial-gradient(circle at top right,rgba(245,197,112,.12) 0%,transparent 44%),linear-gradient(180deg,#fffaf1,#f4ede2);border-color:rgba(207,170,97,.18)}
      .light-theme .nte-stat-card.routility-usd-card{background:radial-gradient(circle at top right,rgba(17,24,39,.035) 0%,transparent 44%),linear-gradient(180deg,#ffffff,#eff1f3);border-color:rgba(17,24,39,.08)}
      .light-theme .nte-stat-label{color:#6b7280}
      .light-theme .nte-stat-value{color:#111317}
      .light-theme .nte-stat-value.val-color{color:#111317}
      .light-theme .nte-stat-value.rap-color{color:#4b5563}
      .light-theme .nte-stat-value.usd-color{color:#9a6a1c}
      .light-theme .nte-stat-card.routility-usd-card .nte-stat-value.usd-color{color:#49515b}
      .light-theme .nte-stat-sub{color:#6b7280}
      .light-theme .nte-search,.light-theme .nte-sort{background:linear-gradient(180deg,#ffffff,#f4f5f6);border-color:rgba(17,24,39,.1);color:#171a1f}
      .light-theme .nte-search:focus{background:#fff;border-color:rgba(17,24,39,.18);box-shadow:0 0 0 3px rgba(17,24,39,.08)}
      .light-theme .nte-search::placeholder{color:#949aa6}
      .light-theme .nte-sort:hover{border-color:rgba(17,24,39,.14);background:#fff}
      .light-theme .nte-sort option{background:#fff;color:#171a1f}
      .light-theme .nte-item-card{background:linear-gradient(180deg,#ffffff 0%,#f5f6f7 100%);border-color:rgba(17,24,39,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 10px 20px rgba(15,23,42,.04)}
      .light-theme .nte-item-card::before{background:linear-gradient(145deg,rgba(255,255,255,.94),transparent 24%,transparent 72%,rgba(17,24,39,.03))}
      .light-theme .nte-item-card:hover{background:linear-gradient(180deg,#ffffff 0%,#f0f2f4 100%);border-color:rgba(17,24,39,.12);box-shadow:0 14px 28px rgba(34,55,99,.1),0 0 0 1px rgba(17,24,39,.03),inset 0 1px 0 rgba(255,255,255,.72)}
      .light-theme .nte-item-thumb{background:radial-gradient(circle at top,#ffffff 0%,#eff0f2 60%,#e5e7eb 100%);box-shadow:inset 0 0 0 1px rgba(17,24,39,.08)}
      .light-theme .nte-item-name{color:#171a1f}
      .light-theme .nte-item-val{color:#6b7280;background:linear-gradient(180deg,rgba(17,24,39,.025),rgba(17,24,39,.015));border-color:rgba(17,24,39,.06)}
      .light-theme .nte-item-val span:first-child{color:#6f7581}
      .light-theme .nte-item-val .v{color:#111317}
      .light-theme .nte-item-val .r{color:#4b5563}
      .light-theme .nte-thumb-tag{background:rgba(255,255,255,.92);color:#171a1f;border-color:rgba(17,24,39,.1);box-shadow:0 4px 14px rgba(34,55,99,.08)}
      .light-theme .nte-thumb-tag.proj{background:linear-gradient(180deg,rgba(255,245,223,.98),rgba(255,236,193,.95));color:#7d5417;border-color:rgba(220,173,92,.22)}
      .light-theme .nte-thumb-tag.rare{background:linear-gradient(180deg,#ffffff,#e7eaee);color:#16181c;border-color:rgba(17,24,39,.12)}
      .light-theme .nte-thumb-tag.serial{background:rgba(255,255,255,.95);color:#171a1f;border-color:rgba(17,24,39,.1)}
      .light-theme .nte-item-footer{color:#171a1f}
      .light-theme .nte-item-demand{background:rgba(255,255,255,.96);border-color:rgba(17,24,39,.08);box-shadow:0 1px 2px rgba(15,23,42,.04);color:#171a1f}
      .light-theme .nte-item-demand-dot{background:#8a9099}
      .light-theme .nte-item-demand.demand-amazing{background:rgba(36,117,57,.11);border-color:rgba(68,163,86,.2);color:#1f6b31}
      .light-theme .nte-item-demand.demand-amazing .nte-item-demand-dot{background:#27b34a;box-shadow:none}
      .light-theme .nte-item-demand.demand-high{background:rgba(104,165,72,.12);border-color:rgba(110,178,82,.2);color:#41722e}
      .light-theme .nte-item-demand.demand-high .nte-item-demand-dot{background:#6eb34f}
      .light-theme .nte-item-demand.demand-normal{background:rgba(234,197,60,.16);border-color:rgba(202,165,44,.24);color:#7b5b00}
      .light-theme .nte-item-demand.demand-normal .nte-item-demand-dot{background:#d4a91f}
      .light-theme .nte-item-demand.demand-low{background:rgba(242,124,89,.12);border-color:rgba(224,112,80,.2);color:#b44d2f}
      .light-theme .nte-item-demand.demand-low .nte-item-demand-dot{background:#ea764d}
      .light-theme .nte-item-demand.demand-terrible{color:#b91c1c;background:rgba(220,38,38,.11);border-color:rgba(220,38,38,.18)}
      .light-theme .nte-item-demand.demand-terrible .nte-item-demand-dot{background:#dc2626}
      .light-theme .nte-item-count{background:rgba(255,255,255,.94);border-color:rgba(17,24,39,.1);color:#171a1f;box-shadow:0 4px 12px rgba(34,55,99,.08)}
      .light-theme .nte-modal-footer{opacity:.58}
      .light-theme .nte-modal-footer:hover{opacity:.86}
      .light-theme .nte-discord-link{color:#5f6772}
      .light-theme .nte-discord-link:hover{color:#111827}
      .light-theme .nte-loading-modal{color:#6b7280}
      .light-theme .nte-loading-modal .spinner{border-color:rgba(17,24,39,.12);border-top-color:#4b5563}
      .light-theme .nte-items-container::-webkit-scrollbar-thumb{background:rgba(17,24,39,.16)}
      @media(max-width:640px){.nte-modal-overlay{align-items:flex-start}.nte-modal{width:100%;max-height:calc(100vh - 8px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));max-height:calc(100dvh - 8px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));border-radius:16px}.nte-modal-header{padding:12px 14px 8px;align-items:flex-start}.nte-modal-logo{width:28px;height:28px;border-radius:9px}.nte-modal-title{gap:8px}.nte-modal-title-text{font-size:14px}.nte-modal-discord-sub{display:none}.nte-stats{display:flex;grid-template-columns:none;gap:7px;padding:8px 14px 6px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}.nte-stats::-webkit-scrollbar{display:none}.nte-stat-card{flex:0 0 112px;padding:9px 10px;border-radius:12px;scroll-snap-align:start}.nte-stats .nte-stat-card:last-child{flex-basis:146px}.nte-stats .nte-stat-card:last-child .nte-stat-value{font-size:12px;line-height:1.25;white-space:normal;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.nte-stat-label{font-size:9px;letter-spacing:.05em;margin-bottom:4px}.nte-stat-label.has-logo{gap:5px}.nte-stat-label-logo{width:11px;height:11px}.nte-stat-value{font-size:16px;line-height:1.1}.nte-stat-sub{font-size:10px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nte-controls{padding:8px 14px 10px;flex-direction:column;align-items:stretch;gap:8px}.nte-inv-hash-serial-btn,.nte-search,.nte-sort{width:100%}.nte-inv-hash-serial-btn{min-height:36px;height:36px}.nte-search,.nte-sort{height:36px;font-size:12px}.nte-items-container{padding:4px 14px 14px}.nte-items-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.nte-item-card{padding:8px}.nte-item-thumb{margin-bottom:7px;border-radius:9px}.nte-thumb-tag{font-size:8px;padding:3px 6px}.nte-thumb-tag.rare{width:20px;height:20px}.nte-thumb-tag.rare svg{width:9px;height:9px}.nte-thumb-tag.serial{font-size:8px;padding:3px 6px}.nte-item-name{font-size:11px;min-height:30px;margin-bottom:7px}.nte-item-values{gap:4px}.nte-item-val{padding:6px 7px;border-radius:9px}.nte-item-val span:first-child{font-size:8px}.nte-item-val .v,.nte-item-val .r{font-size:10px}.nte-item-footer{margin-top:6px;min-height:24px}.nte-item-demand{font-size:8.5px;padding:4px 7px}.nte-item-demand-dot{width:5px;height:5px}.nte-item-count{top:5px;right:5px;font-size:8px;padding:3px 6px}.nte-modal-close{width:32px;height:32px;font-size:18px;flex-shrink:0}}
    `;
    document.head.appendChild(style);

    var thumb_cache = {};

    function get_thumb_cache_key(item_type, id) {
      return String(item_type || "Asset") + ":" + String(id);
    }

    async function fetch_thumb_batch(item_type, ids) {
      if (!ids.length) return;

      let endpoint =
        item_type === "Bundle"
          ? "https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds="
          : "https://thumbnails.roblox.com/v1/assets?assetIds=";
      let size = item_type === "Bundle" ? "150x150" : "110x110";

      for (let i = 0; i < ids.length; i += 100) {
        let batch = ids.slice(i, i + 100);
        try {
          let resp = await fetch(endpoint + batch.join(",") + "&size=" + size + "&format=Png&isCircular=false");
          if (!resp.ok) continue;
          (await resp.json()).data.forEach((d) => {
            if (d.state === "Completed" && d.imageUrl) {
              thumb_cache[get_thumb_cache_key(item_type, d.targetId)] = d.imageUrl;
            }
          });
        } catch (e) {}
      }
    }

    async function fetch_thumbs(items) {
      let asset_ids = [];
      let bundle_ids = [];

      for (let item of items) {
        let cache_key = get_thumb_cache_key(item.item_type, item.id);
        if (thumb_cache[cache_key]) continue;
        if (item.item_type === "Bundle") {
          bundle_ids.push(item.id);
        } else {
          asset_ids.push(item.id);
        }
      }

      await Promise.all([fetch_thumb_batch("Asset", asset_ids), fetch_thumb_batch("Bundle", bundle_ids)]);
    }

    function get_demand(val) {
      var map = {
        0: { l: "Terrible", c: "demand-terrible" },
        1: { l: "Low", c: "demand-low" },
        2: { l: "Normal", c: "demand-normal" },
        3: { l: "High", c: "demand-high" },
        4: { l: "Amazing", c: "demand-amazing" },
      };
      return map[val] || null;
    }

    function short_num(n) {
      if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
      if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
      return String(n);
    }

    function fmt(n) {
      return n.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
    }

    function fmt_usd(n) {
      return (
        "$" +
        Number(n || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    }

    function escape_html(value) {
      return String(value ?? "").replace(
        /[&<>"']/g,
        (ch) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[ch],
      );
    }

    function attach_modal_logo(overlay) {
      var el = overlay.querySelector(".nte-modal-logo");
      if (!el) return;
      var url = utils.getURL("assets/icons/logo128.png");
      el.setAttribute("src", url);
      el.setAttribute("alt", "Nevos Trading Extension");
      el.setAttribute("width", "36");
      el.setAttribute("height", "36");
      el.setAttribute("decoding", "async");
    }

    window.__nteShowModal = async function () {
      var data = window.__nteInvData;
      if (!data) return;
      document.getElementById("nte-inv-modal")?.remove();

      var { items, totalValue: total_value, totalRAP: total_rap } = data;


      var overlay = document.createElement("div");
      overlay.id = "nte-inv-modal";
      overlay.className = "nte-modal-overlay";
      overlay.innerHTML =
        '<div class="nte-modal"><div class="nte-modal-header"><div class="nte-modal-title"><img class="nte-modal-logo" alt="" width="36" height="36" decoding="async" /><div class="nte-modal-title-stack"><span class="nte-modal-title-text">Inventory Overview</span><a class="nte-modal-discord-sub" href="https://discord.gg/4XWE7yy2uE" target="_blank" rel="noopener noreferrer">discord.gg/4XWE7yy2uE</a></div></div><button class="nte-modal-close">\u00d7</button></div><div class="nte-loading-modal"><div class="spinner"></div>Nevos Trading Extension is loading inventory details...</div></div>';
      document.body.appendChild(overlay);
      assert_profile_dominance();
      attach_modal_logo(overlay);
      requestAnimationFrame(() => overlay.classList.add("active"));

      function close_modal() {
        overlay.classList.remove("active");
        setTimeout(() => overlay.remove(), 250);
      }
      overlay.querySelector(".nte-modal-close").addEventListener("click", close_modal);
      overlay.addEventListener("click", (ev) => {
        if (ev.target === overlay) close_modal();
      });
      document.addEventListener("keydown", function esc(ev) {
        if (ev.key === "Escape") {
          close_modal();
          document.removeEventListener("keydown", esc);
        }
      });


      var enriched = [],
        seen = {};
      for (let item of items) {
        let is_bundle = item.itemType === "Bundle";
        let rolimons_item = utils.getRolimonsItem(item.assetId, item.name, is_bundle);
        let rolimons_item_id = utils.getRolimonsItemId(item.assetId, item.name, is_bundle);
        if (!rolimons_item_id && !is_bundle) rolimons_item_id = item.assetId;
        let val = 0;
        let rap = 0;

        try {
          val = utils.getValueOrRAP(item.assetId, item.name, item.recentAveragePrice);
        } catch (e) {}
        try {
          rap = item.recentAveragePrice || utils.getRAP(item.assetId, item.name, item.recentAveragePrice);
        } catch (e) {}

        if (seen[item.assetId]) {
          seen[item.assetId].count++;
          seen[item.assetId].total_val += val;
          seen[item.assetId].total_rap += rap;
          if (item.serialNumber && (!seen[item.assetId].serial || item.serialNumber < seen[item.assetId].serial))
            seen[item.assetId].serial = item.serialNumber;
          continue;
        }

        let entry = {
          id: item.assetId,
          rolimons_id: rolimons_item_id,
          item_type: item.itemType || "Asset",
          thumb_key: get_thumb_cache_key(item.itemType || "Asset", item.assetId),
          name: item.name || "Unknown",
          val: val,
          rap: rap,
          proj: rolimons_item && rolimons_item[7] === 1,
          rare: rolimons_item && rolimons_item[9] === 1,
          demand: rolimons_item ? rolimons_item[5] : -1,
          serial: item.serialNumber,
          count: 1,
          total_val: val,
          total_rap: rap,
        };
        seen[item.assetId] = entry;
        enriched.push(entry);
      }


      await fetch_thumbs(enriched);


      var show_routility_usd = !!(await utils.getOption("Show Routility USD Values"));
      var routility_snapshot = typeof utils.getRoutilityData === "function" ? utils.getRoutilityData() : null;
      if (show_routility_usd && !routility_snapshot) {
        routility_snapshot = await new Promise((resolve) => {
          nte_send_message("getRoutilityData", function (data) {
            resolve(data || null);
          });
        });
      }
      function get_entry_routility_usd(entry) {
        let direct = Number(routility_snapshot?.items?.[String(entry.id)]?.usd || 0);
        if (direct > 0) return direct;
        let fallback = Number(routility_snapshot?.items?.[String(entry.rolimons_id)]?.usd || 0);
        if (fallback > 0) return fallback;
        if (typeof utils.getUSD === "function") {
          direct = Number(utils.getUSD(entry.id) || 0);
          if (direct > 0) return direct;
          fallback = Number(utils.getUSD(entry.rolimons_id) || 0);
          if (fallback > 0) return fallback;
        }
        return 0;
      }
      var unique_count = enriched.length;
      var total_count = items.length;
      var top_item = enriched.length > 0 ? [...enriched].sort((a, b) => b.val - a.val)[0] : null;
      var rare_count = enriched.filter((i) => i.rare).length;
      var proj_count = enriched.filter((i) => i.proj).length;
      var worth_source_total = total_value > 0 ? total_value : total_rap;
      var routility_total_usd = 0;
      var routility_priced_count = 0;
      for (let entry of enriched) {
        let usd = show_routility_usd ? get_entry_routility_usd(entry) : 0;
        entry.usd = usd;
        entry.total_usd = usd * entry.count;
        if (usd > 0) {
          routility_total_usd += entry.total_usd;
          routility_priced_count += entry.count;
        }
      }
      var estimated_usd_worth = show_routility_usd ? routility_total_usd : (worth_source_total / 1000) * 3;
      var estimated_usd_card_class = show_routility_usd ? "nte-stat-card routility-usd-card" : "nte-stat-card usd-card";
      var estimated_usd_label_html = show_routility_usd
        ? '<div class="nte-stat-label has-logo"><img class="nte-stat-label-logo" src="' +
          escape_html(utils.getURL("assets/routility.png")) +
          '" alt="" decoding="async" />Routility Worth</div>'
        : '<div class="nte-stat-label">Estimated Worth</div>';
      var estimated_usd_sub = show_routility_usd
        ? routility_priced_count
          ? `Based on Routility.io\n${fmt(routility_priced_count)}/${fmt(total_count)} copies priced`
          : "Routility.io values unavailable"
        : "Based on $3.00 / 1k";
      var estimated_usd_sub_html = escape_html(estimated_usd_sub).replace(/\n/g, "<br>");


      var modal = overlay.querySelector(".nte-modal");
      modal.innerHTML =
        '<div class="nte-modal-header"><div class="nte-modal-title"><img class="nte-modal-logo" alt="" width="36" height="36" decoding="async" /><div class="nte-modal-title-stack"><span class="nte-modal-title-text">Inventory Overview</span><a class="nte-modal-discord-sub" href="https://discord.gg/4XWE7yy2uE" target="_blank" rel="noopener noreferrer">discord.gg/4XWE7yy2uE</a></div></div><button class="nte-modal-close">\u00d7</button></div>' +
        '<div class="nte-stats">' +
        '<div class="' + estimated_usd_card_class + '">' + estimated_usd_label_html + '<div class="nte-stat-value usd-color">' +
        fmt_usd(estimated_usd_worth) +
        '</div><div class="nte-stat-sub">' +
        estimated_usd_sub_html +
        "</div></div>" +
        '<div class="nte-stat-card"><div class="nte-stat-label">Total Value</div><div class="nte-stat-value val-color">' +
        short_num(total_value) +
        '</div><div class="nte-stat-sub">' +
        fmt(total_value) +
        " exact</div></div>" +
        '<div class="nte-stat-card"><div class="nte-stat-label">Total RAP</div><div class="nte-stat-value rap-color">' +
        short_num(total_rap) +
        '</div><div class="nte-stat-sub">' +
        fmt(total_rap) +
        " exact</div></div>" +
        '<div class="nte-stat-card"><div class="nte-stat-label">Items</div><div class="nte-stat-value">' +
        fmt(total_count) +
        '</div><div class="nte-stat-sub">' +
        fmt(unique_count) +
        " unique" +
        (rare_count > 0 ? " / " + rare_count + " rare" : "") +
        (proj_count > 0 ? " / " + proj_count + " proj" : "") +
        "</div></div>" +
        '<div class="nte-stat-card"><div class="nte-stat-label">Best Item</div><div class="nte-stat-value" style="font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
        escape_html(top_item ? top_item.name : "N/A") +
        '</div><div class="nte-stat-sub">' +
        (top_item ? fmt(top_item.val) + " value" : "") +
        "</div></div>" +
        "</div>" +
        '<div class="nte-controls"><input type="text" class="nte-search" placeholder="Search items by name..."><select class="nte-sort"><option value="val-d">Value: High to Low</option><option value="rap-d">RAP: High to Low</option><option value="val-a">Value: Low to High</option><option value="name-a">Name: A to Z</option><option value="count-d">Quantity: Most</option></select></div>' +
        '<div class="nte-items-container"><div class="nte-items-grid"></div><div class="nte-modal-footer"><a href="https://discord.gg/4XWE7yy2uE" target="_blank" class="nte-discord-link"><svg width="14" height="11" viewBox="0 0 71 55" fill="currentColor"><path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.6 4.9a.2.2 0 00-.1.1C1.5 18.7-.9 32.2.3 45.5v.2a58.7 58.7 0 0017.7 9 .2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.6 38.6 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.8 41.8 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4c-1.8 1-3.6 1.8-5.5 2.6a.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1 58.5 58.5 0 0017.7-9 .2.2 0 00.1-.2c1.4-15.1-2.4-28.2-10-39.8a.2.2 0 00-.1-.1zM23.7 37.3c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7zm23.3 0c-3.4 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.1 6.3 7-2.8 7-6.3 7z"/></svg> Join our Discord</a></div></div>';

      attach_modal_logo(overlay);

      overlay.querySelector(".nte-modal-close").addEventListener("click", close_modal);

      var inv_serial_blur_on = false;
      var ctrl_row = overlay.querySelector(".nte-controls");
      if (ctrl_row && !ctrl_row.querySelector(".nte-inv-hash-serial-btn")) {
        var inv_hash_btn = document.createElement("button");
        inv_hash_btn.type = "button";
        inv_hash_btn.className = "nte-inv-hash-serial-btn";
        inv_hash_btn.textContent = "#";
        inv_hash_btn.setAttribute("aria-label", "Blur serial numbers in this list");
        inv_hash_btn.title = "Blur serial numbers";
        inv_hash_btn.addEventListener("click", function () {
          inv_serial_blur_on = !inv_serial_blur_on;
          overlay.classList.toggle("nte-inv-blur-serials", inv_serial_blur_on);
          inv_hash_btn.classList.toggle("nte-inv-hash-serial-active", inv_serial_blur_on);
          inv_hash_btn.setAttribute("aria-pressed", inv_serial_blur_on ? "true" : "false");
          inv_hash_btn.title = inv_serial_blur_on ? "Show serial numbers" : "Blur serial numbers";
        });
        ctrl_row.insertBefore(inv_hash_btn, ctrl_row.firstChild);
      }

      function render_items(sort_key, query) {
        var filtered = enriched;
        if (query) {
          var q = query.toLowerCase();
          filtered = enriched.filter((i) => i.name.toLowerCase().includes(q));
        }
        var sorted = [...filtered];
        switch (sort_key) {
          case "val-d":
            sorted.sort((a, b) => b.val - a.val);
            break;
          case "rap-d":
            sorted.sort((a, b) => b.rap - a.rap);
            break;
          case "val-a":
            sorted.sort((a, b) => a.val - b.val);
            break;
          case "name-a":
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
          case "count-d":
            sorted.sort((a, b) => b.count - a.count);
            break;
        }

        var grid = overlay.querySelector(".nte-items-grid");
        if (sorted.length === 0) {
          grid.innerHTML = '<div class="nte-no-items">No items match your search</div>';
          return;
        }

        grid.innerHTML = sorted
          .map((item) => {
            var thumb = thumb_cache[item.thumb_key] || "";
            var dm = get_demand(item.demand);
            var demand_html = dm
              ? '<div class="nte-item-footer"><span class="nte-item-demand ' +
                dm.c +
                '"><span class="nte-item-demand-dot"></span><span>' +
                dm.l +
                "</span></span></div>"
              : "";
            var count_badge = item.count > 1 ? '<div class="nte-item-count">x' + item.count + "</div>" : "";
            var dv = item.count > 1 ? item.total_val : item.val;
            var dr = item.count > 1 ? item.total_rap : item.rap;
            var safe_name = escape_html(item.name);
            var serial_tag = item.serial
              ? '<div class="nte-thumb-tag serial"><span class="nte-inv-serial">#' + fmt(item.serial) + "</span></div>"
              : "";
            var proj_tag = item.proj ? '<div class="nte-thumb-tag proj">Projected</div>' : "";
            var rare_tag = item.rare
              ? '<div class="nte-thumb-tag rare" aria-label="Rare"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 14 8 8 14 2 8 8 2Z" fill="currentColor"></path></svg></div>'
              : "";
            var card_class =
              "nte-item-card" + (item.rare ? " is-rare" : "") + (item.proj ? " is-proj" : "");
            var item_url = item.rolimons_id
              ? "https://www.rolimons.com/item/" + item.rolimons_id
              : item.item_type === "Bundle"
                ? "https://www.roblox.com/bundles/" + item.id
                : "https://www.roblox.com/catalog/" + item.id;

            return (
              '<a class="' +
              card_class +
              '" href="' +
              item_url +
              '" target="_blank" rel="noopener noreferrer" title="' +
              safe_name +
              (item.count > 1 ? " (x" + item.count + ")" : "") +
              '">' +
              '<div class="nte-item-thumb">' +
              (thumb ? '<img src="' + thumb + '" loading="lazy" alt="' + safe_name + '">' : "") +
              count_badge +
              proj_tag +
              rare_tag +
              serial_tag +
              "</div>" +
              '<div class="nte-item-name">' +
              safe_name +
              "</div>" +
              '<div class="nte-item-values">' +
              '<div class="nte-item-val"><span>Value</span><span class="v">' +
              fmt(dv) +
              "</span></div>" +
              '<div class="nte-item-val"><span>RAP</span><span class="r">' +
              fmt(dr) +
              "</span></div>" +
              "</div>" +
              demand_html +
              "</a>"
            );
          })
          .join("");
      }

      render_items("val-d", "");
      var search_el = overlay.querySelector(".nte-search");
      var sort_el = overlay.querySelector(".nte-sort");
      search_el.addEventListener("input", () => render_items(sort_el.value, search_el.value));
      sort_el.addEventListener("change", () => render_items(sort_el.value, search_el.value));
    };
  })();
  try {
    let keepalive_port = chrome.runtime.connect({ name: "nte-keepalive" });
    setInterval(() => {
      try {
        keepalive_port.postMessage({ type: "ping" });
      } catch {
        try {
          keepalive_port = chrome.runtime.connect({ name: "nte-keepalive" });
        } catch {}
      }
    }, 25000);
  } catch {}
})();
