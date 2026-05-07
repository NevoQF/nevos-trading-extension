(function () {
  if ("undefined" === typeof globalThis.chrome && "undefined" !== typeof globalThis.browser) {
    globalThis.chrome = globalThis.browser;
  }

  function nte_mark_roblox_request_url(value) {
    try {
      let url = new URL(String(value), globalThis.location?.href || "https://www.roblox.com/");
      if (url.hostname === "roblox.com" || url.hostname.endsWith(".roblox.com")) {
        url.searchParams.set("NTERequest", "1");
        return url.toString();
      }
    } catch {}
    return value;
  }

  function nte_mark_roblox_request_input(input) {
    if ("string" === typeof input || input instanceof URL) return nte_mark_roblox_request_url(input);
    if ("undefined" !== typeof Request && input instanceof Request) {
      let url = nte_mark_roblox_request_url(input.url);
      return url === input.url ? input : new Request(url, input);
    }
    return input;
  }

  if ("function" === typeof globalThis.fetch && !globalThis.fetch.__nte_request_marked) {
    let native_fetch = globalThis.fetch.bind(globalThis);
    let marked_fetch = (input, init) => native_fetch(nte_mark_roblox_request_input(input), init);
    Object.defineProperty(marked_fetch, "__nte_request_marked", { value: true });
    globalThis.fetch = marked_fetch;
  }
})();
