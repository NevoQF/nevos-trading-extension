// Full only: sends a problem report the user filed from the popup. LITE never loads this
// file; its popup only offers "Copy report".
const problem_report_url = "https://nevos-extension.com/api/reports";

function problem_report_handle_message(message, respond) {
  if (message?.type !== "nte_report_send") return false;
  (async () => {
    let response = null;
    try {
      response = await fetch_with_timeout(
        problem_report_url,
        {
          method: "POST",
          headers: nte_api_headers({ "Content-Type": "application/json" }),
          body: JSON.stringify(message.report || {}),
        },
        30000,
      );
    } catch {
      respond({
        ok: false,
        error: "Couldn't reach the report server. Check your connection, or use Copy instead.",
      });
      return;
    }
    let body = await response.json().catch(() => null);
    if (response.ok && body?.ok && /^NTE-[A-Z0-9]{4}$/.test(String(body.id || ""))) {
      respond({ ok: true, id: body.id });
      return;
    }
    respond({
      ok: false,
      error:
        response.status === 429
          ? "Too many reports from your network right now. Try again later, or use Copy instead."
          : String(body?.error || `Couldn't send the report (error ${response.status}). Use Copy instead.`).slice(0, 200),
    });
  })();
  return true;
}
