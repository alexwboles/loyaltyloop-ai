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

  /* ---------- tabs ---------- */
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('.tab-btn'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.tab-section'));

  function showTab(name) {
    tabButtons.forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    sections.forEach(function (s) { s.classList.toggle('active', s.id === 'section-' + name); });
  }
  tabButtons.forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.dataset.tab); });
  });

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
    // remember the suggested card size for the printable tab
    var rec2 = rec;
    window.__lastRec = rec2;
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
    // tiny punch-card: filled circles = punches on the member's current card
    var per = Math.max(1, m.punchesPerCard || 10);
    var filled = m.visits % per;
    var cells = '';
    for (var i = 0; i < per; i++) {
      cells += '<span class="punch-mini' + (i < filled ? ' filled' : '') + '"></span>';
    }
    return '<span class="stamp-mini-card" aria-label="' + filled + ' of ' + per + ' punches">' +
      cells + '<span class="punch-frac">' + filled + '/' + per + '</span></span>';
  }

  function renderMembers() {
    var list = loadMembers();
    var box = $('member-list');
    var count = $('member-count');
    if (count) count.textContent = list.length ? String(list.length) : '';
    if (!list.length) {
      box.innerHTML = '<p class="empty-note">No members yet — add your first member above.</p>';
      return;
    }
    var html = list.map(function (m) {
      var earned = rewardsEarned(m);
      return '<div class="member-row" data-id="' + esc(m.id) + '">' +
        '<span class="member-name">' + esc(m.name) + '</span>' +
        stampStrip(m) +
        '<span class="member-stats">' + m.visits + ' visit' + (m.visits === 1 ? '' : 's') +
        (earned ? ' &middot; <span class="reward-pill">' + earned + ' reward' + (earned === 1 ? '' : 's') + ' earned</span>' : '') +
        '</span>' +
        '<button class="btn small visit-btn" type="button">+1 visit</button>' +
        '<button class="btn small secondary remove-btn" type="button">Remove</button>' +
      '</div>';
    }).join('');
    box.innerHTML = html;

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
    Array.prototype.forEach.call(box.querySelectorAll('.remove-btn'), function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.closest('.member-row').dataset.id;
        saveMembers(loadMembers().filter(function (m) { return m.id !== id; }));
        renderMembers();
      });
    });
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
    var list = loadMembers();
    try {
      list.push(createMember(name, { punchesPerCard: Math.max(1, Math.round(num('member-punches', 10))) }));
    } catch (e) {
      showToast('Could not add member.');
      return;
    }
    saveMembers(list);
    nameInput.value = '';
    renderMembers();
  });

  /* ---------- boot ---------- */
  // populate business type select from the data table (no duplication)
  (function populateTypes() {
    var sel = $('biz-type');
    BUSINESS_TYPES.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      sel.appendChild(opt);
    });
  })();

  // sensible calculator defaults so first click shows something real
  $('ec-ticket').value = '6.50';
  $('ec-visits').value = '8';
  $('ec-margin').value = '65';
  $('ec-cost').value = '4.50';
  $('ec-everyn').value = '10';
  $('ec-lift').value = '12';
  $('pc-punches').value = '10';
  $('pc-reward').value = 'Free drink';

  showTab('recommend');
  renderMembers();
})();
