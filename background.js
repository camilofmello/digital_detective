(function () {
  'use strict';

  function safeFetch(url) {
    return fetch(url, { credentials: 'include' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .catch(function () { return ''; });
  }

  function getStorageArea() {
    if (chrome.storage && chrome.storage.session) return chrome.storage.session;
    return chrome.storage.local;
  }

  function getBlockedMap(cb) {
    var storage = getStorageArea();
    storage.get('dd_blocked', function (res) {
      cb((res && res.dd_blocked) ? res.dd_blocked : {});
    });
  }

  function setBlockedMap(map, cb) {
    var storage = getStorageArea();
    storage.set({ dd_blocked: map || {} }, function () {
      if (cb) cb();
    });
  }

  function hashText(str) {
    var h = 0;
    var s = String(str || '');
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function ruleIdFor(url, tabId) {
    var base = String(tabId || '') + '|' + String(url || '');
    var id = hashText(base);
    if (id === 0) id = 1;
    return id % 100000000;
  }

  function normalizeBaseUrl(url) {
    return String(url || '').split('#')[0].split('?')[0];
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {

    // ── Event Tracker Inject
    if (msg.action === 'event_tracker_inject') {
      var tabId = sender && sender.tab ? sender.tab.id : null;
      if (!tabId) {
        sendResponse({ ok: false });
        return;
      }
      try {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          world: 'MAIN',
          func: function () {
            if (window.__ddEventTrackerInjected) return;
            window.__ddEventTrackerInjected = true;

            // ── Post message to content script ──
            function post(provider, method, args, payload) {
              try {
                window.postMessage({
                  source:   'dd-event-tracker',
                  provider: provider || 'page',
                  method:   method   || 'event',
                  args:     Array.prototype.slice.call(args || []),
                  payload:  payload  || null,
                  ts:       Date.now()
                }, '*');
              } catch (e) {}
            }

            // ── Wrap all standard analytics methods on a provider object ──
            var TRACK_METHODS = ['track', 'page', 'identify', 'group', 'alias', 'screen'];

            function wrapProvider(obj, provider) {
              if (!obj || obj.__ddWrapped) return;
              TRACK_METHODS.forEach(function (m) {
                try {
                  var fn = obj[m];
                  if (typeof fn === 'function' && !fn.__ddWrapped) {
                    var wrapped = (function (mName, origFn) {
                      var w = function () {
                        post(provider, mName, arguments);
                        return origFn.apply(this, arguments);
                      };
                      w.__ddWrapped = true;
                      return w;
                    })(m, fn);
                    obj[m] = wrapped;
                  }
                } catch (e) {}
              });
              // Intercept stub-queue push (Segment classic snippet initialises analytics as array)
              try {
                var origPush = obj.push;
                if (typeof origPush === 'function' && !origPush.__ddWrapped) {
                  obj.push = function () {
                    try {
                      var item = arguments[0];
                      if (Array.isArray(item) && item.length >= 1 &&
                          TRACK_METHODS.indexOf(item[0]) !== -1) {
                        post(provider, item[0], Array.prototype.slice.call(item, 1));
                      }
                    } catch (e) {}
                    return origPush.apply(this, arguments);
                  };
                  obj.push.__ddWrapped = true;
                }
              } catch (e) {}
              obj.__ddWrapped = true;
            }

            // ── Hook a global using Object.defineProperty so replacements are caught ──
            // This covers Segment analytics-next which replaces window.analytics entirely
            function hookGlobal(globalName, provider) {
              try {
                var _val = window[globalName];
                if (_val) wrapProvider(_val, provider);

                var desc = Object.getOwnPropertyDescriptor(window, globalName);
                if (desc && !desc.configurable) {
                  // Property is non-configurable, fall back to interval
                  throw new Error('non-configurable');
                }

                Object.defineProperty(window, globalName, {
                  configurable: true,
                  enumerable:   true,
                  get: function () { return _val; },
                  set: function (newVal) {
                    _val = newVal;
                    if (newVal && !newVal.__ddWrapped) {
                      wrapProvider(newVal, provider);
                    }
                  }
                });
              } catch (e) {
                // Fallback: poll every 500 ms for up to 60 iterations (30 s)
                var tries = 0;
                var timer = setInterval(function () {
                  if (window[globalName] && !window[globalName].__ddWrapped) {
                    wrapProvider(window[globalName], provider);
                  }
                  tries++;
                  if (tries > 60) clearInterval(timer);
                }, 500);
              }
            }

            hookGlobal('analytics',      'segment');
            hookGlobal('rudderanalytics', 'rudderstack');

            // ── GTM / dataLayer interception ──
            function hookDataLayer(obj) {
              if (!obj || obj.__ddDLWrapped) return;
              var origPush = obj.push;
              if (typeof origPush !== 'function' || origPush.__ddWrapped) return;
              obj.push = function () {
                try {
                  for (var i = 0; i < arguments.length; i++) {
                    var item = arguments[i];
                    if (item && typeof item === 'object' && item.event) {
                      post('gtm', 'track', [], { event: item });
                    }
                  }
                } catch (e) {}
                return origPush.apply(this, arguments);
              };
              obj.push.__ddWrapped  = true;
              obj.__ddDLWrapped     = true;
            }

            try {
              if (window.dataLayer) hookDataLayer(window.dataLayer);
              var _dl = window.dataLayer;
              var dlDesc = Object.getOwnPropertyDescriptor(window, 'dataLayer');
              if (!dlDesc || dlDesc.configurable) {
                Object.defineProperty(window, 'dataLayer', {
                  configurable: true,
                  enumerable:   true,
                  get: function () { return _dl; },
                  set: function (newVal) { _dl = newVal; if (newVal) hookDataLayer(newVal); }
                });
              }
            } catch (e) {}

            // ── Network helpers ──
            function isTrackedEndpoint(url) {
              try {
                var u = String(url || '');
                // Segment CDN / API (covers all short and long forms)
                if (/api\.segment\.io\/v1\/|\.segment\.com\/v1\/|\.segment\.io\/v1\//.test(u)) return true;
                // Generic v1 analytics paths (long form)
                if (/\/v1\/(?:batch|track|page|identify|screen|group|alias)(?:[/?#]|$)/.test(u)) return true;
                // Short-form Segment API endpoints (/v1/b, /v1/t, /v1/p, /v1/i, /v1/g, /v1/s)
                if (/\/v1\/[btpigs](?:[/?#]|$)/.test(u)) return true;
                return false;
              } catch (e) { return false; }
            }

            function parsePayload(text) {
              if (!text) return null;
              try { return JSON.parse(text); } catch (e) { return null; }
            }

            function emitFromPayload(payload, url) {
              if (!payload) return;
              if (Array.isArray(payload.batch)) {
                payload.batch.forEach(function (item) {
                  post(payload.provider || 'network', item.type || 'batch', [], { url: url, event: item });
                });
                return;
              }
              post(payload.provider || 'network', payload.type || 'event', [], { url: url, event: payload });
            }

            // ── Fetch interception ──
            // Read body BEFORE origFetch to avoid Request-body-consumed issues
            try {
              var origFetch = window.fetch;
              if (origFetch && !origFetch.__ddWrapped) {
                var wrappedFetch = function (input, init) {
                  var url = '';
                  try { url = (typeof input === 'string') ? input : (input && input.url ? input.url : ''); } catch (e) {}
                  if (url && isTrackedEndpoint(url)) {
                    try {
                      if (init && typeof init.body === 'string') {
                        // Most common case: fetch(url, { body: JSON.stringify(...) })
                        emitFromPayload(parsePayload(init.body), url);
                      } else if (input instanceof Request) {
                        // Clone before origFetch consumes it
                        input.clone().text().then(function (text) {
                          emitFromPayload(parsePayload(text), url);
                        }).catch(function () {});
                      }
                    } catch (e) {}
                  }
                  return origFetch.apply(this, arguments);
                };
                wrappedFetch.__ddWrapped = true;
                window.fetch = wrappedFetch;
              }
            } catch (e) {}

            // ── XHR interception ──
            try {
              var origOpen = XMLHttpRequest.prototype.open;
              var origSend = XMLHttpRequest.prototype.send;
              if (!origOpen.__ddWrapped) {
                XMLHttpRequest.prototype.open = function (method, url) {
                  this.__ddUrl = url;
                  return origOpen.apply(this, arguments);
                };
                XMLHttpRequest.prototype.open.__ddWrapped = true;
              }
              if (!origSend.__ddWrapped) {
                XMLHttpRequest.prototype.send = function (body) {
                  try {
                    if (this.__ddUrl && isTrackedEndpoint(this.__ddUrl)) {
                      var text = body && typeof body === 'string' ? body : '';
                      emitFromPayload(parsePayload(text), this.__ddUrl);
                    }
                  } catch (e) {}
                  return origSend.apply(this, arguments);
                };
                XMLHttpRequest.prototype.send.__ddWrapped = true;
              }
            } catch (e) {}

            // ── Beacon interception ──
            try {
              var origBeacon = navigator.sendBeacon;
              if (origBeacon && !origBeacon.__ddWrapped) {
                var wrappedBeacon = function (url, data) {
                  try {
                    if (url && isTrackedEndpoint(url)) {
                      var text = typeof data === 'string' ? data : '';
                      if (text) emitFromPayload(parsePayload(text), url);
                    }
                  } catch (e) {}
                  return origBeacon.apply(this, arguments);
                };
                wrappedBeacon.__ddWrapped = true;
                navigator.sendBeacon = wrappedBeacon;
              }
            } catch (e) {}
          }
        }, function () {
          sendResponse({ ok: !chrome.runtime.lastError });
        });
      } catch (e) {
        sendResponse({ ok: false });
      }
      return true;
    }

    // ── Capture Tab (Screenshot)
    if (msg.action === 'capture_tab') {
      var tab = sender && sender.tab;
      var windowId = tab && tab.windowId ? tab.windowId : chrome.windows.WINDOW_ID_CURRENT;
      chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, function (dataUrl) {
        if (chrome.runtime.lastError || !dataUrl) {
          sendResponse({ ok: false, error: chrome.runtime.lastError ? chrome.runtime.lastError.message : 'capture_failed' });
          return;
        }
        sendResponse({ ok: true, dataUrl: dataUrl });
      });
      return true;
    }

    // ── Download Image
    if (msg.action === 'download_image') {
      var dataUrl = msg.dataUrl || '';
      var filename = msg.filename || 'screenshot.png';
      if (!dataUrl) { sendResponse({ ok: false }); return; }
      try {
        chrome.downloads.download({ url: dataUrl, filename: filename, saveAs: true }, function () {
          sendResponse({ ok: true });
        });
      } catch (e0) {
        sendResponse({ ok: false });
      }
      return true;
    }

    // ── Fetch Script Text
    if (msg.action === 'fetch_script_text') {
      var scriptUrl = msg.url || '';
      if (!scriptUrl) { sendResponse({ ok: false }); return; }
      safeFetch(scriptUrl).then(function (text) {
        sendResponse({ ok: true, text: text || '' });
      }).catch(function () {
        sendResponse({ ok: false });
      });
      return true;
    }

    // ── Get Blocked Scripts
    if (msg.action === 'get_blocked_scripts') {
      var tabId = msg.tabId;
      getBlockedMap(function (map) {
        var blocked = (tabId && map[String(tabId)]) ? map[String(tabId)] : {};
        sendResponse({ blocked: blocked });
      });
      return true;
    }

    // ── Block Script
    if (msg.action === 'block_script') {
      var url = msg.url || '';
      var tabId = msg.tabId;
      if (!url || !tabId) { sendResponse({ ok: false }); return; }
      var baseUrl = normalizeBaseUrl(url);
      var ruleId  = ruleIdFor(baseUrl, tabId);
      try {
        chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: [ruleId],
          addRules: [{
            id: ruleId,
            priority: 1,
            action: { type: 'block' },
            condition: { urlFilter: baseUrl, resourceTypes: ['script'], tabIds: [tabId] }
          }]
        }, function () {
          getBlockedMap(function (map) {
            var key = String(tabId);
            if (!map[key]) map[key] = {};
            map[key][baseUrl] = true;
            setBlockedMap(map, function () { sendResponse({ ok: true }); });
          });
        });
      } catch (e) {
        sendResponse({ ok: false });
      }
      return true;
    }

    // ── Unblock Script
    if (msg.action === 'unblock_script') {
      var url2   = msg.url || '';
      var tabId2 = msg.tabId;
      if (!url2 || !tabId2) { sendResponse({ ok: false }); return; }
      var baseUrl2 = normalizeBaseUrl(url2);
      var ruleId2  = ruleIdFor(baseUrl2, tabId2);
      try {
        chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId2] }, function () {
          getBlockedMap(function (map) {
            var key2 = String(tabId2);
            if (map[key2] && map[key2][baseUrl2]) {
              delete map[key2][baseUrl2];
              if (!Object.keys(map[key2]).length) delete map[key2];
            }
            setBlockedMap(map, function () { sendResponse({ ok: true }); });
          });
        });
      } catch (e3) {
        sendResponse({ ok: false });
      }
      return true;
    }

    // ── Open Report Viewer
    if (msg.action === 'open_report_viewer') {
      var html     = msg.html || '';
      var filename = msg.filename || 'report.html';
      var reportId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      var key      = 'dd_report_' + reportId;
      var payload  = {};
      payload[key] = { html: html, filename: filename };
      var storage  = (chrome.storage && chrome.storage.session) ? chrome.storage.session : chrome.storage.local;
      storage.set(payload, function () {
        var url = chrome.runtime.getURL('report_viewer.html?rid=' + reportId);
        chrome.tabs.create({ url: url }, function () { sendResponse({ ok: true }); });
      });
      return true;
    }

    // ── Download Report
    if (msg.action === 'download_report') {
      var html     = msg.html || '';
      var filename = msg.filename || 'design_system_report.html';
      try {
        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var url  = URL.createObjectURL(blob);
        chrome.downloads.download({ url: url, filename: filename, saveAs: true }, function () {
          setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
        });
      } catch (e) {}
      sendResponse({ ok: true });
      return;
    }

    // ── Download Asset
    if (msg.action === 'download_asset') {
      var assetUrl = msg.url || '';
      if (!assetUrl) { sendResponse({ ok: false }); return; }
      var assetName = msg.filename || '';
      try {
        var options = { url: assetUrl, saveAs: true };
        if (assetName) options.filename = assetName;
        chrome.downloads.download(options);
      } catch (e2) {}
      sendResponse({ ok: true });
      return;
    }

    // ── Fetch Page for Match Analysis
    if (msg.action === 'fetch_page_for_match') {
      var pageUrl = msg.url || '';
      if (!pageUrl) {
        sendResponse({ ok: false, error: 'No URL provided' });
        return;
      }
      safeFetch(pageUrl).then(function (html) {
        sendResponse({ ok: true, html: html || '', url: pageUrl });
      }).catch(function () {
        sendResponse({ ok: false, error: 'Fetch failed' });
      });
      return true;
    }

    // ── Fetch CSS URLs
    if (msg.action !== 'fetch_css_urls') return;
    var urls = Array.isArray(msg.urls) ? msg.urls : [];
    if (!urls.length) { sendResponse({ items: [] }); return; }
    Promise.all(urls.map(function (url) {
      return safeFetch(url).then(function (css) { return { url: url, css: css || '' }; });
    })).then(function (items) {
      sendResponse({ items: items });
    }).catch(function () {
      sendResponse({ items: [] });
    });
    return true;
  });
})();
