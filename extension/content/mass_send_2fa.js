(function () {
  const DIALOG_ID = "nte-ms-2fa-dialog";
  const STYLE_ID = "nte-ms-2fa-style";

  function remove_existing() {
    document.getElementById(DIALOG_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
  }

  function show_dialog({ title, subtitle, stats, mode }) {
    return new Promise((resolve) => {
      remove_existing();

      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        #${DIALOG_ID}::backdrop { background: rgba(0,0,0,0.58); }
        #${DIALOG_ID} {
          border: none;
          padding: 0;
          background: transparent;
          max-width: calc(100vw - 24px);
        }
      `;
      document.head.appendChild(style);

      const dialog = document.createElement("dialog");
      dialog.id = DIALOG_ID;
      dialog.setAttribute("aria-labelledby", "nte-ms-2fa-title");
      Object.assign(dialog.style, {
        fontFamily: "system-ui,Segoe UI,Roboto,sans-serif",
        zIndex: "2147483647",
      });

      const panel = document.createElement("div");
      Object.assign(panel.style, {
        width: "min(400px, calc(100vw - 32px))",
        padding: "22px 24px",
        borderRadius: "14px",
        background: "#16161c",
        color: "#eee",
        boxShadow: "0 18px 48px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.12)",
      });

      const title_el = document.createElement("div");
      title_el.id = "nte-ms-2fa-title";
      title_el.textContent = title;
      Object.assign(title_el.style, {
        fontSize: "17px",
        fontWeight: "750",
        marginBottom: "6px",
      });

      const sub_el = document.createElement("div");
      sub_el.textContent = subtitle;
      Object.assign(sub_el.style, {
        fontSize: "12px",
        lineHeight: "1.45",
        opacity: "0.85",
        marginBottom: "14px",
      });

      if (stats && typeof stats === "object") {
        const grid = document.createElement("div");
        Object.assign(grid.style, {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginBottom: "14px",
        });
        const rows = [
          ["Sent", stats.sent],
          ["Failed", stats.failed],
          ["Skipped", stats.skipped],
          ["Remaining", stats.remaining],
        ];
        for (const [label, value] of rows) {
          const cell = document.createElement("div");
          Object.assign(cell.style, {
            padding: "8px 10px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          });
          const lab = document.createElement("div");
          lab.textContent = label;
          Object.assign(lab.style, {
            fontSize: "11px",
            opacity: "0.7",
            marginBottom: "2px",
          });
          const val = document.createElement("div");
          val.textContent = String(value ?? 0);
          Object.assign(val.style, { fontSize: "16px", fontWeight: "700" });
          cell.append(lab, val);
          grid.append(cell);
        }
        panel.append(title_el, sub_el, grid);
      } else {
        panel.append(title_el, sub_el);
      }

      const err = document.createElement("div");
      Object.assign(err.style, {
        fontSize: "12px",
        color: "#f87171",
        marginBottom: "8px",
        minHeight: "1.1em",
      });

      const input = document.createElement("input");
      input.type = mode === "unlock" ? "password" : "text";
      input.inputMode = mode === "unlock" ? "text" : "numeric";
      input.autocomplete = "one-time-code";
      input.spellcheck = false;
      input.placeholder =
        mode === "unlock" ? "Extension lock password" : "6-digit code";
      if (mode !== "unlock") {
        input.maxLength = 8;
        input.pattern = "[0-9]*";
      }
      Object.assign(input.style, {
        width: "100%",
        boxSizing: "border-box",
        padding: "11px 12px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.2)",
        background: "#0f0f14",
        color: "#fff",
        fontSize: mode === "unlock" ? "14px" : "20px",
        letterSpacing: mode === "unlock" ? "normal" : "0.18em",
        textAlign: mode === "unlock" ? "left" : "center",
        marginBottom: "14px",
      });

      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex",
        gap: "10px",
        justifyContent: "flex-end",
      });

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
      ok_btn.textContent = mode === "unlock" ? "Unlock" : "Continue";
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
      function finish(value) {
        if (settled) return;
        settled = true;
        try {
          dialog.close();
        } catch {}
        remove_existing();
        resolve(value);
      }

      cancel_btn.addEventListener("click", () => finish(null));
      ok_btn.addEventListener("click", () => {
        err.textContent = "";
        const raw = String(input.value || "").trim();
        if (mode === "unlock") {
          if (!raw) {
            err.textContent = "Enter your password.";
            return;
          }
          finish(raw);
          return;
        }
        const code = raw.replace(/\D/g, "");
        if (code.length !== 6) {
          err.textContent = "Enter the 6-digit authenticator code.";
          return;
        }
        finish(code);
      });
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") ok_btn.click();
      });
      dialog.addEventListener("cancel", (ev) => {
        ev.preventDefault();
        finish(null);
      });

      row.append(cancel_btn, ok_btn);
      panel.append(err, input, row);
      dialog.append(panel);
      (document.body || document.documentElement).appendChild(dialog);

      try {
        dialog.showModal();
      } catch {
        remove_existing();
        resolve(null);
        return;
      }

      requestAnimationFrame(() => {
        input.focus({ preventScroll: true });
      });
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "ms_2fa_code_prompt") {
      show_dialog({
        title: "Enter 2FA code",
        subtitle:
          "Mass Sending needs your Roblox authenticator code to keep sending trades.",
        stats: message.stats || null,
        mode: "code",
      }).then((code) => {
        sendResponse({ ok: !!code, code: code || null });
      });
      return true;
    }
    if (message.type === "ms_2fa_unlock_prompt") {
      show_dialog({
        title: "Unlock 2FA secret",
        subtitle:
          "Your saved 2FA secret is password-locked. Unlock it so Mass Sending can verify automatically.",
        stats: message.stats || null,
        mode: "unlock",
      }).then((password) => {
        sendResponse({ ok: !!password, password: password || null });
      });
      return true;
    }
  });
})();
