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
  'logVisit','rewardsEarned','punchCardSpec','normalizeType','fmtMoney'];
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

echo "---"
echo "smoke: $PASS passed, $FAIL failed"
exit "$FAIL"
