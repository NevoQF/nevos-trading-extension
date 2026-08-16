(() => {
  if (typeof nte_is_lite === "function" && nte_is_lite()) return;

  const HISTORY_BTN_CLASS =
    "btn btn-flat-light-blue-sm shadow rounded-pill mt-2 mt-sm-1 mr-2 nte-ih-btn";
  const BTN_CLASS =
    "btn btn-flat-light-blue-sm shadow rounded-pill mt-2 mt-sm-1 nte-rp-btn";
  const ROOT_ID = "nte-rp-root";
  const STYLE_ID = "nte-rp-style";

  let modal = null;
  let slides = [];
  let slide_index = 0;
  let loading_token = 0;
  let image_cache = new Map();
  let open = false;

  function send_message(message) {
    return new Promise((resolve) => {
      try {
        let settled = false;
        let finish = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        let result = chrome.runtime.sendMessage(message, (value) => {
          if (chrome.runtime.lastError) finish(null);
          else finish(value);
        });
        if (result && typeof result.then === "function") {
          result.then(finish, () => finish(null));
        }
      } catch {
        resolve(null);
      }
    });
  }

  function esc(text) {
    let div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  function attr_esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function asset_id_from_path() {
    let match = String(location.pathname || "").match(
      /\/(?:item|bundle)\/(\d+)/i,
    );
    return match ? match[1] : "";
  }

  function item_name_from_page() {
    let h1 = document.querySelector("h1");
    let name = h1?.textContent?.trim() || "";
    if (name) return name;
    let title = String(document.title || "");
    let cut = title.split("|")[0]?.trim() || "";
    return cut;
  }

  function logo_url(path) {
    try {
      return chrome.runtime.getURL(path);
    } catch {
      return "";
    }
  }

  function ensure_styles() {
    if (document.getElementById(STYLE_ID)) return;
    let style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .nte-rp-btn,
      .nte-ih-btn{
        max-height:32px;
      }
      .nte-rp-btn.is-busy,
      .nte-ih-btn.is-busy{opacity:.72;pointer-events:none}

      #${ROOT_ID}{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:rgba(4,8,14,.72);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);opacity:0;pointer-events:none;transition:opacity .34s cubic-bezier(.32,.72,0,1)}
      #${ROOT_ID}.is-open{opacity:1;pointer-events:auto}
      #${ROOT_ID} *{box-sizing:border-box}
      .nte-rp-shell{width:min(920px,100%);max-height:min(90vh,900px);padding:0;border-radius:22px;background:#0c121b;border:1px solid rgba(148,163,184,.14);box-shadow:0 28px 80px rgba(0,0,0,.5);transform:translateY(14px) scale(.988);opacity:0;overflow:hidden;transition:transform .4s cubic-bezier(.32,.72,0,1),opacity .4s cubic-bezier(.32,.72,0,1)}
      #${ROOT_ID}.is-open .nte-rp-shell{transform:translateY(0) scale(1);opacity:1}
      .nte-rp-card{display:flex;flex-direction:column;min-height:0;max-height:min(90vh,900px);color:#e8eef8;font-family:"Avenir Next","Segoe UI Variable Text","Segoe UI",Candara,sans-serif}
      .nte-rp-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 18px;border-bottom:1px solid rgba(148,163,184,.1)}
      .nte-rp-brand{display:flex;align-items:center;gap:11px;min-width:0}
      .nte-rp-brand-mark{width:34px;height:34px;border-radius:10px;overflow:hidden;flex:0 0 auto;background:#100b2a;box-shadow:0 0 0 1px rgba(255,255,255,.14)}
      .nte-rp-brand-mark img{width:100%;height:100%;object-fit:cover;display:block}
      .nte-rp-brand-copy{min-width:0}
      .nte-rp-brand-title{font-size:15px;font-weight:750;letter-spacing:.01em;line-height:1.2}
      .nte-rp-brand-sub{margin-top:2px;font-size:12px;line-height:1.35;color:rgba(226,232,240,.58);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .nte-rp-brand-sub a{color:rgba(125,211,252,.9);text-decoration:none}
      .nte-rp-brand-sub a:hover{text-decoration:underline}
      .nte-rp-close{appearance:none;border:0;background:rgba(148,163,184,.1);color:#e2e8f0;width:34px;height:34px;border-radius:999px;cursor:pointer;font:inherit;font-size:20px;line-height:1;display:inline-flex;align-items:center;justify-content:center;transition:background-color .2s cubic-bezier(.32,.72,0,1),transform .2s cubic-bezier(.32,.72,0,1)}
      .nte-rp-close:hover{background:rgba(148,163,184,.18)}
      .nte-rp-close:active{transform:scale(.96)}

      .nte-rp-body{display:grid;grid-template-rows:minmax(260px,1fr) auto;min-height:0;flex:1}
      .nte-rp-stage{position:relative;min-height:300px;display:flex;align-items:center;justify-content:center;padding:16px 58px;background:#070b12}
      .nte-rp-frame{position:relative;width:100%;height:100%;min-height:280px;max-height:min(58vh,580px);display:flex;align-items:center;justify-content:center;border-radius:14px;overflow:hidden;background:#05080e}
      .nte-rp-image{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block;opacity:0;transform:translateY(6px);transition:opacity .3s cubic-bezier(.32,.72,0,1),transform .3s cubic-bezier(.32,.72,0,1)}
      .nte-rp-image.is-shown{opacity:1;transform:translateY(0)}

      .nte-rp-nav{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(15,23,42,.78);color:#f8fafc;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:22px;line-height:1;transition:background-color .2s cubic-bezier(.32,.72,0,1),border-color .2s cubic-bezier(.32,.72,0,1),transform .2s cubic-bezier(.32,.72,0,1),opacity .2s cubic-bezier(.32,.72,0,1);z-index:2}
      .nte-rp-nav:hover{background:rgba(30,41,59,.95);border-color:rgba(125,211,252,.35)}
      .nte-rp-nav:active{transform:translateY(-50%) scale(.96)}
      .nte-rp-nav[disabled]{opacity:.25;pointer-events:none}
      .nte-rp-nav--prev{left:12px}
      .nte-rp-nav--next{right:12px}

      .nte-rp-meta{padding:16px 20px 18px;border-top:1px solid rgba(148,163,184,.1);display:grid;gap:12px;background:#0c121b}
      .nte-rp-meta-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .nte-rp-count{font-size:12px;font-weight:750;letter-spacing:.06em;text-transform:uppercase;color:#7dd3fc}
      .nte-rp-age{font-size:13px;color:rgba(226,232,240,.55)}
      .nte-rp-text{display:grid;gap:8px;font-size:15px;line-height:1.55;color:rgba(241,245,249,.94)}
      .nte-rp-line{display:block}
      .nte-rp-line--title{font-size:17px;font-weight:750;letter-spacing:.01em;color:#f8fafc}
      .nte-rp-line--value{font-size:15px;color:rgba(226,232,240,.9)}
      .nte-rp-kv{display:grid;grid-template-columns:88px 1fr;gap:8px 12px;align-items:baseline;margin-top:4px}
      .nte-rp-kv-label{font-size:12px;font-weight:750;letter-spacing:.05em;text-transform:uppercase;color:rgba(125,211,252,.85)}
      .nte-rp-kv-value{font-size:15px;color:#f1f5f9;word-break:break-word}
      .nte-rp-empty,.nte-rp-loading,.nte-rp-error{padding:48px 24px;text-align:center;color:rgba(226,232,240,.78);font-size:15px;line-height:1.5}
      .nte-rp-spinner{width:18px;height:18px;border:2px solid rgba(125,211,252,.35);border-right-color:transparent;border-radius:999px;display:inline-block;vertical-align:-3px;margin-right:8px;animation:nteRpSpin .7s linear infinite}
      @keyframes nteRpSpin{to{transform:rotate(360deg)}}

      @media (max-width:720px){
        .nte-rp-shell{border-radius:18px}
        .nte-rp-stage{padding:12px 46px;min-height:240px}
        .nte-rp-frame{min-height:230px;max-height:48vh}
        .nte-rp-nav{width:36px;height:36px;font-size:18px}
        .nte-rp-nav--prev{left:8px}
        .nte-rp-nav--next{right:8px}
        .nte-rp-meta{padding:14px 16px 16px}
        .nte-rp-line--title{font-size:16px}
        .nte-rp-kv{grid-template-columns:76px 1fr}
        .nte-rp-brand-sub{white-space:normal}
      }
    `;
    document.documentElement.appendChild(style);
  }

  function find_action_host() {
    let links = [...document.querySelectorAll("a.btn")].filter((a) =>
      /Trade Ads|Sales|Value Changes/i.test(a.textContent || ""),
    );
    return links[0]?.parentElement || null;
  }

  function format_age(timestamp) {
    let time = Number(timestamp) || 0;
    if (!(time > 0)) return "";
    if (time < 10000000000) time *= 1000;
    let diff = Date.now() - time;
    if (!(diff >= 0)) return "";
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 86400000 * 30) return `${Math.floor(diff / 86400000)}d ago`;
    return new Date(time).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function build_slides(response) {
    let results = Array.isArray(response?.results) ? response.results : [];
    let out = [];
    results.forEach((proof, proof_index) => {
      let attachments = Array.isArray(proof?.attachments)
        ? proof.attachments.filter(Boolean)
        : [];
      if (!attachments.length) {
        out.push({
          proof_index,
          attachment_index: -1,
          url: "",
          content: String(proof?.content || "").trim(),
          timestamp: Number(proof?.timestamp || 0),
          attachment_count: Number(proof?.attachmentCount || 0),
        });
        return;
      }
      attachments.forEach((url, attachment_index) => {
        out.push({
          proof_index,
          attachment_index,
          url: String(url || "").trim(),
          content: String(proof?.content || "").trim(),
          timestamp: Number(proof?.timestamp || 0),
          attachment_count: Math.max(
            Number(proof?.attachmentCount || 0),
            attachments.length,
          ),
        });
      });
    });
    return out;
  }

  function format_proof_text_html(content) {
    let lines = String(content || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return `<div class="nte-rp-line">No proof text.</div>`;

    let title = "";
    let values = [];
    let rows = [];
    for (let line of lines) {
      let match = line.match(/^(S|R|D)\s*[:=-]\s*(.+)$/i);
      if (match) {
        let key = match[1].toUpperCase();
        let label = key === "S" ? "Sender" : key === "R" ? "Receiver" : "Date";
        rows.push({ label, value: match[2].trim() });
        continue;
      }
      if (!title) title = line;
      else values.push(line);
    }

    let html = "";
    if (title) html += `<div class="nte-rp-line nte-rp-line--title">${esc(title)}</div>`;
    for (let value of values) {
      html += `<div class="nte-rp-line nte-rp-line--value">${esc(value)}</div>`;
    }
    if (rows.length) {
      html += `<div class="nte-rp-kv">${rows
        .map(
          (row) =>
            `<span class="nte-rp-kv-label">${esc(row.label)}</span><span class="nte-rp-kv-value">${esc(row.value)}</span>`,
        )
        .join("")}</div>`;
    }
    return html || `<div class="nte-rp-line">${esc(content)}</div>`;
  }

  function ensure_modal() {
    if (modal && document.body.contains(modal)) return modal;
    ensure_styles();
    modal = document.createElement("div");
    modal.id = ROOT_ID;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Item proofs");
    modal.innerHTML = `
      <div class="nte-rp-shell">
        <div class="nte-rp-card">
          <div class="nte-rp-head">
            <div class="nte-rp-brand">
              <div class="nte-rp-brand-mark"><img alt="" width="34" height="34" decoding="async"></div>
              <div class="nte-rp-brand-copy">
                <div class="nte-rp-brand-title">Item Proofs</div>
                <div class="nte-rp-brand-sub"></div>
              </div>
            </div>
            <button type="button" class="nte-rp-close" aria-label="Close">&times;</button>
          </div>
          <div class="nte-rp-body">
            <div class="nte-rp-stage">
              <button type="button" class="nte-rp-nav nte-rp-nav--prev" aria-label="Previous proof">&lsaquo;</button>
              <div class="nte-rp-frame">
                <img class="nte-rp-image" alt="Proof screenshot">
              </div>
              <button type="button" class="nte-rp-nav nte-rp-nav--next" aria-label="Next proof">&rsaquo;</button>
            </div>
            <div class="nte-rp-meta">
              <div class="nte-rp-meta-row">
                <div class="nte-rp-count"></div>
                <div class="nte-rp-age"></div>
              </div>
              <div class="nte-rp-text"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    let logo = logo_url("assets/icons/logo32.png") || logo_url("assets/icons/logo.png");
    let brand_img = modal.querySelector(".nte-rp-brand-mark img");
    if (logo && brand_img) brand_img.src = logo;
    else brand_img?.remove();

    modal.addEventListener("click", (event) => {
      if (event.target === modal) close_modal();
    });
    modal.querySelector(".nte-rp-close").onclick = () => close_modal();
    modal.querySelector(".nte-rp-nav--prev").onclick = () => step_slide(-1);
    modal.querySelector(".nte-rp-nav--next").onclick = () => step_slide(1);
    return modal;
  }

  function set_busy_button(busy) {
    let btn = document.querySelector(".nte-rp-btn");
    if (!btn) return;
    btn.classList.toggle("is-busy", !!busy);
    btn.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function show_status(kind, message) {
    let root = ensure_modal();
    let stage = root.querySelector(".nte-rp-stage");
    let meta = root.querySelector(".nte-rp-meta");
    let class_name =
      kind === "error"
        ? "nte-rp-error"
        : kind === "empty"
          ? "nte-rp-empty"
          : "nte-rp-loading";
    stage.innerHTML = `<div class="${class_name}">${
      kind === "loading"
        ? `<span class="nte-rp-spinner" aria-hidden="true"></span>`
        : ""
    }${esc(message)}</div>`;
    meta.hidden = true;
  }

  function restore_stage_shell() {
    let root = ensure_modal();
    let stage = root.querySelector(".nte-rp-stage");
    let meta = root.querySelector(".nte-rp-meta");
    stage.innerHTML = `
      <button type="button" class="nte-rp-nav nte-rp-nav--prev" aria-label="Previous proof">&lsaquo;</button>
      <div class="nte-rp-frame">
        <img class="nte-rp-image" alt="Proof screenshot">
      </div>
      <button type="button" class="nte-rp-nav nte-rp-nav--next" aria-label="Next proof">&rsaquo;</button>
    `;
    meta.hidden = false;
    stage.querySelector(".nte-rp-nav--prev").onclick = () => step_slide(-1);
    stage.querySelector(".nte-rp-nav--next").onclick = () => step_slide(1);
  }

  async function load_image(url) {
    let key = String(url || "").trim();
    if (!key) return "";
    if (image_cache.has(key)) return image_cache.get(key);
    let response = await send_message({
      type: "getItemProofImages",
      attachments: [key],
    });
    let data_url = "";
    if (response?.success && Array.isArray(response.images)) {
      let hit = response.images.find((row) => row?.dataUrl);
      data_url = String(hit?.dataUrl || "");
    }
    if (data_url) image_cache.set(key, data_url);
    return data_url;
  }

  function prefetch_neighbors() {
    for (let offset of [-1, 1, 2]) {
      let slide = slides[slide_index + offset];
      if (!slide?.url || image_cache.has(slide.url)) continue;
      load_image(slide.url).catch(() => {});
    }
  }

  async function render_slide() {
    let root = ensure_modal();
    if (!slides.length) {
      show_status("empty", "No proof posts found for this item right now.");
      return;
    }
    if (!root.querySelector(".nte-rp-image")) restore_stage_shell();

    let slide = slides[slide_index] || slides[0];
    let img = root.querySelector(".nte-rp-image");
    let prev = root.querySelector(".nte-rp-nav--prev");
    let next = root.querySelector(".nte-rp-nav--next");
    let count = root.querySelector(".nte-rp-count");
    let age = root.querySelector(".nte-rp-age");
    let text = root.querySelector(".nte-rp-text");
    let token = ++loading_token;

    prev.disabled = slides.length < 2;
    next.disabled = slides.length < 2;
    count.textContent = `${slide_index + 1} / ${slides.length}`;
    age.textContent = format_age(slide.timestamp) || "";
    text.innerHTML = format_proof_text_html(slide.content);

    img.classList.remove("is-shown");
    if (!slide.url) {
      img.removeAttribute("src");
      img.alt = "No image on this proof";
      text.innerHTML = format_proof_text_html(
        slide.content ||
          (slide.attachment_count > 0
            ? "This proof has attachments that could not be loaded."
            : "No proof text or images."),
      );
      return;
    }

    let data_url = await load_image(slide.url);
    if (token !== loading_token) return;
    if (!data_url) {
      img.removeAttribute("src");
      img.alt = "Could not load proof image";
      text.innerHTML = format_proof_text_html(
        slide.content
          ? `${slide.content}\nCould not load this proof image.`
          : "Could not load this proof image.",
      );
      return;
    }
    img.onload = () => img.classList.add("is-shown");
    img.src = data_url;
    if (img.complete) img.classList.add("is-shown");
    prefetch_neighbors();
  }

  function step_slide(delta) {
    if (slides.length < 2) return;
    slide_index = (slide_index + delta + slides.length) % slides.length;
    render_slide();
  }

  function on_key_down(event) {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close_modal();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step_slide(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step_slide(1);
    }
  }

  function open_modal_shell(item_name) {
    let root = ensure_modal();
    open = true;
    root.classList.add("is-open");
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("keydown", on_key_down, true);
    let sub = root.querySelector(".nte-rp-brand-sub");
    sub.innerHTML = `${esc(item_name || "Item")} · <a href="https://nevos-extension.com" target="_blank" rel="noopener noreferrer">nevos trading extension</a>`;
  }

  function close_modal() {
    if (!modal) return;
    open = false;
    modal.classList.remove("is-open");
    document.documentElement.style.overflow = "";
    document.removeEventListener("keydown", on_key_down, true);
    set_busy_button(false);
  }

  async function open_proofs() {
    let asset_id = asset_id_from_path();
    let item_name = item_name_from_page();
    if (!asset_id && !item_name) return;

    set_busy_button(true);
    open_modal_shell(item_name);
    show_status("loading", "Loading proofs…");

    let response = await send_message({
      type: "getItemProofs",
      assetId: asset_id,
      itemName: item_name,
    });

    set_busy_button(false);
    if (!open) return;

    if (!response?.success) {
      show_status(
        "error",
        response?.error || "Could not load proofs right now.",
      );
      return;
    }

    slides = build_slides(response);
    slide_index = 0;
    if (!slides.length) {
      show_status("empty", "No proof posts found for this item right now.");
      return;
    }

    restore_stage_shell();
    await render_slide();
  }

  function inject_history_button(host) {
    if (document.querySelector(".nte-ih-btn")) return;
    let btn = document.createElement("a");
    btn.href = "#";
    btn.className = HISTORY_BTN_CLASS;
    btn.setAttribute("role", "button");
    btn.setAttribute("aria-expanded", "false");
    btn.style.maxHeight = "32px";
    btn.innerHTML = `<span class="text-nowrap">History</span>`;
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.dispatchEvent(
        new CustomEvent("nte-item-intel-toggle", { detail: { view: "history" } }),
      );
    });
    let proofs = host.querySelector(".nte-rp-btn");
    if (proofs) proofs.before(btn);
    else host.appendChild(btn);
  }

  function inject_button() {
    let host = find_action_host();
    if (!host) return false;

    for (let link of host.querySelectorAll("a.btn")) {
      if (!link.classList.contains("mr-2") && !link.classList.contains("nte-rp-btn"))
        link.classList.add("mr-2");
    }

    if (!document.querySelector(".nte-rp-btn")) {
      let btn = document.createElement("a");
      btn.href = "#";
      btn.className = BTN_CLASS;
      btn.setAttribute("role", "button");
      btn.style.maxHeight = "32px";
      btn.innerHTML = `<span class="text-nowrap">View Proofs</span>`;
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        open_proofs().catch(() => {
          set_busy_button(false);
          show_status("error", "Could not load proofs right now.");
        });
      });
      host.appendChild(btn);
    }
    inject_history_button(host);
    return true;
  }

  function boot() {
    if (!asset_id_from_path()) return;
    ensure_styles();
    if (inject_button()) return;
    let tries = 0;
    let timer = setInterval(() => {
      tries += 1;
      if (inject_button() || tries > 40) clearInterval(timer);
    }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
