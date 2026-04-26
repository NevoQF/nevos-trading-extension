

(function () {
  function data_url_to_blob_url(data_url) {
    try {
      var comma = data_url.indexOf(",");
      if (comma < 0) return data_url;
      var meta = data_url.substring(0, comma);
      var body = data_url.substring(comma + 1);
      var is_base64 = /;base64/i.test(meta);
      var mime_match = /^data:([^;,]+)/.exec(meta);
      var mime = mime_match ? mime_match[1] : "application/octet-stream";
      var bin_str = is_base64 ? atob(body) : decodeURIComponent(body);
      var len = bin_str.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i++) bytes[i] = bin_str.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: mime }));
    } catch (e) {
      return data_url;
    }
  }

  var use_blob = /Firefox\//.test(navigator.userAgent || "");

  window.__NTE_resolveInlineIcon = function (path, data_url) {
    if (!use_blob || !data_url || data_url.indexOf("data:") !== 0) return data_url;
    if (!window.__NTE_blobIconCache) window.__NTE_blobIconCache = {};
    if (window.__NTE_blobIconCache[path]) return window.__NTE_blobIconCache[path];
    var u = data_url_to_blob_url(data_url);
    window.__NTE_blobIconCache[path] = u;
    return u;
  };
})();
