(() => {
  if (window.__nru_trade_list_request_patch_loaded) return;
  window.__nru_trade_list_request_patch_loaded = true;
  document.documentElement?.setAttribute("data-nru-trade-list-request-patch-loaded", "1");

  let trade_limit = "100",
    trade_detail_request_seq = 0,
    trade_thumb_cache = {},
    trade_thumb_pending = {},
    trade_thumb_image_pending = {},
    trade_thumb_image_seen = {},
    trade_thumb_image_refs = [];

  let trade_thumb_proxy_style_bound = false;
  function ensure_trade_thumb_proxy_style() {
    if (trade_thumb_proxy_style_bound) return;
    trade_thumb_proxy_style_bound = true;
    try {
      let style = document.createElement("style");
      style.textContent = `
        thumbnail-2d.nru-trade-thumb-proxy-host-active{
          display:block!important;
          width:100%!important;
          height:100%!important;
        }
        .thumbnail-2d-container.nru-trade-thumb-proxy-active{
          display:block!important;
          width:100%!important;
          height:100%!important;
          min-width:100%!important;
          min-height:100%!important;
          animation:none!important;
          background-image:none!important;
        }
        .thumbnail-2d-container.nru-trade-thumb-proxy-active::before,
        .thumbnail-2d-container.nru-trade-thumb-proxy-active::after{
          animation:none!important;
          background-image:none!important;
          opacity:0!important;
        }
        .thumbnail-2d-container.nru-trade-thumb-proxy-active img:not(.nru-trade-thumb-proxy){
          opacity:1!important;
          transition:none!important;
          animation:none!important;
        }
      `;
      (document.head || document.documentElement || document.body)?.appendChild(style);
    } catch {}
  }

  function get_trade_thumb_proxy_host(container) {
    let host = container?.parentElement;
    return host?.tagName === "THUMBNAIL-2D" ? host : null;
  }

  function set_trade_thumb_proxy_host_active(container, active) {
    let host = get_trade_thumb_proxy_host(container);
    host && host.classList.toggle("nru-trade-thumb-proxy-host-active", !!active);
  }

  function set_trade_thumb_proxy_active(container, active) {
    if (!(container instanceof Element)) return;
    container.classList.toggle("nru-trade-thumb-proxy-active", !!active);
    set_trade_thumb_proxy_host_active(container, active);
  }

  function is_trade_list_url(url) {
    return (
      "trades.roblox.com" === url.hostname &&
      /^\/v1\/trades\/(inbound|outbound|completed|inactive)\/?$/.test(url.pathname)
    );
  }

  function patch_url(raw_url) {
    try {
      let url = new URL(raw_url, location.origin);
      if (!is_trade_list_url(url)) return null;

      url.searchParams.set("limit", trade_limit);
      if (!url.searchParams.has("sortOrder")) {
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
          document.removeEventListener("nru_trade_detail_cache_response", on_response);
          resolve(trade && "object" == typeof trade ? trade : null);
        },
        on_response = (event) => {
          let detail = parse_bridge_detail(event.detail);
          detail?.request_id === request_id && finish(detail.trade || null);
        },
        timeout_id = setTimeout(() => finish(null), 80);

      document.addEventListener("nru_trade_detail_cache_response", on_response);
      document.dispatchEvent(
        new CustomEvent("nru_trade_detail_cache_request", {
          detail: JSON.stringify({ request_id, trade_id }),
        }),
      );
    });
  }

  function normalize_thumb_request_type(type, fallback_type = "") {
    let normalized = String(type || "").trim().toLowerCase();
    if ("bundlethumbnail" === normalized || "bundle" === normalized) return "BundleThumbnail";
    if ("asset" === normalized || "assetthumbnail" === normalized) return "Asset";
    if (!normalized) {
      let fallback = String(fallback_type || "").trim().toLowerCase();
      if ("bundlethumbnail" === fallback || "bundle" === fallback) return "BundleThumbnail";
      if ("asset" === fallback || "assetthumbnail" === fallback) return "Asset";
    }
    return "";
  }

  function get_thumb_cache_key(target_id, type = "Asset") {
    let parsed = parseInt(target_id, 10);
    if (!(parsed > 0)) return "";
    return `${normalize_thumb_request_type(type)}:${parsed}`;
  }

  function make_thumb_request_id(target_id, request_id = "", type = "Asset") {
    let parsed = parseInt(target_id, 10);
    if (!(parsed > 0)) return "";
    let normalized_type = normalize_thumb_request_type(type);
    return request_id || `${parsed}:undefined:${normalized_type}:150x150:webp:regular:0:`;
  }

  function normalize_thumb_request(request, fallback_type = "Asset") {
    let target_id = parseInt(request?.targetId ?? request, 10);
    if (!(target_id > 0)) return null;
    let type = normalize_thumb_request_type(request?.type, fallback_type);
    if (!type) return null;
    return {
      type,
      targetId: String(target_id),
      requestId: String(request?.requestId || "").trim(),
      key: get_thumb_cache_key(target_id, type),
    };
  }

  function is_bad_trade_thumb_url(url) {
    let key = String(url || "").trim().toLowerCase();
    return !key || key.includes("/brokenimage/");
  }

  function get_thumb_batch_requests(raw_body) {
    let body = parse_bridge_detail(raw_body);
    if (!Array.isArray(body) || !body.length) return null;
    let requests = [];
    for (let request of body) {
      let size = String(request?.size || "").trim(),
        format = String(request?.format || "").trim().toLowerCase(),
        normalized = normalize_thumb_request(request);
      if (!normalized || "150x150" !== size || "webp" !== format) return null;
      requests.push(normalized);
    }
    return requests;
  }

  function preload_thumb_image(url) {
    let key = String(url || "").trim();
    if (!key) return Promise.resolve();
    if (trade_thumb_image_seen[key]) return Promise.resolve();
    if (trade_thumb_image_pending[key]) return trade_thumb_image_pending[key];
    return (trade_thumb_image_pending[key] = new Promise((resolve) => {
      let done = false,
        finish = () => {
          if (done) return;
          done = true;
          trade_thumb_image_seen[key] = true;
          delete trade_thumb_image_pending[key];
          resolve();
        };
      try {
        let img = new Image();
        (img.decoding = "async"),
          (img.onload = finish),
          (img.onerror = finish),
          (img.src = key),
          img.complete && finish(),
          trade_thumb_image_refs.push(img),
          trade_thumb_image_refs.length > 64 && trade_thumb_image_refs.splice(0, trade_thumb_image_refs.length - 64);
      } catch {
        finish();
      }
    }));
  }

  function get_cached_trade_thumb(target_id, type = "Asset") {
    let key = get_thumb_cache_key(target_id, type),
      cached = key ? trade_thumb_cache[key] : null;
    return cached && "object" == typeof cached && cached.imageUrl && !is_bad_trade_thumb_url(cached.imageUrl) ? cached : null;
  }

  function set_cached_trade_thumb(entry, fallback_type = "Asset") {
    let normalized = normalize_thumb_request(entry, fallback_type),
      key = normalized?.key;
    if (!key || !entry?.imageUrl) return null;
    let cached = {
      requestId: make_thumb_request_id(normalized.targetId, entry?.requestId, normalized.type),
      errorCode: Number(entry?.errorCode) || 0,
      errorMessage: String(entry?.errorMessage || ""),
      targetId: parseInt(normalized.targetId, 10),
      type: normalized.type,
      state: String(entry?.state || "Completed"),
      imageUrl: String(entry?.imageUrl || ""),
      version: String(entry?.version || ""),
    };
    return (trade_thumb_cache[key] = cached), is_bad_trade_thumb_url(cached.imageUrl) || preload_thumb_image(cached.imageUrl), cached;
  }

  function get_cached_trade_thumbs(requests) {
    if (!Array.isArray(requests) || !requests.length) return null;
    let thumbs = [];
    for (let request of requests) {
      let normalized = normalize_thumb_request(request),
        cached = normalized ? get_cached_trade_thumb(normalized.targetId, normalized.type) : null;
      if (!cached) return null;
      thumbs.push({
        ...cached,
        requestId: make_thumb_request_id(normalized.targetId, request?.requestId, normalized.type),
      });
    }
    return thumbs;
  }

  function get_trade_thumb_requests(trade) {
    let requests = [],
      seen = new Set(),
      offers = Array.isArray(trade?.offers)
        ? trade.offers
        : trade?.participantAOffer || trade?.participantBOffer
          ? [trade.participantAOffer, trade.participantBOffer]
          : [];
    for (let offer of offers || []) {
      let items = Array.isArray(offer?.items)
        ? offer.items
        : Array.isArray(offer?.assets)
          ? offer.assets
          : Array.isArray(offer?.userAssets)
            ? offer.userAssets
            : [];
      for (let item of items) {
        let target_id = item?.assetId ?? item?.itemTarget?.targetId ?? item?.targetId ?? item?.itemId ?? item?.asset?.id ?? item?.item?.id ?? item?.collectibleItemId ?? item?.id,
          normalized = normalize_thumb_request(
            {
              type: item?.itemType || item?.itemTarget?.itemType || "Asset",
              targetId: target_id,
            },
            "Asset",
          );
        normalized && !seen.has(normalized.key) && (seen.add(normalized.key), requests.push(normalized));
      }
    }
    return requests;
  }

  function ensure_trade_thumbs(thumb_requests) {
    let requests = [],
      seen = new Set();
    for (let request of Array.isArray(thumb_requests) ? thumb_requests : []) {
      let normalized = normalize_thumb_request(request);
      normalized && !seen.has(normalized.key) && (seen.add(normalized.key), requests.push(normalized));
    }
    if (!requests.length) return Promise.resolve();
    let pending = [],
      uncached = [];
    for (let request of requests) {
      let cached = get_cached_trade_thumb(request.targetId, request.type),
        wait = trade_thumb_pending[request.key];
      cached || (wait ? pending.push(wait) : uncached.push(request));
    }
    if (uncached.length) {
      let request_lookup = {};
      for (let request of uncached) request_lookup[make_thumb_request_id(request.targetId, "", request.type)] = request;
      let request = fetch("https://thumbnails.roblox.com/v1/batch", {
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          uncached.map((request) => ({
            requestId: make_thumb_request_id(request.targetId, "", request.type),
            type: request.type,
            targetId: request.targetId,
            format: "webp",
            size: "150x150",
          })),
        ),
      })
        .then((response) => (response.ok ? response.json().catch(() => null) : null))
        .then((payload) => {
          let data = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
          for (let entry of data) set_cached_trade_thumb(entry, request_lookup[String(entry?.requestId || "")]?.type || "Asset");
          return Promise.all(
            uncached
              .map((request) => get_cached_trade_thumb(request.targetId, request.type)?.imageUrl)
              .filter(Boolean)
              .map((url) => preload_thumb_image(url)),
          ).then(() => {});
        })
        .catch(() => null)
        .finally(() => {
          for (let request of uncached) delete trade_thumb_pending[request.key];
        });
      for (let request of uncached) trade_thumb_pending[request.key] = request;
      pending.push(request);
    }
    return pending.length ? Promise.all(pending).then(() => {}) : Promise.resolve();
  }

  function remove_proxy_trade_thumb(container) {
    try {
      set_trade_thumb_proxy_active(container, false);
      container?.querySelectorAll?.("img.nru-trade-thumb-proxy").forEach((node) => node.remove());
    } catch {}
  }

  function make_real_trade_thumb_instant(img) {
    if (!(img instanceof HTMLImageElement)) return;
    try {
      img.style.setProperty("opacity", "1", "important");
      img.style.setProperty("transition", "none", "important");
      img.style.setProperty("animation", "none", "important");
    } catch {}
  }

  function finish_real_trade_thumb_handoff(container, real) {
    if (!(container instanceof Element) || !(real instanceof HTMLImageElement)) return;
    if (real.__nru_trade_thumb_handoff_finished) return;
    real.__nru_trade_thumb_handoff_finished = true;
    make_real_trade_thumb_instant(real);
    let cleanup = () => {
      make_real_trade_thumb_instant(real);
      container.isConnected && real.isConnected && remove_proxy_trade_thumb(container);
    };
    requestAnimationFrame(cleanup);
    setTimeout(cleanup, 40);
  }

  function bind_real_trade_thumb_handoff(container, real) {
    if (!(container instanceof Element) || !(real instanceof HTMLImageElement)) return;
    make_real_trade_thumb_instant(real);
    if (real.complete && real.naturalWidth > 0) return finish_real_trade_thumb_handoff(container, real);
    if (real.__nru_trade_thumb_handoff_bound) return;
    real.__nru_trade_thumb_handoff_bound = true;
    real.addEventListener(
      "load",
      () => {
        finish_real_trade_thumb_handoff(container, real);
      },
      { once: true },
    );
    real.addEventListener(
      "error",
      () => {
        finish_real_trade_thumb_handoff(container, real);
      },
      { once: true },
    );
  }

  function hydrate_trade_thumb_container(container) {
    if (!(container instanceof Element)) return;
    let target_id = container.getAttribute("thumbnail-target-id"),
      type = normalize_thumb_request_type(container.getAttribute("thumbnail-type"));
    if (!get_thumb_cache_key(target_id, type)) return remove_proxy_trade_thumb(container);
    let real = container.querySelector("img:not(.nru-trade-thumb-proxy)");
    if (real instanceof HTMLImageElement) return bind_real_trade_thumb_handoff(container, real);
    let cached = get_cached_trade_thumb(target_id, type);
    if (!cached?.imageUrl) return remove_proxy_trade_thumb(container);
    let proxy = container.querySelector("img.nru-trade-thumb-proxy");
    proxy ||
      ((proxy = document.createElement("img")),
      (proxy.className = "nru-trade-thumb-proxy"),
      (proxy.alt = ""),
      (proxy.draggable = false),
      (proxy.decoding = "async"),
      Object.assign(proxy.style, {
        position: "absolute",
        inset: "0",
        zIndex: "1",
        width: "100%",
        height: "100%",
        objectFit: "contain",
        pointerEvents: "none",
        opacity: "1",
        transition: "none",
      }),
      "static" === getComputedStyle(container).position && (container.style.position = "relative"),
      container.appendChild(proxy));
    ensure_trade_thumb_proxy_style();
    set_trade_thumb_proxy_active(container, true);
    proxy.src !== cached.imageUrl && (proxy.src = cached.imageUrl);
  }

  function hydrate_visible_trade_thumb_containers() {
    document.querySelectorAll(".trades-list-detail .thumbnail-2d-container[thumbnail-target-id]").forEach(hydrate_trade_thumb_container);
  }

  let trade_thumb_dom_observer_started = false;
  function bind_trade_thumb_dom_observer() {
    if (trade_thumb_dom_observer_started) return;
    trade_thumb_dom_observer_started = true;
    let schedule_id = 0,
      schedule = () => {
        if (schedule_id) return;
        schedule_id = setTimeout(() => {
          schedule_id = 0;
          hydrate_visible_trade_thumb_containers();
        }, 0);
      },
      observer = new MutationObserver((mutations) => {
        for (let mutation of mutations) {
          if ("attributes" === mutation.type) {
            let target = mutation.target;
            if (target instanceof Element && target.matches?.(".trades-list-detail .thumbnail-2d-container[thumbnail-target-id]")) {
              hydrate_trade_thumb_container(target);
              continue;
            }
          }
          for (let node of mutation.addedNodes || []) {
            if (!(node instanceof Element)) continue;
            node.matches?.(".trades-list-detail .thumbnail-2d-container[thumbnail-target-id]") && hydrate_trade_thumb_container(node);
            node.querySelectorAll?.(".trades-list-detail .thumbnail-2d-container[thumbnail-target-id], .trades-list-detail .thumbnail-2d-container[thumbnail-target-id] *")
              ?.forEach?.((child) => {
                let container = child.closest?.(".thumbnail-2d-container[thumbnail-target-id]");
                container && hydrate_trade_thumb_container(container);
              });
          }
        }
        schedule();
      });
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "thumbnail-target-id", "thumbnail-type", "src"],
    });
    hydrate_visible_trade_thumb_containers();
  }

  function request_cached_trade_thumbs(requests) {
    return ensure_trade_thumbs(requests)
      .then(() => get_cached_trade_thumbs(requests))
      .catch(() => null);
  }

  document.addEventListener("nru_trade_thumb_prewarm", (event) => {
    let detail = parse_bridge_detail(event.detail),
      thumb_requests = Array.isArray(detail?.thumb_requests)
        ? detail.thumb_requests
        : Array.isArray(detail?.asset_ids)
          ? detail.asset_ids.map((target_id) => ({ type: "Asset", targetId: target_id }))
          : Array.isArray(detail)
            ? detail
            : [];
    thumb_requests.length &&
      ensure_trade_thumbs(thumb_requests)
        .then(() => hydrate_visible_trade_thumb_containers())
        .catch(() => {});
  });

  document.addEventListener("nru_trade_thumb_clear", () => {
    trade_thumb_cache = {};
    trade_thumb_pending = {};
    trade_thumb_image_pending = {};
    trade_thumb_image_seen = {};
    trade_thumb_image_refs = [];
    document.querySelectorAll(".nru-trade-thumb-proxy").forEach((node) => node.remove());
  });

  bind_trade_thumb_dom_observer();

  async function get_cached_trade_response(input, init) {
    if ("GET" !== get_request_method(input, init)) return null;
    let trade_id = get_trade_detail_id(get_request_url(input));
    if (!trade_id) return null;
    let trade = await request_cached_trade_detail(trade_id);
    if (!trade || (!trade.participantAOffer && !trade.participantBOffer && !Array.isArray(trade.offers))) return null;
    ensure_trade_thumbs(get_trade_thumb_requests(trade)).catch(() => {});
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
      return patched_url ? new Request(patched_url, input) : input;
    }

    if ("string" == typeof input) return patch_url(input) || input;

    if (input && "object" == typeof input && "string" == typeof input.url) {
      return patch_url(input.url) || input;
    }

    return input;
  }

  let original_fetch = window.fetch;
  if ("function" == typeof original_fetch) {
    window.fetch = async function (input, init) {
      let cached_response = await get_cached_trade_response(input, init);
      return cached_response || original_fetch.call(this, normalize_request(input), init);
    };
  }

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
    let patched_url = "string" == typeof url ? patch_url(url) || url : url;
    this.__nru_xhr_request_meta = {
      method: String(method || "GET").toUpperCase(),
      url: "string" == typeof url ? url : "",
      rest,
    };
    return original_open.call(this, method, patched_url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    let xhr = this,
      meta = xhr.__nru_xhr_request_meta || {},
      trade_id = get_trade_detail_id(meta.url),
      thumb_requests =
        "POST" === meta.method &&
        "thumbnails.roblox.com" === (() => {
          try {
            return new URL(meta.url, location.origin).hostname;
          } catch {
            return "";
          }
        })()
          ? get_thumb_batch_requests(args[0])
          : null;
    if ("GET" === meta.method && trade_id && !1 !== meta.rest?.[0]) {
      request_cached_trade_detail(trade_id).then((trade) => {
        trade && ensure_trade_thumbs(get_trade_thumb_requests(trade)).catch(() => {});
        trade && (trade.participantAOffer || trade.participantBOffer || Array.isArray(trade.offers))
          ? respond_with_cached_xhr(xhr, meta.url, null == trade.tradeId ? { ...trade, tradeId: parseInt(trade_id, 10) || trade_id } : trade, {
              "x-nru-trade-cache": "hit",
            })
          : original_send.apply(xhr, args);
      });
      return void 0;
    }
    if (thumb_requests) {
      request_cached_trade_thumbs(thumb_requests).then((thumbs) => {
        Array.isArray(thumbs) && thumbs.length === thumb_requests.length
          ? respond_with_cached_xhr(xhr, meta.url, { data: thumbs }, { "x-nru-trade-thumb-cache": "hit" })
          : original_send.apply(xhr, args);
      });
      return void 0;
    }
    return original_send.apply(xhr, args);
  };
})();
