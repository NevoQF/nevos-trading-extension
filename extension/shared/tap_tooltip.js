(function () {
  "use strict";

  const OPEN_CLASS = "is-open";
  const HOST_SELECTOR =
    ".nte-tap-tooltip-host, .about-thanks-hint, .nte-trade-limit-help";
  const TIP_SELECTOR =
    '[role="tooltip"], .nte-tap-tooltip, .about-thanks-tooltip, .nte-trade-limit-tooltip';

  let doc_listeners_bound = false;

  function get_tooltip_el(host) {
    return host?.querySelector?.(TIP_SELECTOR) || null;
  }

  function set_host_open(host, open) {
    if (!host) return;
    host.classList.toggle(OPEN_CLASS, open);
    host.setAttribute("aria-expanded", open ? "true" : "false");
    let tip = get_tooltip_el(host);
    if (tip) tip.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function close_all_tap_tooltips(except) {
    document.querySelectorAll(`${HOST_SELECTOR}.${OPEN_CLASS}`).forEach((host) => {
      if (host !== except) set_host_open(host, false);
    });
  }

  function bind_document_listeners() {
    if (doc_listeners_bound) return;
    doc_listeners_bound = true;

    document.addEventListener(
      "click",
      (event) => {
        if (event.target.closest(HOST_SELECTOR)) return;
        close_all_tap_tooltips();
      },
      true,
    );

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close_all_tap_tooltips();
    });
  }

  function ensure_tap_tooltip_styles() {
    if (document.getElementById("nte-tap-tooltip-styles")) return;
    let style = document.createElement("style");
    style.id = "nte-tap-tooltip-styles";
    style.textContent = `
      .nte-tap-tooltip-host,
      .about-thanks-hint,
      .nte-trade-limit-help {
        -webkit-tap-highlight-color: transparent;
      }
      .nte-tap-tooltip-host:focus-visible,
      .about-thanks-hint:focus-visible,
      .nte-trade-limit-help:focus-visible {
        outline: 2px solid rgba(34, 211, 238, 0.55);
        outline-offset: 2px;
      }
      .nte-tap-tooltip-host.is-open [role="tooltip"],
      .nte-tap-tooltip-host.is-open .nte-tap-tooltip,
      .nte-tap-tooltip-host.is-open .about-thanks-tooltip,
      .nte-tap-tooltip-host.is-open .nte-trade-limit-tooltip,
      .about-thanks-hint.is-open .about-thanks-tooltip,
      .nte-trade-limit-help.is-open .nte-trade-limit-tooltip {
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function bind_tap_tooltip_host(host) {
    if (!host || host.dataset.nteTapTooltipBound === "1") return;
    host.dataset.nteTapTooltipBound = "1";

    if (!host.hasAttribute("tabindex")) host.setAttribute("tabindex", "0");
    if (!host.getAttribute("role")) host.setAttribute("role", "button");
    set_host_open(host, false);

    let tip = get_tooltip_el(host);
    if (tip && !tip.id) {
      tip.id =
        "nte-tap-tip-" +
        Math.random().toString(36).slice(2, 10);
    }
    if (tip?.id) host.setAttribute("aria-describedby", tip.id);

    host.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      let open = !host.classList.contains(OPEN_CLASS);
      close_all_tap_tooltips();
      set_host_open(host, open);
    });

    host.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      host.click();
    });
  }

  function init_tap_tooltips(root, selector) {
    ensure_tap_tooltip_styles();
    bind_document_listeners();
    let scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(selector || HOST_SELECTOR).forEach(bind_tap_tooltip_host);
  }

  globalThis.init_tap_tooltips = init_tap_tooltips;
  globalThis.close_all_tap_tooltips = close_all_tap_tooltips;
})();
