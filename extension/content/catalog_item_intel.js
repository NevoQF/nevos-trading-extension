(()=>{
  let root_id = "nte-item-intel-root";
  let sync_timer = 0;
  let last_url = location.href;
  let styles_injected = false;
  let state = {
    asset_id: "",
    active_view: "",
    epoch: 0,
    history_loading: false,
    proofs_loading: false,
    history_error: "",
    proofs_error: "",
    history_response: null,
    proofs_response: null,
  };

  function send_message(message, callback) {
    try {
      let result = chrome.runtime.sendMessage(message);
      if (result && typeof result.then === "function") {
        result.then((value) => callback(value), () => callback(undefined));
      } else {
        callback(undefined);
      }
    } catch {
      callback(undefined);
    }
  }

  function esc(text) {
    let div = document.createElement("div");
    div.textContent = text == null ? "" : String(text);
    return div.innerHTML;
  }

  function attr_esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function multiline_html(text) {
    return esc(text).replace(/\n/g, "<br>");
  }

  function format_number(value) {
    return Math.max(0, Number(value) || 0).toLocaleString();
  }

  function format_date(timestamp) {
    let time = Number(timestamp) || 0;
    if (!(time > 0)) return "Unknown time";
    try {
      return new Date(time).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "Unknown time";
    }
  }

  function format_age(timestamp) {
    let diff = Date.now() - (Number(timestamp) || 0);
    if (!(diff >= 0)) return "";
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  function profile_html(user_id, user_name) {
    let id = String(user_id || "").trim();
    let label = esc(user_name || (id ? `User ${id}` : "Unknown"));
    if (!/^\d+$/.test(id)) return label;
    return `<a class="nte-history-link" href="https://www.rolimons.com/player/${id}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }

  function clean_name(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function is_roblox_bundle_page() {
    if (!/\/bundles\/\d+(?:\/|$)/i.test(location.pathname)) return true;
    let link = document.querySelector(".text-label a.text-name");
    if (!link) return false;
    return clean_name(link.textContent) === "roblox" && /\/users\/1(?:\/|$)/i.test(String(link.getAttribute("href") || ""));
  }

  function get_context() {
    let match = location.pathname.match(/\/(?:catalog|bundles)\/(\d+)(?:\/|$)/i);
    if (!match) return null;
    if (!is_roblox_bundle_page()) return null;
    let price_row =
      document.querySelector(".item-details-section .price-row-container") ||
      document.querySelector(".price-row-container") ||
      document.querySelector(".price-container-text")?.closest(".price-row-container") ||
      document.querySelector(".price-container-text");
    let section =
      price_row?.parentElement ||
      document.querySelector(".item-details-section") ||
      price_row?.closest(".item-details-section, section, .container-main, .content");
    let title = document.querySelector(".item-name-container h1, h1");
    if (!section || !price_row || !title) return null;
    let clone = title.cloneNode(true);
    for (let node of clone.querySelectorAll("a,button,span")) node.remove();
    let item_name = String(clone.textContent || title.textContent || "").trim();
    if (!item_name) return null;
    let thumb =
      String(document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "").trim() ||
      String(document.querySelector(".item-thumbnail-container img, .thumbnail-span img")?.src || "").trim();
    return {
      asset_id: match[1],
      item_name,
      thumb,
      section,
      price_row,
    };
  }

  function reset_state(context) {
    if (state.asset_id === context.asset_id) return;
    state.asset_id = context.asset_id;
    state.active_view = "";
    state.epoch += 1;
    state.history_loading = false;
    state.proofs_loading = false;
    state.history_error = "";
    state.proofs_error = "";
    state.history_response = null;
    state.proofs_response = null;
  }

  function get_root(context) {
    let root = document.getElementById(root_id);
    if (!context) {
      root?.remove();
      return null;
    }
    if (!root || root.parentElement !== context.section || root.previousElementSibling !== context.price_row) {
      root?.remove();
      root = document.createElement("div");
      root.id = root_id;
      root.className = "nte-item-intel-root";
      context.price_row.insertAdjacentElement("afterend", root);
    }
    root.dataset.assetId = context.asset_id;
    return root;
  }

  function get_history_item(context) {
    let item = Array.isArray(state.history_response?.items) ? state.history_response.items[0] || null : null;
    return {
      name: String(item?.name || context.item_name || "Unknown Item").trim(),
      thumb: String(item?.thumb || context.thumb || "").trim(),
      assetId: String(item?.assetId || context.asset_id || "").trim(),
      tradeCount: Number(item?.tradeCount || 0),
      history: Array.isArray(item?.history) ? item.history : [],
    };
  }

  function get_history_count() {
    return Math.max(0, Number((state.history_response?.items || [])[0]?.tradeCount || 0));
  }

  function get_proofs_count() {
    let results = Array.isArray(state.proofs_response?.results) ? state.proofs_response.results.length : 0;
    return Math.max(Number(state.proofs_response?.count || 0), results);
  }

  function get_button_label(view) {
    if (view === "history") return state.history_response ? `History (${format_number(get_history_count())})` : "History";
    return state.proofs_response ? `Proofs (${format_number(get_proofs_count())})` : "Proofs";
  }

  function render_toolbar() {
    return `
      <div class="nte-item-intel-bar">
        <div class="nte-item-intel-controls">
          <button type="button" class="nte-item-intel-btn${state.active_view === "history" ? " is-active" : ""}" data-view="history" aria-pressed="${state.active_view === "history" ? "true" : "false"}">${esc(get_button_label("history"))}</button>
          <button type="button" class="nte-item-intel-btn${state.active_view === "proofs" ? " is-active" : ""}" data-view="proofs" aria-pressed="${state.active_view === "proofs" ? "true" : "false"}">${esc(get_button_label("proofs"))}</button>
        </div>
      </div>
    `;
  }

  function render_panel_shell(title, sub, body, error = false) {
    return `
      <section class="nte-history-panel${error ? " nte-history-panel--error" : ""}">
        <button type="button" class="nte-history-close">Close</button>
        <div class="nte-history-head">
          <div>
            <div class="nte-history-title">${esc(title)}</div>
            <div class="nte-history-sub">${esc(sub)}</div>
          </div>
        </div>
        ${body}
      </section>
    `;
  }

  function render_loading_panel(context, view) {
    return render_panel_shell(
      `${view === "history" ? "History" : "Proofs"} for ${context.item_name}`,
      view === "history"
        ? "Checking recent recorded trades across all copies of this item."
        : "Searching recent proof posts for this item.",
      `<div class="nte-item-intel-loading"><span class="nte-history-spinner" aria-hidden="true"></span><span>${esc(view === "history" ? "Loading item history." : "Loading item proofs.")}</span></div>`,
    );
  }

  function render_error_panel(context, view, message) {
    return render_panel_shell(
      `${view === "history" ? "History" : "Proofs"} for ${context.item_name}`,
      view === "history" ? "Something went wrong while loading trade history for this item." : "Something went wrong while loading proof posts for this item.",
      `<div class="nte-history-empty">${esc(message || "Could not load item intel right now.")}</div>`,
      true,
    );
  }

  function is_focus_trade_item(item, asset_id) {
    return !!(asset_id && item?.assetId && String(item.assetId) === String(asset_id));
  }

  function render_history_trade_item(item, asset_id) {
    let thumb_html = item?.thumb
      ? `<img class="nte-history-trade-thumb" src="${attr_esc(item.thumb)}" alt="">`
      : '<div class="nte-history-trade-thumb nte-history-trade-thumb--empty">?</div>';
    let stat_text =
      Number(item?.value || 0) > 0
        ? `Value ${format_number(item.value)}`
        : Number(item?.rap || 0) > 0
          ? `RAP ${format_number(item.rap)}`
          : `Asset ${esc(item?.assetId || "")}`;
    return `
      <div class="nte-history-trade-item${is_focus_trade_item(item, asset_id) ? " is-focus" : ""}">
        ${thumb_html}
        <div class="nte-history-trade-copy">
          <div class="nte-history-trade-name">${esc(item?.name || `Asset ${item?.assetId || ""}`)}</div>
          <div class="nte-history-trade-meta">${stat_text}</div>
        </div>
      </div>
    `;
  }

  function render_history_trade_side(title, user_id, user_name, items, total, asset_id) {
    let list = Array.isArray(items) ? items : [];
    let visible = list.slice(0, 4);
    let items_html = visible.map((item) => render_history_trade_item(item, asset_id)).join("");
    let more_html =
      list.length > 4
        ? `<div class="nte-history-trade-more">+${list.length - 4} more item${list.length - 4 === 1 ? "" : "s"}</div>`
        : "";
    return `
      <div class="nte-history-trade-side">
        <div class="nte-history-trade-side-head">
          <div>
            <div class="nte-history-trade-side-title">${esc(title)}</div>
            <div class="nte-history-trade-side-user">${profile_html(user_id, user_name)} gave</div>
          </div>
          <div class="nte-history-trade-side-total">${format_number(total)}</div>
        </div>
        <div class="nte-history-trade-items">${items_html || '<div class="nte-history-trade-empty">No items recorded.</div>'}</div>
        ${more_html}
      </div>
    `;
  }

  function render_history_trade(entry, asset_id) {
    let trade = entry?.trade || null;
    let offer = Array.isArray(trade?.offer) ? trade.offer : [];
    let request = Array.isArray(trade?.request) ? trade.request : [];
    if (!offer.length && !request.length) return '<div class="nte-history-trade-empty-card">Trade details are not recorded for this row.</div>';
    return `
      <div class="nte-history-trade-card">
        ${render_history_trade_side("Offer", entry?.offererId, entry?.offererName, offer, Number(trade?.offerTotal || 0), asset_id)}
        <div class="nte-history-trade-sep"><span class="nte-history-trade-sep-label">for</span></div>
        ${render_history_trade_side("Request", entry?.requesterId, entry?.requesterName, request, Number(trade?.requestTotal || 0), asset_id)}
      </div>
    `;
  }

  function render_history_entry(entry, index, context) {
    let trade = entry?.trade || null;
    let side = String(entry?.side || "");
    let focus_total = side === "offer" ? Number(trade?.offerTotal || 0) : Number(trade?.requestTotal || 0);
    let other_total = side === "offer" ? Number(trade?.requestTotal || 0) : Number(trade?.offerTotal || 0);
    let delta = other_total - focus_total;
    let pills = [];
    if (trade && (side === "offer" || side === "request")) {
      if (delta > 0) pills.push(`<span class="nte-history-pill is-up">Gain +${format_number(delta)}</span>`);
      else if (delta < 0) pills.push(`<span class="nte-history-pill is-down">Loss -${format_number(Math.abs(delta))}</span>`);
      else pills.push('<span class="nte-history-pill is-note">Even</span>');
    }
    let copy_count = Math.max(0, Number(entry?.copyCount || 0));
    if (copy_count > 1) pills.push(`<span class="nte-history-pill is-note">${copy_count} copies</span>`);
    let meta_bits = [`Trade #${esc(entry?.tradeId || "")}`];
    if (trade) meta_bits.push(`${format_number(focus_total)} -> ${format_number(other_total)}`);
    let has_trade = !!(entry?.tradeId || (trade && ((Array.isArray(trade.offer) && trade.offer.length) || (Array.isArray(trade.request) && trade.request.length))));
    let asset_id = String(context?.asset_id || "").trim();
    return `
      <article class="nte-history-entry" data-history-index="${index}">
        <div class="nte-history-entry-top">
          <div class="nte-history-entry-main">
            <div class="nte-history-entry-flow">${profile_html(entry?.ownerBeforeId, entry?.ownerBeforeName)}<span class="nte-history-arrow">&rarr;</span>${profile_html(entry?.ownerAfterId, entry?.ownerAfterName)}</div>
            <div class="nte-history-entry-meta">${meta_bits.join(" • ")}</div>
            ${pills.length ? `<div class="nte-history-entry-pills">${pills.join("")}</div>` : ""}
            ${
              has_trade
                ? `<div class="nte-history-proof-actions"><button type="button" class="nte-history-proof-images-btn nte-history-trade-btn" aria-expanded="false"><span class="nte-history-trade-btn-label">Show trade</span></button></div>`
                : ""
            }
          </div>
          <div class="nte-history-entry-time">${esc(format_date(entry?.timestamp))}<br>${esc(format_age(entry?.timestamp))}</div>
        </div>
        ${has_trade ? `<div class="nte-history-trade-shell" hidden>${render_history_trade(entry, asset_id)}</div>` : ""}
      </article>
    `;
  }

  function render_history_panel(context) {
    let item = get_history_item(context);
    let trade_count = Math.max(0, Number(item.tradeCount || 0));
    let thumb_html = item.thumb
      ? `<img class="nte-history-thumb" src="${attr_esc(item.thumb)}" alt="">`
      : '<div class="nte-history-thumb nte-history-thumb--empty">?</div>';
    return render_panel_shell(
      `History for ${context.item_name}`,
      trade_count
        ? `Showing ${Math.min(trade_count, item.history.length)} recent recorded trade${trade_count === 1 ? "" : "s"} across all copies of this item.`
        : "No recorded trade history for this item in the local database yet.",
      `
        <section class="nte-history-card">
          <div class="nte-history-card-head">
            ${thumb_html}
            <div class="nte-history-card-copy">
              <div class="nte-history-card-title">${esc(item.name || context.item_name)}</div>
              <div class="nte-history-card-pills">
                <span class="nte-history-pill">${trade_count} trade${trade_count === 1 ? "" : "s"}</span>
                <span class="nte-history-pill is-note">All copies</span>
              </div>
              <div class="nte-history-card-link"><a href="https://www.rolimons.com/item/${attr_esc(item.assetId || context.asset_id)}" target="_blank" rel="noopener noreferrer">Open item on Rolimons</a></div>
            </div>
          </div>
          ${trade_count ? `<div class="nte-history-list">${item.history.map((entry, index) => render_history_entry(entry, index, context)).join("")}</div>` : '<div class="nte-history-empty">No recorded trade history for this item across all copies yet.</div>'}
        </section>
      `,
    );
  }

  function get_proof_image_button_label(button_state, count) {
    let image_count = Math.max(0, Number(count || 0));
    if (button_state === "loading") return image_count === 1 ? "Loading Image" : "Loading Images";
    if (button_state === "open") return image_count === 1 ? "Hide Image" : "Hide Images";
    if (image_count <= 1) return "Show Image";
    return `Show Images (${image_count})`;
  }

  function render_proof_images(images) {
    let entries = Array.isArray(images) ? images : [];
    if (!entries.length) return '<div class="nte-history-proof-empty-copy">No image attachments on this proof.</div>';
    return `<div class="nte-history-proof-attachments">${entries
      .map((entry, index) => {
        let data_url = String(entry?.dataUrl || "").trim();
        let source_url = String(entry?.sourceUrl || "").trim();
        if (!data_url) return `<div class="nte-history-proof-image-fail">${esc(entry?.error || `Could not load image ${index + 1}.`)}</div>`;
        return `<a class="nte-history-proof-thumb-link" href="${attr_esc(source_url || data_url)}" target="_blank" rel="noopener noreferrer"><img class="nte-history-proof-thumb" src="${attr_esc(data_url)}" alt="Proof image ${index + 1}" loading="lazy" decoding="async"></a>`;
      })
      .join("")}</div>`;
  }

  function render_proof_attachments(entry, index) {
    let attachments = Array.isArray(entry?.attachments) ? entry.attachments : [];
    let attachment_count = Math.max(Number(entry?.attachmentCount || 0), attachments.length);
    if (!attachments.length) return '<div class="nte-history-proof-empty-copy">No image attachments on this proof.</div>';
    return `
      <div class="nte-history-proof-actions">
        <button type="button" class="nte-history-proof-images-btn" data-proof-index="${index}" data-attachment-count="${attachment_count}" aria-expanded="false"><span class="nte-history-proof-images-btn-label">${esc(get_proof_image_button_label("idle", attachment_count))}</span></button>
        ${attachment_count > attachments.length ? `<span class="nte-history-proof-image-note">+${attachment_count - attachments.length} more not shown</span>` : ""}
      </div>
      <div class="nte-history-proof-image-shell" hidden></div>
    `;
  }

  function render_proofs_panel(context) {
    let response = state.proofs_response || {};
    let results = Array.isArray(response.results) ? response.results : [];
    let visible = results.slice(0, 6);
    let count = Math.max(Number(response.count || 0), results.length);
    return render_panel_shell(
      `Proofs for ${context.item_name}`,
      count ? `Showing ${visible.length} of ${count} proof${count === 1 ? "" : "s"} matched by ${response.searchMode === "asset" ? "asset id" : "item name"}.` : "No proof posts found for this item right now.",
      visible.length
        ? `<div class="nte-history-proofs-grid">${visible
            .map((entry, index) => {
              let attachment_count = Math.max(Number(entry?.attachmentCount || 0), Array.isArray(entry?.attachments) ? entry.attachments.length : 0);
              let meta = [`${attachment_count} image${attachment_count === 1 ? "" : "s"}`];
              let age = format_age(entry?.timestamp);
              if (age) meta.push(age);
              let meta_title = Number(entry?.timestamp) > 0 ? format_date(entry.timestamp) : "";
              return `
                <article class="nte-history-proof-card">
                  <div class="nte-history-proof-card-head">
                    <div class="nte-history-proof-card-title">Proof ${index + 1}</div>
                    <div class="nte-history-proof-card-meta"${meta_title ? ` title="${attr_esc(meta_title)}"` : ""}>${esc(meta.join(" | "))}</div>
                  </div>
                  <div class="nte-history-proof-card-text">${multiline_html(entry?.content || "No proof text.")}</div>
                  ${render_proof_attachments(entry, index)}
                </article>
              `;
            })
            .join("")}</div>`
        : '<div class="nte-history-empty">No proof posts found for this item right now.</div>',
    );
  }

  function set_proof_button_state(button, button_state) {
    if (!button) return;
    let label = button.querySelector(".nte-history-proof-images-btn-label");
    let count = Math.max(0, Number(button.getAttribute("data-attachment-count") || 0));
    button.classList.toggle("is-open", button_state === "open");
    button.disabled = button_state === "loading";
    button.setAttribute("aria-expanded", button_state === "open" ? "true" : "false");
    button.setAttribute("aria-busy", button_state === "loading" ? "true" : "false");
    if (label) label.textContent = get_proof_image_button_label(button_state, count);
  }

  function attach_proof_buttons(root) {
    for (let button of root.querySelectorAll(".nte-history-proof-images-btn")) {
      set_proof_button_state(button, "idle");
      button.onclick = async () => {
        let card = button.closest(".nte-history-proof-card");
        let shell = card?.querySelector(".nte-history-proof-image-shell");
        if (!card || !shell) return;
        if (!shell.hidden) {
          shell.hidden = true;
          set_proof_button_state(button, "idle");
          return;
        }
        let proof_index = Number(button.getAttribute("data-proof-index") || -1);
        let proofs = Array.isArray(state.proofs_response?.results) ? state.proofs_response.results : [];
        let entry = proof_index >= 0 ? proofs[proof_index] : null;
        let attachments = Array.isArray(entry?.attachments) ? entry.attachments : [];
        if (!attachments.length) {
          shell.innerHTML = '<div class="nte-history-proof-empty-copy">No image attachments on this proof.</div>';
          shell.hidden = false;
          set_proof_button_state(button, "open");
          return;
        }
        if (card.__nte_item_intel_images_loaded) {
          shell.innerHTML = card.__nte_item_intel_images_loaded;
          shell.hidden = false;
          set_proof_button_state(button, "open");
          return;
        }
        set_proof_button_state(button, "loading");
        shell.innerHTML = '<div class="nte-item-intel-loading nte-item-intel-loading--tight"><span class="nte-history-spinner" aria-hidden="true"></span><span>Fetching proof screenshots.</span></div>';
        shell.hidden = false;
        let response = await new Promise((resolve) => send_message({ type: "getItemProofImages", attachments }, (value) => resolve(value)));
        if (response?.success) {
          card.__nte_item_intel_images_loaded = render_proof_images(response.images);
          shell.innerHTML = card.__nte_item_intel_images_loaded;
          set_proof_button_state(button, "open");
          return;
        }
        card.__nte_item_intel_images_loaded = "";
        shell.innerHTML = `<div class="nte-history-proof-empty-copy">${esc(response?.error || "Could not load proof images right now.")}</div>`;
        set_proof_button_state(button, "open");
      };
    }
  }

  function set_history_trade_button_state(button, is_open) {
    if (!button) return;
    let label = button.querySelector(".nte-history-trade-btn-label");
    button.classList.toggle("is-open", is_open);
    button.setAttribute("aria-expanded", is_open ? "true" : "false");
    if (label) label.textContent = is_open ? "Hide trade" : "Show trade";
  }

  function attach_history_trade_buttons(root) {
    for (let button of root.querySelectorAll(".nte-history-trade-btn")) {
      set_history_trade_button_state(button, false);
      button.onclick = () => {
        let entry = button.closest(".nte-history-entry");
        let shell = entry?.querySelector(".nte-history-trade-shell");
        if (!entry || !shell) return;
        let is_open = shell.hidden;
        entry.classList.toggle("is-open", is_open);
        shell.hidden = !is_open;
        set_history_trade_button_state(button, is_open);
      };
    }
  }

  function render_root(context) {
    let root = get_root(context);
    if (!root) return;
    let panel = "";
    if (state.active_view === "history") {
      if (state.history_loading) panel = render_loading_panel(context, "history");
      else if (state.history_error) panel = render_error_panel(context, "history", state.history_error);
      else if (state.history_response) panel = render_history_panel(context);
    } else if (state.active_view === "proofs") {
      if (state.proofs_loading) panel = render_loading_panel(context, "proofs");
      else if (state.proofs_error) panel = render_error_panel(context, "proofs", state.proofs_error);
      else if (state.proofs_response) panel = render_proofs_panel(context);
    }
    root.innerHTML = `${render_toolbar()}${panel}`;
    for (let button of root.querySelectorAll(".nte-item-intel-btn[data-view]")) {
      button.onclick = () => toggle_view(String(button.getAttribute("data-view") || ""));
    }
    let close_button = root.querySelector(".nte-history-close");
    if (close_button) {
      close_button.onclick = () => {
        state.active_view = "";
        render_root(context);
      };
    }
    if (state.active_view === "history") attach_history_trade_buttons(root);
    if (state.active_view === "proofs") attach_proof_buttons(root);
    root.dataset.nteRendered = "1";
  }

  async function load_history(context) {
    if (state.history_loading || state.history_response) {
      render_root(context);
      return;
    }
    state.history_loading = true;
    state.history_error = "";
    let epoch = state.epoch;
    render_root(context);
    let response = await new Promise((resolve) =>
      send_message(
        {
          type: "getTradeHistory",
          scope: "asset",
          offerItems: [{ name: context.item_name, assetId: context.asset_id, thumb: context.thumb }],
          limit: 8,
        },
        (value) => resolve(value),
      ),
    );
    if (state.epoch !== epoch || state.asset_id !== context.asset_id) return;
    state.history_loading = false;
    if (response?.success) {
      state.history_response = response;
      state.history_error = "";
    } else {
      state.history_response = null;
      state.history_error = response?.error || "Could not load item history right now.";
    }
    render_root(context);
  }

  async function load_proofs(context) {
    if (state.proofs_loading || state.proofs_response) {
      render_root(context);
      return;
    }
    state.proofs_loading = true;
    state.proofs_error = "";
    let epoch = state.epoch;
    render_root(context);
    let response = await new Promise((resolve) =>
      send_message(
        {
          type: "getItemProofs",
          itemName: context.item_name,
          assetId: context.asset_id,
        },
        (value) => resolve(value),
      ),
    );
    if (state.epoch !== epoch || state.asset_id !== context.asset_id) return;
    state.proofs_loading = false;
    if (response?.success) {
      state.proofs_response = response;
      state.proofs_error = "";
    } else {
      state.proofs_response = null;
      state.proofs_error = response?.error || "Could not load item proofs right now.";
    }
    render_root(context);
  }

  async function toggle_view(view) {
    if (view !== "history" && view !== "proofs") return;
    let context = get_context();
    if (!context) return;
    reset_state(context);
    if (state.active_view === view && !state[`${view}_loading`]) {
      state.active_view = "";
      render_root(context);
      return;
    }
    state.active_view = view;
    render_root(context);
    if (view === "history") await load_history(context);
    else await load_proofs(context);
  }

  function inject_styles() {
    if (styles_injected) return;
    styles_injected = true;
    let style = document.createElement("style");
    style.textContent = `
      .nte-item-intel-root{margin-top:14px}
      .nte-item-intel-bar{display:flex;align-items:center;justify-content:flex-start;gap:8px;flex-wrap:wrap}
      .nte-item-intel-controls{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;padding:4px;border-radius:14px;background:rgba(15,23,42,.08);border:1px solid rgba(148,163,184,.18);box-shadow:0 8px 18px rgba(15,23,42,.08)}
      .light-theme .nte-item-intel-controls{background:rgba(248,250,252,.96);border-color:rgba(148,163,184,.16);box-shadow:0 8px 18px rgba(15,23,42,.06)}
      .nte-item-intel-btn{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:0 14px;border:0;border-radius:10px;background:transparent;color:inherit;font:inherit;font-size:12px;font-weight:800;line-height:1;cursor:pointer;opacity:.82;transition:background-color .18s ease,color .18s ease,opacity .18s ease,transform .18s ease}
      .nte-item-intel-btn:hover{opacity:1;transform:translateY(-1px)}
      .nte-item-intel-btn.is-active{opacity:1;background:rgba(96,165,250,.16);color:#dbeafe}
      .light-theme .nte-item-intel-btn.is-active{color:#1d4ed8}
      .nte-history-panel{position:relative;margin-top:12px;border-radius:14px;padding:14px 16px 16px;background:linear-gradient(160deg,rgba(15,23,42,.92),rgba(17,24,39,.96));border:1px solid rgba(148,163,184,.18);box-shadow:0 16px 42px rgba(2,6,23,.22);color:#e5eefc;overflow:hidden}
      .light-theme .nte-history-panel{background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(248,250,252,.98));border-color:rgba(15,23,42,.1);box-shadow:0 16px 34px rgba(15,23,42,.08);color:#122033}
      .nte-history-panel.nte-history-panel--error{background:linear-gradient(160deg,rgba(69,10,10,.92),rgba(31,17,17,.96));border-color:rgba(248,113,113,.28);color:#fecaca}
      .light-theme .nte-history-panel.nte-history-panel--error{background:linear-gradient(180deg,rgba(254,242,242,.98),rgba(255,255,255,.98));border-color:rgba(239,68,68,.22);color:#991b1b}
      .nte-history-close{position:absolute;top:14px;right:16px;display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:7px 12px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(148,163,184,.08);color:inherit;opacity:.84;cursor:pointer;font:inherit;font-size:11px;font-weight:800;line-height:1;transition:background-color .18s ease,border-color .18s ease,opacity .18s ease;z-index:1}
      .nte-history-close:hover{opacity:1;background:rgba(148,163,184,.14);border-color:rgba(148,163,184,.28)}
      .nte-history-head{display:flex;flex-direction:column;gap:10px;margin-bottom:12px;padding-right:76px}
      .nte-history-title{font-size:15px;font-weight:800;letter-spacing:.01em}
      .nte-history-sub{margin-top:4px;font-size:12px;line-height:1.45;opacity:.78}
      .nte-item-intel-loading{display:flex;align-items:center;gap:8px;padding:12px;border-radius:12px;background:rgba(255,255,255,.045);border:1px solid rgba(148,163,184,.14);font-size:12px;line-height:1.45}
      .light-theme .nte-item-intel-loading{background:rgba(241,245,249,.92);border-color:rgba(148,163,184,.18)}
      .nte-item-intel-loading--tight{margin-top:10px;padding:10px;font-size:11px}
      .nte-history-spinner{width:13px;height:13px;border:2px solid currentColor;border-right-color:transparent;border-radius:999px;animation:nteItemIntelSpin .72s linear infinite;flex:0 0 auto}
      @keyframes nteItemIntelSpin{to{transform:rotate(360deg)}}
      .nte-history-card{border-radius:12px;padding:12px;background:rgba(255,255,255,.045);border:1px solid rgba(148,163,184,.14)}
      .light-theme .nte-history-card{background:rgba(241,245,249,.92);border-color:rgba(148,163,184,.18)}
      .nte-history-card-head{display:flex;align-items:flex-start;gap:12px}
      .nte-history-thumb{width:44px;height:44px;border-radius:10px;object-fit:cover;flex:0 0 auto;background:rgba(15,23,42,.5)}
      .light-theme .nte-history-thumb{background:rgba(226,232,240,.9)}
      .nte-history-thumb--empty{display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:rgba(148,163,184,.85)}
      .nte-history-card-copy{min-width:0;flex:1}
      .nte-history-card-title{font-size:13px;font-weight:800;line-height:1.35;word-break:break-word}
      .nte-history-card-pills{margin-top:6px;display:flex;flex-wrap:wrap;gap:6px}
      .nte-history-card-link{margin-top:8px;font-size:11px;opacity:.78}
      .nte-history-card-link a,.nte-history-link{color:inherit;text-decoration:underline;text-decoration-style:dotted}
      .nte-history-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(148,163,184,.14);border:1px solid rgba(148,163,184,.18);color:inherit}
      .nte-history-pill.is-note{background:rgba(96,165,250,.14);border-color:rgba(96,165,250,.24);color:#bfdbfe}
      .light-theme .nte-history-pill.is-note{color:#1d4ed8}
      .nte-history-pill.is-up{background:rgba(34,197,94,.16);border-color:rgba(34,197,94,.26);color:#86efac}
      .light-theme .nte-history-pill.is-up{color:#166534}
      .nte-history-pill.is-down{background:rgba(248,113,113,.16);border-color:rgba(248,113,113,.28);color:#fecaca}
      .light-theme .nte-history-pill.is-down{color:#b91c1c}
      .nte-history-empty{padding:12px;border-radius:10px;background:rgba(15,23,42,.28);border:1px dashed rgba(148,163,184,.18);font-size:12px;line-height:1.5;opacity:.82}
      .light-theme .nte-history-empty{background:rgba(255,255,255,.8)}
      .nte-history-list{margin-top:12px;display:flex;flex-direction:column;gap:8px}
      .nte-history-entry{display:flex;flex-direction:column;gap:10px;padding:10px 11px;border-radius:10px;background:rgba(2,6,23,.24);border:1px solid rgba(148,163,184,.12)}
      .light-theme .nte-history-entry{background:rgba(255,255,255,.82);border-color:rgba(148,163,184,.16)}
      .nte-history-entry-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .nte-history-entry-main{min-width:0;flex:1}
      .nte-history-entry-flow{font-size:12px;font-weight:700;line-height:1.4;min-width:0;word-break:break-word}
      .nte-history-arrow{opacity:.54;padding:0 4px}
      .nte-history-entry-meta{margin-top:6px;font-size:11px;line-height:1.45;opacity:.76}
      .nte-history-entry-pills{margin-top:7px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      .nte-history-entry-time{text-align:right;font-size:11px;line-height:1.35;opacity:.74;flex:0 0 auto}
      .nte-history-trade-shell{padding-top:10px;border-top:1px solid rgba(148,163,184,.12)}
      .nte-history-trade-shell[hidden]{display:none!important}
      .nte-history-trade-card{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:8px;align-items:stretch}
      .nte-history-trade-sep{display:flex;align-items:center;justify-content:center;padding:0 1px}
      .nte-history-trade-sep-label{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;opacity:.55}
      .nte-history-trade-side{min-width:0;padding:9px;border-radius:10px;background:rgba(15,23,42,.24);border:1px solid rgba(148,163,184,.12)}
      .light-theme .nte-history-trade-side{background:rgba(241,245,249,.88);border-color:rgba(148,163,184,.16)}
      .nte-history-trade-side-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px}
      .nte-history-trade-side-title{font-size:10px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;opacity:.62}
      .nte-history-trade-side-user{margin-top:2px;font-size:11px;font-weight:800;line-height:1.35;word-break:break-word}
      .nte-history-trade-side-total{font-size:11px;font-weight:900;line-height:1.35;white-space:nowrap}
      .nte-history-trade-items{display:grid;gap:7px}
      .nte-history-trade-item{display:flex;align-items:flex-start;gap:8px;min-width:0;padding:7px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid rgba(148,163,184,.12)}
      .light-theme .nte-history-trade-item{background:rgba(255,255,255,.76)}
      .nte-history-trade-item.is-focus{border-color:rgba(96,165,250,.44);box-shadow:0 0 0 1px rgba(96,165,250,.18) inset;background:linear-gradient(135deg,rgba(96,165,250,.13),rgba(255,255,255,.04))}
      .light-theme .nte-history-trade-item.is-focus{background:linear-gradient(135deg,rgba(96,165,250,.13),rgba(255,255,255,.92))}
      .nte-history-trade-thumb{width:32px;height:32px;border-radius:8px;object-fit:cover;flex:0 0 auto;background:rgba(15,23,42,.5)}
      .light-theme .nte-history-trade-thumb{background:rgba(226,232,240,.9)}
      .nte-history-trade-thumb--empty{display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:rgba(148,163,184,.8)}
      .nte-history-trade-copy{min-width:0;flex:1}
      .nte-history-trade-name{font-size:10px;font-weight:800;line-height:1.35;word-break:break-word}
      .nte-history-trade-meta,.nte-history-trade-more,.nte-history-trade-empty{margin-top:3px;font-size:10px;line-height:1.35;opacity:.72}
      .nte-history-trade-empty-card{padding:10px;border-radius:10px;background:rgba(15,23,42,.24);border:1px dashed rgba(148,163,184,.16);font-size:11px;font-weight:700;line-height:1.4;opacity:.76}
      .light-theme .nte-history-trade-empty-card{background:rgba(241,245,249,.88)}
      .nte-history-proofs-grid{display:grid;gap:8px}
      .nte-history-proof-card{padding:10px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(148,163,184,.12)}
      .light-theme .nte-history-proof-card{background:rgba(241,245,249,.88)}
      .nte-history-proof-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px}
      .nte-history-proof-card-title{font-size:11px;font-weight:800}
      .nte-history-proof-card-meta{font-size:10px;opacity:.72}
      .nte-history-proof-card-text{font-size:11px;line-height:1.55;word-break:break-word}
      .nte-history-proof-actions{margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .nte-history-proof-images-btn{display:inline-flex;align-items:center;justify-content:center;padding:4px 8px;border-radius:999px;border:1px solid rgba(148,163,184,.22);background:rgba(148,163,184,.12);color:inherit;font:inherit;font-size:10px;font-weight:800;line-height:1.2;cursor:pointer;transition:background-color .18s ease,border-color .18s ease,opacity .18s ease}
      .nte-history-proof-images-btn:hover{background:rgba(148,163,184,.18);border-color:rgba(148,163,184,.3)}
      .nte-history-proof-images-btn.is-open{background:rgba(34,197,94,.14);border-color:rgba(34,197,94,.3);color:#bbf7d0}
      .light-theme .nte-history-proof-images-btn.is-open{color:#166534}
      .nte-history-proof-images-btn[disabled]{opacity:.72;cursor:wait}
      .nte-history-proof-image-note{font-size:10px;opacity:.72}
      .nte-history-proof-image-shell{margin-top:10px}
      .nte-history-proof-image-shell[hidden]{display:none!important}
      .nte-history-proof-empty-copy{margin-top:8px;font-size:11px;opacity:.72}
      .nte-history-proof-attachments{margin-top:10px;display:flex;flex-wrap:wrap;gap:8px}
      .nte-history-proof-thumb-link{display:block}
      .nte-history-proof-thumb{width:84px;height:84px;border-radius:10px;object-fit:cover;background:rgba(15,23,42,.45);border:1px solid rgba(148,163,184,.16)}
      .light-theme .nte-history-proof-thumb{background:rgba(226,232,240,.9)}
      .nte-history-proof-image-fail{display:flex;align-items:center;justify-content:center;min-width:84px;height:84px;padding:0 10px;border-radius:10px;background:rgba(248,113,113,.08);border:1px dashed rgba(248,113,113,.22);font-size:10px;font-weight:700;line-height:1.35;text-align:center}
      @media (max-width:700px){
        .nte-item-intel-controls{width:100%}
        .nte-item-intel-btn{flex:1}
        .nte-history-entry-top{flex-direction:column;align-items:stretch}
        .nte-history-entry-time{text-align:left}
        .nte-history-trade-card{grid-template-columns:minmax(0,1fr)}
        .nte-history-trade-sep{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  function sync(force = false) {
    let context = get_context();
    if (!context) {
      document.getElementById(root_id)?.remove();
      return;
    }
    reset_state(context);
    inject_styles();
    let root = get_root(context);
    if (!root) return;
    if (force || root.dataset.nteRendered !== "1" || root.dataset.assetId !== context.asset_id) render_root(context);
  }

  function queue_sync(force = false) {
    clearTimeout(sync_timer);
    sync_timer = setTimeout(() => sync(force), force ? 0 : 80);
  }

  let page_observer = null;

  function should_watch_page() {
    return /\/(?:catalog|bundles)\/\d+(?:\/|$)/i.test(location.pathname);
  }

  function sync_observer() {
    if (!should_watch_page()) {
      page_observer?.disconnect();
      page_observer = null;
      document.getElementById(root_id)?.remove();
      return;
    }
    if (!page_observer) {
      page_observer = new MutationObserver(() => queue_sync());
      page_observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    }
    queue_sync(true);
  }

  sync_observer();
  setInterval(() => {
    if (location.href !== last_url) {
      last_url = location.href;
      sync_observer();
    }
  }, 700);
})();
