(() => {
  const option_name = "Quick Item Search";
  const data_age_ms = 5 * 60 * 1000;
  const max_results = 6;
  const debounce_ms = 100;
  const min_query_len = 2;
  const item_class = "nte-quick-search-item";

  let item_data = null;
  let item_data_time = 0;
  let item_data_promise = null;
  let name_index = null;
  let name_index_source = null;
  let thumb_cache = {};
  let last_results = [];
  let last_query_norm = "";
  let pending_token = 0;
  let debounce_timer = 0;
  let injecting = false;
  let active_input = null;

  function get_option_value(name) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([name], (r) => resolve(r ? r[name] : undefined));
      } catch {
        resolve(undefined);
      }
    });
  }

  async function is_enabled() {
    const v = await get_option_value(option_name);
    return v === undefined ? true : v === true;
  }

  function send_message(message) {
    return new Promise((resolve) => {
      try {
        const r = chrome.runtime.sendMessage(message);
        if (r && typeof r.then === "function") r.then((v) => resolve(v), () => resolve(null));
        else resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async function load_item_data() {
    if (item_data && Date.now() - item_data_time < data_age_ms) return item_data;
    if (item_data_promise) return item_data_promise;
    item_data_promise = (async () => {
      const data = await send_message(item_data ? "getDataPeriodic" : "getData");
      if (data && data.items) {
        item_data = data;
        item_data_time = Date.now();
      }
      item_data_promise = null;
      return item_data;
    })();
    return item_data_promise;
  }

  function normalize(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function build_index(data) {
    if (name_index_source === data && name_index) return name_index;
    const list = [];
    for (const id in data.items) {
      const row = data.items[id];
      if (!Array.isArray(row) || typeof row[0] !== "string") continue;
      const norm = normalize(row[0]);
      if (!norm) continue;
      const abbr = typeof row[1] === "string" && row[1].trim() && row[1] !== "-1" ? row[1].trim() : "";
      list.push({ id, name: row[0], norm, abbr, value: Number(row[4]) || 0, rap: Number(row[2]) || 0 });
    }
    name_index = list;
    name_index_source = data;
    return list;
  }

  function score_match(entry, tokens) {
    let score = 0;
    let matched = true;
    for (const tok of tokens) {
      const idx = entry.norm.indexOf(tok);
      if (idx === -1) {
        matched = false;
        break;
      }
      if (idx === 0 || entry.norm[idx - 1] === " ") score += 100;
      else score += 10;
      score -= idx;
    }
    if (!matched) {
      if (tokens.length !== 1 || tokens[0].length < 2) return -1;
      const tok = tokens[0];
      const abbr_norm = normalize(entry.abbr);
      if (!abbr_norm || !abbr_norm.includes(tok)) return -1;
      score = abbr_norm === tok ? 80 : abbr_norm.startsWith(tok) ? 60 : 40;
    }
    score += Math.min(60, Math.floor(Math.log10(Math.max(1, entry.value || entry.rap)) * 6));
    return score;
  }

  function search(query, list) {
    const norm = normalize(query);
    if (norm.length < min_query_len) return [];
    const tokens = norm.split(" ").filter(Boolean);
    if (!tokens.length) return [];
    const out = [];
    for (const entry of list) {
      const s = score_match(entry, tokens);
      if (s >= 0) out.push({ entry, score: s });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, max_results).map((x) => x.entry);
  }

  async function fetch_thumbs(ids) {
    const need = ids.filter((id) => !(id in thumb_cache));
    if (!need.length) return;
    try {
      const url = `https://thumbnails.roblox.com/v1/assets?assetIds=${need.join(",")}&size=75x75&format=Png&isCircular=false`;
      const r = await fetch(url, { credentials: "omit" });
      if (!r.ok) return;
      const j = await r.json();
      for (const row of j.data || []) {
        if (row && row.targetId && row.imageUrl) thumb_cache[row.targetId] = row.imageUrl;
      }
    } catch {}
  }

  function find_dropdown_list() {
    const direct = document.querySelector(
      "ul.new-navbar-search-menu, ul.navbar-search-menu, ul.navbar-search-options"
    );
    if (direct) return direct;
    const li = document.querySelector("li.navbar-search-option");
    return li ? li.parentElement : null;
  }

  function build_item_li(entry) {
    const li = document.createElement("li");
    li.className = `navbar-search-option rbx-clickable-li ${item_class}`;
    li.dataset.nteQuickItem = "1";

    const a = document.createElement("a");
    a.className = "new-navbar-search-anchor";
    a.href = `https://www.roblox.com/catalog/${entry.id}/-`;
    a.style.cssText = "padding-left:0;";

    const icon = document.createElement("span");
    icon.className = `navbar-list-option-icon ${item_class}-icon`;
    icon.style.cssText =
      "display:inline-block;width:48px;height:48px;margin-right:10px;background-size:contain;background-position:center;background-repeat:no-repeat;background-color:transparent;vertical-align:middle;flex:0 0 auto;opacity:1!important;filter:none!important;";
    const thumb = thumb_cache[entry.id];
    if (thumb && thumb !== "in-review" && thumb !== "blocked") {
      icon.style.setProperty("background-image", `url("${thumb}")`, "important");
    }

    const text = document.createElement("span");
    text.className = "navbar-list-option-text";
    text.textContent = entry.abbr ? `${entry.name} (${entry.abbr})` : entry.name;

    a.append(icon, text);
    li.appendChild(a);
    return li;
  }

  function clear_injected() {
    for (const el of document.querySelectorAll(`li.${item_class}`)) el.remove();
  }

  function inject_into(list, results) {
    if (!list) return;
    injecting = true;
    try {
      for (const el of list.querySelectorAll(`li.${item_class}`)) el.remove();
      if (!results.length) return;
      const frag = document.createDocumentFragment();
      for (const entry of results) frag.appendChild(build_item_li(entry));
      list.prepend(frag);
    } finally {
      injecting = false;
    }
  }

  function reapply_if_missing() {
    if (injecting) return;
    if (!last_results.length) return;
    const list = find_dropdown_list();
    if (!list) return;
    const ours = list.querySelectorAll(`li.${item_class}`);
    if (ours.length === last_results.length) return;
    inject_into(list, last_results);
  }

  async function run_search(input, query) {
    const norm = normalize(query);
    if (norm.length < min_query_len) {
      last_results = [];
      last_query_norm = "";
      clear_injected();
      return;
    }
    const token = ++pending_token;
    const data = await load_item_data();
    if (token !== pending_token) return;
    if (!data || !data.items) return;
    const list_index = build_index(data);
    const results = search(query, list_index);
    if (!results.length) {
      last_results = [];
      last_query_norm = norm;
      clear_injected();
      return;
    }
    await fetch_thumbs(results.map((r) => r.id));
    if (token !== pending_token) return;
    last_results = results;
    last_query_norm = norm;
    const list = find_dropdown_list();
    if (list) inject_into(list, results);
  }

  function on_input(input) {
    clearTimeout(debounce_timer);
    debounce_timer = setTimeout(async () => {
      if (!(await is_enabled())) {
        last_results = [];
        clear_injected();
        return;
      }
      await run_search(input, input.value || "");
    }, debounce_ms);
  }

  function attach(input) {
    if (input.dataset.nteQuickSearch === "1") return;
    input.dataset.nteQuickSearch = "1";
    active_input = input;
    input.addEventListener("input", () => {
      active_input = input;
      on_input(input);
    });
    input.addEventListener("focus", async () => {
      active_input = input;
      if ((input.value || "").trim().length >= min_query_len && (await is_enabled())) on_input(input);
    });
    input.addEventListener("blur", () => {
      setTimeout(() => {
        last_results = [];
        clear_injected();
      }, 200);
    });
  }

  function find_and_attach() {
    const input = document.getElementById("navbar-search-input");
    if (input) attach(input);
  }

  find_and_attach();

  let raf = 0;
  const observer = new MutationObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      find_and_attach();
      reapply_if_missing();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
