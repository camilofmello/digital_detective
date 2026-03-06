(function () {
  'use strict';

  var state = {
    tabId: null,
    sourceUrl: ''
  };

  try {
    var qp = new URLSearchParams(window.location.search || '');
    var tabIdParam = qp.get('tabId');
    if (tabIdParam) state.tabId = parseInt(tabIdParam, 10);
    var sourceUrlParam = qp.get('sourceUrl');
    if (sourceUrlParam) state.sourceUrl = sourceUrlParam;
  } catch (e) {}

  var scopePanel = document.getElementById('scope-panel');
  var elementPanel = document.getElementById('element-panel');
  var htmlInput = document.querySelector('[data-html]');
  var backBtn = document.querySelector('[data-back]');
  var generateBtn = document.querySelector('[data-generate]');
  var statusEl = document.getElementById('status');
  var statusText = document.getElementById('status-text');
  var spinnerEl = document.getElementById('spinner');
  var sourceNote = document.getElementById('source-note');
  var lastReport = { html: '', filename: '', url: '' };

  if (sourceNote) {
    sourceNote.textContent = 'Source: ' + (state.sourceUrl || '—');
  }

  function setStatus(msg, type) {
    statusEl.className = 'status is-active' + (type ? ' is-' + type : '');
    statusText.textContent = msg;
    spinnerEl.style.display = type === 'success' || type === 'error' ? 'none' : '';
  }

  function clearStatus() {
    statusEl.className = 'status';
  }

  function sendToTab(payload) {
    return new Promise(function (resolve) {
      if (!state.tabId) return resolve({ error: 'No active tab' });
      chrome.tabs.sendMessage(state.tabId, payload, function (response) {
        if (chrome.runtime.lastError) {
          chrome.scripting.executeScript(
            { target: { tabId: state.tabId }, files: ['content.js'] },
            function () {
              if (chrome.runtime.lastError) {
                return resolve({ error: 'Cannot inject content script' });
              }
              chrome.tabs.sendMessage(state.tabId, payload, function (resp2) {
                resolve(resp2 || { error: 'No response' });
              });
            }
          );
          return;
        }
        resolve(response || { error: 'No response' });
      });
    });
  }

  function downloadReport(html, filename) {
    chrome.runtime.sendMessage({
      action: 'download_report',
      html: html,
      filename: filename
    });
  }

  function openReport(html, filename) {
    if (!html) return false;
    chrome.runtime.sendMessage({
      action: 'open_report_viewer',
      html: html,
      filename: filename || 'design_system_report.html'
    });
    return true;
  }

  function handleResponse(resp, filename) {
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
    var opened = openReport(resp.html, filename);
    if (opened) {
      setStatus('Report opened in a new tab.', 'success');
    } else {
      setStatus('Popup blocked. Allow popups to open the report.', 'error');
    }
  }

  function scopeToElement() {
    scopePanel.classList.add('hidden');
    elementPanel.classList.remove('hidden');
    clearStatus();
  }

  function scopeToPage() {
    setStatus('Collecting CSS from page...');
    sendToTab({ action: 'extract_ds' }).then(function (resp) {
      handleResponse(resp, 'design_system_report.html');
    });
  }

  Array.from(scopePanel.querySelectorAll('[data-scope]')).forEach(function (btn) {
    btn.addEventListener('click', function () {
      var scope = btn.getAttribute('data-scope');
      if (scope === 'page') scopeToPage();
      if (scope === 'element') scopeToElement();
    });
  });

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      elementPanel.classList.add('hidden');
      scopePanel.classList.remove('hidden');
      clearStatus();
    });
  }

  if (generateBtn) {
    generateBtn.addEventListener('click', function () {
      var html = (htmlInput.value || '').trim();
      if (!html) {
        setStatus('Please paste the component HTML.', 'error');
        return;
      }
      setStatus('Analyzing selected component...');
      sendToTab({ action: 'extract_ds_html', html: html }).then(function (resp) {
        handleResponse(resp, 'design_system_report_scoped.html');
      });
    });
  }

})();
