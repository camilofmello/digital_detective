(function () {
  'use strict';

  function downloadBlob(blob, filename) {
    if (!blob) return;
    try {
      var blobUrl = URL.createObjectURL(blob);
      if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
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

  function saveDocumentAsHtml(filename) {
    var html = '<!doctype html>\n' + document.documentElement.outerHTML;
    var blob = new Blob([html], { type: 'text/html' });
    if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
      downloadBlob(blob, filename || 'report.html');
      return;
    }
    if (window.showSaveFilePicker) {
      window.showSaveFilePicker({
        suggestedName: filename || 'report.html',
        types: [{ description: 'HTML', accept: { 'text/html': ['.html'] } }]
      }).then(function (handle) {
        return handle.createWritable().then(function (writable) {
          return writable.write(blob).then(function () { return writable.close(); });
        });
      }).catch(function () { downloadBlob(blob, filename || 'report.html'); });
      return;
    }
    downloadBlob(blob, filename || 'report.html');
  }

  function bindSaveButton(btn, filename) {
    if (!btn) return;
    btn.addEventListener('click', function () {
      saveDocumentAsHtml(filename || 'report.html');
    });
  }

  function bindCodeModal(opts) {
    var modal = opts && opts.modal;
    var openBtn = opts && opts.openBtn;
    var getHtml = opts && opts.getHtml;
    if (!modal || !openBtn) return;
    var codeView = modal.querySelector('[data-code-view]');
    var closeEls = modal.querySelectorAll('[data-close-code]');
    function openModal() {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      if (codeView) {
        var html = (typeof getHtml === 'function') ? (getHtml() || '') : '';
        codeView.textContent = html;
      }
    }
    function closeModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
    openBtn.addEventListener('click', openModal);
    Array.prototype.slice.call(closeEls).forEach(function (el) { el.addEventListener('click', closeModal); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  }

  function getBodyAttrs(doc) {
    if (!doc || !doc.body || !doc.body.attributes) return '';
    var out = [];
    Array.prototype.slice.call(doc.body.attributes).forEach(function (a) {
      if (!a || !a.name) return;
      out.push(a.name + '="' + String(a.value).replace(/"/g, '&quot;') + '"');
    });
    return out.join(' ');
  }

  function getStyleText(doc) {
    if (!doc) return '';
    var css = '';
    var styles = doc.querySelectorAll('style');
    Array.prototype.slice.call(styles).forEach(function (s) { css += s.textContent || ''; });
    return css;
  }

  function buildPreviewSvg(doc, width, height) {
    if (!doc) return '';
    var html = doc.body ? doc.body.innerHTML : '';
    var css = getStyleText(doc);
    var bodyAttrs = getBodyAttrs(doc);
    var wrapperAttrs = bodyAttrs ? ' ' + bodyAttrs : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
      '<foreignObject width="100%" height="100%">' +
      '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' + width + 'px;height:' + height + 'px;">' +
      '<style>body{margin:0;}' + css + '</style>' +
      '<div' + wrapperAttrs + '>' + html + '</div>' +
      '</div>' +
      '</foreignObject>' +
      '</svg>';
  }

  function downloadIframeImage(frame, filenameBase) {
    if (!frame || !frame.contentDocument) return;
    var doc = frame.contentDocument;
    var rect = frame.getBoundingClientRect();
    var width = Math.max(Math.round(rect.width || 0), 320);
    var height = Math.max(Math.round(rect.height || 0), 200);
    try {
      height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, height);
    } catch (e) {}
    var svg = buildPreviewSvg(doc, width, height);
    if (!svg) return;
    var svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    var svgUrl = URL.createObjectURL(svgBlob);
    var img = new Image();
    img.onload = function () {
      try { URL.revokeObjectURL(svgUrl); } catch (e) {}
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(function (blob) {
        if (!blob) {
          downloadBlob(svgBlob, (filenameBase || 'component') + '.svg');
          return;
        }
        downloadBlob(blob, (filenameBase || 'component') + '.png');
      }, 'image/png', 0.92);
    };
    img.onerror = function () {
      try { URL.revokeObjectURL(svgUrl); } catch (e) {}
      downloadBlob(svgBlob, (filenameBase || 'component') + '.svg');
    };
    img.src = svgUrl;
  }

  function bindPreviewDownloads(opts) {
    if (!opts) return;
    var desktopBtn = opts.desktopBtn;
    var mobileBtn = opts.mobileBtn;
    var desktopFrame = opts.desktopFrame;
    var mobileFrame = opts.mobileFrame;
    var base = opts.filenameBase || 'component';
    if (desktopBtn && desktopFrame) {
      desktopBtn.addEventListener('click', function () {
        downloadIframeImage(desktopFrame, base + '-desktop');
      });
    }
    if (mobileBtn && mobileFrame) {
      mobileBtn.addEventListener('click', function () {
        downloadIframeImage(mobileFrame, base + '-mobile');
      });
    }
  }

  window.DDReportUtils = {
    downloadBlob: downloadBlob,
    saveDocumentAsHtml: saveDocumentAsHtml,
    bindSaveButton: bindSaveButton,
    bindCodeModal: bindCodeModal,
    bindPreviewDownloads: bindPreviewDownloads
  };
})();
