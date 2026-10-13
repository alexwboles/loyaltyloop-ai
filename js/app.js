/* LoyaltyLoop AI — UI wiring.
 * All business logic lives in js/logic.js (loaded first, exposes globals in
 * the browser). This file only wires DOM events, renders results, and
 * persists member data to localStorage.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'loyaltyloop.members.v1';

  /* ---------- tiny helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(id, fallback) {
    var v = parseFloat($(id).value);
    return isFinite(v) ? v : fallback;
  }
  function fmtLastVisit(iso) {
    if (!iso) return 'no visits yet';
    try {
      var d = new Date(iso);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return 'recently'; }
  }
  function relTime(iso) {
    if (!iso) return 'never';
    var ms = Date.now() - new Date(iso).getTime();
    if (!(ms >= 0)) return 'just now';
    var mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' hr ago';
    var days = Math.floor(hrs / 24);
    if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago');
    var months = Math.floor(days / 30);
    return months + (months === 1 ? ' month ago' : ' months ago');
  }

  /* ---------- tabs ---------- */
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('.tab-btn'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.tab-section'));
  var TAB_META = {
    overview: { eyebrow: 'Loyalty dashboard', title: 'Good morning, boss.' },
    program: { eyebrow: 'Program studio', title: 'Design your program' },
    economics: { eyebrow: 'Program studio', title: 'Check the economics' },
    members: { eyebrow: 'Members', title: 'Your regulars' },
    print: { eyebrow: 'Print & hand out', title: 'Cards on the counter' }
  };

  function showTab(name) {
    tabButtons.forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    sections.forEach(function (s) { s.classList.toggle('active', s.id === 'section-' + name); });
    var meta = TAB_META[name] || TAB_META.overview;
    var eb = $('topbar-eyebrow'), tt = $('topbar-title');
    if (eb) eb.textContent = meta.eyebrow;
    if (tt) tt.textContent = meta.title;
    if (name === 'overview') renderOverview();
  }
  tabButtons.forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.dataset.tab); });
  });
  window.__showTab = showTab;

  /* ---------- 1. recommender ---------- */
  function renderRecommender() {
    var type = $('biz-type').value;
    var rec = recommendProgram(type);
    var html = '<div class="result stamp-result"><span class="stamp-seal">Recommended<br>for you</span>';
    html += '<span class="rec-badge">' + esc(rec.structureName) + '</span>';
    if (rec.fallback) {
      html += '<p><em>Heads up:</em> we didn\'t recognize that business type, so here\'s our safe default.</p>';
    }
    html += '<p>' + esc(rec.rationale) + '</p>';
    html += '<dl class="kv"><dt>How members earn</dt><dd>' + esc(rec.earn) + '</dd>' +
            '<dt>How they redeem</dt><dd>' + esc(rec.redeem) + '</dd></dl>';
    html += '</div>';
    $('rec-result').innerHTML = html;
    window.__lastRec = rec;
  }
  $('rec-btn').addEventListener('click', renderRecommender);

  /* ---------- 2. economics calculator ---------- */
  function renderEconomics() {
    var r = calculateEconomics({
      avgTicket: num('ec-ticket', 0),
      visitsPerMonth: num('ec-visits', 0),
      marginPct: num('ec-margin', 0),
      rewardCost: num('ec-cost', 0),
      rewardEveryN: num('ec-everyn', 10),
      visitLiftPct: num('ec-lift', 0)
    });
    var cls = r.netBenefit > 0.005 ? 'good' : (r.netBenefit < -0.005 ? 'bad' : 'neutral');
    var beText = r.breakEvenLiftPct === Infinity ? 'unreachable' : r.breakEvenLiftPct.toFixed(2) + '%';
    var html = '<div class="result"><dl class="kv">' +
      '<dt>Reward cost / member / month</dt><dd>' + esc(fmtMoney(r.rewardCostPerMemberMonth)) + '</dd>' +
      '<dt>Extra gross profit from lift</dt><dd>' + esc(fmtMoney(r.extraGrossProfit)) + '</dd>' +
      '<dt>Net benefit / member / month</dt><dd><strong>' + esc(fmtMoney(r.netBenefit)) + '</strong></dd>' +
      '<dt>Break-even visit lift</dt><dd>' + esc(beText) + '</dd></dl>' +
      '<div class="verdict ' + cls + '">' + esc(r.verdict) + '</div></div>';
    $('ec-result').innerHTML = html;
  }
  $('ec-btn').addEventListener('click', renderEconomics);

  /* ---------- 3. printable punch card + signup sheet ---------- */
  function renderPrintable() {
    var name = $('pc-name').value.trim() || 'Your Business';
    var n = Math.max(1, Math.round(num('pc-punches', 10)));
    var reward = $('pc-reward').value.trim() || 'Free reward';
    var spec = punchCardSpec(name, n, reward);

    var cells = spec.cells.map(function (c) {
      return '<div class="punch-cell">' + c + '</div>';
    }).join('');

    var signupRows = '';
    for (var i = 1; i <= 12; i++) {
      signupRows += '<tr><td>' + i + '</td><td></td><td></td><td></td></tr>';
    }

    var html =
      '<div class="punch-card">' +
        '<h3>' + esc(spec.businessName) + '</h3>' +
        '<div class="reward-line">Loyalty Card — ' + esc(spec.rewardLabel) + '</div>' +
        '<hr class="punch-divider">' +
        '<div class="punch-grid">' + cells + '</div>' +
        '<div class="member-line"></div>' +
        '<div class="member-line-label">Member name</div>' +
      '</div>' +
      '<h3 class="signup-title">' + esc(spec.businessName) + ' — Loyalty Signup Sheet</h3>' +
      '<p class="signup-sub">Members: please print your details so we can stamp your card at every visit.</p>' +
      '<table class="data"><thead><tr><th style="width:40px">#</th><th>Name</th>' +
      '<th>Phone</th><th>Email</th></tr></thead><tbody>' + signupRows + '</tbody></table>';

    $('print-area').innerHTML = html;
  }
  $('pc-btn').addEventListener('click', renderPrintable);
  $('pc-print').addEventListener('click', function () {
    renderPrintable();
    window.print();
  });

  /* ---------- 4. member tracker (localStorage) ---------- */
  function loadMembers() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveMembers(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function findMember(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function stampStrip(m) {
    var per = Math.max(1, m.punchesPerCard || 10);
    var filled = m.visits % per;
    var cells = '';
    for (var i = 0; i < per; i++) {
      cells += '<span class="punch-mini' + (i < filled ? ' filled' : '') + '"></span>';
    }
    return '<span class="stamp-mini-card" aria-label="' + filled + ' of ' + per + ' punches">' +
      cells + '<span class="punch-frac">' + filled + '/' + per + '</span></span>';
  }

  var memberSearch = '';
  var memberSort = 'newest';

  /* ---------- overview dashboard (Square-Loyalty style) ---------- */
  function renderOverview() {
    var all = loadMembers();
    var empty = $('ov-empty');
    var hasData = all.length > 0;
    empty.style.display = hasData ? 'none' : 'block';

    var totalVisits = 0, earned = 0, redeemed = 0, unredeemed = 0;
    var newCount = 0;
    var cutoff = Date.now() - 30 * 86400000;
    all.forEach(function (m) {
      totalVisits += m.visits || 0;
      earned += rewardsEarned(m);
      redeemed += Number.isFinite(Number(m.redeemed)) ? Number(m.redeemed) : 0;
      unredeemed += rewardsAvailable(m);
      try {
        if (m.joinedAt && new Date(m.joinedAt).getTime() >= cutoff) newCount++;
      } catch (e) {}
    });

    $('ov-members').textContent = String(all.length);
    $('ov-members-sub').textContent = newCount ? '+' + newCount + ' in the last 30 days' : 'enrolled since day one';
    $('ov-visits').textContent = String(totalVisits);
    $('ov-visits-sub').textContent = all.length ? 'avg ' + (totalVisits / all.length).toFixed(1) + ' per member' : '';
    $('ov-earned').textContent = String(earned);
    $('ov-earned-sub').textContent = unredeemed ? unredeemed + ' still unredeemed' : (earned ? 'all redeemed — nice' : '');
    $('ov-redeemed').textContent = String(redeemed);
    $('ov-redeemed-sub').textContent = earned ? Math.round((redeemed / earned) * 100) + '% redemption rate' : '';

    // top members
    var top = sortMembers(all.slice(), 'visits').slice(0, 5);
    var maxV = top.length ? (top[0].visits || 0) : 0;
    $('ov-top').innerHTML = top.length ? top.map(function (m, i) {
      var pct = maxV ? Math.round(((m.visits || 0) / maxV) * 100) : 0;
      return '<div class="top-row' + (i === 0 ? ' first' : '') + '">' +
        '<span class="top-rank">' + (i + 1) + '</span>' +
        '<span class="top-name"><strong>' + esc(m.name) + '</strong>' +
        '<span>' + (m.mode === 'points' ? Math.floor(Math.max(0, Number(m.points) || 0)) + ' pts' : (m.visits % Math.max(1, m.punchesPerCard || 10)) + '/' + Math.max(1, m.punchesPerCard || 10) + ' punches') + ' · last visit ' + esc(relTime(m.lastVisitAt)) + '</span></span>' +
        '<span class="top-bar"><i style="width:' + pct + '%"></i></span>' +
        '<span class="top-count">' + (m.visits || 0) + '</span>' +
      '</div>';
    }).join('') : '<p class="empty-note">Your top regulars will appear here.</p>';

    // member mix
    var c = segmentCounts(all);
    var parts = ['champion', 'regular', 'occasional', 'new', 'lapsed']
      .filter(function (k) { return c[k] > 0; })
      .map(function (k) { return '<span class="seg-badge seg-' + k + '">' + c[k] + ' ' + k + '</span>'; });
    $('ov-mix').innerHTML = parts.length ? parts.join('') : '<p class="empty-note">Segments appear once members join.</p>';

    $('ov-new').textContent = String(newCount);
    $('ov-risk').textContent = String(atRiskMembers(all, 30).length);

    // recent activity: latest visits across members
    var acts = [];
    all.forEach(function (m) {
      if (m.lastVisitAt) {
        acts.push({
          when: m.lastVisitAt,
          what: '<strong>' + esc(m.name) + '</strong> checked in — visit #' + (m.visits || 0),
          tag: 'visit', tagLabel: 'visit'
        });
        var avail = rewardsAvailable(m);
        if (avail > 0) {
          acts.push({
            when: m.lastVisitAt,
            what: '<strong>' + esc(m.name) + '</strong> has ' + avail + ' reward' + (avail === 1 ? '' : 's') + ' waiting',
            tag: 'reward', tagLabel: 'reward'
          });
        }
      }
    });
    acts.sort(function (a, b) { return new Date(b.when) - new Date(a.when); });
    $('ov-activity').innerHTML = acts.length ? acts.slice(0, 8).map(function (a) {
      return '<div class="act-row"><span class="act-when">' + esc(fmtLastVisit(a.when)) + '</span>' +
        '<span class="act-what">' + a.what + '</span>' +
        '<span class="act-tag ' + a.tag + '">' + a.tagLabel + '</span></div>';
    }).join('') : '<p class="empty-note">Visits you stamp will stream in here.</p>';

    // member count in nav
    var count = $('member-count');
    if (count) count.textContent = all.length ? String(all.length) : '';
  }

  $('ov-goto-winback').addEventListener('click', function () { showTab('members'); });
  $('ov-add-first').addEventListener('click', function () { showTab('members'); });

  /* ---------- member list ---------- */
  function renderMembers() {
    var all = loadMembers();
    var box = $('member-list');
    var count = $('member-count');
    if (count) count.textContent = all.length ? String(all.length) : '';
    var list = sortMembers(searchMembers(all, memberSearch), memberSort);
    if (!all.length) {
      box.innerHTML = '<p class="empty-note">No members yet — add your first member above.</p>';
      return;
    }
    if (!list.length) {
      box.innerHTML = '<p class="empty-note">No members match "' + esc(memberSearch) + '". Try a different search.</p>';
      return;
    }
    var html = renderSegmentSummary(all) + list.map(function (m) {
      var earned = rewardsEarned(m);
      var available = rewardsAvailable(m);
      var redeemed = Number.isFinite(Number(m.redeemed)) ? Number(m.redeemed) : 0;
      var prog = visitsToNextReward(m);
      var seg = segmentMember(m);
      var isPoints = m.mode === 'points';
      var rpLabel = isPoints
        ? Math.floor(Math.max(0, Number(m.points) || 0)) + '/' + prog.perCard + ' pts to next reward'
        : prog.intoCard + '/' + prog.perCard + ' to next reward';
      var rpTitle = isPoints
        ? prog.toGo + ' points to the next reward'
        : prog.toGo + ' visit' + (prog.toGo === 1 ? '' : 's') + ' to the next reward';
      return '<div class="member-row" data-id="' + esc(m.id) + '">' +
        '<span class="member-name">' + esc(m.name) +
        ' <span class="seg-badge seg-' + seg + '">' + seg + '</span>' +
        ' <span class="mode-badge mode-' + (isPoints ? 'points' : 'punches') + '">' +
        (isPoints ? 'points' : 'punches') + '</span></span>' +
        (isPoints
          ? '<span class="points-pill" title="Points balance">' + esc(String(Math.floor(Math.max(0, Number(m.points) || 0)))) + ' pts</span>'
          : stampStrip(m)) +
        '<span class="member-stats">' + m.visits + ' visit' + (m.visits === 1 ? '' : 's') +
        ' · last visit: ' + esc(fmtLastVisit(m.lastVisitAt)) +
        (earned ? ' &middot; <span class="reward-pill">' + earned + ' reward' + (earned === 1 ? '' : 's') + ' earned</span>' : '') +
        (redeemed ? ' <span class="redeemed-note">' + redeemed + ' redeemed</span>' : '') +
        '</span>' +
        '<span class="reward-progress" title="' + esc(rpTitle) + '">' +
        '<span class="rp-track"><span class="rp-fill" style="width:' + prog.pct + '%"></span></span>' +
        '<span class="rp-label">' + esc(rpLabel) + '</span></span>' +
        '<span class="member-actions">' +
        (isPoints
          ? '<span class="purchase-wrap"><input class="purchase-amt" type="number" min="0" step="0.01" placeholder="Spend $" ' +
            'aria-label="Purchase amount for ' + esc(m.name) + '"><button class="btn small purchase-btn" type="button">Log purchase</button></span>'
          : '<button class="btn small visit-btn" type="button">+1 visit</button>') +
        '<button class="btn small redeem-btn" type="button"' + (available < 1 ? ' disabled' : '') +
        ' title="' + (available < 1 ? 'No rewards to redeem yet' : available + ' reward(s) ready to redeem') + '">' +
        'Redeem' + (available > 0 ? ' (' + available + ')' : '') + '</button>' +
        '<button class="btn small secondary remove-btn" type="button">Remove</button>' +
        '</span></div>';
    }).join('');
    box.innerHTML = html + renderWinBack(all);
    wireNudgeButtons(box);

    Array.prototype.forEach.call(box.querySelectorAll('.visit-btn'), function (btn) {
      btn.addEventListener('click', function () {
        var list2 = loadMembers();
        var m = findMember(list2, btn.closest('.member-row').dataset.id);
        if (!m) return;
        var res = logVisit(m);
        saveMembers(list2);
        renderMembers();
        if (res.rewardEarnedNow) {
          showToast(m.name + ' just earned a reward');
        }
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll('.purchase-btn'), function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.member-row');
        var amtInput = row.querySelector('.purchase-amt');
        var spend = parseFloat(amtInput.value);
        if (!isFinite(spend) || spend <= 0) {
          showToast('Enter a purchase amount first.');
          amtInput.focus();
          return;
        }
        var list2 = loadMembers();
        var m = findMember(list2, row.dataset.id);
        if (!m) return;
        try {
          var res = logPurchase(m, spend);
        } catch (e) {
          showToast(e.message || 'Could not log purchase.');
          return;
        }
        saveMembers(list2);
        renderMembers();
        showToast(m.name + ' earned ' + res.pointsEarned + ' pts ($' + res.spend.toFixed(2) + ')' +
          (res.rewardEarnedNow ? ' — reward unlocked!' : ''));
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll('.redeem-btn'), function (btn) {
      btn.addEventListener('click', function () {
        var list2 = loadMembers();
        var m = findMember(list2, btn.closest('.member-row').dataset.id);
        if (!m) return;
        try {
          redeemReward(m);
        } catch (e) {
          showToast('No rewards available to redeem yet.');
          return;
        }
        saveMembers(list2);
        renderMembers();
        showToast('Reward redeemed for ' + m.name + ' — enjoy!');
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll('.remove-btn'), function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.closest('.member-row').dataset.id;
        saveMembers(loadMembers().filter(function (m) { return m.id !== id; }));
        renderMembers();
      });
    });
  }

  function renderSegmentSummary(all) {
    if (!all.length) return '';
    var c = segmentCounts(all);
    var parts = ['champion', 'regular', 'occasional', 'new', 'lapsed']
      .filter(function (k) { return c[k] > 0; })
      .map(function (k) { return '<span class="seg-badge seg-' + k + '">' + c[k] + ' ' + k + '</span>'; });
    return '<div class="segment-summary">Member mix: ' + parts.join(' ') + '</div>';
  }

  function renderWinBack(all) {
    var risk = atRiskMembers(all, 30);
    if (!risk.length) return '';
    var rows = risk.slice(0, 10).map(function (x) {
      return '<div class="risk-row" data-days="' + x.daysSince + '">' +
        '<span>' + esc(x.member.name) + '</span>' +
        '<span class="muted">' + x.daysSince + ' days since last visit</span>' +
        '<button class="btn small secondary nudge-btn" type="button" data-name="' + esc(x.member.name) + '">Nudge</button>' +
        '<div class="nudge-panel" style="display:none">' +
          '<label class="nudge-label">Offer <input class="nudge-offer" type="text" value="10% off your next visit" maxlength="80"></label>' +
          '<textarea class="nudge-text" rows="4" readonly></textarea>' +
          '<div><button class="btn small nudge-copy" type="button">Copy message</button></div>' +
        '</div></div>';
    }).join('');
    return '<div class="winback"><h3>Win back (' + risk.length + ')</h3>' +
      '<p class="muted small">No visit in 30+ days — a personal nudge brings regulars back. ' +
      'Hit Nudge to draft a message, copy it, and send it however you reach them.</p>' +
      rows + (risk.length > 10 ? '<p class="muted small">+ ' + (risk.length - 10) + ' more</p>' : '') + '</div>';
  }

  function wireNudgeButtons(box) {
    Array.prototype.forEach.call(box.querySelectorAll('.nudge-btn'), function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.risk-row');
        var panel = row.querySelector('.nudge-panel');
        var showing = panel.style.display !== 'none';
        panel.style.display = showing ? 'none' : 'block';
        if (showing) return;
        var offerInput = panel.querySelector('.nudge-offer');
        var textArea = panel.querySelector('.nudge-text');
        var all = loadMembers();
        var m = null;
        for (var i = 0; i < all.length; i++) {
          if (all[i].name === btn.getAttribute('data-name')) { m = all[i]; break; }
        }
        var days = parseInt(row.getAttribute('data-days'), 10) || 30;
        var draft = function () {
          textArea.value = winBackMessage(m, days, offerInput.value, $('pc-name').value);
        };
        offerInput.addEventListener('input', draft);
        draft();
        panel.querySelector('.nudge-copy').addEventListener('click', function () {
          copyText(textArea.value, function () { showToast('Message copied — paste it into a text or email.'); });
        }, { once: true });
      });
    });
  }

  function copyText(text, done) {
    var finish = function () { if (done) done(); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(finish, function () { legacyCopy(text); finish(); });
    } else {
      legacyCopy(text);
      finish();
    }
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) { /* clipboard unavailable */ }
  }

  function downloadCSV() {
    var csv = membersToCSV(loadMembers());
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'loyaltyloop-members.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  function showToast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.style.display = 'block';
    setTimeout(function () { t.style.display = 'none'; }, 2600);
  }

  $('member-add-btn').addEventListener('click', function () {
    var nameInput = $('member-name');
    var name = nameInput.value.trim();
    if (!name) { showToast('Please enter a member name.'); nameInput.focus(); return; }
    var mode = $('member-mode') ? $('member-mode').value : 'punches';
    var list = loadMembers();
    try {
      list.push(createMember(name, {
        punchesPerCard: Math.max(1, Math.round(num('member-punches', 10))),
        mode: mode,
        pointsPerReward: Math.max(1, Math.round(num('member-ppreward', 100)))
      }));
    } catch (e) {
      showToast('Could not add member.');
      return;
    }
    saveMembers(list);
    nameInput.value = '';
    renderMembers();
    showToast(name + ' joined the ' + (mode === 'points' ? 'points' : 'punch-card') + ' program.');
  });

  var modeSel = $('member-mode');
  if (modeSel) {
    var pprField = $('member-ppreward-wrap');
    var syncMode = function () {
      var isPts = modeSel.value === 'points';
      if (pprField) pprField.style.display = isPts ? '' : 'none';
      var punchesField = $('member-punches-wrap');
      if (punchesField) punchesField.style.display = isPts ? 'none' : '';
    };
    modeSel.addEventListener('change', syncMode);
    syncMode();
  }

  var importInput = $('member-import-file');
  if (importInput) {
    $('member-import-btn').addEventListener('click', function () { importInput.click(); });
    importInput.addEventListener('change', function () {
      var file = importInput.files && importInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var res = membersFromCSV(reader.result);
          if (!res.members.length) {
            showToast('No member names found in that file.');
            return;
          }
          var list = loadMembers();
          var before = list.length;
          res.members.forEach(function (m) { list.push(m); });
          saveMembers(list);
          renderMembers();
          showToast('Imported ' + (list.length - before) + ' member' +
            (list.length - before === 1 ? '' : 's') +
            (res.skipped ? ' (' + res.skipped + ' blank rows skipped)' : '') + '.');
        } catch (e) {
          showToast('Could not import that file.');
        }
        importInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  $('member-search').addEventListener('input', function () {
    memberSearch = $('member-search').value;
    renderMembers();
  });
  $('member-sort').addEventListener('change', function () {
    memberSort = $('member-sort').value;
    renderMembers();
  });
  $('member-csv-btn').addEventListener('click', function () {
    if (!loadMembers().length) { showToast('No members to export yet.'); return; }
    downloadCSV();
  });

  /* ---------- boot ---------- */
  (function populateTypes() {
    var sel = $('biz-type');
    BUSINESS_TYPES.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      sel.appendChild(opt);
    });
  })();

  $('ec-ticket').value = '6.50';
  $('ec-visits').value = '8';
  $('ec-margin').value = '65';
  $('ec-cost').value = '4.50';
  $('ec-everyn').value = '10';
  $('ec-lift').value = '12';
  $('pc-punches').value = '10';
  $('pc-reward').value = 'Free drink';

  showTab('overview');
  renderMembers();
})();
