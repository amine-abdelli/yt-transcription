/* ============================================================================
 * Recap Panel — inline summary + per-claim fact-check UI
 * Vanilla DOM, scoped under .recap-root (see panel.css)
 *
 * Public API (window.RecapPanel):
 *   .mount()                              -> ensure host node exists between title and description
 *   .showIdle()                           -> idle state with length picker + CTA
 *   .showLoading(msg?)                    -> shimmer skeletons + status line
 *   .showStreaming(text)                  -> partial paragraph w/ blinking caret
 *   .showResult({ summary, claims, quotes, category, lengthLabel })
 *   .showError(msg)
 *   .close()
 *
 * Wiring is done in content.js — this file only renders + emits events.
 * Events on window: 'recap:summarize' { length }, 'recap:regenerate', 'recap:translate',
 *                   'recap:save', 'recap:copy', 'recap:fact-check' { claimId | 'all' },
 *                   'recap:seek' { seconds }
 * ========================================================================= */

(function () {
  if (window.RecapPanel) return;

  const ICONS = {
    sparkle: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2l1.5 5L18 8.5 13.5 10 12 15l-1.5-5L6 8.5 10.5 7zM18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9zM5 15l.7 1.6L7.3 17.3 5.7 18l-.7 1.6L4.3 18l-1.6-.7L4.3 16.6z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    warn: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>',
    cross: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    question: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>',
    spinner: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
    quote: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 17h3l2-4V7H2v6h3zM13 17h3l2-4V7h-6v6h3z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
    save: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>',
    translate: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/></svg>',
    regen: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
  };

  const VERDICTS = {
    verified:   { label: 'Verified',    icon: ICONS.check },
    disputed:   { label: 'Disputed',    icon: ICONS.warn },
    false:      { label: 'Inaccurate',  icon: ICONS.cross },
    unverified: { label: 'Unverified',  icon: ICONS.question },
    pending:    { label: 'Checking…',   icon: ICONS.spinner },
    idle:       { label: 'Fact-check',  icon: ICONS.sparkle }
  };

  // ---------- helpers --------------------------------------------------------
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (k.startsWith('data-')) node.setAttribute(k, attrs[k]);
        else node[k] = attrs[k];
      }
    }
    for (const c of children) {
      if (c == null || c === false) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }
  function fire(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })); }
  function fmtTs(s) {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
  }
  function tsToSec(t) {
    if (typeof t === 'number') return t;
    if (!t) return 0;
    const parts = String(t).replace(/[\[\]]/g, '').trim().split(':').map(n => parseInt(n, 10));
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
    if (parts.length === 2) return parts[0]*60 + parts[1];
    return parts[0] || 0;
  }
  function seekVideo(seconds) {
    const v = document.querySelector('video');
    if (v) { v.currentTime = seconds; v.play && v.play().catch(()=>{}); }
    fire('recap:seek', { seconds });
  }

  // ---------- root + state ---------------------------------------------------
  let root = null, panel = null, currentLength = 'normal', currentTheme = 'dark';

  function ensureRoot() {
    if (root && document.body.contains(root)) return root;
    // Mount inside ytd-watch-metadata, before #bottom-row (description) and after #above-the-fold (title + channel)
    let mount = document.getElementById('recap-mount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'recap-mount';
      const bottomRow = document.querySelector('ytd-watch-metadata #bottom-row');
      if (!bottomRow || !bottomRow.parentNode) return null;
      bottomRow.parentNode.insertBefore(mount, bottomRow);
    }
    root = el('div', { class: 'recap-root', 'data-theme': currentTheme });
    panel = el('div', { class: 'recap-panel' });
    root.appendChild(panel);
    mount.innerHTML = '';
    mount.appendChild(root);
    return root;
  }

  function setHead(category) {
    return el('div', { class: 'recap-head' },
      el('div', { class: 'recap-brand' },
        el('div', { class: 'recap-logo', html: ICONS.sparkle }),
        el('span', { class: 'recap-name' }, 'Recap'),
        category ? el('span', { class: 'recap-tag' }, category) : null
      ),
      el('div', { class: 'recap-head-actions' },
        el('button', { class: 'recap-icon-btn', title: 'Close', html: ICONS.close, onclick: () => api.close() })
      )
    );
  }

  // ---------- states ---------------------------------------------------------
  function renderIdle() {
    ensureRoot();
    panel.setAttribute('data-state', 'idle');
    panel.innerHTML = '';
    panel.appendChild(setHead());

    const lengthBtn = (id, label) => el('button', {
      class: 'recap-len' + (currentLength === id ? ' on' : ''),
      onclick: (e) => {
        currentLength = id;
        panel.querySelectorAll('.recap-len').forEach(b => b.classList.remove('on'));
        e.currentTarget.classList.add('on');
      }
    }, label);

    panel.appendChild(el('div', { class: 'recap-idle' },
      el('div', { class: 'recap-idle-text' },
        el('h3', { class: 'recap-idle-title' }, 'Generate a video summary'),
        el('p', { class: 'recap-idle-sub' }, 'Recap analyzes the transcript and pulls out key points, quotes and verifiable claims.')
      ),
      el('div', { class: 'recap-cta-row' },
        el('button', {
          class: 'recap-cta',
          html: ICONS.sparkle + '<span>Summarize video</span>',
          onclick: () => fire('recap:summarize', { length: currentLength })
        }),
        el('div', { class: 'recap-len-pick' },
          lengthBtn('tldr', 'TL;DR'),
          lengthBtn('normal', 'Normal'),
          lengthBtn('detailed', 'Detailed')
        )
      )
    ));
  }

  function renderLoading(statusMsg) {
    ensureRoot();
    panel.setAttribute('data-state', 'loading');
    panel.innerHTML = '';
    panel.appendChild(setHead());
    panel.appendChild(el('div', { class: 'recap-loading' },
      el('div', { class: 'recap-load-stripe' }, el('span', { class: 'recap-stripe-fill' })),
      el('div', { class: 'recap-load-rows' },
        el('span', { class: 'recap-skel', style: 'width: 92%' }),
        el('span', { class: 'recap-skel', style: 'width: 78%' }),
        el('span', { class: 'recap-skel', style: 'width: 88%' }),
        el('span', { class: 'recap-skel', style: 'width: 60%' })
      ),
      el('div', { class: 'recap-load-foot' },
        el('span', { class: 'recap-spinner' }),
        el('span', { class: 'recap-load-status' }, statusMsg || 'Reading transcript…')
      )
    ));
  }

  function renderStreaming(text) {
    ensureRoot();
    if (panel.getAttribute('data-state') !== 'streaming') {
      panel.setAttribute('data-state', 'streaming');
      panel.innerHTML = '';
      panel.appendChild(setHead());
      const body = el('div', { class: 'recap-loading' },
        el('div', { class: 'recap-load-stripe' }, el('span', { class: 'recap-stripe-fill' })),
        el('p', { class: 'recap-stream' },
          el('span', { class: 'recap-stream-text' }, text || ''),
          el('span', { class: 'recap-caret' })
        ),
        el('div', { class: 'recap-load-foot' },
          el('span', { class: 'recap-spinner' }),
          el('span', { class: 'recap-load-status' }, 'Generating summary…')
        )
      );
      panel.appendChild(body);
    } else {
      const t = panel.querySelector('.recap-stream-text');
      if (t) t.textContent = text || '';
    }
  }

  // ---------- result / claims ------------------------------------------------
  // claims: [{ id, text, ts, verdict?, note?, sources?: [{name, domain, date}] }]
  // quotes: [{ text, speaker?, role?, ts? }]
  function renderResult({ summary, claims, quotes, category, lengthLabel }) {
    ensureRoot();
    panel.setAttribute('data-state', 'done');
    panel.innerHTML = '';
    panel.appendChild(setHead(category));

    // Summary section
    panel.appendChild(el('section', { class: 'recap-section' },
      el('div', { class: 'recap-sec-head' },
        el('h4', { class: 'recap-sec-title' }, lengthLabel || 'Summary'),
        el('div', { class: 'recap-sec-actions' },
          el('button', { class: 'recap-mini', html: ICONS.copy + '<span>Copy</span>', onclick: () => {
            navigator.clipboard.writeText(summary || '').then(() => flash(this));
            fire('recap:copy');
          }}),
          el('button', { class: 'recap-mini', html: ICONS.save + '<span>Save</span>', onclick: () => fire('recap:save') }),
          el('button', { class: 'recap-mini', html: ICONS.translate + '<span>Translate</span>', onclick: () => fire('recap:translate') })
        )
      ),
      el('p', { class: 'recap-paragraph' }, summary || '')
    ));

    // Claims (only if news/info-style content)
    if (claims && claims.length) {
      const verifiedCount = claims.filter(c => c.verdict === 'verified').length;
      const disputedCount = claims.filter(c => c.verdict === 'disputed').length;
      const falseCount = claims.filter(c => c.verdict === 'false').length;
      const pendingCount = claims.filter(c => !c.verdict || c.verdict === 'idle' || c.verdict === 'pending').length;

      const claimsSection = el('section', { class: 'recap-section', id: 'recap-claims-section' },
        el('div', { class: 'recap-sec-head' },
          el('h4', { class: 'recap-sec-title' }, 'Verifiable claims',
            el('span', { class: 'recap-claim-count' }, String(claims.length))
          ),
          el('button', {
            class: 'recap-fcheck' + (pendingCount === 0 ? ' done' : ''),
            id: 'recap-fcheck-all',
            html: (pendingCount === 0 ? ICONS.check : ICONS.sparkle) + '<span>' + (pendingCount === 0 ? 'Re-check all' : 'Fact-check all') + '</span>',
            onclick: () => fire('recap:fact-check', { claimId: 'all' })
          })
        )
      );

      // tally pills (only if some have been checked)
      if (verifiedCount + disputedCount + falseCount > 0) {
        const tally = el('div', { class: 'recap-tally' });
        if (verifiedCount) tally.appendChild(el('span', { class: 'recap-tally-pill', html: ICONS.check + ` ${verifiedCount} verified` }));
        if (disputedCount) tally.appendChild(el('span', { class: 'recap-tally-pill warn', html: ICONS.warn + ` ${disputedCount} disputed` }));
        if (falseCount) tally.appendChild(el('span', { class: 'recap-tally-pill bad', html: ICONS.cross + ` ${falseCount} inaccurate` }));
        if (pendingCount) tally.appendChild(el('span', { class: 'recap-tally-pill neutral' }, `${pendingCount} unchecked`));
        claimsSection.appendChild(tally);
      }

      const list = el('div', { class: 'recap-claims' });
      claims.forEach(c => list.appendChild(renderClaim(c)));
      claimsSection.appendChild(list);
      panel.appendChild(claimsSection);
    }

    // Quotes
    if (quotes && quotes.length) {
      const quotesEl = el('div', { class: 'recap-quotes' });
      quotes.forEach(q => {
        quotesEl.appendChild(el('figure', { class: 'recap-quote' },
          el('span', { html: ICONS.quote }),
          el('blockquote', null, '"' + (q.text || '') + '"'),
          el('figcaption', null,
            q.speaker ? el('span', { class: 'recap-q-speaker' }, q.speaker) : null,
            q.role ? el('span', { class: 'recap-q-role' }, '— ' + q.role) : null,
            q.ts != null ? el('button', {
              class: 'recap-q-ts', html: ICONS.play + '<span>' + fmtTs(tsToSec(q.ts)) + '</span>',
              onclick: () => seekVideo(tsToSec(q.ts))
            }) : null
          )
        ));
      });
      panel.appendChild(el('section', { class: 'recap-section' },
        el('div', { class: 'recap-sec-head' },
          el('h4', { class: 'recap-sec-title' }, 'Key quotes',
            el('span', { class: 'recap-claim-count' }, String(quotes.length))
          )
        ),
        quotesEl
      ));
    }

    // Footer
    panel.appendChild(el('div', { class: 'recap-foot' },
      el('span', { class: 'recap-foot-l' }, 'gpt-4o-mini · ' + (lengthLabel || 'Normal')),
      el('div', null,
        el('button', { class: 'recap-foot-btn', html: ICONS.regen + '<span>Regenerate</span>', onclick: () => fire('recap:regenerate') })
      )
    ));
  }

  function renderClaim(c) {
    const verdict = c.verdict || 'idle';
    const v = VERDICTS[verdict] || VERDICTS.idle;
    const hasDetail = (c.note && c.note.length) || (c.sources && c.sources.length);
    const expanded = c._expanded || false;

    const claimEl = el('article', { class: 'recap-claim', 'data-verdict': verdict, 'data-claim-id': c.id });
    const row = el('div', { class: 'recap-claim-row' });

    if (c.ts != null) {
      row.appendChild(el('button', {
        class: 'recap-claim-ts',
        html: fmtTs(tsToSec(c.ts)),
        title: 'Jump to ' + fmtTs(tsToSec(c.ts)),
        onclick: () => seekVideo(tsToSec(c.ts))
      }));
    }

    const body = el('div', { class: 'recap-claim-body' });
    body.appendChild(el('p', { class: 'recap-claim-text' }, c.text || ''));

    const meta = el('div', { class: 'recap-claim-meta' });
    meta.appendChild(el('button', {
      class: 'recap-vrd-pill',
      'data-verdict': verdict,
      html: v.icon + '<span>' + v.label + '</span>',
      disabled: verdict === 'pending',
      onclick: () => {
        if (verdict === 'idle' || verdict === 'unverified') {
          fire('recap:fact-check', { claimId: c.id });
        } else if (hasDetail) {
          c._expanded = !c._expanded;
          rerenderClaim(c);
        }
      }
    }));

    if (hasDetail && verdict !== 'idle' && verdict !== 'pending') {
      meta.appendChild(el('button', {
        class: 'recap-claim-toggle',
        html: '<span>' + (expanded ? 'Hide sources' : `${(c.sources||[]).length} source${(c.sources||[]).length===1?'':'s'}`) + '</span><span class="recap-claim-toggle-chev' + (expanded ? ' up' : '') + '">' + ICONS.chevron + '</span>',
        onclick: () => { c._expanded = !c._expanded; rerenderClaim(c); }
      }));
    }
    body.appendChild(meta);
    row.appendChild(body);
    claimEl.appendChild(row);

    if (expanded && hasDetail) {
      const detail = el('div', { class: 'recap-claim-detail' });
      if (c.note) detail.appendChild(el('p', { class: 'recap-claim-note' }, c.note));
      if (c.sources && c.sources.length) {
        const ul = el('ul', { class: 'recap-claim-sources' });
        c.sources.forEach(s => {
          const href = s.url || (s.domain ? 'https://' + s.domain : null);
          ul.appendChild(el('li', {
            onclick: () => href && window.open(href, '_blank', 'noopener')
          },
            el('span', { class: 'recap-src-dot' }),
            el('span', { class: 'recap-src-name' }, s.name || s.domain || 'Source'),
            s.domain ? el('span', { class: 'recap-src-domain' }, s.domain) : null,
            s.date ? el('span', { class: 'recap-src-date' }, s.date) : null
          ));
        });
        detail.appendChild(ul);
      } else {
        detail.appendChild(el('p', { class: 'recap-claim-no-src' }, 'No sources returned.'));
      }
      claimEl.appendChild(detail);
    }
    return claimEl;
  }

  function rerenderClaim(c) {
    const old = panel.querySelector(`.recap-claim[data-claim-id="${c.id}"]`);
    if (!old) return;
    const fresh = renderClaim(c);
    old.replaceWith(fresh);
  }

  function renderError(msg) {
    ensureRoot();
    panel.setAttribute('data-state', 'error');
    panel.innerHTML = '';
    panel.appendChild(setHead());
    panel.appendChild(el('div', { class: 'recap-error' }, msg || 'Something went wrong.'));
    panel.appendChild(el('div', { class: 'recap-foot' },
      el('span', { class: 'recap-foot-l' }, 'Error'),
      el('button', { class: 'recap-foot-btn', html: ICONS.regen + '<span>Try again</span>', onclick: () => fire('recap:regenerate') })
    ));
  }

  function flash(node) {
    if (!node) return;
    node.style.background = 'var(--rcp-accent-soft)';
    setTimeout(() => { node.style.background = ''; }, 600);
  }

  // ---------- public API -----------------------------------------------------
  const api = {
    mount: ensureRoot,
    showIdle: renderIdle,
    showLoading: renderLoading,
    showStreaming: renderStreaming,
    showResult: renderResult,
    showError: renderError,
    setTheme(t) { currentTheme = t; if (root) root.setAttribute('data-theme', t); },
    setLength(l) { currentLength = l; },
    updateClaim(id, patch) {
      // find in current claims and rerender
      const node = panel && panel.querySelector(`.recap-claim[data-claim-id="${id}"]`);
      if (!node) return;
      // we don't keep state here; caller must re-call showResult with merged data.
    },
    close() {
      const m = document.getElementById('recap-mount');
      if (m) m.remove();
      root = panel = null;
    }
  };

  window.RecapPanel = api;
})();
