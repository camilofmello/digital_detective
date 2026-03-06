(function () {
  'use strict';

  var params  = new URLSearchParams(window.location.search);
  var pageUrl = params.get('url') || '';
  var apiKey  = params.get('key') || '';

  var METRIC_IDS = [
    { id: 'first-contentful-paint',   label: 'First Contentful Paint (FCP)' },
    { id: 'largest-contentful-paint', label: 'Largest Contentful Paint (LCP)' },
    { id: 'total-blocking-time',      label: 'Total Blocking Time (TBT)' },
    { id: 'cumulative-layout-shift',  label: 'Cumulative Layout Shift (CLS)' },
    { id: 'speed-index',              label: 'Speed Index' },
    { id: 'interactive',              label: 'Time to Interactive (TTI)' }
  ];

  /* ── Score helpers ── */

  function scoreColor(s) {
    if (s === null || s === undefined) return '#9ca3af';
    if (s >= 0.9) return '#16a34a';
    if (s >= 0.5) return '#d97706';
    return '#DD1234';
  }

  function scoreValClass(s) {
    if (s === null || s === undefined) return 'lhr-val-na';
    if (s >= 0.9) return 'lhr-val-good';
    if (s >= 0.5) return 'lhr-val-avg';
    return 'lhr-val-poor';
  }

  function scoreDotClass(s) {
    if (s === null || s === undefined) return 'lhr-dot-neutral';
    if (s >= 0.9) return 'lhr-dot-good';
    if (s >= 0.5) return 'lhr-dot-avg';
    return 'lhr-dot-poor';
  }

  function setStatus(msg) {
    var el = document.getElementById('lhr-status');
    if (el) el.textContent = msg;
  }

  /* ── Gauge SVG ── */

  function renderGauge(svgId, numId, score100) {
    var color = scoreColor(score100 / 100);
    var r     = 38;
    var circ  = 2 * Math.PI * r;
    var dash  = circ * (score100 / 100);
    var gap   = circ - dash;

    var svg = document.getElementById(svgId);
    if (svg) {
      svg.innerHTML =
        '<circle cx="48" cy="48" r="' + r + '" fill="none" stroke="#e5e7eb" stroke-width="8" />' +
        '<circle cx="48" cy="48" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="8"' +
        '  stroke-dasharray="' + dash.toFixed(2) + ' ' + gap.toFixed(2) + '"' +
        '  stroke-linecap="round"' +
        '  transform="rotate(-90 48 48)" />';
    }

    var numEl = document.getElementById(numId);
    if (numEl) {
      numEl.textContent = score100;
      numEl.style.color = color;
    }
  }

  /* ── Metrics comparison table ── */

  function renderMetrics(auditsD, auditsM) {
    var tbody = document.getElementById('lhr-metrics-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    METRIC_IDS.forEach(function (m) {
      var aD = auditsD[m.id];
      var aM = auditsM[m.id];

      var valD = aD ? (aD.displayValue || '—') : '—';
      var valM = aM ? (aM.displayValue || '—') : '—';
      var clsD = aD ? scoreValClass(aD.score) : 'lhr-val-na';
      var clsM = aM ? scoreValClass(aM.score) : 'lhr-val-na';

      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="lhr-metric-name-cell">' + m.label + '</td>' +
        '<td class="lhr-metric-val-cell ' + clsD + '">' + valD + '</td>' +
        '<td class="lhr-metric-val-cell ' + clsM + '">' + valM + '</td>';
      tbody.appendChild(tr);
    });
  }

  /* ── Audit list (Opportunities / Diagnostics / Passed) ── */

  function extractAuditGroups(lhr) {
    var perf   = lhr.categories.performance;
    var audits = lhr.audits;

    var metricSet      = {};
    var opportunityIds = [];
    var diagnosticIds  = [];

    METRIC_IDS.forEach(function (m) { metricSet[m.id] = true; });

    (perf.auditRefs || []).forEach(function (ref) {
      if (metricSet[ref.id]) return;
      if (ref.group === 'load-opportunities') opportunityIds.push(ref.id);
      else if (ref.group === 'diagnostics')   diagnosticIds.push(ref.id);
    });

    function filterFailing(ids) {
      return ids.map(function (id) { return audits[id]; }).filter(function (a) {
        return a &&
          a.score !== null && a.score !== undefined && a.score < 0.9 &&
          a.scoreDisplayMode !== 'notApplicable' &&
          a.scoreDisplayMode !== 'informative';
      });
    }

    function filterPassed(ids) {
      return ids.map(function (id) { return audits[id]; }).filter(function (a) {
        return a && a.score !== null && a.score !== undefined && a.score >= 0.9;
      });
    }

    var opportunities = filterFailing(opportunityIds);
    opportunities.sort(function (x, y) {
      return ((y.details && y.details.overallSavingsMs) || 0) -
             ((x.details && x.details.overallSavingsMs) || 0);
    });

    return {
      opportunities: opportunities,
      diagnostics:   filterFailing(diagnosticIds),
      passed:        filterPassed(opportunityIds.concat(diagnosticIds))
    };
  }

  function renderAuditList(containerId, auditList) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!auditList.length) {
      var empty = document.createElement('div');
      empty.className   = 'lhr-empty';
      empty.textContent = 'None found.';
      container.appendChild(empty);
      return;
    }

    auditList.forEach(function (a) {
      var item  = document.createElement('div');
      item.className = 'lhr-audit-item';

      var dot = document.createElement('span');
      dot.className = 'lhr-audit-dot ' + scoreDotClass(a.score);

      var text  = document.createElement('div');
      var title = document.createElement('div');
      title.className   = 'lhr-audit-title';
      title.textContent = a.title;
      text.appendChild(title);

      if (a.displayValue) {
        var val = document.createElement('div');
        val.className   = 'lhr-audit-val';
        val.textContent = a.displayValue;
        text.appendChild(val);
      }

      item.appendChild(dot);
      item.appendChild(text);
      container.appendChild(item);
    });
  }

  /* ── Collapsible sections ── */

  function bindSectionToggles() {
    document.querySelectorAll('.lhr-section-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var section   = btn.closest('.lhr-section');
        if (!section) return;
        var collapsed = section.classList.toggle('lhr-collapsed');
        btn.innerHTML = collapsed ? '&#9654;' : '&#9660;';
      });
    });
  }

  /* ── Reload ── */

  function bindReload() {
    var btn = document.getElementById('lhr-reload');
    if (!btn) return;
    btn.addEventListener('click', function () {
      window.location.reload();
    });
  }

  /* ── Save HTML ── */

  function bindSave() {
    var btn = document.getElementById('lhr-save');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
      var blob = new Blob([html], { type: 'text/html' });
      var a    = document.createElement('a');
      var host = '';
      try { host = new URL(pageUrl).hostname.replace(/^www\./, '').replace(/[^a-zA-Z0-9.-]/g, '_'); } catch (e) {}
      a.download = 'lighthouse_performance_' + host + '.html';
      a.href     = URL.createObjectURL(blob);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    });
  }

  /* ── Main ── */

  function run() {
    if (!pageUrl) {
      setStatus('No URL provided. Please reopen from the extension popup.');
      return;
    }

    document.title = 'Lighthouse — ' + pageUrl;
    var urlEl = document.getElementById('lhr-url');
    if (urlEl) {
      urlEl.textContent = pageUrl;
      urlEl.setAttribute('href', pageUrl);
    }

    var apiBase =
      'https://www.googleapis.com/pagespeedonline/v5/runPagespeed' +
      '?url=' + encodeURIComponent(pageUrl) +
      '&category=performance' +
      (apiKey ? '&key=' + encodeURIComponent(apiKey) : '') +
      '&strategy=';

    setStatus('Fetching Desktop score…');

    fetch(apiBase + 'desktop')
      .then(function (r) {
        if (!r.ok) throw new Error('Desktop API: HTTP ' + r.status);
        return r.json();
      })
      .then(function (dataD) {
        if (dataD.error) throw new Error('Desktop API error: ' + (dataD.error.message || JSON.stringify(dataD.error)));
        setStatus('Fetching Mobile score…');
        return new Promise(function (resolve) { setTimeout(resolve, 1500); })
          .then(function () { return fetch(apiBase + 'mobile'); })
          .then(function (r) {
            if (!r.ok) throw new Error('Mobile API: HTTP ' + r.status);
            return r.json();
          })
          .then(function (dataM) {
            if (dataM.error) throw new Error('Mobile API error: ' + (dataM.error.message || JSON.stringify(dataM.error)));
            return { dataD: dataD, dataM: dataM };
          });
      })
      .then(function (results) {
        var dataD = results.dataD;
        var dataM = results.dataM;

        var lhrD = dataD.lighthouseResult;
        var lhrM = dataM.lighthouseResult;

        if (!lhrD) throw new Error('Desktop: lighthouseResult missing from API response.');
        if (!lhrM) throw new Error('Mobile: lighthouseResult missing from API response.');

        var scoreD = Math.round((lhrD.categories.performance.score || 0) * 100);
        var scoreM = Math.round((lhrM.categories.performance.score || 0) * 100);

        var groupsD = extractAuditGroups(lhrD);
        var groupsM = extractAuditGroups(lhrM);

        /* Show report */
        var loadingEl = document.getElementById('lhr-loading');
        var rootEl    = document.getElementById('lhr-root');
        if (loadingEl) loadingEl.style.display = 'none';
        if (rootEl)    rootEl.style.display    = 'block';

        var genTimeEl = document.getElementById('lhr-gen-time');
        if (genTimeEl) genTimeEl.textContent = 'Generated: ' + new Date().toUTCString();

        renderGauge('lhr-gauge-desktop', 'lhr-num-desktop', scoreD);
        renderGauge('lhr-gauge-mobile',  'lhr-num-mobile',  scoreM);

        renderMetrics(lhrD.audits, lhrM.audits);

        renderAuditList('lhr-opp-desktop',  groupsD.opportunities);
        renderAuditList('lhr-opp-mobile',   groupsM.opportunities);
        renderAuditList('lhr-diag-desktop', groupsD.diagnostics);
        renderAuditList('lhr-diag-mobile',  groupsM.diagnostics);
        renderAuditList('lhr-pass-desktop', groupsD.passed);
        renderAuditList('lhr-pass-mobile',  groupsM.passed);

        /* Update counts */
        var oppCount  = document.getElementById('lhr-opp-count');
        var diagCount = document.getElementById('lhr-diag-count');
        var passCount = document.getElementById('lhr-pass-count');
        if (oppCount)  oppCount.textContent  = 'Desktop: ' + groupsD.opportunities.length + '  ·  Mobile: ' + groupsM.opportunities.length;
        if (diagCount) diagCount.textContent = 'Desktop: ' + groupsD.diagnostics.length   + '  ·  Mobile: ' + groupsM.diagnostics.length;
        if (passCount) passCount.textContent = 'Desktop: ' + groupsD.passed.length        + '  ·  Mobile: ' + groupsM.passed.length;

        bindSectionToggles();
        bindReload();
        bindSave();
      })
      .catch(function (err) {
        var loadingEl = document.getElementById('lhr-loading');
        if (loadingEl) {
          loadingEl.innerHTML =
            '<div class="lhr-error">' +
              '<div class="lhr-error-icon">&#9888;</div>' +
              '<div class="lhr-error-msg">Lighthouse analysis failed</div>' +
              '<div class="lhr-error-sub">This usually means the URL is not publicly accessible, or there was a temporary issue with PageSpeed Insights. Make sure the page is live and publicly reachable, then try again.</div>' +
              '<div class="lhr-error-detail">' + String(err && err.message ? err.message : err) + '</div>' +
            '</div>';
        }
      });
  }

  document.addEventListener('DOMContentLoaded', run);
})();
