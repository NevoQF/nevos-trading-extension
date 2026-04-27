(()=>{function nte_send_message(msg,callback){try{let result=chrome.runtime.sendMessage(msg);if(result&&typeof result.then==="function"){result.then(function(r){callback(r)},function(){callback(undefined)})}}catch(e){callback(undefined)}}function e(e,t,n,a){Object.defineProperty(e,t,{get:n,set:a,enumerable:!0,configurable:!0})}var t=globalThis,n={},a={},r=t.parcelRequire94c2;null==r&&((r=function(e){if(e in n)return n[e].exports;if(e in a){var t=a[e];delete a[e];var r={id:e,exports:{}};return n[e]=r,t.call(r.exports,r,r.exports),r.exports}var o=Error("Cannot find module '"+e+"'");throw o.code="MODULE_NOT_FOUND",o}).register=function(e,t){a[e]=t},t.parcelRequire94c2=r);var o=r.register;o("eFyFE",function(t,n){let a;function o(){return a}function i(e){if(window.__NTE_ICONS&&window.__NTE_ICONS[e]){var d=window.__NTE_ICONS[e];if(window.__NTE_resolveInlineIcon)d=window.__NTE_resolveInlineIcon(e,d);return d}return chrome.runtime.getURL(e)}function l(e,t){return new Promise(n=>{let a=document;function r(){let t=a.querySelector(e);t&&(n(t),o.disconnect())}void 0!==t&&(a=t);let o=new MutationObserver(r);o.observe(void 0===t?document.body:a,{childList:!0,subtree:!0}),r()})}function s(e,t,n){for(var a=e.length,r=-1;n--&&r++<a&&!((r=e.indexOf(t,r))<0););return r}function c(e){return e.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g,",")}function d(e){return new Promise(t=>{chrome.storage.local.get([e],function(n){chrome.runtime.lastError&&console.info(chrome.runtime.lastError),t(n[e])})})}function u(){let e=document.querySelector('[ng-show="layout.view === tradesConstants.views.tradeRequest"]');return e?e.classList.contains("ng-hide")?"details":"sendOrCounter":document.querySelector(".results-container")?"catalog":document.querySelector("[data-internal-page-name]")?.getAttribute("data-internal-page-name")==="CatalogItem"?"itemProfile":document.querySelector("[data-profileuserid]")?"userProfile":document.querySelector('meta[data-internal-page-name="Inventory"]')?"userInventory":void 0}function m(e){return a.items[e][4]}function p(e){return a.items[e][2]}function f(e){return e?chrome.runtime.getManifest().name:chrome.runtime.getManifest().short_name}function g(){return document.getElementById("rbx-body").classList.contains("light-theme")?"light":"dark"}async function y(e){let t;let n=!1,a=[];for(;!n;){let r=`https://inventory.roblox.com/v1/users/${e}/assets/collectibles?sortOrder=Desc&limit=100${t?"&cursor="+t:""}`,o=await fetch(r,{credentials:"include"});if(200!==o.status)return!1;{let e=await o.json();a=a.concat(e.data),null===(t=e.nextPageCursor)&&(n=!0)}}return a}async function h(){return parseInt(document.querySelector('meta[name="user-data"]').getAttribute("data-userid"))}function x(e,t){e.setAttribute("data-toggle","tooltip"),e.setAttribute("title",t)}function v(e){for(let element of document.querySelectorAll(`.${e}`))element.removeAttribute("data-toggle"),element.removeAttribute("data-original-title")}function b(){if(document.getElementById("nteInitTooltipsScript"))document.dispatchEvent(new CustomEvent("nte_init_tooltips"));else{let e=document.createElement("script");e.id="nteInitTooltipsScript",e.src=i("scripts/init_tooltips.js"),e.onload=function(){document.dispatchEvent(new CustomEvent("nte_init_tooltips"))},(document.head||document.documentElement).appendChild(e)}}function w(e){return -1!==[8,17,18,19,27,28,29,30,31,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,61,64,65,66,67,68,69,70,71,72,76,77,78,79].indexOf(e)}function E(e){return e.split("/").filter(e=>2!==e.length).join("/")}async function T(e,t){await l(".item-card-container");let n=e.querySelectorAll(".item-card-container");await l(".item-card-price");let a=0;for(let item of n){let e=E(item.querySelector(".item-card-price").parentElement.getElementsByTagName("a")[0].pathname);a+=m(parseInt(e.substring(s(e,"/",2)+1,s(e,"/",3))))}let r=a,o=Math.round((parseInt(e.querySelector(".text-label.robux-line-value").innerText.replace(",",""))||0)/.7);return(a+=o,t)?[r,o]:a}async function S(e,t){await l('[ng-repeat="slot in offer.slots"]',e);let n=e.querySelectorAll('[ng-repeat="slot in offer.slots"]'),a=0;for(let item of n){let e=parseInt(item.querySelector('[thumbnail-target-id][thumbnail-type="Asset"]')?.getAttribute("thumbnail-target-id"));isNaN(e)||(a+=m(e))}let r=a,o=e.querySelector('[name="robux"]'),i=parseInt(o.value)||0;return(o.parentElement.classList.contains("form-has-error")&&(i=0),a+=i,t)?[r,i]:a}function k(e,t){function n(e,t){let n=t.querySelector(".icon-link");n?t.insertBefore(e,n.parentElement):t.appendChild(e)}e.style.height="44px",t?.inline||n(document.createElement("br"),e);let a=document.createElement("span");a.className="icon icon-rolimons",a.style.backgroundImage=`url(${JSON.stringify(i("assets/icons/logo48.png"))})`,a.style.display="inline-block",a.style.backgroundSize="cover",a.style.width=t?.large?"21px":"19px",a.style.height=a.style.width,a.style.marginTop=t?.inline?"-4px":"0px",a.style.marginRight=t?.inline?"3px":"6px",a.style.marginLeft=t?.inline?"5px":"0px",a.style.verticalAlign=t?.inline&&"middle",a.style.transform=t?.large?"translateY(4px)":"translateY(2px)",a.style.backgroundColor="transparent",n(a,e);let r=document.createElement("span");r.className=`valueSpan ${t?.large?"text-robux-lg":"text-robux"}`,r.innerHTML="",n(r,e)}async function D(e){let t=await fetch("https://users.roblox.com/v1/usernames/users",{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({usernames:[e],excludeBannedUsers:!1})});return(await t.json()).data[0].id}e(t.exports,"refreshData",()=>function e(t){let n="getData";void 0!==a&&(n="getDataPeriodic"),nte_send_message(n,function(n){(a=n)&&t(),setTimeout(()=>e(t),6e4)})}),e(t.exports,"getRolimonsData",()=>o),e(t.exports,"getURL",()=>i),e(t.exports,"waitForElm",()=>l),e(t.exports,"nthIndex",()=>s),e(t.exports,"commafy",()=>c),e(t.exports,"getOption",()=>d),e(t.exports,"getPageType",()=>u),e(t.exports,"getValueOrRAP",()=>m),e(t.exports,"getRAP",()=>p),e(t.exports,"getExtensionTitle",()=>f),e(t.exports,"getColorMode",()=>g),e(t.exports,"getUserInventory",()=>y),e(t.exports,"getAuthenticatedUserId",()=>h),e(t.exports,"addTooltip",()=>x),e(t.exports,"removeTooltipsFromClass",()=>v),e(t.exports,"initTooltips",()=>b),e(t.exports,"checkIfAssetTypeIsOnRolimons",()=>w),e(t.exports,"removeTwoLetterPath",()=>E),e(t.exports,"calculateValueTotalDetails",()=>T),e(t.exports,"calculateValueTotalSendOrCounter",()=>S),e(t.exports,"createValuesSpans",()=>k),e(t.exports,"fetchIDFromName",()=>D),r("8kQ1K")}),o("8kQ1K",function(e,t){e.exports=JSON.parse('["Values",{"name":"Values on Trading Window","enabledByDefault":true,"path":"values-on-trading-window"},{"name":"Values on Trade Lists","enabledByDefault":true,"path":"values-on-trade-lists"},{"name":"Values on Catalog Pages","enabledByDefault":true,"path":"values-on-catalog-pages"},{"name":"Values on User Pages","enabledByDefault":true,"path":"values-on-user-pages"},{"name":"Show Routility USD Values","enabledByDefault":false,"path":"show-usd-values"},"Trading",{"name":"Trade Win/Loss Stats","enabledByDefault":true,"path":"trade-win-loss-stats"},{"name":"Colorblind Mode","enabledByDefault":false,"path":"colorblind-profit-mode"},{"name":"Trade Window Search","enabledByDefault":true,"path":"trade-window-search"},"Trade Notifications",{"name":"Inbound Trade Notifications","enabledByDefault":false,"path":"inbound-trade-notifications"},{"name":"Declined Trade Notifications","enabledByDefault":false,"path":"declined-trade-notifications"},{"name":"Completed Trade Notifications","enabledByDefault":false,"path":"completed-trade-notifications"},"Item Flags",{"name":"Flag Rare Items","enabledByDefault":true,"path":"flag-rare-items"},{"name":"Flag Projected Items","enabledByDefault":true,"path":"flag-projected-items"},"Links",{"name":"Add Item Profile Links","enabledByDefault":true,"path":"add-item-profile-links"},{"name":"Add Item Ownership History (UAID) Links","enabledByDefault":true,"path":"add-uaid-links"},{"name":"Add User Profile Links","enabledByDefault":true,"path":"add-user-profile-links"},"Other",{"name":"Show User RoliBadges","enabledByDefault":true,"path":"show-user-roli-badges"},{"name":"Post-Tax Trade Value","enabledByDefault":true,"path":"post-tax-trade-value"},{"name":"Mobile Trade Items Button","enabledByDefault":true,"path":"mobile-trade-items-button"},{"name":"Disable Win/Loss Stats RAP","enabledByDefault":false,"path":"disable-win-loss-stats-rap"}]')}),o("8r981",function(t,n){e(t.exports,"default",()=>s);var a=r("eFyFE");function o(){for(let element of(document.querySelector(".value-price-info")?.remove(),document.querySelector(".value-price-label")?.remove(),document.querySelectorAll(".valueSpan")))element.parentElement.getElementsByTagName("br")[0]?.remove(),element.parentElement.getElementsByClassName("icon-rolimons")[0]?.remove(),element.remove()}async function i(){let e=window.location.pathname.match(/\/catalog\/(\d+)\//)?.[1];if(void 0!==a.getRolimonsData().items[e]){let t=await a.waitForElm(".price-container-text");null===t.querySelector(".icon-rolimons")&&(t.insertAdjacentHTML("beforeend",'<div class="text-label field-label price-label value-price-label row-label" style="width: 150px;">Value</div>'),t.insertAdjacentHTML("beforeend",`
                <div class="price-info value-price-info">
                    <div class="icon-text-wrapper clearfix icon-robux-price-container">
                        <span style="margin-top:0px;" class="icon-rolimons icon-robux-16x16 wait-for-i18n-format-render"></span>
                        <span class="valueSpan text-robux-lg wait-for-i18n-format-render"></span>
                    </div>
                </div>
                `),t.querySelector(".item-info-row-container").style.marginBottom="5px");let n=t.querySelector(".icon-rolimons");n.style.setProperty("background-image",`url(${JSON.stringify(a.getURL("assets/icons/logo48.png"))})`,"important"),n.style.backgroundSize="cover",n.style.backgroundPosition="center";let r=t.querySelector(".valueSpan"),o=a.getValueOrRAP(e);r.innerText=a.commafy(o)}}async function l(){for(let text_div of(await a.waitForElm(".item-card-price"),document.getElementsByClassName("item-card-price"))){let e=a.removeTwoLetterPath(text_div.parentElement.parentElement.pathname||text_div.parentElement.querySelector("a").pathname),t=parseInt(e.substring(a.nthIndex(e,"/",2)+1,a.nthIndex(e,"/",3)));if(console.info(t),void 0!==a.getRolimonsData().items[t]){void 0===text_div.getElementsByClassName("valueSpan")[0]&&a.createValuesSpans(text_div);let e=a.getValueOrRAP(t);text_div.getElementsByClassName("valueSpan")[0].innerText=a.commafy(e)}}for(let element of document.getElementsByClassName("list-item"))element.style.marginBottom="35px"}var s=async function(){if("catalog"===a.getPageType()||"itemProfile"===a.getPageType()){if(!await a.getOption("Values on Catalog Pages"))return o();"itemProfile"===a.getPageType()?i():l()}if("userInventory"===a.getPageType()){if(!await a.getOption("Values on User Pages"))return o();l()}}}),o("fgypU",function(t,n){e(t.exports,"default",()=>d);var a=r("eFyFE");async function o(){let e=await a.getOption("Flag Rare Items"),t=await a.getOption("Flag Projected Items");function n(n){let r=n.querySelector(".item-card-price"),o=r?.parentElement?.querySelector(":scope > a")||r?.parentElement?.parentElement,i=a.removeTwoLetterPath(o.pathname),s=parseInt(i.substring(a.nthIndex(i,"/",2)+1,a.nthIndex(i,"/",3)));if(void 0===n.getElementsByClassName("flagBox")[0]){let e=n.querySelector(".item-card-link");e.style.position="relative",l(e)}let d=n.getElementsByClassName("flagBox")[0];d.replaceChildren();let u=a.getRolimonsData().items[s];if(u)for(let hlist of(e&&1===u[9]&&c(d,"rare"),t&&1===u[7]&&c(d,"projected"),document.getElementsByClassName("hlist")))hlist.style.cssText+=";overflow:visible !important;"}if("details"===a.getPageType()){let e=await a.waitForElm(".trades-list-detail");if(e)for(let offer of(await a.waitForElm(".trade-list-detail-offer"),e.getElementsByClassName("trade-list-detail-offer")))for(let item of(await a.waitForElm(".item-card-container"),offer.querySelectorAll(".item-card-container")))n(item)}if("sendOrCounter"===a.getPageType()){let e=await a.waitForElm(".inventory-panel-holder");for(let inventory of(await a.waitForElm(".hlist",e),e.querySelectorAll(".hlist")))for(let item of(await a.waitForElm(".item-card-container"),inventory.querySelectorAll(".item-card-container")))n(item)}if("catalog"===a.getPageType())for(let item of(await a.waitForElm(".item-card-container"),await a.waitForElm(".item-card-price"),document.querySelectorAll(".item-card-container")))n(item);a.initTooltips()}let i={rare:a.getURL("assets/rare.png"),projected:a.getURL("assets/projected.png")};async function l(e){var t=document.createElement("div");t.style.backgroundColor="rgba(0,0,0,0.2)",t.style.maxWidth="54px",t.style.borderRadius="8px",t.style.position="absolute",t.style.top="0px",void 0===document.getElementsByClassName("ropro-icon")[0]?t.style.left="0px":t.style.right="0px",t.className="flagBox",e.appendChild(t)}let s={rare:"This item is rare.",projected:"This item is projected."};function c(e,t){let n=document.createElement("div");n.style.display="inline-block",n.style.cursor="help",n.className=`${t}-flag`;let r=document.createElement("img");r.src=i[t],r.style.height="27px",r.style.width="27px",r.style.padding="3px",n.appendChild(r),e.appendChild(n),a.addTooltip(e.querySelector(`.${t}-flag`),s[t])}var d=o}),o("92Pqq",function(t,n){let a;e(t.exports,"default",()=>u);var o=r("eFyFE");async function i(){if(!await o.getOption("Add Item Profile Links"))return void(document.querySelectorAll(".icon-link").forEach(e=>{e.parentElement.remove()}),document.querySelectorAll(".hasAssetLink").forEach(e=>{e.classList.remove("hasAssetLink")}));"itemProfile"===o.getPageType()&&l(),-1!==["details","sendOrCounter","catalog","userInventory"].indexOf(o.getPageType())&&d()}async function l(){await o.waitForElm(".item-name-container");let e=document.querySelector(".item-name-container").getElementsByTagName("h1")[0];if(null===e.querySelector(".icon-link")){e.style.overflow="visible";let t=document.getElementById("asset-resale-data-container"),n=window.location.pathname.match(/\/catalog\/(\d+)\//)?.[1],a=parseInt(t.getAttribute("data-asset-type"));if(o.checkIfAssetTypeIsOnRolimons(a)){let t=document.createElement("a");t.href=`https://www.rolimons.com/item/${n}`,t.target="_blank",t.style.display="inline-block",t.style.width="28px",t.style.height="28px",t.style.transform="translateY(4px)",o.addTooltip(t,"Open item data page");let a=document.createElement("span"),r="dark"===o.getColorMode()?"rolimonsLink.svg":"rolimonsLinkDark.svg";a.style.backgroundImage=`url(${JSON.stringify(o.getURL(`assets/${r}`))})`,a.className="icon icon-link",a.style.display="inline-block",a.style.backgroundSize="cover",a.style.width="30px",a.style.height="30px",a.style.cursor="pointer",a.style.transition="filter 0.2s",a.style.backgroundColor="transparent",a.style.marginLeft="4px",a.onmouseover=()=>{a.style.filter="brightness(50%)"},a.onmouseout=()=>{a.style.filter=""},t.appendChild(a),e.appendChild(t),o.initTooltips()}}}let s={},c=!1;async function d(){for(let text_div of document.querySelectorAll(".item-card-price:not(.hasAssetLink), .item-value")){for(let old_link of text_div.querySelectorAll(".icon-link"))old_link.parentElement.remove();let e=o.removeTwoLetterPath(text_div.parentElement.parentElement.pathname||text_div.parentElement.querySelector("a").pathname),t=parseInt(e.substring(o.nthIndex(e,"/",2)+1,o.nthIndex(e,"/",3))),n=s[t];if("failed"!==n){if(n){if(o.checkIfAssetTypeIsOnRolimons(n)){let e=document.createElement("a");e.href=`https://www.rolimons.com/item/${t}`,e.target="_blank",e.style.display="inline-block",e.style.paddingLeft="2px",e.style.transform="translateY(-2px)",o.addTooltip(e,"Open item data page");let n=document.createElement("span"),a="dark"===o.getColorMode()?"rolimonsLink.svg":"rolimonsLinkDark.svg";n.style.backgroundImage=`url(${JSON.stringify(o.getURL(`assets/${a}`))})`,n.className="icon icon-link",n.style.display="inline-block",n.style.verticalAlign="bottom",n.style.backgroundSize="cover",n.style.width="18px",n.style.height="18px",n.style.cursor="pointer",n.style.transition="filter 0.2s",n.style.backgroundColor="transparent",n.onmouseover=()=>{n.style.filter="brightness(50%)"},n.onmouseout=()=>{n.style.filter=""},e.appendChild(n),text_div.appendChild(e),text_div.style.overflow="visible",text_div.classList.add("hasAssetLink"),text_div.querySelector('[ng-bind="item.priceStatus"]')&&(text_div.parentElement.querySelector(".creator-name")?(e.style.float="left",e.style.marginTop="-7px"):(e.style.position="absolute",e.style.bottom="18px",e.style.right="50px"))}}else s[t]=!1}}if(o.initTooltips(),-1!==Object.values(s).indexOf(!1)&&!c){c=!0;let e=Object.keys(s).filter(e=>!1===s[e]).map(e=>parseInt(e)),t={items:[]};e.forEach(e=>{t.items.length<100&&t.items.push({itemType:1,id:e})}),void 0===a&&(a=document.querySelector('meta[name="csrf-token"]').getAttribute("data-token"));let n=await fetch("https://catalog.roblox.com/v1/catalog/items/details",{method:"POST",headers:{"X-CSRF-TOKEN":a},body:JSON.stringify(t),credentials:"include"});if(403===n.status&&0===(await n.json()).code)return a=n.headers.get("X-CSRF-TOKEN"),c=!1,d();if(200===n.status?(await n.json()).data.forEach(e=>{s[e.id]=e?.assetType||"failed"}):Object.keys(s).forEach(e=>{!1===s[e]&&(s[e]="failed")}),await i(),c=!1,e.length>100)return d()}}var u=i});var i=r("eFyFE"),l=r("8r981"),s=r("fgypU"),c=r("92Pqq");console.info(`%c${i.getExtensionTitle()} v${chrome.runtime.getManifest().version} has started!`,"color: #0084DD"),console.info("%cJoin our Discord: discord.gg/4XWE7yy2uE","color: #5865F2; font-weight: bold"),i.refreshData(u);let d=0;async function u(){Date.now()-d<100||(d=Date.now(),(0,c.default)(),(0,l.default)(),(0,s.default)())}(async()=>{new MutationObserver(e=>{for(let t of e)if("childList"===t.type&&t.addedNodes){for(let node of t.addedNodes)if(node.classList?.contains("grid-item-container"))return u()}}).observe(await i.waitForElm("#results"),{attributes:!0,childList:!0,subtree:!0})})();let m=["Values","Item Flags","Links"];chrome.runtime.onMessage.addListener(function(e,t){-1!==m.indexOf(e)&&u()})})();

(()=>{
  function get_rolimons_logo_url() {
    let logo_url = window.__NTE_ICONS?.["assets/rolimons.png"] || chrome.runtime.getURL("assets/rolimons.png");
    if (window.__NTE_resolveInlineIcon) {
      logo_url = window.__NTE_resolveInlineIcon("assets/rolimons.png", logo_url);
    }
    return logo_url;
  }

  function patch_catalog_value_icons() {
    let rolimons_logo_url = get_rolimons_logo_url();
    let expected_background = `url("${rolimons_logo_url}")`;

    for (let icon of document.querySelectorAll(".value-price-info .icon-rolimons, .item-card-price .icon-rolimons, .item-value .icon-rolimons")) {
      if (icon.dataset.nte_rolimons_logo === rolimons_logo_url && icon.style.backgroundImage === expected_background) continue;
      icon.style.setProperty("background-image", expected_background, "important");
      icon.style.backgroundSize = "cover";
      icon.style.backgroundPosition = "center";
      icon.style.backgroundColor = "transparent";
      icon.dataset.nte_rolimons_logo = rolimons_logo_url;
    }
  }

  patch_catalog_value_icons();
  new MutationObserver(patch_catalog_value_icons).observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });
})();

(() => {
  let sync_timer = 0;
  let last_url = location.href;
  let rolimons_data = null;
  let rolimons_data_promise = null;
  let rolimons_data_time = 0;
  let rolimons_name_cache = null;
  let rolimons_name_cache_source = null;
  let bundle_detail_cache = {};

  function send_message(message, callback) {
    try {
      let result = chrome.runtime.sendMessage(message);
      if (result && typeof result.then === "function") {
        result.then((value) => callback(value), () => callback(undefined));
      } else {
        callback(undefined);
      }
    } catch {
      callback(undefined);
    }
  }

  function get_option(name) {
    return new Promise((resolve) => {
      chrome.storage.local.get([name], (result) => resolve(result?.[name]));
    });
  }

  function get_rolimons_logo_url() {
    let logo_url = window.__NTE_ICONS?.["assets/rolimons.png"] || chrome.runtime.getURL("assets/rolimons.png");
    if (window.__NTE_resolveInlineIcon) logo_url = window.__NTE_resolveInlineIcon("assets/rolimons.png", logo_url);
    return logo_url;
  }

  function normalize_name(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/[#,()\-:'`"]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function is_unsupported_bundle(name) {
    let normalized = normalize_name(name);
    return normalized === "signature kicks" || normalized === "the jade catseye";
  }

  async function get_bundle_detail(bundle_id) {
    let id = String(bundle_id || "").trim();
    if (!id) return null;
    if (id in bundle_detail_cache) return bundle_detail_cache[id];
    try {
      let resp = await fetch(`https://catalog.roblox.com/v1/bundles/${encodeURIComponent(id)}/details`, {
        credentials: "include",
      });
      bundle_detail_cache[id] = resp.ok ? await resp.json() : null;
    } catch {
      bundle_detail_cache[id] = null;
    }
    return bundle_detail_cache[id];
  }

  function is_roblox_bundle(detail) {
    let creator = detail?.creator;
    if (creator) {
      return String(creator.id || "") === "1" && normalize_name(creator.name) === "roblox" && String(creator.type || "").toLowerCase() === "user";
    }
    let link = document.querySelector(".text-label a.text-name");
    return normalize_name(link?.textContent) === "roblox" && /\/users\/1(?:\/|$)/i.test(String(link?.getAttribute("href") || ""));
  }

  function ensure_rolimons_name_cache(data) {
    if (rolimons_name_cache_source === data && rolimons_name_cache) return rolimons_name_cache;
    let cache = {};
    for (let [id, item] of Object.entries(data?.items || {})) {
      if (!Array.isArray(item) || typeof item[0] !== "string") continue;
      let normalized = normalize_name(item[0]);
      if (normalized && cache[normalized] === undefined) cache[normalized] = { id, item };
    }
    rolimons_name_cache = cache;
    rolimons_name_cache_source = data;
    return cache;
  }

  function get_bundle_match() {
    return location.pathname.match(/\/bundles\/(\d+)(?:\/|$)/i);
  }

  function get_bundle_name() {
    let title = document.querySelector(".item-name-container h1, h1");
    if (!title) return "";
    let clone = title.cloneNode(true);
    for (let node of clone.querySelectorAll("a, button, span")) node.remove();
    return String(clone.textContent || title.textContent || "").trim();
  }

  function get_bundle_price_fallback() {
    let text = document.querySelector(".price-container-text .text-robux-lg, .price-row-container .text-robux-lg")?.textContent || "";
    let value = parseInt(String(text).replace(/[^\d]/g, ""), 10);
    return Number.isFinite(value) ? value : 0;
  }

  function get_bundle_value_entry(data, bundle_id, bundle_name, detail) {
    if (!is_roblox_bundle(detail)) return null;
    if (bundle_id && data?.items?.[bundle_id]) return { id: String(bundle_id), item: data.items[bundle_id] };
    let normalized = normalize_name(bundle_name);
    if (!normalized) return null;
    return ensure_rolimons_name_cache(data)[normalized] || null;
  }

  function load_rolimons_data() {
    if (rolimons_data && Date.now() - rolimons_data_time < 60000) return Promise.resolve(rolimons_data);
    if (rolimons_data_promise) return rolimons_data_promise;
    let message = rolimons_data ? "getDataPeriodic" : "getData";
    rolimons_data_promise = new Promise((resolve) => {
      send_message(message, (data) => {
        if (data?.items) {
          rolimons_data = data;
          rolimons_data_time = Date.now();
        }
        resolve(rolimons_data);
        rolimons_data_promise = null;
      });
    });
    return rolimons_data_promise;
  }

  function remove_bundle_value_row() {
    for (let node of document.querySelectorAll('[data-nte-bundle-value="1"]')) node.remove();
  }

  function ensure_bundle_value_row() {
    let container = document.querySelector(".price-container-text");
    if (!container) return null;

    let label = container.querySelector('.value-price-label[data-nte-bundle-value="1"]');
    if (!label) {
      label = document.createElement("div");
      label.className = "text-label field-label price-label value-price-label row-label";
      label.style.width = "150px";
      label.dataset.nteBundleValue = "1";
      label.textContent = "Value";
      container.appendChild(label);
    }

    let info = container.querySelector('.value-price-info[data-nte-bundle-value="1"]');
    if (!info) {
      info = document.createElement("div");
      info.className = "price-info value-price-info";
      info.dataset.nteBundleValue = "1";

      let wrapper = document.createElement("div");
      wrapper.className = "icon-text-wrapper clearfix icon-robux-price-container";

      let icon = document.createElement("span");
      icon.className = "icon-rolimons icon-robux-16x16 wait-for-i18n-format-render";
      icon.style.marginTop = "0px";
      icon.style.backgroundImage = `url("${get_rolimons_logo_url()}")`;
      icon.style.backgroundSize = "cover";
      icon.style.backgroundPosition = "center";
      icon.style.backgroundColor = "transparent";

      let value = document.createElement("span");
      value.className = "valueSpan text-robux-lg wait-for-i18n-format-render";
      value.dataset.nteBundleValue = "1";

      wrapper.append(icon, value);
      info.appendChild(wrapper);
      container.appendChild(info);
    }

    container.querySelector(".item-info-row-container")?.style.setProperty("margin-bottom", "5px");
    return info.querySelector(".valueSpan");
  }

  async function sync_bundle_value_row() {
    if (!(await get_option("Values on Catalog Pages"))) {
      remove_bundle_value_row();
      return;
    }

    let match = get_bundle_match();
    if (!match) {
      remove_bundle_value_row();
      return;
    }

    let bundle_name = get_bundle_name();
    let detail = await get_bundle_detail(match[1]);
    let data = await load_rolimons_data();
    let official_bundle = is_roblox_bundle(detail);
    let entry = get_bundle_value_entry(data, match[1], bundle_name, detail);
    let fallback_value = official_bundle && is_unsupported_bundle(bundle_name) ? get_bundle_price_fallback() : 0;
    let value = entry?.item?.[4];
    value = Number.isFinite(Number(value)) ? Number(value) : fallback_value;

    if (!(value > 0)) {
      remove_bundle_value_row();
      return;
    }

    let span = ensure_bundle_value_row();
    if (!span) return;
    let display = Number(value).toLocaleString();
    if (span.textContent !== display) span.textContent = display;
  }

  function schedule_sync() {
    clearTimeout(sync_timer);
    sync_timer = setTimeout(() => {
      sync_timer = 0;
      sync_bundle_value_row().catch(() => {});
    }, 60);
  }

  schedule_sync();
  new MutationObserver(() => {
    if (location.href !== last_url) last_url = location.href;
    schedule_sync();
  }).observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });
  setInterval(() => {
    if (location.href === last_url) return;
    last_url = location.href;
    schedule_sync();
  }, 500);
})();
