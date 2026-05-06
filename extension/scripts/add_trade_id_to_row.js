function resolve_trade_from_row(row) {
  if (!row) return null;

  let scope = null;
  try {
    scope =
      angular?.element(row)?.scope?.() ||
      angular?.element(row)?.isolateScope?.();
  } catch {}

  return scope?.trade || scope?.$parent?.trade || scope?.$parent?.$parent?.trade || null;
}

function parse_trade_time_value(value) {
  if (null == value || "" === value) return 0;
  let numeric = "number" == typeof value || ("string" == typeof value && /^\d+(\.\d+)?$/.test(value.trim()));
  let time = numeric ? Number(value) : new Date(value).getTime();
  if (numeric && time > 0 && time < 10000000000) time *= 1000;
  return Number.isFinite(time) && time > 0 ? time : 0;
}

function get_trade_time_from_object(trade) {
  if (!trade || "object" != typeof trade) return 0;
  let keys = [
    "completed",
    "completedAt",
    "completedTime",
    "completedUtc",
    "completedDate",
    "completedOn",
    "updated",
    "updatedAt",
    "updatedTime",
    "updatedUtc",
    "modified",
    "modifiedAt",
    "created",
    "createdAt",
    "createdTime",
    "createdUtc",
    "createdDate",
    "createdOn",
    "date",
    "dateCreated",
    "timestamp",
    "tradeStatusDate",
  ];
  for (let key of keys) {
    let time = parse_trade_time_value(trade[key]);
    if (time > 0) return time;
  }
  return 0;
}

function assign_trade_row_meta(row, trade) {
  let time = get_trade_time_from_object(trade);
  if (time > 0) row.setAttribute("data-nte-trade-time", String(time));
}

document.addEventListener("nru_add_trade_id_to_row", (event) => {
  let raw = event.detail;
  let detail = raw;
  if (typeof raw === "string") {
    try { detail = JSON.parse(raw); } catch(e) { detail = raw; }
  }
  let index =
    "object" == typeof detail && null !== detail
      ? Number(detail.index)
      : Number(detail);
  let token = "object" == typeof detail && null !== detail ? detail.token : null;

  if (!Number.isInteger(index) || index < 0) return;

  let attempts = 0;
  let max_attempts = 20;

  function assign_trade_id() {
    let row =
      (token && document.querySelector(`[data-nru-row-token="${token}"]`)) ||
      document.querySelectorAll(".trade-row")[index];
    if (!row) return;

    let trade = resolve_trade_from_row(row) || {
      id: row.getAttribute("data-trade-id") || row.dataset.tradeId,
    };

    if (trade?.id) {
      row.setAttribute("nruTradeId", String(trade.id));
      assign_trade_row_meta(row, trade);
      row.removeAttribute("data-nru-row-token");
      return;
    }

    row.removeAttribute("nruTradeId");

    if (++attempts < max_attempts) setTimeout(assign_trade_id, 100);
    else row.removeAttribute("data-nru-row-token");
  }

  assign_trade_id();
});
