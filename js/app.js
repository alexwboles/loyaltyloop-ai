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
    referrals: { eyebrow: 'Refer & grow', title: 'Referrals turn regulars into recruiters' },
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
    if (name === 'members') renderMembers();
    if (name === 'referrals') renderReferralAll();
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
    var name = $('pc-name').value.trim() || (refState.business || '').trim() || 'Your Business';
    var n = Math.max(1, Math.round(num('pc-punches', 10)));
    var reward = $('pc-reward').value.trim() || 'Free reward';
    var spec = punchCardSpec(name, n, reward);

    var cells = spec.cells.map(function (c) {
      return '<div class="punch-cell">' + c + '</div>';
    }).join('');

    // Punch card + referral code in one print kit.
    var refStrip = '';
    var includeRef = $('pc-include-ref') && $('pc-include-ref').checked;
    if (includeRef) {
      var rule = currentReferralRule();
      var bp = Math.max(1, Math.round(Number(rule.bonusPunches) || 2));
      refStrip =
        '<div class="ref-strip"><strong>Refer friends, earn bonus punches.</strong><br>' +
        'Friends get ' + esc(rule.giveText) +
        (rule.minPurchase > 0 ? ' (min purchase ' + esc(money(rule.minPurchase)) + ')' : '') +
        ' — you earn ' + bp + ' bonus punch' + (bp === 1 ? '' : 'es') + ' for every friend who buys.<br>' +
        '<span class="ref-code-line">Your share code: ' + esc(normalizePrefix(name) + '-XXXX') + '</span> ' +
        '<span class="muted small">(every member gets their own code — see the Members tab)</span></div>';
    }

    var signupHead = '<tr><th style="width:40px">#</th><th>Name</th><th>Phone</th><th>Email</th>' +
      (includeRef ? '<th>Referred by (code)</th>' : '') + '</tr>';
    var signupRows = '';
    for (var i = 1; i <= 12; i++) {
      signupRows += '<tr><td>' + i + '</td><td></td><td></td><td></td>' +
        (includeRef ? '<td></td>' : '') + '</tr>';
    }

    var html =
      '<div class="punch-card">' +
        '<h3>' + esc(spec.businessName) + '</h3>' +
        '<div class="reward-line">Loyalty Card — ' + esc(spec.rewardLabel) + '</div>' +
        '<hr class="punch-divider">' +
        '<div class="punch-grid">' + cells + '</div>' +
        '<div class="member-line"></div>' +
        '<div class="member-line-label">Member name</div>' +
        refStrip +
      '</div>' +
      '<h3 class="signup-title">' + esc(spec.businessName) + ' — Loyalty Signup Sheet</h3>' +
      '<p class="signup-sub">Members: please print your details so we can stamp your card at every visit.</p>' +
      '<table class="data"><thead>' + signupHead + '</thead><tbody>' + signupRows + '</tbody></table>';

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

    // referral KPIs — same roster, merged engine
    var rs = computeStats(refState.referrals, {});
    $('ov-refsent').textContent = String(rs.totalSent);
    $('ov-refcompleted').textContent = String(rs.completed + rs.rewarded);
    $('ov-refsent-sub').textContent = rs.totalSent ? rs.conversionRate + '% convert' : '';
    $('ov-refcompleted-sub').textContent = rs.rewardsOwedCount ? rs.rewardsOwedCount + ' awaiting reward' : '';

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
    // referral events feed the same activity stream
    refState.referrals.forEach(function (r) {
      acts.push({
        when: r.createdAt,
        what: '<strong>' + esc(r.referrerName) + '</strong> referred <strong>' + esc(r.friendName) + '</strong> <span class="ref-code-chip">' + esc(r.code) + '</span>',
        tag: 'referral', tagLabel: 'referral'
      });
      (r.history || []).forEach(function (h) {
        if (h.status === 'completed') {
          acts.push({
            when: h.at,
            what: '<strong>' + esc(r.friendName) + '</strong>\u2019s referral completed — bonus punches to <strong>' + esc(r.referrerName) + '</strong>',
            tag: 'referral', tagLabel: 'referral'
          });
        }
        if (h.status === 'rewarded') {
          acts.push({
            when: h.at,
            what: 'Referral reward logged for <strong>' + esc(r.referrerName) + '</strong>',
            tag: 'reward', tagLabel: 'reward'
          });
        }
      });
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
    // Every member gets a personal referral code (lazy, persisted once).
    var codesDirty = false;
    all.forEach(function (m) {
      if (!m.referralCode) { m.referralCode = personalReferralCode(m.name); codesDirty = true; }
    });
    if (codesDirty) saveMembers(all);
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
      var refSent = Number(m.referralsSent) || 0;
      var refDone = Number(m.referralsCompleted) || 0;
      var bonusPunchCount = Math.max(0, Math.floor(Number(m.bonusPunches) || 0));
      var bonusPts = Math.max(0, Number(m.bonusPoints) || 0);
      var bonusLabel = '';
      if (isPoints && bonusPts > 0) bonusLabel = '+' + bonusPts + ' bonus pts';
      else if (!isPoints && bonusPunchCount > 0) {
        bonusLabel = '+' + bonusPunchCount + ' bonus punch' + (bonusPunchCount === 1 ? '' : 'es');
      }
      var refLine =
        '<span class="ref-line">' +
        '<span class="ref-code-chip" title="Personal referral code — friends sign up with this">' + esc(m.referralCode || '') + '</span>' +
        '<button class="btn small secondary ref-copy-btn" type="button" data-code="' + esc(m.referralCode || '') + '">Copy code</button>' +
        '<button class="btn small secondary ref-invite-btn" type="button" data-id="' + esc(m.id) + '">Copy invite</button>' +
        (bonusLabel ? '<span class="bonus-badge">' + esc(bonusLabel) + '</span>' : '') +
        (refSent ? '<span class="muted small">' + refSent + ' referral' + (refSent === 1 ? '' : 's') + ' sent · ' + refDone + ' completed</span>' : '') +
        (m.referredBy ? '<span class="ref-by">referred by ' + esc(m.referredBy) + '</span>' : '') +
        '</span>';
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
        refLine +
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
    wireReferralRowButtons(box);

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
        '<button class="btn small secondary nudge-btn" type="button" data-id="' + esc(x.member.id) + '">Nudge</button>' +
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
        var m = findMember(loadMembers(), btn.getAttribute('data-id'));
        var days = parseInt(row.getAttribute('data-days'), 10) || 30;
        var draft = function () {
          textArea.value = winBackMessage(m, days, offerInput.value, $('pc-name').value);
        };
        // Wire the panel's inner controls only once per render — reopening the
        // panel must not stack duplicate listeners, and the copy button must
        // keep working on every click (not just the first per open).
        if (!panel.getAttribute('data-wired')) {
          panel.setAttribute('data-wired', '1');
          offerInput.addEventListener('input', draft);
          panel.querySelector('.nudge-copy').addEventListener('click', function () {
            copyText(textArea.value, function () { showToast('Message copied — paste it into a text or email.'); });
          });
        }
        draft();
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

  /* ---------- 5. referral engine (merged from ReferralPilot AI) ---------- */
  var REF_LS = {
    codes: 'loyaltyloop.codes.v1',
    batches: 'loyaltyloop.batches.v1',
    ledger: 'loyaltyloop.ledger.v1',
    avgValue: 'loyaltyloop.avgvalue.v1',
    rule: 'loyaltyloop.rule.v1',
    referrals: 'loyaltyloop.referrals.v1',
    business: 'loyaltyloop.business.v1',
    templates: 'loyaltyloop.templates.v1'
  };

  function refLoad(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function refSave(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* One-time migration: carry ReferralPilot data (rp_*) into the merged keys.
   * Only fills keys the merged app hasn't written yet — never overwrites. */
  function migrateLegacyReferralData() {
    var legacy = {
      codes: 'rp_codes', batches: 'rp_batches', ledger: 'rp_ledger',
      avgValue: 'rp_avgvalue', rule: 'rp_rule', referrals: 'rp_referrals',
      business: 'rp_business', templates: 'rp_templates'
    };
    Object.keys(legacy).forEach(function (k) {
      try {
        if (localStorage.getItem(REF_LS[k]) === null) {
          var v = localStorage.getItem(legacy[k]);
          if (v !== null) localStorage.setItem(REF_LS[k], v);
        }
      } catch (e) {}
    });
  }
  migrateLegacyReferralData();

  var refState = {
    codes: refLoad(REF_LS.codes, []),
    batches: refLoad(REF_LS.batches, []),
    ledger: refLoad(REF_LS.ledger, []),
    rule: refLoad(REF_LS.rule, null),
    referrals: refLoad(REF_LS.referrals, []),
    business: refLoad(REF_LS.business, ''),
    templates: refLoad(REF_LS.templates, null)
  };
  if (!refState.templates) {
    refState.templates = { sms: DEFAULT_TEMPLATES.sms, email: DEFAULT_TEMPLATES.email };
    refSave(REF_LS.templates, refState.templates);
  }

  /* Rebuild the rule when storage holds the legacy ReferralPilot shape
   * (give/get, no bonusPunches) or corrupt data. */
  function currentReferralRule() {
    var r = refState.rule;
    if (!r || r.bonusPunches == null || !r.summary) {
      r = buildReferralRule({
        give: r && isFinite(Number(r.give)) ? Number(r.give) : 10,
        type: r ? r.type : 'dollars',
        minPurchase: r && isFinite(Number(r.minPurchase)) ? Number(r.minPurchase) : 25,
        bonusPunches: r && isFinite(Number(r.bonusPunches)) ? Number(r.bonusPunches) : 2
      });
      refState.rule = r;
      refSave(REF_LS.rule, r);
    }
    return r;
  }

  function downloadTextFile(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  function refStatusLabel(s) {
    return s === 'sent' ? 'Sent' : s === 'completed' ? 'Completed' : 'Rewarded';
  }

  /* ---------- referral stats band ---------- */
  function renderReferralStats() {
    var s = computeStats(refState.referrals, {});
    $('rf-stat-sent').textContent = s.totalSent;
    $('rf-stat-completed').textContent = s.completed + s.rewarded;
    $('rf-stat-rewarded').textContent = s.rewarded;
    $('rf-stat-conversion').textContent = s.conversionRate + '%';
    $('rf-stat-owed').textContent = s.rewardsOwedCount;
  }

  /* ---------- referral code inventory ---------- */
  function renderReferralCodes() {
    var list = $('ref-code-list');
    list.innerHTML = '';
    var today = new Date().toISOString().slice(0, 10);
    function codeRow(code, exp) {
      var li = document.createElement('li');
      li.className = 'code-row';
      var span = document.createElement('span');
      span.textContent = code;
      li.appendChild(span);
      if (exp) {
        var flag = document.createElement('span');
        var dead = exp < today;
        flag.className = 'badge ' + (dead ? 'badge-expired' : 'badge-exp');
        flag.textContent = dead ? 'expired ' + exp : 'expires ' + exp;
        li.appendChild(flag);
      }
      var btn = document.createElement('button');
      btn.className = 'btn small secondary';
      btn.type = 'button';
      btn.textContent = 'Copy';
      btn.addEventListener('click', function () {
        copyText(code, function () { showToast('Code copied.'); });
      });
      li.appendChild(btn);
      return li;
    }
    var batched = {};
    refState.batches.forEach(function (b) {
      var head = document.createElement('li');
      head.className = 'batch-head';
      var dead = b.expiresAt && b.expiresAt < today;
      head.innerHTML = '<strong>' + esc(b.prefix) + '</strong> · ' + b.codes.length + ' codes' +
        (b.expiresAt ? ' · <span class="' + (dead ? 'exp-dead' : 'exp-ok') + '">' +
          (dead ? 'expired ' : 'expires ') + esc(b.expiresAt) + '</span>' : ' · no expiry');
      list.appendChild(head);
      b.codes.forEach(function (c) { batched[c] = true; list.appendChild(codeRow(c, b.expiresAt)); });
    });
    var legacy = refState.codes.filter(function (c) { return !batched[c]; });
    legacy.forEach(function (c) { list.appendChild(codeRow(c, null)); });
    if (!refState.batches.length && !legacy.length) {
      list.innerHTML = '<li class="empty">No codes yet — generate a batch above.</li>';
    }
    var dl = $('ref-code-datalist');
    if (dl) {
      dl.innerHTML = '';
      refState.codes.forEach(function (code) {
        var o = document.createElement('option');
        o.value = code;
        dl.appendChild(o);
      });
    }
  }

  /* ---------- referral rule ---------- */
  function readReferralRuleForm() {
    var typeEl = document.querySelector('input[name="ref-reward-type"]:checked');
    return buildReferralRule({
      give: $('ref-give').value,
      type: typeEl ? typeEl.value : 'dollars',
      minPurchase: $('ref-min').value,
      bonusPunches: $('ref-bonus').value
    });
  }

  function renderReferralRule() {
    var r = currentReferralRule();
    $('ref-rule-summary').textContent = r.summary;
    $('ref-rule-cost').textContent = money(r.costPerReferral);
    renderRefOfferPreview(r);
    renderRefTemplatePreviews();
  }

  /* Friend-offer preview: the offer as a customer sees it, rebuilt live. */
  function renderRefOfferPreview(r) {
    var box = $('ref-offer-preview');
    if (!box) return;
    r = r || currentReferralRule();
    var biz = (refState.business || '').trim() || 'Your business';
    var bp = Math.max(1, Math.round(Number(r.bonusPunches) || 2));
    function amt(v) {
      if (r.type === 'percent') return v + '% off';
      if (r.type === 'freebie') return 'a free gift';
      return money(v) + ' off';
    }
    box.innerHTML = '<div class="offer-card">' +
      '<div class="offer-eyebrow">' + esc(biz) + ' · friends with benefits</div>' +
      '<div class="offer-give">Give friends <strong>' + esc(amt(r.give)) + '</strong></div>' +
      '<div class="offer-get">You get <strong>' + bp + ' bonus punch' + (bp === 1 ? '' : 'es') + '</strong> for every friend who buys</div>' +
      (r.minPurchase > 0 ? '<div class="offer-fine">Minimum purchase of ' + money(r.minPurchase) + ' applies.</div>' : '') +
      '<div class="offer-cta">Claim your code</div></div>';
  }

  /* ---------- referral tracker ---------- */
  function renderReferralTracker() {
    var tbody = $('ref-referral-rows');
    var q = $('ref-search') ? $('ref-search').value : '';
    var st = $('ref-status-filter') ? $('ref-status-filter').value : '';
    var list = filterReferrals(refState.referrals, q, st);
    var owedBtn = $('ref-reward-all');
    var owed = refState.referrals.filter(function (r) { return r.status === 'completed'; }).length;
    owedBtn.textContent = owed ? 'Reward all owed (' + owed + ')' : 'Reward all owed';
    owedBtn.disabled = !owed;
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">' +
        (refState.referrals.length ? 'No referrals match your search.' : 'No referrals yet — add one above.') +
        '</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    list.forEach(function (ref) {
      var i = refState.referrals.indexOf(ref);
      var tr = document.createElement('tr');
      var next = nextStatus(ref);
      var action = next
        ? '<button class="btn small" type="button" data-advance="' + i + '">Mark ' + refStatusLabel(next) + '</button>'
        : '<span class="done-mark">Done</span>';
      tr.innerHTML =
        '<td><span class="ref-code-chip">' + esc(ref.code) + '</span></td>' +
        '<td>' + esc(ref.referrerName) + '</td>' +
        '<td>' + esc(ref.friendName) + (ref.friendContact ? '<br><small>' + esc(ref.friendContact) + '</small>' : '') + '</td>' +
        '<td><span class="badge badge-' + ref.status + '">' + refStatusLabel(ref.status) + '</span></td>' +
        '<td>' + action + '</td>';
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-advance]').forEach(function (b) {
      b.addEventListener('click', function () { advanceReferralAt(Number(b.getAttribute('data-advance'))); });
    });
  }

  /* Advance one step, firing the merge hooks:
   * sent->completed: auto-enroll the friend as a member + bonus punches to the referrer.
   * completed->rewarded: log the friend-side reward cost in the ledger. */
  function advanceReferralAt(i) {
    var ref = refState.referrals[i];
    if (!ref) return;
    var was = ref.status;
    try {
      advanceStatus(ref);
    } catch (e) { showToast(e.message); return; }
    var rule = currentReferralRule();
    if (ref.status === 'completed' && was === 'sent') {
      var members = loadMembers();
      var f = autoEnrollMember(members, ref.friendName, { referredBy: ref.referrerName });
      if (!f.member.referralCode) f.member.referralCode = personalReferralCode(f.member.name);
      var rm = autoEnrollMember(members, ref.referrerName, {});
      if (!rm.member.referralCode) rm.member.referralCode = personalReferralCode(rm.member.name);
      var ev = recordReferralEvent(rm.member, 'completed', rule.bonusPunches);
      saveMembers(members);
      var b = ev.bonus;
      var msg = rm.member.name + ' earned ' + b.bonusPunches + ' bonus punch' +
        (b.bonusPunches === 1 ? '' : 'es') +
        (b.rewardEarnedNow ? ' — reward unlocked!' : '') + '.';
      if (f.created) msg = ref.friendName + ' auto-enrolled as a member. ' + msg;
      showToast(msg);
    }
    if (ref.status === 'rewarded' && was === 'completed') {
      refState.ledger = logReward(refState.ledger, {
        referralId: '',
        referrer: ref.referrerName,
        friend: ref.friendName,
        code: ref.code,
        amount: rule.costPerReferral
      });
      var members2 = loadMembers();
      var rm2 = findMemberByName(members2, ref.referrerName);
      if (rm2) { recordReferralEvent(rm2, 'rewarded'); saveMembers(members2); }
      refSave(REF_LS.ledger, refState.ledger);
    }
    refSave(REF_LS.referrals, refState.referrals);
    renderReferralAll();
    renderMembers();
  }

  /* ---------- monthly trend / by channel / stale ---------- */
  function renderReferralTrend() {
    var rows = conversionByMonth(refState.referrals);
    var tbody = $('ref-trend-rows');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">No referrals yet — trends appear once you log some.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (r) {
      return '<tr><td><strong>' + esc(r.month) + '</strong></td><td>' + r.sent + '</td><td>' +
        r.converted + '</td><td>' + r.conversionRate + '%</td></tr>';
    }).join('');
  }

  function renderReferralChannels() {
    var rows = conversionByChannel(refState.referrals);
    var tbody = $('ref-channel-rows');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty">No referrals yet — channel stats appear once you log some.</td></tr>';
      return;
    }
    var best = rows[0].conversionRate;
    tbody.innerHTML = rows.map(function (r) {
      var star = (rows.length > 1 && r.conversionRate === best) ? ' — best' : '';
      var label = (CHANNEL_LABELS && CHANNEL_LABELS[r.channel]) || r.channel || 'Not recorded';
      return '<tr><td><strong>' + esc(label) + '</strong>' + star + '</td><td>' + r.sent +
        '</td><td>' + r.converted + '</td><td>' + r.conversionRate + '%</td></tr>';
    }).join('');
  }

  function renderReferralStale() {
    var rows = staleReferrals(refState.referrals, 21);
    var tbody = $('ref-stale-rows');
    var count = $('ref-stale-count');
    if (count) count.textContent = rows.length ? String(rows.length) : '';
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">Nothing stale — every referral is fresh or already converted.</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    rows.forEach(function (ref) {
      var i = refState.referrals.indexOf(ref);
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + esc(ref.friendName) + (ref.friendContact ? '<br><small>' + esc(ref.friendContact) + '</small>' : '') + '</td>' +
        '<td>' + esc(ref.referrerName) + '</td>' +
        '<td><span class="ref-code-chip">' + esc(ref.code) + '</span></td>' +
        '<td>' + esc((ref.createdAt || '').slice(0, 10)) + '</td>' +
        '<td><button class="btn small secondary" type="button" data-nudge="' + i + '">Copy nudge</button></td>';
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-nudge]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ref = refState.referrals[Number(btn.getAttribute('data-nudge'))];
        copyText(followUpText(ref, refState.business || 'our business'), function () {
          showToast('Nudge copied.');
        });
      });
    });
  }

  /* ---------- leaderboard / spotlight / ROI ---------- */
  function renderReferralLeaderboard() {
    var rows = leaderboard(refState.referrals, {});
    var rule = currentReferralRule();
    var bp = Math.max(1, Math.round(Number(rule.bonusPunches) || 2));
    var box = $('ref-podium');
    var medals = ['1st', '2nd', '3rd'];
    box.innerHTML = rows.length ? '<div class="podium-steps">' + rows.slice(0, 3).map(function (row, i) {
      var tier = tierFor(row.completed);
      return '<div class="pstep p' + (i + 1) + '">' +
        '<div class="pmedal">' + medals[i] + '</div>' +
        '<div class="pname">' + esc(row.name) + '</div>' +
        '<div class="pscore">' + row.completed + ' converted</div>' +
        '<div class="pbadge badge tier-' + tier.name.toLowerCase() + '">' + esc(tier.name) + '</div></div>';
    }).join('') + '</div>' : '';
    var tbody = $('ref-leaderboard-rows');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No referrers yet.</td></tr>';
    } else {
      tbody.innerHTML = rows.map(function (row, i) {
        var tier = tierFor(row.completed);
        var tierSub = tier.nextTier ? ' · ' + tier.needed + ' to ' + esc(tier.nextTier) : ' · top';
        var tierBar = tier.nextTier
          ? '<span class="tierbar" title="' + tier.needed + ' to ' + esc(tier.nextTier) + '"><i style="width:' +
            Math.min(100, Math.round((tier.completed / (tier.completed + tier.needed)) * 100)) + '%"></i></span>'
          : '';
        return '<tr>' +
          '<td><span class="rank rank-' + (i + 1) + '">' + (i + 1) + '</span></td>' +
          '<td>' + esc(row.name) + '</td>' +
          '<td><span class="badge tier-' + tier.name.toLowerCase() + '">' + esc(tier.name) + '</span><br><small>' + tierSub + '</small>' + tierBar + '</td>' +
          '<td>' + row.sent + '</td>' +
          '<td>' + row.completed + '</td>' +
          '<td>' + row.rewarded + '</td>' +
          '<td>' + (row.completed * bp) + '</td></tr>';
      }).join('');
    }
    renderReferralSpotlight();
    renderReferralROI();
  }

  function renderReferralSpotlight() {
    var box = $('ref-spotlight-box');
    var spot = referrerOfMonth(refState.referrals);
    if (!spot) {
      box.innerHTML = '<p class="hint">No completed referrals this month yet — the spotlight appears once someone converts.</p>';
      return;
    }
    var text = spotlightText(spot, refState.business);
    box.innerHTML = '<div class="spot">' +
      '<div><div class="spot-name">' + esc(spot.name) + '</div>' +
      '<div class="spot-sub">Top referrer · ' + esc(spot.month) + ' · ' + spot.completed +
      ' completed referral' + (spot.completed === 1 ? '' : 's') + '</div></div>' +
      '<p class="spot-text">' + esc(text) + '</p>' +
      '<button class="btn small secondary" id="ref-spot-copy" type="button">Copy shout-out</button></div>';
    $('ref-spot-copy').addEventListener('click', function () {
      copyText(text, function () { showToast('Shout-out copied.'); });
    });
  }

  function renderReferralROI() {
    var box = $('ref-roi-box');
    var avg = Number($('ref-avg-value').value) || 0;
    var r = programROI(refState.referrals, refState.ledger, avg);
    var lt = ledgerTotals(refState.ledger);
    var netCls = r.net >= 0 ? 'pos' : 'neg';
    var netTxt = (r.net >= 0 ? '+' : '−') + money(Math.abs(r.net));
    box.innerHTML =
      '<div class="roi-grid">' +
      '<div class="roi-stat"><div class="roi-num">' + r.rewardedCount + '</div><div class="roi-lab">rewarded referrals</div></div>' +
      '<div class="roi-stat"><div class="roi-num">' + money(r.estRevenue) + '</div><div class="roi-lab">est. new-customer revenue</div></div>' +
      '<div class="roi-stat"><div class="roi-num">' + money(r.rewardCost) + '</div><div class="roi-lab">reward cost paid (' + lt.count + ' logged)</div></div>' +
      '<div class="roi-stat ' + netCls + '"><div class="roi-num">' + netTxt + '</div><div class="roi-lab">program net</div></div>' +
      '</div>' +
      (avg > 0 ? '' : '<p class="hint" style="margin-top:10px">Enter your average new-customer value above to see the program\u2019s estimated return.</p>');
  }

  /* ---------- share templates ---------- */
  function renderRefTemplatePreviews() {
    var vars = referralTemplateVars(currentReferralRule(), refState.business || 'our business', refState.codes[0]);
    $('ref-preview-sms').textContent = fillTemplate(refState.templates.sms, vars);
    $('ref-preview-email').textContent = fillTemplate(refState.templates.email, vars);
  }

  /* ---------- member-row referral buttons ---------- */
  function wireReferralRowButtons(box) {
    Array.prototype.forEach.call(box.querySelectorAll('.ref-copy-btn'), function (btn) {
      btn.addEventListener('click', function () {
        copyText(btn.getAttribute('data-code') || '', function () { showToast('Code copied.'); });
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll('.ref-invite-btn'), function (btn) {
      btn.addEventListener('click', function () {
        var list2 = loadMembers();
        var m = findMember(list2, btn.getAttribute('data-id'));
        if (!m) return;
        var vars = referralTemplateVars(
          currentReferralRule(), refState.business || 'our business', m.referralCode || 'YOURCODE');
        copyText(fillTemplate(refState.templates.sms, vars), function () {
          showToast('Invite copied — paste it into a text.');
        });
      });
    });
  }

  function renderReferralAll() {
    renderReferralStats();
    renderReferralCodes();
    renderReferralRule();
    renderReferralTracker();
    renderReferralLeaderboard();
    renderReferralTrend();
    renderReferralChannels();
    renderReferralStale();
    renderRefTemplatePreviews();
  }

  /* ---------- referral events ---------- */
  function bindReferralEvents() {
    var biz = $('ref-business-name');
    biz.value = refState.business;
    biz.addEventListener('input', function () {
      refState.business = biz.value;
      refSave(REF_LS.business, refState.business);
      renderReferralRule();
    });

    var avg = $('ref-avg-value');
    avg.value = refLoad(REF_LS.avgValue, '');
    avg.addEventListener('input', function () {
      refSave(REF_LS.avgValue, avg.value);
      renderReferralROI();
    });

    var r = currentReferralRule();
    $('ref-give').value = r.give;
    $('ref-min').value = r.minPurchase;
    $('ref-bonus').value = r.bonusPunches;
    var typeEl = document.querySelector('input[name="ref-reward-type"][value="' + r.type + '"]');
    if (typeEl) typeEl.checked = true;

    ['ref-give', 'ref-min', 'ref-bonus'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        refState.rule = readReferralRuleForm();
        refSave(REF_LS.rule, refState.rule);
        renderReferralRule();
        renderReferralLeaderboard();
        renderReferralStats();
      });
    });
    document.querySelectorAll('input[name="ref-reward-type"]').forEach(function (el) {
      el.addEventListener('change', function () {
        refState.rule = readReferralRuleForm();
        refSave(REF_LS.rule, refState.rule);
        renderReferralRule();
      });
    });

    // Code generator
    $('ref-gen-btn').addEventListener('click', function () {
      var prefix = $('ref-code-prefix').value;
      var n = Number($('ref-batch-size').value);
      var exp = $('ref-batch-expiry').value || '';
      try {
        var batch = makeBatch(prefix, n, exp);
        refState.batches.unshift(batch);
        batch.codes.forEach(function (c) { if (refState.codes.indexOf(c) === -1) refState.codes.push(c); });
        refSave(REF_LS.batches, refState.batches);
        refSave(REF_LS.codes, refState.codes);
        $('ref-batch-expiry').value = '';
        renderReferralCodes();
        renderRefTemplatePreviews();
        showToast(batch.codes.length + ' codes generated' + (exp ? ', expiring ' + exp : ' (no expiry)') + '.');
      } catch (e) { showToast(e.message); }
    });

    // Add referral — auto-enrolls the referrer as a member (killer feature)
    $('ref-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var referrer = $('ref-referrer').value.trim();
      var friend = $('ref-friend').value.trim();
      var contact = $('ref-contact').value.trim();
      var dup = findDuplicate(refState.referrals, friend, contact);
      if (dup) {
        showToast('Already referred: ' + dup.friendName + ' (' + dup.code + ', ' +
          refStatusLabel(dup.status) + '). Not added again.');
        return;
      }
      var code = $('ref-code').value;
      if (code && isCodeExpired(refState.batches, code)) {
        var exp = codeExpiry(refState.batches, code);
        if (!confirm('This code expired on ' + exp + '. Add the referral anyway?')) return;
      }
      try {
        var ref = createReferral(code, referrer, friend, contact, $('ref-channel').value);
        refState.referrals.push(ref);
        var members = loadMembers();
        var en = autoEnrollMember(members, ref.referrerName, {});
        if (!en.member.referralCode) en.member.referralCode = personalReferralCode(en.member.name);
        recordReferralEvent(en.member, 'sent');
        saveMembers(members);
        refSave(REF_LS.referrals, refState.referrals);
        e.target.reset();
        renderReferralAll();
        renderMembers();
        showToast('Referral added.' + (en.created ? ' ' + ref.referrerName + ' auto-enrolled as a member.' : ''));
      } catch (err) { showToast(err.message); }
    });

    // Tracker tools
    $('ref-search').addEventListener('input', renderReferralTracker);
    $('ref-status-filter').addEventListener('change', renderReferralTracker);
    $('ref-export').addEventListener('click', function () {
      if (!refState.referrals.length) { showToast('No referrals to export yet.'); return; }
      downloadTextFile('loyaltyloop-referrals.csv', referralsToCSV(refState.referrals));
      showToast('Exported ' + refState.referrals.length + ' referral(s) to CSV.');
    });
    $('ref-reward-all').addEventListener('click', function () {
      var owed = refState.referrals.filter(function (rr) { return rr.status === 'completed'; });
      if (!owed.length) { showToast('Nothing owed — no completed referrals waiting.'); return; }
      var rule = currentReferralRule();
      var members = loadMembers();
      owed.forEach(function (rr) {
        refState.ledger = logReward(refState.ledger, {
          referralId: '', referrer: rr.referrerName, friend: rr.friendName,
          code: rr.code, amount: rule.costPerReferral
        });
        var m = findMemberByName(members, rr.referrerName);
        if (m) recordReferralEvent(m, 'rewarded');
      });
      var n = markAllRewarded(refState.referrals);
      saveMembers(members);
      refSave(REF_LS.referrals, refState.referrals);
      refSave(REF_LS.ledger, refState.ledger);
      renderReferralAll();
      renderMembers();
      showToast('Rewarded ' + n + ' referral' + (n === 1 ? '' : 's') + '.');
    });

    // Templates
    $('ref-tpl-sms').value = refState.templates.sms;
    $('ref-tpl-email').value = refState.templates.email;
    $('ref-tpl-sms').addEventListener('input', function () {
      refState.templates.sms = $('ref-tpl-sms').value;
      refSave(REF_LS.templates, refState.templates);
      renderRefTemplatePreviews();
    });
    $('ref-tpl-email').addEventListener('input', function () {
      refState.templates.email = $('ref-tpl-email').value;
      refSave(REF_LS.templates, refState.templates);
      renderRefTemplatePreviews();
    });
    $('ref-copy-sms').addEventListener('click', function () {
      copyText($('ref-preview-sms').textContent, function () { showToast('SMS copied.'); });
    });
    $('ref-copy-email').addEventListener('click', function () {
      copyText($('ref-preview-email').textContent, function () { showToast('Email copied.'); });
    });
    $('ref-reset-tpl').addEventListener('click', function () {
      refState.templates = { sms: DEFAULT_TEMPLATES.sms, email: DEFAULT_TEMPLATES.email };
      $('ref-tpl-sms').value = refState.templates.sms;
      $('ref-tpl-email').value = refState.templates.email;
      refSave(REF_LS.templates, refState.templates);
      renderRefTemplatePreviews();
      showToast('Templates reset to defaults.');
    });
  }

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
  bindReferralEvents();
})();
