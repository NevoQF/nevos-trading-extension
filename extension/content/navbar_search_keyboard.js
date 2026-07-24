(() => {
  const custom_item_selector =
    "li.nte-people-search-item, li.nte-quick-search-item";
  let attached_input = null;
  let class_observer = null;

  function find_dropdown_list() {
    let direct = document.querySelector(
      "ul.new-navbar-search-menu, ul.navbar-search-menu, ul.navbar-search-options",
    );
    if (direct) return direct;
    let li = document.querySelector("li.navbar-search-option");
    return li ? li.parentElement : null;
  }

  function selected_class_for(list) {
    return list.classList.contains("new-dropdown-menu")
      ? "new-selected"
      : "selected";
  }

  function list_options(list) {
    return [...list.querySelectorAll(":scope > li.navbar-search-option")];
  }

  function has_custom_items(list) {
    return !!list.querySelector(custom_item_selector);
  }

  function is_custom_item(li) {
    return !!(
      li &&
      (li.classList.contains("nte-people-search-item") ||
        li.classList.contains("nte-quick-search-item"))
    );
  }

  function clear_selection(list, selected_class) {
    for (let li of list.querySelectorAll(`:scope > li.${selected_class}`)) {
      li.classList.remove(selected_class);
    }
  }

  function select_option(list, selected_class, next) {
    if (!next) return;
    clear_selection(list, selected_class);
    next.classList.add(selected_class);
    try {
      next.scrollIntoView({ block: "nearest" });
    } catch {}
  }

  function on_keydown(ev) {
    let is_down = ev.key === "ArrowDown" || (ev.key === "Tab" && !ev.shiftKey);
    let is_up = ev.key === "ArrowUp" || (ev.key === "Tab" && ev.shiftKey);
    if (!is_down && !is_up) return;

    let list = find_dropdown_list();
    if (!list || !has_custom_items(list)) return;

    let selected_class = selected_class_for(list);
    let options = list_options(list);
    if (!options.length) return;

    let idx = options.findIndex((li) => li.classList.contains(selected_class));
    if (idx < 0) idx = is_down ? -1 : 0;

    let next_idx;
    if (is_up) next_idx = idx <= 0 ? options.length - 1 : idx - 1;
    else next_idx = idx >= options.length - 1 ? 0 : idx + 1;

    select_option(list, selected_class, options[next_idx]);
    ev.preventDefault();
    ev.stopImmediatePropagation();
    ev.stopPropagation();
  }

  function on_keyup(ev) {
    if (ev.key !== "Enter") return;
    let list = find_dropdown_list();
    if (!list || !has_custom_items(list)) return;

    let selected_class = selected_class_for(list);
    let selected = list.querySelector(`:scope > li.${selected_class}`);
    if (!is_custom_item(selected)) return;

    let href = selected.querySelector("a")?.href;
    if (!href) return;

    ev.preventDefault();
    ev.stopImmediatePropagation();
    ev.stopPropagation();
    location.href = href;
  }

  function reconcile_selection() {
    let list = find_dropdown_list();
    if (!list || !has_custom_items(list)) return;
    let selected_class = selected_class_for(list);
    let selected = [
      ...list.querySelectorAll(`:scope > li.${selected_class}`),
    ];
    if (selected.length <= 1) return;

    let custom = selected.filter(is_custom_item);
    let native = selected.filter((li) => !is_custom_item(li));
    if (!custom.length || !native.length) {
      for (let i = 1; i < selected.length; i++) {
        selected[i].classList.remove(selected_class);
      }
      return;
    }

    // Prefer keeping the custom highlight when Roblox also marks a native row.
    for (let li of native) li.classList.remove(selected_class);
  }

  function watch_selection_classes(root) {
    if (class_observer) class_observer.disconnect();
    class_observer = new MutationObserver(() => {
      reconcile_selection();
    });
    class_observer.observe(root, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  function attach(input) {
    if (!input || input.dataset.nteSearchKeyboard === "1") return;
    input.dataset.nteSearchKeyboard = "1";
    attached_input = input;
    input.addEventListener("keydown", on_keydown, true);
    input.addEventListener("keyup", on_keyup, true);
    let root =
      input.closest("#navbar-universal-search, .navbar-search, .navbar-left") ||
      document.documentElement;
    watch_selection_classes(root);
  }

  function find_and_attach() {
    attach(document.getElementById("navbar-search-input"));
  }

  find_and_attach();
  let raf = 0;
  new MutationObserver(() => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      find_and_attach();
      reconcile_selection();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
