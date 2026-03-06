(function () {
  'use strict';

  /* ═══════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════ */

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function ratioScore(a, b) {
    if (!a && !b) return 100;
    if (!a || !b) return 0;
    return Math.round(Math.min(a, b) / Math.max(a, b) * 100);
  }

  function jaccardScore(arrA, arrB) {
    var setA = {};
    var setB = {};
    arrA.forEach(function (s) { setA[String(s).toLowerCase()] = true; });
    arrB.forEach(function (s) { setB[String(s).toLowerCase()] = true; });
    var keysA = Object.keys(setA);
    var keysB = Object.keys(setB);
    var intersection = keysA.filter(function (k) { return setB[k]; }).length;
    var union = keysA.length + keysB.length - intersection;
    if (!union) return 100;
    return Math.round(intersection / union * 100);
  }

  function parseHexColor(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length !== 6) return null;
    return [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
  }

  function colorDistance(hex1, hex2) {
    var a = parseHexColor(hex1), b = parseHexColor(hex2);
    if (!a || !b) return 999;
    return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2));
  }

  function normalizeHex(hex) {
    hex = hex.toUpperCase().replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    return '#' + hex;
  }

  function unique(arr) {
    var seen = {};
    return arr.filter(function (v) {
      var k = String(v).toLowerCase();
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  /* ═══════════════════════════════════════════
     EXTRACTION
  ═══════════════════════════════════════════ */

  function extractFonts(html, css) {
    var genericFamilies = [
      'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
      'system-ui', '-apple-system', 'segoe ui', 'roboto', 'helvetica',
      'arial', 'inherit', 'initial', 'unset', '-webkit-body'
    ];

    var families = [];
    var reFamily = /font-family\s*:\s*([^;}{]+)/gi;
    var m;
    while ((m = reFamily.exec(css)) !== null) {
      m[1].split(',').forEach(function (p) {
        var f = p.trim().replace(/['"]/g, '');
        if (f && f.length > 1 && !genericFamilies.some(function (g) { return g.toLowerCase() === f.toLowerCase(); })) {
          families.push(f);
        }
      });
    }

    var reFace = /@font-face\s*\{[^}]*font-family\s*:\s*['"]?([^'";,\n]+)/gi;
    while ((m = reFace.exec(css)) !== null) {
      var f2 = m[1].trim().replace(/['"]/g, '');
      if (f2) families.push(f2);
    }

    var googleFonts = [];
    var reGf = /fonts\.googleapis\.com[^"']*[?&]family=([^"'&\s]+)/gi;
    while ((m = reGf.exec(html)) !== null) {
      var raw = decodeURIComponent(m[1]);
      raw.split('|').forEach(function (f3) {
        var name = f3.split(':')[0].trim().replace(/\+/g, ' ');
        if (name) googleFonts.push(name);
      });
    }

    var weights = [];
    var reWeight = /font-weight\s*:\s*([^;}{]+)/gi;
    while ((m = reWeight.exec(css)) !== null) {
      var w = m[1].trim();
      if (/^\d+$/.test(w) || w === 'bold' || w === 'normal') weights.push(w);
    }

    return {
      families: unique(families).slice(0, 12),
      googleFonts: unique(googleFonts).slice(0, 6),
      weights: unique(weights).slice(0, 8)
    };
  }

  function extractColors(css) {
    var colorMap = {};
    var reHex = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
    var m;
    while ((m = reHex.exec(css)) !== null) {
      var c = normalizeHex(m[0]);
      colorMap[c] = (colorMap[c] || 0) + 1;
    }
    var palette = Object.keys(colorMap)
      .sort(function (a, b) { return colorMap[b] - colorMap[a]; })
      .slice(0, 12);

    var variables = {};
    var reVar = /--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|(?:rgb|hsl)a?\([^)]+\))\s*[;}/]/gi;
    while ((m = reVar.exec(css)) !== null) {
      variables['--' + m[1]] = m[2].trim();
    }
    return { palette: palette, variables: variables, variableCount: Object.keys(variables).length };
  }

  function extractButtons(html, css) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var btnClasses = {};
    doc.querySelectorAll('button, a, input[type="button"], input[type="submit"], [class]').forEach(function (el2) {
      el2.classList.forEach(function (cls) {
        if (/\b(btn|button|cta|action)\b/i.test(cls) || /^(btn|os-btn|button)\b/.test(cls)) {
          btnClasses[cls] = true;
        }
      });
    });

    var radii = [];
    var reRadius = /(?:\.btn|\.button|\.os-btn|\.cta|\.action)[^{}]*\{[^}]*border-radius\s*:\s*([^;}{]+)/gi;
    var m;
    while ((m = reRadius.exec(css)) !== null) { radii.push(m[1].trim()); }

    var hoverCount = (css.match(/(?:\.btn|\.button|\.os-btn|\.cta)[^{}]*:hover\s*\{/gi) || []).length;

    var btnBg = [];
    var reBg = /(?:\.btn|\.button|\.os-btn)[^{}]*\{[^}]*background(?:-color)?\s*:\s*([^;}{]+)/gi;
    while ((m = reBg.exec(css)) !== null) { btnBg.push(m[1].trim()); }

    return {
      classes: Object.keys(btnClasses).slice(0, 15),
      borderRadii: unique(radii).slice(0, 5),
      hoverCount: hoverCount,
      backgrounds: unique(btnBg).slice(0, 4)
    };
  }

  function extractHover(css) {
    var hoverCount  = (css.match(/:hover\s*[\{,]/g) || []).length;
    var focusCount  = (css.match(/:focus(?:-visible|-within)?\s*[\{,]/g) || []).length;
    var activeCount = (css.match(/:active\s*[\{,]/g) || []).length;

    var transitions = [];
    var reTrans = /transition\s*:\s*([^;}{]+)/gi;
    var m;
    while ((m = reTrans.exec(css)) !== null) {
      transitions.push(m[1].trim().substring(0, 80));
      if (transitions.length >= 12) break;
    }
    transitions = unique(transitions);

    var transforms = [];
    var reTf = /transform\s*:\s*([^;}{]+)/gi;
    while ((m = reTf.exec(css)) !== null) {
      transforms.push(m[1].trim().substring(0, 60));
      if (transforms.length >= 10) break;
    }
    transforms = unique(transforms);

    var hoverSamples = [];
    var reHoverSel = /([a-zA-Z0-9._#\[\]-]+(?:\s+[a-zA-Z0-9._#\[\]-]+)*):hover\s*\{/g;
    while ((m = reHoverSel.exec(css)) !== null) {
      hoverSamples.push(m[1].trim().slice(-50));
      if (hoverSamples.length >= 6) break;
    }

    var focusSamples = [];
    var reFocusSel = /([a-zA-Z0-9._#\[\]-]+(?:\s+[a-zA-Z0-9._#\[\]-]+)*):focus[^-\w]\s*\{/g;
    while ((m = reFocusSel.exec(css)) !== null) {
      focusSamples.push(m[1].trim().slice(-50));
      if (focusSamples.length >= 4) break;
    }

    return {
      hoverCount: hoverCount,
      focusCount: focusCount,
      activeCount: activeCount,
      transitionCount: transitions.length,
      transitions: transitions.slice(0, 5),
      transformCount: transforms.length,
      transforms: transforms.slice(0, 4),
      hoverSamples: hoverSamples,
      focusSamples: focusSamples
    };
  }

  function extractLayout(html, css) {
    var combined = html + css;
    var systems = [];
    if (/col-\d+|col-(?:md|lg|sm|xl)-|\.container\b|\.row\b/.test(combined)) systems.push('Bootstrap');
    if (/w-layout-grid|w-nav\b|w-container|\.w-row/.test(combined)) systems.push('Webflow');
    if (!systems.length && /display\s*:\s*grid/.test(css)) systems.push('CSS Grid');

    var gridCount = (css.match(/display\s*:\s*grid/gi) || []).length;
    var flexCount = (css.match(/display\s*:\s*flex/gi) || []).length;

    var gaps = [];
    var reGap = /\bgap\s*:\s*([^;}{]+)/gi;
    var m;
    while ((m = reGap.exec(css)) !== null) {
      gaps.push(m[1].trim());
      if (gaps.length >= 10) break;
    }
    return {
      system: systems.length ? systems.join(' + ') : 'Custom',
      systems: systems,
      gridCount: gridCount,
      flexCount: flexCount,
      gaps: unique(gaps).slice(0, 5),
      hasCssVariables: /--[\w-]+/.test(css)
    };
  }

  function extractNavigation(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var navEl = doc.querySelector('nav') ||
      doc.querySelector('[class*="main-menu"]') ||
      doc.querySelector('[class*="navbar"]') ||
      doc.querySelector('[class*="navigation"]') ||
      doc.querySelector('header');
    var navClasses = navEl ? Array.from(navEl.classList).slice(0, 6) : [];
    var linkEls   = navEl ? Array.from(navEl.querySelectorAll('a')) : [];
    var linkCount = linkEls.length;
    var links = [];
    linkEls.forEach(function (a) {
      var t = (a.textContent || '').trim().replace(/\s+/g, ' ');
      if (t && t.length >= 2 && t.length <= 40) links.push(t);
    });
    return {
      classes:     navClasses,
      linkCount:   linkCount,
      links:       unique(links).slice(0, 12),
      hasLogo:     !!doc.querySelector('header .logo, header [class*="logo"], nav [class*="logo"], nav [class*="brand"]'),
      hasCTA:      !!doc.querySelector('nav [class*="btn"], nav [class*="button"], nav [class*="cta"], header [class*="btn"], header [class*="cta"]'),
      hasDropdown: !!doc.querySelector('[class*="dropdown"],[class*="submenu"],[class*="tab-pane"]'),
      hasMobile:   !!doc.querySelector('[class*="burger"],[class*="hamburger"],[class*="mobile-menu"]'),
      hasSearch:   !!doc.querySelector('[class*="search"]'),
      hasLang:     !!doc.querySelector('[class*="language"],[class*="lang-"]')
    };
  }

  function extractFooter(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var ftEl = doc.querySelector('footer') ||
      doc.querySelector('[role="contentinfo"]') ||
      doc.querySelector('.footer') ||
      doc.querySelector('#footer') ||
      doc.querySelector('[class*="site-footer"]');
    if (!ftEl) return { found: false, linkCount: 0, links: [], columns: 0, hasSocial: false, hasCopyright: false, hasNewsletter: false, hasLang: false, classes: [] };

    var linkEls = Array.from(ftEl.querySelectorAll('a'));
    var links = [];
    linkEls.forEach(function (a) {
      var t = (a.textContent || '').trim().replace(/\s+/g, ' ');
      if (t && t.length >= 2 && t.length <= 50) links.push(t);
    });

    var cols = ftEl.querySelectorAll('[class*="footer-col"], [class*="footer-column"], [class*="footer-section"], [class*="footer-widget"]');
    var colCount = cols.length;
    if (!colCount) {
      var divChildren = Array.from(ftEl.querySelectorAll('div, section, ul')).filter(function (d) {
        return d.parentElement === ftEl && d.querySelectorAll('a').length > 1;
      });
      colCount = divChildren.length;
    }

    var ftText    = (ftEl.textContent || '').toLowerCase();
    var hasSocial = !!ftEl.querySelector('[class*="social"],[href*="facebook.com"],[href*="twitter.com"],[href*="linkedin.com"],[href*="instagram.com"],[href*="youtube.com"],[href*="x.com"]');

    return {
      found:         true,
      linkCount:     linkEls.length,
      links:         unique(links).slice(0, 15),
      columns:       colCount,
      hasSocial:     hasSocial,
      hasCopyright:  /copyright|©|\(c\)/.test(ftText),
      hasNewsletter: !!ftEl.querySelector('[type="email"],[class*="newsletter"],form'),
      hasLang:       !!ftEl.querySelector('[class*="language"],[class*="lang-"]'),
      classes:       Array.from(ftEl.classList).slice(0, 6)
    };
  }

  function extractTypography(css) {
    var headings = {};
    var m;

    var reTag = /(?:^|[{}])\s*h([1-6])\s*(?:[^{,]*?)?\{([^}]*)/gm;
    while ((m = reTag.exec(css)) !== null) {
      var lvl = 'h' + m[1];
      var fsm = /font-size\s*:\s*([^;}{]+)/.exec(m[2]);
      if (fsm && !headings[lvl]) headings[lvl] = fsm[1].trim();
    }

    var reClass = /\.heading(?:-style)?-h([1-6])[^{]*\{([^}]*)/gi;
    while ((m = reClass.exec(css)) !== null) {
      var lvl2 = 'h' + m[1];
      var fsm2 = /font-size\s*:\s*([^;}{]+)/.exec(m[2]);
      if (fsm2 && !headings[lvl2]) headings[lvl2] = fsm2[1].trim();
    }

    var bodyMatch = /body\s*\{([^}]*)/.exec(css);
    var bodySize  = bodyMatch ? ((/font-size\s*:\s*([^;}{]+)/.exec(bodyMatch[1]) || [])[1] || '').trim() : '';

    var lineHeights = [];
    var reLH = /line-height\s*:\s*([^;}{]+)/gi;
    while ((m = reLH.exec(css)) !== null) {
      lineHeights.push(m[1].trim());
      if (lineHeights.length >= 12) break;
    }
    return { headings: headings, bodySize: bodySize || '—', lineHeights: unique(lineHeights).slice(0, 6) };
  }

  function extractSections(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var sections = [];
    doc.querySelectorAll('section, main > div, [class*="section"], [class*="hero"], [id*="section"]').forEach(function (el2) {
      var id  = el2.id || '';
      var cls = Array.from(el2.classList).slice(0, 2).join(' ');
      var tag = el2.tagName.toLowerCase();
      if (cls || id) sections.push({ tag: tag, id: id, cls: cls });
    });
    return { sections: sections.slice(0, 15), count: sections.length };
  }

  /* ═══════════════════════════════════════════
     INFRASTRUCTURE DETECTION
  ═══════════════════════════════════════════ */

  function detectTechStack(html, url) {
    var h      = String(html || '');
    var urlStr = String(url || '');
    var results = [];

    function add(name, category) {
      results.push({ name: name, category: category });
    }

    // ── CMS ──
    if (/wp-content\/|wp-includes\//.test(h) || /name=["']generator["'][^>]*content=["'][^"']*WordPress/i.test(h))
      add('WordPress', 'CMS');
    if (/data-wf-site|data-wf-page|\.webflow\.com|webflow\.io/.test(h))
      add('Webflow', 'CMS');
    if (/\/sitecore\/|\/~\/media\/|data-sc-[a-z]|Sitecore\./.test(h))
      add('Sitecore', 'CMS');
    if (/\/content\/dam\/|\/etc\.clientlibs\/|\/etc\/designs\//.test(h))
      add('Adobe Experience Manager', 'CMS');
    if (/drupal\.js|\/sites\/default\/files\/|Drupal\.settings|data-drupal/.test(h))
      add('Drupal', 'CMS');
    if (/\/media\/jui\/|joomla|\/components\/com_/.test(h))
      add('Joomla', 'CMS');
    if (/squarespace\.com|sqsp\.net|static1\.squarespace\.com/.test(h))
      add('Squarespace', 'CMS');
    if (/wix\.com|wixstatic\.com/.test(h))
      add('Wix', 'CMS');
    if (/hs-scripts\.com|hubspot\.net|hubspotusercontent/.test(h))
      add('HubSpot CMS', 'CMS');
    if (/ghost\.io|\/content\/ghost/.test(h))
      add('Ghost', 'CMS');
    if (/typo3temp|\/typo3\//.test(h))
      add('TYPO3', 'CMS');
    if (/kentico/i.test(h))
      add('Kentico', 'CMS');
    if (/episerver|epi-server/i.test(h))
      add('Episerver', 'CMS');
    if (/contentful\.com/.test(h))
      add('Contentful', 'CMS');
    if (/prismic\.io/.test(h))
      add('Prismic', 'CMS');
    if (/OutSystemsUIWeb|OutSystems\.js|ServiceCenter/i.test(h))
      add('OutSystems', 'CMS');

    // ── Frontend Framework ──
    if (/__NEXT_DATA__|_next\/static\//.test(h))
      add('Next.js', 'Framework');
    if (/__NUXT__|_nuxt\//.test(h))
      add('Nuxt.js', 'Framework');
    if (/___gatsby|gatsby-chunk/.test(h))
      add('Gatsby', 'Framework');
    if (/ng-version|_nghost-|ng-app/.test(h))
      add('Angular', 'Framework');
    if (/data-reactroot|__reactFiber|reactRoot/.test(h)) {
      if (!results.some(function (r) { return r.name === 'Next.js' || r.name === 'Gatsby'; }))
        add('React', 'Framework');
    }
    if (/data-v-[a-f0-9]{6,}|__vue__/.test(h)) {
      if (!results.some(function (r) { return r.name === 'Nuxt.js'; }))
        add('Vue.js', 'Framework');
    }
    if (/svelte-[a-z]|__sveltekit/.test(h))
      add('Svelte', 'Framework');
    if (/astro-island|data-astro-cid/.test(h))
      add('Astro', 'Framework');

    // ── Static Site Generator ──
    if (/name=["']generator["'][^>]*content=["'][^"']*Hugo/i.test(h))
      add('Hugo', 'Static Generator');
    if (/name=["']generator["'][^>]*content=["'][^"']*Jekyll/i.test(h))
      add('Jekyll', 'Static Generator');
    if (/name=["']generator["'][^>]*content=["'][^"']*Eleventy/i.test(h))
      add('Eleventy', 'Static Generator');
    if (/docusaurus/.test(h))
      add('Docusaurus', 'Static Generator');

    // ── E-commerce ──
    if (/cdn\.shopify\.com|shopify-section|Shopify\.theme/.test(h))
      add('Shopify', 'E-commerce');
    if (/magento|Mage\.Cookies|\/mage\//.test(h))
      add('Magento', 'E-commerce');
    if (/woocommerce|\/wc-/.test(h) && /wp-content/.test(h))
      add('WooCommerce', 'E-commerce');
    if (/prestashop/i.test(h))
      add('PrestaShop', 'E-commerce');

    // ── Hosting / CDN ──
    if (/netlify\.app/.test(urlStr) || /netlify\.com/.test(h))
      add('Netlify', 'Hosting');
    if (/vercel\.app/.test(urlStr) || /_vercel/.test(h))
      add('Vercel', 'Hosting');
    if (/github\.io/.test(urlStr))
      add('GitHub Pages', 'Hosting');
    if (/azurewebsites\.net|azureedge\.net/.test(h + urlStr))
      add('Azure', 'Hosting');
    if (/cloudfront\.net|s3\.amazonaws\.com/.test(h + urlStr))
      add('AWS CloudFront', 'CDN');
    if (/pages\.dev/.test(urlStr) || /cdnjs\.cloudflare\.com/.test(h))
      add('Cloudflare', 'CDN');
    if (/akamaized\.net|akamaiapis\.net/.test(h + urlStr))
      add('Akamai', 'CDN');
    if (/fastly\.net/.test(h + urlStr))
      add('Fastly', 'CDN');

    return { detected: results };
  }

  /* ═══════════════════════════════════════════
     SCORING
  ═══════════════════════════════════════════ */

  function scoreFonts(a, b) {
    return clamp(Math.round(jaccardScore(a.families, b.families) * 0.65 + jaccardScore(a.googleFonts, b.googleFonts) * 0.35), 0, 100);
  }
  function scoreColors(a, b) {
    if (!a.palette.length && !b.palette.length) return 100;
    if (!a.palette.length || !b.palette.length) return 0;
    var matched = 0, total = Math.max(a.palette.length, b.palette.length);
    a.palette.forEach(function (cA) {
      var minDist = 999;
      b.palette.forEach(function (cB) { var d = colorDistance(cA, cB); if (d < minDist) minDist = d; });
      if (minDist < 20) matched += 1; else if (minDist < 50) matched += 0.5;
    });
    return clamp(Math.round(matched / total * 100), 0, 100);
  }
  function scoreButtons(a, b) {
    var patA = a.classes.join(' ').toLowerCase();
    var patB = b.classes.join(' ').toLowerCase();
    var typeA = /os-btn|btn-/.test(patA) ? 'os-btn' : /\bbutton\b/.test(patA) ? 'button' : 'other';
    var typeB = /os-btn|btn-/.test(patB) ? 'os-btn' : /\bbutton\b/.test(patB) ? 'button' : 'other';
    return clamp(Math.round((typeA === typeB ? 100 : 20) * 0.4 + jaccardScore(a.borderRadii, b.borderRadii) * 0.3 + ratioScore(a.hoverCount, b.hoverCount) * 0.3), 0, 100);
  }
  function scoreHover(a, b) {
    return clamp(Math.round((ratioScore(a.hoverCount, b.hoverCount) + ratioScore(a.focusCount, b.focusCount) + ratioScore(a.transitionCount, b.transitionCount) + ratioScore(a.transformCount, b.transformCount)) / 4), 0, 100);
  }
  function scoreLayout(a, b) {
    var sysScore = a.system === b.system ? 100 : (a.systems.filter(function (s) { return b.systems.indexOf(s) !== -1; }).length ? 50 : 15);
    return clamp(Math.round(sysScore * 0.5 + ratioScore(a.gridCount, b.gridCount) * 0.25 + ratioScore(a.flexCount, b.flexCount) * 0.25), 0, 100);
  }
  function scoreNavigation(a, b) {
    var featScore = ((a.hasDropdown === b.hasDropdown ? 100 : 0) + (a.hasMobile === b.hasMobile ? 100 : 0) + (a.hasSearch === b.hasSearch ? 100 : 0) + (a.hasLang === b.hasLang ? 100 : 0) + ratioScore(a.linkCount, b.linkCount)) / 5;
    var labelScore = jaccardScore(a.links || [], b.links || []);
    return clamp(Math.round(featScore * 0.5 + labelScore * 0.5), 0, 100);
  }
  function scoreFooter(a, b) {
    if (!a.found && !b.found) return 100;
    if (!a.found || !b.found) return 0;
    var labelScore = jaccardScore(a.links, b.links) * 0.45 + ratioScore(a.linkCount, b.linkCount) * 0.15;
    var featScore  = ((a.hasSocial === b.hasSocial ? 100 : 0) + (a.hasCopyright === b.hasCopyright ? 100 : 0) + (a.hasNewsletter === b.hasNewsletter ? 100 : 0) + (a.hasLang === b.hasLang ? 100 : 0) + ratioScore(a.columns || 0, b.columns || 0)) / 5;
    return clamp(Math.round(labelScore + featScore * 0.40), 0, 100);
  }
  function scoreTypography(a, b) {
    var scores = [];
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(function (h) {
      var vA = a.headings[h], vB = b.headings[h];
      if (vA && vB) scores.push(vA === vB ? 100 : 40);
      else if (vA || vB) scores.push(0);
    });
    if (a.bodySize !== '—' && b.bodySize !== '—') scores.push(a.bodySize === b.bodySize ? 100 : 50);
    return clamp(!scores.length ? 75 : Math.round(scores.reduce(function (s, v) { return s + v; }, 0) / scores.length), 0, 100);
  }
  function scoreSections(a, b) {
    return clamp(Math.round(ratioScore(a.count, b.count) * 0.5 + jaccardScore(a.sections.map(function (s) { return s.cls; }), b.sections.map(function (s) { return s.cls; })) * 0.5), 0, 100);
  }

  /* ═══════════════════════════════════════════
     DOM BUILDERS
  ═══════════════════════════════════════════ */

  function scoreClass(score) {
    if (score >= 85) return 'chip-ok';
    if (score >= 60) return 'chip-warn';
    return 'chip-bad';
  }
  function scoreIcon(score) {
    if (score >= 85) return '✓';
    if (score >= 60) return '≈';
    return '✗';
  }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function makeScoreChip(score) {
    var chip = el('span', 'ma-chip ' + scoreClass(score));
    chip.textContent = scoreIcon(score) + '  ' + score + '%';
    return chip;
  }
  function makeProgressBar(score) {
    var wrap = el('div', 'ma-bar-wrap');
    var bar  = el('div', 'ma-bar ' + scoreClass(score));
    bar.style.width = score + '%';
    wrap.appendChild(bar);
    return wrap;
  }
  function makeSwatch(hex) {
    var s = el('span', 'ma-swatch');
    s.style.background = hex;
    s.title = hex;
    return s;
  }
  function makeRow(content, cls) {
    var row = el('div', 'ma-row' + (cls ? ' ' + cls : ''));
    if (typeof content === 'string') row.textContent = content;
    else if (content && content.nodeType) row.appendChild(content);
    return row;
  }
  function makeRowWithSwatch(hex, label, cls) {
    var row = el('div', 'ma-row' + (cls ? ' ' + cls : ''));
    row.appendChild(makeSwatch(hex));
    row.appendChild(el('span', '', label));
    return row;
  }
  function makeCol(label, rows) {
    var col = el('div', 'ma-col');
    col.appendChild(el('div', 'ma-col-label', label));
    rows.forEach(function (r) { col.appendChild(r); });
    return col;
  }
  function makeBlock(title, score, colA, colB, key) {
    var block = el('div', 'ma-block');
    if (key) block.dataset.key = key;
    var head  = el('div', 'ma-block-head');
    head.appendChild(el('span', 'ma-block-title', title));
    var headActions = el('div', 'ma-block-actions');
    var collapseBtn = el('button', 'ma-collapse-btn', '▼');
    collapseBtn.type = 'button';
    collapseBtn.setAttribute('aria-label', 'Collapse section');
    headActions.appendChild(collapseBtn);
    headActions.appendChild(makeScoreChip(score));
    if (key) {
      var toggleBtn = el('button', 'ma-toggle-btn ma-toggle-on', 'ON');
      toggleBtn.type = 'button';
      toggleBtn.dataset.key = key;
      headActions.appendChild(toggleBtn);
    }
    head.appendChild(headActions);
    block.appendChild(head);
    var cols = el('div', 'ma-two-col');
    cols.appendChild(colA);
    cols.appendChild(colB);
    block.appendChild(cols);
    return block;
  }

  /* ═══════════════════════════════════════════
     BLOCK RENDERERS
  ═══════════════════════════════════════════ */

  function buildFontsBlock(dA, dB, score) {
    function makeRows(selfData, otherData) {
      var rows = [];
      var all = selfData.families.slice();
      otherData.families.forEach(function (f) {
        if (!all.some(function (x) { return x.toLowerCase() === f.toLowerCase(); })) all.push(f);
      });
      if (!all.length) { rows.push(makeRow('No custom fonts detected', 'neutral')); }
      else {
        all.slice(0, 8).forEach(function (f) {
          var inSelf = selfData.families.some(function (x) { return x.toLowerCase() === f.toLowerCase(); });
          rows.push(makeRow((inSelf ? '✓  ' : '✗  ') + f, inSelf ? 'ok' : 'bad'));
        });
      }
      if (selfData.googleFonts.length) rows.push(makeRow('Google Fonts: ' + selfData.googleFonts.join(', '), 'meta'));
      if (selfData.weights.length)     rows.push(makeRow('Weights: ' + selfData.weights.join(', '), 'meta'));
      return rows;
    }
    return makeBlock('Fonts', score, makeCol('A — Reference', makeRows(dA, dB)), makeCol('B — Variant', makeRows(dB, dA)), 'fonts');
  }

  function buildColorsBlock(dA, dB, score) {
    function makeRows(selfPal, otherPal) {
      var rows = [];
      if (!selfPal.length) { rows.push(makeRow('No colors detected', 'neutral')); return rows; }
      selfPal.slice(0, 8).forEach(function (hex) {
        var minDist = 999;
        otherPal.forEach(function (h2) { var d = colorDistance(hex, h2); if (d < minDist) minDist = d; });
        var status = minDist < 20 ? 'ok' : minDist < 50 ? 'warn' : 'bad';
        var icon   = minDist < 20 ? '✓' : minDist < 50 ? '≈' : '✗';
        rows.push(makeRowWithSwatch(hex, icon + '  ' + hex, status));
      });
      return rows;
    }
    return makeBlock('Colors', score, makeCol('A — Reference', makeRows(dA.palette, dB.palette)), makeCol('B — Variant', makeRows(dB.palette, dA.palette)), 'colors');
  }

  function buildButtonsBlock(dA, dB, score) {
    function makeRows(data, other) {
      var rows = [];
      if (data.classes.length) rows.push(makeRow('Classes: ' + data.classes.slice(0, 5).join(', '), 'meta'));
      else rows.push(makeRow('No button classes found', 'neutral'));
      if (data.borderRadii.length) rows.push(makeRow('Border-radius: ' + data.borderRadii.slice(0, 3).join(', '), 'meta'));
      if (data.backgrounds.length) rows.push(makeRow('BG colors: ' + data.backgrounds.slice(0, 3).join(', '), 'meta'));
      rows.push(makeRow(':hover states: ' + data.hoverCount, data.hoverCount > 0 ? 'ok' : 'neutral'));
      return rows;
    }
    return makeBlock('Buttons', score, makeCol('A — Reference', makeRows(dA, dB)), makeCol('B — Variant', makeRows(dB, dA)), 'buttons');
  }

  function buildHoverBlock(dA, dB, score) {
    function makeRows(data, other) {
      var rows = [];
      rows.push(makeRow(':hover rules: '   + data.hoverCount,      data.hoverCount  > 0 ? (ratioScore(data.hoverCount,      other.hoverCount)  > 60 ? 'ok' : 'warn') : 'neutral'));
      rows.push(makeRow(':focus rules: '   + data.focusCount,      data.focusCount  > 0 ? (ratioScore(data.focusCount,      other.focusCount)  > 60 ? 'ok' : 'warn') : 'neutral'));
      rows.push(makeRow(':active rules: '  + data.activeCount,     data.activeCount > 0 ? 'ok' : 'neutral'));
      rows.push(makeRow('Transitions: '    + data.transitionCount, data.transitionCount > 0 ? (ratioScore(data.transitionCount, other.transitionCount) > 60 ? 'ok' : 'warn') : 'neutral'));
      rows.push(makeRow('Transforms: '     + data.transformCount,  data.transformCount  > 0 ? 'ok' : 'neutral'));
      if (data.transitions.length) {
        data.transitions.slice(0, 2).forEach(function (t) { rows.push(makeRow('→ ' + t.substring(0, 55), 'meta')); });
      }
      if (data.hoverSamples.length) {
        rows.push(makeRow('Hover selectors sample:', 'meta'));
        data.hoverSamples.slice(0, 3).forEach(function (s) { rows.push(makeRow('  ' + s, 'meta')); });
      }
      return rows;
    }
    return makeBlock('Hover & Interactions', score, makeCol('A — Reference', makeRows(dA, dB)), makeCol('B — Variant', makeRows(dB, dA)), 'hover');
  }

  function buildLayoutBlock(dA, dB, score) {
    function makeRows(data, other) {
      var rows = [];
      rows.push(makeRow('System: ' + data.system, data.system === other.system ? 'ok' : 'bad'));
      rows.push(makeRow('display:grid — ' + data.gridCount + 'x', 'meta'));
      rows.push(makeRow('display:flex — ' + data.flexCount + 'x', 'meta'));
      rows.push(makeRow('CSS Variables: ' + (data.hasCssVariables ? 'Yes ✓' : 'No'), data.hasCssVariables === other.hasCssVariables ? (data.hasCssVariables ? 'ok' : 'neutral') : 'warn'));
      if (data.gaps.length) rows.push(makeRow('Gap values: ' + data.gaps.slice(0, 3).join(', '), 'meta'));
      return rows;
    }
    return makeBlock('Layout System', score, makeCol('A — Reference', makeRows(dA, dB)), makeCol('B — Variant', makeRows(dB, dA)), 'layout');
  }

  function buildNavigationBlock(dA, dB, score) {
    function makeRows(data, other) {
      var rows = [];
      rows.push(makeRow('Nav links: '      + data.linkCount,                            ratioScore(data.linkCount, other.linkCount) > 60 ? 'ok' : 'warn'));
      rows.push(makeRow('Logo: '           + (data.hasLogo    ? 'Yes ✓' : 'No'),        data.hasLogo    === other.hasLogo    ? (data.hasLogo ? 'ok' : 'neutral') : 'bad'));
      rows.push(makeRow('CTA button: '     + (data.hasCTA     ? 'Yes ✓' : 'No'),        data.hasCTA     === other.hasCTA     ? (data.hasCTA  ? 'ok' : 'neutral') : 'warn'));
      rows.push(makeRow('Dropdown menus: ' + (data.hasDropdown ? 'Yes' : 'No'),         data.hasDropdown === other.hasDropdown ? 'ok' : 'bad'));
      rows.push(makeRow('Mobile menu: '    + (data.hasMobile   ? 'Yes' : 'No'),         data.hasMobile   === other.hasMobile   ? 'ok' : 'bad'));
      rows.push(makeRow('Search: '         + (data.hasSearch   ? 'Yes' : 'No'),         data.hasSearch   === other.hasSearch   ? 'ok' : 'warn'));
      rows.push(makeRow('Lang switcher: '  + (data.hasLang     ? 'Yes' : 'No'),         data.hasLang     === other.hasLang     ? 'ok' : 'warn'));
      if (data.links && data.links.length) {
        rows.push(makeRow('Menu items:', 'meta'));
        data.links.slice(0, 10).forEach(function (l) {
          var inOther = (other.links || []).some(function (ol) { return ol.toLowerCase() === l.toLowerCase(); });
          rows.push(makeRow((inOther ? '✓  ' : '✗  ') + l, inOther ? 'ok' : 'bad'));
        });
      }
      return rows;
    }
    return makeBlock('Header / Menu', score, makeCol('A — Reference', makeRows(dA, dB)), makeCol('B — Variant', makeRows(dB, dA)), 'navigation');
  }

  function buildFooterBlock(dA, dB, score) {
    function makeRows(data, other) {
      var rows = [];
      if (!data.found) { rows.push(makeRow('No footer element detected', 'neutral')); return rows; }
      rows.push(makeRow('Footer links: '  + data.linkCount,                              ratioScore(data.linkCount, other.linkCount) > 60 ? 'ok' : 'warn'));
      rows.push(makeRow('Columns: '       + (data.columns || '—'),                       data.columns > 0 && other.columns > 0 ? (ratioScore(data.columns, other.columns) > 60 ? 'ok' : 'warn') : 'neutral'));
      rows.push(makeRow('Social links: '  + (data.hasSocial     ? 'Yes ✓' : 'No'),       data.hasSocial     === other.hasSocial     ? (data.hasSocial ? 'ok' : 'neutral') : 'warn'));
      rows.push(makeRow('Copyright: '     + (data.hasCopyright  ? 'Yes ✓' : 'No'),       data.hasCopyright  === other.hasCopyright  ? 'ok' : 'warn'));
      rows.push(makeRow('Newsletter: '    + (data.hasNewsletter ? 'Yes ✓' : 'No'),       data.hasNewsletter === other.hasNewsletter ? (data.hasNewsletter ? 'ok' : 'neutral') : 'warn'));
      rows.push(makeRow('Lang switcher: ' + (data.hasLang       ? 'Yes ✓' : 'No'),       data.hasLang       === other.hasLang       ? 'ok' : 'warn'));
      if (data.links && data.links.length) {
        rows.push(makeRow('Footer links:', 'meta'));
        data.links.slice(0, 10).forEach(function (l) {
          var inOther = (other.links || []).some(function (ol) { return ol.toLowerCase() === l.toLowerCase(); });
          rows.push(makeRow((inOther ? '✓  ' : '✗  ') + l, inOther ? 'ok' : 'bad'));
        });
      }
      return rows;
    }
    return makeBlock('Footer', score, makeCol('A — Reference', makeRows(dA, dB)), makeCol('B — Variant', makeRows(dB, dA)), 'footer');
  }

  function buildTypographyBlock(dA, dB, score) {
    function makeRows(data, other) {
      var rows = [];
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(function (h) {
        var vS = data.headings[h] || '—';
        var vO = other.headings[h] || '—';
        rows.push(makeRow(h.toUpperCase() + ': ' + vS, (vS === '—' && vO === '—') ? 'neutral' : (vS === vO ? 'ok' : 'bad')));
      });
      if (data.bodySize && data.bodySize !== '—') {
        rows.push(makeRow('Body: ' + data.bodySize, data.bodySize === other.bodySize ? 'ok' : 'warn'));
      }
      if (data.lineHeights.length) rows.push(makeRow('Line-heights: ' + data.lineHeights.slice(0, 2).join(', '), 'meta'));
      return rows;
    }
    return makeBlock('Typography', score, makeCol('A — Reference', makeRows(dA, dB)), makeCol('B — Variant', makeRows(dB, dA)), 'typography');
  }

  function buildSectionsBlock(dA, dB, score) {
    function makeRows(data) {
      var rows = [];
      rows.push(makeRow('Sections found: ' + data.count, 'meta'));
      data.sections.slice(0, 8).forEach(function (s) {
        var label = s.tag + (s.id ? ' #' + s.id : '') + (s.cls ? ' .' + s.cls.replace(/\s+/g, ' .') : '');
        rows.push(makeRow(label.substring(0, 54), 'meta'));
      });
      return rows;
    }
    return makeBlock('Page Sections', score, makeCol('A — Reference', makeRows(dA)), makeCol('B — Variant', makeRows(dB)), 'sections');
  }

  /* ═══════════════════════════════════════════
     INFRASTRUCTURE BLOCK BUILDER
  ═══════════════════════════════════════════ */

  function getPrimaryLabel(stack) {
    if (!stack || !stack.detected || !stack.detected.length) return 'Unknown / Static HTML';
    var priorities = ['CMS', 'Framework', 'Static Generator', 'E-commerce', 'Hosting', 'CDN'];
    for (var i = 0; i < priorities.length; i++) {
      var cat = priorities[i];
      for (var j = 0; j < stack.detected.length; j++) {
        if (stack.detected[j].category === cat) return stack.detected[j].name;
      }
    }
    return stack.detected[0].name;
  }

  function makeInfraCol(label, stack) {
    var col = el('div', 'ma-col');
    col.appendChild(el('div', 'ma-col-label', label));

    var detected = (stack && stack.detected) ? stack.detected : [];
    if (!detected.length) {
      col.appendChild(el('div', 'ma-infra-none', 'No specific stack detected'));
      col.appendChild(el('div', 'ma-row meta', 'Likely static HTML or unrecognized platform'));
      return col;
    }

    var grouped = {};
    var order   = [];
    detected.forEach(function (tech) {
      if (!grouped[tech.category]) { grouped[tech.category] = []; order.push(tech.category); }
      grouped[tech.category].push(tech.name);
    });

    order.forEach(function (cat) {
      col.appendChild(el('div', 'ma-infra-cat', cat));
      var tagWrap = el('div', 'ma-infra-tags');
      grouped[cat].forEach(function (name) {
        tagWrap.appendChild(el('span', 'ma-infra-tag', name));
      });
      col.appendChild(tagWrap);
    });

    return col;
  }

  function buildInfrastructureBlock(stackA, stackB) {
    var primaryA = getPrimaryLabel(stackA);
    var primaryB = getPrimaryLabel(stackB);
    var isDiff   = primaryA !== primaryB;

    var block = el('div', 'ma-block ma-infra-block');

    var head = el('div', 'ma-block-head');
    head.appendChild(el('span', 'ma-block-title', 'Infrastructure'));
    var headActions = el('div', 'ma-block-actions');
    var collapseBtn = el('button', 'ma-collapse-btn', '▼');
    collapseBtn.type = 'button';
    collapseBtn.setAttribute('aria-label', 'Collapse section');
    headActions.appendChild(collapseBtn);
    var badge = el('span', 'ma-infra-badge ' + (isDiff ? 'ma-infra-badge-diff' : 'ma-infra-badge-same'));
    badge.textContent = isDiff ? '⚠  Different stacks detected' : '✓  Same infrastructure';
    headActions.appendChild(badge);
    head.appendChild(headActions);
    block.appendChild(head);

    block.appendChild(el('div', 'ma-infra-note', 'Infrastructure differences are informational only and do not affect match scores.'));

    var cols = el('div', 'ma-two-col');
    cols.appendChild(makeInfraCol('A — Reference', stackA));
    cols.appendChild(makeInfraCol('B — Variant', stackB));
    block.appendChild(cols);

    return block;
  }

  /* ═══════════════════════════════════════════
     REPORT BUILDER
  ═══════════════════════════════════════════ */

  function buildReport(analyses, scores, overall, urlA, urlB, stackA, stackB, weights) {
    var root = document.getElementById('ma-root');
    if (!root) return;

    var page = el('div', 'ma-page');

    // ── Header
    var header  = el('div', 'ma-header');
    var hdrLeft = el('div', 'ma-header-left');
    var logo    = el('span', 'ma-logo', 'keyboard_command_key');
    var titleWrp = el('div', 'ma-title-wrap');
    titleWrp.appendChild(el('h1', 'ma-title', 'Match Analysis'));

    // Clickable URL A
    var linkA = document.createElement('a');
    linkA.className  = 'ma-url-link';
    linkA.textContent = 'A: ' + urlA;
    linkA.href   = urlA;
    linkA.target = '_blank';
    linkA.rel    = 'noopener noreferrer';
    titleWrp.appendChild(linkA);

    // Clickable URL B
    var linkB = document.createElement('a');
    linkB.className  = 'ma-url-link';
    linkB.textContent = 'B: ' + urlB;
    linkB.href   = urlB;
    linkB.target = '_blank';
    linkB.rel    = 'noopener noreferrer';
    titleWrp.appendChild(linkB);

    // Generated timestamp in GMT
    titleWrp.appendChild(el('div', 'ma-gen-time', 'Generated: ' + new Date().toUTCString()));

    hdrLeft.appendChild(logo);
    hdrLeft.appendChild(titleWrp);

    // Reload button — built as <a href> so it works in saved HTML too.
    // The href encodes the full extension URL with the original parameters,
    // so opening the saved file and clicking Reload re-runs the analysis.
    var reloadUrl = '';
    try {
      if (window.chrome && chrome.runtime && chrome.runtime.getURL) {
        reloadUrl = chrome.runtime.getURL('match_analysis.html') +
          '?urlA=' + encodeURIComponent(urlA) + '&urlB=' + encodeURIComponent(urlB);
      }
    } catch (e) {}
    var reloadBtn = document.createElement('a');
    reloadBtn.className   = 'ma-reload-btn';
    reloadBtn.textContent = 'Reload';
    reloadBtn.href        = reloadUrl || window.location.href;

    var saveBtn = el('button', 'ma-save-btn', 'SAVE HTML');
    saveBtn.id  = 'saveReport';

    var btnWrap = el('div', 'ma-header-btns');
    btnWrap.appendChild(reloadBtn);
    btnWrap.appendChild(saveBtn);

    header.appendChild(hdrLeft);
    header.appendChild(btnWrap);
    page.appendChild(header);

    // ── Infrastructure Block
    page.appendChild(buildInfrastructureBlock(stackA, stackB));

    // ── Score Card
    var card      = el('div', 'ma-score-card');
    var scoreLeft = el('div', 'ma-score-left');
    scoreLeft.appendChild(el('div', 'ma-score-num ' + scoreClass(overall), overall + '%'));
    scoreLeft.appendChild(el('div', 'ma-score-label', 'Overall Match'));
    card.appendChild(scoreLeft);

    var summary = el('div', 'ma-summary');
    var cats = [
      { key: 'fonts',       label: 'Fonts'              },
      { key: 'colors',      label: 'Colors'             },
      { key: 'buttons',     label: 'Buttons'            },
      { key: 'hover',       label: 'Hover & Interactions'},
      { key: 'layout',      label: 'Layout'             },
      { key: 'navigation',  label: 'Header / Menu'      },
      { key: 'typography',  label: 'Typography'         },
      { key: 'sections',    label: 'Sections'           },
      { key: 'footer',      label: 'Footer'             }
    ];
    cats.forEach(function (cat) {
      var s   = scores[cat.key];
      var row = el('div', 'ma-summary-row');
      row.dataset.key = cat.key;
      row.appendChild(el('span', 'ma-summary-label', cat.label));
      row.appendChild(makeProgressBar(s));
      row.appendChild(el('span', 'ma-summary-pct ' + scoreClass(s), s + '%'));
      summary.appendChild(row);
    });
    card.appendChild(summary);
    page.appendChild(card);

    // ── Detail Blocks
    var blocks = [
      buildFontsBlock(     analyses.a.fonts,      analyses.b.fonts,      scores.fonts),
      buildColorsBlock(    analyses.a.colors,     analyses.b.colors,     scores.colors),
      buildButtonsBlock(   analyses.a.buttons,    analyses.b.buttons,    scores.buttons),
      buildHoverBlock(     analyses.a.hover,      analyses.b.hover,      scores.hover),
      buildLayoutBlock(    analyses.a.layout,     analyses.b.layout,     scores.layout),
      buildNavigationBlock(analyses.a.navigation, analyses.b.navigation, scores.navigation),
      buildTypographyBlock(analyses.a.typography, analyses.b.typography, scores.typography),
      buildSectionsBlock(  analyses.a.sections,   analyses.b.sections,   scores.sections),
      buildFooterBlock(    analyses.a.footer,     analyses.b.footer,     scores.footer)
    ];
    blocks.forEach(function (b) { page.appendChild(b); });

    // ── Footer
    page.appendChild(el('div', 'ma-footer', 'Digital Detective Match Analysis  ·  Digital Detective V1.6  ·  Developed by Camilo Mello'));

    root.innerHTML = '';
    root.appendChild(page);

    // ── Toggle on/off per section
    var activeKeys = {};
    cats.forEach(function (cat) { activeKeys[cat.key] = true; });

    function recalcOverall() {
      var ws = 0, tw = 0;
      Object.keys(weights).forEach(function (k) {
        if (activeKeys[k]) { ws += scores[k] * weights[k]; tw += weights[k]; }
      });
      var newScore = tw ? Math.round(ws / tw) : 0;
      var numEl = page.querySelector('.ma-score-num');
      if (numEl) {
        numEl.textContent = newScore + '%';
        numEl.className   = 'ma-score-num ' + scoreClass(newScore);
      }
    }

    page.querySelectorAll('.ma-toggle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.key;
        activeKeys[key] = !activeKeys[key];
        var isOn = activeKeys[key];
        btn.textContent = isOn ? 'ON' : 'OFF';
        btn.className   = 'ma-toggle-btn ' + (isOn ? 'ma-toggle-on' : 'ma-toggle-off');
        var blockEl = page.querySelector('.ma-block[data-key="' + key + '"]');
        if (blockEl) blockEl.classList.toggle('ma-block--off', !isOn);
        var rowEl = page.querySelector('.ma-summary-row[data-key="' + key + '"]');
        if (rowEl) rowEl.classList.toggle('ma-summary-row--off', !isOn);
        recalcOverall();
      });
    });

    page.querySelectorAll('.ma-collapse-btn').forEach(function (btn) {
      var block = btn.closest('.ma-block');
      if (block) btn.textContent = block.classList.contains('ma-collapsed') ? '▶' : '▼';
      btn.addEventListener('click', function () {
        var blockEl = btn.closest('.ma-block');
        if (!blockEl) return;
        var collapsed = blockEl.classList.toggle('ma-collapsed');
        btn.textContent = collapsed ? '▶' : '▼';
      });
    });

    if (window.DDReportUtils) {
      window.DDReportUtils.bindSaveButton(saveBtn, buildReportFilename(urlA, urlB));
    }
  }

  function buildReportFilename(urlA, urlB) {
    function host(url) {
      try { return new URL(url).hostname.replace(/^www\./, '').replace(/[^a-zA-Z0-9.-]/g, '_'); }
      catch (e) { return 'site'; }
    }
    var now  = new Date();
    var mm   = String(now.getMonth() + 1).padStart(2, '0');
    var dd   = String(now.getDate()).padStart(2, '0');
    var yyyy = now.getFullYear();
    return host(urlA) + '_X_' + host(urlB) + '_Match_Analysis_Report_' + mm + '_' + dd + '_' + yyyy + '.html';
  }

  /* ═══════════════════════════════════════════
     CSS FETCHING
  ═══════════════════════════════════════════ */

  var MAX_CSS_BYTES = 600000;

  function getCssForPage(html, baseUrl) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var inlineCss = '';
    doc.querySelectorAll('style').forEach(function (s) { inlineCss += (s.textContent || ''); });

    var cssUrls = [];
    doc.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;
      try { cssUrls.push(new URL(href, baseUrl).href); } catch (e) {}
    });

    if (!cssUrls.length) return Promise.resolve(inlineCss.substring(0, MAX_CSS_BYTES));

    return new Promise(function (resolve) {
      chrome.runtime.sendMessage({ action: 'fetch_css_urls', urls: cssUrls.slice(0, 12) }, function (resp) {
        var externalCss = '';
        if (resp && resp.items) resp.items.forEach(function (item) { externalCss += (item.css || ''); });
        resolve((inlineCss + '\n' + externalCss).substring(0, MAX_CSS_BYTES));
      });
    });
  }

  /* ═══════════════════════════════════════════
     STATUS & MAIN
  ═══════════════════════════════════════════ */

  function setStatus(msg, isError) {
    var el2 = document.getElementById('ma-status-text');
    if (el2) el2.textContent = msg;
    if (isError) {
      var spinner = document.querySelector('.ma-spinner');
      if (spinner) spinner.style.display = 'none';
    }
  }

  function run() {
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (e) { params = { get: function () { return ''; } }; }
    var urlA = (params.get('urlA') || '').trim();
    var urlB = (params.get('urlB') || '').trim();

    if (!urlA || !urlB) {
      setStatus('Missing URLs. Close this tab and try again from the popup.', true);
      return;
    }

    setStatus('Fetching Reference URL (A)…');

    var htmlA, htmlB;

    chrome.runtime.sendMessage({ action: 'fetch_page_for_match', url: urlA }, function (respA) {
      if (!respA || !respA.ok || !respA.html) {
        setStatus('Failed to fetch URL A. Check the URL and try again.', true);
        return;
      }
      htmlA = respA.html;
      setStatus('Fetching Variant URL (B)…');

      chrome.runtime.sendMessage({ action: 'fetch_page_for_match', url: urlB }, function (respB) {
        if (!respB || !respB.ok || !respB.html) {
          setStatus('Failed to fetch URL B. Check the URL and try again.', true);
          return;
        }
        htmlB = respB.html;
        setStatus('Extracting CSS from A…');

        getCssForPage(htmlA, urlA).then(function (cssA) {
          setStatus('Extracting CSS from B…');
          return getCssForPage(htmlB, urlB).then(function (cssB) {
            return { cssA: cssA, cssB: cssB };
          });
        }).then(function (css) {
          setStatus('Running analysis…');

          var stackA = detectTechStack(htmlA, urlA);
          var stackB = detectTechStack(htmlB, urlB);

          var analyses = {
            a: {
              fonts:      extractFonts(htmlA, css.cssA),
              colors:     extractColors(css.cssA),
              buttons:    extractButtons(htmlA, css.cssA),
              hover:      extractHover(css.cssA),
              layout:     extractLayout(htmlA, css.cssA),
              navigation: extractNavigation(htmlA),
              typography: extractTypography(css.cssA),
              sections:   extractSections(htmlA),
              footer:     extractFooter(htmlA)
            },
            b: {
              fonts:      extractFonts(htmlB, css.cssB),
              colors:     extractColors(css.cssB),
              buttons:    extractButtons(htmlB, css.cssB),
              hover:      extractHover(css.cssB),
              layout:     extractLayout(htmlB, css.cssB),
              navigation: extractNavigation(htmlB),
              typography: extractTypography(css.cssB),
              sections:   extractSections(htmlB),
              footer:     extractFooter(htmlB)
            }
          };

          var scores = {
            fonts:      scoreFonts(     analyses.a.fonts,      analyses.b.fonts),
            colors:     scoreColors(    analyses.a.colors,     analyses.b.colors),
            buttons:    scoreButtons(   analyses.a.buttons,    analyses.b.buttons),
            hover:      scoreHover(     analyses.a.hover,      analyses.b.hover),
            layout:     scoreLayout(    analyses.a.layout,     analyses.b.layout),
            navigation: scoreNavigation(analyses.a.navigation, analyses.b.navigation),
            typography: scoreTypography(analyses.a.typography, analyses.b.typography),
            sections:   scoreSections(  analyses.a.sections,   analyses.b.sections),
            footer:     scoreFooter(    analyses.a.footer,     analyses.b.footer)
          };

          var weights = { fonts: 14, colors: 14, buttons: 12, hover: 8, layout: 12, navigation: 12, typography: 10, sections: 8, footer: 10 };
          var weightedSum = 0, totalWeight = 0;
          Object.keys(weights).forEach(function (k) { weightedSum += scores[k] * weights[k]; totalWeight += weights[k]; });
          var overall = Math.round(weightedSum / totalWeight);

          setStatus('Rendering report…');
          setTimeout(function () {
            var loading = document.getElementById('ma-loading');
            var rootEl  = document.getElementById('ma-root');
            if (loading) loading.style.display = 'none';
            if (rootEl)  rootEl.style.display = '';
            buildReport(analyses, scores, overall, urlA, urlB, stackA, stackB, weights);
          }, 80);
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', run);
})();
