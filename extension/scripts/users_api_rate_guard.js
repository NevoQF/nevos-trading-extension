(() => {
  if (window.__nte_users_api_rate_guard) return;
  window.__nte_users_api_rate_guard = true;

  const native_fetch = window.fetch.bind(window);
  const XHR = window.XMLHttpRequest;
  const native_open = XHR.prototype.open;
  const native_send = XHR.prototype.send;
  const native_set_request_header = XHR.prototype.setRequestHeader;

  // user id: unknown -> cached (6 h) | known-missing (10 min, only after a parsed 2xx reply) -> unknown
  const cache = new Map();
  const pending = new Map();
  const cache_ttl_ms = 6 * 60 * 60 * 1000;
  // Ids the profiles API doesn't return (terminated users): only native knows them.
  const missing_ids = new Map();
  const missing_ttl_ms = 10 * 60 * 1000;
  const profiles_url =
    "https://apis.roblox.com/user-profile-api/v1/user/profiles/get-profiles";
  const users_batch_re = /^https:\/\/users\.roblox\.com\/v1\/users\/?(?:\?|$)/i;

  function now() {
    return Date.now();
  }

  function get_request_url(input) {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url;
    return "";
  }

  function get_request_method(input, init) {
    return String(init?.method || input?.method || "GET").toUpperCase();
  }

  async function read_request_body(input, init) {
    try {
      if (typeof init?.body === "string") return init.body;
      if (init?.body != null) return await new Response(init.body).text();
      if (typeof Request !== "undefined" && input instanceof Request)
        return await input.clone().text();
    } catch {}
    return "";
  }

  function parse_user_ids(body) {
    try {
      let data = JSON.parse(body || "{}");
      // Banned-user filtering changes the answer; let it pass through uncached.
      if (data?.excludeBannedUsers === true) return [];
      let ids = Array.isArray(data?.userIds) ? data.userIds : [];
      return [
        ...new Set(
          ids
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0),
        ),
      ];
    } catch {
      return [];
    }
  }

  function cache_get(id) {
    let hit = cache.get(String(id));
    if (!hit) return null;
    if (hit.expires_at <= now()) {
      cache.delete(String(id));
      return null;
    }
    return hit;
  }

  function is_known_missing(id) {
    let expires_at = missing_ids.get(String(id));
    if (!expires_at) return false;
    if (expires_at > now()) return true;
    missing_ids.delete(String(id));
    return false;
  }

  function cache_set(user) {
    let id = String(user?.id || "");
    if (!id || !user?.name) return;
    missing_ids.delete(id);
    cache.set(id, {
      id: Number(id),
      name: String(user.name || ""),
      displayName: String(user.displayName || user.name || ""),
      hasVerifiedBadge: !!user.hasVerifiedBadge,
      expires_at: now() + cache_ttl_ms,
    });
  }

  function pick_header(headers, name) {
    if (!headers) return "";
    if (typeof headers.get === "function") return headers.get(name) || "";
    let lower = name.toLowerCase();
    for (let key of Object.keys(headers)) {
      if (String(key).toLowerCase() === lower) return headers[key] || "";
    }
    return "";
  }

  function request_headers_from_fetch(input, init) {
    let headers = init?.headers || input?.headers || null;
    return {
      csrf: pick_header(headers, "x-csrf-token"),
      bat: pick_header(headers, "x-bound-auth-token"),
    };
  }

  async function fetch_profiles(ids, header_info) {
    let out = [];
    for (let i = 0; i < ids.length; i += 200) {
      let chunk = ids.slice(i, i + 200);
      let headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (header_info?.csrf) headers["x-csrf-token"] = header_info.csrf;
      if (header_info?.bat) headers["x-bound-auth-token"] = header_info.bat;
      let res = await native_fetch(profiles_url, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          userIds: chunk,
          fields: ["names.username", "names.displayName", "isVerified"],
        }),
      });
      if (!res.ok) continue;
      let json = await res.json().catch(() => null);
      // A 2xx body that isn't JSON says nothing about these ids: don't mark them missing.
      if (!json || typeof json !== "object") continue;
      for (let profile of json.profileDetails || []) {
        let id = Number(profile?.userId) || 0;
        let name = String(profile?.names?.username || "").trim();
        // Without a real verified flag we'd cache false and hide checkmarks.
        if (!id || !name || typeof profile?.isVerified !== "boolean") continue;
        let user = {
          id,
          name,
          displayName: String(
            profile?.names?.displayName ||
              profile?.names?.combinedName ||
              name,
          ),
          hasVerifiedBadge: profile.isVerified,
        };
        cache_set(user);
        out.push(user);
      }
      // Only a successful reply proves an id is unknown to the profiles API.
      for (let id of chunk) {
        if (!cache.has(String(id))) missing_ids.set(String(id), now() + missing_ttl_ms);
      }
    }
    return out;
  }

  function users_payload(users) {
    return JSON.stringify({ data: users });
  }

  function make_users_response(users) {
    return new Response(users_payload(users), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }

  async function resolve_users(ids, header_info) {
    let found = [];
    let missing = [];
    for (let id of ids) {
      let hit = cache_get(id);
      if (hit) {
        found.push({
          id: hit.id,
          name: hit.name,
          displayName: hit.displayName,
          hasVerifiedBadge: hit.hasVerifiedBadge,
        });
      } else missing.push(id);
    }
    // A batch with a known-missing id can't be fully served, so skip the profiles call.
    if (missing.length && !ids.some(is_known_missing)) {
      let loaded = await fetch_profiles(missing, header_info || {});
      found = found.concat(loaded);
    }
    let by_id = new Map(found.map((u) => [Number(u.id), u]));
    return ids.map((id) => by_id.get(id)).filter(Boolean);
  }

  function resolve_users_deduped(ids, header_info) {
    let key = ids.slice().sort((a, b) => a - b).join(",");
    let existing = pending.get(key);
    if (!existing) {
      existing = resolve_users(ids, header_info)
        .catch(() => [])
        .finally(() => pending.delete(key));
      pending.set(key, existing);
    }
    return existing;
  }

  function cache_native_rows(json) {
    for (let row of json?.data || []) {
      cache_set({
        id: row?.id,
        name: row?.name,
        displayName: row?.displayName || row?.name,
        hasVerifiedBadge: !!row?.hasVerifiedBadge,
      });
    }
  }

  window.fetch = async function nte_users_api_rate_guard(input, init) {
    let url = get_request_url(input);
    let method = get_request_method(input, init);
    if (method !== "POST" || !users_batch_re.test(url)) {
      return native_fetch(input, init);
    }

    let body = await read_request_body(input, init);
    let ids = parse_user_ids(body);
    if (!ids.length) return native_fetch(input, init);

    let users = await resolve_users_deduped(
      ids,
      request_headers_from_fetch(input, init),
    );
    if (users.length === ids.length) return make_users_response(users);

    let response = await native_fetch(input, init);
    if (response.ok) {
      try {
        let json = await response.clone().json();
        cache_native_rows(json);
      } catch {}
    }
    return response;
  };

  XHR.prototype.open = function nte_users_api_xhr_open(method, url, ...rest) {
    this.__nte_users_guard = {
      method: String(method || "GET").toUpperCase(),
      url: String(url || ""),
      headers: {},
    };
    return native_open.call(this, method, url, ...rest);
  };

  XHR.prototype.setRequestHeader = function nte_users_api_xhr_header(
    name,
    value,
  ) {
    if (this.__nte_users_guard) {
      this.__nte_users_guard.headers[String(name || "").toLowerCase()] = String(
        value || "",
      );
    }
    return native_set_request_header.call(this, name, value);
  };

  XHR.prototype.send = function nte_users_api_xhr_send(body) {
    let meta = this.__nte_users_guard;
    if (
      !meta ||
      meta.method !== "POST" ||
      !users_batch_re.test(meta.url)
    ) {
      return native_send.call(this, body);
    }

    let ids = parse_user_ids(typeof body === "string" ? body : "");
    if (!ids.length) return native_send.call(this, body);

    let xhr = this;
    resolve_users_deduped(ids, {
      csrf: meta.headers["x-csrf-token"] || "",
      bat: meta.headers["x-bound-auth-token"] || "",
    }).then((users) => {
      if (users.length !== ids.length) {
        xhr.addEventListener("load", () => {
          try {
            if (xhr.status !== 200) return;
            if (!users_batch_re.test(String(xhr.responseURL || ""))) return;
            let json =
              xhr.responseType === "json"
                ? xhr.response
                : JSON.parse(xhr.responseText);
            cache_native_rows(json);
          } catch {}
        }, { once: true });
        native_send.call(xhr, body);
        return;
      }
      let payload = users_payload(users);
      let response_value =
        String(xhr.responseType || "") === "json"
          ? { data: users }
          : payload;
      let ready = 4;
      let status = 200;
      try {
        Object.defineProperty(xhr, "readyState", {
          configurable: true,
          get: () => ready,
        });
        Object.defineProperty(xhr, "status", {
          configurable: true,
          get: () => status,
        });
        Object.defineProperty(xhr, "statusText", {
          configurable: true,
          get: () => "OK",
        });
        Object.defineProperty(xhr, "responseText", {
          configurable: true,
          get: () => payload,
        });
        Object.defineProperty(xhr, "response", {
          configurable: true,
          get: () => response_value,
        });
        Object.defineProperty(xhr, "responseURL", {
          configurable: true,
          get: () => meta.url,
        });
        xhr.getAllResponseHeaders = () =>
          "content-type: application/json\r\n";
        xhr.getResponseHeader = (name) =>
          String(name || "").toLowerCase() === "content-type"
            ? "application/json"
            : null;
      } catch {
        native_send.call(xhr, body);
        return;
      }

      let fire = (type) => {
        try {
          if (typeof xhr["on" + type] === "function") xhr["on" + type]();
        } catch {}
        try {
          xhr.dispatchEvent(new Event(type));
        } catch {}
      };
      try {
        if (typeof xhr.onreadystatechange === "function")
          xhr.onreadystatechange();
      } catch {}
      try {
        xhr.dispatchEvent(new Event("readystatechange"));
      } catch {}
      fire("load");
      fire("loadend");
    });
  };
})();
