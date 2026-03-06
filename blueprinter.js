(function () {
      var debugPanel = document.querySelector('[data-debug]');
      var debugEnabled = false;
      try {
        var params = new URLSearchParams(window.location.search);
        debugEnabled = params.get('debug') === '1' || localStorage.getItem('dd_debug') === '1';
      } catch (e) {}
      if (debugEnabled && debugPanel) {
        debugPanel.classList.add('is-active');
      }
      function log(msg) {
        if (debugEnabled) {
          console.log('[DD]', msg);
          if (debugPanel) debugPanel.textContent += msg + '\n';
        }
      }

      var state = {
        url: '',
        html: '',
        origin: '',
        baseHref: '',
        tabId: null,
        sourceUrl: '',
        edits: null,
        sanitizedHtml: '',
        pageCss: '',
        pageHtmlAttrs: '',
        pageBodyAttrs: '',
        assetMap: null,
        cssPromise: null,
        quickMode: false
      };

      try {
        var qp = new URLSearchParams(window.location.search || '');
        var tabIdParam = qp.get('tabId');
        if (tabIdParam) state.tabId = parseInt(tabIdParam, 10);
        var sourceUrlParam = qp.get('sourceUrl');
        if (sourceUrlParam) state.sourceUrl = sourceUrlParam;
        state.quickMode = qp.get('quick') === '1';
      } catch (e) {}

      var steps = {
        url:     document.querySelector('[data-step="url"]'),
        html:    document.querySelector('[data-step="html"]'),
        loading: document.querySelector('[data-step="loading"]'),
        result:  document.querySelector('[data-step="result"]')
      };
      var reportUrlEl  = document.querySelector('[data-report-url]');
      var reportTimeEl = document.querySelector('[data-report-time]');
      var reloadBtn    = document.querySelector('[data-reload]');

      function updateReportHeader(url, generatedDate) {
        var href = (url || state.url || state.sourceUrl || '').trim();
        if (reportUrlEl) {
          if (href) {
            reportUrlEl.textContent = href;
            reportUrlEl.setAttribute('href', href);
          } else {
            reportUrlEl.textContent = '—';
            reportUrlEl.setAttribute('href', '#');
          }
        }
        if (reportTimeEl) {
          var dt = generatedDate || new Date();
          reportTimeEl.textContent = 'Generated: ' + dt.toUTCString();
        }
      }

      if (reloadBtn) {
        reloadBtn.addEventListener('click', function () {
          window.location.reload();
        });
      }
      updateReportHeader(state.sourceUrl || '');

      function showStep(name) {
        Object.keys(steps).forEach(function (key) {
          steps[key].classList.toggle('is-active', key === name);
        });
        log('Step: ' + name);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        var footer = document.querySelector('[data-footer]');
        if (footer) footer.classList.toggle('is-visible', name === 'result');
      }

      function bindResultPanelCollapsers() {
        var resultStep = document.querySelector('[data-step="result"]');
        if (!resultStep) return;
        var children = Array.prototype.slice.call(resultStep.children || []);
        var panelIdx = 0;
        children.forEach(function (panel) {
          if (!panel || !panel.classList || !panel.classList.contains('panel')) return;
          if (panel.getAttribute('data-collapsible') === '1') return;

          var titleEl = null;
          Array.prototype.slice.call(panel.children || []).some(function (child) {
            if (child && child.classList && child.classList.contains('panel-title')) {
              titleEl = child;
              return true;
            }
            return false;
          });
          if (!titleEl) return;

          panel.setAttribute('data-collapsible', '1');
          var head = document.createElement('div');
          head.className = 'panel-head';
          var toggleBtn = document.createElement('button');
          toggleBtn.className = 'panel-collapse-btn';
          toggleBtn.type = 'button';
          toggleBtn.textContent = '▼';
          toggleBtn.setAttribute('aria-label', 'Collapse section');

          titleEl.parentNode.insertBefore(head, titleEl);
          head.appendChild(titleEl);
          head.appendChild(toggleBtn);

          var body = document.createElement('div');
          body.className = 'panel-body';
          while (head.nextSibling) {
            body.appendChild(head.nextSibling);
          }
          panel.appendChild(body);

          if (panelIdx > 1) {
            panel.classList.add('is-collapsed');
            toggleBtn.textContent = '▶';
          }
          panelIdx++;

          toggleBtn.addEventListener('click', function () {
            var collapsed = panel.classList.toggle('is-collapsed');
            toggleBtn.textContent = collapsed ? '▶' : '▼';
          });
        });
      }
      bindResultPanelCollapsers();

      function cleanText(text) {
        return (text || '').replace(/\s+/g, ' ').trim();
      }

      function buildPreviewDoc(html, baseHref, paddingY, extraCss, htmlAttrs, bodyAttrs) {
        var pad = (typeof paddingY === 'number') ? paddingY : 0;
        var baseTag = baseHref ? '<base href="' + baseHref + '" />' : '';
        var defaultCss = 'body{margin:0;padding:' + pad + 'px 0;}';
        var extraStyle = extraCss ? ('<style>' + extraCss + '</style>') : '';
        var htmlAttrText = htmlAttrs ? (' ' + htmlAttrs) : '';
        var hasLang = htmlAttrs && /\blang\s*=/.test(htmlAttrs);
        var langAttr = hasLang ? '' : ' lang="en"';
        var bodyAttrText = bodyAttrs ? (' ' + bodyAttrs) : '';
        return (
          '<!doctype html>' +
          '<html' + langAttr + htmlAttrText + '><head><meta charset="utf-8" />' +
          baseTag +
          '<style>' + defaultCss + '</style>' +
          extraStyle +
          '</head><body' + bodyAttrText + '>' +
          html +
          '<scr' + 'ipt>(function(){if(!window.frameElement){return;}var last=0;function post(){var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);if(h===last){return;}last=h;var id=window.frameElement.getAttribute("data-frame-id")||\"\";window.parent.postMessage({type:\"ccb-height\",id:id,height:h},\"*\");}window.addEventListener(\"load\",post);if(\"ResizeObserver\" in window){var ro=new ResizeObserver(function(){post();});ro.observe(document.body);}else{setInterval(post,500);}})();<\/scr' + 'ipt>' +
          '</body></html>'
        );
      }

      function sanitizeHtml(html) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        doc.querySelectorAll('script').forEach(function (el) { el.remove(); });
        return doc.body.innerHTML || '';
      }

      function rewriteCssUrls(cssText, baseUrl) {
        if (!cssText) return '';
        var rewritten = cssText.replace(/url\(\s*(['"]?)(?!data:)([^'")]+)\1\s*\)/gi, function (_, quote, url) {
          var cleaned = (url || '').trim();
          if (!cleaned) return 'url(' + url + ')';
          if (/^(data:|https?:|blob:|about:|#)/i.test(cleaned)) return 'url(' + cleaned + ')';
          if (cleaned.indexOf('//') === 0) return 'url(' + 'https:' + cleaned + ')';
          try { return 'url(' + new URL(cleaned, baseUrl).href + ')'; } catch (err) { return 'url(' + cleaned + ')'; }
        });
        rewritten = rewritten.replace(/@import\s+(?:url\()?['"]?([^'")\s]+)['"]?\)?\s*([^;]*);/gi, function (_, url, media) {
          var cleaned = (url || '').trim();
          if (!cleaned) return _;
          var abs = cleaned;
          if (!/^(data:|https?:|blob:|about:|#)/i.test(cleaned)) {
            if (cleaned.indexOf('//') === 0) abs = 'https:' + cleaned;
            else {
              try { abs = new URL(cleaned, baseUrl).href; } catch (err) { abs = cleaned; }
            }
          }
          var mediaText = (media || '').trim();
          return '@import url("' + abs + '")' + (mediaText ? (' ' + mediaText) : '') + ';';
        });
        return rewritten;
      }

      function escapeAttr(value) {
        return String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      function collectAttrs(el) {
        if (!el || !el.attributes) return '';
        var out = [];
        Array.from(el.attributes).forEach(function (attr) {
          var name = attr.name;
          if (name === 'class' || name === 'style' || name === 'lang' || name === 'dir' || name === 'id' || name.indexOf('data-') === 0) {
            out.push(name + '="' + escapeAttr(attr.value) + '"');
          }
        });
        return out.join(' ');
      }

      var ASSET_CACHE_NAME = 'dd-asset-cache-v1-1';
      var MAX_ASSETS = 180;

      function uniqueList(items) {
        var map = {};
        var out = [];
        items.forEach(function (item) {
          if (!item) return;
          if (map[item]) return;
          map[item] = true;
          out.push(item);
        });
        return out;
      }

      function normalizeUrl(url, base) {
        if (!url) return '';
        var cleaned = String(url).trim();
        if (!cleaned) return '';
        if (/^(data:|blob:|about:|#)/i.test(cleaned)) return cleaned;
        if (cleaned.indexOf('//') === 0) return 'https:' + cleaned;
        try { return new URL(cleaned, base).href; } catch (err) { return cleaned; }
      }

      function collectUrlsFromCss(cssText) {
        var urls = [];
        if (!cssText) return urls;
        cssText.replace(/url\(\s*(['"]?)(?!data:)([^'")]+)\1\s*\)/gi, function (_, q, u) {
          if (u) urls.push(u);
          return _;
        });
        return urls;
      }

      function collectUrlsFromHtml(html, baseUrl) {
        var urls = [];
        var parser = new DOMParser();
        var doc = parser.parseFromString(html || '', 'text/html');
        var nodes = doc.querySelectorAll('[src], [data-src], [poster], [href], [srcset]');
        nodes.forEach(function (el) {
          if (el.hasAttribute('src')) urls.push(el.getAttribute('src'));
          if (el.hasAttribute('data-src')) urls.push(el.getAttribute('data-src'));
          if (el.hasAttribute('poster')) urls.push(el.getAttribute('poster'));
          if (el.hasAttribute('href') && el.tagName.toLowerCase() === 'use') urls.push(el.getAttribute('href'));
          if (el.hasAttribute('xlink:href')) urls.push(el.getAttribute('xlink:href'));
          if (el.hasAttribute('srcset')) {
            var srcset = el.getAttribute('srcset') || '';
            srcset.split(',').forEach(function (part) {
              var piece = part.trim().split(/\s+/)[0];
              if (piece) urls.push(piece);
            });
          }
        });
        return urls.map(function (u) { return normalizeUrl(u, baseUrl); });
      }

      function rewriteSrcset(value, baseUrl, map) {
        if (!value) return value;
        return value.split(',').map(function (part) {
          var bits = part.trim().split(/\s+/);
          var rawUrl = bits[0];
          var abs = normalizeUrl(rawUrl, baseUrl);
          if (map[abs]) bits[0] = map[abs];
          return bits.join(' ');
        }).join(', ');
      }

      function replaceUrlsWithMap(text, baseUrl, map) {
        if (!text) return text;
        return text.replace(/url\(\s*(['"]?)(?!data:)([^'")]+)\1\s*\)/gi, function (_, q, u) {
          var abs = normalizeUrl(u, baseUrl);
          var next = map[abs] || abs;
          return 'url(' + next + ')';
        });
      }

      function rewriteHtmlAssets(html, baseUrl, map) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html || '', 'text/html');
        var nodes = doc.querySelectorAll('[src], [data-src], [poster], [href], [srcset], [style]');
        nodes.forEach(function (el) {
          if (el.hasAttribute('src')) {
            var abs = normalizeUrl(el.getAttribute('src'), baseUrl);
            if (map[abs]) el.setAttribute('src', map[abs]);
          }
          if (el.hasAttribute('data-src')) {
            var abs2 = normalizeUrl(el.getAttribute('data-src'), baseUrl);
            if (map[abs2]) el.setAttribute('data-src', map[abs2]);
          }
          if (el.hasAttribute('poster')) {
            var abs3 = normalizeUrl(el.getAttribute('poster'), baseUrl);
            if (map[abs3]) el.setAttribute('poster', map[abs3]);
          }
          if (el.hasAttribute('href') && el.tagName.toLowerCase() === 'use') {
            var abs4 = normalizeUrl(el.getAttribute('href'), baseUrl);
            if (map[abs4]) el.setAttribute('href', map[abs4]);
          }
          if (el.hasAttribute('xlink:href')) {
            var abs5 = normalizeUrl(el.getAttribute('xlink:href'), baseUrl);
            if (map[abs5]) el.setAttribute('xlink:href', map[abs5]);
          }
          if (el.hasAttribute('srcset')) {
            var srcset = el.getAttribute('srcset') || '';
            el.setAttribute('srcset', rewriteSrcset(srcset, baseUrl, map));
          }
          if (el.hasAttribute('style')) {
            var style = el.getAttribute('style') || '';
            el.setAttribute('style', replaceUrlsWithMap(style, baseUrl, map));
          }
        });
        return doc.body.innerHTML || '';
      }

      function cacheFetch(url) {
        if (!url || /^(data:|blob:|about:|#)/i.test(url)) return Promise.resolve(null);
        if (!('caches' in window)) {
          return fetch(url, { credentials: 'include' }).then(function (res) { return res.ok ? res : null; }).catch(function () { return null; });
        }
        return caches.open(ASSET_CACHE_NAME).then(function (cache) {
          return cache.match(url).then(function (cached) {
            if (cached) return cached;
            return fetch(url, { credentials: 'include' }).then(function (res) {
              if (!res.ok) return null;
              try { cache.put(url, res.clone()); } catch (e) {}
              return res;
            }).catch(function () { return null; });
          });
        }).catch(function () {
          return fetch(url, { credentials: 'include' }).then(function (res) { return res.ok ? res : null; }).catch(function () { return null; });
        });
      }

      function fetchAssetBlobs(urls, onProgress) {
        var list = uniqueList(urls).filter(function (u) { return u && !/^(data:|blob:|about:|#)/i.test(u); });
        if (list.length > MAX_ASSETS) list = list.slice(0, MAX_ASSETS);
        var map = {};
        var promises = list.map(function (url, idx) {
          return cacheFetch(url).then(function (res) {
            if (!res) return null;
            return res.blob().then(function (blob) {
              var blobUrl = URL.createObjectURL(blob);
              map[url] = blobUrl;
              if (onProgress) onProgress(idx + 1, list.length);
              return null;
            });
          });
        });
        return Promise.all(promises).then(function () { return map; });
      }

      function revokeAssetBlobs(map) {
        if (!map) return;
        Object.keys(map).forEach(function (key) {
          var val = map[key];
          if (val && val.indexOf('blob:') === 0) {
            try { URL.revokeObjectURL(val); } catch (e) {}
          }
        });
      }
      function inlineCssImports(cssText, baseUrl, depth) {
        var importRegex = /@import\s+(?:url\()?['"]?([^'")]+)['"]?\)?[^;]*;/gi;
        var imports = [];
        var match;
        while ((match = importRegex.exec(cssText)) !== null) {
          imports.push({ raw: match[0], href: match[1] });
        }
        if (!imports.length) return Promise.resolve(cssText);
        var chain = Promise.resolve(cssText);
        imports.forEach(function (item) {
          chain = chain.then(function (current) {
            var abs = toAbsolute(item.href, baseUrl);
            return fetchCssWithImports(abs, depth + 1).then(function (imported) {
              var block = '\n/* @import ' + abs + ' */\n' + imported + '\n';
              return current.replace(item.raw, block);
            }).catch(function () {
              return current.replace(item.raw, '\n/* @import ' + abs + ' (failed) */\n');
            });
          });
        });
        return chain;
      }

      function fetchCssWithImports(url, depth) {
        if (!url) return Promise.resolve('');
        if (depth > 2) return Promise.resolve('');
        return fetch(url, { credentials: 'include' }).then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch CSS: ' + url);
          return res.text();
        }).then(function (cssText) {
          var rewritten = rewriteCssUrls(cssText, url);
          return inlineCssImports(rewritten, url, depth);
        }).catch(function () {
          return '';
        });
      }

      function fetchPageCss(pageUrl) {
        if (!pageUrl) return Promise.resolve('');
        return fetch(pageUrl, { credentials: 'include' }).then(function (res) {
          if (!res.ok) throw new Error('Failed to fetch page HTML: ' + pageUrl);
          return res.text();
        }).then(function (html) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, 'text/html');
          var pageHtmlAttrs = collectAttrs(doc.documentElement);
          var pageBodyAttrs = collectAttrs(doc.body);
          var nodes = Array.from(doc.querySelectorAll('link[rel~="stylesheet"], link[rel~="preload"][as="style"], style'));
          var tasks = nodes.map(function (node) {
            var tag = (node.tagName || '').toLowerCase();
            if (tag === 'style') {
              var inlineCss = rewriteCssUrls(node.textContent || '', pageUrl);
              return inlineCssImports(inlineCss, pageUrl, 0);
            }
            if (tag === 'link') {
              var href = node.getAttribute('href');
              if (!href) return Promise.resolve('');
              var abs = toAbsolute(href, pageUrl);
              return fetchCssWithImports(abs, 0).then(function (cssText) {
                if (!cssText) return '';
                return '/* ' + abs + ' */\n' + cssText;
              });
            }
            return Promise.resolve('');
          });
          return Promise.all(tasks).then(function (parts) {
            return {
              css: parts.filter(Boolean).join('\n'),
              htmlAttrs: pageHtmlAttrs,
              bodyAttrs: pageBodyAttrs
            };
          });
        }).catch(function () {
          return { css: '', htmlAttrs: '', bodyAttrs: '' };
        });
      }

      function fetchCssFromTab(tabId) {
        return new Promise(function (resolve) {
          if (!tabId || !chrome || !chrome.tabs) return resolve(null);
          chrome.tabs.sendMessage(tabId, { action: 'collect_css_raw' }, function (resp) {
            if (resp && !chrome.runtime.lastError) return resolve(resp);
            if (!chrome || !chrome.scripting || !chrome.scripting.executeScript) return resolve(null);
            chrome.scripting.executeScript(
              { target: { tabId: tabId }, files: ['content.js'] },
              function () {
                if (chrome.runtime.lastError) return resolve(null);
                chrome.tabs.sendMessage(tabId, { action: 'collect_css_raw' }, function (resp2) {
                  if (resp2 && !chrome.runtime.lastError) return resolve(resp2);
                  chrome.tabs.sendMessage(tabId, { action: 'collect_css' }, function (resp3) {
                    if (resp3 && !chrome.runtime.lastError) return resolve(resp3);
                    resolve(null);
                  });
                });
              }
            );
          });
        });
      }

      function buildCssFromSheets(resp, baseUrl) {
        var sheets = (resp && Array.isArray(resp.sheets)) ? resp.sheets : [];
        if (!sheets.length) return Promise.resolve('');
        var missing = [];
        sheets.forEach(function (sheet) {
          if (sheet && !sheet.cssText && sheet.href) missing.push(sheet.href);
        });
        return fetchCssViaBackground(missing).then(function (items) {
          var map = {};
          (items || []).forEach(function (item) {
            if (!item || !item.url) return;
            map[item.url] = item.css || '';
          });
          var parts = [];
          sheets.forEach(function (sheet) {
            if (!sheet) return;
            var css = sheet.cssText || (sheet.href ? map[sheet.href] : '');
            if (!css) return;
            var base = sheet.href || baseUrl;
            var rewritten = rewriteCssUrls(css, base || baseUrl);
            var media = (sheet.media || '').trim();
            if (media && media !== 'all') {
              rewritten = '@media ' + media + '{' + rewritten + '}';
            }
            parts.push('/* ' + (sheet.href || 'inline') + ' */\n' + rewritten);
          });
          return parts.filter(Boolean).join('\n');
        });
      }

      function fetchCssViaBackground(urls) {
        return new Promise(function (resolve) {
          if (!urls || !urls.length) return resolve([]);
          if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) return resolve([]);
          chrome.runtime.sendMessage({ action: 'fetch_css_urls', urls: urls }, function (resp) {
            if (chrome.runtime.lastError) return resolve([]);
            if (resp && Array.isArray(resp.items)) return resolve(resp.items);
            resolve([]);
          });
        });
      }

      function extractSpacing(styleText, classSet) {
        var results = [];
        if (!styleText) return results;

        function addMatch(selector, decls, mediaLabel) {
          var sel = selector.trim().replace(/\s+/g, ' ');
          if (!sel) return;
          var match = false;
          classSet.forEach(function (cls) {
            if (sel.indexOf('.' + cls) !== -1) match = true;
          });
          if (!match) return;
          decls.split(';').forEach(function (decl) {
            var parts = decl.split(':');
            if (parts.length < 2) return;
            var prop = parts[0].trim();
            var val  = parts.slice(1).join(':').trim();
            if (!prop) return;
            if (prop.indexOf('margin') === 0 || prop.indexOf('padding') === 0) {
              var prefix = mediaLabel ? '[' + mediaLabel + '] ' : '';
              results.push(prefix + sel + ' { ' + prop + ': ' + val + '; }');
            }
          });
        }

        var mediaRegex = /@media[^{]+\{([\s\S]*?)\}\s*/g;
        var mediaBlocks = [];
        var cleaned = styleText.replace(mediaRegex, function (match) {
          mediaBlocks.push(match);
          return '';
        });

        var blockRegex = /([^{}]+)\{([^}]+)\}/g;
        var m;
        while ((m = blockRegex.exec(cleaned)) !== null) addMatch(m[1], m[2], '');

        mediaBlocks.forEach(function (block) {
          var headerMatch = block.match(/@media[^{]+/);
          var mediaLabel  = headerMatch ? headerMatch[0].trim() : '@media';
          var inner = block.replace(/^[^{]+\{/, '').replace(/\}\s*$/, '');
          var bm;
          while ((bm = blockRegex.exec(inner)) !== null) addMatch(bm[1], bm[2], mediaLabel);
        });

        return results;
      }

      function applyEditsToHtml(html, edits) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var headlineEl = doc.body.querySelector('h1') || doc.body.querySelector('h2');
        if (headlineEl) {
          var span = headlineEl.querySelector('span');
          var newHeadline = (edits && edits.headline !== undefined) ? edits.headline : headlineEl.textContent;
          if (span) {
            var newSpan = span.cloneNode(true);
            newSpan.textContent = (edits && edits.subheadline !== undefined) ? edits.subheadline : span.textContent;
            headlineEl.textContent = '';
            headlineEl.appendChild(doc.createTextNode(newHeadline));
            headlineEl.appendChild(newSpan);
          } else {
            headlineEl.textContent = newHeadline;
          }
        }

        var bodyCopyEl = doc.body.querySelector('[class*="copy-block"] p') || doc.body.querySelector('p');
        if (bodyCopyEl && edits && edits.bodyCopy !== undefined) bodyCopyEl.textContent = edits.bodyCopy;

        var ctaBlock = doc.body.querySelector('[class*="cta-block"]');
        var ctaEls   = ctaBlock ? Array.from(ctaBlock.querySelectorAll('a,button')) : Array.from(doc.body.querySelectorAll('a,button'));
        if (edits && Array.isArray(edits.ctas)) {
          edits.ctas.forEach(function (cta, idx) {
            var el = ctaEls[idx];
            if (!el) return;
            el.textContent = cta.text || '';
            if (el.tagName.toLowerCase() === 'a') el.setAttribute('href', cta.href || '');
          });
        }

        return doc.body.innerHTML || '';
      }

      function findComponentName(doc) {
        var elements = Array.from(doc.body.querySelectorAll('*'));
        for (var i = 0; i < elements.length; i++) {
          var clsList = Array.from(elements[i].classList || []);
          for (var j = 0; j < clsList.length; j++) {
            if (/-component$/.test(clsList[j]) || /_component$/.test(clsList[j])) return clsList[j];
          }
        }
        for (var k = 0; k < elements.length; k++) {
          var clsList2 = Array.from(elements[k].classList || []);
          for (var mm = 0; mm < clsList2.length; mm++) {
            if (/component__/.test(clsList2[mm])) return clsList2[mm].split('__')[0];
          }
        }
        return '';
      }

      function toAbsolute(url, origin) {
        if (!url) return '';
        try { return new URL(url, origin).href; } catch (err) { return url; }
      }

      function getAssetFilename(url) {
        if (!url) return 'asset';
        try {
          var u = new URL(url);
          var parts = u.pathname.split('/').filter(Boolean);
          return decodeURIComponent(parts[parts.length - 1] || 'asset');
        } catch (err) {
          var cleaned = url.split('?')[0].split('#')[0];
          var parts2 = cleaned.split('/').filter(Boolean);
          return parts2[parts2.length - 1] || 'asset';
        }
      }

      function getAssetFormat(url) {
        var name = getAssetFilename(url);
        var m = name.match(/\.([a-zA-Z0-9]+)$/);
        return m ? m[1].toUpperCase() : 'UNKNOWN';
      }
      function downloadBlob(blob, filename) {
        if (!blob) return;
        try {
          var blobUrl = URL.createObjectURL(blob);
          if (chrome && chrome.downloads && chrome.downloads.download) {
            chrome.downloads.download({ url: blobUrl, filename: filename || '', saveAs: true }, function () {
              setTimeout(function () { try { URL.revokeObjectURL(blobUrl); } catch (e) {} }, 10000);
            });
            return;
          }
          var a = document.createElement('a');
          a.href = blobUrl;
          if (filename) a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { try { URL.revokeObjectURL(blobUrl); } catch (e) {} }, 10000);
        } catch (e2) {}
      }

      function fetchAssetBlob(url) {
        if (!url) return Promise.reject(new Error('Missing URL'));
        var blobUrl = (state && state.assetMap && state.assetMap[url]) ? state.assetMap[url] : '';
        var target = blobUrl || url;
        return fetch(target, { credentials: 'include' }).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.blob();
        });
      }

      function blobToImage(blob) {
        return new Promise(function (resolve, reject) {
          try {
            var objectUrl = URL.createObjectURL(blob);
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () {
              try { URL.revokeObjectURL(objectUrl); } catch (e) {}
              resolve(img);
            };
            img.onerror = function () {
              try { URL.revokeObjectURL(objectUrl); } catch (e) {}
              reject(new Error('Image load failed'));
            };
            img.src = objectUrl;
          } catch (e2) {
            reject(e2);
          }
        });
      }

      function rasterizeAsset(url, format) {
        return fetchAssetBlob(url).then(function (blob) {
          return blobToImage(blob).then(function (img) {
            var w = img.naturalWidth || img.width || 1200;
            var h = img.naturalHeight || img.height || 800;
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            if (format === 'jpg') {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, w, h);
            }
            ctx.drawImage(img, 0, 0, w, h);
            return new Promise(function (resolve) {
              canvas.toBlob(function (out) { resolve(out); }, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.92);
            });
          });
        });
      }

      function getPreferredDownloadFormat(url) {
        var ext = getAssetFormat(url).toLowerCase();
        if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
        if (ext === 'png') return 'png';
        return 'png';
      }

      function downloadAsset(url, filename) {
        if (!url) return;
        var preferred = getPreferredDownloadFormat(url);
        var baseName = getAssetFilename(url).replace(/\.[^.]+$/, '');
        var finalName = baseName + '.' + preferred;
        var ext = getAssetFormat(url).toLowerCase();
        var shouldConvert = !(ext === 'png' || ext === 'jpg' || ext === 'jpeg') || (preferred === 'jpg' && ext !== 'jpg' && ext !== 'jpeg') || (preferred === 'png' && ext !== 'png');

        if (shouldConvert) {
          rasterizeAsset(url, preferred).then(function (blob) {
            if (blob) downloadBlob(blob, finalName);
          }).catch(function () {
            if (chrome && chrome.downloads && chrome.downloads.download) {
              chrome.downloads.download({ url: url, filename: filename || getAssetFilename(url), saveAs: true });
              return;
            }
            var a = document.createElement('a');
            a.href = url;
            a.download = filename || getAssetFilename(url);
            document.body.appendChild(a);
            a.click();
            a.remove();
          });
          return;
        }

        if (chrome && chrome.downloads && chrome.downloads.download) {
          chrome.downloads.download({ url: url, filename: finalName, saveAs: true });
          return;
        }
        var a = document.createElement('a');
        a.href = url;
        a.download = finalName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      function extractData(html) {
        var parser = new DOMParser();
        var doc    = parser.parseFromString(html, 'text/html');
        var wrapper = doc.body.querySelector('.component') || doc.body.firstElementChild || doc.body;

        var componentName = findComponentName(doc);
        if (!componentName && wrapper && wrapper.className) componentName = wrapper.className.split(' ')[0];
        if (!componentName) componentName = wrapper.tagName.toLowerCase();

        var wrapperClasses = cleanText(wrapper.className || '');
        var variants = wrapperClasses.split(' ')
          .filter(function (c) { return c && c !== 'component' && c !== 'content' && c !== 'component-content'; })
          .join(' ');

        var hasContainer = !!doc.body.querySelector('.container');
        var hasRow       = !!doc.body.querySelector('.row');
        var colClasses   = Array.from(doc.body.querySelectorAll('[class*="col-"]'))
          .map(function (el) { return Array.from(el.classList || []).filter(function (c) { return c.indexOf('col-') === 0; }); })
          .reduce(function (acc, curr) { return acc.concat(curr); }, []);
        var uniqueCols = Array.from(new Set(colClasses));
        var grid = [];
        if (hasContainer) grid.push('container');
        if (hasRow)       grid.push('row');
        if (uniqueCols.length) grid.push(uniqueCols.join(', '));
        if (!grid.length) grid.push('—');

        var copyBlock   = doc.body.querySelector('[class*="copy-block"]');
        var h1          = (copyBlock && copyBlock.querySelector('h1')) || doc.body.querySelector('h1') || doc.body.querySelector('h2');
        var subSpan     = h1 ? h1.querySelector('span') : null;
        var headline    = h1 ? cleanText(h1.cloneNode(true).textContent) : '—';
        var subheadline = subSpan ? cleanText(subSpan.textContent) : '—';
        if (subSpan && h1) {
          var clone = h1.cloneNode(true);
          var childSpan = clone.querySelector('span');
          if (childSpan) childSpan.remove();
          headline = cleanText(clone.textContent);
        }
        var bodyCopyEl = (copyBlock && copyBlock.querySelector('p')) || doc.body.querySelector('p');
        var bodyCopy   = bodyCopyEl ? cleanText(bodyCopyEl.textContent) : '—';

        var ctaBlock = doc.body.querySelector('[class*="cta-block"]');
        var ctaEls   = [];
        if (ctaBlock) {
          ctaEls = Array.from(ctaBlock.querySelectorAll('a,button'));
        } else {
          ctaEls = Array.from(doc.body.querySelectorAll('a,button')).filter(function (el) {
            return /btn|cta|action/i.test(el.className || '');
          });
        }
        var ctas = ctaEls.map(function (el) {
          return { text: cleanText(el.textContent), href: el.getAttribute('href') || '' };
        }).filter(function (cta) { return cta.text || cta.href; });

        var nestedComponents = Array.from(doc.body.querySelectorAll('.component'))
          .filter(function (el) { return el !== wrapper; })
          .map(function (el) {
            var classes = Array.from(el.classList || [])
              .filter(function (c) { return c !== 'component' && c !== 'content' && c !== 'component-content'; });
            return classes.join(' ') || 'component';
          });

        var images = Array.from(doc.body.querySelectorAll('img'))
          .map(function (img) { return img.getAttribute('src') || img.getAttribute('data-src') || ''; })
          .filter(Boolean);

        var styles     = Array.from(doc.querySelectorAll('style')).map(function (s) { return s.textContent || ''; }).join(' ');
        var classSet   = new Set();
        Array.from(doc.body.querySelectorAll('[class]')).forEach(function (el) {
          Array.from(el.classList || []).forEach(function (cls) { if (cls) classSet.add(cls); });
        });
        var spacingNotes    = extractSpacing(styles, classSet);
        var responsiveNotes = [];
        if (/@media[^}]*min-width:\s*768px/.test(styles)) responsiveNotes.push('≥ 768px breakpoint detected.');
        if (/@media[^}]*min-width:\s*992px/.test(styles)) responsiveNotes.push('≥ 992px breakpoint detected.');
        if (!responsiveNotes.length && /@media/.test(styles)) responsiveNotes.push('Responsive breakpoints detected.');
        if (!responsiveNotes.length) responsiveNotes.push('No responsive hints found in inline styles.');

        var trackingFound   = /data-mfo-|data-track|data-analytics|data-layer/.test(html);
        var trackingSignals = Array.from(doc.body.querySelectorAll('*')).filter(function (el) {
          return Array.from(el.attributes || []).some(function (attr) { return /^data-mfo-/.test(attr.name); });
        }).map(function (el) {
          var attrs = Array.from(el.attributes || [])
            .filter(function (attr) { return /^data-mfo-/.test(attr.name); })
            .map(function (attr) { return attr.name + '="' + attr.value + '"'; });
          return {
            tag: el.tagName.toLowerCase(),
            classes: (el.className || '').trim(),
            text: cleanText(el.textContent || ''),
            href: el.getAttribute('href') || '',
            attrs: attrs
          };
        });

        return {
          componentName: componentName, wrapperClasses: wrapperClasses || '—',
          variants: variants || '—', grid: grid.join(' → '),
          headline: headline || '—', subheadline: subheadline || '—',
          bodyCopy: bodyCopy || '—', ctas: ctas,
          nested: nestedComponents, images: images,
          responsive: responsiveNotes.join(' '),
          spacing: spacingNotes,
          tracking: trackingFound ? 'Tracking attributes detected.' : 'No tracking attributes detected.',
          rows: hasRow ? 'Row layout detected.' : 'Row layout not detected.',
          trackingSignals: trackingSignals
        };
      }

      function setEditPanel(type, show) {
        var panel = document.querySelector('[data-edit-panel="' + type + '"]');
        if (!panel) return;
        panel.classList.toggle('is-active', !!show);
      }

      function updateSummaryFromEdits() {
        if (!state.edits) return;
        document.querySelector('[data-headline]').textContent    = state.edits.headline    || '—';
        document.querySelector('[data-subheadline]').textContent = state.edits.subheadline || '—';
        document.querySelector('[data-body-copy]').textContent   = state.edits.bodyCopy    || '—';

        var ctaList = document.querySelector('[data-cta-list]');
        ctaList.innerHTML = '';
        if (state.edits.ctas && state.edits.ctas.length) {
          state.edits.ctas.forEach(function (cta) {
            var chip = document.createElement('span');
            chip.className = 'chip';
            chip.textContent = cta.text || '—';
            ctaList.appendChild(chip);
          });
          var ctaNode = document.querySelector('[data-cta-node]');
          if (ctaNode) {
            var labels = state.edits.ctas.map(function (cta) { return cta.text; }).filter(Boolean);
            ctaNode.textContent = labels.length ? labels.join(' • ') : 'No CTAs found';
          }
        } else {
          ctaList.textContent = '—';
          var ctaNodeEmpty = document.querySelector('[data-cta-node]');
          if (ctaNodeEmpty) ctaNodeEmpty.textContent = 'No CTAs found';
        }
      }

      function renderCtaEditor(ctas) {
        var container = document.querySelector('[data-cta-editor]');
        if (!container) return;
        container.innerHTML = '';
        if (!ctas || !ctas.length) {
          var empty = document.createElement('p');
          empty.className = 'text-sm';
          empty.textContent = 'No CTAs found.';
          container.appendChild(empty);
          return;
        }
        ctas.forEach(function (cta, idx) {
          var row = document.createElement('div');
          row.style.marginBottom = '8px';
          row.setAttribute('data-cta-row', idx);

          var textInput = document.createElement('input');
          textInput.className = 'edit-field';
          textInput.type = 'text';
          textInput.placeholder = 'CTA text';
          textInput.value = cta.text || '';
          textInput.setAttribute('data-cta-text', idx);

          var hrefInput = document.createElement('input');
          hrefInput.className = 'edit-field';
          hrefInput.type = 'text';
          hrefInput.placeholder = 'CTA href';
          hrefInput.value = cta.href || '';
          hrefInput.setAttribute('data-cta-href', idx);

          row.appendChild(textInput);
          row.appendChild(hrefInput);
          container.appendChild(row);
        });
      }

      function openPreviewTab(htmlDoc) {
        var blob = new Blob([htmlDoc], { type: 'text/html' });
        var url  = URL.createObjectURL(blob);
        var win  = window.open(url, '_blank');
        if (!win) window.location.href = url;
        setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      }

      function renderBlueprint(data) {
        document.querySelector('[data-component-name]').textContent  = data.componentName;
        document.querySelector('[data-wrapper-classes]').textContent = data.wrapperClasses;
        document.querySelector('[data-grid]').textContent            = data.grid;
        document.querySelector('[data-variants]').textContent        = data.variants;
        var sourceLink = document.querySelector('[data-source-url]');
        if (state.url) {
          sourceLink.textContent = state.url;
          sourceLink.setAttribute('href', state.url);
        } else {
          sourceLink.textContent = '—';
          sourceLink.setAttribute('href', '#');
        }

        document.querySelector('[data-wrapper-node]').textContent = data.componentName;
        document.querySelector('[data-rows]').textContent         = data.rows;
        document.querySelector('[data-copy-node]').textContent    = 'Headline + subheadline + body copy';
        var ctaLabels = (data.ctas || []).map(function (cta) { return cta.text; }).filter(Boolean);
        document.querySelector('[data-cta-node]').textContent   = ctaLabels.length ? ctaLabels.join(' • ') : 'No CTAs found';
        document.querySelector('[data-nested]').textContent     = data.nested.length ? data.nested.join(' | ') : 'No nested components found';
        document.querySelector('[data-hero-image]').textContent = data.images.length ? (data.images[0] || '—') : 'No image found';

        state.edits = {
          headline:    data.headline    || '',
          subheadline: data.subheadline || '',
          bodyCopy:    data.bodyCopy    || '',
          ctas: (data.ctas || []).map(function (cta) { return { text: cta.text || '', href: cta.href || '' }; })
        };
        updateSummaryFromEdits();
        renderCtaEditor(state.edits.ctas);

        var assets = document.querySelector('[data-assets]');
        assets.innerHTML = '';
        if (data.images.length) {
          data.images.forEach(function (src) {
            var div = document.createElement('div');
            div.className = 'asset';
            var abs = toAbsolute(src, state.origin);
            var format = getAssetFormat(abs);
            var filename = getAssetFilename(abs);

            var row = document.createElement('div');
            row.className = 'asset-row';

            var urlEl = document.createElement('div');
            urlEl.className = 'asset-url';
            urlEl.textContent = abs + ' \u2022 ' + format;

            var btn = document.createElement('button');
            btn.className = 'asset-btn';
            btn.type = 'button';
            btn.textContent = 'DOWNLOAD ASSET';
            btn.addEventListener('click', function () {
              downloadAsset(abs, filename);
            });

            row.appendChild(urlEl);
            row.appendChild(btn);

            var meta = document.createElement('div');
            meta.className = 'asset-meta';
            meta.textContent = 'Format: ' + format;

            div.appendChild(row);
            div.appendChild(meta);
            assets.appendChild(div);
          });
        } else {
          var noImg = document.createElement('div');
          noImg.className = 'asset';
          noImg.textContent = 'No images found.';
          assets.appendChild(noImg);
        }

        document.querySelector('[data-responsive]').textContent = data.responsive;
        document.querySelector('[data-tracking]').textContent   = data.tracking;
        var spacingEl = document.querySelector('[data-spacing]');
        if (spacingEl) {
          spacingEl.innerHTML = '';
          if (data.spacing && data.spacing.length) {
            data.spacing.slice(0, 12).forEach(function (line) {
              var li = document.createElement('li');
              li.textContent = line;
              spacingEl.appendChild(li);
            });
            if (data.spacing.length > 12) {
              var more = document.createElement('li');
              more.textContent = '...and ' + (data.spacing.length - 12) + ' more';
              spacingEl.appendChild(more);
            }
          } else {
            var liEmpty = document.createElement('li');
            liEmpty.textContent = 'No padding or margin declarations found in inline styles.';
            spacingEl.appendChild(liEmpty);
          }
        }

        var trackingSignalsEl = document.querySelector('[data-tracking-signals]');
        trackingSignalsEl.innerHTML = '';
        if (data.trackingSignals && data.trackingSignals.length) {
          data.trackingSignals.forEach(function (signal) {
            var card  = document.createElement('div');
            card.className = 'card';
            var title = document.createElement('p');
            title.className = 'card-title';
            var label = signal.tag || 'element';
            if (signal.classes) label += '.' + signal.classes.split(/\s+/).filter(Boolean).join('.');
            title.textContent = label;
            var text = document.createElement('p');
            text.className = 'text-sm';
            text.textContent = signal.text || '—';
            var href = document.createElement('p');
            href.className = 'text-sm';
            href.textContent = signal.href ? ('Href: ' + signal.href) : 'Href: —';
            var list = document.createElement('ul');
            signal.attrs.forEach(function (attr) {
              var li = document.createElement('li');
              li.textContent = attr;
              list.appendChild(li);
            });
            card.appendChild(title);
            card.appendChild(text);
            card.appendChild(href);
            card.appendChild(list);
            trackingSignalsEl.appendChild(card);
          });
        } else {
          var none = document.createElement('div');
          none.className = 'card';
          none.textContent = 'No data-mfo-* attributes found in the snippet.';
          trackingSignalsEl.appendChild(none);
        }

        var signature = document.querySelector('[data-signature]');
        var date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        signature.textContent = 'Generated by Digital Detective v1.6 — Application Developed by Camilo Mello — ' + date;
        updateReportHeader(state.url, new Date());

        var previewFrame        = document.querySelector('[data-preview]');
        var previewModal        = document.querySelector('[data-preview-modal]');
        var previewMobileFrame  = document.querySelector('[data-preview-mobile]');
        var previewMobileModal  = document.querySelector('[data-preview-mobile-modal]');
        var previewNoteEl       = document.querySelector('[data-preview-note]');
        var sanitized = sanitizeHtml(state.html);
        state.sanitizedHtml = sanitized;
        var baseHref = state.baseHref || state.origin;

        var cssAbs = rewriteCssUrls(state.pageCss || '', baseHref);
        var cssUrls = collectUrlsFromCss(cssAbs).map(function (u) { return normalizeUrl(u, baseHref); });
        var htmlUrls = collectUrlsFromHtml(sanitized, baseHref);
        var assetUrls = uniqueList(cssUrls.concat(htmlUrls));

        if (state.assetMap) {
          revokeAssetBlobs(state.assetMap);
          state.assetMap = null;
        }

        var cssBytes = cssAbs ? cssAbs.length : 0;
        if (previewNoteEl) {
          previewNoteEl.textContent = 'Base URL: ' + (baseHref || '?') + (cssBytes ? (' | CSS: ' + Math.round(cssBytes / 1024) + 'KB') : '') + (assetUrls.length ? (' | Assets: ' + assetUrls.length) : '');
        }

        fetchAssetBlobs(assetUrls, function (curr, total) {
          if (!previewNoteEl) return;
          previewNoteEl.textContent = 'Base URL: ' + (baseHref || '?') + (cssBytes ? (' | CSS: ' + Math.round(cssBytes / 1024) + 'KB') : '') + ' | Caching: ' + curr + '/' + total;
        }).then(function (map) {
          state.assetMap = map || {};
          var cssFinal = replaceUrlsWithMap(cssAbs, baseHref, state.assetMap);
          var htmlFinal = rewriteHtmlAssets(sanitized, baseHref, state.assetMap);

          var previewDoc = buildPreviewDoc(
            htmlFinal,
            baseHref,
            20,
            cssFinal,
            state.pageHtmlAttrs,
            state.pageBodyAttrs
          );
          previewFrame.srcdoc = previewDoc;
          previewModal.srcdoc = previewDoc;
          if (previewMobileFrame) {
            previewMobileFrame.srcdoc = buildPreviewDoc(
              htmlFinal,
              baseHref,
              0,
              cssFinal,
              state.pageHtmlAttrs,
              state.pageBodyAttrs
            );
          }
          if (previewMobileModal) {
            previewMobileModal.srcdoc = buildPreviewDoc(
              htmlFinal,
              baseHref,
              0,
              cssFinal,
              state.pageHtmlAttrs,
              state.pageBodyAttrs
            );
          }
          if (previewNoteEl) {
            var cachedCount = state.assetMap ? Object.keys(state.assetMap).length : 0;
            previewNoteEl.textContent = 'Base URL: ' + (baseHref || '?') + (cssBytes ? (' | CSS: ' + Math.round(cssBytes / 1024) + 'KB') : '') + (cachedCount ? (' | Cached: ' + cachedCount) : '');
          }
        });

      }

      var urlInput         = document.querySelector('[data-url]');
      var urlError         = document.querySelector('[data-url-error]');
      var urlNext          = document.querySelector('[data-url-next]');
      var htmlInput        = document.querySelector('[data-html]');
      var htmlError        = document.querySelector('[data-html-error]');
      var htmlNext         = document.querySelector('[data-html-next]');
      var saveBtn          = document.querySelector('[data-save]');
      var previewUpdatedBtn = document.querySelector('[data-preview-updated]');

      if (state.sourceUrl && urlInput) {
        urlInput.value = state.sourceUrl;
        updateReportHeader(state.sourceUrl);
      }

      document.querySelectorAll('[data-edit]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var type = btn.getAttribute('data-edit');
          if (!state.edits) return;
          if (type === 'headline') {
            document.querySelector('[data-edit-headline]').value    = state.edits.headline    || '';
            document.querySelector('[data-edit-subheadline]').value = state.edits.subheadline || '';
          }
          if (type === 'body') document.querySelector('[data-edit-body]').value = state.edits.bodyCopy || '';
          if (type === 'cta') renderCtaEditor(state.edits.ctas);
          setEditPanel(type, true);
        });
      });

      document.querySelectorAll('[data-cancel]').forEach(function (btn) {
        btn.addEventListener('click', function () { setEditPanel(btn.getAttribute('data-cancel'), false); });
      });

      document.querySelectorAll('[data-apply]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var type = btn.getAttribute('data-apply');
          if (!state.edits) return;
          if (type === 'headline') {
            state.edits.headline    = document.querySelector('[data-edit-headline]').value.trim();
            state.edits.subheadline = document.querySelector('[data-edit-subheadline]').value.trim();
          }
          if (type === 'body') state.edits.bodyCopy = document.querySelector('[data-edit-body]').value.trim();
          if (type === 'cta') {
            var rows = Array.from(document.querySelectorAll('[data-cta-row]'));
            state.edits.ctas = rows.map(function (row) {
              return {
                text: ((row.querySelector('[data-cta-text]') || {}).value || '').trim(),
                href: ((row.querySelector('[data-cta-href]') || {}).value || '').trim()
              };
            });
          }
          updateSummaryFromEdits();
          setEditPanel(type, false);
        });
      });

      urlNext.addEventListener('click', function () {
        urlError.textContent = '';
        var value = (urlInput.value || '').trim();
        if (!value) { urlError.textContent = 'Please enter the component source URL.'; return; }
        try {
          var parsed = new URL(value);
          state.url    = parsed.href;
          state.origin = parsed.origin;
          state.baseHref = parsed.href;
          updateReportHeader(state.url);
          state.pageCss = '';
          state.pageHtmlAttrs = '';
          state.pageBodyAttrs = '';
          state.cssPromise = fetchCssFromTab(state.tabId).then(function (resp) {
            if (resp) {
              var parts = [];
              var base = resp.url || state.baseHref;
              if (resp.sheets && resp.sheets.length) {
                return buildCssFromSheets(resp, base).then(function (cssText) {
                  state.pageCss = cssText || '';
                  state.pageHtmlAttrs = resp.htmlAttrs || '';
                  state.pageBodyAttrs = resp.bodyAttrs || '';
                  if (resp.url) state.baseHref = resp.url;
                  log('CSS loaded from tab (ordered): ' + (state.pageCss ? state.pageCss.length : 0) + ' bytes');
                  return null;
                });
              }
              if (resp.css) {
                parts.push('/* cssRules */\n' + rewriteCssUrls(resp.css, base));
              }
              if (resp.inlineCss && resp.inlineCss.length) {
                resp.inlineCss.forEach(function (css) {
                  if (!css) return;
                  parts.push(rewriteCssUrls(css, base));
                });
              }
              var hrefs = Array.isArray(resp.hrefs) ? resp.hrefs : [];
              return fetchCssViaBackground(hrefs).then(function (items) {
                if (items && items.length) {
                  items.forEach(function (item) {
                    if (!item || !item.css) return;
                    var src = item.url || base;
                    parts.push('/* ' + (item.url || '') + ' */\n' + rewriteCssUrls(item.css, src));
                  });
                }
                state.pageCss = parts.filter(Boolean).join('\n');
                state.pageHtmlAttrs = resp.htmlAttrs || '';
                state.pageBodyAttrs = resp.bodyAttrs || '';
                if (resp.url) state.baseHref = resp.url;
                log('CSS loaded from tab: ' + (state.pageCss ? state.pageCss.length : 0) + ' bytes');
                return null;
              });
            }
            return fetchPageCss(state.baseHref).then(function (cssText) {
              state.pageCss = (cssText && cssText.css) ? cssText.css : '';
              state.pageHtmlAttrs = (cssText && cssText.htmlAttrs) ? cssText.htmlAttrs : '';
              state.pageBodyAttrs = (cssText && cssText.bodyAttrs) ? cssText.bodyAttrs : '';
              log('CSS loaded: ' + (state.pageCss ? state.pageCss.length : 0) + ' bytes');
              return null;
            });
          }).catch(function (err) {
            state.pageCss = '';
            state.pageHtmlAttrs = '';
            state.pageBodyAttrs = '';
            log('CSS load failed: ' + (err && err.message ? err.message : err));
          });
          showStep('html');
        } catch (err) {
          urlError.textContent = 'Please enter a valid URL.';
        }
      });

      htmlNext.addEventListener('click', function () {
        htmlError.textContent = '';
        var value = (htmlInput.value || '').trim();
        if (!value) { htmlError.textContent = 'Please paste the section HTML.'; return; }
        state.html = value;
        showStep('loading');
        setTimeout(function () {
          var run = function () {
            try {
              log('Parsing HTML length: ' + state.html.length);
              var data = extractData(state.html);
              renderBlueprint(data);
              showStep('result');
              saveBtn.removeAttribute('disabled');
              log('Blueprint generated.');
            } catch (err) {
              showStep('html');
              htmlError.textContent = 'Something went wrong while parsing the HTML. Please try a smaller snippet.';
              log('Error: ' + (err && err.message ? err.message : err));
            }
          };
          var promise = state.cssPromise;
          if (promise && typeof promise.then === 'function') {
            promise.then(run).catch(run);
          } else {
            run();
          }
        }, 900);
      });

      if (previewUpdatedBtn) {
        previewUpdatedBtn.addEventListener('click', function () {
          if (!state.edits) return;
          var sanitized  = sanitizeHtml(state.html);
          var editedHtml = applyEditsToHtml(sanitized, state.edits);
          var baseHref = state.baseHref || state.origin;
          var cssAbs = rewriteCssUrls(state.pageCss || '', baseHref);
          var cssFinal = state.assetMap ? replaceUrlsWithMap(cssAbs, baseHref, state.assetMap) : cssAbs;
          var htmlFinal = state.assetMap ? rewriteHtmlAssets(editedHtml, baseHref, state.assetMap) : editedHtml;
          openPreviewTab(buildPreviewDoc(
            htmlFinal,
            baseHref,
            20,
            cssFinal,
            state.pageHtmlAttrs,
            state.pageBodyAttrs
          ));
        });
      }

      function tryRunQuickBlueprint() {
        if (!state.quickMode || !chrome || !chrome.storage || !chrome.storage.local) return;
        chrome.storage.local.get(['dd_bluep_quick'], function (res) {
          var payload = res && res.dd_bluep_quick;
          if (!payload || !payload.html) return;
          var payloadUrl = (payload.url || state.sourceUrl || '').trim();
          var payloadHtml = (payload.html || '').trim();
          if (!payloadUrl || !payloadHtml) return;

          if (payload.ts && (Date.now() - payload.ts > 10 * 60 * 1000)) {
            chrome.storage.local.remove('dd_bluep_quick');
            return;
          }

          chrome.storage.local.remove('dd_bluep_quick');
          if (urlInput) urlInput.value = payloadUrl;
          if (htmlInput) htmlInput.value = payloadHtml;
          updateReportHeader(payloadUrl);

          setTimeout(function () {
            if (urlNext) urlNext.click();
            setTimeout(function () {
              if (htmlNext) htmlNext.click();
            }, 80);
          }, 30);
        });
      }
      tryRunQuickBlueprint();

      window.addEventListener('message', function (event) {
        var data = event.data || {};
        if (!data || data.type !== 'ccb-height') return;
        var iframe = document.querySelector('iframe[data-frame-id="' + data.id + '"]');
        if (!iframe || !iframe.hasAttribute('data-auto-height')) return;
        var height = parseInt(data.height, 10);
        if (!height || height < 50) return;
        iframe.style.height = height + 'px';
      });

      if (saveBtn) {
        if (window.DDReportUtils && typeof window.DDReportUtils.bindSaveButton === 'function') {
          window.DDReportUtils.bindSaveButton(saveBtn, 'component-blueprint.html');
        } else {
          saveBtn.addEventListener('click', function () {
            var html = '<!doctype html>\n' + document.documentElement.outerHTML;
            var blob = new Blob([html], { type: 'text/html' });
            var url = URL.createObjectURL(blob);
            var a   = document.createElement('a');
            a.href  = url;
            a.download = 'component-blueprint.html';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          });
        }
      }

      // Modal: Preview
      var modal       = document.getElementById('previewModal');
      var openPreview = document.querySelector('[data-open-preview]');
      if (modal && openPreview) {
        var closeEls = modal.querySelectorAll('[data-close]');
        function openModal()  { modal.classList.add('is-open');    modal.setAttribute('aria-hidden','false'); }
        function closeModal() { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden','true');  }
        openPreview.addEventListener('click', openModal);
        closeEls.forEach(function (el) { el.addEventListener('click', closeModal); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
      }

      // Modal: Code
      var codeModal = document.getElementById('codeModal');
      var openCode  = document.querySelector('[data-open-code]');
      var codeView  = document.querySelector('[data-code-view]');
      if (codeModal && openCode && codeView) {
        if (window.DDReportUtils && typeof window.DDReportUtils.bindCodeModal === 'function') {
          window.DDReportUtils.bindCodeModal({
            modal: codeModal,
            openBtn: openCode,
            getHtml: function () { return state.sanitizedHtml || state.html || ''; }
          });
        } else {
          var closeCodeEls = codeModal.querySelectorAll('[data-close-code]');
          function openCodeModal()  { codeModal.classList.add('is-open');    codeModal.setAttribute('aria-hidden','false'); codeView.textContent = state.sanitizedHtml || state.html || ''; }
          function closeCodeModal() { codeModal.classList.remove('is-open'); codeModal.setAttribute('aria-hidden','true');  }
          openCode.addEventListener('click', openCodeModal);
          closeCodeEls.forEach(function (el) { el.addEventListener('click', closeCodeModal); });
          document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCodeModal(); });
        }
      }

      // Modal: Mobile
      var mobileModal       = document.getElementById('previewMobileModal');
      var openMobilePreview = document.querySelector('[data-open-mobile-preview]');
      if (mobileModal && openMobilePreview) {
        var closeMobileEls = mobileModal.querySelectorAll('[data-close-mobile]');
        function openMobileModal()  { mobileModal.classList.add('is-open');    mobileModal.setAttribute('aria-hidden','false'); }
        function closeMobileModal() { mobileModal.classList.remove('is-open'); mobileModal.setAttribute('aria-hidden','true');  }
        openMobilePreview.addEventListener('click', openMobileModal);
        closeMobileEls.forEach(function (el) { el.addEventListener('click', closeMobileModal); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMobileModal(); });
      }
    })();
