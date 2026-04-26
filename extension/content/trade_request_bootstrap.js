(() => {
  let path_parts = (location.pathname || "")
    .split("/")
    .filter(Boolean)
    .map((part) => part.toLowerCase());

  if (!path_parts.length || "trades" !== path_parts[path_parts.length - 1]) return;
  if (!window.__nru_trade_detail_cache_bridge_loaded) {
    window.__nru_trade_detail_cache_bridge_loaded = true;

    let trade_detail_cache = new Map(),
      trade_detail_pending = new Map();

    function parse_bridge_detail(raw_detail) {
      if ("string" != typeof raw_detail) return raw_detail && "object" == typeof raw_detail ? raw_detail : null;
      try {
        return JSON.parse(raw_detail);
      } catch {
        return null;
      }
    }

    function bridge_send_message(message) {
      return new Promise((resolve) => {
        let done = false,
          finish = (value) => {
            if (done) return;
            done = true;
            resolve(value);
          };

        try {
          let result = chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) return finish(null);
            finish(response);
          });
          result && "function" == typeof result.then && result.then(finish, () => finish(null));
        } catch {
          finish(null);
        }
      });
    }

    function get_trade_patch_marker() {
      return document.documentElement?.getAttribute("data-nru-trade-list-request-patch-loaded") || "";
    }

    function normalize_thumb_request_type(type) {
      let normalized = String(type || "").trim().toLowerCase();
      return "bundlethumbnail" === normalized || "bundle" === normalized ? "BundleThumbnail" : "Asset";
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

    function get_thumb_cache_candidates(target_id, type = "Asset") {
      let parsed = parseInt(target_id, 10);
      if (!(parsed > 0)) return [];
      let candidates = [get_thumb_cache_key(parsed, type), String(parsed)];
      return candidates.filter((value, index) => value && candidates.indexOf(value) === index);
    }

    async function inject_trade_patch_inline() {
      if ("1" === get_trade_patch_marker()) return true;
      let source = "";
      try {
        let resp = await fetch(chrome.runtime.getURL("scripts/trade_list_request_patch.js"));
        source = resp.ok ? await resp.text() : "";
      } catch {}
      if (!source) return false;

      let script = document.createElement("script"),
        nonce_node = document.querySelector("script[nonce]"),
        nonce = nonce_node?.nonce || nonce_node?.getAttribute?.("nonce") || "",
        target = document.head || document.documentElement;
      if (!target) return false;
      nonce && script.setAttribute("nonce", nonce);
      script.textContent = `${source}\n;document.documentElement&&document.documentElement.setAttribute("data-nru-trade-list-request-patch-loaded","1");`;
      target.appendChild(script);
      script.remove();
      return "1" === get_trade_patch_marker();
    }

    function get_live_trade_detail(trade_id) {
      let key = String(trade_id || "").trim();
      if (!key) return null;
      let cache = window.__nte_trade_row_raw_cache;
      if (!cache || "object" != typeof cache) return null;
      let trade = cache[key];
      if (!trade || "object" != typeof trade) return null;
      if (!trade.participantAOffer && !trade.participantBOffer && !Array.isArray(trade.offers)) return null;
      let normalized_trade = null == trade.tradeId ? { ...trade, tradeId: parseInt(key, 10) || key } : trade;
      trade_detail_cache.set(key, normalized_trade);
      return normalized_trade;
    }

    function normalize_thumb_cache_request(request) {
      if (!request || "object" != typeof request) return null;
      let type = normalize_thumb_request_type(request.type || ""),
        size = String(request.size || "").trim(),
        format = String(request.format || "").trim().toLowerCase(),
        target_id = String(request.targetId || "").trim();
      return "150x150" !== size || "webp" !== format || !target_id
        ? null
        : {
            requestId: String(request.requestId || ""),
            targetId: target_id,
            type,
            key: get_thumb_cache_key(target_id, type),
          };
    }

    function get_live_trade_thumbs(requests) {
      if (!Array.isArray(requests) || !requests.length) return null;
      let cache = window.__nte_trade_thumb_meta_cache;
      if (!cache || "object" != typeof cache) return null;
      let thumbs = [];
      for (let raw_request of requests) {
        let request = normalize_thumb_cache_request(raw_request);
        if (!request) return null;
        let cached = null;
        for (let key of get_thumb_cache_candidates(request.targetId, request.type)) {
          let entry = cache[key];
          if (entry && "object" == typeof entry && entry.imageUrl) {
            cached = entry;
            break;
          }
        }
        if (!cached || "object" != typeof cached || !cached.imageUrl) return null;
        thumbs.push({
          requestId: make_thumb_request_id(request.targetId, request.requestId, request.type),
          errorCode: Number(cached.errorCode) || 0,
          errorMessage: String(cached.errorMessage || ""),
          targetId: parseInt(request.targetId, 10) || request.targetId,
          type: normalize_thumb_request_type(cached.type || request.type),
          state: String(cached.state || "Completed"),
          imageUrl: String(cached.imageUrl || ""),
          version: String(cached.version || ""),
        });
      }
      return thumbs;
    }

    function get_cached_trade_detail(trade_id) {
      let key = String(trade_id || "").trim();
      if (!key) return Promise.resolve(null);
      if (trade_detail_cache.has(key)) return Promise.resolve(trade_detail_cache.get(key));
      let live_trade = get_live_trade_detail(key);
      if (live_trade) return Promise.resolve(live_trade);
      if (trade_detail_pending.has(key)) return trade_detail_pending.get(key);

      let request = bridge_send_message({ type: "getCachedTrade", tradeId: key })
        .then((trade) => {
          if (!trade || "object" != typeof trade) return null;
          if (!trade.participantAOffer && !trade.participantBOffer && !Array.isArray(trade.offers)) return null;
          let normalized_trade = null == trade.tradeId ? { ...trade, tradeId: parseInt(key, 10) || key } : trade;
          trade_detail_cache.set(key, normalized_trade);
          return normalized_trade;
        })
        .catch(() => null)
        .finally(() => {
          trade_detail_pending.delete(key);
        });

      trade_detail_pending.set(key, request);
      return request;
    }

    document.addEventListener("nru_trade_detail_cache_request", (event) => {
      let detail = parse_bridge_detail(event.detail),
        request_id = String(detail?.request_id || "").trim(),
        trade_id = String(detail?.trade_id || "").trim();
      if (!request_id || !trade_id) return;
      get_cached_trade_detail(trade_id)
        .then((trade) => {
          document.dispatchEvent(
            new CustomEvent("nru_trade_detail_cache_response", {
              detail: JSON.stringify({ request_id, trade_id, trade: trade || null }),
            }),
          );
        })
        .catch(() => {
          document.dispatchEvent(
            new CustomEvent("nru_trade_detail_cache_response", {
              detail: JSON.stringify({ request_id, trade_id, trade: null }),
            }),
          );
        });
    });

    document.addEventListener("nru_trade_thumb_cache_request", (event) => {
      let detail = parse_bridge_detail(event.detail),
        request_id = String(detail?.request_id || "").trim(),
        requests = Array.isArray(detail?.requests) ? detail.requests : null,
        thumbs = get_live_trade_thumbs(requests);
      if (!request_id) return;
      document.dispatchEvent(
        new CustomEvent("nru_trade_thumb_cache_response", {
          detail: JSON.stringify({ request_id, thumbs: thumbs || null }),
        }),
      );
    });

    inject_trade_patch_inline().catch(() => {});
  }
})();
