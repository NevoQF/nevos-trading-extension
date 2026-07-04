(() => {
  const style_id = "nte-settings-menu-style";
  const logo_path = "assets/icons/logo32.png";

  function get_logo_url() {
    try {
      return chrome.runtime.getURL(logo_path);
    } catch {
      return "";
    }
  }

  function inject_styles() {
    if (document.getElementById(style_id)) return;
    const style = document.createElement("style");
    style.id = style_id;
    style.textContent = `
      #settings-popover-menu .nte-settings-toggle{
        display:flex;
        align-items:center;
        gap:8px;
        padding-top:6px;
        padding-bottom:6px;
        line-height:1.1;
        text-decoration:none;
        cursor:pointer;
      }
      #settings-popover-menu .nte-settings-toggle:hover,
      #settings-popover-menu .nte-settings-toggle:focus{
        text-decoration:none;
      }
      #settings-popover-menu .nte-settings-menu-inner{
        display:flex;
        align-items:center;
        gap:8px;
        min-width:0;
      }
      #settings-popover-menu .nte-settings-menu-logo{
        width:18px;
        height:18px;
        flex:0 0 18px;
        border-radius:4px;
        object-fit:contain;
        display:block;
      }
      #settings-popover-menu .nte-settings-menu-wrap{
        display:block;
        min-width:0;
      }
      #settings-popover-menu .nte-settings-menu-primary{
        display:block;
        font-size:14px;
        font-weight:500;
        color:inherit;
      }
      #settings-popover-menu .nte-settings-menu-secondary{
        display:block;
        margin-top:2px;
        font-size:10px;
        font-weight:400;
        letter-spacing:.02em;
        opacity:.52;
        color:inherit;
      }
      .light-theme #settings-popover-menu .nte-settings-menu-secondary{
        opacity:.48;
      }
    `;
    document.head.appendChild(style);
  }

  function send_message(message) {
    return new Promise((resolve) => {
      try {
        const result = chrome.runtime.sendMessage(message, (response) => {
          resolve(response);
        });
        if (result && typeof result.then === "function") {
          result.then((value) => resolve(value), () => resolve(null));
        }
      } catch {
        resolve(null);
      }
    });
  }

  async function open_extension_settings() {
    try {
      if (chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
        return;
      }
    } catch {}
    await send_message({ type: "open_extension_settings" });
  }

  function close_settings_popover() {
    const toggle =
      document.querySelector("#settings-icon") ||
      document.querySelector('[data-testid="settings-icon"]') ||
      document.querySelector(".icon-nav-settings");
    if (toggle instanceof HTMLElement) {
      toggle.click();
      return;
    }
    document.body?.click();
  }

  function find_settings_insert_point(menu) {
    for (const li of menu.querySelectorAll(":scope > li")) {
      const link = li.querySelector("a.rbx-menu-item");
      if (!link) continue;
      const href = String(link.getAttribute("href") || "");
      if (
        href.includes("/my/account") &&
        !href.includes("roseal") &&
        !link.classList.contains("btr-settings-toggle") &&
        !link.classList.contains("nte-settings-toggle")
      ) {
        return li;
      }
    }
    return null;
  }

  function wire_settings_link(link) {
    if (link.dataset.nteSettingsBound === "1") return;
    link.dataset.nteSettingsBound = "1";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      open_extension_settings();
      setTimeout(close_settings_popover, 0);
    });
  }

  function build_menu_content(link) {
    const logo_url = get_logo_url();
    link.replaceChildren();

    const inner = document.createElement("span");
    inner.className = "nte-settings-menu-inner";

    if (logo_url) {
      const logo = document.createElement("img");
      logo.className = "nte-settings-menu-logo";
      logo.src = logo_url;
      logo.alt = "";
      logo.width = 18;
      logo.height = 18;
      logo.decoding = "async";
      inner.appendChild(logo);
    }

    const wrap = document.createElement("span");
    wrap.className = "nte-settings-menu-wrap";

    const primary = document.createElement("span");
    primary.className = "nte-settings-menu-primary";
    primary.textContent = "nevos";

    const secondary = document.createElement("span");
    secondary.className = "nte-settings-menu-secondary";
    secondary.textContent = "trading extension";

    wrap.append(primary, secondary);
    inner.appendChild(wrap);
    link.appendChild(inner);
  }

  function ensure_settings_menu_item() {
    const menu = document.getElementById("settings-popover-menu");
    if (!menu) return;

    inject_styles();

    let link = menu.querySelector(".nte-settings-toggle");
    if (link) {
      if (!link.querySelector(".nte-settings-menu-logo")) build_menu_content(link);
      wire_settings_link(link);
      return;
    }

    const li = document.createElement("li");
    link = document.createElement("a");
    link.className = "rbx-menu-item nte-settings-toggle";
    link.href = "#";
    link.setAttribute("role", "button");
    build_menu_content(link);
    wire_settings_link(link);
    li.appendChild(link);

    const insert_before = find_settings_insert_point(menu);
    if (insert_before) menu.insertBefore(li, insert_before);
    else menu.appendChild(li);
  }

  ensure_settings_menu_item();

  let raf = 0;
  const observer = new MutationObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      ensure_settings_menu_item();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
