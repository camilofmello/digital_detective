(function () {
  'use strict';

  function getStorageArea() {
    if (chrome && chrome.storage && chrome.storage.session) return chrome.storage.session;
    if (chrome && chrome.storage && chrome.storage.local) return chrome.storage.local;
    return null;
  }

  function setStatus(msg) {
    var loading = document.getElementById('loadingState');
    if (!loading) return;
    loading.querySelector('.status').textContent = msg;
  }

  function parseSourceHtml(root) {
    var source = '';
    try {
      var node = root.querySelector('#dd-source-html');
      if (node) {
        var data = JSON.parse(node.textContent || '{}');
        source = data.html || '';
      }
    } catch (e) {}
    return source;
  }

  function extractStyles(doc) {
    var styles = '';
    try {
      var nodes = doc.querySelectorAll('style');
      nodes.forEach(function (s) { styles += s.textContent || ''; });
    } catch (e) {}
    return styles;
  }

  function renderReport(html, filename) {
    var root = document.getElementById('reportRoot');
    var loading = document.getElementById('loadingState');
    if (!root) return;
    if (loading) loading.style.display = 'none';

    var parser = new DOMParser();
    var doc = parser.parseFromString(html || '', 'text/html');

    if (doc.title) document.title = doc.title;

    // Inject styles from report into viewer head.
    var styleText = extractStyles(doc);
    if (styleText) {
      var styleEl = document.createElement('style');
      styleEl.textContent = styleText;
      document.head.appendChild(styleEl);
    }

    root.innerHTML = doc.body ? doc.body.innerHTML : (html || '');

    var saveBtn = root.querySelector('#saveReport');
    if (saveBtn) {
      saveBtn.textContent = 'SAVE HTML';
      if (window.DDReportUtils) {
        window.DDReportUtils.bindSaveButton(saveBtn, filename || 'report.html');
      }
    }

    var sourceHtml = parseSourceHtml(root);
    var codeModal = root.querySelector('#codeModal');
    var openCode = root.querySelector('[data-open-code]');
    if (codeModal && openCode && window.DDReportUtils) {
      window.DDReportUtils.bindCodeModal({
        modal: codeModal,
        openBtn: openCode,
        getHtml: function () { return sourceHtml; }
      });
    }

    if (window.DDReportUtils) {
      window.DDReportUtils.bindPreviewDownloads({
        desktopBtn: root.querySelector('[data-download-preview="desktop"]'),
        mobileBtn: root.querySelector('[data-download-preview="mobile"]'),
        desktopFrame: root.querySelector('[data-preview-desktop]'),
        mobileFrame: root.querySelector('[data-preview-mobile]'),
        filenameBase: 'component'
      });
    }
  }

  function init() {
    var params = new URLSearchParams(window.location.search || '');
    var rid = params.get('rid');
    if (!rid) {
      setStatus('Missing report id.');
      return;
    }
    var storage = getStorageArea();
    if (!storage) {
      setStatus('Storage unavailable.');
      return;
    }
    var key = 'dd_report_' + rid;
    storage.get(key, function (items) {
      var payload = items ? items[key] : null;
      if (!payload || !payload.html) {
        setStatus('Report not found.');
        return;
      }
      try { storage.remove(key); } catch (e) {}
      renderReport(payload.html, payload.filename || 'report.html');
    });
  }

  init();
})();
