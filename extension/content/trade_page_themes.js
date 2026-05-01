(() => {
  const style_id = "nte-trade-page-theme-style";
  const upload_style_id = "nte-trade-page-theme-upload-style";
  const upload_modal_id = "nte-trade-page-theme-upload-modal";
  const enabled_key = "trade_page_theme_enabled";
  const theme_key = "trade_page_theme";
  const custom_themes_key = "trade_page_custom_themes";
  const default_image_overlay = 72;
  const recommended_image_width = 1920;
  const recommended_image_height = 1080;
  const default_theme = {
    name: "Obsidian",
    background: "#0f1117",
    accent: "#6ea8fe",
    accent2: "#a78bfa",
    effect: "nebula",
  };
  const theme_effects = new Set(["nebula", "lightning", "aurora", "ember", "frost", "petals", "circuit", "royal", "sheen", "image"]);

  let last_path = "";

  function is_trade_page() {
    return /^\/(?:[a-z]{2}\/)?trades\/?$/i.test(location.pathname);
  }

  function normalize_hex_color(value, fallback) {
    let color = String(value || "").trim();
    if (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(color)) color = `#${color}`;
    if (/^#[0-9a-f]{3}$/i.test(color)) {
      color = `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
    }
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
  }

  function normalize_theme_image(value) {
    let image = String(value || "").trim();
    return /^data:image\/(?:png|jpe?g|webp);base64,/i.test(image) ? image : "";
  }

  function fit_image_to_recommended(data_url, background) {
    return new Promise((resolve) => {
      let image = new Image();
      image.onload = () => {
        try {
          let canvas = document.createElement("canvas");
          canvas.width = recommended_image_width;
          canvas.height = recommended_image_height;
          let ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(data_url);
            return;
          }
          ctx.fillStyle = normalize_hex_color(background, default_theme.background);
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          let scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
          let width = Math.max(1, Math.round(image.naturalWidth * scale));
          let height = Math.max(1, Math.round(image.naturalHeight * scale));
          let x = Math.round((canvas.width - width) / 2);
          let y = Math.round((canvas.height - height) / 2);
          ctx.drawImage(image, x, y, width, height);
          resolve(canvas.toDataURL("image/webp", 0.9));
        } catch {
          resolve(data_url);
        }
      };
      image.onerror = () => resolve(data_url);
      image.src = data_url;
    });
  }

  function normalize_image_overlay(value) {
    let amount = Number(value);
    return Number.isFinite(amount) ? Math.max(0, Math.min(90, Math.round(amount))) : default_image_overlay;
  }

  function hex_to_rgba(hex, alpha) {
    let color = normalize_hex_color(hex, "#000000").slice(1);
    let r = parseInt(color.slice(0, 2), 16);
    let g = parseInt(color.slice(2, 4), 16);
    let b = parseInt(color.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function hex_to_rgb_tuple(hex) {
    let color = normalize_hex_color(hex, "#000000").slice(1);
    return [parseInt(color.slice(0, 2), 16), parseInt(color.slice(2, 4), 16), parseInt(color.slice(4, 6), 16)];
  }

  function rgb_tuple_to_hex(parts) {
    return `#${parts.map((part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, "0")).join("")}`;
  }

  function mix_hex_color(from, to, weight) {
    let a = hex_to_rgb_tuple(from);
    let b = hex_to_rgb_tuple(to);
    return rgb_tuple_to_hex(a.map((part, index) => part + (b[index] - part) * weight));
  }

  function get_color_luma(hex) {
    let [r, g, b] = hex_to_rgb_tuple(hex).map((part) => {
      let channel = part / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function svg_data_uri(svg) {
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  function normalize_theme_effect(value) {
    let effect = String(value || "").trim().toLowerCase();
    return theme_effects.has(effect) ? effect : default_theme.effect;
  }

  function normalize_theme(value) {
    let source = value && typeof value === "object" ? value : {};
    let background = normalize_hex_color(source.background, default_theme.background);
    let accent = normalize_hex_color(source.accent, default_theme.accent);
    let accent2 = normalize_hex_color(source.accent2, mix_hex_color(accent, background, 0.35));
    let image = normalize_theme_image(source.image);
    let is_dark = get_color_luma(background) < 0.45;
    let shade = is_dark ? "#ffffff" : "#000000";
    let text = is_dark ? "#f8fafc" : "#111827";
    return {
      background,
      surface: mix_hex_color(background, shade, is_dark ? 0.08 : 0.035),
      surface2: mix_hex_color(background, shade, is_dark ? 0.14 : 0.07),
      text,
      muted: mix_hex_color(text, background, is_dark ? 0.42 : 0.48),
      accent,
      accent2,
      border: mix_hex_color(background, shade, is_dark ? 0.22 : 0.14),
      effect: image ? "image" : normalize_theme_effect(source.effect),
      image,
      image_overlay: image ? normalize_image_overlay(source.image_overlay) : default_image_overlay,
    };
  }

  function get_theme_backdrop(theme) {
    let accent_soft = hex_to_rgba(theme.accent, 0.14);
    let accent_mid = hex_to_rgba(theme.accent, 0.24);
    let accent2_soft = hex_to_rgba(theme.accent2, 0.15);
    let accent2_mid = hex_to_rgba(theme.accent2, 0.28);
    if (theme.effect === "image" && theme.image) {
      let overlay = theme.image_overlay / 100;
      let overlay_strong = Math.min(0.96, overlay * 1.22);
      let image_accent = Math.min(0.24, overlay * 0.2);
      return `
        linear-gradient(135deg, ${hex_to_rgba(theme.background, overlay)}, ${hex_to_rgba(theme.background, overlay_strong)}),
        radial-gradient(circle at 18% 12%, ${hex_to_rgba(theme.accent, image_accent)}, transparent 34%),
        url("${theme.image}"),
        ${theme.background}
      `;
    }
    if (theme.effect === "lightning") {
      let storm = svg_data_uri(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760">
          <defs>
            <filter id="noise">
              <feTurbulence type="fractalNoise" baseFrequency=".012 .035" numOctaves="3" seed="8"/>
              <feColorMatrix values="0 0 0 0 0.2 0 0 0 0 0.55 0 0 0 0 1 0 0 0 .28 0"/>
            </filter>
            <filter id="glow">
              <feGaussianBlur stdDeviation="7" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="${theme.background}"/>
              <stop offset=".48" stop-color="${mix_hex_color(theme.background, theme.accent, 0.18)}"/>
              <stop offset="1" stop-color="${mix_hex_color(theme.background, theme.accent2, 0.12)}"/>
            </linearGradient>
          </defs>
          <rect width="1200" height="760" fill="url(#sky)"/>
          <rect width="1200" height="760" filter="url(#noise)" opacity=".46"/>
          <path d="M860 -30 710 188 790 188 640 430 730 325 705 530 890 228 808 228 935 -30Z" fill="${theme.accent2}" opacity=".34" filter="url(#glow)"/>
          <path d="M845 0 735 174 804 174 680 356 756 282 736 438 876 206 803 206 905 0Z" fill="${theme.accent}" opacity=".48" filter="url(#glow)"/>
          <path d="M180 88 C310 22 442 25 574 92 S844 162 1015 76" fill="none" stroke="${theme.accent}" stroke-width="2" opacity=".24"/>
          <path d="M0 620 C230 560 394 645 620 590 S960 560 1200 610" fill="none" stroke="${theme.accent2}" stroke-width="3" opacity=".18"/>
        </svg>
      `);
      return `
        ${storm},
        radial-gradient(circle at 72% 10%, ${accent_soft}, transparent 30%),
        ${theme.background}
      `;
    }
    if (theme.effect === "aurora") {
      return `
        radial-gradient(ellipse at 12% 16%, ${accent_mid}, transparent 38%),
        radial-gradient(ellipse at 80% 8%, ${accent2_mid}, transparent 36%),
        linear-gradient(130deg, ${theme.background}, ${mix_hex_color(theme.background, theme.accent, 0.12)})
      `;
    }
    if (theme.effect === "circuit") {
      return `
        linear-gradient(90deg, ${hex_to_rgba(theme.accent, 0.11)} 1px, transparent 1px),
        linear-gradient(0deg, ${hex_to_rgba(theme.accent2, 0.09)} 1px, transparent 1px),
        ${theme.background}
      `;
    }
    if (theme.effect === "ember") {
      return `
        radial-gradient(circle at 18% 90%, ${accent2_mid}, transparent 36%),
        radial-gradient(circle at 80% 8%, ${accent_soft}, transparent 34%),
        linear-gradient(145deg, ${theme.background}, ${mix_hex_color(theme.background, theme.accent, 0.14)})
      `;
    }
    if (theme.effect === "frost") {
      return `
        radial-gradient(circle at 20% 18%, ${accent_soft}, transparent 34%),
        linear-gradient(135deg, ${mix_hex_color(theme.background, theme.accent2, 0.14)}, ${theme.background})
      `;
    }
    if (theme.effect === "petals") {
      return `
        radial-gradient(circle at 18% 22%, ${accent2_soft}, transparent 24%),
        radial-gradient(circle at 74% 18%, ${accent_soft}, transparent 30%),
        ${theme.background}
      `;
    }
    if (theme.effect === "royal") {
      return `
        radial-gradient(circle at 74% 12%, ${accent2_soft}, transparent 28%),
        linear-gradient(145deg, ${theme.background}, ${mix_hex_color(theme.background, theme.accent, 0.16)})
      `;
    }
    if (theme.effect === "sheen") {
      return `
        linear-gradient(120deg, transparent 0 20%, ${hex_to_rgba(theme.accent, 0.08)} 42%, transparent 68%),
        ${theme.background}
      `;
    }
    return `
      radial-gradient(circle at 16% 12%, ${accent_soft}, transparent 34%),
      radial-gradient(circle at 84% 10%, ${accent2_soft}, transparent 32%),
      ${theme.background}
    `;
  }

  function get_storage(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (result) => resolve(result || {}));
      } catch {
        resolve({});
      }
    });
  }

  function set_storage(values) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(values, () => resolve());
      } catch {
        resolve();
      }
    });
  }

  function pack_theme(source) {
    let normalized = normalize_theme(source);
    return {
      name: String(source?.name || "Custom theme").trim().slice(0, 32) || "Custom theme",
      background: normalize_hex_color(source?.background, default_theme.background),
      accent: normalize_hex_color(source?.accent, default_theme.accent),
      accent2: normalize_hex_color(source?.accent2, mix_hex_color(normalize_hex_color(source?.accent, default_theme.accent), normalize_hex_color(source?.background, default_theme.background), 0.35)),
      effect: normalized.effect,
      image: normalized.image,
      ...(normalized.image ? { image_overlay: normalized.image_overlay } : {}),
    };
  }

  function normalize_custom_themes(value) {
    return Array.isArray(value) ? value.map(pack_theme).filter((theme) => theme.name).slice(0, 16) : [];
  }

  function ensure_upload_style() {
    if (document.getElementById(upload_style_id)) return;
    let style = document.createElement("style");
    style.id = upload_style_id;
    style.textContent = `
      #${upload_modal_id} {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(6, 8, 13, 0.58);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        font-family: Builder Sans, Arial, sans-serif;
      }

      #${upload_modal_id}[hidden] {
        display: none;
      }

      #${upload_modal_id} .nte-theme-upload-panel {
        width: min(392px, 100%);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 16px;
        background:
          radial-gradient(circle at 18% 0%, rgba(110, 168, 254, 0.2), transparent 34%),
          linear-gradient(145deg, #181c27, #10131b);
        color: #f8fafc;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 22px 70px rgba(0, 0, 0, 0.48);
        padding: 16px;
        animation: nte-theme-upload-in 160ms ease-out;
      }

      @keyframes nte-theme-upload-in {
        from {
          opacity: 0;
          transform: translateY(6px) scale(0.985);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      #${upload_modal_id} .nte-theme-upload-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }

      #${upload_modal_id} .nte-theme-upload-kicker {
        display: block;
        margin-bottom: 4px;
        color: rgba(248, 250, 252, 0.52);
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      #${upload_modal_id} h3 {
        margin: 0;
        font-size: 18px;
        line-height: 1.2;
      }

      #${upload_modal_id} p {
        margin: 0 0 12px;
        color: rgba(248, 250, 252, 0.66);
        font-size: 12px;
        line-height: 1.45;
      }

      #${upload_modal_id} button {
        min-height: 34px;
        padding: 0 12px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.08);
        color: #f8fafc;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        transition: transform 120ms ease, border-color 120ms ease, background 120ms ease, color 120ms ease;
      }

      #${upload_modal_id} button:hover {
        background: rgba(255, 255, 255, 0.13);
      }

      #${upload_modal_id} button:active {
        transform: translateY(1px) scale(0.99);
      }

      #${upload_modal_id} .nte-theme-upload-primary {
        background: #6ea8fe;
        border-color: #6ea8fe;
        color: #0f1117;
      }

      #${upload_modal_id} .nte-theme-upload-choose {
        width: 100%;
        min-height: 78px;
        display: grid;
        grid-template-columns: 42px 1fr;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 14px;
        border-style: dashed;
        background: rgba(255, 255, 255, 0.065);
        text-align: left;
      }

      #${upload_modal_id} .nte-theme-upload-choose:hover {
        border-color: rgba(110, 168, 254, 0.62);
        background: rgba(110, 168, 254, 0.1);
      }

      #${upload_modal_id} .nte-theme-upload-choose-icon {
        width: 42px;
        height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        background: rgba(110, 168, 254, 0.16);
        color: #9cc6ff;
      }

      #${upload_modal_id} .nte-theme-upload-choose svg {
        width: 21px;
        height: 21px;
      }

      #${upload_modal_id} .nte-theme-upload-choose strong,
      #${upload_modal_id} .nte-theme-upload-name label span {
        display: block;
        color: #f8fafc;
        font-size: 13px;
        font-weight: 900;
      }

      #${upload_modal_id} .nte-theme-upload-choose small {
        display: block;
        margin-top: 3px;
        color: rgba(248, 250, 252, 0.56);
        font-size: 11px;
        font-weight: 700;
      }

      #${upload_modal_id} .nte-theme-upload-fit {
        display: grid;
        grid-template-columns: 18px 1fr;
        gap: 8px;
        align-items: start;
        margin: 10px 0 0;
        padding: 10px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.055);
        cursor: pointer;
      }

      #${upload_modal_id} .nte-theme-upload-fit input {
        width: 16px;
        height: 16px;
        margin: 2px 0 0;
        accent-color: #6ea8fe;
      }

      #${upload_modal_id} .nte-theme-upload-fit strong,
      #${upload_modal_id} .nte-theme-upload-fit small {
        display: block;
      }

      #${upload_modal_id} .nte-theme-upload-fit strong {
        color: #f8fafc;
        font-size: 12px;
        font-weight: 900;
      }

      #${upload_modal_id} .nte-theme-upload-fit small {
        margin-top: 3px;
        color: rgba(248, 250, 252, 0.56);
        font-size: 11px;
        font-weight: 700;
        line-height: 1.35;
      }

      #${upload_modal_id} .nte-theme-upload-file {
        display: inline-flex;
        align-items: center;
        min-height: 26px;
        max-width: 100%;
        margin: 2px 0 12px;
        padding: 5px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        color: rgba(248, 250, 252, 0.78);
        font-size: 11px;
        font-weight: 800;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #${upload_modal_id} .nte-theme-upload-x {
        width: 34px;
        padding: 0;
        border-radius: 999px;
      }

      #${upload_modal_id} .nte-theme-upload-name {
        display: grid;
        gap: 10px;
        margin-top: 4px;
        padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.07);
      }

      #${upload_modal_id} .nte-theme-upload-name[hidden] {
        display: none;
      }

      #${upload_modal_id} input[type="text"] {
        width: 100%;
        height: 40px;
        box-sizing: border-box;
        padding: 0 12px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 10px;
        background: rgba(5, 8, 14, 0.36);
        color: #f8fafc;
        font: inherit;
        font-size: 14px;
        font-weight: 800;
        margin-top: 6px;
      }

      #${upload_modal_id} input[type="text"]:focus {
        outline: none;
        border-color: #6ea8fe;
        box-shadow: 0 0 0 3px rgba(110, 168, 254, 0.18);
      }

      #${upload_modal_id} .nte-theme-upload-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      #${upload_modal_id} .nte-theme-upload-actions button {
        flex: 1 1 0;
      }

      #${upload_modal_id} .nte-theme-upload-status {
        min-height: 16px;
        margin-top: 10px;
        color: rgba(248, 250, 252, 0.72);
        font-size: 12px;
        font-weight: 700;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function open_upload_modal(open_picker = false, initial_upload = null, initial_file_name = "", initial_status = "") {
    ensure_upload_style();
    document.getElementById(upload_modal_id)?.remove();
    let modal = document.createElement("div");
    modal.id = upload_modal_id;
    modal.innerHTML = `
      <div class="nte-theme-upload-panel" role="dialog" aria-modal="true" aria-label="Upload trade page theme">
        <div class="nte-theme-upload-head">
          <div>
            <span class="nte-theme-upload-kicker">Trade page theme</span>
            <h3>Upload theme</h3>
          </div>
          <button type="button" class="nte-theme-upload-x" data-close aria-label="Close">x</button>
        </div>
        <p data-copy>Select a custom background image or an exported theme file. Recommended image size: 1920 x 1080.</p>
        <input type="file" accept=".json,application/json,image/png,image/jpeg,image/webp" hidden data-file />
        <button type="button" class="nte-theme-upload-choose" data-choose>
          <span class="nte-theme-upload-choose-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 16V5m0 0 4 4m-4-4L8 9M5 19h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span>
            <strong>Choose file</strong>
            <small>PNG, JPG, WebP, or theme JSON</small>
          </span>
        </button>
        <label class="nte-theme-upload-fit">
          <input type="checkbox" data-fit checked />
          <span>
            <strong>Fit image to 1920 x 1080</strong>
            <small>Attempts to scale the whole image into the recommended size before saving.</small>
          </span>
        </label>
        <div class="nte-theme-upload-name" data-name-panel hidden>
          <div class="nte-theme-upload-file" data-file-name></div>
          <label>
            <span>Theme name</span>
            <input type="text" maxlength="32" spellcheck="false" data-name placeholder="Theme name" />
          </label>
          <div class="nte-theme-upload-actions">
            <button type="button" class="nte-theme-upload-primary" data-save>Save theme</button>
            <button type="button" data-cancel>Cancel</button>
          </div>
        </div>
        <div class="nte-theme-upload-status" data-status></div>
      </div>
    `;
    document.documentElement.appendChild(modal);

    let file_input = modal.querySelector("[data-file]");
    let name_panel = modal.querySelector("[data-name-panel]");
    let file_name = modal.querySelector("[data-file-name]");
    let name_input = modal.querySelector("[data-name]");
    let choose_btn = modal.querySelector("[data-choose]");
    let fit_input = modal.querySelector("[data-fit]");
    let copy_el = modal.querySelector("[data-copy]");
    let status = modal.querySelector("[data-status]");
    let pending_upload = null;

    function set_status(message) {
      status.textContent = message || "";
    }

    function close_modal() {
      modal.remove();
    }

    function show_name_panel(uploaded, file) {
      pending_upload = uploaded;
      file_name.textContent = file.name;
      name_input.value = String(uploaded.name || file.name.replace(/\.[^.]+$/, "") || "Custom theme").trim().slice(0, 32);
      name_panel.hidden = false;
      choose_btn.hidden = true;
      copy_el.textContent = "Now name it so it shows up in your theme list.";
      set_status("");
      name_input.focus();
      name_input.select();
    }

    async function save_pending_upload() {
      if (!pending_upload) return;
      let name = name_input.value.trim();
      if (!name) {
        set_status("Name the theme first.");
        name_input.focus();
        return;
      }
      let saved = await get_storage([custom_themes_key]);
      let packed = pack_theme({ ...pending_upload, name });
      let custom_themes = normalize_custom_themes(saved[custom_themes_key]);
      custom_themes = [packed, ...custom_themes.filter((item) => item.name.toLowerCase() !== packed.name.toLowerCase())].slice(0, 16);
      await set_storage({
        [custom_themes_key]: custom_themes,
        [enabled_key]: true,
        [theme_key]: packed,
      });
      apply_theme(normalize_theme(packed));
      set_status(`${packed.name} saved.`);
      setTimeout(close_modal, 450);
    }

    modal.querySelector("[data-close]").addEventListener("click", close_modal);
    modal.querySelector("[data-choose]").addEventListener("click", () => file_input.click());
    modal.querySelector("[data-save]").addEventListener("click", save_pending_upload);
    modal.querySelector("[data-cancel]").addEventListener("click", close_modal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) close_modal();
    });
    name_input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") save_pending_upload();
      if (event.key === "Escape") close_modal();
    });
    file_input.addEventListener("change", async () => {
      let file = file_input.files?.[0];
      if (!file) return;
      let is_image = file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name);
      if (is_image && file.size > 3 * 1024 * 1024) {
        set_status("Theme image must be under 3 MB.");
        file_input.value = "";
        return;
      }
      let saved = await get_storage([theme_key]);
      let base = normalize_theme(saved[theme_key]);
      let reader = new FileReader();
      reader.onload = async () => {
        try {
          let image_data = String(reader.result || "");
          if (is_image && fit_input.checked) {
            set_status("Fitting image to 1920 x 1080...");
            image_data = await fit_image_to_recommended(image_data, base.background);
          }
          let uploaded =
            is_image
              ? {
                  name: "",
                  background: base.background,
                  accent: base.accent,
                  accent2: base.accent2,
                  effect: "image",
                  image: image_data,
                  image_overlay: default_image_overlay,
                }
              : JSON.parse(String(reader.result || "{}"));
          if (is_image && !normalize_theme_image(uploaded.image)) {
            set_status("Theme image must be PNG, JPG, or WebP.");
            file_input.value = "";
            return;
          }
          show_name_panel(uploaded, file);
        } catch {
          set_status("Theme file must be valid JSON.");
          file_input.value = "";
        }
      };
      reader.onerror = () => {
        set_status("Could not read theme file.");
        file_input.value = "";
      };
      if (is_image) reader.readAsDataURL(file);
      else reader.readAsText(file);
    });
    if (initial_upload) show_name_panel(initial_upload, { name: initial_file_name || initial_upload.name || "theme" });
    if (initial_status) set_status(initial_status);
    if (open_picker) file_input.click();
  }

  function remove_theme() {
    document.documentElement.classList.remove("nte-trade-page-theme");
    document.getElementById(style_id)?.remove();
  }

  function apply_theme(theme) {
    let root = document.documentElement;
    let style = document.getElementById(style_id);
    if (!style) {
      style = document.createElement("style");
      style.id = style_id;
      (document.head || document.documentElement).appendChild(style);
    }

    root.classList.add("nte-trade-page-theme");
    let backdrop = get_theme_backdrop(theme);
    style.textContent = `
      html.nte-trade-page-theme {
        --nte-trade-bg: ${theme.background};
        --nte-trade-surface: ${theme.surface};
        --nte-trade-surface-2: ${theme.surface2};
        --nte-trade-text: ${theme.text};
        --nte-trade-muted: ${theme.muted};
        --nte-trade-accent: ${theme.accent};
        --nte-trade-accent-2: ${theme.accent2};
        --nte-trade-border: ${theme.border};
        --nte-trade-accent-soft: ${hex_to_rgba(theme.accent, 0.18)};
        --nte-trade-border-soft: ${hex_to_rgba(theme.border, 0.62)};
      }

      html.nte-trade-page-theme body,
      html.nte-trade-page-theme #rbx-body,
      html.nte-trade-page-theme .container-main:has(.trades-container),
      html.nte-trade-page-theme .content:has(.trades-container),
      html.nte-trade-page-theme #footer-container,
      html.nte-trade-page-theme .container-footer,
      html.nte-trade-page-theme .footer {
        background: ${backdrop} !important;
        background-attachment: fixed !important;
        background-size: ${theme.effect === "circuit" ? "34px 34px, 34px 34px, auto" : "cover"} !important;
      }

      html.nte-trade-page-theme .container-main:has(.trades-container),
      html.nte-trade-page-theme .content:has(.trades-container),
      html.nte-trade-page-theme .trades-page,
      html.nte-trade-page-theme .trade-page,
      html.nte-trade-page-theme .trades-container,
      html.nte-trade-page-theme .trades-list-container,
      html.nte-trade-page-theme .trades-list-detail,
      html.nte-trade-page-theme .trade-list-detail,
      html.nte-trade-page-theme .trade-list-detail-offer,
      html.nte-trade-page-theme .trade-details,
      html.nte-trade-page-theme .section-content,
      html.nte-trade-page-theme .tab-content {
        background: ${backdrop} !important;
        background-attachment: fixed !important;
        background-size: ${theme.effect === "circuit" ? "34px 34px, 34px 34px, auto" : "cover"} !important;
      }

      html.nte-trade-page-theme .trades-list,
      html.nte-trade-page-theme .trades-list-container,
      html.nte-trade-page-theme .trade-list,
      html.nte-trade-page-theme .trade-list-detail,
      html.nte-trade-page-theme .trade-list-detail-offer,
      html.nte-trade-page-theme .trade-details {
        color: var(--nte-trade-text) !important;
      }

      html.nte-trade-page-theme .trade-row,
      html.nte-trade-page-theme .trade-list-item,
      html.nte-trade-page-theme .list-item,
      html.nte-trade-page-theme .rbx-tabs-horizontal,
      html.nte-trade-page-theme .nav-tabs {
        background-color: var(--nte-trade-surface) !important;
        border-color: var(--nte-trade-border-soft) !important;
      }

      html.nte-trade-page-theme .trade-row:hover,
      html.nte-trade-page-theme .trade-list-item:hover,
      html.nte-trade-page-theme .trade-row.active,
      html.nte-trade-page-theme .trade-row.selected,
      html.nte-trade-page-theme .trade-list-item.active,
      html.nte-trade-page-theme .trade-list-item.selected,
      html.nte-trade-page-theme .nav-tabs li.active a,
      html.nte-trade-page-theme .nav-tabs li.active button,
      html.nte-trade-page-theme .rbx-tab.active {
        background-color: var(--nte-trade-surface-2) !important;
        border-color: var(--nte-trade-accent) !important;
      }

      html.nte-trade-page-theme .trade-item-card,
      html.nte-trade-page-theme .item-cards .list-item,
      html.nte-trade-page-theme .item-card-container,
      html.nte-trade-page-theme .item-card-link,
      html.nte-trade-page-theme .item-card-thumb-container,
      html.nte-trade-page-theme .thumbnail-2d-container,
      html.nte-trade-page-theme thumbnail-2d,
      html.nte-trade-page-theme .item-card-caption,
      html.nte-trade-page-theme .item-card-name-link {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
        border-color: transparent !important;
        box-shadow: none !important;
      }

      html.nte-trade-page-theme .trade-item-card:hover,
      html.nte-trade-page-theme .item-cards .list-item:hover,
      html.nte-trade-page-theme .item-card-container:hover,
      html.nte-trade-page-theme .item-card-link:hover,
      html.nte-trade-page-theme .item-card-thumb-container:hover {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
      }

      html.nte-trade-page-theme .text-label,
      html.nte-trade-page-theme .trades-container .text-secondary,
      html.nte-trade-page-theme .trades-container .text-subheader,
      html.nte-trade-page-theme .trade-date,
      html.nte-trade-page-theme .item-card-price {
        color: var(--nte-trade-muted) !important;
      }

      html.nte-trade-page-theme .trades-container h1,
      html.nte-trade-page-theme .trades-container .font-header-1,
      html.nte-trade-page-theme .item-card-name {
        color: var(--nte-trade-text) !important;
      }

      html.nte-trade-page-theme .trades-container a:not(.paired-name),
      html.nte-trade-page-theme .trades-container .btn-link {
        color: var(--nte-trade-accent) !important;
      }

      html.nte-trade-page-theme .trades-container select,
      html.nte-trade-page-theme .trades-container .input-field,
      html.nte-trade-page-theme .trades-container .form-control {
        background-color: var(--nte-trade-bg) !important;
        border-color: var(--nte-trade-border-soft) !important;
        color: var(--nte-trade-text) !important;
      }

      html.nte-trade-page-theme .trades-container select:focus,
      html.nte-trade-page-theme .trades-container .input-field:focus,
      html.nte-trade-page-theme .trades-container .form-control:focus {
        border-color: var(--nte-trade-accent) !important;
        box-shadow: 0 0 0 2px var(--nte-trade-accent-soft) !important;
      }

      html.nte-trade-page-theme .trades-container .btn-cta-md,
      html.nte-trade-page-theme .trades-container .btn-primary-md,
      html.nte-trade-page-theme .trades-container .btn-primary-sm,
      html.nte-trade-page-theme .trades-container .nte-analyze-trade-btn {
        background-color: var(--nte-trade-accent) !important;
        border-color: var(--nte-trade-accent) !important;
        color: var(--nte-trade-bg) !important;
      }

      html.nte-trade-page-theme .trades-container .btn-control-md,
      html.nte-trade-page-theme .trades-container .btn-secondary-md,
      html.nte-trade-page-theme .trades-container .nte-history-btn {
        background-color: var(--nte-trade-surface) !important;
        border-color: var(--nte-trade-border-soft) !important;
        color: var(--nte-trade-text) !important;
      }

      html.nte-trade-page-theme .trades-container .btn-control-md:hover,
      html.nte-trade-page-theme .trades-container .btn-secondary-md:hover,
      html.nte-trade-page-theme .trades-container .nte-history-btn:hover {
        border-color: var(--nte-trade-accent) !important;
        color: var(--nte-trade-accent) !important;
      }

      html.nte-trade-page-theme .rbx-divider,
      html.nte-trade-page-theme .divider,
      html.nte-trade-page-theme hr {
        border-color: var(--nte-trade-border-soft) !important;
        background-color: var(--nte-trade-border-soft) !important;
      }

      html.nte-trade-page-theme #footer-container,
      html.nte-trade-page-theme .container-footer,
      html.nte-trade-page-theme .footer,
      html.nte-trade-page-theme .footer .row,
      html.nte-trade-page-theme .footer .footer-links,
      html.nte-trade-page-theme .footer .copyright-container {
        background: transparent !important;
        border-color: var(--nte-trade-border-soft) !important;
        box-shadow: none !important;
      }

      html.nte-trade-page-theme .footer .footer-link,
      html.nte-trade-page-theme .footer .language-selector-wrapper,
      html.nte-trade-page-theme .footer .form-group {
        background: transparent !important;
      }

      html.nte-trade-page-theme .footer .text-footer-nav,
      html.nte-trade-page-theme .footer .footer-button-link,
      html.nte-trade-page-theme .footer .footer-note,
      html.nte-trade-page-theme .footer .foundation-web-menu-item-title,
      html.nte-trade-page-theme .footer .icon {
        color: var(--nte-trade-muted) !important;
      }

      html.nte-trade-page-theme .footer button[role="combobox"] {
        background-color: var(--nte-trade-surface) !important;
        border-color: var(--nte-trade-border-soft) !important;
        color: var(--nte-trade-text) !important;
      }
    `;
  }

  async function refresh() {
    if (!is_trade_page()) {
      remove_theme();
      return;
    }
    let saved = await get_storage([enabled_key, theme_key]);
    if (saved[enabled_key] !== true) {
      remove_theme();
      return;
    }
    apply_theme(normalize_theme(saved[theme_key]));
  }

  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[enabled_key] || changes[theme_key]) refresh();
  });

  chrome.runtime?.onMessage?.addListener((message, sender, send_response) => {
    if (message?.type !== "nte_open_trade_theme_upload") return false;
    if (!is_trade_page()) {
      send_response({ ok: false });
      return false;
    }
    if (message.upload) open_upload_modal(false, message.upload, String(message.file_name || message.upload.name || "theme"));
    else if (message.status) open_upload_modal(false, null, "", String(message.status));
    else open_upload_modal(message.open_picker === true);
    send_response({ ok: true });
    return false;
  });

  refresh();
  setInterval(() => {
    if (location.pathname === last_path) return;
    last_path = location.pathname;
    refresh();
  }, 700);
})();
