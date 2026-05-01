(() => {
  function nte_send_message(msg, callback) {
    let done = false;
    let finish = function (value) {
      if (done) return;
      done = true;
      callback(value);
    };
    try {
      let result = chrome.runtime.sendMessage(msg, function (response) {
        finish(response);
      });
      if (result && typeof result.then === "function") {
        result.then(
          function (r) {
            finish(r);
          },
          function () {
            finish(undefined);
          },
        );
      }
    } catch (e) {
      finish(undefined);
    }
  }
  const TRADE_API_RATE_LIMIT_BUFFER = 10;
  const TRADE_API_RATE_LIMIT_RESET_PAD_MS = 1000;
  const TRADE_API_RATE_LIMIT_DEFAULT_PAUSE_MS = 60000;
  const TRADE_API_RATE_LIMIT_RESUME_KEY = "tradeApiRateLimitResumeAt";
  const TRADE_API_FETCH_TIMEOUT_MS = 15000;
  let trade_api_rate_limit_resume_at = 0;
  let trade_api_rate_limit_queue = Promise.resolve();

  function trade_api_delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function fetch_trade_api_with_timeout(url, init) {
    if (typeof AbortController === "undefined") return fetch(url, init);
    let controller = new AbortController();
    let timeout_id = setTimeout(() => controller.abort(), TRADE_API_FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, { ...(init || {}), signal: controller.signal });
    } finally {
      clearTimeout(timeout_id);
    }
  }

  function get_shared_trade_api_resume_at() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([TRADE_API_RATE_LIMIT_RESUME_KEY], (result) => {
          let value = Number(result?.[TRADE_API_RATE_LIMIT_RESUME_KEY]) || 0;
          resolve(Number.isFinite(value) ? value : 0);
        });
      } catch {
        resolve(0);
      }
    });
  }

  function set_shared_trade_api_resume_at(value) {
    try {
      chrome.storage.local.set({ [TRADE_API_RATE_LIMIT_RESUME_KEY]: value }, () => {});
    } catch {}
  }

  const TRADE_API_WINDOW_MS = 60000;
  const TRADE_API_WINDOW_LIMIT = 40;
  const TRADE_API_TIMES_KEY = "tradeApiRequestTimes";
  let trade_api_request_times = [];

  function prune_trade_api_times(now) {
    let cutoff = now - TRADE_API_WINDOW_MS;
    while (trade_api_request_times.length && trade_api_request_times[0] < cutoff) {
      trade_api_request_times.shift();
    }
  }

  function get_shared_trade_api_times() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([TRADE_API_TIMES_KEY], (result) => {
          let value = result?.[TRADE_API_TIMES_KEY];
          resolve(Array.isArray(value) ? value.filter(Number.isFinite) : []);
        });
      } catch { resolve([]); }
    });
  }

  function set_shared_trade_api_times(times) {
    try { chrome.storage.local.set({ [TRADE_API_TIMES_KEY]: times }, () => {}); } catch {}
  }

  function parse_trade_api_header_number(response, name) {
    let value = response?.headers?.get?.(name);
    if (value === null || value === undefined || value === "") return null;
    let parsed = Number.parseFloat(String(value).split(",")[0].trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  function get_trade_api_reset_delay_ms(response) {
    let reset = parse_trade_api_header_number(response, "x-ratelimit-reset");
    if (reset === null) reset = parse_trade_api_header_number(response, "retry-after");
    if (reset === null) return TRADE_API_RATE_LIMIT_DEFAULT_PAUSE_MS;
    if (reset > 1000000000) return Math.max(0, reset * 1000 - Date.now()) + TRADE_API_RATE_LIMIT_RESET_PAD_MS;
    return Math.max(0, reset * 1000) + TRADE_API_RATE_LIMIT_RESET_PAD_MS;
  }

  function update_trade_api_rate_limit(response) {
    let pause = response?.status === 429;
    let remaining = parse_trade_api_header_number(response, "x-ratelimit-remaining");
    if (remaining !== null && remaining <= TRADE_API_RATE_LIMIT_BUFFER) pause = true;
    if (!pause) return;

    trade_api_rate_limit_resume_at = Math.max(
      trade_api_rate_limit_resume_at,
      Date.now() + get_trade_api_reset_delay_ms(response),
    );
    set_shared_trade_api_resume_at(trade_api_rate_limit_resume_at);
  }

  async function fetch_trade_api(url, init) {
    let run = trade_api_rate_limit_queue.then(async () => {
      trade_api_rate_limit_resume_at = Math.max(trade_api_rate_limit_resume_at, await get_shared_trade_api_resume_at());
      let wait_ms = trade_api_rate_limit_resume_at - Date.now();
      if (wait_ms > 0) await trade_api_delay(wait_ms);

      let shared = await get_shared_trade_api_times();
      let now = Date.now();
      let merged = trade_api_request_times.concat(shared);
      let seen = new Set();
      trade_api_request_times = merged.filter(t => !seen.has(t) && seen.add(t)).sort((a, b) => a - b);
      prune_trade_api_times(now);
      if (trade_api_request_times.length >= TRADE_API_WINDOW_LIMIT) {
        let oldest = trade_api_request_times[0];
        let window_wait = oldest + TRADE_API_WINDOW_MS + TRADE_API_RATE_LIMIT_RESET_PAD_MS - now;
        if (window_wait > 0) await trade_api_delay(window_wait);
        prune_trade_api_times(Date.now());
      }

      trade_api_request_times.push(Date.now());
      prune_trade_api_times(Date.now());
      set_shared_trade_api_times(trade_api_request_times.slice(-TRADE_API_WINDOW_LIMIT * 2));

      let response = await fetch_trade_api_with_timeout(url, init);
      update_trade_api_rate_limit(response);
      return response;
    });
    trade_api_rate_limit_queue = run.catch(() => {});
    return run;
  }
  let e, t;
  function r(e, t, r, n) {
    Object.defineProperty(e, t, {
      get: r,
      set: n,
      enumerable: !0,
      configurable: !0,
    });
  }
  var n,
    a,
    o = globalThis,
    i = {},
    l = {},
    s = o.parcelRequire94c2;
  null == s &&
    (((s = function (e) {
      if (e in i) return i[e].exports;
      if (e in l) {
        var t = l[e];
        delete l[e];
        var r = { id: e, exports: {} };
        return (i[e] = r), t.call(r.exports, r, r.exports), r.exports;
      }
      var n = Error("Cannot find module '" + e + "'");
      throw ((n.code = "MODULE_NOT_FOUND"), n);
    }).register = function (e, t) {
      l[e] = t;
    }),
    (o.parcelRequire94c2 = s));
  var d = s.register;
  d("eFyFE", function (e, t) {
    let n, q, rt;
    function a() {
      return n;
    }
    function get_routility_data() {
      return rt;
    }
    function get_usd(e) {
      let t = rt?.items?.[String(e)];
      return t && "number" == typeof t.usd ? t.usd : 0;
    }
    function o(e) {
      if (window.__NTE_ICONS && window.__NTE_ICONS[e]) {
        let d = window.__NTE_ICONS[e];
        if (window.__NTE_resolveInlineIcon) d = window.__NTE_resolveInlineIcon(e, d);
        return d;
      }
      return chrome.runtime.getURL(e);
    }
    function i(e, t) {
      return new Promise((r) => {
        let n = document;
        function a() {
          let t = n.querySelector(e);
          t && (r(t), o.disconnect());
        }
        void 0 !== t && (n = t);
        let o = new MutationObserver(a);
        o.observe(void 0 === t ? document.body : n, {
          childList: !0,
          subtree: !0,
        }),
          a();
      });
    }
    function l(e, t, r) {
      for (var n = e.length, a = -1; r-- && a++ < n && !((a = e.indexOf(t, a)) < 0); );
      return a;
    }
    function d(e) {
      return e.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
    }
    function c(e) {
      return new Promise((t) => {
        chrome.storage.local.get([e], function (r) {
          chrome.runtime.lastError && console.info(chrome.runtime.lastError), t(r[e]);
        });
      });
    }
    function u() {
      let e = document.querySelector('[ng-show="layout.view === tradesConstants.views.tradeRequest"]');
      if (e) return e.classList.contains("ng-hide") ? "details" : "sendOrCounter";
      let t = location.pathname || "";
      if (document.querySelector(".trades-container") || /\/trades(\/|$|\?)/i.test(t) || /\/users\/\d+\/trade/i.test(t)) {
        let e = document.querySelector(".trade-request-window");
        return e && !e.classList.contains("ng-hide") ? "sendOrCounter" : "details";
      }
      return document.querySelector(".results-container")
        ? "catalog"
        : document.querySelector("[data-internal-page-name]")?.getAttribute("data-internal-page-name") === "CatalogItem"
          ? "itemProfile"
          : document.querySelector("[data-profileuserid]")
            ? "userProfile"
            : document.querySelector('meta[data-internal-page-name="Inventory"]')
              ? "userInventory"
              : void 0;
    }
    function is_unsupported_bundle(e, t) {
      let r = M(t);
      return "signature kicks" === r || "the jade catseye" === r;
    }
    function get_unsupported_bundle_value(e, t, r) {
      if (!is_unsupported_bundle(e, t)) return null;
      let n = parseInt(r, 10);
      return isNaN(n) ? 0 : n;
    }
    function m(e, t, r) {
      let n = D(e, t);
      if (Array.isArray(n) && "number" == typeof n[4]) return n[4];
      let a = get_unsupported_bundle_value(e, t, r);
      return null !== a ? a : 0;
    }
    function p(e, t, r) {
      let n = D(e, t);
      if (Array.isArray(n) && "number" == typeof n[2]) return n[2];
      let a = get_unsupported_bundle_value(e, t, r);
      return null !== a ? a : 0;
    }
    function f(e) {
      return e ? chrome.runtime.getManifest().name : chrome.runtime.getManifest().short_name;
    }
    function g() {
      return document.getElementById("rbx-body").classList.contains("light-theme") ? "light" : "dark";
    }
    async function y(e) {
      let t;
      let r = !1,
        n = [];
      for (; !r; ) {
        let a = `https://inventory.roblox.com/v1/users/${e}/assets/collectibles?sortOrder=Desc&limit=100${t ? "&cursor=" + t : ""}`,
          o = await fetch(a, { credentials: "include" });
        if (200 !== o.status) return !1;
        {
          let e = await o.json();
          (n = n.concat(e.data)), null === (t = e.nextPageCursor) && (r = !0);
        }
      }
      return n;
    }
    async function h() {
      return parseInt(document.querySelector('meta[name="user-data"]').getAttribute("data-userid"));
    }
    function v(e, t) {
      e.setAttribute("data-toggle", "tooltip"), e.setAttribute("title", t);
    }
    function x(e) {
      for (let element of document.querySelectorAll(`.${e}`)) element.removeAttribute("data-toggle"), element.removeAttribute("data-original-title");
    }
    function b() {
      if (document.getElementById("nruInitTooltipsScript")) document.dispatchEvent(new CustomEvent("nru_init_tooltips"));
      else {
        let e = document.createElement("script");
        (e.id = "nruInitTooltipsScript"),
          (e.src = o("scripts/init_tooltips.js")),
          (e.onload = function () {
            document.dispatchEvent(new CustomEvent("nru_init_tooltips"));
          }),
          (document.head || document.documentElement).appendChild(e);
      }
    }
    function destroy_tooltips(root) {
      if (!(root instanceof Element)) return;
      let token = `nte${Date.now()}${Math.random().toString(36).slice(2)}`;
      root.setAttribute("data-nte-tooltip-cleanup", token);
      document.dispatchEvent(
        new CustomEvent("nru_destroy_tooltips", {
          detail: `[data-nte-tooltip-cleanup="${token}"],[data-nte-tooltip-cleanup="${token}"] [data-toggle="tooltip"]`,
        }),
      );
      root.removeAttribute("data-nte-tooltip-cleanup");
    }
    function w(e) {
      return (
        -1 !==
        [
          8, 17, 18, 19, 27, 28, 29, 30, 31, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 61, 64, 65, 66, 67, 68, 69, 70, 71, 72,
          76, 77, 78, 79,
        ].indexOf(e)
      );
    }
    function E(e) {
      return e
        .split("/")
        .filter((e) => 2 !== e.length)
        .join("/");
    }
    function M(e) {
      return String(e || "")
        .toLowerCase()
        .replace(/[#,()\-:'`"]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
    function O(e) {
      if (!e) return null;
      let t = String(e).match(/\/catalog\/(\d+)/);
      return t ? parseInt(t[1], 10) : null;
    }
    function I(e) {
      if (!(e instanceof Element)) return null;
      let t = ["data-asset-id", "data-assetid", "data-item-id", "data-itemid", "data-id", "data-target-id", "thumbnail-target-id"],
        r = [
          e,
          ...e.querySelectorAll(
            "[data-asset-id], [data-assetid], [data-item-id], [data-itemid], [data-id], [data-target-id], [thumbnail-target-id], .thumbnail-2d-container",
          ),
        ];
      for (let e of r)
        for (let r of t) {
          let t = e.getAttribute?.(r);
          if (t && /\d+/.test(t)) return parseInt(t.match(/\d+/)[0], 10);
        }
      let n = e.querySelector('a[href*="/catalog/"]');
      let a = n ? O(n.getAttribute("href") || n.pathname) : null;
      return a || get_trade_el_value_ctx(e).targetId;
    }
    function R(e) {
      if (!(e instanceof Element)) return null;
      let t = e.querySelector(".item-card-name, .item-card-name-link, .text-overflow, .text-name, h3, h4"),
        r = t?.textContent?.trim();
      if (r) return r;
      let n = e.querySelector("img[alt]");
      return n?.getAttribute("alt")?.trim() || get_trade_el_value_ctx(e).name;
    }
    function extract_displayed_rap(e) {
      if (!(e instanceof Element)) return 0;
      let t = e.cloneNode(!0);
      for (let e of t.querySelectorAll(".valueSpan, .icon-rolimons, .icon-link, br")) e.remove();
      let r = (t.textContent || "").match(/\d[\d,]*/);
      if (r) return parseInt(r[0].replace(/,/g, ""), 10) || 0;
      return get_trade_el_value_ctx(e.closest?.(".trade-request-item, .item-card-container") || e).rap || 0;
    }
    function D(e, t) {
      let r = n?.items?.[e];
      if (r) return r;
      if (!t) return null;
      q || (q = {});
      if (!q.__ready) {
        for (let [e, t] of Object.entries(n?.items || {})) {
          if (!Array.isArray(t) || "string" != typeof t[0]) continue;
          let r = M(t[0]);
          r && void 0 === q[r] && (q[r] = { id: parseInt(e, 10), item: t });
        }
        q.__ready = !0;
      }
      return q[M(t)]?.item || null;
    }
    function P(e, t, r) {
      if (!r && n?.items?.[e]) return e;
      if (!t) return null;
      D(e, t);
      return q?.[M(t)]?.id ?? null;
    }
    async function S(e, t) {
      await i(".item-card-container");
      let r = e.querySelectorAll(".item-card-container");
      await i(".item-card-price");
      let n = 0;
      for (let item of r) {
        let e = I(item),
          t = R(item),
          r = extract_displayed_rap(item.querySelector(".item-card-price"));
        n += m(e, t, r);
      }
      let a = n,
        o_el = e.querySelector(".text-label.robux-line-value"),
        o_text = (o_el?.innerText || o_el?.textContent || "").replace(/,/g, ""),
        o = Math.round((parseInt(o_text, 10) || 0) / 0.7);
      return ((n += o), t) ? [a, o] : n;
    }
    async function k(e, t) {
      await i('[ng-repeat="slot in offer.slots"]', e);
      let r = e.querySelectorAll('[ng-repeat="slot in offer.slots"]'),
        n = 0;
      for (let item of r) {
        let e = I(item),
          t = R(item),
          r = extract_displayed_rap(item.querySelector(".item-card-price, .item-value"));
        n += m(e, t, r);
      }
      let a = n,
        o = e.querySelector('[name="robux"]'),
        l = parseInt(o?.value, 10) || 0;
      return (o?.parentElement?.classList.contains("form-has-error") && (l = 0), (n += l), t) ? [a, l] : n;
    }
    function apply_total_trade_difference(items_total, robux_total, use_post_tax = !1) {
      let item_value = parseInt(items_total, 10) || 0,
        robux_value = parseInt(robux_total, 10) || 0;
      return item_value + (use_post_tax ? Math.round(0.7 * robux_value) : robux_value);
    }
    function apply_trade_difference_total(items_total, robux_total, use_post_tax = !1) {
      return apply_total_trade_difference(items_total, robux_total, use_post_tax);
    }
    function T(e, t) {
      function r(e, t) {
        let r = t.querySelector(".icon-link");
        r ? t.insertBefore(e, r.parentElement) : t.appendChild(e);
      }
      (e.style.height = "44px"), t?.inline || r(document.createElement("br"), e);
      let n = document.createElement("span");
      (n.className = "icon icon-rolimons"),
        (n.style.backgroundImage = `url(${JSON.stringify(o("assets/rolimons.png"))})`),
        (n.style.display = "inline-block"),
        (n.style.backgroundSize = "cover"),
        (n.style.width = t?.large ? "21px" : "19px"),
        (n.style.height = n.style.width),
        (n.style.marginTop = t?.inline ? "-4px" : "0px"),
        (n.style.marginRight = t?.inline ? "3px" : "6px"),
        (n.style.marginLeft = t?.inline ? "5px" : "0px"),
        (n.style.verticalAlign = t?.inline && "middle"),
        (n.style.transform = t?.large ? "translateY(4px)" : "translateY(2px)"),
        (n.style.backgroundColor = "transparent"),
        r(n, e);
      let a = document.createElement("span");
      (a.className = `valueSpan ${t?.large ? "text-robux-lg" : "text-robux"}`), (a.innerHTML = ""), r(a, e);
    }
    let username_id_cache = {},
      username_id_pending = {};
    const username_id_cache_prefix = "nte_username_lookup:",
      username_id_hit_ttl_ms = 6 * 60 * 60 * 1000,
      username_id_miss_ttl_ms = 5 * 60 * 1000,
      username_id_pending_ttl_ms = 60 * 1000;
    function get_username_id_cache(key) {
      let now = Date.now(),
        cached = username_id_cache[key];
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
    async function C(e) {
      let username = String(e || "").trim(),
        key = username.toLowerCase();
      if (!key) return null;
      let cached = get_username_id_cache(key);
      if (cached !== undefined) return cached;
      if (username_id_pending[key]) return username_id_pending[key];
      return (username_id_pending[key] = (async () => {
        set_username_id_cache(key, null, username_id_pending_ttl_ms);
        try {
          let t = await fetch("https://users.roblox.com/v1/usernames/users", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ usernames: [username], excludeBannedUsers: !1 }),
          });
          if (!t.ok) return set_username_id_cache(key, null, username_id_miss_ttl_ms);
          let id = ((await t.json()).data || [])[0]?.id || null;
          return set_username_id_cache(key, id, id ? username_id_hit_ttl_ms : username_id_miss_ttl_ms);
        } catch {
          return set_username_id_cache(key, null, username_id_miss_ttl_ms);
        } finally {
          delete username_id_pending[key];
        }
      })());
    }
    r(
      e.exports,
      "refreshData",
      () =>
        function e(t) {
          let r = "getData";
          void 0 !== n && (r = "getDataPeriodic");
          let rm = void 0 !== rt ? "getRoutilityDataPeriodic" : "getRoutilityData";
          nte_send_message(rm, function (d) {
            if (d) rt = d;
          });
          nte_send_message(r, function (r) {
            (q = void 0), (n = r) && t(), setTimeout(() => e(t), 6e4);
          });
        },
    ),
      r(e.exports, "getRolimonsData", () => a),
      r(e.exports, "getURL", () => o),
      r(e.exports, "waitForElm", () => i),
      r(e.exports, "nthIndex", () => l),
      r(e.exports, "commafy", () => d),
      r(e.exports, "getOption", () => c),
      r(e.exports, "getPageType", () => u),
      r(e.exports, "getValueOrRAP", () => m),
      r(e.exports, "getRAP", () => p),
      r(e.exports, "getUSD", () => get_usd),
      r(e.exports, "getRoutilityData", () => get_routility_data),
      r(e.exports, "getExtensionTitle", () => f),
      r(e.exports, "getColorMode", () => g),
      r(e.exports, "getUserInventory", () => y),
      r(e.exports, "getAuthenticatedUserId", () => h),
      r(e.exports, "addTooltip", () => v),
      r(e.exports, "removeTooltipsFromClass", () => x),
      r(e.exports, "initTooltips", () => b),
      r(e.exports, "destroyTooltips", () => destroy_tooltips),
      r(e.exports, "checkIfAssetTypeIsOnRolimons", () => w),
      r(e.exports, "removeTwoLetterPath", () => E),
      r(e.exports, "getItemIdFromElement", () => I),
      r(e.exports, "getItemNameFromElement", () => R),
      r(e.exports, "resolveRolimonsItemId", () => P),
      r(e.exports, "isUnsupportedBundle", () => is_unsupported_bundle),
      r(e.exports, "apply_total_trade_difference", () => apply_total_trade_difference),
      r(e.exports, "apply_trade_difference_total", () => apply_trade_difference_total),
      r(e.exports, "calculateValueTotalDetails", () => S),
      r(e.exports, "calculateValueTotalSendOrCounter", () => k),
      r(e.exports, "createValuesSpans", () => T),
      r(e.exports, "fetchIDFromName", () => C),
      s("8kQ1K");
  }),
    d("8kQ1K", function (e, t) {
      e.exports = JSON.parse(
        '["Values",{"name":"Values on Trading Window","enabledByDefault":true,"path":"values-on-trading-window"},{"name":"Values on Trade Lists","enabledByDefault":true,"path":"values-on-trade-lists"},{"name":"Values on Catalog Pages","enabledByDefault":true,"path":"values-on-catalog-pages"},{"name":"Values on User Pages","enabledByDefault":true,"path":"values-on-user-pages"},{"name":"Show Routility USD Values","enabledByDefault":false,"path":"show-usd-values"},"Trading",{"name":"Trade Win/Loss Stats","enabledByDefault":true,"path":"trade-win-loss-stats"},{"name":"Colorblind Mode","enabledByDefault":false,"path":"colorblind-profit-mode"},{"name":"Trade Window Search","enabledByDefault":true,"path":"trade-window-search"},{"name":"Show Quick Decline Button","enabledByDefault":true,"path":"show-quick-decline-button"},{"name":"Analyze Trade","enabledByDefault":true,"path":"analyze-trade"},"Trade Notifications",{"name":"Inbound Trade Notifications","enabledByDefault":false,"path":"inbound-trade-notifications"},{"name":"Declined Trade Notifications","enabledByDefault":false,"path":"declined-trade-notifications"},{"name":"Completed Trade Notifications","enabledByDefault":false,"path":"completed-trade-notifications"},"Item Flags",{"name":"Flag Rare Items","enabledByDefault":true,"path":"flag-rare-items"},{"name":"Flag Projected Items","enabledByDefault":true,"path":"flag-projected-items"},"Links",{"name":"Add Item Profile Links","enabledByDefault":true,"path":"add-item-profile-links"},{"name":"Add Item Ownership History (UAID) Links","enabledByDefault":true,"path":"add-uaid-links"},{"name":"Add User Profile Links","enabledByDefault":true,"path":"add-user-profile-links"},"Other",{"name":"Show User RoliBadges","enabledByDefault":true,"path":"show-user-roli-badges"},{"name":"Post-Tax Trade Values","enabledByDefault":true,"path":"post-tax-trade-values"},{"name":"Mobile Trade Items Button","enabledByDefault":true,"path":"mobile-trade-items-button"},{"name":"Disable Win/Loss Stats RAP","enabledByDefault":false,"path":"disable-win-loss-stats-rap"}]',
      );
    }),
    d("92Pqq", function (e, t) {
      let n;
      r(e.exports, "default", () => u);
      var a = s("eFyFE");
      async function o() {
        if (!(await a.getOption("Add Item Profile Links")))
          return void (document.querySelectorAll(".icon-link").forEach((e) => {
            e.parentElement.remove();
          }),
          document.querySelectorAll(".hasAssetLink").forEach((e) => {
            e.classList.remove("hasAssetLink");
          }));
        "itemProfile" === a.getPageType() && i(), -1 !== ["details", "sendOrCounter", "catalog", "userInventory"].indexOf(a.getPageType()) && c();
      }
      async function i() {
        await a.waitForElm(".item-name-container");
        let e = document.querySelector(".item-name-container").getElementsByTagName("h1")[0];
        if (null === e.querySelector(".icon-link")) {
          e.style.overflow = "visible";
          let t = document.getElementById("asset-resale-data-container"),
            r = window.location.pathname.match(/\/catalog\/(\d+)\//)?.[1],
            n = parseInt(t.getAttribute("data-asset-type"));
          if (a.checkIfAssetTypeIsOnRolimons(n)) {
            let t = document.createElement("a");
            (t.href = `https://www.rolimons.com/item/${r}`),
              (t.target = "_blank"),
              (t.style.display = "inline-block"),
              (t.style.width = "28px"),
              (t.style.height = "28px"),
              (t.style.transform = "translateY(4px)"),
              a.addTooltip(t, "Open item data page");
            let n = document.createElement("span"),
              o = "dark" === a.getColorMode() ? "rolimonsLink.svg" : "rolimonsLinkDark.svg";
            (n.style.backgroundImage = `url(${JSON.stringify(a.getURL(`assets/${o}`))})`),
              (n.className = "icon icon-link"),
              (n.style.display = "inline-block"),
              (n.style.backgroundSize = "cover"),
              (n.style.width = "30px"),
              (n.style.height = "30px"),
              (n.style.cursor = "pointer"),
              (n.style.transition = "filter 0.2s"),
              (n.style.backgroundColor = "transparent"),
              (n.style.marginLeft = "4px"),
              (n.onmouseover = () => {
                n.style.filter = "brightness(50%)";
              }),
              (n.onmouseout = () => {
                n.style.filter = "";
              }),
              t.appendChild(n),
              e.appendChild(t),
              a.initTooltips();
          }
        }
      }
      let l = {},
        d = !1;
      function is_roblox_bundle_card(e) {
        return !!(e && (e.querySelector('a[href*="/bundles/"]') || e.querySelector('[thumbnail-type="BundleThumbnail"]')));
      }
      function f(e) {
        if (!e) return null;
        return (
          e.querySelector(".item-card-thumb-container") ||
          e.querySelector(".item-card-link") ||
          e.querySelector("thumbnail-2d") ||
          e.querySelector(".thumbnail-2d-container") ||
          e.querySelector(".item-card-thumb")
        );
      }
      function y(e) {
        if (!e?.querySelectorAll) return false;
        for (let t of e.querySelectorAll('a[href*="rolimons.com/"]')) {
          if (t.classList?.contains("nte-rolimons-thumb-link") || t.classList?.contains("nte-uaid-thumb-link")) continue;
          return true;
        }
        return false;
      }
      function remove_our_rolimons_links(e, t = null) {
        if (!e?.querySelectorAll) return;
        for (let r of e.querySelectorAll("a.nte-rolimons-thumb-link")) r !== t && r.remove();
      }
      function p(e, t) {
        let r = e.querySelector(".icon-link");
        if (!r) return;
        let host_card = t?.closest(".item-card-container, .trade-request-item") || t;
        if (y(host_card)) {
          e.remove();
          return;
        }
        e.removeAttribute("data-nte-inline-link"), remove_our_rolimons_links(host_card, e);
        if ("static" === getComputedStyle(t).position) t.style.position = "relative";
        let n = "dark" === a.getColorMode() ? "rolimonsLink.svg" : "rolimonsLinkDark.svg";
        (r.style.backgroundImage = `url(${JSON.stringify(a.getURL(`assets/${n}`))})`),
          (r.className = "icon icon-link"),
          (r.style.display = "block"),
          (r.style.backgroundSize = "cover"),
          (r.style.width = "18px"),
          (r.style.height = "18px"),
          (r.style.cursor = "pointer"),
          (r.style.backgroundColor = "transparent"),
          (r.style.pointerEvents = "none"),
          (r.style.verticalAlign = ""),
          (r.style.transition = "filter 0.2s ease"),
          (e.style.position = "absolute"),
          (e.style.bottom = "6px"),
          (e.style.right = "6px"),
          (e.style.zIndex = "5"),
          (e.style.display = "flex"),
          (e.style.alignItems = "center"),
          (e.style.justifyContent = "center"),
          (e.style.width = "24px"),
          (e.style.height = "24px"),
          (e.style.textDecoration = "none"),
          (e.style.background = "transparent"),
          (e.style.border = "none"),
          (e.style.boxShadow = "none"),
          (e.style.float = ""),
          (e.style.paddingLeft = ""),
          (e.style.marginTop = ""),
          (e.style.transform = ""),
          (e.style.transition = "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)"),
          e.addEventListener("mouseenter", () => {
            (e.style.transform = "scale(1.12)"), (r.style.filter = "brightness(1.22)");
          }),
          e.addEventListener("mouseleave", () => {
            (e.style.transform = "scale(1)"), (r.style.filter = "");
          }),
          e.addEventListener("click", (e) => e.stopPropagation()),
          e.addEventListener("mousedown", (e) => e.stopPropagation()),
          t.appendChild(e);
      }
      function h() {
        for (let e of document.querySelectorAll(".item-card-container, .trade-request-item")) {
          if (e.closest(".trade-request-window-offer")) continue;
          let t = e.querySelector("a.nte-rolimons-thumb-link");
          if (!t?.isConnected) continue;
          if (y(e)) {
            t.remove();
            continue;
          }
          let r = f(e);
          if (!r || t.parentElement === r) continue;
          let n = t.cloneNode(!0);
          t.remove(), n.removeAttribute("style");
          let o = n.querySelector(".icon-link");
          o && o.removeAttribute("style"), p(n, r);
        }
      }
      async function c() {
        for (let text_div of document.querySelectorAll(".item-card-price:not(.hasAssetLink), .item-value:not(.hasAssetLink)")) {
          for (let old_link of text_div.querySelectorAll("a.nte-rolimons-thumb-link")) old_link.remove();
          let card = text_div.closest(".item-card-container, .trade-request-item"),
            item_id_raw = a.getItemIdFromElement(card),
            item_name = a.getItemNameFromElement(card),
            card_bundle = is_roblox_bundle_card(card),
            is_trade_offer_item = !!card?.closest(".trade-request-window-offer");
          remove_our_rolimons_links(card);
          if (a.isUnsupportedBundle(item_id_raw, item_name)) continue;
          let n = a.resolveRolimonsItemId(item_id_raw, item_name, card_bundle);
          if (!n) continue;
          let roli_row = a.getRolimonsData()?.items?.[n],
            o = l[n];
          if ("failed" === o && !roli_row) continue;
          let asset_type_ok = o && a.checkIfAssetTypeIsOnRolimons(o);
          if (!(asset_type_ok || roli_row)) {
            void 0 === o && (l[n] = !1);
            continue;
          }
          if (y(card)) continue;
          let link_el = document.createElement("a");
          (link_el.href = `https://www.rolimons.com/item/${n}`),
            (link_el.target = "_blank"),
            (link_el.rel = "noopener noreferrer"),
            (link_el.className = "nte-rolimons-thumb-link"),
            link_el.setAttribute("aria-label", "Rolimons");
          let icon_span = document.createElement("span"),
            svg_asset = "dark" === a.getColorMode() ? "rolimonsLink.svg" : "rolimonsLinkDark.svg";
          (icon_span.style.backgroundImage = `url(${JSON.stringify(a.getURL(`assets/${svg_asset}`))})`),
            (icon_span.className = "icon icon-link"),
            (icon_span.style.display = "block"),
            (icon_span.style.backgroundSize = "cover"),
            (icon_span.style.width = "18px"),
            (icon_span.style.height = "18px"),
            (icon_span.style.cursor = "pointer"),
            (icon_span.style.backgroundColor = "transparent"),
            (icon_span.style.pointerEvents = "none");
          link_el.appendChild(icon_span);
          let thumb_wrap = f(card);
          if (thumb_wrap && !is_trade_offer_item) {
            p(link_el, thumb_wrap);
          } else {
            link_el.dataset.nteInlineLink = "1";
            (link_el.style.display = "inline-block"),
              (link_el.style.paddingLeft = "2px"),
              (link_el.style.transform = "translateY(-2px)"),
              (link_el.style.transition = "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)"),
              (icon_span.style.display = "inline-block"),
              (icon_span.style.verticalAlign = "bottom"),
              (icon_span.style.width = "18px"),
              (icon_span.style.height = "18px"),
              (icon_span.style.pointerEvents = "auto"),
              (icon_span.style.transition = "filter 0.2s ease"),
              link_el.addEventListener("mouseenter", () => {
                link_el.style.transform = "translateY(-2px) scale(1.1)";
                icon_span.style.filter = "brightness(1.18)";
              }),
              link_el.addEventListener("mouseleave", () => {
                link_el.style.transform = "translateY(-2px)";
                icon_span.style.filter = "";
              }),
              text_div.appendChild(link_el),
              (text_div.style.overflow = "visible"),
              text_div.querySelector('[ng-bind="item.priceStatus"]') &&
                (text_div.parentElement.querySelector(".creator-name")
                  ? ((link_el.style.float = "left"), (link_el.style.marginTop = "-7px"))
                  : ((link_el.style.position = "absolute"), (link_el.style.bottom = "18px"), (link_el.style.right = "50px")));
          }
          text_div.classList.add("hasAssetLink");
        }
        h(),
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              h();
            });
          });
        if ((a.initTooltips(), -1 !== Object.values(l).indexOf(!1) && !d)) {
          d = !0;
          let e = Object.keys(l)
              .filter((e) => !1 === l[e])
              .map((e) => parseInt(e)),
            t = { items: [] };
          e.forEach((e) => {
            t.items.length < 100 && t.items.push({ itemType: 1, id: e });
          }),
            void 0 === n && (n = document.querySelector('meta[name="csrf-token"]').getAttribute("data-token"));
          let r = await fetch("https://catalog.roblox.com/v1/catalog/items/details", {
            method: "POST",
            headers: { "X-CSRF-TOKEN": n },
            body: JSON.stringify(t),
            credentials: "include",
          });
          if (403 === r.status && 0 === (await r.json()).code) return (n = r.headers.get("X-CSRF-TOKEN")), (d = !1), c();
          if (
            (200 === r.status
              ? (await r.json()).data.forEach((e) => {
                  l[e.id] = e?.assetType || "failed";
                })
              : Object.keys(l).forEach((e) => {
                  !1 === l[e] && (l[e] = "failed");
                }),
            await o(),
            (d = !1),
            e.length > 100)
          )
            return c();
        }
      }
      var u = o;
    }),
    d("98F8t", function (e, t) {
      r(e.exports, "default", () => l);
      var n = s("eFyFE");
      async function a() {
        await n.waitForElm(".profile-header-title-container");
        let e = document.querySelector(".profile-header-title-container"),
          t = parseInt(document.querySelector("[data-profileuserid]").getAttribute("data-profileuserid")),
          r = document.createElement("a");
        (r.href = `https://www.rolimons.com/player/${t}`), (r.target = "_blank"), (r.style.display = "inline-block"), (r.style.order = 1);
        let a = document.createElement("span"),
          o = "dark" === n.getColorMode() ? "rolimonsLink.svg" : "rolimonsLinkDark.svg";
        (a.style.backgroundImage = `url(${JSON.stringify(n.getURL(`assets/${o}`))})`),
          (a.className = "icon icon-link user-profile-link"),
          (a.style.display = "inline-block"),
          (a.style.backgroundSize = "cover"),
          screen.width > 767 ? ((a.style.width = "32px"), (a.style.height = "32px")) : ((a.style.width = "20px"), (a.style.height = "20px")),
          (a.style.cursor = "pointer"),
          (a.style.transition = "filter 0.2s"),
          (a.style.backgroundColor = "transparent"),
          (a.onmouseover = () => {
            a.style.filter = "brightness(50%)";
          }),
          (a.onmouseout = () => {
            a.style.filter = "";
          }),
          r.appendChild(a),
          i(),
          e.appendChild(r);
      }
      async function o() {
        await n.waitForElm(".trades-header-nowrap");
        let t = [...document.getElementsByClassName("trades-header-nowrap")].at(-1)?.querySelector(".paired-name");
        if (!t) return;
        let container = t.parentElement || t;
        let e =
            parseInt((window.location.pathname.match(/\/users\/(\d+)\/trade/) || [])[1], 10) ||
            parseInt((String(t.getAttribute("href") || t.href || "").match(/\/users\/(\d+)\//) || [])[1], 10) ||
            null,
          existing = container.querySelector(".user-profile-link")?.parentElement,
          username = "";
        if (!e) {
          username =
            t.querySelector(".connector + .element")?.textContent?.trim() ||
            t.querySelector(".paired-name")?.children?.[2]?.innerText?.trim() ||
            t.children?.[2]?.innerText?.trim() ||
            "";
          if (!username) return;
          if (existing?.getAttribute("data-nte-profile-name") === username) return;
          e = await n.fetchIDFromName(username);
        }
        if (!e) return;
        let href = `https://www.rolimons.com/player/${e}`;
        if (existing?.href === href || existing?.getAttribute("href") === href) return;
        let r = t.innerText.length;
        container.style.position = "relative";
        let a = document.createElement("a");
        username && a.setAttribute("data-nte-profile-name", username),
          (a.className = "nte-profile-rolimons-link"),
          (a.href = href),
          (a.target = "_blank"),
          (a.style.display = "inline-block"),
          r > 35 && ((a.style.display = "block"), (a.style.marginBottom = "5px")),
          (a.style.paddingLeft = "4px"),
          (a.style.width = "28px"),
          (a.style.height = "28px"),
          (a.style.transform = "translateY(3px)");
        let o = document.createElement("span"),
          l = "dark" === n.getColorMode() ? "rolimonsLink.svg" : "rolimonsLinkDark.svg";
        (o.style.backgroundImage = `url(${JSON.stringify(n.getURL(`assets/${l}`))})`),
          (o.className = "icon icon-link user-profile-link"),
          (o.style.display = "inline-block"),
          (o.style.position = "absolute"),
          (o.style.verticalAlign = "bottom"),
          (o.style.backgroundSize = "cover"),
          (o.style.width = "28px"),
          (o.style.height = "28px"),
          (o.style.cursor = "pointer"),
          (o.style.transition = "filter 0.2s"),
          (o.style.backgroundColor = "transparent"),
          (o.onmouseover = () => {
            o.style.filter = "brightness(50%)";
          }),
          (o.onmouseout = () => {
            o.style.filter = "";
          }),
          a.appendChild(o),
          i(),
          t.insertAdjacentElement("afterend", a);
      }
      function i() {
        document.querySelector(".user-profile-link")?.parentElement.remove();
      }
      var l = async function () {
        if (!(await n.getOption("Add User Profile Links"))) return i();
        ("details" === n.getPageType() || "sendOrCounter" === n.getPageType()) && o(), "userProfile" === n.getPageType() && a();
      };
    }),
    d("fgypU", function (e, t) {
      r(e.exports, "default", () => c);
      var n = s("eFyFE");
      async function a() {
        let e = await n.getOption("Flag Rare Items"),
          t = await n.getOption("Flag Projected Items");
        function s(e, t) {
          if (!e?.classList) return;
          let r = null;
          if ("string" === typeof t) r = t;
          else if (t?.children?.length) r = t?.dataset?.nteSide || null;
          e.classList.toggle("nte-has-flag", !!r),
            e.classList.toggle("nte-flag-side-left", "left" === r),
            e.classList.toggle("nte-flag-side-right", "right" === r);
        }
        function m(e) {
          let t = e?.querySelector?.(".item-card-link") || e;
          if (!t) return null;
          let r = t.getBoundingClientRect(),
            a = [e?.querySelector?.(".ropro-projected-badge"), e?.querySelector?.(".ropro-icon"), ...Array.from(e?.querySelectorAll?.(".flagBox:not([data-nte-side])") || [])];
          for (let e of a) {
            if (!(e instanceof Element) || e.classList?.contains("ng-hide")) continue;
            let t = getComputedStyle(e);
            if ("none" === t.display || "hidden" === t.visibility || Number(t.opacity || "1") < 0.05) continue;
            let a = e.getBoundingClientRect();
            if (a.width < 8 || a.height < 8) continue;
            return a.left + a.width / 2 <= r.left + r.width / 2 ? "left" : "right";
          }
          return null;
        }
        function r(r) {
          let a = n.getItemIdFromElement(r),
            o = n.getItemNameFromElement(r),
            is_bundle_card = !!(r.querySelector('a[href*="/bundles/"]') || r.querySelector('[thumbnail-type="BundleThumbnail"]')),
            l = n.resolveRolimonsItemId(a, o, is_bundle_card);
          let f = r.querySelector(".item-card-link"),
            u = m(r);
          if (u) {
            let old_box = f?.querySelector(".flagBox[data-nte-side]");
            old_box && (n.destroyTooltips(old_box), old_box.remove());
            f && s(f, u);
            return;
          }
          if (void 0 === r.getElementsByClassName("flagBox")[0]) {
            let e = r.querySelector(".item-card-link");
            (e.style.position = "relative"), i(e);
          }
          let c = r.getElementsByClassName("flagBox")[0];
          n.destroyTooltips(c);
          c.replaceChildren();
          f = c.parentElement;
          let g = null != l ? n.getRolimonsData().items[l] : null;
          if (g)
            for (let hlist of (e && 1 === g[9] && d(c, "rare"), t && 1 === g[7] && d(c, "projected"), document.getElementsByClassName("hlist")))
              (hlist.style.getPropertyValue("overflow") === "visible" && hlist.style.getPropertyPriority("overflow") === "important") ||
                hlist.style.setProperty("overflow", "visible", "important");
          s(f, c);
        }
        if ("details" === n.getPageType()) {
          let e = await n.waitForElm(".trades-list-detail");
          if (e)
            for (let offer of (await n.waitForElm(".trade-list-detail-offer"), e.getElementsByClassName("trade-list-detail-offer")))
              for (let item of (await n.waitForElm(".item-card-container"), offer.querySelectorAll(".item-card-container"))) r(item);
        }
        if ("sendOrCounter" === n.getPageType()) {
          let e = await n.waitForElm(".inventory-panel-holder");
          for (let inventory of (await n.waitForElm(".hlist", e), e.querySelectorAll(".hlist")))
            for (let item of (await n.waitForElm(".item-card-container"), inventory.querySelectorAll(".item-card-container"))) r(item);
        }
        if ("catalog" === n.getPageType())
          for (let item of (await n.waitForElm(".item-card-container"),
          await n.waitForElm(".item-card-price"),
          document.querySelectorAll(".item-card-container")))
            r(item);
        n.initTooltips();
      }
      let o = {
        rare: n.getURL("assets/rare.png"),
        projected: n.getURL("assets/projected.png"),
      };
      async function i(e) {
        var t = document.createElement("div");
        let r = void 0 === document.getElementsByClassName("ropro-icon")[0] ? "left" : "right";
        (t.style.display = "flex"),
          (t.style.alignItems = "center"),
          (t.style.gap = "2px"),
          (t.style.position = "absolute"),
          (t.style.top = "2px"),
          ("left" === r ? (t.style.left = "2px") : (t.style.right = "2px")),
          (t.style.zIndex = "8"),
          (t.dataset.nteSide = r),
          (t.className = "flagBox"),
          e.appendChild(t);
      }
      let l = {
        rare: "This item is rare.",
        projected: "This item is projected.",
      };
      function d(e, t) {
        let r = document.createElement("div");
        (r.style.display = "inline-flex"), (r.style.alignItems = "center"), (r.style.cursor = "help"), (r.className = `${t}-flag`);
        let a = document.createElement("img");
        (a.src = o[t]),
          (a.style.height = "27px"),
          (a.style.width = "27px"),
          (a.style.display = "block"),
          (a.style.padding = "0px"),
          r.appendChild(a),
          e.appendChild(r),
          n.addTooltip(e.querySelector(`.${t}-flag`), l[t]);
      }
      var c = a;
    });
  var c = s("eFyFE"),
    u = s("92Pqq");
  function clear_uaid_link_targets() {
    for (let e of document.querySelectorAll(".nte-uaid-thumb-link")) e.remove();
    for (let e of document.querySelectorAll('[data-nte-uaid-link="1"]'))
      if (!e.classList?.contains("nte-uaid-thumb-link"))
        (e.onclick = null),
          (e.onmousedown = null),
          (e.style.cursor = "auto"),
          e.removeAttribute("data-toggle"),
          e.removeAttribute("data-original-title"),
          e.removeAttribute("title"),
          e.removeAttribute("data-nte-uaid-link"),
          e.removeAttribute("data-nte-uaid-instance-id");
  }
  function get_uaid_link_host(e, t = null) {
    if (!(e instanceof Element)) return null;
    return (
      t?.closest?.(".item-card-thumb-container,.item-card-link,.thumbnail-2d-container,thumbnail-2d,.trade-request-item") ||
      e.querySelector(".item-card-thumb-container") ||
      e.querySelector(".item-card-link") ||
      e.querySelector(".thumbnail-2d-container") ||
      e.querySelector("thumbnail-2d") ||
      e
    );
  }
  function sync_uaid_link_overlay(e, t, r) {
    if (!(e instanceof Element) || !(t instanceof Element) || !r) return null;
    let n = [...(e.children || [])].find((e) => e.classList?.contains("nte-uaid-thumb-link")) || null;
    n instanceof HTMLAnchorElement ||
      ((n = document.createElement("a")),
      (n.className = "nte-uaid-thumb-link"),
      (n.target = "_blank"),
      (n.rel = "noopener noreferrer"),
      (n.style.position = "absolute"),
      (n.style.display = "block"),
      (n.style.background = "transparent"),
      (n.style.border = "none"),
      (n.style.boxShadow = "none"),
      (n.style.padding = "0"),
      (n.style.margin = "0"),
      (n.style.borderRadius = "999px"),
      (n.style.cursor = "pointer"),
      (n.style.pointerEvents = "auto"),
      (n.style.textDecoration = "none"),
      (n.style.outline = "none"),
      (n.style.appearance = "none"),
      (n.style.webkitAppearance = "none"),
      (n.style.zIndex = "10"),
      (n.tabIndex = -1),
      n.addEventListener("mousedown", (e) => {
        e.stopPropagation();
      }),
      n.addEventListener("click", (e) => {
        e.stopPropagation();
      }),
      e.appendChild(n));
    "static" === getComputedStyle(e).position && (e.style.position = "relative");
    let a = e.getBoundingClientRect(),
      o = t.getBoundingClientRect(),
      i = Math.max(Math.round(o.width || t.offsetWidth || 0), 16),
      l = Math.max(Math.round(o.height || t.offsetHeight || 0), 16),
      d = Math.round(o.left - a.left),
      s = Math.round(o.top - a.top);
    return (
      Number.isFinite(d) || (d = 0),
      Number.isFinite(s) || (s = 0),
      (n.href = `https://www.rolimons.com/ciiid/${encodeURIComponent(String(r))}`),
      n.setAttribute("aria-label", "Quick link to this specific copy's Rolimon's page"),
      n.setAttribute("data-nte-uaid-link", "1"),
      n.setAttribute("data-nte-uaid-instance-id", String(r)),
      (n.style.left = `${Math.max(0, d)}px`),
      (n.style.top = `${Math.max(0, s)}px`),
      (n.style.width = `${i}px`),
      (n.style.height = `${l}px`),
      c.addTooltip(n, "Quick link to this specific copy's Rolimon's page"),
      n
    );
  }
  function get_uaid_link_target(e) {
    if (!(e instanceof Element)) return null;
    return e.querySelector(".limited-icon-container:not(.infocardbutton):not(.tooltip-pastnames)");
  }
  let uaid_link_refresh_timer = 0;
  let uaid_link_refresh_retry_timer = 0;
  let uaid_tooltip_init_timer = 0;
  function schedule_uaid_link_refresh(delay = 0, retry = !1) {
    clearTimeout(uaid_link_refresh_timer);
    uaid_link_refresh_timer = setTimeout(() => {
      uaid_link_refresh_timer = 0;
      m().catch(() => {});
    }, delay);
    retry &&
      (clearTimeout(uaid_link_refresh_retry_timer),
      (uaid_link_refresh_retry_timer = setTimeout(() => {
        uaid_link_refresh_retry_timer = 0;
        m().catch(() => {});
      }, delay + 220)));
  }
  let trade_detail_uaid_observer_started = !1;
  async function bind_trade_detail_uaid_refresh() {
    if (trade_detail_uaid_observer_started || "details" !== c.getPageType()) return;
    trade_detail_uaid_observer_started = !0;
    let detail_root = await c.waitForElm(".trades-list-detail").catch(() => null);
    if (!(detail_root instanceof Element)) return;
    let queue = () => schedule_uaid_link_refresh(80, !0);
    new MutationObserver((records) => {
      for (let record of records) {
        if ("attributes" === record.type) {
          let node = record.target;
          if (
            node?.matches?.(".trade-list-detail-offer,.item-card-container,.item-card-price,.limited-icon-container,[data-collectibleiteminstanceid],thumbnail-2d")
          ) {
            queue();
            return;
          }
          continue;
        }
        if (record.addedNodes?.length || record.removedNodes?.length) {
          queue();
          return;
        }
      }
    }).observe(detail_root, {
      childList: !0,
      subtree: !0,
      attributes: !0,
      attributeFilter: ["class", "data-collectibleiteminstanceid"],
    });
    queue();
  }
  async function m() {
    if (!(await c.getOption("Add Item Ownership History (UAID) Links")))
      return (function () {
        clear_uaid_link_targets();
        for (let item_card of document.querySelectorAll(".item-cards")) item_card.style.setProperty("overflow", "hidden");
      })();
    let e = new Set(),
      t = !1;
    for (let text_div of document.querySelectorAll(
      ".trade-list-detail-offer .item-card-price, .trade-inventory-panel .item-card-price, .trade-request-item",
    )) {
      let card = text_div.closest?.(".item-card-container, .trade-request-item") || text_div;
      let r = card?.getAttribute?.("data-collectibleiteminstanceid") || find_collectible_item_instance_id(card);
      if (!r) continue;
      let n = get_uaid_link_target(card);
      if (!(n instanceof Element)) continue;
      let a = get_uaid_link_host(card, n),
        o = sync_uaid_link_overlay(a, n, r);
      o && (e.add(o), (t = !0));
    }
    for (let r of document.querySelectorAll(".nte-uaid-thumb-link")) e.has(r) || r.remove();
    t &&
      (clearTimeout(uaid_tooltip_init_timer),
      (uaid_tooltip_init_timer = setTimeout(() => {
        (uaid_tooltip_init_timer = 0), c.initTooltips();
      }, 0)));
    for (let item_card of document.querySelectorAll(".item-cards"))
      (item_card.style.getPropertyValue("overflow") === "visible" && item_card.style.getPropertyPriority("overflow") === "important") ||
        item_card.style.setProperty("overflow", "visible", "important");
  }
  let trade_win_loss_retry_timer = null,
    trade_win_loss_retry_count = 0;
  function clear_trade_win_loss_detail_mount() {
    for (let divider of document.querySelectorAll('.rbx-divider[data-nte-trade-win-loss-detail-mount="1"]')) {
      divider.style.removeProperty("padding-top");
      divider.style.removeProperty("border-top");
      divider.style.removeProperty("overflow");
      divider.style.removeProperty("background-color");
      divider.removeAttribute("data-nte-trade-win-loss-detail-mount");
      if (divider.dataset.nteTradeWinLossDetailPositioned === "1") {
        divider.style.removeProperty("position");
        delete divider.dataset.nteTradeWinLossDetailPositioned;
      }
    }
  }
  function clear_trade_win_loss_send_mount() {
    for (let panel of document.querySelectorAll('.trade-inventory-panel[data-nte-trade-win-loss-send-mount="1"]')) {
      panel.style.removeProperty("padding-top");
      panel.style.removeProperty("border-top");
      panel.removeAttribute("data-nte-trade-win-loss-send-mount");
      if (panel.dataset.nteTradeWinLossPositioned === "1") {
        panel.style.removeProperty("position");
        delete panel.dataset.nteTradeWinLossPositioned;
      }
    }
  }
  function get_trade_win_loss_mount_point() {
    if ("details" === c.getPageType()) {
      let detail_offer = document.querySelectorAll(".trade-list-detail-offer")[1];
      let divider = detail_offer?.querySelector(".rbx-divider");
      if (divider instanceof Element) return { parent: divider, before: null, mode: "detail_divider" };
    }
    if ("sendOrCounter" === c.getPageType()) {
      let inventory_holder = document.querySelector(".inventory-panel-holder");
      let inventory_panels = inventory_holder?.querySelectorAll(".trade-inventory-panel");
      if (inventory_holder instanceof Element) {
        let second_panel = inventory_panels?.[1];
        let second_panel_host = second_panel instanceof Element ? Array.from(inventory_holder.children).find((child) => child.contains(second_panel)) : null;
        if (second_panel_host instanceof Element) return { parent: inventory_holder, before: second_panel_host, mode: "send_holder" };
        return { parent: inventory_holder, before: null, mode: "send_holder" };
      }
      let offers = document.querySelector(".trade-request-window-offers");
      if (offers instanceof Element) {
        let action_button = offers.querySelector(
          '[ng-click="sendTrade()"], [ng-click="counterTrade()"], button.btn-cta-md.btn-full-width, button.btn-full-width',
        );
        if (action_button instanceof Element) return { parent: offers, before: action_button };
        return { parent: offers, before: null };
      }
      let inventory_panel = document.querySelectorAll(".trade-inventory-panel")[1];
      if (inventory_panel instanceof Element) return { parent: inventory_panel, before: null, mode: "send_panel" };
    }
    let detail_offers = document.querySelectorAll(".trade-list-detail-offer");
    if (detail_offers.length >= 2 && detail_offers[0]?.parentElement) return { parent: detail_offers[0].parentElement, before: detail_offers[0].nextSibling };
    let buttons = document.querySelector(".trade-buttons");
    if (buttons?.parentElement) return { parent: buttons.parentElement, before: buttons };
    let offers = document.querySelector(".trade-request-window-offers");
    if (offers?.parentElement) return { parent: offers.parentElement, before: offers.nextSibling };
    let trade_window = document.querySelector(".trade-request-window, .trades-container");
    return trade_window?.parentElement ? { parent: trade_window.parentElement, before: trade_window.nextSibling } : null;
  }
  function ensure_trade_win_loss_container(mount, show_usd) {
    let is_send_panel = mount?.mode === "send_panel",
      is_detail_divider = mount?.mode === "detail_divider";
    let row = document.getElementById("winLossStatsContainer");
    row ||
      ((row = document.createElement("div")),
      (row.id = "winLossStatsContainer"));
    clear_trade_win_loss_detail_mount();
    clear_trade_win_loss_send_mount();
    row.style.width = "100%";
    row.style.maxWidth = "100%";
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "center";
    row.style.gap = "8px";
    row.style.boxSizing = "border-box";
    row.style.transform = "none";
    row.style.marginBottom = "0";
    row.style.zIndex = "4";
    if (is_send_panel && mount?.parent instanceof Element) {
      let parent = mount.parent;
      parent.setAttribute("data-nte-trade-win-loss-send-mount", "1");
      if (getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
        parent.dataset.nteTradeWinLossPositioned = "1";
      }
      parent.style.borderTop = "0px";
      row.style.position = "absolute";
      row.style.top = "0";
      row.style.left = "0";
      row.style.right = "0";
      row.style.clear = "none";
      row.style.flexBasis = "auto";
      row.style.alignSelf = "auto";
      row.style.justifySelf = "auto";
      row.style.gridColumn = "auto";
      row.style.padding = show_usd ? "3px 6px 0" : "2px 6px 0";
      row.style.margin = "0";
      row.style.marginTop = "0";
      row.style.marginLeft = "0";
      row.style.marginRight = "0";
      if (row.parentElement !== parent || row !== parent.lastChild) parent.appendChild(row);
    } else if (is_detail_divider && mount?.parent instanceof Element) {
      let parent = mount.parent;
      parent.setAttribute("data-nte-trade-win-loss-detail-mount", "1");
      if (getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
        parent.dataset.nteTradeWinLossDetailPositioned = "1";
      }
      parent.style.overflow = "visible";
      parent.style.setProperty("background-color", "transparent", "important");
      parent.style.borderTop = "0px";
      parent.style.paddingTop = show_usd ? "64px" : "38px";
      row.style.position = "absolute";
      row.style.top = "0";
      row.style.left = "0";
      row.style.right = "0";
      row.style.clear = "none";
      row.style.flexBasis = "auto";
      row.style.alignSelf = "auto";
      row.style.justifySelf = "auto";
      row.style.gridColumn = "auto";
      row.style.padding = show_usd ? "3px 6px 0" : "2px 6px 0";
      row.style.margin = "0";
      row.style.marginTop = "0";
      row.style.marginLeft = "0";
      row.style.marginRight = "0";
      if (row.parentElement !== parent || row !== parent.lastChild) parent.appendChild(row);
    } else {
      row.style.position = "relative";
      row.style.clear = "both";
      row.style.flexBasis = "100%";
      row.style.alignSelf = "stretch";
      row.style.justifySelf = "stretch";
      row.style.gridColumn = "1 / -1";
      row.style.left = "0";
      row.style.right = "0";
      row.style.padding = show_usd ? "6px 6px 2px" : "4px 6px 0";
      row.style.margin = "0 auto";
      row.style.marginTop = "0";
      row.style.marginLeft = "auto";
      row.style.marginRight = "auto";
      if (mount?.parent && row.parentElement !== mount.parent) mount.parent.insertBefore(row, mount.before || null);
      else if (mount?.parent && mount.before && row.nextSibling !== mount.before) mount.parent.insertBefore(row, mount.before);
      else if (mount?.parent && !mount.before && row.parentElement === mount.parent && row !== mount.parent.lastChild)
        mount.parent.appendChild(row);
    }
    row.hidden = !1;
    return row;
  }
  function sync_trade_win_loss_send_mount(row) {
    if (!(row instanceof Element)) return;
    let parent = row.parentElement;
    if (!(parent instanceof Element) || parent.getAttribute("data-nte-trade-win-loss-send-mount") !== "1") return;
    let row_rect = row.getBoundingClientRect();
    if (!(row_rect.height > 0)) return;
    parent.style.paddingTop = `${Math.ceil(row_rect.height + 4)}px`;
  }
  function align_trade_win_loss_container(row) {
    if (!(row instanceof Element)) return;
    row.style.transform = "none";
    row.style.marginBottom = "0";
    if (row.parentElement?.getAttribute("data-nte-trade-win-loss-detail-mount") === "1") return;
    if ("details" !== c.getPageType()) return;
    let offers = document.querySelectorAll(".trade-list-detail-offer"),
      first_offer = offers[0],
      second_offer = offers[1];
    if (!(first_offer instanceof Element)) return;
    let is_compact = window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
    let card_rects = Array.from(first_offer.querySelectorAll(".trade-item-card, .item-card.trade-item-card"))
      .map((el) => el.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    let target_center = NaN;
    if (card_rects.length) {
      let min_left = Math.min(...card_rects.map((rect) => rect.left)),
        max_right = Math.max(...card_rects.map((rect) => rect.right));
      target_center = (min_left + max_right) / 2;
    } else {
      let fallback = first_offer.querySelector(".robux-line") || first_offer.querySelector(".trade-list-detail-offer-header");
      if (fallback instanceof Element) {
        let rect = fallback.getBoundingClientRect();
        rect.width > 0 && (target_center = rect.left + rect.width / 2);
      }
    }
    let row_rect = row.getBoundingClientRect();
    if (!(row_rect.width > 0) || !Number.isFinite(target_center)) return;
    let x_offset = target_center - (row_rect.left + row_rect.width / 2);
    if (!Number.isFinite(x_offset)) return;
    x_offset = is_compact ? 0 : Math.max(-80, Math.min(80, Math.round(x_offset)));
    let y_offset = 0,
      divider = second_offer instanceof Element ? second_offer.querySelector(".rbx-divider") : null,
      content = row.firstElementChild instanceof Element ? row.firstElementChild : row;
    if (divider instanceof Element) {
      let divider_rect = divider.getBoundingClientRect(),
        content_rect = content.getBoundingClientRect();
      if (divider_rect.width > 0 && content_rect.height > 0) y_offset = Math.round(divider_rect.top + divider_rect.height / 2 - (content_rect.top + content_rect.height / 2));
    }
    row.style.marginBottom = y_offset > 0 ? `-${y_offset}px` : "0";
    row.style.transform = Math.abs(x_offset) > 1 || Math.abs(y_offset) > 1 ? `translate(${x_offset}px, ${y_offset}px)` : "none";
  }
  function clear_trade_win_loss_retry() {
    trade_win_loss_retry_timer && clearTimeout(trade_win_loss_retry_timer),
      (trade_win_loss_retry_timer = null),
      (trade_win_loss_retry_count = 0);
  }
  function schedule_trade_win_loss_retry() {
    if (trade_win_loss_retry_timer || trade_win_loss_retry_count >= 20) return;
    trade_win_loss_retry_timer = setTimeout(() => {
      (trade_win_loss_retry_timer = null),
        trade_win_loss_retry_count++,
        p().catch((e) => {
          console.debug("NTE trade stats retry failed", e);
        });
    }, 250);
  }
  async function p() {
    let mount = get_trade_win_loss_mount_point();
    if (!(await c.getOption("Trade Win/Loss Stats"))) return clear_trade_win_loss_retry(), h();
    let t = !(await c.getOption("Disable Win/Loss Stats RAP"));
    let show_usd = !!(await c.getOption("Show Routility USD Values"));
    if (!mount) return schedule_trade_win_loss_retry();
    let n = !1,
      a = 0,
      o = !1,
      i = NaN,
      u_pct = !1,
      u_amt = NaN;
    try {
      [n, a] = await f();
    } catch (e) {
      console.debug("NTE trade RAP stats failed", e);
    }
    try {
      [o, i] = await g();
    } catch (e) {
      console.debug("NTE trade value stats failed", e);
    }
    if (show_usd)
      try {
        [u_pct, u_amt] = await usd_totals();
      } catch (e) {
        console.debug("NTE trade USD stats failed", e);
      }
    let rap_ready = Number.isFinite(a),
      value_ready = Number.isFinite(i),
      usd_ready = show_usd && Number.isFinite(u_amt);
    if (!value_ready) return schedule_trade_win_loss_retry();
    clear_trade_win_loss_retry();
    u_amt = usd_ready ? Math.round(u_amt) : 0;
    let r = ensure_trade_win_loss_container(mount, show_usd);
    c.destroyTooltips(r);
    r.replaceChildren();
    function l(e, t, r, l, prefix) {
      prefix = prefix || "";
      let s, d;
      "value" === e && ((s = i), (d = o)), "RAP" === e && ((s = a), (d = n)), "USD" === e && ((s = u_amt), (d = u_pct));
      let pretty = (v) => `${prefix}${c.commafy(Math.abs(Math.round(v)))}`;
      let pct_text = format_trade_percent(Math.abs(d));
      let u = {
        win: {
          start: `You are gaining ${pretty(s)} ${e} on this trade`,
          endFinite: `, and winning in ${e} by ${pct_text}%.`,
          endInfinite: ".",
        },
        loss: {
          start: `You are losing ${pretty(s)} ${e} on this trade`,
          endFinite: `, and losing in ${e} by ${pct_text}%.`,
          endInfinite: ".",
        },
        equal: {
          start: `This trade is equal in ${e}`,
          endFinite: "",
          endInfinite: "",
        },
      };
      return 0 === l
        ? u.equal.start
        : t
          ? r
            ? u.win.start + u.win.endFinite
            : u.win.start + u.win.endInfinite
          : r
            ? u.loss.start + u.loss.endFinite
            : u.loss.start + u.loss.endInfinite;
    }
    let s = rap_ready && "number" === typeof n && Number.isFinite(n),
      d = "number" === typeof o && Number.isFinite(o),
      u_show_pct = usd_ready && "number" === typeof u_pct && Number.isFinite(u_pct);
    if (value_ready) {
      let g = a > 0,
        h = i > 0,
        u_win = u_amt > 0;
      let e = y(t && rap_ready, a, n, s, i, o, d, usd_ready, u_amt, u_pct, u_show_pct);
      let tooltip = `${t && rap_ready ? l("RAP", g, s, a) + " " : ""}${l("value", h, d, i)}`;
      if (usd_ready) tooltip += ` ${l("USD", u_win, u_show_pct, u_amt, "$")}`;
      c.addTooltip(e, tooltip),
        r.appendChild(e),
        sync_trade_win_loss_send_mount(r),
        align_trade_win_loss_container(r),
        requestAnimationFrame(() => {
          sync_trade_win_loss_send_mount(r), align_trade_win_loss_container(r);
        }),
        c.initTooltips();
    }
  }
  function get_trade_percent(diff, total) {
    if (!(total > 0)) return !1;
    let pct = (diff / total) * 100;
    return Number.isFinite(pct) ? (Object.is(pct, -0) ? 0 : pct) : !1;
  }
  function format_trade_percent(value, signed = !1) {
    if (!Number.isFinite(value)) return "";
    let abs = Math.abs(value),
      rounded = abs >= 10 ? Math.round(value) : abs >= 1 ? Math.round(10 * value) / 10 : Math.round(100 * value) / 100;
    Object.is(rounded, -0) && (rounded = 0);
    let rounded_abs = Math.abs(rounded),
      text = (rounded_abs >= 10 ? rounded_abs.toFixed(0) : rounded_abs >= 1 ? rounded_abs.toFixed(1) : rounded_abs.toFixed(2))
        .replace(/\.0+$/, "")
        .replace(/(\.\d*[1-9])0+$/, "$1");
    return signed ? `${rounded > 0 ? "+" : rounded < 0 ? "-" : ""}${text}` : text;
  }
  const colorblind_mode_option_name = "Colorblind Mode";
  const legacy_colorblind_mode_option_name = "Colorblind Profit Mode";
  const post_tax_trade_values_option_name = "Post-Tax Trade Values";
  const legacy_post_tax_trade_value_option_name = "Post-Tax Trade Value";
  const colorblind_mode_profile_key = "colorblind_mode_profile";
  const colorblind_mode_profile_default = "deuteranopia";
  const colorblind_mode_profiles = ["deuteranopia", "protanopia", "tritanopia", "achromatopsia"];
  const colorblind_trade_refresh_messages = [
    colorblind_mode_option_name,
    legacy_colorblind_mode_option_name,
    colorblind_mode_profile_key,
  ];
  const trade_ui_refresh_messages = [
    "Values",
    "Values on Trading Window",
    "Values on Trade Lists",
    "Trade Win/Loss Stats",
    post_tax_trade_values_option_name,
    legacy_post_tax_trade_value_option_name,
    "Disable Win/Loss Stats RAP",
    "Show Routility USD Values",
  ];
  let trade_profit_colorblind_mode = !1;
  let trade_profit_colorblind_profile = colorblind_mode_profile_default;
  function normalize_colorblind_mode_profile(value) {
    let normalized = String(value || "").trim().toLowerCase();
    return colorblind_mode_profiles.includes(normalized) ? normalized : colorblind_mode_profile_default;
  }
  function get_trade_colorblind_mode_settings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        [colorblind_mode_option_name, legacy_colorblind_mode_option_name, colorblind_mode_profile_key],
        (result) => {
          chrome.runtime.lastError && console.info(chrome.runtime.lastError);
          let enabled =
            result?.[colorblind_mode_option_name] !== undefined
              ? !!result[colorblind_mode_option_name]
              : !!result?.[legacy_colorblind_mode_option_name];
          resolve({
            enabled,
            profile: normalize_colorblind_mode_profile(result?.[colorblind_mode_profile_key]),
          });
        },
      );
    });
  }
  function get_trade_profit_palette() {
    if (!trade_profit_colorblind_mode)
      return {
        chip_gain_bg: "rgba(71, 180, 109, 0.48)",
        chip_gain_border: "rgba(181, 243, 200, 0.34)",
        chip_loss_bg: "rgba(204, 86, 82, 0.46)",
        chip_loss_border: "rgba(255, 190, 186, 0.32)",
        chip_text: "rgba(255, 255, 255, 0.96)",
        history_up_bg: "rgba(34, 197, 94, 0.16)",
        history_up_border: "rgba(34, 197, 94, 0.26)",
        history_up_color: "#86efac",
        history_up_light: "#166534",
        history_down_bg: "rgba(248, 113, 113, 0.16)",
        history_down_border: "rgba(248, 113, 113, 0.28)",
        history_down_color: "#fecaca",
        history_down_light: "#b91c1c",
        list_gain_color: "#20d742",
        list_loss_color: "#d72020",
        list_even_color: "rgb(79, 81, 82)",
        list_gain_fill: "none",
        list_loss_fill: "none",
        list_even_fill: "none",
        list_gain_label: "rgba(255, 255, 255, 0.82)",
        list_loss_label: "rgba(255, 255, 255, 0.82)",
        list_even_label: "rgba(255, 255, 255, 0.82)",
      };

    switch (trade_profit_colorblind_profile) {
      case "protanopia":
        return {
          chip_gain_bg: "rgba(13, 148, 136, 0.48)",
          chip_gain_border: "rgba(153, 246, 228, 0.34)",
          chip_loss_bg: "rgba(225, 29, 72, 0.46)",
          chip_loss_border: "rgba(251, 113, 133, 0.32)",
          chip_text: "rgba(255, 255, 255, 0.96)",
          history_up_bg: "rgba(20, 184, 166, 0.16)",
          history_up_border: "rgba(45, 212, 191, 0.26)",
          history_up_color: "#99f6e4",
          history_up_light: "#115e59",
          history_down_bg: "rgba(244, 63, 94, 0.16)",
          history_down_border: "rgba(251, 113, 133, 0.28)",
          history_down_color: "#fecdd3",
          history_down_light: "#9f1239",
          list_gain_color: "#0f766e",
          list_loss_color: "#e11d48",
          list_even_color: "rgb(79, 81, 82)",
          list_gain_fill: "linear-gradient(180deg, #5eead4 0%, #0f766e 100%)",
          list_loss_fill: "repeating-linear-gradient(135deg, #fda4af 0 6px, #e11d48 6px 12px)",
          list_even_fill: "linear-gradient(180deg, rgba(148, 163, 184, 0.64) 0%, rgba(71, 85, 105, 0.95) 100%)",
          list_gain_label: "#ccfbf1",
          list_loss_label: "#ffe4e6",
          list_even_label: "rgba(255, 255, 255, 0.82)",
        };
      case "tritanopia":
        return {
          chip_gain_bg: "rgba(22, 163, 74, 0.48)",
          chip_gain_border: "rgba(187, 247, 208, 0.34)",
          chip_loss_bg: "rgba(147, 51, 234, 0.46)",
          chip_loss_border: "rgba(216, 180, 254, 0.32)",
          chip_text: "rgba(255, 255, 255, 0.96)",
          history_up_bg: "rgba(34, 197, 94, 0.16)",
          history_up_border: "rgba(74, 222, 128, 0.26)",
          history_up_color: "#bbf7d0",
          history_up_light: "#166534",
          history_down_bg: "rgba(168, 85, 247, 0.16)",
          history_down_border: "rgba(192, 132, 252, 0.28)",
          history_down_color: "#f3e8ff",
          history_down_light: "#6b21a8",
          list_gain_color: "#16a34a",
          list_loss_color: "#9333ea",
          list_even_color: "rgb(79, 81, 82)",
          list_gain_fill: "linear-gradient(180deg, #86efac 0%, #16a34a 100%)",
          list_loss_fill: "repeating-linear-gradient(135deg, #d8b4fe 0 6px, #9333ea 6px 12px)",
          list_even_fill: "linear-gradient(180deg, rgba(148, 163, 184, 0.64) 0%, rgba(71, 85, 105, 0.95) 100%)",
          list_gain_label: "#dcfce7",
          list_loss_label: "#f3e8ff",
          list_even_label: "rgba(255, 255, 255, 0.82)",
        };
      case "achromatopsia":
        return {
          chip_gain_bg: "rgba(100, 116, 139, 0.55)",
          chip_gain_border: "rgba(226, 232, 240, 0.34)",
          chip_loss_bg: "rgba(17, 24, 39, 0.62)",
          chip_loss_border: "rgba(156, 163, 175, 0.36)",
          chip_text: "rgba(255, 255, 255, 0.96)",
          history_up_bg: "rgba(203, 213, 225, 0.16)",
          history_up_border: "rgba(226, 232, 240, 0.28)",
          history_up_color: "#f8fafc",
          history_up_light: "#475569",
          history_down_bg: "rgba(17, 24, 39, 0.26)",
          history_down_border: "rgba(156, 163, 175, 0.32)",
          history_down_color: "#d1d5db",
          history_down_light: "#111827",
          list_gain_color: "#cbd5e1",
          list_loss_color: "#94a3b8",
          list_even_color: "rgb(79, 81, 82)",
          list_gain_fill: "linear-gradient(180deg, #cbd5e1 0%, #64748b 100%)",
          list_loss_fill: "repeating-linear-gradient(135deg, #111827 0 6px, #6b7280 6px 12px)",
          list_even_fill: "linear-gradient(180deg, rgba(148, 163, 184, 0.64) 0%, rgba(71, 85, 105, 0.95) 100%)",
          list_gain_label: "rgba(255, 255, 255, 0.82)",
          list_loss_label: "rgba(255, 255, 255, 0.82)",
          list_even_label: "rgba(255, 255, 255, 0.82)",
        };
      default:
        return {
          chip_gain_bg: "rgba(37, 99, 235, 0.5)",
          chip_gain_border: "rgba(147, 197, 253, 0.34)",
          chip_loss_bg: "rgba(249, 115, 22, 0.5)",
          chip_loss_border: "rgba(253, 186, 116, 0.34)",
          chip_text: "rgba(255, 255, 255, 0.96)",
          history_up_bg: "rgba(59, 130, 246, 0.16)",
          history_up_border: "rgba(96, 165, 250, 0.26)",
          history_up_color: "#bfdbfe",
          history_up_light: "#1d4ed8",
          history_down_bg: "rgba(249, 115, 22, 0.18)",
          history_down_border: "rgba(251, 146, 60, 0.28)",
          history_down_color: "#fed7aa",
          history_down_light: "#c2410c",
          list_gain_color: "#2563eb",
          list_loss_color: "#ea580c",
          list_even_color: "rgb(79, 81, 82)",
          list_gain_fill: "linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)",
          list_loss_fill: "repeating-linear-gradient(135deg, #fdba74 0 6px, #f97316 6px 12px)",
          list_even_fill: "linear-gradient(180deg, rgba(148, 163, 184, 0.64) 0%, rgba(71, 85, 105, 0.95) 100%)",
          list_gain_label: "#dbeafe",
          list_loss_label: "#ffedd5",
          list_even_label: "rgba(255, 255, 255, 0.82)",
        };
    }
  }
  function get_trade_profit_state_meta(amount) {
    let equal = 0 === amount,
      win = amount > 0;
    return {
      equal,
      win,
      key: equal ? "even" : win ? "gain" : "loss",
      label: equal ? "Even" : win ? "Gain" : "Loss",
    };
  }
  function apply_trade_profit_theme_vars() {
    let palette = get_trade_profit_palette(),
      root = document.documentElement;
    root.style.setProperty("--nte-history-profit-up-bg", palette.history_up_bg);
    root.style.setProperty("--nte-history-profit-up-border", palette.history_up_border);
    root.style.setProperty("--nte-history-profit-up-color", palette.history_up_color);
    root.style.setProperty("--nte-history-profit-up-light", palette.history_up_light);
    root.style.setProperty("--nte-history-profit-down-bg", palette.history_down_bg);
    root.style.setProperty("--nte-history-profit-down-border", palette.history_down_border);
    root.style.setProperty("--nte-history-profit-down-color", palette.history_down_color);
    root.style.setProperty("--nte-history-profit-down-light", palette.history_down_light);
  }
  async function sync_trade_profit_mode() {
    try {
      let settings = await get_trade_colorblind_mode_settings();
      trade_profit_colorblind_mode = settings.enabled;
      trade_profit_colorblind_profile = settings.profile;
    } catch {
      trade_profit_colorblind_mode = !1;
      trade_profit_colorblind_profile = colorblind_mode_profile_default;
    }
    apply_trade_profit_theme_vars();
    return trade_profit_colorblind_mode;
  }
  async function f() {
    if ("sendOrCounter" === c.getPageType()) {
      let offers = document.querySelectorAll(".trade-request-window-offer");
      if (offers[0] && offers[1]) {
        let left = get_trade_offer_rendered_totals(offers[0]),
          right = get_trade_offer_rendered_totals(offers[1]);
        if (Number.isFinite(left?.rap_total) && Number.isFinite(right?.rap_total)) {
          let diff = right.rap_total - left.rap_total,
            pct = get_trade_percent(diff, left.rap_total);
          return [pct, diff];
        }
      }
    }
    let e = document.querySelectorAll(".text-robux-lg:not(.valueSpan)");
    if (e.length >= 2) {
      let t = parseInt(e[e.length - 2].innerText.replaceAll(",", ""), 10),
        r = parseInt(e[e.length - 1].innerText.replaceAll(",", ""), 10);
      if (Number.isFinite(t) && Number.isFinite(r)) {
        let n = r - t,
          a = get_trade_percent(n, t);
        return [a, n];
      }
    }
    let offers = await get_trade_offer_elements();
    if (offers?.[0] && offers?.[1]) {
      let left = get_trade_offer_rendered_totals(offers[0]),
        right = get_trade_offer_rendered_totals(offers[1]);
      if (Number.isFinite(left?.rap_total) && Number.isFinite(right?.rap_total)) {
        let diff = right.rap_total - left.rap_total,
          pct = get_trade_percent(diff, left.rap_total);
        return [pct, diff];
      }
    }
    return [!1, 0];
  }
  async function get_trade_offer_elements() {
    if ("details" === c.getPageType()) {
      document.querySelector(".trade-list-detail-offer") || (await c.waitForElm(".trade-list-detail-offer"));
      let e = document.getElementsByClassName("trade-list-detail-offer");
      if (e[0] && e[1]) return e;
    }
    document.querySelector(".trade-request-window-offer") || (await c.waitForElm(".trade-request-window-offer"));
    let t = document.getElementsByClassName("trade-request-window-offer");
    return t[0] && t[1] ? t : null;
  }
  function parse_trade_summary_number(text) {
    let match = String(text || "").match(/\d[\d,]*/);
    return match ? parseInt(match[0].replace(/,/g, ""), 10) || 0 : NaN;
  }
  function get_trade_offer_robux_total(offer) {
    if (!(offer instanceof Element)) return 0;
    let input = offer.querySelector('[name="robux"]');
    if (input) return parseInt(input.value, 10) || 0;
    let details_value_el = offer.querySelector(".text-label.robux-line-value"),
      details_value = parse_trade_summary_number(details_value_el?.textContent || "");
    return Number.isFinite(details_value) ? Math.round(details_value / 0.7) : 0;
  }
  function get_trade_offer_rendered_totals(offer, use_post_tax = !1) {
    let total_line =
      offer?.querySelector(".robux-line:not(.ng-hide) .robux-line-amount .text-robux-lg")?.parentElement ||
      offer?.querySelector(".robux-line .robux-line-amount .text-robux-lg")?.parentElement ||
      offer?.querySelector(".robux-line-amount");
    if (!(total_line instanceof Element)) return null;
    let value_total = parse_trade_summary_number(total_line.querySelector(".valueSpan")?.textContent || ""),
      clone = total_line.cloneNode(!0),
      robux_total = get_trade_offer_robux_total(offer);
    for (let el of clone.querySelectorAll(".valueSpan, .icon-rolimons, .nte-routility-usd-row, .nte-routility-usd-inline, img, br")) el.remove();
    let rap_total = parse_trade_summary_number(clone.textContent || "");
    if (Number.isFinite(value_total) && use_post_tax) value_total = value_total - robux_total + Math.round(0.7 * robux_total);
    return {
      rap_total,
      value_total,
      robux_total,
    };
  }
  async function get_post_tax_trade_values_enabled() {
    let value = await c.getOption(post_tax_trade_values_option_name);
    if (value !== undefined) return !!value;
    let legacy_value = await c.getOption(legacy_post_tax_trade_value_option_name);
    return legacy_value !== undefined ? !!legacy_value : true;
  }
  async function g() {
    let use_post_tax = await get_post_tax_trade_values_enabled();
    if ("sendOrCounter" === c.getPageType()) {
      let offers = document.querySelectorAll(".trade-request-window-offer");
      if (offers[0] && offers[1]) {
        let left_rendered = get_trade_offer_rendered_totals(offers[0], use_post_tax),
          right_rendered = get_trade_offer_rendered_totals(offers[1], use_post_tax);
        if (Number.isFinite(left_rendered?.value_total) && Number.isFinite(right_rendered?.value_total)) {
          let diff = right_rendered.value_total - left_rendered.value_total,
            pct = get_trade_percent(diff, left_rendered.value_total);
          return [pct, diff];
        }
      }
    }
    let e = await get_trade_offer_elements();
    if (!e?.[0] || !e?.[1]) return [!1, NaN];
    let left_rendered = get_trade_offer_rendered_totals(e[0], use_post_tax),
      right_rendered = get_trade_offer_rendered_totals(e[1], use_post_tax);
    if (Number.isFinite(left_rendered?.value_total) && Number.isFinite(right_rendered?.value_total)) {
      let n = right_rendered.value_total - left_rendered.value_total,
        a = get_trade_percent(n, left_rendered.value_total);
      return [a, n];
    }
    let
      t = await v(e[0], use_post_tax),
      r = await v(e[1], use_post_tax);
    if (!Number.isFinite(t) || !Number.isFinite(r)) return [!1, NaN];
    let n = r - t,
      a = get_trade_percent(n, t);
    return [a, n];
  }
  function get_trade_context_usd_value(item_el, price_el) {
    let item_id = c.getItemIdFromElement(item_el),
      item_name = c.getItemNameFromElement(item_el),
      rap = 0;
    if (price_el instanceof Element) {
      let copy = price_el.cloneNode(!0);
      for (let el of copy.querySelectorAll(".valueSpan, .icon-rolimons, .icon-link, .nte-routility-usd-row, .nte-routility-usd-inline, br")) el.remove();
      let match = (copy.textContent || "").match(/\d[\d,]*/);
      rap = match ? parseInt(match[0].replace(/,/g, ""), 10) || 0 : 0;
    }
    let ctx = get_trade_el_value_ctx(item_el, item_id, item_name, rap),
      resolved_id = c.resolveRolimonsItemId(ctx.targetId, ctx.name, "Bundle" === ctx.itemType);
    return Number(c.getUSD(ctx.targetId) || c.getUSD(resolved_id) || 0);
  }
  function get_trade_sales_hover_routility_usd(ctx) {
    let target_id = Number(ctx?.target_id || 0),
      target_name = String(ctx?.name || ""),
      item_type = String(ctx?.item_type || "Asset"),
      resolved_id = c.resolveRolimonsItemId(target_id, target_name, "Bundle" === item_type);
    return Number(c.getUSD(target_id) || c.getUSD(ctx?.rolimons_id) || c.getUSD(resolved_id) || 0);
  }
  async function usd_side(offer) {
    let pt = c.getPageType();
    if ("details" === pt) {
      await c.waitForElm(".item-card-container");
      let containers = offer.querySelectorAll(".item-card-container");
      await c.waitForElm(".item-card-price");
      let total = 0;
      for (let item of containers) total += get_trade_context_usd_value(item, item.querySelector(".item-card-price"));
      return total;
    }
    await c.waitForElm('[ng-repeat="slot in offer.slots"]', offer);
    let slots = offer.querySelectorAll('[ng-repeat="slot in offer.slots"]');
    let total = 0;
    for (let item of slots) total += get_trade_context_usd_value(item, item.querySelector(".item-card-price, .item-value"));
    return total;
  }
  async function usd_totals() {
    let offers = await get_trade_offer_elements();
    if (!offers?.[0] || !offers?.[1]) return [!1, NaN];
    let left = await usd_side(offers[0]);
    let right = await usd_side(offers[1]);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return [!1, NaN];
    let diff = right - left;
    let pct = get_trade_percent(diff, left);
    return [pct, diff];
  }
  function y(show_rap, rap_amount, rap_percent, show_rap_percent, value_amount, value_percent, show_value_percent, show_usd, usd_amount, usd_percent, show_usd_percent) {
    let dark = "dark" === c.getColorMode(),
      neutral_bg = dark ? "rgba(255, 255, 255, 0.12)" : "rgba(37, 45, 55, 0.09)",
      neutral_border = dark ? "rgba(255, 255, 255, 0.16)" : "rgba(37, 45, 55, 0.12)",
      neutral_color = dark ? "rgba(248, 250, 252, 0.88)" : "rgba(35, 43, 52, 0.82)";
    let palette = get_trade_profit_palette();
    let pack_asset_url = (path) => chrome.runtime.getURL(path),
      rap_icon_url = pack_asset_url("elements/robux.png"),
      value_icon_url = pack_asset_url("assets/rolimons.png"),
      usd_icon_url = pack_asset_url("assets/routility.png"),
      chip_icon_style =
        "display:block;width:17px;height:17px;object-fit:contain;object-position:center;flex:0 0 auto;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.22));",
      rap_icon = `<img src="${rap_icon_url}" alt="" aria-hidden="true" decoding="async" style="${chip_icon_style}">`,
      value_icon = `<img src="${value_icon_url}" alt="" aria-hidden="true" decoding="async" style="${chip_icon_style}">`,
      usd_icon = `<img src="${usd_icon_url}" alt="" aria-hidden="true" decoding="async" style="display:block;width:16px;height:16px;object-fit:contain;object-position:center;flex:0 0 auto;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.22));">`;
    function chip(label, amount, percent, show_percent, icon_html, prefix, source_label) {
      prefix = prefix || "";
      let state = get_trade_profit_state_meta(amount),
        equal = state.equal,
        win = state.win,
        background = equal ? neutral_bg : win ? palette.chip_gain_bg : palette.chip_loss_bg,
        border = equal ? neutral_border : win ? palette.chip_gain_border : palette.chip_loss_border,
        color = equal ? neutral_color : palette.chip_text,
        amount_text = equal
          ? "Even"
          : trade_profit_colorblind_mode
            ? `${win ? "Gain" : "Loss"} ${amount > 0 ? "+" : "-"}${prefix}${c.commafy(Math.abs(amount))}`
            : `${amount > 0 ? "+" : "-"}${prefix}${c.commafy(Math.abs(amount))}`,
        percent_text = !equal && show_percent ? `(${format_trade_percent(percent, !0)}%)` : "",
        value_row = `<span style="display:inline-flex;align-items:center;justify-content:center;gap:5px;line-height:1;height:16px;min-width:0;"><span style="display:inline-flex;align-items:center;height:16px;font-size:15px;font-weight:800;color:${color};line-height:16px;">${amount_text}</span>${percent_text ? `<span style="display:inline-flex;align-items:center;height:16px;font-size:12px;font-weight:800;color:${color};opacity:0.88;line-height:16px;">${percent_text}</span>` : ""}</span>`,
        source_html = source_label
          ? `<span style="display:inline-flex;align-items:center;height:10px;font-size:10px;font-weight:800;color:${equal ? neutral_color : "rgba(255, 255, 255, 0.84)"};letter-spacing:.55px;line-height:10px;text-transform:uppercase;">${source_label}</span>`
          : "";
      return `<span aria-label="${label}" style="min-height:29px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:${source_label ? "6px 13px" : "0 12px"};border-radius:8px;background:${background};border:1px solid ${border};box-shadow:inset 0 1px 0 rgba(255,255,255,0.14),0 2px 8px rgba(0,0,0,0.10);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);box-sizing:border-box;color:${color};line-height:1;white-space:nowrap;"><span style="width:17px;height:17px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 17px;">${icon_html}</span><span style="display:inline-flex;${source_label ? "flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;" : "align-items:center;justify-content:center;"}line-height:1;min-width:0;">${source_html}${value_row}</span></span>`;
    }
    let e = document.createElement("div");
    (e.style.minHeight = "30px"),
      (e.style.width = "auto"),
      (e.style.maxWidth = "100%"),
      (e.style.margin = "0 auto"),
      (e.style.boxSizing = "border-box"),
      (e.style.background = "transparent"),
      (e.style.border = "0"),
      (e.style.borderRadius = "0"),
      (e.style.boxShadow = "none"),
      (e.style.alignItems = "center"),
      (e.style.padding = "0"),
      (e.style.cursor = "default"),
      (e.style.display = "inline-flex"),
      (e.style.justifyContent = "center"),
      (e.style.flexDirection = show_usd ? "column" : "row"),
      (e.style.gap = show_usd ? "6px" : "8px"),
      (e.style.letterSpacing = "0"),
      (e.style.whiteSpace = show_usd ? "normal" : "nowrap"),
      (e.style.flexWrap = "nowrap");
    let top_row = `${show_rap ? chip("RAP", rap_amount, rap_percent, show_rap_percent, rap_icon) : ""}${chip("Value", value_amount, value_percent, show_value_percent, value_icon)}`;
    return (
      (e.innerHTML = show_usd
        ? `<span style="display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;">${top_row}</span><span style="display:inline-flex;align-items:center;justify-content:center;">${chip("USD", usd_amount, usd_percent, show_usd_percent, usd_icon, "$")}</span>`
        : top_row),
      e
    );
  }
  function h() {
    clear_trade_win_loss_detail_mount();
    clear_trade_win_loss_send_mount();
    let row = document.getElementById("winLossStatsContainer");
    row && (c.destroyTooltips(row), row.remove());
  }
  async function get_trade_offer_value_totals(e) {
    if (!(e instanceof Element)) return null;
    if (e.classList.contains("trade-list-detail-offer") || e.querySelector(".item-card-container")) return await c.calculateValueTotalDetails(e, !0);
    if (e.classList.contains("trade-request-window-offer") || e.querySelector('[ng-repeat="slot in offer.slots"], [name="robux"]'))
      return await c.calculateValueTotalSendOrCounter(e, !0);
    return null;
  }
  async function v(e, use_post_tax = !1) {
    let totals = await get_trade_offer_value_totals(e);
    return Array.isArray(totals) ? c.apply_trade_difference_total(totals[0], totals[1], use_post_tax) : void 0;
  }
  var c = (s("eFyFE"), s("eFyFE"), s("eFyFE")),
    x = {};
  (n = x),
    (a = (e) => {
      var t,
        r,
        n,
        a,
        o = (e, t) => {
          if (e === C) return C;
          var r = e.target,
            n = r.length,
            a = e._indexes;
          a = a.slice(0, a.len).sort((e, t) => e - t);
          for (var o = "", i = 0, l = 0, s = !1, e = [], d = 0; d < n; ++d) {
            var c = r[d];
            if (a[l] === d) {
              if ((++l, s || ((s = !0), e.push(o), (o = "")), l === a.length)) {
                (o += c), e.push(t(o, i++)), (o = ""), e.push(r.substr(d + 1));
                break;
              }
            } else s && ((s = !1), e.push(t(o, i++)), (o = ""));
            o += c;
          }
          return e;
        },
        i = (e) => {
          "string" != typeof e && (e = "");
          var t = p(e);
          return {
            target: e,
            _targetLower: t._lower,
            _targetLowerCodes: t.lowerCodes,
            _nextBeginningIndexes: C,
            _bitflags: t.bitflags,
            score: C,
            _indexes: [0],
            obj: C,
          };
        },
        l = (e) => {
          "string" != typeof e && (e = "");
          var t = p((e = e.trim())),
            r = [];
          if (t.containsSpace) {
            var n = e.split(/\s+/);
            n = [...new Set(n)];
            for (var a = 0; a < n.length; a++)
              if ("" !== n[a]) {
                var o = p(n[a]);
                r.push({
                  lowerCodes: o.lowerCodes,
                  _lower: n[a].toLowerCase(),
                  containsSpace: !1,
                });
              }
          }
          return {
            lowerCodes: t.lowerCodes,
            bitflags: t.bitflags,
            containsSpace: t.containsSpace,
            _lower: t._lower,
            spaceSearches: r,
          };
        },
        s = (e) => {
          if (e.length > 999) return i(e);
          var t = y.get(e);
          return void 0 !== t || ((t = i(e)), y.set(e, t)), t;
        },
        d = (e) => {
          if (e.length > 999) return l(e);
          var t = h.get(e);
          return void 0 !== t || ((t = l(e)), h.set(e, t)), t;
        },
        c = (e, t, r) => {
          var n = [];
          n.total = t.length;
          var a = (r && r.limit) || S;
          if (r && r.key)
            for (var o = 0; o < t.length; o++) {
              var i = t[o],
                l = w(i, r.key);
              if (l) {
                E(l) || (l = s(l)), (l.score = k), (l._indexes.len = 0);
                var d = l;
                if (
                  ((d = {
                    target: d.target,
                    _targetLower: "",
                    _targetLowerCodes: C,
                    _nextBeginningIndexes: C,
                    _bitflags: 0,
                    score: l.score,
                    _indexes: C,
                    obj: i,
                  }),
                  n.push(d),
                  n.length >= a)
                )
                  break;
              }
            }
          else if (r && r.keys)
            for (var o = 0; o < t.length; o++) {
              for (var i = t[o], c = Array(r.keys.length), u = r.keys.length - 1; u >= 0; --u) {
                var l = w(i, r.keys[u]);
                if (!l) {
                  c[u] = C;
                  continue;
                }
                E(l) || (l = s(l)), (l.score = k), (l._indexes.len = 0), (c[u] = l);
              }
              if (((c.obj = i), (c.score = k), n.push(c), n.length >= a)) break;
            }
          else
            for (var o = 0; o < t.length; o++) {
              var l = t[o];
              if (l && (E(l) || (l = s(l)), (l.score = k), (l._indexes.len = 0), n.push(l), n.length >= a)) break;
            }
          return n;
        },
        u = (e, t, r = !1) => {
          if (!1 === r && e.containsSpace) return m(e, t);
          for (var n = e._lower, a = e.lowerCodes, o = a[0], i = t._targetLowerCodes, l = a.length, s = i.length, d = 0, c = 0, u = 0; ; ) {
            var p = o === i[c];
            if (p) {
              if (((v[u++] = c), ++d === l)) break;
              o = a[d];
            }
            if (++c >= s) return C;
          }
          var d = 0,
            f = !1,
            y = 0,
            h = t._nextBeginningIndexes;
          h === C && (h = t._nextBeginningIndexes = g(t.target));
          var b = 0;
          if ((c = 0 === v[0] ? 0 : h[v[0] - 1]) !== s)
            for (;;)
              if (c >= s) {
                if (d <= 0 || ++b > 200) break;
                --d, (c = h[x[--y]]);
              } else {
                var p = a[d] === i[c];
                if (p) {
                  if (((x[y++] = c), ++d === l)) {
                    f = !0;
                    break;
                  }
                  ++c;
                } else c = h[c];
              }
          var w = t._targetLower.indexOf(n, v[0]),
            E = ~w;
          if (E && !f) for (var S = 0; S < u; ++S) v[S] = w + S;
          var k = !1;
          if ((E && (k = t._nextBeginningIndexes[w - 1] === w), f))
            var T = x,
              I = y;
          else
            var T = v,
              I = u;
          for (var q = 0, B = 0, S = 1; S < l; ++S) T[S] - T[S - 1] != 1 && ((q -= T[S]), ++B);
          if (((q -= (12 + (T[l - 1] - T[0] - (l - 1))) * B), 0 !== T[0] && (q -= T[0] * T[0] * 0.2), f)) {
            for (var A = 1, S = h[0]; S < s; S = h[S]) ++A;
            A > 24 && (q *= (A - 24) * 10);
          } else q *= 1e3;
          E && (q /= 1 + l * l * 1), k && (q /= 1 + l * l * 1), (q -= s - l), (t.score = q);
          for (var S = 0; S < I; ++S) t._indexes[S] = T[S];
          return (t._indexes.len = I), t;
        },
        m = (e, t) => {
          for (var r = new Set(), n = 0, a = C, o = 0, i = e.spaceSearches, l = 0; l < i.length; ++l) {
            if ((a = u(i[l], t)) === C) return C;
            (n += a.score), a._indexes[0] < o && (n -= o - a._indexes[0]), (o = a._indexes[0]);
            for (var s = 0; s < a._indexes.len; ++s) r.add(a._indexes[s]);
          }
          var d = u(e, t, !0);
          if (d !== C && d.score > n) return d;
          a.score = n;
          var l = 0;
          for (let e of r) a._indexes[l++] = e;
          return (a._indexes.len = l), a;
        },
        p = (e) => {
          for (var t = e.length, r = e.toLowerCase(), n = [], a = 0, o = !1, i = 0; i < t; ++i) {
            var l = (n[i] = r.charCodeAt(i));
            if (32 === l) {
              o = !0;
              continue;
            }
            a |= 1 << (l >= 97 && l <= 122 ? l - 97 : l >= 48 && l <= 57 ? 26 : l <= 127 ? 30 : 31);
          }
          return { lowerCodes: n, bitflags: a, containsSpace: o, _lower: r };
        },
        f = (e) => {
          for (var t = e.length, r = [], n = 0, a = !1, o = !1, i = 0; i < t; ++i) {
            var l = e.charCodeAt(i),
              s = l >= 65 && l <= 90,
              d = s || (l >= 97 && l <= 122) || (l >= 48 && l <= 57),
              c = (s && !a) || !o || !d;
            (a = s), (o = d), c && (r[n++] = i);
          }
          return r;
        },
        g = (e) => {
          for (var t = e.length, r = f(e), n = [], a = r[0], o = 0, i = 0; i < t; ++i)
            a > i ? (n[i] = a) : ((a = r[++o]), (n[i] = void 0 === a ? t : a));
          return n;
        },
        y = new Map(),
        h = new Map(),
        v = [],
        x = [],
        b = (e) => {
          for (var t = k, r = e.length, n = 0; n < r; ++n) {
            var a = e[n];
            if (a !== C) {
              var o = a.score;
              o > t && (t = o);
            }
          }
          return t === k ? C : t;
        },
        w = (e, t) => {
          var r = e[t];
          if (void 0 !== r) return r;
          var n = t;
          Array.isArray(t) || (n = t.split("."));
          for (var a = n.length, o = -1; e && ++o < a; ) e = e[n[o]];
          return e;
        },
        E = (e) => "object" == typeof e,
        S = 1 / 0,
        k = -1 / 0,
        T = [];
      T.total = 0;
      var C = null,
        I =
          ((t = []),
          (r = 0),
          (n = {}),
          (a = (e) => {
            for (var n = 0, a = t[n], o = 1; o < r; ) {
              var i = o + 1;
              (n = o), i < r && t[i].score < t[o].score && (n = i), (t[(n - 1) >> 1] = t[n]), (o = 1 + (n << 1));
            }
            for (var l = (n - 1) >> 1; n > 0 && a.score < t[l].score; l = ((n = l) - 1) >> 1) t[n] = t[l];
            t[n] = a;
          }),
          (n.add = (e) => {
            var n = r;
            t[r++] = e;
            for (var a = (n - 1) >> 1; n > 0 && e.score < t[a].score; a = ((n = a) - 1) >> 1) t[n] = t[a];
            t[n] = e;
          }),
          (n.poll = (e) => {
            if (0 !== r) {
              var n = t[0];
              return (t[0] = t[--r]), a(), n;
            }
          }),
          (n.peek = (e) => {
            if (0 !== r) return t[0];
          }),
          (n.replaceTop = (e) => {
            (t[0] = e), a();
          }),
          n);
      return {
        single: (e, t) => {
          if ("farzher" == e)
            return {
              target: "farzher was here (^-^*)/",
              score: 0,
              _indexes: [0],
            };
          if (!e || !t) return C;
          var r = d(e);
          E(t) || (t = s(t));
          var n = r.bitflags;
          return (n & t._bitflags) !== n ? C : u(r, t);
        },
        go: (e, t, r) => {
          if ("farzher" == e)
            return [
              {
                target: "farzher was here (^-^*)/",
                score: 0,
                _indexes: [0],
                obj: t ? t[0] : C,
              },
            ];
          if (!e) return r && r.all ? c(e, t, r) : T;
          var n = d(e),
            a = n.bitflags;
          n.containsSpace;
          var o = (r && r.threshold) || k,
            i = (r && r.limit) || S,
            l = 0,
            m = 0,
            p = t.length;
          if (r && r.key)
            for (var f = r.key, g = 0; g < p; ++g) {
              var y = t[g],
                h = w(y, f);
              if (h && (E(h) || (h = s(h)), (a & h._bitflags) === a)) {
                var v = u(n, h);
                v !== C &&
                  !(v.score < o) &&
                  ((v = {
                    target: v.target,
                    _targetLower: "",
                    _targetLowerCodes: C,
                    _nextBeginningIndexes: C,
                    _bitflags: 0,
                    score: v.score,
                    _indexes: v._indexes,
                    obj: y,
                  }),
                  l < i ? (I.add(v), ++l) : (++m, v.score > I.peek().score && I.replaceTop(v)));
              }
            }
          else if (r && r.keys)
            for (var x = r.scoreFn || b, q = r.keys, B = q.length, g = 0; g < p; ++g) {
              for (var y = t[g], A = Array(B), L = 0; L < B; ++L) {
                var f = q[L],
                  h = w(y, f);
                if (!h) {
                  A[L] = C;
                  continue;
                }
                E(h) || (h = s(h)), (a & h._bitflags) !== a ? (A[L] = C) : (A[L] = u(n, h));
              }
              A.obj = y;
              var N = x(A);
              N !== C && !(N < o) && ((A.score = N), l < i ? (I.add(A), ++l) : (++m, N > I.peek().score && I.replaceTop(A)));
            }
          else
            for (var g = 0; g < p; ++g) {
              var h = t[g];
              if (h && (E(h) || (h = s(h)), (a & h._bitflags) === a)) {
                var v = u(n, h);
                v !== C && !(v.score < o) && (l < i ? (I.add(v), ++l) : (++m, v.score > I.peek().score && I.replaceTop(v)));
              }
            }
          if (0 === l) return T;
          for (var F = Array(l), g = l - 1; g >= 0; --g) F[g] = I.poll();
          return (F.total = l + m), F;
        },
        highlight: (e, t, r) => {
          if ("function" == typeof t) return o(e, t);
          if (e === C) return C;
          void 0 === t && (t = "<b>"), void 0 === r && (r = "</b>");
          var n = "",
            a = 0,
            i = !1,
            l = e.target,
            s = l.length,
            d = e._indexes;
          d = d.slice(0, d.len).sort((e, t) => e - t);
          for (var c = 0; c < s; ++c) {
            var u = l[c];
            if (d[a] === c) {
              if ((++a, i || ((i = !0), (n += t)), a === d.length)) {
                n += u + r + l.substr(c + 1);
                break;
              }
            } else i && ((i = !1), (n += r));
            n += u;
          }
          return n;
        },
        prepare: i,
        indexes: (e) => e._indexes.slice(0, e._indexes.len).sort((e, t) => e - t),
        cleanup: () => {
          y.clear(), h.clear(), (v = []), (x = []);
        },
      };
    }),
    "function" == typeof define && define.amd ? define([], a) : x ? (x = a()) : (n.fuzzysort = a());
  let b = {};
  let search_inv_cache = {};
  let search_inst_cache = {};
  let search_thumb_cache = {};
  function normalize_trade_search_text(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[#,()\-:'"`._/\\]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function compact_trade_search_text(value) {
    return normalize_trade_search_text(value).replace(/\s+/g, "");
  }
  function is_trade_search_subsequence(query, text) {
    let e = compact_trade_search_text(query),
      t = compact_trade_search_text(text);
    if (!e || !t) return !1;
    let r = 0;
    for (let n = 0; n < t.length && r < e.length; n++) t[n] === e[r] && r++;
    return r === e.length;
  }
  function parse_trade_search_demand_filter(value) {
    let e = compact_trade_search_text(value);
    if (!e) return null;
    if (/^-?\d+$/.test(e)) {
      let t = parseInt(e, 10);
      return { min: t, max: t, label: t < 0 ? "No Demand" : `Demand ${t}` };
    }
    switch (e) {
      case "none":
      case "nodemand":
      case "na":
        return { min: -1, max: -1, label: "No Demand" };
      case "terrible":
      case "worst":
        return { min: 0, max: 0, label: "Terrible Demand" };
      case "low":
        return { min: 1, max: 1, label: "Low Demand" };
      case "normal":
      case "medium":
      case "mid":
      case "good":
      case "decent":
        return { min: 2, max: 2, label: "Normal Demand" };
      case "high":
        return { min: 3, max: 3, label: "High Demand" };
      case "highplus":
      case "strong":
        return { min: 3, max: 4, label: "High+ Demand" };
      case "amazing":
        return { min: 4, max: 4, label: "Amazing Demand" };
      default:
        return null;
    }
  }
  function parse_trade_search_number_value(value) {
    let e = String(value ?? "")
      .toLowerCase()
      .trim()
      .replace(/,/g, "")
      .replace(/^#+/, "");
    if (!e) return NaN;
    let t = 1;
    if (e.endsWith("k")) (t = 1e3), (e = e.slice(0, -1));
    else if (e.endsWith("m")) (t = 1e6), (e = e.slice(0, -1));
    else if (e.endsWith("b")) (t = 1e9), (e = e.slice(0, -1));
    if (!/^-?\d+(?:\.\d+)?$/.test(e)) return NaN;
    let r = Math.round(parseFloat(e) * t);
    return Number.isFinite(r) ? r : NaN;
  }
  function parse_trade_search_numeric_range(op, value) {
    let e = parse_trade_search_number_value(value);
    if (!Number.isFinite(e)) return null;
    switch (op) {
      case ">":
        return { min: e + 1, max: Infinity };
      case ">=":
        return { min: e, max: Infinity };
      case "<":
        return { min: -Infinity, max: e - 1 };
      case "<=":
        return { min: -Infinity, max: e };
      default:
        return { min: e, max: e };
    }
  }
  function parse_trade_search_spaced_operator_value(tokens, idx) {
    let next = String(tokens?.[idx + 1] ?? "").trim(),
      after = String(tokens?.[idx + 2] ?? "").trim();
    if (!next) return null;
    let combined = next.match(/^(<=|>=|=|:|<|>)(.+)$/);
    if (combined && combined[2]) return { op: combined[1], value: combined[2], consumed: 1 };
    if (/^(<=|>=|=|:|<|>)$/.test(next) && after) return { op: next, value: after, consumed: 2 };
    return null;
  }
  function parse_trade_search_spaced_filter_value(tokens, idx) {
    let next = String(tokens?.[idx + 1] ?? "").trim(),
      after = String(tokens?.[idx + 2] ?? "").trim();
    if (!next) return null;
    let prefixed = next.match(/^(?:=|:)(.+)$/);
    if (prefixed && prefixed[1]) return { value: prefixed[1], consumed: 1 };
    if (/^(?:=|:)$/.test(next) && after) return { value: after, consumed: 2 };
    return { value: next, consumed: 1 };
  }
  function parse_trade_search_spaced_numeric_filter(tokens, idx) {
    let parsed = parse_trade_search_spaced_operator_value(tokens, idx);
    if (!parsed) return null;
    let range = parse_trade_search_numeric_range(parsed.op, parsed.value);
    return range ? { range, consumed: parsed.consumed } : null;
  }
  function is_trade_search_number_in_range(value, range) {
    let e = Number(value);
    return !!range && Number.isFinite(e) && e >= (range.min ?? -Infinity) && e <= (range.max ?? Infinity);
  }
  function get_trade_search_demand_label(value) {
    switch (Number(value)) {
      case 0:
        return "Terrible";
      case 1:
        return "Low";
      case 2:
        return "Normal";
      case 3:
        return "High";
      case 4:
        return "Amazing";
      default:
        return "No";
    }
  }
  function trade_sales_hover_demand_value_class(label) {
    switch (String(label || "").toLowerCase()) {
      case "terrible":
        return "is-terrible";
      case "low":
        return "is-low";
      case "normal":
        return "is-normal";
      case "good":
        return "is-good";
      case "high":
        return "is-high";
      case "amazing":
        return "is-amazing";
      default:
        return "is-none";
    }
  }
  function get_trade_search_item_meta(item) {
    let tid = item?.targetId ?? item?.itemTarget?.targetId ?? item?.assetId ?? item?.itemId ?? 0;
    let e = `${item?.collectibleItemInstanceId || ""}:${tid}:${item?.name || item?.itemName || ""}:${item?.rap || item?.recentAveragePrice || 0}`;
    if (item?.__nteSearchMeta && item.__nteSearchMetaKey === e) return item.__nteSearchMeta;
    let t = c.resolveRolimonsItemId(tid, item?.name || item?.itemName, item?.itemType === "Bundle" || item?.itemTarget?.itemType === "Bundle"),
      r = null != t ? c.getRolimonsData()?.items?.[t] : null,
      n = normalize_trade_search_text(item?.name),
      a = n.split(" ").filter(Boolean),
      o = a.join(""),
      i = a.map((e) => e[0] || "").join(""),
      l = compact_trade_search_text(Array.isArray(r) ? r[1] : ""),
      s = Array.isArray(r) && Number(r[3]) >= 0,
      d = Array.isArray(r) ? Number(r[5]) : -1,
      u = Array.isArray(r) ? Number(r[6]) : -1,
      m = {
        rolimonsId: t,
        rolData: r,
        normalizedName: n,
        compactName: o,
        words: a,
        initials: i,
        acronym: l,
        hasValue: s,
        demand: d,
        demandLabel: get_trade_search_demand_label(d),
        trend: u,
        isProjected: 1 === r?.[7],
        isHyped: 1 === r?.[8],
        isRare: 1 === r?.[9],
        value: c.getValueOrRAP(tid, item?.name || item?.itemName, item?.rap ?? item?.recentAveragePrice),
      };
    return item && ((item.__nteSearchMetaKey = e), (item.__nteSearchMeta = m), (item.rolimonsId = t)), m;
  }
  const trade_rap_signal_value_ladder = (() => {
    let steps = [4e3, 4500];
    for (let value = 5e3; value <= 16e3; value += 1e3) steps.push(value);
    for (let value = 18e3; value <= 32e3; value += 2e3) steps.push(value);
    steps.push(35e3, 38e3, 4e4, 42e3, 45e3, 48e3, 5e4);
    for (let value = 55e3; value <= 1e5; value += 5e3) steps.push(value);
    let next = Object.create(null),
      prev = Object.create(null),
      index = Object.create(null);
    for (let i = 0; i < steps.length; i++) {
      let value = steps[i];
      index[value] = i;
      i > 0 && (prev[value] = steps[i - 1]);
      i < steps.length - 1 && (next[value] = steps[i + 1]);
    }
    return { steps, next, prev, index };
  })();
  function get_trade_rap_signal_supported_value(rap) {
    let value = parseInt(rap ?? 0, 10),
      steps = trade_rap_signal_value_ladder.steps;
    if (!Number.isFinite(value) || value < 1 || !steps.length) return 0;
    if (value < steps[0]) return steps[0];
    for (let i = steps.length - 1; i >= 0; i--) if (value >= steps[i]) return trade_rap_signal_value_ladder.next[steps[i]] || steps[i];
    return steps[0];
  }
  function get_trade_rap_signal_info(ctx) {
    let rap = parseInt(ctx?.rap ?? 0, 10),
      value = parseInt(ctx?.value ?? 0, 10),
      demand_label = String(ctx?.demand_label || ctx?.demandLabel || "").trim().toLowerCase(),
      hold_floor = trade_rap_signal_value_ladder.prev[value] || 0;
    if (!ctx?.has_value || !Number.isFinite(rap) || rap < 1 || !Number.isFinite(value) || value < 4e3 || value >= 1e5 || (!trade_rap_signal_value_ladder.next[value] && !hold_floor)) return null;
    if (ctx?.is_projected || ctx?.isProjected) return null;
    if ("terrible" === demand_label) return null;
    let target_value = get_trade_rap_signal_supported_value(rap),
      value_tier = trade_rap_signal_value_ladder.index[value],
      target_tier = trade_rap_signal_value_ladder.index[target_value];
    if (!Number.isFinite(value_tier) || !Number.isFinite(target_tier) || value_tier === target_tier) return null;
    let tier_delta = target_tier - value_tier;
    if (tier_delta >= 2 || tier_delta <= -3) return null;
    if (target_value > value)
      return {
        is_over: !0,
        label: "Might Raise",
        badge_class: "good",
        hold_floor,
        target_value,
        over_by: Math.max(rap - value, 0),
        tier_delta,
      };
    if (target_value < value && hold_floor && rap >= hold_floor * 0.98) return null;
    if (target_value < value && hold_floor)
      return {
        is_over: !1,
        label: "Might Drop",
        badge_class: "danger",
        hold_floor,
        target_value,
        below_floor_by: Math.max(hold_floor - rap, 0),
        tier_delta,
      };
    return null;
  }
  function parse_trade_search_query(query) {
    let e = {
      rawQuery: String(query || ""),
      textTerms: [],
      filters: {
        rare: !1,
        projected: !1,
        rapOnly: !1,
        valued: !1,
        onHold: !1,
        serial: !1,
        serialNumber: null,
        hyped: !1,
        itemType: null,
        demand: null,
        valueRange: null,
        rapRange: null,
        targetId: null,
      },
    };
    let tokens = String(query || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    for (let idx = 0; idx < tokens.length; idx++) {
      let t = tokens[idx];
      let r = String(t || "")
          .toLowerCase()
          .trim(),
        n = compact_trade_search_text(t),
        a = r.match(/^demand(?:=|:)(.+)$/),
        i = r.match(/^serial(?:=|:)(.+)$/),
        l = r.match(/^#(\d+)$/),
        s = r.match(/^(?:value|values|val|v)(<=|>=|=|:|<|>)(.+)$/),
        d = r.match(/^(?:rap)(<=|>=|=|:|<|>)(.+)$/),
        u = r.match(/^(?:id|itemid|assetid|targetid)(?:=|:)(.+)$/),
        o = !1;
      if (["value", "values", "val", "v"].includes(n)) {
        let parsed = parse_trade_search_spaced_numeric_filter(tokens, idx);
        if (parsed) {
          e.filters.valueRange = parsed.range;
          idx += parsed.consumed;
          continue;
        }
      } else if (["rap"].includes(n)) {
        let parsed = parse_trade_search_spaced_numeric_filter(tokens, idx);
        if (parsed) {
          e.filters.rapRange = parsed.range;
          idx += parsed.consumed;
          continue;
        }
      } else if (["id", "itemid", "assetid", "targetid"].includes(n)) {
        let parsed = parse_trade_search_spaced_filter_value(tokens, idx),
          value = parse_trade_search_number_value(parsed?.value);
        if (parsed && Number.isFinite(value)) {
          e.filters.targetId = value;
          idx += parsed.consumed;
          continue;
        }
      } else if (["serial", "serials"].includes(n)) {
        let parsed = parse_trade_search_spaced_filter_value(tokens, idx),
          value = parse_trade_search_number_value(parsed?.value);
        if (parsed && Number.isFinite(value)) {
          e.filters.serial = !0;
          e.filters.serialNumber = value;
          idx += parsed.consumed;
          continue;
        }
      } else if (["demand"].includes(n)) {
        let parsed = parse_trade_search_spaced_filter_value(tokens, idx),
          demand = parse_trade_search_demand_filter(parsed?.value);
        if (parsed && demand) {
          e.filters.demand = demand;
          idx += parsed.consumed;
          continue;
        }
      }
      if (l) {
        let m = parse_trade_search_number_value(l[1]);
        Number.isFinite(m) && ((e.filters.serial = !0), (e.filters.serialNumber = m), (o = !0));
      } else if (i) {
        let t = parse_trade_search_number_value(i[1]);
        Number.isFinite(t) && ((e.filters.serial = !0), (e.filters.serialNumber = t), (o = !0));
      } else if (s) {
        let r = parse_trade_search_numeric_range(s[1], s[2]);
        r && ((e.filters.valueRange = r), (o = !0));
      } else if (d) {
        let n = parse_trade_search_numeric_range(d[1], d[2]);
        n && ((e.filters.rapRange = n), (o = !0));
      } else if (u) {
        let a = parse_trade_search_number_value(u[1]);
        Number.isFinite(a) && ((e.filters.targetId = a), (o = !0));
      } else if (a) {
        (e.filters.demand = parse_trade_search_demand_filter(a[1])), (o = !!e.filters.demand);
      } else
        ["rare", "rares"].includes(n)
          ? ((e.filters.rare = !0), (o = !0))
          : ["proj", "projs", "projected", "projecteds"].includes(n)
            ? ((e.filters.projected = !0), (o = !0))
            : ["rap", "raps", "raponly", "raponlyitems", "rapitems"].includes(n)
              ? ((e.filters.rapOnly = !0), (o = !0))
              : ["value", "values", "valued", "valueonly", "valuedonly"].includes(n)
                ? ((e.filters.valued = !0), (o = !0))
                : ["hold", "holds", "onhold", "onholds"].includes(n)
                  ? ((e.filters.onHold = !0), (o = !0))
                  : ["serial", "serials", "numbered", "numberedonly"].includes(n)
                    ? ((e.filters.serial = !0), (o = !0))
                    : ["hyped", "hype"].includes(n)
                      ? ((e.filters.hyped = !0), (o = !0))
                      : ["bundle", "bundles"].includes(n)
                        ? ((e.filters.itemType = "Bundle"), (o = !0))
                        : ["asset", "assets"].includes(n) && ((e.filters.itemType = "Asset"), (o = !0));
      o || (n && e.textTerms.push(n));
    }
    return e;
  }
  function get_trade_search_term_score(meta, term) {
    return !term
      ? 0
      : meta.acronym === term || meta.initials === term || meta.compactName === term
        ? 0
        : meta.acronym && meta.acronym.startsWith(term)
          ? 1
          : meta.initials && meta.initials.startsWith(term)
            ? 1
            : meta.words.some((e) => e.startsWith(term))
              ? 2
              : meta.normalizedName.includes(term)
                ? 3
                : meta.compactName.includes(term)
                  ? 4
                  : term.length <= 4 &&
                      (is_trade_search_subsequence(term, meta.acronym) ||
                        is_trade_search_subsequence(term, meta.initials) ||
                        is_trade_search_subsequence(term, meta.compactName))
                    ? 5
                    : 99;
  }
  function does_trade_search_item_match(item, parsed) {
    let e = get_trade_search_item_meta(item),
      t = parsed?.filters || {},
      r = Number(item?.targetId ?? item?.itemTarget?.targetId ?? item?.assetId ?? item?.itemId ?? 0),
      n = Number(item?.rap ?? item?.recentAveragePrice ?? 0),
      a = e.hasValue ? e.value : NaN,
      o = Number(item?.serialNumber);
    if (t.rare && !e.isRare) return !1;
    if (t.projected && !e.isProjected) return !1;
    if (t.rapOnly && e.hasValue) return !1;
    if (t.valued && !e.hasValue) return !1;
    if (t.onHold && !item.isOnHold) return !1;
    if (t.serial && null == item.serialNumber) return !1;
    if (null != t.serialNumber && o !== t.serialNumber) return !1;
    if (t.hyped && !e.isHyped) return !1;
    if (t.itemType && item.itemType !== t.itemType) return !1;
    if (t.demand && !(Number.isFinite(e.demand) && e.demand >= t.demand.min && e.demand <= t.demand.max)) return !1;
    if (t.valueRange && !is_trade_search_number_in_range(a, t.valueRange)) return !1;
    if (t.rapRange && !is_trade_search_number_in_range(n, t.rapRange)) return !1;
    if (null != t.targetId && r !== t.targetId && Number(e.rolimonsId) !== t.targetId) return !1;
    return parsed.textTerms.every((t) => get_trade_search_term_score(e, t) < 99);
  }
  function get_trade_search_rank(item, parsed) {
    let e = get_trade_search_item_meta(item);
    return parsed.textTerms.length ? parsed.textTerms.reduce((t, r) => t + get_trade_search_term_score(e, r), 0) : 50;
  }
  function cache_search_item(item) {
    let inst_id = item?.collectibleItemInstanceId;
    inst_id && (search_inst_cache[String(inst_id)] = item);
    return item;
  }
  function get_cached_search_item_by_inst(inst_id) {
    return inst_id ? search_inst_cache[String(inst_id)] || null : null;
  }
  function get_cached_search_item_from_el(element) {
    if (!(element instanceof Element) || "function" != typeof find_collectible_item_instance_id) return null;
    return get_cached_search_item_by_inst(find_collectible_item_instance_id(element));
  }
  function get_trade_el_value_ctx(element, fallback_target_id = null, fallback_name = null, fallback_rap = 0) {
    let cached = get_cached_search_item_from_el(element);
    return {
      targetId: fallback_target_id || cached?.targetId || null,
      name: fallback_name || cached?.name || null,
      rap: fallback_rap || cached?.rap || 0,
      itemType: cached?.itemType || null,
      collectibleItemId: cached?.collectibleItemId || null,
      collectibleItemInstanceId: cached?.collectibleItemInstanceId || null,
    };
  }
  async function fetch_tradable_items(user_id) {
    if (search_inv_cache[user_id]) return search_inv_cache[user_id];
    if (search_inv_cache[user_id + "_loading"]) return search_inv_cache[user_id + "_loading"];
    search_inv_cache[user_id + "_loading"] = (async () => {
      let all = [],
        cursor = "";
      try {
        do {
          let params = new URLSearchParams({ sortBy: "CreationTime", cursor, limit: "50", sortOrder: "Desc" });
          let resp = await fetch(`https://trades.roblox.com/v2/users/${user_id}/tradableitems?${params.toString()}`, { credentials: "include" });
          if (429 === resp.status || resp.status >= 500) {
            await U(500);
            continue;
          }
          if (!resp.ok) break;
          let data = await resp.json();
          let page_items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.data) ? data.data : [];
          for (let item of page_items) {
            let { instances: _ignored_instances, ...item_base } = item || {};
            let instances = Array.isArray(item.instances) && item.instances.length ? item.instances : [item];
            for (let inst of instances) {
              let target = inst?.itemTarget || item_base.itemTarget || {};
              let norm_item = {
                ...item_base,
                ...(inst || {}),
                itemTarget: { ...(item_base.itemTarget || {}), ...(inst?.itemTarget || {}) },
                name: inst?.name || inst?.itemName || item_base.name || item_base.itemName || "Unknown",
                itemName: inst?.itemName || inst?.name || item_base.itemName || item_base.name || "Unknown",
                targetId:
                  parseInt(target.targetId ?? inst?.targetId ?? item_base.targetId ?? inst?.assetId ?? item_base.assetId ?? 0, 10) || 0,
                itemType: target.itemType || inst?.itemType || item_base.itemType || "Asset",
                rap: parseInt(inst?.rap ?? inst?.recentAveragePrice ?? item_base.rap ?? item_base.recentAveragePrice ?? 0, 10) || 0,
                recentAveragePrice:
                  parseInt(inst?.recentAveragePrice ?? inst?.rap ?? item_base.recentAveragePrice ?? item_base.rap ?? 0, 10) || 0,
                collectibleItemId: item_base.collectibleItemId || inst?.collectibleItemId || null,
                collectibleItemInstanceId: inst?.collectibleItemInstanceId || item_base.collectibleItemInstanceId || null,
                serialNumber: inst?.serialNumber ?? item_base.serialNumber ?? null,
                originalPrice: inst?.originalPrice ?? item_base.originalPrice ?? null,
                assetStock: parseInt(inst?.assetStock ?? item_base.assetStock ?? 0, 10) || 0,
                isOnHold: !!(inst?.isOnHold ?? item_base.isOnHold),
                userAssetId:
                  parseInt(
                    inst?.userAssetId ??
                      inst?.userAsset?.id ??
                      inst?.userAsset?.userAssetId ??
                      inst?.id ??
                      item_base.userAssetId ??
                      item_base.userAsset?.id ??
                      item_base.userAsset?.userAssetId ??
                      item_base.id ??
                      0,
                    10,
                  ) || 0,
              };
              all.push(norm_item), cache_search_item(norm_item);
            }
          }
          cursor = data.nextPageCursor || "";
        } while (cursor);
      } catch (err) {
        console.error("[NRU] Failed to fetch tradable items", err);
      }
      search_inv_cache[user_id] = all;
      delete search_inv_cache[user_id + "_loading"];
      "function" == typeof N &&
        c?.getPageType &&
        -1 !== ["details", "sendOrCounter"].indexOf(c.getPageType()) &&
        setTimeout(() => {
          try {
            N();
          } catch {}
        }, 0);
      return all;
    })();
    return search_inv_cache[user_id + "_loading"];
  }
  async function fetch_search_thumbs(items) {
    let needed = items.filter((i) => !search_thumb_cache[i.itemType + ":" + i.targetId]).slice(0, 50);
    if (!needed.length) return !1;
    let asset_ids = needed.filter((i) => i.itemType === "Asset").map((i) => i.targetId);
    let bundle_ids = needed.filter((i) => i.itemType === "Bundle").map((i) => i.targetId);
    let fetches = [];
    if (asset_ids.length) {
      fetches.push(
        fetch(`https://thumbnails.roblox.com/v1/assets?assetIds=${asset_ids.join(",")}&size=110x110&format=Png&isCircular=false`, {
          credentials: "include",
        })
          .then((r) => (r.ok ? r.json() : { data: [] }))
          .then((j) => {
            for (let d of j.data || []) search_thumb_cache["Asset:" + d.targetId] = d.imageUrl || "";
          }),
      );
    }
    if (bundle_ids.length) {
      fetches.push(
        fetch(`https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${bundle_ids.join(",")}&size=150x150&format=Png&isCircular=false`, {
          credentials: "include",
        })
          .then((r) => (r.ok ? r.json() : { data: [] }))
          .then((j) => {
            for (let d of j.data || []) search_thumb_cache["Bundle:" + d.targetId] = d.imageUrl || "";
          }),
      );
    }
    await Promise.all(fetches);
    return !0;
  }
  function ensure_demand_styles() {
    document.getElementById("nteDemandTierStyles")?.remove();
    document.getElementById("nteDemandTierStylesV2")?.remove();
    document.getElementById("nteDemandTierStylesV3")?.remove();
    if (document.getElementById("nteDemandTierStylesV4")) return;
    let style = document.createElement("style");
    style.id = "nteDemandTierStylesV4";
    style.textContent = `
      .nte-demand-tier{font-weight:800;letter-spacing:.02em;line-height:inherit;display:inline;vertical-align:baseline}
      .nte-demand-tier.is-none{font-weight:700;opacity:.72}
      .nte-demand-tier.is-terrible{color:#fb7185}
      .nte-demand-tier.is-low{color:#f97316}
      .nte-demand-tier.is-normal{color:#fbbf24}
      .nte-demand-tier.is-good{color:#d4f34a}
      .nte-demand-tier.is-high{color:#c5f167;text-shadow:0 0 10px rgba(190,230,90,.28)}
      .nte-demand-tier.is-amazing{color:#34d399;text-shadow:0 0 16px rgba(52,211,153,.4)}
      .light-theme .nte-demand-tier.is-terrible{color:#e11d48}
      .light-theme .nte-demand-tier.is-low{color:#ea580c}
      .light-theme .nte-demand-tier.is-normal{color:#ca8a04}
      .light-theme .nte-demand-tier.is-good{color:#65a30d}
      .light-theme .nte-demand-tier.is-high{color:#5f8f2a}
      .light-theme .nte-demand-tier.is-amazing{color:#047857}
      .light-theme .nte-demand-tier.is-high,.light-theme .nte-demand-tier.is-amazing{text-shadow:none}
      .nte-search-overlay .nte-sr-stats strong.nte-demand-tier.is-terrible{color:#fb7185}
      .nte-search-overlay .nte-sr-stats strong.nte-demand-tier.is-low{color:#f97316}
      .nte-search-overlay .nte-sr-stats strong.nte-demand-tier.is-normal{color:#fbbf24}
      .nte-search-overlay .nte-sr-stats strong.nte-demand-tier.is-good{color:#d4f34a}
      .nte-search-overlay .nte-sr-stats strong.nte-demand-tier.is-high{color:#c5f167}
      .nte-search-overlay .nte-sr-stats strong.nte-demand-tier.is-amazing{color:#34d399}
      .dark-theme .nte-search-overlay .nte-sr-stats strong.nte-demand-tier.is-high{text-shadow:0 0 10px rgba(190,230,90,.24)}
      .dark-theme .nte-search-overlay .nte-sr-stats strong.nte-demand-tier.is-amazing{text-shadow:0 0 12px rgba(52,211,153,.32)}
    `;
    document.head.appendChild(style);
  }
  function ensure_search_styles() {
    ensure_demand_styles();
    if (document.getElementById("nteSearchOverlayStyle")) return;
    let style = document.createElement("style");
    style.id = "nteSearchOverlayStyle";
    style.textContent = `
      .nte-search-overlay {
        margin-top: 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.08);
        background: var(--nte-search-bg, #fff); overflow-y: auto; padding: 6px;
        max-height: 540px;
      }
      .dark-theme .nte-search-overlay { --nte-search-bg: #232527; }
      .light-theme .nte-search-overlay { --nte-search-bg: #fff; }
      .nte-search-overlay .nte-sr-card {
        display: flex; align-items: center; gap: 10px; padding: 8px 10px;
        border-radius: 8px; cursor: pointer; transition: background 100ms;
      }
      .nte-search-overlay .nte-sr-card:hover { background: rgba(128,128,128,0.15); }
      .nte-search-overlay .nte-sr-card.is-active { background: rgba(59,130,246,0.16); box-shadow: inset 0 0 0 1px rgba(96,165,250,0.45); }
      .nte-search-overlay .nte-sr-card.is-hold { opacity: 0.5; cursor: default; }
      .nte-search-overlay .nte-sr-header {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        padding: 6px 8px 10px; border-bottom: 1px solid rgba(128,128,128,0.12); margin-bottom: 4px;
      }
      .nte-search-overlay .nte-sr-summary { font-size: 12px; color: #8a8f98; }
      .nte-search-overlay .nte-sr-summary strong { color: inherit; font-weight: 800; }
      .nte-search-overlay .nte-sr-hint { font-size: 11px; color: #777; text-align: right; }
      .nte-search-overlay .nte-sr-thumb {
        width: 56px; height: 56px; border-radius: 8px; background: rgba(128,128,128,0.12);
        flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center;
      }
      .nte-search-overlay .nte-sr-thumb img { width: 100%; height: 100%; object-fit: cover; }
      .nte-search-overlay .nte-sr-info { flex: 1; min-width: 0; }
      .nte-search-overlay .nte-sr-name {
        font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .nte-search-overlay .nte-sr-stats { font-size: 11px; color: #888; margin-top: 2px; }
      .nte-search-overlay .nte-sr-stats strong { color: inherit; font-weight: 800; }
      .dark-theme .nte-search-overlay .nte-sr-name { color: #e8e8e8; }
      .dark-theme .nte-search-overlay .nte-sr-stats { color: #999; }
      .dark-theme .nte-search-overlay .nte-sr-stats strong { color: #ccc; }
      .dark-theme .nte-search-overlay .nte-sr-summary { color: #a7abb2; }
      .dark-theme .nte-search-overlay .nte-sr-hint { color: #8c9198; }
      .nte-search-overlay .nte-sr-badge {
        display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;
        margin-left: 6px;
      }
      .nte-search-overlay .nte-sr-badge.hold { background: rgba(255,80,80,0.15); color: #e55; }
      .nte-search-overlay .nte-sr-badge.rare { background: rgba(160,80,255,0.15); color: #a050ff; }
      .nte-search-overlay .nte-sr-badge.projected { background: rgba(255,208,91,0.15); color: #d69b00; }
      .nte-search-overlay .nte-sr-badge.rap { background: rgba(67,156,255,0.15); color: #4a9dff; }
      .nte-search-overlay .nte-sr-loading, .nte-search-overlay .nte-sr-empty {
        padding: 18px 12px; text-align: center; color: #888; font-size: 13px;
      }
      .nte-search-overlay .nte-sr-loading strong { color: inherit; font-weight: 800; }
      .nte-trade-search-wrap { position: relative; width: 100%; max-width: 100%; align-self: flex-start; }
    `;
    document.head.appendChild(style);
  }
  async function w() {
    let r = document.querySelector(".trade-row.selected")?.querySelector(".avatar-card-link")?.pathname;
    if (r) {
      let t = parseInt((r = c.removeTwoLetterPath(r)).substring(c.nthIndex(r, "/", 2) + 1, c.nthIndex(r, "/", 3)));
      t && (e = t);
    }
    if (!(await c.getOption("Trade Window Search")))
      return (
        Array.from(document.getElementsByClassName("rolimons-search")).forEach((e) => {
          (e.closest(".nte-trade-search-wrap") || e.parentElement)?.remove();
        }),
        Array.from(document.querySelectorAll(".inventory-type-dropdown")).forEach((e) => {
          delete e.dataset.nteTradeSearchMounted, delete e.dataset.nteTradeSearchMounting;
        }),
        Array.from(document.getElementsByClassName("nte-search-overlay")).forEach((e) => e.remove()),
        Array.from(
          document.querySelectorAll(".trade-inventory-panel .item-cards, .trade-inventory-panel .pager-holder, .trade-inventory-panel .pager"),
        ).forEach((e) => {
          e.style.removeProperty("display");
        }),
        void 0
      );
    async function n(r) {
      let a = r - 1,
        s = "dark" === c.getColorMode() ? "xDark.svg" : "x.svg",
        u = document.querySelectorAll(".inventory-type-dropdown")[a];
      if (!u) return;
      let m = u.getElementsByClassName("rolimons-search")[0];
      if (m || "true" === u.dataset.nteTradeSearchMounted || "true" === u.dataset.nteTradeSearchMounting) return;
      u.dataset.nteTradeSearchMounting = "true";
      let d = E();
      m = u.getElementsByClassName("rolimons-search")[0];
      let overlay_el = null;
      let search_timer = null;
      let show_values = await c.getOption("Values on Trading Window");
      let show_rare = await c.getOption("Flag Rare Items");
      let show_projected = await c.getOption("Flag Projected Items");
      let search_pending = !1;
      let search_token = 0;
      let active_bridge_id = "";
      let active_status_cleanup = null;
      function esc_search(value) {
        return String(value ?? "").replace(
          /[&<>"']/g,
          (e) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[e],
        );
      }
      function get_panel() {
        return document.getElementsByClassName("trade-inventory-panel")[a];
      }
      function get_item_list() {
        let panel = get_panel();
        if (!panel) return null;
        return panel.querySelector(".item-cards") || panel.querySelector(".item-cards-stackable") || panel.querySelector(".item-list") || null;
      }
      function get_overlay_host() {
        let panel = get_panel(),
          list_el = get_item_list();
        if (!panel) return null;
        return list_el?.parentElement || panel;
      }
      function get_side_user_id() {
        if (1 === r) return t || ((t = parseInt(document.querySelector('meta[name="user-data"]')?.getAttribute("data-userid"))), t);
        return e || ((e = parseInt(window.location.href.split("/").find((v) => !isNaN(parseInt(v))))), e);
      }
      function show_overlay(html) {
        ensure_search_styles();
        let panel = get_panel(),
          list_el = get_item_list(),
          overlay_host = get_overlay_host();
        if (!panel || !overlay_host) return;
        let pager_el = panel.querySelector(".pager-holder");
        if (!overlay_el) {
          overlay_el = document.createElement("div");
          overlay_el.className = "nte-search-overlay";
        }
        if (overlay_el.parentElement !== overlay_host) {
          overlay_el.remove();
          list_el ? overlay_host.insertBefore(overlay_el, list_el) : overlay_host.appendChild(overlay_el);
        }
        overlay_el.innerHTML = html;
        if (list_el) list_el.style.display = "none";
        if (pager_el) pager_el.style.display = "none";
      }
      function hide_overlay() {
        if (overlay_el) overlay_el.remove();
        overlay_el = null;
        let panel = get_panel();
        if (!panel) return;
        let list_el = get_item_list();
        let pager_el = panel.querySelector(".pager-holder");
        if (list_el) list_el.style.removeProperty("display");
        if (pager_el) pager_el.style.removeProperty("display");
      }
      function set_search_busy(is_busy) {
        if (!m) return;
        m.readOnly = !!is_busy;
        m.style.opacity = is_busy ? "0.75" : "";
      }
      function stop_search_status() {
        if ("function" != typeof active_status_cleanup) return;
        try {
          active_status_cleanup();
        } catch {}
        active_status_cleanup = null;
      }
      function is_search_active(token) {
        return !!search_pending && token === search_token;
      }
      function ensure_search_active(token) {
        if (!is_search_active(token)) throw Error("Search cancelled");
      }
      function get_search_per_page() {
        let visible_count = get_visible_cards().length;
        if (12 === visible_count || 10 === visible_count) return visible_count;
        try {
          return window.innerWidth <= 700 || !!window.matchMedia("(hover:none), (pointer:coarse)").matches ? 12 : 10;
        } catch {
          return window.innerWidth <= 700 ? 12 : 10;
        }
      }
      function cancel_search(clear_input = !1) {
        search_pending = !1;
        search_token++;
        stop_search_status();
        let request_id = active_bridge_id;
        active_bridge_id = "";
        request_id &&
          dispatch_custom_trade_bridge_action("cancelRequest", {
            cancel_request_id: request_id,
          }).catch(() => {});
        set_search_busy(!1);
        if (clear_input && m) m.value = "";
      }
      function show_search_status(message) {
        show_overlay(`<div class="nte-sr-loading">${message}</div>`);
      }
      function get_pager_btn(direction) {
        return get_panel()?.querySelector(
          "next" === direction ? ".pager-next button, .pager-next .btn-generic-right-sm" : ".pager-prev button, .pager-prev .btn-generic-left-sm",
        );
      }
      function get_visible_cards() {
        return Array.from(get_panel()?.querySelectorAll(".item-card-container[data-collectibleiteminstanceid]") || []);
      }
      function get_page_sig() {
        let cards = get_visible_cards();
        if (!cards.length) return "";
        let first = cards[0]?.getAttribute("data-collectibleiteminstanceid") || "",
          last = cards[cards.length - 1]?.getAttribute("data-collectibleiteminstanceid") || "";
        return `${first}|${last}|${cards.length}`;
      }
      function get_page_est() {
        let user_id = get_side_user_id(),
          items = Array.isArray(search_inv_cache[user_id]) ? search_inv_cache[user_id] : [],
          cards = get_visible_cards(),
          per_page = get_search_per_page();
        for (let card of cards) {
          let inst_id = card.getAttribute("data-collectibleiteminstanceid"),
            item_i = items.findIndex((e) => e.collectibleItemInstanceId && e.collectibleItemInstanceId === inst_id);
          if (item_i >= 0) return Math.floor(item_i / per_page) + 1;
        }
        let text = get_panel()?.querySelector(".pager span")?.textContent || "",
          match = text.match(/(\d+)/);
        return match ? parseInt(match[1], 10) || 1 : 1;
      }
      function get_search_page_data(item) {
        let user_id = get_side_user_id(),
          items = Array.isArray(search_inv_cache[user_id]) ? search_inv_cache[user_id] : [],
          item_i = items.findIndex((e) => e.collectibleItemInstanceId && e.collectibleItemInstanceId === item.collectibleItemInstanceId),
          per_page = get_search_per_page();
        if (item_i < 0) return null;
        let dup_group = items.filter((e) => e.itemType === item.itemType && e.targetId === item.targetId && e.name === item.name),
          dup_ord = dup_group.findIndex((e) => e.collectibleItemInstanceId === item.collectibleItemInstanceId) + 1;
        return {
          index: item_i,
          targetPage: Math.floor(item_i / per_page) + 1,
          totalPages: Math.max(1, Math.ceil(items.length / per_page)),
          duplicateCount: dup_group.length,
          duplicateOrdinal: dup_ord,
        };
      }
      function build_search_bridge_item(item) {
        return build_custom_trade_bridge_item({
          collectible_item_id: item.collectibleItemId || null,
          collectible_item_instance_id: item.collectibleItemInstanceId || null,
          item_type: item.itemType || "Asset",
          target_id: item.targetId || 0,
          item_name: item.name || "Unknown",
          serial_number: item.serialNumber ?? null,
          original_price: item.originalPrice ?? null,
          recent_average_price: item.rap ?? 0,
          asset_stock: item.assetStock ?? 0,
          is_on_hold: !!item.isOnHold,
        });
      }
      function build_direct_search_item(item) {
        let direct_item = build_search_bridge_item(item),
          user_id = get_side_user_id();
        return {
          ...item,
          ...direct_item,
          id: item.id || item.collectibleItemInstanceId || direct_item.collectibleItemInstanceId,
          userId: user_id,
          itemName: item.itemName || item.name || direct_item.itemName || "Unknown",
          name: item.name || item.itemName || direct_item.name || direct_item.itemName || "Unknown",
          itemType: item.itemType || item.itemTarget?.itemType || direct_item.itemType || "Asset",
          targetId: parseInt(item.targetId ?? item.itemTarget?.targetId ?? direct_item.targetId ?? 0, 10) || 0,
          recentAveragePrice: parseInt(item.recentAveragePrice ?? item.rap ?? direct_item.recentAveragePrice ?? 0, 10) || 0,
          rap: parseInt(item.rap ?? item.recentAveragePrice ?? direct_item.rap ?? 0, 10) || 0,
          isOnHold: !!item.isOnHold,
          userAssetId:
            parseInt(
              item.userAssetId ??
                item.userAsset?.id ??
                item.userAsset?.userAssetId ??
                item.id ??
                direct_item.userAssetId ??
                direct_item.userAsset?.id ??
                direct_item.userAsset?.userAssetId ??
                direct_item.id ??
                0,
              10,
            ) || 0,
        };
      }
      let rendered_results = [],
        active_result_idx = -1;
      function get_selectable_indices() {
        let indices = [];
        for (let idx = 0; idx < rendered_results.length; idx++) rendered_results[idx] && !rendered_results[idx].isOnHold && indices.push(idx);
        return indices;
      }
      function set_active_result(idx, scroll_into_view = true) {
        active_result_idx = Number.isFinite(idx) ? idx : -1;
        if (!overlay_el) return;
        for (let card of overlay_el.querySelectorAll(".nte-sr-card")) {
          let card_idx = parseInt(card.getAttribute("data-sr-idx") || "-1", 10);
          card.classList.toggle("is-active", card_idx === active_result_idx);
          if (card_idx === active_result_idx && scroll_into_view) {
            try {
              card.scrollIntoView({ block: "nearest", inline: "nearest" });
            } catch {}
          }
        }
      }
      function activate_result(idx) {
        let item = rendered_results[idx];
        if (!item || item.isOnHold) return;
        add_search_item_to_trade(item, a);
      }
      function get_thumb_by_inst(inst_id) {
        if (!inst_id) return null;
        let safe_inst_id = String(inst_id).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        return get_panel()?.querySelector(`[data-collectibleiteminstanceid="${safe_inst_id}"] .item-card-thumb-container`);
      }
      function wait_inventory_change(current_sig, timeout = 1600) {
        let container = get_item_list() || get_panel();
        return new Promise((resolve) => {
          let finished = !1,
            observer = null,
            interval = null,
            timer = null,
            finish = (changed) => {
              finished ||
                ((finished = !0), observer?.disconnect(), interval && clearInterval(interval), timer && clearTimeout(timer), resolve(changed));
            },
            check = () => {
              get_page_sig() !== current_sig && finish(!0);
            };
          container &&
            window.MutationObserver &&
            ((observer = new MutationObserver(check)),
            observer.observe(container, {
              childList: !0,
              subtree: !0,
              attributes: !0,
            }));
          interval = setInterval(check, 30);
          timer = setTimeout(() => finish(!1), timeout);
          check();
        });
      }
      async function wait_visible_item(inst_id, timeout = 1200, action_token = null) {
        let started = Date.now();
        for (; Date.now() - started < timeout; ) {
          null != action_token && ensure_search_active(action_token);
          let thumb = get_thumb_by_inst(inst_id);
          if (thumb) return thumb;
          await U(30);
        }
        return null;
      }
      async function wait_pager_btn(direction, timeout = 1800, action_token = null) {
        let started = Date.now();
        for (; Date.now() - started < timeout; ) {
          null != action_token && ensure_search_active(action_token);
          let button = get_pager_btn(direction);
          if (button && !button.disabled) return button;
          await U(30);
        }
        return null;
      }
      async function step_trade_page(direction, action_token = null) {
        null != action_token && ensure_search_active(action_token);
        let current_sig = get_page_sig(),
          button = await wait_pager_btn(direction, 1800, action_token);
        if (!button) return !1;
        button.click();
        null != action_token && ensure_search_active(action_token);
        return await wait_inventory_change(current_sig);
      }
      async function click_visible_item(item, before_sig = null, action_token = null) {
        let visible_thumb = await wait_visible_item(item.collectibleItemInstanceId, 1200, action_token);
        if (!visible_thumb) return !1;
        try {
          visible_thumb.scrollIntoView({
            block: "center",
            inline: "center",
            behavior: "instant",
          });
        } catch {}
        await U(180);
        null != action_token && ensure_search_active(action_token);
        visible_thumb.click();
        return await U(120), !0;
      }
      async function go_to_search_page(item, page_data, before_sig = null, action_token = null) {
        null != action_token && ensure_search_active(action_token);
        if (await click_visible_item(item, before_sig, action_token)) return !0;
        let page_i = get_page_est(),
          target_page = page_data.targetPage,
          main_dir = page_i < target_page ? "next" : "prev",
          status_label = esc_search(item.name),
          dup_label = page_data.duplicateCount > 1 ? ` copy ${page_data.duplicateOrdinal}/${page_data.duplicateCount}` : "";
        if (page_i !== target_page)
          for (let e = 0; e < Math.abs(target_page - page_i); e++) {
            null != action_token && ensure_search_active(action_token);
            let page = page_i + ("next" === main_dir ? e + 1 : -(e + 1));
            show_search_status(
              `Going to page <strong>${page}/${page_data.totalPages}</strong> to click <strong>${status_label}</strong>${dup_label}.`,
            );
            if (!(await step_trade_page(main_dir, action_token))) return !1;
          }
        await U(180);
        null != action_token && ensure_search_active(action_token);
        show_search_status(`Clicking <strong>${status_label}</strong> on page <strong>${target_page}/${page_data.totalPages}</strong>${dup_label}.`);
        if (await click_visible_item(item, before_sig, action_token)) return !0;
        for (let direction of ["next", "prev"])
          for (let e = 1; e <= 1; e++) {
            null != action_token && ensure_search_active(action_token);
            let page = target_page + ("next" === direction ? e : -e);
            if (page < 1) break;
            show_search_status(
              `Checking nearby page <strong>${page}/${page_data.totalPages}</strong> for <strong>${status_label}</strong>${dup_label}.`,
            );
            if (!(await step_trade_page(direction, action_token))) break;
            await U(180);
            if (await click_visible_item(item, before_sig, action_token)) return !0;
          }
        return !1;
      }
      function render_results(items, query) {
        if (!query.trim()) {
          rendered_results = [];
          active_result_idx = -1;
          hide_overlay();
          return;
        }
        let q = query.trim().toLowerCase(),
          parsed_query = parse_trade_search_query(query);
        let matches = items.filter((i) => does_trade_search_item_match(i, parsed_query));
        if (!matches.length) {
          show_overlay('<div class="nte-sr-empty">No items matching "' + q.replace(/[<>"'&]/g, "") + '"</div>');
          return;
        }
        matches.sort((a, b) => {
          let a_meta = get_trade_search_item_meta(a),
            b_meta = get_trade_search_item_meta(b),
            a_rank = get_trade_search_rank(a, parsed_query),
            b_rank = get_trade_search_rank(b, parsed_query);
          return (
            a_rank - b_rank ||
            Number(b_meta.hasValue) - Number(a_meta.hasValue) ||
            b_meta.value - a_meta.value ||
            b.rap - a.rap ||
            a.name.localeCompare(b.name)
          );
        });
        let visible_results = matches;
        rendered_results = visible_results;
        active_result_idx = -1;
        let dup_counts = new Map(),
          dup_seen = new Map();
        for (let item of matches) {
          let key = `${item.itemType}:${item.targetId}:${item.name}`;
          dup_counts.set(key, (dup_counts.get(key) || 0) + 1);
        }
        let html = `<div class="nte-sr-header">
          <div class="nte-sr-summary"><strong>${matches.length}</strong> match${matches.length === 1 ? "" : "es"}</div>
          <div class="nte-sr-hint">Hover shows sales - Enter adds - Try value&gt;50k rap&lt;10k #1234</div>
        </div>${visible_results
          .map((item, idx) => {
            let thumb = search_thumb_cache[item.itemType + ":" + item.targetId] || "";
            let meta = get_trade_search_item_meta(item),
              val = meta.value;
            let hold_class = item.isOnHold ? " is-hold" : "";
            let badges = "";
            if (item.isOnHold) badges += '<span class="nte-sr-badge hold">Hold</span>';
            let dup_key = `${item.itemType}:${item.targetId}:${item.name}`,
              dup_count = dup_counts.get(dup_key) || 1,
              dup_ord = (dup_seen.get(dup_key) || 0) + 1;
            dup_seen.set(dup_key, dup_ord);
            (show_rare || parsed_query.filters.rare || meta.isRare) && meta.isRare && (badges += '<span class="nte-sr-badge rare">Rare</span>');
            (show_projected || parsed_query.filters.projected || meta.isProjected) &&
              meta.isProjected &&
              (badges += '<span class="nte-sr-badge projected">Projected</span>');
            parsed_query.filters.rapOnly && !meta.hasValue && (badges += '<span class="nte-sr-badge rap">RAP</span>');
            if (dup_count > 1 && null == item.serialNumber) badges += `<span class="nte-sr-badge">${dup_ord}/${dup_count}</span>`;
            return `<div class="nte-sr-card${hold_class}" data-sr-idx="${idx}">
            <div class="nte-sr-thumb">${thumb ? `<img src="${thumb.replace(/"/g, "&quot;")}" alt="">` : ""}</div>
            <div class="nte-sr-info">
              <div class="nte-sr-name">${item.name.replace(/[<>]/g, "")}${badges}</div>
              <div class="nte-sr-stats">
                RAP <strong>${c.commafy(item.rap)}</strong>
                ${show_values ? `&nbsp;&middot;&nbsp;Value <strong>${c.commafy(val)}</strong>` : ""}
                ${meta.acronym ? `&nbsp;&middot;&nbsp;ACR <strong>${meta.acronym.toUpperCase()}</strong>` : ""}
                ${meta.demand >= 0 ? `&nbsp;&middot;&nbsp;Demand <strong class="nte-demand-tier ${trade_sales_hover_demand_value_class(meta.demandLabel)}">${String(meta.demandLabel).replace(/[<>]/g, "")}</strong>` : ""}
                ${item.serialNumber != null ? `&nbsp;&middot;&nbsp;<span class="nte-trade-serial">#${item.serialNumber}</span>` : ""}
              </div>
            </div>
          </div>`;
          })
          .join("")}`;
        show_overlay(html);
        for (let card of overlay_el.querySelectorAll(".nte-sr-card")) {
          let idx = parseInt(card.getAttribute("data-sr-idx") || "-1", 10);
          card.__nte_sales_item = visible_results[idx] || null;
          card.addEventListener("mouseenter", () => {
            set_active_result(idx, false);
          });
        }
        let selectable_indices = get_selectable_indices();
        if (selectable_indices.length) set_active_result(selectable_indices[0], false);
        if (typeof mount_trade_sales_hover_targets === "function") mount_trade_sales_hover_targets(overlay_el);
        overlay_el.onclick = (ev) => {
          let card = ev.target.closest("[data-sr-idx]");
          if (!card) return;
          let item = visible_results[parseInt(card.dataset.srIdx)];
          if (!item || item.isOnHold) return;
          add_search_item_to_trade(item, a);
        };
        fetch_search_thumbs(visible_results).then((did_fetch) => {
          if (did_fetch && overlay_el && m.value.trim().toLowerCase() === q) render_results(items, query);
        });
      }
      async function add_search_item_to_trade(item, side_idx) {
        if (search_pending) return;
        search_pending = !0;
        let action_token = ++search_token;
        active_bridge_id = "";
        set_search_busy(!0);
        let status_timer = null;
        active_status_cleanup = () => {
          status_timer && clearInterval(status_timer);
          status_timer = null;
        };
        try {
          ensure_search_active(action_token);
          let page_data = get_search_page_data(item);
          if (!page_data) return void console.warn("[NRU] Could not resolve a page for the searched trade item.", item);
          let status_label = esc_search(item.name),
            dup_label = page_data.duplicateCount > 1 ? ` copy ${page_data.duplicateOrdinal}/${page_data.duplicateCount}` : "",
            status_state = {
              phase: "seeking",
              currentPage: get_page_est(),
              startedAt: Date.now(),
            },
            render_bridge_status = () => {
              let elapsed = ((Date.now() - status_state.startedAt) / 1e3).toFixed(1),
                page_i =
                  Number.isFinite(Number(status_state.currentPage)) && Number(status_state.currentPage) > 0
                    ? Number(status_state.currentPage)
                    : "?";
              show_search_status(
                "clicking" === status_state.phase
                  ? `Clicking <strong>${status_label}</strong>${dup_label} on page <strong>${page_data.targetPage}/${page_data.totalPages} (${page_i})</strong>.<div style="margin-top:6px;font-size:12px;opacity:.72;">Elapsed: ${elapsed}s</div>`
                  : "direct" === status_state.phase
                    ? `Adding <strong>${status_label}</strong>${dup_label} directly.<div style="margin-top:6px;font-size:12px;opacity:.72;">Elapsed: ${elapsed}s</div>`
                    : `Going to page <strong>${page_data.targetPage}/${page_data.totalPages} (${page_i})</strong> for <strong>${status_label}</strong>${dup_label}.<div style="margin-top:6px;font-size:12px;opacity:.72;">Elapsed: ${elapsed}s</div>`,
              );
            };
          render_bridge_status(),
            (status_timer = setInterval(() => {
              if (!is_search_active(action_token)) return;
              render_bridge_status();
            }, 250));
          try {
            let before_snap = get_native_offer_snapshot(),
              before_sig = before_snap ? get_offer_signature(before_snap) : null,
              before_offer_sig = get_native_offer_dom_fingerprint(),
              before_membership = is_native_offer_item_present(item.collectibleItemInstanceId, before_snap);
            ensure_search_active(action_token);
            status_state.phase = "direct";
            render_bridge_status();
            dispatch_custom_trade_bridge_action("toggleItem", {
              side_index: side_idx,
              collectible_item_instance_id: item.collectibleItemInstanceId,
              tradable_item: build_direct_search_item(item),
            }).catch((e) => console.warn("[NRU] Direct synthetic add dispatch failed, trying native page selection.", e));
            let direct_wait_ms = 1e4,
              direct_added = await Promise.race([
                wait_for_native_offer_dom_change(before_offer_sig, direct_wait_ms),
                wait_for_native_offer_item_membership_change(item.collectibleItemInstanceId, before_membership, direct_wait_ms),
                before_sig
                  ? wait_for_custom_trade_signature_change(before_sig, direct_wait_ms).then(Boolean)
                  : new Promise((e) => setTimeout(() => e(!1), direct_wait_ms)),
                new Promise((e) => setTimeout(() => e(!1), direct_wait_ms + 50)),
              ]);
            ensure_search_active(action_token);
            if (direct_added) {
              stop_search_status();
              return void clear_search();
            }
          } catch (direct_err) {
            if (!is_search_active(action_token)) return;
            console.warn("[NRU] Direct synthetic add failed, trying native page selection.", direct_err);
          }
          try {
            ensure_search_active(action_token);
            status_state.phase = "seeking";
            render_bridge_status();
            active_bridge_id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            await run_custom_trade_bridge_action("selectItemByInstanceId", {
              request_id: active_bridge_id,
              side_index: side_idx,
              collectible_item_instance_id: item.collectibleItemInstanceId,
              target_page: page_data.targetPage,
              timeout_ms: Math.max(1e4, Math.abs(page_data.targetPage - get_page_est()) * 550 + 5e3),
              on_progress: (e) => {
                if (!is_search_active(action_token)) return;
                Number.isFinite(Number(e?.current_page)) && (status_state.currentPage = Number(e.current_page)),
                  e?.phase && (status_state.phase = e.phase),
                  render_bridge_status();
              },
            });
            active_bridge_id = "";
            ensure_search_active(action_token);
            stop_search_status();
            return void clear_search();
          } catch (bridge_err) {
            active_bridge_id = "";
            if (!is_search_active(action_token)) return;
            stop_search_status();
            console.warn("[NRU] Direct trade bridge add failed, falling back to page navigation.", bridge_err);
          }
          ensure_search_active(action_token);
          show_search_status(
            `Going to page <strong>${page_data.targetPage}/${page_data.totalPages}</strong> for <strong>${status_label}</strong>${dup_label}.`,
          );
          let before_snap = get_native_offer_snapshot(),
            before_sig = before_snap ? get_offer_signature(before_snap) : null;
          if (await go_to_search_page(item, page_data, before_sig, action_token)) return void clear_search();
          ensure_search_active(action_token);
          console.warn("[NRU] Could not find the searched item on its predicted trade pages.", item);
          m.value.trim() && render_results(Array.isArray(search_inv_cache[get_side_user_id()]) ? search_inv_cache[get_side_user_id()] : [], m.value);
        } catch (err) {
          if (!is_search_active(action_token) && "Search cancelled" === err?.message) return;
          console.warn("[NRU] Could not add searched trade item", err);
        } finally {
          stop_search_status();
          if (action_token === search_token) {
            search_pending = !1;
            active_bridge_id = "";
            set_search_busy(!1);
          }
        }
      }
      function clear_search() {
        cancel_search(!0), hide_overlay(), (u.getElementsByClassName("rolimons-search-x-button")[0].style.display = "none");
      }
      if (!m) {
        u.innerHTML += d;
        let loading_svg = u.getElementsByTagName("svg")[0];
        if (loading_svg) loading_svg.style.display = "none";
        let x_btn_el = u.getElementsByClassName("rolimons-search-x-button")[0];
        let x_icon_el = x_btn_el && x_btn_el.querySelector(".nte-search-x-icon");
        if (x_icon_el) {
          x_icon_el.style.position = "absolute";
          x_icon_el.style.width = "30px";
          x_icon_el.style.height = "30px";
          x_icon_el.style.top = "3px";
          x_icon_el.style.left = "3px";
          x_icon_el.style.pointerEvents = "none";
          nte_append_trade_search_clear_icon(x_icon_el, "xDark.svg" === s);
        }
        (m = u.getElementsByClassName("rolimons-search")[0]), x_btn_el.addEventListener("click", clear_search);
        let user_id = get_side_user_id();
        user_id &&
          (fetch_tradable_items(user_id),
          dispatch_custom_trade_bridge_action("primeVisibleItems", {
            side_index: a,
          }).catch(() => {}));
        m.addEventListener("keydown", (ev) => {
          if (!m.value.trim()) return;
          let selectable_indices = get_selectable_indices();
          if (!selectable_indices.length) {
            if ("Escape" === ev.key) {
              ev.preventDefault();
              clear_search();
            }
            return;
          }
          if ("ArrowDown" === ev.key || "ArrowUp" === ev.key) {
            ev.preventDefault();
            let current_list_index = selectable_indices.indexOf(active_result_idx);
            current_list_index < 0 && (current_list_index = 0);
            current_list_index += "ArrowDown" === ev.key ? 1 : -1;
            current_list_index < 0 && (current_list_index = selectable_indices.length - 1);
            current_list_index >= selectable_indices.length && (current_list_index = 0);
            set_active_result(selectable_indices[current_list_index]);
          } else if ("Enter" === ev.key) {
            ev.preventDefault();
            activate_result(active_result_idx >= 0 ? active_result_idx : selectable_indices[0]);
          } else if ("Escape" === ev.key) {
            ev.preventDefault();
            clear_search();
          }
        });
        m.addEventListener("input", () => {
          let q = m.value;
          let x_btn = u.getElementsByClassName("rolimons-search-x-button")[0];
          if (q.trim()) {
            x_btn.style.removeProperty("display");
          } else {
            (x_btn.style.display = "none"), hide_overlay();
            return;
          }
          clearTimeout(search_timer),
            (search_timer = setTimeout(async () => {
              let user_id = get_side_user_id();
              if (!user_id) return;
              let items = search_inv_cache[user_id];
              if (!items) {
                show_overlay('<div class="nte-sr-loading">Loading inventory...</div>');
                items = await fetch_tradable_items(user_id);
              }
              m.value === q && render_results(items, q);
            }, 150));
        });
        (u.dataset.nteTradeSearchMounted = "true"), delete u.dataset.nteTradeSearchMounting;
      } else delete u.dataset.nteTradeSearchMounting;
    }
    "sendOrCounter" === c.getPageType() && (await c.waitForElm(".trade-inventory-panel"), n(1), n(2));
  }
  function decode_data_uri_text(data_url) {
    let comma = data_url.indexOf(",");
    if (comma < 0) return "";
    let meta = data_url.substring(0, comma);
    let body = data_url.substring(comma + 1);
    if (/;base64/i.test(meta)) return atob(body);
    return decodeURIComponent(body);
  }
  function nte_append_trade_search_clear_icon(container_el, is_dark) {
    if (!container_el) return;
    let NS = "http://www.w3.org/2000/svg",
      svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "30");
    svg.setAttribute("height", "30");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.style.pointerEvents = "none";
    svg.style.display = "block";
    let path = document.createElementNS(NS, "path");
    path.setAttribute("d", "M18 6 6 18M6 6l12 12");
    path.setAttribute("stroke", is_dark ? "#BDBEBE" : "#606162");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    for (; container_el.firstChild; ) container_el.removeChild(container_el.firstChild);
    container_el.appendChild(svg);
  }
  function E() {
    let load_raw = window.__NTE_ICONS && window.__NTE_ICONS["assets/loading.svg"];
    let t = "string" == typeof load_raw && 0 === load_raw.indexOf("data:") ? decode_data_uri_text(load_raw) : "";
    return `
        <div class="nte-trade-search-wrap">
        <div style="display: flex; margin-top: 5px; gap: 5px;">
            <input
            type="text"
            placeholder="Search items"
            class="rolimons-search form-control input-field"
            style="
                margin-left: 10px;
                margin-left: auto;
            "
            />
            <button
            type="button"
            class="input-dropdown-btn rolimons-search-x-button"
            style="
                width: 40px;
                position: relative;
                display: none;
            "
            >
            ${t}
            <span class="nte-search-x-icon"></span>
            </button>
        </div>
        </div>`;
  }
  async function S() {
    if (!(await c.getOption("Values on Trading Window")))
      return (function () {
        for (let element of document.querySelectorAll(".valueSpan"))
          element.parentElement.getElementsByTagName("br")[0]?.remove(),
            element.parentElement.getElementsByClassName("icon-rolimons")[0]?.remove(),
            element.remove();
      })();
    let e = await c.waitForElm(".trades-container");
    if ((k(), "details" === c.getPageType()))
      for (let offer of e.getElementsByClassName("trade-list-detail-offer"))
        T(
          offer.querySelector(".robux-line:not(.ng-hide):not([ng-show])").querySelector(".robux-line-amount"),
          await c.calculateValueTotalDetails(offer),
        );
    if ("sendOrCounter" === c.getPageType())
      for (let offer of document.getElementsByClassName("trade-request-window-offer"))
        T(
          offer.querySelector(".robux-line:not(.ng-hide):not([ng-show])").querySelector(".robux-line-amount"),
          await c.calculateValueTotalSendOrCounter(offer),
        );
  }
  function format_trade_item_routility_usd(value) {
    let numeric = Number(value) || 0,
      whole = Math.abs(numeric - Math.round(numeric)) < 0.005;
    return `$${numeric.toLocaleString(undefined, {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }
  function set_trade_item_routility_usd(price_el, usd_value) {
    if (!(price_el instanceof Element)) return;
    price_el.querySelector(".nte-routility-usd-row")?.remove();
    price_el.querySelector(".nte-routility-usd-break")?.remove();
    price_el.querySelector(".nte-routility-usd-inline")?.remove();
    price_el.style.height = "44px";
    if (!(usd_value > 0)) return;
    let br = document.createElement("br"),
      row = document.createElement("span"),
      icon = document.createElement("img"),
      text = document.createElement("span"),
      dark = "dark" === c.getColorMode();
    br.className = "nte-routility-usd-break";
    row.className = "valueSpan nte-routility-usd-row";
    row.style.display = "inline-flex";
    row.style.alignItems = "center";
    row.style.gap = "6px";
    row.style.marginTop = "4px";
    row.style.marginLeft = "2px";
    row.style.minHeight = "20px";
    row.style.lineHeight = "20px";
    row.style.whiteSpace = "nowrap";
    row.style.verticalAlign = "middle";
    icon.className = "nte-routility-usd-logo";
    icon.src = c.getURL("assets/routility.png");
    icon.alt = "";
    icon.decoding = "async";
    icon.width = 16;
    icon.height = 16;
    icon.style.display = "block";
    icon.style.width = "16px";
    icon.style.height = "16px";
    icon.style.objectFit = "contain";
    icon.style.flex = "0 0 16px";
    text.className = "valueSpan text-robux";
    text.style.color = dark ? "rgba(125, 211, 252, 0.96)" : "#0369a1";
    text.style.display = "inline-flex";
    text.style.alignItems = "center";
    text.style.minHeight = "20px";
    text.style.lineHeight = "20px";
    text.textContent = format_trade_item_routility_usd(usd_value);
    row.appendChild(icon);
    row.appendChild(text);
    price_el.appendChild(br);
    price_el.appendChild(row);
    price_el.style.height = "68px";
  }
  async function k() {
    let show_routility_usd = !!(await c.getOption("Show Routility USD Values"));
    for (let item of (await c.waitForElm(".item-card-container"), document.querySelectorAll(".item-card-container"))) {
      let e = item.querySelector(".item-card-price"),
        t = c.getItemIdFromElement(item),
        r = c.getItemNameFromElement(item),
        n = (function (e) {
          if (!(e instanceof Element)) return 0;
          let t = e.cloneNode(!0);
          for (let e of t.querySelectorAll(".valueSpan, .icon-rolimons, .icon-link, br")) e.remove();
          let r = (t.textContent || "").match(/\d[\d,]*/);
          return r ? parseInt(r[0].replace(/,/g, ""), 10) || 0 : 0;
        })(e),
        a = get_trade_el_value_ctx(item, t, r, n);
      e.querySelector(".valueSpan") || c.createValuesSpans(e);
      let o = c.getValueOrRAP(a.targetId, a.name, a.rap);
      e.querySelector(".valueSpan").innerText = c.commafy(o);
      set_trade_item_routility_usd(
        e,
        show_routility_usd
          ? Number(c.getUSD(a.targetId) || c.getUSD(c.resolveRolimonsItemId(a.targetId, a.name, "Bundle" === a.itemType)) || 0)
          : 0,
      );
      item.parentElement.parentElement.style.marginBottom = "0px";
    }
    for (let item of document.querySelectorAll(".trade-request-item")) {
      let e = item.querySelector(".item-value");
      if (!e) continue;
      let t = c.getItemIdFromElement(item),
        r = c.getItemNameFromElement(item),
        n = (function (e) {
          if (!(e instanceof Element)) return 0;
          let t = e.cloneNode(!0);
          for (let e of t.querySelectorAll(".valueSpan, .icon-rolimons, .icon-link, br")) e.remove();
          let r = (t.textContent || "").match(/\d[\d,]*/);
          return r ? parseInt(r[0].replace(/,/g, ""), 10) || 0 : 0;
        })(e),
        a = get_trade_el_value_ctx(item, t, r, n);
      e.querySelector(".valueSpan") || c.createValuesSpans(e, { inline: !0 });
      let o = c.getValueOrRAP(a.targetId, a.name, a.rap);
      e.querySelector(".valueSpan").innerText = c.commafy(o);
      set_trade_item_routility_usd(
        e,
        show_routility_usd
          ? Number(c.getUSD(a.targetId) || c.getUSD(c.resolveRolimonsItemId(a.targetId, a.name, "Bundle" === a.itemType)) || 0)
          : 0,
      );
    }
    nte_tag_trade_page_serial_spans();
  }
  function T(e, t) {
    void 0 === e.getElementsByClassName("valueSpan")[0] && c.createValuesSpans(e, { large: !0 }),
      (e.getElementsByClassName("valueSpan")[0].innerText = c.commafy(t));
  }
    async function C() {
      if (!(await get_post_tax_trade_values_enabled())) return I();
      let e = document.querySelector(".trades-container");
      if (!e) return I();
    function build_info_svg() {
      let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "infoSVG");
      svg.setAttribute("width", "32");
      svg.setAttribute("height", "32");
      svg.setAttribute("viewBox", "0 0 32 32");
      svg.style.height = "20px";
      let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("fill", "currentColor");
      path.setAttribute(
        "d",
        "M16 1.466C7.973 1.466 1.466 7.973 1.466 16c0 8.027 6.507 14.534 14.534 14.534c8.027 0 14.534-6.507 14.534-14.534c0-8.027-6.507-14.534-14.534-14.534zM14.757 8h2.42v2.574h-2.42V8zm4.005 15.622H16.1c-1.034 0-1.475-.44-1.475-1.496V15.26c0-.33-.176-.483-.484-.483h-.88V12.4h2.663c1.035 0 1.474.462 1.474 1.496v6.887c0 .31.176.484.484.484h.88v2.355z",
      );
      svg.appendChild(path);
      return svg;
    }
    function build_value_warning(value, robux, font_size) {
      let outer = document.createElement("div");
      let inner = document.createElement("div");
      inner.id = "valueWarning";
      inner.style.marginTop = "10px";
      inner.style.backgroundColor = "dark" === c.getColorMode() ? "#191b1d" : "#dee1e3";
      inner.style.padding = "3px";
      inner.style.display = "inline-flex";
      inner.style.cursor = "default";
      let span = document.createElement("span");
      span.style.fontSize = font_size;
      span.textContent = `Value received after Robux tax: ${c.commafy(Math.round(value + 0.7 * robux))}`;
      inner.appendChild(span);
      inner.appendChild(build_info_svg());
      outer.appendChild(inner);
      return outer;
    }
    if ("details" === c.getPageType()) {
      let r = e.getElementsByClassName("trade-list-detail-offer");
      if (!r[1]) return;
      let [n, a] = await c.calculateValueTotalDetails(r[1], !0);
      I();
      if (a > 1) {
        let target = document.querySelector(".trade-buttons");
        if (target) target.appendChild(build_value_warning(n, a, "18px"));
        else r[1].insertAdjacentElement("afterend", build_value_warning(n, a, "18px"));
      }
    }
    if ("sendOrCounter" === c.getPageType()) {
      let e = document.getElementsByClassName("trade-request-window-offer");
      if (!e[1]) return;
      let [r, n] = await c.calculateValueTotalSendOrCounter(e[1], !0);
      I();
      if (n > 1) {
        let target = document.querySelector(".trade-request-window-offers");
        if (target) target.appendChild(build_value_warning(r, n, "15px"));
      }
    }
    document.getElementById("valueWarning") &&
      (c.addTooltip(
        document.getElementById("valueWarning").querySelector("svg"),
        "Reminder: you will not receive the full amount of Robux present on the trade because Roblox takes a 30% Robux fee. To disable this reminder, turn off Post-Tax Trade Values in the extension options.",
      ),
      c.initTooltips());
  }
  function I() {
    document.getElementById("valueWarning")?.remove();
  }
  var c = (s("eFyFE"), s("eFyFE"), s("eFyFE"));
  var nte_serial_blur_style_injected = !1;
  function inject_nte_serial_blur_styles() {
    if (nte_serial_blur_style_injected) return;
    nte_serial_blur_style_injected = !0;
    let e = document.createElement("style");
    (e.id = "nte-serial-blur-style"),
      (e.textContent = `
      .light-theme .nte-serial-hide-host .hide-button {
        background-color: #424141;
      }
      .text-blur {
        color: transparent !important;
        text-shadow: 0 0 15px rgba(255,255,255,0.5) !important;
      }
      .light-theme .text-blur {
        color: transparent !important;
        text-shadow: 0 0 15px rgba(0,0,0,0.5) !important;
      }
      .nte-serial-hide-host.buttontooltip {
        position: relative;
        display: inline-block;
      }
      .nte-serial-hide-host.buttontooltip .tooltiptext {
        visibility: hidden;
        width: 260px;
        background-color: #000;
        color: #fff;
        text-align: center;
        padding: 5px 0;
        border-radius: 6px;
        position: absolute;
        z-index: 10001;
      }
      .nte-serial-hide-host.buttontooltip:hover .tooltiptext {
        visibility: visible;
      }
    `),
      document.head.appendChild(e);
  }
  function nte_serial_hide_icon_url() {
    return document.querySelector(".light-theme") ? c.getURL("assets/serials_on_lightmode.svg") : c.getURL("assets/serials_on.svg");
  }
  function nte_serials_currently_blurred() {
    for (let c of document.getElementsByClassName("limited-number-container")) {
      if (c.querySelector("span.text-blur")) return !0;
    }
    return !!document.querySelector(".nte-trade-serial.text-blur");
  }
  function nte_tag_trade_page_serial_spans() {
    let scopes = [];
    let a = document.querySelector(".trades-container");
    a && scopes.push(a);
    let b = document.querySelector(".trade-request-window");
    b && !scopes.includes(b) && scopes.push(b);
    for (let scope of scopes) {
      for (let root of scope.querySelectorAll(".item-card-container, .trade-item-card")) {
        if (root.closest(".tradeListValuesBox")) continue;
        for (let el of root.querySelectorAll("span, div, button, a, p")) {
          if (el.closest(".tradeListValuesBox")) continue;
          if (el.classList.contains("valueSpan") || el.classList.contains("icon-rolimons") || el.classList.contains("icon-link")) continue;
          if (el.classList.contains("nte-trade-serial")) continue;
          if (el.childElementCount !== 0) continue;
          let text = (el.textContent || "").replace(/\s/g, "").trim();
          if (!/^#\d[\d,]*$/.test(text) || text.length > 24) continue;
          el.classList.add("nte-trade-serial");
        }
      }
    }
  }
  function toggle_nte_serial_text_blur() {
    let seen = new Set();
    function toggle_el(t) {
      if (seen.has(t)) return;
      seen.add(t), t.classList.toggle("text-blur");
    }
    let e = document.getElementsByClassName("limited-number-container");
    for (let t = 0; t < e.length; t++) {
      let r = e[t].getElementsByTagName("span");
      for (let n = 0; n < r.length; n++) toggle_el(r[n]);
    }
    for (let t of document.querySelectorAll(".nte-trade-serial")) toggle_el(t);
  }
  function update_nte_serial_hide_controls() {
    let e = nte_serials_currently_blurred(),
      t = nte_serial_hide_icon_url();
    for (let r of document.querySelectorAll(".nte-serial-hide-host"))
      r.classList.toggle("inactive", !e), r.querySelector("img") && (r.querySelector("img").src = t);
  }
  function nte_paired_name_visible(e) {
    if (!e || !e.isConnected) return !1;
    if (e.classList.contains("ng-hide")) return !1;
    let t = e.getBoundingClientRect();
    return !(t.width < 2 || t.height < 2);
  }
  function nte_insert_serial_hide_button(e) {
    if (!e || !nte_paired_name_visible(e) || e.classList.contains("hide-button-inserted")) return !1;
    if (e.closest(".trade-request-window")) return !1;
    let t = e.parentNode && e.parentNode.parentNode;
    if (!t) return !1;
    let r = t.querySelector(".text-label.ng-binding") || t.querySelector(".text-label");
    if (!r) return !1;
    if (r.querySelector(".nte-serial-hide-host")) return !1;
    let n = document.createElement("div");
    (n.className = "inactive buttontooltip nte-serial-hide-host"), (n.style.display = "inline-block"), n.setAttribute("data-nevos-serial-hider", "1");
    let a = document.createElement("img");
    (a.className = "hide-button limited-icon-container tooltip-pastnames"),
      (a.style.width = "25px"),
      (a.style.marginTop = "-3px"),
      (a.style.cursor = "pointer"),
      (a.alt = ""),
      (a.src = nte_serial_hide_icon_url());
    let o = document.createElement("span");
    (o.className = "tooltiptext"),
      (o.style.marginTop = "-5.5px"),
      (o.style.marginLeft = "3px"),
      (o.style.pointerEvents = "none"),
      (o.style.width = "130px"),
      (o.textContent = "Blur Serials"),
      n.appendChild(a),
      n.appendChild(o),
      (n.onclick = (e) => {
        e.preventDefault(), e.stopPropagation(), toggle_nte_serial_text_blur(), update_nte_serial_hide_controls();
      }),
      r.classList.contains("ng-hide") && ((r.innerHTML = ""), r.classList.remove("ng-hide")),
      r.appendChild(n),
      e.classList.add("hide-button-inserted");
    return !0;
  }
  function ensure_nte_serial_hash_button() {
    inject_nte_serial_blur_styles();
    let e = c.getPageType(),
      t = !!document.querySelector(".trades-container, .trade-request-window, .trade-row, .trades-list-detail");
    if (!t && "details" !== e && "sendOrCounter" !== e) return;
    nte_tag_trade_page_serial_spans();
    {
      let e = document.querySelector(".nte-serial-hide-host");
      if (e && e.isConnected) return void update_nte_serial_hide_controls();
    }
    let r = [...document.getElementsByClassName("trades-header-nowrap")].at(-1)?.querySelector(".paired-name");
    if (nte_insert_serial_hide_button(r)) return void update_nte_serial_hide_controls();
    for (let e of document.querySelectorAll(".trades-list-detail .paired-name, .trades-container .paired-name"))
      if (nte_insert_serial_hide_button(e)) return void update_nte_serial_hide_controls();
    update_nte_serial_hide_controls();
  }
  var B = s("98F8t"),
    A = s("fgypU"),
    c = s("eFyFE");
  let row_trade_cache = {},
    row_trade_pending = {},
    row_trade_raw_cache =
      window.__nte_trade_row_raw_cache && "object" == typeof window.__nte_trade_row_raw_cache
        ? window.__nte_trade_row_raw_cache
        : ((window.__nte_trade_row_raw_cache = {}), window.__nte_trade_row_raw_cache),
    row_thumb_meta =
      window.__nte_trade_thumb_meta_cache && "object" == typeof window.__nte_trade_thumb_meta_cache
        ? window.__nte_trade_thumb_meta_cache
        : ((window.__nte_trade_thumb_meta_cache = {}), window.__nte_trade_thumb_meta_cache),
    row_thumb_pending = {},
    row_thumb_seen = {},
    row_thumb_refs = [],
    row_script_promise,
    row_fetch_q = [],
    row_active_requests = 0,
    row_next_request_at = 0;
  let TRADE_LIST_FILTER_OPTIONS = [
      { value: "all", label: "All trades" },
      { value: "overpay", label: "Overpay" },
      { value: "equal", label: "Equal" },
      { value: "underpay", label: "Underpay" },
      { value: "upgrade", label: "Upgrade" },
      { value: "downgrade", label: "Downgrade" },
      { value: "robux", label: "Robux" },
      { value: "item_search", label: "Item search" },
    ],
    trade_filter_state = { value: "all" },
    trade_filter_bound = !1,
    trade_search_q = "";
  function make_item_acronym(name) {
    if (!name) return "";
    return name
      .split(/[\s\-_:]+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }
  let _search_cache = { query: "", lq: "", qwords: null };
  function _prep_search_query(query) {
    if (_search_cache.query === query) return _search_cache;
    let lq = query.toLowerCase().trim();
    let qwords = lq.includes(" ") ? lq.split(/\s+/).filter(Boolean) : null;
    _search_cache = { query, lq, qwords };
    return _search_cache;
  }
  function does_item_name_match_search_fast(item_name, sc) {
    if (!item_name) return false;
    let lower_name = item_name.toLowerCase();
    if (lower_name.includes(sc.lq)) return true;
    let acronym = make_item_acronym(item_name).toLowerCase();
    if (acronym === sc.lq || acronym.startsWith(sc.lq)) return true;
    if (sc.qwords) {
      let words = lower_name.split(/[\s\-_:]+/);
      return sc.qwords.every((qw) => words.some((w) => w.startsWith(qw)));
    }
    return false;
  }
  function does_trade_row_match_search(row, query) {
    if (!query || !query.trim()) return true;
    let names = row.dataset.nteTradeItemNames;
    if (!names) return true;
    let sc = _prep_search_query(query);
    if (!sc.lq) return true;
    let start = 0,
      len = names.length;
    while (start < len) {
      let end = names.indexOf("|", start);
      if (end === -1) end = len;
      let item_name = names.substring(start, end);
      if (item_name && does_item_name_match_search_fast(item_name, sc)) return true;
      start = end + 1;
    }
    return false;
  }
  function U(e) {
    return new Promise((t) => setTimeout(t, e));
  }
  function V(e, t = 0) {
    if (!e || t > 3) return null;
    if ("string" == typeof e) return e.trim() || null;
    let r = [
      e?.name,
      e?.assetName,
      e?.displayName,
      e?.userAsset?.name,
      e?.userAsset?.assetName,
      e?.asset?.name,
      e?.item?.name,
      e?.collectibleItem?.name,
      e?.details?.name,
      e?.collectibleItemDetails?.name,
      e?.collectibleDetails?.name,
    ];
    for (let e of r) if ("string" == typeof e && e.trim()) return e.trim();
    if ("object" != typeof e) return null;
    for (let [r, n] of Object.entries(e)) {
      if ("string" == typeof n && /name$/i.test(r) && n.trim()) return n.trim();
      if (n && "object" == typeof n) {
        let e = V(n, t + 1);
        if (e) return e;
      }
    }
    return null;
  }
  function X(e) {
    let t = e?.userAssets || e?.assets || e?.userItems || e?.items || e?.userCollectibles || e?.collectibles || [];
    return Array.isArray(t) ? t : [];
  }
  function Z(e) {
    return e.querySelector(".trade-row-details") || e.querySelector(".trade-row-info") || e.querySelector(".trade-row-summary") || e;
  }
  function get_trade_row_item_id(e) {
    let t = e?.assetId ?? e?.itemTarget?.targetId ?? e?.targetId ?? e?.itemId ?? e?.asset?.id ?? e?.item?.id ?? e?.collectibleItemId ?? e?.id;
    if (null == t) return void 0;
    let r = parseInt(t, 10);
    return isNaN(r) ? void 0 : r;
  }
  function normalize_trade_row(e) {
    if (!e) return null;
    if (Array.isArray(e.offers))
      return {
        offers: [
          { robux: e.offers?.[0]?.robux || 0, items: X(e.offers?.[0]) },
          { robux: e.offers?.[1]?.robux || 0, items: X(e.offers?.[1]) },
        ],
      };
    if (e.participantAOffer || e.participantBOffer)
      return {
        offers: [
          {
            robux: e.participantAOffer?.robux || 0,
            items: Array.isArray(e.participantAOffer?.items) ? e.participantAOffer.items : [],
          },
          {
            robux: e.participantBOffer?.robux || 0,
            items: Array.isArray(e.participantBOffer?.items) ? e.participantBOffer.items : [],
          },
        ],
      };
    return null;
  }
  function get_trade_row_raw_cache_entry(e) {
    let t = String(e || "");
    if (!t) return null;
    let r = row_trade_raw_cache?.[t];
    return r && "object" == typeof r ? r : null;
  }
  function set_trade_row_raw_cache_entry(e, t) {
    let r = String(e || "");
    if (!r || !t || "object" != typeof t) return null;
    return (row_trade_raw_cache[r] = t);
  }
  function set_trade_row_cached_trade(e, t) {
    let r = String(e || "");
    if (!r) return null;
    let n = t && "object" == typeof t ? set_trade_row_raw_cache_entry(r, t) : null,
      a = normalize_trade_row(n || t);
    return a ? (row_trade_cache[r] = a) : null;
  }
  function get_trade_row_thumb_cache_entry(e) {
    let t = parseInt(e, 10);
    if (!(t > 0)) return null;
    let r = row_thumb_meta?.[String(t)];
    return r && "object" == typeof r && r.imageUrl ? r : null;
  }
  function set_trade_row_thumb_cache_entry(e, t) {
    let r = parseInt(e?.targetId ?? e, 10);
    if (!(r > 0) || !t?.imageUrl) return null;
    let n = {
      targetId: r,
      state: String(t.state || "Completed"),
      imageUrl: String(t.imageUrl || ""),
      version: String(t.version || ""),
      errorCode: Number(t.errorCode) || 0,
      errorMessage: String(t.errorMessage || ""),
    };
    return (row_thumb_meta[String(r)] = n);
  }
  function preload_trade_row_thumb_image(e) {
    let t = String(e || "").trim();
    if (!t || row_thumb_seen[t]) return;
    row_thumb_seen[t] = true;
    try {
      let e = new Image();
      (e.decoding = "async"), (e.src = t), row_thumb_refs.push(e), row_thumb_refs.length > 64 && row_thumb_refs.splice(0, row_thumb_refs.length - 64);
    } catch {}
  }
  function get_trade_row_thumb_type(e) {
    let t = String(e?.itemType || e?.itemTarget?.itemType || "Asset").trim();
    return "Bundle" === t ? "BundleThumbnail" : "Asset";
  }
  function get_trade_row_trade_thumb_requests(e) {
    let t = [],
      r = new Set();
    if (!e?.offers) return t;
    for (let e of e.offers || [])
      for (let n of X(e)) {
        let a = get_trade_row_item_id(n);
        if (!(a > 0)) continue;
        let o = get_trade_row_thumb_type(n),
          i = `${o}:${a}`;
        r.has(i) || (r.add(i), t.push({ type: o, targetId: String(a) }));
      }
    return t;
  }
  function dispatch_trade_row_thumb_prewarm(e) {
    let t = [];
    for (let r of Array.isArray(e) ? e : []) {
      let e = parseInt(r?.targetId ?? r, 10);
      if (!(e > 0)) continue;
      let n = "BundleThumbnail" === String(r?.type || "").trim() ? "BundleThumbnail" : "Asset",
        a = `${n}:${e}`;
      t.some((e) => `${e.type}:${e.targetId}` === a) || t.push({ type: n, targetId: String(e) });
    }
    if (!t.length) return;
    try {
      document.dispatchEvent(
        new CustomEvent("nru_trade_thumb_prewarm", {
          detail: JSON.stringify({ thumb_requests: t }),
        }),
      );
    } catch {}
  }
  async function prewarm_trade_row_thumbnails(e) {
    let t = get_trade_row_trade_thumb_requests(e);
    t.length && dispatch_trade_row_thumb_prewarm(t);
  }
  function process_row_fetch_q() {
    if (row_active_requests >= 2 || 0 === row_fetch_q.length) return;
    let { tradeId: e, resolve: t } = row_fetch_q.shift(),
      r = Math.max(0, row_next_request_at - Date.now());
    row_active_requests++,
      (row_next_request_at = Date.now() + r + 100),
      setTimeout(async () => {
        let r = null;
        try {
          let t = await fetch_trade_api(`https://trades.roblox.com/v2/trades/${e}`, {
            credentials: "include",
          });
          200 === t.status
            ? (r = await t.json())
            : 429 === t.status
              ? (row_next_request_at = Math.max(row_next_request_at, Date.now() + 10000))
              : 404 !== t.status &&
                ((t = await fetch_trade_api(`https://trades.roblox.com/v1/trades/${e}`, {
                  credentials: "include",
                })),
                200 === t.status && (r = await t.json()));
        } catch {}
        if (r) {
          let _tab = new URLSearchParams(window.location.search).get("tab") || "inbound";
          let _type = { inbound: "inbound", outbound: "outbound", completed: "completed", inactive: "inactive" }[_tab.toLowerCase()] || "inbound";
          if (!r.status) r.status = { inbound: "Open", outbound: "Open", completed: "Completed", inactive: "Inactive" }[_type] || "Open";
          if (!r.tradeType) r.tradeType = _type;
          nte_send_message({ type: "cacheTrade", tradeId: e, trade: r }, function () {});
        }
        let n = set_trade_row_cached_trade(e, r);
        n && prewarm_trade_row_thumbnails(n).catch(() => {});
        t(n), row_active_requests--, process_row_fetch_q();
      }, r);
  }
  function queue_row_fetch(e) {
    return new Promise((t) => {
      row_fetch_q.push({ tradeId: e, resolve: t }), process_row_fetch_q();
    });
  }
  async function Y() {
    if (row_script_promise) return row_script_promise;
    let e = document.getElementById("nruAddTradeIdToRowScript");
    return e
      ? (row_script_promise = Promise.resolve())
      : (row_script_promise = new Promise((e) => {
          let t = document.createElement("script");
          (t.id = "nruAddTradeIdToRowScript"),
            (t.src = c.getURL("scripts/add_trade_id_to_row.js")),
            (t.onload = () => e()),
            (document.head || document.documentElement).appendChild(t);
        }));
  }
  async function H(e, t) {
    let r = `${Date.now()}-${t}-${Math.random().toString(36).slice(2, 8)}`;
    return (
      e.setAttribute("data-nru-row-token", r),
      await Y(),
      document.dispatchEvent(
        new CustomEvent("nru_add_trade_id_to_row", {
          detail: JSON.stringify({ index: t, token: r }),
        }),
      ),
      r
    );
  }
  async function J(e, t = 20) {
    for (let r = 0; r < t; r++) {
      if (!e?.isConnected) return null;
      let t = e.getAttribute("nruTradeId");
      if (t) return t;
      await U(100);
    }
    return null;
  }
  async function K(e, t) {
    if (!(e = String(e || ""))) return null;
    if (row_trade_cache[e]) return row_trade_cache[e];
    let r = t?.[e] || t?.[Number(e)];
    if (r) return set_trade_row_cached_trade(e, r);
    if (row_trade_pending[e]) return row_trade_pending[e];
    return (row_trade_pending[e] = queue_row_fetch(e)
      .then((t) => {
        return t || row_trade_cache[e] || null;
      })
      .finally(() => {
        delete row_trade_pending[e];
      }));
  }
  function get_trade_list_filter_option(e) {
    return TRADE_LIST_FILTER_OPTIONS.find((t) => t.value === e) || TRADE_LIST_FILTER_OPTIONS[0];
  }
  function get_trade_list_filter_anchor() {
    let e = document.querySelector(".trade-row-list");
    if (!e) return null;
    return e.querySelector(".trade-quality") || e.querySelector(".trades-header") || e.firstElementChild || e;
  }
  function get_trade_list_scroll_element() {
    return document.querySelector("#trade-row-scroll-container .simplebar-content-wrapper") || document.getElementById("trade-row-scroll-container");
  }
  function get_trade_rows_for_processing() {
    let e = [...document.querySelectorAll(".trade-row-list .trade-row")];
    if (!e.length) return e;
    let fv = trade_filter_state.value;
    if (fv === "item_search") {
      let need_names = e.filter((r) => !r.dataset.nteTradeItemNames);
      return need_names.length ? need_names : e.slice(0, 0);
    }
    if ("all" !== fv) return e;
    let t = get_trade_list_scroll_element();
    if (!t) return e.slice(0, 14);
    let r = t.getBoundingClientRect(),
      n = r.top - 140,
      a = r.bottom + 220,
      o = e.filter((e) => {
        if (e.classList?.contains("selected")) return !0;
        let t = e.getBoundingClientRect();
        return t.bottom >= n && t.top <= a;
      });
    return o.length ? o : e.slice(0, 14);
  }
  function bind_trade_list_scroll_refresh() {
    let e = get_trade_list_scroll_element();
    if (!e || "1" === e.dataset.nteValueScrollBound) return;
    e.dataset.nteValueScrollBound = "1";
    let t = 0;
    e.addEventListener(
      "scroll",
      () => {
        clearTimeout(t),
          (t = setTimeout(() => {
            L();
          }, 120));
      },
      { passive: !0 },
    );
  }
  function clear_trade_list_filter_ui() {
    document.getElementById("nteTradeListFilter")?.remove(), document.getElementById("nteTradeListFilterEmpty")?.remove();
    for (let e of document.querySelectorAll(".trade-row-list .trade-row")) e.style.display = "";
    trade_search_q = "";
  }
  function close_trade_list_filter_menu() {
    let e = document.getElementById("nteTradeListFilterMenu"),
      t = document.getElementById("nteTradeListFilterButton");
    e && (e.style.display = "none"), t?.setAttribute("aria-expanded", "false");
  }
  function sync_trade_list_filter_ui_state() {
    let e = get_trade_list_filter_option(trade_filter_state.value),
      t = document.getElementById("nteTradeListFilterLabel");
    t && (t.textContent = e.label);
    for (let t of document.querySelectorAll("#nteTradeListFilterMenu li"))
      t.classList.toggle("active", t.getAttribute("data-value") === trade_filter_state.value);
  }
  function show_trade_list_search_input() {
    let dd = document.querySelector("#nteTradeListFilter .input-group-btn");
    if (!dd) return;
    let btn = document.getElementById("nteTradeListFilterButton");
    if (btn) btn.style.display = "none";
    let existing = document.getElementById("nteTradeListSearchInput");
    if (existing) {
      existing.focus();
      return;
    }
    let wrap = document.createElement("div");
    wrap.id = "nteTradeListSearchInput";
    wrap.style.cssText = "position:relative;width:100%;";
    let icon = document.createElement("span");
    icon.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.35"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
    icon.style.cssText = "position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none;display:flex;align-items:center;";
    let input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Item name or acronym...";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.style.cssText =
      "width:100%;height:36px;padding:0 30px 0 32px;box-sizing:border-box;font-size:13px;text-overflow:ellipsis;border:1px solid rgba(128,128,128,0.3);border-radius:4px;background:transparent;color:inherit;outline:none;cursor:text;font-family:inherit;";
    input.addEventListener("focus", () => {
      input.style.borderColor = "rgba(128,128,128,0.55)";
    });
    input.addEventListener("blur", () => {
      input.style.borderColor = "rgba(128,128,128,0.3)";
    });
    let clear = document.createElement("span");
    clear.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    clear.style.cssText =
      "position:absolute;right:9px;top:50%;transform:translateY(-50%);cursor:pointer;display:flex;align-items:center;padding:3px;border-radius:3px;opacity:0.4;transition:opacity 0.15s;";
    clear.title = "Clear search";
    clear.addEventListener("mouseenter", () => {
      clear.style.opacity = "0.7";
    });
    clear.addEventListener("mouseleave", () => {
      clear.style.opacity = "0.4";
    });
    clear.addEventListener("click", (ev) => {
      ev.stopPropagation();
      hide_trade_list_search_input();
      trade_filter_state.value = "all";
      trade_search_q = "";
      sync_trade_list_filter_ui_state();
      apply_trade_list_filter();
      L();
    });
    let search_timer = 0;
    input.addEventListener("input", () => {
      clearTimeout(search_timer);
      search_timer = setTimeout(() => {
        trade_search_q = input.value;
        trade_filter_state.value = "item_search";
        apply_trade_list_search_fast();
      }, 250);
    });
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        hide_trade_list_search_input();
        trade_filter_state.value = "all";
        trade_search_q = "";
        sync_trade_list_filter_ui_state();
        apply_trade_list_filter();
        L();
      }
    });
    wrap.append(icon, input, clear);
    dd.insertBefore(wrap, dd.firstChild);
    trade_filter_state.value = "item_search";
    input.focus();
  }
  function hide_trade_list_search_input() {
    let wrap = document.getElementById("nteTradeListSearchInput");
    if (wrap) wrap.remove();
    let btn = document.getElementById("nteTradeListFilterButton");
    if (btn) btn.style.display = "";
    trade_search_q = "";
  }
  function ensure_trade_list_filter_ui() {
    let e = get_trade_list_filter_anchor();
    if (!e) return clear_trade_list_filter_ui(), null;
    let t = document.querySelector(".trade-row-list"),
      r = document.getElementById("nteTradeListFilter");
    if (
      !r &&
      ((r = document.createElement("div")),
      (r.id = "nteTradeListFilter"),
      (r.className = "trade-quality"),
      (r.style.display = "flex"),
      (r.style.alignItems = "flex-start"),
      (r.style.justifyContent = "space-between"),
      (r.style.gap = "12px"),
      (r.style.width = "100%"),
      (function () {
        let lbl = document.createElement("div");
        lbl.className = "trade-quality-label";
        lbl.style.paddingTop = "10px";
        lbl.style.flex = "1 1 auto";
        lbl.style.minWidth = "0";
        lbl.textContent = "Sort by";
        let col = document.createElement("div");
        col.style.display = "flex";
        col.style.flexDirection = "column";
        col.style.alignItems = "flex-end";
        col.style.flex = "0 0 auto";
        col.style.width = "202px";
        let dd = document.createElement("div");
        dd.className = "input-group-btn group-dropdown trade-list-dropdown";
        dd.style.width = "202px";
        dd.style.position = "relative";
        let btn = document.createElement("button");
        btn.type = "button";
        btn.id = "nteTradeListFilterButton";
        btn.className = "input-dropdown-btn";
        btn.setAttribute("aria-expanded", "false");
        btn.style.width = "100%";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "space-between";
        btn.style.gap = "8px";
        let sel_label = document.createElement("span");
        sel_label.className = "rbx-selection-label";
        sel_label.id = "nteTradeListFilterLabel";
        sel_label.style.overflow = "hidden";
        sel_label.style.textOverflow = "ellipsis";
        sel_label.textContent = "All trades";
        let arrow = document.createElement("span");
        arrow.className = "icon-down-16x16";
        btn.append(sel_label, arrow);
        let ul = document.createElement("ul");
        ul.id = "nteTradeListFilterMenu";
        ul.className = "dropdown-menu";
        ul.setAttribute("role", "menu");
        ul.style.display = "none";
        ul.style.minWidth = "100%";
        ul.style.width = "202px";
        TRADE_LIST_FILTER_OPTIONS.forEach(function (opt) {
          let li = document.createElement("li");
          li.setAttribute("data-value", opt.value);
          let a = document.createElement("a");
          a.href = "#";
          a.setAttribute("data-value", opt.value);
          a.style.display = "block";
          a.style.color = "inherit";
          let sp = document.createElement("span");
          sp.textContent = opt.label;
          a.appendChild(sp);
          li.appendChild(a);
          ul.appendChild(li);
        });
        dd.append(btn, ul);
        let cnt = document.createElement("div");
        cnt.id = "nteTradeListFilterCount";
        cnt.className = "text-date-hint";
        cnt.style.width = "100%";
        cnt.style.marginTop = "6px";
        cnt.style.paddingRight = "4px";
        cnt.style.textAlign = "right";
        cnt.style.whiteSpace = "nowrap";
        cnt.style.opacity = "0.85";
        cnt.textContent = "Showing 0/0";
        col.append(dd, cnt);
        r.append(lbl, col);
      })(),
      e.parentElement)
    ) {
      let n = r.querySelector("#nteTradeListFilterButton"),
        a = r.querySelector("#nteTradeListFilterMenu");
      n &&
        a &&
        (n.addEventListener("click", (e) => {
          e.preventDefault(),
            e.stopPropagation(),
            (a.style.display = "none" === a.style.display ? "block" : "none"),
            n.setAttribute("aria-expanded", "block" === a.style.display ? "true" : "false");
        }),
        a.addEventListener("click", (e) => {
          let t = e.target?.closest?.("[data-value]")?.getAttribute("data-value");
          if (!t) return;
          e.preventDefault();
          close_trade_list_filter_menu();
          if (t === "item_search") {
            show_trade_list_search_input();
          } else {
            hide_trade_list_search_input();
            trade_filter_state.value = t;
            trade_search_q = "";
            sync_trade_list_filter_ui_state();
            L();
          }
        }),
        trade_filter_bound ||
          (document.addEventListener("click", (e) => {
            document.getElementById("nteTradeListFilter")?.contains?.(e.target) || close_trade_list_filter_menu();
          }),
          (trade_filter_bound = !0))),
        e.insertAdjacentElement("afterend", r);
    }
    if (!r || !t) return r;
    if (r.previousElementSibling !== e && e.parentElement) e.insertAdjacentElement("afterend", r);
    return sync_trade_list_filter_ui_state(), r;
  }
  function get_trade_row_filter_metrics(e) {
    if (!e?.offers?.[0] || !e?.offers?.[1]) return null;
    let t = X(e.offers[0]),
      r = X(e.offers[1]),
      n = 0,
      a = 0,
      o = !1,
      i = !1,
      l = !1;
    function s(e) {
      let t = 0;
      for (let r = 0; r < e.length; r++) {
        let n = e[r],
          a = get_trade_row_item_id(n),
          s = V(n),
          d = n?.recentAveragePrice,
          u = get_trade_search_item_meta({ targetId: a, name: s, rap: d });
        (t += c.getValueOrRAP(a, s, d)), (o = o || !!u?.isProjected), (i = i || !!u?.isRare);
      }
      return t;
    }
    (n += s(t)),
      (a += s(r)),
      (n += e.offers[0]?.robux || 0),
      (a += e.offers[1]?.robux || 0),
      (l = (e.offers[0]?.robux || 0) > 0 || (e.offers[1]?.robux || 0) > 0);
    let d = a - n,
      u = n > 0 ? Math.round((d / n) * 100) : null;
    return {
      giveValue: n,
      receiveValue: a,
      giveItemCount: t.length,
      receiveItemCount: r.length,
      delta: d,
      percent: u,
      hasProjected: o,
      hasRare: i,
      hasRobux: l,
    };
  }
  function set_trade_row_filter_metrics(e, t) {
    t
      ? ((e.dataset.nteTradeReady = "1"),
        (e.dataset.nteTradeDelta = String(t.delta || 0)),
        (e.dataset.nteTradePct = null == t.percent || !isFinite(t.percent) ? "" : String(t.percent)),
        (e.dataset.nteTradeGiveCount = String(t.giveItemCount || 0)),
        (e.dataset.nteTradeReceiveCount = String(t.receiveItemCount || 0)),
        (e.dataset.nteTradeProjected = t.hasProjected ? "1" : "0"),
        (e.dataset.nteTradeRare = t.hasRare ? "1" : "0"),
        (e.dataset.nteTradeRobux = t.hasRobux ? "1" : "0"))
      : (delete e.dataset.nteTradeReady,
        delete e.dataset.nteTradeDelta,
        delete e.dataset.nteTradePct,
        delete e.dataset.nteTradeGiveCount,
        delete e.dataset.nteTradeReceiveCount,
        delete e.dataset.nteTradeProjected,
        delete e.dataset.nteTradeRare,
        delete e.dataset.nteTradeRobux);
  }
  function does_trade_row_match_filter(e, t) {
    let filter_pass = true;
    if (e && t && "all" !== t) {
      if ("1" !== e.dataset.nteTradeReady) return false;
      let r = Number(e.dataset.nteTradeDelta || 0),
        n = Number(e.dataset.nteTradeGiveCount || 0),
        a = Number(e.dataset.nteTradeReceiveCount || 0);
      switch (t) {
        case "overpay":
          filter_pass = r > 0;
          break;
        case "equal":
          filter_pass = 0 === r;
          break;
        case "underpay":
          filter_pass = r < 0;
          break;
        case "upgrade":
          filter_pass = n > 1 && 1 === a;
          break;
        case "downgrade":
          filter_pass = 1 === n && a > 1;
          break;
        case "robux":
          filter_pass = "1" === e.dataset.nteTradeRobux;
          break;
      }
    }
    if (filter_pass && trade_search_q) {
      filter_pass = does_trade_row_match_search(e, trade_search_q);
    }
    return filter_pass;
  }
  function sync_trade_list_empty_state(e, t) {
    let r = document.querySelector("#trade-row-scroll-container .simplebar-content") || document.getElementById("trade-row-scroll-container");
    if (!r) return;
    let n = document.getElementById("nteTradeListFilterEmpty");
    n ||
      ((n = document.createElement("div")),
      (n.id = "nteTradeListFilterEmpty"),
      (n.className = "text-date-hint"),
      (n.style.padding = "12px 4px"),
      (n.style.textAlign = "center"),
      (n.style.display = "none"),
      r.appendChild(n));
    let a = get_trade_list_filter_option(trade_filter_state.value);
    if (trade_search_q && trade_search_q.trim()) {
      let q = trade_search_q.trim();
      n.textContent = `No trades contain "${q}".`;
    } else {
      n.textContent = `No trades match ${a.label.toLowerCase()}.`;
    }
    let o = e > 0 && 0 === t;
    n.style.display = o ? "block" : "none";
  }
  function apply_trade_list_search_fast() {
    let rows = document.querySelectorAll(".trade-row-list .trade-row");
    if (!rows.length) return;
    let q = trade_search_q;
    let shown = 0,
      total = rows.length;
    let displays = new Array(total);
    for (let i = 0; i < total; i++) {
      let match = does_trade_row_match_search(rows[i], q);
      displays[i] = match;
      if (match) shown++;
    }
    for (let i = 0; i < total; i++) {
      rows[i].style.display = displays[i] ? "" : "none";
    }
    let cnt = document.getElementById("nteTradeListFilterCount");
    if (cnt) cnt.textContent = `Showing ${shown}/${total}`;
    sync_trade_list_empty_state(total, shown);
  }
  function apply_trade_list_filter() {
    let e = document.getElementById("nteTradeListFilter") || ensure_trade_list_filter_ui();
    let t = document.querySelectorAll(".trade-row-list .trade-row");
    if (!e || !t.length) return sync_trade_list_empty_state(0, 0), void 0;
    let fv = trade_filter_state.value;
    let r = 0,
      total = t.length;
    for (let i = 0; i < total; i++) {
      let row = t[i];
      let n = does_trade_row_match_filter(row, fv);
      row.style.display = n ? "" : "none";
      if (n) r++;
    }
    let cnt = document.getElementById("nteTradeListFilterCount");
    if (cnt) cnt.textContent = `Showing ${r}/${total}`;
    if (r === 0 && total > 0) {
      sync_trade_list_empty_state(total, 0);
    } else {
      sync_trade_list_empty_state(total, r);
    }
  }
  function reset_trade_row_status_hint_flex(el) {
    if (!el) return;
    if (el.querySelector(".nte-trade-row-decline-wrap")) return void apply_trade_row_status_hint_row_flex(el);
    let line = el.querySelector(".nte-trade-row-status-line");
    if (line?.parentNode === el) {
      while (line.firstChild) el.insertBefore(line.firstChild, line);
      line.remove();
    }
    el.style.removeProperty("display"),
      el.style.removeProperty("align-items"),
      el.style.removeProperty("flex-direction"),
      el.style.removeProperty("flex-wrap"),
      el.style.removeProperty("gap");
  }
  function apply_trade_row_status_hint_row_flex(el) {
    if (!el) return null;
    let line = el.querySelector(".nte-trade-row-status-line");
    if (!line) {
      line = document.createElement("span");
      line.className = "nte-trade-row-status-line";
      let decline_wrap = el.querySelector(".nte-trade-row-decline-wrap");
      for (let node of [...el.childNodes]) {
        if (node === line || node === decline_wrap) continue;
        line.appendChild(node);
      }
      decline_wrap ? el.insertBefore(line, decline_wrap) : el.appendChild(line);
    } else {
      let decline_wrap = el.querySelector(".nte-trade-row-decline-wrap");
      for (let node of [...el.childNodes]) {
        if (node === line || node === decline_wrap) continue;
        line.appendChild(node);
      }
      decline_wrap && line.nextSibling !== decline_wrap && el.insertBefore(line, decline_wrap);
    }
    (el.style.display = "inline-flex"),
      (el.style.alignItems = "flex-start"),
      (el.style.flexDirection = "column"),
      (el.style.flexWrap = "nowrap"),
      (el.style.gap = "1px"),
      (line.style.display = "inline-flex"),
      (line.style.alignItems = "center"),
      (line.style.flexDirection = "row"),
      (line.style.flexWrap = "nowrap"),
      (line.style.gap = "4px");
    return line;
  }
  function remove_trade_row_rolimons_links() {
    for (let link of [...document.querySelectorAll("a.nte-trade-row-rolimons-link")]) {
      let parent = link.parentElement;
      link.remove();
      parent?.classList.contains("text-date-hint") && reset_trade_row_status_hint_flex(parent);
    }
    for (let wrap of [...document.querySelectorAll(".nte-trade-row-name-inline")])
      if (1 === wrap.childElementCount && wrap.querySelector(".text-lead")) {
        let name_el = wrap.querySelector(".text-lead");
        wrap.parentNode.insertBefore(name_el, wrap);
        wrap.remove();
      }
  }
  function unwrap_trade_row_name_inline(row) {
    let stale = row.querySelector(".nte-trade-row-name-inline");
    if (!stale?.parentNode) return;
    let nl = stale.querySelector(".text-lead");
    nl && stale.parentNode.insertBefore(nl, stale);
    stale.querySelector("a.nte-trade-row-rolimons-link")?.remove();
    stale.remove();
  }
  function ensure_trade_row_rolimons_link(row) {
    if (!row?.querySelector) return;
    let href = row.querySelector(".avatar-card-link")?.getAttribute("href") || "",
      m = href.match(/\/users\/(\d+)\//);
    if (!m) return;
    let user_id = m[1];
    unwrap_trade_row_name_inline(row);
    let status_hint = row.querySelector(".text-date-hint:not(.trade-sent-date)") || row.querySelector(".text-date-hint");
    if (!status_hint) return;
    let existing_hint = status_hint.querySelector("a.nte-trade-row-rolimons-link");
    if (existing_hint && existing_hint.getAttribute("data-nte-user-id") === user_id) {
      for (let link of row.querySelectorAll("a.nte-trade-row-rolimons-link"))
        if (link !== existing_hint) {
          let parent = link.parentElement;
          link.remove();
          parent?.classList.contains("text-date-hint") && reset_trade_row_status_hint_flex(parent);
        }
      existing_hint.removeAttribute("data-toggle"),
        existing_hint.removeAttribute("title"),
        existing_hint.removeAttribute("data-original-title"),
        existing_hint.setAttribute("aria-label", "Open Rolimons profile");
      let status_line = apply_trade_row_status_hint_row_flex(status_hint);
      (existing_hint.style.width = "18px"),
        (existing_hint.style.height = "18px"),
        (existing_hint.style.transform = "translateY(1px)"),
        (existing_hint.style.flexShrink = "0");
      let ic = existing_hint.querySelector(".icon-link");
      ic && ((ic.style.width = "16px"), (ic.style.height = "16px"));
      return;
    }
    for (let link of row.querySelectorAll("a.nte-trade-row-rolimons-link")) {
      let parent = link.parentElement;
      link.remove();
      parent?.classList.contains("text-date-hint") && reset_trade_row_status_hint_flex(parent);
    }
    let a = document.createElement("a");
    (a.className = "nte-trade-row-rolimons-link"),
      (a.href = "https://www.rolimons.com/player/" + user_id),
      (a.target = "_blank"),
      (a.rel = "noopener noreferrer"),
      a.setAttribute("data-nte-user-id", user_id),
      a.setAttribute("aria-label", "Open Rolimons profile"),
      (a.style.display = "inline-block"),
      (a.style.width = "18px"),
      (a.style.height = "18px"),
      (a.style.transform = "translateY(1px)"),
      (a.style.textDecoration = "none"),
      (a.style.flexShrink = "0");
    let icon = document.createElement("span"),
      svg_asset = "dark" === c.getColorMode() ? "rolimonsLink.svg" : "rolimonsLinkDark.svg";
    (icon.style.backgroundImage = "url(" + JSON.stringify(c.getURL(`assets/${svg_asset}`)) + ")"),
      (icon.className = "icon icon-link"),
      (icon.style.display = "inline-block"),
      (icon.style.backgroundSize = "cover"),
      (icon.style.width = "16px"),
      (icon.style.height = "16px"),
      (icon.style.cursor = "pointer"),
      (icon.style.transition = "filter 0.2s"),
      (icon.style.backgroundColor = "transparent"),
      (icon.style.pointerEvents = "none"),
      (a.onmouseenter = () => {
        icon.style.filter = "brightness(50%)";
      }),
      (a.onmouseleave = () => {
        icon.style.filter = "";
      }),
      a.appendChild(icon);
    let status_line = apply_trade_row_status_hint_row_flex(status_hint);
    (status_line || status_hint).appendChild(a);
  }
  function get_trade_row_status_hint(row) {
    return row?.querySelector(".text-date-hint:not(.trade-sent-date)") || row?.querySelector(".text-date-hint") || null;
  }
  function remove_trade_row_decline_buttons(scope = document) {
    for (let wrap of [...scope.querySelectorAll(".nte-trade-row-decline-wrap")]) {
      let row = wrap.closest(".trade-row");
      let status_hint = wrap.closest(".text-date-hint");
      row?.classList.remove("nte-trade-row-has-decline");
      wrap.remove();
      status_hint && reset_trade_row_status_hint_flex(status_hint);
    }
  }
  function remove_trade_row_decline_button(row) {
    if (!row?.querySelector) return;
    let status_hint = row.querySelector(".nte-trade-row-decline-wrap")?.closest(".text-date-hint");
    row.classList.remove("nte-trade-row-has-decline");
    row.querySelector(".nte-trade-row-decline-wrap")?.remove();
    status_hint && reset_trade_row_status_hint_flex(status_hint);
  }
  function is_trade_row_decline_tab() {
    let tab = get_current_trade_tab();
    return tab === "inbound" || tab === "outbound";
  }
  let trade_row_decline_prime_started = false;
  let trade_row_decline_enabled = true;
  function prime_trade_row_decline() {
    if (trade_row_decline_prime_started) return;
    trade_row_decline_prime_started = true;
    nte_send_message({ type: "trade_row_prepare_decline" }, function () {});
  }
  function prime_trade_row_id(row) {
    if (!row?.isConnected) return;
    if (get_selected_trade_id_sync(row) || row.getAttribute("data-nru-row-token")) return;
    let index = get_trade_row_index(row);
    if (index < 0) return;
    H(row, index).catch(() => {});
  }
  function get_trade_row_index(row) {
    return [...document.querySelectorAll(".trade-row-list .trade-row")].indexOf(row);
  }
  function get_trade_row_cached_trade(trade_id, saved_trades = null) {
    let key = String(trade_id || "");
    if (!key) return null;
    let raw = get_trade_row_raw_cache_entry(key) || saved_trades?.[key] || saved_trades?.[trade_id];
    if (raw) return set_trade_row_cached_trade(key, raw);
    return row_trade_cache[key] || null;
  }
  async function prewarm_trade_row_detail(row) {
    if (!row?.isConnected) return;
    let trade_id = get_selected_trade_id_sync(row);
    if (!trade_id) {
      prime_trade_row_id(row);
      trade_id = await J(row, 3);
    }
    if (!trade_id) return;
    let trade = get_trade_row_cached_trade(trade_id);
    trade || (trade = !row_trade_pending[trade_id] ? await K(trade_id).catch(() => null) : await row_trade_pending[trade_id].catch(() => null));
    trade && prewarm_trade_row_thumbnails(trade).catch(() => {});
  }
  let trade_row_detail_prewarm_bound = false;
  function bind_trade_row_detail_prewarm() {
    if (trade_row_detail_prewarm_bound) return;
    trade_row_detail_prewarm_bound = true;
    let handler = (event) => {
      let row = event.target instanceof Element ? event.target.closest(".trade-row-list .trade-row") : null;
      row && prewarm_trade_row_detail(row);
    };
    document.addEventListener("pointerover", handler, true);
    document.addEventListener("mousedown", handler, true);
    document.addEventListener("focusin", handler, true);
  }
  let trade_row_view_prewarm_bound = false;
  let trade_row_view_prewarm_timer = 0;
  let trade_row_view_prewarm_running = false;
  function schedule_trade_row_view_prewarm(delay = 0) {
    clearTimeout(trade_row_view_prewarm_timer);
    trade_row_view_prewarm_timer = setTimeout(run_trade_row_view_prewarm, delay);
  }
  async function run_trade_row_view_prewarm() {
    if (trade_row_view_prewarm_running) return;
    trade_row_view_prewarm_running = true;
    try {
      let retry = false;
      for (let row of get_trade_rows_for_processing().slice(0, 14)) {
        get_selected_trade_id_sync(row) || ((retry = true), prime_trade_row_id(row));
        prewarm_trade_row_detail(row).catch(() => {});
      }
      retry && schedule_trade_row_view_prewarm(350);
    } catch {}
    trade_row_view_prewarm_running = false;
  }
  function bind_trade_row_view_prewarm() {
    if (trade_row_view_prewarm_bound) return;
    trade_row_view_prewarm_bound = true;
    let schedule = () => schedule_trade_row_view_prewarm(80);
    let list = document.querySelector(".trade-row-list");
    let scroll_el = get_trade_list_scroll_element();
    scroll_el?.addEventListener("scroll", schedule, { passive: true });
    list &&
      new MutationObserver(schedule).observe(list, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "nrutradeid"],
      });
    schedule_trade_row_view_prewarm(0);
  }
  async function sync_trade_row_decline_button(row, saved_trades = null) {
    if (!row?.querySelector) return;
    if (!trade_row_decline_enabled || !is_trade_row_decline_tab()) return void remove_trade_row_decline_button(row);
    prime_trade_row_decline();
    let trade_id = get_selected_trade_id_sync(row);
    if (!trade_id) {
      prime_trade_row_id(row);
      trade_id = await J(row, 3);
    }
    if (!trade_id || !get_trade_row_cached_trade(trade_id, saved_trades)) {
      remove_trade_row_decline_button(row);
      return;
    }
    ensure_trade_row_decline_button(row);
  }
  function request_trade_row_decline(trade_id) {
    return new Promise((resolve) => {
      let settled = false;
      let finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result || { ok: false, status: 0, error: "No response." });
      };
      setTimeout(() => {
        finish({ ok: false, status: 0, error: "Decline timed out. Try again." });
      }, 15000);
      nte_send_message({ type: "trade_row_decline", trade_id }, function (result) {
        finish(result);
      });
    });
  }
  function set_trade_row_decline_button_state(btn, state, detail = "") {
    if (!btn) return;
    let label = "Decline";
    btn.dataset.nteState = state || "idle";
    btn.classList.remove("is-pending", "is-success", "is-error");
    btn.disabled = false;
    detail ? btn.setAttribute("title", detail) : btn.removeAttribute("title");
    switch (state) {
      case "pending":
        btn.classList.add("is-pending");
        btn.disabled = true;
        label = "...";
        break;
      case "success":
        btn.classList.add("is-success");
        label = "Done";
        break;
      case "error":
        btn.classList.add("is-error");
        label = "Retry";
        break;
    }
    btn.textContent = label;
  }
  function get_adjacent_trade_row(row) {
    let next = row?.nextElementSibling;
    while (next) {
      if (next.classList?.contains("trade-row") && "none" !== next.style.display) return next;
      next = next.nextElementSibling;
    }
    let prev = row?.previousElementSibling;
    while (prev) {
      if (prev.classList?.contains("trade-row") && "none" !== prev.style.display) return prev;
      prev = prev.previousElementSibling;
    }
    return null;
  }
  function remove_trade_row_after_decline(row, trade_id) {
    if (!row) return;
    let next_row = row.classList.contains("selected") ? get_adjacent_trade_row(row) : null;
    if (trade_id) {
      delete row_trade_cache[trade_id];
      delete row_trade_pending[trade_id];
    }
    row.classList.remove("selected", "nte-trade-row-has-decline");
    row.style.pointerEvents = "none";
    row.style.transition = "opacity .12s ease";
    row.style.opacity = "0";
    row.style.transform = "";
    row.style.overflow = "hidden";
    row.style.height = "0";
    row.style.minHeight = "0";
    row.style.margin = "0";
    row.style.paddingTop = "0";
    row.style.paddingBottom = "0";
    row.style.border = "0";
    row.style.display = "none";
    setTimeout(() => {
      if (next_row?.isConnected) {
        try {
          next_row.click();
        } catch {}
      }
      if (row.isConnected) row.remove();
      apply_trade_list_filter();
      L();
    }, 30);
  }
  function sync_trade_row_decline_position(row) {
    if (!row?.querySelector) return;
    let wrap = row.querySelector(".nte-trade-row-decline-wrap");
    if (!wrap) return;
    let box = row.querySelector(".tradeListValuesBox");
    let summary_width = box ? Math.ceil(box.getBoundingClientRect().width || box.offsetWidth || 0) : 0;
    let gap = summary_width > 0 ? 6 : 8;
    wrap.style.right = summary_width > 0 ? `${summary_width + gap}px` : `${gap}px`;
    wrap.style.bottom = "6px";
  }
  function ensure_trade_row_decline_button(row) {
    if (!row?.querySelector) return;
    let trade_id = get_selected_trade_id_sync(row);
    let wrap = row.querySelector(".nte-trade-row-decline-wrap");
    if (!trade_row_decline_enabled || !is_trade_row_decline_tab() || !trade_id || !get_trade_row_cached_trade(trade_id)) {
      remove_trade_row_decline_button(row);
      return;
    }
    prime_trade_row_decline();
    row.classList.add("nte-trade-row-has-decline");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "nte-trade-row-decline-wrap";
      row.appendChild(wrap);
    } else if (wrap.parentElement !== row) row.appendChild(wrap);
    let btn = wrap.querySelector(".nte-trade-row-decline");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nte-trade-row-decline";
      for (let ev of ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend", "dblclick"]) {
        btn.addEventListener(ev, (event) => {
          event.stopPropagation();
        });
      }
      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        let current_row = btn.closest(".trade-row");
        if (!current_row?.isConnected || btn.disabled) return;
        set_trade_row_decline_button_state(btn, "pending");
        let trade_id = get_selected_trade_id_sync(current_row);
        if (!trade_id || !get_trade_row_cached_trade(trade_id)) {
          set_trade_row_decline_button_state(btn, "error", "Trade data is not ready yet.");
          setTimeout(() => {
            btn.isConnected && set_trade_row_decline_button_state(btn, "idle");
          }, 1800);
          return;
        }
        let result = await request_trade_row_decline(trade_id);
        if (result?.ok) {
          set_trade_row_decline_button_state(btn, "success");
          remove_trade_row_after_decline(current_row, trade_id);
          return;
        }
        set_trade_row_decline_button_state(btn, "error", result?.error || "Decline failed.");
        setTimeout(() => {
          btn.isConnected && set_trade_row_decline_button_state(btn, "idle");
        }, 1800);
      });
      wrap.appendChild(btn);
    }
    if (!btn.dataset.nteState || btn.dataset.nteState === "idle") {
      set_trade_row_decline_button_state(btn, "idle");
    }
    sync_trade_row_decline_position(row);
  }
  let L_running = false,
    L_queued = false;
  async function L() {
    if (L_running) {
      L_queued = true;
      return;
    }
    L_running = true;
    try {
      await L_inner();
    } finally {
      L_running = false;
      if (L_queued) {
        L_queued = false;
        L();
      }
    }
  }
  async function L_inner() {
    let e = await c.getOption("Values on Trade Lists");
    trade_row_decline_enabled = false !== (await c.getOption("Show Quick Decline Button"));
    let quick_decline_tab = trade_row_decline_enabled && is_trade_row_decline_tab();
    quick_decline_tab && prime_trade_row_decline();
    document.getElementById("nteTradeListFilter") || ensure_trade_list_filter_ui() || document.getElementById("nteTradeListFilterEmpty")?.remove();
    bind_trade_list_scroll_refresh();
    bind_trade_row_detail_prewarm();
    bind_trade_row_view_prewarm();
    schedule_trade_row_view_prewarm(0);
    e ||
      (function () {
        for (let e of document.querySelectorAll(".tradeListValuesBox"))
          e.parentElement.parentElement.parentElement.removeAttribute("nruTradeId"), e.remove();
      })();
    if (!e && "all" === trade_filter_state.value && !trade_search_q) {
      await c.waitForElm(".trade-row");
      let saved_trades = quick_decline_tab ? (await new Promise((resolve) => nte_send_message("getTradeListData", resolve))) || {} : null;
      let pl = await c.getOption("Add User Profile Links");
      let rows = get_trade_rows_for_processing();
      if (pl) {
        for (let row of rows) ensure_trade_row_rolimons_link(row);
        c.initTooltips();
      } else remove_trade_row_rolimons_links();
      if (quick_decline_tab) {
        await Promise.all(rows.map((row) => sync_trade_row_decline_button(row, saved_trades)));
      } else remove_trade_row_decline_buttons();
      return apply_trade_list_filter();
    }
    await c.waitForElm(".trade-row"),
      nte_send_message("getTradeListData", async function (r) {
        let show_profile_links = await c.getOption("Add User Profile Links");
        if (!show_profile_links) remove_trade_row_rolimons_links();
        if (!quick_decline_tab) remove_trade_row_decline_buttons();
        async function t(t, n) {
          if (!t?.isConnected) return;
          show_profile_links && ensure_trade_row_rolimons_link(t);
          let a = t.getAttribute("nruTradeId");
          a || (await H(t, n));
          a = await J(t);
          if (!a) return;
          let l = await K(a, r);
          quick_decline_tab && (l ? ensure_trade_row_decline_button(t) : remove_trade_row_decline_button(t));
          if (!l?.offers?.[0] || !l?.offers?.[1] || !t.isConnected) return;
          let s = get_trade_row_filter_metrics(l);
          set_trade_row_filter_metrics(t, s);
          let all_trade_items = [...X(l.offers[0]), ...X(l.offers[1])];
          let item_names_arr = all_trade_items.map((it) => V(it)).filter(Boolean);
          t.dataset.nteTradeItemNames = item_names_arr.join("|");
          let d = X(l.offers[0]),
            u = X(l.offers[1]);
          let o = 0,
            i = 0;
          for (let e = 0; e < d.length; e++) {
            let t = d[e];
            o += c.getValueOrRAP(get_trade_row_item_id(t), V(t), t?.recentAveragePrice);
          }
          o += l.offers[0]?.robux || 0;
          for (let e = 0; e < u.length; e++) {
            let t = u[e];
            i += c.getValueOrRAP(get_trade_row_item_id(t), V(t), t?.recentAveragePrice);
          }
          if (((i += l.offers[1]?.robux || 0), !e)) {
            t.querySelector(".tradeListValuesBox")?.remove();
            quick_decline_tab && sync_trade_row_decline_position(t);
            return;
          }
          t.querySelector(".tradeListValuesBox")?.remove();
          let trade_delta = i - o,
            state = get_trade_profit_state_meta(trade_delta),
            palette = get_trade_profit_palette(),
            glow_color = state.equal ? palette.list_even_color : state.win ? palette.list_gain_color : palette.list_loss_color,
            glow_fill = state.equal ? palette.list_even_fill : state.win ? palette.list_gain_fill : palette.list_loss_fill;
          let box = document.createElement("div");
          box.className = "tradeListValuesBox";
          box.style.height = "60%";
          box.style.padding = "2px";
          box.style.zIndex = "0";
          box.style.borderTopLeftRadius = "8px";
          box.style.overflow = "visible";
          box.style.position = "absolute";
          box.style.bottom = "0";
          box.style.right = "0";
          let glow = document.createElement("div");
          glow.className = "glowBar";
          glow.style.marginTop = "2%";
          glow.style.marginLeft = "3%";
          glow.style.height = "90%";
          glow.style.width = "15px";
          glow.style.cssFloat = "left";
          glow.style.backgroundColor = glow_color;
          glow.style.backgroundImage = glow_fill;
          glow.style.borderTopLeftRadius = "8px";
          let rap = document.createElement("div");
          rap.className = "rapElement";
          rap.style.fontFamily = "HCo Gotham SSm, Helvetica Neue, Helvetica, Arial, Lucida Grande, sans-serif";
          rap.style.fontWeight = "bold";
          rap.style.fontSize = "15px";
          rap.style.lineHeight = trade_profit_colorblind_mode ? "1.3" : "1.5";
          rap.style.color = "rgb(255, 255, 255)";
          rap.style.zIndex = "1001";
          rap.style.marginLeft = "25px";
          rap.style.paddingRight = "3px";
          rap.style.fontVariantNumeric = "tabular-nums";
          rap.style.textShadow = "0 1px 2px rgba(0,0,0,0.35)";
          let span1 = document.createElement("span");
          span1.className = "amount-1 text-robux";
          span1.textContent = c.commafy(o);
          let hr = document.createElement("hr");
          hr.style.cssFloat = "right";
          hr.style.width = "80%";
          hr.style.backgroundColor = "rgba(0, 0, 0, 0.18)";
          hr.style.height = "2px";
          hr.style.border = "0px";
          hr.style.margin = "0px";
          hr.style.borderRadius = "1px";
          let span2 = document.createElement("span");
          span2.className = "amount-2 text-robux";
          span2.textContent = c.commafy(i);
          if (trade_profit_colorblind_mode) {
            let status = document.createElement("div");
            status.className = "tradeListState";
            status.textContent = state.label.toUpperCase();
            status.style.fontSize = "10px";
            status.style.fontWeight = "800";
            status.style.letterSpacing = "0.08em";
            status.style.lineHeight = "1";
            status.style.marginBottom = "2px";
            status.style.color = state.equal ? palette.list_even_label : state.win ? palette.list_gain_label : palette.list_loss_label;
            rap.append(status);
          }
          rap.append(span1, document.createElement("br"), hr, span2);
          box.append(glow, rap);
          let m = Z(t);
          m &&
            !t.querySelector(".tradeListValuesBox") &&
            (m === t && "static" === getComputedStyle(m).position && (m.style.position = "relative"), m.appendChild(box));
          quick_decline_tab && sync_trade_row_decline_position(t);
        }
        r || (r = {});
        let _ct = get_current_trade_tab();
        if (_ct === "inbound" || _ct === "outbound") prefetch_uncached_trades(r);
        let n = get_trade_rows_for_processing();
        for (let e = 0; e < n.length; e++) t(n[e], e);
        apply_trade_list_filter();
        show_profile_links && c.initTooltips();
      });
  }
  let prefetch_running = false,
    prefetch_last_tab = null,
    prefetch_last_time = 0,
    bg_fetch_running = false,
    bg_fetch_abort = false,
    bg_fetch_token = 0,
    auto_scroll_running = false;
  const bg_fetch_max = 2000,
    bg_fetch_pages = 20;

  function get_current_trade_tab() {
    let tab = new URLSearchParams(window.location.search).get("tab") || "inbound";
    return { inbound: "inbound", outbound: "outbound", completed: "completed", inactive: "inactive" }[tab.toLowerCase()] || "inbound";
  }

  async function fetch_all_trade_ids(type) {
    let all = [];
    let cursor = "";
    for (let page = 0; page < bg_fetch_pages && all.length < bg_fetch_max; page++) {
      if (get_current_trade_tab() !== type) break;
      let url = `https://trades.roblox.com/v1/trades/${type}?limit=100&sortOrder=Desc`;
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
      let resp = await fetch_trade_api(url, { credentials: "include" });
      if (!resp.ok) break;
      let data = await resp.json();
      for (let t of data.data || []) {
        all.push({ id: String(t.id), status: t.status });
        if (all.length >= bg_fetch_max) break;
      }
      cursor = data.nextPageCursor || "";
      if (!cursor) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    return all;
  }

  async function prefetch_uncached_trades(cached) {
    if (prefetch_running) return;
    let type = get_current_trade_tab();
    if (type === prefetch_last_tab && Date.now() - prefetch_last_time < 120000) return;
    prefetch_running = true;
    try {
      let all_trades = await fetch_all_trade_ids(type);
      prefetch_last_tab = type;
      prefetch_last_time = Date.now();
      let uncached = all_trades.filter((t) => !(t.id in cached) && !row_trade_cache[t.id]);
      if (uncached.length) {
        start_background_trade_fetch(uncached, type);
      }
    } catch {}
    prefetch_running = false;
  }

  function cancel_background_trade_fetch() {
    bg_fetch_abort = true;
    bg_fetch_token++;
    bg_fetch_running = false;
  }

  function start_background_trade_fetch(trades, type) {
    if (bg_fetch_running) return;
    trades = (Array.isArray(trades) ? trades : []).slice(0, bg_fetch_max);
    if (!trades.length) return;
    bg_fetch_running = true;
    bg_fetch_abort = false;
    let fetch_token = ++bg_fetch_token;
    (async () => {
      let skipped = 0;
      try {
        let status_map = trades.reduce((m, t) => {
          m[t.id] = t.status;
          return m;
        }, {});
        let cached = (await new Promise((r) => nte_send_message("getTradeListData", r))) || {};
        if (bg_fetch_abort || fetch_token !== bg_fetch_token) return;
        for (let t of trades) {
          if (bg_fetch_abort || fetch_token !== bg_fetch_token) break;
          if (get_current_trade_tab() !== type) break;
          if (row_trade_cache[t.id]) continue;
          if (t.id in cached) {
            set_trade_row_cached_trade(t.id, cached[t.id]);
            skipped++;
            continue;
          }
          try {
            let resp = await fetch_trade_api(`https://trades.roblox.com/v2/trades/${t.id}`, { credentials: "include" });
            if (bg_fetch_abort || fetch_token !== bg_fetch_token) break;
            if (200 === resp.status) {
              let trade = await resp.json();
              if (status_map[t.id]) trade.status = status_map[t.id];
              if (type) trade.tradeType = type;
              nte_send_message({ type: "cacheTrade", tradeId: t.id, trade }, function () {});
              set_trade_row_cached_trade(t.id, trade);
            } else if (429 === resp.status) {
              await new Promise((r) => setTimeout(r, 15000));
              continue;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 2500));
        }
      } finally {
        if (fetch_token === bg_fetch_token) {
          bg_fetch_running = false;
          if (!bg_fetch_abort && get_current_trade_tab() === type && (skipped > 0 || trades.length > 0)) L();
        }
      }
    })();
  }

  async function auto_scroll_trade_list() {
    if (auto_scroll_running) return;
    auto_scroll_running = true;
    let started_tab = get_current_trade_tab();
    try {
      let scroll_el = get_trade_list_scroll_element();
      if (!scroll_el) return;
      let last_count = 0;
      let stale_rounds = 0;
      for (let attempt = 0; attempt < 200; attempt++) {
        if (get_current_trade_tab() !== started_tab) break;
        let rows = document.querySelectorAll(".trade-row-list .trade-row");
        let count = rows.length;
        if (count === last_count) {
          stale_rounds++;
          if (stale_rounds >= 4) break;
        } else {
          stale_rounds = 0;
          last_count = count;
        }
        let saved = scroll_el.scrollTop;
        scroll_el.scrollTop = scroll_el.scrollHeight;
        scroll_el.dispatchEvent(new Event("scroll", { bubbles: true }));
        await new Promise((r) => requestAnimationFrame(r));
        scroll_el.scrollTop = saved;
        await new Promise((r) => setTimeout(r, 350));
      }
      if (get_current_trade_tab() === started_tab) L();
    } catch {}
    auto_scroll_running = false;
  }
  let custom_trade_bridge_promise;
  async function ensure_custom_trade_bridge() {
    if (custom_trade_bridge_promise) return custom_trade_bridge_promise;
    return (custom_trade_bridge_promise = new Promise((e, t) => {
      let r = document.getElementById("nruTradeBridgeScript"),
        n = !1,
        a = () => {
          o && clearTimeout(o),
            document.removeEventListener("nruTradeBridgeReady", i),
            r?.removeEventListener("load", l),
            r?.removeEventListener("error", d);
        },
        o = setTimeout(() => {
          (window.__nru_trade_bridge_loaded || "true" === r?.dataset?.nruReady) && i();
          n || ((custom_trade_bridge_promise = null), (n = !0), a(), t(Error("Timed out while attaching the Roblox trade bridge.")));
        }, 2600),
        i = () => {
          n || ((n = !0), a(), e());
        },
        l = () => {
          (window.__nru_trade_bridge_loaded || "true" === r?.dataset?.nruReady) && i();
        },
        d = () => {
          n || ((custom_trade_bridge_promise = null), (n = !0), a(), t(Error("Failed to load the Roblox trade bridge script.")));
        };
      if (
        (document.addEventListener("nruTradeBridgeReady", i),
        r ||
          ((r = document.createElement("script")),
          (r.id = "nruTradeBridgeScript"),
          (r.src = c.getURL("scripts/trade_bridge.js")),
          (document.head || document.documentElement).appendChild(r)),
        window.__nru_trade_bridge_loaded || "true" === r?.dataset?.nruReady)
      )
        return i();
      r.addEventListener("load", l), r.addEventListener("error", d);
    }));
  }
  async function run_custom_trade_bridge_action(e, t = {}) {
    await ensure_custom_trade_bridge();
    let r = String(t?.request_id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      timeout_ms = Math.max(2200, Number(t?.timeout_ms) || 0),
      on_progress = "function" == typeof t?.on_progress ? t.on_progress : null,
      payload = { ...t };
    delete payload.on_progress, delete payload.request_id;
    return new Promise((n, a) => {
      let o = setTimeout(() => {
          document.removeEventListener("nruTradeBridgeResult", i),
            document.removeEventListener("nruTradeBridgeProgress", l),
            a(Error("Timed out while syncing Roblox trade state"));
        }, timeout_ms),
        i = (event) => {
          if (event.detail?.request_id !== r) return;
          clearTimeout(o),
            document.removeEventListener("nruTradeBridgeResult", i),
            document.removeEventListener("nruTradeBridgeProgress", l),
            event.detail?.ok ? n(event.detail) : a(Error(event.detail?.error || "Bridge action failed"));
        },
        l = (e) => {
          e.detail?.request_id === r && on_progress?.(e.detail);
        };
      document.addEventListener("nruTradeBridgeResult", i),
        document.addEventListener("nruTradeBridgeProgress", l),
        document.dispatchEvent(
          new CustomEvent("nruTradeBridgeAction", {
            detail: JSON.stringify({ request_id: r, action: e, ...payload }),
          }),
        );
    });
  }
  async function dispatch_custom_trade_bridge_action(e, t = {}) {
    await ensure_custom_trade_bridge();
    document.dispatchEvent(
      new CustomEvent("nruTradeBridgeAction", {
        detail: JSON.stringify({
          request_id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          action: e,
          ...t,
        }),
      }),
    );
  }
  function find_collectible_item_instance_id(e) {
    if (!(e instanceof Element)) return null;
    let t = [e, ...e.querySelectorAll("[data-collectibleiteminstanceid]")];
    for (let e of t) {
      let t = e.getAttribute?.("data-collectibleiteminstanceid");
      if (t) return t;
    }
    for (let t = e; t; t = t.parentElement) {
      let e = t.getAttribute?.("data-collectibleiteminstanceid");
      if (e) return e;
    }
    return null;
  }
  function parse_native_offer_items(e) {
    let t = [],
      r = new Set();
    for (let n of e.querySelectorAll(".trade-request-item")) {
      let e = n.querySelector(".item-value, .item-card-price"),
        a = c.getItemIdFromElement(n),
        o = c.getItemNameFromElement(n),
        i = find_collectible_item_instance_id(n),
        l = e ? extract_displayed_rap(e) : 0,
        s = get_trade_el_value_ctx(n, a, o, l),
        d = i || `${s.targetId || "0"}:${s.name || "item"}:${t.length}`;
      if (!e && !s.targetId && !s.name) continue;
      if (r.has(d)) continue;
      r.add(d);
      t.push({
        collectible_item_instance_id: i,
        target_id: s.targetId,
        item_name: s.name || "Item",
        recent_average_price: s.rap,
        value: c.getValueOrRAP(s.targetId, s.name, s.rap),
        rap: c.getRAP(s.targetId, s.name, s.rap),
        rolimons_id: c.resolveRolimonsItemId(s.targetId, s.name, s.itemType === "Bundle"),
      });
    }
    return {
      items: t,
      robux: parseInt(e.querySelector('[name="robux"]')?.value || "0", 10) || 0,
    };
  }
  function get_native_offer_snapshot() {
    let e = document.querySelectorAll(".trade-request-window-offer");
    return e[0] && e[1] ? { mine: parse_native_offer_items(e[0]), theirs: parse_native_offer_items(e[1]) } : null;
  }
  function get_offer_signature(e) {
    return [
      ...e.mine.items.map((e) => e.collectible_item_instance_id || `${e.target_id}:${e.item_name}`),
      `r${e.mine.robux}`,
      "|",
      ...e.theirs.items.map((e) => e.collectible_item_instance_id || `${e.target_id}:${e.item_name}`),
      `r${e.theirs.robux}`,
    ].join("~");
  }
  function is_native_offer_item_present(e, t = get_native_offer_snapshot()) {
    if (!e || !t) return !1;
    let r = String(e);
    return [...t.mine.items, ...t.theirs.items].some((e) => String(e.collectible_item_instance_id || "") === r);
  }
  function get_native_offer_dom_fingerprint() {
    let e = document.querySelectorAll(".trade-request-window-offer");
    return e[0] && e[1]
      ? Array.from(e)
          .map((e) => {
            let t = Array.from(e.querySelectorAll(".trade-request-item"))
                .map((e, t) => {
                  let r = find_collectible_item_instance_id(e),
                    n = c.getItemIdFromElement(e),
                    a = c.getItemNameFromElement(e) || "";
                  return `${r || n || t}:${a}`;
                })
                .join("|"),
              r = parseInt(e.querySelector('[name="robux"]')?.value || "0", 10) || 0;
            return `${t}~r${r}`;
          })
          .join("||")
      : "";
  }
  function wait_for_custom_trade_signature_change(e, t = 3e3) {
    let r = Date.now();
    return new Promise((n) => {
      (async function a() {
        let o = get_native_offer_snapshot();
        if (o) {
          let t = get_offer_signature(o);
          if (t && t !== e) return n(t);
        }
        Date.now() - r >= t ? n(null) : (await U(70), a());
      })();
    });
  }
  function wait_for_native_offer_item_membership_change(e, t, r = 3e3) {
    let n = Date.now();
    return new Promise((a) => {
      (async function o() {
        if (is_native_offer_item_present(e) !== t) return a(!0);
        Date.now() - n >= r ? a(!1) : (await U(70), o());
      })();
    });
  }
  function wait_for_native_offer_dom_change(e, t = 3e3) {
    let r = document.querySelector(".trade-request-window-offers-parent");
    return new Promise((n) => {
      let a = !1,
        o = null,
        i = null,
        l = null,
        s = () => {
          let t = get_native_offer_dom_fingerprint();
          t && t !== e && d(!0);
        },
        d = (e) => {
          a || ((a = !0), o?.disconnect(), i && clearInterval(i), l && clearTimeout(l), n(e));
        };
      r &&
        window.MutationObserver &&
        ((o = new MutationObserver(s)), o.observe(r, { childList: !0, subtree: !0, attributes: !0, characterData: !0 }));
      i = setInterval(s, 70);
      l = setTimeout(() => d(!1), t);
      s();
    });
  }
  function build_custom_trade_bridge_item(e) {
    let target_id = parseInt(e.target_id ?? e.targetId ?? e.assetId ?? e.bundleId ?? 0, 10) || 0,
      item_type = e.item_type || e.itemType || "Asset",
      collectible_item_id = e.collectible_item_id ?? e.collectibleItemId ?? null,
      collectible_item_instance_id = e.collectible_item_instance_id ?? e.collectibleItemInstanceId ?? null,
      item_name = e.item_name || e.itemName || e.name || "Unknown",
      serial_number = e.serial_number ?? e.serialNumber ?? null,
      original_price = e.original_price ?? e.originalPrice ?? null,
      recent_average_price = parseInt(e.recent_average_price ?? e.recentAveragePrice ?? e.rap ?? 0, 10) || 0,
      asset_stock = parseInt(e.asset_stock ?? e.assetStock ?? 0, 10) || 0,
      user_asset_id =
        parseInt(
          e.user_asset_id ??
            e.userAssetId ??
            e.userAsset?.id ??
            e.userAsset?.userAssetId ??
            e.id ??
            0,
          10,
        ) || 0,
      user_id = parseInt(e.user_id ?? e.userId ?? 0, 10) || 0;
    return {
      collectibleItemId: collectible_item_id,
      collectibleItemInstanceId: collectible_item_instance_id,
      collectibleItemInstance: collectible_item_instance_id ? { collectibleItemInstanceId: collectible_item_instance_id } : void 0,
      itemTarget: { itemType: item_type, targetId: String(target_id) },
      itemType: item_type,
      targetId: target_id,
      assetId: "Asset" === item_type ? target_id : e.assetId,
      bundleId: "Bundle" === item_type ? target_id : e.bundleId,
      itemName: item_name,
      name: item_name,
      serialNumber: serial_number,
      originalPrice: original_price,
      recentAveragePrice: recent_average_price,
      rap: recent_average_price,
      assetStock: asset_stock,
      isOnHold: !!e.is_on_hold,
      userAssetId: user_asset_id,
      userId: user_id || void 0,
      id: e.id ?? collectible_item_instance_id ?? user_asset_id ?? target_id,
      itemRestrictions: Array.isArray(e.item_restrictions) ? e.item_restrictions : Array.isArray(e.itemRestrictions) ? e.itemRestrictions : [],
      layoutOptions: {
        ...(e.layoutOptions || {}),
        isUnique: null != serial_number,
        limitedNumber: serial_number,
        isLimitedNumberShown: null != serial_number,
        isIconDisabled: !1,
      },
    };
  }
  var nte_trade_sales_hover_style_injected = false;
  var nte_trade_sales_hover_panel = null;
  var nte_trade_sales_hover_show_timer = 0;
  var nte_trade_sales_hover_hide_timer = 0;
  var nte_trade_sales_hover_active_el = null;
  var nte_trade_sales_hover_request_token = 0;
  function nte_make_lru(max, ttl_ms) {
    let m = new Map();
    return {
      get(k) {
        let e = m.get(k);
        if (!e) return undefined;
        if (Date.now() - e.t > ttl_ms) { m.delete(k); return undefined; }
        m.delete(k); m.set(k, e);
        return e.v;
      },
      set(k, v) {
        if (m.has(k)) m.delete(k);
        m.set(k, { v, t: Date.now() });
        while (m.size > max) m.delete(m.keys().next().value);
      },
      clear() { m.clear(); },
    };
  }
  var nte_trade_sales_hover_data_cache = nte_make_lru(300, 3e5);
  var nte_trade_economy_v2_detail_cache = nte_make_lru(500, 18e5);
  var nte_trade_economy_v1_resale_cache = nte_make_lru(500, 18e5);
  var nte_trade_bundle_detail_cache = nte_make_lru(500, 18e5);
  function inject_trade_sales_hover_styles() {
    if (nte_trade_sales_hover_style_injected) return;
    ensure_demand_styles();
    nte_trade_sales_hover_style_injected = true;
    let style = document.createElement("style");
    style.id = "nteTradeSalesHoverStyle";
    style.textContent = `
      .nte-sales-hover-panel{
        position:fixed; z-index:100000; width:320px; max-width:calc(100vw - 16px); padding:12px;
        border-radius:8px; border:1px solid rgba(255,255,255,0.12); background:rgba(24,26,30,0.98);
        box-shadow:0 18px 40px rgba(0,0,0,0.42); color:#eceef1; pointer-events:none; opacity:0; visibility:hidden;
        transform:translateY(4px) scale(.98); transition:opacity .12s ease, transform .12s ease, visibility 0s linear .12s;
      }
      .nte-sales-hover-panel.is-visible{opacity:1;visibility:visible;transform:translateY(0) scale(1);pointer-events:auto;transition-delay:0s}
      .light-theme .nte-sales-hover-panel{background:rgba(255,255,255,0.985);color:#1f2937;border-color:rgba(15,23,42,0.12);box-shadow:0 18px 40px rgba(15,23,42,0.15)}
      .nte-sales-hover-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .nte-sales-hover-title{font-size:13px;font-weight:800;line-height:1.25}
      .nte-sales-hover-serial{font-size:12px;font-weight:800;opacity:.72;white-space:nowrap}
      .light-theme .nte-sales-hover-serial{opacity:.68}
      .nte-sales-hover-sub{
        display:flex;flex-wrap:wrap;align-items:baseline;gap:.35ch .5ch;
        margin-top:3px;font-size:11px;font-weight:500;line-height:1.35;opacity:.78
      }
      .nte-sales-hover-sub-line{display:inline-flex;align-items:baseline;gap:.25ch;flex-wrap:nowrap}
      .nte-sales-hover-demand-prelude{font-weight:inherit;white-space:pre}
      .nte-sales-hover-sub-sep{opacity:.55;font-weight:inherit}
      .nte-sales-hover-price-status{font-weight:inherit}
      .nte-sales-hover-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
      .nte-sales-hover-badge{padding:2px 7px;border-radius:999px;font-size:10px;font-weight:800;background:rgba(255,255,255,.08)}
      .light-theme .nte-sales-hover-badge{background:rgba(15,23,42,.07)}
      .nte-sales-hover-badge.warn{background:rgba(245,158,11,.18);color:#fbbf24}
      .nte-sales-hover-badge.danger{background:rgba(239,68,68,.18);color:#fca5a5}
      .nte-sales-hover-badge.good{background:rgba(34,197,94,.18);color:#86efac}
      .nte-sales-hover-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
      .nte-sales-hover-stat{padding:8px 9px;border-radius:8px;background:rgba(255,255,255,.05)}
      .light-theme .nte-sales-hover-stat{background:rgba(15,23,42,.045)}
      .nte-sales-hover-label{font-size:10px;font-weight:700;opacity:.72;text-transform:uppercase;letter-spacing:.04em}
      .nte-sales-hover-value{margin-top:3px;font-size:14px;font-weight:800}
      .nte-sales-hover-note{margin-top:10px;font-size:11px;line-height:1.45;opacity:.82}
      .nte-sales-hover-sales{margin-top:10px}
      .nte-sales-hover-sales-title{font-size:11px;font-weight:800;opacity:.8;margin-bottom:6px}
      .nte-sales-hover-sales-list.is-expanded{max-height:168px;overflow:auto;padding-right:4px}
      .nte-sales-hover-sale{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0;font-size:11px;border-top:1px solid rgba(255,255,255,.06)}
      .light-theme .nte-sales-hover-sale{border-top-color:rgba(15,23,42,.06)}
      .nte-sales-hover-sale:first-of-type{border-top:0}
      .nte-sales-hover-sale-date{opacity:.72}
      .nte-sales-hover-sale-price{font-weight:800}
      .nte-sales-hover-more{margin-top:8px}
      .nte-sales-hover-more-btn{
        appearance:none;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit;
        border-radius:999px;padding:6px 10px;font:inherit;font-size:11px;font-weight:700;cursor:pointer;
      }
      .light-theme .nte-sales-hover-more-btn{border-color:rgba(15,23,42,.12);background:rgba(15,23,42,.05)}
      .nte-sales-hover-loading,.nte-sales-hover-empty{font-size:12px;opacity:.82;line-height:1.45}
      .nte-sales-hover-chart-wrap{margin-top:10px}
      .nte-sales-hover-chart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px}
      .nte-sales-hover-chart-head .nte-sales-hover-sales-title{margin-bottom:0;padding-top:3px}
      .nte-sales-hover-chart-filters{display:flex;align-items:center;justify-content:flex-end;gap:4px;flex-wrap:wrap;margin-left:auto}
      .nte-sales-hover-chart-filter{
        appearance:none;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:inherit;
        border-radius:999px;padding:4px 7px;font:inherit;font-size:10px;font-weight:800;line-height:1;cursor:pointer;opacity:.8;
      }
      .nte-sales-hover-chart-filter:hover{opacity:1}
      .nte-sales-hover-chart-filter.is-active{background:rgba(108,92,231,.24);border-color:rgba(108,92,231,.5);color:#ece8ff;opacity:1}
      .light-theme .nte-sales-hover-chart-filter{border-color:rgba(15,23,42,.12);background:rgba(15,23,42,.05)}
      .light-theme .nte-sales-hover-chart-filter.is-active{background:rgba(91,76,219,.14);border-color:rgba(91,76,219,.34);color:#4c1d95}
      .nte-sales-hover-chart{width:100%;height:84px;display:block;border-radius:8px;background:rgba(255,255,255,.04)}
      .light-theme .nte-sales-hover-chart{background:rgba(15,23,42,.04)}
      .nte-sales-hover-chart-empty{
        width:100%;height:84px;display:flex;align-items:center;justify-content:center;border-radius:8px;
        background:rgba(255,255,255,.04);font-size:11px;font-weight:700;opacity:.72;text-align:center;
      }
      .light-theme .nte-sales-hover-chart-empty{background:rgba(15,23,42,.04)}
      .nte-sales-hover-chart-grid{stroke:rgba(255,255,255,.08);stroke-width:1}
      .light-theme .nte-sales-hover-chart-grid{stroke:rgba(15,23,42,.08)}
      .nte-sales-hover-chart-line{fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:#6c5ce7}
      .nte-sales-hover-chart-line.is-sparse{stroke-width:1.7}
      .nte-sales-hover-chart-area{fill:rgba(108,92,231,.22);stroke:none}
      .light-theme .nte-sales-hover-chart-line{stroke:#5b4cdb}
      .light-theme .nte-sales-hover-chart-area{fill:rgba(91,76,219,.18)}
      .nte-sales-hover-chart-single-guide{stroke:rgba(255,255,255,.1);stroke-width:1}
      .light-theme .nte-sales-hover-chart-single-guide{stroke:rgba(15,23,42,.12)}
      .nte-sales-hover-chart-single-halo{fill:rgba(108,92,231,.16)}
      .light-theme .nte-sales-hover-chart-single-halo{fill:rgba(91,76,219,.12)}
      .nte-sales-hover-chart-single-dot{fill:#6c5ce7;stroke:rgba(255,255,255,.92);stroke-width:1.6}
      .light-theme .nte-sales-hover-chart-single-dot{fill:#5b4cdb;stroke:rgba(255,255,255,.8)}
      .nte-sales-hover-chart-single-value{fill:currentColor;opacity:.86;font-size:11px;font-weight:800}
      .nte-sales-hover-chart-single-date{fill:currentColor;opacity:.62;font-size:9px;font-weight:700}
      .nte-sales-hover-chart-sparse-guide{stroke:rgba(255,255,255,.09);stroke-width:1}
      .light-theme .nte-sales-hover-chart-sparse-guide{stroke:rgba(15,23,42,.1)}
      .nte-sales-hover-chart-sparse-dot{fill:#6c5ce7;stroke:rgba(255,255,255,.92);stroke-width:1.4}
      .light-theme .nte-sales-hover-chart-sparse-dot{fill:#5b4cdb;stroke:rgba(255,255,255,.8)}
      .nte-sales-hover-chart-sparse-date{fill:currentColor;opacity:.62;font-size:9px;font-weight:700}
      .nte-sales-hover-chart-hover-dot{pointer-events:none}
      .nte-sales-hover-chart-hover-dot-halo{
        fill:rgba(52,211,153,.32);
        transform-box:fill-box;
        transform-origin:50% 50%;
        animation:nte_sales_chart_hover_pulse 2.1s ease-out infinite;
      }
      .nte-sales-hover-chart-hover-dot-core{
        fill:#34d399;
        stroke:rgba(255,255,255,.92);
        stroke-width:1.2;
        filter:drop-shadow(0 0 5px rgba(16,185,129,.55));
      }
      .light-theme .nte-sales-hover-chart-hover-dot-core{fill:#059669;stroke:rgba(255,255,255,.75)}
      .light-theme .nte-sales-hover-chart-hover-dot-halo{fill:rgba(5,150,105,.28)}
      @keyframes nte_sales_chart_hover_pulse{
        0%{transform:scale(.5);opacity:1}
        60%{transform:scale(1.35);opacity:.06}
        100%{transform:scale(1.35);opacity:0}
      }
      .nte-sales-hover-chart-hit{cursor:default;pointer-events:all;fill:transparent}
      .nte-sales-chart-point-tooltip{
        position:fixed; z-index:100001; display:none; padding:5px 9px; border-radius:6px;
        font-size:12px; font-weight:800; pointer-events:none; white-space:nowrap;
        border:1px solid rgba(255,255,255,.12); box-shadow:0 6px 18px rgba(0,0,0,.38);
      }
      .nte-sales-chart-point-tooltip.is-dark{background:rgba(24,26,30,.97); color:#eceef1}
      .nte-sales-chart-point-tooltip.is-light{background:rgba(255,255,255,.97); color:#1f2937; border-color:rgba(15,23,42,.12)}
      .nte-sales-hover-btn{
        position:absolute; top:6px; left:6px; z-index:7; width:25px; height:25px; border-radius:999px;
        display:flex; align-items:center; justify-content:center; cursor:pointer; box-sizing:border-box;
        padding:0; appearance:none; -webkit-appearance:none; font:inherit; touch-action:manipulation; -webkit-tap-highlight-color:transparent;
        background:#494d5a; border:1px solid rgba(255,255,255,.1);
        box-shadow:0 4px 10px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.09);
        color:#f4d06f;
        transition:transform .12s ease, background .12s ease, border-color .12s ease, box-shadow .12s ease, color .12s ease;
      }
      .nte-sales-hover-btn:hover{
        transform:scale(1.08);
        background:#727375;
        border-color:rgba(255,255,255,.18);
        box-shadow:0 6px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.13);
        color:#ffe39a;
      }
      .nte-sales-hover-btn.is-pressed,.nte-rap-signal-btn.is-pressed{transform:scale(.9)!important}
      .nte-sales-hover-btn svg{width:15px;height:15px;display:block;overflow:visible}
      .nte-sales-hover-btn-glyph{fill:none;stroke:currentColor;stroke-width:2.25;stroke-linecap:round;stroke-linejoin:round}
      .light-theme .nte-sales-hover-btn{
        background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(235,238,244,.98));
        border:1px solid rgba(31,41,55,.12);
        box-shadow:0 4px 10px rgba(15,23,42,.12), inset 0 1px 0 rgba(255,255,255,.8);
        color:#b7791f;
      }
      .light-theme .nte-sales-hover-btn:hover{
        background:linear-gradient(180deg,#fff,rgba(242,245,250,.98));
        border-color:rgba(31,41,55,.18);
        color:#975a16;
      }
      .nte-rap-signal-btn{
        position:absolute; top:4px; right:4px; z-index:8; width:30px; height:30px;
        display:flex; align-items:center; justify-content:center; cursor:pointer; box-sizing:border-box;
        padding:0; appearance:none; -webkit-appearance:none; font:inherit; touch-action:manipulation; -webkit-tap-highlight-color:transparent;
        background:transparent; border:0; color:#9f4956;
        transition:transform .12s ease, filter .12s ease, color .12s ease;
      }
      .nte-rap-signal-btn:hover{
        transform:scale(1.08);
      }
      .nte-rap-signal-btn svg{width:100%;height:100%;display:block;overflow:visible}
      .nte-rap-signal-btn.is-over{color:#2e8068}
      .nte-rap-signal-btn.is-under{color:#9f4956}
      .nte-rap-signal-btn.is-over svg{filter:drop-shadow(0 7px 14px rgba(31,76,61,.34))}
      .nte-rap-signal-btn.is-under svg{filter:drop-shadow(0 7px 14px rgba(94,40,50,.32))}
      .nte-rap-signal-shell{fill:currentColor}
      .nte-rap-signal-chevron-over,.nte-rap-signal-chevron-under{display:none;fill:none;stroke:#f8fafc;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round}
      .nte-rap-signal-btn.is-over .nte-rap-signal-chevron-over{display:block}
      .nte-rap-signal-btn.is-under .nte-rap-signal-chevron-under{display:block}
      .light-theme .nte-rap-signal-btn.is-over svg{filter:drop-shadow(0 5px 11px rgba(31,76,61,.18))}
      .light-theme .nte-rap-signal-btn.is-under svg{filter:drop-shadow(0 5px 11px rgba(94,40,50,.18))}
      .nte-sales-hover-close{
        flex:none; width:32px; height:32px; border-radius:10px; border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.06); color:inherit; display:inline-flex; align-items:center; justify-content:center;
        appearance:none; -webkit-appearance:none; font:inherit; cursor:pointer; touch-action:manipulation; -webkit-tap-highlight-color:transparent;
        transition:background .12s ease, border-color .12s ease, transform .12s ease;
      }
      .nte-sales-hover-close:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18);transform:scale(1.03)}
      .nte-sales-hover-close svg{width:14px;height:14px;display:block}
      .light-theme .nte-sales-hover-close{background:rgba(15,23,42,.05);border-color:rgba(15,23,42,.1)}
      .light-theme .nte-sales-hover-close:hover{background:rgba(15,23,42,.09);border-color:rgba(15,23,42,.16)}
      .nte-sales-hover-usd{color:#f4cc66;font-weight:800}
      .light-theme .nte-sales-hover-usd{color:#b7791f}
      .nte-trade-row-status-line{display:inline-flex;align-items:center;flex-wrap:nowrap;gap:4px}
      .trade-row.nte-trade-row-has-decline{position:relative}
      .nte-trade-row-decline-wrap{
        position:absolute;top:auto;right:8px;bottom:6px;left:auto;transform:none;
        display:inline-flex;align-items:center;justify-content:flex-end;width:auto;max-width:100%;margin-top:0;line-height:1;z-index:2;
      }
      .nte-trade-row-decline{
        min-width:0;min-height:20px;padding:0 9px;border-radius:999px;border:1px solid rgba(148,163,184,.16);
        background:linear-gradient(180deg,rgba(30,41,59,.34),rgba(15,23,42,.28));color:#cbd5e1;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
        display:inline-flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;
        appearance:none;-webkit-appearance:none;font:inherit;font-size:10px;font-weight:700;letter-spacing:.01em;line-height:1;
        transition:background .14s ease, border-color .14s ease, box-shadow .14s ease, color .14s ease, opacity .14s ease;
        backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
      }
      .nte-trade-row-decline:hover{
        background:linear-gradient(180deg,rgba(127,29,29,.24),rgba(69,10,10,.18));
        border-color:rgba(248,113,113,.28);color:#ffe4e6;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 2px 8px rgba(2,6,23,.12);
      }
      .nte-trade-row-decline:disabled{cursor:wait}
      .nte-trade-row-decline.is-pending{
        background:linear-gradient(180deg,rgba(71,85,105,.3),rgba(51,65,85,.24));border-color:rgba(148,163,184,.24);color:#e2e8f0;
      }
      .nte-trade-row-decline.is-success{
        background:linear-gradient(180deg,rgba(21,128,61,.24),rgba(20,83,45,.18));border-color:rgba(134,239,172,.26);color:#dcfce7;
      }
      .nte-trade-row-decline.is-error{
        background:linear-gradient(180deg,rgba(180,83,9,.24),rgba(120,53,15,.18));border-color:rgba(253,186,116,.26);color:#ffedd5;
      }
      .light-theme .nte-trade-row-decline{
        background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(248,250,252,.92));border-color:rgba(148,163,184,.18);color:#64748b;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 1px 2px rgba(15,23,42,.03);
      }
      .light-theme .nte-trade-row-decline:hover{
        background:linear-gradient(180deg,rgba(255,250,250,.98),rgba(254,242,242,.96));border-color:rgba(239,68,68,.22);color:#b91c1c;box-shadow:inset 0 1px 0 rgba(255,255,255,.96),0 2px 6px rgba(15,23,42,.05);
      }
      .light-theme .nte-trade-row-decline.is-pending{
        background:linear-gradient(180deg,rgba(241,245,249,.98),rgba(226,232,240,.96));border-color:rgba(148,163,184,.24);color:#334155;
      }
      .light-theme .nte-trade-row-decline.is-success{
        background:linear-gradient(180deg,rgba(240,253,244,.98),rgba(220,252,231,.96));border-color:rgba(34,197,94,.22);color:#166534;
      }
      .light-theme .nte-trade-row-decline.is-error{
        background:linear-gradient(180deg,rgba(255,247,237,.98),rgba(254,215,170,.96));border-color:rgba(249,115,22,.22);color:#9a3412;
      }
      .item-card-link.nte-has-flag.nte-flag-side-left.nte-has-rap-signal .nte-sales-hover-btn{left:auto;right:6px;top:36px}
      .item-card-link.nte-has-flag.nte-flag-side-left:not(.nte-has-rap-signal) .nte-sales-hover-btn{left:auto;right:6px;top:6px}
      .item-card-link.nte-has-flag.nte-flag-side-right .nte-sales-hover-btn{left:6px;right:auto;top:6px}
      .item-card-link.nte-has-flag.nte-flag-side-right .nte-rap-signal-btn{right:6px;top:36px}
      .nte-sales-hover-panel.is-mobile{
        width:min(420px, calc(100vw - 12px)); max-width:min(420px, calc(100vw - 12px));
        max-height:calc(100vh - 16px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));
        overflow-y:auto; overscroll-behavior:contain; border-radius:16px;
        padding:14px 14px calc(14px + env(safe-area-inset-bottom,0px));
      }
      @media (hover:none), (pointer:coarse), (max-width: 700px) {
        .nte-sales-hover-btn { width:28px; height:28px; top:3px; left:3px; box-shadow:0 4px 10px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.09); }
        .nte-sales-hover-btn svg{width:13px;height:13px}
        .nte-rap-signal-btn { width:32px; height:32px; top:2px; right:2px; }
        .item-card-link.nte-has-flag.nte-flag-side-left.nte-has-rap-signal .nte-sales-hover-btn{left:auto;right:3px;top:33px}
        .item-card-link.nte-has-flag.nte-flag-side-left:not(.nte-has-rap-signal) .nte-sales-hover-btn{left:auto;right:3px;top:3px}
        .item-card-link.nte-has-flag.nte-flag-side-right .nte-sales-hover-btn{left:3px;right:auto;top:3px}
        .item-card-link.nte-has-flag.nte-flag-side-right .nte-rap-signal-btn{right:2px;top:33px}
        .nte-sales-hover-panel { max-width:calc(100vw - 12px); }
        .nte-sales-hover-close{width:36px;height:36px;border-radius:11px}
      }
    `;
    document.head.appendChild(style);
  }
  function trade_sales_hover_use_mobile_layout() {
    try {
      return window.innerWidth <= 700 || !!window.matchMedia("(hover:none), (pointer:coarse)").matches;
    } catch {
      return window.innerWidth <= 700;
    }
  }
  function trade_sales_hover_close_markup() {
    return '<button type="button" class="nte-sales-hover-close" aria-label="Close item panel"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>';
  }
  function wire_trade_sales_hover_panel_controls(panel) {
    let close_btn = panel?.querySelector(".nte-sales-hover-close");
    if (close_btn && !close_btn.__nte_trade_sales_bound) {
      close_btn.__nte_trade_sales_bound = !0;
      close_btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        hide_trade_sales_hover_panel();
      });
    }
    let toggle_btn = panel?.querySelector("[data-nte-sales-toggle]");
    if (toggle_btn && !toggle_btn.__nte_trade_sales_more_bound) {
      toggle_btn.__nte_trade_sales_more_bound = !0;
      toggle_btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        panel.dataset.nteSalesExpanded = panel.dataset.nteSalesExpanded === "1" ? "0" : "1";
        if (!panel.__nte_sales_data) return;
        rerender_trade_sales_hover_panel(panel);
        nte_trade_sales_hover_active_el && position_trade_sales_hover_panel(nte_trade_sales_hover_active_el);
      });
    }
    for (let filter_btn of panel?.querySelectorAll("[data-nte-sales-chart-filter]") || []) {
      if (filter_btn.__nte_trade_sales_chart_filter_bound) continue;
      filter_btn.__nte_trade_sales_chart_filter_bound = !0;
      filter_btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        let next_filter = get_trade_sales_chart_filter_key(filter_btn.getAttribute("data-nte-sales-chart-filter"));
        if (panel.dataset.nteSalesChartFilter === next_filter) return;
        panel.dataset.nteSalesChartFilter = next_filter;
        rerender_trade_sales_hover_panel(panel);
        nte_trade_sales_hover_active_el && position_trade_sales_hover_panel(nte_trade_sales_hover_active_el);
      });
    }
  }
  function ensure_trade_sales_hover_panel() {
    if (nte_trade_sales_hover_panel?.isConnected) return nte_trade_sales_hover_panel;
    inject_trade_sales_hover_styles();
    let panel = document.createElement("div");
    panel.className = "nte-sales-hover-panel";
    panel.addEventListener("mouseenter", () => {
      clearTimeout(nte_trade_sales_hover_hide_timer);
    });
    window.addEventListener(
      "scroll",
      (ev) => {
        if (!nte_trade_sales_hover_panel?.classList.contains("is-visible")) return;
        let t = ev.target;
        if (t === document || t === document.documentElement || t === document.body) hide_trade_sales_hover_panel();
      },
      { capture: !1, passive: !0 },
    );
    window.addEventListener("resize", hide_trade_sales_hover_panel);
    let handle_trade_sales_hover_press_away = (ev) => {
      if (!nte_trade_sales_hover_panel?.classList.contains("is-visible")) return;
      if (nte_trade_sales_hover_panel.contains(ev.target)) return;
      if (ev.target?.closest && ev.target.closest(".nte-sales-hover-btn,.nte-rap-signal-btn")) return;
      hide_trade_sales_hover_panel();
    };
    document.addEventListener("mousedown", handle_trade_sales_hover_press_away, true);
    document.addEventListener("touchstart", handle_trade_sales_hover_press_away, true);
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && nte_trade_sales_hover_panel?.classList.contains("is-visible")) hide_trade_sales_hover_panel();
    });
    document.body.appendChild(panel);
    nte_trade_sales_hover_panel = panel;
    return panel;
  }
  function schedule_trade_sales_hover_hide(delay = 120) {
    clearTimeout(nte_trade_sales_hover_show_timer);
    clearTimeout(nte_trade_sales_hover_hide_timer);
    nte_trade_sales_hover_hide_timer = setTimeout(hide_trade_sales_hover_panel, delay);
  }
  var nte_chart_point_tooltip_el = null;
  function hide_chart_point_sale_tooltip() {
    try {
      document.querySelectorAll(".nte-sales-hover-chart-hover-dot").forEach((g) => g.setAttribute("visibility", "hidden"));
    } catch {}
    nte_chart_point_tooltip_el && (nte_chart_point_tooltip_el.style.display = "none");
  }
  function ensure_chart_point_sale_tooltip() {
    if (nte_chart_point_tooltip_el?.isConnected) return nte_chart_point_tooltip_el;
    let el = document.getElementById("nte-sales-chart-point-tooltip");
    if (!el) {
      (el = document.createElement("div")).id = "nte-sales-chart-point-tooltip";
      el.className = "nte-sales-chart-point-tooltip is-dark";
      document.body.appendChild(el);
    }
    return (nte_chart_point_tooltip_el = el);
  }
  function get_trade_sales_pointer_point(ev) {
    let point = ev?.touches?.[0] || ev?.changedTouches?.[0] || ev;
    let x = Number(point?.clientX),
      y = Number(point?.clientY);
    return Number.isFinite(x) && Number.isFinite(y) ? { clientX: x, clientY: y } : null;
  }
  function position_chart_point_sale_tooltip(point, tip_el) {
    if (!point) return;
    let pad = 10,
      x = point.clientX + pad,
      y = point.clientY + pad;
    tip_el.style.display = "block";
    let r = tip_el.getBoundingClientRect();
    x > window.innerWidth - r.width - 6 && (x = window.innerWidth - r.width - 6);
    y > window.innerHeight - r.height - 6 && (y = window.innerHeight - r.height - 6);
    x < 6 && (x = 6);
    y < 6 && (y = 6);
    tip_el.style.left = `${Math.round(x)}px`;
    tip_el.style.top = `${Math.round(y)}px`;
  }
  function wire_trade_sales_chart_hovers(panel) {
    let svg = panel.querySelector("svg.nte-sales-hover-chart");
    if (!svg) return;
    let tip = ensure_chart_point_sale_tooltip(),
      hover_dot_g = svg.querySelector(".nte-sales-hover-chart-hover-dot");
    for (let node of svg.querySelectorAll(".nte-sales-hover-chart-hit")) {
      if (node.__nte_chart_point_wired) continue;
      node.__nte_chart_point_wired = !0;
      let move = (ev) => {
        let point = get_trade_sales_pointer_point(ev);
        if (!point) return;
        let raw = node.getAttribute("data-nte-price"),
          price = parseInt(raw, 10);
        if (!Number.isFinite(price)) return;
        if (hover_dot_g) {
          let cx = parseFloat(node.getAttribute("cx")),
            cy = parseFloat(node.getAttribute("cy"));
          Number.isFinite(cx) &&
            Number.isFinite(cy) &&
            (hover_dot_g.setAttribute("transform", `translate(${cx} ${cy})`),
            hover_dot_g.setAttribute("visibility", "visible"));
        }
        let date = node.getAttribute("data-nte-date") || "";
        tip.textContent = date ? `${c.commafy(price)} - ${date}` : c.commafy(price);
        document.documentElement.classList.contains("light-theme")
          ? (tip.classList.add("is-light"), tip.classList.remove("is-dark"))
          : (tip.classList.add("is-dark"), tip.classList.remove("is-light"));
        position_chart_point_sale_tooltip(point, tip);
      },
        leave = () => hide_chart_point_sale_tooltip();
      node.addEventListener("mouseenter", move);
      node.addEventListener("mousemove", move);
      node.addEventListener("click", move);
      node.addEventListener("touchstart", move, { passive: !0 });
      node.addEventListener("mouseleave", leave);
    }
  }
  function hide_trade_sales_hover_panel() {
    clearTimeout(nte_trade_sales_hover_show_timer);
    clearTimeout(nte_trade_sales_hover_hide_timer);
    nte_trade_sales_hover_active_el = null;
    hide_chart_point_sale_tooltip();
    nte_trade_sales_hover_panel?.classList.remove("is-visible");
    if (nte_trade_sales_hover_panel) {
      nte_trade_sales_hover_panel.dataset.nteSalesExpanded = "0";
      nte_trade_sales_hover_panel.dataset.nteSalesChartFilter = "all";
      nte_trade_sales_hover_panel.__nte_sales_data = null;
      nte_trade_sales_hover_panel.__nte_sales_mode = "";
      nte_trade_sales_hover_panel.__nte_sales_load_failed = !1;
      nte_trade_sales_hover_panel.classList.remove("is-mobile");
      nte_trade_sales_hover_panel.style.left = "-9999px";
      nte_trade_sales_hover_panel.style.top = "-9999px";
    }
  }
  function position_trade_sales_hover_panel(anchor) {
    let panel = ensure_trade_sales_hover_panel();
    if (!anchor || !panel) return;
    let position_anchor =
        anchor.classList?.contains("nte-sales-hover-btn") || anchor.classList?.contains("nte-rap-signal-btn")
          ? anchor.__nte_sales_source ||
            anchor.closest(".item-card-container") ||
            anchor.closest(".nte-sr-card") ||
            anchor.closest(".item-card-link") ||
            anchor.closest(".item-card-thumb-container") ||
            anchor.parentElement ||
            anchor
          : anchor,
      rect = position_anchor.getBoundingClientRect();
    if (!rect.width && !rect.height && anchor.__nte_last_rect) rect = anchor.__nte_last_rect;
    let mobile_layout = trade_sales_hover_use_mobile_layout(),
      panel_width = mobile_layout ? Math.min(420, window.innerWidth - 12) : Math.min(320, window.innerWidth - 16);
    panel.classList.toggle("is-mobile", mobile_layout);
    panel.style.width = `${panel_width}px`;
    panel.style.left = "-9999px";
    panel.style.top = "-9999px";
    panel.classList.add("is-visible");
    let panel_rect = panel.getBoundingClientRect(),
      left,
      top;
    if (mobile_layout) {
      left = Math.max(6, Math.round((window.innerWidth - panel_rect.width) / 2));
      top = Math.max(8, window.innerHeight - panel_rect.height - 8);
    } else {
      let gap = 10,
        top_candidate = rect.top;
      left = rect.right + gap;
      left + panel_rect.width > window.innerWidth - 8 && (left = rect.left - panel_rect.width - gap);
      left < 8 && (left = Math.max(8, window.innerWidth - panel_rect.width - 8));
      top = top_candidate + panel_rect.height > window.innerHeight - 8 ? Math.max(8, rect.bottom - panel_rect.height) : top_candidate;
    }
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }
  function parse_trade_sales_time(value) {
    if (null == value || "" === value) return NaN;
    if ("number" == typeof value) return value < 1e12 ? 1e3 * value : value;
    if (/^\d+$/.test(String(value))) {
      let parsed = parseInt(value, 10);
      return parsed < 1e12 ? 1e3 * parsed : parsed;
    }
    return new Date(value).getTime();
  }
  function format_trade_sales_date(value) {
    let time = parse_trade_sales_time(value);
    return Number.isFinite(time)
      ? new Intl.DateTimeFormat(void 0, {
          month: "short",
          day: "numeric",
        }).format(new Date(time))
      : "Unknown";
  }
  function trade_sales_average(values, fallback = 0) {
    let nums = values.map((v) => parseFloat(v)).filter((v) => Number.isFinite(v));
    return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : fallback;
  }
  function trade_sales_median(values, fallback = 0) {
    let nums = values.map((v) => parseFloat(v)).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (!nums.length) return fallback;
    let mid = Math.floor(nums.length / 2);
    return Math.round(nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2);
  }
  function normalize_trade_sales_points(payload) {
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
    return rows
      .map((row) => ({
        value: parseInt(row?.value ?? row?.price ?? row?.robux ?? row?.amount ?? 0, 10),
        time_ms: parse_trade_sales_time(row?.date ?? row?.timestamp ?? row?.time ?? row?.created ?? row?.saleDate ?? row?.soldAt),
      }))
      .filter((row) => Number.isFinite(row.value) && row.value > 0 && Number.isFinite(row.time_ms))
      .sort((a, b) => b.time_ms - a.time_ms);
  }
  function compute_trade_sales_summary(payload, fallback_rap = 0) {
    let points = normalize_trade_sales_points(payload);
    let rap = parseInt(payload?.recentAveragePrice ?? fallback_rap ?? 0, 10);
    if (!Number.isFinite(rap) || rap < 0) rap = points[0]?.value || 0;
    let now = Date.now(),
      day_ms = 864e5,
      values_7 = points.filter((p) => now - p.time_ms <= 7 * day_ms).map((p) => p.value),
      values_30 = points.filter((p) => now - p.time_ms <= 30 * day_ms).map((p) => p.value),
      values_prev_30 = points.filter((p) => now - p.time_ms > 30 * day_ms && now - p.time_ms <= 60 * day_ms).map((p) => p.value),
      avg_7 = trade_sales_average(values_7, rap),
      avg_30 = trade_sales_average(values_30, avg_7 || rap),
      prev_30 = trade_sales_average(values_prev_30, avg_30 || rap),
      median_30 = trade_sales_median(values_30, avg_30 || rap),
      trend_30 = prev_30 > 0 ? Math.round(((avg_30 - prev_30) / prev_30) * 100) : 0,
      recent_sales = points.map((point) => ({
        date_text: format_trade_sales_date(point.time_ms),
        value: point.value,
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
  function format_trade_sales_hover_usd(value) {
    let numeric = Number(value) || 0;
    return `$${(numeric * 3 / 1e3).toFixed(2)}`;
  }
  function format_trade_sales_hover_currency(value) {
    return `$${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  const trade_sales_recent_preview_count = 4;
  function build_trade_sales_recent_sales_html(summary, expanded = !1) {
    let recent_sales = Array.isArray(summary?.recent_sales) ? summary.recent_sales : [];
    if (!recent_sales.length) return '<div class="nte-sales-hover-note">Sale history unavailable right now.</div>';
    let visible_sales = expanded ? recent_sales : recent_sales.slice(0, trade_sales_recent_preview_count),
      toggle_html =
        recent_sales.length > trade_sales_recent_preview_count
          ? `<div class="nte-sales-hover-more"><button type="button" class="nte-sales-hover-more-btn" data-nte-sales-toggle="1">${expanded ? "Show fewer sales" : "Show more sales"}</button></div>`
          : "";
    return `<div class="nte-sales-hover-sales"><div class="nte-sales-hover-sales-title">Recent sales</div><div class="nte-sales-hover-sales-list${expanded ? " is-expanded" : ""}">${visible_sales
      .map(
        (sale) => `<div class="nte-sales-hover-sale">
            <span class="nte-sales-hover-sale-date">${String(sale.date_text || "").replace(/[<>]/g, "")}</span>
            <span class="nte-sales-hover-sale-price">${c.commafy(sale.value)}</span>
          </div>`,
      )
      .join("")}</div>${toggle_html}</div>`;
  }
  function sanitize_trade_sales_price_status(value) {
    let status = String(value || "").trim();
    if (!status) return "";
    let normalized = status.toLowerCase().replace(/[^a-z]/g, "");
    return ["invalid", "unknown", "undefined", "null", "none"].includes(normalized) ? "" : status;
  }
  async function fetch_trade_sales_payload(collectible_item_id) {
    if (null == collectible_item_id || "" === String(collectible_item_id).trim()) return null;
    let cid = encodeURIComponent(String(collectible_item_id).trim());
    try {
      let resp = await fetch(`https://apis.roblox.com/marketplace-sales/v1/item/${cid}/resale-data`, {
        credentials: "include",
      });
      if (resp.ok) return await resp.json().catch(() => null);
    } catch {}
    return null;
  }
  async function fetch_trade_economy_v1_asset_resale(asset_id) {
    let key = `econ1:${asset_id}`;
    let cached = nte_trade_economy_v1_resale_cache.get(key);
    if (cached) return cached;
    let out = null;
    try {
      let resp = await fetch(`https://economy.roblox.com/v1/assets/${encodeURIComponent(String(asset_id))}/resale-data`, {
        credentials: "include",
      });
      if (resp.ok) out = await resp.json().catch(() => null);
    } catch {}
    nte_trade_economy_v1_resale_cache.set(key, out);
    return out;
  }
  async function fetch_trade_economy_v2_asset_details(asset_id) {
    if (!asset_id) return null;
    let key = `econ2:${asset_id}`;
    let cached = nte_trade_economy_v2_detail_cache.get(key);
    if (cached) return cached;
    let out = null;
    try {
      let resp = await fetch(`https://economy.roblox.com/v2/assets/${encodeURIComponent(String(asset_id))}/details`, {
        credentials: "include",
      });
      if (resp.ok) out = await resp.json().catch(() => null);
    } catch {}
    nte_trade_economy_v2_detail_cache.set(key, out);
    return out;
  }
  async function fetch_trade_bundle_details(bundle_id) {
    if (!bundle_id) return null;
    let key = `bundle:${bundle_id}`;
    let cached = nte_trade_bundle_detail_cache.get(key);
    if (cached) return cached;
    let out = null;
    try {
      let resp = await fetch(`https://catalog.roblox.com/v1/bundles/${encodeURIComponent(String(bundle_id))}/details`, {
        credentials: "include",
      });
      if (resp.ok) out = await resp.json().catch(() => null);
    } catch {}
    nte_trade_bundle_detail_cache.set(key, out);
    return out;
  }
  function parse_lowest_resale_price_from_economy_v2(detail) {
    if (!detail) return null;
    let c = detail.CollectiblesItemDetails || detail.collectiblesItemDetails;
    let lp = c?.CollectibleLowestResalePrice ?? c?.collectibleLowestResalePrice ?? detail.CollectibleLowestResalePrice ?? detail.collectibleLowestResalePrice;
    let n = parseInt(lp, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function parse_lowest_resale_price_from_bundle_detail(detail) {
    if (!detail) return null;
    let c = detail.collectibleItemDetail || detail.CollectibleItemDetail;
    let lp = c?.lowestResalePrice ?? c?.lowestPrice ?? c?.LowestResalePrice ?? c?.LowestPrice ?? null;
    let n = parseInt(lp, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function extract_collectible_item_id_from_economy_v2(detail) {
    if (!detail) return null;
    let cid = detail.CollectibleItemId ?? detail.collectibleItemId ?? null;
    if (null == cid) return null;
    let s = String(cid).trim();
    return s ? s : null;
  }
  function extract_collectible_item_id_from_bundle_detail(detail) {
    if (!detail) return null;
    let c = detail.collectibleItemDetail || detail.CollectibleItemDetail;
    let cid = c?.collectibleItemId ?? c?.CollectibleItemId ?? null;
    if (null == cid) return null;
    let s = String(cid).trim();
    return s ? s : null;
  }
  function escape_html_attr(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }
  function trade_sales_hover_pointer_went_to_panel(related) {
    try {
      return !!(related && nte_trade_sales_hover_panel && (related === nte_trade_sales_hover_panel || nte_trade_sales_hover_panel.contains(related)));
    } catch {
      return !1;
    }
  }
  function trade_sales_chart_hover_dot_markup() {
    return `<g class="nte-sales-hover-chart-hover-dot" visibility="hidden" pointer-events="none"><circle class="nte-sales-hover-chart-hover-dot-halo" cx="0" cy="0" r="10"/><circle class="nte-sales-hover-chart-hover-dot-core" cx="0" cy="0" r="3.75"/></g>`;
  }
  const trade_sales_chart_timeframes = [
    { key: "8h", label: "8H", window_ms: 8 * 36e5 },
    { key: "1d", label: "1D", window_ms: 24 * 36e5 },
    { key: "7d", label: "7D", window_ms: 7 * 864e5 },
    { key: "1m", label: "1M", window_ms: 30 * 864e5 },
    { key: "all", label: "All", window_ms: 0 },
  ];
  function get_trade_sales_chart_filter_key(value) {
    let key = String(value || "").toLowerCase();
    return trade_sales_chart_timeframes.some((option) => option.key === key) ? key : "all";
  }
  function build_trade_sales_chart_filter_buttons(active_key) {
    let current = get_trade_sales_chart_filter_key(active_key);
    return `<div class="nte-sales-hover-chart-filters">${trade_sales_chart_timeframes
      .map(
        (option) =>
          `<button type="button" class="nte-sales-hover-chart-filter${option.key === current ? " is-active" : ""}" data-nte-sales-chart-filter="${option.key}">${option.label}</button>`,
      )
      .join("")}</div>`;
  }
  function filter_trade_sales_chart_points(points, filter_key) {
    let sorted = Array.isArray(points) ? points.slice().sort((a, b) => a.time_ms - b.time_ms) : [];
    let current = get_trade_sales_chart_filter_key(filter_key);
    if (!sorted.length || current === "all") return sorted;
    let option = trade_sales_chart_timeframes.find((entry) => entry.key === current);
    if (!option?.window_ms) return sorted;
    let filtered = sorted.filter((point) => Number(point?.time_ms) >= Date.now() - option.window_ms);
    if (filtered.length) return filtered;
    let latest_time = Number(sorted[sorted.length - 1]?.time_ms) || 0;
    if (latest_time <= 0) return [];
    filtered = sorted.filter((point) => Number(point?.time_ms) >= latest_time - option.window_ms);
    return filtered.length ? filtered : sorted.slice(-1);
  }
  function build_trade_sales_chart_header(filter_key) {
    return `<div class="nte-sales-hover-chart-head"><div class="nte-sales-hover-sales-title">Sales history</div>${build_trade_sales_chart_filter_buttons(filter_key)}</div>`;
  }
  function build_trade_sales_chart_empty_state(filter_key) {
    return `<div class="nte-sales-hover-chart-wrap">${build_trade_sales_chart_header(filter_key)}<div class="nte-sales-hover-chart-empty">No sales in range.</div></div>`;
  }
  function build_trade_sales_single_chart_svg(point, chart_head) {
    let W = 280,
      H = 84,
      cx = Math.round(W / 2),
      y = 34,
      base_y = H - 16,
      dtxt = escape_html_attr(format_trade_sales_date(point.time_ms));
    return `<div class="nte-sales-hover-chart-wrap">${chart_head}<svg class="nte-sales-hover-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <line class="nte-sales-hover-chart-grid" x1="22" y1="${base_y}" x2="${W - 22}" y2="${base_y}" />
      <line class="nte-sales-hover-chart-single-guide" x1="${cx}" y1="20" x2="${cx}" y2="${base_y}" />
      <text class="nte-sales-hover-chart-single-value" x="${cx}" y="17" text-anchor="middle">${c.commafy(point.value)}</text>
      <circle class="nte-sales-hover-chart-single-halo" cx="${cx}" cy="${y}" r="11"></circle>
      <circle class="nte-sales-hover-chart-single-dot" cx="${cx}" cy="${y}" r="5"></circle>
      <text class="nte-sales-hover-chart-single-date" x="${cx}" y="${H - 4}" text-anchor="middle">${dtxt}</text>
      <circle class="nte-sales-hover-chart-hit" cx="${cx}" cy="${y}" r="14" data-nte-price="${point.value}" data-nte-date="${dtxt}"></circle>
      ${trade_sales_chart_hover_dot_markup()}
    </svg></div>`;
  }
  function build_trade_sales_sparse_chart_svg(sorted, chart_head) {
    let W = 280,
      H = 84,
      pad_x = 18,
      pad_top = 12,
      pad_bottom = 18,
      inner_w = W - 2 * pad_x,
      inner_h = H - pad_top - pad_bottom;
    let vals = sorted.map((p) => p.value),
      vmin = Math.min(...vals),
      vmax = Math.max(...vals);
    vmax <= vmin && (vmax = vmin + 1);
    let step = sorted.length > 1 ? inner_w / (sorted.length - 1) : 0,
      x_at = (index) => pad_x + step * index,
      y_at = (value) => pad_top + (1 - (value - vmin) / (vmax - vmin)) * inner_h;
    let guides = sorted
        .map((p, index) => {
          let x = x_at(index).toFixed(1),
            y = y_at(p.value).toFixed(1);
          return `<line class="nte-sales-hover-chart-sparse-guide" x1="${x}" y1="${y}" x2="${x}" y2="${H - pad_bottom + 2}" />`;
        })
        .join(""),
      pts = sorted.map((p, index) => `${x_at(index).toFixed(1)},${y_at(p.value).toFixed(1)}`).join(" "),
      dates = sorted
        .map((p, index) => {
          let x = x_at(index).toFixed(1),
            d = String(format_trade_sales_date(p.time_ms) || "").replace(/[<>]/g, "");
          return `<text class="nte-sales-hover-chart-sparse-date" x="${x}" y="${H - 4}" text-anchor="middle">${d}</text>`;
        })
        .join(""),
      visible_dots = sorted
        .map((p, index) => {
          let x = x_at(index).toFixed(1),
            y = y_at(p.value).toFixed(1);
          return `<circle class="nte-sales-hover-chart-sparse-dot" cx="${x}" cy="${y}" r="4.1"></circle>`;
        })
        .join(""),
      hit_layer = sorted
        .map((p, index) => {
          let x = x_at(index).toFixed(1),
            y = y_at(p.value).toFixed(1),
            d = escape_html_attr(format_trade_sales_date(p.time_ms));
          return `<circle class="nte-sales-hover-chart-hit" cx="${x}" cy="${y}" r="12" data-nte-price="${p.value}" data-nte-date="${d}"></circle>`;
        })
        .join("");
    return `<div class="nte-sales-hover-chart-wrap">${chart_head}<svg class="nte-sales-hover-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <line class="nte-sales-hover-chart-grid" x1="${pad_x}" y1="${H - pad_bottom + 2}" x2="${W - pad_x}" y2="${H - pad_bottom + 2}" />
      ${guides}
      <polyline class="nte-sales-hover-chart-line is-sparse" points="${pts}" pointer-events="none" />
      ${visible_dots}
      ${hit_layer}
      ${dates}
      ${trade_sales_chart_hover_dot_markup()}
    </svg></div>`;
  }
  function rerender_trade_sales_hover_panel(panel) {
    if (!panel?.__nte_sales_data) return;
    panel.__nte_sales_mode === "rap_signal"
      ? render_trade_rap_signal_data(panel.__nte_sales_data, !!panel.__nte_sales_load_failed)
      : render_trade_sales_hover_data(panel.__nte_sales_data);
  }
  function build_trade_sales_chart_svg(points, filter_key = "all") {
    let active_filter = get_trade_sales_chart_filter_key(filter_key),
      sorted = filter_trade_sales_chart_points(points, active_filter),
      chart_head = build_trade_sales_chart_header(active_filter);
    if (Array.isArray(points) && points.length && !sorted.length) return build_trade_sales_chart_empty_state(active_filter);
    if (sorted.length === 1) return build_trade_sales_single_chart_svg(sorted[0], chart_head);
    if (sorted.length < 2) return "";
    if (sorted.length < 5) return build_trade_sales_sparse_chart_svg(sorted, chart_head);
    let W = 280,
      H = 84,
      pad = 6,
      inner_w = W - 2 * pad,
      inner_h = H - 2 * pad;
    let vals = sorted.map((p) => p.value),
      t0 = sorted[0].time_ms,
      t1 = sorted[sorted.length - 1].time_ms,
      vmin = Math.min(...vals),
      vmax = Math.max(...vals);
    t1 <= t0 && (t1 = t0 + 1);
    vmax <= vmin && (vmax = vmin + 1);
    let x_at = (t) => pad + ((t - t0) / (t1 - t0)) * inner_w,
      y_at = (v) => pad + (1 - (v - vmin) / (vmax - vmin)) * inner_h;
    let pts = sorted.map((p) => `${x_at(p.time_ms).toFixed(1)},${y_at(p.value).toFixed(1)}`).join(" ");
    let area =
      `M ${x_at(sorted[0].time_ms).toFixed(1)} ${H - pad} L ` +
      sorted.map((p) => `${x_at(p.time_ms).toFixed(1)},${y_at(p.value).toFixed(1)}`).join(" L ") +
      ` L ${x_at(sorted[sorted.length - 1].time_ms).toFixed(1)} ${H - pad} Z`;
    let hit_layer = sorted
        .map((p) => {
          let x = x_at(p.time_ms).toFixed(1),
            y = y_at(p.value).toFixed(1),
            d = escape_html_attr(format_trade_sales_date(p.time_ms));
          return `<circle class="nte-sales-hover-chart-hit" cx="${x}" cy="${y}" r="12" data-nte-price="${p.value}" data-nte-date="${d}"></circle>`;
        })
        .join("");
    return `<div class="nte-sales-hover-chart-wrap">${chart_head}<svg class="nte-sales-hover-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <line class="nte-sales-hover-chart-grid" x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" />
      <path class="nte-sales-hover-chart-area" d="${area}" />
      <polyline class="nte-sales-hover-chart-line" points="${pts}" pointer-events="none" />
      ${hit_layer}
      ${trade_sales_chart_hover_dot_markup()}
    </svg></div>`;
  }
  function get_trade_sales_hover_context_from_element(el) {
    let source_el = el?.__nte_sales_source || el;
    let data_el =
      source_el?.closest?.(".item-card-container,.trade-request-item,.nte-sr-card") ||
      el?.closest?.(".item-card-container,.trade-request-item,.nte-sr-card") ||
      source_el;
    let item = el?.__nte_sales_item || source_el?.__nte_sales_item || data_el?.__nte_sales_item || null;
    let fallback_target_id = c.getItemIdFromElement(data_el) || c.getItemIdFromElement(source_el) || 0,
      fallback_name = c.getItemNameFromElement(data_el) || c.getItemNameFromElement(source_el) || "Item",
      fallback_price_el = data_el?.querySelector?.(".item-card-price, .item-value") || source_el?.querySelector?.(".item-card-price, .item-value"),
      fallback_rap = (() => {
        if (!fallback_price_el) return 0;
        let t = fallback_price_el.cloneNode(true);
        for (let e of t.querySelectorAll(".valueSpan,.icon-rolimons,.icon-link,br")) e.remove();
        let r = (t.textContent || "").match(/\d[\d,]*/);
        return r ? parseInt(r[0].replace(/,/g, ""), 10) || 0 : 0;
      })();
    if (item) {
      let normalized = {
        ...item,
        targetId: item.targetId || item.itemTarget?.targetId || item.assetId || item.itemId || fallback_target_id || 0,
        itemType: item.itemType || item.itemTarget?.itemType || "Asset",
        name: item.name || item.itemName || fallback_name || "Item",
        rap: item.rap ?? item.recentAveragePrice ?? fallback_rap ?? 0,
      };
      let meta = get_trade_search_item_meta(normalized);
      return {
        name: normalized.name || "Item",
        target_id: normalized.targetId || 0,
        item_type: normalized.itemType || "Asset",
        rap: normalized.rap || 0,
        has_value: !!meta.hasValue,
        value: meta.value,
        rolimons_id: meta.rolimonsId,
        collectible_item_id: item.collectibleItemId || normalized.collectibleItemId || null,
        serial_number: item.serialNumber ?? null,
        is_on_hold: !!item.isOnHold,
        is_projected: !!meta.isProjected,
        demand: Number.isFinite(meta.demand) ? meta.demand : -1,
        demand_label: Number.isFinite(meta.demand) && meta.demand >= 0 ? meta.demandLabel : "No",
      };
    }
    let target_id = fallback_target_id,
      name = fallback_name,
      price_el = fallback_price_el,
      rap = (() => { if (!price_el) return 0; let t = price_el.cloneNode(true); for (let e of t.querySelectorAll(".valueSpan,.icon-rolimons,.icon-link,br")) e.remove(); let r = (t.textContent || "").match(/\d[\d,]*/); return r ? parseInt(r[0].replace(/,/g, ""), 10) || 0 : 0; })(),
      base = get_trade_el_value_ctx(data_el, target_id, name, rap),
      item_type = base.itemType || (data_el.querySelector('a[href*="/bundles/"]') || data_el.querySelector('[thumbnail-type="BundleThumbnail"]') ? "Bundle" : "Asset"),
      serial_text = data_el.querySelector(".limited-number")?.textContent || "",
      serial_number = parseInt(serial_text.replace(/[^\d]/g, ""), 10);
    Number.isFinite(serial_number) || (serial_number = null);
    let meta = get_trade_search_item_meta({
      targetId: base.targetId || target_id || 0,
      name: base.name || name || "Item",
      rap: base.rap || rap || 0,
      itemType: item_type,
    });
    return base.targetId || target_id
      ? {
          name: base.name || name || "Item",
          target_id: base.targetId || target_id || 0,
          item_type,
          rap: base.rap || rap || 0,
          has_value: !!meta.hasValue,
          value: meta.value,
          rolimons_id: meta.rolimonsId,
          collectible_item_id: base.collectibleItemId || null,
          serial_number,
          is_on_hold: !1,
          is_projected: !!meta.isProjected,
          demand: Number.isFinite(meta.demand) ? meta.demand : -1,
          demand_label: meta.demand >= 0 ? meta.demandLabel : "No",
        }
      : null;
  }
  async function fetch_trade_sales_hover_data(ctx) {
    let cache_key = `${ctx.collectible_item_id || ""}:${ctx.item_type}:${ctx.target_id}:${ctx.rap}:${ctx.value}`;
    let cache_entry = nte_trade_sales_hover_data_cache.get(cache_key);
    if (cache_entry) return cache_entry;
    let bundle_detail = "Bundle" === ctx.item_type && ctx.target_id ? await fetch_trade_bundle_details(ctx.target_id) : null;
    let econ_v2 = !bundle_detail && ctx.target_id ? await fetch_trade_economy_v2_asset_details(ctx.target_id) : null;
    let collectible_item_id =
      ctx.collectible_item_id || extract_collectible_item_id_from_bundle_detail(bundle_detail) || extract_collectible_item_id_from_economy_v2(econ_v2) || null;
    let sales_payload = collectible_item_id ? await fetch_trade_sales_payload(collectible_item_id) : null;
    let pts = normalize_trade_sales_points(sales_payload);
    if ((!pts.length || !sales_payload) && ctx.target_id && ctx.item_type !== "Bundle") {
      let eco1 = await fetch_trade_economy_v1_asset_resale(ctx.target_id);
      if (eco1 && normalize_trade_sales_points(eco1).length) sales_payload = eco1;
    }
    let summary = compute_trade_sales_summary(sales_payload || {}, ctx.rap || 0);
    let lowest_price = parse_lowest_resale_price_from_bundle_detail(bundle_detail) || parse_lowest_resale_price_from_economy_v2(econ_v2);
    let chart_points = normalize_trade_sales_points(sales_payload || {});
    let price_status = "",
      is_off_sale = !1;
    if (bundle_detail) {
      let sale_status = sanitize_trade_sales_price_status(
        bundle_detail?.collectibleItemDetail?.saleStatus || bundle_detail?.CollectibleItemDetail?.SaleStatus || "",
      );
      let normalized_sale_status = sale_status.toLowerCase().replace(/[^a-z]/g, "");
      if (sale_status) {
        price_status = sale_status;
        if (["offsale", "notforsale"].includes(normalized_sale_status)) is_off_sale = !0;
      } else if (bundle_detail?.product?.isForSale === !1) {
        is_off_sale = !0;
        price_status = "Offsale";
      }
    } else if (econ_v2) {
      if (econ_v2.IsForSale === !1 || econ_v2.isForSale === !1) (is_off_sale = !0), (price_status = "Not for sale");
      else if (econ_v2.IsLimited === !0 || econ_v2.isLimited === !0) price_status = price_status || "Limited";
    }
    let resale_active =
      (Number.isFinite(lowest_price) && lowest_price > 0) ||
      (Array.isArray(chart_points) && chart_points.length > 0) ||
      (Array.isArray(summary?.recent_sales) && summary.recent_sales.length > 0);
    let normalized_price_status = String(price_status).toLowerCase().replace(/[^a-z]/g, "");
    if (resale_active) {
      is_off_sale = !1;
      if (["notforsale", "offsale"].includes(normalized_price_status)) price_status = "";
    }
    price_status = sanitize_trade_sales_price_status(price_status);
    let routility_usd = get_trade_sales_hover_routility_usd(ctx);
    let data = {
      ...ctx,
      collectible_item_id,
      sales_payload,
      summary,
      chart_points,
      lowest_price,
      price_status,
      is_off_sale,
      routility_usd,
    };
    nte_trade_sales_hover_data_cache.set(cache_key, data);
    return data;
  }
  function render_trade_sales_hover_loading(ctx) {
    hide_chart_point_sale_tooltip();
    let panel = ensure_trade_sales_hover_panel();
    panel.dataset.nteSalesExpanded = "0";
    panel.dataset.nteSalesChartFilter = "all";
    panel.__nte_sales_data = null;
    panel.__nte_sales_mode = "";
    panel.__nte_sales_load_failed = !1;
    panel.innerHTML = `<div class="nte-sales-hover-head"><div class="nte-sales-hover-title">${String(ctx?.name || "Item").replace(/[<>]/g, "")}${
      ctx?.serial_number != null ? ` <span class="nte-sales-hover-serial">#${ctx.serial_number}</span>` : ""
    }</div>${trade_sales_hover_close_markup()}</div><div class="nte-sales-hover-loading"><div style="margin-top:6px;">RAP: ${c.commafy(ctx?.rap || 0)}${
      ctx?.value ? ` - Value: ${c.commafy(ctx.value)}` : ""
    }</div><div style="margin-top:6px;">Loading sale data...</div></div>`;
    wire_trade_sales_hover_panel_controls(panel);
  }
  function render_trade_sales_hover_data(data) {
    let panel = ensure_trade_sales_hover_panel();
    panel.__nte_sales_data = data;
    panel.__nte_sales_mode = "sales";
    panel.__nte_sales_load_failed = !1;
    let badges = "";
    data.is_projected && (badges += '<span class="nte-sales-hover-badge warn">Projected</span>');
    data.summary?.is_probably_projected && (badges += '<span class="nte-sales-hover-badge danger">RAP Spike</span>');
    data.is_on_hold && (badges += '<span class="nte-sales-hover-badge warn">On Hold</span>');
    data.is_off_sale && (badges += '<span class="nte-sales-hover-badge">Offsale</span>');
    data.item_type === "Bundle" && (badges += '<span class="nte-sales-hover-badge">Bundle</span>');
    let recent_sales_html = build_trade_sales_recent_sales_html(data.summary, panel.dataset.nteSalesExpanded === "1");
    let demand_esc = String(data.demand_label || "").replace(/[<>]/g, ""),
      demand_cls = trade_sales_hover_demand_value_class(data.demand_label),
      demand_block =
        "No" === data.demand_label
          ? `<span class="nte-sales-hover-sub-line"><span class="nte-sales-hover-demand-prelude">Rolimons demand: </span><span class="nte-demand-tier is-none">none</span></span>`
          : `<span class="nte-sales-hover-sub-line"><span class="nte-sales-hover-demand-prelude">Rolimons demand: </span><strong class="nte-demand-tier ${demand_cls}">${demand_esc}</strong></span>`,
      price_tail = data.price_status
        ? `<span class="nte-sales-hover-sub-sep" aria-hidden="true">-</span><span class="nte-sales-hover-price-status">${String(data.price_status).replace(/[<>]/g, "")}</span>`
        : "";
    let usd_basis = Number(data.value || data.summary?.avg_30 || data.summary?.rap || data.rap || 0),
      usd_note = data.routility_usd > 0
        ? `<div class="nte-sales-hover-note">Routility USD: <strong class="nte-sales-hover-usd">${format_trade_sales_hover_currency(data.routility_usd)}</strong></div>`
        : `<div class="nte-sales-hover-note">Est. USD @ $3/1k: <strong class="nte-sales-hover-usd">${format_trade_sales_hover_usd(usd_basis)}</strong></div>`,
      chart_filter = get_trade_sales_chart_filter_key(panel.dataset.nteSalesChartFilter),
      chart_html = build_trade_sales_chart_svg(Array.isArray(data.chart_points) ? data.chart_points : [], chart_filter);
    panel.innerHTML = `
      <div class="nte-sales-hover-head">
        <div>
          <div class="nte-sales-hover-title">${String(data.name || "Item").replace(/[<>]/g, "")}${
      data.serial_number != null ? ` <span class="nte-sales-hover-serial">#${data.serial_number}</span>` : ""
    }</div>
          <div class="nte-sales-hover-sub">
            ${demand_block}${price_tail}
          </div>
        </div>
        ${trade_sales_hover_close_markup()}
      </div>
      ${badges ? `<div class="nte-sales-hover-badges">${badges}</div>` : ""}
      <div class="nte-sales-hover-grid">
        <div class="nte-sales-hover-stat"><div class="nte-sales-hover-label">RAP</div><div class="nte-sales-hover-value">${c.commafy(data.summary?.rap || data.rap || 0)}</div></div>
        <div class="nte-sales-hover-stat"><div class="nte-sales-hover-label">Value</div><div class="nte-sales-hover-value">${c.commafy(data.value || data.rap || 0)}</div></div>
        <div class="nte-sales-hover-stat"><div class="nte-sales-hover-label">7D Avg</div><div class="nte-sales-hover-value">${c.commafy(data.summary?.avg_7 || data.rap || 0)}</div></div>
        <div class="nte-sales-hover-stat"><div class="nte-sales-hover-label">30D Avg</div><div class="nte-sales-hover-value">${c.commafy(data.summary?.avg_30 || data.rap || 0)}</div></div>
      </div>
      ${Number.isFinite(data.lowest_price) && data.lowest_price > 0 ? `<div class="nte-sales-hover-note">Lowest price: <strong>${c.commafy(data.lowest_price)}</strong></div>` : `<div class="nte-sales-hover-note">Lowest price: <strong>-</strong> <span style="opacity:.75">(sign in / not reselling)</span></div>`}
      ${usd_note}
      ${chart_html}
      ${recent_sales_html}
    `;
    wire_trade_sales_hover_panel_controls(panel);
    wire_trade_sales_chart_hovers(panel);
  }
  function get_trade_rap_signal_context_from_element(el) {
    let cached = el?.__nte_rap_signal_ctx;
    if (cached?.rap_signal) return cached;
    let ctx = get_trade_sales_hover_context_from_element(el);
    if (!ctx) return null;
    let rap_signal = get_trade_rap_signal_info(ctx);
    return rap_signal ? { ...ctx, rap_signal } : null;
  }
  function render_trade_rap_signal_loading(ctx) {
    hide_chart_point_sale_tooltip();
    let panel = ensure_trade_sales_hover_panel(),
      signal = ctx?.rap_signal || get_trade_rap_signal_info(ctx),
      badge = signal ? `<div class="nte-sales-hover-badges"><span class="nte-sales-hover-badge ${signal.badge_class}">${signal.label}</span></div>` : "";
    panel.dataset.nteSalesExpanded = "0";
    panel.dataset.nteSalesChartFilter = "all";
    panel.__nte_sales_data = null;
    panel.__nte_sales_mode = "";
    panel.__nte_sales_load_failed = !1;
    panel.innerHTML = `<div class="nte-sales-hover-head"><div class="nte-sales-hover-title">${String(ctx?.name || "Item").replace(/[<>]/g, "")}${
      ctx?.serial_number != null ? ` <span class="nte-sales-hover-serial">#${ctx.serial_number}</span>` : ""
    }</div>${trade_sales_hover_close_markup()}</div>${badge}<div class="nte-sales-hover-loading"><div style="margin-top:6px;">RAP: ${c.commafy(ctx?.rap || 0)}${
      ctx?.value ? ` - Value: ${c.commafy(ctx.value)}` : ""
    }</div><div style="margin-top:6px;">Loading lowest price and sales chart...</div></div>`;
    wire_trade_sales_hover_panel_controls(panel);
  }
  function render_trade_rap_signal_data(data, load_failed = !1) {
    let panel = ensure_trade_sales_hover_panel(),
      signal = data?.rap_signal || get_trade_rap_signal_info(data);
    if (!signal) {
      panel.__nte_sales_data = null;
      panel.__nte_sales_mode = "";
      panel.__nte_sales_load_failed = !!load_failed;
      panel.innerHTML = `<div class="nte-sales-hover-head"><div class="nte-sales-hover-title">RAP signal</div>${trade_sales_hover_close_markup()}</div><div class="nte-sales-hover-empty">This item no longer qualifies for a RAP signal.</div>`;
      wire_trade_sales_hover_panel_controls(panel);
      return;
    }
    panel.__nte_sales_data = data;
    panel.__nte_sales_mode = "rap_signal";
    panel.__nte_sales_load_failed = !!load_failed;
    let demand_esc = String(data.demand_label || "").replace(/[<>]/g, ""),
      demand_cls = trade_sales_hover_demand_value_class(data.demand_label),
      demand_block =
        "No" === data.demand_label
          ? `<span class="nte-sales-hover-sub-line"><span class="nte-sales-hover-demand-prelude">Rolimons demand: </span><span class="nte-demand-tier is-none">none</span></span>`
          : `<span class="nte-sales-hover-sub-line"><span class="nte-sales-hover-demand-prelude">Rolimons demand: </span><strong class="nte-demand-tier ${demand_cls}">${demand_esc}</strong></span>`,
      badges = `<span class="nte-sales-hover-badge ${signal.badge_class}">${signal.label}</span>`,
      current_rap = data.summary?.rap || data.rap || 0;
    let status_note = signal.is_over
        ? `This item might raise to <strong>${c.commafy(signal.target_value)}</strong> since it's at <strong>${c.commafy(current_rap)}</strong> RAP.`
        : `This item might drop to <strong>${c.commafy(signal.target_value)}</strong> since it's at <strong>${c.commafy(current_rap)}</strong> RAP.`,
      chart_filter = get_trade_sales_chart_filter_key(panel.dataset.nteSalesChartFilter),
      chart_html = build_trade_sales_chart_svg(Array.isArray(data.chart_points) ? data.chart_points : [], chart_filter),
      lowest_price_html = Number.isFinite(data.lowest_price) && data.lowest_price > 0
        ? `<div class="nte-sales-hover-note">Lowest price: <strong>${c.commafy(data.lowest_price)}</strong></div>`
        : load_failed
          ? `<div class="nte-sales-hover-note">Lowest price and sales history could not be loaded right now.</div>`
          : `<div class="nte-sales-hover-note">Lowest price: <strong>-</strong> <span style="opacity:.75">(sign in / not reselling)</span></div>`,
      chart_or_note = chart_html || (load_failed ? "" : '<div class="nte-sales-hover-note">Sales history unavailable right now.</div>');
    panel.innerHTML = `
      <div class="nte-sales-hover-head">
        <div>
          <div class="nte-sales-hover-title">${String(data.name || "Item").replace(/[<>]/g, "")}${
      data.serial_number != null ? ` <span class="nte-sales-hover-serial">#${data.serial_number}</span>` : ""
    }</div>
          <div class="nte-sales-hover-sub">
            ${demand_block}
          </div>
        </div>
        ${trade_sales_hover_close_markup()}
      </div>
      <div class="nte-sales-hover-badges">${badges}</div>
      <div class="nte-sales-hover-note">${status_note}</div>
      <div class="nte-sales-hover-grid">
        <div class="nte-sales-hover-stat"><div class="nte-sales-hover-label">RAP</div><div class="nte-sales-hover-value">${c.commafy(current_rap)}</div></div>
        <div class="nte-sales-hover-stat"><div class="nte-sales-hover-label">Value</div><div class="nte-sales-hover-value">${c.commafy(data.value || data.rap || 0)}</div></div>
      </div>
      ${lowest_price_html}
      ${chart_or_note}
      <div class="nte-sales-hover-note"><span style="opacity:.86">This may be wrong. Some sub-100k items are still proof based, and we cannot know for certain.</span></div>
    `;
    wire_trade_sales_hover_panel_controls(panel);
    wire_trade_sales_chart_hovers(panel);
  }
  function show_trade_rap_signal_hover_from_element(el) {
    let ctx = el?.__nte_rap_signal_ctx || get_trade_rap_signal_context_from_element(el);
    if (!ctx) return;
    clearTimeout(nte_trade_sales_hover_hide_timer);
    nte_trade_sales_hover_active_el = el;
    render_trade_rap_signal_loading(ctx);
    position_trade_sales_hover_panel(el);
    let request_token = ++nte_trade_sales_hover_request_token;
    fetch_trade_sales_hover_data(ctx)
      .then((data) => {
        if (request_token !== nte_trade_sales_hover_request_token || nte_trade_sales_hover_active_el !== el) return;
        render_trade_rap_signal_data(data);
        position_trade_sales_hover_panel(el);
      })
      .catch(() => {
        if (request_token !== nte_trade_sales_hover_request_token || nte_trade_sales_hover_active_el !== el) return;
        render_trade_rap_signal_data({ ...ctx, chart_points: [], lowest_price: null }, !0);
        position_trade_sales_hover_panel(el);
      });
  }
  function show_trade_sales_hover_from_element(el) {
    let ctx = get_trade_sales_hover_context_from_element(el);
    if (!ctx) { console.warn("[NTE] Sales hover: no context for", el); return; }
    clearTimeout(nte_trade_sales_hover_hide_timer);
    nte_trade_sales_hover_active_el = el;
    render_trade_sales_hover_loading(ctx);
    position_trade_sales_hover_panel(el);
    let request_token = ++nte_trade_sales_hover_request_token;
    fetch_trade_sales_hover_data(ctx)
      .then((data) => {
        if (request_token !== nte_trade_sales_hover_request_token || nte_trade_sales_hover_active_el !== el) return;
        render_trade_sales_hover_data(data);
        position_trade_sales_hover_panel(el);
      })
      .catch(() => {
        if (request_token !== nte_trade_sales_hover_request_token || nte_trade_sales_hover_active_el !== el) return;
        hide_chart_point_sale_tooltip();
        let panel = ensure_trade_sales_hover_panel();
        panel.__nte_sales_data = null;
        panel.__nte_sales_mode = "";
        panel.__nte_sales_load_failed = !1;
        panel.innerHTML = `<div class="nte-sales-hover-head"><div class="nte-sales-hover-title">Sale data</div>${trade_sales_hover_close_markup()}</div><div class="nte-sales-hover-empty">Sale data could not be loaded.</div>`;
        wire_trade_sales_hover_panel_controls(panel);
        position_trade_sales_hover_panel(el);
      });
  }
  function trade_sales_hover_event_on_rolimons_link(ev) {
    try {
      return !!(ev.target && ev.target.closest && ev.target.closest("a.nte-rolimons-thumb-link,.flagBox,.projected-flag,.rare-flag"));
    } catch {
      return !1;
    }
  }
  function trade_sales_hover_pointer_on_rolimons_link(el) {
    try {
      let x = el?.__nte_sales_hover_last_x,
        y = el?.__nte_sales_hover_last_y;
      if (!Number.isFinite(x) || !Number.isFinite(y) || typeof document.elementFromPoint !== "function") return !1;
      let n = document.elementFromPoint(x, y);
      return !!(n && n.closest && n.closest("a.nte-rolimons-thumb-link,.flagBox,.projected-flag,.rare-flag"));
    } catch {
      return !1;
    }
  }
  function wire_trade_sales_hover_target(el) {
    if (!el || el.__nte_trade_sales_hover_bound) return;
    el.__nte_trade_sales_hover_bound = true;
    let track = (ev) => {
      el.__nte_sales_hover_last_x = ev.clientX;
      el.__nte_sales_hover_last_y = ev.clientY;
    };
    el.addEventListener("mousemove", track, { passive: !0 });
    el.addEventListener("mouseenter", (ev) => {
      track(ev);
      clearTimeout(nte_trade_sales_hover_hide_timer);
      clearTimeout(nte_trade_sales_hover_show_timer);
      if (trade_sales_hover_event_on_rolimons_link(ev) || trade_sales_hover_pointer_on_rolimons_link(el)) return;
      nte_trade_sales_hover_show_timer = setTimeout(() => {
        if (trade_sales_hover_pointer_on_rolimons_link(el)) return;
        show_trade_sales_hover_from_element(el);
      }, 140);
    });
    el.addEventListener(
      "mouseover",
      (ev) => {
        if (!trade_sales_hover_event_on_rolimons_link(ev)) return;
        clearTimeout(nte_trade_sales_hover_show_timer);
        nte_trade_sales_hover_active_el === el && schedule_trade_sales_hover_hide(100);
      },
      !0
    );
    el.addEventListener("mouseleave", (ev) => {
      if (trade_sales_hover_pointer_went_to_panel(ev.relatedTarget)) return;
      schedule_trade_sales_hover_hide(220);
    });
  }
  function create_trade_sales_hover_button() {
    let btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nte-sales-hover-btn";
    btn.setAttribute("aria-label", "Sale data - click to view");
    btn.setAttribute("title", "Sale data");
    btn.tabIndex = 0;
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path class="nte-sales-hover-btn-glyph" d="M12 4.7v14.6M15.9 7.6h-4.3a2.2 2.2 0 0 0 0 4.4h1.1a2.2 2.2 0 1 1 0 4.4H8.1"/></svg>';
    wire_trade_thumb_button_press(btn);
    btn.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      btn.__nte_last_rect = btn.getBoundingClientRect();
      clearTimeout(nte_trade_sales_hover_hide_timer);
      clearTimeout(nte_trade_sales_hover_show_timer);
      if (nte_trade_sales_hover_active_el === btn && nte_trade_sales_hover_panel?.classList.contains("is-visible")) {
        hide_trade_sales_hover_panel();
        return;
      }
      show_trade_sales_hover_from_element(btn);
    });
    return btn;
  }
  function wire_trade_thumb_button_press(btn) {
    if (!btn || btn.__nte_trade_thumb_press_bound) return;
    btn.__nte_trade_thumb_press_bound = !0;
    let clear = () => btn.classList.remove("is-pressed");
    btn.addEventListener("pointerdown", (ev) => {
      if ("mouse" === ev.pointerType && 0 !== ev.button) return;
      btn.classList.add("is-pressed");
    });
    btn.addEventListener("pointerup", clear);
    btn.addEventListener("pointercancel", clear);
    btn.addEventListener("pointerleave", clear);
    btn.addEventListener("blur", clear);
    btn.addEventListener("dragstart", clear);
  }
  function create_trade_rap_signal_button() {
    let btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nte-rap-signal-btn";
    btn.tabIndex = 0;
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="nte-rap-signal-shell" cx="12" cy="12" r="9.15"/><path class="nte-rap-signal-chevron-over" d="M8.95 14.2 12 9.7l3.05 4.5"/><path class="nte-rap-signal-chevron-under" d="M8.95 9.8 12 14.3l3.05-4.5"/></svg>';
    wire_trade_thumb_button_press(btn);
    btn.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      btn.__nte_last_rect = btn.getBoundingClientRect();
      clearTimeout(nte_trade_sales_hover_hide_timer);
      clearTimeout(nte_trade_sales_hover_show_timer);
      if (nte_trade_sales_hover_active_el === btn && nte_trade_sales_hover_panel?.classList.contains("is-visible")) {
        hide_trade_sales_hover_panel();
        return;
      }
      show_trade_rap_signal_hover_from_element(btn);
    });
    return btn;
  }
  function update_trade_rap_signal_button(btn, ctx) {
    let signal = ctx?.rap_signal;
    if (!btn || !signal) return;
    btn.classList.toggle("is-over", !!signal.is_over);
    btn.classList.toggle("is-under", !signal.is_over);
    btn.setAttribute("aria-label", `${signal.label} indicator - click to view details`);
    btn.setAttribute("title", `${signal.label} - click for details`);
    btn.__nte_rap_signal_ctx = ctx;
  }
  function ensure_trade_sales_hover_button(card) {
    if (!card) return;
    let cached_item = get_cached_search_item_from_el(card) || card.__nte_sales_item || null;
    cached_item && (card.__nte_sales_item = cached_item);
    let thumb =
      card.querySelector(".item-card-thumb-container") ||
      card.querySelector(".item-card-link") ||
      card.querySelector("thumbnail-2d") ||
      card.querySelector(".thumbnail-2d-container") ||
      card;
    if (!thumb) return;
    if ("static" === getComputedStyle(thumb).position) thumb.style.position = "relative";
    let existing = thumb.querySelector(".nte-sales-hover-btn");
    if (existing) {
      cached_item ? (existing.__nte_sales_item = cached_item) : delete existing.__nte_sales_item;
      existing.__nte_sales_source = thumb;
      return;
    }
    let btn = create_trade_sales_hover_button();
    cached_item && (btn.__nte_sales_item = cached_item);
    btn.__nte_sales_source = thumb;
    thumb.appendChild(btn);
  }
  function sync_trade_rap_signal_button(card) {
    if (!card) return;
    let cached_item = get_cached_search_item_from_el(card) || card.__nte_sales_item || null;
    cached_item && (card.__nte_sales_item = cached_item);
    let flag_host = card.querySelector(".item-card-link") || card;
    let thumb =
      card.querySelector(".item-card-thumb-container") ||
      card.querySelector(".item-card-link") ||
      card.querySelector("thumbnail-2d") ||
      card.querySelector(".thumbnail-2d-container") ||
      card;
    if (!thumb) return;
    if ("static" === getComputedStyle(thumb).position) thumb.style.position = "relative";
    let btn = thumb.querySelector(".nte-rap-signal-btn"),
      ctx = get_trade_rap_signal_context_from_element(card);
    if (!ctx) {
      flag_host?.classList?.remove("nte-has-rap-signal");
      if (btn) {
        nte_trade_sales_hover_active_el === btn && hide_trade_sales_hover_panel();
        btn.remove();
      }
      return;
    }
    flag_host?.classList?.add("nte-has-rap-signal");
    btn || (btn = create_trade_rap_signal_button());
    cached_item ? (btn.__nte_sales_item = cached_item) : delete btn.__nte_sales_item;
    btn.__nte_sales_source = thumb;
    update_trade_rap_signal_button(btn, ctx);
    btn.isConnected || thumb.appendChild(btn);
  }
  function mount_trade_sales_hover_targets(root = document) {
    ensure_trade_sales_hover_panel();
    for (let el of root.querySelectorAll(".trade-list-detail-offer .item-card-container, .trade-inventory-panel .item-card-container")) {
      ensure_trade_sales_hover_button(el);
      sync_trade_rap_signal_button(el);
    }
  }
  function sync_mobile_trade_inventory_scroll() {
    if ("sendOrCounter" !== c.getPageType()) return;
    let mobile_layout = trade_sales_hover_use_mobile_layout(),
      scroll_hosts = ".trade-inventory-panel .item-cards, .trade-inventory-panel .item-cards-stackable, .trade-inventory-panel .item-list, .inventory-panel-holder .hlist",
      scroll_wrappers = ".trade-inventory-panel, .inventory-panel-holder";
    for (let el of document.querySelectorAll(scroll_wrappers))
      mobile_layout
        ? (el.style.setProperty("overscroll-behavior", "contain"),
          el.style.setProperty("touch-action", "pan-y"),
          el.style.setProperty("-webkit-overflow-scrolling", "touch"))
        : (el.style.removeProperty("overscroll-behavior"),
          el.style.removeProperty("touch-action"),
          el.style.removeProperty("-webkit-overflow-scrolling"));
    for (let el of document.querySelectorAll(scroll_hosts))
      mobile_layout
        ? (el.style.setProperty("overflow-y", "auto", "important"),
          el.style.setProperty("overflow-x", "hidden", "important"),
          el.style.setProperty("overscroll-behavior", "contain"),
          el.style.setProperty("touch-action", "pan-y"),
          el.style.setProperty("-webkit-overflow-scrolling", "touch"))
        : (el.style.removeProperty("overflow-y"),
          el.style.removeProperty("overflow-x"),
          el.style.removeProperty("overscroll-behavior"),
          el.style.removeProperty("touch-action"),
          el.style.removeProperty("-webkit-overflow-scrolling"));
  }
  let nte_trade_dominance_frame = 0;
  function is_trade_overlay_visible(el) {
    if (!(el instanceof Element) || !el.isConnected || el.hidden || "true" === el.getAttribute("aria-hidden") || el.classList?.contains("ng-hide")) return false;
    let style = getComputedStyle(el);
    if ("none" === style.display || "hidden" === style.visibility || Number(style.opacity || "1") < 0.05) return false;
    let rect = el.getBoundingClientRect();
    return !(rect.width < 90 || rect.height < 90);
  }
  function is_trade_modal_like(el) {
    if (!is_trade_overlay_visible(el)) return false;
    if (el.matches?.("dialog[open], #nte-totp-unlock-dialog[open], [role='dialog'][aria-modal='true'], [aria-modal='true']")) return true;
    let style = getComputedStyle(el),
      z_index = parseInt(style.zIndex || "0", 10);
    if ("fixed" !== style.position && "sticky" !== style.position) return false;
    return !isNaN(z_index) && z_index >= 100;
  }
  function has_active_trade_modal() {
    let selectors = [
      "dialog[open]",
      "#nte-totp-unlock-dialog[open]",
      "[role='dialog'][aria-modal='true']",
      "[aria-modal='true']",
      ".modal-dialog",
      ".rbx-modal",
      ".ReactModal__Content",
      ".two-step-verification",
      ".two-step-verification-container",
      ".verification-modal",
      ".challenge-dialog",
    ];
    for (let el of document.querySelectorAll(selectors.join(","))) if (is_trade_modal_like(el)) return true;
    return false;
  }
  function has_foreign_trade_overlay() {
    let selectors = [".ropro-trade-infocard-overlay", ".ropro-upgrade-modal", "#tradePanelModal", "#rovalk-custom-trade-window", ".rovalk-search-overlay"];
    for (let el of document.querySelectorAll(selectors.join(","))) if (is_trade_overlay_visible(el)) return true;
    return false;
  }
  function trade_rects_overlap(a, b, padding = 2) {
    if (!(a instanceof Element) || !(b instanceof Element)) return false;
    let r1 = a.getBoundingClientRect(),
      r2 = b.getBoundingClientRect();
    if (r1.width < 4 || r1.height < 4 || r2.width < 4 || r2.height < 4) return false;
    return !(r1.right <= r2.left + padding || r1.left >= r2.right - padding || r1.bottom <= r2.top + padding || r1.top >= r2.bottom - padding);
  }
  function get_trade_interference_targets() {
    let selectors = [
      ".ropro-trade-thumb-rolimons-link",
      ".ropro-projected-badge",
      ".ropro-trade-panel-launch",
      ".ropro-trade-refresh-launch",
      ".ropro-quick-decline-row",
      ".ropro-quick-cancel-row",
      ".trade-flag-div",
      ".trade-flag",
      ".rovalk-toolbar-link",
      ".rovalk-sr-card",
      ".rovalk-sr-badge",
      "#rovalkTradeListFilterButton",
      ".flagBox:not([data-nte-side])",
      "a[href*='rolimons.com/']:not(.nte-rolimons-thumb-link)",
      ".ropro-trade-infocard-overlay",
      ".ropro-upgrade-modal",
      "#tradePanelModal",
      "#rovalk-custom-trade-window",
      ".rovalk-search-overlay",
    ];
    let targets = [];
    for (let el of document.querySelectorAll(selectors.join(","))) {
      if (!is_trade_overlay_visible(el)) continue;
      if (el.closest?.(".nte-history-panel,.nte-sales-hover-panel")) continue;
      targets.push(el);
    }
    return targets;
  }
  function has_trade_interference() {
    let targets = get_trade_interference_targets();
    if (!targets.length) return false;
    let ours = document.querySelectorAll(
      ".nte-history-btn,.nte-analyze-trade-btn,.nte-poison-btn,.nte-sales-hover-btn,.nte-rap-signal-btn,.nte-rolimons-thumb-link,.nte-uaid-thumb-link,.nte-history-panel,.nte-sales-hover-panel,.nte-sales-chart-point-tooltip",
    );
    for (let own of ours) {
      if (!is_trade_overlay_visible(own)) continue;
      for (let target of targets) if (trade_rects_overlap(own, target)) return true;
    }
    return false;
  }
  function should_back_off_trade_thumb_ui() {
    return has_active_trade_modal();
  }
  function ensure_trade_page_dominance_styles() {
    if (document.getElementById("nte-trade-dominance-style")) return;
    let style = document.createElement("style");
    style.id = "nte-trade-dominance-style";
    style.textContent = `
      .trade-buttons,.nte-history-fallback-row,.nte-poison-fallback-row{overflow:visible!important}
      .trade-buttons .nte-history-btn,
      .trade-buttons .nte-analyze-trade-btn,
      .trade-buttons .nte-poison-btn,
      .nte-history-fallback-row .nte-history-btn,
      .nte-history-fallback-row .nte-analyze-trade-btn,
      .nte-poison-fallback-row .nte-analyze-trade-btn,
      .nte-poison-fallback-row .nte-poison-btn{position:relative!important;pointer-events:auto!important;isolation:isolate!important}
      .nte-history-fallback-row,.nte-poison-fallback-row{position:relative!important;isolation:isolate!important}
      .nte-history-panel,.nte-sales-hover-panel,.nte-sales-chart-point-tooltip{pointer-events:auto!important;isolation:isolate!important}
      .nte-history-panel{position:relative!important}
      .item-card-container,.item-card-link,.item-card-thumb-container,.trade-request-item{overflow:visible!important}
      .item-card-container .nte-sales-hover-btn,.item-card-link .nte-sales-hover-btn,.item-card-thumb-container .nte-sales-hover-btn,.trade-request-item .nte-sales-hover-btn,
      .item-card-container .nte-rap-signal-btn,.item-card-link .nte-rap-signal-btn,.item-card-thumb-container .nte-rap-signal-btn,.trade-request-item .nte-rap-signal-btn,
      .item-card-container .nte-rolimons-thumb-link,.item-card-link .nte-rolimons-thumb-link,.item-card-thumb-container .nte-rolimons-thumb-link,.trade-request-item .nte-rolimons-thumb-link:not([data-nte-inline-link="1"]),
      .item-card-container .nte-uaid-thumb-link,.item-card-link .nte-uaid-thumb-link,.item-card-thumb-container .nte-uaid-thumb-link,.trade-request-item .nte-uaid-thumb-link{position:absolute!important;pointer-events:auto!important;isolation:isolate!important}
      html.nte-trade-ui-fight .trade-buttons .nte-history-btn,
      html.nte-trade-ui-fight .trade-buttons .nte-analyze-trade-btn,
      html.nte-trade-ui-fight .trade-buttons .nte-poison-btn,
      html.nte-trade-ui-fight .nte-history-fallback-row .nte-history-btn,
      html.nte-trade-ui-fight .nte-history-fallback-row .nte-analyze-trade-btn,
      html.nte-trade-ui-fight .nte-poison-fallback-row .nte-analyze-trade-btn,
      html.nte-trade-ui-fight .nte-poison-fallback-row .nte-poison-btn{z-index:2147483588!important}
      html.nte-trade-ui-fight .nte-history-fallback-row,html.nte-trade-ui-fight .nte-poison-fallback-row{z-index:2147483586!important}
      html.nte-trade-ui-fight .nte-history-panel{z-index:2147483610!important}
      html.nte-trade-ui-fight .nte-sales-hover-panel{z-index:2147483612!important}
      html.nte-trade-ui-fight .nte-sales-chart-point-tooltip{z-index:2147483613!important}
      html.nte-trade-ui-fight .item-card-container .nte-sales-hover-btn,html.nte-trade-ui-fight .item-card-link .nte-sales-hover-btn,html.nte-trade-ui-fight .item-card-thumb-container .nte-sales-hover-btn,html.nte-trade-ui-fight .trade-request-item .nte-sales-hover-btn,
      html.nte-trade-ui-fight .item-card-container .nte-rap-signal-btn,html.nte-trade-ui-fight .item-card-link .nte-rap-signal-btn,html.nte-trade-ui-fight .item-card-thumb-container .nte-rap-signal-btn,html.nte-trade-ui-fight .trade-request-item .nte-rap-signal-btn,
      html.nte-trade-ui-fight .item-card-container .nte-rolimons-thumb-link,html.nte-trade-ui-fight .item-card-link .nte-rolimons-thumb-link,html.nte-trade-ui-fight .item-card-thumb-container .nte-rolimons-thumb-link,html.nte-trade-ui-fight .trade-request-item .nte-rolimons-thumb-link:not([data-nte-inline-link="1"]),
      html.nte-trade-ui-fight .item-card-container .nte-uaid-thumb-link,html.nte-trade-ui-fight .item-card-link .nte-uaid-thumb-link,html.nte-trade-ui-fight .item-card-thumb-container .nte-uaid-thumb-link,html.nte-trade-ui-fight .trade-request-item .nte-uaid-thumb-link{z-index:2147483589!important}
      html.nte-trade-ui-backoff .item-card-container .nte-sales-hover-btn,html.nte-trade-ui-backoff .item-card-link .nte-sales-hover-btn,html.nte-trade-ui-backoff .item-card-thumb-container .nte-sales-hover-btn,html.nte-trade-ui-backoff .trade-request-item .nte-sales-hover-btn,
      html.nte-trade-ui-backoff .item-card-container .nte-rap-signal-btn,html.nte-trade-ui-backoff .item-card-link .nte-rap-signal-btn,html.nte-trade-ui-backoff .item-card-thumb-container .nte-rap-signal-btn,html.nte-trade-ui-backoff .trade-request-item .nte-rap-signal-btn,
      html.nte-trade-ui-backoff .item-card-container .nte-rolimons-thumb-link,html.nte-trade-ui-backoff .item-card-link .nte-rolimons-thumb-link,html.nte-trade-ui-backoff .item-card-thumb-container .nte-rolimons-thumb-link,html.nte-trade-ui-backoff .trade-request-item .nte-rolimons-thumb-link:not([data-nte-inline-link="1"]),
      html.nte-trade-ui-backoff .item-card-container .nte-uaid-thumb-link,html.nte-trade-ui-backoff .item-card-link .nte-uaid-thumb-link,html.nte-trade-ui-backoff .item-card-thumb-container .nte-uaid-thumb-link,html.nte-trade-ui-backoff .trade-request-item .nte-uaid-thumb-link{opacity:0!important;visibility:hidden!important;pointer-events:none!important;transform:none!important}
      html.nte-trade-ui-backoff .nte-sales-hover-panel,html.nte-trade-ui-backoff .nte-sales-chart-point-tooltip{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}
    `;
    document.head.appendChild(style);
  }
  function set_trade_style(el, property, value, priority = "") {
    if (!el?.style) return;
    if (el.style.getPropertyValue(property) === value && el.style.getPropertyPriority(property) === priority) return;
    el.style.setProperty(property, value, priority);
  }
  function remove_trade_style(el, property) {
    if (!el?.style || !el.style.getPropertyValue(property)) return;
    el.style.removeProperty(property);
  }
  function mark_trade_dominant(el, z_index) {
    if (!el?.style) return;
    let position = getComputedStyle(el).position;
    if (!position || "static" === position) set_trade_style(el, "position", "relative", "important");
    set_trade_style(el, "z-index", String(z_index), "important");
    set_trade_style(el, "pointer-events", "auto", "important");
    set_trade_style(el, "isolation", "isolate", "important");
  }
  function clear_trade_dominant(el) {
    remove_trade_style(el, "z-index");
  }
  function is_trade_action_button(el) {
    return !!(el?.matches?.('button[ng-click*="acceptTrade"],button[ng-click*="counterTrade"],button[ng-click*="declineTrade"]') && !el.classList.contains("ng-hide"));
  }
  function sync_trade_button_position(btn) {
    let container = btn?.parentElement;
    if (!container) return;
    let children = [...container.children].filter((child) => child !== btn);
    let after = null;
    for (let child of children) {
      if (is_trade_action_button(child)) after = child;
    }
    if (btn.classList.contains("nte-analyze-trade-btn")) {
      let history_btn = children.find((child) => child.classList?.contains("nte-history-btn"));
      if (history_btn) after = history_btn;
    }
    if (btn.classList.contains("nte-poison-btn")) {
      let analyze_btn = children.find((child) => child.classList?.contains("nte-analyze-trade-btn"));
      let history_btn = children.find((child) => child.classList?.contains("nte-history-btn"));
      if (analyze_btn) after = analyze_btn;
      else if (history_btn) after = history_btn;
    }
    let desired_next = after ? after.nextSibling : container.firstChild;
    if ((after && btn.previousSibling === after) || (!after && container.firstChild === btn)) return;
    container.insertBefore(btn, desired_next);
  }
  function assert_trade_page_dominance() {
    nte_trade_dominance_frame && cancelAnimationFrame(nte_trade_dominance_frame);
    nte_trade_dominance_frame = requestAnimationFrame(() => {
      nte_trade_dominance_frame = 0;
      ensure_trade_page_dominance_styles();
      let back_off_thumb_ui = should_back_off_trade_thumb_ui();
      let fight_mode = !back_off_thumb_ui && has_trade_interference();
      document.documentElement.classList.toggle("nte-trade-ui-backoff", back_off_thumb_ui);
      document.documentElement.classList.toggle("nte-trade-ui-fight", fight_mode);
      if (back_off_thumb_ui) {
        clearTimeout(nte_trade_sales_hover_hide_timer);
        clearTimeout(nte_trade_sales_hover_show_timer);
        nte_trade_sales_hover_active_el = null;
        schedule_trade_sales_hover_hide(0);
      }
      for (let el of document.querySelectorAll(".trade-buttons,.nte-history-fallback-row,.nte-poison-fallback-row")) set_trade_style(el, "overflow", "visible", "important");
      for (let el of document.querySelectorAll(".item-card-container,.item-card-link,.item-card-thumb-container,.trade-request-item")) {
        set_trade_style(el, "overflow", "visible", "important");
        let position = getComputedStyle(el).position;
        if (!position || "static" === position) set_trade_style(el, "position", "relative", "important");
      }
      for (let el of document.querySelectorAll(".nte-history-btn,.nte-analyze-trade-btn,.nte-poison-btn")) {
        fight_mode ? mark_trade_dominant(el, 2147483588) : clear_trade_dominant(el);
        sync_trade_button_position(el);
      }
      for (let el of document.querySelectorAll(".nte-sales-hover-btn,.nte-rap-signal-btn,.nte-rolimons-thumb-link,.nte-uaid-thumb-link")) {
        if (el.classList?.contains("nte-rolimons-thumb-link") && el.dataset.nteInlineLink === "1") {
          clear_trade_dominant(el);
          continue;
        }
        fight_mode ? mark_trade_dominant(el, 2147483589) : clear_trade_dominant(el);
        let host = el.__nte_sales_source || el.closest(".item-card-link,.item-card-thumb-container,.item-card-container,.trade-request-item");
        host && el.parentElement !== host && host.appendChild(el);
      }
      for (let el of document.querySelectorAll(".nte-history-fallback-row,.nte-poison-fallback-row")) fight_mode ? mark_trade_dominant(el, 2147483586) : clear_trade_dominant(el);
      for (let el of document.querySelectorAll(".nte-history-panel")) fight_mode ? mark_trade_dominant(el, 2147483610) : clear_trade_dominant(el);
      if (!back_off_thumb_ui && fight_mode) {
        for (let el of document.querySelectorAll(".nte-sales-hover-panel")) mark_trade_dominant(el, 2147483612);
        for (let el of document.querySelectorAll(".nte-sales-chart-point-tooltip")) mark_trade_dominant(el, 2147483613);
      } else {
        for (let el of document.querySelectorAll(".nte-sales-hover-panel,.nte-sales-chart-point-tooltip")) clear_trade_dominant(el);
      }
    });
  }
  let trade_ui_refresh_timer = 0,
    trade_ui_refresh_retry_timer = 0,
    trade_ui_refresh_running = null,
    trade_ui_refresh_pending = !1;
  async function run_trade_ui_refresh_now() {
    if (trade_ui_refresh_running) return (trade_ui_refresh_pending = !0), trade_ui_refresh_running;
    trade_ui_refresh_running = (async () => {
      do {
        trade_ui_refresh_pending = !1;
        await N();
      } while (trade_ui_refresh_pending);
    })();
    return trade_ui_refresh_running.finally(() => {
      trade_ui_refresh_running = null;
    });
  }
  function schedule_trade_ui_refresh(delay = 0, retry = !1) {
    clearTimeout(trade_ui_refresh_timer);
    trade_ui_refresh_timer = setTimeout(() => {
      trade_ui_refresh_timer = 0;
      run_trade_ui_refresh_now().catch(() => {});
    }, delay);
    if (retry) {
      clearTimeout(trade_ui_refresh_retry_timer);
      trade_ui_refresh_retry_timer = setTimeout(() => {
        trade_ui_refresh_retry_timer = 0;
        run_trade_ui_refresh_now().catch(() => {});
      }, delay + 140);
    }
  }
  async function N() {
    await sync_trade_profit_mode();
    get_trade_list_filter_anchor() || clear_trade_list_filter_ui();
    (0, u.default)();
    bind_trade_detail_uaid_refresh();
    if (typeof schedule_ownership_check === "function") schedule_ownership_check();
    await Promise.allSettled([Promise.resolve(m()), S(), p(), C()]);
    w();
    (0, B.default)();
    (0, A.default)();
    ensure_nte_serial_hash_button();
    L();
    F();
    mount_trade_sales_hover_targets();
    sync_mobile_trade_inventory_scroll();
    if (typeof inject_trade_history_button === "function") inject_trade_history_button();
    if (typeof schedule_ownership_check === "function") schedule_ownership_check();
    assert_trade_page_dominance();
  }
  async function F() {
    async function e() {
      await S();
      await p();
      await C();
    }
    let t = document.querySelectorAll('[name="robux"]');
    if (t[0])
      for (let robux_input of t)
        robux_input.dataset.nteTradeRefreshBound ||
          ((robux_input.dataset.nteTradeRefreshBound = "1"), robux_input.addEventListener("input", e));
  }
  console.info(`%c${c.getExtensionTitle()} v${chrome.runtime.getManifest().version} has started!`, "color: #0084DD");
  console.info("%cJoin our Discord: discord.gg/4XWE7yy2uE", "color: #5865F2; font-weight: bold");
  c.refreshData(N);
  (async () => {
    let e = await c.waitForElm(".trades-container");
    let _obs_L_timer = 0;
    new MutationObserver((e) => {
      for (let t of e) {
        if ("attributes" === t.type) {
          let node = t.target;
          if (node?.classList?.contains("trade-row") && node.classList.contains("selected")) {
            reset_ownership_check_state_for_row(node);
            if (typeof prewarm_ownership_for_row === "function") prewarm_ownership_for_row(node);
            if (typeof schedule_ownership_check === "function") schedule_ownership_check(0);
            schedule_trade_ui_refresh(0, !0);
            continue;
          }
        }
        if ("childList" !== t.type || !t.addedNodes) continue;
        for (let node of t.addedNodes) {
          if (node.classList?.contains("trade-item-card")) {
            if (typeof schedule_ownership_check === "function") schedule_ownership_check(0);
            return schedule_trade_ui_refresh(0, !0);
          }
          if (
            node.matches?.(".item-card-container[data-collectibleiteminstanceid], .trade-item-card[data-collectibleiteminstanceid]") ||
            node.querySelector?.(".item-card-container[data-collectibleiteminstanceid], .trade-item-card[data-collectibleiteminstanceid]")
          ) {
            if (typeof schedule_ownership_check === "function") schedule_ownership_check(0);
            return schedule_trade_ui_refresh(0, !0);
          }
          if (node.classList?.contains("trade-row") || node.querySelector?.(".trade-row")) {
            if (auto_scroll_running) {
              clearTimeout(_obs_L_timer);
              _obs_L_timer = setTimeout(L, 600);
              return;
            }
            return L();
          }
          if (node.classList?.contains("loading") || node.classList?.contains("trade-request-item")) return schedule_trade_ui_refresh(0, !0);
        }
      }
    }).observe(e, {
      attributes: !0,
      childList: !0,
      subtree: !0,
    });
    e.addEventListener(
      "pointerdown",
      (event) => {
        let row = event.target?.closest?.(".trade-row");
        if (!row || !e.contains(row)) return;
        reset_ownership_check_state_for_row(row);
        prewarm_ownership_for_row(row);
        schedule_ownership_check(0);
      },
      true,
    );
    e.addEventListener(
      "click",
      (event) => {
        let row = event.target?.closest?.(".trade-row");
        if (!row || !e.contains(row)) return;
        reset_ownership_check_state_for_row(row);
        prewarm_ownership_for_row(row);
        schedule_ownership_check(0);
      },
      true,
    );
    schedule_trade_ui_refresh(0, !0);
    let _last_observed_tab = get_current_trade_tab();
    function check_tab_switch() {
      let current = get_current_trade_tab();
      if (current !== _last_observed_tab) {
        _last_observed_tab = current;
        cancel_background_trade_fetch();
        prefetch_last_tab = null;
        prefetch_last_time = 0;
        row_trade_cache = {};
        row_trade_pending = {};
        row_trade_raw_cache = window.__nte_trade_row_raw_cache = {};
        row_thumb_meta = window.__nte_trade_thumb_meta_cache = {};
        row_thumb_pending = {};
        row_thumb_seen = {};
        row_thumb_refs = [];
        try {
          document.dispatchEvent(new CustomEvent("nru_trade_thumb_clear"));
        } catch {}
        row_fetch_q = [];
        row_active_requests = 0;
        reset_ownership_check_state();
        if (current !== "inbound" && current !== "outbound") {
          remove_trade_row_decline_buttons();
          trade_row_decline_prime_started = false;
        }
        if (current === "inbound" || current === "outbound") {
          trade_row_decline_enabled && prime_trade_row_decline();
        }
      }
    }
    new MutationObserver(check_tab_switch).observe(document.querySelector(".trade-tab-group") || document.querySelector(".tab-nav") || e, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    setInterval(check_tab_switch, 1500);
  })();
  async function rerender_open_trade_history_panel() {
    let btn = document.querySelector(".nte-history-btn--active");
    if (!btn || !document.querySelector(".nte-history-panel")) return;
    await run_trade_history(btn, {
      close_if_same: false,
      mode: btn.__nte_history_mode || "uaid",
      item_side: btn.__nte_history_item_side || "partner",
    });
  }
  chrome.runtime.onMessage.addListener(function (e, t) {
    if (colorblind_trade_refresh_messages.includes(e)) {
      (async () => {
        await N();
        await rerender_open_trade_history_panel();
      })();
      return;
    }
    if (trade_ui_refresh_messages.includes(e)) N();
    if (e === "Show Quick Decline Button") L();
    if (e === "Analyze Trade") inject_trade_history_button();
    if (e === "Duplicate Trade Warning") schedule_duplicate_trade_warning_update(0);
  });
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

  const duplicate_trade_warning_option_name = "Duplicate Trade Warning";
  const duplicate_trade_warning_hours_key = "duplicate_trade_warning_hours";
  const duplicate_trade_warning_hours_default = 24;
  const duplicate_trade_warning_cache_ttl_ms = 60000;
  const duplicate_trade_warning_max_pages = 10;
  const duplicate_trade_warning_max_age_ms = 7 * 24 * 60 * 60 * 1000;
  let duplicate_trade_warning_styles_injected = false;
  let duplicate_trade_warning_refresh_timer = 0;
  let duplicate_trade_warning_observer_started = false;
  let duplicate_trade_warning_request_token = 0;
  let duplicate_trade_warning_cache = null;
  let duplicate_trade_warning_local_sent = {};

  function normalize_duplicate_trade_warning_hours(value) {
    let parsed = Number(String(value ?? "").replace(/h/gi, "").trim());
    if (!Number.isFinite(parsed)) parsed = duplicate_trade_warning_hours_default;
    parsed = Math.round(parsed);
    return Math.max(1, Math.min(168, parsed));
  }

  function prune_duplicate_trade_warning_local_sent(now = Date.now()) {
    for (let [user_id, timestamp] of Object.entries(duplicate_trade_warning_local_sent)) {
      if (!Number.isFinite(timestamp) || now - timestamp > duplicate_trade_warning_max_age_ms) delete duplicate_trade_warning_local_sent[user_id];
    }
  }

  function is_duplicate_trade_warning_modal(el) {
    return el instanceof Element && !el.classList.contains("ng-hide") && el.getClientRects().length > 0 && /send a trade request/i.test(el.textContent || "");
  }

  function find_duplicate_trade_warning_modal() {
    let selectors = [".modal-dialog", ".modal-content", ".modal-body", '[role="dialog"]', ".rbx-overlay", ".rbx-modal", ".modal-container"];
    let candidates = [];
    for (let selector of selectors) candidates.push(...document.querySelectorAll(selector));
    for (let i = candidates.length - 1; i >= 0; i--) {
      if (is_duplicate_trade_warning_modal(candidates[i])) return candidates[i];
    }
    return null;
  }

  function find_duplicate_trade_warning_anchor(modal) {
    let body = modal.matches(".modal-body") ? modal : modal.querySelector(".modal-body") || modal;
    let candidates = Array.from(body.querySelectorAll("div, p, span, h4, h5"));
    return candidates.find((el) => /send a trade request/i.test(el.textContent || "") && el.children.length <= 3) || body.firstElementChild || body;
  }

  function is_duplicate_trade_warning_relevant_page() {
    let page_type = c.getPageType();
    return page_type === "details" || page_type === "sendOrCounter" || /\/users\/\d+\/trade/i.test(window.location.pathname) || !!document.querySelector(".trade-request-window, .trades-container");
  }

  function get_duplicate_trade_warning_partner_id() {
    let path_match = window.location.pathname.match(/\/users\/(\d+)\/trade/i);
    if (path_match) return String(path_match[1]);
    let header_link = [...document.querySelectorAll(".trades-header-nowrap .paired-name a[href*='/users/'], .paired-name a[href*='/users/']")].at(-1);
    let href = header_link?.getAttribute("href") || header_link?.href || "";
    let href_match = href.match(/\/users\/(\d+)/i);
    if (href_match) return String(href_match[1]);
    return get_selected_trade_partner_id(document.querySelector(".trade-row.selected")) || "";
  }

  function ensure_duplicate_trade_warning_styles() {
    if (duplicate_trade_warning_styles_injected) return;
    duplicate_trade_warning_styles_injected = true;
    let style = document.createElement("style");
    style.textContent = `
      .nte-duplicate-trade-warning{margin-top:10px;padding:8px 12px;border-radius:8px;display:flex;align-items:flex-start;gap:9px;background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.38);color:#fbbf24;font-size:13px;font-weight:700;line-height:1.4}
      .nte-duplicate-trade-warning-copy{display:flex;flex-direction:column;gap:1px;min-width:0}
      .nte-duplicate-trade-warning strong{color:inherit}
      .nte-duplicate-trade-warning-icon{flex:0 0 auto;line-height:1}
      .light-theme .nte-duplicate-trade-warning{background:rgba(254,243,199,.96);border-color:rgba(217,119,6,.32);color:#92400e}
    `;
    document.head.appendChild(style);
  }

  function format_duplicate_trade_warning_age(timestamp) {
    let diff = Math.max(0, Date.now() - Number(timestamp || 0));
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
    if (diff < 86400000) return `${Math.max(1, Math.floor(diff / 3600000))}h ago`;
    let days = Math.max(1, Math.floor(diff / 86400000));
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  function build_duplicate_trade_warning(created_at) {
    let warning = document.createElement("div");
    warning.className = "nte-duplicate-trade-warning";
    warning.dataset.createdAt = String(created_at || 0);
    warning.innerHTML = `<span class="nte-duplicate-trade-warning-icon">&#9888;</span><span class="nte-duplicate-trade-warning-copy"><span>You already sent this person a trade <strong>${format_duplicate_trade_warning_age(created_at)}</strong>.</span><span>Are you sure you want to send another?</span></span>`;
    return warning;
  }

  function remove_duplicate_trade_warning() {
    document.querySelectorAll(".nte-duplicate-trade-warning").forEach((el) => el.remove());
  }

  function parse_duplicate_trade_warning_created(trade) {
    let raw = trade?.created || trade?.createdAt || trade?.createdDate || trade?.createdUtc || trade?.createdOn;
    let parsed = raw ? new Date(raw).getTime() : NaN;
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function get_duplicate_trade_warning_trade_user_id(trade) {
    return String(trade?.user?.id || trade?.partner?.id || trade?.counterparty?.id || "");
  }

  async function get_duplicate_trade_warning_recent_by_user(hours) {
    let normalized_hours = normalize_duplicate_trade_warning_hours(hours),
      cutoff = Date.now() - normalized_hours * 3600000;
    prune_duplicate_trade_warning_local_sent();

    if (
      duplicate_trade_warning_cache &&
      Date.now() - duplicate_trade_warning_cache.fetched_at < duplicate_trade_warning_cache_ttl_ms &&
      duplicate_trade_warning_cache.cutoff <= cutoff
    ) {
      let merged = { ...duplicate_trade_warning_cache.latest_by_user };
      for (let [user_id, timestamp] of Object.entries(duplicate_trade_warning_local_sent)) {
        if (timestamp >= cutoff && (!merged[user_id] || timestamp > merged[user_id])) merged[user_id] = timestamp;
      }
      return merged;
    }

    let latest_by_user = {};
    let cursor = "";
    for (let page = 0; page < duplicate_trade_warning_max_pages; page++) {
      let url = `https://trades.roblox.com/v1/trades/outbound?limit=100&sortOrder=Desc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      let resp = await fetch_trade_api(url, { credentials: "include" });
      if (!resp.ok) break;
      let json = await resp.json().catch(() => null);
      let trades = Array.isArray(json?.data) ? json.data : [];
      if (!trades.length) break;
      let reached_cutoff = false;
      for (let trade of trades) {
        let created = parse_duplicate_trade_warning_created(trade);
        if (!Number.isFinite(created)) continue;
        if (created < cutoff) {
          reached_cutoff = true;
          break;
        }
        let user_id = get_duplicate_trade_warning_trade_user_id(trade);
        if (user_id && latest_by_user[user_id] === undefined) latest_by_user[user_id] = created;
      }
      if (reached_cutoff || !json?.nextPageCursor) break;
      cursor = json.nextPageCursor;
    }

    duplicate_trade_warning_cache = {
      fetched_at: Date.now(),
      cutoff,
      latest_by_user,
    };

    for (let [user_id, timestamp] of Object.entries(duplicate_trade_warning_local_sent)) {
      if (timestamp >= cutoff && (!latest_by_user[user_id] || timestamp > latest_by_user[user_id])) latest_by_user[user_id] = timestamp;
    }
    return latest_by_user;
  }

  async function update_duplicate_trade_warning() {
    if (!is_duplicate_trade_warning_relevant_page()) {
      remove_duplicate_trade_warning();
      return;
    }
    let modal = find_duplicate_trade_warning_modal();
    if (!modal) {
      remove_duplicate_trade_warning();
      return;
    }
    if (!(await c.getOption(duplicate_trade_warning_option_name))) {
      remove_duplicate_trade_warning();
      return;
    }
    let partner_id = get_duplicate_trade_warning_partner_id();
    if (!partner_id) {
      remove_duplicate_trade_warning();
      return;
    }
    let request_token = ++duplicate_trade_warning_request_token;
    let hours = normalize_duplicate_trade_warning_hours(await c.getOption(duplicate_trade_warning_hours_key));
    let recent_by_user = await get_duplicate_trade_warning_recent_by_user(hours).catch(() => ({}));
    if (request_token !== duplicate_trade_warning_request_token) return;
    modal = find_duplicate_trade_warning_modal();
    if (!modal) return;

    let existing = modal.querySelector(".nte-duplicate-trade-warning");
    let recent_trade = recent_by_user[String(partner_id)] || 0;
    if (!recent_trade) {
      existing?.remove();
      return;
    }

    ensure_duplicate_trade_warning_styles();
    if (existing?.dataset.createdAt === String(recent_trade)) return;
    let warning = build_duplicate_trade_warning(recent_trade);
    if (existing) existing.replaceWith(warning);
    else {
      let anchor = find_duplicate_trade_warning_anchor(modal);
      if (anchor?.parentElement) anchor.insertAdjacentElement("afterend", warning);
      else modal.insertBefore(warning, modal.firstChild);
    }
  }

  function schedule_duplicate_trade_warning_update(delay = 50) {
    clearTimeout(duplicate_trade_warning_refresh_timer);
    duplicate_trade_warning_refresh_timer = setTimeout(() => {
      duplicate_trade_warning_refresh_timer = 0;
      update_duplicate_trade_warning().catch(() => {});
    }, delay);
  }

  function note_duplicate_trade_warning_send(event) {
    let btn = event.target?.closest?.("button");
    if (!(btn instanceof Element)) return;
    let modal = btn.closest(".modal-dialog, .modal-content, .modal-body, [role='dialog'], .rbx-overlay, .rbx-modal, .modal-container");
    if (!is_duplicate_trade_warning_modal(modal)) return;
    let label = String(btn.textContent || "").trim().toLowerCase();
    if (!/send|submit|confirm/.test(label) && !btn.classList.contains("btn-primary-md") && !btn.classList.contains("btn-cta-md")) return;
    let partner_id = get_duplicate_trade_warning_partner_id();
    if (!partner_id) return;
    duplicate_trade_warning_local_sent[String(partner_id)] = Date.now();
    if (duplicate_trade_warning_cache?.latest_by_user) {
      let current = duplicate_trade_warning_cache.latest_by_user[String(partner_id)] || 0;
      duplicate_trade_warning_cache.latest_by_user[String(partner_id)] = Math.max(current, duplicate_trade_warning_local_sent[String(partner_id)]);
    }
  }

  function ensure_duplicate_trade_warning_observer() {
    if (duplicate_trade_warning_observer_started || !document.body) return;
    duplicate_trade_warning_observer_started = true;
    document.addEventListener("click", note_duplicate_trade_warning_send, true);
    new MutationObserver(() => {
      if (!is_duplicate_trade_warning_relevant_page()) {
        remove_duplicate_trade_warning();
        return;
      }
      let modal = find_duplicate_trade_warning_modal();
      if (!modal) {
        remove_duplicate_trade_warning();
        return;
      }
      schedule_duplicate_trade_warning_update();
    }).observe(document.body, { childList: true, subtree: true });
    schedule_duplicate_trade_warning_update(0);
  }

  ensure_duplicate_trade_warning_observer();


  var nte_ownership_style_injected = false;
  function inject_ownership_styles() {
    if (nte_ownership_style_injected) return;
    nte_ownership_style_injected = true;
    let style = document.createElement("style");
    style.textContent = `
      .nte-ownership-banner{display:flex;position:relative;z-index:1;isolation:isolate;visibility:visible;opacity:1;align-items:center;gap:9px;margin:8px 0 10px;padding:9px 12px;border-radius:8px;background:linear-gradient(135deg,rgba(220,38,38,.16),rgba(220,38,38,.06));border:1px solid rgba(248,113,113,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.08);color:#fca5a5;font-size:12px;font-weight:700;line-height:1.35}
      .nte-ownership-banner:before{content:"";width:9px;height:9px;border-radius:99px;background:#ef4444;box-shadow:0 0 0 4px rgba(239,68,68,.18),0 0 12px rgba(239,68,68,.55);flex:0 0 auto}
      .nte-ownership-banner.nte-ownership-unknown{background:linear-gradient(135deg,rgba(245,158,11,.14),rgba(245,158,11,.05));border-color:rgba(245,158,11,.32);color:#fbbf24}
      .nte-ownership-banner.nte-ownership-unknown:before{background:#f59e0b;box-shadow:0 0 0 4px rgba(245,158,11,.16),0 0 12px rgba(245,158,11,.42)}
      .light-theme .nte-ownership-banner{color:#b91c1c;background:linear-gradient(135deg,rgba(254,226,226,.98),rgba(255,255,255,.92));border-color:rgba(220,38,38,.28)}
      .light-theme .nte-ownership-banner.nte-ownership-unknown{color:#92400e;background:linear-gradient(135deg,rgba(254,243,199,.96),rgba(255,255,255,.92));border-color:rgba(245,158,11,.28)}
    `;
    document.head.appendChild(style);
  }

  var ownership_cache = {};
  var ownership_pending = {};
  var ownership_check_timer = 0;
  var ownership_check_due = 0;
  var ownership_last_trade_id = null;
  var ownership_run_token = 0;
  var ownership_selected_row_key = "";

  function reset_ownership_check_state() {
    ownership_selected_row_key = "";
    ownership_last_trade_id = null;
    ownership_run_token += 1;
  }

  function reset_ownership_check_state_for_row(row) {
    let row_key = get_ownership_row_key(row);
    if (row_key && row_key === ownership_selected_row_key) return false;
    ownership_selected_row_key = row_key;
    ownership_last_trade_id = null;
    ownership_run_token += 1;
    return true;
  }

  function create_owned_item_state() {
    return { instance_ids: new Set(), target_counts: new Map(), name_counts: new Map(), is_complete: false };
  }

  function normalize_ownership_name(name) {
    return String(name || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function add_ownership_count(map, key) {
    if (key) map.set(key, (map.get(key) || 0) + 1);
  }

  function add_owned_item_state(state, item, inst = item) {
    let instance_id =
      inst?.collectibleItemInstanceId ||
      inst?.collectibleItemInstance?.collectibleItemInstanceId ||
      inst?.collectibleItemInstance?.id ||
      item?.collectibleItemInstanceId ||
      item?.collectibleItemInstance?.collectibleItemInstanceId ||
      item?.collectibleItemInstance?.id;
    if (instance_id) state.instance_ids.add(String(instance_id).toLowerCase());

    let target = inst?.itemTarget || item?.itemTarget || {};
    let target_id = target?.targetId || target?.id || item?.assetId || item?.targetId;
    if (target_id) add_ownership_count(state.target_counts, String(target_id));

    let name = normalize_ownership_name(inst?.itemName || item?.itemName || item?.name);
    if (name) add_ownership_count(state.name_counts, name);
  }

  function has_owned_item_state(state) {
    return !!(state && (state.instance_ids.size || state.target_counts.size || state.name_counts.size));
  }

  async function fetch_inventory_owned_items(user_id, wanted_offers = null) {
    let owned = create_owned_item_state();
    let cursor = "";
    for (let page = 0; page < 40; page++) {
      let url = `https://inventory.roblox.com/v1/users/${user_id}/assets/collectibles?limit=100&sortOrder=Asc`;
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
      let resp;
      try {
        resp = await fetch(url, { credentials: "include" });
      } catch {
        return null;
      }
      if (!resp.ok) return null;
      let json = await resp.json().catch(() => null);
      if (!json) return null;
      if (json.data) for (let item of json.data) {
        add_owned_item_state(owned, item);
      }
      if (wanted_ownership_met(owned, wanted_offers)) return owned;
      cursor = json.nextPageCursor;
      if (!cursor) break;
    }
    owned.is_complete = true;
    return owned;
  }

  async function fetch_tradable_owned_items(user_id, wanted_offers = null) {
    let owned = create_owned_item_state();
    let cursor = "";
    for (let page = 0; page < 40; page++) {
      let params = new URLSearchParams({ sortBy: "CreationTime", cursor, limit: "100", sortOrder: "Desc" });
      let resp;
      try {
        resp = await fetch(`https://trades.roblox.com/v2/users/${user_id}/tradableitems?${params.toString()}`, { credentials: "include" });
      } catch {
        return null;
      }
      if (!resp.ok) return null;
      let json = await resp.json().catch(() => null);
      if (!json) return null;
      let page_items = Array.isArray(json?.items) ? json.items : Array.isArray(json?.data) ? json.data : [];
      for (let item of page_items) {
        let instances = Array.isArray(item.instances) && item.instances.length ? item.instances : [item];
        for (let inst of instances) {
          add_owned_item_state(owned, item, inst);
        }
      }
      if (wanted_ownership_met(owned, wanted_offers)) return owned;
      cursor = json.nextPageCursor || "";
      if (!cursor) break;
    }
    owned.is_complete = true;
    return owned;
  }

  function ownership_wanted_key(wanted_offers) {
    if (!Array.isArray(wanted_offers) || !wanted_offers.length) return "all";
    return wanted_offers
      .map((offer) => `${offer.instance_id || ""}:${offer.target_id || ""}:${offer.name || ""}`)
      .join("|");
  }

  async function prewarm_user_ownership(user_id) {
    let id = String(user_id || "").trim();
    if (!/^\d+$/.test(id)) return null;
    let cache = ownership_cache[id];
    if (cache && cache.ts > Date.now() - 600000 && cache.complete) return cache.ids;
    let pending_key = `${id}:prewarm`;
    if (ownership_pending[pending_key]) return ownership_pending[pending_key];
    ownership_pending[pending_key] = (async () => {
      let owned = create_owned_item_state();
      let params = new URLSearchParams({ sortBy: "CreationTime", cursor: "", limit: "100", sortOrder: "Desc" });
      let resp = await fetch(`https://trades.roblox.com/v2/users/${id}/tradableitems?${params.toString()}`, { credentials: "include" }).catch(() => null);
      if (!resp?.ok) return null;
      let json = await resp.json().catch(() => null);
      if (!json) return null;
      let page_items = Array.isArray(json?.items) ? json.items : Array.isArray(json?.data) ? json.data : [];
      for (let item of page_items) {
        let instances = Array.isArray(item.instances) && item.instances.length ? item.instances : [item];
        for (let inst of instances) add_owned_item_state(owned, item, inst);
      }
      owned.is_complete = !json?.nextPageCursor;
      if (!has_owned_item_state(owned)) return owned;
      let merged = cache?.ids || create_owned_item_state();
      for (let value of owned.instance_ids) merged.instance_ids.add(value);
      for (let [key, value] of owned.target_counts) merged.target_counts.set(key, Math.max(merged.target_counts.get(key) || 0, value));
      for (let [key, value] of owned.name_counts) merged.name_counts.set(key, Math.max(merged.name_counts.get(key) || 0, value));
      merged.is_complete = !!owned.is_complete || !!cache?.complete;
      ownership_cache[id] = { ids: merged, ts: Date.now(), complete: merged.is_complete };
      return merged;
    })().finally(() => {
      delete ownership_pending[pending_key];
    });
    return ownership_pending[pending_key];
  }

  async function fetch_user_collectible_ids(user_id, wanted_offers = null) {
    let prewarm_key = `${user_id}:prewarm`;
    if (ownership_pending[prewarm_key]) await ownership_pending[prewarm_key].catch(() => null);
    let cache = ownership_cache[user_id];
    if (cache && cache.ts > Date.now() - 600000) {
      if (cache.complete || wanted_ownership_met(cache.ids, wanted_offers)) return cache.ids;
    }
    let pending_key = `${user_id}:${ownership_wanted_key(wanted_offers)}`;
    if (ownership_pending[pending_key]) return ownership_pending[pending_key];
    ownership_pending[pending_key] = (async () => {
      let owned = await fetch_tradable_owned_items(user_id, wanted_offers);
      if (!has_owned_item_state(owned)) owned = await fetch_inventory_owned_items(user_id, wanted_offers);
      if (owned) ownership_cache[user_id] = { ids: owned, ts: Date.now(), complete: !!owned.is_complete };
      return owned;
    })().finally(() => {
      delete ownership_pending[pending_key];
    });
    return ownership_pending[pending_key];
  }

  function get_selected_trade_id_sync(row) {
    return row?.getAttribute("nruTradeId") || row?.getAttribute("nrutradeid") || row?.getAttribute("data-nte-trade-id") || "";
  }

  function get_selected_trade_partner_id(row) {
    let href =
      row?.querySelector('a[href*="/users/"]')?.getAttribute("href") ||
      [...document.getElementsByClassName("trades-header-nowrap")].at(-1)?.querySelector(".paired-name")?.getAttribute("href") ||
      "";
    let match = href.match(/\/users\/(\d+)\//);
    return match ? match[1] : "";
  }

  function get_ownership_row_key(row) {
    let trade_id = get_selected_trade_id_sync(row);
    if (trade_id) return `trade:${trade_id}`;
    let partner_id = get_selected_trade_partner_id(row);
    let text = row?.textContent?.replace(/\s+/g, " ").trim().slice(0, 160) || "";
    return partner_id || text ? `row:${partner_id}:${text}` : "";
  }

  function prewarm_ownership_for_row(row) {
    let partner_id = get_selected_trade_partner_id(row);
    if (!partner_id) return;
    prewarm_user_ownership(partner_id).catch(() => {});
  }

  function get_selected_trade_partner_name(row) {
    let paired = [...document.getElementsByClassName("trades-header-nowrap")].at(-1)?.querySelector(".paired-name");
    let username = paired?.children?.[2]?.textContent?.trim() || "";
    if (username) return username.replace(/^@+/, "");
    let name_el = row?.querySelector(".text-lead") || row?.querySelector("[ng-bind*='nameForDisplay']");
    return name_el?.textContent?.trim() || "Unknown";
  }

  function get_trade_offer_elements() {
    return Array.from(document.querySelectorAll(".trade-list-detail-offer"));
  }

  function get_trade_offer_header_text(offer_el) {
    return String(offer_el?.querySelector(".trade-list-detail-offer-header")?.textContent || "");
  }

  function get_partner_offer_element() {
    let offers = get_trade_offer_elements();
    if (!offers.length) return null;
    return (
      offers.find((offer) => /would have received|would receive|received/i.test(get_trade_offer_header_text(offer))) ||
      offers[1] ||
      null
    );
  }

  function get_self_offer_element() {
    let offers = get_trade_offer_elements();
    if (!offers.length) return null;
    let partner_offer = get_partner_offer_element();
    return (
      offers.find((offer) => /would have given|would give|gave|sent|offered/i.test(get_trade_offer_header_text(offer))) ||
      offers.find((offer) => offer !== partner_offer) ||
      offers[0] ||
      null
    );
  }

  function get_history_offer_element(item_side = "partner") {
    return item_side === "self" ? get_self_offer_element() : get_partner_offer_element();
  }

  function get_offer_collectible_cards(offer_el) {
    return Array.from(offer_el?.querySelectorAll(".item-card-container[data-collectibleiteminstanceid]") || []);
  }

  function get_offer_card_ownership_data(card) {
    let name_el =
      card.querySelector(".item-card-name span") ||
      card.querySelector(".item-card-name-link") ||
      card.querySelector(".item-card-name");
    return {
      instance_id: (card.getAttribute("data-collectibleiteminstanceid") || "").toLowerCase(),
      target_id: String(c.getItemIdFromElement(card) || ""),
      name: normalize_ownership_name(name_el?.textContent),
      display_name: name_el?.textContent?.trim() || "Unknown item",
    };
  }

  function consume_ownership_count(map, key) {
    let count = key ? map.get(key) || 0 : 0;
    if (count <= 0) return false;
    if (count === 1) map.delete(key);
    else map.set(key, count - 1);
    return true;
  }

  function consume_owned_item(owned, offer) {
    if (offer.instance_id && owned.instance_ids.has(offer.instance_id)) {
      owned.instance_ids.delete(offer.instance_id);
      consume_ownership_count(owned.target_counts, offer.target_id);
      consume_ownership_count(owned.name_counts, offer.name);
      return true;
    }
    if (consume_ownership_count(owned.target_counts, offer.target_id)) return true;
    return consume_ownership_count(owned.name_counts, offer.name);
  }

  function wanted_ownership_met(owned, wanted_offers) {
    if (!Array.isArray(wanted_offers) || !wanted_offers.length || !has_owned_item_state(owned)) return false;
    let remaining_owned = {
      instance_ids: new Set(owned.instance_ids),
      target_counts: new Map(owned.target_counts),
      name_counts: new Map(owned.name_counts),
    };
    return wanted_offers.every((offer) => consume_owned_item(remaining_owned, offer));
  }

  function clear_ownership_ui() {
    document.querySelectorAll(".nte-unowned-badge, .nte-ownership-banner").forEach((el) => el.remove());
    document.querySelectorAll(".nte-unowned-card").forEach((el) => el.classList.remove("nte-unowned-card"));
  }

  function show_ownership_banner(offer_el, unowned_names) {
    offer_el.querySelectorAll(".nte-ownership-banner").forEach((el) => el.remove());
    let banner = document.createElement("div");
    banner.className = "nte-ownership-banner";
    banner.textContent = `They no longer own: ${unowned_names.join(", ")}`;
    let header = offer_el.querySelector(".trade-list-detail-offer-header");
    if (header) header.insertAdjacentElement("afterend", banner);
    else offer_el.insertAdjacentElement("afterbegin", banner);
  }

  function show_ownership_unknown_banner(offer_el) {
    offer_el.querySelectorAll(".nte-ownership-banner").forEach((el) => el.remove());
    let banner = document.createElement("div");
    banner.className = "nte-ownership-banner nte-ownership-unknown";
    banner.textContent = "Could not verify current ownership for this user";
    let header = offer_el.querySelector(".trade-list-detail-offer-header");
    if (header) header.insertAdjacentElement("afterend", banner);
    else offer_el.insertAdjacentElement("afterbegin", banner);
  }

  async function run_ownership_check() {
    if (!/\/trades\b/i.test(location.pathname)) return;
    let _oc_tab = (new URLSearchParams(location.search).get("tab") || "inbound").toLowerCase();
    if (_oc_tab === "completed") return;
    inject_ownership_styles();

    let row = document.querySelector(".trade-row.selected");
    let partner_id = get_selected_trade_partner_id(row);
    let trade_id = get_selected_trade_id_sync(row);
    let offer_el = get_partner_offer_element();
    let cards = get_offer_collectible_cards(offer_el);
    if (!partner_id || !offer_el || !cards.length) return;

    let card_signature = cards.map((card) => card.getAttribute("data-collectibleiteminstanceid") || "").join("|");
    let check_key = `${trade_id || "detail"}:${partner_id}:${card_signature}`;
    if (check_key === ownership_last_trade_id) return;
    ownership_last_trade_id = check_key;
    let run_token = ++ownership_run_token;

    let wanted_offers = cards.map((card) => get_offer_card_ownership_data(card));
    let owned = await fetch_user_collectible_ids(partner_id, wanted_offers);
    if (run_token !== ownership_run_token || ownership_last_trade_id !== check_key) return;
    if (!has_owned_item_state(owned)) {
      clear_ownership_ui();
      show_ownership_unknown_banner(offer_el);
      return;
    }

    let unowned_names = [];
    let remaining_owned = {
      instance_ids: new Set(owned.instance_ids),
      target_counts: new Map(owned.target_counts),
      name_counts: new Map(owned.name_counts),
    };
    for (let offer_data of wanted_offers) {
      if (!consume_owned_item(remaining_owned, offer_data)) {
        unowned_names.push(offer_data.display_name);
      }
    }

    clear_ownership_ui();
    if (unowned_names.length > 0) show_ownership_banner(offer_el, unowned_names);
  }

  function schedule_ownership_check(delay = 120) {
    let due = Date.now() + Math.max(0, Number(delay) || 0);
    if (ownership_check_timer && due >= ownership_check_due) return;
    clearTimeout(ownership_check_timer);
    ownership_check_due = due;
    ownership_check_timer = setTimeout(() => {
      ownership_check_timer = 0;
      ownership_check_due = 0;
      run_ownership_check().catch(() => {});
    }, Math.max(0, due - Date.now()));
  }



  var nte_history_style_injected = false;
  var nte_history_last_key = "";
  var nte_history_request_token = 0;
  var nte_analyze_trade_feature = null;
  var nte_history_owner_asset_cache = {};

  function inject_trade_history_styles() {
    if (nte_history_style_injected) return;
    nte_history_style_injected = true;
    let style = document.createElement("style");
    style.textContent = `
      .nte-history-fallback-row{display:flex;flex-direction:row;align-items:center;flex-wrap:wrap;gap:10px;margin-top:14px;margin-bottom:6px;min-height:36px}
      .nte-history-btn,.nte-analyze-trade-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px}
      .nte-history-btn .nte-history-btn-inner,.nte-analyze-trade-btn .nte-history-btn-inner{display:inline-flex;align-items:center;justify-content:center;gap:8px}
      .nte-history-btn.nte-history-btn--loading,.nte-analyze-trade-btn.nte-analyze-trade-btn--loading{pointer-events:none}
      .nte-history-btn.nte-history-btn--active{box-shadow:0 0 0 1px rgba(96,165,250,.38) inset}
      .nte-analyze-trade-btn.nte-analyze-trade-btn--active{box-shadow:0 0 0 1px rgba(45,212,191,.42) inset}
      .nte-history-btn-spinner{width:14px;height:14px;border:2px solid currentColor;border-right-color:transparent;border-radius:999px;animation:nteHistorySpin .72s linear infinite;flex:0 0 auto}
      @keyframes nteHistorySpin{to{transform:rotate(360deg)}}
      .nte-history-panel{margin-top:12px;border-radius:14px;padding:14px 16px 16px;background:linear-gradient(160deg,rgba(15,23,42,.92),rgba(17,24,39,.96));border:1px solid rgba(148,163,184,.18);box-shadow:0 16px 42px rgba(2,6,23,.32);color:#e5eefc;overflow:hidden}
      .light-theme .nte-history-panel{background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(248,250,252,.98));border-color:rgba(15,23,42,.1);box-shadow:0 16px 34px rgba(15,23,42,.08);color:#122033}
      .nte-history-panel.nte-history-panel--error{background:linear-gradient(160deg,rgba(69,10,10,.92),rgba(31,17,17,.96));border-color:rgba(248,113,113,.28);color:#fecaca}
      .light-theme .nte-history-panel.nte-history-panel--error{background:linear-gradient(180deg,rgba(254,242,242,.98),rgba(255,255,255,.98));border-color:rgba(239,68,68,.22);color:#991b1b}
      .nte-history-head{display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:10px;margin-bottom:12px;padding-right:76px}
      .nte-history-head-actions{display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:8px;flex:0 0 auto;width:min(100%,228px);min-width:0}
      .nte-history-title{font-size:15px;font-weight:800;letter-spacing:.01em}
      .nte-history-sub{margin-top:4px;font-size:12px;line-height:1.45;opacity:.78}
      .nte-history-switches{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:8px;flex:0 0 auto;width:min(100%,228px);padding:8px;border-radius:16px;background:rgba(15,23,42,.26);border:1px solid rgba(148,163,184,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
      .light-theme .nte-history-switches{background:rgba(241,245,249,.92);border-color:rgba(148,163,184,.18);box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}
      .nte-history-switch-group{display:flex;width:100%}
      .nte-history-mode-switch{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:center;gap:4px;padding:3px;width:100%;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(148,163,184,.12)}
      .light-theme .nte-history-mode-switch{background:rgba(255,255,255,.92);border-color:rgba(148,163,184,.16)}
      .nte-history-mode-btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:31px;border:0;background:transparent;color:inherit;font:inherit;font-size:11px;font-weight:800;line-height:1.1;padding:7px 10px;border-radius:10px;cursor:pointer;opacity:.76;text-align:center;transition:background-color .18s ease,color .18s ease,opacity .18s ease}
      .nte-history-mode-btn:hover{opacity:1}
      .nte-history-mode-btn.is-active{opacity:1;background:rgba(96,165,250,.2);color:#dbeafe}
      .light-theme .nte-history-mode-btn.is-active{color:#1d4ed8}
      .nte-history-close{position:absolute;top:14px;right:16px;display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:7px 12px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(148,163,184,.08);color:inherit;opacity:.84;cursor:pointer;font:inherit;font-size:11px;font-weight:800;line-height:1;text-decoration:none;transition:background-color .18s ease,border-color .18s ease,opacity .18s ease;z-index:1}
      .nte-history-close:hover{opacity:1;background:rgba(148,163,184,.14);border-color:rgba(148,163,184,.28)}
      .nte-history-grid,.nte-history-loading-grid{display:grid;gap:12px}
      .nte-history-foot{margin-top:14px;display:flex;align-items:center;justify-content:center}
      .nte-history-more-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:8px 14px;border-radius:999px;border:1px solid rgba(148,163,184,.2);background:rgba(148,163,184,.1);color:inherit;font:inherit;font-size:12px;font-weight:800;cursor:pointer;transition:background-color .18s ease,border-color .18s ease,opacity .18s ease}
      .nte-history-more-btn:hover{background:rgba(148,163,184,.16);border-color:rgba(148,163,184,.28)}
      .nte-history-more-btn[disabled]{opacity:.62;cursor:wait}
      .nte-history-item{border-radius:12px;padding:12px;background:rgba(255,255,255,.045);border:1px solid rgba(148,163,184,.14)}
      .light-theme .nte-history-item{background:rgba(241,245,249,.92);border-color:rgba(148,163,184,.18)}
      .nte-history-item-top{display:flex;align-items:flex-start;gap:12px}
      .nte-history-thumb{width:44px;height:44px;border-radius:10px;object-fit:cover;flex:0 0 auto;background:rgba(15,23,42,.5)}
      .light-theme .nte-history-thumb{background:rgba(226,232,240,.9)}
      .nte-history-thumb--empty{display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:rgba(148,163,184,.85)}
      .nte-history-item-copy{min-width:0;flex:1}
      .nte-history-item-name-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap}
      .nte-history-item-name{font-size:13px;font-weight:800;line-height:1.35;word-break:break-word}
      .nte-history-proof-btn{display:inline-flex;align-items:center;justify-content:center;padding:4px 8px;border-radius:999px;border:1px solid rgba(96,165,250,.26);background:rgba(96,165,250,.12);color:#dbeafe;font:inherit;font-size:10px;font-weight:800;line-height:1.2;cursor:pointer;transition:background-color .18s ease,border-color .18s ease,opacity .18s ease;flex:0 0 auto}
      .light-theme .nte-history-proof-btn{color:#1d4ed8}
      .nte-history-proof-btn:hover{background:rgba(96,165,250,.18);border-color:rgba(96,165,250,.36)}
      .nte-history-proof-btn.is-open{background:rgba(34,197,94,.14);border-color:rgba(34,197,94,.3);color:#bbf7d0}
      .light-theme .nte-history-proof-btn.is-open{color:#166534}
      .nte-history-proof-btn[disabled]{opacity:.72;cursor:wait}
      .nte-history-item-meta{margin-top:6px;display:flex;flex-wrap:wrap;gap:6px}
      .nte-history-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(148,163,184,.14);border:1px solid rgba(148,163,184,.18);color:inherit}
      .nte-history-pill.is-good{background:rgba(34,197,94,.16);border-color:rgba(34,197,94,.26);color:#86efac}
      .light-theme .nte-history-pill.is-good{color:#166534}
      .nte-history-pill.is-note{background:rgba(96,165,250,.14);border-color:rgba(96,165,250,.24);color:#bfdbfe}
      .light-theme .nte-history-pill.is-note{color:#1d4ed8}
      .nte-history-pill.is-up{background:var(--nte-history-profit-up-bg, rgba(34,197,94,.16));border-color:var(--nte-history-profit-up-border, rgba(34,197,94,.26));color:var(--nte-history-profit-up-color, #86efac)}
      .light-theme .nte-history-pill.is-up{color:var(--nte-history-profit-up-light, #166534)}
      .nte-history-pill.is-down{background:var(--nte-history-profit-down-bg, rgba(248,113,113,.16));border-color:var(--nte-history-profit-down-border, rgba(248,113,113,.28));color:var(--nte-history-profit-down-color, #fecaca)}
      .light-theme .nte-history-pill.is-down{color:var(--nte-history-profit-down-light, #b91c1c)}
      .nte-history-pill.is-muted{opacity:.82}
      .nte-history-item-held{margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;line-height:1.4;color:#cbd5e1}
      .nte-history-item-held:before{content:"";width:7px;height:7px;border-radius:999px;background:#60a5fa;box-shadow:0 0 0 3px rgba(96,165,250,.16);flex:0 0 auto}
      .light-theme .nte-history-item-held{color:#475569}
      .nte-history-item-held-copy{font-weight:700}
      .nte-history-item-held-age{display:inline-flex;align-items:center;padding:2px 7px;border-radius:999px;background:rgba(96,165,250,.14);border:1px solid rgba(96,165,250,.22);color:#bfdbfe;font-size:10px;font-weight:800;line-height:1}
      .light-theme .nte-history-item-held-age{color:#1d4ed8}
      .nte-history-item-link{margin-top:8px;font-size:11px;opacity:.78}
      .nte-history-item-link a,.nte-history-link{color:inherit;text-decoration:underline;text-decoration-style:dotted}
      .nte-history-item-toggle{margin-top:10px;display:inline-flex;align-items:center;gap:6px;padding:0;border:0;background:transparent;color:inherit;font:inherit;font-size:11px;font-weight:800;cursor:pointer;opacity:.8}
      .nte-history-item-toggle:hover{opacity:1}
      .nte-history-item-toggle-chevron{display:inline-block;transition:transform .18s ease}
      .nte-history-item.is-open .nte-history-item-toggle-chevron{transform:rotate(90deg)}
      .nte-history-item-body[hidden]{display:none!important}
      .nte-history-proof-slot[hidden]{display:none!important}
      .nte-history-proofs{margin-top:12px;padding:12px;border-radius:12px;background:rgba(2,6,23,.2);border:1px solid rgba(148,163,184,.14)}
      .light-theme .nte-history-proofs{background:rgba(255,255,255,.82);border-color:rgba(148,163,184,.16)}
      .nte-history-proofs-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .nte-history-proofs-title{font-size:12px;font-weight:800}
      .nte-history-proofs-sub{margin-top:4px;font-size:11px;line-height:1.45;opacity:.78}
      .nte-history-proof-loading{margin-top:12px;display:flex;align-items:center;gap:8px;font-size:11px;opacity:.78}
      .nte-history-proof-loading-spinner{width:13px;height:13px;border:2px solid currentColor;border-right-color:transparent;border-radius:999px;animation:nteHistorySpin .72s linear infinite}
      .nte-history-proofs-grid{margin-top:12px;display:grid;gap:8px}
      .nte-history-proof-card{padding:10px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(148,163,184,.12)}
      .light-theme .nte-history-proof-card{background:rgba(241,245,249,.88)}
      .nte-history-proof-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px}
      .nte-history-proof-card-title{font-size:11px;font-weight:800}
      .nte-history-proof-card-meta{font-size:10px;opacity:.72}
      .nte-history-proof-card-text{font-size:11px;line-height:1.55;word-break:break-word}
      .nte-history-proof-actions{margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .nte-history-proof-images-btn{display:inline-flex;align-items:center;justify-content:center;padding:4px 8px;border-radius:999px;border:1px solid rgba(148,163,184,.22);background:rgba(148,163,184,.12);color:inherit;font:inherit;font-size:10px;font-weight:800;line-height:1.2;cursor:pointer;transition:background-color .18s ease,border-color .18s ease,opacity .18s ease}
      .nte-history-proof-images-btn:hover{background:rgba(148,163,184,.18);border-color:rgba(148,163,184,.3)}
      .nte-history-proof-images-btn.is-open{background:rgba(34,197,94,.14);border-color:rgba(34,197,94,.3);color:#bbf7d0}
      .light-theme .nte-history-proof-images-btn.is-open{color:#166534}
      .nte-history-proof-images-btn[disabled]{opacity:.72;cursor:wait}
      .nte-history-proof-image-note{font-size:10px;opacity:.72}
      .nte-history-proof-image-shell{margin-top:10px}
      .nte-history-proof-image-shell[hidden]{display:none!important}
      .nte-history-proof-attachments{margin-top:10px;display:flex;flex-wrap:wrap;gap:8px}
      .nte-history-proof-thumb-link{display:block}
      .nte-history-proof-thumb{width:84px;height:84px;border-radius:10px;object-fit:cover;background:rgba(15,23,42,.45);border:1px solid rgba(148,163,184,.16)}
      .light-theme .nte-history-proof-thumb{background:rgba(226,232,240,.9)}
      .nte-history-proof-image-fail{display:flex;align-items:center;justify-content:center;min-width:84px;height:84px;padding:0 10px;border-radius:10px;background:rgba(248,113,113,.08);border:1px dashed rgba(248,113,113,.22);font-size:10px;font-weight:700;line-height:1.35;text-align:center}
      .nte-history-proof-more{display:inline-flex;align-items:center;justify-content:center;min-width:84px;height:84px;padding:0 12px;border-radius:10px;background:rgba(148,163,184,.12);border:1px dashed rgba(148,163,184,.2);font-size:11px;font-weight:800;text-decoration:none;color:inherit}
      .nte-history-proof-empty-copy{margin-top:8px;font-size:11px;opacity:.72}
      .nte-history-list{margin-top:12px;display:flex;flex-direction:column;gap:8px}
      .nte-history-entry{padding:10px 11px;border-radius:10px;background:rgba(2,6,23,.24);border:1px solid rgba(148,163,184,.12)}
      .light-theme .nte-history-entry{background:rgba(255,255,255,.82);border-color:rgba(148,163,184,.16)}
      .nte-history-entry-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .nte-history-entry-main{min-width:0;flex:1}
      .nte-history-entry-flow{font-size:12px;font-weight:700;line-height:1.4;min-width:0}
      .nte-history-user-chip{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;max-width:100%;vertical-align:top}
      .nte-history-user-name{min-width:0}
      .nte-history-user-badge{display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;font-size:10px;font-weight:800;line-height:1;background:rgba(96,165,250,.18);border:1px solid rgba(96,165,250,.28);color:#bfdbfe}
      .light-theme .nte-history-user-badge{color:#1d4ed8}
      .nte-history-entry-side{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
      .nte-history-entry-time{flex:0 0 auto;text-align:right;font-size:11px;line-height:1.35;opacity:.74}
      .nte-history-entry-meta{margin-top:6px;font-size:11px;line-height:1.45;opacity:.76}
      .nte-history-entry-meta-row{margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      .nte-history-entry-meta-row .nte-history-entry-meta{margin-top:0}
      .nte-history-entry-pills{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      .nte-history-entry-toggle{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(148,163,184,.08);color:inherit;font:inherit;font-size:11px;font-weight:700;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background-color .18s ease}
      .nte-history-entry-toggle:hover{background:rgba(148,163,184,.14);border-color:rgba(148,163,184,.28)}
      .nte-history-entry-toggle-chevron{display:inline-block;transition:transform .18s ease}
      .nte-history-entry.is-open .nte-history-entry-toggle-chevron{transform:rotate(90deg)}
      .nte-history-arrow{opacity:.54;padding:0 4px}
      .nte-history-entry-expand{margin-top:12px;padding-top:12px;border-top:1px solid rgba(148,163,184,.12)}
      .nte-history-trade-card{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:12px;align-items:stretch}
      .nte-history-trade-sep{display:flex;align-items:center;justify-content:center;padding:0 2px}
      .nte-history-trade-sep-label{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.6}
      .nte-history-trade-side{padding:12px;border-radius:12px;background:rgba(15,23,42,.24);border:1px solid rgba(148,163,184,.12)}
      .light-theme .nte-history-trade-side{background:rgba(255,255,255,.82);border-color:rgba(148,163,184,.16)}
      .nte-history-trade-side-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
      .nte-history-trade-side-label{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;font-weight:800;line-height:1.35;word-break:break-word}
      .nte-history-trade-side-verb{opacity:.72;font-weight:700}
      .nte-history-trade-side-total{margin-top:4px;font-size:13px;font-weight:800;line-height:1.35}
      .nte-history-trade-side-count{font-size:11px;line-height:1.4;opacity:.7}
      .nte-history-trade-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .nte-history-trade-slot{display:flex;align-items:flex-start;gap:8px;min-width:0;padding:8px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(148,163,184,.12)}
      .light-theme .nte-history-trade-slot{background:rgba(241,245,249,.88)}
      .nte-history-trade-slot.is-focus{border-color:rgba(96,165,250,.42);box-shadow:0 0 0 1px rgba(96,165,250,.18) inset;background:linear-gradient(135deg,rgba(96,165,250,.12),rgba(255,255,255,.04))}
      .light-theme .nte-history-trade-slot.is-focus{background:linear-gradient(135deg,rgba(96,165,250,.12),rgba(255,255,255,.92))}
      .nte-history-trade-slot-thumb{width:34px;height:34px;border-radius:8px;object-fit:cover;flex:0 0 auto;background:rgba(15,23,42,.5)}
      .light-theme .nte-history-trade-slot-thumb{background:rgba(226,232,240,.9)}
      .nte-history-trade-slot-thumb--empty{display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:rgba(148,163,184,.8)}
      .nte-history-trade-slot-copy{min-width:0;flex:1}
      .nte-history-trade-slot-name{font-size:11px;font-weight:800;line-height:1.35;word-break:break-word}
      .nte-history-trade-slot-meta{margin-top:3px;font-size:10px;line-height:1.35;opacity:.74}
      .nte-history-trade-more{margin-top:8px;font-size:11px;font-weight:700;line-height:1.4;opacity:.72}
      .nte-history-empty{margin-top:12px;padding:12px;border-radius:10px;background:rgba(15,23,42,.28);border:1px dashed rgba(148,163,184,.18);font-size:12px;line-height:1.5;opacity:.82}
      .light-theme .nte-history-empty{background:rgba(255,255,255,.8)}
      .nte-history-loading-card{padding:12px;border-radius:12px;background:rgba(255,255,255,.045);border:1px solid rgba(148,163,184,.14)}
      .light-theme .nte-history-loading-card{background:rgba(241,245,249,.92);border-color:rgba(148,163,184,.18)}
      .nte-history-skel{border-radius:999px;background:linear-gradient(90deg,rgba(148,163,184,.14),rgba(148,163,184,.3),rgba(148,163,184,.14));background-size:220% 100%;animation:nteHistoryPulse 1.15s linear infinite}
      .nte-history-skel-thumb{width:44px;height:44px;border-radius:10px}
      .nte-history-skel-line{height:10px}
      .nte-history-skel-line.is-wide{width:68%}
      .nte-history-skel-line.is-mid{width:44%;margin-top:8px}
      @media (max-width:700px){
        .nte-history-head{flex-direction:column;align-items:stretch}
        .nte-history-head-actions{align-items:stretch;min-width:0}
        .nte-history-switches{width:100%}
        .nte-history-entry-top{flex-direction:column;align-items:stretch}
        .nte-history-entry-side{width:100%;flex-direction:row;align-items:center;justify-content:space-between}
        .nte-history-entry-time{text-align:left}
        .nte-history-trade-card{grid-template-columns:minmax(0,1fr)}
        .nte-history-trade-sep{display:none}
      }
      @keyframes nteHistoryPulse{to{background-position:-220% 0}}
    `;
    document.head.appendChild(style);
  }

  function nte_history_esc(text) {
    let div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  function nte_history_attr_esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function nte_history_multiline_html(text) {
    return nte_history_esc(text).replace(/\n/g, "<br>");
  }

  function nte_history_is_current_partner(user_id, current_partner_id) {
    return !!(current_partner_id && user_id && String(current_partner_id) === String(user_id));
  }

  function nte_history_profile_html(user_id, user_name, current_partner_id = "") {
    let id = String(user_id || "").trim();
    let label = nte_history_esc(user_name || (id ? `User ${id}` : "Unknown"));
    let name_html = /^\d+$/.test(id)
      ? `<a class="nte-history-link" href="https://www.rolimons.com/player/${id}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : label;
    let badge_html = nte_history_is_current_partner(id, current_partner_id)
      ? ' <span class="nte-history-user-badge">Current trader</span>'
      : "";
    return `<span class="nte-history-user-chip"><span class="nte-history-user-name">${name_html}</span>${badge_html}</span>`;
  }

  function nte_history_format_number(value) {
    let numeric = Math.max(0, Number(value) || 0);
    return numeric.toLocaleString();
  }

  function normalize_trade_history_item_side(value) {
    return value === "self" ? "self" : "partner";
  }

  function get_trade_history_side_copy(item_side = "partner") {
    return normalize_trade_history_item_side(item_side) === "self"
      ? {
          button_label: "Your items",
          scope_label: "your side",
          panel_label: "your items",
        }
      : {
          button_label: "Their items",
          scope_label: "their side",
          panel_label: "their items",
        };
  }

  function render_trade_history_mode_switch(mode) {
    return `
      <div class="nte-history-switch-group">
        <div class="nte-history-mode-switch" role="tablist" aria-label="History scope">
          <button type="button" class="nte-history-mode-btn${mode === "uaid" ? " is-active" : ""}" data-mode="uaid">This copy</button>
          <button type="button" class="nte-history-mode-btn${mode === "asset" ? " is-active" : ""}" data-mode="asset">All copies</button>
        </div>
      </div>
    `;
  }

  function render_trade_history_side_switch(item_side = "partner") {
    item_side = normalize_trade_history_item_side(item_side);
    let partner_copy = get_trade_history_side_copy("partner");
    let self_copy = get_trade_history_side_copy("self");
    return `
      <div class="nte-history-switch-group">
        <div class="nte-history-mode-switch" role="tablist" aria-label="Trade side">
          <button type="button" class="nte-history-mode-btn${item_side === "partner" ? " is-active" : ""}" data-item-side="partner">${nte_history_esc(partner_copy.button_label)}</button>
          <button type="button" class="nte-history-mode-btn${item_side === "self" ? " is-active" : ""}" data-item-side="self">${nte_history_esc(self_copy.button_label)}</button>
        </div>
      </div>
    `;
  }

  function render_trade_history_controls(mode, item_side) {
    return `<div class="nte-history-switches">${render_trade_history_side_switch(item_side)}${render_trade_history_mode_switch(mode)}</div>`;
  }

  function render_trade_history_close_button() {
    return '<button type="button" class="nte-history-close">Close</button>';
  }

  function render_trade_history_head_actions(mode, item_side) {
    return `
      <div class="nte-history-head-actions">
        ${render_trade_history_controls(mode, item_side)}
      </div>
    `;
  }

  function get_trade_history_more_state(items) {
    let max_loaded = 0;
    let has_more = false;
    for (let item of Array.isArray(items) ? items : []) {
      let loaded = Array.isArray(item?.history) ? item.history.length : 0;
      let total = Math.max(0, Number(item?.tradeCount || 0));
      if (loaded > max_loaded) max_loaded = loaded;
      if (total > loaded) has_more = true;
    }
    return { hasMore: has_more, loadedCount: max_loaded };
  }

  function render_trade_history_more_button(items, mode, use_item_toggle) {
    let state = get_trade_history_more_state(items);
    if (!state.hasMore) return "";
    let next_count = Math.min(20, Math.max(6, state.loadedCount + 6));
    if (!(next_count > state.loadedCount)) return "";
    let hide_until_item_open = use_item_toggle ? " hidden" : "";
    return `
      <div class="nte-history-foot"${hide_until_item_open}>
        <button type="button" class="nte-history-more-btn" data-next-limit="${next_count}">Show more trades</button>
      </div>
    `;
  }

  function nte_history_sync_more_foot_visibility(panel) {
    let foot = panel.querySelector(".nte-history-foot");
    if (!foot) return;
    if (panel.dataset.nteHistoryMultiItem !== "1") {
      foot.hidden = false;
      return;
    }
    foot.hidden = !panel.querySelector(".nte-history-item.is-open");
  }

  function get_trade_history_market_snapshot(entry) {
    let trade = entry?.trade || null;
    let side = String(entry?.side || "");
    if (!trade || (side !== "offer" && side !== "request")) return null;
    let focus_total = side === "offer" ? Number(trade?.offerTotal || 0) : Number(trade?.requestTotal || 0);
    let other_total = side === "offer" ? Number(trade?.requestTotal || 0) : Number(trade?.offerTotal || 0);
    return {
      focusTotal: focus_total,
      otherTotal: other_total,
      delta: other_total - focus_total,
    };
  }

  function render_trade_history_entry_pills(entry, mode) {
    let pills = [];
    if (mode === "asset") {
      let market = get_trade_history_market_snapshot(entry);
      if (market) {
        if (market.delta > 0) pills.push(`<span class="nte-history-pill is-up">${trade_profit_colorblind_mode ? "Gain" : "OP"} +${nte_history_format_number(market.delta)}</span>`);
        else if (market.delta < 0) pills.push(`<span class="nte-history-pill is-down">${trade_profit_colorblind_mode ? "Loss" : "LB"} -${nte_history_format_number(Math.abs(market.delta))}</span>`);
        else pills.push('<span class="nte-history-pill is-note">Even</span>');
      }
      let copy_count = Math.max(0, Number(entry?.copyCount || 0));
      if (copy_count > 1) pills.push(`<span class="nte-history-pill is-note">${copy_count} copies</span>`);
    }
    return pills.length ? `<div class="nte-history-entry-pills">${pills.join("")}</div>` : "";
  }

  function is_trade_history_focus_item(item, focus_item, mode) {
    if (!focus_item) return false;
    if (mode === "asset") {
      return !!(focus_item.assetId && item?.assetId && String(focus_item.assetId) === String(item.assetId));
    }
    return !!(focus_item.uaid && item?.uaid && String(focus_item.uaid) === String(item.uaid));
  }

  function render_trade_history_trade_slot(item, focus_item, mode) {
    let thumb_html = item?.thumb
      ? `<img class="nte-history-trade-slot-thumb" src="${nte_history_esc(item.thumb)}" alt="">`
      : `<div class="nte-history-trade-slot-thumb nte-history-trade-slot-thumb--empty">?</div>`;
    let stat_text =
      Number(item?.value || 0) > 0
        ? `Value ${nte_history_format_number(item.value)}`
        : Number(item?.rap || 0) > 0
          ? `RAP ${nte_history_format_number(item.rap)}`
          : `Asset ${nte_history_esc(item?.assetId || "")}`;
    let is_focus = is_trade_history_focus_item(item, focus_item, mode);
    return `
      <div class="nte-history-trade-slot${is_focus ? " is-focus" : ""}">
        ${thumb_html}
        <div class="nte-history-trade-slot-copy">
          <div class="nte-history-trade-slot-name">${nte_history_esc(item?.name || `Asset ${item?.assetId || ""}`)}</div>
          <div class="nte-history-trade-slot-meta">${stat_text}</div>
        </div>
      </div>
    `;
  }

  function render_trade_history_trade_side(user_id, user_name, items, total, focus_item, current_partner_id, mode) {
    let list = Array.isArray(items) ? items : [];
    let visible = list.slice(0, 4);
    let slots_html = visible.map((item) => render_trade_history_trade_slot(item, focus_item, mode)).join("");
    let more_html =
      list.length > 4
        ? `<div class="nte-history-trade-more">+${list.length - 4} more item${list.length - 4 === 1 ? "" : "s"}</div>`
        : "";
    let user_html = nte_history_profile_html(user_id, user_name, current_partner_id);
    return `
      <div class="nte-history-trade-side">
        <div class="nte-history-trade-side-head">
          <div>
            <div class="nte-history-trade-side-label">${user_html}<span class="nte-history-trade-side-verb"> gave</span></div>
            <div class="nte-history-trade-side-total">${nte_history_format_number(total)} total value</div>
          </div>
          <div class="nte-history-trade-side-count">${list.length} item${list.length === 1 ? "" : "s"}</div>
        </div>
        <div class="nte-history-trade-grid">${slots_html}</div>
        ${more_html}
      </div>
    `;
  }

  function render_trade_history_trade_card(trade, entry, focus_item, current_partner_id, mode) {
    let offer = Array.isArray(trade?.offer) ? trade.offer : [];
    let request = Array.isArray(trade?.request) ? trade.request : [];
    let offerer_id = String(entry?.offererId || "");
    let requester_id = String(entry?.requesterId || "");
    let offerer_name = entry?.offererName || (offerer_id ? `User ${offerer_id}` : "Unknown");
    let requester_name = entry?.requesterName || (requester_id ? `User ${requester_id}` : "Unknown");
    return `
      <div class="nte-history-entry-expand" hidden>
        <div class="nte-history-trade-card">
          ${render_trade_history_trade_side(offerer_id, offerer_name, offer, Number(trade?.offerTotal || 0), focus_item, current_partner_id, mode)}
          <div class="nte-history-trade-sep"><span class="nte-history-trade-sep-label">for</span></div>
          ${render_trade_history_trade_side(requester_id, requester_name, request, Number(trade?.requestTotal || 0), focus_item, current_partner_id, mode)}
        </div>
      </div>
    `;
  }

  function attach_trade_history_controls(panel, btn, row, offer_items, mode, item_side) {
    for (let mode_btn of panel.querySelectorAll(".nte-history-mode-btn[data-mode]")) {
      mode_btn.onclick = () => {
        let next_mode = String(mode_btn.getAttribute("data-mode") || "");
        if (!next_mode || next_mode === mode) return;
        run_trade_history(btn, {
          mode: next_mode,
          item_side,
          close_if_same: false,
          row,
          offer_items,
        });
      };
    }

    for (let side_btn of panel.querySelectorAll(".nte-history-mode-btn[data-item-side]")) {
      side_btn.onclick = () => {
        let next_side = normalize_trade_history_item_side(side_btn.getAttribute("data-item-side") || "");
        if (!next_side || next_side === item_side) return;
        run_trade_history(btn, {
          mode,
          item_side: next_side,
          close_if_same: false,
          row,
          offer_items: btn.__nte_history_cache?.offer_items_by_side?.[next_side] || null,
        });
      };
    }
  }

  function attach_trade_history_more_button(panel, btn, row, offer_items, mode, item_side, limit) {
    let more_btn = panel.querySelector(".nte-history-more-btn");
    if (!more_btn) return;
    more_btn.onclick = () => {
      let next_limit = Math.max(Number(limit) || 6, Number(more_btn.getAttribute("data-next-limit")) || 0);
      if (!(next_limit > (Number(limit) || 0))) return;
      more_btn.disabled = true;
      more_btn.textContent = "Loading more";
      run_trade_history(btn, {
        mode,
        item_side,
        limit: next_limit,
        close_if_same: false,
        row,
        offer_items,
      });
    };
  }

  function attach_trade_history_item_toggles(panel) {
    function sync_more_foot() {
      nte_history_sync_more_foot_visibility(panel);
    }
    function set_item_open_state(item, should_open) {
      let body = item?.querySelector(".nte-history-item-body");
      if (!item || !body) return;
      item.classList.toggle("is-open", should_open);
      body.hidden = !should_open;
      let toggle_btn = item.querySelector(".nte-history-item-toggle");
      if (toggle_btn) {
        toggle_btn.setAttribute("aria-expanded", should_open ? "true" : "false");
        let label = toggle_btn.querySelector(".nte-history-item-toggle-label");
        if (label) label.textContent = should_open ? "Hide history" : "Show history";
      }
      sync_more_foot();
    }
    for (let btn of panel.querySelectorAll(".nte-history-item-toggle")) {
      btn.onclick = () => {
        let item = btn.closest(".nte-history-item");
        if (!item) return;
        set_item_open_state(item, !item.classList.contains("is-open"));
      };
    }
    panel.__nte_set_history_item_open_state = set_item_open_state;
    sync_more_foot();
  }

  function render_trade_history_proof_loading() {
    return `
      <div class="nte-history-proofs">
        <div class="nte-history-proofs-title">Loading proofs</div>
        <div class="nte-history-proof-loading">
          <span class="nte-history-proof-loading-spinner" aria-hidden="true"></span>
          <span>Searching recent proof posts for this item.</span>
        </div>
      </div>
    `;
  }

  function render_trade_history_proof_image_loading() {
    return `
      <div class="nte-history-proof-loading">
        <span class="nte-history-proof-loading-spinner" aria-hidden="true"></span>
        <span>Fetching proof screenshots.</span>
      </div>
    `;
  }

  function render_trade_history_proof_image_error(message) {
    return `<div class="nte-history-proof-empty-copy">${nte_history_esc(message || "Could not load proof images right now.")}</div>`;
  }

  function get_trade_history_proof_image_button_label(state, count) {
    let image_count = Math.max(0, Number(count || 0));
    if (state === "loading") return image_count === 1 ? "Loading Image" : "Loading Images";
    if (state === "open") return image_count === 1 ? "Hide Image" : "Hide Images";
    if (image_count <= 1) return "Show Image";
    return `Show Images (${image_count})`;
  }

  function render_trade_history_proof_images(images) {
    let entries = Array.isArray(images) ? images : [];
    if (!entries.length) {
      return '<div class="nte-history-proof-empty-copy">No image attachments on this proof.</div>';
    }
    let thumbs_html = entries
      .map((entry, index) => {
        let data_url = String(entry?.dataUrl || "").trim();
        let source_url = String(entry?.sourceUrl || "").trim();
        if (!data_url) {
          return `<div class="nte-history-proof-image-fail">${nte_history_esc(entry?.error || `Could not load image ${index + 1}.`)}</div>`;
        }
        return `
          <a class="nte-history-proof-thumb-link" href="${nte_history_attr_esc(source_url || data_url)}" target="_blank" rel="noopener noreferrer">
            <img class="nte-history-proof-thumb" src="${nte_history_attr_esc(data_url)}" alt="Proof image ${index + 1}" loading="lazy" decoding="async">
          </a>
        `;
      })
      .join("");
    return `<div class="nte-history-proof-attachments">${thumbs_html}</div>`;
  }

  function render_trade_history_proof_attachments(entry, index) {
    let attachments = Array.isArray(entry?.attachments) ? entry.attachments : [];
    let attachment_count = Math.max(Number(entry?.attachmentCount || 0), attachments.length);
    if (!attachments.length) {
      return '<div class="nte-history-proof-empty-copy">No image attachments on this proof.</div>';
    }
    let more_html =
      attachment_count > attachments.length
        ? `<span class="nte-history-proof-image-note">+${attachment_count - attachments.length} more not shown</span>`
        : "";
    return `
      <div class="nte-history-proof-actions">
        <button type="button" class="nte-history-proof-images-btn" data-proof-index="${index}" data-attachment-count="${attachment_count}" aria-expanded="false">
          <span class="nte-history-proof-images-btn-label">${nte_history_esc(get_trade_history_proof_image_button_label("idle", attachment_count))}</span>
        </button>
        ${more_html}
      </div>
      <div class="nte-history-proof-image-shell" hidden></div>
    `;
  }

  function render_trade_history_proofs(response, request) {
    let results = Array.isArray(response?.results) ? response.results : [];
    let visible = results.slice(0, 6);
    let item_name =
      String(response?.itemName || "").trim() ||
      String(request?.itemName || "").trim() ||
      (request?.assetId ? `Asset ${request.assetId}` : "this item");
    let count = Math.max(Number(response?.count || 0), results.length);
    let sub_text = count
      ? `Showing ${visible.length} of ${count} proof${count === 1 ? "" : "s"} matched by ${response?.searchMode === "asset" ? "asset id" : "item name"}.`
      : "No proof posts found for this item right now.";
    let cards_html = visible
      .map(
        (entry, index) => {
          let attachment_count = Math.max(Number(entry?.attachmentCount || 0), Array.isArray(entry?.attachments) ? entry.attachments.length : 0);
          let meta_parts = [`${attachment_count} image${attachment_count === 1 ? "" : "s"}`];
          let proof_age = nte_history_format_age(entry?.timestamp);
          if (proof_age) meta_parts.push(proof_age);
          let meta_title = Number(entry?.timestamp) > 0 ? nte_history_format_date(entry.timestamp) : "";
          return `
          <article class="nte-history-proof-card">
            <div class="nte-history-proof-card-head">
              <div class="nte-history-proof-card-title">Proof ${index + 1}</div>
              <div class="nte-history-proof-card-meta"${meta_title ? ` title="${nte_history_attr_esc(meta_title)}"` : ""}>${nte_history_esc(meta_parts.join(" | "))}</div>
            </div>
            <div class="nte-history-proof-card-text">${nte_history_multiline_html(entry?.content || "No proof text.")}</div>
            ${render_trade_history_proof_attachments(entry, index)}
          </article>
        `;
        },
      )
      .join("");
    return `
      <div class="nte-history-proofs">
        <div class="nte-history-proofs-head">
          <div>
            <div class="nte-history-proofs-title">Proofs for ${nte_history_esc(item_name)}</div>
            <div class="nte-history-proofs-sub">${nte_history_esc(sub_text)}</div>
          </div>
        </div>
        ${visible.length ? `<div class="nte-history-proofs-grid">${cards_html}</div>` : ""}
      </div>
    `;
  }

  function render_trade_history_proof_error(message) {
    return `
      <div class="nte-history-proofs">
        <div class="nte-history-empty">${nte_history_esc(message || "Could not load proofs right now.")}</div>
      </div>
    `;
  }

  function set_trade_history_proof_button_state(btn, state) {
    if (!btn) return;
    let label = btn.querySelector(".nte-history-proof-btn-label");
    btn.classList.toggle("is-open", state === "open");
    btn.disabled = state === "loading";
    btn.setAttribute("aria-expanded", state === "open" ? "true" : "false");
    btn.setAttribute("aria-busy", state === "loading" ? "true" : "false");
    if (label) label.textContent = state === "loading" ? "Loading" : state === "open" ? "Hide Proofs" : "View Proofs";
  }

  function set_trade_history_proof_images_button_state(btn, state) {
    if (!btn) return;
    let label = btn.querySelector(".nte-history-proof-images-btn-label");
    let count = Math.max(0, Number(btn.getAttribute("data-attachment-count") || 0));
    btn.classList.toggle("is-open", state === "open");
    btn.disabled = state === "loading";
    btn.setAttribute("aria-expanded", state === "open" ? "true" : "false");
    btn.setAttribute("aria-busy", state === "loading" ? "true" : "false");
    if (label) label.textContent = get_trade_history_proof_image_button_label(state, count);
  }

  function attach_trade_history_proof_image_buttons(scope) {
    if (!scope) return;
    for (let btn of scope.querySelectorAll(".nte-history-proof-images-btn")) {
      set_trade_history_proof_images_button_state(btn, "idle");
      btn.onclick = async () => {
        let item = btn.closest(".nte-history-item");
        let card = btn.closest(".nte-history-proof-card");
        let shell = card?.querySelector(".nte-history-proof-image-shell");
        if (!item || !card || !shell) return;

        if (!shell.hidden) {
          shell.hidden = true;
          set_trade_history_proof_images_button_state(btn, "idle");
          return;
        }

        let proof_index = Number(btn.getAttribute("data-proof-index") || -1);
        let proofs = Array.isArray(item.__nte_history_proofs_response?.results) ? item.__nte_history_proofs_response.results : [];
        let entry = proof_index >= 0 ? proofs[proof_index] : null;
        let attachments = Array.isArray(entry?.attachments) ? entry.attachments : [];
        if (!attachments.length) {
          shell.innerHTML = render_trade_history_proof_image_error("No image attachments on this proof.");
          shell.hidden = false;
          set_trade_history_proof_images_button_state(btn, "open");
          return;
        }

        if (card.__nte_history_proof_images_loaded) {
          if (!String(shell.innerHTML || "").trim()) {
            shell.innerHTML = card.__nte_history_proof_images_loaded;
          }
          shell.hidden = false;
          set_trade_history_proof_images_button_state(btn, "open");
          return;
        }

        set_trade_history_proof_images_button_state(btn, "loading");
        shell.innerHTML = render_trade_history_proof_image_loading();
        shell.hidden = false;

        let response = await new Promise((resolve) => {
          nte_send_message({ type: "getItemProofImages", attachments }, (value) => resolve(value));
        });

        if (response?.success) {
          card.__nte_history_proof_images_loaded = render_trade_history_proof_images(response.images);
          shell.innerHTML = card.__nte_history_proof_images_loaded;
          set_trade_history_proof_images_button_state(btn, "open");
          return;
        }

        card.__nte_history_proof_images_loaded = "";
        shell.innerHTML = render_trade_history_proof_image_error(response?.error || "Could not load proof images right now.");
        set_trade_history_proof_images_button_state(btn, "open");
      };
    }
  }

  function attach_trade_history_proof_buttons(panel) {
    for (let btn of panel.querySelectorAll(".nte-history-proof-btn")) {
      btn.onclick = async () => {
        let item = btn.closest(".nte-history-item");
        let body = item?.querySelector(".nte-history-item-body");
        let slot = item?.querySelector(".nte-history-proof-slot");
        if (!item || !body || !slot) return;

        if (!slot.hidden) {
          slot.hidden = true;
          set_trade_history_proof_button_state(btn, "idle");
          return;
        }

        if (typeof panel.__nte_set_history_item_open_state === "function") {
          panel.__nte_set_history_item_open_state(item, true);
        } else {
          item.classList.add("is-open");
          body.hidden = false;
        }

        let request = {
          type: "getItemProofs",
          itemName: String(btn.getAttribute("data-proof-name") || "").trim(),
          assetId: String(btn.getAttribute("data-proof-asset-id") || "").trim(),
        };

        if (item.__nte_history_proofs_loaded) {
          if (!String(slot.innerHTML || "").trim()) {
            slot.innerHTML = item.__nte_history_proofs_loaded;
            attach_trade_history_proof_image_buttons(slot);
          }
          slot.hidden = false;
          set_trade_history_proof_button_state(btn, "open");
          return;
        }

        set_trade_history_proof_button_state(btn, "loading");
        slot.innerHTML = render_trade_history_proof_loading();
        slot.hidden = false;

        let response = await new Promise((resolve) => {
          nte_send_message(request, (value) => resolve(value));
        });

        if (response?.success) {
          item.__nte_history_proofs_response = response;
          item.__nte_history_proofs_loaded = render_trade_history_proofs(response, request);
          slot.innerHTML = item.__nte_history_proofs_loaded;
          attach_trade_history_proof_image_buttons(slot);
          set_trade_history_proof_button_state(btn, "open");
          return;
        }

        item.__nte_history_proofs_response = null;
        item.__nte_history_proofs_loaded = "";
        slot.innerHTML = render_trade_history_proof_error(response?.error || "Could not load proofs right now.");
        set_trade_history_proof_button_state(btn, "open");
      };
    }
  }

  function attach_trade_history_entry_toggles(panel) {
    for (let btn of panel.querySelectorAll(".nte-history-entry-toggle")) {
      btn.setAttribute("aria-expanded", "false");
      let label = btn.querySelector(".nte-history-entry-toggle-label");
      if (label) label.textContent = "Show trade";
    }
    if (panel.dataset.nteHistoryTradeBound === "1") return;
    panel.dataset.nteHistoryTradeBound = "1";
    panel.addEventListener("click", (event) => {
      let btn = event.target?.closest?.(".nte-history-entry-toggle");
      if (!btn || !panel.contains(btn)) return;
      event.preventDefault();
      event.stopPropagation();
      let entry = btn.closest(".nte-history-entry");
      let expand = entry?.querySelector(".nte-history-entry-expand");
      if (!entry || !expand) return;
      let should_open = !entry.classList.contains("is-open");
      entry.classList.toggle("is-open", should_open);
      expand.hidden = !should_open;
      btn.setAttribute("aria-expanded", should_open ? "true" : "false");
      let label = btn.querySelector(".nte-history-entry-toggle-label");
      if (label) label.textContent = should_open ? "Hide trade" : "Show trade";
    });
  }

  function nte_history_format_date(timestamp) {
    let time = Number(timestamp) || 0;
    if (!(time > 0)) return "Unknown time";
    try {
      return new Date(time).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "Unknown time";
    }
  }

  function nte_history_format_age(timestamp) {
    let diff = Date.now() - (Number(timestamp) || 0);
    if (!(diff >= 0)) return "";
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  function nte_history_parse_timestamp_value(value) {
    if (null == value || "" === value) return 0;
    let numeric_string = "string" === typeof value && /^\d+(\.\d+)?$/.test(value.trim());
    let timestamp = "number" === typeof value || numeric_string ? Number(value) : new Date(value).getTime();
    if (("number" === typeof value || numeric_string) && timestamp > 0 && timestamp < 10000000000) timestamp *= 1000;
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
  }

  function nte_history_extract_hold_since(raw) {
    if (!raw || "object" !== typeof raw) return 0;
    let candidates = [
      raw.heldSince,
      raw.holdingSince,
      raw.ownerSince,
      raw.ownedSince,
      raw.acquiredAt,
      raw.acquiredTime,
      raw.acquisitionTime,
      raw.obtainedAt,
      raw.createdAt,
      raw.createdTime,
      raw.createdUtc,
      raw.created,
      raw.collectibleItemInstance?.createdAt,
      raw.collectibleItemInstance?.createdTime,
      raw.collectibleItemInstance?.createdUtc,
      raw.collectibleItemInstance?.created,
      raw.userAsset?.createdAt,
      raw.userAsset?.createdTime,
      raw.userAsset?.createdUtc,
      raw.userAsset?.created,
    ];
    for (let value of candidates) {
      let timestamp = nte_history_parse_timestamp_value(value);
      if (timestamp > 0) return timestamp;
    }
    return 0;
  }

  function nte_history_format_hold_date(timestamp) {
    let time = Number(timestamp) || 0;
    if (!(time > 0)) return "";
    try {
      let now = new Date();
      let value = new Date(time);
      let options = { month: "short", day: "numeric" };
      if (value.getFullYear() !== now.getFullYear()) options.year = "numeric";
      return value.toLocaleDateString([], options);
    } catch {
      return "";
    }
  }

  function nte_history_format_full_date(timestamp) {
    let time = Number(timestamp) || 0;
    if (!(time > 0)) return "";
    try {
      return new Date(time).toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function nte_history_owner_name_key(name) {
    return String(name || "").trim().toLowerCase();
  }

  function get_history_authenticated_owner_context() {
    let meta = document.querySelector('meta[name="user-data"]');
    return {
      id: String(parseInt(meta?.getAttribute("data-userid") || 0, 10) || ""),
      name: meta?.getAttribute("data-displayname")?.trim() || meta?.getAttribute("data-name")?.trim() || "You",
      allowHistoryFallback: false,
    };
  }

  function get_history_blank_owner_context() {
    return {
      id: "",
      name: "",
      allowHistoryFallback: false,
    };
  }

  function get_history_partner_owner_context(row) {
    return {
      id: String(get_selected_trade_partner_id(row) || ""),
      name: get_history_trade_partner_name(row),
      allowHistoryFallback: true,
    };
  }

  function get_history_current_item_owner_context(row, item_side = "partner") {
    let tab = get_current_trade_tab();
    if (tab === "inactive") return get_history_blank_owner_context();
    if (normalize_trade_history_item_side(item_side) === "self") {
      if (tab === "completed") return get_history_partner_owner_context(row);
      return { ...get_history_authenticated_owner_context(), allowHistoryFallback: true };
    }
    if (tab === "completed") return get_history_authenticated_owner_context();
    return get_history_partner_owner_context(row);
  }

  function get_trade_history_item_hold_meta(item, current_owner, mode) {
    if (mode === "asset") return null;

    let owner_id = String(current_owner?.id || "").trim();
    let owner_name = String(current_owner?.name || "").trim();
    let verified_hold_since = !!item?.holdVerified ? Number(item?.heldSince || 0) : 0;
    if (verified_hold_since > 0 && (owner_id || owner_name)) {
      let age = nte_history_format_age(verified_hold_since);
      let since = nte_history_format_hold_date(verified_hold_since);
      if (age || since) {
        let owner = owner_name || "current owner";
        let full_date = nte_history_format_full_date(verified_hold_since);
        let title = full_date ? `Held by ${owner} since ${full_date}` : `Held by ${owner}`;
        return { owner, age, since, title };
      }
    }

    let history = Array.isArray(item?.history)
      ? item.history
          .filter((entry) => Number(entry?.timestamp || 0) > 0)
          .slice()
          .sort((a, b) => Number(b?.timestamp || 0) - Number(a?.timestamp || 0))
      : [];
    let latest = history[0] || null;
    let latest_owner_id = String(latest?.ownerAfterId || "").trim();
    let latest_owner_name = String(latest?.ownerAfterName || "").trim();
    let owner_matches =
      !!latest &&
      ((owner_id && latest_owner_id === owner_id) ||
        (!owner_id &&
          owner_name &&
          latest_owner_name &&
          nte_history_owner_name_key(latest_owner_name) === nte_history_owner_name_key(owner_name)));
    let hold_since = current_owner?.allowHistoryFallback && owner_matches ? Number(latest?.timestamp || 0) : 0;
    if (!(hold_since > 0)) return null;

    let age = nte_history_format_age(hold_since);
    let since = nte_history_format_hold_date(hold_since);
    if (!age && !since) return null;

    let owner = owner_name || latest_owner_name || "current owner";
    let full_date = nte_history_format_full_date(hold_since);
    let title = full_date ? `Held by ${owner} since ${full_date}` : `Held by ${owner}`;
    return { owner, age, since, title };
  }

  function build_trade_history_offer_item_lookup(offer_items) {
    let lookup = { by_ciiid: {}, by_uaid: {}, by_asset: {} };
    for (let item of Array.isArray(offer_items) ? offer_items : []) {
      let ciiid = normalize_history_instance_id(item?.ciiid);
      let uaid = String(item?.userAssetId || item?.uaid || "").trim();
      let asset_id = String(item?.assetId || "").trim();
      if (ciiid && !lookup.by_ciiid[ciiid]) lookup.by_ciiid[ciiid] = item;
      if (uaid && !lookup.by_uaid[uaid]) lookup.by_uaid[uaid] = item;
      if (asset_id && !lookup.by_asset[asset_id]) lookup.by_asset[asset_id] = item;
    }
    return lookup;
  }

  function merge_trade_history_offer_item_state(items, offer_items) {
    let lookup = build_trade_history_offer_item_lookup(offer_items);
    return (Array.isArray(items) ? items : []).map((item) => {
      let ciiid = normalize_history_instance_id(item?.ciiid);
      let uaid = String(item?.uaid || "").trim();
      let asset_id = String(item?.assetId || "").trim();
      let source =
        (ciiid && lookup.by_ciiid[ciiid]) ||
        (uaid && lookup.by_uaid[uaid]) ||
        (asset_id && lookup.by_asset[asset_id]) ||
        null;
      let held_since = nte_history_extract_hold_since(item) || nte_history_extract_hold_since(source);
      let hold_verified = !!(item?.holdVerified || source?.holdVerified);
      if (held_since > 0 || hold_verified) {
        return { ...item, heldSince: held_since, holdVerified: hold_verified };
      }
      return item;
    });
  }

  function get_history_trade_partner_name(row) {
    return get_selected_trade_partner_name(row);
  }

  function normalize_history_instance_id(value) {
    return String(value || "").trim().toLowerCase();
  }

  function get_history_item_asset_id(card, cached_item = null) {
    let catalog_href =
      card?.querySelector('.item-card-caption a[href*="/catalog/"]')?.getAttribute("href") ||
      card?.querySelector('a[href*="/catalog/"]')?.getAttribute("href") ||
      "";
    let catalog_asset_id = parseInt(String(catalog_href).match(/\/catalog\/(\d+)/i)?.[1] || 0, 10) || 0;
    if (catalog_asset_id > 0) return catalog_asset_id;

    let target_id =
      parseInt(
        cached_item?.targetId ??
          cached_item?.itemTarget?.targetId ??
          cached_item?.assetId ??
          cached_item?.itemId ??
          cached_item?.item?.id ??
          cached_item?.asset?.id ??
          card?.querySelector("thumbnail-2d")?.getAttribute("thumbnail-target-id") ??
          card?.querySelector("[thumbnail-target-id]")?.getAttribute("thumbnail-target-id") ??
          0,
        10,
      ) || 0;
    let item_name =
      cached_item?.name ||
      cached_item?.itemName ||
      card?.querySelector(".item-card-name")?.textContent?.trim() ||
      "";
    let is_bundle =
      cached_item?.itemType === "Bundle" ||
      cached_item?.itemTarget?.itemType === "Bundle" ||
      !!(card?.querySelector('a[href*="/bundles/"]') || card?.querySelector('[thumbnail-type="BundleThumbnail"]'));
    if (target_id > 0 && typeof c?.resolveRolimonsItemId === "function") {
      let resolved_id = parseInt(c.resolveRolimonsItemId(target_id, item_name, is_bundle) || 0, 10) || 0;
      if (resolved_id > 0) return resolved_id;
    }

    let direct_value =
      cached_item?.assetId ??
      cached_item?.itemId ??
      cached_item?.item?.id ??
      cached_item?.asset?.id ??
      target_id;
    let asset_id = parseInt(direct_value || 0, 10) || 0;
    if (asset_id > 0) return asset_id;
    return 0;
  }

  function get_history_offer_items(item_side = "partner") {
    let items = [];
    let offer_el = get_history_offer_element(item_side);
    let cards = get_offer_collectible_cards(offer_el);
    let seen = new Set();
    let hold_verified = get_current_trade_tab() === "inbound" || get_current_trade_tab() === "outbound";

    for (let card of cards) {
      let ciiid = normalize_history_instance_id(card.getAttribute("data-collectibleiteminstanceid"));
      let cached_item = get_cached_search_item_from_el(card) || card.__nte_sales_item || null;
      let name_el =
        card.querySelector(".item-card-name span") ||
        card.querySelector(".item-card-name-link") ||
        card.querySelector(".item-card-name") ||
        card.querySelector(".text-overflow");
      let thumb_el = card.querySelector("thumbnail-2d img, .item-card-thumb img, img");
      let name = name_el?.textContent?.trim() || "Unknown Item";
      let thumb = thumb_el?.src || "";
      let dedupe_key = ciiid || `${name}|${thumb}`;
      if (seen.has(dedupe_key)) continue;
      seen.add(dedupe_key);
      let held_since = hold_verified ? nte_history_extract_hold_since(cached_item) : 0;
      items.push({
        name,
        thumb,
        ciiid,
        assetId: get_history_item_asset_id(card, cached_item),
        heldSince: held_since,
        holdVerified: !!(hold_verified && held_since > 0),
        userAssetId:
          parseInt(
            cached_item?.userAssetId ??
              cached_item?.userAsset?.id ??
              cached_item?.userAsset?.userAssetId ??
              cached_item?.id ??
              0,
            10,
          ) || 0,
      });
    }

    return items;
  }

  function resolve_history_asset_id_from_trade_item(raw_item, fallback_name = "") {
    let item = raw_item?.item || raw_item?.tradableItem || raw_item || null;
    if (!item || "object" !== typeof item) return 0;

    let item_type =
      item?.itemType ||
      item?.itemTarget?.itemType ||
      raw_item?.itemType ||
      raw_item?.itemTarget?.itemType ||
      "Asset";
    let target_id =
      parseInt(
        item?.assetId ??
          item?.targetId ??
          item?.itemTarget?.targetId ??
          item?.bundleId ??
          raw_item?.assetId ??
          raw_item?.targetId ??
          raw_item?.itemTarget?.targetId ??
          raw_item?.bundleId ??
          0,
        10,
      ) || 0;
    let item_name =
      item?.itemName ||
      item?.name ||
      raw_item?.itemName ||
      raw_item?.name ||
      fallback_name ||
      "";

    if (target_id > 0 && typeof c?.resolveRolimonsItemId === "function") {
      let resolved_id = parseInt(c.resolveRolimonsItemId(target_id, item_name, item_type === "Bundle") || 0, 10) || 0;
      if (resolved_id > 0) return resolved_id;
    }

    if (item_type !== "Bundle" && target_id > 0) return target_id;
    return 0;
  }

  async function fetch_history_user_asset_map_from_tradable(user_id, wanted_instance_ids) {
    let wanted = new Set((wanted_instance_ids || []).map(normalize_history_instance_id).filter(Boolean));
    let found = {};
    if (!(Number(user_id) > 0) || !wanted.size) return found;

    let cursor = "";
    for (let page = 0; page < 40; page++) {
      let params = new URLSearchParams({ sortBy: "CreationTime", cursor, limit: "100", sortOrder: "Desc" });
      let resp;
      try {
        resp = await fetch(`https://trades.roblox.com/v2/users/${user_id}/tradableitems?${params.toString()}`, { credentials: "include" });
      } catch {
        break;
      }
      if (!resp.ok) break;

      let json = await resp.json().catch(() => null);
      if (!json) break;

      let page_items = Array.isArray(json?.items) ? json.items : Array.isArray(json?.data) ? json.data : [];
      for (let item of page_items) {
        let instances = Array.isArray(item?.instances) && item.instances.length ? item.instances : [item];
        for (let inst of instances) {
          let instance_id = normalize_history_instance_id(
            inst?.collectibleItemInstanceId ||
            item?.collectibleItemInstanceId ||
            inst?.collectibleItemInstance?.collectibleItemInstanceId ||
            item?.collectibleItemInstance?.collectibleItemInstanceId,
          );
          if (!instance_id || !wanted.has(instance_id)) continue;
          let user_asset_id =
            parseInt(inst?.userAssetId ?? item?.userAssetId ?? 0, 10) ||
            parseInt(inst?.userAsset?.id ?? item?.userAsset?.id ?? 0, 10) ||
            parseInt(inst?.userAsset?.userAssetId ?? item?.userAsset?.userAssetId ?? 0, 10) ||
            parseInt(inst?.id ?? item?.id ?? 0, 10) ||
            0;
          let held_since = nte_history_extract_hold_since(inst) || nte_history_extract_hold_since(item);
          if (user_asset_id > 0 || held_since > 0)
            found[instance_id] = { userAssetId: user_asset_id, heldSince: held_since, holdVerified: held_since > 0 };
        }
      }

      if (wanted.size === Object.keys(found).length) break;
      cursor = json?.nextPageCursor || "";
      if (!cursor) break;
    }

    return found;
  }

  async function fetch_history_bridge_asset_map(wanted_instance_ids) {
    let wanted = new Set((wanted_instance_ids || []).map(normalize_history_instance_id).filter(Boolean));
    let found = {};
    if (!wanted.size) return found;

    let result = await run_custom_trade_bridge_action("getDetailTradeItems", {
      timeout_ms: 2200,
    }).catch(() => null);

    for (let entry of Array.isArray(result?.items) ? result.items : []) {
      let instance_id = normalize_history_instance_id(
        entry?.collectibleItemInstanceId ||
        entry?.item?.collectibleItemInstanceId ||
        entry?.item?.collectibleItemInstance?.collectibleItemInstanceId,
      );
      if (!instance_id || !wanted.has(instance_id)) continue;

      let user_asset_id =
        parseInt(entry?.userAssetId ?? 0, 10) ||
        parseInt(entry?.item?.userAssetId ?? 0, 10) ||
        parseInt(entry?.item?.userAsset?.id ?? 0, 10) ||
        parseInt(entry?.item?.userAsset?.userAssetId ?? 0, 10) ||
        parseInt(entry?.id ?? 0, 10) ||
        parseInt(entry?.item?.id ?? 0, 10) ||
        0;
      if (user_asset_id > 0) found[instance_id] = user_asset_id;
    }

    return found;
  }

  async function fetch_history_bridge_item_map(wanted_instance_ids) {
    let wanted = new Set((wanted_instance_ids || []).map(normalize_history_instance_id).filter(Boolean));
    let found = {};
    if (!wanted.size) return found;

    let result = await run_custom_trade_bridge_action("getDetailTradeItems", {
      timeout_ms: 2200,
    }).catch(() => null);

    for (let entry of Array.isArray(result?.items) ? result.items : []) {
      let instance_id = normalize_history_instance_id(
        entry?.collectibleItemInstanceId ||
        entry?.item?.collectibleItemInstanceId ||
        entry?.item?.collectibleItemInstance?.collectibleItemInstanceId,
      );
      if (!instance_id || !wanted.has(instance_id)) continue;

      let user_asset_id =
        parseInt(entry?.userAssetId ?? 0, 10) ||
        parseInt(entry?.item?.userAssetId ?? 0, 10) ||
        parseInt(entry?.item?.userAsset?.id ?? 0, 10) ||
        parseInt(entry?.item?.userAsset?.userAssetId ?? 0, 10) ||
        parseInt(entry?.id ?? 0, 10) ||
        parseInt(entry?.item?.id ?? 0, 10) ||
        0;

      found[instance_id] = {
        userAssetId: user_asset_id,
        assetId: resolve_history_asset_id_from_trade_item(entry, entry?.item?.itemName || entry?.item?.name || ""),
        heldSince: nte_history_extract_hold_since(entry) || nte_history_extract_hold_since(entry?.item),
        holdVerified: get_current_trade_tab() === "inbound" || get_current_trade_tab() === "outbound",
      };
    }

    return found;
  }

  async function fetch_history_user_asset_map_from_inventory(user_id, wanted_instance_ids) {
    let wanted = new Set((wanted_instance_ids || []).map(normalize_history_instance_id).filter(Boolean));
    let found = {};
    if (!(Number(user_id) > 0) || !wanted.size) return found;

    let cursor = "";
    for (let page = 0; page < 40; page++) {
      let url = `https://inventory.roblox.com/v1/users/${user_id}/assets/collectibles?limit=100&sortOrder=Asc`;
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
      let resp;
      try {
        resp = await fetch(url, { credentials: "include" });
      } catch {
        break;
      }
      if (!resp.ok) break;

      let json = await resp.json().catch(() => null);
      if (!json) break;

      for (let item of Array.isArray(json?.data) ? json.data : []) {
        let instance_id = normalize_history_instance_id(
          item?.collectibleItemInstanceId ||
          item?.collectibleItemInstance?.collectibleItemInstanceId ||
          item?.collectibleItemInstance?.id,
        );
        if (!instance_id || !wanted.has(instance_id)) continue;
        let user_asset_id =
          parseInt(item?.userAssetId ?? 0, 10) ||
          parseInt(item?.userAsset?.id ?? 0, 10) ||
          parseInt(item?.userAsset?.userAssetId ?? 0, 10) ||
          parseInt(item?.id ?? 0, 10) ||
          0;
        let held_since = nte_history_extract_hold_since(item);
        if (user_asset_id > 0 || held_since > 0)
          found[instance_id] = { userAssetId: user_asset_id, heldSince: held_since, holdVerified: held_since > 0 };
      }

      if (wanted.size === Object.keys(found).length) break;
      cursor = json?.nextPageCursor || "";
      if (!cursor) break;
    }

    return found;
  }

  async function fetch_history_owner_asset_map(user_id, instance_ids) {
    let owner_id = String(user_id || "").trim();
    let wanted = [...new Set((instance_ids || []).map(normalize_history_instance_id).filter(Boolean))];
    if (!/^\d+$/.test(owner_id) || !wanted.length) return {};

    let cache = nte_history_owner_asset_cache[owner_id];
    if (cache && cache.ts > Date.now() - 120000) {
      let cached_hits = {};
      for (let instance_id of wanted) {
        if (cache.map?.[instance_id]) cached_hits[instance_id] = cache.map[instance_id];
      }
      if (cache.complete || Object.keys(cached_hits).length === wanted.length) return cached_hits;
    }

    let merged = { ...(cache?.map || {}) };
    Object.assign(merged, await fetch_history_user_asset_map_from_tradable(owner_id, wanted));

    let missing = wanted.filter((instance_id) => !merged[instance_id]);
    if (missing.length) {
      Object.assign(merged, await fetch_history_user_asset_map_from_inventory(owner_id, missing));
    }

    nte_history_owner_asset_cache[owner_id] = {
      ts: Date.now(),
      complete: !wanted.some((instance_id) => !merged[instance_id]),
      map: merged,
    };

    let out = {};
    for (let instance_id of wanted) {
      if (merged[instance_id]) out[instance_id] = merged[instance_id];
    }
    return out;
  }

  async function get_history_trade_id() {
    let row = document.querySelector(".trade-row.selected");
    if (!row) return "";
    let trade_id = get_selected_trade_id_sync(row);
    if (!trade_id) prime_trade_row_id(row);
    if (trade_id) return trade_id;
    return (await J(row, 40)) || "";
  }

  async function get_history_offer_items_enriched(row = document.querySelector(".trade-row.selected"), item_side = "partner") {
    let items = get_history_offer_items(item_side);
    if (!items.length) return items;

    let instance_ids = items.map((item) => item.ciiid).filter(Boolean);
    if (instance_ids.length) {
      let bridge_item_map = await fetch_history_bridge_item_map(instance_ids).catch(() => ({}));
      let bridge_asset_map = await fetch_history_bridge_asset_map(instance_ids).catch(() => ({}));
      items = items.map((item) => ({
        ...item,
        heldSince:
          item.heldSince ||
          bridge_item_map[normalize_history_instance_id(item.ciiid)]?.heldSince ||
          0,
        holdVerified:
          item.holdVerified ||
          bridge_item_map[normalize_history_instance_id(item.ciiid)]?.holdVerified ||
          false,
      }));
      items = items.map((item) => ({
        ...item,
        userAssetId:
          item.userAssetId ||
          bridge_item_map[normalize_history_instance_id(item.ciiid)]?.userAssetId ||
          bridge_asset_map[normalize_history_instance_id(item.ciiid)] ||
          0,
        assetId:
          item.assetId ||
          bridge_item_map[normalize_history_instance_id(item.ciiid)]?.assetId ||
          0,
      }));
      if (items.every((item) => !item.ciiid || (Number(item.userAssetId) > 0 && Number(item.assetId) > 0))) return items;
    }

    let owner_id = get_history_current_item_owner_context(row, item_side).id;
    if (owner_id && instance_ids.length) {
      let owner_asset_map = await fetch_history_owner_asset_map(owner_id, instance_ids).catch(() => ({}));
      items = items.map((item) => ({
        ...item,
        heldSince: item.heldSince || owner_asset_map[normalize_history_instance_id(item.ciiid)]?.heldSince || 0,
        holdVerified: item.holdVerified || owner_asset_map[normalize_history_instance_id(item.ciiid)]?.holdVerified || false,
        userAssetId: item.userAssetId || owner_asset_map[normalize_history_instance_id(item.ciiid)]?.userAssetId || 0,
      }));
      if (items.every((item) => !item.ciiid || Number(item.userAssetId) > 0)) return items;
    }

    let trade_id = await get_history_trade_id();
    if (!trade_id) return items;

    let flat = [];
    let detail = await K(trade_id).catch(() => null);
    if (Array.isArray(detail?.offers)) {
      for (let offer of detail.offers) {
        flat.push(...(Array.isArray(offer?.items) ? offer.items : []));
      }
    }

    if (!flat.length) {
      let raw = null;
      try {
        let resp = await fetch_trade_api(`https://trades.roblox.com/v2/trades/${trade_id}`, { credentials: "include" });
        if (resp.ok) raw = await resp.json();
        if (!raw) {
          let fallback = await fetch_trade_api(`https://trades.roblox.com/v1/trades/${trade_id}`, { credentials: "include" });
          if (fallback.ok) raw = await fallback.json();
        }
      } catch {}

      if (Array.isArray(raw?.offers)) {
        for (let offer of raw.offers) flat.push(...X(offer));
      } else {
        if (raw?.participantAOffer) flat.push(...X(raw.participantAOffer));
        if (raw?.participantBOffer) flat.push(...X(raw.participantBOffer));
      }
    }

    let by_ciiid = new Map();
    for (let entry of flat) {
      let ciiid = normalize_history_instance_id(
        entry.collectibleItemInstanceId || entry.collectibleItemInstance?.collectibleItemInstanceId,
      );
      if (!ciiid) continue;
      let user_asset_id =
        parseInt(entry.userAssetId, 10) ||
        parseInt(entry.userAsset?.id, 10) ||
        parseInt(entry.userAsset?.userAssetId, 10) ||
        parseInt(entry.id, 10) ||
        0;
      let current = by_ciiid.get(String(ciiid)) || {};
      let asset_id = resolve_history_asset_id_from_trade_item(entry, entry?.itemName || entry?.name || "");
      if (user_asset_id > 0 || asset_id > 0) {
        by_ciiid.set(String(ciiid), {
          userAssetId: user_asset_id || current.userAssetId || 0,
          assetId: asset_id || current.assetId || 0,
        });
      }
    }

    return items.map((item) => ({
      ...item,
      userAssetId:
        item.userAssetId ||
        (item.ciiid ? by_ciiid.get(normalize_history_instance_id(item.ciiid))?.userAssetId || 0 : 0),
      assetId:
        item.assetId ||
        (item.ciiid ? by_ciiid.get(normalize_history_instance_id(item.ciiid))?.assetId || 0 : 0),
    }));
  }

  function nte_history_state_key() {
    let row = document.querySelector(".trade-row.selected");
    let trade_id = get_selected_trade_id_sync(row) || "";
    let partner_id =
      get_selected_trade_partner_id(row) ||
      String(typeof get_trade_partner_id === "function" ? get_trade_partner_id() || "" : "");
    let their_card_signature = get_offer_collectible_cards(get_history_offer_element("partner"))
      .map((card) => card.getAttribute("data-collectibleiteminstanceid") || "")
      .join("|");
    let your_card_signature = get_offer_collectible_cards(get_history_offer_element("self"))
      .map((card) => card.getAttribute("data-collectibleiteminstanceid") || "")
      .join("|");
    let trade_tab = typeof get_trade_tab === "function" ? get_trade_tab() || "trade" : "trade";
    return `${trade_tab}:${trade_id}:${partner_id}:${their_card_signature}:${your_card_signature}`;
  }

  function nte_history_action_visible(el) {
    return el && !el.classList.contains("ng-hide") && el.offsetParent !== null;
  }

  function ensure_trade_history_container() {
    for (let sel of ['[ng-click="acceptTrade(data.trade)"]', '[ng-click="counterTrade(data.trade)"]', '[ng-click="declineTrade(data.trade)"]']) {
      let el = document.querySelector(sel);
      if (nte_history_action_visible(el)) {
        let row = el.closest(".trade-buttons");
        if (row) return { el: row, synthetic: false };
      }
    }

    let shared_poison_row = document.querySelector(".trades-container .nte-poison-fallback-row");
    if (shared_poison_row) {
      return { el: shared_poison_row, synthetic: true };
    }

    if (!document.querySelector(".trade-row.selected")) return null;
    let offers = document.querySelectorAll(".trades-container .trade-list-detail-offer");
    if (offers.length < 2) offers = document.querySelectorAll(".trade-list-detail-offer");
    if (offers.length < 2) return null;

    let last = offers[offers.length - 1];
    let existing = document.querySelector(".trades-container .nte-history-fallback-row");
    if (existing) {
      if (last.nextElementSibling !== existing) last.insertAdjacentElement("afterend", existing);
      return { el: existing, synthetic: true };
    }

    let row = document.createElement("div");
    row.className = "nte-history-fallback-row";
    row.setAttribute("data-nte-history-fallback", "1");
    last.insertAdjacentElement("afterend", row);
    return { el: row, synthetic: true };
  }

  function find_trade_history_reference_button(container) {
    let buttons = [
      container?.querySelector('button.btn-control-md[ng-click*="declineTrade"]'),
      container?.querySelector("button.btn-control-md"),
      container?.querySelector("button.btn-cta-md"),
      document.querySelector('button.btn-control-md[ng-click*="declineTrade"]'),
      document.querySelector(".trade-buttons button.btn-control-md"),
      document.querySelector(".trade-buttons button.btn-cta-md"),
    ];
    return buttons.find((btn) => btn && !btn.classList.contains("ng-hide")) || null;
  }

  function create_trade_history_button(reference) {
    let btn = reference ? reference.cloneNode(true) : document.createElement("button");
    btn.type = "button";
    btn.removeAttribute("ng-bind");
    btn.removeAttribute("ng-click");
    btn.removeAttribute("ng-show");
    btn.removeAttribute("ng-disabled");
    btn.removeAttribute("disabled");
    btn.className = String(btn.className || "")
      .replace(/\bng-hide\b/g, "")
      .trim();
    btn.classList.remove("btn-cta-md");
    btn.classList.add("btn-control-md", "nte-history-btn");
    btn.onclick = () => run_trade_history(btn);
    nte_history_set_btn_idle(btn);
    return btn;
  }

  function nte_history_set_btn_idle(btn) {
    btn.disabled = false;
    btn.__nte_history_open = false;
    btn.classList.remove("nte-history-btn--loading", "nte-history-btn--active");
    btn.innerHTML = '<span class="nte-history-btn-inner"><span class="nte-history-btn-label">History</span></span>';
    btn.setAttribute("aria-label", "View item trade history");
    btn.title = "View item trade history";
  }

  function nte_history_set_btn_loading(btn) {
    btn.disabled = true;
    btn.classList.remove("nte-history-btn--active");
    btn.classList.add("nte-history-btn--loading");
    btn.innerHTML = '<span class="nte-history-btn-inner"><span class="nte-history-btn-spinner"></span><span class="nte-history-btn-label">Thinking</span></span>';
    btn.setAttribute("aria-label", "Loading item trade history");
    btn.title = "Loading item trade history";
  }

  function nte_history_set_btn_active(btn) {
    btn.disabled = false;
    btn.__nte_history_open = true;
    btn.classList.remove("nte-history-btn--loading");
    btn.classList.add("nte-history-btn--active");
    btn.innerHTML = '<span class="nte-history-btn-inner"><span class="nte-history-btn-label">History</span></span>';
    btn.setAttribute("aria-label", "Hide item trade history");
    btn.title = "Hide item trade history";
  }

  function get_analyze_trade_feature() {
    if (nte_analyze_trade_feature) return nte_analyze_trade_feature;
    if (typeof window.nte_create_analyze_trade_feature !== "function") return null;
    nte_analyze_trade_feature = window.nte_create_analyze_trade_feature({
      esc: nte_history_esc,
      attr_esc: nte_history_attr_esc,
      send_message: nte_send_message,
      assert_dominance: assert_trade_page_dominance,
      set_history_btn_idle: nte_history_set_btn_idle,
      inject_history_styles: inject_trade_history_styles,
      get_container_from_button: get_trade_history_container_from_button,
      get_state_key: nte_history_state_key,
      get_offer_items_enriched: get_history_offer_items_enriched,
      get_offer_items: get_history_offer_items,
      get_offer_element: get_history_offer_element,
      get_robux_total: get_trade_offer_robux_total,
    });
    return nte_analyze_trade_feature;
  }

  function create_analyze_trade_button(reference) {
    let feature = get_analyze_trade_feature();
    return feature ? feature.create_button(reference) : null;
  }

  function close_analyze_trade_modal(btn) {
    let feature = get_analyze_trade_feature();
    if (feature) feature.close(btn);
  }

  function clear_trade_history_ui(remove_buttons = true) {
    close_analyze_trade_modal(null);
    document.querySelectorAll(".nte-history-panel").forEach((el) => el.remove());
    if (remove_buttons) {
      document.querySelectorAll(".nte-history-btn").forEach((el) => el.remove());
      document.querySelectorAll(".nte-analyze-trade-btn").forEach((el) => el.remove());
      document.querySelectorAll(".nte-history-fallback-row").forEach((el) => el.remove());
    }
  }

  function get_trade_history_container_from_button(btn) {
    let container = btn?.closest?.(".trade-buttons, .nte-history-fallback-row, .nte-poison-fallback-row");
    if (!container) return ensure_trade_history_container();
    return {
      el: container,
      synthetic: !container.classList.contains("trade-buttons"),
    };
  }

  function get_trade_history_panel(container_info) {
    close_analyze_trade_modal(null);
    document.querySelectorAll(".nte-history-panel").forEach((el) => el.remove());
    let panel = document.createElement("div");
    panel.className = "nte-history-panel";
    container_info.el.insertAdjacentElement("afterend", panel);
    assert_trade_page_dominance();
    return panel;
  }

  function get_trade_history_loading_copy(mode, item_side = "partner") {
    let side_copy = get_trade_history_side_copy(item_side);
    return mode === "asset"
      ? `Scanning recent trades across all copies of the items on ${side_copy.scope_label} of this deal.`
      : `Pulling recorded trades for each specific copy on ${side_copy.scope_label} of this deal.`;
  }

  function get_trade_history_panel_title(row, item_side = "partner") {
    if (normalize_trade_history_item_side(item_side) === "self") return "History for your items";
    return `History for ${get_history_trade_partner_name(row)}`;
  }

  function get_trade_history_result_copy(mode, item_side, found_count, total_count) {
    let side_copy = get_trade_history_side_copy(item_side);
    let count_copy = `${found_count}/${total_count || 0} item${total_count === 1 ? "" : "s"}`;
    return mode === "asset"
      ? `Found database matches for ${count_copy} across all copies on ${side_copy.scope_label}.`
      : `Found database matches for ${count_copy} on ${side_copy.scope_label} in this trade.`;
  }

  function render_trade_history_loading(panel, items, mode = "uaid", item_side = "partner") {
    let cards = (items || []).slice(0, 3);
    if (!cards.length) cards = [{}];
    panel.className = "nte-history-panel";
    panel.innerHTML = `
      <div class="nte-history-head">
        <div>
          <div class="nte-history-title">Item history</div>
          <div class="nte-history-sub">${get_trade_history_loading_copy(mode, item_side)}</div>
        </div>
        ${render_trade_history_head_actions(mode, item_side)}
      </div>
      <div class="nte-history-loading-grid">
        ${cards
          .map(
            () => `
            <div class="nte-history-loading-card">
              <div class="nte-history-item-top">
                <div class="nte-history-skel nte-history-skel-thumb"></div>
                <div class="nte-history-item-copy">
                  <div class="nte-history-skel nte-history-skel-line is-wide"></div>
                  <div class="nte-history-skel nte-history-skel-line is-mid"></div>
                </div>
              </div>
            </div>`,
          )
          .join("")}
      </div>
    `;
  }

  function render_trade_history_error(panel, btn, message) {
    panel.className = "nte-history-panel nte-history-panel--error";
    panel.innerHTML = `
      <div class="nte-history-head">
        <div>
          <div class="nte-history-title">History unavailable</div>
          <div class="nte-history-sub">${nte_history_esc(message || "Could not load trade history right now.")}</div>
        </div>
        <button type="button" class="nte-history-close">Close</button>
      </div>
    `;
    let close_btn = panel.querySelector(".nte-history-close");
    if (close_btn) {
      close_btn.onclick = () => {
        panel.remove();
        nte_history_set_btn_idle(btn);
      };
    }
    nte_history_set_btn_active(btn);
  }

  function render_trade_history_entry(entry, focus_item, current_partner_id, mode) {
    let flow = `${nte_history_profile_html(entry.ownerBeforeId, entry.ownerBeforeName, current_partner_id)}<span class="nte-history-arrow">&rarr;</span>${nte_history_profile_html(entry.ownerAfterId, entry.ownerAfterName, current_partner_id)}`;
    let meta = `Trade completed &bull; Trade #${nte_history_esc(entry.tradeId)}`;
    let has_trade = !!(entry?.trade && (Array.isArray(entry.trade.offer) || Array.isArray(entry.trade.request)));
    let pills_html = render_trade_history_entry_pills(entry, mode);
    let toggle_html = has_trade
      ? `<button type="button" class="nte-history-entry-toggle" aria-expanded="false"><span class="nte-history-entry-toggle-label">Show trade</span><span class="nte-history-entry-toggle-chevron">&rsaquo;</span></button>`
      : "";
    return `
      <div class="nte-history-entry">
        <div class="nte-history-entry-top">
          <div class="nte-history-entry-main">
            <div class="nte-history-entry-flow">${flow}</div>
            <div class="nte-history-entry-meta-row"><div class="nte-history-entry-meta">${meta}</div>${pills_html}</div>
          </div>
          <div class="nte-history-entry-side">
            <div class="nte-history-entry-time">${nte_history_esc(nte_history_format_date(entry.timestamp))}<br>${nte_history_esc(nte_history_format_age(entry.timestamp))}</div>
            ${toggle_html}
          </div>
        </div>
        ${has_trade ? render_trade_history_trade_card(entry.trade, entry, focus_item, current_partner_id, mode) : ""}
      </div>
    `;
  }

  function render_trade_history_item(item, current_partner_id, current_owner, use_item_toggle, mode) {
    let proof_name = String(item?.name || "").trim();
    let proof_asset_id = String(item?.assetId || "").trim();
    let can_view_proofs = !!(proof_name || /^\d+$/.test(proof_asset_id));
    let hold_meta = get_trade_history_item_hold_meta(item, current_owner, mode);
    let thumb_html = item.thumb
      ? `<img class="nte-history-thumb" src="${nte_history_esc(item.thumb)}" alt="">`
      : `<div class="nte-history-thumb nte-history-thumb--empty">?</div>`;
    let trade_count = Number(item.tradeCount || 0);
    let pills = [];
    pills.push(`<span class="nte-history-pill">${trade_count} trade${trade_count === 1 ? "" : "s"}</span>`);
    if (mode === "asset") {
      pills.push('<span class="nte-history-pill is-note">All copies</span>');
      if (Number(item.tradeItemCount || 0) > 1) {
        pills.push(`<span class="nte-history-pill is-note">${nte_history_esc(item.tradeItemCount)} in this trade</span>`);
      }
      if (item.missingAssetId) pills.push('<span class="nte-history-pill is-muted">Asset id missing</span>');
    } else {
      if (item.known) pills.push('<span class="nte-history-pill is-good">Known UAID</span>');
      if (item.missingUaid) pills.push('<span class="nte-history-pill is-muted">UAID missing</span>');
    }
    let link_html = mode === "asset"
      ? item.assetId
        ? `<div class="nte-history-item-link"><a href="https://www.rolimons.com/item/${nte_history_esc(item.assetId)}" target="_blank" rel="noopener noreferrer">Open item on Rolimons</a></div>`
        : ""
      : item.uaid
        ? `<div class="nte-history-item-link"><a href="https://www.rolimons.com/uaid/${nte_history_esc(item.uaid)}" target="_blank" rel="noopener noreferrer">Open UAID on Rolimons</a></div>`
        : "";
    let body_html = "";
    if (mode === "asset" && item.missingAssetId) {
      body_html = '<div class="nte-history-empty">Could not resolve this item asset id from Roblox trade data yet, so all-copy history cannot be searched.</div>';
    } else if (mode !== "asset" && item.missingUaid) {
      body_html = '<div class="nte-history-empty">Could not resolve this item instance from Roblox trade data, so there is nothing reliable to search yet.</div>';
    } else if (!trade_count) {
      body_html = `<div class="nte-history-empty">${mode === "asset" ? "No recorded trade history for this item across all copies in the local database yet." : "No recorded trade history for this UAID in the local database yet."}</div>`;
    } else {
      body_html = `<div class="nte-history-list">${(item.history || []).map((entry) => render_trade_history_entry(entry, item, current_partner_id, mode)).join("")}</div>`;
    }
    let toggle_html = use_item_toggle
      ? `<button type="button" class="nte-history-item-toggle" aria-expanded="false"><span class="nte-history-item-toggle-label">Show history</span><span class="nte-history-item-toggle-chevron">&rsaquo;</span></button>`
      : "";
    return `
      <section class="nte-history-item">
        <div class="nte-history-item-top">
          ${thumb_html}
          <div class="nte-history-item-copy">
            <div class="nte-history-item-name-row">
              <div class="nte-history-item-name">${nte_history_esc(item.name || "Unknown Item")}</div>
              ${
                can_view_proofs
                  ? `<button type="button" class="nte-history-proof-btn" data-proof-name="${nte_history_attr_esc(proof_name)}" data-proof-asset-id="${nte_history_attr_esc(proof_asset_id)}" aria-expanded="false"><span class="nte-history-proof-btn-label">View Proofs</span></button>`
                  : ""
              }
            </div>
            <div class="nte-history-item-meta">${pills.join("")}</div>
            ${
              hold_meta
                ? `<div class="nte-history-item-held" title="${nte_history_attr_esc(hold_meta.title)}"><span class="nte-history-item-held-copy">Held by ${nte_history_esc(hold_meta.owner)}${hold_meta.since ? ` since ${nte_history_esc(hold_meta.since)}` : ""}</span>${hold_meta.age ? `<span class="nte-history-item-held-age">${nte_history_esc(hold_meta.age)}</span>` : ""}</div>`
                : ""
            }
            ${link_html}
          </div>
        </div>
        ${toggle_html}
        <div class="nte-history-item-body"${use_item_toggle ? " hidden" : ""}>
          ${can_view_proofs ? '<div class="nte-history-proof-slot" hidden></div>' : ""}
          ${body_html}
        </div>
      </section>
    `;
  }

  function render_trade_history_panel(panel, btn, data, row, mode, item_side, offer_items, limit) {
    let items = merge_trade_history_offer_item_state(data?.items, offer_items);
    let current_partner_id = get_selected_trade_partner_id(row) || "";
    let current_owner = get_history_current_item_owner_context(row, item_side);
    let side_copy = get_trade_history_side_copy(item_side);
    let use_item_toggle = items.length > 1;
    let found_count = items.filter((item) => Number(item.tradeCount || 0) > 0).length;
    let sub_text = get_trade_history_result_copy(mode, item_side, found_count, items.length);
    let empty_text = `No collectible items found on ${side_copy.scope_label} of this trade.`;
    panel.className = "nte-history-panel";
    panel.dataset.nteHistoryMultiItem = use_item_toggle ? "1" : "0";
    panel.innerHTML = `
      ${render_trade_history_close_button()}
      <div class="nte-history-head">
        <div>
          <div class="nte-history-title">${nte_history_esc(get_trade_history_panel_title(row, item_side))}</div>
          <div class="nte-history-sub">${sub_text}</div>
        </div>
        ${render_trade_history_head_actions(mode, item_side)}
      </div>
      <div class="nte-history-grid">
        ${items.length ? items.map((item) => render_trade_history_item(item, current_partner_id, current_owner, use_item_toggle, mode)).join("") : `<div class="nte-history-empty">${empty_text}</div>`}
      </div>
      ${render_trade_history_more_button(items, mode, use_item_toggle)}
    `;
    let close_btn = panel.querySelector(".nte-history-close");
    if (close_btn) {
      close_btn.onclick = () => {
        panel.remove();
        nte_history_set_btn_idle(btn);
      };
    }
    attach_trade_history_controls(panel, btn, row, offer_items, mode, item_side);
    attach_trade_history_more_button(panel, btn, row, offer_items, mode, item_side, limit);
    attach_trade_history_item_toggles(panel);
    attach_trade_history_proof_buttons(panel);
    attach_trade_history_entry_toggles(panel);
    nte_history_set_btn_active(btn);
  }

  async function run_trade_history(btn, options = {}) {
    await sync_trade_profit_mode();
    inject_trade_history_styles();
    let container_info = get_trade_history_container_from_button(btn);
    if (!container_info) return;

    let requested_row = options?.row || document.querySelector(".trade-row.selected");
    let state_key = nte_history_state_key();
    let cache = btn.__nte_history_cache;
    if (!cache || cache.key !== state_key) {
      cache = {
        key: state_key,
        offer_items_by_side: {},
        data_by_key: {},
        limit_by_key: {
          "partner:uaid": 6,
          "partner:asset": 6,
          "self:uaid": 6,
          "self:asset": 6,
        },
      };
      btn.__nte_history_cache = cache;
      btn.__nte_history_mode = "uaid";
      btn.__nte_history_item_side = "partner";
    }

    let item_side = normalize_trade_history_item_side(options?.item_side || btn.__nte_history_item_side || "partner");
    let mode = options?.mode === "asset" ? "asset" : options?.mode === "uaid" ? "uaid" : btn.__nte_history_mode || "uaid";
    let limit_key = `${item_side}:${mode}`;
    let limit = Math.max(1, Math.min(20, Number(options?.limit) || Number(cache.limit_by_key?.[limit_key]) || 6));
    let current_panel = document.querySelector(".nte-history-panel");
    if (
      (options?.close_if_same ?? true) &&
      btn.__nte_history_open &&
      current_panel &&
      btn.__nte_history_key === state_key &&
      btn.__nte_history_mode === mode &&
      btn.__nte_history_item_side === item_side
    ) {
      current_panel.remove();
      nte_history_set_btn_idle(btn);
      return;
    }

    let panel = get_trade_history_panel(container_info);
    btn.__nte_history_key = state_key;
    btn.__nte_history_mode = mode;
    btn.__nte_history_item_side = item_side;
    cache.limit_by_key[limit_key] = limit;
    nte_history_set_btn_loading(btn);
    render_trade_history_loading(panel, [], mode, item_side);

    let request_token = ++nte_history_request_token;

    try {
      let row = requested_row || document.querySelector(".trade-row.selected");
      let offer_items = Array.isArray(options?.offer_items) ? options.offer_items : cache.offer_items_by_side?.[item_side];
      if (Array.isArray(options?.offer_items)) cache.offer_items_by_side[item_side] = options.offer_items;
      if (!offer_items) {
        offer_items = await get_history_offer_items_enriched(row, item_side).catch(() => get_history_offer_items(item_side));
        cache.offer_items_by_side[item_side] = offer_items;
      }
      if (request_token !== nte_history_request_token) return;
      render_trade_history_loading(panel, offer_items, mode, item_side);
      let cache_key = `${item_side}:${mode}:${limit}`;
      let data = cache.data_by_key?.[cache_key];
      if (!data) {
        data = await new Promise((resolve) => {
          nte_send_message(
            {
              type: "getTradeHistory",
              offerItems: offer_items,
              limit,
              scope: mode,
            },
            resolve,
          );
        });
        if (data?.success) cache.data_by_key[cache_key] = data;
      }
      if (request_token !== nte_history_request_token) return;
      if (!data || !data.success) {
        render_trade_history_error(panel, btn, data?.error || "Could not load trade history right now.");
        return;
      }
      render_trade_history_panel(panel, btn, data, row, mode, item_side, offer_items, limit);
    } catch (err) {
      if (request_token !== nte_history_request_token) return;
      render_trade_history_error(panel, btn, err?.message || "Could not load trade history right now.");
    }
  }

  async function inject_trade_history_button() {
    if ("details" !== c.getPageType()) {
      clear_trade_history_ui();
      return;
    }

    inject_trade_history_styles();

    let container_info = ensure_trade_history_container();
    if (!container_info) {
      clear_trade_history_ui();
      return;
    }

    if (!container_info.synthetic) {
      document.querySelectorAll(".nte-history-fallback-row").forEach((el) => el.remove());
    }

    let key = nte_history_state_key();
    if (key !== nte_history_last_key) {
      nte_history_last_key = key;
      document.querySelectorAll(".nte-history-btn").forEach((el) => el.remove());
      document.querySelectorAll(".nte-analyze-trade-btn").forEach((el) => el.remove());
      document.querySelectorAll(".nte-history-panel").forEach((el) => el.remove());
      close_analyze_trade_modal(null);
    }

    let container = container_info.el;
    let reference = find_trade_history_reference_button(container);
    if (!container.querySelector(".nte-history-btn")) {
      let btn = create_trade_history_button(reference);
      container.appendChild(btn);
      sync_trade_button_position(btn);
    }

    let analyze_enabled = false !== (await c.getOption("Analyze Trade"));
    if (!analyze_enabled) {
      container.querySelectorAll(".nte-analyze-trade-btn").forEach((el) => el.remove());
      close_analyze_trade_modal(null);
      assert_trade_page_dominance();
      return;
    }

    if (!container.querySelector(".nte-analyze-trade-btn")) {
      let btn = create_analyze_trade_button(reference);
      if (btn) {
        container.appendChild(btn);
        sync_trade_button_position(btn);
      }
    }
    container.querySelectorAll(".nte-history-btn,.nte-analyze-trade-btn,.nte-poison-btn").forEach((btn) => sync_trade_button_position(btn));
    assert_trade_page_dominance();
  }

  // === Counter / Send prompt ===
  (function init_counter_prompt() {
    let style_injected = false;
    let modal_el = null;
    let escape_handler = null;

    function inject_styles() {
      if (style_injected) return;
      style_injected = true;
      let style = document.createElement("style");
      style.id = "nte-counter-prompt-style";
      style.textContent = `
        html.nte-counter-prompt-open{overflow:hidden!important}
        .nte-counter-prompt-modal{position:fixed!important;inset:0!important;z-index:2147483640!important;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(8,10,14,.7);backdrop-filter:blur(14px) saturate(120%);-webkit-backdrop-filter:blur(14px) saturate(120%);animation:ntePromptIn .15s ease}
        .nte-counter-prompt-card{position:relative;width:min(360px,calc(100vw - 36px));border-radius:16px;background:#181b24;border:1px solid rgba(255,255,255,.08);box-shadow:0 24px 70px rgba(0,0,0,.55);color:#e8eaed;font-family:'Inter','Segoe UI',Roboto,system-ui,sans-serif;overflow:hidden;animation:ntePromptCardIn .2s cubic-bezier(.2,.8,.2,1)}
        .nte-counter-prompt-head{display:flex;align-items:center;gap:11px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.06)}
        .nte-counter-prompt-mark{flex:0 0 auto;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(99,102,241,.18),rgba(16,185,129,.12));overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.05) inset}
        .nte-counter-prompt-mark img{width:24px;height:24px;object-fit:contain}
        .nte-counter-prompt-mark span{font-size:13px;font-weight:800;color:#9ca3af}
        .nte-counter-prompt-titles{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
        .nte-counter-prompt-title{font-size:13px;font-weight:700;color:#f3f4f6;line-height:1;letter-spacing:-.005em}
        .nte-counter-prompt-sub{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;line-height:1}
        .nte-counter-prompt-close{flex:0 0 auto;width:28px;height:28px;border-radius:7px;border:0;background:transparent;color:#9ca3af;cursor:pointer;font:inherit;font-size:18px;line-height:1;transition:background-color .15s,color .15s}
        .nte-counter-prompt-close:hover{background:rgba(255,255,255,.06);color:#f3f4f6}
        .nte-counter-prompt-body{padding:16px 18px 18px}
        .nte-counter-prompt-question{font-size:13.5px;font-weight:500;line-height:1.5;color:#cbd5e1;margin-bottom:14px}
        .nte-counter-prompt-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .nte-counter-prompt-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#e8eaed;font:inherit;font-size:13px;font-weight:600;letter-spacing:-.005em;line-height:1;cursor:pointer;transition:transform .15s ease,background .15s ease,border-color .15s ease,box-shadow .15s ease}
        .nte-counter-prompt-btn:hover{transform:translateY(-1px);background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14)}
        .nte-counter-prompt-btn.is-primary{background:linear-gradient(180deg,#8576f9,#6c5ce7);border-color:transparent;color:#fff;box-shadow:0 6px 18px rgba(108,92,231,.22)}
        .nte-counter-prompt-btn.is-primary:hover{box-shadow:0 10px 26px rgba(108,92,231,.32)}
        @keyframes ntePromptIn{from{opacity:0}to{opacity:1}}
        @keyframes ntePromptCardIn{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
      `;
      document.head.appendChild(style);
    }

    function get_logo_url() {
      try { return chrome.runtime.getURL("assets/icons/logo.png"); } catch { return ""; }
    }

    function close_modal() {
      if (modal_el) { modal_el.remove(); modal_el = null; }
      document.documentElement.classList.remove("nte-counter-prompt-open");
      if (escape_handler) {
        document.removeEventListener("keydown", escape_handler, true);
        escape_handler = null;
      }
    }

    function show_prompt(counter_btn) {
      inject_styles();
      close_modal();
      let logo = get_logo_url();
      let modal = document.createElement("div");
      modal.className = "nte-counter-prompt-modal";
      modal.innerHTML = `
        <div class="nte-counter-prompt-card" role="dialog" aria-modal="true" aria-label="Counter or send trade">
          <div class="nte-counter-prompt-head">
            <div class="nte-counter-prompt-mark">
              ${logo ? `<img src="${nte_history_attr_esc(logo)}" alt="">` : "<span>N</span>"}
            </div>
            <div class="nte-counter-prompt-titles">
              <div class="nte-counter-prompt-title">Nevos Trading Extension</div>
              <div class="nte-counter-prompt-sub">Trade action</div>
            </div>
            <button type="button" class="nte-counter-prompt-close" aria-label="Cancel">&times;</button>
          </div>
          <div class="nte-counter-prompt-body">
            <div class="nte-counter-prompt-question">Counter this trade or send a new one to this user?</div>
            <div class="nte-counter-prompt-actions">
              <button type="button" class="nte-counter-prompt-btn" data-action="send">Send trade</button>
              <button type="button" class="nte-counter-prompt-btn is-primary" data-action="counter">Counter</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal_el = modal;
      document.documentElement.classList.add("nte-counter-prompt-open");

      modal.querySelector(".nte-counter-prompt-close").onclick = close_modal;
      modal.addEventListener("mousedown", (event) => { if (event.target === modal) close_modal(); });

      modal.querySelector('[data-action="counter"]').onclick = () => {
        close_modal();
        counter_btn.__nte_counter_bypass = true;
        try { counter_btn.click(); } catch {}
      };
      modal.querySelector('[data-action="send"]').onclick = () => {
        close_modal();
        let row = document.querySelector(".trade-row.selected");
        let partner_id = get_selected_trade_partner_id(row);
        if (partner_id) location.href = `/users/${partner_id}/trade`;
      };

      escape_handler = (event) => { if (event.key === "Escape") close_modal(); };
      document.addEventListener("keydown", escape_handler, true);
    }

    async function on_doc_click(event) {
      let btn = event.target?.closest?.('button[ng-click*="counterTrade"]');
      if (!btn) return;
      if (btn.__nte_counter_bypass) {
        btn.__nte_counter_bypass = false;
        return;
      }
      if (btn.classList.contains("ng-hide") || btn.disabled) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      let enabled = false !== (await c.getOption("Counter Trade Prompt"));
      if (!enabled) {
        btn.__nte_counter_bypass = true;
        try { btn.click(); } catch {}
        return;
      }
      show_prompt(btn);
    }

    document.addEventListener("click", on_doc_click, true);
  })();

})();
