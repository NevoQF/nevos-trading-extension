function nte_tooltip_targets(selector) {
  if (typeof $ !== "function") return null;
  return selector ? $(selector) : $('[data-toggle="tooltip"]');
}

function nte_ensure_tooltip_style() {
  if (document.getElementById("nteTooltipPointerStyle")) return;
  let style = document.createElement("style");
  style.id = "nteTooltipPointerStyle";
  style.textContent = ".tooltip{pointer-events:none!important}";
  (document.head || document.documentElement).appendChild(style);
}

document.addEventListener("nru_destroy_tooltips", (event) => {
  let targets = nte_tooltip_targets(event.detail);
  if (!targets) return;
  targets.each(function () {
    try {
      $(this).tooltip("destroy");
    } catch (e) {
      try {
        $(this).tooltip("dispose");
      } catch (e) {}
    }
    try {
      $(this).removeData("bs.tooltip").removeData("tooltip");
    } catch (e) {}
  });
});

document.addEventListener("nru_init_tooltips", () => {
  nte_ensure_tooltip_style();
  let targets = nte_tooltip_targets();
  targets && targets.tooltip();
});
