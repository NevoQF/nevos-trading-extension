(() => {
  const option_name = "Quick User Search";
  const legacy_option_name = "Quick People Search";
  const item_class = "nte-people-search-item";
  const container_id = "nte-people-search-container";
  const style_id = "nte-people-search-style";
  const friends_storage_key = "nte_people_search_friends";
  const debounce_ms = 0;
  const min_query_len = 3;
  const max_results = 4;
  const username_re = /^[a-zA-Z0-9]+(?:[ _.]?[a-zA-Z0-9]+)?$/;
  const friends_ttl_ms = 30 * 60 * 1000;
  const thumb_ttl_ms = 30 * 60 * 1000;
  const presence_ttl_ms = 30 * 1000;
  const stats_ok_ttl_ms = 15 * 60 * 1000;
  const stats_miss_ttl_ms = 20 * 1000;

  let friends_cache = null;
  let friends_cache_at = 0;
  let friends_promise = null;
  let thumb_cache = new Map();
  let presence_cache = new Map();
  let value_cache = new Map();
  let last_results = [];
  let last_query = "";
  let pending_token = 0;
  let debounce_timer = 0;
  let injecting = false;
  let active_input = null;
  let enabled_cache = true;
  let enabled_cache_at = 0;

  function get_option_value(name) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([name], (r) =>
          resolve(r ? r[name] : undefined),
        );
      } catch {
        resolve(undefined);
      }
    });
  }

  async function is_enabled() {
    if (Date.now() - enabled_cache_at < 5000) return enabled_cache;
    let v = await get_option_value(option_name);
    if (v === undefined) v = await get_option_value(legacy_option_name);
    enabled_cache = v === undefined ? true : v === true;
    enabled_cache_at = Date.now();
    return enabled_cache;
  }

  function is_enabled_sync() {
    return enabled_cache;
  }

  function send_message(message) {
    return new Promise((resolve) => {
      let settled = false;
      let finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      try {
        if (typeof globalThis.nte_extension_alive === "function" && !globalThis.nte_extension_alive())
          return finish(null);
        let r = chrome.runtime.sendMessage(message, (response) => {
          try {
            if (chrome.runtime.lastError) finish(null);
            else finish(response);
          } catch {
            finish(null);
          }
        });
        if (r && typeof r.then === "function")
          r.then((v) => finish(v), () => finish(null));
      } catch {
        finish(null);
      }
    });
  }

  function normalize_query(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function format_stat(value) {
    let n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return n.toLocaleString("en-US");
  }

  function find_dropdown_list() {
    let direct = document.querySelector(
      "ul.new-navbar-search-menu, ul.navbar-search-menu, ul.navbar-search-options",
    );
    if (direct) return direct;
    let li = document.querySelector("li.navbar-search-option");
    return li ? li.parentElement : null;
  }

  function pin_people_first(list) {
    if (!list) return;
    let people = [...list.querySelectorAll(`:scope > li.${item_class}`)];
    if (!people.length) return;
    let children = [...list.children];
    let already =
      people.length <= children.length &&
      people.every((li, i) => children[i] === li);
    if (already) return;
    for (let i = people.length - 1; i >= 0; i--) list.prepend(people[i]);
  }

  function ensure_styles() {
    if (document.getElementById(style_id)) return;
    let style = document.createElement("style");
    style.id = style_id;
    style.textContent = `
      li.${item_class} > a.new-navbar-search-anchor {
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        padding: 8px 12px 8px 0 !important;
        text-decoration: none !important;
      }
      li.${item_class} .nte-people-search-avatar {
        position: relative;
        width: 48px;
        height: 48px;
        flex: 0 0 auto;
      }
      li.${item_class} .nte-people-search-thumb {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        object-fit: cover;
        background: rgba(128,128,128,0.18);
        display: block;
      }
      li.${item_class} .nte-people-search-thumb.is-loading {
        opacity: 0.55;
      }
      li.${item_class} .nte-people-search-presence {
        display: none;
        position: absolute;
        right: -1px;
        bottom: -1px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid #1b1f27;
        box-sizing: border-box;
        pointer-events: none;
      }
      li.${item_class} .nte-people-search-presence.online,
      li.${item_class} .nte-people-search-presence.icon-online {
        display: block;
        background: #00a2ff;
      }
      li.${item_class} .nte-people-search-presence.game,
      li.${item_class} .nte-people-search-presence.icon-game {
        display: block;
        background: #02b757;
      }
      li.${item_class} .nte-people-search-presence.studio,
      li.${item_class} .nte-people-search-presence.icon-studio {
        display: block;
        background: #f68802;
      }
      .light-theme li.${item_class} .nte-people-search-presence {
        border-color: #fff;
      }
      li.${item_class} .nte-people-search-body {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        flex: 1 1 auto;
      }
      li.${item_class} .nte-people-search-name {
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      li.${item_class} .nte-people-search-name b {
        font-weight: 800;
      }
      li.${item_class} .nte-people-search-friend {
        color: rgba(134, 239, 172, 0.95);
        font-size: 12px;
        font-weight: 400;
        line-height: 1.2;
      }
      li.${item_class} .nte-people-search-sub {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        min-height: 18px;
      }
      li.${item_class} .nte-people-search-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 7px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.5);
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.02em;
        line-height: 1.2;
      }
      li.${item_class} .nte-people-search-chip strong {
        font-weight: 700;
        color: rgba(255, 255, 255, 0.9);
        font-size: 11px;
        letter-spacing: 0;
      }
      li.${item_class} .nte-people-search-chip.is-value strong {
        color: #93c5fd;
      }
      li.${item_class} .nte-people-search-chip.is-muted {
        color: rgba(255, 255, 255, 0.42);
      }
      li.${item_class} .nte-people-search-chip.is-loading strong {
        opacity: 0.55;
      }
      .light-theme li.${item_class} .nte-people-search-name {
        color: #111827;
      }
      .light-theme li.${item_class} .nte-people-search-friend {
        color: #15803d;
      }
      .light-theme li.${item_class} .nte-people-search-chip {
        background: rgba(15, 23, 42, 0.06);
        color: rgba(55, 65, 81, 0.72);
      }
      .light-theme li.${item_class} .nte-people-search-chip strong {
        color: #111827;
      }
      .light-theme li.${item_class} .nte-people-search-chip.is-value strong {
        color: #2563eb;
      }
    `;
    document.head.appendChild(style);
  }

  function build_chip(label, value, extra_class) {
    let chip = document.createElement("span");
    chip.className = `nte-people-search-chip${extra_class ? ` ${extra_class}` : ""}`;
    chip.innerHTML = `${label} <strong>${value}</strong>`;
    return chip;
  }

  function highlight_name(display, query) {
    let q = String(query || "");
    if (!q) return display;
    let lower = display.toLowerCase();
    let idx = lower.indexOf(q.toLowerCase());
    if (idx < 0) return display;
    return (
      display.slice(0, idx) +
      "<b>" +
      display.slice(idx, idx + q.length) +
      "</b>" +
      display.slice(idx + q.length)
    );
  }

  function build_li(user, query) {
    ensure_styles();
    let li = document.createElement("li");
    li.className = `navbar-search-option rbx-clickable-li ${item_class}`;
    li.dataset.ntePeopleUserId = String(user.userId);
    li.dataset.searchurl = `/User.aspx?userId=${user.userId}&searchTerm=`;

    let a = document.createElement("a");
    a.className = "new-navbar-search-anchor";
    a.href = `https://www.roblox.com/users/${user.userId}/profile`;
    // Keep search focused so blur cleanup doesn't remove the row mid-click.
    a.addEventListener("mousedown", (e) => e.preventDefault());

    let avatar = document.createElement("div");
    avatar.className = "nte-people-search-avatar";
    let img = document.createElement("img");
    img.className = "nte-people-search-thumb is-loading";
    img.alt = "";
    img.src =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    let presence = document.createElement("span");
    presence.className = "nte-people-search-presence";
    presence.dataset.testid = "presence-icon";
    presence.setAttribute("aria-hidden", "true");
    avatar.append(img, presence);

    let body = document.createElement("div");
    body.className = "nte-people-search-body";

    let name = document.createElement("div");
    name.className = "nte-people-search-name";
    let display =
      user.displayName && user.displayName !== user.name
        ? `${user.displayName} (@${user.name})`
        : user.name || user.displayName || `User ${user.userId}`;
    name.innerHTML = highlight_name(display, query);

    let sub = document.createElement("div");
    sub.className = "nte-people-search-sub";
    let rap_chip = build_chip("RAP", "…", "is-loading");
    let value_chip = build_chip("Value", "…", "is-value is-loading");
    rap_chip.dataset.ntePeopleStat = "rap";
    value_chip.dataset.ntePeopleStat = "value";
    sub.append(rap_chip, value_chip);

    body.append(name);
    if (is_friend_user(user)) {
      let friend_label = document.createElement("div");
      friend_label.className = "nte-people-search-friend";
      friend_label.textContent = "You are friends.";
      body.appendChild(friend_label);
    }
    body.appendChild(sub);
    a.append(avatar, body);
    li.appendChild(a);
    return li;
  }

  function clear_injected() {
    for (let el of document.querySelectorAll(`li.${item_class}`)) el.remove();
    let box = document.getElementById(container_id);
    if (box) box.remove();
  }

  function inject_into(list, results, query) {
    if (!list) return;
    injecting = true;
    try {
      ensure_styles();
      clear_injected();
      if (!results.length) return;
      let frag = document.createDocumentFragment();
      for (let user of results) frag.appendChild(build_li(user, query));
      list.prepend(frag);
    } finally {
      injecting = false;
    }
  }

  function update_li_stats(user_id, stats) {
    let li = document.querySelector(
      `li.${item_class}[data-nte-people-user-id="${CSS.escape(String(user_id))}"]`,
    );
    if (!li) return;
    let rap = li.querySelector('[data-nte-people-stat="rap"]');
    let value = li.querySelector('[data-nte-people-stat="value"]');
    let rap_text = format_stat(stats?.rap);
    let value_text = format_stat(stats?.value);
    let has_numbers =
      (Number(stats?.rap) || 0) > 0 || (Number(stats?.value) || 0) > 0;

    if (stats?.terminated && !has_numbers) {
      if (rap) {
        rap.classList.remove("is-loading");
        rap.classList.add("is-muted");
        rap.innerHTML = `RAP <strong>—</strong>`;
      }
      if (value) {
        value.classList.remove("is-loading");
        value.classList.add("is-muted");
        value.innerHTML = `Value <strong>Terminated</strong>`;
      }
      return;
    }

    if (rap) {
      rap.classList.remove("is-loading");
      if (!has_numbers && stats?.privacy_enabled) rap.classList.add("is-muted");
      else rap.classList.remove("is-muted");
      rap.innerHTML = `RAP <strong>${rap_text}</strong>`;
    }
    if (value) {
      value.classList.remove("is-loading");
      if (!has_numbers && stats?.privacy_enabled) {
        value.classList.add("is-muted");
        value.innerHTML = `Value <strong>Private</strong>`;
      } else {
        value.classList.remove("is-muted");
        value.innerHTML = `Value <strong>${value_text}</strong>`;
      }
    }
  }

  function update_li_thumb(user_id, url) {
    let img = document.querySelector(
      `li.${item_class}[data-nte-people-user-id="${CSS.escape(String(user_id))}"] .nte-people-search-thumb`,
    );
    if (!img || !url) return;
    img.classList.remove("is-loading");
    img.src = url;
  }

  function update_li_presence(user_id, info) {
    let el = document.querySelector(
      `li.${item_class}[data-nte-people-user-id="${CSS.escape(String(user_id))}"] .nte-people-search-presence`,
    );
    if (!el) return;
    el.className = "nte-people-search-presence";
    el.removeAttribute("title");
    let type = Number(info?.userPresenceType) || 0;
    if (type === 2) {
      el.classList.add("game", "icon-game");
      el.title = String(info.lastLocation || "In Experience").trim() || "In Experience";
    } else if (type === 3) {
      el.classList.add("studio", "icon-studio");
      el.title = "Studio";
    } else if (type > 0) {
      el.classList.add("online", "icon-online");
      el.title = "Website";
    }
  }

  async function fetch_presences(user_ids) {
    let ids = [...new Set((user_ids || []).map(Number).filter((id) => id > 0))];
    if (!ids.length) return;
    let need = ids.filter((id) => {
      let hit = presence_cache.get(String(id));
      return !(hit && Date.now() - hit.at < presence_ttl_ms);
    });
    if (!need.length) return;
    try {
      let res = await fetch("https://presence.roblox.com/v1/presence/users", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ userIds: need }),
      });
      if (!res.ok) return;
      let json = await res.json().catch(() => null);
      let now = Date.now();
      for (let row of json?.userPresences || []) {
        let id = Number(row.userId) || 0;
        if (!id) continue;
        presence_cache.set(String(id), { info: row, at: now });
      }
      for (let id of need) {
        if (!presence_cache.has(String(id))) {
          presence_cache.set(String(id), {
            info: { userId: id, userPresenceType: 0 },
            at: now,
          });
        }
      }
    } catch {}
  }

  function remember_friends(friends) {
    friends_cache = Array.isArray(friends) ? friends : [];
    friends_cache_at = Date.now();
    try {
      chrome.storage.local.set({
        [friends_storage_key]: {
          at: friends_cache_at,
          friends: friends_cache,
        },
      });
    } catch {}
  }

  function is_friend_user(user) {
    if (!user) return false;
    if (user.isFriend) return true;
    let id = Number(user.userId) || 0;
    if (!id || !Array.isArray(friends_cache)) return false;
    return friends_cache.some((row) => row.userId === id);
  }

  function mark_friend_flags(rows) {
    return (rows || []).map((row) => ({
      ...row,
      isFriend: is_friend_user(row),
    }));
  }

  function merge_search_results(base, extra) {
    let by_id = new Map();
    for (let row of mark_friend_flags(base)) {
      if (row?.userId) by_id.set(row.userId, row);
    }
    for (let row of mark_friend_flags(extra)) {
      if (!row?.userId) continue;
      let prev = by_id.get(row.userId);
      by_id.set(row.userId, prev ? { ...prev, ...row, isFriend: prev.isFriend || row.isFriend } : row);
    }
    let friends_first = [...by_id.values()].sort(
      (a, b) => Number(b.isFriend) - Number(a.isFriend),
    );
    return friends_first.slice(0, max_results);
  }

  async function read_stored_friends() {
    try {
      let stored = await get_option_value(friends_storage_key);
      if (!stored || !Array.isArray(stored.friends) || !stored.friends.length) {
        return null;
      }
      if (Date.now() - Number(stored.at || 0) > friends_ttl_ms) return null;
      if (
        !stored.friends.every(
          (row) => row?.userId > 0 && String(row.name || "").trim(),
        )
      ) {
        return null;
      }
      return stored.friends;
    } catch {
      return null;
    }
  }

  async function hydrate_friend_names(friends) {
    let list = Array.isArray(friends) ? friends.slice() : [];
    let need = list.filter((row) => row.userId > 0 && !String(row.name || "").trim());
    if (!need.length) return list.filter((row) => row.userId > 0 && row.name);

    let by_id = new Map(list.map((row) => [row.userId, { ...row, isFriend: true }]));
    // Friends currently return blank names; hydrate via profile API only.
    // Do not fall back to users.roblox.com/v1/users (shared account rate limit).
    for (let i = 0; i < need.length; i += 100) {
      let ids = need.slice(i, i + 100).map((row) => row.userId);
      try {
        let res = await fetch(
          "https://apis.roblox.com/user-profile-api/v1/user/profiles/get-profiles",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              userIds: ids,
              fields: ["names.username", "names.displayName"],
            }),
          },
        );
        if (!res.ok) continue;
        let json = await res.json().catch(() => null);
        for (let profile of json?.profileDetails || []) {
          let id = Number(profile.userId) || 0;
          let prev = by_id.get(id);
          if (!prev) continue;
          let name = String(profile.names?.username || "");
          if (!name) continue;
          by_id.set(id, {
            ...prev,
            name,
            displayName: String(profile.names?.displayName || name),
            isFriend: true,
          });
        }
      } catch {}
    }

    return [...by_id.values()].filter(
      (row) => row.userId > 0 && String(row.name || "").trim(),
    );
  }

  async function load_friends_direct() {
    try {
      let me = await fetch(
        "https://users.roblox.com/v1/users/authenticated",
        { credentials: "include", cache: "no-store" },
      );
      if (!me.ok) return [];
      let me_json = await me.json().catch(() => null);
      let my_id = Number(me_json?.id) || 0;
      if (!my_id) return [];
      let res = await fetch(
        `https://friends.roblox.com/v1/users/${my_id}/friends`,
        { credentials: "include", cache: "no-store" },
      );
      if (!res.ok) return [];
      let json = await res.json().catch(() => null);
      let friends = (Array.isArray(json?.data) ? json.data : [])
        .map((row) => ({
          userId: Number(row.id) || 0,
          name: String(row.name || ""),
          displayName: String(row.displayName || row.name || ""),
          isFriend: true,
        }))
        .filter((row) => row.userId > 0);
      return await hydrate_friend_names(friends);
    } catch {
      return [];
    }
  }

  function with_timeout(promise, ms, fallback) {
    return new Promise((resolve) => {
      let done = false;
      let timer = setTimeout(() => {
        if (done) return;
        done = true;
        resolve(fallback);
      }, ms);
      Promise.resolve(promise).then(
        (value) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(value);
        },
        () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(fallback);
        },
      );
    });
  }

  function friends_have_names(friends) {
    return (
      Array.isArray(friends) &&
      friends.length > 0 &&
      friends.every((row) => row.userId > 0 && String(row.name || "").trim())
    );
  }

  async function load_friends() {
    if (
      friends_have_names(friends_cache) &&
      friends_cache_at > 0 &&
      Date.now() - friends_cache_at < friends_ttl_ms
    ) {
      return friends_cache;
    }
    if (friends_promise) return friends_promise;
    friends_promise = (async () => {
      try {
        if (!friends_have_names(friends_cache)) {
          let stored = await read_stored_friends();
          if (friends_have_names(stored)) {
            friends_cache = stored;
            friends_cache_at = Date.now();
          }
        }

        let direct = await with_timeout(load_friends_direct(), 8000, []);
        if (friends_have_names(direct)) {
          remember_friends(direct);
          return friends_cache;
        }

        let res = await with_timeout(
          send_message({ type: "roblox_friends_list" }),
          8000,
          null,
        );
        let friends = await hydrate_friend_names(
          Array.isArray(res?.friends) ? res.friends : [],
        );
        if (friends_have_names(friends)) remember_friends(friends);
        else if (!friends_have_names(friends_cache)) {
          friends_cache = [];
          friends_cache_at = 0;
        }
        return friends_have_names(friends_cache) ? friends_cache : [];
      } catch {
        return friends_have_names(friends_cache) ? friends_cache : [];
      } finally {
        friends_promise = null;
      }
    })();
    return friends_promise;
  }

  async function resolve_username(query) {
    let q = String(query || "").trim();
    if (q.length < 3 || !username_re.test(q)) return null;
    try {
      let res = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          usernames: [q],
          excludeBannedUsers: false,
        }),
      });
      if (!res.ok) return null;
      let json = await res.json().catch(() => null);
      let row = Array.isArray(json?.data) ? json.data[0] : null;
      if (!row?.id) return null;
      return {
        userId: Number(row.id) || 0,
        name: String(row.name || q),
        displayName: String(row.displayName || row.name || q),
        isFriend: false,
      };
    } catch {
      return null;
    }
  }

  function match_friends(query, friends) {
    let q = normalize_query(query);
    if (!q) return [];
    let scored = [];
    for (let friend of friends || []) {
      let name = normalize_query(friend.name);
      let display = normalize_query(friend.displayName);
      if (!name) continue;
      let name_idx = name.indexOf(q);
      let display_idx = display.indexOf(q);
      if (name_idx < 0 && display_idx < 0) continue;
      let exact = name === q || display === q;
      let starts = name.startsWith(q) || display.startsWith(q);
      let score = exact
        ? 0
        : starts
          ? 1
          : 2 +
            Math.min(
              name_idx >= 0 ? name_idx : 999,
              display_idx >= 0 ? display_idx : 999,
            );
      scored.push({ friend, score, name });
    }
    scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
    return scored.slice(0, max_results).map((row) => row.friend);
  }

  async function fetch_thumbs(user_ids) {
    let need = user_ids.filter((id) => {
      let hit = thumb_cache.get(String(id));
      return !(hit && Date.now() - hit.at < thumb_ttl_ms);
    });
    if (!need.length) return;
    try {
      let res = await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${need.join(",")}&size=48x48&format=Png&isCircular=true`,
        { credentials: "omit" },
      );
      if (!res.ok) return;
      let json = await res.json().catch(() => null);
      for (let row of json?.data || []) {
        if (row?.imageUrl) {
          thumb_cache.set(String(row.targetId), {
            url: row.imageUrl,
            at: Date.now(),
          });
        }
      }
    } catch {}
  }

  async function fetch_player_stats(user_id) {
    let id = String(user_id);
    let cached = value_cache.get(id);
    if (cached) {
      let ttl = cached.ok ? stats_ok_ttl_ms : stats_miss_ttl_ms;
      if (Date.now() - cached.at < ttl) return cached;
    }
    let res = await send_message({
      type: "rolimons_player_info",
      user_id: id,
    });
    if (!res?.ok) {
      let miss = { ok: false, at: Date.now() };
      value_cache.set(id, miss);
      return miss;
    }
    let rec = {
      ok: true,
      value: Number(res.value) || 0,
      rap: Number(res.rap) || 0,
      privacy_enabled: !!res.privacy_enabled,
      terminated: !!res.terminated,
      at: Date.now(),
    };
    value_cache.set(id, rec);
    return rec;
  }

  async function hydrate_results(results, token) {
    let ids = results.map((row) => row.userId).filter(Boolean);
    await Promise.all([fetch_thumbs(ids), fetch_presences(ids)]);
    if (token !== pending_token) return;
    for (let user of results) {
      let thumb = thumb_cache.get(String(user.userId));
      if (thumb?.url) update_li_thumb(user.userId, thumb.url);
      let presence = presence_cache.get(String(user.userId));
      if (presence?.info) update_li_presence(user.userId, presence.info);
    }
    await Promise.all(
      results.map(async (user) => {
        let stats = await fetch_player_stats(user.userId);
        if (token !== pending_token) return;
        update_li_stats(user.userId, stats);
      }),
    );
  }

  function run_search(query) {
    let q = normalize_query(query);
    if (q.length < min_query_len) {
      last_results = [];
      last_query = "";
      clear_injected();
      return;
    }
    let token = ++pending_token;
    let friends = friends_cache || [];
    let results = mark_friend_flags(match_friends(q, friends));
    last_results = results;
    last_query = q;
    let list = find_dropdown_list();
    if (list) {
      if (results.length) inject_into(list, results, q);
      else clear_injected();
    }

    let friends_fresh = friends_have_names(friends_cache) &&
      friends_cache_at > 0 &&
      Date.now() - friends_cache_at < friends_ttl_ms;
    if (!friends_fresh) {
      load_friends().then((loaded) => {
        if (token !== pending_token) return;
        if (!active_input) return;
        if (normalize_query(active_input.value || "") !== q) return;
        let next = merge_search_results(match_friends(q, loaded), last_results);
        apply_results(next, q, token, true);
      });
    }

    if (q.length >= 3 && username_re.test(q.replace(/\s+/g, " "))) {
      resolve_username(query.trim()).then((resolved) => {
        if (token !== pending_token) return;
        if (!active_input) return;
        if (normalize_query(active_input.value || "") !== q) return;
        if (!resolved?.userId) {
          if (last_results.length) hydrate_results(last_results, token).catch(() => {});
          return;
        }
        let next = merge_search_results(last_results, [
          { ...resolved, isFriend: is_friend_user(resolved) },
        ]);
        apply_results(next, q, token, true);
      });
    } else if (results.length) {
      hydrate_results(results, token).catch(() => {});
    }
  }

  function apply_results(results, q, token, hydrate) {
    if (token !== pending_token) return;
    let next = mark_friend_flags(results);
    if (!next.length) {
      last_results = [];
      last_query = q;
      clear_injected();
      return;
    }
    last_results = next;
    last_query = q;
    let list = find_dropdown_list();
    if (list) inject_into(list, next, q);
    if (hydrate) hydrate_results(next, token).catch(() => {});
  }

  function on_input(input) {
    clearTimeout(debounce_timer);
    let value = input.value || "";
    // Update friend matches immediately so typing never feels stuck.
    if (!is_enabled_sync()) {
      last_results = [];
      clear_injected();
      return;
    }
    run_search(value);
    // Refresh enabled flag in background occasionally.
    if (Date.now() - enabled_cache_at > 5000) {
      debounce_timer = setTimeout(() => {
        is_enabled().then((on) => {
          if (!on) {
            last_results = [];
            clear_injected();
          }
        });
      }, 0);
    }
  }

  function reapply_if_missing() {
    if (injecting || !last_results.length) return;
    let list = find_dropdown_list();
    if (!list) return;
    let ours = list.querySelectorAll(`li.${item_class}`);
    if (ours.length !== last_results.length) {
      let q = active_input
        ? normalize_query(active_input.value || "")
        : last_query;
      if (q !== last_query) return;
      inject_into(list, last_results, last_query);
      hydrate_results(last_results, pending_token).catch(() => {});
      return;
    }
    // Roblox/item search keeps shoving nodes above us — pin people first.
    pin_people_first(list);
  }

  function attach(input) {
    if (input.dataset.ntePeopleSearch === "1") return;
    input.dataset.ntePeopleSearch = "1";
    active_input = input;
    input.addEventListener("input", () => {
      active_input = input;
      on_input(input);
    });
    input.addEventListener("focus", () => {
      active_input = input;
      load_friends().catch(() => {});
      is_enabled().then((on) => {
        if (
          on &&
          (input.value || "").trim().length >= min_query_len &&
          active_input === input
        ) {
          on_input(input);
        }
      });
    });
    input.addEventListener("blur", () => {
      setTimeout(() => {
        if (document.activeElement === input) return;
        last_results = [];
        clear_injected();
      }, 220);
    });
    load_friends().then(() => {
      if (
        active_input === input &&
        (input.value || "").trim().length >= min_query_len &&
        is_enabled_sync()
      ) {
        on_input(input);
      }
    });
  }

  function find_and_attach() {
    let input = document.getElementById("navbar-search-input");
    if (input) attach(input);
  }

  is_enabled().catch(() => {});
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (!changes[option_name] && !changes[legacy_option_name]) return;
      enabled_cache_at = 0;
      is_enabled().then((on) => {
        if (on) return;
        last_results = [];
        clear_injected();
      });
    });
  } catch {}
  read_stored_friends().then((stored) => {
    if (stored?.length && !friends_cache) {
      friends_cache = stored;
      friends_cache_at = Date.now();
    }
  });
  load_friends().catch(() => {});
  find_and_attach();
  let raf = 0;
  new MutationObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      find_and_attach();
      reapply_if_missing();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
