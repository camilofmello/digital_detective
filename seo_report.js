(function () {
  'use strict';

  /* ── Constants ────────────────────────────────────────────────────────────── */

  var PILLAR_WEIGHTS = { indexability: 25, onPageSeo: 25, contentQuality: 20, semanticSeo: 15, mediaLinks: 15 };

  var WORD_THRESHOLDS = { post: 600, page: 250, product: 150, category: 120, homepage: 0 };

  var PILLAR_LABELS = {
    indexability:   'Indexability',
    onPageSeo:      'On-Page SEO',
    contentQuality: 'Content Quality',
    semanticSeo:    'Semantic SEO',
    mediaLinks:     'Media & Crawlability'
  };

  var STOPWORDS = ['a','an','the','and','or','but','in','on','at','to','for','of','with','by','from',
    'is','are','was','were','be','been','being','have','has','had','do','does','did','will','would',
    'could','should','may','might','can','its','this','that','these','those','it','as','if','so','not'];

  /* ── Utilities ────────────────────────────────────────────────────────────── */

  function normalizeText(text) {
    return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function tokenize(text) {
    return normalizeText(text).split(' ').filter(function (w) { return w.length > 2 && STOPWORDS.indexOf(w) === -1; });
  }

  function containsPhrase(text, phrase) {
    if (!text || !phrase) return false;
    return normalizeText(text).indexOf(normalizeText(phrase)) !== -1;
  }

  function partialMatch(text, phrase) {
    if (!text || !phrase) return false;
    var tokens = tokenize(phrase);
    if (!tokens.length) return false;
    var norm = normalizeText(text);
    var hits = tokens.filter(function (t) { return norm.indexOf(t) !== -1; }).length;
    return hits >= Math.ceil(tokens.length * 0.6);
  }

  function pillarColor(score) {
    if (score >= 80) return '#16a34a';
    if (score >= 55) return '#d97706';
    return '#DD1234';
  }

  function scoreColor(score) { return pillarColor(score); }

  function getGrade(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Strong';
    if (score >= 60) return 'Moderate';
    if (score >= 45) return 'Weak';
    return 'Poor';
  }

  function getGradeColor(score) {
    if (score >= 75) return '#16a34a';
    if (score >= 55) return '#d97706';
    return '#DD1234';
  }

  function setStatus(msg) {
    var el = document.getElementById('seo-status');
    if (el) el.textContent = msg;
  }

  function showError(msg) {
    var loadingEl = document.getElementById('seo-loading');
    if (loadingEl) {
      loadingEl.innerHTML =
        '<div class="seo-error">' +
          '<div class="seo-error-icon">⚠</div>' +
          '<div class="seo-error-msg">SEO Analysis failed</div>' +
          '<div class="seo-error-sub">' + escHtml(msg) + '</div>' +
        '</div>';
    }
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Page type detection ──────────────────────────────────────────────────── */

  function detectPageType(s) {
    // Product
    if (s.hasProductSchema) return 'product';
    if (s.hasPriceEl && s.hasCartCta) return 'product';

    // Post / Article
    if (s.hasArticleSchema) return 'post';
    if (s.hasArticleEl && s.hasPublishDate) return 'post';
    if (s.hasAuthor && s.wordCount > 400 && s.h2s && s.h2s.length >= 2) return 'post';

    // Homepage
    if (s.isRootUrl) return 'homepage';

    // Category / Archive
    if (s.hasPagination && s.hasItemCards) return 'category';
    if (s.hasItemCards && (s.h1s && s.h1s.length > 0) && !(s.hasPriceEl && s.hasCartCta)) return 'category';
    if (s.hasPagination && s.wordCount < 400) return 'category';

    // Default: landing page
    return 'page';
  }

  /* ── Keyword inference ────────────────────────────────────────────────────── */

  function inferKeyword(s) {
    var titleTokens = tokenize(s.title || '');
    var h1Tokens    = tokenize((s.h1s && s.h1s[0]) || '');
    var slugTokens  = tokenize((s.slug || '').replace(/-/g, ' '));
    var ogTokens    = tokenize((s.ogTags && s.ogTags['og:title']) || '');

    function overlap(a, b) {
      return a.filter(function (t) { return b.indexOf(t) !== -1; });
    }

    var shared = overlap(titleTokens, h1Tokens);
    if (shared.length >= 2) return shared.slice(0, 4).join(' ');

    var titleSlug = overlap(titleTokens, slugTokens);
    if (titleSlug.length >= 2) return titleSlug.slice(0, 4).join(' ');

    if (titleTokens.length >= 2) return titleTokens.slice(0, 4).join(' ');
    if (h1Tokens.length >= 2) return h1Tokens.slice(0, 4).join(' ');
    if (slugTokens.length >= 2) return slugTokens.slice(0, 4).join(' ');
    if (ogTokens.length >= 2) return ogTokens.slice(0, 4).join(' ');
    return titleTokens[0] || h1Tokens[0] || 'unknown';
  }

  /* ── Rule result helper ───────────────────────────────────────────────────── */

  function rule(id, label, category, status, details, weight) {
    return { id: id, label: label, category: category, status: status, details: details, weight: weight };
  }

  /* ── Pillar 1: Indexability ───────────────────────────────────────────────── */

  function evaluateIndexability(s) {
    var results = [];

    // 1. HTTP status (page loaded = accessible)
    results.push(rule('http-status', 'Page accessibility', 'Indexability',
      'pass', 'Page is loaded and accessible in the browser.', 4));

    // 2. Meta robots
    var robots = (s.metaRobots || '').toLowerCase();
    if (robots.indexOf('noindex') !== -1) {
      results.push(rule('meta-robots', 'Meta robots directive', 'Indexability',
        'fail', 'Meta robots contains "noindex". This page is blocked from being indexed by search engines.', 5));
    } else if (robots.indexOf('nofollow') !== -1 || robots.indexOf('noarchive') !== -1) {
      results.push(rule('meta-robots', 'Meta robots directive', 'Indexability',
        'warn', 'Meta robots contains a restrictive directive ("' + s.metaRobots + '"). Links and/or caching may be affected.', 5));
    } else {
      results.push(rule('meta-robots', 'Meta robots directive', 'Indexability',
        'pass', robots ? 'Robots directive is present and allows indexing: "' + s.metaRobots + '".' : 'No blocking robots directive found.', 5));
    }

    // 3. Canonical present
    if (!s.canonical) {
      results.push(rule('canonical-present', 'Canonical tag present', 'Indexability',
        'fail', 'No canonical tag found. Add <link rel="canonical" href="..."> to prevent duplicate content issues.', 4));
    } else {
      results.push(rule('canonical-present', 'Canonical tag present', 'Indexability',
        'pass', 'Canonical tag found: ' + s.canonical, 4));
    }

    // 4. Canonical consistency
    if (!s.canonical) {
      results.push(rule('canonical-consistency', 'Canonical consistency', 'Indexability',
        'na', 'No canonical tag to evaluate.', 4));
    } else {
      try {
        var canonUrl = new URL(s.canonical, s.url);
        var pageUrl  = new URL(s.url);
        var canonNorm = canonUrl.origin + canonUrl.pathname.replace(/\/$/, '');
        var pageNorm  = pageUrl.origin  + pageUrl.pathname.replace(/\/$/, '');
        if (canonUrl.origin !== pageUrl.origin) {
          results.push(rule('canonical-consistency', 'Canonical consistency', 'Indexability',
            'fail', 'Canonical points to a different domain (' + canonUrl.origin + '). This may transfer SEO value away from this page.', 4));
        } else if (canonNorm !== pageNorm) {
          results.push(rule('canonical-consistency', 'Canonical consistency', 'Indexability',
            'warn', 'Canonical URL differs slightly from the page URL (e.g. trailing slash or path difference). Verify this is intentional.', 4));
        } else {
          results.push(rule('canonical-consistency', 'Canonical consistency', 'Indexability',
            'pass', 'Canonical URL matches the current page URL.', 4));
        }
      } catch (e) {
        results.push(rule('canonical-consistency', 'Canonical consistency', 'Indexability',
          'warn', 'Could not fully evaluate canonical URL consistency.', 4));
      }
    }

    // 5. Indexable content
    if (s.wordCount < 10) {
      results.push(rule('indexable-content', 'Indexable main content', 'Indexability',
        'fail', 'Almost no readable text found on the page. Search engines need meaningful content to index.', 4));
    } else if (s.wordCount < 50) {
      results.push(rule('indexable-content', 'Indexable main content', 'Indexability',
        'warn', 'Very little text detected (' + s.wordCount + ' words). Content may be too thin to index effectively.', 4));
    } else {
      results.push(rule('indexable-content', 'Indexable main content', 'Indexability',
        'pass', 'Readable content found (' + s.wordCount + ' words).', 4));
    }

    // 6. Crawlable links
    var allLinks = (s.internalLinks || []).length + (s.externalLinks || []).length;
    if (allLinks === 0) {
      results.push(rule('crawlable-links', 'Crawlable links', 'Indexability',
        'fail', 'No crawlable HTML anchor links detected. Search engines need links to discover and navigate content.', 4));
    } else if ((s.internalLinks || []).length === 0) {
      results.push(rule('crawlable-links', 'Crawlable links', 'Indexability',
        'warn', 'No internal links detected. Consider adding links to related content on your site.', 4));
    } else {
      results.push(rule('crawlable-links', 'Crawlable links', 'Indexability',
        'pass', (s.internalLinks || []).length + ' internal and ' + (s.externalLinks || []).length + ' external crawlable links found.', 4));
    }

    return results;
  }

  /* ── Pillar 2: On-Page SEO ────────────────────────────────────────────────── */

  function evaluateOnPageSeo(s, pageType, keyword) {
    var results = [];
    var isHomepage = pageType === 'homepage';
    var isPost     = pageType === 'post';
    var isProduct  = pageType === 'product';
    var isPage     = pageType === 'page';
    var isCategory = pageType === 'category';

    // 7. Title present
    if (!s.title || s.title.trim().length === 0) {
      results.push(rule('title-present', 'Title tag present', 'On-Page SEO',
        'fail', 'No title tag found. The title is one of the most critical on-page SEO signals.', 3));
    } else {
      results.push(rule('title-present', 'Title tag present', 'On-Page SEO',
        'pass', 'Title found: "' + s.title.substring(0, 80) + '".', 3));
    }

    // 8. Title length
    var titleLen = (s.title || '').length;
    if (titleLen === 0) {
      results.push(rule('title-length', 'Title length', 'On-Page SEO',
        'fail', 'Title is missing.', 2));
    } else if (titleLen >= 30 && titleLen <= 65) {
      results.push(rule('title-length', 'Title length', 'On-Page SEO',
        'pass', 'Title length is ' + titleLen + ' characters (optimal range: 30–65).', 2));
    } else if (titleLen < 15 || titleLen > 80) {
      results.push(rule('title-length', 'Title length', 'On-Page SEO',
        'fail', 'Title length is ' + titleLen + ' characters. Recommended range is 30–65 characters.', 2));
    } else {
      results.push(rule('title-length', 'Title length', 'On-Page SEO',
        'warn', 'Title length is ' + titleLen + ' characters. Recommended range is 30–65 characters.', 2));
    }

    // 9. Meta description
    var descLen = (s.metaDescription || '').length;
    if (descLen === 0) {
      results.push(rule('meta-description', 'Meta description', 'On-Page SEO',
        'fail', 'No meta description found. A compelling description can improve click-through rates in search results.', 3));
    } else if (descLen >= 50 && descLen <= 160) {
      results.push(rule('meta-description', 'Meta description', 'On-Page SEO',
        'pass', 'Meta description is ' + descLen + ' characters (optimal range: 50–160).', 3));
    } else {
      results.push(rule('meta-description', 'Meta description', 'On-Page SEO',
        'warn', 'Meta description is ' + descLen + ' characters. Recommended range is 50–160 characters.', 3));
    }

    // 10. H1 presence
    var h1Count = (s.h1s || []).length;
    if (h1Count === 0) {
      results.push(rule('h1-presence', 'H1 heading', 'On-Page SEO',
        'fail', 'No H1 heading found. Every page should have exactly one H1 that clearly describes its topic.', 4));
    } else if (h1Count === 1) {
      results.push(rule('h1-presence', 'H1 heading', 'On-Page SEO',
        'pass', 'One H1 found: "' + (s.h1s[0] || '').substring(0, 80) + '".', 4));
    } else {
      results.push(rule('h1-presence', 'H1 heading', 'On-Page SEO',
        'warn', h1Count + ' H1 headings found. A page should have exactly one H1. Multiple H1s can dilute SEO focus.', 4));
    }

    // 11. Heading structure (not homepage)
    if (!isHomepage) {
      var h2Count = (s.h2s || []).length;
      var h3Count = (s.h3s || []).length;
      if (h2Count === 0 && h3Count === 0) {
        results.push(rule('heading-structure', 'Heading hierarchy', 'On-Page SEO',
          'fail', 'No H2 or H3 subheadings found. Subheadings improve readability and help search engines understand page structure.', 2));
      } else if (h2Count + h3Count < 2) {
        results.push(rule('heading-structure', 'Heading hierarchy', 'On-Page SEO',
          'warn', 'Only one subheading detected. Consider adding more H2/H3 subheadings to structure the content.', 2));
      } else {
        results.push(rule('heading-structure', 'Heading hierarchy', 'On-Page SEO',
          'pass', h2Count + ' H2 and ' + h3Count + ' H3 subheadings found.', 2));
      }
    } else {
      results.push(rule('heading-structure', 'Heading hierarchy', 'On-Page SEO', 'na', 'Not evaluated for homepages.', 2));
    }

    // 12. Keyword in title (not homepage)
    if (!isHomepage) {
      if (containsPhrase(s.title, keyword)) {
        results.push(rule('keyword-in-title', 'Focus keyword in title', 'On-Page SEO',
          'pass', 'Focus keyword "' + keyword + '" found in the title tag.', 3));
      } else if (partialMatch(s.title, keyword)) {
        results.push(rule('keyword-in-title', 'Focus keyword in title', 'On-Page SEO',
          'warn', 'Focus keyword "' + keyword + '" not found exactly in title, but related terms are present.', 3));
      } else {
        results.push(rule('keyword-in-title', 'Focus keyword in title', 'On-Page SEO',
          'fail', 'Focus keyword "' + keyword + '" not found in the title tag.', 3));
      }
    } else {
      results.push(rule('keyword-in-title', 'Focus keyword in title', 'On-Page SEO', 'na', 'Not evaluated for homepages.', 3));
    }

    // 13. Keyword in H1 (not homepage)
    if (!isHomepage) {
      var h1Text = (s.h1s || []).join(' ');
      if (containsPhrase(h1Text, keyword)) {
        results.push(rule('keyword-in-h1', 'Focus keyword in H1', 'On-Page SEO',
          'pass', 'Focus keyword "' + keyword + '" found in the H1 heading.', 3));
      } else if (partialMatch(h1Text, keyword)) {
        results.push(rule('keyword-in-h1', 'Focus keyword in H1', 'On-Page SEO',
          'warn', 'Focus keyword "' + keyword + '" not found exactly in H1, but related terms are present.', 3));
      } else {
        results.push(rule('keyword-in-h1', 'Focus keyword in H1', 'On-Page SEO',
          'fail', 'Focus keyword "' + keyword + '" not found in the H1 heading.', 3));
      }
    } else {
      results.push(rule('keyword-in-h1', 'Focus keyword in H1', 'On-Page SEO', 'na', 'Not evaluated for homepages.', 3));
    }

    // 14. Keyword in first paragraph (post, page, product)
    if (isPost || isPage || isProduct) {
      if (containsPhrase(s.firstParagraph, keyword)) {
        results.push(rule('keyword-first-paragraph', 'Keyword in first paragraph', 'On-Page SEO',
          'pass', 'Focus keyword "' + keyword + '" appears in the opening paragraph.', 3));
      } else if (partialMatch(s.firstParagraph, keyword)) {
        results.push(rule('keyword-first-paragraph', 'Keyword in first paragraph', 'On-Page SEO',
          'warn', 'Exact keyword not found in first paragraph, but semantically related terms are present.', 3));
      } else {
        results.push(rule('keyword-first-paragraph', 'Keyword in first paragraph', 'On-Page SEO',
          'fail', 'Focus keyword "' + keyword + '" not found in the opening paragraph. Including it early reinforces topic relevance.', 3));
      }
    } else {
      results.push(rule('keyword-first-paragraph', 'Keyword in first paragraph', 'On-Page SEO', 'na', 'Not evaluated for this page type.', 3));
    }

    // 15. Keyword in slug (not homepage)
    if (!isHomepage) {
      var slug = (s.slug || '').replace(/-/g, ' ');
      if (containsPhrase(slug, keyword)) {
        results.push(rule('keyword-in-slug', 'Keyword in URL slug', 'On-Page SEO',
          'pass', 'Focus keyword "' + keyword + '" is reflected in the URL slug.', 2));
      } else if (partialMatch(slug, keyword)) {
        results.push(rule('keyword-in-slug', 'Keyword in URL slug', 'On-Page SEO',
          'warn', 'URL slug partially matches the focus keyword "' + keyword + '".', 2));
      } else {
        results.push(rule('keyword-in-slug', 'Keyword in URL slug', 'On-Page SEO',
          'fail', 'Focus keyword "' + keyword + '" not found in the URL slug. URL slugs are a light but useful on-page signal.', 2));
      }
    } else {
      results.push(rule('keyword-in-slug', 'Keyword in URL slug', 'On-Page SEO', 'na', 'Not evaluated for homepages.', 2));
    }

    // 16. Unique primary topic
    var titleToks = new Set(tokenize(s.title || ''));
    var h1Toks    = new Set(tokenize((s.h1s || []).join(' ')));
    var sharedCount = 0;
    titleToks.forEach(function (t) { if (h1Toks.has(t)) sharedCount++; });
    var totalUniq = titleToks.size + h1Toks.size - sharedCount;
    var overlapRatio = totalUniq > 0 ? sharedCount / Math.min(titleToks.size, h1Toks.size || 1) : 0;

    if (overlapRatio >= 0.5) {
      results.push(rule('unique-primary-topic', 'Unique primary topic', 'On-Page SEO',
        'pass', 'Title and H1 share strong thematic alignment.', 3));
    } else if (overlapRatio >= 0.2) {
      results.push(rule('unique-primary-topic', 'Unique primary topic', 'On-Page SEO',
        'warn', 'Title and H1 have limited token overlap. Ensure they convey the same primary topic.', 3));
    } else {
      results.push(rule('unique-primary-topic', 'Unique primary topic', 'On-Page SEO',
        'fail', 'Title and H1 appear to cover different topics. Align them to reinforce the page\'s primary subject.', 3));
    }

    return results;
  }

  /* ── Pillar 3: Content Quality ────────────────────────────────────────────── */

  function evaluateContentQuality(s, pageType, keyword) {
    var results = [];
    var isPost     = pageType === 'post';
    var isPage     = pageType === 'page';
    var isProduct  = pageType === 'product';
    var isCategory = pageType === 'category';
    var isHomepage = pageType === 'homepage';

    // 17. Text volume
    if (isHomepage) {
      results.push(rule('text-volume', 'Text volume', 'Content Quality', 'na', 'No minimum word count for homepages.', 4));
    } else {
      var threshold = WORD_THRESHOLDS[pageType] || 200;
      if (s.wordCount >= threshold) {
        results.push(rule('text-volume', 'Text volume', 'Content Quality',
          'pass', 'Word count (' + s.wordCount + ') meets the recommended minimum of ' + threshold + ' for a ' + pageType + ' page.', 4));
      } else if (s.wordCount >= Math.round(threshold * 0.6)) {
        results.push(rule('text-volume', 'Text volume', 'Content Quality',
          'warn', 'Word count (' + s.wordCount + ') is below the recommended minimum of ' + threshold + ' words for a ' + pageType + ' page.', 4));
      } else {
        results.push(rule('text-volume', 'Text volume', 'Content Quality',
          'fail', 'Word count (' + s.wordCount + ') is significantly below the recommended minimum of ' + threshold + ' words for a ' + pageType + ' page.', 4));
      }
    }

    // 18. Introductory content (post, page, product)
    if (isPost || isPage || isProduct) {
      var fpLen = (s.firstParagraph || '').length;
      if (fpLen >= 100) {
        results.push(rule('intro-content', 'Introductory paragraph', 'Content Quality',
          'pass', 'Page has a clear introductory paragraph (' + fpLen + ' characters).', 2));
      } else if (fpLen >= 40) {
        results.push(rule('intro-content', 'Introductory paragraph', 'Content Quality',
          'warn', 'Opening paragraph is quite short (' + fpLen + ' characters). Expand it to establish the topic clearly.', 2));
      } else {
        results.push(rule('intro-content', 'Introductory paragraph', 'Content Quality',
          'fail', 'No substantial introductory paragraph found. Add an opening paragraph of at least 50 characters.', 2));
      }
    } else {
      results.push(rule('intro-content', 'Introductory paragraph', 'Content Quality', 'na', 'Not evaluated for this page type.', 2));
    }

    // 19. Subheading coverage (post, page, category)
    if (isPost || isPage || isCategory) {
      var h2c = (s.h2s || []).length;
      var h3c = (s.h3s || []).length;
      if (h2c + h3c >= 3) {
        results.push(rule('subheading-coverage', 'Subheading coverage', 'Content Quality',
          'pass', 'Content is well-sectioned with ' + (h2c + h3c) + ' subheadings.', 2));
      } else if (h2c + h3c >= 1) {
        results.push(rule('subheading-coverage', 'Subheading coverage', 'Content Quality',
          'warn', 'Only ' + (h2c + h3c) + ' subheadings detected. Add more to break up long content.', 2));
      } else if (s.wordCount > 300) {
        results.push(rule('subheading-coverage', 'Subheading coverage', 'Content Quality',
          'fail', 'No subheadings found on a page with ' + s.wordCount + ' words. Readers and crawlers benefit from structured sections.', 2));
      } else {
        results.push(rule('subheading-coverage', 'Subheading coverage', 'Content Quality',
          'warn', 'No subheadings found. Consider adding H2/H3 to improve structure.', 2));
      }
    } else {
      results.push(rule('subheading-coverage', 'Subheading coverage', 'Content Quality', 'na', 'Not evaluated for this page type.', 2));
    }

    // 20. Keyword density (post, page, product)
    if (isPost || isPage || isProduct) {
      var bodyNorm = normalizeText(s.bodyText || '');
      var kwTokens = tokenize(keyword);
      var kwCount  = 0;
      if (kwTokens.length > 0) {
        kwTokens.forEach(function (t) {
          var re = new RegExp('\\b' + t + '\\b', 'g');
          var m  = bodyNorm.match(re);
          kwCount += m ? m.length : 0;
        });
        kwCount = Math.round(kwCount / kwTokens.length);
      }
      var density = s.wordCount > 0 ? (kwCount / s.wordCount) * 100 : 0;
      if (density >= 0.5 && density <= 2.5) {
        results.push(rule('keyword-density', 'Keyword density', 'Content Quality',
          'pass', 'Keyword density is ' + density.toFixed(1) + '% (healthy range: 0.5–2.5%).', 3));
      } else if (density > 3.5) {
        results.push(rule('keyword-density', 'Keyword density', 'Content Quality',
          'fail', 'Keyword density is ' + density.toFixed(1) + '% — possibly over-optimised. Keep it under 3%.', 3));
      } else {
        results.push(rule('keyword-density', 'Keyword density', 'Content Quality',
          'warn', 'Keyword density is ' + density.toFixed(1) + '%. The optimal range is 0.5–2.5%. Use the keyword more naturally.', 3));
      }
    } else {
      results.push(rule('keyword-density', 'Keyword density', 'Content Quality', 'na', 'Not evaluated for this page type.', 3));
    }

    // 21. Transition words (post, page)
    if (isPost || isPage) {
      var twr = s.transitionWordRatio || 0;
      if (twr >= 0.15) {
        results.push(rule('transition-words', 'Transition words', 'Content Quality',
          'pass', 'Good use of transition words improves text flow and readability.', 2));
      } else if (twr >= 0.05) {
        results.push(rule('transition-words', 'Transition words', 'Content Quality',
          'warn', 'Moderate use of transition words. Adding more connective language (e.g. "however", "therefore") improves flow.', 2));
      } else {
        results.push(rule('transition-words', 'Transition words', 'Content Quality',
          'fail', 'Very few transition words detected. Use connective language to improve readability.', 2));
      }
    } else {
      results.push(rule('transition-words', 'Transition words', 'Content Quality', 'na', 'Not evaluated for this page type.', 2));
    }

    // 22. Long sentences (post, page)
    if (isPost || isPage) {
      var lsr = s.longSentenceRatio || 0;
      if (lsr <= 0.10) {
        results.push(rule('long-sentences', 'Sentence length', 'Content Quality',
          'pass', 'Sentence length is well-balanced. Only ' + Math.round(lsr * 100) + '% of sentences are very long.', 2));
      } else if (lsr <= 0.20) {
        results.push(rule('long-sentences', 'Sentence length', 'Content Quality',
          'warn', Math.round(lsr * 100) + '% of sentences exceed 25 words. Consider breaking some up for better readability.', 2));
      } else {
        results.push(rule('long-sentences', 'Sentence length', 'Content Quality',
          'fail', Math.round(lsr * 100) + '% of sentences are very long (>25 words). Shorten them to improve readability.', 2));
      }
    } else {
      results.push(rule('long-sentences', 'Sentence length', 'Content Quality', 'na', 'Not evaluated for this page type.', 2));
    }

    // 23. Passive voice (post, page)
    if (isPost || isPage) {
      var pv = s.passiveVoiceEstimate || 0;
      if (pv <= 0.10) {
        results.push(rule('passive-voice', 'Passive voice usage', 'Content Quality',
          'pass', 'Low passive voice usage (' + Math.round(pv * 100) + '%). Active voice improves clarity.', 2));
      } else if (pv <= 0.20) {
        results.push(rule('passive-voice', 'Passive voice usage', 'Content Quality',
          'warn', 'Moderate passive voice usage (' + Math.round(pv * 100) + '%). Try to use more active voice.', 2));
      } else {
        results.push(rule('passive-voice', 'Passive voice usage', 'Content Quality',
          'fail', 'High passive voice usage (' + Math.round(pv * 100) + '%). Rewrite sentences in active voice for better readability.', 2));
      }
    } else {
      results.push(rule('passive-voice', 'Passive voice usage', 'Content Quality', 'na', 'Not evaluated for this page type.', 2));
    }

    // 24. Scan-friendly blocks (post, page, category)
    if (isPost || isPage || isCategory) {
      var listCount  = (s.listCount  || 0);
      var tableCount = (s.tableCount || 0);
      var scanBlocks = listCount + tableCount;
      if (scanBlocks >= 2) {
        results.push(rule('scan-friendly-blocks', 'Scan-friendly content blocks', 'Content Quality',
          'pass', 'Page contains ' + listCount + ' list(s) and ' + tableCount + ' table(s) to aid scannability.', 1));
      } else if (scanBlocks >= 1) {
        results.push(rule('scan-friendly-blocks', 'Scan-friendly content blocks', 'Content Quality',
          'warn', 'Only ' + scanBlocks + ' list or table found. Consider adding more bullets, numbered lists, or tables to improve scannability.', 1));
      } else if (s.wordCount > 400) {
        results.push(rule('scan-friendly-blocks', 'Scan-friendly content blocks', 'Content Quality',
          'fail', 'No lists or tables found on a long page (' + s.wordCount + ' words). Add scannable elements to improve reader experience.', 1));
      } else {
        results.push(rule('scan-friendly-blocks', 'Scan-friendly content blocks', 'Content Quality',
          'warn', 'No lists or tables found. Consider adding some to aid scannability.', 1));
      }
    } else {
      results.push(rule('scan-friendly-blocks', 'Scan-friendly content blocks', 'Content Quality', 'na', 'Not evaluated for this page type.', 1));
    }

    // 25. Content relevance
    var titleNorm = normalizeText(s.title || '');
    var bodyNorm2 = normalizeText((s.bodyText || '').substring(0, 2000));
    var titleToks2 = tokenize(s.title || '');
    var bodyHits = titleToks2.filter(function (t) { return bodyNorm2.indexOf(t) !== -1; }).length;
    var relevanceRatio = titleToks2.length > 0 ? bodyHits / titleToks2.length : 0;
    if (relevanceRatio >= 0.6) {
      results.push(rule('content-relevance', 'Content–title relevance', 'Content Quality',
        'pass', 'Body content strongly aligns with the title topic.', 2));
    } else if (relevanceRatio >= 0.3) {
      results.push(rule('content-relevance', 'Content–title relevance', 'Content Quality',
        'warn', 'Only partial alignment between title keywords and body content.', 2));
    } else {
      results.push(rule('content-relevance', 'Content–title relevance', 'Content Quality',
        'fail', 'Body content does not appear to match the declared title topic. Ensure the page delivers on its title promise.', 2));
    }

    return results;
  }

  /* ── Pillar 4: Semantic SEO ───────────────────────────────────────────────── */

  function evaluateSemanticSeo(s, pageType) {
    var results = [];
    var isPost     = pageType === 'post';
    var isProduct  = pageType === 'product';
    var isCategory = pageType === 'category';
    var isHomepage = pageType === 'homepage';

    // 26. Structured data present
    var schemaCount = (s.schemaTypes || []).length;
    if (schemaCount > 0) {
      results.push(rule('structured-data-present', 'Structured data present', 'Semantic SEO',
        'pass', 'Structured data found: ' + s.schemaTypes.slice(0, 5).join(', ') + '.', 3));
    } else {
      results.push(rule('structured-data-present', 'Structured data present', 'Semantic SEO',
        'fail', 'No structured data (JSON-LD or microdata) detected. Structured data helps search engines understand content.', 3));
    }

    // 27. Structured data relevance
    var types = (s.schemaTypes || []).map(function (t) { return (t || '').toLowerCase(); });
    var hasOrg    = types.some(function (t) { return /organization|website|webpage/i.test(t); });
    var hasArt    = s.hasArticleSchema;
    var hasProd   = s.hasProductSchema;
    var hasBread  = s.hasBreadcrumbSchema;
    var hasFaq    = types.some(function (t) { return /faq/i.test(t); });

    if (schemaCount === 0) {
      results.push(rule('structured-data-relevance', 'Structured data relevance', 'Semantic SEO',
        'fail', 'No schema to evaluate. Add structured data appropriate for this ' + pageType + ' page.', 4));
    } else if (isPost && hasArt) {
      results.push(rule('structured-data-relevance', 'Structured data relevance', 'Semantic SEO',
        'pass', 'Article/BlogPosting schema is appropriate for a post page.', 4));
    } else if (isProduct && hasProd) {
      results.push(rule('structured-data-relevance', 'Structured data relevance', 'Semantic SEO',
        'pass', 'Product schema is present and appropriate for a product page.', 4));
    } else if (isHomepage && (hasOrg || types.some(function(t){ return /website/i.test(t); }))) {
      results.push(rule('structured-data-relevance', 'Structured data relevance', 'Semantic SEO',
        'pass', 'Organization/WebSite schema is appropriate for the homepage.', 4));
    } else if (hasOrg || hasBread) {
      results.push(rule('structured-data-relevance', 'Structured data relevance', 'Semantic SEO',
        'warn', 'Generic schema present, but no page-type-specific schema. Consider adding ' + (isPost ? 'Article' : isProduct ? 'Product' : 'relevant') + ' schema.', 4));
    } else {
      results.push(rule('structured-data-relevance', 'Structured data relevance', 'Semantic SEO',
        'warn', 'Schema types found (' + s.schemaTypes.slice(0,3).join(', ') + ') may not match this ' + pageType + ' page type.', 4));
    }

    // 28. Breadcrumbs (product, category, post)
    if (isProduct || isCategory || isPost) {
      if (s.hasBreadcrumbs) {
        results.push(rule('breadcrumbs', 'Breadcrumb navigation', 'Semantic SEO',
          'pass', 'Breadcrumb markup detected (' + (s.hasBreadcrumbSchema ? 'schema' : 'HTML') + ').', 2));
      } else {
        results.push(rule('breadcrumbs', 'Breadcrumb navigation', 'Semantic SEO',
          'fail', 'No breadcrumb markup found. Breadcrumbs improve site navigation and can enhance search result appearance.', 2));
      }
    } else {
      results.push(rule('breadcrumbs', 'Breadcrumb navigation', 'Semantic SEO', 'na', 'Not required for this page type.', 2));
    }

    // 29. Open Graph tags
    var ogTitle = s.ogTags && s.ogTags['og:title'];
    var ogDesc  = s.ogTags && s.ogTags['og:description'];
    var ogImage = s.ogTags && s.ogTags['og:image'];
    var ogScore = (ogTitle ? 1 : 0) + (ogDesc ? 1 : 0) + (ogImage ? 1 : 0);
    if (ogScore === 3) {
      results.push(rule('og-tags', 'Open Graph tags', 'Semantic SEO',
        'pass', 'All core Open Graph tags (title, description, image) are present.', 2));
    } else if (ogScore >= 1) {
      results.push(rule('og-tags', 'Open Graph tags', 'Semantic SEO',
        'warn', 'Partial Open Graph coverage (' + ogScore + '/3 core tags). Missing: ' + (!ogTitle ? 'og:title ' : '') + (!ogDesc ? 'og:description ' : '') + (!ogImage ? 'og:image' : '') + '.', 2));
    } else {
      results.push(rule('og-tags', 'Open Graph tags', 'Semantic SEO',
        'fail', 'No Open Graph tags found. Add og:title, og:description, and og:image for better social sharing previews.', 2));
    }

    // 30. Twitter Card tags
    var twCard = s.twitterTags && (s.twitterTags['twitter:card'] || s.twitterTags['twitter:title']);
    if (twCard) {
      results.push(rule('twitter-tags', 'Twitter Card tags', 'Semantic SEO',
        'pass', 'Twitter Card metadata is present.', 1));
    } else {
      results.push(rule('twitter-tags', 'Twitter Card tags', 'Semantic SEO',
        'fail', 'No Twitter Card meta tags found. Add twitter:card at minimum for proper Twitter/X share previews.', 1));
    }

    // 31. Primary image metadata
    if (ogImage) {
      results.push(rule('primary-image-meta', 'Primary image metadata', 'Semantic SEO',
        'pass', 'og:image is set: ' + String(ogImage).substring(0, 80) + '.', 2));
    } else if ((s.images || []).length > 0) {
      results.push(rule('primary-image-meta', 'Primary image metadata', 'Semantic SEO',
        'warn', 'Images found on page but no og:image defined. Set og:image to control how the page appears when shared.', 2));
    } else {
      results.push(rule('primary-image-meta', 'Primary image metadata', 'Semantic SEO',
        'fail', 'No images and no og:image found. At minimum, set an og:image for social sharing.', 2));
    }

    // 32. Article/Product specific schema (post, product)
    if (isPost) {
      if (s.hasArticleSchema) {
        results.push(rule('article-product-schema', 'Article schema', 'Semantic SEO',
          'pass', 'Article or BlogPosting structured data is present.', 3));
      } else {
        results.push(rule('article-product-schema', 'Article schema', 'Semantic SEO',
          'fail', 'This appears to be a post/article page but no Article or BlogPosting schema was found.', 3));
      }
    } else if (isProduct) {
      if (s.hasProductSchema) {
        results.push(rule('article-product-schema', 'Product schema', 'Semantic SEO',
          'pass', 'Product structured data is present.', 3));
      } else {
        results.push(rule('article-product-schema', 'Product schema', 'Semantic SEO',
          'fail', 'This appears to be a product page but no Product schema was found. This is a high-impact missing element.', 3));
      }
    } else {
      results.push(rule('article-product-schema', 'Type-specific schema', 'Semantic SEO', 'na', 'Not required for this page type.', 3));
    }

    return results;
  }

  /* ── Pillar 5: Media, Links & Crawlability ────────────────────────────────── */

  function evaluateMediaLinks(s, pageType) {
    var results = [];
    var isPost     = pageType === 'post';
    var isPage     = pageType === 'page';
    var isProduct  = pageType === 'product';
    var isCategory = pageType === 'category';
    var isHomepage = pageType === 'homepage';

    var images = s.images || [];
    var visImages = images.length;

    // 33. Image alt coverage
    if (visImages === 0) {
      results.push(rule('image-alt-coverage', 'Image alt text coverage', 'Media & Crawlability',
        'na', 'No images detected on this page.', 3));
    } else {
      var altCount = images.filter(function (img) { return img.hasAlt; }).length;
      var altRatio = altCount / visImages;
      if (altRatio >= 0.85) {
        results.push(rule('image-alt-coverage', 'Image alt text coverage', 'Media & Crawlability',
          'pass', altCount + ' of ' + visImages + ' images have descriptive alt text.', 3));
      } else if (altRatio >= 0.5) {
        results.push(rule('image-alt-coverage', 'Image alt text coverage', 'Media & Crawlability',
          'warn', 'Only ' + altCount + ' of ' + visImages + ' images have alt text. Add alt attributes to all meaningful images.', 3));
      } else {
        results.push(rule('image-alt-coverage', 'Image alt text coverage', 'Media & Crawlability',
          'fail', 'Most images lack alt text (' + altCount + '/' + visImages + '). Alt text is essential for accessibility and image SEO.', 3));
      }
    }

    // 34. Main image alt quality (post, page, product)
    if (isPost || isPage || isProduct) {
      if (visImages === 0) {
        results.push(rule('main-image-alt', 'Main image alt quality', 'Media & Crawlability',
          'warn', 'No images found. Consider adding a relevant hero or featured image with descriptive alt text.', 2));
      } else {
        var firstImg = images[0];
        if (firstImg.hasAlt && (firstImg.alt || '').length > 10) {
          results.push(rule('main-image-alt', 'Main image alt quality', 'Media & Crawlability',
            'pass', 'First image has a descriptive alt text: "' + firstImg.alt.substring(0, 60) + '".', 2));
        } else if (firstImg.hasAlt) {
          results.push(rule('main-image-alt', 'Main image alt quality', 'Media & Crawlability',
            'warn', 'First image has alt text but it may be too brief: "' + (firstImg.alt || '').substring(0, 40) + '".', 2));
        } else {
          results.push(rule('main-image-alt', 'Main image alt quality', 'Media & Crawlability',
            'fail', 'The first/main image is missing an alt attribute. Add descriptive alt text for SEO and accessibility.', 2));
        }
      }
    } else {
      results.push(rule('main-image-alt', 'Main image alt quality', 'Media & Crawlability', 'na', 'Not evaluated for this page type.', 2));
    }

    // 35. Internal links (post, page, product, category)
    if (!isHomepage) {
      var intCount = (s.internalLinks || []).length;
      if (intCount >= 3) {
        results.push(rule('internal-links', 'Internal links', 'Media & Crawlability',
          'pass', intCount + ' internal links help distribute PageRank and aid navigation.', 3));
      } else if (intCount >= 1) {
        results.push(rule('internal-links', 'Internal links', 'Media & Crawlability',
          'warn', 'Only ' + intCount + ' internal link(s) found. Add more links to related pages to improve crawlability.', 3));
      } else {
        results.push(rule('internal-links', 'Internal links', 'Media & Crawlability',
          'fail', 'No internal links found. Add links to relevant pages on your site to support crawl flow.', 3));
      }
    } else {
      results.push(rule('internal-links', 'Internal links', 'Media & Crawlability', 'na', 'Not individually evaluated for homepages.', 3));
    }

    // 36. External links (post, page)
    if (isPost || isPage) {
      var extCount = (s.externalLinks || []).length;
      if (extCount >= 1) {
        results.push(rule('external-links', 'External links', 'Media & Crawlability',
          'pass', extCount + ' external link(s) found. Citing quality sources adds credibility.', 1));
      } else {
        results.push(rule('external-links', 'External links', 'Media & Crawlability',
          'warn', 'No external links found. Linking to authoritative sources can add credibility to content-heavy pages.', 1));
      }
    } else {
      results.push(rule('external-links', 'External links', 'Media & Crawlability', 'na', 'Not evaluated for this page type.', 1));
    }

    // 37. Broken link sampling — skip (can't do HEAD requests from extension page without CORS)
    results.push(rule('broken-link-sampling', 'Broken link sampling', 'Media & Crawlability',
      'na', 'Cannot sample link responses from an extension report page. Use a dedicated crawl tool to check for broken links.', 2));

    // 38. Anchor text quality
    var allAnchors = (s.internalLinks || []).concat(s.externalLinks || []);
    var genericTerms = ['click here', 'here', 'more', 'read more', 'learn more', 'link', 'this', 'page'];
    if (allAnchors.length === 0) {
      results.push(rule('anchor-text-quality', 'Anchor text quality', 'Media & Crawlability',
        'warn', 'No anchors found to evaluate.', 2));
    } else {
      var descriptive = allAnchors.filter(function (a) {
        var text = (a.text || '').trim().toLowerCase();
        return text.length > 3 && genericTerms.indexOf(text) === -1;
      }).length;
      var qualityRatio = descriptive / allAnchors.length;
      if (qualityRatio >= 0.8) {
        results.push(rule('anchor-text-quality', 'Anchor text quality', 'Media & Crawlability',
          'pass', Math.round(qualityRatio * 100) + '% of anchors have descriptive text.', 2));
      } else if (qualityRatio >= 0.5) {
        results.push(rule('anchor-text-quality', 'Anchor text quality', 'Media & Crawlability',
          'warn', 'Only ' + Math.round(qualityRatio * 100) + '% of anchors have descriptive text. Replace generic labels like "click here" with descriptive text.', 2));
      } else {
        results.push(rule('anchor-text-quality', 'Anchor text quality', 'Media & Crawlability',
          'fail', 'Most anchor text is non-descriptive (' + Math.round(qualityRatio * 100) + '%). Use keyword-rich, contextual anchor labels.', 2));
      }
    }

    // 39. Viewport meta
    if ((s.viewport || '').indexOf('width=device-width') !== -1) {
      results.push(rule('viewport-meta', 'Viewport meta tag', 'Media & Crawlability',
        'pass', 'Responsive viewport meta tag is present: "' + s.viewport + '".', 2));
    } else if (s.viewport) {
      results.push(rule('viewport-meta', 'Viewport meta tag', 'Media & Crawlability',
        'warn', 'Viewport meta found but may not be fully responsive: "' + s.viewport + '".', 2));
    } else {
      results.push(rule('viewport-meta', 'Viewport meta tag', 'Media & Crawlability',
        'fail', 'No viewport meta tag found. Add <meta name="viewport" content="width=device-width, initial-scale=1"> for mobile-friendliness.', 2));
    }

    // 40. Lazy-load (product, category, post)
    if (isProduct || isCategory || isPost) {
      if (visImages === 0) {
        results.push(rule('lazy-load', 'Image lazy loading', 'Media & Crawlability', 'na', 'No images found.', 1));
      } else if (visImages <= 3) {
        results.push(rule('lazy-load', 'Image lazy loading', 'Media & Crawlability',
          'pass', 'Few images (' + visImages + ') — lazy loading is not critical.', 1));
      } else {
        var lazyCount = images.filter(function (img) { return img.isLazy; }).length;
        if (lazyCount >= Math.floor(visImages * 0.5)) {
          results.push(rule('lazy-load', 'Image lazy loading', 'Media & Crawlability',
            'pass', lazyCount + ' of ' + visImages + ' images use lazy loading.', 1));
        } else if (lazyCount > 0) {
          results.push(rule('lazy-load', 'Image lazy loading', 'Media & Crawlability',
            'warn', 'Only ' + lazyCount + ' of ' + visImages + ' images use loading="lazy". Apply it to non-critical images.', 1));
        } else {
          results.push(rule('lazy-load', 'Image lazy loading', 'Media & Crawlability',
            'fail', 'None of the ' + visImages + ' images use lazy loading. Add loading="lazy" to non-hero images to improve page load.', 1));
        }
      }
    } else {
      results.push(rule('lazy-load', 'Image lazy loading', 'Media & Crawlability', 'na', 'Not evaluated for this page type.', 1));
    }

    return results;
  }

  /* ── Score calculation ────────────────────────────────────────────────────── */

  function calcPillarScore(ruleResults) {
    var totalWeight   = 0;
    var weightedScore = 0;
    ruleResults.forEach(function (r) {
      if (r.status === 'na') return;
      totalWeight += r.weight;
      if (r.status === 'pass') weightedScore += r.weight * 1.0;
      if (r.status === 'warn') weightedScore += r.weight * 0.5;
      // fail = 0
    });
    return totalWeight > 0 ? (weightedScore / totalWeight) : 1;
  }

  function applyPenalties(score, checks, signals, pageType) {
    var penalties = [];

    // noindex
    var metaRobots = (signals.metaRobots || '').toLowerCase();
    if (metaRobots.indexOf('noindex') !== -1) {
      score -= 40;
      penalties.push({ title: 'Page has noindex directive', desc: 'The meta robots tag contains "noindex", blocking this page from being indexed. Remove it immediately unless intentional. (-40 pts)' });
    }
    // missing title
    if (!signals.title || signals.title.trim().length === 0) {
      score -= 12;
      penalties.push({ title: 'Missing title tag', desc: 'No title tag found. The title is one of the most important on-page SEO elements. (-12 pts)' });
    }
    // missing H1
    if (!signals.h1s || signals.h1s.length === 0) {
      score -= 10;
      penalties.push({ title: 'Missing H1 heading', desc: 'No H1 heading found. Every page needs a clear primary heading. (-10 pts)' });
    }
    // canonical to different domain
    if (signals.canonical) {
      try {
        var cu = new URL(signals.canonical, signals.url);
        var pu = new URL(signals.url);
        if (cu.origin !== pu.origin) {
          score -= 10;
          penalties.push({ title: 'Canonical points to different domain', desc: 'The canonical tag points to ' + cu.origin + ' instead of this domain. This transfers SEO value away from this page. (-10 pts)' });
        }
      } catch (e) {}
    }
    // product missing Product schema
    if (pageType === 'product' && !signals.hasProductSchema) {
      score -= 8;
      penalties.push({ title: 'Product page missing Product schema', desc: 'This appears to be a product page but has no Product structured data. This is a high-impact gap for e-commerce SEO. (-8 pts)' });
    }
    // no meaningful content
    if (signals.wordCount < 10) {
      score -= 10;
      penalties.push({ title: 'No meaningful text content', desc: 'Almost no readable text found. Search engines need textual content to understand and rank the page. (-10 pts)' });
    }

    return { score: Math.max(0, Math.min(100, score)), penalties: penalties };
  }

  function buildReport(signals) {
    setStatus('Detecting page type…');
    var pageType = detectPageType(signals);
    var keyword  = inferKeyword(signals);

    setStatus('Evaluating ' + 5 + ' pillars…');

    var idxRules  = evaluateIndexability(signals);
    var onpRules  = evaluateOnPageSeo(signals, pageType, keyword);
    var cqRules   = evaluateContentQuality(signals, pageType, keyword);
    var semRules  = evaluateSemanticSeo(signals, pageType);
    var mlRules   = evaluateMediaLinks(signals, pageType);

    var pillarScoresRaw = {
      indexability:   calcPillarScore(idxRules),
      onPageSeo:      calcPillarScore(onpRules),
      contentQuality: calcPillarScore(cqRules),
      semanticSeo:    calcPillarScore(semRules),
      mediaLinks:     calcPillarScore(mlRules)
    };

    var baseScore = 0;
    Object.keys(PILLAR_WEIGHTS).forEach(function (k) {
      baseScore += pillarScoresRaw[k] * PILLAR_WEIGHTS[k];
    });
    baseScore = Math.round(Math.max(0, Math.min(100, baseScore)));

    var penResult = applyPenalties(baseScore, null, signals, pageType);
    var finalScore = Math.round(penResult.score);

    var pillarScores = {};
    Object.keys(pillarScoresRaw).forEach(function (k) {
      pillarScores[k] = Math.round(pillarScoresRaw[k] * 100);
    });

    var allRules = idxRules.concat(onpRules).concat(cqRules).concat(semRules).concat(mlRules);
    var failed  = allRules.filter(function (r) { return r.status === 'fail'; });
    var warned  = allRules.filter(function (r) { return r.status === 'warn'; });
    var passed  = allRules.filter(function (r) { return r.status === 'pass'; });
    var na      = allRules.filter(function (r) { return r.status === 'na';   });

    // Sort failed by weight desc
    failed.sort(function (a, b) { return b.weight - a.weight; });
    warned.sort(function (a, b) { return b.weight - a.weight; });

    // Recommendations from failed + warned
    var recs = [];
    failed.concat(warned).forEach(function (r) {
      if (recs.length >= 10) return;
      recs.push(r.details);
    });

    return {
      url:         signals.url,
      pageType:    pageType,
      keyword:     keyword,
      score:       finalScore,
      grade:       getGrade(finalScore),
      pillarScores: pillarScores,
      criticalIssues: penResult.penalties,
      failed:      failed,
      warnings:    warned,
      passed:      passed,
      na:          na,
      recommendations: recs
    };
  }

  /* ── Rendering ────────────────────────────────────────────────────────────── */

  function renderGauge(score) {
    var r     = 40;
    var circ  = 2 * Math.PI * r;
    var dash  = circ * (score / 100);
    var gap   = circ - dash;
    var color = scoreColor(score);
    var svg   = document.getElementById('seo-gauge-svg');
    if (!svg) return;
    svg.innerHTML =
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="#e5e7eb" stroke-width="8" />' +
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="8"' +
      '  stroke-dasharray="' + dash.toFixed(2) + ' ' + gap.toFixed(2) + '"' +
      '  stroke-linecap="round" transform="rotate(-90 50 50)" />';
    var numEl = document.getElementById('seo-score-num');
    if (numEl) { numEl.textContent = score; numEl.style.color = color; }
  }

  function renderPillarBars(pillarScores) {
    var container = document.getElementById('seo-pillar-bars');
    if (!container) return;
    container.innerHTML = '';
    Object.keys(PILLAR_LABELS).forEach(function (k) {
      var sc = pillarScores[k] || 0;
      var row = document.createElement('div');
      row.className = 'seo-pillar-row';
      row.innerHTML =
        '<div class="seo-pillar-name">' + PILLAR_LABELS[k] + '</div>' +
        '<div class="seo-pillar-track"><div class="seo-pillar-fill" style="width:' + sc + '%;background:' + pillarColor(sc) + ';"></div></div>' +
        '<div class="seo-pillar-num" style="color:' + pillarColor(sc) + '">' + sc + '</div>';
      container.appendChild(row);
    });
  }

  function renderCheckItem(rule) {
    var item = document.createElement('div');
    item.className = 'seo-check-item';
    item.innerHTML =
      '<div class="seo-check-dot ' + rule.status + '"></div>' +
      '<div class="seo-check-body">' +
        '<div class="seo-check-header">' +
          '<span class="seo-check-cat">' + escHtml(rule.category) + '</span>' +
          '<span class="seo-check-label">' + escHtml(rule.label) + '</span>' +
        '</div>' +
        '<div class="seo-check-details">' + escHtml(rule.details) + '</div>' +
      '</div>';
    return item;
  }

  function renderCheckList(listId, rules) {
    var container = document.getElementById(listId);
    if (!container) return;
    container.innerHTML = '';
    if (!rules.length) {
      var empty = document.createElement('div');
      empty.className = 'seo-empty';
      empty.textContent = 'None.';
      container.appendChild(empty);
      return;
    }
    rules.forEach(function (r) { container.appendChild(renderCheckItem(r)); });
  }

  function renderPassedGrouped(passed) {
    var container = document.getElementById('seo-pass-list');
    if (!container) return;
    container.innerHTML = '';
    if (!passed.length) {
      var empty = document.createElement('div');
      empty.className = 'seo-empty';
      empty.textContent = 'No passed checks.';
      container.appendChild(empty);
      return;
    }
    var groups = {};
    passed.forEach(function (r) {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    });
    Object.keys(groups).forEach(function (cat) {
      var group = document.createElement('div');
      group.className = 'seo-pass-group';
      var title = document.createElement('div');
      title.className = 'seo-pass-group-title';
      title.textContent = cat;
      group.appendChild(title);
      groups[cat].forEach(function (r) { group.appendChild(renderCheckItem(r)); });
      container.appendChild(group);
    });
  }

  function renderCritical(criticalIssues) {
    var critSection = document.getElementById('seo-critical');
    var critList    = document.getElementById('seo-critical-list');
    var critCount   = document.getElementById('seo-critical-count');
    if (!critSection || !critList) return;
    if (!criticalIssues || !criticalIssues.length) {
      critSection.style.display = 'none';
      return;
    }
    critSection.style.display = 'block';
    if (critCount) critCount.textContent = criticalIssues.length + ' issue' + (criticalIssues.length > 1 ? 's' : '');
    critList.innerHTML = '';
    criticalIssues.forEach(function (issue) {
      var item = document.createElement('div');
      item.className = 'seo-critical-item';
      item.innerHTML =
        '<div class="seo-critical-icon">⚠️</div>' +
        '<div>' +
          '<div class="seo-critical-title">' + escHtml(issue.title) + '</div>' +
          '<div class="seo-critical-desc">'  + escHtml(issue.desc)  + '</div>' +
        '</div>';
      critList.appendChild(item);
    });
  }

  function renderRecommendations(recs) {
    var container = document.getElementById('seo-rec-list');
    if (!container) return;
    container.innerHTML = '';
    if (!recs || !recs.length) {
      var empty = document.createElement('div');
      empty.className = 'seo-empty';
      empty.textContent = 'No recommendations — page is performing well!';
      container.appendChild(empty);
      return;
    }
    recs.forEach(function (rec, i) {
      var li = document.createElement('li');
      li.className = 'seo-rec-item';
      li.innerHTML = '<div class="seo-rec-num">' + (i + 1) + '</div><div>' + escHtml(rec) + '</div>';
      container.appendChild(li);
    });
  }

  function bindSectionToggles() {
    document.querySelectorAll('.seo-toggle-head').forEach(function (head) {
      head.addEventListener('click', function () {
        var section  = head.closest('.seo-section');
        if (!section) return;
        var collapsed = section.classList.toggle('seo-collapsed');
        var btn = head.querySelector('.seo-section-toggle');
        if (btn) btn.innerHTML = collapsed ? '&#9654;' : '&#9660;';
      });
    });
  }

  function renderReport(report, signals) {
    var loadingEl = document.getElementById('seo-loading');
    var rootEl    = document.getElementById('seo-root');
    if (loadingEl) loadingEl.style.display = 'none';
    if (rootEl)    rootEl.style.display    = 'block';

    document.title = 'SEO — ' + report.url;

    var urlEl = document.getElementById('seo-url');
    if (urlEl) {
      urlEl.textContent = report.url;
      urlEl.setAttribute('href', report.url);
    }

    var genTimeEl = document.getElementById('seo-gen-time');
    if (genTimeEl) genTimeEl.textContent = 'Generated: ' + new Date().toUTCString();

    // Gauge
    renderGauge(report.score);

    // Grade
    var gradeEl  = document.getElementById('seo-grade');
    var badgeEl  = document.getElementById('seo-grade-badge');
    if (gradeEl) gradeEl.textContent = report.grade;
    if (badgeEl) {
      badgeEl.textContent = report.score + ' / 100';
      badgeEl.style.background = getGradeColor(report.score);
    }

    // Page type + keyword
    var ptEl = document.getElementById('seo-page-type');
    var kwEl = document.getElementById('seo-keyword');
    if (ptEl) ptEl.textContent = { post: 'Post / Article', page: 'Landing Page', product: 'Product Page', category: 'Category / Archive', homepage: 'Homepage' }[report.pageType] || report.pageType;
    if (kwEl) kwEl.textContent = report.keyword;

    // Count chips
    var fcEl = document.getElementById('seo-fail-chip');
    var wcEl = document.getElementById('seo-warn-chip');
    var pcEl = document.getElementById('seo-pass-chip');
    if (fcEl) fcEl.textContent = report.failed.length  + ' failure'  + (report.failed.length  !== 1 ? 's' : '');
    if (wcEl) wcEl.textContent = report.warnings.length + ' warning' + (report.warnings.length !== 1 ? 's' : '');
    if (pcEl) pcEl.textContent = report.passed.length  + ' passed';

    // Pillar bars
    renderPillarBars(report.pillarScores);

    // Critical issues
    renderCritical(report.criticalIssues);

    // Success banner (if no failures)
    var successBanner = document.getElementById('seo-success-banner');
    if (successBanner) {
      successBanner.style.display = (report.failed.length === 0 && report.criticalIssues.length === 0) ? 'flex' : 'none';
    }

    // Failed
    renderCheckList('seo-fail-list', report.failed);
    var failCount = document.getElementById('seo-fail-count');
    if (failCount) failCount.textContent = '(' + report.failed.length + ')';

    // Warnings
    renderCheckList('seo-warn-list', report.warnings);
    var warnCount = document.getElementById('seo-warn-count');
    if (warnCount) warnCount.textContent = '(' + report.warnings.length + ')';

    // Recommendations
    renderRecommendations(report.recommendations);

    // Passed (collapsed)
    renderPassedGrouped(report.passed);
    var passCount = document.getElementById('seo-pass-count');
    if (passCount) passCount.textContent = '(' + report.passed.length + ')';

    bindSectionToggles();
    bindReload();
    bindSave(report, signals);
    bindCopyJson(report, signals);
  }

  /* ── Reload / Save / Copy ─────────────────────────────────────────────────── */

  function bindReload() {
    var btn = document.getElementById('seo-reload');
    if (!btn) return;
    btn.addEventListener('click', function () { window.location.reload(); });
  }

  function bindSave(report, signals) {
    var btn = document.getElementById('seo-save');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
      var blob = new Blob([html], { type: 'text/html' });
      var a    = document.createElement('a');
      var host = '';
      try { host = new URL(report.url).hostname.replace(/^www\./, '').replace(/[^a-zA-Z0-9.-]/g, '_'); } catch (e) {}
      a.download = 'seo_report_' + host + '.html';
      a.href     = URL.createObjectURL(blob);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    });
  }

  function buildJsonExport(report, signals) {
    return {
      url:            report.url,
      capturedAt:     signals.capturedAt || null,
      pageType:       report.pageType,
      detectedKeyword: report.keyword,
      score:          report.score,
      grade:          report.grade,
      pillarScores:   report.pillarScores,
      criticalIssues: report.criticalIssues,
      checks: {
        failed:   report.failed.map(function(r){ return { category:r.category, ruleId:r.id, label:r.label, status:r.status, weight:r.weight, details:r.details }; }),
        warnings: report.warnings.map(function(r){ return { category:r.category, ruleId:r.id, label:r.label, status:r.status, weight:r.weight, details:r.details }; }),
        passed:   report.passed.map(function(r){ return { category:r.category, ruleId:r.id, label:r.label, status:r.status, weight:r.weight }; }),
        notApplicable: report.na.map(function(r){ return { category:r.category, ruleId:r.id, label:r.label }; })
      },
      prioritizedRecommendations: report.recommendations
    };
  }

  function bindCopyJson(report, signals) {
    var btn = document.getElementById('seo-copy-json');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var jsonStr = JSON.stringify(buildJsonExport(report, signals), null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsonStr).then(function () {
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = 'Copy JSON'; }, 1800);
        });
      } else {
        var ta = document.createElement('textarea');
        ta.value = jsonStr;
        ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        ta.remove();
        btn.textContent = 'Copied!';
        setTimeout(function () { btn.textContent = 'Copy JSON'; }, 1800);
      }
    });
  }

  /* ── Entry point ──────────────────────────────────────────────────────────── */

  function run() {
    setStatus('Loading SEO data…');
    try {
      chrome.storage.local.get(['dd_seo_data'], function (res) {
        var signals = res && res.dd_seo_data;
        if (!signals) {
          showError('No SEO data found. Please re-run the analysis from the extension popup.');
          return;
        }
        try { chrome.storage.local.remove(['dd_seo_data']); } catch (e) {}

        setStatus('Running analysis…');
        var report = buildReport(signals);
        renderReport(report, signals);
      });
    } catch (e) {
      showError('Failed to load analysis data: ' + e.message);
    }
  }

  document.addEventListener('DOMContentLoaded', run);

})();
