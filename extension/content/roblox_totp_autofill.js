
(function () {
  const INPUT_ID = "two-step-verification-code-input";
  const STORAGE_ENABLED = "roblox_totp_autofill_enabled";
  const STORAGE_SECRET = "roblox_totp_secret_b32";
  const STORAGE_MODE = "roblox_totp_storage_mode";
  const STORAGE_ENC = "roblox_totp_encrypted_blob";
  const ENC_VERSION = 1;
  const PBKDF2_ITERATIONS = 210000;

  const MUTATION_DEBOUNCE_MS = 280;
  const POLL_INTERVAL_MS = 1400;
  const DEEP_FIND_MIN_GAP_MS = 650;
  const SHADOW_HOOK_MIN_GAP_MS = 2000;

  const shadow_seen = new WeakSet();

  let cached_input = null;
  let last_deep_find_at = 0;
  let last_shadow_hook_at = 0;

  let session_secret = null;
  let decrypt_promise = null;

  let unlock_declined_at = 0;
  const UNLOCK_DECLINE_COOLDOWN_MS = 120000;

  function unlock_suppressed() {
    if (!unlock_declined_at) return false;
    if (Date.now() - unlock_declined_at > UNLOCK_DECLINE_COOLDOWN_MS) {
      unlock_declined_at = 0;
      return false;
    }
    return true;
  }


  function clear_session_secret() {
    session_secret = null;
  }

  function b64_to_bytes(s) {
    const bin = atob(String(s).replace(/\s/g, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function derive_aes_key(password, salt_bytes) {
    const enc = new TextEncoder();
    const key_material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt_bytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      key_material,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
  }

  async function decrypt_blob(blob, password) {
    if (!blob || blob.v !== ENC_VERSION || !blob.saltB64 || !blob.ivB64 || !blob.ctB64) throw new Error("bad blob");
    const salt = b64_to_bytes(blob.saltB64);
    const iv = b64_to_bytes(blob.ivB64);
    const ct = b64_to_bytes(blob.ctB64);
    const aes_key = await derive_aes_key(password, salt);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aes_key, ct);
    return new TextDecoder().decode(pt).trim();
  }

  function is_encrypted_storage(st) {
    if (st[STORAGE_MODE] === "encrypted") return true;
    const enc = st[STORAGE_ENC];
    return !!(enc && enc.v === ENC_VERSION && enc.saltB64 && enc.ivB64 && enc.ctB64);
  }

  function run_unlock(blob) {
    return new Promise((resolve) => {
      const existing = document.getElementById("nte-totp-unlock-dialog");
      if (existing) {
        try {
          existing.close();
        } catch {

        }
        existing.remove();
      }
      document.getElementById("nte-totp-unlock-style")?.remove();

      const style = document.createElement("style");
      style.id = "nte-totp-unlock-style";
      style.textContent = `
        #nte-totp-unlock-dialog::backdrop { background: rgba(0,0,0,0.55); }
        #nte-totp-unlock-dialog { border: none; padding: 0; background: transparent; max-width: calc(100vw - 24px); }
      `;
      document.head.appendChild(style);

      const dialog = document.createElement("dialog");
      dialog.id = "nte-totp-unlock-dialog";
      dialog.setAttribute("aria-labelledby", "nte-totp-unlock-title");
      Object.assign(dialog.style, {
        fontFamily: "system-ui,Segoe UI,Roboto,sans-serif",
        zIndex: "2147483647",
      });

      const panel = document.createElement("div");
      Object.assign(panel.style, {
        width: "min(360px,calc(100vw - 32px))",
        padding: "20px 22px",
        borderRadius: "12px",
        background: "#1e1e24",
        color: "#eee",
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
        border: "1px solid rgba(255,255,255,0.12)",
      });

      const title = document.createElement("div");
      title.id = "nte-totp-unlock-title";
      title.textContent = "Unlock 2FA autofill";
      Object.assign(title.style, { fontSize: "16px", fontWeight: "700", marginBottom: "8px" });

      const sub = document.createElement("div");
      sub.textContent =
        "Enter the password you chose in the extension. It is not saved anywhere - only you know it.";
      Object.assign(sub.style, { fontSize: "12px", lineHeight: "1.45", opacity: "0.85", marginBottom: "14px" });

      const err = document.createElement("div");
      Object.assign(err.style, {
        fontSize: "12px",
        color: "#f87171",
        marginBottom: "10px",
        minHeight: "1.2em",
      });

      const input = document.createElement("input");
      input.type = "password";
      input.id = "nte-totp-unlock-pass";
      input.name = "nte-totp-unlock-pass";
      input.autocomplete = "new-password";
      input.spellcheck = false;
      input.setAttribute("data-lpignore", "true");
      input.setAttribute("data-1p-ignore", "true");
      input.setAttribute("data-form-type", "other");
      input.placeholder = "Extension lock password";
      Object.assign(input.style, {
        width: "100%",
        boxSizing: "border-box",
        padding: "10px 12px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.2)",
        background: "#121218",
        color: "#fff",
        fontSize: "14px",
        marginBottom: "14px",
      });

      const row = document.createElement("div");
      Object.assign(row.style, { display: "flex", gap: "10px", justifyContent: "flex-end" });

      const cancel_btn = document.createElement("button");
      cancel_btn.type = "button";
      cancel_btn.textContent = "Cancel";
      Object.assign(cancel_btn.style, {
        padding: "8px 14px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.2)",
        background: "transparent",
        color: "#ccc",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: "600",
      });

      const ok_btn = document.createElement("button");
      ok_btn.type = "button";
      ok_btn.textContent = "Unlock";
      Object.assign(ok_btn.style, {
        padding: "8px 16px",
        borderRadius: "8px",
        border: "none",
        background: "#6c5ce7",
        color: "#fff",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: "700",
      });

      let settled = false;
      let refocus_id = null;
      function cleanup() {
        if (refocus_id != null) {
          clearInterval(refocus_id);
          refocus_id = null;
        }
        try {
          style.remove();
        } catch {

        }
        try {
          dialog.remove();
        } catch {

        }
      }

      function finish(value) {
        if (settled) return;
        settled = true;
        if (value === null) unlock_declined_at = Date.now();
        try {
          dialog.close();
        } catch {

        }
        cleanup();
        resolve(value);
      }

      cancel_btn.addEventListener("click", () => finish(null));

      ok_btn.addEventListener("click", async () => {
        err.textContent = "";
        const pw = input.value;
        if (!pw) {
          err.textContent = "Enter your password.";
          return;
        }
        try {
          const dec = await decrypt_blob(blob, pw);
          finish(dec.trim());
        } catch {
          err.textContent = "Wrong password - try again.";
        }
      });

      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") ok_btn.click();
      });

      dialog.addEventListener("cancel", (ev) => {
        ev.preventDefault();
        finish(null);
      });

      row.append(cancel_btn, ok_btn);
      panel.append(title, sub, err, input, row);
      dialog.append(panel);
      (document.body || document.documentElement).appendChild(dialog);

      try {
        dialog.showModal();
      } catch {
        cleanup();
        resolve(null);
        return;
      }

      refocus_id = setInterval(() => {
        if (!dialog.open) {
          clearInterval(refocus_id);
          refocus_id = null;
          return;
        }
        const ae = document.activeElement;
        if (ae && dialog.contains(ae)) return;
        input.focus({ preventScroll: true });
      }, 80);

      input.readOnly = true;
      requestAnimationFrame(() => {
        input.readOnly = false;
        input.focus({ preventScroll: true });
      });
    });
  }

  window.addEventListener("beforeunload", () => {
    clear_session_secret();
  });

  window.addEventListener("pagehide", () => {
    clear_session_secret();
  });

  function find_totp_input_deep() {
    function walk(node) {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return null;
      if (node.id === INPUT_ID) return node;
      if (node.shadowRoot) {
        const inner = walk_shadow(node.shadowRoot);
        if (inner) return inner;
      }
      for (const c of node.children) {
        const f = walk(c);
        if (f) return f;
      }
      return null;
    }
    function walk_shadow(root) {
      if (!root) return null;
      for (const c of root.children) {
        const f = walk(c);
        if (f) return f;
      }
      return null;
    }
    const de = document.documentElement;
    if (de) {
      const f = walk(de);
      if (f) return f;
    }
    return document.body ? walk(document.body) : null;
  }

  function find_totp_input() {
    if (cached_input && cached_input.isConnected && cached_input.id === INPUT_ID) {
      return cached_input;
    }
    cached_input = null;

    const light = document.getElementById(INPUT_ID);
    if (light) {
      cached_input = light;
      return light;
    }

    const now = Date.now();
    if (now - last_deep_find_at < DEEP_FIND_MIN_GAP_MS) return null;
    last_deep_find_at = now;

    const deep = find_totp_input_deep();
    if (deep) cached_input = deep;
    return deep;
  }

  function watch_shadow_roots(root, mo) {
    const visit = (node) => {
      if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.shadowRoot && !shadow_seen.has(node.shadowRoot)) {
        shadow_seen.add(node.shadowRoot);
        try {
          mo.observe(node.shadowRoot, { childList: true, subtree: true, attributes: false });
        } catch {

        }
        for (const c of node.shadowRoot.children) visit(c);
      }
      for (const c of node.children) visit(c);
    };
    visit(root);
  }

  function hook_shadow_roots(mo) {
    if (cached_input && cached_input.isConnected) return;
    const now = Date.now();
    if (now - last_shadow_hook_at < SHADOW_HOOK_MIN_GAP_MS) return;
    last_shadow_hook_at = now;
    const root = document.documentElement;
    if (root) watch_shadow_roots(root, mo);
  }

  function base32_to_bytes(b32) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const char of String(b32)
      .toUpperCase()
      .replace(/\s/g, "")
      .replace(/=+$/, "")) {
      const val = alphabet.indexOf(char);
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, "0");
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return new Uint8Array(bytes);
  }

  async function make_totp(secret_b32, digits = 6, step_sec = 30) {
    const key_bytes = base32_to_bytes(secret_b32);
    if (!key_bytes.length) return null;
    const crypto_key = await crypto.subtle.importKey("raw", key_bytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const counter = Math.floor(Date.now() / 1000 / step_sec);
    const buf = new ArrayBuffer(8);
    new DataView(buf).setBigUint64(0, BigInt(counter), false);
    const sig = await crypto.subtle.sign("HMAC", crypto_key, buf);
    const hmac = new Uint8Array(sig);
    const offset = hmac[hmac.length - 1] & 0xf;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    const mod = 10 ** digits;
    return (code % mod).toString().padStart(digits, "0");
  }

  function set_native_value(input, value) {
    try {
      const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      if (desc && desc.set) desc.set.call(input, value);
      else input.value = value;
    } catch {
      input.value = value;
    }
    try {
      input.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: value }));
    } catch {
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  let in_flight = false;

  async function try_fill(input) {
    if (!input || !input.isConnected || in_flight) return;
    if (String(input.value || "").replace(/\D/g, "").length > 0) return;

    const st = await chrome.storage.local.get([STORAGE_ENABLED, STORAGE_SECRET, STORAGE_MODE, STORAGE_ENC]);
    if (st[STORAGE_ENABLED] === false) return;

    const plain_stored = typeof st[STORAGE_SECRET] === "string" ? st[STORAGE_SECRET].trim() : "";
    const enc = st[STORAGE_ENC];
    const use_enc = is_encrypted_storage(st) && enc && enc.v === ENC_VERSION;

    let secret = null;
    if (use_enc) {
      if (session_secret) {
        secret = session_secret;
      } else {
        if (unlock_suppressed()) return;
        if (!decrypt_promise) {
          decrypt_promise = run_unlock(enc).finally(() => {
            decrypt_promise = null;
          });
        }
        secret = await decrypt_promise;
        if (!secret) return;
        session_secret = secret;
      }
    } else {
      if (!plain_stored) return;
      secret = plain_stored;
    }

    if (!secret) return;

    in_flight = true;
    try {
      try {
        const code = await make_totp(secret);
        if (!code || !input.isConnected) return;
        if (String(input.value || "").replace(/\D/g, "").length > 0) return;
        set_native_value(input, code);
      } catch {

      } finally {
        if (use_enc) {
          clear_session_secret();
          decrypt_promise = null;
        }
      }
    } finally {
      in_flight = false;
    }
  }

  let debounce_id = null;
  function schedule_scan() {
    if (debounce_id) clearTimeout(debounce_id);
    debounce_id = setTimeout(() => {
      debounce_id = null;
      run_scan();
    }, MUTATION_DEBOUNCE_MS);
  }

  function run_scan() {
    if (cached_input && cached_input.isConnected && cached_input.id === INPUT_ID) {
      void try_fill(cached_input);
      return;
    }
    cached_input = null;
    hook_shadow_roots(mo);
    const el = find_totp_input();
    if (!el) unlock_declined_at = 0;
    if (el) void try_fill(el);
  }

  const mo = new MutationObserver(() => {
    schedule_scan();
  });

  function start() {
    try {
      mo.observe(document.documentElement, { childList: true, subtree: true, attributes: false });
    } catch {

    }
    schedule_scan();
    setInterval(() => {
      if (document.visibilityState !== "visible") return;
      run_scan();
    }, POLL_INTERVAL_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!changes[STORAGE_ENABLED] && !changes[STORAGE_SECRET] && !changes[STORAGE_MODE] && !changes[STORAGE_ENC]) return;
    clear_session_secret();
    unlock_declined_at = 0;
    const unlock_dlg = document.getElementById("nte-totp-unlock-dialog");
    if (unlock_dlg) {
      try {
        unlock_dlg.close();
      } catch {

      }
      unlock_dlg.remove();
    }
    document.getElementById("nte-totp-unlock-style")?.remove();
    cached_input = null;
    last_deep_find_at = 0;
    const el = find_totp_input();
    if (el) void try_fill(el);
  });
})();
