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

echo "---"
echo "e2e: $PASS passed, $FAIL failed"
exit "$FAIL"
