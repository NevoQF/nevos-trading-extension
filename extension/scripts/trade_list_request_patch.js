(() => {
  if (window.__nru_trade_list_request_patch_loaded) return;
  window.__nru_trade_list_request_patch_loaded = true;
  document.documentElement?.setAttribute("data-nru-trade-list-request-patch-loaded", "1");

  let trade_limit = "100",
    trade_detail_request_seq = 0;

  function is_trade_list_status(value) {
    return /^(inbound|outbound|completed|inactive)$/i.test(String(value || "").trim());
  }

  function is_trade_list_url(url) {
    let host = String(url.hostname || "").toLowerCase();
    if ("trades.roblox.com" !== host && !host.endsWith(".trades.roblox.com")) {
      // Some clients hit same-origin proxies under www.roblox.com.
      if (!/(^|\.)roblox\.com$/i.test(host)) return false;
    }
    let path = String(url.pathname || "");
    if (/^\/v1\/trades\/(inbound|outbound|completed|inactive)\/?$/i.test(path)) {
      return true;
    }
    // Rare shape: /v1/trades?tradeStatusType=Inbound
    if (/^\/v1\/trades\/?$/i.test(path)) {
      return is_trade_list_status(
        url.searchParams.get("tradeStatusType") ||
          url.searchParams.get("TradeStatusType") ||
          url.searchParams.get("status"),
      );
    }
    return false;
  }

  function patch_url(raw_url) {
    try {
      let url = new URL(String(raw_url || ""), location.href);
      if (!is_trade_list_url(url)) return null;

      for (let key of [...url.searchParams.keys()]) {
        if (/^(limit|pagesize)$/i.test(key)) url.searchParams.delete(key);
      }
      url.searchParams.set("limit", trade_limit);
      if (![...url.searchParams.keys()].some((key) => /^sortorder$/i.test(key))) {
        url.searchParams.set("sortOrder", "Desc");
      }
      return url.toString();
    } catch {
      return null;
    }
  }

  function get_request_method(input, init) {
    let method = init?.method || input?.method || "GET";
    return String(method || "GET").toUpperCase();
  }

  function get_request_url(input) {
    if ("undefined" != typeof Request && input instanceof Request) return input.url;
    if ("string" == typeof input) return input;
    if (input && "object" == typeof input && "string" == typeof input.url) return input.url;
    return "";
  }

  function get_trade_detail_id(raw_url) {
    try {
      let url = new URL(raw_url, location.origin),
        match = "trades.roblox.com" === url.hostname && url.pathname.match(/^\/v2\/trades\/(\d+)\/?$/);
      return match ? match[1] : "";
    } catch {
      return "";
    }
  }

  function get_trade_decline_id(raw_url) {
    try {
      let url = new URL(raw_url, location.origin),
        match = "trades.roblox.com" === url.hostname && url.pathname.match(/^\/v1\/trades\/(\d+)\/decline\/?$/);
      return match ? match[1] : "";
    } catch {
      return "";
    }
  }

  function dispatch_self_declined_trade(trade_id) {
    if (!trade_id) return;
    try {
      document.dispatchEvent(
        new CustomEvent("nru_trade_self_declined", {
          detail: JSON.stringify({ trade_id }),
        }),
      );
    } catch {}
  }

  function parse_bridge_detail(raw_detail) {
    if ("string" != typeof raw_detail) return raw_detail && "object" == typeof raw_detail ? raw_detail : null;
    try {
      return JSON.parse(raw_detail);
    } catch {
      return null;
    }
  }

  function request_cached_trade_detail(trade_id) {
    return new Promise((resolve) => {
      let request_id = `nru-trade-cache-${Date.now()}-${++trade_detail_request_seq}`,
        done = false,
        finish = (trade) => {
          if (done) return;
          done = true;
          clearTimeout(timeout_id);
          clearInterval(poll_id);
          document.removeEventListener("nru_trade_detail_cache_response", on_response);
          resolve(trade && "object" == typeof trade ? trade : null);
        },
        on_response = (event) => {
          let detail = parse_bridge_detail(event.detail);
          detail?.request_id === request_id && finish(detail.trade || null);
        },
        // Poll a bit longer so an in-flight extension cache fill can win
        // before Roblox opens a second /v2/trades/{id} on category switch.
        started = Date.now(),
        poll_id = setInterval(() => {
          if (Date.now() - started >= 450) {
            finish(null);
            return;
          }
          document.dispatchEvent(
            new CustomEvent("nru_trade_detail_cache_request", {
              detail: JSON.stringify({ request_id, trade_id }),
            }),
          );
        }, 60),
        timeout_id = setTimeout(() => finish(null), 500);

      document.addEventListener("nru_trade_detail_cache_response", on_response);
      document.dispatchEvent(
        new CustomEvent("nru_trade_detail_cache_request", {
          detail: JSON.stringify({ request_id, trade_id }),
        }),
      );
    });
  }

  function dispatch_trade_detail_network_start(trade_id) {
    if (!trade_id) return;
    try {
      document.dispatchEvent(
        new CustomEvent("nru_trade_detail_network_start", {
          detail: JSON.stringify({ trade_id }),
        }),
      );
    } catch {}
  }

  function dispatch_trade_detail_network_result(trade_id, trade) {
    if (!trade_id || !trade || "object" != typeof trade) return;
    try {
      document.dispatchEvent(
        new CustomEvent("nru_trade_detail_network_result", {
          detail: JSON.stringify({ trade_id, trade }),
        }),
      );
    } catch {}
  }

  function get_trade_list_type_from_url(raw_url) {
    try {
      let url = new URL(String(raw_url || ""), location.href);
      if (!is_trade_list_url(url)) return "";
      let path = String(url.pathname || "");
      let m = path.match(/^\/v1\/trades\/(inbound|outbound|completed|inactive)\/?$/i);
      if (m) return String(m[1] || "").toLowerCase();
      let status =
        url.searchParams.get("tradeStatusType") ||
        url.searchParams.get("TradeStatusType") ||
        url.searchParams.get("status") ||
        "";
      return is_trade_list_status(status) ? String(status).toLowerCase() : "";
    } catch {
      return "";
    }
  }

  function store_boot_trade_list(type, trades, next_cursor) {
    if (!type || !Array.isArray(trades)) return;
    try {
      let el = document.getElementById("nru-trade-list-boot");
      if (!el) {
        el = document.createElement("script");
        el.id = "nru-trade-list-boot";
        el.type = "application/json";
        (document.documentElement || document.head || document.body)?.appendChild(el);
      }
      el.textContent = JSON.stringify({
        type,
        trades,
        nextPageCursor: next_cursor || "",
        at: Date.now(),
      });
    } catch {}
  }

  function dispatch_trade_list_network_result(type, trades, next_cursor) {
    if (!type || !Array.isArray(trades)) return;
    store_boot_trade_list(type, trades, next_cursor);
    try {
      document.dispatchEvent(
        new CustomEvent("nru_trade_list_network_result", {
          detail: JSON.stringify({
            type,
            trades,
            nextPageCursor: next_cursor || "",
          }),
        }),
      );
    } catch {}
  }

  async function note_trade_list_response(input, init, response) {
    if (!response?.ok) return;
    if ("GET" !== get_request_method(input, init)) return;
    let type = get_trade_list_type_from_url(get_request_url(input));
    if (!type) return;
    try {
      let data = await response.clone().json();
      let trades = Array.isArray(data?.data) ? data.data : [];
      dispatch_trade_list_network_result(
        type,
        trades,
        data?.nextPageCursor || "",
      );
    } catch {}
  }

  async function get_cached_trade_response(input, init) {
    if ("GET" !== get_request_method(input, init)) return null;
    let trade_id = get_trade_detail_id(get_request_url(input));
    if (!trade_id) return null;
    let trade = await request_cached_trade_detail(trade_id);
    if (!trade || (!trade.participantAOffer && !trade.participantBOffer && !Array.isArray(trade.offers))) return null;
    null == trade.tradeId && (trade = { ...trade, tradeId: parseInt(trade_id, 10) || trade_id });
    return new Response(JSON.stringify(trade), {
      status: 200,
      statusText: "OK",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-nru-trade-cache": "hit",
      },
    });
  }

  function normalize_request(input) {
    if ("undefined" != typeof Request && input instanceof Request) {
      let patched_url = patch_url(input.url);
      if (!patched_url) return input;
      try {
        return new Request(patched_url, input);
      } catch {
        return patched_url;
      }
    }

    if ("string" == typeof input) return patch_url(input) || input;

    if ("undefined" != typeof URL && input instanceof URL) {
      let patched_url = patch_url(input.toString());
      return patched_url || input;
    }

    if (input && "object" == typeof input && "string" == typeof input.url) {
      let patched_url = patch_url(input.url);
      return patched_url || input;
    }

    return input;
  }

  function wrap_fetch(original_fetch) {
    if ("function" != typeof original_fetch) return original_fetch;
    if (original_fetch.__nru_trade_list_patched) return original_fetch;
    let patched_fetch = async function (input, init) {
      let trade_id =
        "GET" === get_request_method(input, init)
          ? get_trade_detail_id(get_request_url(input))
          : "";
      let cached_response = await get_cached_trade_response(input, init);
      if (cached_response) return cached_response;
      let decline_id =
        "POST" === get_request_method(input, init)
          ? get_trade_decline_id(get_request_url(input))
          : "";
      if (trade_id) dispatch_trade_detail_network_start(trade_id);
      let response = await original_fetch.call(this, normalize_request(input), init);
      if (decline_id && response?.ok) dispatch_self_declined_trade(decline_id);
      if (trade_id && response?.ok) {
        try {
          let clone = response.clone();
          let trade = await clone.json();
          dispatch_trade_detail_network_result(trade_id, trade);
        } catch {}
      }
      void note_trade_list_response(input, init, response);
      return response;
    };
    patched_fetch.__nru_trade_list_patched = true;
    patched_fetch.__nru_trade_list_original = original_fetch;
    return patched_fetch;
  }

  function install_fetch_patch() {
    let current = window.fetch;
    if ("function" != typeof current) return;
    if (current.__nru_trade_list_patched) return;
    let patched = wrap_fetch(current);
    try {
      Object.defineProperty(window, "fetch", {
        configurable: true,
        enumerable: true,
        get() {
          return patched;
        },
        set(next) {
          if ("function" == typeof next && next.__nru_trade_list_patched) {
            patched = next;
            return;
          }
          patched = wrap_fetch("function" == typeof next ? next : current);
        },
      });
    } catch {
      window.fetch = patched;
    }
  }

  install_fetch_patch();
  // Roblox bundles sometimes replace window.fetch after startup.
  try {
    let fetch_watch = setInterval(install_fetch_patch, 1500);
    setTimeout(() => clearInterval(fetch_watch), 30000);
  } catch {}

  document.addEventListener("nru_trade_detail_fetch_request", (event) => {
    let raw = event?.detail;
    let detail = raw;
    if (typeof raw === "string") {
      try {
        detail = JSON.parse(raw);
      } catch {
        detail = null;
      }
    }
    let request_id = detail?.request_id;
    let trade_id = String(detail?.trade_id || "").trim();
    if (!request_id || !trade_id) return;

    (async () => {
      let trade = null;
      try {
        let resp = await fetch(
          `https://trades.roblox.com/v2/trades/${encodeURIComponent(trade_id)}`,
          { credentials: "include" },
        );
        if (resp?.ok) trade = await resp.json();
        else if (resp && 404 !== resp.status) {
          let fallback = await fetch(
            `https://trades.roblox.com/v1/trades/${encodeURIComponent(trade_id)}`,
            { credentials: "include" },
          );
          if (fallback?.ok) trade = await fallback.json();
        }
      } catch {}
      try {
        document.dispatchEvent(
          new CustomEvent("nru_trade_detail_fetch_response", {
            detail: JSON.stringify({ request_id, trade_id, trade }),
          }),
        );
      } catch {}
      if (trade && "object" == typeof trade) {
        dispatch_trade_detail_network_result(trade_id, trade);
      }
    })();
  });

  function respond_with_cached_xhr(xhr, request_url, payload, extra_headers = {}) {
    let body = JSON.stringify(payload),
      headers = {
        "content-type": "application/json; charset=utf-8",
        ...extra_headers,
      },
      all_headers = Object.entries(headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\r\n"),
      define = (name, getter) => {
        try {
          Object.defineProperty(xhr, name, { configurable: true, get: getter });
        } catch {}
      };

    define("readyState", () => 4);
    define("status", () => 200);
    define("statusText", () => "OK");
    define("responseURL", () => request_url);
    define("responseText", () => body);
    define("responseXML", () => null);
    define("response", () => {
      let type = xhr.responseType || "";
      return "json" === type ? payload : body;
    });

    try {
      xhr.getResponseHeader = (name) => headers[String(name || "").toLowerCase()] || null;
    } catch {}
    try {
      xhr.getAllResponseHeaders = () => all_headers;
    } catch {}

    setTimeout(() => {
      try {
        xhr.onreadystatechange && xhr.onreadystatechange(new Event("readystatechange"));
      } catch {}
      try {
        xhr.dispatchEvent(new Event("readystatechange"));
      } catch {}
      try {
        xhr.onload && xhr.onload(new Event("load"));
      } catch {}
      try {
        xhr.dispatchEvent(new Event("load"));
      } catch {}
      try {
        xhr.onloadend && xhr.onloadend(new Event("loadend"));
      } catch {}
      try {
        xhr.dispatchEvent(new Event("loadend"));
      } catch {}
    }, 0);
  }

  let original_open = XMLHttpRequest.prototype.open,
    original_send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    let raw_url =
      "string" == typeof url
        ? url
        : "undefined" != typeof URL && url instanceof URL
          ? url.toString()
          : url && "object" == typeof url && "string" == typeof url.url
            ? url.url
            : "";
    let patched_url = raw_url ? patch_url(raw_url) || raw_url : url;
    this.__nru_xhr_request_meta = {
      method: String(method || "GET").toUpperCase(),
      url: raw_url || ("string" == typeof url ? url : ""),
      rest,
    };
    return original_open.call(this, method, patched_url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    let xhr = this,
      meta = xhr.__nru_xhr_request_meta || {},
      trade_id = get_trade_detail_id(meta.url),
      list_type =
        "GET" === meta.method ? get_trade_list_type_from_url(meta.url) : "",
      decline_id = "POST" === meta.method ? get_trade_decline_id(meta.url) : "";
    if (decline_id) {
      try {
        xhr.addEventListener("loadend", () => {
          xhr.status >= 200 &&
            xhr.status < 300 &&
            dispatch_self_declined_trade(decline_id);
        });
      } catch {}
    }
    if (list_type) {
      try {
        xhr.addEventListener("loadend", () => {
          if (!(xhr.status >= 200 && xhr.status < 300)) return;
          try {
            let payload =
              "json" === (xhr.responseType || "")
                ? xhr.response
                : JSON.parse(xhr.responseText || "null");
            let trades = Array.isArray(payload?.data) ? payload.data : [];
            dispatch_trade_list_network_result(
              list_type,
              trades,
              payload?.nextPageCursor || "",
            );
          } catch {}
        });
      } catch {}
    }
    if ("GET" === meta.method && trade_id && !1 !== meta.rest?.[0]) {
      request_cached_trade_detail(trade_id).then((trade) => {
        if (
          trade &&
          (trade.participantAOffer ||
            trade.participantBOffer ||
            Array.isArray(trade.offers))
        ) {
          respond_with_cached_xhr(
            xhr,
            meta.url,
            null == trade.tradeId
              ? { ...trade, tradeId: parseInt(trade_id, 10) || trade_id }
              : trade,
            { "x-nru-trade-cache": "hit" },
          );
          return;
        }
        dispatch_trade_detail_network_start(trade_id);
        try {
          xhr.addEventListener("loadend", () => {
            if (!(xhr.status >= 200 && xhr.status < 300)) return;
            try {
              let payload =
                "json" === (xhr.responseType || "")
                  ? xhr.response
                  : JSON.parse(xhr.responseText || "null");
              dispatch_trade_detail_network_result(trade_id, payload);
            } catch {}
          });
        } catch {}
        original_send.apply(xhr, args);
      });
      return void 0;
    }
    return original_send.apply(xhr, args);
  };
})();
