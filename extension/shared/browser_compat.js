(function () {
  if ("undefined" === typeof globalThis.chrome && "undefined" !== typeof globalThis.browser) {
    globalThis.chrome = globalThis.browser;
  }
})();
