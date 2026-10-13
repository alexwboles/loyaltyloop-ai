#!/usr/bin/env bash
# LoyaltyLoop AI — end-to-end flows through js/logic.js.
# Each flow exercises a realistic user journey across multiple functions.
# Fail fast: first failing flow stops the run. Exit code = FAIL count.
set -u
cd "$(dirname "$0")/.."

PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); echo "PASS: $1"; }
fail() {
  FAIL=$((FAIL + 1))
  echo "FAIL: $1"
  echo "e2e: $PASS passed, $FAIL failed"
  exit "$FAIL"
}

echo "== LoyaltyLoop AI e2e flows =="

# Flow 1: pick business type -> recommendation -> calculator -> net-positive verdict
node <<'EOF' || fail "flow 1: recommend -> calculate -> positive verdict"
const L = require('./js/logic.js');
// Owner of a bakery asks for a program, then sanity-checks the economics.
const rec = L.recommendProgram('bakery');
if (rec.structure !== 'punch_card') process.exit(1);
const econ = L.calculateEconomics({
  avgTicket: 6, visitsPerMonth: 8, marginPct: 65,
  rewardCost: 4, rewardEveryN: 10, visitLiftPct: 15
});
// hand check: lifted=9.2 visits -> cost/mo=4*0.92=3.68
// extra=6*8*0.15*0.65=4.68 ; net=1.00
if (econ.netBenefit !== 1.00) { console.error('net=' + econ.netBenefit); process.exit(1); }
if (!/profitable/i.test(econ.verdict)) { console.error('verdict: ' + econ.verdict); process.exit(1); }
EOF
pass "flow 1: bakery -> punch card -> calculator -> net +\$1.00, profitable verdict"

# Flow 2: member journey — add member, log visits, reward earned at threshold
node <<'EOF' || fail "flow 2: member add -> visits -> reward"
const L = require('./js/logic.js');
L._resetMemberSeq();
const m = L.createMember('Maria Lopez', { punchesPerCard: 8 });
let earnedAt = -1;
for (let i = 1; i <= 20; i++) {
  const r = L.logVisit(m);
  if (r.rewardEarnedNow && earnedAt === -1) earnedAt = i;
}
if (earnedAt !== 8) { console.error('first reward at visit ' + earnedAt); process.exit(1); }
if (m.visits !== 20 || L.rewardsEarned(m) !== 2) { console.error('20 visits -> 2 rewards'); process.exit(1); }
EOF
pass "flow 2: member earns first reward exactly at 8th visit, 2 rewards at 20"

# Flow 3: printable card data from a real recommendation
node <<'EOF' || fail "flow 3: recommendation -> printable card spec"
const L = require('./js/logic.js');
const rec = L.recommendProgram('coffee_shop');
const n = L.RECOMMENDATIONS['coffee_shop'].punchesPerCard; // 10
const spec = L.punchCardSpec('Sunny Side Cafe', n, 'Free drink');
if (spec.cells.length !== 10 || spec.punchesPerCard !== 10) process.exit(1);
if (spec.businessName !== 'Sunny Side Cafe' || spec.rewardLabel !== 'Free drink') process.exit(1);
// grid renders 5 per row -> 10 cells = 2 full rows
if (spec.cells.length % 5 !== 0) { console.error('grid not a multiple of 5'); process.exit(1); }
EOF
pass "flow 3: coffee shop recommendation -> 10-punch printable card spec"

# Flow 4: break-even edge — zero expected lift means the program loses money
node <<'EOF' || fail "flow 4: zero lift -> negative net, break-even named"
const L = require('./js/logic.js');
const r = L.calculateEconomics({
  avgTicket: 5, visitsPerMonth: 8, marginPct: 70,
  rewardCost: 5, rewardEveryN: 10, visitLiftPct: 0
});
if (!(r.netBenefit < 0)) { console.error('net should be negative'); process.exit(1); }
if (r.breakEvenLiftPct !== 16.67) { console.error('be=' + r.breakEvenLiftPct); process.exit(1); }
if (!/16\.67/.test(r.verdict)) { console.error('verdict should name 16.67%: ' + r.verdict); process.exit(1); }
EOF
pass "flow 4: 0% lift -> net negative, verdict names 16.67% break-even"

# Flow 5: unknown business type falls back gracefully, then economics still work
node <<'EOF' || fail "flow 5: unknown type fallback -> calculator"
const L = require('./js/logic.js');
const rec = L.recommendProgram('escape room');
if (rec.fallback !== true) process.exit(1);
if (rec.structure !== 'points') process.exit(1);
if (!rec.rationale || !rec.earn || !rec.redeem) process.exit(1);
const r = L.calculateEconomics({
  avgTicket: 25, visitsPerMonth: 2, marginPct: 80,
  rewardCost: 10, rewardEveryN: 5, visitLiftPct: 20
});
if (typeof r.netBenefit !== 'number' || typeof r.verdict !== 'string') process.exit(1);
EOF
pass "flow 5: unknown type -> points fallback, calculator still runs"

# Flow 6: tier recommendation for a gym carries earn/redeem guidance
node <<'EOF' || fail "flow 6: gym -> tiers with guidance"
const L = require('./js/logic.js');
const rec = L.recommendProgram('gym');
if (rec.structure !== 'tiers') process.exit(1);
if (rec.structureName !== 'Tiers') process.exit(1);
if (!/tier/i.test(rec.earn) || !/guest pass/i.test(rec.redeem)) {
  console.error('tier guidance missing'); process.exit(1);
}
const salon = L.recommendProgram('salon_barber');
if (salon.structure !== 'tiers' || salon.fallback) process.exit(1);
EOF
pass "flow 6: gym & salon -> tiers with earn/redeem guidance"

# Flow 7: impossible economics -> Infinity break-even + honest verdict
node <<'EOF' || fail "flow 7: impossible economics -> Infinity"
const L = require('./js/logic.js');
const r = L.calculateEconomics({
  avgTicket: 5, visitsPerMonth: 8, marginPct: 50,
  rewardCost: 30, rewardEveryN: 10, visitLiftPct: 25
});
if (r.breakEvenLiftPct !== Infinity) { console.error('be=' + r.breakEvenLiftPct); process.exit(1); }
if (!(r.netBenefit < 0)) process.exit(1);
if (!/lower the reward cost|more visits per reward/i.test(r.verdict)) {
  console.error('verdict: ' + r.verdict); process.exit(1);
}
EOF
pass "flow 7: reward costlier than visit profit -> Infinity break-even, honest verdict"

# Flow 8: visit -> earn -> redeem -> available math across the whole journey
node <<'EOF' || fail "flow 8: visit -> earn -> redeem journey"
const L = require('./js/logic.js');
L._resetMemberSeq();
const m = L.createMember('Rosa Diaz', { punchesPerCard: 8 });
for (let i = 0; i < 8; i++) {
  const r = L.logVisit(m, '2026-10-0' + (i + 1) + 'T10:00:00.000Z');
  if (i === 7 && !r.rewardEarnedNow) { console.error('8th visit should earn'); process.exit(1); }
}
if (m.lastVisitAt !== '2026-10-08T10:00:00.000Z') { console.error('lastVisitAt=' + m.lastVisitAt); process.exit(1); }
if (L.rewardsAvailable(m) !== 1) { console.error('available=' + L.rewardsAvailable(m)); process.exit(1); }
L.redeemReward(m);
if (L.rewardsAvailable(m) !== 0 || m.redeemed !== 1) { console.error('after redeem wrong'); process.exit(1); }
// earning a second card restores availability
for (let i = 0; i < 8; i++) L.logVisit(m);
if (L.rewardsAvailable(m) !== 1) { console.error('second card available wrong'); process.exit(1); }
EOF
pass "flow 8: 8 visits earn a reward, lastVisitAt tracked, redeem zeroes availability"

# Flow 9: roster search + sort as the owner would use them
node <<'EOF' || fail "flow 9: search + sort roster"
const L = require('./js/logic.js');
L._resetMemberSeq();
const names = ['Priya Nair', 'Tom Baker', 'priya sharma', 'Zed Cole'];
const roster = names.map((n, i) => {
  const m = L.createMember(n, { punchesPerCard: 10 });
  m.joinedAt = '2026-09-0' + (i + 1) + 'T00:00:00.000Z';
  for (let v = 0; v < i * 3; v++) L.logVisit(m);
  return m;
});
const hits = L.sortMembers(L.searchMembers(roster, 'priya'), 'visits');
if (hits.length !== 2 || hits[0].name !== 'priya sharma') {
  console.error('search+sort: ' + hits.map(h => h.name).join(',')); process.exit(1);
}
const alpha = L.sortMembers(roster, 'name').map(m => m.name);
if (alpha[0] !== 'Priya Nair' || alpha[3] !== 'Zed Cole') { console.error('alpha: ' + alpha); process.exit(1); }
EOF
pass "flow 9: search 'priya' -> 2 hits sorted by visits; A-Z ordering"

# Flow 10: roster -> CSV has one data row per member with correct numbers
node <<'EOF' || fail "flow 10: roster CSV export"
const L = require('./js/logic.js');
L._resetMemberSeq();
const a = L.createMember('Ava', { punchesPerCard: 5 });
const b = L.createMember('Ben', { punchesPerCard: 10 });
for (let i = 0; i < 10; i++) L.logVisit(a);
for (let i = 0; i < 4; i++) L.logVisit(b);
L.redeemReward(a);
const lines = L.membersToCSV([a, b]).split('\n');
if (lines.length !== 3) { console.error('lines=' + lines.length); process.exit(1); }
if (!/^Ava,10,2,1,1,/.test(lines[1])) { console.error('ava: ' + lines[1]); process.exit(1); }
if (!/^Ben,4,0,0,0,/.test(lines[2])) { console.error('ben: ' + lines[2]); process.exit(1); }
EOF
pass "flow 10: membersToCSV rows carry earned/redeemed/available per member"

# Flow 11: win-back journey — lapsed regulars surface for outreach
node <<'EOF' || fail "flow 11: win-back journey"
const L = require('./js/logic.js');
L._resetMemberSeq();
const ref = '2026-10-12';
function mk(name, visits, lastVisitAt) {
  const m = L.createMember(name, { punchesPerCard: 10 });
  m.visits = visits; m.lastVisitAt = lastVisitAt; m.joinedAt = '2026-01-01T00:00:00.000Z';
  return m;
}
// Simulate a year of member history: a champion, a lapsed regular, a fresh face
const champ = mk('Maria', 30, '2026-10-11T09:00:00.000Z');
for (let i = 0; i < 30; i++) L.logVisit(champ, '2026-09-' + String(10 + (i % 18)).padStart(2, '0') + 'T09:00:00.000Z');
const lapsed = mk('Dave', 15, '2026-07-01T09:00:00.000Z');
const fresh = mk('Nina', 1, '2026-10-10T09:00:00.000Z');
const list = [champ, lapsed, fresh];
const risk = L.atRiskMembers(list, 30, ref);
if (risk.length !== 1 || risk[0].member.name !== 'Dave') { console.error('win-back list wrong'); process.exit(1); }
if (L.segmentMember(lapsed, ref) !== 'lapsed') { console.error('Dave should be lapsed'); process.exit(1); }
if (L.segmentMember(champ, ref) !== 'champion') { console.error('Maria should be champion'); process.exit(1); }
// Dave comes back: one visit clears him from the at-risk list
L.logVisit(lapsed, '2026-10-12T09:00:00.000Z');
if (L.atRiskMembers(list, 30, ref).length !== 0) { console.error('Dave still at risk after visit'); process.exit(1); }
EOF
pass "flow 11: lapsed regular flagged for win-back; a new visit clears him"

# Flow 12: reward progress journey — member watches punches fill toward a freebie
node <<'EOF' || fail "flow 12: reward progress journey"
const L = require('./js/logic.js');
L._resetMemberSeq();
const m = L.createMember('Sam', { punchesPerCard: 8 });
for (let i = 1; i <= 6; i++) L.logVisit(m);
let p = L.visitsToNextReward(m);
if (p.toGo !== 2 || p.pct !== 75) { console.error('6/8 progress wrong: ' + JSON.stringify(p)); process.exit(1); }
L.logVisit(m); L.logVisit(m); // 8th visit earns the reward
p = L.visitsToNextReward(m);
if (p.toGo !== 0) { console.error('reward should be earned at 8'); process.exit(1); }
L.redeemReward(m);
const avail = L.rewardsAvailable(m);
if (avail !== 0) { console.error('after redeem, available should be 0'); process.exit(1); }
EOF
pass "flow 12: 6/8 visits -> 75% progress -> reward at 8th -> redeemed"

# Flow 13: points member journey — purchases earn points, redeem deducts
node <<'EOF' || fail "flow 13: points member journey"
const L = require('./js/logic.js');
L._resetMemberSeq();
// A retail shop runs the points program: 1 pt per $1, reward every 200 pts.
const m = L.createMember('Rita Retail', { mode: 'points', pointsPerDollar: 1, pointsPerReward: 200 });
const p1 = L.logPurchase(m, 85.50);
if (p1.pointsEarned !== 85.5 || p1.points !== 85.5) { console.error('p1: ' + JSON.stringify(p1)); process.exit(1); }
const p2 = L.logPurchase(m, 120);
if (!p2.rewardEarnedNow || L.rewardsAvailable(m) !== 1) { console.error('p2: ' + JSON.stringify(p2)); process.exit(1); }
// purchases count as visits too (CSV + stats stay consistent)
if (m.visits !== 2) { console.error('visits should be 2, got ' + m.visits); process.exit(1); }
L.redeemReward(m);
if (m.points !== 5.5 || m.redeemed !== 1 || L.rewardsAvailable(m) !== 0) {
  console.error('redeem: points=' + m.points + ' redeemed=' + m.redeemed); process.exit(1);
}
const prog = L.visitsToNextReward(m);
if (!prog.points || prog.intoCard !== 5 || prog.toGo !== 195) { console.error('prog: ' + JSON.stringify(prog)); process.exit(1); }
EOF
pass "flow 13: points member earns on spend, redeems, balance deducts"

# Flow 14: win-back nudge journey — lapsed member gets a tailored message
node <<'EOF' || fail "flow 14: win-back nudge journey"
const L = require('./js/logic.js');
L._resetMemberSeq();
const ref = '2026-10-12';
function mk(name, visits, lastVisitAt) {
  const m = L.createMember(name, { punchesPerCard: 10 });
  m.visits = visits; m.lastVisitAt = lastVisitAt; m.joinedAt = '2026-01-01T00:00:00.000Z';
  return m;
}
const lapsed = mk('Nina Lapsed', 12, '2026-08-20T10:00:00.000Z'); // 53 days ago
const recent = mk('Rex Recent', 12, '2026-10-10T10:00:00.000Z');
const risk = L.atRiskMembers([lapsed, recent], 30, ref);
if (risk.length !== 1 || risk[0].member.name !== 'Nina Lapsed') { console.error('risk: ' + JSON.stringify(risk.map(r => r.member.name))); process.exit(1); }
const msg = L.winBackMessage(risk[0].member, risk[0].daysSince, 'a free pastry with your coffee', 'Sunrise Bakery');
if (msg.indexOf('Hi Nina') !== 0 || msg.indexOf('53 days') === -1) { console.error('msg: ' + msg); process.exit(1); }
if (msg.indexOf('free pastry with your coffee') === -1 || msg.indexOf('Sunrise Bakery') === -1) { console.error('msg2: ' + msg); process.exit(1); }
// punches progress hook: 12 visits on a 10-card -> 2 into next card -> 8 to go
if (msg.indexOf('8 visits away') === -1) { console.error('hook: ' + msg); process.exit(1); }
EOF
pass "flow 14: at-risk member surfaces, nudge message is personalized"

# Flow 15: CSV import journey — a paper signup sheet becomes members
node <<'EOF' || fail "flow 15: CSV import journey"
const L = require('./js/logic.js');
L._resetMemberSeq();
const sheet = 'name,punches_per_card\nAmy Alvarez,5\nBen Brooks\n\nCara Chen,8\n';
const res = L.membersFromCSV(sheet);
if (res.members.length !== 3 || res.skipped !== 1) { console.error('import: ' + JSON.stringify(res)); process.exit(1); }
// imported members behave like hand-added ones
const amy = res.members[0];
for (let i = 0; i < 5; i++) L.logVisit(amy);
if (L.rewardsEarned(amy) !== 1) { console.error('amy should earn at 5 visits'); process.exit(1); }
const cara = res.members[2];
if (cara.punchesPerCard !== 8) { console.error('cara card size'); process.exit(1); }
// and they appear in the roster export
const csv = L.membersToCSV(res.members);
if (csv.split('\n').length !== 4 || csv.indexOf('Amy Alvarez') === -1) { console.error('csv: ' + csv); process.exit(1); }
EOF
pass "flow 15: CSV import -> working members -> roster export"


# Flow 16: merchant opens the dashboard — every KPI derives from member data
node <<'NODEEOF' || fail "flow 16: overview dashboard journey"
const L = require('./js/logic.js');
L._resetMemberSeq();
// a morning at the register: two new members, a stack of visits, one redemption
const list = [L.createMember('Dana', { punchesPerCard: 10 }), L.createMember('Eli', { mode: 'points', pointsPerReward: 100 })];
const dana = list[0];
const oneMinAgo = new Date(Date.now() - 60000).toISOString();
for (let i = 0; i < 10; i++) L.logVisit(dana, oneMinAgo);
if (L.rewardsAvailable(dana) !== 1) { console.error('dana reward'); process.exit(1); }
L.redeemReward(dana);
const eli = list[1];
L.logPurchase(eli, 120); // logged now — newer than Dana's visits
if (Math.floor(eli.points) !== 120) { console.error('eli points=' + eli.points); process.exit(1); }
// dashboard KPIs
const earned = list.reduce((s, m) => s + L.rewardsEarned(m), 0);
const redeemed = list.reduce((s, m) => s + (Number.isFinite(+m.redeemed) ? +m.redeemed : 0), 0);
if (earned !== 2 || redeemed !== 1) { console.error('kpi: ' + earned + '/' + redeemed); process.exit(1); }
const top = L.sortMembers(list.slice(), 'visits');
if (top[0].name !== 'Dana') { console.error('top'); process.exit(1); }
// recent activity order: Eli's purchase is the newest entry
const acts = list.filter(m => m.lastVisitAt).sort((a, b) => new Date(b.lastVisitAt) - new Date(a.lastVisitAt));
if (acts[0].name !== 'Eli' || acts[1].name !== 'Dana') { console.error('activity'); process.exit(1); }
NODEEOF
pass "flow 16: overview dashboard journey (KPIs, top member, activity order)"

echo "---"
echo "e2e: $PASS passed, $FAIL failed"
exit "$FAIL"
