# State machines

Most of the extension is state over time: a trade loads, values fill in, a send runs, an ad posts. This file lists every such state machine, where its state lives and how to see it, plus the rules for writing one. The rules exist so that a change never strands a user in a state with no way out. Much of the existing code predates them, so follow them when you add or change a machine, and use the Notes column to see what is already fixed or known.

## Rules

1. **One mode, one value.** A machine's mode lives in one variable, one storage key or one `data-state` attribute, never in a mix of flags. Name it `<thing>_state` and list the states and moves where it is declared:
   `let sync_state = "idle"; // idle → loading → ready | failed; failed → loading (retry)`
2. **Every state has a way out.** Locks and in-flight flags are released in `finally`. Waiting states time out. Failed states retry or show why.
3. **The newest request wins.** Async work takes a run number and drops its result if a newer run started:
   `let run = ++sync_run; … if (run !== sync_run) return;`
4. **Persist what must survive a restart.** The background worker can be killed at any time. A mode that must outlive it goes in `chrome.storage` and is checked when the worker wakes.
5. **Show it.** If a user can be in a state, the UI says so: loading, empty, failed (with what to do next) or running (with how to stop).
6. **Write DOM state only when it changes.** Our MutationObservers react to every write, even one that sets the same value. Use `set_attr_if_changed`, `set_text_if_changed`, `add_class_if_missing` and `remove_class_if_present` (in `content/trade_page.js`), or the same check inline elsewhere.
7. **Make it observable.** When you add or change a machine the user can see, put its state in `data-state` on its root element (written only when it changes), so CSS and tests can read `[data-state="failed"]` instead of guessing from text.

## How to see a machine's state

- **Background worker.** The state lives in top-level variables (for example `ta_state`, `ta_run_id`) and in `chrome.storage` keys. Open `chrome://extensions`, find the extension, choose "service worker" and then Inspect. Read the variables and keys from that console.
- **Content scripts.** The state lives in isolated-world variables. In DevTools, pick the extension's context in the console's context menu. The DOM markers (`data-*` attributes and classes) are listed in each row.
- **Popup.** Right-click the popup and choose Inspect. Read the `chrome.storage` keys listed in each row from the console.

## Map

Each row names one machine. The IDs in brackets are the audit IDs, so the full report can be found.

### Background worker

| Machine | Where | States | Lives in | Notes |
|---|---|---|---|---|
| Item data cache and retry (ITEM) | `background/background.js` → `item_data_retry_promise`, `item_data_refresh_promise`, item fetch and cache helpers | FRESH → STALE → REFRESHING → FRESH; RETRYING-FOREVER (no good data); EMPTY (null to consumers) | memory; storage keys `data`, `lastRequestForData`, `lastItemDataAttempt` | Known gap: null item data reaches notifications and inbound stats (see Known gaps) |
| Trade API queue and rate window (TAPI) | `background/background.js` → trade API queue, window and resume helpers; priority bypass | OPEN → PAUSED (until resume) \| WINDOW-FULL (40 per minute); priority path bypasses both | memory | |
| Inventory fetch retry (INVRETRY) | `background/background.js` → `nte_fetch_inventory_with_retries` | ATTEMPT(n) → WAIT-429 (until) \| WAIT-5xx (backoff) → GIVE-UP (null or last response) | memory | |
| Trade cache map (TCACHE) | `background/background.js` → `cache_trade_detail`, normalize, prune and save helpers | ABSENT → CACHED-LIST-ROW (no offers) \| CACHED-DETAIL (offers) → EXPIRED (pruned) | storage `cachedTrades` | Known gap: lost updates between writers (TCACHE-1, see Known gaps) |
| Update state (UPDATE) | `background/background.js` → update check and apply code | NONE → PENDING (version newer than current) → CLEARED | storage (update state key) | |
| Trade notification reservation (NOTIF, background) | `background/background.js` → `show_trade_notification`, reserve step; `trade_notification_sent_memory`, `trade_notification_pending_keys` | per key `type:id`: UNSEEN → PENDING (memory) → RESERVED (persisted) → result ignored | memory; storage (reservation keys) | Known gap: reserved before delivery, not retried (NOTIF-1) |
| Notification click handlers (NOTIFCLICK) | `background/background.js` → `ensure_notification_click_handler`, `remember_trade_notification_user` | UNREGISTERED → REGISTERED (once) | memory | |
| Inbound trade poll (INBOUND) | `background/background.js` → inbound poll function; `inbound_poll_running`, `inbound_poll_timer` | DISABLED → IDLE → RUNNING → SEEDING (first run) \| STALE-RECOVERY → BATCH-PROCESSING → SAVED | storage `inboundPollState`; alarm `inboundPollAlarm` | Fixed: one bad trade no longer stops the batch. Known gap: webhook before cursor save (INB-2) |
| Poll timers and keep-alive ports (POLL) | `background/background.js` → `ensure_inbound_poll_timer`, `ensure_trade_status_poll_timer`, `keepalive_ports` (Set), onConnect and onDisconnect | TIMERS-ON ⇄ TIMERS-OFF | memory; alarm `inboundPollAlarm` (30 s fallback) | Fixed: timers stop only after the last port closes |
| Trade-status poll (TSTATUS) | `background/background.js` → `fetch_trade_page`, `refresh_trade_cache`; `trade_status_seed_running`, `trade_status_poll_running` | IDLE → POLLING \| SEEDING (blocks poll) → SUPPRESSING (stale gap, declines cached silently) → NOTIFYING | memory; storage `cachedTrades` | |
| Self-declined ids (SELFDEC) | `background/background.js` → get, mark and consume helpers | ABSENT → MARKED (timestamp) → CONSUMED; 24 h TTL | storage (self-declined key) | Known gap: lost update, LOW, not changed |
| Decline CSRF token (CSRF) | `background/background.js` → `trade_row_get_csrf`, `trade_row_decline_trade` | NO-TOKEN → FETCHING (promise) → HAVE-TOKEN → STALE (after 403 or 429) | memory | |
| Authenticated user (AUTHUSER) | `background/background.js` → authenticated-user lookup and cache | EMPTY → PENDING → VALID (5 min) → EXPIRED | memory | |
| Trade pricing freshness (PRICING) | `background/background.js` → apply-pricing code; `trade_rap_fresh_ms`, `__nte_fetched_at` gate | empty → fresh → stale → refetch | memory | |
| Proof lookups and images (PROOFS) | `background/background.js` → `fetch_player_proofs`, `fetch_item_proofs_api`, `get_item_proofs`, image fetch | CACHED \| MISS → FETCHING (no in-flight marker) → CACHED; ERROR (thrown, not cached) | memory | Fixed: 20 s timeouts on proof lookups and images |
| Trade-history thumbnails (THUMBS) | `background/background.js` → `fetch_trade_history_asset_thumbnails`; `trade_history_thumb_cache` | CACHED-USABLE \| MISS → FETCHED \| LEFTOVER (retry pass) | memory | Known gap: thumbnail fetches have no timeout (MSG-1) |
| Trade history, user and ciiid caches (TRADEHIST) | `background/background.js` → `resolve_trade_history_uaid_from_ciiid`, `fetch_trade_history_api`, `get_trade_history`; LRU helpers | CACHED (value or empty) \| MISS → ERROR | memory | Fixed: failed uaid lookup no longer cached as "none". Known gap: ciiid lookup has no timeout |
| Rolimons lane (ROLI-LANE) | `background/background.js` → `rolimons_queue`, `rolimons_note`, `rolimons_backing_off`; `rolimons_backoff_until`, `rolimons_backoff_ms` | OPEN → BACKING OFF (429/403: 60 s, doubling to 10 min) → OPEN on success; lookups run one at a time, ≥ 300 ms apart | memory | Added 2026-11-11: a 400-row trade list fired every player lookup at once and Rolimons banned users (Cloudflare 1015). Player info and ciiid lookups go through it. |
| Rolimons player info (ROLIPLAYER) | `background/background.js` → `fetch_rolimons_player_info`; `rolimons_player_info_cache`, `rolimons_player_info_inflight` | MISS → INFLIGHT → CACHED \| ERROR (not cached) | memory | Fixed: 20 s timeouts on player info and page fetches |
| Roblox friends list (FRIENDS) | `background/background.js` → `fetch_roblox_friends_list`, `hydrate_roblox_friend_names`; `roblox_friends_cache`, `roblox_friends_cache_at`, `roblox_friends_inflight` | EMPTY → INFLIGHT → CACHED \| PARTIAL (cached with missing names) | memory | Fixed: timeouts; partial names not cached. Known gap: partial names still reply ok |
| Trade-auto runner (TA) | `background/background.js` → `ta_run_action`, `ta_stop_now`, `ta_sleep`; `ta_state`, `ta_abort`, `ta_run_id`, `ta_wake`; message handlers | IDLE → RUNNING (fetching \| checking \| declining) → WAITING-RATE-LIMIT (`wait_until` > now) → CANCELLING (abort set) → DONE (error "", "Cancelled by user" or message) | memory `ta_state` |Fixed: old run stops after Stop then Start; timeouts; visible errors; no decline without item values. Known gap: one in-flight decline can still send after Stop then Start (TA-1 residual) Unowned check (2026-11-11): one exact-copy lookup per item (`ta_user_owns_copy`); a private inventory falls back to "owns any copy"; unknowns count in `ta_state.unchecked`; `ta_state.finished_at` lets the popup drop a result after 10 min. |
| Item resale cache (SALES) | `background/background.js` → sales fetch and cache; `item_sales_cache` | CACHED (5 min) \| MISS | memory | |
| Face-to-bundle map (FACEMAP) | `background/background.js` → `rolimons_player_face_map_cache`, `rolimons_player_face_map_at` | CACHED (30 min) → EMPTY \| STALE-FALLBACK | memory | |
| Message response channel (MSG-1) | `background/background.js` → `onMessage` listener (all handlers) | PENDING → RESPONDED; failure mode is PENDING with no response | memory | Fixed: 20 s timeouts on handler-awaited fetches. Known gap: other fetches have no timeout |
| Default options migration (OPT) | `background/background.js` → `ensure_default_options` (install and startup) | MIGRATED (idempotent) | storage (options) | |
| Storage change reactions (STORECHG) | `background/background.js` → `chrome.storage.onChanged` listener | no state; `Inbound Trade Notifications` and `Declined/Completed Trade Notifications` keys start or stop their polls | storage (setting keys) | |
| Caching and inbound alarms (ALARM) | `background/background.js` → alarm create and listener (`cachingSystem`, `inboundPollAlarm`) | no state (alarm dispatch) | alarms | |
| Routility item data (ROUTILITY) | `background/background.js` → `fetch_routility_data` and storage-backed cache | FRESH (under 59 s) → STALE → FETCHING (no marker) | storage (Routility item data) | |
| Screenshot capture (QUICKPROOF) | `background/background.js` → quick-proof capture | CAPTURING (10 s timer) → done (latch) | memory | |
| Trade analysis request (TRADEANALYZE) | `background/background.js` → `evaluate_trade_analysis` | stateless (request in flight) | memory | Fixed: 35 s timeout with a plain message |

### Background jobs

Mass send (`background/mass_send.js`), trade ads (`background/trade_ads.js`) and trade ad alerts (`background/trade_ad_notifications.js`), plus the inbound webhook sender and the notification card.

| Machine | Where | States | Lives in | Notes |
|---|---|---|---|---|
| Mass send run (MS-RUN) | `mass_send.js` → `ms_run`, `ms_start`, `ms_stop`, `ms_stop_now`, `ms_progress`; `ms_state`, `ms_abort`, `ms_run_seq` | idle → preparing → waiting-for-roblox-tab → resolving-offer → owners → filtering → sending ⇄ rate-limited → done \| stopped \| error (also awaiting_2fa) | memory `ms_state` | Fixed: a send that succeeds after Stop is still recorded |
| 2FA code prompt (MS-2FA-PROMPT) | `mass_send.js` → `ms_notify_2fa`, `ms_prompt_2fa_code`, `ms_2fa_submit`, prompt wait | none → prompt(code) \| prompt(unlock) → busy (submitted, verifying) → done; timed-out or cancelled | memory (prompt shown by popup) | |
| Unlock password and TOTP session (MS-TOTP-SESSION) | `mass_send.js` → `ms_resolve_session_secret`, `ms_get_2fa_code`, `ms_decrypt_totp_secret`, `ms_wait_for_fresh_totp`; `ms_session_secret`, `ms_last_used_totp` | plain-secret → unlocked (memory); encrypted-locked → unlocking (prompt) → unlocked; manual-only (no secret or unlock failed) | memory (session secret) | Fixed: wrong password re-prompts; three misses fall back to manual code |
| Per-trade send and challenge (MS-SEND-CHALLENGE) | `mass_send.js` → `ms_send_trade`, `ms_extract_challenge_info`, `ms_verify_2fa` | sent; csrf-refresh; challenge (2FA) → verifying → retry-with-challenge-headers; stale-challenge-retry; security-check; failed | memory | |
| Rate-limit wait (MS-RATE-WAIT) | `mass_send.js` → `ms_sleep`, `ms_wake`, `ms_wait_rate_limit`, `ms_send_trade_with_rate_limit` | sending → rate-limited (until) → resumed | memory (`ms_wake`) | |
| Pending send handoff (MS-PENDING-SEND) | `mass_send.js` → `ms_pending_send` | none → pending → settled | memory | |
| Daily trade limit snapshot (MS-DAILY-LIMIT) | `mass_send.js` → `ms_compute_trade_daily_limit`, `ms_get_trade_daily_limit`; limit constants | fresh-tab-answer; snapshot-fresh; computed; stale-snapshot; unknown (ok false) | storage (snapshot with `fetched_at`) | |
| Roblox front-tab gate (MS-TAB-GATE) | `mass_send.js` → `ms_roblox_tab_is_in_front`, `ms_wait_for_roblox_tab` | in-front ⇄ not-in-front (waits at start only) | memory | |
| Keep-alive ping (MS-KEEPALIVE) | `mass_send.js` → `ms_keep_alive_tick`, `ms_stop_keep_alive` | on ⇄ off | memory | |
| Posting busy lock (TA-POST-LOCK) | `trade_ads.js` → `trade_ads_post_in_flight`, `trade_ads_post_is_busy`, `trade_ads_post_now` | idle → in-flight (timestamp) → stale (over 15 min, treated as idle) | memory (timestamp) | |
| Auto-post scheduler (TA-AUTO) | `trade_ads.js` → `trade_ads_auto_post_tick`, `trade_ads_compute_next_auto_post_due_at`, `trade_ads_sync_alarm`, `trade_ads_advance_rotation_preset` | paused → armed-no-anchor → waiting-interval → due → posting → backing-off (n, until) \| posted | alarm (synced by `trade_ads_sync_alarm`); storage (trade ads config) | Fixed: rotation write-back reads fresh config, keeps pause |
| Roblox verification and bio (TA-VERIFY) | `trade_ads.js` → `trade_ads_auto_verify`, `trade_ads_verify_via_api`, `trade_ads_get_roblox_bio`, `trade_ads_update_roblox_bio`, `trade_ads_is_stored_verified` | unverified → phrase-issued → bio-modified (phrase appended) → verified; bio-restored; failed-with-bio-dirty | storage (verified flag); Roblox bio | Fixed: failed verify removes the appended phrase (best effort). Known gap: no dedupe for double clicks |
| Catalog and thumbnail locks (TA-MUTEX) | `trade_ads.js` → `trade_ads_catalog_locked`, `trade_ads_catalog_csrf`, `trade_ads_thumb_cache_locked`, `trade_ads_roblox_catalog_items_details` | unlocked → locked (holder) → queued | memory | Fixed: 20 s timeouts on the three locked fetches |
| Alert poll lock and watermark (TAN-POLL) | `trade_ad_notifications.js` → `trade_ad_notif_poll_once`, `trade_ad_notif_commit_poll`, `trade_ad_notif_ensure_alarm`, `trade_ad_notif_init_monitor`; `trade_ad_notif_poll_in_flight` | disabled → idle → polling (in flight) → error (lastError set; next poll retries on alarm) | storage (alert state blob); alarm (1 min) | |
| Alert enable and backfill on enable (TAN-ENABLE) | `trade_ad_notifications.js` → `trade_ad_notifications_set_enabled`, `trade_ad_notif_load_more_once` | off → on-backfilling (reply waits for backfill) → on-idle | storage (alert state blob) | Known gap: reply waits for backfill; popup needs a change |
| Feed backfill cursor (TAN-BACKFILL) | `trade_ad_notifications.js` → `trade_ad_notif_backfill_feed`, `trade_ad_notif_feed_retry_delay_ms`, `trade_ad_notif_load_more_once` | not-started → in-progress → busy (429; retry after 60 s, 120 s, 240 s, then 300 s) → exhausted \| error | storage (`feedRetryAt`, `feedRetryCount`, offset) | Fixed: a 429 schedules a retry on the one-minute alarm |
| Alert state writes (TAN-STATE-WRITES) | `trade_ad_notifications.js` → `trade_ad_notif_save_if_current`, `trade_ad_notif_scan_owned_fields`, dismiss, ignore, threshold, settings, disabled-items handlers | shared blob, no mode of its own | storage (alert state blob) | Fixed: saves merge scan fields only; disable and dismiss survive. Known gap: disable can race a save |
| Viewer inventory cache (TAN-INV-CACHE) | `trade_ad_notifications.js` → `trade_ad_notif_get_viewer_inventory`; `trade_ad_notif_inventory_cache` | empty → fresh → stale → refreshing (no lock) | memory (15 min TTL) | |
| Inbound webhook send (IWP-SEND) | `background/inbound_trade_webhook_preview.js` → `send_inbound_trade_webhook_notification`, `get_discord_retry_delay_ms` | multipart-sending → 429-waiting → multipart-retrying → json-fallback → done-ok \| done-failed | memory | Not changed in the fix pass |
| Preview fonts and blobs (IWP-FONT) | `background/inbound_trade_webhook_preview.js` → font loader (`_loadFF`) and blob revoke | fonts-loaded \| fallback-system-fonts | memory | Not changed in the fix pass |
| Notification card (C-CARD) | `background/trade_notification_card.js` → `build_trade_notification_card`, `nte_card_thumb_bitmaps` | none (pure render); caller decides text fallback | n/a | |

### Popup

Files: `popup/popup.js` and `popup/trade_ad_notifications_ui.js`.

| Machine | Where | States | Lives in | Notes |
|---|---|---|---|---|
| Trade-ads tab render (TAR) | `popup.js` → `render_trade_ads_tab`; `trade_ads_render_run` | loading → not-signed-in \| error \| composer (verified) \| verify-flow (unverified); last render to finish wins | DOM `#trade-ads-root`; memory (run counter) | Fixed: a run counter stops older renders overwriting newer ones |
| Trade-ads inventory session (TINV) | `popup.js` → `trade_ads_load_inventory_session`, `trade_ads_reset_inventory_session`; `trade_ads_inventory_session_gen` | none → loading (promise) → loaded \| error (promise cleared) | memory | Fixed: a reset generation stops old loads refilling the cache |
| Catalog picker search (TPK) | `popup.js` → `fetch_catalog_page`, `schedule_search`; `search_run` | idle → loading-first-page \| loading-more → idle; has_more true or false | memory | Fixed: a new search supersedes an in-flight append |
| Inbound alert toggle (NOTIF, popup) | `popup.js` → `create_toggle`, `maybe_request_notifications`, `notifications_failure_text` | off → requesting-permission → on (granted) \| off (denied) | storage (inbound notifications setting) | Known gap: checkbox read before the permission prompt (LOW) |
| Trade-ad alerts mount (TNOTIF) | `popup.js` → `trade_ads_mount_notifications_panel`; listener in `trade_ad_notifications_ui.js` → `on_changed` | unmounted → mounted (listener attached) → mounted-refresh | DOM `#ta-notifs-root`; storage change listener | Fixed: listener removes itself when its mount is detached |
| Trade-ads verify flow (TAV) | `popup.js` → `render_trade_ads_verify_flow`; keys and merge helpers | idle → loading → idle \| manual; "Try auto again" → loading → verified | storage (verify step key); memory | Fixed: loading step no longer persisted, so no auto-verify on reopen. Known gap: background verify has no dedupe (TA-VERIFY) |
| Posting countdown (TCD) | `popup.js` → `refresh_trade_ads_next_run` (tick), clear and restart at render | paused → counting-down → alarm-polling (tick calls `chrome.alarms.get`) → paused | memory (interval); alarm | |
| Post now button (POST) | `popup.js` → post-now click handler | idle → posting (disabled) → posted \| failed | DOM button | |
| Disconnect confirm (DISC) | `popup.js` → disconnect click handler | idle → armed (confirm text, timer) → disconnecting → re-render | memory (timer) | |
| Posting switch and interval (SCHED) | `popup.js` → `sync_schedule_ui`, switch and interval handlers | off ⇄ on; displayed state comes from config, not the alarm | storage (trade ads config) | |
| Trade-ads config save chain (TSAVE) | `popup.js` → `trade_ads_save_merged_config` (chained writes); render-time `cfg` in `render_trade_ads_composer` | writes serialized; each patch built from the render-time snapshot | storage (trade ads config) | |
| Extension update banner (UPD) | `popup.js` → normalize, apply, request-check, `render_update_banner` | no-update → throttled (cooldown) \| update-available → applying (disabled) → apply-failed (re-enabled) | memory (cooldown) | |
| Popup theme switcher (THEME) | `popup.js` → `init_popup_theme_switcher`, apply | default → loaded (applies saved value) | storage (popup theme) | |
| Inbound and duplicate-warning modals (MODAL) | `popup.js` → `prompt_inbound…`, `open_inbound_…`, `open_duplicate…`, `prompt_duplicate…` | closed → open (awaiting resolve) → closed; test button: idle → sending → sent \| failed \| error → re-enabled after 3 s | memory | |
| Option mode menu (OPTMENU) | `popup.js` → `create_option_mode_menu`, `close_menu`; four document listeners | closed → open (panel in body, global listeners) → closed | DOM; memory (listeners) | |
| Item picker (PICKER) | `popup.js` → `trade_ads_attach_picker`, close, debounce, offer and catalog sides, reload | closed → open (loading inventory or catalog) → filtered or paged → closed | DOM | |
| Trade-ads category (CAT) | `popup.js` → category get, set, layout, bind, restore | posting \| notifs | storage (trade ads category) | |
| Recent posts list (RECENT) | `popup.js` → recent-list toggle; `#ta-recent-list` | collapsed ⇄ expanded | DOM `aria-expanded` (default false); no storage | |
| Posting storage listener (PSTORE) | `popup.js` → listener installed in `render_trade_ads_composer` | listener per composer render; replaces its predecessor | memory | |
| Options search (OPTSRCH) | `popup.js` → `apply_options_search`, `ensure_options_search_bar` | no query ⇄ query (search-driven visibility) | DOM | |
| Options render generation (OPTRENDER) | `popup.js` → `render_options_seq`, `render_id` | each render gets an id; only the newest swaps the DOM | memory | |
| Options page rebuild (M01) | `popup/popup.js` → `render_options_seq` (same generation as OPTRENDER) | idle → building (awaiting banners, storage, TOTP snapshot) → committed | memory | |
| Trade-ads thumbnail retry (THUMB) | `popup.js` → thumbnail loader | loading → error → refetch once → placeholder | memory | |
| Colorblind and counter-trade migrations (COLOR) | `popup.js` → `ensure_*` helpers, toggle, profile picker | derived enabled and profile; migration writes both keys together | storage (colorblind mode and profile keys) | |
| Roblox 2FA card (M02) | `popup/popup.js` → options build; `totp_write_gen`, `save_plain_secret`, `pending_secret`, `pending_encrypt` | disabled → enabled-no-secret \| enabled-plain \| enabled-encrypted; awaiting-protect-choice → awaiting-password → encrypting → saved | storage (TOTP mode, encrypted blob, plaintext secret); memory (pending values) | Fixed: new secret saved before old blob removed; Clear beats late encrypt |
| Theme card (M03) | `popup/popup.js` → `show_surface`, `save_theme`, `queue_theme_save`; `surface_state` cache | surface (roblox \| rolimons) × enabled × editor, picker and name-panel open or closed × upload pending | storage (theme keys); memory (`surface_state`) | |
| Settings backup and reset (M04) | `popup/popup.js` → restore button, import and export handlers | idle → armed (confirm, 4 s window) → running (disabled) → done \| failed | memory | |
| Host permission banner (M05) | `popup/popup.js` → `required_origins`; banner `nte-permissions-banner` | granted \| missing (banner shown) \| requesting | DOM; browser permissions | |
| Trade-actions confirm dialogs (M06) | `popup/popup.js` → `ta_wire_dialog` and dialog open or confirm | closed → open (one overlay expected) → confirming | DOM overlay | |
| Trade-actions bulk job (M07) | `popup/popup.js` → `ta_update_buttons`, `ta_start_polling`, `ta_poll_timer`, `ta_last_announced`, stop handler | idle → starting → fetching \| checking \| declining → stopping → done \| error; other-action-running; popup-disconnected (null progress) | memory (poll timer); background `ta_state` | Fixed: Stop stays usable after lost contact; failed starts show errors. Known gap: background start always replies ok |
| Mass-send inventory cache (M08) | `popup/popup.js` → mass-send inventory loader (in-flight promise and cache) | empty → in-flight → cached | memory | |
| Mass-send 2FA box (M09) | `popup/popup.js` → `maybe_focus_mass_send_2fa`, `ms_sync_2fa_box`, `ms_submit_2fa` | hidden → awaiting-code \| awaiting-unlock → busy (submitting) → error-shown | DOM (box); background prompt state | |
| Mass-send polling (M10) | `popup/popup.js` → `ms_update_progress_ui`, `ms_start_polling`, `ms_max_null_polls`; `ms_poll_timer` | idle → running → lost-contact (after 10 null replies) \| stopped | memory | Fixed: Stop after lost contact stops the run, does not start one |
| Mass-send panel render (M11) | `popup/popup.js` → `render_mass_send_panel`; `ms_render_run` | rate-gated \| lite \| mounted (from snapshot) \| rendering (awaiting snapshot) | DOM; memory | Fixed: only the newest render binds its handlers |
| Mass-send config (M12) | `popup/popup.js` → `ms_normalize_config`, `ms_load_config`, `ms_save_config`, `persist_filters`, toggles | persistence only | storage (mass-send config) | Fixed: toggles re-read config before saving |
| Mass-send start confirm (M13) | `popup/popup.js` → `ms_confirm_start` | closed → open → resolved (true or false) | DOM; memory | |
| Mass-send rate gate (M14) | `popup/popup.js` → rate-gate handlers (keys set at popup start) | gated → store-opened (unlock shown) → unlocked | storage (rate-gate keys) | |
| Never-send-to blocklist (M15) | `popup/popup.js` → blocklist resolver and handlers; `ms_blocklist_io_flash` | idle → looking-up (add disabled) → importing → status-shown; clear-armed | storage (blocklist); memory (flash) | |
| Rolimons item data in alerts UI (M16) | `popup/trade_ad_notifications_ui.js` → item data loader and lookups | unloaded → loaded | memory | |
| Watch-items modal (M17) | `popup/trade_ad_notifications_ui.js` → `hydrate_items`, `load_failed` flag, Save handler | loading → cached-and-refreshing → loaded; load-failed (Save disabled); saving | memory; storage (watch items) | Fixed: failed load blocks Save; refresh keeps unsaved choices |
| Ignore-list and profit-filter modals (M18) | `popup/trade_ad_notifications_ui.js` → ignore and threshold modals (unused) | closed ⇄ open → resolved | memory | |
| Alert settings modal (M19) | `popup/trade_ad_notifications_ui.js` → settings modal, Save, Manage | closed → open (clean or dirty) → saving | storage; memory (dismissed copy) | |
| Next-refresh countdown (M20) | `popup/trade_ad_notifications_ui.js` → countdown label and timer; `globalThis.__taNotifLastState` | off → scanning → waiting (countdown) → refreshing-soon → overdue | memory | Fixed: overdue label reads "Waiting for the next check" |
| Feed scan and load more (M21) | `popup/trade_ad_notifications_ui.js` → `try_load_more`, ensure and append, load-more binding | idle → scanning (in flight) → exhausted \| error (lastError) \| idle-with-more | memory | Fixed: zero-match pages keep scanning; Load more re-enables after success |
| Alerts panel refresh and render (M22) | `popup/trade_ad_notifications_ui.js` → `render_shell`, `refresh_ui`, `render_into`, `sync_open_panel`; `__taNotifRefreshRun` | loading → shell (enabled \| disabled) → shell with cards \| error card | DOM; memory (refresh run) | Fixed: out-of-order refreshes do not render; error card has Retry. Known gap: toggle and settings writes do not bump the run (M22) |
| Alert card list (M23) | `popup/trade_ad_notifications_ui.js` → `trade_ad_notif_append_matches`, dismiss, send | cards rendered; dismiss in flight (disabled); send in flight ("Opening…", 700 ms reset) | DOM `.ta-notif-card[data-ad-id]` | Fixed: live poll inserts newer ads at the top, no duplicates |

### Trades page (content/trade_page.js)

The list, rows, filters, inventory search and overlays on `/trades`. Rows below are the audit groups R1 to R3 for this file.

| Machine | Where | States | Lives in | Notes |
|---|---|---|---|---|
| Trade API rate-limit queue (R1-01) | `trade_page.js` → `fetch_trade_api`, helpers; `trade_api_rate_limit_resume_at`, `trade_api_rate_limit_queue`, `trade_api_request_times` | idle → throttled-by-window (40 requests per 60 s) → paused (resume_at > now) → in-flight → idle | memory; storage `tradeApiRateLimitResumeAt`, `tradeApiRequestTimes` | |
| Rolimons and Routility data loader (R1-02) | `trade_page.js` → `refreshData`, apply, storage listener; `rolimons_refresh_callback`, `rolimons_refresh_failures`, `values_to_use_cache` | loading (no items) → ready → refreshing (60 s) → backoff (2 s × k, cap 30 s) while no items | memory; storage listener | Fixed: retries stop when the extension context is gone. Known gap: values-to-use split (audit R1-01) |
| Username to user id cache (R1-03) | `trade_page.js` → `fetchIDFromName` (`C`), cache helpers; `username_id_cache`, `username_id_pending` | unknown → pending → hit (6 h TTL) \| miss (5 min TTL) | memory | |
| Item-link decorator lock (R1-04) | `trade_page.js` → decorator pass `c()`; busy flag and id-status map | per id: unknown → pending → known (asset type) \| failed; global idle ⇄ busy (released in finally) | memory | Fixed: 429 and 5xx retry after 30 s; CSRF retry capped |
| Profile header Rolimons link (R1-05) | `trade_page.js` → header link inject and remove; `nte-header-with-roli` | none → link present → removed | DOM class `nte-header-with-roli`; link `.nte-profile-rolimons-link` | |
| Projected and rare flag boxes (R1-06) | `trade_page.js` → refresh, per-card, flag-state, box and tooltip functions | no flag → flag (rare \| projected \| both); side left or right by layout | DOM `.flagBox`, `nte-has-flag`, `nte-flag-side-left` and `-right` | |
| Ownership badge observer (R1-07) | `trade_page.js` → provider, badge writes, observer and timers, refresh pass; `ownership_link_provider_cache`, `uaid_link_refresh_timer`, `uaid_link_refresh_retry_timer` | observer not started → started → observing; refresh scheduled \| idle | memory | Fixed: a detached root rebinds; a failed bind clears the flag |
| Trade win and loss chip (R1-08) | `trade_page.js` → `p()`, retry loop, `ensure_trade_win_loss_container`, `align_trade_win_loss_container`; `trade_win_loss_run`, `trade_win_loss_retry_count` | hidden → pending-retry (20 max, 80 ms apart) → rendered (trade id) → hidden-stale (trade change) | memory; DOM `#winLossStatsContainer` | Fixed: superseded runs draw nothing |
| Colorblind profit palette (R1-09) | `trade_page.js` → `sync_trade_profit_mode`, palette tables; `trade_profit_colorblind_mode`, `trade_profit_colorblind_profile` | default → colorblind (profile) | memory; storage (profit palette setting) | |
| Post-tax filter mirror (R1-10) | `trade_page.js` → `get_post_tax_trade_values_enabled`, `ensure_post_tax_filter_sync`, storage listener | default true → synced to option → refresh on storage change | memory mirror; storage (option) | |
| Trade search inventory cache (R1-11) | `trade_page.js` → `fetch_tradable_items`, `clear_trade_search_caches`; `search_inv_cache`, `search_inv_cache_at`, `search_thumb_cache` | absent → loading → fresh (5 min) → expired \| partial (30 s) | memory | Fixed: TTL checked before reuse; reload blocks stale writes |
| Inventory search overlay and mount (R1-12) | `trade_page.js` → `w()` and mount function `n(r)`; `search_pending`, `search_toggle_inflight` | unmounted → waiting-for-host → mounting → mounted \| mounted-failed; per search: idle → pending → done \| cancelled | DOM panel dataset flags `nteTradeSearchMounting`, `nteTradeSearchMounted`, `nteTradeSearchWaiting` | Fixed: mount flags release on throw; failed adds show a message |
| Inventory reload buttons (R1-13) | `trade_page.js` → `reload_trade_inventory_side`, `mount_trade_inventory_reload_buttons`, error detection | idle → busy (disabled, spinner) → idle (finally); error-visible ⇄ error-hidden | DOM `.nte-inv-reload-wrap`, class `is-busy`, `btn.disabled` | |
| Values overlay and tax warning (R1-14) | `trade_page.js` → value-span writers, USD row, `set_trade_item_routility_usd`, tax warning, remove | values hidden ⇄ applied; data not ready → applied when data arrives; tax warning shown ⇄ hidden | DOM `.valueSpan`, `#valueWarningRow`, `#valueWarning`, `.nte-routility-usd-row` | Fixed: unchanged text skipped; warning updated in place. Known gap: USD row rebuilt each pass (R1-14b) |
| One-shot style injectors (R1-15) | `trade_page.js` → `ensure_projected_flag_tip_styles`, `ensure_header_roli_style`, `inject_trade_inventory_reload_styles`, serial-blur style | not injected → injected | DOM element id or flag `nte_serial_blur_style_injected` | |
| Offer membership for search results (R1-16) | `trade_page.js` → `side_offer_instance_ids`, reconcile, selectable indices, `finish_search_add_success` | derived from DOM offer keys on each read | DOM (derived; no stored state) | |
| Blur serials toggle (SERIAL-BLUR) | `trade_page.js` → blur click handler, toggle, tag and ensure functions; `nte-serial-masked`, `nte-trade-serial` | unblurred ⇄ blurred; host missing → present; ensure re-blurs or clears stale marker | DOM `data-nte-serial-blurred`, `.nte-serial-hide-host` | Known gap: skipped per lead; no reason recorded |
| Copy-proof run lock (QUICK-PROOF) | `trade_page.js` → `run_nte_quick_proof`, `ensure_nte_quick_proof_button`, capture, timeout helper | idle → preparing → capturing → previewing \| text-fallback → done; finally → idle | DOM `btn.disabled`, class `is-copying` | Fixed: timeout cancels the capture; one run at a time |
| Paced row fetch queue (ROW-FETCH-QUEUE) | `trade_page.js` → `process_row_fetch_q`, `queue_row_fetch`; `row_active_requests`, `row_fetch_generation`, `row_fetch_q`, `row_fetch_fast_q` | slot free ⇄ busy; queue empty ⇄ non-empty; generation current ⇄ stale; each slot released once | memory | Fixed: soft mode keeps slot count; parallel limit holds |
| Roblox-owned detail markers (ROW-DETAIL-INFLIGHT) | `trade_page.js` → `mark_roblox_owned_detail`, `is_roblox_owned_detail`, `is_page_detail_inflight`, network listeners; `roblox_owned_detail_until`, `page_detail_inflight` | none → inflight (until result or 5 s) → roblox-owned (1.2 s) → none | memory | |
| List processing pass (LIST-PASS) | `trade_page.js` → `L()`, `L_inner`, `schedule_trade_list_filter_backfill`, `schedule_missing_value_summaries_retry`, `count_visible_rows_missing_value_summaries`, row-script loader `Y()`; `L_running`, `L_queued`, `L_values_shown` | idle → running → queued-rerun → soft-paused → queued; backfill timer → `L()` | memory | Fixed: row retries bounded; failed loader releases the lock |
| Row ID assignment (ROW-ID-ASSIGN) | `trade_page.js` → `ensure_trade_row_ids_from_api`, `apply_trade_list_ids_to_rows`; `ensure_trade_row_ids_inflight`, `trade_list_id_cache` | idle → in-flight (+ extra pages or urgent) → idle; provisional stamp → resolved | memory | |
| Row prewarm (ROW-PREWARM) | `trade_page.js` → `schedule_trade_row_view_prewarm`, `run_trade_row_view_prewarm`, `prime_trade_row_id`; `trade_row_view_prewarm_timer`, `trade_row_view_prewarm_running` | idle → scheduled (80 ms) → running → scheduled again while a top row has no id | memory | Fixed: retry chain capped at 10 per trigger |
| List filter state (FILTER-STATE) | `trade_page.js` → `apply_trade_list_filter`, `apply_trade_list_search_fast`, `sync_trade_focus_button`, `should_show_trade_row`, `sync_trade_list_filter_ui_state` | all → filtered → item-search; rejected (inactive only); focus on ⇄ off | memory | Fixed: focus mode can always be turned off |
| List filter menu (FILTER-MENU) | `trade_page.js` → open, close, toggle, bind, outside-click handler | closed ⇄ open | DOM `aria-expanded` on `#nteTradeListFilterButton`; inline display on `#nteTradeListFilterMenu` | |
| Sort in settings sheet (SORT-SHEET) | `trade_page.js` → `ensure_trade_sort_in_settings_sheet`, `sync_trade_sheet_sort_state`; `window.__nteTradeSheetWatch` | sheet absent → present (host) → host missing → re-inject | DOM `sheet.dataset.nteSortObs`; memory global | |
| Pointer trap (POINTER-TRAP) | `trade_page.js` → unlock, dismiss and watchdog functions; `window.__nteTradePointerTrapWatch` | trap set (pointer-events none or scroll-locked) → unlock unless select or dialog open; 500 ms tick | memory global | |
| Category soft mode (CATEGORY-SOFT-MODE) | `trade_page.js` → `begin_trade_category_soft_mode`, finish, settle watch; `trade_row_mut_observer_paused_until`, `trade_category_soft_until` | normal → soft (hold 700 to 1200 ms) → soft and settling → finished | memory | |
| Trade row lock (ROW-LOCK) | `trade_page.js` → lock toggle, button update, ensure, mount, storage listener | unloaded → loaded → toggle-busy (per button) | storage (locked trade id set) | Known gap: silent no-op on unresolved id (UNCLEAR) |
| Row quick decline (ROW-DECLINE) | `trade_page.js` → `request_trade_row_decline`, sync, state setter, click handler; `trade_row_decline_inflight` (Map) | idle → pending → success (row hidden) \| error (reset after 1.8 s) → idle; locked (disabled) | memory | |
| Row control parking (ROW-CONTROL-PARK) | `trade_page.js` → park, remember, restore, reattach, deferred queue; `trade_row_id_by_fp` | attached → parked → reattach-pending → soft-deferred | memory (Maps and Set) | |
| Partner value chip (PARTNER-VALUE) | `trade_page.js` → partner value fetch, format, mount, sync; `trade_row_partner_value_cache`, `trade_row_partner_value_inflight` | unknown → loading → ok (15 min TTL) \| miss (20 s TTL) \| terminated, private or empty | memory | |
| Background prefetch (BG-PREFETCH) | `trade_page.js` → `prefetch_uncached_trades`, `start_background_trade_fetch`, cancel; `prefetch_running`, `prefetch_list_signature` | idle → prefetching → bg-running (token) → bg-aborted (token bumped); tab change breaks | memory | |
| Custom trade bridge loader (CUSTOM-BRIDGE) | `trade_page.js` → `ensure_custom_trade_bridge`, run and dispatch; `custom_trade_bridge_promise`, `window.__nru_trade_bridge_loaded` | not loaded → loading → ready \| failed (no ready within 2.6 s) | memory; DOM `#nruTradeBridgeScript` | Fixed: failed load removes the script tag. Known gap: timeout path not retried |
| Sales hover panel (SALES-HOVER-PANEL) | `trade_page.js` → panel ensure, schedule hide, hide, position, fetch and cache; `nte_trade_sales_hover_panel` | hidden → loading → shown-data \| shown-failed → hidden | memory; DOM panel | Fixed: failed sales fetch no longer cached for 5 min |
| Header refresh button (HEADER-REFRESH) | `trade_page.js` → `mount_trade_header_refresh_button`, `refresh_trade_list_via_active_tab` | idle → busy (450 ms minimum) → idle | DOM `#nteTradeHeaderRefreshBtn`, class `is-busy` | |
| Tab chip relabel (CHIP-RELABEL) | `trade_page.js` → chip relabel observer | observed ⇄ unobserved | memory (observer) | |
| Sales and RAP hover request (SALES-HOVER) | `trade_page.js` → show and render functions; `nte_trade_sales_hover_request_token`, `nte_trade_sales_hover_active_el`, `nte_trade_sales_hover_hide_timer` | closed → loading → loaded (data) \| load_failed \| empty (signal no longer qualifies) | memory | |
| Thumb overlay host sizing (OVERLAY-HOST) | `trade_page.js` → `sync_trade_card_overlay_host`, `ensure_trade_card_overlay_host`; DOM expandos `__nte_overlay_sized`, `__nte_overlay_rect` | unsized → sized-visible → sized-but-stale (sticky) | DOM expandos | |
| Offer slot fill (SLOT-FILL) | `trade_page.js` → `is_trade_request_slot_filled`, `is_trade_request_offer_card` | filled ⇄ blank (derived) | none (derived from DOM) | |
| Sales and RAP buttons per card (SALES-BTN-MOUNT) | `trade_page.js` → remove, ensure and sync functions for sales and RAP buttons; `card.__nte_sales_item`, `btn.__nte_rap_signal_ctx` | no-btn → sales-btn → sales+rap-btn → removed | DOM class `nte-has-rap-signal`; expandos | Fixed: RAP class add skips when already set |
| Fight and back-off dominance (DOMINANCE) | `trade_page.js` → `mark_trade_dominant`, `clear_trade_dominant`, `has_trade_interference`, `ensure_trade_modal_watch`; `back_off_thumb_ui` | calm → fight (modal not open and interference) \| backoff (modal open) | memory; DOM CSS block | |
| Trade UI refresh loop (TRADE-UI-REFRESH) | `trade_page.js` → `trade_ui_missing_chrome`, `run_trade_ui_refresh_now`, `schedule_trade_ui_refresh`, `N` | idle → scheduled → running (muted) → running + pending → soft-muted | memory | Known gap: muted observers and direct `N()` calls kept (skipped) |
| Boot, 1 Hz chrome check and list observers (LIST-INIT) | `trade_page.js` → boot IIFE, 1 Hz interval, container wait, list observers; `c.refreshData(N)` | boot (waiting for `.trades-container`) → bound (observers live) \| abandoned; 1 Hz loop runs in parallel | memory | Fixed: 1 Hz loop capped; writers skip unchanged DOM; container poll resumes |
| Selected-row overlay reset (ROW-SELECTION) | `trade_page.js` → `reset_trade_detail_overlays`, `on_trade_row_selected`; `last_selected_trade_overlay_key` | no-selection → selected (key) → selected (new key); gated-out during soft or paused | memory | Known gap: work dropped during soft or paused is not replayed (UNCLEAR) |
| Tab and URL poll (TAB-SWITCH) | `trade_page.js` → `check_tab_switch`, popstate and visibility handlers | stable → switching (soft mode) \| counter or send (no soft mode); hidden ⇄ visible | memory | |
| Offer Robux autofill (AD-ROBUX) | `trade_page.js` → apply step and boot call | pending (attempts 0 to 30) → done \| gave-up | memory (attempt count) | |
| Background port keep-alive (KEEPALIVE) | `trade_page.js` → `start_keepalive`, `stop_keepalive` | connected → reconnecting (on post failure) → stopped (extension gone) | memory | |
| Daily trade limit counter (DAILY-LIMIT) | `trade_page.js` → record, load, paginate, fetch, snapshot persist, sync UI, `schedule_trade_daily_limit_retry`; `trade_daily_limit` retry vars | not-loaded ("-/100") → loaded-fresh (45 s TTL) \| loaded-partial (15 s back-off) \| failed (15 s back-off) → inflight | storage (snapshot); memory |Fixed: a failed or partial load retries itself, up to four times Before the first good load, a failed fetch says so in the tooltip instead of "Loading…" forever (2026-11-11). |
| Duplicate-recipient warning (DUP-WARNING) | `trade_page.js` → `get_duplicate_trade_warning_recent_by_user`, `duplicate_trade_warning_retry_at`, modal detection, update, send-click handler | no-modal → modal-no-warning → warning-shown (createdAt) \| fetching | memory | Fixed: failed fetch backs off 15 s; failures never cached |
| Send-button review lock (MISS-SEND) | `trade_page.js` → `sync_miss_send_warning_send_button`, block, lock, unlock, update | unlocked → locked-pending → locked-awaiting-review → reviewed (unlocked) \| unreadable (unlocked) | DOM (panel and checkbox); memory | Known gap: send-button replacement not handled (skipped; touches send path) |
| Ownership check (OWNERSHIP) | `trade_page.js` → `run_ownership_check`, `fetch_asset_owned_items`, `fetch_user_collectible_ids`, prewarm; `ownership_pending`, back-off cache | idle → scheduled → fetching → checked (key) → failed-once (retry 15 s) → failed-final → shown → backed-off (per user, 60 s) | memory | Fixed: retries at 15, 30 and 60 s; 429 backs off; 20 s timeouts |
| Item history panel (HISTORY) | `trade_page.js` → history render helpers, `fetch_history_owner_asset_map`; owner-asset cache | idle → loading → active (panel open) \| error; panel toggle by token | memory | Fixed: owner-asset cache reused only on a full hit |
| History container placement (HISTORY-CONTAINER) | `trade_page.js` → `ensure_trade_history_container`, reference button and create helpers | real-actions-row \| synthetic-after-last-offer \| none (derived each pass) | DOM (derived) | |
| Analyze row under send button (ANALYZE-SEND-ROW) | `trade_page.js` → `inject_trade_request_analyze_button`, spacing | absent → placed → placed-without-button (creates it) | DOM | |
| Counter-choice prompt (COUNTER-PROMPT) | `trade_page.js` → show, close, navigate-clear, counter-send create and sync, doc click gate | prompt-mode (default) → buttons-mode \| disabled; modal open shows prompt; bypass-once flag | DOM button flags; memory | |

### Trade helpers

Bootstrap, analyze, and page scripts that run on trade pages (`content/trade_request_bootstrap.js`, `content/analyze_trade.js`, `scripts/*`).

| Machine | Where | States | Lives in | Notes |
|---|---|---|---|---|
| Trade detail cache and page patch (M1) | `content/trade_request_bootstrap.js` → `get_live_trade_detail`, patch injection; `trade_detail_cache`, `trade_detail_pending`, `patch_tries`, `patch_retry`, `raw_first_seen` | bridge uninit → loaded; patch not-injected → injecting → injected (marker "1") \| gave-up (after 8 tries); fast-trade flag unknown → on \| off | memory; DOM attribute for fast-trade flag (absent means on) and patch marker | Fixed: detail cache TTL counts from first sighting |
| Analyze Trade button and result (M2) | `content/analyze_trade.js` → button state, close, run; `request_token`, `escape_handler`, `style_injected` | idle → loading (token N) → active (result or error) → closed | memory; per-button expandos | Fixed: 30 s timeout shows the existing error message |
| Analyze modal chrome (M3) | `content/analyze_trade.js` → `remove_modal`, `get_panel`, Escape and Tab trap, `attach_close` | closed ⇄ open (modal, class and listener installed) | DOM class; memory (listeners) | |
| Trade-list XHR hold (M4) | `scripts/trade_list_request_patch.js` → open and send wrappers, `respond_with_cached_xhr`, `send_real`; `xhr.__nru_request_seq`, `xhr.__nru_held_seq` | idle → held (seq N) → served-from-cache \| sent-network \| cancelled-while-held \| reopened (seq mismatch) | memory (XHR expandos) | |
| Fetch wrapper and watcher (M5) | `scripts/trade_list_request_patch.js` → `install_fetch_patch`, 30 s watcher; `patched`, `current`, `fetch_watch` | unpatched → patched \| fallback-assigned; rewrap on reassign; watcher ends after 30 s | memory | |
| Trade-detail start and result events (M6) | `scripts/trade_list_request_patch.js` → event dispatch helpers (fetch and XHR start, load and loadend result) | idle → in-flight (start event) → done (result event); failed not represented | memory (events) | |
| Boot trade-list snapshot (M7) | `scripts/trade_list_request_patch.js` → `store_boot_trade_list`, dispatch | empty → holds snapshot for the last list type | DOM script node | |
| Select-by-instance request and cancel (M8) | `scripts/trade_bridge.js` → `select_trade_item_by_instance_id`, `ensure_request_active`, `run_in_scope`, `step_inventory_page`, cancel registry | idle → seeking (page) → clicking → done \| cancelled \| failed | memory (cancel Set) | Fixed: selects run one at a time; a destroyed scope rejects |
| Per-side trade-item cache (M9) | `scripts/trade_bridge.js` → `cache_visible_trade_items`, `clear_side_cache`, fallback and materialize, toggle item | empty → populated → cleared per side (on inventory reload) | memory | Fixed: toggle refuses an item whose id does not match. Known gap: stale cached item can still report success (UNCLEAR) |
| Inventory filter reload (M10) | `scripts/trade_bridge.js` → `reload_inventory`, `wait_for_react_inventory_reload` | idle → reloading (clear selection, re-click filter) → idle-after-wait → verified or assumed success | memory (Angular scope) | |
| Trade list reload (M11) | `scripts/trade_bridge.js` → `find_trade_list_scope`, `reload_trade_list`, React reloader | idle → reloading (forced flags) → loaded | memory (Angular scope) | Known gap: forced reload reports success without waiting (15 s wait reverted; caller allows 5 s) |
| Ownership badge stamping (M12) | `scripts/trade_bridge.js` → `stamp_ownership_badge`, `stamp_trade_detail_item_ids`, hit test, click binding, observer; `trade_detail_stamp_queued` | idle → queued → stamped → idle | memory | Fixed: observer watches the whole body, not one root |
| Row trade-id retry (M13) | `scripts/add_trade_id_to_row.js` → `assign_trade_id` and handler; `attempts`, `max_attempts` | pending (attempt n) → assigned \| retrying (100 ms) → gave-up (token removed) | DOM `data-nru-row-token`, `nruTradeId`, `data-nte-trade-time` | Fixed: a missing row retries within the same bound |
| Users batch lookup (M14) | `scripts/users_api_rate_guard.js` → `cache_get`, `is_known_missing`, `cache_set`, `fetch_profiles`, `resolve_users`, dedupe | unknown → cached \| known-missing (10 min) → unknown | memory | Fixed: a non-JSON success no longer marks ids missing |
| Synthetic XHR response (M15) | `scripts/users_api_rate_guard.js` → open, setRequestHeader and send wrappers; `this.__nte_users_guard` | plain → opened → sent-pending → faked \| passthrough-native | memory (XHR expandos) | Known gap: faked state never cleared (not changed) |

### Profile and inventory

`content/user_profile_page.js` on `/users/*` profile pages.

| Machine | Where | States | Lives in | Notes |
|---|---|---|---|---|
| Inventory value pill (UP-1) | `user_profile_page.js` → `show_inventory_values`, `get_cached_profile_inventory`, `get_user_inventory`, `set_label_text`; `profile_private_until`, `profile_fail_until` | idle (no pill) → loading → value shown \| Private (false) \| Unavailable (null, backs off 15 s) | memory | Fixed: partial scans never cached; Private expires after 5 min |
| Profile body observer (UP-2) | `user_profile_page.js` → `start_profile_observer`; `profile_observer`, `profile_render_timer` | observer off → on (never disconnected); debounce idle ⇄ pending | memory | |
| Inventory modal and snapshot (UP-3) | `user_profile_page.js` → `__nteShowModal`, `open_inventory_modal_click`; `window.__nteInvData` | closed → loading (spinner) → ready → closed; ready → image sub-states | memory (`window.__nteInvData` with user id) | Fixed: snapshot checked against page user; spinner exits on timeout. Known gap: double-open and close-during-load not changed |
| Inventory image export (UP-4) | `user_profile_page.js` → `inv_image_prompt`, `inv_image_preview_toast`, `inv_image_close_toast`, `inv_image_error_toast`; `inv_image_asset_cache` | idle → prompt open → rendering ("Rendering...", disabled) → preview toast \| error toast; button back after 350 ms | memory | |
| Mobile Trade Items button (UP-5) | `user_profile_page.js` → `add_mobile_trade_button`; `mobile_trade_check_cache`, `mobile_trade_click_bound`, `mobile_trade_inject` | not-checked → checking → can-trade (inject) \| false (no-op) \| failed (retry next call); injected ⇄ not injected | memory; DOM `#profile-trade-items` | |
| RoliBadges section (UP-6) | `user_profile_page.js` → `show_roli_badges`, `BADGE_KEYS` | absent → waiting for `#roblox-badges-container` (up to 20 s) → inserted; option off → removed | DOM | |
| Page init and refresh chain (UP-7) | `user_profile_page.js` → `init`, `utils.refreshData(init)`, runtime message listener | loading-data (retry every 5 s) → data-ready (callback every 60 s); page type recomputed per init | memory | Known gap: no route-change hook (left; file has no route mechanism) |
| Inventory item links and fetching lock (UP-8) | `user_profile_page.js` → `show_catalog_values`, `add_catalog_item_links`; `type_cache`, `fetching` | idle → fetching (lock) → resolved; per item unknown → typed \| failed; CSRF retry branch | memory | Fixed: lock clears on throw; one CSRF retry; 20 s timeout |
| Profile Rolimons link (UP-9) | `user_profile_page.js` → `remove_existing_link`, `remove_stale_profile_links`, `style_profile_link`, `add_profile_link` | present ⇄ absent (keyed by user id) | DOM | |
| Inventory serial tooltip (UP-10) | `user_profile_page.js` → `inv_serials_tip_el`, `inv_serials_tip_listening`, show, hide, bind | hidden → shown (mouseenter) → hidden (leave, render, scroll, resize, modal close) | memory; DOM tooltip | |

### Catalog and bundles

`content/catalog_page.js` (minified bundle), `content/catalog_item_intel.js`, `content/catalog_reseller_trade.js`.

| Machine | Where | States | Lives in | Notes |
|---|---|---|---|---|
| Throttled value pass (CP-1) | `catalog_page.js` → `u()` throttle (100 ms); `d` timestamp | idle → running (100 ms window) → idle; a call inside the window is dropped | memory; timer `nte_u_t` | Fixed: a throttled call schedules one trailing run |
| Unknown-type CSRF lock (CP-2) | `catalog_page.js` → `d()` lock `c`, CSRF retry | idle → in-flight → idle; 403 → one retry; other failure → failed | memory | Fixed: lock clears on every path; one CSRF retry. Known gap: non-200 failures mark ids failed for the page |
| Rolimons data poll (CP-3) | `catalog_page.js` → `refreshData`; cache `a`, flag `ok` | no data → polling every 5 s → data → polling every 60 s | memory | |
| Bundle value row sync (CP-4) | `catalog_page.js` → `sync_bundle_value_row`, `schedule_sync`, observer, interval; `sync_timer`, `last_url`, `bundle_detail_cache` | no row → row shown \| removed (not a bundle, or value 0) | memory; DOM | Fixed: a sync that started on another page is dropped |
| Icon patch (CP-5) | `catalog_page.js` → `patch_catalog_value_icons`, observer | unpatched → patched (guarded) | DOM | |
| Bundle-detail backoff (CP-6) | `catalog_page.js` → `in_backoff`, `note_failure`, `get_bundle_detail`; `FAIL_BACKOFF_MS`, `FAIL_MAX` | attempts → backing-off → given up (4 failures, until reload) | memory | Known gap: gives up until reload (same as CIE-2 before its fix; not in fix list) |
| Item intel view (CIE-1) | `catalog_item_intel.js` → `toggle_view`, `load_history`, `load_proofs`, `render_root`, `reset_state`; `state.active_view` | hidden → history \| proofs, each loading, error, loaded or empty | memory | |
| Limited-asset check with backoff (CIE-2) | `catalog_item_intel.js` → `in_backoff`, `note_failure`, `is_roblox_limited`, `get_bundle_detail`; `item_check_cache`, `item_check_inflight`, `fail_at`, `fail_count` | unknown → checking → known (cached) \| backing-off → retry every 3 min after 3 failures | memory | Fixed: slow retry every 3 min instead of stopping. Known gap: failing keys share one retry timer |
| Rolimons item data promise (CIE-3) | `catalog_item_intel.js` → `get_rolimons_item_data`, `find_rolimons_bundle_id` | unloaded → loading → loaded (cached) \| empty (retry after 30 s) | memory | |
| Page sync observer (CIE-4) | `catalog_item_intel.js` → `queue_sync`, `sync_observer`, 700 ms URL poll; `sync_timer`, `last_url`, `page_observer` | not-watching ⇄ watching (observer on `documentElement`) | memory | |
| Proof image loader and lightbox (CIE-5) | `catalog_item_intel.js` → `attach_proof_buttons`, `attach_proof_open_handlers`, lightbox; `card.__nte_item_intel_images_loaded` | idle → loading (disabled) → open \| error (next click retries); open ⇄ idle | DOM `#nte-history-proof-lightbox`; memory | |
| Can-trade queue and cache (CRT-1) | `catalog_reseller_trade.js` → `fetch_can_trade`, `can_trade_with`, queue and pump; `can_trade_cache`, `can_trade_inflight`, `can_trade_queue` | unknown → queued → in-flight → cached (true or false, success only) \| failure (returns true, not cached) | memory | |
| Row flags and Trade button (CRT-2) | `catalog_reseller_trade.js` → `inject_trade_button`, `remove_trade_buttons`; row flags | idle → pending (awaiting can-trade) → injected \| yielded (Roseal button present) | DOM `data-nte-reseller-trade-pending`, `data-nte-reseller-trade-row` | Fixed: no button if the seller or instance changed while pending |
| Sync scheduler and URL change (CRT-3) | `catalog_reseller_trade.js` → `sync`, `schedule_sync`, `on_url_change`, observer, interval; `sync_timer`, `resellers_seen_at`, `last_url` | waiting for `#resellers` → deferring (400 ms) → syncing; URL change resets | memory | Fixed: a stale row schedules another sync |

### Navbar search and menu

| Machine | Where | States | Lives in | Notes |
|---|---|---|---|---|
| Friends cache for people search (NPS-1) | `content/navbar_people_search.js` → `load_friends`, `load_friends_direct`, `read_stored_friends`, `hydrate_friend_names`, `run_search` freshness; `friends_fail_until`, `friends_fail_retry_ms` | empty → loading (promise) → loaded (names) \| loaded-but-empty \| failed (retry after 30 s) | memory; reads background friends list | Fixed: empty answers cached; failures retry after 30 s. Known gap: direct path returns [] for failure and zero friends alike |
| Search token and dropdown (NPS-2) | `content/navbar_people_search.js` → `run_search`, `apply_results`, `on_input`, `reapply_if_missing`, attach and blur handlers, observer; `pending_token`, `last_results`, `injecting` | idle → searching (token) → results injected → hydrated; cleared on blur (220 ms) or short query | memory; DOM | |
| Hydration writes (NPS-3) | `content/navbar_people_search.js` → `update_li_stats`, `update_li_thumb`, presence writer | writes only (no state) | DOM | |
| Username lookup debounce (NPS-4) | `content/navbar_people_search.js` → `resolve_username`; `resolve_timer` | idle → pending timer (250 ms) → lookup → merged \| dropped (token or input changed) | memory | |
| Item data, face map and name index (NQS-1) | `content/navbar_quick_search.js` → `load_item_data`, `load_face_map`, `build_index`, `resolve_catalog_target` | unloaded → loading → loaded (data 5 min, face map 30 min) → stale (background refresh) \| failed (face map retry 60 s) | memory | |
| Quick-search token and rows (NQS-2) | `content/navbar_quick_search.js` → `clear_injected`, `inject_into`, `reapply_if_missing`, `run_search`, `on_input`, `attach` | idle → searching (token) → rows injected → cleared (blur 200 ms, short query, no results) | memory; DOM | |
| First-run popup gate (NQS-3) | `content/navbar_quick_search.js` → `open_first_roblox_popup` | never → attempted (24 h gate) → done (permanent) | storage (gate) | |
| Settings menu item (NSM-1) | `content/navbar_settings_menu.js` → `build_menu_content`, `ensure_settings_menu_item`, observer, `get_logo_url` | absent → built (with logo) → bound | DOM | Fixed: no rebuild loop when the logo URL is empty |
| Popover clone and Escape (NSM-2) | `content/navbar_settings_menu.js` → `find_popover_settings_link`, `ensure_popover_menu_item`, click handler | no clone → cloned (guarded by `:scope > .nte-settings-clone`) | DOM | |
| Popover toggle after open (NSM-3) | `content/navbar_settings_menu.js` → `close_settings_popover`, click wiring | none (one deferred close) | memory | |
| Keyboard selection in dropdown (NSK-1) | `content/navbar_search_keyboard.js` → `selected_class_for`, `on_keydown`, `on_keyup`, select and clear | none selected → one selected (custom or native) → wrap-around; Enter on a custom row navigates | DOM classes | |
| Selection class observer (NSK-2) | `content/navbar_search_keyboard.js` → `reconcile_selection`, `watch_selection_classes`, `attach`; `class_observer` | observing root ⇄ detached root (container replaced) | memory (observer) | |

### Friends

`content/friends_page.js` (the friends list value check). The background friends list cache is under Background worker (FRIENDS).

| Machine | Where | States | Lives in | Notes |
|---|---|---|---|---|
| Per-user inventory cache (FP-1) | `content/friends_page.js` → `fetch_user_inventory`; `inventory_cache`, `inventory_pending` | unknown → pending → cached array (ok) \| cached false (private, 401 or 403) | memory | Fixed: failures and partial scans are not cached |
| Value totals cache (FP-2) | `content/friends_page.js` → `get_user_totals`, values-mode storage sync; `totals_cache`, `values_to_use_cache`, `rolimons_data`, `routility_data` | uncached → computing → cached until mode change | memory; storage (values mode) | Fixed: totals cached only when prices loaded |
| Check Value button (FP-3) | `content/friends_page.js` → `set_menu_btn_loading`, `set_menu_btn_result`, `check_value_from_menu` | idle → loading (disabled) → done \| error (enabled) | DOM | Fixed: an exception re-enables the button with an error |
| Menu injection and enablement (FP-4) | `content/friends_page.js` → `inject_menu_item`, cleanup, `sync_cards`, `schedule_sync`, `refresh_enabled`, `boot`; `enabled`, `sync_timer`, `click_bound` | disabled → enabled-off-view → enabled-on-view (inject per card) | memory; DOM | |
| Rolimons and Routility data (FP-5) | `content/friends_page.js` → `ensure_rolimons_data`, `ensure_routility_data`; `rolimons_data`, `routility_data` | unloaded → loading → loaded \| null (retried on next call) | memory | |

### Rolimons pages

Player, item, and ads pages on rolimons.com, plus the page-world scripts (`scripts/*`).

| Machine | Where | States | Lives in | Notes |
|---|---|---|---|---|
| Boot and route poller (RP-1) | `content/rolimons_player_page.js` → `boot`, `last_path` poller (1 s); `ran_for_user`, `player_fix_retry_timer` | loading → booted (per route); route change → reset gates → re-boot | memory | |
| Player inventory fix (RP-2) | `content/rolimons_player_page.js` → `run_for_player`, `is_stale`, `adjust_sidebar_stat`; `player_run_token`, `player_wait_retries` | not-run → waiting-for-grid (15 s) → fetching → incomplete (retry 15 s, 30 s) \| complete → applied → done (`ran_for_user`) | memory | Fixed: route change cancels the run; a wait timeout retries once |
| Trade calculator hide and filter (RP-3) | `content/rolimons_player_page.js` → `run_trade_calculator_fix`, `run_trade_calculator_fix_once`, `watch_trade_calculator`; `trade_calc_ran_for`, `trade_calc_inflight`, `trade_calc_pending`, `trade_calc_retry_after` | idle → inflight → done (token set) \| retry-after (15 s) \| pending (rerun after finally) | memory | Fixed: lock set before first await; failed apply backs off |
| Trade calculator hold badges (RP-4) | `content/rolimons_player_page.js` → `paint_trade_calc_hold_badges`, `schedule_trade_calc_hold_paint`, `watch_trade_calc_hold_grid`; `trade_calc_hold_by_id`, `trade_calc_hold_observer` | no map → map set; idle → scheduled (80 ms) → painting → idle | memory | Fixed: painter drops its own mutation records; no repaint loop |
| Page-script bridge (RP-5) | `content/rolimons_player_page.js` → `inject_trade_calc_page_script`, `ensure_trade_calc_page_script`, `ensure_trade_calc_bridge`, `call_trade_calc_page`; `TRADE_CALC_BRIDGE_ID` | not-injected → injecting → injected \| failed (tag removed); per call waiting → answered \| timed out | DOM script element | Fixed: failed script load removes its tag, so a retry reloads |
| Trade calculator USD rows (RP-6) | `content/rolimons_player_page.js` → `paint_trade_calculator_usd`, debounce, observer; `tc_usd_applied`, `tc_usd_last_key`, `tc_usd_timer` | off → on-empty (no trade) → on-with-trade; key-gated repaint | memory; DOM rows | Fixed: only the newest async paint can write |
| Trade ads USD labels (RP-7) | `content/rolimons_player_page.js` → `ad_side_items`, `ensure_ad_side_usd`, `paint_ad_side_usd`, `paint_trade_ads_usd`, `watch_trade_ads_usd`, `boot_trade_ads_usd` | off → painted; observer on or off | memory; DOM | Fixed: a failed boot retries once after 5 s |
| Serial tooltip (RP-8) | `content/rolimons_player_page.js` → `show_serials_tip`, `hide_serials_tip`, `bind_serials_tip`, `paint_player_serial_tips` | hidden → shown (mouseenter) → hidden (leave, scroll, resize, clear) | memory; DOM | |
| Action-row button poll (RIP-1) | `content/rolimons_item_page.js` → `find_action_host`, `inject_history_button`, `inject_button`, boot poll | waiting (250 ms, max 40 tries) → injected → done \| gave-up after 40 | memory | |
| Proofs modal (RIP-2) | `content/rolimons_item_page.js` → `ensure_modal`, `open_modal_shell`, `close_modal`, `open_proofs`, `on_key_down`, `render_slide` | closed → open-loading → open-loaded → closed; open flag, class, scroll lock and listener move together | memory; DOM class | |
| Player Recent Trades menu (RIP-3) | `content/rolimons_item_page.js` → `open_player_slide`, `toggle_player_menu`, `close_player_menu`, `inject_player_button` | closed → loading → listed \| error \| empty; outside click closes | DOM | |
| Player-page button poll (RIP-4) | `content/rolimons_item_page.js` → `boot_player`, `inject_player_button` | waiting (250 ms, max 40 tries) → injected → done \| gave-up after 40 | memory | |
| Ad-tier badge fetch (RTA-1) | `content/rolimons_trade_ads_extras.js` → `load_missing`, `schedule`; `failures` | active → backing-off (3 s, 6 s, 12 s) → slow retry every 3 min | memory | Fixed: no permanent give-up; slow retry every 3 min. Known gap: retries every 3 min while open |
| Sales panel (RTA-2) | `content/rolimons_trade_ads_extras.js` → `open_sales_panel`, `close_panel`, `ensure_sales_sources`, `refresh_face_map`; sequence token | closed → loading (token N) → shown \| abandoned (token bumped) | memory | |
| Boot gate and option (RTA-3) | `content/rolimons_trade_ads_extras.js` → `is_enabled`, `boot` | enabled → initialised \| disabled (return) | storage (option) | |
| Page-world trade bridge (SCP-1) | `scripts/rolimons_trade_calc_inventory_patch.js` → `ensure_bridge`, `write_response`, `handle_command`, command observer; sender in `rolimons_player_page.js` → `call_trade_calc_page` | idle → command received → handled → idle; repeated stamp ignored | DOM bridge element (`data-nte-cmd`) | Fixed: command stamps are unique; none dropped as repeats. Known gap: two calls in one tick overwrite the text |
| Init pollers (SCP-2) | `scripts/rolimons_trade_calc_inventory_patch.js` → `wrap_timer` (250 ms, 80 tries), stamp interval (400 ms) | waiting → wrapped \| gave up after 80 tries; stamp interval runs forever | memory (`__nte_wrapped`, `__nte_usd_stamp`, `__nte_unlim` flags) | Known gap: stamp interval never stops (not changed) |
| Trade-side detection (SCP-3) | `scripts/rolimons_trade_calc_inventory_patch.js` → `sums_match`, `item_rap_value`, `collect_item_lists`, `read_trade_object_sides`, `read_trade_sides` | none (decided on each read) | memory | |
| Owned-ids apply (SCP-4) | `scripts/rolimons_trade_calc_inventory_patch.js` → `apply_owned_ids`, `expand_face_asset_keys`, `sync_source_select` | scan result → applied (replace or merge) → redraw | memory (Rolimons `playerAssets`) | |
| Mode from status text (SCP-5) | `scripts/rolimons_trade_calc_inventory_patch.js` → `status_text`, `inventory_mode_from_status`, `sync_source_select` | mine \| other \| unknown (from status text and select value) | DOM | |
| Unused duplicate patch (SCF-1) | `scripts/rolimons_trade_calc_inventory_fix.js` | none (not loaded) | n/a | Known gap: unused file, not deleted |
| Offer-Robux filter (SAP-1) | `scripts/rolimons_trade_ads_patch.js` → guard, wrapper, `rerun`, modal, button, chips, sync; `window.__nte_robux_filter` | off ⇄ on; each change calls `rerun()` | memory (window flag) | |

### 2FA autofill

`content/roblox_totp_autofill.js`. The popup side of 2FA is under Popup (M02), and the mass-send side under Background jobs.

| Machine | Where | States | Lives in | Notes |
|---|---|---|---|---|
| Unlock dialog and decrypt promise (TOTP-1) | `roblox_totp_autofill.js` → `run_unlock`, `cancel_pending_unlock`, storage listener; `decrypt_promise`, `unlock_declined_at` | idle → prompting → unlocked \| cancelled (cooldown) \| withdrawn (dialog removed) | memory | Fixed: removing the dialog settles the pending unlock |
| Fill in-flight lock (TOTP-2) | `roblox_totp_autofill.js` → `try_fill` lock | idle → in-flight → idle | memory | |
| Session secret (TOTP-3) | `roblox_totp_autofill.js` → `session_secret` read, set and clear in `try_fill` | none → set (after unlock) → cleared after each encrypted fill | memory | |
| Storage mode choice (TOTP-4) | `roblox_totp_autofill.js` → `is_encrypted_storage`, `try_fill`; storage keys named by `STORAGE_MODE`, `STORAGE_ENC`, `STORAGE_SECRET` | disabled; plaintext; encrypted (blob valid); encrypted-but-blob-broken | storage (mode, encrypted blob, plaintext secret) | Known gap: broken blob with a leftover plaintext secret types a code without prompt (left on purpose) |
| Input discovery (TOTP-5) | `roblox_totp_autofill.js` → `find_totp_input`, `watch_shadow_roots`, `hook_shadow_roots`, `run_scan`, `schedule_scan` | no input → input cached → input disconnected (cache cleared on next scan) | memory | |
| Cooldown after cancel (TOTP-6) | `roblox_totp_autofill.js` → `unlock_suppressed`, `unlock_declined_at` | normal → cooling-down (120 s) → normal (time passes or input disappears) | memory | |

### Themes

| Machine | Where | States | Lives in | Notes |
|---|---|---|---|---|
| Trade and Rolimons theme apply (TTP-1) | `content/trade_page_themes.js` → `refresh`, `remove_theme`, `apply_theme`, storage listener, path poll; `site`, `enabled_key`, `theme_key`, `last_path` | off (no class, no style) ⇄ on (class and style for current theme); not-theme-page (forced off by path) | storage (enabled and theme keys); DOM class and style | |
| Theme upload modal (TTP-2) | `content/trade_page_themes.js` → `open_upload_modal`, `save_pending_upload`, `set_storage`, file change; `pending_upload` | closed → picking → reading → naming → saving → closed (450 ms) | memory; storage on save | Fixed: a failed save shows an error and does not apply the theme |

### Shared helpers

| Machine | Where | States | Lives in | Notes |
|---|---|---|---|---|
| Tap tooltip open state (M17, tap tooltip) | `shared/tap_tooltip.js` → `open_host_selector`, `close_all_tap_tooltips`, document and host listeners | per host: closed ⇄ open; outside click or Escape → closed | memory; DOM `aria-expanded`, `aria-hidden` on hosts | Fixed: close selector matches every host type |
| Username lookup cache (M16, shared) | `shared/username_lookup_guard.js` → `read_cache`, `write_cache`, `guarded_lookup`, fetch wrapper | unknown → pending → cached-hit (6 h) \| cached-miss (5 min) \| passthrough (not cached on non-OK) | memory | Fixed: parse failure is not cached |
| Trade-ad match pipeline (M24, popup) | `shared/trade_ad_notifications_core.js` → `build_match`, `scan`, `stored_match_to_ad`, `rescore_stored_matches`, `sort_matches` | pure functions; stored matches are a cache of owned ids and item data | storage (alert matches) | Fixed: rescore keeps stored alerts until data loads. Known gap: an empty owned set counts as not loaded |
| Init-tooltips event (IT-1) | `scripts/init_tooltips.js` → listeners for the `nte_init_tooltips` event | event-driven (no state) | DOM style element | |

## Known gaps

Each line gives where, what can happen, and why it was left.

- `content/trade_page.js`, TRADE-UI-REFRESH (R3): muted observers and direct `N()` calls are kept. Can keep the trade page re-rendering. Left because changing them risks feedback loops.
- `content/trade_page.js`, MISS-SEND (R3): send-button replacement is not handled by the review lock. Left: skipped, the fix touches the send path.
- `content/trade_page.js`, SERIAL-BLUR (R2): not changed. Left: skipped per lead; no reason recorded.
- `content/trade_page.js`, ROW-LOCK (R2): lock on an unresolved id is a silent no-op. Left: no visible status element; needs new UI.
- `content/trade_page.js`, ROW-SELECTION (R3): selection dropped during soft or paused states is not replayed. Left: needs a new replay hook.
- `content/trade_page.js`, R1-14b: USD row rebuilt every pass when Routility USD values are on. Left: UNCLEAR; a safe skip needs a browser check.
- `content/trade_page.js`, R1-01 values-to-use split: not changed. Left: cross-tab shared storage and settings semantics.
- `content/trade_page.js`, CUSTOM-BRIDGE (R2): timeout path is not re-injected. Left: the tag may be live, and re-injecting could double-install the bridge.
- `background/background.js`, NOTIF-1: a notification is reserved before delivery, so a failed delivery is not retried. Left: documented only.
- `background/background.js`, INB-2: webhook and reservation run before the cursor is saved, so a restart between them can resend. Left: documented only.
- `background/background.js`, TCACHE-1: `cachedTrades` writers can lose updates. Left: documented only.
- `background/background.js`, ITEM-1: null item data is used by notifications and inbound stats. Left: only the trade-auto decline path was fixed (TA-5).
- `background/background.js`, TA-2: long jobs have no keep-alive to reuse; the port keep-alive only holds timers, and mass send has none either. A worker stop ends the job. Left: no existing mechanism to reuse.
- `background/background.js`, TA-1 residual: `ta_fetch`, `ta_decline_trade` and `do_decline` read the global `ta_abort`. A Stop then Start during one in-flight request can send one more decline for the old trade. Left: the window is one request; passing the run through was not done.
- `background/background.js`, MSG-1 remaining: `fetch_rolimons_html`, ad tiers, logout CSRF, the ciiid lookup and trade-history thumbnails have no timeout. The ciiid lookup can hang `getTradeHistory`. Left: outside the handler-awaited set in the fix list.
- `background/background.js`, FRIENDS: partial name hydration still replies ok; only an empty list after a hydration failure is refused. Left: the caller cannot tell a partial list.
- `background/background.js`, timeout text: other `TimeoutError` sites (player proofs, item proofs, trade history) still show raw timeout text. Left: not in the review list.
- `background/background.js`, `ta_start`: always replies ok, so a rejected start shows as lost contact in the popup. Left: not changed.
- `background/trade_ad_notifications.js`, TAN-ENABLE: enable, threshold and settings replies wait for backfill, so the popup shows the pre-backfill status until refresh. Left: needs a popup change.
- `background/trade_ad_notifications.js`, TAN-STATE-WRITES: a disable can still land between a save's load and its write. Left: no lock; the window is one storage round trip.
- `background/trade_ads.js`, TA-VERIFY: `trade_ads_auto_verify` has no dedupe, so two clicks run two verifies. Left: LOW; the popup and background can both trigger it.
- `popup/popup.js`, M22 (alerts panel): toggle and settings writes do not bump the refresh run. A stale render is corrected at the next storage change. Left: partial fix.
- `content/user_profile_page.js`, UP-7: no route-change hook. Left: the file has no route mechanism, and none was added.
- `content/user_profile_page.js`, UP-3: double-open and close-during-load are not changed. Left: not in the review list.
- `content/roblox_totp_autofill.js`, TOTP-4: a broken encrypted blob with a leftover plaintext secret types a code with no prompt. Left on purpose: failing closed would break autofill; plaintext exists only after a partial write.
- `content/catalog_page.js`, CP-2 (observed): a non-200, non-403 reply marks every unknown id as failed for the page. Left: pattern D decision for the lead.
- `content/catalog_page.js`, CP-6: bundle detail gives up until reload after four failures. Left: not in the fix list; same pattern as CIE-2 before its fix.
- `content/catalog_item_intel.js`, CIE-2: failing keys share one three-minute retry timer. Left: a per-key timer was judged too large.
- `content/rolimons_trade_ads_extras.js`, RTA-1: a failing batch retries every three minutes while the page is open. Left: a cap or backoff decision is pending.
- `scripts/trade_bridge.js`, M9: a cached item for an instance that left the inventory can still match and report success. Left: UNCLEAR; needs a manual check on a trade.
- `scripts/trade_bridge.js`, M11: forced trade-list reload reports success without waiting. Left: the 15 s wait was reverted because the caller allows only 5 s; a failed forced reload can report success.
- `scripts/rolimons_trade_calc_inventory_patch.js`, SCP-1: two bridge commands in one tick overwrite the shared text before the page script reads it. Left: a separate issue, not changed.
- `scripts/rolimons_trade_calc_inventory_fix.js`, SCF-1: unused, not loaded, not deleted. Left: cleanup was not requested.
- `content/navbar_people_search.js`, NPS-1: the direct path returns an empty list for both failure and zero friends. Left: zero-friend caching works only through the background fallback.

Refuted, but worth knowing:

- `content/trade_page.js`, R1-02 (duplicate 60 s refresh chains): refuted. The refresh runs once, and the shared module registry is not loaded on trade pages.
- `content/trade_page.js`, R1-13 (reload button stuck): refuted. The bridge action always settles within about 5 s.
- `scripts/trade_list_request_patch.js`, M6 (start without end): refuted. The consumer expires a start after 5 s.
- `content/trade_page.js`, R1-06 (flag box class toggle): refuted. `classList.toggle` with a force value does not write when nothing changes.
