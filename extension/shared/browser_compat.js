(function () {
  if ("undefined" === typeof globalThis.chrome && "undefined" !== typeof globalThis.browser) {
    globalThis.chrome = globalThis.browser;
  }

  // Chrome invalidates old content-script contexts after reload/update/disable.
  // Call sites should check this before chrome.runtime / chrome.storage use.
  if (typeof globalThis.nte_extension_alive !== "function") {
    globalThis.nte_extension_alive = function nte_extension_alive() {
      try {
        return !!(globalThis.chrome && chrome.runtime && chrome.runtime.id);
      } catch {
        return false;
      }
    };
  }

  // Problem reports: uncaught extension errors and failed extension requests from every
  // context (pages, popup, worker) are kept in the worker's lists for this browser session.
  // Nothing leaves the browser unless the user files a report from the popup.
  // Firefox never passes content-script errors to listeners, so there pages only add requests.
  if (!globalThis.nte_diag) {
    let base = "";
    try {
      base = chrome.runtime.getURL("");
    } catch {}
    // In Firefox content scripts globalThis is a sandbox; window is the page's window.
    let win = typeof window === "object" && window ? window : globalThis;
    let on_page = /^https?:$/.test(win.location?.protocol || "");
    // The worker, or Firefox's background page before background.js (loaded last) sets the sink.
    let in_background = !on_page && (typeof document === "undefined" || /background/.test(win.location?.pathname || ""));
    let budget = 60;
    let busy = false;
    let benign =
      /Extension context invalidated|Receiving end does not exist|message (?:port|channel) closed|ResizeObserver loop|AbortError|The user aborted/i;
    // Query strings and fragments dropped from every URL in the text (a stack frame keeps its
    // :line:col), then extension paths shortened.
    let tidy = (value, max) =>
      String(value ?? "")
        .replace(/(\b[a-z][\w+.-]*:\/\/[^\s?#)]*)[?#][^\s)]*?((?::\d+){0,2})(?=[\s)]|$)/gi, "$1$2")
        .split(base || "\u0000")
        .join("ext/")
        .slice(0, max);
    let page_host = /^(?:www\.)?(?:roblox|rolimons)\.com$/;
    // Host and path only, with digits and token-like segments masked. Page addresses keep just the
    // page type (no item, game or group names), APIs keep their path, other hosts 3 segments.
    let clean_url = (value, keep = 0) => {
      try {
        let url = new URL(String(value), win.location?.href);
        let parts = url.pathname.split("/").filter(Boolean);
        if (base && url.href.startsWith(base)) return `ext/${parts.join("/")}`;
        let limit =
          keep || (page_host.test(url.hostname) ? 2 : /(^|\.)(roblox|rolimons|rbxcdn)\.com$/.test(url.hostname) ? 12 : 3);
        parts = parts
          .slice(0, limit)
          .map((part) => (/^\d+$/.test(part) ? "{n}" : part.length > 24 || /\d{4,}/.test(part) ? "{x}" : part));
        return `${url.hostname}/${parts.join("/")}`.slice(0, 200);
      } catch {
        return "";
      }
    };
    let diag = {
      errors: [],
      requests: [],
      // The worker sets this to keep entries itself; everywhere else forwards them.
      sink: null,
      clean_url,
    };
    globalThis.nte_diag = diag;
    let where = typeof document === "undefined" ? "worker" : clean_url(win.location?.href, 1);
    let send = (list, entry) => {
      if (diag.sink) return diag.sink(list, entry);
      // Early background code: keep it here; background.js merges these lists on start.
      if (in_background) return diag[list].length < 60 && diag[list].push(entry);
      if (budget <= 0 || !globalThis.nte_extension_alive()) return;
      budget -= 1;
      try {
        chrome.runtime.sendMessage({ type: "nte_diag", list, entry })?.catch?.(() => {});
      } catch {}
    };
    diag.note_error = (kind, error, file) => {
      if (busy) return;
      busy = true;
      try {
        let message = tidy(error?.message ?? error, 300);
        if (!message || benign.test(message) || benign.test(error?.name || "")) return;
        send("errors", { at: Date.now(), kind, where, message, stack: tidy(error?.stack || file, 900) });
      } finally {
        busy = false;
      }
    };
    diag.note_request = (input, status, started) => {
      let url = clean_url(input?.url || input);
      if (url) send("requests", { at: Date.now(), where, url, status, ms: Date.now() - started });
    };
    let ours = (text) => !on_page || (!!base && String(text || "").includes(base));
    win.addEventListener?.("error", (event) => {
      if (!ours(event?.filename) && !ours(event?.error?.stack)) return;
      diag.note_error("uncaught", event.error || event.message, event.filename);
    });
    win.addEventListener?.("unhandledrejection", (event) => {
      if (ours(event?.reason?.stack)) diag.note_error("unhandled", event.reason);
    });
    // "Page details" for a report: asked for by the popup, top frame only.
    if (on_page && win.top === win) {
      try {
        chrome.runtime.onMessage.addListener((message, _sender, respond) => {
          if (message?.type !== "nte_report_page") return false;
          let body_classes = document.body?.classList;
          respond({
            url: `${location.origin}${location.pathname}`,
            title: document.title.slice(0, 200),
            viewport: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
            theme: body_classes?.contains("light-theme") ? "light" : body_classes?.contains("dark-theme") ? "dark" : "",
            language: document.documentElement.lang || "",
            // "nte" at a class start, not inside words like "content-".
            extension_elements: document.querySelectorAll('[class^="nte"], [class*=" nte"], [id^="nte"]').length,
            // A 2FA code box or account settings may be on screen: the popup unticks the screenshot.
            sensitive:
              !!document.getElementById("two-step-verification-code-input") ||
              /\/my\/account/.test(location.pathname),
          });
          return false;
        });
      } catch {}
    }
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

  // Once per context: username_lookup_guard.js wraps fetch again, and a later copy of this
  // file must not wrap that wrapper (it would count every failure twice).
  if ("function" === typeof globalThis.fetch && !globalThis.__nte_fetch_marked) {
    globalThis.__nte_fetch_marked = true;
    let native_fetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (input, init) => {
      let started = Date.now();
      return native_fetch(nte_mark_roblox_request_input(input), init).then(
        (response) => {
          // A 403 carrying x-csrf-token is Roblox's normal token handshake, not a failure.
          let handshake = response.status === 403 && response.headers.has("x-csrf-token");
          if (response.status >= 400 && !handshake)
            globalThis.nte_diag?.note_request(input, response.status, started);
          return response;
        },
        (error) => {
          if (error?.name !== "AbortError")
            globalThis.nte_diag?.note_request(
              input,
              error?.name === "TimeoutError" ? "timeout" : "network",
              started,
            );
          throw error;
        },
      );
    };
  }
})();
