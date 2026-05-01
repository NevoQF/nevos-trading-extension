(() => {
  if (globalThis.__nte_username_lookup_guard) return;
  globalThis.__nte_username_lookup_guard = true;

  const native_fetch = globalThis.fetch.bind(globalThis);
  const cache_key_prefix = "nte_username_lookup:";
  const hit_ttl_ms = 6 * 60 * 60 * 1000;
  const miss_ttl_ms = 5 * 60 * 1000;
  const memory_cache = new Map();
  const pending_fetches = new Map();

  function normalize_name(name) {
    return String(name || "").trim().toLowerCase();
  }

  function parse_lookup_key(input, init) {
    let url = typeof input === "string" ? input : input?.url || "";
    let method = String(init?.method || input?.method || "GET").toUpperCase();
    if (method !== "POST" || !/^https:\/\/users\.roblox\.com\/v1\/usernames\/users(?:\?|$)/i.test(url)) return "";
    let body = init?.body;
    if (typeof body !== "string") return "";
    try {
      let data = JSON.parse(body);
      let names = Array.isArray(data?.usernames) ? data.usernames.map(normalize_name).filter(Boolean) : [];
      return names.length ? names.sort().join("|") : "";
    } catch {
      return "";
    }
  }

  function read_cache(key) {
    let now = Date.now();
    let cached = memory_cache.get(key);
    if (cached && cached.expires_at > now) return cached;
    if (cached) memory_cache.delete(key);
    try {
      cached = JSON.parse(sessionStorage.getItem(cache_key_prefix + key) || "null");
      if (cached && cached.expires_at > now) {
        memory_cache.set(key, cached);
        return cached;
      }
      sessionStorage.removeItem(cache_key_prefix + key);
    } catch {}
    return null;
  }

  function write_cache(key, body, ttl_ms) {
    let cached = { status: 200, body: body || { data: [] }, expires_at: Date.now() + ttl_ms };
    memory_cache.set(key, cached);
    try {
      sessionStorage.setItem(cache_key_prefix + key, JSON.stringify(cached));
    } catch {}
    return cached;
  }

  function make_response(cached) {
    return new Response(JSON.stringify(cached.body || { data: [] }), {
      status: cached.status || 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  async function guarded_lookup(input, init, key) {
    try {
      let response = await native_fetch(input, init);
      if (!response.ok) return write_cache(key, { data: [] }, miss_ttl_ms);
      let body = await response.clone().json().catch(() => ({ data: [] }));
      let has_result = Array.isArray(body?.data) && body.data.length > 0;
      return write_cache(key, body && typeof body === "object" ? body : { data: [] }, has_result ? hit_ttl_ms : miss_ttl_ms);
    } catch {
      return write_cache(key, { data: [] }, miss_ttl_ms);
    }
  }

  globalThis.fetch = function nte_guarded_fetch(input, init) {
    let key = parse_lookup_key(input, init);
    if (!key) return native_fetch(input, init);

    let cached = read_cache(key);
    if (cached) return Promise.resolve(make_response(cached));

    let pending = pending_fetches.get(key);
    if (!pending) {
      pending = guarded_lookup(input, init, key).finally(() => pending_fetches.delete(key));
      pending_fetches.set(key, pending);
    }
    return pending.then(make_response);
  };
})();
