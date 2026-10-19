#!/usr/bin/env bash
# LoyaltyLoop AI — smoke tests.
# File existence, JS syntax, and pure-logic unit checks against js/logic.js.
# Fail fast: first failing test stops the run. Exit code = FAIL count.
set -u
cd "$(dirname "$0")/.."

PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); echo "PASS: $1"; }
fail() {
  FAIL=$((FAIL + 1))
  echo "FAIL: $1"
  echo "smoke: $PASS passed, $FAIL failed"
  exit "$FAIL"
}

echo "== LoyaltyLoop AI smoke tests =="

# 1. required files exist
for f in index.html css/style.css js/logic.js js/app.js README.md test/smoke.sh test/e2e.sh; do
  [ -f "$f" ] || fail "required file missing: $f"
done
pass "all required files exist"

# 2-3. JS syntax checks
node --check js/logic.js || fail "node --check js/logic.js"
pass "node --check js/logic.js"
node --check js/app.js || fail "node --check js/app.js"
pass "node --check js/app.js"

# 4. logic.js is requireable and exports the public API
node <<'EOF' || fail "logic.js module exports"
const L = require('./js/logic.js');
const fns = ['recommendProgram','calculateEconomics','breakEvenLift','createMember',
  'logVisit','logPurchase','rewardsEarned','rewardsAvailable','redeemReward','searchMembers',
  'sortMembers','membersToCSV','membersFromCSV','winBackMessage','punchCardSpec','normalizeType','fmtMoney',
  'daysSinceVisit','atRiskMembers','segmentMember','segmentCounts','visitsToNextReward'];
for (const f of fns) if (typeof L[f] !== 'function') { console.error('missing fn: ' + f); process.exit(1); }
for (const t of ['STRUCTURES','BUSINESS_TYPES','RECOMMENDATIONS']) if (!L[t]) { console.error('missing table: ' + t); process.exit(1); }
EOF
pass "logic.js exports public functions + data tables"

# 5. recommender: right structure per business type
node <<'EOF' || fail "recommender structure mapping"
const L = require('./js/logic.js');
const expect = {
  coffee_shop: 'punch_card', car_wash: 'punch_card', bakery: 'punch_card',
  restaurant: 'points', retail: 'points', pet_groomer: 'points',
  salon_barber: 'tiers', gym: 'tiers'
};
for (const [type, structure] of Object.entries(expect)) {
  const r = L.recommendProgram(type);
  if (r.structure !== structure || r.fallback !== false) {
    console.error(type + ' -> ' + r.structure + ' (expected ' + structure + ')');
    process.exit(1);
  }
  if (!r.rationale || !r.earn || !r.redeem) { console.error(type + ': missing fields'); process.exit(1); }
}
EOF
pass "recommender picks correct structure for all 8 business types"

# 6. recommender edge cases: unknown type fallback, aliases, case-insensitivity
node <<'EOF' || fail "recommender edge/unknown handling"
const L = require('./js/logic.js');
const u = L.recommendProgram('space tourism franchise');
if (u.fallback !== true || u.structure !== 'points') { console.error('unknown fallback wrong'); process.exit(1); }
if (L.recommendProgram('cafe').structure !== 'punch_card') { console.error('alias cafe wrong'); process.exit(1); }
if (L.recommendProgram('  COFFEE_SHOP ').structure !== 'punch_card') { console.error('case/space handling wrong'); process.exit(1); }
if (L.recommendProgram('').fallback !== true) { console.error('empty type wrong'); process.exit(1); }
if (L.recommendProgram(null).fallback !== true) { console.error('null type wrong'); process.exit(1); }
EOF
pass "recommender handles unknown type, aliases, case, empty/null"

# 7. calculator math (hand-verified numbers)
node <<'EOF' || fail "calculator math"
const L = require('./js/logic.js');
// avgTicket=5, visits=8/mo, margin=70%, reward=$5 every 10 visits, lift=10%
// liftedVisits=8.8 -> cost/mo = 5*0.88 = 4.40
// extra profit = 5*8*0.10*0.70 = 2.80 ; net = -1.60
const r = L.calculateEconomics({ avgTicket: 5, visitsPerMonth: 8, marginPct: 70,
  rewardCost: 5, rewardEveryN: 10, visitLiftPct: 10 });
if (r.rewardCostPerMemberMonth !== 4.40) { console.error('cost/mo=' + r.rewardCostPerMemberMonth); process.exit(1); }
if (r.extraGrossProfit !== 2.80) { console.error('extra=' + r.extraGrossProfit); process.exit(1); }
if (r.netBenefit !== -1.60) { console.error('net=' + r.netBenefit); process.exit(1); }
if (typeof r.verdict !== 'string' || r.verdict.length < 20) { console.error('verdict missing'); process.exit(1); }
EOF
pass "calculator math: cost/mo 4.40, extra 2.80, net -1.60"

# 8. break-even math incl. edge cases
node <<'EOF' || fail "break-even math"
const L = require('./js/logic.js');
// 100 * (5/10) / (5*0.7 - 5/10) = 100*0.5/3.0 = 16.67
const be = L.breakEvenLift({ avgTicket: 5, visitsPerMonth: 8, marginPct: 70,
  rewardCost: 5, rewardEveryN: 10, visitLiftPct: 10 });
if (be !== 16.67) { console.error('breakEven=' + be); process.exit(1); }
if (L.breakEvenLift({ avgTicket: 5, marginPct: 70, rewardCost: 0, rewardEveryN: 10 }) !== 0) {
  console.error('free reward should break even at 0'); process.exit(1);
}
// reward costs $3/visit but a visit only earns $2.50 -> never breaks even
const inf = L.breakEvenLift({ avgTicket: 5, marginPct: 50, rewardCost: 30, rewardEveryN: 10 });
if (inf !== Infinity) { console.error('impossible should be Infinity, got ' + inf); process.exit(1); }
EOF
pass "break-even math: 16.67%, free=0, impossible=Infinity"

# 9. member visit / reward math
node <<'EOF' || fail "member visit/reward math"
const L = require('./js/logic.js');
L._resetMemberSeq();
const m = L.createMember('Sam', { punchesPerCard: 10 });
if (m.visits !== 0 || L.rewardsEarned(m) !== 0) { console.error('new member wrong'); process.exit(1); }
let last;
for (let i = 0; i < 10; i++) last = L.logVisit(m);
if (m.visits !== 10) { console.error('visits=' + m.visits); process.exit(1); }
if (last.rewardEarnedNow !== true || last.rewardsEarned !== 1) { console.error('10th visit reward wrong'); process.exit(1); }
for (let i = 0; i < 5; i++) last = L.logVisit(m);
if (m.visits !== 15 || L.rewardsEarned(m) !== 1 || last.rewardEarnedNow !== false) {
  console.error('15 visits wrong'); process.exit(1);
}
const m2 = L.createMember('Jo', { punchesPerCard: 10 });
for (let i = 0; i < 9; i++) L.logVisit(m2);
if (L.rewardsEarned(m2) !== 0) { console.error('9 visits should earn 0'); process.exit(1); }
let threw = false;
try { L.createMember('   '); } catch (e) { threw = true; }
if (!threw) { console.error('empty name should throw'); process.exit(1); }
EOF
pass "member math: visits counted, reward at 10th visit, floor division"

# 10. punch card spec generation
node <<'EOF' || fail "punchCardSpec"
const L = require('./js/logic.js');
const s = L.punchCardSpec('Acme Coffee', 10, 'Free latte');
if (s.businessName !== 'Acme Coffee' || s.punchesPerCard !== 10) { console.error('spec fields'); process.exit(1); }
if (s.rewardLabel !== 'Free latte') { console.error('reward label'); process.exit(1); }
if (!Array.isArray(s.cells) || s.cells.length !== 10 || s.cells[0] !== 1 || s.cells[9] !== 10) {
  console.error('cells wrong'); process.exit(1);
}
const d = L.punchCardSpec('', 0, '');
if (d.businessName !== 'Your Business' || d.punchesPerCard < 1) { console.error('defaults wrong'); process.exit(1); }
EOF
pass "punchCardSpec generates card data with sane defaults"

# 11. no API keys, no network calls anywhere in the app JS
if grep -qiE 'api[_-]?key|apikey|secret|fetch\(|XMLHttpRequest|https?://' js/logic.js js/app.js; then
  fail "app JS must contain no API keys or network calls"
fi
pass "no API keys / network calls in js"

# 12. print CSS present
grep -q '@media print' css/style.css || fail "@media print missing from css"
grep -q '\.no-print' css/style.css || fail ".no-print rule missing from css"
pass "@media print rules present in css"

# 13. index.html wires everything
grep -q 'css/style.css' index.html || fail "index.html missing css link"
grep -q 'js/logic.js' index.html || fail "index.html missing logic.js"
grep -q 'js/app.js' index.html || fail "index.html missing app.js"
for id in biz-type rec-btn ec-btn pc-print member-list; do
  grep -q "id=\"$id\"" index.html || fail "index.html missing element id=$id"
done
pass "index.html links css/js and has required element ids"

# 14. README documents the product honestly
grep -qi 'free' README.md || fail "README missing free note"
grep -qi 'local' README.md || fail "README missing local-first note"
grep -q 'index.html' README.md || fail "README missing how-to-run"
pass "README covers features, how to run, free/local-first"

# 15. reward redemption: earned - redeemed = available; throws when none
node <<'EOF' || fail "redeemReward math"
const L = require('./js/logic.js');
L._resetMemberSeq();
const m = L.createMember('Sam', { punchesPerCard: 5 });
for (let i = 0; i < 12; i++) L.logVisit(m); // 2 earned
if (L.rewardsEarned(m) !== 2) { console.error('earned=' + L.rewardsEarned(m)); process.exit(1); }
if (L.rewardsAvailable(m) !== 2) { console.error('available=' + L.rewardsAvailable(m)); process.exit(1); }
const r = L.redeemReward(m);
if (m.redeemed !== 1 || r.rewardsAvailable !== 1) { console.error('redeem wrong'); process.exit(1); }
L.redeemReward(m);
let threw = false;
try { L.redeemReward(m); } catch (e) { threw = true; }
if (!threw) { console.error('redeem with none available should throw'); process.exit(1); }
if (L.rewardsAvailable(m) !== 0) { console.error('available should be 0'); process.exit(1); }
EOF
pass "redeemReward: earn 2, redeem 2, throws on third"

# 16. redeem tolerates old member records without redeemed/lastVisitAt fields
node <<'EOF' || fail "redeemReward old-record tolerance"
const L = require('./js/logic.js');
// simulate a record saved before these fields existed
const old = { id: 'm_old', name: 'Old Record', visits: 10, punchesPerCard: 10, joinedAt: '2026-01-01T00:00:00.000Z' };
if (L.rewardsAvailable(old) !== 1) { console.error('old record available wrong'); process.exit(1); }
L.redeemReward(old);
if (old.redeemed !== 1 || L.rewardsAvailable(old) !== 0) { console.error('old record redeem wrong'); process.exit(1); }
if (L.rewardsAvailable({ visits: 3 }) !== 0) { console.error('missing punchesPerCard should be 0'); process.exit(1); }
EOF
pass "rewardsAvailable/redeemReward tolerate pre-upgrade records"

# 17. logVisit stamps lastVisitAt (injectable for tests)
node <<'EOF' || fail "logVisit lastVisitAt"
const L = require('./js/logic.js');
L._resetMemberSeq();
const m = L.createMember('Tim', { punchesPerCard: 10 });
if (m.lastVisitAt !== null || m.redeemed !== 0) { console.error('new member fields wrong'); process.exit(1); }
const r = L.logVisit(m, '2026-10-07T09:30:00.000Z');
if (r.lastVisitAt !== '2026-10-07T09:30:00.000Z' || m.lastVisitAt !== '2026-10-07T09:30:00.000Z') {
  console.error('lastVisitAt not stamped'); process.exit(1);
}
const r2 = L.logVisit(m); // default = now
if (!r2.lastVisitAt || isNaN(Date.parse(r2.lastVisitAt))) { console.error('default lastVisitAt wrong'); process.exit(1); }
EOF
pass "logVisit stamps lastVisitAt (injectable or now)"

# 18. searchMembers + sortMembers
node <<'EOF' || fail "searchMembers/sortMembers"
const L = require('./js/logic.js');
L._resetMemberSeq();
const a = L.createMember('Zoe Alpha', { punchesPerCard: 10 }); a.joinedAt = '2026-01-03T00:00:00.000Z';
const b = L.createMember('mike beta', { punchesPerCard: 10 }); b.joinedAt = '2026-01-01T00:00:00.000Z';
const c = L.createMember('Ann Gamma', { punchesPerCard: 10 }); c.joinedAt = '2026-01-02T00:00:00.000Z';
for (let i = 0; i < 5; i++) L.logVisit(c);
const list = [a, b, c];
const orig = list.slice();
if (L.searchMembers(list, 'miKE').length !== 1 || L.searchMembers(list, 'miKE')[0] !== b) {
  console.error('search case-insensitive wrong'); process.exit(1);
}
if (L.searchMembers(list, 'zzz').length !== 0) { console.error('search no-match wrong'); process.exit(1); }
if (L.searchMembers(list, '').length !== 3) { console.error('empty search should return all'); process.exit(1); }
const byName = L.sortMembers(list, 'name').map(m => m.name);
if (byName.join('|') !== 'Ann Gamma|mike beta|Zoe Alpha') { console.error('name sort: ' + byName); process.exit(1); }
const byVisits = L.sortMembers(list, 'visits');
if (byVisits[0] !== c) { console.error('visits sort wrong'); process.exit(1); }
const byNewest = L.sortMembers(list, 'newest');
if (byNewest[0] !== a || byNewest[2] !== b) { console.error('newest sort wrong'); process.exit(1); }
if (list.join('|') !== orig.join('|')) { console.error('sortMembers must not mutate'); process.exit(1); }
EOF
pass "searchMembers filters case-insensitively; sortMembers: name/visits/newest, no mutation"

# 19. membersToCSV: header + one row per member, quoted commas
node <<'EOF' || fail "membersToCSV"
const L = require('./js/logic.js');
L._resetMemberSeq();
const m = L.createMember('O"Brien, Pat', { punchesPerCard: 10 });
for (let i = 0; i < 10; i++) L.logVisit(m, '2026-10-07T09:30:00.000Z');
L.redeemReward(m);
const csv = L.membersToCSV([m]);
const lines = csv.split('\n');
if (lines[0] !== 'name,visits,rewards_earned,rewards_redeemed,rewards_available,last_visit,joined') {
  console.error('header: ' + lines[0]); process.exit(1);
}
if (lines.length !== 2) { console.error('expected 2 lines, got ' + lines.length); process.exit(1); }
// name with comma+quote must be quoted and escaped: "O""Brien, Pat"
if (lines[1].indexOf('"O""Brien, Pat"') !== 0) { console.error('quoting: ' + lines[1]); process.exit(1); }
// visits=10 earned=1 redeemed=1 available=0
if (lines[1].indexOf(',10,1,1,0,') === -1) { console.error('counts: ' + lines[1]); process.exit(1); }
EOF
pass "membersToCSV: header, quoted names, correct counts"

# 20. index.html has the new member controls
for id in member-search member-sort member-csv-btn; do
  grep -q "id=\"$id\"" index.html || fail "index.html missing element id=$id"
done
pass "index.html has member search/sort/export controls"

# win-back: at-risk members
node <<'EOF' || fail "atRiskMembers"
const L = require('./js/logic.js');
L._resetMemberSeq();
const ref = '2026-10-12';
function mk(name, visits, lastVisitAt) {
  const m = L.createMember(name, { punchesPerCard: 10 });
  m.visits = visits; m.lastVisitAt = lastVisitAt; m.joinedAt = '2026-01-01T00:00:00.000Z';
  return m;
}
const list = [
  mk('Ava', 25, '2026-10-01T10:00:00.000Z'),   // 11 days ago — fine
  mk('Ben', 5, '2026-08-01T10:00:00.000Z'),    // 72 days ago — at risk
  mk('Cy', 3, '2026-09-01T10:00:00.000Z'),     // 41 days ago — at risk
  mk('Dee', 0, null)                           // never visited, joined Jan — at risk
];
const risk = L.atRiskMembers(list, 30, ref);
if (risk.length !== 3) { console.error('risk count ' + risk.length); process.exit(1); }
if (risk[0].member.name !== 'Dee' || risk[0].daysSince < 200) { console.error('most-lapsed first wrong'); process.exit(1); }
if (L.daysSinceVisit(list[0], ref) !== 11) { console.error('daysSince ' + L.daysSinceVisit(list[0], ref)); process.exit(1); }
EOF
pass "win-back: 3 at-risk members, most-lapsed first, days-since math"

# segments
node <<'EOF' || fail "segments"
const L = require('./js/logic.js');
L._resetMemberSeq();
const ref = '2026-10-12';
function mk(name, visits, lastVisitAt) {
  const m = L.createMember(name, { punchesPerCard: 10 });
  m.visits = visits; m.lastVisitAt = lastVisitAt; m.joinedAt = '2026-10-01T00:00:00.000Z';
  return m;
}
const cases = [
  ['champ', 25, '2026-10-10T00:00:00Z', 'champion'],
  ['reg', 8, '2026-10-10T00:00:00Z', 'regular'],
  ['occ', 3, '2026-10-10T00:00:00Z', 'occasional'],
  ['newbie', 1, '2026-10-10T00:00:00Z', 'new'],
  ['gone', 12, '2026-06-01T00:00:00Z', 'lapsed']
];
for (const [n, v, lv, want] of cases) {
  const got = L.segmentMember(mk(n, v, lv), ref);
  if (got !== want) { console.error(n + ' -> ' + got + ' want ' + want); process.exit(1); }
}
const counts = L.segmentCounts(cases.map(c => mk(c[0], c[1], c[2])), ref);
if (counts.champion !== 1 || counts.lapsed !== 1 || counts.new !== 1) { console.error(JSON.stringify(counts)); process.exit(1); }
EOF
pass "segments: champion/regular/occasional/new/lapsed + counts"

# reward progress
node <<'EOF' || fail "visitsToNextReward"
const L = require('./js/logic.js');
L._resetMemberSeq();
const m = L.createMember('Zed', { punchesPerCard: 10 });
let p = L.visitsToNextReward(m);
if (p.toGo !== 10 || p.pct !== 0) { console.error('fresh: ' + JSON.stringify(p)); process.exit(1); }
m.visits = 4;
p = L.visitsToNextReward(m);
if (p.toGo !== 6 || p.pct !== 40 || p.intoCard !== 4) { console.error('4 visits: ' + JSON.stringify(p)); process.exit(1); }
m.visits = 10;
p = L.visitsToNextReward(m);
if (p.toGo !== 0 || p.pct !== 0) { console.error('reward earned: ' + JSON.stringify(p)); process.exit(1); }
EOF
pass "visitsToNextReward: 0/10 -> 4/10 -> reward earned"

# 21. points mode: earn per dollar, redeem deducts, progress is points-based
node <<'EOF' || fail "points mode"
const L = require('./js/logic.js');
L._resetMemberSeq();
const m = L.createMember('Points Pat', { mode: 'points', pointsPerDollar: 2, pointsPerReward: 100 });
if (m.mode !== 'points' || m.points !== 0) { console.error('mode: ' + JSON.stringify(m)); process.exit(1); }
let r = L.logPurchase(m, 30); // 60 pts
if (r.points !== 60 || r.pointsEarned !== 60 || L.rewardsEarned(m) !== 0) { console.error('p1: ' + JSON.stringify(r)); process.exit(1); }
r = L.logPurchase(m, 25); // 110 pts -> 1 reward
if (!r.rewardEarnedNow || L.rewardsAvailable(m) !== 1) { console.error('p2: ' + JSON.stringify(r)); process.exit(1); }
L.redeemReward(m);
if (m.points !== 10 || L.rewardsAvailable(m) !== 0 || m.redeemed !== 1) { console.error('redeem: ' + m.points); process.exit(1); }
const prog = L.visitsToNextReward(m);
if (!prog.points || prog.perCard !== 100 || prog.toGo !== 90) { console.error('prog: ' + JSON.stringify(prog)); process.exit(1); }
// errors: punch member, bad spend
const punchy = L.createMember('Punchy', { punchesPerCard: 8 });
try { L.logPurchase(punchy, 10); console.error('should throw on punch member'); process.exit(1); } catch (e) {}
try { L.logPurchase(m, 0); console.error('should throw on zero spend'); process.exit(1); } catch (e) {}
try { L.logPurchase(m, 'abc'); console.error('should throw on NaN spend'); process.exit(1); } catch (e) {}
// punch mode unchanged
for (let i = 0; i < 8; i++) L.logVisit(punchy);
if (L.rewardsEarned(punchy) !== 1) { console.error('punch regression'); process.exit(1); }
EOF
pass "points mode: earn/redeem/deduct + punch mode unchanged"

# 22. winBackMessage: personalized nudge with offer + progress hook
node <<'EOF' || fail "winBackMessage"
const L = require('./js/logic.js');
L._resetMemberSeq();
const m = L.createMember('Maria Lopez', { punchesPerCard: 10 });
for (let i = 0; i < 7; i++) L.logVisit(m);
const msg = L.winBackMessage(m, 45, '10% off your next visit', 'Acme Coffee');
if (msg.indexOf('Hi Maria') !== 0) { console.error('greeting: ' + msg); process.exit(1); }
if (msg.indexOf('45 days') === -1 || msg.indexOf('10% off your next visit') === -1) { console.error('days/offer: ' + msg); process.exit(1); }
if (msg.indexOf('3 visits away') === -1) { console.error('progress hook: ' + msg); process.exit(1); }
if (msg.indexOf('Acme Coffee') === -1) { console.error('sign-off: ' + msg); process.exit(1); }
const pts = L.createMember('Pat Points', { mode: 'points', pointsPerReward: 100 });
L.logPurchase(pts, 40);
const msg2 = L.winBackMessage(pts, 31, '', '');
if (msg2.indexOf('60 points away') === -1) { console.error('points hook: ' + msg2); process.exit(1); }
if (msg2.indexOf('a little thank-you') === -1) { console.error('default offer: ' + msg2); process.exit(1); }
EOF
pass "winBackMessage: personalized nudge with offer + progress hook"

# 23. membersFromCSV: header row or plain names, blanks skipped
node <<'EOF' || fail "membersFromCSV"
const L = require('./js/logic.js');
L._resetMemberSeq();
let r = L.membersFromCSV('name,punches_per_card\nAmy,5\n\nBob\n,,\n');
if (r.members.length !== 2 || r.skipped !== 2) { console.error('header: ' + JSON.stringify(r)); process.exit(1); }
if (r.members[0].name !== 'Amy' || r.members[0].punchesPerCard !== 5) { console.error('amy: ' + JSON.stringify(r.members[0])); process.exit(1); }
if (r.members[1].punchesPerCard !== 10) { console.error('default punches'); process.exit(1); }
r = L.membersFromCSV('Amy\nBob\n');
if (r.members.length !== 2 || r.skipped !== 0) { console.error('plain: ' + JSON.stringify(r)); process.exit(1); }
r = L.membersFromCSV('');
if (r.members.length !== 0) { console.error('empty'); process.exit(1); }
r = L.membersFromCSV('name,punches\n"Amy, A.",7\n');
if (r.members[0].name !== 'Amy, A.' || r.members[0].punchesPerCard !== 7) { console.error('quoted: ' + JSON.stringify(r.members[0])); process.exit(1); }
EOF
pass "membersFromCSV: header + plain-name formats, blanks skipped"

# 24. index.html has the new member controls
for id in member-mode member-ppreward member-import-btn member-import-file; do
  if grep -q "id=\"$id\"" index.html; then pass "index.html has #$id"; else fail "index.html missing #$id"; fi
done

# 25. app.js wires points purchases, nudge composer, CSV import
for needle in logPurchase purchase-btn winBackMessage nudge-copy membersFromCSV member-import-btn copyText; do
  if grep -q "$needle" js/app.js; then pass "app.js wires $needle"; else fail "app.js missing $needle"; fi
done


# 26. index.html has the overview dashboard elements
for id in topbar-eyebrow topbar-title ov-members ov-visits ov-earned ov-redeemed ov-top ov-mix ov-activity ov-empty ov-goto-winback ov-add-first; do
  if grep -q "id=\"$id\"" index.html; then pass "index.html has #$id"; else fail "index.html missing #$id"; fi
done

# 27. app.js renders the overview dashboard
for needle in renderOverview ov-members-sub ov-new ov-risk act-row top-row segmentCounts atRiskMembers relTime; do
  if grep -q "$needle" js/app.js; then pass "app.js wires $needle"; else fail "app.js missing $needle"; fi
done

# 28. overview aggregate math (the numbers the dashboard shows)
node <<'NODEEOF' || fail "overview aggregates"
const L = require('./js/logic.js');
L._resetMemberSeq();
const mk = (name, visits, daysAgo, redeem) => {
  const m = L.createMember(name, { punchesPerCard: 10 });
  for (let i = 0; i < visits; i++) L.logVisit(m, new Date(Date.now() - (daysAgo + i) * 864e5).toISOString());
  if (redeem) L.redeemReward(m);
  return m;
};
const all = [mk('Ava', 23, 2, true), mk('Ben', 11, 9, false), mk('Cy', 2, 45, false)];
const visits = all.reduce((s, m) => s + m.visits, 0);
if (visits !== 36) { console.error('visits=' + visits); process.exit(1); }
const earned = all.reduce((s, m) => s + L.rewardsEarned(m), 0);
if (earned !== 3) { console.error('earned=' + earned); process.exit(1); }
const unredeemed = all.reduce((s, m) => s + L.rewardsAvailable(m), 0);
if (unredeemed !== 2) { console.error('unredeemed=' + unredeemed); process.exit(1); }
const top = L.sortMembers(all.slice(), 'visits');
if (top[0].name !== 'Ava' || top[2].name !== 'Cy') { console.error('top sort'); process.exit(1); }
if (L.atRiskMembers(all, 30).length !== 1) { console.error('at-risk'); process.exit(1); }
NODEEOF
pass "overview aggregates: visits, rewards, top-member sort, at-risk count"

# 29. logic.js exports the referral engine + merge API
node <<'EOF' || fail "referral logic exports"
const L = require('./js/logic.js');
const fns = ['generateCode','generateBatch','isValidCodeFormat','personalReferralCode',
  'buildRule','buildReferralRule','createReferral','canAdvance','nextStatus','advanceStatus',
  'countByStatus','leaderboard','fillTemplate','templateVarsFromRule','referralTemplateVars',
  'computeStats','referralsToCSV','filterReferrals','findDuplicate','markAllRewarded',
  'conversionByMonth','conversionByChannel','tierFor','staleReferrals','followUpText',
  'makeBatch','codeExpiry','isCodeExpired','logReward','ledgerTotals','programROI',
  'referrerOfMonth','spotlightText','findMemberByName','autoEnrollMember',
  'awardBonusPunches','recordReferralEvent','money','monthKey','normalizeChannel','normalizePrefix'];
for (const f of fns) if (typeof L[f] !== 'function') { console.error('missing fn: ' + f); process.exit(1); }
for (const t of ['STATUS','REWARD_TYPES','TIERS','DEFAULT_TEMPLATES','CHANNELS','CHANNEL_LABELS']) {
  if (!L[t]) { console.error('missing table: ' + t); process.exit(1); }
}
EOF
pass "logic.js exports referral engine + merge functions"

# 30. referral codes: format, batch uniqueness, batch errors
node <<'EOF' || fail "referral codes"
const L = require('./js/logic.js');
let i = 0;
const rand = () => (i = (i * 9301 + 49297) % 233280) / 233280;
const batch = L.generateBatch('MAIN-ST', 20, rand);
if (new Set(batch).size !== 20) { console.error('batch not unique'); process.exit(1); }
if (!batch.every(c => L.isValidCodeFormat(c) && c.startsWith('MAIN-ST-'))) {
  console.error('bad format: ' + batch[0]); process.exit(1);
}
if (L.isValidCodeFormat('MAIN-ST-0000')) { console.error('0/O lookalikes must be rejected'); process.exit(1); }
for (const bad of [0, -3, 1001, 'abc']) {
  let threw = false;
  try { L.generateBatch('X', bad, rand); } catch (e) { threw = true; }
  if (!threw) { console.error('batch size ' + bad + ' should throw'); process.exit(1); }
}
// member personal codes
const mc = L.personalReferralCode('Maria Lopez', rand);
if (!L.isValidCodeFormat(mc) || !mc.startsWith('MARIA-LOPEZ-')) { console.error('member code: ' + mc); process.exit(1); }
EOF
pass "referral codes: 20 unique, valid format, no lookalikes, batch errors"

# 31. buildReferralRule: merged rule shape + cost math
node <<'EOF' || fail "buildReferralRule"
const L = require('./js/logic.js');
let r = L.buildReferralRule({ give: 10, type: 'dollars', minPurchase: 25, bonusPunches: 2 });
if (r.costPerReferral !== 10) { console.error('cost: ' + r.costPerReferral); process.exit(1); }
if (r.giveText !== '$10 off') { console.error('giveText: ' + r.giveText); process.exit(1); }
if (!/Give friends \$10 off/.test(r.summary) || !/2 bonus punches/.test(r.summary)) {
  console.error('summary: ' + r.summary); process.exit(1);
}
r = L.buildReferralRule({ give: 20, type: 'percent', minPurchase: 25, bonusPunches: 1 });
if (r.costPerReferral !== 10) { console.error('percent cost: ' + r.costPerReferral); process.exit(1); } // 20% of $50 AOV
if (!/1 bonus punch(?!es)/.test(r.summary)) { console.error('singular: ' + r.summary); process.exit(1); }
r = L.buildReferralRule({});
if (r.bonusPunches !== 2 || r.type !== 'dollars') { console.error('defaults'); process.exit(1); }
const vars = L.referralTemplateVars(r, 'Acme Coffee', 'ABC-1234');
if (vars.get !== '2 bonus punches' || vars.code !== 'ABC-1234' || vars.business !== 'Acme Coffee') {
  console.error('vars: ' + JSON.stringify(vars)); process.exit(1);
}
EOF
pass "buildReferralRule: summary, cost math, singular punch, template vars"

# 32. referral pipeline: one-step transitions, no skipping
node <<'EOF' || fail "referral pipeline"
const L = require('./js/logic.js');
const ref = L.createReferral('MAIN-ST-7K2Q', 'Maria Lopez', 'Nina Friend', 'nina@x.com', 'sms');
if (ref.status !== 'sent' || !L.canAdvance(ref) || L.nextStatus(ref) !== 'completed') {
  console.error('initial state wrong'); process.exit(1);
}
L.advanceStatus(ref);
if (ref.status !== 'completed') { console.error('advance 1'); process.exit(1); }
L.advanceStatus(ref, 'rewarded');
if (ref.status !== 'rewarded' || L.canAdvance(ref)) { console.error('advance 2'); process.exit(1); }
let threw = false;
try { L.createReferral('MAIN-ST-7K2Q', 'A', 'B', '', '').status = 'sent', L.advanceStatus({ status: 'sent', history: [] }, 'rewarded'); }
catch (e) { threw = true; }
if (!threw) { console.error('sent->rewarded skip must throw'); process.exit(1); }
threw = false;
try { L.createReferral('bad code', 'A', 'B', '', ''); } catch (e) { threw = true; }
if (!threw) { console.error('bad code must throw'); process.exit(1); }
const c = L.countByStatus([ref]);
if (c.rewarded !== 1) { console.error('counts'); process.exit(1); }
EOF
pass "referral pipeline: sent->completed->rewarded, skips rejected, bad codes rejected"

# 33. duplicate detection + bulk reward
node <<'EOF' || fail "duplicates + bulk reward"
const L = require('./js/logic.js');
const refs = [
  L.createReferral('A-7K2Q', 'Maria', 'Nina', 'nina@x.com', ''),
  L.createReferral('B-9M4P', 'Tom', 'Nina', '', '')
];
if (!L.findDuplicate(refs, 'nina', '')) { console.error('name dup missed'); process.exit(1); }
if (!L.findDuplicate(refs, '', 'NINA@X.COM')) { console.error('contact dup missed'); process.exit(1); }
if (L.findDuplicate(refs, 'Zed', 'zed@x.com')) { console.error('false dup'); process.exit(1); }
L.advanceStatus(refs[0]); L.advanceStatus(refs[1]);
if (L.markAllRewarded(refs) !== 2) { console.error('bulk count'); process.exit(1); }
if (refs.some(r => r.status !== 'rewarded')) { console.error('bulk status'); process.exit(1); }
if (L.markAllRewarded(refs) !== 0) { console.error('bulk idempotent'); process.exit(1); }
EOF
pass "duplicate detection (name + contact, case-insensitive) + bulk reward"

# 34. stale referrals + follow-up text
node <<'EOF' || fail "stale referrals"
const L = require('./js/logic.js');
const refs = [
  L.createReferral('A-7K2Q', 'Maria', 'Old Friend', '', ''),
  L.createReferral('B-9M4P', 'Tom', 'New Friend', '', '')
];
refs[0].createdAt = '2026-09-01T00:00:00.000Z';
refs[1].createdAt = '2026-10-18T00:00:00.000Z';
const stale = L.staleReferrals(refs, 21, '2026-10-19T00:00:00.000Z');
if (stale.length !== 1 || stale[0].friendName !== 'Old Friend') { console.error('stale: ' + stale.length); process.exit(1); }
const txt = L.followUpText(stale[0], 'Acme Coffee');
if (txt.indexOf('Old Friend') === -1 || txt.indexOf('A-7K2Q') === -1 || txt.indexOf('Acme Coffee') === -1) {
  console.error('nudge: ' + txt); process.exit(1);
}
EOF
pass "stale referrals (21d window) + copy-ready nudge"

# 35. reward ledger + program ROI
node <<'EOF' || fail "ledger + ROI"
const L = require('./js/logic.js');
let ledger = [];
ledger = L.logReward(ledger, { referrer: 'Maria', friend: 'Nina', code: 'A-7K2Q', amount: 10 });
ledger = L.logReward(ledger, { referrer: 'Tom', friend: 'Zed', code: 'B-9M4P', amount: 7.5 });
const t = L.ledgerTotals(ledger);
if (t.count !== 2 || t.total !== 17.5) { console.error('totals: ' + JSON.stringify(t)); process.exit(1); }
const refs = [L.createReferral('A-7K2Q', 'Maria', 'Nina', '', ''), L.createReferral('B-9M4P', 'Tom', 'Zed', '', '')];
L.advanceStatus(refs[0]); L.advanceStatus(refs[0], 'rewarded');
const roi = L.programROI(refs, ledger, 120);
if (roi.rewardedCount !== 1 || roi.estRevenue !== 120 || roi.rewardCost !== 17.5 || roi.net !== 102.5) {
  console.error('roi: ' + JSON.stringify(roi)); process.exit(1);
}
EOF
pass "reward ledger totals + program ROI math"

# 36. killer feature: auto-enroll + bonus punches
node <<'EOF' || fail "auto-enroll + bonus punches"
const L = require('./js/logic.js');
L._resetMemberSeq();
const list = [];
const first = L.autoEnrollMember(list, 'Maria Lopez', { punchesPerCard: 10 });
if (!first.created || list.length !== 1) { console.error('enroll'); process.exit(1); }
const second = L.autoEnrollMember(list, 'MARIA LOPEZ');
if (second.created || second.member !== first.member) { console.error('dedup by name'); process.exit(1); }
if (!L.findMemberByName(list, 'maria lopez') || L.findMemberByName(list, 'nobody')) {
  console.error('findMemberByName'); process.exit(1);
}
// 8 visits on a 10-card, then 2 bonus punches -> reward earned
const m = first.member;
for (let i = 0; i < 8; i++) L.logVisit(m);
if (L.rewardsEarned(m) !== 0) { console.error('pre-bonus'); process.exit(1); }
const ev = L.recordReferralEvent(m, 'completed', 2);
if (!ev.bonus.rewardEarnedNow || ev.bonus.rewardsEarned !== 1) {
  console.error('bonus: ' + JSON.stringify(ev.bonus)); process.exit(1);
}
if (m.referralsCompleted !== 1 || m.bonusPunches !== 2) { console.error('counters'); process.exit(1); }
const prog = L.visitsToNextReward(m);
if (prog.bonusPunches !== 2 || prog.intoCard !== 0 || prog.toGo !== 0) {
  console.error('progress: ' + JSON.stringify(prog)); process.exit(1);
}
// points mode: bonus converts at 10 punches = 1 reward
const pm = L.createMember('Pat Points', { mode: 'points', pointsPerReward: 100 });
const ev2 = L.recordReferralEvent(pm, 'completed', 2);
if (ev2.bonus.pointsBonus !== 20 || pm.points !== 20 || pm.bonusPoints !== 20) {
  console.error('points bonus: ' + JSON.stringify(ev2.bonus)); process.exit(1);
}
L.recordReferralEvent(m, 'sent'); L.recordReferralEvent(m, 'rewarded');
if (m.referralsSent !== 1 || m.referralsRewarded !== 1) { console.error('event counters'); process.exit(1); }
let threw = false;
try { L.recordReferralEvent(m, 'bogus'); } catch (e) { threw = true; }
if (!threw) { console.error('unknown event must throw'); process.exit(1); }
EOF
pass "killer feature: auto-enroll dedups, bonus punches earn a reward, points convert"

# 37. index.html has the referral UI elements
for id in section-referrals ref-business-name ref-bonus ref-give ref-min ref-rule-summary \
    ref-rule-cost ref-offer-preview ref-code-prefix ref-batch-size ref-batch-expiry \
    ref-gen-btn ref-code-list ref-code-datalist ref-form ref-code ref-referrer ref-friend \
    ref-contact ref-channel ref-search ref-status-filter ref-reward-all ref-export \
    ref-referral-rows ref-stale-count ref-stale-rows ref-trend-rows ref-channel-rows \
    ref-podium ref-leaderboard-rows ref-spotlight-box ref-avg-value ref-roi-box \
    ref-tpl-sms ref-tpl-email ref-preview-sms ref-preview-email ref-copy-sms \
    ref-copy-email ref-reset-tpl rf-stat-sent rf-stat-completed rf-stat-rewarded \
    rf-stat-conversion rf-stat-owed ov-refsent ov-refcompleted ov-refsent-sub \
    ov-refcompleted-sub pc-include-ref; do
  if grep -q "id=\"$id\"" index.html; then pass "index.html has #$id"; else fail "index.html missing #$id"; fi
done

# 38. app.js wires the referral engine + merge hooks
for needle in renderReferralAll currentReferralRule advanceReferralAt autoEnrollMember \
    recordReferralEvent personalReferralCode buildReferralRule referralTemplateVars \
    bindReferralEvents migrateLegacyReferralData fillTemplate markAllRewarded \
    findMemberByName followUpText referralsToCSV wireReferralRowButtons; do
  if grep -q "$needle" js/app.js; then pass "app.js wires $needle"; else fail "app.js missing $needle"; fi
done

echo "---"
echo "smoke: $PASS passed, $FAIL failed"
exit "$FAIL"
