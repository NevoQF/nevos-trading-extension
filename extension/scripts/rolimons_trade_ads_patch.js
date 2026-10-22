// Runs in the Rolimons /trades page world: adds an "Offer Robux" filter next
// to Rolimons' own value filter. Rolimons' filter_control_handler() calls
// filter_request_tag() right after its value filters, so we narrow
// displayable_trade_ads there and its pagination counts stay correct.
(() => {
  if (window.__nte_robux_filter) return;
  if (
    typeof window.filter_control_handler !== "function" ||
    typeof window.filter_request_tag !== "function" ||
    !document.getElementById("trade_ads_offer_value_filter_button")
  )
    return;
  let filter = { min: null, max: null };
  window.__nte_robux_filter = filter;

  let active = () => filter.min !== null || filter.max !== null;
  let original_tag_filter = window.filter_request_tag;
  window.filter_request_tag = function (name, ...rest) {
    if (name === "demand" && active()) {
      window.displayable_trade_ads = window.displayable_trade_ads.filter((ad) => {
        let robux = Number(ad.offer_robux) || 0;
        return (
          robux > 0 &&
          (filter.min === null || robux >= filter.min) &&
          (filter.max === null || robux <= filter.max)
        );
      });
    }
    return original_tag_filter.call(this, name, ...rest);
  };

  function rerun() {
    window.repagination_required = true;
    window.filter_control_handler();
    sync_chips();
  }

  // Modal cloned from Rolimons' "Offer Value Filter" so it looks native.
  let value_modal = document.getElementById("offer_value_filter_modal");
  let modal = value_modal.cloneNode(true);
  modal.id = "nte_offer_robux_filter_modal";
  modal.querySelector(".modal-title").textContent = "Offer Robux Filter";
  let inputs = [...modal.querySelectorAll("input")];
  let labels = [...modal.querySelectorAll("label")];
  let clears = [...modal.querySelectorAll("button.text-light")];
  ["min", "max"].forEach((key, i) => {
    inputs[i].id = `nte_filter_offer_robux_${key}`;
    inputs[i].value = "";
    labels[i].setAttribute("for", inputs[i].id);
    labels[i].textContent = i ? "Maximum Robux" : "Minimum Robux";
    clears[i].id = `nte_clear_offer_robux_${key}`;
    let timer = 0;
    inputs[i].addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        let n = parseInt(inputs[i].value, 10);
        filter[key] = Number.isFinite(n) && n >= 0 ? n : null;
        rerun();
      }, 300);
    });
    clears[i].addEventListener("click", () => {
      inputs[i].value = "";
      filter[key] = null;
      rerun();
    });
  });
  document.body.appendChild(modal);

  let value_btn = document.getElementById("trade_ads_offer_value_filter_button");
  let btn = value_btn.cloneNode(false);
  btn.id = "nte_trade_ads_offer_robux_filter_button";
  btn.classList.add("ml-2");
  btn.innerHTML =
    '<div data-toggle="tooltip" title="Robux Filter"><svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="1.75em" height="1.75em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2.5 20.5 7.4v9.2L12 21.5 3.5 16.6V7.4z"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/></svg></div>';
  btn.addEventListener("click", () => window.$(modal).modal("show"));
  value_btn.after(btn);
  try {
    window.$(btn.firstChild).tooltip();
  } catch {}

  // "Min Robux 1,000 ×" chips beside Rolimons' own value chips.
  let grid = value_btn
    .closest(".trade_ads_filter_button_row")
    ?.parentElement?.querySelector(".enabled_filter_display_grid");
  let template = document.getElementById(
    "enabled_filter_offer_value_min_container",
  );
  let chips = {};
  ["min", "max"].forEach((key) => {
    let chip = template.cloneNode(true);
    chip.id = `nte_enabled_filter_offer_robux_${key}`;
    chip.querySelector(".small").textContent =
      key === "min" ? "Min Robux" : "Max Robux";
    let remove = chip.querySelector("button");
    remove.removeAttribute("onclick");
    remove.removeAttribute("id");
    remove.addEventListener("click", () => {
      filter[key] = null;
      modal.querySelector(`#nte_filter_offer_robux_${key}`).value = "";
      rerun();
    });
    grid?.appendChild(chip);
    chips[key] = chip;
  });
  function sync_chips() {
    for (let key of ["min", "max"]) {
      let chip = chips[key];
      chip.classList.toggle("d-none", filter[key] === null);
      chip.querySelector(".enabled_value_filter_text").textContent =
        filter[key] === null ? "" : filter[key].toLocaleString();
    }
  }
})();
