(function () {
  "use strict";

  window.nte_create_analyze_trade_feature = function nte_create_analyze_trade_feature(deps) {
    let request_token = 0;
    let escape_handler = null;
    let style_injected = false;

    function esc(text) {
      return deps.esc(text);
    }

    function attr_esc(text) {
      return deps.attr_esc(text);
    }

    function inject_styles() {
      if (style_injected) return;
      style_injected = true;
      let style = document.createElement("style");
      style.textContent = `
        html.nte-analyze-trade-open{overflow:hidden!important}
        .nte-analyze-trade-modal{position:fixed!important;inset:0!important;z-index:2147483630!important;display:grid!important;place-items:center!important;padding:24px!important;background:rgba(8,10,14,.74)!important;backdrop-filter:blur(18px) saturate(120%);animation:nteAnalyzeModalIn .16s ease;pointer-events:auto!important}
        .nte-analyze-trade-window{position:relative!important;display:flex;flex-direction:column;width:clamp(700px,84vw,1040px);height:min(92vh,940px);max-height:min(92vh,940px);overflow:hidden;border-radius:20px;background:radial-gradient(1200px 600px at 0% -20%,rgba(129,140,248,.08),transparent 55%),radial-gradient(900px 500px at 100% 120%,rgba(52,211,153,.05),transparent 50%),#181b24;border:1px solid rgba(255,255,255,.08);box-shadow:0 32px 80px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.025) inset;color:#e8eaed;font-family:'Inter','Segoe UI',Roboto,system-ui,sans-serif;font-variant-numeric:tabular-nums;animation:nteAnalyzeWindowIn .22s cubic-bezier(.2,.8,.2,1)}
        .light-theme .nte-analyze-trade-window{background:radial-gradient(1200px 600px at 0% -20%,rgba(99,102,241,.05),transparent 55%),#fcfcfd;border-color:rgba(15,23,42,.08);box-shadow:0 28px 70px rgba(15,23,42,.16);color:#0f172a}
        .nte-analyze-trade-topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 24px;border-bottom:1px solid rgba(255,255,255,.06);flex:0 0 auto;background:linear-gradient(180deg,rgba(255,255,255,.02),transparent)}
        .light-theme .nte-analyze-trade-topbar{border-bottom-color:rgba(15,23,42,.07);background:linear-gradient(180deg,rgba(15,23,42,.015),transparent)}
        .nte-analyze-trade-brand{display:flex;align-items:center;gap:14px;min-width:0}
        .nte-analyze-trade-brand-mark{display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:12px;overflow:hidden;flex:0 0 auto;background:linear-gradient(135deg,rgba(99,102,241,.18),rgba(16,185,129,.12));box-shadow:0 1px 2px rgba(0,0,0,.3),0 0 0 1px rgba(255,255,255,.05) inset}
        .light-theme .nte-analyze-trade-brand-mark{background:linear-gradient(135deg,rgba(99,102,241,.1),rgba(16,185,129,.08));box-shadow:0 1px 2px rgba(15,23,42,.06),0 0 0 1px rgba(15,23,42,.04) inset}
        .nte-analyze-trade-brand-mark img{width:30px;height:30px;object-fit:contain}
        .nte-analyze-trade-brand-mark span{font-size:16px;font-weight:800;color:#9ca3af}
        .nte-analyze-trade-brand-text{min-width:0;display:flex;flex-direction:column;gap:4px}
        .nte-analyze-trade-brand-title{font-size:17px;font-weight:800;letter-spacing:-.015em;line-height:1;color:#f3f4f6}
        .light-theme .nte-analyze-trade-brand-title{color:#0f172a}
        .nte-analyze-trade-brand-sub{font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;line-height:1}
        .nte-analyze-trade-close{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;border:0;background:transparent;color:#9ca3af;cursor:pointer;font:inherit;font-size:22px;line-height:1;transition:background-color .15s,color .15s}
        .light-theme .nte-analyze-trade-close{color:#64748b}
        .nte-analyze-trade-close:hover{background:rgba(255,255,255,.06);color:#f3f4f6}
        .light-theme .nte-analyze-trade-close:hover{background:rgba(15,23,42,.06);color:#0f172a}
        .nte-analyze-trade-body{flex:1;min-height:0;overflow:auto;padding:24px;display:flex;flex-direction:column;gap:18px;scrollbar-width:thin}
        .nte-analyze-trade-verdict{position:relative;display:flex;align-items:center;gap:20px;padding:22px 24px;border-radius:16px;background:#222632;border:1px solid rgba(255,255,255,.06);overflow:hidden}
        .light-theme .nte-analyze-trade-verdict{background:#f8fafc;border-color:rgba(15,23,42,.07)}
        .nte-analyze-trade-verdict.is-bad{background:linear-gradient(90deg,rgba(239,68,68,.1),rgba(239,68,68,.02) 60%),#222632;border-color:rgba(239,68,68,.22)}
        .light-theme .nte-analyze-trade-verdict.is-bad{background:linear-gradient(90deg,rgba(239,68,68,.07),#fff 60%);border-color:rgba(239,68,68,.2)}
        .nte-analyze-trade-verdict.is-good{background:linear-gradient(90deg,rgba(16,185,129,.1),rgba(16,185,129,.02) 60%),#222632;border-color:rgba(16,185,129,.22)}
        .light-theme .nte-analyze-trade-verdict.is-good{background:linear-gradient(90deg,rgba(16,185,129,.07),#fff 60%);border-color:rgba(16,185,129,.2)}
        .nte-analyze-trade-verdict.is-warn{background:linear-gradient(90deg,rgba(245,158,11,.1),rgba(245,158,11,.02) 60%),#222632;border-color:rgba(245,158,11,.22)}
        .light-theme .nte-analyze-trade-verdict.is-warn{background:linear-gradient(90deg,rgba(245,158,11,.07),#fff 60%);border-color:rgba(245,158,11,.2)}
        .nte-analyze-trade-verdict-icon{flex:0 0 auto;display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#9ca3af}
        .nte-analyze-trade-verdict-icon svg{width:23px;height:23px}
        .nte-analyze-trade-verdict.is-bad .nte-analyze-trade-verdict-icon{background:rgba(239,68,68,.14);border-color:rgba(239,68,68,.32);color:#f87171}
        .light-theme .nte-analyze-trade-verdict.is-bad .nte-analyze-trade-verdict-icon{color:#dc2626}
        .nte-analyze-trade-verdict.is-good .nte-analyze-trade-verdict-icon{background:rgba(16,185,129,.14);border-color:rgba(16,185,129,.32);color:#34d399}
        .light-theme .nte-analyze-trade-verdict.is-good .nte-analyze-trade-verdict-icon{color:#059669}
        .nte-analyze-trade-verdict.is-warn .nte-analyze-trade-verdict-icon{background:rgba(245,158,11,.14);border-color:rgba(245,158,11,.32);color:#fbbf24}
        .light-theme .nte-analyze-trade-verdict.is-warn .nte-analyze-trade-verdict-icon{color:#d97706}
        .nte-analyze-trade-verdict-text{flex:1;min-width:0;font-size:18px;font-weight:700;letter-spacing:-.015em;line-height:1.42;color:#f3f4f6}
        .light-theme .nte-analyze-trade-verdict-text{color:#0f172a}
        .nte-analyze-trade-verdict-text strong{font-weight:800;color:inherit}
        .nte-analyze-trade-verdict-edge{flex:0 0 auto;font-size:30px;font-weight:800;letter-spacing:-.05em;line-height:1;color:#e5e7eb;font-variant-numeric:tabular-nums;padding-left:20px;border-left:1px solid rgba(255,255,255,.08)}
        .light-theme .nte-analyze-trade-verdict-edge{color:#0f172a;border-left-color:rgba(15,23,42,.08)}
        .nte-analyze-trade-verdict.is-good .nte-analyze-trade-verdict-edge{color:#34d399}
        .nte-analyze-trade-verdict.is-bad .nte-analyze-trade-verdict-edge{color:#f87171}
        .nte-analyze-trade-verdict.is-warn .nte-analyze-trade-verdict-edge{color:#fbbf24}
        .light-theme .nte-analyze-trade-verdict.is-good .nte-analyze-trade-verdict-edge{color:#059669}
        .light-theme .nte-analyze-trade-verdict.is-bad .nte-analyze-trade-verdict-edge{color:#dc2626}
        .light-theme .nte-analyze-trade-verdict.is-warn .nte-analyze-trade-verdict-edge{color:#d97706}
        .nte-analyze-trade-reasons{padding:20px 22px;border-radius:15px;background:#222632;border:1px solid rgba(255,255,255,.06)}
        .light-theme .nte-analyze-trade-reasons{background:#f8fafc;border-color:rgba(15,23,42,.07)}
        .nte-analyze-trade-reasons-title{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.12em;color:#6b7280;margin-bottom:14px}
        .nte-analyze-trade-reasons-title:before{content:"";width:18px;height:1px;background:currentColor;opacity:.5}
        .nte-analyze-trade-reasons-title:after{content:"";flex:1;height:1px;background:currentColor;opacity:.18}
        .nte-analyze-trade-reason-list{display:flex;flex-direction:column;gap:12px;margin:0;padding:0;list-style:none}
        .nte-analyze-trade-reason{position:relative;padding-left:22px;font-size:14px;line-height:1.58;color:#cbd5e1}
        .light-theme .nte-analyze-trade-reason{color:#475569}
        .nte-analyze-trade-reason:before{content:"";position:absolute;left:5px;top:9px;width:7px;height:7px;border-radius:50%;background:#6b7280}
        .nte-analyze-trade-reasons.is-bad .nte-analyze-trade-reason:before{background:#ef4444}
        .nte-analyze-trade-reasons.is-good .nte-analyze-trade-reason:before{background:#10b981}
        .nte-analyze-trade-reasons.is-warn .nte-analyze-trade-reason:before{background:#f59e0b}
        .nte-analyze-trade-reason strong{font-weight:700;color:#f3f4f6}
        .light-theme .nte-analyze-trade-reason strong{color:#0f172a}
        .nte-analyze-trade-sides{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;flex:1 1 auto;min-height:0}
        .nte-analyze-trade-side{position:relative;display:flex;flex-direction:column;min-height:0;padding:20px;border-radius:16px;background:#222632;border:1px solid rgba(255,255,255,.06);overflow:hidden}
        .light-theme .nte-analyze-trade-side{background:#f8fafc;border-color:rgba(15,23,42,.07)}
        .nte-analyze-trade-side:before{content:"";position:absolute;left:0;right:0;top:0;height:3px}
        .nte-analyze-trade-side.is-give:before{background:#ef4444}
        .nte-analyze-trade-side.is-receive:before{background:#10b981}
        .nte-analyze-trade-side-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.05)}
        .light-theme .nte-analyze-trade-side-head{border-bottom-color:rgba(15,23,42,.06)}
        .nte-analyze-trade-side-kicker{font-size:11px;font-weight:750;text-transform:uppercase;letter-spacing:.1em;color:#6b7280}
        .nte-analyze-trade-side-title{margin-top:5px;font-size:16px;font-weight:800;letter-spacing:-.025em;color:#e5e7eb}
        .light-theme .nte-analyze-trade-side-title{color:#0f172a}
        .nte-analyze-trade-side-totals{text-align:right}
        .nte-analyze-trade-side-total{font-size:18px;font-weight:850;letter-spacing:-.025em;line-height:1;color:#e5e7eb}
        .light-theme .nte-analyze-trade-side-total{color:#0f172a}
        .nte-analyze-trade-side-rap{margin-top:5px;font-size:11px;color:#6b7280}
        .nte-analyze-trade-items{display:grid;align-content:start;gap:9px;flex:1 1 auto;min-height:0;overflow:auto;padding-right:2px;scrollbar-width:thin}
        .nte-analyze-trade-item{display:grid;grid-template-columns:44px minmax(0,1fr);gap:12px;align-items:center;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.05);transition:background-color .15s,border-color .15s,transform .15s}
        .light-theme .nte-analyze-trade-item{background:#fff;border-color:rgba(15,23,42,.06)}
        .nte-analyze-trade-item:hover{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1);transform:translateY(-1px)}
        .light-theme .nte-analyze-trade-item:hover{background:#fafbfc;border-color:rgba(15,23,42,.1)}
        .nte-analyze-trade-thumb{width:44px;height:44px;border-radius:10px;object-fit:contain;background:#1a1d26;border:1px solid rgba(255,255,255,.05)}
        .light-theme .nte-analyze-trade-thumb{background:#e2e8f0;border-color:rgba(15,23,42,.06)}
        .nte-analyze-trade-thumb.nte-history-thumb--empty{display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#6b7280}
        .nte-analyze-trade-robux-mark{display:flex;align-items:center;justify-content:center;background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.2);font-size:12px;font-weight:800;color:#f59e0b}
        .nte-analyze-trade-item-copy{min-width:0}
        .nte-analyze-trade-item-line{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
        .nte-analyze-trade-item-name{min-width:0;font-size:13px;font-weight:650;line-height:1.35;word-break:break-word;color:#d1d5db}
        .light-theme .nte-analyze-trade-item-name{color:#334155}
        .nte-analyze-trade-item-main{font-size:13px;font-weight:850;line-height:1.25;white-space:nowrap;color:#f3f4f6}
        .light-theme .nte-analyze-trade-item-main{color:#0f172a}
        .nte-analyze-trade-item-meta{margin-top:3px;font-size:10px;line-height:1.35;color:#6b7280}
        .nte-analyze-trade-foot{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:auto;padding-top:14px;border-top:1px solid rgba(255,255,255,.05);flex-wrap:wrap}
        .light-theme .nte-analyze-trade-foot{border-top-color:rgba(15,23,42,.06)}
        .nte-analyze-trade-disclaimer{display:inline-flex;align-items:center;gap:8px;font-size:11px;line-height:1.45;color:#6b7280;font-weight:500;flex:1;min-width:0}
        .nte-analyze-trade-disclaimer svg{flex:0 0 auto;width:13px;height:13px;opacity:.7}
        .nte-analyze-trade-credit a{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);color:#9ca3af;text-decoration:none;font-size:11px;font-weight:650;transition:opacity .15s,border-color .15s,color .15s}
        .light-theme .nte-analyze-trade-credit a{background:#f1f5f9;border-color:rgba(15,23,42,.07);color:#64748b}
        .nte-analyze-trade-credit a:hover{border-color:rgba(141,223,215,.32);color:#cbd5e1}
        .light-theme .nte-analyze-trade-credit a:hover{color:#334155}
        .nte-analyze-trade-credit img{width:16px;height:16px;border-radius:4px;object-fit:contain;background:transparent}
        .nte-analyze-trade-loader{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
        @keyframes nteAnalyzeModalIn{from{opacity:0}to{opacity:1}}
        @keyframes nteAnalyzeWindowIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
        @media (max-width:700px){
          .nte-analyze-trade-modal{padding:max(8px,env(safe-area-inset-top,0px)) max(8px,env(safe-area-inset-right,0px)) max(8px,env(safe-area-inset-bottom,0px)) max(8px,env(safe-area-inset-left,0px))!important;place-items:end center!important}
          .nte-analyze-trade-window{width:100%;height:auto;max-height:calc(100dvh - 16px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));border-radius:18px}
          .nte-analyze-trade-topbar{gap:10px;padding:14px 14px 12px}
          .nte-analyze-trade-brand{gap:10px}
          .nte-analyze-trade-brand-mark{width:34px;height:34px;border-radius:10px}
          .nte-analyze-trade-brand-mark img{width:24px;height:24px}
          .nte-analyze-trade-brand-title{font-size:15px;letter-spacing:0;line-height:1.15}
          .nte-analyze-trade-brand-sub{font-size:10px;letter-spacing:.08em}
          .nte-analyze-trade-close{width:34px;height:34px;border-radius:9px;font-size:20px}
          .nte-analyze-trade-body{gap:12px;padding:14px;overscroll-behavior:contain}
          .nte-analyze-trade-sides,.nte-analyze-trade-loader{grid-template-columns:minmax(0,1fr)}
          .nte-analyze-trade-verdict{display:grid;grid-template-columns:34px minmax(0,1fr);align-items:start;gap:10px;padding:14px;border-radius:14px}
          .nte-analyze-trade-verdict,.nte-analyze-trade-reasons,.nte-analyze-trade-side,.nte-analyze-trade-foot{flex-shrink:0}
          .nte-analyze-trade-verdict-icon{width:34px;height:34px}
          .nte-analyze-trade-verdict-icon svg{width:18px;height:18px}
          .nte-analyze-trade-verdict-text{font-size:15px;line-height:1.38}
          .nte-analyze-trade-verdict-edge{grid-column:2;font-size:22px;padding:8px 0 0;border-left:0;border-top:1px solid rgba(255,255,255,.08)}
          .light-theme .nte-analyze-trade-verdict-edge{border-top-color:rgba(15,23,42,.08)}
          .nte-analyze-trade-reasons{padding:14px;border-radius:14px}
          .nte-analyze-trade-reasons-title{margin-bottom:10px;font-size:10px;letter-spacing:.08em}
          .nte-analyze-trade-reason-list{gap:9px}
          .nte-analyze-trade-reason{font-size:13px;line-height:1.48}
          .nte-analyze-trade-sides{gap:12px;flex:0 0 auto;min-height:auto}
          .nte-analyze-trade-side{min-height:auto;padding:14px;border-radius:14px}
          .nte-analyze-trade-side-head{align-items:flex-start;margin-bottom:10px;padding-bottom:10px}
          .nte-analyze-trade-side-title{font-size:15px}
          .nte-analyze-trade-side-total{font-size:16px}
          .nte-analyze-trade-items{overflow:visible;gap:8px;padding-right:0}
          .nte-analyze-trade-item{grid-template-columns:38px minmax(0,1fr);gap:10px;padding:9px;border-radius:11px}
          .nte-analyze-trade-thumb{width:38px;height:38px;border-radius:9px}
          .nte-analyze-trade-item-line{display:grid;grid-template-columns:minmax(0,1fr);gap:3px}
          .nte-analyze-trade-item-name{font-size:12px;line-height:1.3}
          .nte-analyze-trade-item-main{font-size:13px;white-space:normal;text-align:left}
          .nte-analyze-trade-foot{flex-direction:column;align-items:stretch;gap:8px;margin-top:0;padding-top:12px}
          .nte-analyze-trade-disclaimer{align-items:flex-start;font-size:10px}
          .nte-analyze-trade-credit{display:flex;justify-content:flex-start}
          .nte-analyze-trade-credit a{width:max-content;max-width:100%;border-radius:10px}
        }
      `;
      document.head.appendChild(style);
    }

    function create_button(reference) {
      let btn = reference ? reference.cloneNode(true) : document.createElement("button");
      btn.type = "button";
      btn.removeAttribute("ng-bind");
      btn.removeAttribute("ng-click");
      btn.removeAttribute("ng-show");
      btn.removeAttribute("ng-disabled");
      btn.removeAttribute("disabled");
      btn.className = String(btn.className || "")
        .replace(/\bng-hide\b/g, "")
        .trim();
      btn.classList.remove("btn-cta-md");
      btn.classList.add("btn-control-md", "nte-analyze-trade-btn");
      btn.onclick = () => run(btn);
      set_btn_idle(btn);
      return btn;
    }

    function set_btn_idle(btn) {
      btn.disabled = false;
      btn.__nte_analyze_trade_open = false;
      btn.classList.remove("nte-analyze-trade-btn--loading", "nte-analyze-trade-btn--active");
      btn.innerHTML = '<span class="nte-history-btn-inner"><span class="nte-history-btn-label">Analyze Trade</span></span>';
      btn.setAttribute("aria-label", "Analyze this trade");
      btn.title = "Analyze this trade";
    }

    function set_btn_loading(btn) {
      btn.disabled = true;
      btn.classList.remove("nte-analyze-trade-btn--active");
      btn.classList.add("nte-analyze-trade-btn--loading");
      btn.innerHTML = '<span class="nte-history-btn-inner"><span class="nte-history-btn-spinner"></span><span class="nte-history-btn-label">Analyzing</span></span>';
      btn.setAttribute("aria-label", "Analyzing this trade");
      btn.title = "Analyzing this trade";
    }

    function set_btn_active(btn) {
      btn.disabled = false;
      btn.__nte_analyze_trade_open = true;
      btn.classList.remove("nte-analyze-trade-btn--loading");
      btn.classList.add("nte-analyze-trade-btn--active");
      btn.innerHTML = '<span class="nte-history-btn-inner"><span class="nte-history-btn-label">Analyze Trade</span></span>';
      btn.setAttribute("aria-label", "Hide trade analysis");
      btn.title = "Hide trade analysis";
    }

    function format_number(value) {
      let number = Number(value);
      if (!Number.isFinite(number)) return "N/A";
      return Math.round(number).toLocaleString();
    }

    function format_signed(value) {
      let number = Number(value);
      if (!Number.isFinite(number)) return "N/A";
      let rounded = Math.round(number);
      return `${rounded > 0 ? "+" : ""}${rounded.toLocaleString()}`;
    }

    function format_value(value) {
      if (value === null || value === undefined || value === "") return "N/A";
      return format_number(value);
    }

    function get_runtime_url(path) {
      try {
        return chrome.runtime.getURL(path);
      } catch {
        return "";
      }
    }

    function reason_html(reason) {
      return esc(reason || "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    }

    function get_reasons(result, verdict) {
      if (Array.isArray(verdict?.reasons) && verdict.reasons.length) return verdict.reasons.slice(0, 4);
      if (Array.isArray(result?.reasons) && result.reasons.length) return result.reasons.slice(0, 4);
      if (typeof verdict?.reasoning === "string" && verdict.reasoning.trim()) return [verdict.reasoning.trim()];
      if (typeof result?.reasoning === "string" && result.reasoning.trim()) return [result.reasoning.trim()];
      return [];
    }

    function render_close_button() {
      return '<button type="button" class="nte-analyze-trade-close" aria-label="Close trade analysis">&times;</button>';
    }

    function render_topbar() {
      let logo_url = get_runtime_url("assets/icons/logo.png");
      return `
        <div class="nte-analyze-trade-topbar">
          <div class="nte-analyze-trade-brand">
            <div class="nte-analyze-trade-brand-mark">
              ${logo_url ? `<img src="${attr_esc(logo_url)}" alt="">` : "<span>N</span>"}
            </div>
            <div class="nte-analyze-trade-brand-text">
              <div class="nte-analyze-trade-brand-title">Nevos Trading Extension</div>
              <div class="nte-analyze-trade-brand-sub">Trade Analysis</div>
            </div>
          </div>
          ${render_close_button()}
        </div>
      `;
    }

    function remove_modal() {
      document.querySelectorAll(".nte-analyze-trade-modal").forEach((el) => el.remove());
      document.documentElement.classList.remove("nte-analyze-trade-open");
      if (escape_handler) {
        document.removeEventListener("keydown", escape_handler, true);
        escape_handler = null;
      }
    }

    function close(btn) {
      request_token++;
      remove_modal();
      if (btn) set_btn_idle(btn);
      else document.querySelectorAll(".nte-analyze-trade-btn--active,.nte-analyze-trade-btn--loading").forEach((el) => set_btn_idle(el));
      deps.assert_dominance();
    }

    function get_panel(btn) {
      remove_modal();
      document.querySelectorAll(".nte-history-panel").forEach((el) => el.remove());
      document.querySelectorAll(".nte-history-btn--active").forEach((el) => deps.set_history_btn_idle(el));
      document.querySelectorAll(".nte-analyze-trade-btn--active,.nte-analyze-trade-btn--loading").forEach((el) => set_btn_idle(el));
      let modal = document.createElement("div");
      modal.className = "nte-analyze-trade-modal";
      let panel = document.createElement("div");
      panel.className = "nte-analyze-trade-window nte-analyze-trade-panel";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-label", "Trade analysis");
      panel.tabIndex = -1;
      modal.appendChild(panel);
      document.body.appendChild(modal);
      document.documentElement.classList.add("nte-analyze-trade-open");
      escape_handler = (event) => {
        if (event.key === "Escape") close(btn);
      };
      document.addEventListener("keydown", escape_handler, true);
      setTimeout(() => panel.focus({ preventScroll: true }), 0);
      deps.assert_dominance();
      return panel;
    }

    function attach_close(panel, btn) {
      let modal = panel.closest(".nte-analyze-trade-modal");
      let close_btn = panel.querySelector(".nte-analyze-trade-close");
      if (close_btn) close_btn.onclick = () => close(btn);
      if (modal) {
        modal.onmousedown = (event) => {
          if (event.target === modal) close(btn);
        };
      }
    }

    function get_tone(verdict, label) {
      let label_text = String(label || "").toLowerCase();
      if (verdict?.ok === false || /not|bad|loss|lose|decline|reject|down|red/.test(label_text)) return "is-bad";
      if (verdict?.ok === true || /worth|good|win|take|accept|up|green/.test(label_text)) return "is-good";
      return "is-warn";
    }

    function get_verdict_message(tone) {
      if (tone === "is-bad") return "It is advised you do not take this trade.";
      if (tone === "is-good") return "This trade looks like a good deal for you.";
      return "This trade is roughly even — your call.";
    }

    function render_verdict_message(message, tone) {
      return tone === "is-bad" ? `<strong>${esc(message)}</strong>` : esc(message);
    }

    function get_verdict_icon(tone) {
      if (tone === "is-bad") {
        return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>';
      }
      if (tone === "is-good") {
        return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 10.5l3.2 3.2L15 7"/></svg>';
      }
      return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 10h10"/></svg>';
    }

    function render_credit() {
      let void_logo = get_runtime_url("assets/void-logo.png");
      return `
        <div class="nte-analyze-trade-foot">
          <div class="nte-analyze-trade-disclaimer">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 5v3.5"/><circle cx="8" cy="11" r=".6" fill="currentColor"/></svg>
            <span>Analysis is from a third-party service. Use as guidance, not a final answer.</span>
          </div>
          <div class="nte-analyze-trade-credit">
            <a href="https://discord.gg/zH22s6dm3D" target="_blank" rel="noopener noreferrer" title="Analyzed by Void">
              ${void_logo ? `<img src="${attr_esc(void_logo)}" alt="">` : ""}
              <span>Analyzed by Void</span>
            </a>
          </div>
        </div>
      `;
    }

    function render_reasons(reasons, tone) {
      if (!reasons.length) return "";
      return `
        <div class="nte-analyze-trade-reasons ${tone}">
          <div class="nte-analyze-trade-reasons-title">Why</div>
          <ul class="nte-analyze-trade-reason-list">
            ${reasons.map((r) => `<li class="nte-analyze-trade-reason">${reason_html(r)}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    function render_loading(panel, btn) {
      panel.className = "nte-analyze-trade-window nte-analyze-trade-panel is-loading";
      panel.innerHTML = `
        ${render_topbar()}
        <div class="nte-analyze-trade-body">
          <div class="nte-analyze-trade-verdict is-warn">
            <div class="nte-analyze-trade-verdict-icon"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 3v3M10 14v3M3 10h3M14 10h3M5 5l2 2M13 13l2 2M5 15l2-2M13 7l2-2"/></svg></div>
            <div class="nte-analyze-trade-verdict-text">Analyzing this trade...</div>
          </div>
          <div class="nte-analyze-trade-loader">
            <div class="nte-history-loading-card">
              <div class="nte-history-item-top">
                <div class="nte-history-skel nte-history-skel-thumb"></div>
                <div class="nte-history-item-copy">
                  <div class="nte-history-skel nte-history-skel-line is-wide"></div>
                  <div class="nte-history-skel nte-history-skel-line is-mid"></div>
                </div>
              </div>
            </div>
            <div class="nte-history-loading-card">
              <div class="nte-history-item-top">
                <div class="nte-history-skel nte-history-skel-thumb"></div>
                <div class="nte-history-item-copy">
                  <div class="nte-history-skel nte-history-skel-line is-wide"></div>
                  <div class="nte-history-skel nte-history-skel-line is-mid"></div>
                </div>
              </div>
            </div>
          </div>
          ${render_credit()}
        </div>
      `;
      attach_close(panel, btn);
    }

    function render_error(panel, btn, message) {
      panel.className = "nte-analyze-trade-window nte-analyze-trade-panel is-error";
      panel.innerHTML = `
        ${render_topbar()}
        <div class="nte-analyze-trade-body">
          <div class="nte-analyze-trade-verdict is-bad">
            <div class="nte-analyze-trade-verdict-icon">${get_verdict_icon("is-bad")}</div>
            <div class="nte-analyze-trade-verdict-text">${esc(message || "Could not analyze this trade right now.")}</div>
          </div>
          ${render_credit()}
        </div>
      `;
      attach_close(panel, btn);
      set_btn_active(btn);
    }

    function render_item(item, local_item) {
      let item_id = item?.id || local_item?.assetId || "";
      let raw_name = String(item?.name || "").trim();
      let name = raw_name && !/^\d+$/.test(raw_name) ? raw_name : local_item?.name || (item_id ? `Item ${item_id}` : "Unknown item");
      let primary = item?.value !== null && item?.value !== undefined ? format_value(item.value) : "N/A";
      let meta = "";
      if (item?.rap !== null && item?.rap !== undefined) meta = `RAP ${format_value(item.rap)}`;
      let thumb_url = local_item?.thumb || item?.thumb || item?.thumbnail || item?.image_url || "";
      let thumb_html = thumb_url
        ? `<img class="nte-analyze-trade-thumb" src="${attr_esc(thumb_url)}" alt="">`
        : `<div class="nte-analyze-trade-thumb nte-history-thumb--empty">?</div>`;
      return `
        <div class="nte-analyze-trade-item">
          ${thumb_html}
          <div class="nte-analyze-trade-item-copy">
            <div class="nte-analyze-trade-item-line">
              <div class="nte-analyze-trade-item-name">${esc(name)}</div>
              <div class="nte-analyze-trade-item-main">${esc(primary)}</div>
            </div>
            ${meta ? `<div class="nte-analyze-trade-item-meta">${esc(meta)}</div>` : ""}
          </div>
        </div>
      `;
    }

    function render_robux_item(amount) {
      let robux = Number(amount || 0);
      if (!(robux > 0)) return "";
      return `
        <div class="nte-analyze-trade-item">
          <div class="nte-analyze-trade-thumb nte-analyze-trade-robux-mark">R$</div>
          <div class="nte-analyze-trade-item-copy">
            <div class="nte-analyze-trade-item-line">
              <div class="nte-analyze-trade-item-name">Robux</div>
              <div class="nte-analyze-trade-item-main">${esc(format_number(robux))}</div>
            </div>
          </div>
        </div>
      `;
    }

    function render_side(title, side, local_items, class_name) {
      let items = Array.isArray(side?.items) ? side.items : [];
      let robux = Number(side?.robux || 0);
      let item_html = items.map((item, index) => render_item(item, local_items?.[index] || null)).join("") + render_robux_item(robux);
      let total_value = side?.total_value;
      let total_rap = side?.total_rap;
      let count = items.length + (robux > 0 ? 1 : 0);
      return `
        <section class="nte-analyze-trade-side ${class_name}">
          <div class="nte-analyze-trade-side-head">
            <div>
              <div class="nte-analyze-trade-side-kicker">${esc(title)}</div>
              <div class="nte-analyze-trade-side-title">${count} item${count === 1 ? "" : "s"}</div>
            </div>
            <div class="nte-analyze-trade-side-totals">
              <div class="nte-analyze-trade-side-total">${esc(format_value(total_value))}</div>
              ${total_rap !== null && total_rap !== undefined ? `<div class="nte-analyze-trade-side-rap">RAP ${esc(format_value(total_rap))}</div>` : ""}
            </div>
          </div>
          <div class="nte-analyze-trade-items">
            ${item_html || '<div class="nte-history-empty">No items.</div>'}
          </div>
        </section>
      `;
    }

    function render_result(panel, btn, response, local_items) {
      let result = response?.result || response?.data || {};
      let verdict = result?.verdict || {};
      let trade = result?.trade || {};
      let label = verdict?.label || "";
      let tone = get_tone(verdict, label);
      let effective_edge = verdict?.effective_edge ?? result?.effective_edge ?? trade?.effective_edge;
      let message = get_verdict_message(tone);
      let icon = get_verdict_icon(tone);
      let reasons = get_reasons(result, verdict);
      panel.className = "nte-analyze-trade-window nte-analyze-trade-panel";
      panel.innerHTML = `
        ${render_topbar()}
        <div class="nte-analyze-trade-body">
          <div class="nte-analyze-trade-verdict ${tone}">
            <div class="nte-analyze-trade-verdict-icon">${icon}</div>
            <div class="nte-analyze-trade-verdict-text">${render_verdict_message(message, tone)}</div>
            ${effective_edge !== null && effective_edge !== undefined ? `<div class="nte-analyze-trade-verdict-edge">${esc(format_signed(effective_edge))}</div>` : ""}
          </div>
          ${render_reasons(reasons, tone)}
          <div class="nte-analyze-trade-sides">
            ${render_side("Your offer", trade?.give || {}, local_items?.give || [], "is-give")}
            ${render_side("Their offer", trade?.receive || {}, local_items?.receive || [], "is-receive")}
          </div>
          ${render_credit()}
        </div>
      `;
      attach_close(panel, btn);
      set_btn_active(btn);
    }

    function get_asset_ids(items) {
      return (items || [])
        .map((item) => parseInt(item?.assetId ?? item?.asset_id ?? item?.id ?? 0, 10) || 0)
        .filter((id) => id > 0)
        .slice(0, 4);
    }

    async function get_payload(row) {
      let give_items = await deps.get_offer_items_enriched(row, "self").catch(() => deps.get_offer_items("self"));
      let receive_items = await deps.get_offer_items_enriched(row, "partner").catch(() => deps.get_offer_items("partner"));
      let give_robux = deps.get_robux_total(deps.get_offer_element("self"));
      let receive_robux = deps.get_robux_total(deps.get_offer_element("partner"));
      return {
        payload: {
          give_item_ids: get_asset_ids(give_items),
          receive_item_ids: get_asset_ids(receive_items),
          give_robux,
          receive_robux,
        },
        local_items: {
          give: give_items,
          receive: receive_items,
        },
      };
    }

    async function run(btn) {
      deps.inject_history_styles();
      inject_styles();
      let container_info = deps.get_container_from_button(btn);
      if (!container_info) return;

      let state_key = deps.get_state_key();
      let current_panel = document.querySelector(".nte-analyze-trade-panel");
      if (btn.__nte_analyze_trade_open && current_panel && btn.__nte_analyze_trade_key === state_key) {
        close(btn);
        return;
      }

      let panel = get_panel(btn);
      let current_token = ++request_token;
      btn.__nte_analyze_trade_key = state_key;
      set_btn_loading(btn);
      render_loading(panel, btn);

      try {
        let row = document.querySelector(".trade-row.selected");
        let trade_data = await get_payload(row);
        if (current_token !== request_token) return;
        let payload = trade_data.payload;
        if (!payload.give_item_ids.length && payload.give_robux <= 0) throw new Error("Could not read what you give from this trade.");
        if (!payload.receive_item_ids.length && payload.receive_robux <= 0) throw new Error("Could not read what you receive from this trade.");

        let data = await new Promise((resolve) => {
          deps.send_message({ type: "analyzeTrade", ...payload }, resolve);
        });
        if (current_token !== request_token) return;
        if (!data?.success) {
          render_error(panel, btn, data?.error || "Could not analyze this trade right now.");
          return;
        }
        render_result(panel, btn, data, trade_data.local_items);
      } catch (err) {
        if (current_token !== request_token) return;
        render_error(panel, btn, err?.message || "Could not analyze this trade right now.");
      }
    }

    return {
      close,
      create_button,
      inject_styles,
    };
  };
})();
