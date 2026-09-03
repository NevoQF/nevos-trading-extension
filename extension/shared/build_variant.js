/* Build variant flag. release.js --variant lite flips NTE_IS_LITE to true in staging. */
const NTE_IS_LITE = false;
const NTE_LITE_DROP_OPTION_PATHS = [
  "show-usd-values",
  "values-to-use",
  "analyze-trade",
  "quick-proof",
];

function nte_is_lite() {
  return NTE_IS_LITE === true;
}

function nte_filter_option_groups(groups) {
  if (!nte_is_lite() || !Array.isArray(groups)) return groups;
  let drop = new Set(NTE_LITE_DROP_OPTION_PATHS);
  let out = [];
  for (let i = 0; i < groups.length; i++) {
    let item = groups[i];
    if (typeof item === "string") {
      let has = false;
      for (let j = i + 1; j < groups.length; j++) {
        if (typeof groups[j] === "string") break;
        if (groups[j] && !drop.has(groups[j].path)) {
          has = true;
          break;
        }
      }
      if (has) out.push(item);
      continue;
    }
    if (item && !drop.has(item.path)) out.push(item);
  }
  return out;
}

function nte_product_name() {
  return nte_is_lite()
    ? "Nevos Trading Extension LITE"
    : "Nevos Trading Extension";
}

function nte_product_short_name() {
  return nte_is_lite() ? "Nevos LITE" : "Nevos Trade";
}
