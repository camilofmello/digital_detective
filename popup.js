(function () {
  'use strict';

  var btnDs          = document.getElementById('btn-ds');
  var btnBluep       = document.getElementById('btn-blueprinter');
  var btnPicker      = document.getElementById('btn-picker');
  var btnColor       = document.getElementById('btn-color-picker');
  var btnEvent       = document.getElementById('btn-event-tracker');
  var btnScript      = document.getElementById('btn-script-finder');
  var btnShot        = document.getElementById('btn-screenshot');
  var btnMatch       = document.getElementById('btn-match');
  var colorPanel     = document.getElementById('color-panel');
  var pickerPanel    = document.getElementById('picker-panel');
  var dsPanel        = document.getElementById('ds-panel');
  var bluepPanel     = document.getElementById('bluep-panel');
  var colorStart     = document.getElementById('color-start');
  var pickerStart    = document.getElementById('picker-start');
  var dsRunPage      = document.getElementById('ds-run-page');
  var dsModeElement  = document.getElementById('ds-mode-element');
  var dsHtmlWrap     = document.getElementById('ds-html-wrap');
  var dsHtml         = document.getElementById('ds-html');
  var dsCancelElement = document.getElementById('ds-cancel-element');
  var dsRunHtml      = document.getElementById('ds-run-html');
  var bluepUrl       = document.getElementById('bluep-url');
  var bluepHtml      = document.getElementById('bluep-html');
  var bluepGenerate  = document.getElementById('bluep-generate');
  var shotPanel      = document.getElementById('shot-panel');
  var shotStatus     = document.getElementById('shot-status');
  var shotComponent  = document.getElementById('shot-component');
  var shotVisible    = document.getElementById('shot-visible');
  var shotFull       = document.getElementById('shot-full');
  var helpBtn        = document.getElementById('help-btn');
  var helpModal      = document.getElementById('help-modal');
  var statusEl       = document.getElementById('status');
  var statusText     = document.getElementById('status-text');
  var spinnerEl      = document.getElementById('spinner');
  var scriptPanel    = document.getElementById('script-panel');
  var scriptList     = document.getElementById('script-list');
  var scriptStatus   = document.getElementById('script-status');
  var scriptSearch   = document.getElementById('script-search');
  var eventPanel     = document.getElementById('event-panel');
  var eventActivate  = document.getElementById('event-activate');
  var eventDeactivate = document.getElementById('event-deactivate');
  var eventStatus    = document.getElementById('event-status');
  var eventList      = document.getElementById('event-list');
  var eventFilter    = document.getElementById('event-filter');
  var matchPanel     = document.getElementById('match-panel');
  var matchUrlA      = document.getElementById('match-url-a');
  var matchUrlB      = document.getElementById('match-url-b');
  var matchAnalyse   = document.getElementById('match-analyse');
  var matchStatus    = document.getElementById('match-status');
  var btnLighthouse  = document.getElementById('btn-lighthouse');
  var lhPanel        = document.getElementById('lh-panel');
  var lhUrlPreview   = document.getElementById('lh-url-preview');
  var lhApiKey       = document.getElementById('lh-api-key');
  var lhRun          = document.getElementById('lh-run');
  var lhStatus       = document.getElementById('lh-status');
  var btnSeo         = document.getElementById('btn-seo');
  var seoPanel       = document.getElementById('seo-panel');
  var seoUrlPreview  = document.getElementById('seo-url-preview');
  var seoRun         = document.getElementById('seo-run');
  var seoStatus      = document.getElementById('seo-status');
  var eventPollTimer = null;
  var eventItems     = [];
  var eventOpenId    = null;

  /* -- Status helpers -- */

  function setShotStatus(msg, type) {
    if (!shotStatus) return;
    shotStatus.textContent = msg;
    shotStatus.className = 'shot-status is-active' + (type ? (' is-' + type) : '');
  }

  function clearShotStatus() {
    if (!shotStatus) return;
    shotStatus.className = 'shot-status';
  }

  function setStatus(msg, type) {
    statusEl.className = 'status is-active' + (type ? ' is-' + type : '');
    statusText.textContent = msg;
    spinnerEl.style.display = type === 'success' || type === 'error' ? 'none' : '';
  }

  function clearStatus() {
    statusEl.className = 'status';
  }

  function setButtonsEnabled(enabled) {
    btnDs.disabled = !enabled;
    btnBluep.disabled = !enabled;
    if (btnColor) btnColor.disabled = !enabled;
    btnDs.style.opacity = enabled ? '' : '0.5';
    btnBluep.style.opacity = enabled ? '' : '0.5';
    if (btnColor) btnColor.style.opacity = enabled ? '' : '0.5';
  }

  function setScriptStatus(msg, type) {
    if (!scriptStatus) return;
    scriptStatus.textContent = msg;
    scriptStatus.className = 'script-status is-active' + (type ? (' is-' + type) : '');
  }

  function clearScriptStatus() {
    if (!scriptStatus) return;
    scriptStatus.className = 'script-status';
  }

  function setEventStatus(msg, type) {
    if (!eventStatus) return;
    eventStatus.textContent = msg;
    eventStatus.className = 'event-status is-active' + (type ? (' is-' + type) : '');
  }

  function clearEventStatus() {
    if (!eventStatus) return;
    eventStatus.className = 'event-status';
  }

  function setMatchStatus(msg, type) {
    if (!matchStatus) return;
    matchStatus.textContent = msg;
    matchStatus.className = 'match-status is-active' + (type ? (' is-' + type) : '');
  }

  function clearMatchStatus() {
    if (!matchStatus) return;
    matchStatus.className = 'match-status';
  }

  function setLhStatus(msg, type) {
    if (!lhStatus) return;
    lhStatus.textContent = msg;
    lhStatus.className = 'lh-status is-active' + (type ? (' is-' + type) : '');
  }

  function clearLhStatus() {
    if (!lhStatus) return;
    lhStatus.className = 'lh-status';
  }

  function setSeoStatus(msg, type) {
    if (!seoStatus) return;
    seoStatus.textContent = msg;
    seoStatus.className = 'seo-status is-active' + (type ? (' is-' + type) : '');
  }

  function clearSeoStatus() {
    if (!seoStatus) return;
    seoStatus.className = 'seo-status';
  }

  /* -- Clipboard -- */

  function copyToClipboard(text, onDone) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        if (onDone) onDone(true);
      }).catch(function () {
        fallbackCopy(text);
        if (onDone) onDone(false);
      });
      return;
    }
    fallbackCopy(text);
    if (onDone) onDone(false);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }

  /* -- Tab helpers -- */

  function formatScriptName(name) {
    var maxLen = 30;
    var clean = String(name || '').trim();
    if (!clean) return 'Script';
    if (clean.length <= maxLen) return clean;
    return clean.slice(0, maxLen) + ' (...)';
  }

  function getActiveTab(cb) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      cb(tabs && tabs[0]);
    });
  }

  function sendToTab(tabId, payload, cb) {
    chrome.tabs.sendMessage(tabId, payload, function (resp) {
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript(
          { target: { tabId: tabId }, files: ['content.js'] },
          function () {
            if (chrome.runtime.lastError) {
              cb({ error: 'Cannot inject on this page.' });
              return;
            }
            chrome.tabs.sendMessage(tabId, payload, function (resp2) {
              cb(resp2 || { error: 'No response' });
            });
          }
        );
        return;
      }
      cb(resp || { error: 'No response' });
    });
  }

  /* -- Event Tracker -- */

  function startEventPolling(tab) {
    if (eventPollTimer) clearInterval(eventPollTimer);
    eventPollTimer = setInterval(function () {
      if (!tab || !tab.id) return;
      sendToTab(tab.id, { action: 'event_tracker_get' }, function (resp) {
        if (!resp || resp.error) return;
        eventItems = resp.events || [];
        renderEvents(eventItems);
      });
    }, 800);
  }

  function stopEventPolling() {
    if (eventPollTimer) clearInterval(eventPollTimer);
    eventPollTimer = null;
  }

  function renderEvents(events) {
    if (!eventList) return;
    eventList.innerHTML = '';
    if (!events || !events.length) {
      setEventStatus('No events captured yet.');
      return;
    }
    clearEventStatus();
    var selectedSource = eventFilter ? eventFilter.value : 'all';
    var filtered = events.filter(function (evt) {
      if (selectedSource === 'all') return true;
      return (evt.source || evt.provider || 'page') === selectedSource;
    });
    if (eventOpenId && !filtered.some(function (evt) { return evt.id === eventOpenId; })) {
      eventOpenId = null;
    }
    if (!filtered.length) {
      setEventStatus('No events for this source.');
      return;
    }
    filtered.slice(0, 20).forEach(function (evt) {
      var title = evt.name || evt.method || evt.type || 'Event';
      var meta  = evt.source ? ('source: ' + evt.source) : 'source: page';
      var item  = document.createElement('div');
      item.className = 'event-item';
      item.innerHTML =
        '<div class="event-item-title">' + title + '</div>' +
        '<div class="event-item-meta">' + meta + '</div>' +
        '<div class="event-payload">' +
          '<div class="event-detail-header">' +
            '<div class="event-detail-title">Event Payload</div>' +
            '<button class="script-btn" type="button">Copy JSON</button>' +
          '</div>' +
          '<pre></pre>' +
        '</div>';
      var payload  = item.querySelector('.event-payload');
      var pre      = item.querySelector('pre');
      var copyBtn  = item.querySelector('button');
      var jsonText = JSON.stringify(evt, null, 2);
      if (pre) pre.textContent = jsonText;
      if (payload && evt.id && evt.id === eventOpenId) payload.classList.add('is-open');
      item.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('button')) return;
        if (e.target && e.target.closest && e.target.closest('.event-payload')) return;
        if (!payload) return;
        var open = payload.classList.contains('is-open');
        eventOpenId = open ? null : (evt.id || null);
        payload.classList.toggle('is-open', !open);
      });
      if (copyBtn) {
        copyBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          copyToClipboard(jsonText, function () { setEventStatus('Event copied.', 'success'); });
        });
      }
      eventList.appendChild(item);
    });
  }

  /* -- Screenshot -- */

  function startScreenshot(mode) {
    getActiveTab(function (tab) {
      if (!tab || !tab.id) {
        setShotStatus('Cannot access the current tab.', 'error');
        return;
      }
      setShotStatus('Starting capture...', '');
      sendToTab(tab.id, { action: 'screenshot_start', mode: mode }, function (resp) {
        if (!resp || resp.error) {
          setShotStatus('Unable to start capture.', 'error');
          return;
        }
        window.close();
      });
    });
  }

  function openReport(html, filename) {
    if (!html) return false;
    chrome.runtime.sendMessage({
      action: 'open_report_viewer',
      html: html,
      filename: filename || 'report.html'
    });
    return true;
  }

  function handleDsResponse(resp, filename) {
    if (!resp) {
      setStatus('No response from page.', 'error');
      return;
    }
    if (resp.error) {
      setStatus('Error: ' + String(resp.error).slice(0, 160), 'error');
      return;
    }
    if (!resp.html) {
      setStatus('Empty result. Something went wrong.', 'error');
      return;
    }
    if (openReport(resp.html, filename)) {
      setStatus('Report opened in a new tab.', 'success');
    } else {
      setStatus('Popup blocked. Allow popups to open the report.', 'error');
    }
  }

  function showDsElementMode(show) {
    if (dsHtmlWrap) dsHtmlWrap.classList.toggle('quick-hidden', !show);
    if (dsModeElement) dsModeElement.classList.toggle('primary', !!show);
    if (dsRunPage) dsRunPage.classList.toggle('primary', !show);
    if (!show && dsHtml) dsHtml.value = '';
  }

  function populateDsPanel() {
    showDsElementMode(false);
  }

  function runDsPageFromPopup() {
    showDsElementMode(false);
    getActiveTab(function (tab) {
      if (!tab || !tab.id) {
        setStatus('Cannot access the current tab.', 'error');
        return;
      }
      setStatus('Collecting CSS from page...');
      sendToTab(tab.id, { action: 'extract_ds' }, function (resp) {
        handleDsResponse(resp, 'design_system_report.html');
      });
    });
  }

  function runDsHtmlFromPopup() {
    var html = (dsHtml ? dsHtml.value : '').trim();
    if (!html) {
      setStatus('Please paste the component HTML.', 'error');
      return;
    }
    getActiveTab(function (tab) {
      if (!tab || !tab.id) {
        setStatus('Cannot access the current tab.', 'error');
        return;
      }
      setStatus('Analyzing selected component...');
      sendToTab(tab.id, { action: 'extract_ds_html', html: html }, function (resp) {
        handleDsResponse(resp, 'design_system_report_scoped.html');
      });
    });
  }

  function populateBlueprinterPanel() {
    getActiveTab(function (tab) {
      if (!tab || !tab.url || !bluepUrl) return;
      if (!bluepUrl.value || !bluepUrl.value.trim()) bluepUrl.value = tab.url;
    });
  }

  function runBlueprinterFromPopup() {
    var urlValue = (bluepUrl ? bluepUrl.value : '').trim();
    var htmlValue = (bluepHtml ? bluepHtml.value : '').trim();
    if (!urlValue) {
      setStatus('Please enter the component source URL.', 'error');
      return;
    }
    try {
      urlValue = new URL(urlValue).href;
    } catch (e) {
      setStatus('Please enter a valid URL.', 'error');
      return;
    }
    if (!htmlValue) {
      setStatus('Please paste the component HTML.', 'error');
      return;
    }
    getActiveTab(function (tab) {
      var payload = { url: urlValue, html: htmlValue, ts: Date.now() };
      chrome.storage.local.set({ dd_bluep_quick: payload }, function () {
        var targetUrl = chrome.runtime.getURL('blueprinter.html') + '?quick=1';
        if (tab && tab.id) targetUrl += '&tabId=' + encodeURIComponent(tab.id);
        targetUrl += '&sourceUrl=' + encodeURIComponent(urlValue);
        chrome.tabs.create({ url: targetUrl });
        window.close();
      });
    });
  }

  function startElementPicker() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab || !tab.id) {
        setStatus('Cannot access the current tab.', 'error');
        return;
      }
      chrome.tabs.sendMessage(tab.id, { action: 'toggle_picker' }, function () {
        if (chrome.runtime.lastError) {
          chrome.scripting.executeScript(
            { target: { tabId: tab.id }, files: ['content.js'] },
            function () {
              if (chrome.runtime.lastError) {
                setStatus('Cannot inject on this page (try a regular web page).', 'error');
                return;
              }
              chrome.tabs.sendMessage(tab.id, { action: 'toggle_picker' }, function () {
                window.close();
              });
            }
          );
          return;
        }
        window.close();
      });
    });
  }

  function startColorPicker() {
    getActiveTab(function (tab) {
      if (!tab || !tab.id) {
        setStatus('Cannot access the current tab.', 'error');
        return;
      }
      sendToTab(tab.id, { action: 'start_color_picker' }, function (resp) {
        if (!resp || resp.error) {
          setStatus('Unable to start color picker.', 'error');
          return;
        }
        window.close();
      });
    });
  }

  if (colorStart) colorStart.addEventListener('click', startColorPicker);
  if (pickerStart) pickerStart.addEventListener('click', startElementPicker);
  if (dsModeElement) dsModeElement.addEventListener('click', function () { showDsElementMode(true); });
  if (dsCancelElement) dsCancelElement.addEventListener('click', function () { showDsElementMode(false); });
  if (dsRunPage) dsRunPage.addEventListener('click', runDsPageFromPopup);
  if (dsRunHtml) dsRunHtml.addEventListener('click', runDsHtmlFromPopup);
  if (bluepGenerate) bluepGenerate.addEventListener('click', runBlueprinterFromPopup);

  function closeAllPanels(exceptPanel) {
    var allPanels = [colorPanel, shotPanel, pickerPanel, dsPanel, bluepPanel, matchPanel, lhPanel, seoPanel, eventPanel, scriptPanel];
    var allButtons = [btnColor, btnShot, btnPicker, btnDs, btnBluep, btnMatch, btnLighthouse, btnSeo, btnEvent, btnScript];

    allPanels.forEach(function (panel) {
      if (!panel || panel === exceptPanel) return;
      panel.classList.remove('is-open');
    });
    allButtons.forEach(function (btn) {
      if (btn) btn.classList.remove('is-active');
    });

    if (!exceptPanel || exceptPanel !== eventPanel) stopEventPolling();
    clearShotStatus();
    clearEventStatus();
    clearMatchStatus();
    clearLhStatus();
    clearSeoStatus();
    clearScriptStatus();
    clearStatus();
  }

  function togglePanel(btn, panel, onOpen, onClose) {
    if (!btn || !panel) return;
    var opening = !panel.classList.contains('is-open');
    closeAllPanels(opening ? panel : null);
    panel.classList.toggle('is-open', opening);
    btn.classList.toggle('is-active', opening);
    if (opening && typeof onOpen === 'function') onOpen();
    if (!opening && typeof onClose === 'function') onClose();
  }

  function populateLighthousePanel() {
    getActiveTab(function (tab) {
      if (lhUrlPreview) lhUrlPreview.textContent = (tab && tab.url) ? tab.url : '-';
    });
    try {
      chrome.storage.local.get(['dd_lh_api_key'], function (res) {
        if (lhApiKey && res && res.dd_lh_api_key) lhApiKey.value = res.dd_lh_api_key;
      });
    } catch (e) {}
  }

  function populateSeoPanel() {
    getActiveTab(function (tab) {
      if (seoUrlPreview) seoUrlPreview.textContent = (tab && tab.url) ? tab.url : '-';
    });
  }

  if (btnColor && colorPanel) btnColor.addEventListener('click', function () { togglePanel(btnColor, colorPanel); });
  if (btnShot && shotPanel) btnShot.addEventListener('click', function () { togglePanel(btnShot, shotPanel); });
  if (btnPicker && pickerPanel) btnPicker.addEventListener('click', function () { togglePanel(btnPicker, pickerPanel); });
  if (btnDs && dsPanel) btnDs.addEventListener('click', function () { togglePanel(btnDs, dsPanel, populateDsPanel); });
  if (btnBluep && bluepPanel) btnBluep.addEventListener('click', function () { togglePanel(btnBluep, bluepPanel, populateBlueprinterPanel); });
  if (btnMatch && matchPanel) btnMatch.addEventListener('click', function () { togglePanel(btnMatch, matchPanel); });
  if (btnLighthouse && lhPanel) btnLighthouse.addEventListener('click', function () { togglePanel(btnLighthouse, lhPanel, populateLighthousePanel); });
  if (btnSeo && seoPanel) btnSeo.addEventListener('click', function () { togglePanel(btnSeo, seoPanel, populateSeoPanel); });
  if (btnScript && scriptPanel) btnScript.addEventListener('click', function () { togglePanel(btnScript, scriptPanel, loadScripts); });

  if (btnEvent && eventPanel) {
    btnEvent.addEventListener('click', function () {
      togglePanel(btnEvent, eventPanel, function () {
        getActiveTab(function (tab) {
          if (!tab || !tab.id) {
            setEventStatus('Cannot access the current tab.', 'error');
            return;
          }
          sendToTab(tab.id, { action: 'event_tracker_get' }, function (resp) {
            if (!resp || resp.error) {
              setEventStatus('Unable to read events.', 'error');
              return;
            }
            eventItems = resp.events || [];
            renderEvents(eventItems);
            updateEventToggle(resp.active);
            startEventPolling(tab);
          });
        });
      }, function () {
        stopEventPolling();
      });
    });
  }

  function updateEventToggle(isActive) {
    if (eventActivate)   eventActivate.disabled   = !!isActive;
    if (eventDeactivate) eventDeactivate.disabled = !isActive;
  }

  if (eventActivate) {
    eventActivate.addEventListener('click', function () {
      getActiveTab(function (tab) {
        if (!tab || !tab.id) { setEventStatus('Cannot access the current tab.', 'error'); return; }
        sendToTab(tab.id, { action: 'event_tracker_toggle', active: true }, function (resp) {
          if (!resp || resp.error) { setEventStatus('Unable to activate tracker.', 'error'); return; }
          updateEventToggle(resp.active);
          setEventStatus(resp.active ? 'Listening for events...' : 'Tracker stopped.');
        });
      });
    });
  }

  if (eventDeactivate) {
    eventDeactivate.addEventListener('click', function () {
      getActiveTab(function (tab) {
        if (!tab || !tab.id) { setEventStatus('Cannot access the current tab.', 'error'); return; }
        sendToTab(tab.id, { action: 'event_tracker_toggle', active: false }, function (resp) {
          if (!resp || resp.error) { setEventStatus('Unable to deactivate tracker.', 'error'); return; }
          updateEventToggle(resp.active);
          setEventStatus(resp.active ? 'Listening for events...' : 'Tracker stopped.');
        });
      });
    });
  }

  if (eventFilter) {
    eventFilter.addEventListener('change', function () {
      eventOpenId = null;
      renderEvents(eventItems || []);
      try { chrome.storage.local.set({ dd_event_filter: eventFilter.value }); } catch (e) {}
    });
  }

  function loadEventFilterPreference() {
    if (!eventFilter) return;
    try {
      chrome.storage.local.get(['dd_event_filter'], function (res) {
        if (res && res.dd_event_filter) {
          eventFilter.value = res.dd_event_filter;
        } else {
          eventFilter.value = 'segment';
          chrome.storage.local.set({ dd_event_filter: 'segment' });
        }
        renderEvents(eventItems || []);
      });
    } catch (e) {}
  }

  /* -- Match Analysis -- */

  function validateMatchUrls() {
    var a = (matchUrlA ? matchUrlA.value : '').trim();
    var b = (matchUrlB ? matchUrlB.value : '').trim();
    var valid = /^https:\/\/.+/i.test(a) && /^https:\/\/.+/i.test(b);
    if (matchAnalyse) matchAnalyse.disabled = !valid;
  }

  if (matchUrlA) matchUrlA.addEventListener('input', validateMatchUrls);
  if (matchUrlB) matchUrlB.addEventListener('input', validateMatchUrls);

  if (matchAnalyse) {
    matchAnalyse.addEventListener('click', function () {
      var a = (matchUrlA ? matchUrlA.value : '').trim();
      var b = (matchUrlB ? matchUrlB.value : '').trim();
      if (!a || !b) return;
      var url = chrome.runtime.getURL('match_analysis.html');
      url += '?urlA=' + encodeURIComponent(a) + '&urlB=' + encodeURIComponent(b);
      chrome.tabs.create({ url: url });
      window.close();
    });
  }

  /* -- Lighthouse Audit -- */
  var lhKeyLink = document.getElementById('lh-key-link');
  if (lhKeyLink) {
    lhKeyLink.addEventListener('click', function (e) {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://console.cloud.google.com/apis/credentials' });
    });
  }
  if (lhApiKey) {
    lhApiKey.addEventListener('blur', function () {
      var key = lhApiKey.value.trim();
      try { chrome.storage.local.set({ dd_lh_api_key: key }); } catch (e) {}
    });
  }

  if (lhRun) {
    lhRun.addEventListener('click', function () {
      getActiveTab(function (tab) {
        if (!tab || !tab.url || !/^https:\/\/.+/i.test(tab.url)) {
          setLhStatus('Cannot access this page URL.', 'error');
          return;
        }
        var apiKey = (lhApiKey ? lhApiKey.value : '').trim();
        if (apiKey) {
          try { chrome.storage.local.set({ dd_lh_api_key: apiKey }); } catch (e) {}
        }
        var url = chrome.runtime.getURL('lighthouse_report.html');
        url += '?url=' + encodeURIComponent(tab.url);
        if (apiKey) url += '&key=' + encodeURIComponent(apiKey);
        chrome.tabs.create({ url: url });
        window.close();
      });
    });
  }

  /* -- Help Modal -- */
  if (helpBtn && helpModal) {
    var closeHelpEls = helpModal.querySelectorAll('[data-close-help]');
    function openHelp()  { helpModal.classList.add('is-open');    helpModal.setAttribute('aria-hidden', 'false'); }
    function closeHelp() { helpModal.classList.remove('is-open'); helpModal.setAttribute('aria-hidden', 'true');  }
    helpBtn.addEventListener('click', openHelp);
    closeHelpEls.forEach(function (el) { el.addEventListener('click', closeHelp); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeHelp(); });
  }

  /* -- Screenshot Panel -- */
  if (shotComponent) { shotComponent.addEventListener('click', function () { setShotStatus('Select a component to capture...', ''); startScreenshot('component'); }); }
  if (shotVisible)   { shotVisible.addEventListener('click',   function () { setShotStatus('Capturing visible area...',          ''); startScreenshot('visible');   }); }
  if (shotFull)      { shotFull.addEventListener('click',      function () { setShotStatus('Capturing full page (do not move mouse)...', ''); startScreenshot('full'); }); }

  /* -- Script Finder -- */
  if (scriptSearch) {
    scriptSearch.addEventListener('input', function () {
      getActiveTab(function (tab) {
        if (!tab || !tab.id) return;
        chrome.runtime.sendMessage({ action: 'get_blocked_scripts', tabId: tab.id }, function (blockedResp) {
          var blocked = (blockedResp && blockedResp.blocked) ? blockedResp.blocked : {};
          renderScripts(tab, scriptItems || [], blocked, scriptSearch.value || '');
        });
      });
    });
  }

  var scriptCache = {};
  var scriptItems = [];

  function loadScripts() {
    if (!scriptList) return;
    scriptList.innerHTML = '';
    setScriptStatus('Scanning scripts...');
    getActiveTab(function (tab) {
      if (!tab || !tab.id) { setScriptStatus('Cannot access the current tab.', 'error'); return; }
      sendToTab(tab.id, { action: 'collect_scripts' }, function (resp) {
        if (!resp || resp.error) { setScriptStatus('Unable to read scripts from this page.', 'error'); return; }
        var scripts = (resp.scripts || []).filter(function (item) { return item && item.type === 'external'; });
        chrome.runtime.sendMessage({ action: 'get_blocked_scripts', tabId: tab.id }, function (blockedResp) {
          var blocked = (blockedResp && blockedResp.blocked) ? blockedResp.blocked : {};
          scriptItems = scripts;
          renderScripts(tab, scripts, blocked, (scriptSearch && scriptSearch.value) ? scriptSearch.value : '');
        });
      });
    });
  }

  function renderScripts(tab, scripts, blocked, query) {
    scriptList.innerHTML = '';
    var q        = (query || '').trim().toLowerCase();
    var filtered = scripts.filter(function (item) {
      if (!q) return true;
      var name   = (item.name   || '').toLowerCase();
      var vendor = (item.vendor || '').toLowerCase();
      return name.indexOf(q) >= 0 || vendor.indexOf(q) >= 0;
    });
    if (!filtered.length) {
      setScriptStatus(q ? 'No scripts match your search.' : 'No scripts detected.', 'error');
      return;
    }
    clearScriptStatus();
    scriptCache = {};

    filtered.forEach(function (item) {
      scriptCache[item.id] = item;
      var isExternal   = item.type === 'external';
      var baseUrl      = item.url ? item.url.split('#')[0].split('?')[0] : '';
      var isBlocked    = baseUrl && blocked && blocked[baseUrl];
      var title        = formatScriptName(item.name || 'Script');
      var disableLabel = isBlocked ? 'Enable' : 'Disable';
      var disableClass = isBlocked ? 'script-btn success' : 'script-btn primary';

      var html = '' +
        '<div class="script-item">' +
          '<div class="script-row">' +
            '<div class="script-title">' + title + '</div>' +
          '</div>' +
          '<div class="script-actions">' +
            '<button class="script-btn" data-copy-script="' + item.id + '">Copy Script</button>' +
            '<button class="' + disableClass + '" data-disable-script="' + item.id + '"' + (!isExternal ? ' disabled' : '') + '>' + disableLabel + '</button>' +
          '</div>' +
        '</div>';
      scriptList.insertAdjacentHTML('beforeend', html);
    });

    scriptList.querySelectorAll('[data-copy-script]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id     = btn.getAttribute('data-copy-script');
        var script = scriptCache[id];
        if (!script) return;
        if (script.inline && script.code) {
          copyToClipboard(script.code, function () { setScriptStatus('Inline script copied.', 'success'); });
          return;
        }
        if (!script.url) { setScriptStatus('Script URL unavailable.', 'error'); return; }
        setScriptStatus('Fetching script...', '');
        chrome.runtime.sendMessage({ action: 'fetch_script_text', url: script.url }, function (res) {
          if (res && res.text) {
            copyToClipboard(res.text, function () { setScriptStatus('Script copied.', 'success'); });
          } else {
            copyToClipboard(script.url, function () { setScriptStatus('Copied script URL.', 'success'); });
          }
        });
      });
    });

    scriptList.querySelectorAll('[data-disable-script]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id     = btn.getAttribute('data-disable-script');
        var script = scriptCache[id];
        if (!script || !script.url) return;
        var baseUrl     = script.url.split('#')[0].split('?')[0];
        var isBlockedNow = baseUrl && blocked && blocked[baseUrl];
        if (isBlockedNow) {
          setScriptStatus('Re-enabling script and reloading...', '');
          chrome.runtime.sendMessage({ action: 'unblock_script', url: script.url, tabId: tab.id }, function (res) {
            if (!res || !res.ok) { setScriptStatus('Unable to enable this script.', 'error'); return; }
            blocked[baseUrl] = false;
            renderScripts(tab, scriptItems || [], blocked, (scriptSearch && scriptSearch.value) ? scriptSearch.value : '');
            chrome.tabs.reload(tab.id);
            setScriptStatus('Enabled. Reloading...', 'success');
          });
          return;
        }
        setScriptStatus('Blocking script and reloading...', '');
        chrome.runtime.sendMessage({ action: 'block_script', url: script.url, tabId: tab.id }, function (res) {
          if (!res || !res.ok) { setScriptStatus('Unable to block this script.', 'error'); return; }
          blocked[baseUrl] = true;
          renderScripts(tab, scriptItems || [], blocked, (scriptSearch && scriptSearch.value) ? scriptSearch.value : '');
          chrome.tabs.reload(tab.id);
          setScriptStatus('Blocked. Reloading...', 'success');
        });
      });
    });
  }

  /* -- SEO Analysis -- */

  function collectSeoSignals() {
    /* Self-contained: runs in the page's isolated world via chrome.scripting.executeScript */
    function qa(sel)   { return document.querySelector(sel); }
    function qAll(sel) { return Array.from(document.querySelectorAll(sel)); }
    function metaContent(name) {
      var el = qa('meta[name="' + name + '"]') || qa('meta[name="' + name.toLowerCase() + '"]');
      return el ? (el.getAttribute('content') || '').trim() : '';
    }
    function metaProp(prop) {
      var el = qa('meta[property="' + prop + '"]');
      return el ? (el.getAttribute('content') || '').trim() : '';
    }
    function linkHref(rel) {
      var el = qa('link[rel="' + rel + '"]');
      return el ? (el.getAttribute('href') || '').trim() : '';
    }

    var title           = (document.title || '').trim();
    var metaDescription = metaContent('description');
    var metaRobots      = metaContent('robots');
    var canonical       = linkHref('canonical');

    var h1s = qAll('h1').map(function (el) { return (el.innerText || '').trim(); }).filter(Boolean);
    var h2s = qAll('h2').map(function (el) { return (el.innerText || '').trim(); }).filter(Boolean);
    var h3s = qAll('h3').map(function (el) { return (el.innerText || '').trim(); }).filter(Boolean);

    var bodyText  = document.body ? (document.body.innerText || '') : '';
    var wordCount = bodyText.split(/\s+/).filter(function (w) { return w.trim().length > 0; }).length;

    var firstParagraph = '';
    var paras = qAll('p');
    for (var i = 0; i < paras.length; i++) {
      var pt = (paras[i].innerText || '').trim();
      if (pt.split(/\s+/).length >= 8) { firstParagraph = pt; break; }
    }

    var images = qAll('img').map(function (img) {
      return {
        src:    img.src || '',
        alt:    img.hasAttribute('alt') ? (img.getAttribute('alt') || '').trim() : null,
        hasAlt: img.hasAttribute('alt') && (img.getAttribute('alt') || '').trim().length > 0,
        isLazy: img.getAttribute('loading') === 'lazy'
      };
    }).filter(function (img) { return img.src && img.src.indexOf('data:') === -1; });

    var origin        = location.origin;
    var internalLinks = [];
    var externalLinks = [];
    qAll('a[href]').forEach(function (a) {
      var href = a.href || '';
      var text = (a.innerText || a.textContent || '').trim();
      if (!href || href === '#' || href.indexOf('javascript:') === 0) return;
      var isExt = true;
      try { isExt = new URL(href).origin !== origin; } catch (e) {}
      if (isExt) { externalLinks.push({ href: href, text: text }); }
      else        { internalLinks.push({ href: href, text: text }); }
    });

    var jsonLd = [];
    qAll('script[type="application/ld+json"]').forEach(function (el) {
      try { jsonLd.push(JSON.parse(el.textContent)); } catch (e) {}
    });

    var schemaTypes = [];
    jsonLd.forEach(function (ld) {
      if (ld['@type']) schemaTypes.push(ld['@type']);
      if (ld['@graph']) {
        ld['@graph'].forEach(function (item) { if (item && item['@type']) schemaTypes.push(item['@type']); });
      }
    });
    qAll('[itemtype]').forEach(function (el) {
      var t = (el.getAttribute('itemtype') || '').replace(/.*\//, '');
      if (t) schemaTypes.push(t);
    });

    var ogTags = {};
    qAll('meta[property^="og:"]').forEach(function (el) {
      ogTags[el.getAttribute('property')] = el.getAttribute('content') || '';
    });
    var twitterTags = {};
    qAll('meta[name^="twitter:"]').forEach(function (el) {
      twitterTags[el.getAttribute('name')] = el.getAttribute('content') || '';
    });

    var viewport       = metaContent('viewport');
    var hasArticleEl   = !!qa('article');
    var hasPublishDate = !!(qa('time[datetime]') || qa('[itemprop="datePublished"]') || qa('[class*="publish"]'));
    var hasAuthor      = !!(qa('[itemprop="author"]') || qa('[rel="author"]') || qa('[class*="author"]'));
    var bodyLower      = bodyText.substring(0, 3000).toLowerCase();
    var hasPriceEl     = !!(qa('[itemprop="price"]') || qa('[class*="price"]') || /\$\d+|\u20AC\d+|\u00A3\d+/.test(bodyText.substring(0, 2000)));
    var hasCartCta     = !!(qa('[class*="add-to-cart"]') || qa('[class*="addtocart"]') || /add to cart|buy now|add to bag/i.test(bodyLower));

    function hasSchemaType(pattern) {
      return schemaTypes.some(function (t) { return new RegExp(pattern, 'i').test(t); });
    }
    var hasProductSchema   = hasSchemaType('Product');
    var hasArticleSchema   = hasSchemaType('Article|BlogPosting|NewsArticle|TechArticle');
    var hasBreadcrumbSchema = hasSchemaType('BreadcrumbList');
    var hasBreadcrumbs     = !!(hasBreadcrumbSchema || qa('[class*="breadcrumb" i]') || qa('[itemtype*="BreadcrumbList"]') || qa('nav[aria-label*="breadcrumb" i]'));

    var navigationLinkCount = qAll('nav a, header a').length;
    var sectionCount        = qAll('section').length;
    var hasPagination       = !!(qa('[class*="pagination" i]') || qa('a[rel="next"]') || qa('a[rel="prev"]'));
    var hasItemCards        = qAll('[class*="card" i], [class*="product-item" i], [class*="listing-item" i]').length >= 4;
    var isRootUrl           = location.pathname === '/' || location.pathname === '' || location.pathname === '/index.html';
    var listCount           = qAll('ul, ol').length;
    var tableCount          = qAll('table').length;
    var slug                = location.pathname.replace(/\.[^.]+$/, '').replace(/^\/|\/$/g, '').replace(/-/g, ' ');

    var sentences = bodyText.split(/[.!]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.split(/\s+/).length >= 3; });

    var passiveCount     = (bodyText.match(/\b(was|were|is|are|been|be)\s+\w+ed\b/gi) || []).length;
    var passiveVoiceEstimate = sentences.length > 5 ? passiveCount / sentences.length : 0;

    var transWords = ['however','therefore','furthermore','moreover','additionally','consequently','nevertheless','meanwhile','subsequently','accordingly','although','because','since','whereas','despite','thus','hence','firstly','secondly','finally'];
    var transCount = transWords.reduce(function (n, w) { return n + (bodyLower.indexOf(w) !== -1 ? 1 : 0); }, 0);
    var transitionWordRatio = sentences.length > 5 ? transCount / sentences.length : 0;

    var longSentences   = sentences.filter(function (s) { return s.split(/\s+/).length > 25; }).length;
    var longSentenceRatio = sentences.length > 5 ? longSentences / sentences.length : 0;

    return {
      url: location.href, title: title, metaDescription: metaDescription, metaRobots: metaRobots,
      canonical: canonical, h1s: h1s, h2s: h2s, h3s: h3s,
      wordCount: wordCount, bodyText: bodyText.substring(0, 6000),
      firstParagraph: firstParagraph.substring(0, 1500),
      images: images.slice(0, 80), internalLinks: internalLinks.slice(0, 150), externalLinks: externalLinks.slice(0, 80),
      jsonLd: jsonLd, schemaTypes: schemaTypes, ogTags: ogTags, twitterTags: twitterTags, viewport: viewport,
      hasArticleEl: hasArticleEl, hasPublishDate: hasPublishDate, hasAuthor: hasAuthor,
      hasPriceEl: hasPriceEl, hasCartCta: hasCartCta, hasProductSchema: hasProductSchema,
      hasArticleSchema: hasArticleSchema, hasBreadcrumbSchema: hasBreadcrumbSchema, hasBreadcrumbs: hasBreadcrumbs,
      navigationLinkCount: navigationLinkCount, sectionCount: sectionCount, hasPagination: hasPagination,
      hasItemCards: hasItemCards, isRootUrl: isRootUrl, listCount: listCount, tableCount: tableCount, slug: slug,
      passiveVoiceEstimate: passiveVoiceEstimate, transitionWordRatio: transitionWordRatio, longSentenceRatio: longSentenceRatio
    };
  }
  if (seoRun) {
    seoRun.addEventListener('click', function () {
      getActiveTab(function (tab) {
        if (!tab || !tab.url || !/^https:\/\/.+/i.test(tab.url)) {
          setSeoStatus('Cannot access this page URL.', 'error');
          return;
        }
        setSeoStatus('Collecting SEO signals...', '');
        seoRun.disabled = true;
        chrome.scripting.executeScript(
          { target: { tabId: tab.id }, func: collectSeoSignals },
          function (results) {
            seoRun.disabled = false;
            if (chrome.runtime.lastError) {
              setSeoStatus('Could not access this page: ' + chrome.runtime.lastError.message, 'error');
              return;
            }
            var signals = results && results[0] && results[0].result;
            if (!signals) {
              setSeoStatus('Failed to collect SEO data from this page.', 'error');
              return;
            }
            signals.capturedAt = Date.now();
            chrome.storage.local.set({ dd_seo_data: signals }, function () {
              var url = chrome.runtime.getURL('seo_report.html');
              url += '?url=' + encodeURIComponent(tab.url);
              chrome.tabs.create({ url: url });
              window.close();
            });
          }
        );
      });
    });
  }

  /* -- Init -- */
  clearStatus();
  setButtonsEnabled(true);
  loadEventFilterPreference();

})();



