/* Digital Detective - DS Extraction Engine (content script)
 * Full JavaScript port of ds_extractor.py
 * Uses document.styleSheets to access all browser-loaded CSS (including external).
 */
(function () {
  'use strict';

  // Guard against double-injection
  if (window.__digitalDetectiveLoaded) return;
  window.__digitalDetectiveLoaded = true;

  // --- Element Picker (v1.1) ---
  var pickerState = {
    active: false,
    overlay: null,
    toolbar: null,
    hint: null,
    hintLine1: null,
    hintLine2: null,
    label: null,
    copyBtn: null,
    cancelBtn: null,
    selected: null,
    prevCursor: '',
    mode: 'copy',
    onMove: null,
    onClick: null,
    onContext: null,
    onKey: null,
    onScroll: null
  };

  var colorPickerState = {
    active: false,
    overlay: null,
    tip: null,
    modal: null,
    modalOk: null,
    modalBackdrop: null,
    modalKey: null,
    prevCursor: '',
    onClick: null,
    onKey: null
  };

  var eventTrackerState = {
    active: false,
    injected: false,
    events: [],
    maxEvents: 120,
    lastClick: null,
    onClick: null,
    onMessage: null,
    seq: 0,
    recent: {}
  };

  var messageModalState = {
    root: null,
    text: null,
    okBtn: null,
    timer: null,
    keyHandler: null
  };

  function ensurePickerUi() {
    if (pickerState.overlay && pickerState.toolbar) return;

    var overlay = document.createElement('div');
    overlay.id = 'dd-picker-overlay';
    overlay.style.position = 'fixed';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '2147483646';
    overlay.style.border = '2px solid #DD1234';
    overlay.style.background = 'rgba(221,18,52,0.08)';
    overlay.style.boxShadow = '0 0 0 1px rgba(221,18,52,0.2) inset';
    overlay.style.borderRadius = '6px';
    overlay.style.display = 'none';

    var toolbar = document.createElement('div');
    toolbar.id = 'dd-picker-toolbar';
    toolbar.style.position = 'fixed';
    toolbar.style.zIndex = '2147483647';
    toolbar.style.display = 'none';
    toolbar.style.alignItems = 'center';
    toolbar.style.gap = '8px';
    toolbar.style.background = '#111';
    toolbar.style.color = '#fff';
    toolbar.style.padding = '6px 8px';
    toolbar.style.borderRadius = '10px';
    toolbar.style.boxShadow = '0 10px 24px rgba(0,0,0,0.25)';
    toolbar.style.fontSize = '12px';
    toolbar.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    toolbar.style.pointerEvents = 'none';

    var label = document.createElement('span');
    label.style.maxWidth = '320px';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.style.whiteSpace = 'nowrap';

    var copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy HTML';
    copyBtn.style.background = '#DD1234';
    copyBtn.style.color = '#fff';
    copyBtn.style.border = 'none';
    copyBtn.style.borderRadius = '999px';
    copyBtn.style.padding = '4px 10px';
    copyBtn.style.fontSize = '11px';
    copyBtn.style.cursor = 'pointer';

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.background = 'transparent';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.border = '1px solid rgba(255,255,255,0.3)';
    cancelBtn.style.borderRadius = '999px';
    cancelBtn.style.padding = '4px 10px';
    cancelBtn.style.fontSize = '11px';
    cancelBtn.style.cursor = 'pointer';

    toolbar.appendChild(label);
    toolbar.appendChild(copyBtn);
    toolbar.appendChild(cancelBtn);

    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(toolbar);

    var hint = document.createElement('div');
    hint.id = 'dd-picker-hint';
    hint.style.position = 'fixed';
    hint.style.zIndex = '2147483647';
    hint.style.display = 'none';
    hint.style.pointerEvents = 'none';
    hint.style.background = '#111';
    hint.style.color = '#fff';
    hint.style.borderRadius = '10px';
    hint.style.overflow = 'hidden';
    hint.style.fontSize = '11px';
    hint.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    hint.style.boxShadow = '0 10px 24px rgba(0,0,0,0.25)';
    hint.style.border = '1px solid rgba(255,255,255,0.08)';
    hint.style.minWidth = '120px';

    var hintLine1 = document.createElement('div');
    hintLine1.textContent = 'Left Click To Copy HTML';
    hintLine1.style.padding = '6px 10px';
    hintLine1.style.background = 'rgba(255,255,255,0.04)';
    hintLine1.style.color = '#fff';
    hintLine1.style.fontWeight = '600';

    var hintLine2 = document.createElement('div');
    hintLine2.textContent = 'Right Click To Cancel';
    hintLine2.style.padding = '6px 10px';
    hintLine2.style.background = 'rgba(255,255,255,0.02)';
    hintLine2.style.color = '#e5e5e5';

    hint.appendChild(hintLine1);
    hint.appendChild(hintLine2);
    document.documentElement.appendChild(hint);

    pickerState.overlay = overlay;
    pickerState.toolbar = toolbar;
    pickerState.hint = hint;
    pickerState.hintLine1 = hintLine1;
    pickerState.hintLine2 = hintLine2;
    pickerState.label = label;
    pickerState.copyBtn = copyBtn;
    pickerState.cancelBtn = cancelBtn;

    toolbar.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
    });

    copyBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      if (!pickerState.selected) return;
      var html = pickerState.selected.outerHTML || '';
      copyToClipboard(html).then(function () {
        showToast('OuterHTML copied');
      }).catch(function () {
        showToast('Copy failed');
      });
    });

    cancelBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      stopPicker();
    });
  }

  function ensureMessageModal() {
    if (messageModalState.root) return;

    var root = document.createElement('div');
    root.id = 'dd-message-modal';
    root.style.position = 'fixed';
    root.style.inset = '0';
    root.style.zIndex = '2147483647';
    root.style.display = 'none';
    root.style.alignItems = 'center';
    root.style.justifyContent = 'center';
    root.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

    var backdrop = document.createElement('div');
    backdrop.style.position = 'absolute';
    backdrop.style.inset = '0';
    backdrop.style.background = 'rgba(0,0,0,0.10)';

    var card = document.createElement('div');
    card.style.position = 'relative';
    card.style.zIndex = '2';
    card.style.background = '#0F0F10';
    card.style.border = '1px solid rgba(221,18,52,0.45)';
    card.style.borderRadius = '14px';
    card.style.boxShadow = '0 16px 34px rgba(0,0,0,0.30)';
    card.style.padding = '16px 18px';
    card.style.minWidth = '280px';
    card.style.maxWidth = '360px';
    card.style.textAlign = 'center';

    var text = document.createElement('div');
    text.style.color = '#fff';
    text.style.fontSize = '13px';
    text.style.lineHeight = '1.45';
    text.style.marginBottom = '12px';
    text.textContent = '';

    var okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.textContent = 'OK';
    okBtn.style.background = '#DD1234';
    okBtn.style.color = '#fff';
    okBtn.style.border = 'none';
    okBtn.style.borderRadius = '999px';
    okBtn.style.padding = '8px 16px';
    okBtn.style.fontSize = '12px';
    okBtn.style.fontWeight = '700';
    okBtn.style.cursor = 'pointer';

    card.appendChild(text);
    card.appendChild(okBtn);
    root.appendChild(backdrop);
    root.appendChild(card);
    document.documentElement.appendChild(root);

    messageModalState.root = root;
    messageModalState.text = text;
    messageModalState.okBtn = okBtn;
  }

  function hideMessageModal() {
    if (!messageModalState.root) return;
    if (messageModalState.timer) {
      clearTimeout(messageModalState.timer);
      messageModalState.timer = null;
    }
    if (messageModalState.keyHandler) {
      document.removeEventListener('keydown', messageModalState.keyHandler, true);
      messageModalState.keyHandler = null;
    }
    messageModalState.root.style.display = 'none';
  }

  function showToast(msg, timeoutMs) {
    ensureMessageModal();
    if (!messageModalState.root || !messageModalState.text || !messageModalState.okBtn) return;
    if (messageModalState.timer) {
      clearTimeout(messageModalState.timer);
      messageModalState.timer = null;
    }
    if (messageModalState.keyHandler) {
      document.removeEventListener('keydown', messageModalState.keyHandler, true);
      messageModalState.keyHandler = null;
    }

    messageModalState.text.textContent = String(msg || '');
    messageModalState.root.style.display = 'flex';

    messageModalState.okBtn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      hideMessageModal();
    };

    messageModalState.keyHandler = function (e) {
      if (e.key === 'Escape' || e.key === 'Enter') hideMessageModal();
    };
    document.addEventListener('keydown', messageModalState.keyHandler, true);

    var waitMs = typeof timeoutMs === 'number' ? timeoutMs : 1200;
    if (waitMs > 0) {
      messageModalState.timer = setTimeout(function () {
        hideMessageModal();
      }, waitMs);
    }
  }

  function setPickerHint(mode) {
    if (!pickerState.hintLine1 || !pickerState.hintLine2) return;
    if (mode === 'ds') {
      pickerState.hintLine1.textContent = 'Left Click To Extract DS';
      pickerState.hintLine2.textContent = 'Right Click To Cancel';
      return;
    }
    if (mode === 'screenshot') {
      pickerState.hintLine1.textContent = 'Left Click To Capture';
      pickerState.hintLine2.textContent = 'Right Click To Cancel';
      return;
    }
    pickerState.hintLine1.textContent = 'Left Click To Copy HTML';
    pickerState.hintLine2.textContent = 'Right Click To Cancel';
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        ta.remove();
        if (ok) resolve(); else reject(new Error('execCommand failed'));
      } catch (err) {
        reject(err);
      }
    });
  }

  function describeEl(el) {
    if (!el) return '';
    var tag = (el.tagName || '').toLowerCase();
    var id = el.id ? ('#' + el.id) : '';
    var cls = '';
    if (el.classList && el.classList.length) {
      cls = '.' + Array.from(el.classList).slice(0, 4).join('.');
    }
    return (tag + id + cls).trim();
  }

  function isPickerUi(el) {
    if (!el) return false;
    if (el === pickerState.overlay || el === pickerState.toolbar) return true;
    if (el === pickerState.hint) return true;
    if (pickerState.toolbar && pickerState.toolbar.contains(el)) return true;
    return false;
  }

  function updateOverlay(el) {
    if (!el || !pickerState.overlay || !pickerState.toolbar) return;
    var rect = el.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;

    pickerState.overlay.style.display = 'block';
    pickerState.overlay.style.top = rect.top + 'px';
    pickerState.overlay.style.left = rect.left + 'px';
    pickerState.overlay.style.width = rect.width + 'px';
    pickerState.overlay.style.height = rect.height + 'px';

    pickerState.label.textContent = describeEl(el);

    var toolbarTop = rect.top - 36;
    var toolbarLeft = rect.left;
    if (toolbarTop < 8) toolbarTop = rect.bottom + 8;
    if (toolbarLeft + 360 > window.innerWidth) toolbarLeft = window.innerWidth - 360;
    if (toolbarLeft < 8) toolbarLeft = 8;

    if (pickerState.toolbar) pickerState.toolbar.style.display = 'none';

    if (pickerState.hint) {
      pickerState.hint.style.display = 'block';
      pickerState.hint.style.left = (rect.right - 8) + 'px';
      pickerState.hint.style.top = (rect.bottom - 8) + 'px';
      pickerState.hint.style.transform = 'translate(-100%, -100%)';
    }
  }

  function startPicker(mode) {
    if (pickerState.active) return;
    pickerState.active = true;
    pickerState.mode = mode || 'copy';
    ensurePickerUi();
    setPickerHint(pickerState.mode);
    pickerState.prevCursor = document.documentElement.style.cursor;
    document.documentElement.style.cursor = 'crosshair';

    pickerState.onMove = function (e) {
      if (!pickerState.active) return;
      if (isPickerUi(e.target)) return;
      pickerState.selected = e.target;
      updateOverlay(e.target);
    };
    pickerState.onClick = function (e) {
      if (!pickerState.active) return;
      if (isPickerUi(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      pickerState.selected = e.target;
      updateOverlay(e.target);
      if (pickerState.mode === 'ds') {
        var target = pickerState.selected;
        stopPicker();
        showToast('Extracting scoped DS...');
        setTimeout(function () { runScopedExtraction(target); }, 20);
        return;
      }
      if (pickerState.mode === 'screenshot') {
        var targetShot = pickerState.selected;
        stopPicker();
        showToast('Capturing component...');
        setTimeout(function () { captureComponentScreenshot(targetShot); }, 20);
        return;
      }
      var html = pickerState.selected ? (pickerState.selected.outerHTML || '') : '';
      if (!html) {
        showToast('No HTML found');
        return;
      }
      copyToClipboard(html).then(function () {
        showToast('OuterHTML copied');
        stopPicker();
      }).catch(function () {
        showToast('Copy failed');
      });
    };
    pickerState.onKey = function (e) {
      if (!pickerState.active) return;
      if (e.key === 'Escape') stopPicker();
    };
    pickerState.onContext = function (e) {
      if (!pickerState.active) return;
      if (isPickerUi(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      stopPicker();
      showToast('Picker cancelled');
    };
    pickerState.onScroll = function () {
      if (!pickerState.active) return;
      if (pickerState.selected) updateOverlay(pickerState.selected);
    };

    document.addEventListener('mousemove', pickerState.onMove, true);
    document.addEventListener('click', pickerState.onClick, true);
    document.addEventListener('contextmenu', pickerState.onContext, true);
    document.addEventListener('keydown', pickerState.onKey, true);
    window.addEventListener('scroll', pickerState.onScroll, true);

    showToast(pickerState.mode === 'ds' ? 'Select element for scoped DS' : 'Picker on: click an element');
  }

  function stopPicker() {
    if (!pickerState.active) return;
    pickerState.active = false;
    document.documentElement.style.cursor = pickerState.prevCursor || '';
    if (pickerState.overlay) pickerState.overlay.style.display = 'none';
    if (pickerState.toolbar) pickerState.toolbar.style.display = 'none';
    if (pickerState.hint) pickerState.hint.style.display = 'none';
    document.removeEventListener('mousemove', pickerState.onMove, true);
    document.removeEventListener('click', pickerState.onClick, true);
    document.removeEventListener('contextmenu', pickerState.onContext, true);
    document.removeEventListener('keydown', pickerState.onKey, true);
    window.removeEventListener('scroll', pickerState.onScroll, true);
  }

  function ensureColorPickerUi() {
    if (colorPickerState.overlay) return;

    var overlay = document.createElement('div');
    overlay.id = 'dd-color-picker-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '2147483647';
    overlay.style.display = 'none';
    overlay.style.alignItems = 'flex-end';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '16px';
    overlay.style.background = 'rgba(0,0,0,0.02)';
    overlay.style.cursor = 'crosshair';

    var tip = document.createElement('div');
    tip.textContent = 'Click to pick a color (Esc to cancel)';
    tip.style.background = '#111';
    tip.style.color = '#fff';
    tip.style.padding = '8px 12px';
    tip.style.borderRadius = '999px';
    tip.style.fontSize = '12px';
    tip.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    tip.style.boxShadow = '0 10px 24px rgba(0,0,0,0.25)';

    overlay.appendChild(tip);
    document.documentElement.appendChild(overlay);

    colorPickerState.overlay = overlay;
    colorPickerState.tip = tip;
  }

  function ensureColorPickerModal() {
    if (colorPickerState.modal) return;

    var modal = document.createElement('div');
    modal.id = 'dd-color-picker-modal';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.zIndex = '2147483647';
    modal.style.display = 'none';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

    var backdrop = document.createElement('div');
    backdrop.style.position = 'absolute';
    backdrop.style.inset = '0';
    backdrop.style.background = 'rgba(0,0,0,0.10)';

    var card = document.createElement('div');
    card.style.position = 'relative';
    card.style.zIndex = '2';
    card.style.background = '#0F0F10';
    card.style.border = '1px solid rgba(221,18,52,0.45)';
    card.style.borderRadius = '14px';
    card.style.boxShadow = '0 16px 34px rgba(0,0,0,0.30)';
    card.style.padding = '16px 18px';
    card.style.minWidth = '280px';
    card.style.maxWidth = '360px';
    card.style.textAlign = 'center';

    var msg = document.createElement('div');
    msg.textContent = "Click on any page element to copy it's HEX color value";
    msg.style.fontSize = '13px';
    msg.style.color = '#fff';
    msg.style.lineHeight = '1.45';
    msg.style.marginBottom = '12px';

    var ok = document.createElement('button');
    ok.textContent = 'OK';
    ok.style.background = '#DD1234';
    ok.style.color = '#fff';
    ok.style.border = 'none';
    ok.style.borderRadius = '999px';
    ok.style.padding = '8px 16px';
    ok.style.fontSize = '12px';
    ok.style.fontWeight = '700';
    ok.style.cursor = 'pointer';

    card.appendChild(msg);
    card.appendChild(ok);
    modal.appendChild(backdrop);
    modal.appendChild(card);
    document.documentElement.appendChild(modal);

    colorPickerState.modal = modal;
    colorPickerState.modalOk = ok;
    colorPickerState.modalBackdrop = backdrop;
  }

  function rgbStringToHex(color) {
    if (!color) return null;
    var m = color.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!m) return null;
    var r = Math.min(255, Math.max(0, parseInt(m[1], 10)));
    var g = Math.min(255, Math.max(0, parseInt(m[2], 10)));
    var b = Math.min(255, Math.max(0, parseInt(m[3], 10)));
    var hex = '#' + [r, g, b].map(function (v) {
      var s = v.toString(16).toUpperCase();
      return s.length === 1 ? ('0' + s) : s;
    }).join('');
    return hex;
  }

  function pickColorFromPoint(x, y) {
    if (!colorPickerState.overlay) return null;
    var overlay = colorPickerState.overlay;
    var prev = overlay.style.pointerEvents;
    overlay.style.pointerEvents = 'none';
    var el = document.elementFromPoint(x, y);
    overlay.style.pointerEvents = prev || '';
    if (!el) return null;
    var style = window.getComputedStyle(el);
    if (!style) return null;
    var bg = style.backgroundColor;
    var color = (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') ? bg : style.color;
    return rgbStringToHex(color);
  }

  function stopColorPicker(silent) {
    if (!colorPickerState.active) return;
    colorPickerState.active = false;
    document.documentElement.style.cursor = colorPickerState.prevCursor || '';
    if (colorPickerState.overlay) colorPickerState.overlay.style.display = 'none';
    if (colorPickerState.overlay && colorPickerState.onClick) colorPickerState.overlay.removeEventListener('click', colorPickerState.onClick, true);
    if (colorPickerState.onKey) document.removeEventListener('keydown', colorPickerState.onKey, true);
    if (colorPickerState.modal) colorPickerState.modal.style.display = 'none';
    if (colorPickerState.modalOk && colorPickerState.onModalOk) colorPickerState.modalOk.removeEventListener('click', colorPickerState.onModalOk, true);
    if (colorPickerState.modalBackdrop && colorPickerState.onModalCancel) colorPickerState.modalBackdrop.removeEventListener('click', colorPickerState.onModalCancel, true);
    if (colorPickerState.modalKey) document.removeEventListener('keydown', colorPickerState.modalKey, true);
    colorPickerState.onModalOk = null;
    colorPickerState.onModalCancel = null;
    colorPickerState.modalKey = null;
    if (!silent) showToast('Color picker cancelled');
  }

  function startColorPicker() {
    if (colorPickerState.active) return;
    if (pickerState.active) stopPicker();

    if (window.EyeDropper) {
      ensureColorPickerModal();
      colorPickerState.active = true;
      colorPickerState.modal.style.display = 'flex';

      colorPickerState.onModalOk = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (colorPickerState.modal) colorPickerState.modal.style.display = 'none';

        try {
          var eyeDropper = new window.EyeDropper();
          eyeDropper.open().then(function (result) {
            var hex = result && result.sRGBHex ? String(result.sRGBHex).toUpperCase() : null;
            if (!hex) {
              showToast('Color not found');
              return;
            }
            copyToClipboard(hex).then(function () {
              showToast('Hex Color Copied to Clipboard');
            }).catch(function () {
              showToast('Copy failed');
            });
          }).catch(function (err) {
            if (err && err.name === 'AbortError') {
              showToast('Color picker cancelled');
              return;
            }
            showToast('Color picker failed');
          }).finally(function () {
            colorPickerState.active = false;
          });
        } catch (err) {
          colorPickerState.active = false;
          showToast('Color picker failed');
        }
      };

      colorPickerState.onModalCancel = function (e) {
        e.preventDefault();
        e.stopPropagation();
        stopColorPicker();
      };

      colorPickerState.modalKey = function (e) {
        if (e.key === 'Escape') stopColorPicker();
      };

      if (colorPickerState.modalOk) colorPickerState.modalOk.addEventListener('click', colorPickerState.onModalOk, true);
      if (colorPickerState.modalBackdrop) colorPickerState.modalBackdrop.addEventListener('click', colorPickerState.onModalCancel, true);
      document.addEventListener('keydown', colorPickerState.modalKey, true);
      return;
    }

    // Fallback: no EyeDropper support, use click-to-pick via computed styles.
    ensureColorPickerUi();
    colorPickerState.active = true;
    colorPickerState.prevCursor = document.documentElement.style.cursor;
    document.documentElement.style.cursor = 'crosshair';
    colorPickerState.overlay.style.display = 'flex';

    colorPickerState.onClick = function (e) {
      if (!colorPickerState.active) return;
      e.preventDefault();
      e.stopPropagation();
      stopColorPicker(true);

      var fallbackHex = pickColorFromPoint(e.clientX, e.clientY);
      if (!fallbackHex) {
        showToast('Color not found');
        return;
      }
      copyToClipboard(fallbackHex).then(function () {
        showToast('Hex Color Copied to Clipboard');
      }).catch(function () {
        showToast('Copy failed');
      });
    };

    colorPickerState.onKey = function (e) {
      if (!colorPickerState.active) return;
      if (e.key === 'Escape') stopColorPicker();
    };

    colorPickerState.overlay.addEventListener('click', colorPickerState.onClick, true);
    document.addEventListener('keydown', colorPickerState.onKey, true);
  }

  function togglePicker() {
    if (pickerState.active) stopPicker(); else startPicker('copy');
  }

  // --- Event Tracker (Segment/Rudderstack) ---
  function injectEventTrackerScript() {
    if (eventTrackerState.injected) return;
    chrome.runtime.sendMessage({ action: 'event_tracker_inject' }, function (resp) {
      if (resp && resp.ok) {
        eventTrackerState.injected = true;
      }
    });
  }

  function normalizeEventMessage(msg) {
    var method = msg.method || msg.type || 'event';
    var args = Array.isArray(msg.args) ? msg.args : [];
    var payload = msg.payload || null;
    var name = '';
    if (method === 'track') {
      name = String(args[0] || '');
    } else if (method === 'page') {
      name = String(args[0] || 'page');
    } else if (method === 'identify') {
      name = 'identify';
    } else if (method === 'group') {
      name = 'group';
    } else if (method === 'alias') {
      name = 'alias';
    } else if (method === 'screen') {
      name = String(args[0] || 'screen');
    }

    if (!name && payload && payload.event && payload.event.event) {
      name = String(payload.event.event);
    }
    if (!name && payload && payload.event && payload.event.type) {
      name = String(payload.event.type);
    }

    var entry = {
      id: 'evt_' + Date.now() + '_' + (eventTrackerState.seq++),
      ts: msg.ts || Date.now(),
      provider: msg.provider || 'page',
      method: method,
      name: name || method,
      args: args,
      payload: payload,
      source: msg.provider || 'page'
    };

    if (eventTrackerState.lastClick) {
      var delta = entry.ts - eventTrackerState.lastClick.ts;
      if (delta >= 0 && delta <= 1500) {
        entry.click = eventTrackerState.lastClick;
      }
    }
    return entry;
  }

  function pushEvent(entry) {
    var signature = entry.provider + '|' + entry.method + '|' + entry.name + '|' + JSON.stringify(entry.payload || entry.args || {});
    var now = Date.now();
    if (eventTrackerState.recent[signature] && now - eventTrackerState.recent[signature] < 2000) {
      return;
    }
    eventTrackerState.recent[signature] = now;
    eventTrackerState.events.unshift(entry);
    if (eventTrackerState.events.length > eventTrackerState.maxEvents) {
      eventTrackerState.events.length = eventTrackerState.maxEvents;
    }
  }

  function startEventTracker() {
    if (eventTrackerState.active) return;
    eventTrackerState.active = true;
    injectEventTrackerScript();

    eventTrackerState.onClick = function (e) {
      eventTrackerState.lastClick = {
        ts: Date.now(),
        target: describeEl(e.target)
      };
    };

    eventTrackerState.onMessage = function (e) {
      var data = e.data;
      if (!data || data.source !== 'dd-event-tracker') return;
      var entry = normalizeEventMessage(data);
      pushEvent(entry);
    };

    document.addEventListener('click', eventTrackerState.onClick, true);
    window.addEventListener('message', eventTrackerState.onMessage, true);
  }

  function stopEventTracker() {
    if (!eventTrackerState.active) return;
    eventTrackerState.active = false;
    if (eventTrackerState.onClick) {
      document.removeEventListener('click', eventTrackerState.onClick, true);
      eventTrackerState.onClick = null;
    }
    if (eventTrackerState.onMessage) {
      window.removeEventListener('message', eventTrackerState.onMessage, true);
      eventTrackerState.onMessage = null;
    }
  }

  function loadEventTrackerPreference() {
    try {
      chrome.storage.local.get(['dd_event_tracker_active'], function (res) {
        if (res && res.dd_event_tracker_active) {
          startEventTracker();
        }
      });
    } catch (e) {}
  }

  // --- Screenshot Capture ---
  var screenshotBusy = false;

  function sendRuntimeMessage(payload) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage(payload, function (resp) {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(resp || { ok: false });
      });
    });
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function getPageMetrics() {
    var doc = document.documentElement;
    var body = document.body;
    var scrollHeight = Math.max(
      doc.scrollHeight, doc.offsetHeight, doc.clientHeight,
      body ? body.scrollHeight : 0, body ? body.offsetHeight : 0, body ? body.clientHeight : 0
    );
    var scrollWidth = Math.max(
      doc.scrollWidth, doc.offsetWidth, doc.clientWidth,
      body ? body.scrollWidth : 0, body ? body.offsetWidth : 0, body ? body.clientWidth : 0
    );
    return {
      width: scrollWidth,
      height: scrollHeight,
      viewportW: window.innerWidth,
      viewportH: window.innerHeight
    };
  }

  function sanitizeFilename(name) {
    return String(name || 'screenshot')
      .replace(/[\\/:*"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
  }

  function describeComponent(el) {
    if (!el) return 'component';
    if (el.id) return el.id;
    if (el.classList && el.classList.length) return el.classList[0];
    return (el.tagName || 'component').toLowerCase();
  }

  function createImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Image load failed')); };
      img.src = dataUrl;
    });
  }

  async function captureViewportImage() {
    var lastErr = 'capture_failed';
    for (var attempt = 0; attempt < 3; attempt++) {
      var resp = await sendRuntimeMessage({ action: 'capture_tab' });
      if (resp && resp.ok && resp.dataUrl) return resp.dataUrl;
      if (resp && resp.error) lastErr = resp.error;
      await wait(250 + attempt * 250);
    }
    throw new Error(lastErr || 'capture_failed');
  }

  function addFooterToCanvas(canvas, meta) {
    var font = '12px Arial, sans-serif';
    var lineHeight = 16;
    var lines = [];
    lines.push('Digital Detective v1.6 - Developed by Camilo Mello');
    if (meta && meta.url) lines.push('URL: ' + meta.url);
    if (meta && meta.date) lines.push('Date: ' + meta.date);
    if (meta && meta.component) lines.push('Component: ' + meta.component);
    var footerHeight = (lines.length * lineHeight) + 16;
    var out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height + footerHeight;
    var ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, canvas.height, out.width, footerHeight);
    ctx.fillStyle = '#111827';
    ctx.font = font;
    ctx.textBaseline = 'top';
    var y = canvas.height + 8;
    lines.forEach(function (line) {
      ctx.fillText(line, 12, y);
      y += lineHeight;
    });
    return out;
  }

  async function downloadCanvas(canvas, filename, meta) {
    var finalCanvas = addFooterToCanvas(canvas, meta || {});
    return new Promise(function (resolve) {
      finalCanvas.toBlob(function (blob) {
        if (!blob) {
          showToast('Failed to create image');
          resolve();
          return;
        }
        try {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = filename || 'screenshot.png';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 1000);
          resolve();
        } catch (e) {
          resolve();
        }
      }, 'image/png');
    });
  }

  function hideFixedElements() {
    var hidden = [];
    var nodes = document.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var style = window.getComputedStyle(el);
      if (!style) continue;
      if (style.position === 'fixed' || style.position === 'sticky') {
        hidden.push({ el: el, visibility: el.style.visibility });
        el.style.visibility = 'hidden';
      }
    }
    var styleTag = document.createElement('style');
    styleTag.setAttribute('data-dd-capture', '1');
    styleTag.textContent = '*{transition:none !important;animation:none !important;}';
    document.documentElement.appendChild(styleTag);
    return { hidden: hidden, styleTag: styleTag };
  }

  function restoreFixedElements(state) {
    if (!state) return;
    (state.hidden || []).forEach(function (item) {
      if (item.el) item.el.style.visibility = item.visibility || '';
    });
    if (state.styleTag && state.styleTag.remove) state.styleTag.remove();
  }

  function showCaptureOverlay(message, countdown) {
    var overlay = document.createElement('div');
    overlay.setAttribute('data-dd-capture-overlay', '1');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '2147483647';
    overlay.style.background = 'rgba(0,0,0,0.1)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    overlay.style.color = '#fff';
    overlay.style.textAlign = 'center';
    var box = document.createElement('div');
    box.style.background = '#0F0F10';
    box.style.border = '1px solid rgba(221,18,52,0.45)';
    box.style.borderRadius = '14px';
    box.style.padding = '16px 20px';
    box.style.boxShadow = '0 16px 34px rgba(0,0,0,0.30)';
    box.style.minWidth = '220px';
    var title = document.createElement('div');
    title.textContent = message || "Don't scroll your page";
    title.style.fontWeight = '700';
    title.style.fontSize = '14px';
    title.style.marginBottom = '6px';
    var counter = document.createElement('div');
    counter.textContent = countdown ? String(countdown) : '';
    counter.style.fontSize = '22px';
    counter.style.fontWeight = '700';
    box.appendChild(title);
    box.appendChild(counter);
    overlay.appendChild(box);
    document.documentElement.appendChild(overlay);
    return {
      el: overlay,
      counter: counter,
      remove: function () { overlay.remove(); }
    };
  }

  function hideOverlaysAboveZIndex(zIndexLimit) {
    var hidden = [];
    var nodes = document.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el || el === document.documentElement || el === document.body) continue;
      var style = window.getComputedStyle(el);
      if (!style) continue;
      var z = style.zIndex;
      if (z === 'auto') continue;
      var zVal = parseInt(z, 10);
      if (isNaN(zVal)) continue;
      if (zVal > zIndexLimit) {
        hidden.push({ el: el, display: el.style.display, visibility: el.style.visibility });
        el.style.display = 'none';
      }
    }
    return hidden;
  }

  function restoreHidden(hidden) {
    (hidden || []).forEach(function (item) {
      if (!item.el) return;
      item.el.style.display = item.display || '';
      item.el.style.visibility = item.visibility || '';
    });
  }

  async function captureVisibleScreenshot() {
    if (screenshotBusy) return;
    screenshotBusy = true;
    try {
      var url = location.href;
      var date = new Date().toLocaleString();
      var dataUrl = await captureViewportImage();
      var img = await createImage(dataUrl);
      var canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      await downloadCanvas(canvas, 'screenshot-visible.png', { url: url, date: date });
      showToast('Screenshot saved');
    } catch (e) {
      showToast('Screenshot failed');
    } finally {
      screenshotBusy = false;
    }
  }

  async function captureFullPageScreenshot() {
    if (screenshotBusy) return;
    screenshotBusy = true;
    var restoreState = null;
    var overlayState = null;
    try {
      var url = location.href;
      var date = new Date().toLocaleString();
      overlayState = showCaptureOverlay("Don't scroll your page", 3);
      await wait(800);
      if (overlayState && overlayState.counter) overlayState.counter.textContent = '2';
      await wait(800);
      if (overlayState && overlayState.counter) overlayState.counter.textContent = '1';
      await wait(800);
      if (overlayState) overlayState.remove();
      restoreState = hideFixedElements();
      window.scrollTo(0, 0);
      await wait(300);
      var metrics = getPageMetrics();
      var totalHeight = metrics.height;
      var viewportH = metrics.viewportH;
      var viewportW = metrics.viewportW;
      await wait(300);
      metrics = getPageMetrics();
      totalHeight = Math.max(totalHeight, metrics.height);
      viewportH = metrics.viewportH;
      viewportW = metrics.viewportW;

      var maxScroll = Math.max(totalHeight - viewportH, 0);
      var scrollPositions = [];
      for (var y = 0; y <= maxScroll; y += viewportH) scrollPositions.push(y);
      if (!scrollPositions.length) scrollPositions.push(0);
      if (scrollPositions[scrollPositions.length - 1] !== maxScroll) scrollPositions.push(maxScroll);

      var firstCapture = null;
      var scale = 1;
      var canvas = null;
      var ctx = null;
      var i = 0;

      while (i < scrollPositions.length) {
        var targetY = scrollPositions[i];
        window.scrollTo(0, targetY);
        var tries = 0;
        while (tries < 6) {
          await wait(320);
          if (Math.abs(window.scrollY - targetY) <= 2) break;
          tries += 1;
        }

        var dataUrl = await captureViewportImage();
        var img = await createImage(dataUrl);
        if (!firstCapture) {
          firstCapture = img;
          scale = img.width / viewportW;
          canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = Math.round(totalHeight * scale);
          ctx = canvas.getContext('2d');
        }
        var drawY = Math.round(targetY * scale);
        ctx.drawImage(img, 0, drawY);

        // Re-check page height for lazy-loaded growth.
        metrics = getPageMetrics();
        if (metrics.height > totalHeight + 2) {
          totalHeight = metrics.height;
          var newMax = Math.max(totalHeight - viewportH, 0);
          if (newMax > maxScroll) {
            maxScroll = newMax;
            var lastPos = scrollPositions[scrollPositions.length - 1];
            for (var ny = lastPos + viewportH; ny <= maxScroll; ny += viewportH) {
              scrollPositions.push(ny);
            }
            if (scrollPositions[scrollPositions.length - 1] !== maxScroll) scrollPositions.push(maxScroll);
            // Grow canvas if needed.
            var newHeightPx = Math.round(totalHeight * scale);
            if (canvas && newHeightPx > canvas.height) {
              var newCanvas = document.createElement('canvas');
              newCanvas.width = canvas.width;
              newCanvas.height = newHeightPx;
              var newCtx = newCanvas.getContext('2d');
              newCtx.drawImage(canvas, 0, 0);
              canvas = newCanvas;
              ctx = newCtx;
            }
          }
        }
        i += 1;
      }
      if (canvas) {
        await downloadCanvas(canvas, 'screenshot-full.png', { url: url, date: date });
        showToast('Full page saved');
      }
    } catch (e) {
      showToast('Full page failed');
    } finally {
      restoreFixedElements(restoreState);
      if (overlayState && overlayState.remove) overlayState.remove();
      screenshotBusy = false;
    }
  }

  async function captureComponentScreenshot(el) {
    if (screenshotBusy) return;
    if (!el) { showToast('No component selected'); return; }
    screenshotBusy = true;
    var hiddenOverlays = null;
    try {
      var zIndexVal = 0;
      try {
        var z = window.getComputedStyle(el).zIndex;
        zIndexVal = parseInt(z, 10);
        if (isNaN(zIndexVal)) zIndexVal = 0;
      } catch (e0) {}
      hiddenOverlays = hideOverlaysAboveZIndex(zIndexVal);
      var rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) throw new Error('Empty element');
      var url = location.href;
      var date = new Date().toLocaleString();
      var compName = describeComponent(el);
      var absTop = rect.top + window.scrollY;
      var absLeft = rect.left + window.scrollX;
      var width = rect.width;
      var height = rect.height;
      var viewportH = window.innerHeight;
      var viewportW = window.innerWidth;
      var start = absTop;
      var end = absTop + height;
      var scrollPositions = [];
      for (var y = start; y < end; y += viewportH) {
        scrollPositions.push(y);
      }
      if (scrollPositions.length) {
        var last = end - viewportH;
        if (last > start && scrollPositions[scrollPositions.length - 1] !== last) {
          scrollPositions.push(last);
        }
      }
      var firstImg = null;
      var scale = 1;
      var canvas = null;
      for (var i = 0; i < scrollPositions.length; i++) {
        window.scrollTo(0, scrollPositions[i]);
        await wait(260);
        var dataUrl = await captureViewportImage();
        var img = await createImage(dataUrl);
        if (!firstImg) {
          firstImg = img;
          scale = img.width / viewportW;
          canvas = document.createElement('canvas');
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
        }
        var scrollY = scrollPositions[i];
        var componentTopInView = absTop - scrollY;
        var componentBottomInView = absTop + height - scrollY;
        var cropTop = Math.max(0, componentTopInView);
        var cropBottom = Math.min(viewportH, componentBottomInView);
        var cropH = cropBottom - cropTop;
        if (cropH <= 0) continue;
        var cropX = Math.max(0, absLeft);
        var cropW = Math.min(width, viewportW - cropX);
        if (cropW <= 0) continue;
        var sx = Math.round(cropX * scale);
        var sy = Math.round(cropTop * scale);
        var sw = Math.round(cropW * scale);
        var sh = Math.round(cropH * scale);
        var dy = Math.round((scrollY + cropTop - absTop) * scale);
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, sw, sh, 0, dy, sw, sh);
      }
      if (canvas) {
        await downloadCanvas(canvas, 'screenshot-component-' + sanitizeFilename(compName) + '.png', {
          url: url,
          date: date,
          component: compName
        });
        showToast('Component saved');
      }
    } catch (e) {
      showToast('Component capture failed');
    } finally {
      restoreHidden(hiddenOverlays);
      screenshotBusy = false;
    }
  }

  // -- Constants --------------------------------------------------------------

  var UI_COLOR_PROPS = [
    'background-color', 'background', 'color', 'border-color',
    'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color',
    'border', 'border-top', 'border-bottom', 'box-shadow', 'outline-color',
    'fill', 'stroke', '-webkit-text-fill-color', 'caret-color', 'text-decoration-color',
  ];

  var BUTTON_KEYWORDS = ['btn', 'button', 'cta', '-action', 'action-', 'submit', 'call-to-action'];

  var ABSOLUTE_EXCLUDE_PATTERNS = [
    '__cta-block', '__cta-row', '__cta-section', '__cta-wrapper',
    'collapse__btn', 'collapse-btn', '-collapse-', 'os-collapse',
    'search__input', 'search-input', 'search__submit', 'search-submit', 'input-submit',
    'ot-', 'onetrust', 'save-preference', 'filter-btn', 'clear-filter', 'back-btn-handler',
    'collapsed',
  ];

  var NAV_NOISE_PATTERNS = [
    '__1lvl', '__2lvl', '__3lvl', '__4lvl',
    'language-switcher', 'language__', '__back__', 'back__btn', '-back-btn',
    'burger', 'hamburger', 'mobile__menu', 'mobile-menu', 'main-menu__',
    'sub-menu__btn', 'submenu__btn', 'nav__btn', 'navbar__btn',
    '__search__btn', '-search-btn', 'switcher__btn', 'go-back', 'menu-burger', 'footer--menu',
  ];

  var PRIORITY_CTA_PATTERNS = [
    'os-btn', 'call-to-action', '-action', 'action-',
    'primary-btn', 'primary-button', 'hero__btn', 'hero-btn',
  ];

  var UTILITY_EXACT = {
    'bold':1,'italic':1,'underline':1,'uppercase':1,'lowercase':1,
    'active':1,'disabled':1,'show':1,'hide':1,'open':1,'close':1,
    'selected':1,'checked':1,'focused':1,'visited':1,'current':1,
    'clearfix':1,'sr-only':1,'visually-hidden':1,
  };

  var UTILITY_PREFIXES = [
    'text-color-','text-size-','text-weight-','text-align-',
    'font-size-','font-weight-','font-color-','color-','bg-color-',
    'mt-','mb-','ml-','mr-','mx-','my-','pt-','pb-','pl-','pr-','px-','py-','w-','h-','d-',
  ];

  var CONTAINER_LAST_WORDS = {
    'block':1,'row':1,'section':1,'container':1,'wrapper':1,'area':1,'zone':1,
    'panel':1,'group':1,'list':1,'grid':1,'content':1,'inner':1,'outer':1,
  };

  // -- CSS Collection ----------------------------------------------------------

  async function collectAllCss() {
    var linkedReport = [];
    var sheets = [];
    var missing = [];

    for (var i = 0; i < document.styleSheets.length; i++) {
      var sheet = document.styleSheets[i];
      var href = sheet && sheet.href ? sheet.href : '';
      try {
        var rules = sheet.cssRules || [];
        var cssText = '';
        for (var j = 0; j < rules.length; j++) {
          cssText += rules[j].cssText + '\n';
        }
        sheets.push({ href: href, css: cssText });
        if (href) linkedReport.push({ status: 'loaded', href: href });
      } catch (e) {
        sheets.push({ href: href, css: '' });
        if (href) {
          missing.push(href);
          linkedReport.push({ status: 'pending', href: href });
        }
      }
    }

    if (missing.length) {
      try {
        var items = await fetchCssViaBackground(Array.from(new Set(missing)));
        var map = {};
        (items || []).forEach(function (item) {
          if (!item || !item.url) return;
          map[item.url] = item.css || '';
        });
        sheets = sheets.map(function (sheet) {
          if (!sheet) return sheet;
          if (sheet.css) return sheet;
          if (sheet.href && map.hasOwnProperty(sheet.href)) {
            return { href: sheet.href, css: map[sheet.href] };
          }
          return sheet;
        });
        linkedReport = linkedReport.map(function (row) {
          if (!row || !row.href) return row;
          if (map.hasOwnProperty(row.href)) return { status: 'loaded', href: row.href };
          if (row.status === 'pending') return { status: 'skipped', href: row.href + ' (CORS/network)' };
          return row;
        });
      } catch (e2) {
        linkedReport = linkedReport.map(function (row) {
          if (!row || !row.href) return row;
          if (row.status === 'pending') return { status: 'skipped', href: row.href + ' (CORS/network)' };
          return row;
        });
      }
    }

    var allCssRaw = normalizeEncodingArtifacts(
      sheets.map(function (s) { return (s && s.css) ? s.css : ''; }).join('\n')
    );
    return { allCss: cleanCss(allCssRaw), allCssRaw: allCssRaw, linkedReport: linkedReport };
  }

  function cleanCss(css) {
    css = css.replace(/\/\*[\s\S]*\*\//g, '');
    css = css.replace(/@font-face\s*\{[^}]*\}/gi, '');
    css = css.replace(/@-(?:webkit-)keyframes\s+\S+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gi, '');
    css = css.replace(/url\(['"]data:[^)]+\)/gi, 'url(DATA_REMOVED)');
    return css;
  }


  function fetchCssViaBackground(urls) {
    return new Promise(function (resolve) {
      if (!urls || !urls.length || !chrome || !chrome.runtime || !chrome.runtime.sendMessage) return resolve([]);
      chrome.runtime.sendMessage({ action: 'fetch_css_urls', urls: urls }, function (resp) {
        if (chrome.runtime.lastError) return resolve([]);
        if (resp && Array.isArray(resp.items)) return resolve(resp.items);
        resolve([]);
      });
    });
  }

  function uniqueList(list) {
    var seen = {};
    var out = [];
    (list || []).forEach(function (item) {
      if (!item) return;
      if (seen[item]) return;
      seen[item] = true;
      out.push(item);
    });
    return out;
  }

  function normalizeEncodingArtifacts(value) {
    if (value == null) return '';
    return String(value)
      .replace(/Ã¢â€ Â/g, '<-')
      .replace(/Ã¢â€ â€™/g, '->')
      .replace(/â†/g, '<-')
      .replace(/â†’/g, '->')
      .replace(/Ã—/g, 'x')
      .replace(/â€¢/g, '*')
      .replace(/â€”/g, '-')
      .replace(/â€“/g, '-')
      .replace(/â€¦/g, '...')
      .replace(/â‰¥/g, '>=')
      .replace(/Ã¢â‚¬â€/g, '-')
      .replace(/Ã¢â‚¬â€œ/g, '-')
      .replace(/Ã¢â‚¬Â¢/g, '*')
      .replace(/Â/g, '');
  }

  var reportUtilsPromise = null;
  function getReportUtilsSource() {
    if (reportUtilsPromise) return reportUtilsPromise;
    reportUtilsPromise = new Promise(function (resolve) {
      try {
        if (!chrome || !chrome.runtime || !chrome.runtime.getURL) return resolve('');
        var url = chrome.runtime.getURL('report_utils.js');
        fetch(url).then(function (res) {
          if (!res.ok) return resolve('');
          return res.text().then(function (txt) { resolve(txt || ''); });
        }).catch(function () { resolve(''); });
      } catch (e) {
        resolve('');
      }
    });
    return reportUtilsPromise;
  }

  function normalizeUrl(url, base) {
    if (!url) return '';
    var trimmed = String(url).trim();
    if (!trimmed) return '';
    if (/^(data:|blob:|about:|#)/i.test(trimmed)) return trimmed;
    if (trimmed.indexOf('//') === 0) return 'https:' + trimmed;
    try { return new URL(trimmed, base).href; } catch (e) { return trimmed; }
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

  function detectScriptVendor(url, code) {
    var u = (url || '').toLowerCase();
    var c = (code || '').toLowerCase();
    function has(v) { return u.indexOf(v) >= 0 || c.indexOf(v) >= 0; }
    if (has('googletagmanager.com/gtm.js') || has('gtm-')) return 'Google Tag Manager';
    if (has('googletagmanager.com/gtag/js') || has('gtag(')) return 'Google Analytics (gtag)';
    if (has('google-analytics.com/analytics.js') || has('ga(')) return 'Google Analytics (UA)';
    if (has('googleadservices.com') || has('doubleclick.net')) return 'Google Ads';
    if (has('connect.facebook.net') || has('fbq(')) return 'Meta Pixel';
    if (has('hotjar.com') || has('hj(')) return 'Hotjar';
    if (has('clarity.ms')) return 'Microsoft Clarity';
    if (has('cdn.segment.com/analytics.js') || has('segment.com/analytics')) return 'Segment';
    if (has('cdn.mxpnl.com') || has('mixpanel')) return 'Mixpanel';
    if (has('fullstory.com') || has('fs.js')) return 'FullStory';
    if (has('static.ads-twitter.com') || has('twitter.com/i/adsct')) return 'X / Twitter Pixel';
    if (has('snap.licdn.com') || has('linkedin.com/insight')) return 'LinkedIn Insight';
    if (has('optimizely.com') || has('optimizely')) return 'Optimizely';
    if (has('vwo.com') || has('vwo')) return 'VWO';
    if (has('sitespect') || has('ss[\\w-]*')) return 'SiteSpect';
    if (has('tealium') || has('utag')) return 'Tealium';
    if (has('adobe') || has('omniture') || has('s_code')) return 'Adobe Analytics';
    if (has('crazyegg.com')) return 'Crazy Egg';
    if (has('intercom') || has('intercomcdn')) return 'Intercom';
    return '';
  }

  function collectScripts() {
    var list = [];
    var seen = {};
    var scripts = Array.from(document.scripts || []);
    scripts.forEach(function (scr) {
      var src = scr.getAttribute('src') || '';
      var abs = src ? normalizeUrl(src, location.href) : '';
      var code = src ? '' : (scr.textContent || '').trim();
      var id = src ? ('ext_' + hashText(abs)) : ('inline_' + hashText(code));
      if (seen[id]) return;
      seen[id] = true;
      var vendor = detectScriptVendor(abs, code);
      list.push({
        id: id,
        name: vendor || (abs ? abs.split('/').slice(-1)[0] : 'Inline script'),
        vendor: vendor,
        url: abs,
        type: src ? 'external' : 'inline',
        inline: !src,
        code: code
      });
    });

    try {
      var entries = performance.getEntriesByType('resource') || [];
      entries.forEach(function (entry) {
        if (!entry || entry.initiatorType !== 'script') return;
        var abs = entry.name || '';
        if (!abs) return;
        var id = 'ext_' + hashText(abs);
        if (seen[id]) return;
        seen[id] = true;
        var vendor = detectScriptVendor(abs, '');
        list.push({
          id: id,
          name: vendor || abs.split('/').slice(-1)[0],
          vendor: vendor,
          url: abs,
          type: 'external',
          inline: false,
          code: ''
        });
      });
    } catch (e) {}

    return list;
  }

  function rewriteCssUrls(cssText, baseUrl) {
    if (!cssText) return '';
    var rewritten = String(cssText).replace(/url\(\s*(['"])([^'")]+)\1\s*\)/gi, function (_, quote, url) {
      var cleaned = (url || '').trim();
      if (!cleaned) return 'url(' + url + ')';
      if (/^(data:|https:|blob:|about:|#)/i.test(cleaned)) return 'url(' + cleaned + ')';
      if (cleaned.indexOf('//') === 0) return 'url(' + 'https:' + cleaned + ')';
      try { return 'url(' + new URL(cleaned, baseUrl).href + ')'; } catch (err) { return 'url(' + cleaned + ')'; }
    });
    rewritten = rewritten.replace(/@import\s+(?:url\()["']([^"'\)\s]+)["']\)\s*([^;]*);/gi, function (_, url, media) {
      var cleaned = (url || '').trim();
      if (!cleaned) return _;
      var abs = cleaned;
      if (!/^(data:|https:|blob:|about:|#)/i.test(cleaned)) {
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

  function collectUrlsFromCss(cssText) {
    var out = [];
    if (!cssText) return out;
    var re = /url\(\s*(['"])([^'")]+)\1\s*\)/gi;
    var m;
    while ((m = re.exec(cssText)) !== null) {
      var url = (m[2] || '').trim();
      if (!url || /^(data:|blob:|about:|#)/i.test(url)) continue;
      out.push(url);
    }
    return out;
  }

  function collectUrlsFromHtml(html, baseUrl) {
    var urls = [];
    if (!html) return urls;
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');
      var nodes = doc.querySelectorAll('img, source, video, a, link');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var src = el.getAttribute('src') || '';
        var dataSrc = el.getAttribute('data-src') || '';
        var poster = el.getAttribute('poster') || '';
        var href = el.getAttribute('href') || '';
        if (src) urls.push(normalizeUrl(src, baseUrl));
        if (dataSrc) urls.push(normalizeUrl(dataSrc, baseUrl));
        if (poster) urls.push(normalizeUrl(poster, baseUrl));
        if (href && /\.(png|jpeg|gif|webp|svg|avif)(\?|#|$)/i.test(href)) urls.push(normalizeUrl(href, baseUrl));
      }
    } catch (e) {}
    return urls;
  }

  function replaceUrlsWithMap(text, baseUrl, map) {
    if (!text) return '';
    return String(text).replace(/url\(\s*(['"])([^'")]+)\1\s*\)/gi, function (_, quote, url) {
      var cleaned = (url || '').trim();
      if (!cleaned) return 'url(' + url + ')';
      var abs = normalizeUrl(cleaned, baseUrl);
      if (map && map[abs]) return 'url(' + map[abs] + ')';
      return 'url(' + abs + ')';
    });
  }

  function rewriteHtmlAssets(html, baseUrl, map) {
    if (!html) return '';
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    var nodes = doc.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.hasAttribute('src')) {
        var src = el.getAttribute('src');
        var abs = normalizeUrl(src, baseUrl);
        el.setAttribute('src', (map && map[abs]) ? map[abs] : abs);
      }
      if (el.hasAttribute('data-src')) {
        var dsrc = el.getAttribute('data-src');
        var abs2 = normalizeUrl(dsrc, baseUrl);
        el.setAttribute('data-src', (map && map[abs2]) ? map[abs2] : abs2);
      }
      if (el.hasAttribute('poster')) {
        var poster = el.getAttribute('poster');
        var abs3 = normalizeUrl(poster, baseUrl);
        el.setAttribute('poster', (map && map[abs3]) ? map[abs3] : abs3);
      }
      if (el.hasAttribute('href')) {
        var href = el.getAttribute('href');
        var abs4 = normalizeUrl(href, baseUrl);
        if (map && map[abs4]) el.setAttribute('href', map[abs4]);
      }
      if (el.hasAttribute('style')) {
        var style = el.getAttribute('style') || '';
        el.setAttribute('style', replaceUrlsWithMap(style, baseUrl, map));
      }
    }
    return doc.body.innerHTML || '';
  }

  function sanitizeHtml(html) {
    if (!html) return '';
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('script').forEach(function (el) { el.remove(); });
    return normalizeEncodingArtifacts(doc.body.innerHTML || '');
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(blob);
    });
  }

  async function fetchAssetDataUrl(url) {
    if (!url || /^(data:|blob:|about:|#)/i.test(url)) return '';
    try {
      var res = await fetch(url, { credentials: 'include' });
      if (!res.ok) return '';
      var blob = await res.blob();
      return await blobToDataUrl(blob);
    } catch (e) {
      return '';
    }
  }

  async function buildAssetMap(urls, limit) {
    var list = uniqueList(urls || []);
    if (limit && list.length > limit) list = list.slice(0, limit);
    var map = {};
    for (var i = 0; i < list.length; i++) {
      var abs = list[i];
      var dataUrl = await fetchAssetDataUrl(abs);
      if (dataUrl) map[abs] = dataUrl;
    }
    return map;
  }

  // -- CSS Parsing Helpers -----------------------------------------------------

  function parseFlatRules(css) {
    var rules = [];
    var re = /([^{}@]+)\{([^{}]+)\}/g;
    var m;
    while ((m = re.exec(css)) !== null) {
      rules.push({ sel: m[1].trim(), props: m[2].trim() });
    }
    return rules;
  }

  function buildScopeSets(root) {
    var classSet = {};
    var idSet = {};
    var tagSet = {};

    function addEl(el) {
      if (!el) return;
      var tag = (el.tagName || '').toLowerCase();
      if (tag) tagSet[tag] = true;
      if (el.id) idSet[el.id] = true;
      if (el.classList && el.classList.length) {
        for (var i = 0; i < el.classList.length; i++) {
          classSet[el.classList[i]] = true;
        }
      }
    }

    addEl(root);
    var nodes = root.querySelectorAll('*');
    for (var n = 0; n < nodes.length; n++) addEl(nodes[n]);

    return { root: root, classSet: classSet, idSet: idSet, tagSet: tagSet };
  }

  function sanitizeSelector(sel) {
    if (!sel) return '';
    var cleaned = sel
      .replace(/::[-a-zA-Z0-9_]+(\([^)]*\))/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned;
  }

  function selectorMatchesScope(selector, scope) {
    var s = (selector || '').trim();
    if (!s) return false;
    if (s.indexOf(':root') >= 0 || s.indexOf('html') >= 0 || s.indexOf('body') >= 0) return true;
    if (s.indexOf('*') >= 0) return true;

    var classTokens = s.match(/\.([a-zA-Z0-9_-]+)/g) || [];
    if (classTokens.length) {
      var hasClass = false;
      for (var i = 0; i < classTokens.length; i++) {
        var cls = classTokens[i].slice(1);
        if (scope.classSet[cls]) { hasClass = true; break; }
      }
      if (!hasClass) return false;
    }

    var idTokens = s.match(/#([a-zA-Z0-9_-]+)/g) || [];
    if (idTokens.length) {
      var hasId = false;
      for (var j = 0; j < idTokens.length; j++) {
        var id = idTokens[j].slice(1);
        if (scope.idSet[id]) { hasId = true; break; }
      }
      if (!hasId) return false;
    }

    var tagTokens = s.match(/(^|\\s|>|\\+|~)([a-z][a-z0-9-]*)/gi) || [];
    if (tagTokens.length) {
      var hasTag = false;
      for (var k = 0; k < tagTokens.length; k++) {
        var raw = tagTokens[k].replace(/^[\\s>+~]+/g, '').toLowerCase();
        if (scope.tagSet[raw]) { hasTag = true; break; }
      }
      if (!hasTag) return false;
    }

    var test = sanitizeSelector(s);
    if (!test) return false;
    try { return !!scope.root.querySelector(test); } catch (e) { return false; }
  }

  function filterCssByRoot(allCss, root) {
    if (!root) return allCss;
    var scope = buildScopeSets(root);
    var rules = parseFlatRules(allCss);
    var kept = [];
    for (var i = 0; i < rules.length; i++) {
      var selRaw = rules[i].sel;
      var selectors = selRaw.split(',');
      var keep = false;
      for (var j = 0; j < selectors.length; j++) {
        if (selectorMatchesScope(selectors[j], scope)) { keep = true; break; }
      }
      if (keep) kept.push(selRaw + '{' + rules[i].props + '}');
    }
    return kept.join('\n');
  }

  function parseProps(propsRaw) {
    var result = {};
    var lines = propsRaw.split(';');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      var colon = line.indexOf(':');
      if (colon < 0) continue;
      var k = line.slice(0, colon).trim().toLowerCase();
      var v = line.slice(colon + 1).trim().replace(/;$/, '').trim();
      if (k && v && !k.startsWith('/*')) result[k] = v;
    }
    return result;
  }

  function escapeRegex(str) {
    return str.replace(/[-[\]{}()*+.,\\^$|#\s]/g, '\\$&');
  }

  function buildCssForClass(clsName, allCss) {
    var base = {}, hover = {}, focus = {}, after = {}, hoverAfter = {};
    var exactPat = new RegExp('(?<![a-zA-Z0-9_-])\\.' + escapeRegex(clsName) + '(?![a-zA-Z0-9_-])', 'i');
    var rules = parseFlatRules(allCss);
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (!exactPat.test(rule.sel)) continue;
      var parsed   = parseProps(rule.props);
      var isAfter  = /::(?:after|before)\b/i.test(rule.sel);
      var isHover  = /:hover\b/i.test(rule.sel);
      var isFocus  = /:(?:focus|active|focus-visible)\b/i.test(rule.sel);
      if      (isAfter && isHover) assign(hoverAfter, parsed);
      else if (isAfter)            assign(after, parsed);
      else if (isHover)            assign(hover, parsed);
      else if (isFocus)            assign(focus, parsed);
      else                         assign(base, parsed);
    }
    return { base: base, hover: hover, focus: focus, after: after, hoverAfter: hoverAfter };
  }

  function assign(target, source) {
    for (var k in source) { if (source.hasOwnProperty(k)) target[k] = source[k]; }
    return target;
  }

  function effectiveBg(baseProps, afterProps, primaryColor) {
    var dicts = [afterProps, baseProps];
    for (var i = 0; i < dicts.length; i++) {
      var d = dicts[i];
      var bg = (d['background-color'] || d['background'] || '').trim();
      if (bg && ['none','transparent','inherit','initial','unset',''].indexOf(bg) < 0) {
        if (!bg.startsWith('url(') && bg.toLowerCase().indexOf('gradient') < 0) return bg;
      }
    }
    return primaryColor;
  }

  function effectiveColor(baseProps, afterProps) {
    return baseProps['color'] || afterProps['color'] || '#ffffff';
  }

  // -- Filter Helpers ----------------------------------------------------------

  function isNavNoise(clLower) {
    if (clLower.startsWith('js-')) return true;
    for (var i = 0; i < ABSOLUTE_EXCLUDE_PATTERNS.length; i++) {
      if (clLower.indexOf(ABSOLUTE_EXCLUDE_PATTERNS[i]) >= 0) return true;
    }
    for (var j = 0; j < PRIORITY_CTA_PATTERNS.length; j++) {
      if (clLower.indexOf(PRIORITY_CTA_PATTERNS[j]) >= 0) return false;
    }
    for (var k = 0; k < NAV_NOISE_PATTERNS.length; k++) {
      if (clLower.indexOf(NAV_NOISE_PATTERNS[k]) >= 0) return true;
    }
    return false;
  }

  function isContainerClass(clsName) {
    var lower = clsName.toLowerCase();
    for (var i = 0; i < PRIORITY_CTA_PATTERNS.length; i++) {
      if (lower.indexOf(PRIORITY_CTA_PATTERNS[i]) >= 0) return false;
    }
    var parts = lower.split(/[-_]+/);
    return CONTAINER_LAST_WORDS.hasOwnProperty(parts[parts.length - 1]);
  }

  function isUtilityClass(clsName) {
    var cl = clsName.toLowerCase();
    if (UTILITY_EXACT.hasOwnProperty(cl)) return true;
    for (var i = 0; i < UTILITY_PREFIXES.length; i++) {
      if (cl.startsWith(UTILITY_PREFIXES[i])) return true;
    }
    return false;
  }

  // -- Color Extraction --------------------------------------------------------

  function extractColors(allCss) {
    var colorScore = {};

    function score(css, mult) {
      for (var pi = 0; pi < UI_COLOR_PROPS.length; pi++) {
        var prop = UI_COLOR_PROPS[pi];
        var pat = new RegExp(
          '(?:^|[\\s;{,])\\s*' + prop.replace(/-/g, '\\-') + '\\s*:[^;{}]*(#[0-9a-fA-F]{6})\\b',
          'gim'
        );
        var m;
        while ((m = pat.exec(css)) !== null) {
          var c = m[1].toUpperCase();
          colorScore[c] = (colorScore[c] || 0) + 3 * mult;
        }
      }
    }

    score(allCss, 1);

    var domTags = document.querySelectorAll('body,nav,header,main,section,footer,button,a,h1,h2,h3');
    for (var di = 0; di < domTags.length; di++) {
      var style = domTags[di].getAttribute('style') || '';
      var dm;
      var dPat = /#([0-9a-fA-F]{6})\b/g;
      while ((dm = dPat.exec(style)) !== null) {
        var dc = '#' + dm[1].toUpperCase();
        colorScore[dc] = (colorScore[dc] || 0) + 2;
      }
    }

    var fallPat = /#([0-9a-fA-F]{6})\b/g;
    var fm;
    while ((fm = fallPat.exec(allCss)) !== null) {
      var fc = '#' + fm[1].toUpperCase();
      if (!colorScore.hasOwnProperty(fc)) colorScore[fc] = 0;
      colorScore[fc] += 1;
    }

    function dist(c1, c2) {
      var r1=parseInt(c1.slice(1,3),16), g1=parseInt(c1.slice(3,5),16), b1=parseInt(c1.slice(5,7),16);
      var r2=parseInt(c2.slice(1,3),16), g2=parseInt(c2.slice(3,5),16), b2=parseInt(c2.slice(5,7),16);
      return Math.sqrt(2*(r1-r2)*(r1-r2) + 4*(g1-g2)*(g1-g2) + 3*(b1-b2)*(b1-b2));
    }

    var sorted = Object.keys(colorScore).sort(function(a,b){ return colorScore[b]-colorScore[a]; });
    var unique = [];
    for (var si = 0; si < sorted.length && unique.length < 20; si++) {
      var color = sorted[si];
      var tooClose = false;
      for (var ui = 0; ui < unique.length; ui++) {
        if (dist(color, unique[ui]) < 30) { tooClose = true; break; }
      }
      if (!tooClose) unique.push(color);
    }
    return unique;
  }

  function isNeutral(h) {
    var r=parseInt(h.slice(1,3),16), g=parseInt(h.slice(3,5),16), b=parseInt(h.slice(5,7),16);
    var avg = (r+g+b)/3;
    return avg < 30 || avg > 220;
  }

  function getPrimaryColor(colors) {
    for (var i = 0; i < colors.length; i++) {
      var c = colors[i];
      if (isNeutral(c)) continue;
      var r=parseInt(c.slice(1,3),16), g=parseInt(c.slice(3,5),16), b=parseInt(c.slice(5,7),16);
      if (Math.max(r,g,b) - Math.min(r,g,b) > 40) return c;
    }
    for (var j = 0; j < colors.length; j++) {
      if (!isNeutral(colors[j])) return colors[j];
    }
    return colors[0] || '#333333';
  }

  function colorLabel(h) {
    var r=parseInt(h.slice(1,3),16), g=parseInt(h.slice(3,5),16), b=parseInt(h.slice(5,7),16);
    var br=(r+g+b)/3, sat=Math.max(r,g,b)-Math.min(r,g,b);
    if (br<30)   return 'Near Black';
    if (br>225)  return 'Near White';
    if (sat<18) { if (br<90) return 'Dark Gray'; if (br<160) return 'Mid Gray'; return 'Light Gray'; }
    if (r>=g && r>=b) return b < 100 ? 'Red / Brand' : 'Pink / Magenta';
    if (g>=r && g>=b) return r < 150 ? 'Green / Success' : 'Yellow / Warning';
    if (b>=r && b>=g) return g > 80 ? 'Blue / Link' : 'Indigo / Dark';
    return 'Accent';
  }

  // -- CSS Variables -----------------------------------------------------------

  function extractCssVariables(css) {
    var variables = {};
    var re = /(?<![a-zA-Z0-9_-])(--[a-zA-Z0-9_-]+)\s*:\s*([^;{}\n]+)/gm;
    var m;
    while ((m = re.exec(css)) !== null) {
      var name  = m[1].trim();
      var value = m[2].trim().replace(/;$/, '').trim();
      if (/#[0-9a-fA-F]{3,6}\b|rgba\(|hsla\(/i.test(value)) variables[name] = value;
    }
    return variables;
  }

  // -- Typography --------------------------------------------------------------

  function extractTypography(allCss) {
    function findFontFor(css, pats) {
      var re = /([^{}@]+)\{([^{}]+)\}/g;
      var m;
      while ((m = re.exec(css)) !== null) {
        var sel = m[1].trim().toLowerCase();
        var props = m[2];
        for (var pi = 0; pi < pats.length; pi++) {
          if (new RegExp(pats[pi]).test(sel)) {
            var fm = /font-family\s*:\s*([^;}\n]+)/i.exec(props);
            if (fm) return fm[1].trim().replace(/;$/, '').trim();
          }
        }
      }
      return null;
    }

    var bodyFont = (
      findFontFor(allCss, ['^\\s*body\\s*$', '^\\s*html\\s*$', '^\\s*html\\s*,\\s*body\\s*$']) ||
      findFontFor(allCss, ['\\bbody\\b', '\\bhtml\\b']) ||
      (function(){ var m=/font-family\s*:\s*([^;}\n]+)/i.exec(allCss); return m ? m[1].trim().replace(/;$/,'').trim() : null; })() ||
      "'Noto Sans', sans-serif"
    );

    var headingFont = findFontFor(allCss, ['\\bh[1-3]\\b']) || bodyFont;

    var sizesMap = {};
    var sizePat = /font-size\s*:\s*(\d+(?:\.\d+)?(?:px|rem|em|pt|vw))/gi;
    var sm;
    while ((sm = sizePat.exec(allCss)) !== null) {
      if (!sizesMap[sm[1]]) sizesMap[sm[1]] = true;
    }
    var sizes = Object.keys(sizesMap).slice(0, 14);

    var weightsMap = {};
    var wPat = /font-weight\s*:\s*(\d{3}|bold|semibold|medium|normal|light)/gi;
    var wm;
    while ((wm = wPat.exec(allCss)) !== null) {
      if (!weightsMap[wm[1]]) weightsMap[wm[1]] = true;
    }
    var weights = Object.keys(weightsMap).slice(0, 8);

    return { bodyFont: bodyFont, headingFont: headingFont, sizes: sizes, weights: weights };
  }

  // -- Button Components -------------------------------------------------------

  function inferButtonProps(clsName, allCss, primaryColor) {
    var nl = clsName.toLowerCase();
    var bgColors = [];
    var re = new RegExp(
      '(?<![a-zA-Z0-9_-])\\.' + escapeRegex(clsName) + '(?![a-zA-Z0-9_-])' +
      '[^{]*\\{[^}]*background(?:-color)\\s*:\\s*(#[0-9a-fA-F]{6})',
      'gi'
    );
    var m;
    while ((m = re.exec(allCss)) !== null) bgColors.push(m[1]);

    var bg, fg, bd;
    if (nl.indexOf('dark-inverted') >= 0) {
      bg = 'transparent'; fg = '#0F0E0B'; bd = '2px solid #0F0E0B';
    } else if (nl.indexOf('light') >= 0) {
      bg = 'transparent'; fg = primaryColor; bd = '2px solid ' + primaryColor;
    } else if (nl.indexOf('dark') >= 0) {
      bg = bgColors[0] || '#0F0E0B'; fg = '#ffffff'; bd = '2px solid ' + bg;
    } else {
      bg = bgColors[0] || primaryColor; fg = '#ffffff'; bd = 'none';
    }

    return {
      base: { 'background-color': bg, 'color': fg, 'border': bd,
              'padding': '10px 28px', 'border-radius': '4px',
              'font-weight': '700', 'cursor': 'pointer',
              'display': 'inline-block', 'font-size': '14px' },
      hover: {}, focus: {}, after: {}, hoverAfter: {}
    };
  }

  function extractButtonComponents(allCss, primaryColor, rootEl) {
    primaryColor = primaryColor || '#333333';
    var domClasses = {};
    var domTexts   = {};
    var scope = rootEl || document;
    var tags = scope.querySelectorAll('button, a, input');
    for (var ti = 0; ti < tags.length; ti++) {
      var tag = tags[ti];
      var tagName = tag.tagName.toLowerCase();
      if (tagName === 'input') {
        var t = (tag.getAttribute('type') || '').toLowerCase();
        if (['button','submit','reset','image'].indexOf(t) < 0) continue;
      }

      var text = (tag.textContent || '').trim() || tag.getAttribute('value') || tag.getAttribute('aria-label') || '';
      if (text.length > 80) text = '';

      for (var ci = 0; ci < tag.classList.length; ci++) {
        var cls = tag.classList[ci];
        var cl = cls.toLowerCase();
        if (isNavNoise(cl) || isContainerClass(cls) || isUtilityClass(cls)) continue;
        if (tagName === 'a') {
          var hasKw = false;
          for (var ki = 0; ki < BUTTON_KEYWORDS.length; ki++) {
            if (cl.indexOf(BUTTON_KEYWORDS[ki]) >= 0) { hasKw = true; break; }
          }
          if (!hasKw) continue;
        }
        domClasses[cls] = (domClasses[cls] || 0) + 1;
        if (!domTexts[cls]) domTexts[cls] = [];
        if (text && domTexts[cls].indexOf(text) < 0) domTexts[cls].push(text);
      }
    }

    var sorted = Object.keys(domClasses).sort(function(a,b){ return domClasses[b]-domClasses[a]; });
    var components = [];

    for (var si = 0; si < sorted.length && components.length < 14; si++) {
      var clsName  = sorted[si];
      var domCount = domClasses[clsName];
      var cl2      = clsName.toLowerCase();

      var built  = buildCssForClass(clsName, allCss);
      var base   = built.base;
      var hover  = built.hover;
      var focus  = built.focus;
      var after  = built.after;
      var hoverAfter = built.hoverAfter;
      var source = 'css';

      if (!Object.keys(base).length && !Object.keys(after).length) {
        var inferred = inferButtonProps(clsName, allCss, primaryColor);
        base = inferred.base; hover = inferred.hover; focus = inferred.focus;
        after = inferred.after; hoverAfter = inferred.hoverAfter;
        source = 'reconstructed';
      }

      var effBg    = effectiveBg(base, after, primaryColor);
      var effColor = effectiveColor(base, after);

      var effHoverBg = null;
      var hoverDicts = [hoverAfter, hover];
      for (var hdi = 0; hdi < hoverDicts.length; hdi++) {
        var hbg = (hoverDicts[hdi]['background-color'] || hoverDicts[hdi]['background'] || '').trim();
        if (hbg && ['none','transparent','inherit','initial','unset',''].indexOf(hbg) < 0) {
          if (!hbg.startsWith('url(') && hbg.toLowerCase().indexOf('gradient') < 0) {
            effHoverBg = hbg; break;
          }
        }
      }

      var hasKeyword = false;
      for (var bki = 0; bki < BUTTON_KEYWORDS.length; bki++) {
        if (cl2.indexOf(BUTTON_KEYWORDS[bki]) >= 0) { hasKeyword = true; break; }
      }
      var hasRealBg = !!(after['background-color'] || after['background'] || base['background-color'] || base['background']);
      var hasPadding = base.hasOwnProperty('padding') || after.hasOwnProperty('padding');

      if (!hasKeyword && !(hasRealBg && (hasPadding || base.hasOwnProperty('font-size')))) continue;

      var borderRadius = after['border-radius'] || base['border-radius'] || '0';
      var padding      = base['padding'] || after['padding'] || '10px 28px';
      var height       = base['height'] || base['min-height'] || '';
      var texts        = domTexts[clsName] || [];
      var labelText    = (texts.length > 0 ? texts[0].toUpperCase() : clsName.replace(/-/g,' ').toUpperCase()).slice(0, 40);

      components.push({
        name: clsName, selector: '.' + clsName,
        baseProps: base, hoverProps: hover, focusProps: focus,
        afterProps: after, hoverAfter: hoverAfter,
        source: source, domCount: domCount,
        effBg: effBg, effColor: effColor, effHoverBg: effHoverBg,
        borderRadius: borderRadius, padding: padding, height: height, labelText: labelText
      });
    }

    return components;
  }

  // -- Links -------------------------------------------------------------------

  function extractLinks(allCss) {
    var aBase = {}, aHover = {}, aVisited = {}, aFocus = {};
    var rules = parseFlatRules(allCss);

    for (var ri = 0; ri < rules.length; ri++) {
      var selRaw = rules[ri].sel;
      var props  = rules[ri].props;
      var parts  = selRaw.split(',');

      for (var pi = 0; pi < parts.length; pi++) {
        var partL = parts[pi].toLowerCase().trim();
        if (!/(?:^|[\s>+~])a(?::(?:hover|visited|focus|active|focus-visible))?\s*$/.test(partL)) continue;
        var skipKws = ['btn','button','cta','-action','os-btn'];
        var skip = false;
        for (var ski = 0; ski < skipKws.length; ski++) {
          if (partL.indexOf(skipKws[ski]) >= 0) { skip = true; break; }
        }
        if (skip) continue;

        var parsed = parseProps(props);
        if (/:hover/.test(partL))                            assign(aHover, parsed);
        else if (/:visited/.test(partL))                     assign(aVisited, parsed);
        else if (/:(?:focus|active|focus-visible)/.test(partL)) assign(aFocus, parsed);
        else                                                  assign(aBase, parsed);
      }
    }

    var SKIP_LINK_KW = ['nav','menu','dropdown','toggle','burger','social','footer','logo','lang','search'];
    var domLinkClasses = {};
    var linkTags = document.querySelectorAll('a');
    var linkCount = 0;

    for (var li = 0; li < linkTags.length && linkCount < 2000; li++, linkCount++) {
      var ltag   = linkTags[li];
      var clStr2 = Array.prototype.slice.call(ltag.classList).join(' ').toLowerCase();
      var hasBtn = false;
      for (var bki2 = 0; bki2 < BUTTON_KEYWORDS.length; bki2++) {
        if (clStr2.indexOf(BUTTON_KEYWORDS[bki2]) >= 0) { hasBtn = true; break; }
      }
      if (hasBtn) continue;

      for (var lci = 0; lci < ltag.classList.length; lci++) {
        var lcls = ltag.classList[lci];
        var lcl  = lcls.toLowerCase();
        var skipLink = false;
        if (isNavNoise(lcl) || isUtilityClass(lcl)) skipLink = true;
        if (!skipLink) {
          for (var slki = 0; slki < SKIP_LINK_KW.length; slki++) {
            if (lcl.indexOf(SKIP_LINK_KW[slki]) >= 0) { skipLink = true; break; }
          }
        }
        if (!skipLink) domLinkClasses[lcls] = (domLinkClasses[lcls] || 0) + 1;
      }
    }

    var sortedLinks = Object.keys(domLinkClasses).sort(function(a,b){ return domLinkClasses[b]-domLinkClasses[a]; }).slice(0,5);
    var named = [];
    for (var nli = 0; nli < sortedLinks.length; nli++) {
      var nlCls = sortedLinks[nli];
      var nlBuilt = buildCssForClass(nlCls, allCss);
      if (nlBuilt.base['color'] || nlBuilt.hover['color'] || nlBuilt.base['text-decoration']) {
        named.push({ 'class': nlCls, base: nlBuilt.base, hover: nlBuilt.hover, count: domLinkClasses[nlCls] });
      }
    }

    return { base: aBase, hover: aHover, visited: aVisited, focus: aFocus, named: named };
  }

  // -- Border Radii ------------------------------------------------------------

  function extractBorderRadii(allCss) {
    var seen  = {};
    var SKIP  = { '0px':1,'0':1,'initial':1,'inherit':1,'unset':1,'none':1,'':1 };
    var re    = /border-radius\s*:\s*([^;{}]+)/gi;
    var m;

    while ((m = re.exec(allCss)) !== null) {
      var raw = m[1].trim().replace(/;$/, '').trim().replace(/\s+/g, ' ');
      if (raw.indexOf('var(') >= 0 || raw.indexOf('calc(') >= 0 || SKIP[raw]) continue;
      var parts = raw.split(' ');
      if (parts.length > 2) continue;
      var val = parts[0];
      seen[val] = (seen[val] || 0) + 1;
    }

    function sortKey(v) {
      var n = v.match(/([\d.]+)/);
      return n ? [1, parseFloat(n[1])] : [2, 0];
    }

    var sorted = Object.keys(seen).sort(function(a, b) {
      var ka = sortKey(a), kb = sortKey(b);
      return ka[0] !== kb[0] ? ka[0] - kb[0] : ka[1] - kb[1];
    });

    var result = [], seenKeys = {};
    for (var i = 0; i < sorted.length; i++) {
      var v = sorted[i];
      var n = v.match(/([\d.]+)/);
      var key = v.indexOf('%') >= 0 ? 'pct' : (n ? Math.round(parseFloat(n[1])).toString() : v);
      if (!seenKeys[key]) { seenKeys[key] = true; result.push(v); }
    }
    return result.slice(0, 10);
  }

  // -- Shadows -----------------------------------------------------------------

  function extractShadows(allCss) {
    var seen = {};
    var SKIP = { 'none':1,'0':1,'initial':1,'inherit':1,'unset':1,'':1 };
    var re   = /(?:^|[;{])\s*box-shadow\s*:\s*([^;{}]+)/gim;
    var m;
    while ((m = re.exec(allCss)) !== null) {
      var raw = m[1].trim().replace(/;$/, '').trim().replace(/\s+/g, ' ');
      if (SKIP[raw] || /^0 0 0 /.test(raw)) continue;
      seen[raw] = (seen[raw] || 0) + 1;
    }
    return Object.keys(seen).sort(function(a,b){ return seen[b]-seen[a]; }).slice(0, 6);
  }

  function collectComputedShadows(rootEl) {
    var list = [];
    if (rootEl) {
      list.push(rootEl);
      var nodes = rootEl.querySelectorAll('*');
      for (var i = 0; i < nodes.length; i++) list.push(nodes[i]);
    } else {
      list = Array.from(document.querySelectorAll('*'));
    }

    var seen = {};
    var SKIP = { 'none':1,'0':1,'initial':1,'inherit':1,'unset':1,'':1,'0px 0px 0px 0px':1 };
    var limit = list.length > 6000 ? 6000 : list.length;

    for (var idx = 0; idx < limit; idx++) {
      var el = list[idx];
      if (!el || !el.tagName) continue;
      var style = window.getComputedStyle(el);
      if (!style) continue;
      var sh = (style.boxShadow || '').trim();
      if (sh && !SKIP[sh] && !/^0 0 0 /.test(sh)) seen[sh] = (seen[sh] || 0) + 1;

      var beforeStyle = null;
      var afterStyle = null;
      try { beforeStyle = window.getComputedStyle(el, '::before'); } catch (e1) {}
      try { afterStyle = window.getComputedStyle(el, '::after'); } catch (e2) {}
      if (beforeStyle && beforeStyle.content && beforeStyle.content !== 'none') {
        var bsh = (beforeStyle.boxShadow || '').trim();
        if (bsh && !SKIP[bsh] && !/^0 0 0 /.test(bsh)) seen[bsh] = (seen[bsh] || 0) + 1;
      }
      if (afterStyle && afterStyle.content && afterStyle.content !== 'none') {
        var ash = (afterStyle.boxShadow || '').trim();
        if (ash && !SKIP[ash] && !/^0 0 0 /.test(ash)) seen[ash] = (seen[ash] || 0) + 1;
      }
    }

    return Object.keys(seen).sort(function(a,b){ return seen[b]-seen[a]; }).slice(0, 8);
  }

  function mergeShadowLists(primary, secondary, maxItems) {
    var out = [];
    var seen = {};
    var list = (primary || []).concat(secondary || []);
    for (var i = 0; i < list.length; i++) {
      var val = list[i];
      if (!val || seen[val]) continue;
      seen[val] = true;
      out.push(val);
      if (maxItems && out.length >= maxItems) break;
    }
    return out;
  }

  // -- HTML Report Generator ---------------------------------------------------

  function generateReport(data) {
    var allCss       = data.allCss;
    var linkedReport = data.linkedReport;
    var colors       = data.colors;
    var typography   = data.typography;
    var cssVars      = data.cssVars;
    var primary      = data.primary;
    var components   = data.components;
    var linkData     = data.linkData;
    var radii        = data.radii;
    var shadows      = data.shadows;
    var utilsSource  = data.utilsSource || '';

    var sourceLabel = normalizeEncodingArtifacts(document.title || location.hostname);
    var currentUrl  = location.href;

    // Link tokens
    var lnkColor = linkData.base['color']           || primary;
    var lnkDecor = linkData.base['text-decoration'] || 'underline';
    var lnkHvrC  = linkData.hover['color']          || lnkColor;
    var lnkHvrD  = linkData.hover['text-decoration']|| lnkDecor;
    var lnkVisC  = linkData.visited['color']        || lnkColor;
    var lnkFcsC  = linkData.focus['color']          || lnkColor;

    // CSS Sources card
    var loadedN  = 0, skippedN = 0;
    for (var lr = 0; lr < linkedReport.length; lr++) {
      if (linkedReport[lr].status === 'loaded') loadedN++;
      else skippedN++;
    }

    var srcRows = '';
    if (linkedReport.length > 0) {
      for (var lri = 0; lri < linkedReport.length; lri++) {
        var rep = linkedReport[lri];
        srcRows += '<tr>' +
          '<td style="font-size:11px;color:' + (rep.status === 'loaded' ? '#16a34a' : '#dc2626') + ';padding:3px 10px 3px 0;white-space:nowrap">' + rep.status + '</td>' +
          '<td style="font-size:11px;color:#555;font-family:monospace;word-break:break-all">' + esc(rep.href) + '</td>' +
          '</tr>';
      }
    } else {
      srcRows = '<tr><td colspan="2" style="font-size:12px;color:#aaa">No external stylesheets found - inline styles only.</td></tr>';
    }

    var cssSourceCard = '<div class="card">' +
      '<h2>CSS Sources - ' + loadedN + ' loaded | ' + skippedN + ' skipped</h2>' +
      '<table style="border-collapse:collapse;width:100%"><tbody>' + srcRows + '</tbody></table>' +
      '<p style="margin-top:10px;font-size:11px;color:#aaa">all_css: ' + allCss.length.toLocaleString() + ' chars</p>' +
      '</div>';

    // Color swatches
    function swatch(c) {
      var r=parseInt(c.slice(1,3),16), g=parseInt(c.slice(3,5),16), b=parseInt(c.slice(5,7),16);
      var tc = (r+g+b)/3 < 140 ? '#fff' : '#1a1a1a';
      return '<div style="text-align:center">' +
        '<div style="background:' + c + ';height:72px;border-radius:8px;margin-bottom:6px;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center;padding:4px">' +
        '<span style="font-size:9px;color:' + tc + ';font-weight:700;letter-spacing:.5px">' + colorLabel(c).toUpperCase() + '</span></div>' +
        '<code style="font-size:11px;color:#555">' + c + '</code></div>';
    }

    var swatchesHtml = colors.length > 0 ?
       colors.map(swatch).join('')
      : '<p style="color:#888">No hex colors found.</p>';

    // CSS Vars card
    var cssVarsCard = '';
    var varKeys = Object.keys(cssVars);
    if (varKeys.length > 0) {
      var rows = '';
      for (var vi = 0; vi < Math.min(varKeys.length, 30); vi++) {
        var vk = varKeys[vi], vv = cssVars[vk];
        var hexM = vv.match(/#[0-9a-fA-F]{6}/);
        var swatchDot = hexM ? '<div style="width:18px;height:18px;border-radius:3px;background:' + hexM[0] + ';display:inline-block;vertical-align:middle"></div>' : '';
        rows += '<tr>' +
          '<td style="font-family:monospace;font-size:12px;color:#6e56cf;padding:4px 12px 4px 0">' + esc(vk) + '</td>' +
          '<td style="font-size:12px;color:#444;padding:4px 12px 4px 0">' + esc(vv) + '</td>' +
          '<td style="padding:4px 0">' + swatchDot + '</td></tr>';
      }
      cssVarsCard = '<div class="card"><h2>CSS Custom Properties (' + Math.min(varKeys.length,30) + ' color variables)</h2>' +
        '<table style="border-collapse:collapse;width:100%">' +
        '<thead><tr>' +
        '<th style="text-align:left;font-size:11px;color:#aaa;padding-bottom:8px">VARIABLE</th>' +
        '<th style="text-align:left;font-size:11px;color:#aaa;padding-bottom:8px">VALUE</th>' +
        '<th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    // Button CSS + demos
    var embeddedCss = '';
    var buttonDemosHtml = '';
    var btnNote = '';

    if (components.length > 0) {
      for (var ci = 0; ci < components.length; ci++) {
        var comp = components[ci];
        var sel  = comp.selector;
        embeddedCss += '\n/* ' + comp.name + (comp.source === 'reconstructed' ? ' - inferred' : '') + ' */\n' + sel + ' {\n';
        embeddedCss += '  background-color: ' + comp.effBg + ';\n';
        embeddedCss += '  color: ' + comp.effColor + ';\n';
        var hasBorder = false;
        var bpKeys = Object.keys(comp.baseProps);
        for (var bpi = 0; bpi < bpKeys.length; bpi++) {
          var bk = bpKeys[bpi];
          if (['background-color','background','color'].indexOf(bk) >= 0) continue;
          if (bk.startsWith('border')) hasBorder = true;
          embeddedCss += '  ' + bk + ': ' + comp.baseProps[bk] + ';\n';
        }
        if (!hasBorder) embeddedCss += '  border: none;\n';
        embeddedCss += '}\n';
        if (comp.effHoverBg) {
          embeddedCss += sel + ':hover {\n  background-color: ' + comp.effHoverBg + ';\n}\n';
        } else {
          embeddedCss += sel + ':hover { filter: brightness(0.88); }\n';
        }
      }

      for (var dci = 0; dci < components.length; dci++) {
        var dc        = components[dci];
        var clsStr    = dc.selector.replace(/\./g,' ').trim();
        var hStyle    = dc.height ? 'height:' + dc.height + ';' : 'min-height:44px;';
        var badge     = dc.source === 'reconstructed' ?
           '<span style="font-size:9px;background:#fef3c7;color:#92400e;border-radius:3px;padding:2px 5px;font-weight:700">INFERRED</span>'
          : '';
        var meta = [];
        if (dc.borderRadius && dc.borderRadius !== '0' && dc.borderRadius !== '0px') meta.push('radius: ' + dc.borderRadius);
        if (dc.padding) meta.push('pad: ' + dc.padding);
        if (dc.height)  meta.push('h: ' + dc.height);
        var metaStr = meta.join(' &nbsp;|&nbsp; ');

        buttonDemosHtml +=
          '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;min-width:180px;max-width:220px">' +
          '<button class="' + clsStr + '" style="width:100%;' + hStyle + 'padding:' + dc.padding + ';border-radius:' + dc.borderRadius + ';' +
          'display:flex;align-items:center;justify-content:center;text-transform:uppercase;letter-spacing:0.5px;' +
          'cursor:pointer;font-size:13px;font-weight:700;text-align:center;line-height:1.2;box-sizing:border-box;text-decoration:none">' +
          esc(dc.labelText) + '</button>' +
          '<div style="text-align:center;line-height:1.6">' + badge +
          '<code style="font-size:10px;color:#666">' + esc(dc.selector) + '</code>' +
          '<span style="font-size:10px;color:#bbb;margin-left:4px">DOM: ' + dc.domCount + 'x</span></div>' +
          (metaStr ? '<div style="font-size:9px;color:#ccc;text-align:center">' + metaStr + '</div>' : '') +
          '</div>';
      }

      var cssN = 0, reconN = 0;
      for (var si2 = 0; si2 < components.length; si2++) {
        if (components[si2].source === 'css') cssN++; else reconN++;
      }
      btnNote = 'Found ' + cssN + ' CSS-defined + ' + reconN + ' inferred component(s) - DOM confirmed only. Hover to preview :hover state.';
    } else {
      buttonDemosHtml = '<button style="background:' + primary + ';color:white;padding:10px 28px;border:none;border-radius:4px;font-weight:700;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;text-transform:uppercase">PRIMARY ACTION</button>' +
        '<p style="margin-top:8px;font-size:11px;color:#bbb;font-style:italic">No button classes found in DOM.</p>';
      btnNote = 'No button classes detected in CSS or DOM.';
    }

    // Link CSS
    embeddedCss += '\n/* Link states */\n' +
      '.ds-link { color: ' + lnkColor + '; text-decoration: ' + lnkDecor + '; font-size: 15px; }\n' +
      '.ds-link:hover { color: ' + lnkHvrC + '; text-decoration: ' + lnkHvrD + '; }\n' +
      '.ds-link-hover-state { color: ' + lnkHvrC + '; text-decoration: ' + lnkHvrD + '; font-size: 15px; }\n' +
      '.ds-link-visited { color: ' + lnkVisC + '; text-decoration: ' + lnkDecor + '; font-size: 15px; }\n' +
      '.ds-link-focus { color: ' + lnkFcsC + '; outline: 2px dashed currentColor; outline-offset: 3px; text-decoration: ' + lnkDecor + '; font-size: 15px; }\n';

    if (linkData.named) {
      for (var nli2 = 0; nli2 < linkData.named.length; nli2++) {
        var nl2 = linkData.named[nli2];
        var ns  = '.' + nl2['class'];
        var ps  = Object.keys(nl2.base).map(function(k){ return k + ': ' + nl2.base[k]; }).join('; ');
        if (ps) embeddedCss += ns + ' { ' + ps + '; }\n';
        var hs  = Object.keys(nl2.hover || {}).map(function(k){ return k + ': ' + nl2.hover[k]; }).join('; ');
        if (hs) embeddedCss += ns + ':hover { ' + hs + '; }\n';
      }
    }

    // Links card
    var linkStatesHtml =
      '<div style="display:flex;gap:32px;flex-wrap:wrap;margin-bottom:28px">' +
      '<div><div class="lbl">Default | hover me -></div>' +
      '<a href="javascript:void(0)" class="ds-link">Body link text</a>' +
      '<div style="font-size:10px;color:#bbb;margin-top:4px">color: ' + lnkColor + ' &nbsp;|&nbsp; text-decoration: ' + lnkDecor + '</div></div>' +
      '<div><div class="lbl">Hover state</div>' +
      '<a href="javascript:void(0)" class="ds-link-hover-state">Hover preview</a>' +
      '<div style="font-size:10px;color:#bbb;margin-top:4px">color: ' + lnkHvrC + ' &nbsp;|&nbsp; decoration: ' + lnkHvrD + '</div></div>' +
      '<div><div class="lbl">Visited</div>' +
      '<a href="javascript:void(0)" class="ds-link-visited">Visited link</a>' +
      '<div style="font-size:10px;color:#bbb;margin-top:4px">color: ' + lnkVisC + '</div></div>' +
      '<div><div class="lbl">Focus</div>' +
      '<a href="javascript:void(0)" class="ds-link-focus">Focus state</a>' +
      '<div style="font-size:10px;color:#bbb;margin-top:4px">outline: 2px dashed</div></div>' +
      '</div>';

    var namedLinksHtml = '';
    if (linkData.named && linkData.named.length > 0) {
      namedLinksHtml = '<div class="lbl" style="margin-top:8px;margin-bottom:12px">Named Link Classes</div>' +
        '<div style="display:flex;gap:28px;flex-wrap:wrap">';
      for (var nli3 = 0; nli3 < linkData.named.length; nli3++) {
        var nl3 = linkData.named[nli3];
        var bc3 = nl3.base['color'] || lnkColor;
        var hc3 = (nl3.hover || {})['color'] || bc3;
        namedLinksHtml += '<div style="min-width:160px;margin-bottom:8px">' +
          '<a href="javascript:void(0)" class="' + nl3['class'] + '">' +
          nl3['class'].replace(/-/g,' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); }) + '</a>' +
          '<div style="font-size:10px;color:#bbb;margin-top:4px"><code style="font-size:9px">.' + nl3['class'] + '</code> &nbsp;|&nbsp; DOM: ' + nl3.count + 'x</div>' +
          '<div style="font-size:10px;color:#bbb">color: ' + bc3 + (hc3 !== bc3 ? ' &nbsp;|&nbsp; hover: ' + hc3 : '') + '</div></div>';
      }
      namedLinksHtml += '</div>';
    }

    var linksCard = '<div class="card"><h2>Links &amp; States</h2>' +
      '<p style="font-size:12px;color:#aaa;margin-bottom:20px;font-style:italic">Hover over "Body link text" to preview the live :hover transition.</p>' +
      linkStatesHtml + namedLinksHtml + '</div>';

    // Border Radius card
    var borderRadiusCard = '';
    if (radii.length > 0) {
      var rbBoxes = '';
      for (var rbi = 0; rbi < radii.length; rbi++) {
        rbBoxes += '<div style="text-align:center">' +
          '<div style="width:60px;height:60px;background:' + primary + ';opacity:.7;border-radius:' + radii[rbi] + ';margin:0 auto 8px"></div>' +
          '<code style="font-size:11px;color:#555">' + radii[rbi] + '</code></div>';
      }
      borderRadiusCard = '<div class="card"><h2>Border Radius Scale (' + radii.length + ' tokens)</h2>' +
        '<div style="display:flex;gap:24px;align-items:flex-end;flex-wrap:wrap">' + rbBoxes + '</div></div>';
    }

    // Shadows card
    var shadowsCard = '';
    if (shadows.length > 0) {
      var shBoxes = '';
      for (var shi = 0; shi < shadows.length; shi++) {
        shBoxes += '<div style="background:white;border-radius:10px;padding:20px 24px;box-shadow:' + shadows[shi] + ';min-width:160px;max-width:220px">' +
          '<div style="font-size:10px;color:#888;font-weight:600;margin-bottom:6px">Shadow ' + (shi+1) + '</div>' +
          '<code style="font-size:9px;color:#555;word-break:break-all;line-height:1.5">' + esc(shadows[shi]) + '</code></div>';
      }
      shadowsCard = '<div class="card"><h2>Box Shadows (' + shadows.length + ' tokens)</h2>' +
        '<div style="display:flex;gap:28px;flex-wrap:wrap;align-items:flex-start;padding:8px 0">' + shBoxes + '</div></div>';
    }

    // Aspect Ratios card
    var arList = [['1:1',100,'Avatar | thumbnail'],['4:3',75,'Photo | slide'],['16:9',56.25,'Video | hero'],['21:9',42.86,'Cinematic | banner']];
    var arBoxes = '';
    for (var ari = 0; ari < arList.length; ari++) {
      var lbl2=arList[ari][0], pct=arList[ari][1], desc2=arList[ari][2];
      var w2=120, h2=Math.max(Math.round(w2*pct/100),18);
      arBoxes += '<div style="text-align:center">' +
        '<div style="width:' + w2 + 'px;height:' + h2 + 'px;background:' + primary + ';opacity:.6;border-radius:5px;margin:0 auto 8px;display:flex;align-items:center;justify-content:center">' +
        '<span style="font-size:11px;color:white;font-weight:700">' + lbl2 + '</span></div>' +
        '<div style="font-size:10px;color:#888;margin-bottom:2px">' + desc2 + '</div>' +
        '<code style="font-size:10px;color:#555">pt: ' + pct + '%</code></div>';
    }
    var aspectRatioCard = '<div class="card"><h2>Aspect Ratios</h2>' +
      '<p style="font-size:12px;color:#aaa;margin-bottom:20px;font-style:italic">CSS padding-top trick - maintains ratio at any container width.</p>' +
      '<div style="display:flex;gap:32px;align-items:flex-end;flex-wrap:wrap">' + arBoxes + '</div></div>';

    // Typography
    var bodyFont    = typography.bodyFont;
    var headingFont = typography.headingFont;

    function chips(items) {
      if (!items || !items.length) return '<span style="color:#bbb;font-size:12px">None detected</span>';
      return items.map(function(i){ return '<span style="display:inline-block;background:#f0f0f0;border-radius:4px;padding:2px 8px;margin:2px;font-size:12px;font-family:monospace">' + esc(i) + '</span>'; }).join('');
    }

    var spacingHtml = [4,8,12,16,24,32,48,64,96].map(function(s) {
      return '<div style="text-align:center">' +
        '<div style="width:' + s + 'px;height:' + s + 'px;background:' + primary + ';opacity:.2;border-radius:3px;margin-bottom:4px"></div>' +
        '<code style="font-size:10px;color:#666">' + s + 'px</code></div>';
    }).join('');

    var todayDate  = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    var utilsInline = utilsSource ? String(utilsSource).replace(/<\/script>/gi, '<\\/script>') : '';

    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
      '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<title>Design System Audit - ' + esc(sourceLabel) + '</title>\n' +
      '<script src="https://cdn.tailwindcss.com"><\/script>\n' +
      '<style>\n' +
      '@import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,700,0,0&display=swap");\n' +
      '.dd-header{display:flex;align-items:flex-start;gap:12px;margin-bottom:32px;padding-bottom:18px;border-bottom:1px solid #c7ccd1;}\n' +
      '.dd-header-left{display:flex;align-items:flex-start;gap:10px;flex:1;min-width:0;}\n' +
      '.dd-logo{font-family:"Material Symbols Outlined";font-size:36px;color:#DD1234;line-height:1;flex-shrink:0;}\n' +
      '.dd-title-wrap{min-width:0;}\n' +
      '.dd-report-title{font-size:22px;font-weight:700;line-height:1.2;margin:0 0 3px 0;font-family:"Noto Sans",sans-serif;}\n' +
      '.dd-report-url{font-size:11px;color:#4a4a4a;word-break:break-all;display:block;margin-top:3px;}\n' +
      '.dd-gen-time{font-size:10px;color:#4a4a4a;margin-top:5px;}\n' +
      '.dd-header-btns{display:flex;gap:8px;align-items:flex-start;flex-shrink:0;margin-top:2px;}\n' +
      '.dd-btn{border:1px solid #c7ccd1;background:transparent;color:#1c1c1c;border-radius:999px;padding:8px 16px;font-size:11px;font-weight:700;cursor:pointer;font-family:"Noto Sans",sans-serif;}\n' +
      '.dd-btn:hover{background:#DEE2E6;}\n' +
      '.dd-btn.primary{background:#DD1234;color:#fff;border:none;}\n' +
      '.dd-btn.primary:hover{opacity:0.88;background:#DD1234;}\n' +
      '.dd-container{max-width:960px;margin:0 auto;padding:24px 20px 64px 20px;}\n' +
      'body { font-family: "Noto Sans", sans-serif; background: #F2F5F0; color: #1c1c1c; margin: 0; }\n' +
      '.card { background: white; padding: 28px; border-radius: 14px; box-shadow: 0 2px 16px rgba(0,0,0,0.07); margin-bottom: 32px; }\n' +
      '.dd-section{padding:0;overflow:hidden;}\n' +
      '.dd-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 20px;border-bottom:1px solid #c7ccd1;background:#f8fafc;}\n' +
      '.dd-section-title{font-size:13px;font-weight:700;color:#1c1c1c;}\n' +
      '.dd-section-toggle{border:1px solid #c7ccd1;background:#fff;color:#4a4a4a;border-radius:999px;width:24px;height:24px;font-size:12px;line-height:1;cursor:pointer;padding:0;}\n' +
      '.dd-section-toggle:hover{background:#DEE2E6;}\n' +
      '.dd-section-body{padding:20px;}\n' +
      '.dd-section.is-collapsed .dd-section-body{display:none;}\n' +
      'h1 { font-family: ' + headingFont + ', sans-serif; font-size: 28px; font-weight: 700; margin-bottom: 8px; }\n' +
      'h2 { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #333; }\n' +
      '.lbl { font-size: 11px; color: #888; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .5px; font-weight: 600; }\n' +
      embeddedCss + '\n' +
      '</style>\n</head>\n<body>\n\n' +
      '<div class="dd-container">' +
      '<div class="dd-header">' +
      '<div class="dd-header-left">' +
      '<span class="dd-logo">keyboard_command_key</span>' +
      '<div class="dd-title-wrap">' +
      '<h1 class="dd-report-title">Design System Audit</h1>' +
      '<span class="dd-report-url">' + esc(sourceLabel) + ' &nbsp;&middot;&nbsp; <a href="' + currentUrl + '" target="_blank" rel="noopener noreferrer" style="color:#DD1234;text-decoration:none">' + esc(currentUrl) + '</a></span>' +
      '<div class="dd-gen-time">Generated: ' + new Date().toUTCString() + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="dd-header-btns">' +
      '<button id="reloadReport" class="dd-btn">Reload</button>' +
      '<button id="saveReport" class="dd-btn primary">SAVE HTML</button>' +
      '</div>' +
      '</div>\n' +
      '<p style="color:#aaa;margin-bottom:40px;font-size:12px">Noise filtered: @font-face, @keyframes, base64 URIs, third-party style injections.<br>Primary brand color: <code style="background:#f0f0f0;padding:1px 5px;border-radius:3px">' + primary + '</code></p>\n\n' +
      cssSourceCard + '\n\n' +
      '<div class="card"><h2>Color Palette (' + colors.length + ' tokens)</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:16px">' + swatchesHtml + '</div></div>\n\n' +
      cssVarsCard + '\n\n' +
      '<div class="card"><h2>Typography</h2>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">' +
      '<div><div class="lbl">Body Font</div><code style="font-size:12px;color:#444">' + esc(bodyFont) + '</code></div>' +
      '<div><div class="lbl">Heading Font</div><code style="font-size:12px;color:#444">' + esc(headingFont) + '</code></div>' +
      '</div>' +
      '<div class="lbl" style="margin-bottom:10px">Type Scale</div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px">' +
      '<span style="font-family:' + headingFont + ',sans-serif;font-size:36px;font-weight:700;line-height:1.1">Aa - Display | 36 / 700</span>' +
      '<span style="font-family:' + headingFont + ',sans-serif;font-size:28px;font-weight:700;line-height:1.1">Aa - Heading L | 28 / 700</span>' +
      '<span style="font-family:' + headingFont + ',sans-serif;font-size:22px;font-weight:600;line-height:1.2">Aa - Heading M | 22 / 600</span>' +
      '<span style="font-family:' + bodyFont + ',sans-serif;font-size:16px;line-height:1.5">Aa - Body | 16px - The quick brown fox jumps over the lazy dog.</span>' +
      '<span style="font-family:' + bodyFont + ',sans-serif;font-size:14px;color:#666;line-height:1.5">Aa - Small | 14px - Supporting labels</span>' +
      '<span style="font-family:' + bodyFont + ',sans-serif;font-size:12px;color:#888;line-height:1.5">Aa - Caption | 12px - Metadata, timestamps</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">' +
      '<div><div class="lbl">Font Sizes in CSS</div>' + chips(typography.sizes) + '</div>' +
      '<div><div class="lbl">Font Weights in CSS</div>' + chips(typography.weights) + '</div>' +
      '</div></div>\n\n' +
      '<div class="card"><h2>Spacing Scale</h2>' +
      '<div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">' + spacingHtml + '</div></div>\n\n' +
      '<div class="card"><h2>Buttons &amp; Interactive Components</h2>' +
      '<p style="font-size:12px;color:#aaa;margin-bottom:24px;font-style:italic">' + esc(btnNote) + '</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start">' + buttonDemosHtml + '</div></div>\n\n' +
      linksCard + '\n\n' +
      borderRadiusCard + '\n\n' +
      shadowsCard + '\n\n' +
      aspectRatioCard + '\n\n' +
      '<div style="margin-top:48px;padding-top:24px;border-top:1px solid #e0e0e0;text-align:center">' +
      '<p style="font-size:12px;color:#aaa">Generated by Digital Detective v1.6 &nbsp;|&nbsp; Application Developed by Camilo Mello &nbsp;|&nbsp; ' + todayDate + '</p>' +
      '</div>\n' +
      '</div>\n' +
      (utilsInline ? ('<script>' + utilsInline + '<\/script>\n') : '') +
      '<script>(function(){' +
      'var saveBtn=document.getElementById("saveReport");' +
      'var reloadBtn=document.getElementById("reloadReport");' +
      'if(reloadBtn){reloadBtn.addEventListener("click",function(){window.location.reload();});}' +
      'if(saveBtn&&window.DDReportUtils){window.DDReportUtils.bindSaveButton(saveBtn,"design_system_report.html");}' +
      'var cards=Array.prototype.slice.call(document.querySelectorAll(".card"));' +
      'cards.forEach(function(card,idx){' +
      'if(!card||card.getAttribute("data-collapsible")==="1"){return;}' +
      'var h2=card.querySelector("h2");if(!h2||h2.parentElement!==card){return;}' +
      'card.setAttribute("data-collapsible","1");card.classList.add("dd-section");' +
      'var head=document.createElement("div");head.className="dd-section-head";' +
      'var title=document.createElement("div");title.className="dd-section-title";title.textContent=h2.textContent||"Section";' +
      'var btn=document.createElement("button");btn.className=\"dd-section-toggle\";btn.type=\"button\";btn.innerHTML=\"&#9660;\";btn.setAttribute("aria-label","Collapse section");' +
      'head.appendChild(title);head.appendChild(btn);card.insertBefore(head,h2);h2.remove();' +
      'var body=document.createElement("div");body.className="dd-section-body";while(head.nextSibling){body.appendChild(head.nextSibling);}card.appendChild(body);' +
      'if(idx>1){card.classList.add("is-collapsed");btn.innerHTML="&#9654;";}' +
      'btn.addEventListener("click",function(){var c=card.classList.toggle("is-collapsed");btn.innerHTML=c?"&#9654;":"&#9660;";});' +
      '});' +
      '})();<\/script>\n\n</body>\n</html>';
  }

  function esc(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function extractColorsFromValue(value) {
    if (!value) return [];
    var v = String(value).trim();
    if (!v) return [];
    var lower = v.toLowerCase();
    if (lower === 'transparent' || lower === 'inherit' || lower === 'initial' || lower === 'unset' || lower === 'none') return [];

    var colors = [];
    var hex = v.match(/#[0-9a-fA-F]{3,8}/g);
    if (hex) colors = colors.concat(hex);

    var rgba = v.match(/rgba\([^)]+\)/g);
    if (rgba) {
      rgba.forEach(function (c) {
        var m = c.match(/rgba\(([^)]+)\)/i);
        if (!m) return;
        var parts = m[1].split(',').map(function (p) { return p.trim(); });
        if (parts.length === 4) {
          var alpha = parseFloat(parts[3]);
          if (!isNaN(alpha) && alpha === 0) return;
        }
        colors.push(c);
      });
    }

    var hsl = v.match(/hsla\([^)]+\)/g);
    if (hsl) colors = colors.concat(hsl);

    return colors;
  }

  function addToken(map, key) {
    if (!key) return;
    map[key] = (map[key] || 0) + 1;
  }

  function shouldIgnoreValue(val) {
    var v = (val || '').trim().toLowerCase();
    return !v || v === '0px' || v === '0' || v === 'auto' || v === 'none';
  }

  function isTransparentColor(val) {
    var v = String(val || '').trim().toLowerCase();
    return !v || v === 'transparent' || v === 'rgba(0, 0, 0, 0)' || v === 'rgba(0,0,0,0)';
  }

  function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function parseRuleProps(propsText) {
    var out = {};
    var parts = String(propsText || '').split(';');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!p) continue;
      var idx = p.indexOf(':');
      if (idx < 0) continue;
      var name = p.slice(0, idx).trim().toLowerCase();
      var value = p.slice(idx + 1).trim();
      if (!name || !value) continue;
      out[name] = value;
    }
    return out;
  }

  function pickStateProps(map) {
    var out = {};
    var keys = ['color', 'background', 'background-color', 'border', 'border-color', 'box-shadow', 'text-decoration', 'outline', 'outline-color'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (map.hasOwnProperty(k)) out[k] = map[k];
    }
    return out;
  }

  function selectorMatchesElement(selector, info) {
    if (!selector) return false;
    var sel = selector.replace(/:[:a-zA-Z0-9_-]+(\([^)]*\))/g, '').trim();
    if (!sel) return false;

    var classTokens = sel.match(/\.([a-zA-Z0-9_-]+)/g) || [];
    for (var i = 0; i < classTokens.length; i++) {
      var cls = classTokens[i].slice(1);
      if (!info.classSet[cls]) return false;
    }

    var idMatch = sel.match(/#([a-zA-Z0-9_-]+)/);
    if (idMatch && info.id !== idMatch[1]) return false;

    var tagTokens = sel.match(/(^|[\s>+~])([a-z][a-z0-9-]*)/gi) || [];
    if (tagTokens.length) {
      var hasTag = false;
      for (var t = 0; t < tagTokens.length; t++) {
        var raw = tagTokens[t].trim();
        var tag = raw.replace(/^[\s>+~]+/, '').toLowerCase();
        if (tag && tag === info.tag) { hasTag = true; break; }
      }
      if (!hasTag) return false;
    }

    return true;
  }

  function extractStateStyles(scopedCss, elements, state) {
    var result = new Map();
    if (!scopedCss || !elements || !elements.length) return result;
    var rules = parseFlatRules(scopedCss);
    var token = ':' + state;

    for (var r = 0; r < rules.length; r++) {
      var rule = rules[r];
      if (!rule || !rule.sel || rule.sel.indexOf(token) < 0) continue;
      var selectors = rule.sel.split(',');
      var props = pickStateProps(parseRuleProps(rule.props));
      var hasProps = Object.keys(props).length > 0;
      if (!hasProps) continue;

      for (var s = 0; s < selectors.length; s++) {
        var sel = selectors[s];
        if (sel.indexOf(token) < 0) continue;
        for (var i = 0; i < elements.length; i++) {
          var info = elements[i];
          if (selectorMatchesElement(sel, info)) {
            if (!result.has(info.el)) result.set(info.el, {});
            var current = result.get(info.el);
            for (var k in props) {
              if (!current.hasOwnProperty(k)) current[k] = props[k];
            }
          }
        }
      }
    }
    return result;
  }

  function collectScopedMetrics(rootEl, scopedCss) {
    var elements = [];
    if (rootEl) elements.push(rootEl);
    var descendants = rootEl ? rootEl.querySelectorAll('*') : [];
    for (var i = 0; i < descendants.length; i++) elements.push(descendants[i]);

    var colorMap = {};
    var typeMap = {};
    var spacingSet = {};
    var radiusSet = {};
    var shadowSet = {};
    var buttons = [];
    var links = [];
    var images = [];
    var copyItems = [];

    var buttonEls = rootEl ? rootEl.querySelectorAll('button, a, input') : [];
    var linkEls = rootEl ? rootEl.querySelectorAll('a') : [];
    var imgEls = rootEl ? rootEl.querySelectorAll('img') : [];

    for (var im = 0; im < imgEls.length; im++) {
      var src = imgEls[im].getAttribute('src') || imgEls[im].getAttribute('data-src') || '';
      if (src) images.push(src);
    }

    function recordTypographyText(el, style, text) {
      var clean = normalizeText(text);
      if (!clean) return;
      if (!text) return;
      var key = [
        style.fontFamily || '',
        style.fontSize || '',
        style.fontWeight || '',
        style.lineHeight || '',
        style.letterSpacing || '',
        style.textTransform || ''
      ].join('|');
      if (!typeMap[key]) {
        typeMap[key] = { count: 0, sample: clean.slice(0, 80), style: {
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          textTransform: style.textTransform
        }};
      }
      typeMap[key].count += 1;
      copyItems.push({
        tag: (el.tagName || '').toLowerCase(),
        cls: (el.className || '').trim(),
        text: clean
      });
    }

    function recordButton(el, style, stateMap) {
      var tag = (el.tagName || '').toLowerCase();
      if (tag === 'input') {
        var t = (el.getAttribute('type') || '').toLowerCase();
        if (['button','submit','reset','image'].indexOf(t) < 0) return;
      }
      var text = (el.textContent || '').trim() || el.getAttribute('value') || el.getAttribute('aria-label') || '';
      if (!text) return;
      var beforeStyle = null;
      var afterStyle = null;
      try { beforeStyle = window.getComputedStyle(el, '::before'); } catch (e) {}
      try { afterStyle = window.getComputedStyle(el, '::after'); } catch (e2) {}

      var bg = style.backgroundColor;
      if (isTransparentColor(bg)) {
        if (beforeStyle && !isTransparentColor(beforeStyle.backgroundColor)) bg = beforeStyle.backgroundColor;
        else if (afterStyle && !isTransparentColor(afterStyle.backgroundColor)) bg = afterStyle.backgroundColor;
      }

      buttons.push({
        label: text.slice(0, 60),
        selector: (el.className || '').trim(),
        styles: {
          background: bg || '',
          color: style.color || '',
          border: style.border || '',
          radius: style.borderRadius || '',
          padding: style.padding || '',
          fontSize: style.fontSize || '',
          fontWeight: style.fontWeight || ''
        },
        states: stateMap || {}
      });
    }

    function recordLink(el, style, stateMap) {
      var text = (el.textContent || '').trim();
      if (!text) return;
      links.push({
        label: text.slice(0, 60),
        href: el.getAttribute('href') || '',
        styles: {
          color: style.color || '',
          decoration: style.textDecoration || '',
          fontWeight: style.fontWeight || ''
        },
        states: stateMap || {}
      });
    }

    var buttonInfos = [];
    for (var bi = 0; bi < buttonEls.length; bi++) {
      var bEl = buttonEls[bi];
      if (!bEl || !bEl.tagName) continue;
      var bClassSet = {};
      if (bEl.classList && bEl.classList.length) {
        for (var bc = 0; bc < bEl.classList.length; bc++) bClassSet[bEl.classList[bc]] = true;
      }
      buttonInfos.push({
        el: bEl,
        tag: (bEl.tagName || '').toLowerCase(),
        id: bEl.id || '',
        classSet: bClassSet
      });
    }

    var linkInfos = [];
    for (var li = 0; li < linkEls.length; li++) {
      var lEl = linkEls[li];
      if (!lEl || !lEl.tagName) continue;
      var lClassSet = {};
      if (lEl.classList && lEl.classList.length) {
        for (var lc = 0; lc < lEl.classList.length; lc++) lClassSet[lEl.classList[lc]] = true;
      }
      linkInfos.push({
        el: lEl,
        tag: (lEl.tagName || '').toLowerCase(),
        id: lEl.id || '',
        classSet: lClassSet
      });
    }

    var hoverButtons = extractStateStyles(scopedCss, buttonInfos, 'hover');
    var focusButtons = extractStateStyles(scopedCss, buttonInfos, 'focus');
    var hoverLinks = extractStateStyles(scopedCss, linkInfos, 'hover');
    var focusLinks = extractStateStyles(scopedCss, linkInfos, 'focus');

    for (var e = 0; e < elements.length; e++) {
      var el = elements[e];
      if (!el || !el.tagName) continue;
      var style = window.getComputedStyle(el);
      if (!style) continue;
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

      for (var cp = 0; cp < UI_COLOR_PROPS.length; cp++) {
        var prop = UI_COLOR_PROPS[cp];
        var val = style.getPropertyValue(prop);
        var found = extractColorsFromValue(val);
        for (var fi = 0; fi < found.length; fi++) addToken(colorMap, found[fi]);
      }

      var beforeStyle = null;
      var afterStyle = null;
      try { beforeStyle = window.getComputedStyle(el, '::before'); } catch (e1) {}
      try { afterStyle = window.getComputedStyle(el, '::after'); } catch (e2) {}
      if (beforeStyle && beforeStyle.content && beforeStyle.content !== 'none') {
        for (var cpb = 0; cpb < UI_COLOR_PROPS.length; cpb++) {
          var pprop = UI_COLOR_PROPS[cpb];
          var pval = beforeStyle.getPropertyValue(pprop);
          var pfound = extractColorsFromValue(pval);
          for (var pfi = 0; pfi < pfound.length; pfi++) addToken(colorMap, pfound[pfi]);
        }
        var pshadow = (beforeStyle.boxShadow || '').trim();
        if (pshadow && pshadow !== 'none') shadowSet[pshadow] = true;
      }
      if (afterStyle && afterStyle.content && afterStyle.content !== 'none') {
        for (var cpa = 0; cpa < UI_COLOR_PROPS.length; cpa++) {
          var aprop = UI_COLOR_PROPS[cpa];
          var aval = afterStyle.getPropertyValue(aprop);
          var afound = extractColorsFromValue(aval);
          for (var afi = 0; afi < afound.length; afi++) addToken(colorMap, afound[afi]);
        }
        var ashadow = (afterStyle.boxShadow || '').trim();
        if (ashadow && ashadow !== 'none') shadowSet[ashadow] = true;
      }

      var mt = style.marginTop, mr = style.marginRight, mb = style.marginBottom, ml = style.marginLeft;
      var pt = style.paddingTop, pr = style.paddingRight, pb = style.paddingBottom, pl = style.paddingLeft;
      if (!shouldIgnoreValue(mt)) spacingSet[mt] = true;
      if (!shouldIgnoreValue(mr)) spacingSet[mr] = true;
      if (!shouldIgnoreValue(mb)) spacingSet[mb] = true;
      if (!shouldIgnoreValue(ml)) spacingSet[ml] = true;
      if (!shouldIgnoreValue(pt)) spacingSet[pt] = true;
      if (!shouldIgnoreValue(pr)) spacingSet[pr] = true;
      if (!shouldIgnoreValue(pb)) spacingSet[pb] = true;
      if (!shouldIgnoreValue(pl)) spacingSet[pl] = true;

      var br = style.borderRadius;
      if (!shouldIgnoreValue(br)) radiusSet[br] = true;

      var sh = style.boxShadow;
      if (sh && sh !== 'none') shadowSet[sh] = true;
    }

    if (rootEl) {
      var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          if (!node || !node.parentElement) return NodeFilter.FILTER_REJECT;
          var text = normalizeText(node.nodeValue || '');
          if (!text) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var current;
      while ((current = walker.nextNode())) {
        var parent = current.parentElement;
        if (!parent) continue;
        var pStyle = window.getComputedStyle(parent);
        if (!pStyle) continue;
        if (pStyle.display === 'none' || pStyle.visibility === 'hidden' || pStyle.opacity === '0') continue;
        recordTypographyText(parent, pStyle, current.nodeValue || '');
      }
    }

    for (var b = 0; b < buttonEls.length; b++) {
      var btn = buttonEls[b];
      var state = {
        hover: hoverButtons.get(btn) || {},
        focus: focusButtons.get(btn) || {}
      };
      recordButton(btn, window.getComputedStyle(btn), state);
    }
    for (var l = 0; l < linkEls.length; l++) {
      var link = linkEls[l];
      var lstate = {
        hover: hoverLinks.get(link) || {},
        focus: focusLinks.get(link) || {}
      };
      recordLink(link, window.getComputedStyle(link), lstate);
    }

    function mapToSortedList(map) {
      return Object.keys(map).map(function (k) { return { value: k, count: map[k] }; })
        .sort(function (a, b) { return b.count - a.count; });
    }

    var typography = Object.keys(typeMap).map(function (k) { return typeMap[k]; })
      .sort(function (a, b) { return b.count - a.count; });

    var colorsList = mapToSortedList(colorMap);
    if (scopedCss) {
      try {
        var cssColors = extractColors(scopedCss);
        for (var cc = 0; cc < cssColors.length; cc++) addToken(colorMap, cssColors[cc]);
      } catch (e3) {}
      colorsList = mapToSortedList(colorMap);
    }

    if (scopedCss) {
      try {
        var cssRadii = extractBorderRadii(scopedCss);
        for (var ri = 0; ri < cssRadii.length; ri++) radiusSet[cssRadii[ri]] = true;
      } catch (e4) {}
      try {
        var cssShadows = extractShadows(scopedCss);
        for (var si = 0; si < cssShadows.length; si++) shadowSet[cssShadows[si]] = true;
      } catch (e5) {}
    }

    return {
      counts: {
        elements: elements.length,
        text: copyItems.length,
        buttons: buttons.length,
        links: links.length,
        images: images.length
      },
      colors: colorsList,
      typography: typography,
      spacing: Object.keys(spacingSet),
      radii: Object.keys(radiusSet),
      shadows: Object.keys(shadowSet),
      buttons: buttons,
      links: links,
      images: images,
      copyItems: copyItems
    };
  }

  function generateScopedReport(opts) {
    var scopeName = normalizeEncodingArtifacts(opts.scopeName || 'Selected Element');
    var sourceUrl = opts.sourceUrl || '';
    var counts = opts.counts || {};
    var colors = opts.colors || [];
    var typography = opts.typography || [];
    var spacing = opts.spacing || [];
    var radii = opts.radii || [];
    var shadows = opts.shadows || [];
    var buttons = opts.buttons || [];
    var links = opts.links || [];
    var images = opts.images || [];
    var copyItems = opts.copyItems || [];
    var sourceHtml = opts.sourceHtml || '';
    var utilsSource = opts.utilsSource || '';
    var previewHtml = opts.previewHtml || '';
    var previewCss = opts.previewCss || '';
    var previewBase = opts.previewBase || '';
    var previewHtmlAttrs = opts.previewHtmlAttrs || '';
    var previewBodyAttrs = opts.previewBodyAttrs || '';

    function renderChips(items, emptyText) {
      if (!items.length) return '<p class="muted">' + esc(emptyText) + '</p>';
      return '<div class="chips">' + items.map(function (i) {
        var val = (typeof i === 'string') ? i : (i.value + (i.count ? (' | ' + i.count) : ''));
        return '<span class="chip">' + esc(val) + '</span>';
      }).join('') + '</div>';
    }

    function renderList(items, emptyText) {
      if (!items.length) return '<p class="muted">' + esc(emptyText) + '</p>';
      return '<ul>' + items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>';
    }

    function renderButtons() {
      if (!buttons.length) return '<p class="muted">No buttons found.</p>';
      return '<div class="grid">' + buttons.map(function (btn) {
        var hover = (btn.states && btn.states.hover) ? btn.states.hover : {};
        var focus = (btn.states && btn.states.focus) ? btn.states.focus : {};
        var hoverBg = hover['background-color'] || hover.background || '';
        var focusBg = focus['background-color'] || focus.background || '';
        return '<div class="card">' +
          '<div class="card-title">' + esc(btn.label || 'Button') + '</div>' +
          '<div class="muted">' + esc(btn.selector || '') + '</div>' +
          '<div class="kv"><span>BG</span><span>' + esc(btn.styles.background || '-') + '</span></div>' +
          '<div class="kv"><span>Color</span><span>' + esc(btn.styles.color || '-') + '</span></div>' +
          '<div class="kv"><span>Radius</span><span>' + esc(btn.styles.radius || '-') + '</span></div>' +
          '<div class="kv"><span>Padding</span><span>' + esc(btn.styles.padding || '-') + '</span></div>' +
          (hoverBg || hover.color || hover.border || hover['border-color'] || hover['box-shadow'] ?
            '<div class="kv"><span>Hover BG</span><span>' + esc(hoverBg || '-') + '</span></div>' +
            '<div class="kv"><span>Hover Color</span><span>' + esc(hover.color || '-') + '</span></div>' +
            '<div class="kv"><span>Hover Border</span><span>' + esc(hover.border || hover['border-color'] || '-') + '</span></div>' +
            '<div class="kv"><span>Hover Shadow</span><span>' + esc(hover['box-shadow'] || '-') + '</span></div>'
          : '') +
          (focusBg || focus.color || focus.border || focus['border-color'] || focus['box-shadow'] || focus.outline ?
            '<div class="kv"><span>Focus BG</span><span>' + esc(focusBg || '-') + '</span></div>' +
            '<div class="kv"><span>Focus Color</span><span>' + esc(focus.color || '-') + '</span></div>' +
            '<div class="kv"><span>Focus Border</span><span>' + esc(focus.border || focus['border-color'] || focus.outline || '-') + '</span></div>' +
            '<div class="kv"><span>Focus Shadow</span><span>' + esc(focus['box-shadow'] || '-') + '</span></div>'
          : '') +
          '</div>';
      }).join('') + '</div>';
    }

    function renderLinks() {
      if (!links.length) return '<p class="muted">No links found.</p>';
      return '<div class="grid">' + links.map(function (lnk) {
        var hover = (lnk.states && lnk.states.hover) ? lnk.states.hover : {};
        var focus = (lnk.states && lnk.states.focus) ? lnk.states.focus : {};
        return '<div class="card">' +
          '<div class="card-title">' + esc(lnk.label || 'Link') + '</div>' +
          '<div class="muted">' + esc(lnk.href || '') + '</div>' +
          '<div class="kv"><span>Color</span><span>' + esc(lnk.styles.color || '-') + '</span></div>' +
          '<div class="kv"><span>Decoration</span><span>' + esc(lnk.styles.decoration || '-') + '</span></div>' +
          (hover.color || hover['text-decoration'] ?
            '<div class="kv"><span>Hover Color</span><span>' + esc(hover.color || '-') + '</span></div>' +
            '<div class="kv"><span>Hover Decor</span><span>' + esc(hover['text-decoration'] || '-') + '</span></div>'
          : '') +
          (focus.color || focus['text-decoration'] || focus.outline ?
            '<div class="kv"><span>Focus Color</span><span>' + esc(focus.color || '-') + '</span></div>' +
            '<div class="kv"><span>Focus Decor</span><span>' + esc(focus['text-decoration'] || focus.outline || '-') + '</span></div>'
          : '') +
          '</div>';
      }).join('') + '</div>';
    }

    function renderTypography() {
      if (!typography.length) return '<p class="muted">No text styles found.</p>';
      return '<div class="grid">' + typography.map(function (t) {
        return '<div class="card">' +
          '<div class="card-title">Text | ' + esc(t.count || 1) + 'x</div>' +
          '<div class="muted">' + esc(t.sample || '') + '</div>' +
          '<div class="kv"><span>Font</span><span>' + esc((t.style && t.style.fontFamily) || '-') + '</span></div>' +
          '<div class="kv"><span>Size</span><span>' + esc((t.style && t.style.fontSize) || '-') + '</span></div>' +
          '<div class="kv"><span>Weight</span><span>' + esc((t.style && t.style.fontWeight) || '-') + '</span></div>' +
          '</div>';
      }).join('') + '</div>';
    }

    function renderCopyItems() {
      if (!copyItems.length) return '<p class="muted">No copy found.</p>';
      return '<div class="copy-list">' + copyItems.map(function (c) {
        var label = (c.tag || '') + (c.cls ? ('.' + c.cls.split(/\s+/).slice(0, 2).join('.')) : '');
        return '<div class="copy-item">' +
          '<div class="copy-label">' + esc(label || 'text') + '</div>' +
          '<div class="copy-edit" contenteditable="true">' + esc(c.text || '') + '</div>' +
          '</div>';
      }).join('') + '</div>';
    }

    var previewPayload = {
      html: previewHtml,
      css: previewCss,
      baseHref: previewBase,
      htmlAttrs: previewHtmlAttrs,
      bodyAttrs: previewBodyAttrs
    };
    var previewJson = JSON.stringify(previewPayload).replace(/</g, '\\u003c');
    var previewSection = '';
    if (previewHtml || previewCss) {
      function buildPreviewDocString(html, css, baseHref, htmlAttrs, bodyAttrs) {
        var baseTag = baseHref ? '<base href="' + esc(baseHref) + '" />' : '';
        var htmlAttr = htmlAttrs ? ' ' + htmlAttrs : '';
        var bodyAttr = bodyAttrs ? ' ' + bodyAttrs : '';
        return '<!doctype html><html' + htmlAttr + '><head><meta charset="utf-8" />' +
          '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
          baseTag + '<style>body{margin:0;}' + (css || '') + '</style></head><body' + bodyAttr + '>' +
          (html || '') + '</body></html>';
      }
      var previewDoc = buildPreviewDocString(previewHtml, previewCss, previewBase, previewHtmlAttrs, previewBodyAttrs);
      var previewDocEsc = esc(previewDoc);
      previewSection =
        '<section class="panel"><div class="panel-content"><h2 class="panel-title">Component Preview</h2>' +
        '<div class="preview-grid">' +
        '<div>' +
        '<div class="preview-box"><iframe title="Desktop preview" data-preview-desktop srcdoc="' + previewDocEsc + '"></iframe></div>' +
        '<div class="preview-actions"><button class="btn ghost" data-download-preview="desktop">DOWNLOAD IMAGE</button></div>' +
        '</div>' +
        '<div>' +
        '<div class="preview-box preview-mobile"><iframe title="Mobile preview" data-preview-mobile srcdoc="' + previewDocEsc + '"></iframe></div>' +
        '<div class="preview-actions"><button class="btn ghost" data-download-preview="mobile">DOWNLOAD IMAGE</button></div>' +
        '</div>' +
        '</div></div></section>';
    }

    var codeSection = '';
    if (sourceHtml) {
      codeSection =
        '<section class="panel"><div class="panel-content">' +
        '<div class="panel-header">' +
        '<h2 class="panel-title">Component HTML</h2>' +
        '<div class="actions"><button class="btn ghost" data-open-code>View Code</button></div>' +
        '</div>' +
        '<p class="muted">Open the full HTML snippet in a dedicated viewer.</p>' +
        '</div></section>';
    }

    var todayDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    var utilsInline = utilsSource ? String(utilsSource).replace(/<\/script>/gi, '<\\/script>') : '';
    var sourceJson = JSON.stringify({ html: sourceHtml || '' }).replace(/</g, '\\u003c');

    return '<!doctype html><html lang="en"><head><meta charset="utf-8" />' +
      '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
      '<title>Design System Audit - Scoped</title>' +
      '<style>' +
      '@import url("https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,700,0,0&family=Noto+Sans:wght@400;700&display=swap");' +
      'body{margin:0;font-family:"Noto Sans",sans-serif;background:#F2F5F0;color:#1c1c1c;}' +
      '.page{max-width:960px;margin:24px auto 64px;padding:0 20px;}' +
      '.header{display:flex;align-items:flex-start;gap:12px;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid #c7ccd1;}' +
      '.header-left{display:flex;align-items:flex-start;gap:10px;flex:1;min-width:0;}' +
      '.dd-logo{font-family:"Material Symbols Outlined";font-size:36px;color:#DD1234;line-height:1;flex-shrink:0;}' +
      '.title-wrap{min-width:0;}' +
      '.title{font-size:22px;font-weight:700;margin:0 0 3px 0;line-height:1.2;}' +
      '.report-url{font-size:11px;color:#4a4a4a;word-break:break-all;display:block;margin-top:3px;}' +
      '.report-url-link{color:#DD1234;text-decoration:none;}' +
      '.report-url-link:hover{text-decoration:underline;}' +
      '.gen-time{font-size:10px;color:#4a4a4a;margin-top:5px;}' +
      '.header-btns{display:flex;gap:8px;align-items:flex-start;flex-shrink:0;margin-top:2px;}' +
      '.dd-btn{border:1px solid #c7ccd1;background:transparent;color:#1c1c1c;border-radius:999px;padding:8px 16px;font-size:11px;font-weight:700;cursor:pointer;font-family:"Noto Sans",sans-serif;}' +
      '.dd-btn:hover{background:#DEE2E6;}' +
      '.dd-btn.primary{background:#DD1234;color:#fff;border:none;}' +
      '.dd-btn.primary:hover{opacity:0.88;background:#DD1234;}' +
      '.subtitle{color:#555;margin:0 0 12px 0;font-size:13px;}' +
      '.panel{background:#fff;border:1px solid #c7ccd1;border-radius:14px;margin-bottom:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);}' +
      '.panel-content{padding:16px;}' +
      '.panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 16px;border-bottom:1px solid #c7ccd1;background:#f8fafc;}' +
      '.panel-title{color:#1c1c1c;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin:0;}' +
      '.panel-toggle{border:1px solid #c7ccd1;background:#fff;color:#4a4a4a;border-radius:999px;width:24px;height:24px;font-size:12px;line-height:1;cursor:pointer;padding:0;}' +
      '.panel-toggle:hover{background:#DEE2E6;}' +
      '.panel-body{padding:16px;}' +
      '.panel.is-collapsed .panel-body{display:none;}' +
      '.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));}' +
      '.card{border:1px solid #c7ccd1;border-radius:10px;padding:12px;background:#fafafa;}' +
      '.card-title{font-weight:700;font-size:13px;margin:0 0 6px 0;}' +
      '.muted{color:#6b6f76;font-size:12px;margin:0;}' +
      '.chips{display:flex;flex-wrap:wrap;gap:6px;}' +
      '.chip{background:#f2f3f5;border:1px solid #c7ccd1;border-radius:999px;padding:4px 8px;font-size:11px;}' +
      '.kv{display:flex;justify-content:space-between;font-size:11px;color:#4a4a4a;margin-top:6px;}' +
      '.actions{display:flex;gap:8px;justify-content:flex-end;}' +
      '.btn{background:#DD1234;color:#fff;border:none;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;}' +
      '.btn.ghost{background:#fff;color:#DD1234;border:1px solid #DD1234;}' +
      '.panel-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;}' +
      '.code-block{background:#0f172a;color:#e2e8f0;border-radius:12px;padding:18px;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;max-height:70vh;overflow:auto;}' +
      '.modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9999;}' +
      '.modal.is-open{display:flex;}' +
      '.modal-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.65);}' +
      '.modal-content{position:relative;z-index:2;background:#fff;border-radius:16px;max-width:900px;width:min(92vw,900px);max-height:90vh;overflow:hidden;display:flex;flex-direction:column;}' +
      '.modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #e2e4e7;font-weight:700;}' +
      '.modal-body{padding:20px;overflow:auto;}' +
      '.modal-close{background:#fff;border:1px solid #e2e4e7;border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer;}' +
      '.copy-list{display:grid;gap:10px;}' +
      '.copy-item{border:1px dashed #d4d7dc;border-radius:10px;padding:10px;background:#fafafa;}' +
      '.copy-label{font-size:11px;color:#6b6f76;margin-bottom:6px;}' +
      '.copy-edit{font-size:13px;outline:none;}' +
      '.preview-grid{display:grid;gap:12px;grid-template-columns:1fr;}' +
      '@media (min-width:900px){.preview-grid{grid-template-columns:1fr 1fr;}}' +
      '.preview-box{background:#fff;border:1px solid #e2e4e7;border-radius:12px;overflow:hidden;}' +
      '.preview-box iframe{width:100%;height:360px;border:0;display:block;background:#fff;}' +
      '.preview-mobile{max-width:420px;margin:0 auto;display:flex;justify-content:center;}' +
      '.preview-mobile iframe{width:360px;height:640px;}' +
      '.preview-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px;}' +
      '</style></head><body><div class="page">' +
      '<div class="header">' +
      '<div class="header-left">' +
      '<span class="dd-logo">keyboard_command_key</span>' +
      '<div class="title-wrap">' +
      '<h1 class="title">Design System Audit - Scoped</h1>' +
      '<span class="report-url">Scope: ' + esc(scopeName) + (sourceUrl ? (' &nbsp;&middot;&nbsp; <a class="report-url-link" href="' + esc(sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(sourceUrl) + '</a>') : '') + '</span>' +
      '<div class="gen-time">Generated: ' + new Date().toUTCString() + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="header-btns">' +
      '<button class="dd-btn" id="reloadReport">Reload</button>' +
      '<button class="dd-btn primary" id="saveReport">SAVE HTML</button>' +
      '</div>' +
      '</div>' +
      '<section class="panel"><div class="panel-content"><h2 class="panel-title">Summary</h2>' +
      '<div class="grid">' +
      '<div class="card"><div class="card-title">Elements</div><div class="muted">' + esc(String(counts.elements || 0)) + '</div></div>' +
      '<div class="card"><div class="card-title">Text Items</div><div class="muted">' + esc(String(counts.text || 0)) + '</div></div>' +
      '<div class="card"><div class="card-title">Buttons</div><div class="muted">' + esc(String(counts.buttons || 0)) + '</div></div>' +
      '<div class="card"><div class="card-title">Links</div><div class="muted">' + esc(String(counts.links || 0)) + '</div></div>' +
      '</div></div></section>' +
      previewSection +
      codeSection +
      '<section class="panel"><div class="panel-content"><h2 class="panel-title">Colors</h2>' + renderChips(colors, 'No colors detected.') + '</div></section>' +
      '<section class="panel"><div class="panel-content"><h2 class="panel-title">Typography</h2>' + renderTypography() + '</div></section>' +
      '<section class="panel"><div class="panel-content"><h2 class="panel-title">Spacing</h2>' + renderChips(spacing, 'No spacing tokens found.') + '</div></section>' +
      '<section class="panel"><div class="panel-content"><h2 class="panel-title">Radius</h2>' + renderChips(radii, 'No border-radius found.') + '</div></section>' +
      '<section class="panel"><div class="panel-content"><h2 class="panel-title">Shadows</h2>' + renderList(shadows, 'No shadows found.') + '</div></section>' +
      '<section class="panel"><div class="panel-content"><h2 class="panel-title">Buttons</h2>' + renderButtons() + '</div></section>' +
      '<section class="panel"><div class="panel-content"><h2 class="panel-title">Links</h2>' + renderLinks() + '</div></section>' +
      '<section class="panel"><div class="panel-content"><h2 class="panel-title">Images</h2>' + renderList(images, 'No images found.') + '</div></section>' +
      '<section class="panel"><div class="panel-content"><p class="muted">Generated by Digital Detective v1.6 | ' + esc(todayDate) + '</p></div></section>' +
      '</div>' +
      '<div class="modal" id="codeModal" aria-hidden="true">' +
      '<div class="modal-backdrop" data-close-code></div>' +
      '<div class="modal-content" role="dialog" aria-modal="true" aria-label="Component code">' +
      '<div class="modal-header"><span>Component - code</span><button class="modal-close" type="button" data-close-code>Close</button></div>' +
      '<div class="modal-body"><pre class="code-block" data-code-view></pre></div>' +
      '</div></div>' +
      '<script type="application/json" id="dd-preview-data">' + previewJson + '</script>' +
      '<script type="application/json" id="dd-source-html">' + sourceJson + '</script>' +
      (utilsInline ? ('<script>' + utilsInline + '<\\/script>') : '') +
      '<script>' +
      'var previewData={};try{var el=document.getElementById(\"dd-preview-data\");if(el){previewData=JSON.parse(el.textContent||\"{}\");}}catch(e){}' +
      'function buildPreviewDoc(html,css,baseHref,htmlAttrs,bodyAttrs){var baseTag=baseHref?\"<base href=\\"\"+baseHref+\"\\" />\":\"\";var htmlAttr=htmlAttrs?\" \"+htmlAttrs:\"\";var bodyAttr=bodyAttrs?\" \"+bodyAttrs:\"\";return \"<!doctype html><html\"+htmlAttr+\"><head><meta charset=\\"utf-8\\" /><meta name=\\"viewport\\" content=\\"width=device-width, initial-scale=1\\" />\"+baseTag+\"<style>body{margin:0;}\"+css+\"</style></head><body\"+bodyAttr+\">\"+html+\"</body></html>\";}' +
      'function setFrame(frame){if(!frame||!previewData.html){return;}var doc=buildPreviewDoc(previewData.html,previewData.css||\"\",previewData.baseHref||\"\",previewData.htmlAttrs||\"\",previewData.bodyAttrs||\"\");frame.srcdoc=doc;}' +
      'function initPreview(){setFrame(document.querySelector(\"[data-preview-desktop]\"));setFrame(document.querySelector(\"[data-preview-mobile]\"));}' +
      'initPreview();' +
      'var reloadBtn=document.getElementById(\"reloadReport\");if(reloadBtn){reloadBtn.addEventListener(\"click\",function(){window.location.reload();});}' +
      'var panels=Array.prototype.slice.call(document.querySelectorAll(\".panel\"));panels.forEach(function(panel,idx){' +
      'if(!panel||panel.getAttribute(\"data-collapsible\")===\"1\"){return;}' +
      'var titleEl=panel.querySelector(\".panel-title\");if(!titleEl){return;}' +
      'var titleText=titleEl.textContent||\"Section\";titleEl.remove();' +
      'panel.setAttribute(\"data-collapsible\",\"1\");' +
      'var head=document.createElement(\"div\");head.className=\"panel-head\";' +
      'var title=document.createElement(\"div\");title.className=\"panel-title\";title.textContent=titleText;' +
      'var btn=document.createElement(\"button\");btn.className=\"panel-toggle\";btn.type=\"button\";btn.innerHTML=\"&#9660;\";btn.setAttribute(\"aria-label\",\"Collapse section\");' +
      'head.appendChild(title);head.appendChild(btn);panel.insertBefore(head,panel.firstChild);' +
      'var body=document.createElement(\"div\");body.className=\"panel-body\";while(head.nextSibling){body.appendChild(head.nextSibling);}panel.appendChild(body);' +
      'if(idx>1){panel.classList.add(\"is-collapsed\");btn.innerHTML=\"&#9654;\";}' +
      'btn.addEventListener(\"click\",function(){var c=panel.classList.toggle(\"is-collapsed\");btn.innerHTML=c?\"&#9654;\":\"&#9660;\";});' +
      '});' +
      'var sourceHtml=\"\";try{var sh=document.getElementById(\"dd-source-html\");if(sh){var s=JSON.parse(sh.textContent||\"{}\");sourceHtml=s.html||\"\";}}catch(e){}' +
      'if(window.DDReportUtils){window.DDReportUtils.bindSaveButton(document.getElementById(\"saveReport\"),\"design_system_report_scoped.html\");' +
      'window.DDReportUtils.bindCodeModal({modal:document.getElementById(\"codeModal\"),openBtn:document.querySelector(\"[data-open-code]\"),getHtml:function(){return sourceHtml;}});' +
      'window.DDReportUtils.bindPreviewDownloads({desktopBtn:document.querySelector(\"[data-download-preview=desktop]\"),mobileBtn:document.querySelector(\"[data-download-preview=mobile]\"),desktopFrame:document.querySelector(\"[data-preview-desktop]\"),mobileFrame:document.querySelector(\"[data-preview-mobile]\"),filenameBase:\"component\"});}' +
      '</script>' +
      '</body></html>';
  }

  function scopeLabel(el) {
    if (!el) return 'scoped';
    var tag = (el.tagName || '').toLowerCase();
    var id = el.id ? ('#' + el.id) : '';
    var cls = '';
    if (el.classList && el.classList.length) {
      cls = '.' + Array.from(el.classList).slice(0, 3).join('.');
    }
    return (tag + id + cls).replace(/\s+/g, '').slice(0, 64) || 'scoped';
  }

  function sanitizeFilename(name) {
    return String(name || 'scoped')
      .replace(/[\\/:*"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
  }

  function buildTempScopeFromHtml(html) {
    var container = document.createElement('div');
    container.setAttribute('data-dd-temp-scope', '1');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '1200px';
    container.style.visibility = 'hidden';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '-1';
    container.style.contain = 'layout style paint';

    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    var scripts = tpl.content.querySelectorAll('script');
    for (var i = 0; i < scripts.length; i++) scripts[i].remove();
    container.appendChild(tpl.content);

    document.documentElement.appendChild(container);
    var root = container;
    if (container.childElementCount === 1 && container.firstElementChild) {
      root = container.firstElementChild;
    }
    return { container: container, root: root };
  }

  async function runScopedExtraction(rootEl) {
    if (!rootEl) { showToast('No element selected'); return; }
    try {
      var collected = await collectAllCss();
      var scopedCss = filterCssByRoot(collected.allCss, rootEl);
      var metrics = collectScopedMetrics(rootEl, scopedCss);

      var rawHtml = rootEl.outerHTML || '';
      var sanitizedHtml = sanitizeHtml(rawHtml);
      var baseHref = location.href;
      var allCssRaw = collected.allCssRaw || collected.allCss || '';
      var previewCssAbs = rewriteCssUrls(allCssRaw, baseHref);
      var scopedCssRaw = filterCssByRoot(allCssRaw, rootEl);
      var assetUrls = uniqueList(
        collectUrlsFromCss(rewriteCssUrls(scopedCssRaw, baseHref)).concat(
          collectUrlsFromHtml(sanitizedHtml, baseHref)
        )
      );
      var assetMap = await buildAssetMap(assetUrls, 40);
      var previewCssFinal = normalizeEncodingArtifacts(replaceUrlsWithMap(previewCssAbs, baseHref, assetMap));
      var previewHtmlFinal = normalizeEncodingArtifacts(rewriteHtmlAssets(sanitizedHtml, baseHref, assetMap));

      var label = scopeLabel(rootEl);
      var utilsSource = await getReportUtilsSource();
      var html = generateScopedReport({
        scopeName: label,
        sourceUrl: location.href,
        counts: metrics.counts,
        colors: metrics.colors,
        typography: metrics.typography,
        spacing: metrics.spacing,
        radii: metrics.radii,
        shadows: metrics.shadows,
        buttons: metrics.buttons,
        links: metrics.links,
        images: metrics.images,
        copyItems: metrics.copyItems,
        sourceHtml: sanitizedHtml,
        utilsSource: utilsSource,
        previewHtml: previewHtmlFinal,
        previewCss: previewCssFinal,
        previewBase: baseHref,
        previewHtmlAttrs: collectAttrs(document.documentElement),
        previewBodyAttrs: collectAttrs(document.body)
      });

      var filename = 'design_system_report_scoped_' + sanitizeFilename(label) + '.html';
      chrome.runtime.sendMessage({ action: 'open_report_viewer', html: html, filename: filename });
      showToast('Scoped DS opened');
    } catch (e) {
      showToast('Scoped DS failed');
    }
  }

  async function runScopedExtractionFromHtml(html) {
    if (!html) throw new Error('No HTML provided');
    var scope = buildTempScopeFromHtml(html);
    try {
      var collected = await collectAllCss();
      var scopedCss = filterCssByRoot(collected.allCss, scope.root);
      var metrics = collectScopedMetrics(scope.root, scopedCss);

      var sanitizedHtml = sanitizeHtml(html);
      var baseHref = location.href;
      var allCssRaw = collected.allCssRaw || collected.allCss || '';
      var previewCssAbs = rewriteCssUrls(allCssRaw, baseHref);
      var scopedCssRaw = filterCssByRoot(allCssRaw, scope.root);
      var assetUrls = uniqueList(
        collectUrlsFromCss(rewriteCssUrls(scopedCssRaw, baseHref)).concat(
          collectUrlsFromHtml(sanitizedHtml, baseHref)
        )
      );
      var assetMap = await buildAssetMap(assetUrls, 40);
      var previewCssFinal = normalizeEncodingArtifacts(replaceUrlsWithMap(previewCssAbs, baseHref, assetMap));
      var previewHtmlFinal = normalizeEncodingArtifacts(rewriteHtmlAssets(sanitizedHtml, baseHref, assetMap));

      var label = (scope.root === scope.container) ? 'HTML Snippet' : scopeLabel(scope.root);
      var utilsSource = await getReportUtilsSource();
      return generateScopedReport({
        scopeName: label,
        sourceUrl: location.href,
        counts: metrics.counts,
        colors: metrics.colors,
        typography: metrics.typography,
        spacing: metrics.spacing,
        radii: metrics.radii,
        shadows: metrics.shadows,
        buttons: metrics.buttons,
        links: metrics.links,
        images: metrics.images,
        copyItems: metrics.copyItems,
        sourceHtml: sanitizedHtml,
        utilsSource: utilsSource,
        previewHtml: previewHtmlFinal,
        previewCss: previewCssFinal,
        previewBase: baseHref,
        previewHtmlAttrs: collectAttrs(document.documentElement),
        previewBodyAttrs: collectAttrs(document.body)
      });
    } finally {
      if (scope && scope.container && scope.container.remove) scope.container.remove();
    }
  }

  function collectAttrs(el) {
    if (!el || !el.attributes) return '';
    var out = [];
    Array.from(el.attributes).forEach(function (attr) {
      var name = attr.name;
      if (name === 'class' || name === 'style' || name === 'lang' || name === 'dir' || name === 'id' || name.indexOf('data-') === 0) {
        out.push(name + '="' + esc(attr.value) + '"');
      }
    });
    return out.join(' ');
  }

  function collectCssSources() {
    var hrefs = [];
    var inlineCss = [];
    try {
      for (var i = 0; i < document.styleSheets.length; i++) {
        var sheet = document.styleSheets[i];
        if (sheet && sheet.href) hrefs.push(sheet.href);
      }
    } catch (e) {}
    try {
      var nodes = document.querySelectorAll('style');
      for (var j = 0; j < nodes.length; j++) {
        inlineCss.push(nodes[j].textContent || '');
      }
    } catch (e2) {}
    return {
      hrefs: Array.from(new Set(hrefs)),
      inlineCss: inlineCss
    };
  }

  function collectCssSheetsRaw() {
    var sheets = [];
    for (var i = 0; i < document.styleSheets.length; i++) {
      var sheet = document.styleSheets[i];
      var owner = sheet ? sheet.ownerNode : null;
      var tag = owner && owner.tagName ? owner.tagName.toLowerCase() : '';
      var href = sheet && sheet.href ? sheet.href : '';
      var media = '';
      try {
        if (sheet && sheet.media && sheet.media.mediaText) media = sheet.media.mediaText;
      } catch (e0) {}
      var cssText = '';
      try {
        var rules = sheet.cssRules || [];
        var buf = '';
        for (var r = 0; r < rules.length; r++) {
          buf += rules[r].cssText + '\n';
        }
        cssText = buf;
      } catch (e1) {
        cssText = '';
      }
      sheets.push({
        href: href,
        tag: tag,
        media: media,
        cssText: cssText
      });
    }
    return sheets;
  }

  // -- Message Listener --------------------------------------------------------

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.action === 'screenshot_start') {
      var mode = msg.mode || 'visible';
      if (mode === 'component') {
        startPicker('screenshot');
        sendResponse({ ok: true });
        return true;
      }
      if (mode === 'visible') {
        captureVisibleScreenshot();
        sendResponse({ ok: true });
        return true;
      }
      if (mode === 'full') {
        showToast('Capturing full page...');
        captureFullPageScreenshot();
        sendResponse({ ok: true });
        return true;
      }
    }
    if (msg.action === 'collect_scripts') {
      (function () {
        try {
          var scripts = collectScripts();
          sendResponse({ scripts: scripts });
        } catch (e) {
          sendResponse({ error: e.message + '\n' + (e.stack || '') });
        }
      })();
      return true;
    }

    if (msg.action === 'extract_ds_html') {
      (async function () {
        try {
          var html = (msg && msg.html) ? String(msg.html) : '';
          if (!html.trim()) throw new Error('Empty HTML');
          var report = await runScopedExtractionFromHtml(html);
          sendResponse({ html: report });
        } catch (e) {
          sendResponse({ error: e.message + '\n' + (e.stack || '') });
        }
      })();
      return true;
    }

    if (msg.action === 'extract_ds_scope') {
      startPicker('ds');
      sendResponse({ ok: true });
      return;
    }

    if (msg.action === 'toggle_picker') {
      togglePicker();
      sendResponse({ ok: true, active: pickerState.active });
      return;
    }

    if (msg.action === 'start_color_picker') {
      startColorPicker();
      sendResponse({ ok: true });
      return;
    }

  if (msg.action === 'event_tracker_toggle') {
    if (msg.active) {
      startEventTracker();
    } else {
      stopEventTracker();
    }
    try {
      chrome.storage.local.set({ dd_event_tracker_active: !!msg.active });
    } catch (e) {}
    sendResponse({ ok: true, active: eventTrackerState.active });
    return;
  }

    if (msg.action === 'event_tracker_get') {
      sendResponse({ ok: true, active: eventTrackerState.active, events: eventTrackerState.events });
      return;
    }

    if (msg.action === 'collect_css') {
      (async function () {
        try {
          var collected = await collectAllCss();
          var sources = collectCssSources();
          sendResponse({
            css: collected.allCss,
            hrefs: sources.hrefs,
            inlineCss: sources.inlineCss,
            htmlAttrs: collectAttrs(document.documentElement),
            bodyAttrs: collectAttrs(document.body),
            url: location.href
          });
        } catch (e) {
          sendResponse({ error: e.message + '\n' + (e.stack || '') });
        }
      })();
      return true;
    }

    if (msg.action === 'collect_css_raw') {
      (async function () {
        try {
          var sheets = collectCssSheetsRaw();
          sendResponse({
            sheets: sheets,
            htmlAttrs: collectAttrs(document.documentElement),
            bodyAttrs: collectAttrs(document.body),
            url: location.href
          });
        } catch (e) {
          sendResponse({ error: e.message + '\n' + (e.stack || '') });
        }
      })();
      return true;
    }

    if (msg.action !== 'extract_ds') return;

    (async function () {
      try {
        var collected   = await collectAllCss();
        var allCss      = collected.allCss;
        var linkedReport = collected.linkedReport;
        var colors      = extractColors(allCss);
        var typography  = extractTypography(allCss);
        var cssVars     = extractCssVariables(allCss);
        var primary     = colors.length > 0 ? getPrimaryColor(colors) : '#333333';
        var components  = extractButtonComponents(allCss, primary);
        var linkData    = extractLinks(allCss);
        var radii       = extractBorderRadii(allCss);
        var cssShadows  = extractShadows(allCss);
        var domShadows  = collectComputedShadows(document.body || document.documentElement);
        var shadows     = mergeShadowLists(domShadows, cssShadows, 8);

        var utilsSource = await getReportUtilsSource();
        var html = generateReport({
          allCss: allCss, linkedReport: linkedReport,
          colors: colors, typography: typography, cssVars: cssVars,
          primary: primary, components: components,
          linkData: linkData, radii: radii, shadows: shadows,
          utilsSource: utilsSource
        });

        sendResponse({ html: html });
      } catch (e) {
        sendResponse({ error: e.message + '\n' + (e.stack || '') });
      }
    })();

    return true; // keep channel open for async response
  });

  loadEventTrackerPreference();

})();




