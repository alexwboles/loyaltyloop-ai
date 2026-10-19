/* LoyaltyLoop AI — pure business logic.
 * Browser + Node compatible. No network calls, no API keys, no DOM access.
 * All math is deterministic and unit-testable.
 */
'use strict';

/* ------------------------------------------------------------------ */
/* Data tables                                                         */
/* ------------------------------------------------------------------ */

const STRUCTURES = {
  punch_card: {
    id: 'punch_card',
    name: 'Punch card',
    tagline: 'Buy N, get 1 free',
    description:
      'A simple stamp/punch card: every visit (or item) earns a punch, and a ' +
      'full card earns a free reward. Dead simple to run on paper — no app needed.'
  },
  points: {
    id: 'points',
    name: 'Points',
    tagline: 'Earn per dollar, redeem for rewards',
    description:
      'Members earn points on every dollar they spend and redeem them for ' +
      'rewards. Flexible across a varied menu or product catalog.'
  },
  tiers: {
    id: 'tiers',
    name: 'Tiers',
    tagline: 'Status levels with growing perks',
    description:
      'Members climb status tiers (e.g. Silver → Gold → Platinum) based on ' +
      'spend or visit frequency, unlocking better perks. Builds identity and ' +
      'long-term emotional loyalty.'
  }
};

const BUSINESS_TYPES = [
  { id: 'coffee_shop',  label: 'Coffee shop',    frequency: 'high', ticket: 'low' },
  { id: 'car_wash',     label: 'Car wash',       frequency: 'high', ticket: 'low' },
  { id: 'bakery',       label: 'Bakery',         frequency: 'high', ticket: 'low' },
  { id: 'restaurant',   label: 'Restaurant',     frequency: 'mid',  ticket: 'mid' },
  { id: 'retail',       label: 'Retail shop',    frequency: 'mid',  ticket: 'mid' },
  { id: 'pet_groomer',  label: 'Pet groomer',    frequency: 'mid',  ticket: 'mid' },
  { id: 'salon_barber', label: 'Salon / barber', frequency: 'mid',  ticket: 'high' },
  { id: 'gym',          label: 'Gym',            frequency: 'high', ticket: 'recurring' }
];

/* Aliases so free-text input maps to a known type. */
const TYPE_ALIASES = {
  coffee: 'coffee_shop',
  cafe: 'coffee_shop',
  coffeeshop: 'coffee_shop',
  espresso: 'coffee_shop',
  carwash: 'car_wash',
  'car_wash': 'car_wash',
  car: 'car_wash',
  bakery: 'bakery',
  bread: 'bakery',
  restaurant: 'restaurant',
  cafe_restaurant: 'restaurant',
  diner: 'restaurant',
  pizzeria: 'restaurant',
  retail: 'retail',
  shop: 'retail',
  store: 'retail',
  boutique: 'retail',
  pet: 'pet_groomer',
  groomer: 'pet_groomer',
  petgroomer: 'pet_groomer',
  salon: 'salon_barber',
  barber: 'salon_barber',
  barbershop: 'salon_barber',
  hair: 'salon_barber',
  gym: 'gym',
  fitness: 'gym',
  yoga: 'gym'
};

/* Recommended program per business type. */
const RECOMMENDATIONS = {
  coffee_shop: {
    structure: 'punch_card',
    rationale:
      'Coffee is a high-frequency, low-ticket habit. A punch card is instant to ' +
      'understand, costs nothing to run, and rewards the daily regular — exactly ' +
      'the customer you want to lock in.',
    earn: '1 punch per drink purchased.',
    redeem: '10 punches = 1 free drink of choice.',
    punchesPerCard: 10
  },
  car_wash: {
    structure: 'punch_card',
    rationale:
      'Car washes are repeat, routine purchases with a low ticket. A punch card ' +
      'turns "I need a wash" into "I go to the same place every time" — the ' +
      'reward feels close because visits are frequent.',
    earn: '1 punch per wash.',
    redeem: '8 punches = 1 free basic wash.',
    punchesPerCard: 8
  },
  bakery: {
    structure: 'punch_card',
    rationale:
      'Bakery customers visit often for small treats. A punch card nudges the ' +
      'weekly buyer to consolidate all their visits with you instead of ' +
      'splitting them across competitors.',
    earn: '1 punch per visit (any purchase).',
    redeem: '9 punches = 1 free pastry or $5 off.',
    punchesPerCard: 9
  },
  restaurant: {
    structure: 'points',
    rationale:
      'Restaurants have varied tickets and menus — a flat punch card undervalues ' +
      'big spenders. Points scale with spend, so a $60 dinner earns more than a ' +
      '$12 lunch, which feels fair and drives larger checks.',
    earn: '1 point per $1 spent.',
    redeem: '100 points = $10 off a future visit.',
    pointsPerDollar: 1,
    pointsPerReward: 100
  },
  retail: {
    structure: 'points',
    rationale:
      'Retail baskets vary wildly in size, so points tied to dollars spent are ' +
      'fairer and more motivating than a per-visit punch. Points also let you run ' +
      'double-point promos on slow days.',
    earn: '1 point per $1 spent.',
    redeem: '200 points = $15 off.',
    pointsPerDollar: 1,
    pointsPerReward: 200
  },
  pet_groomer: {
    structure: 'points',
    rationale:
      'Grooming visits are mid-frequency with a mid-size ticket, and owners ' +
      'spend extra on add-ons (nail trims, de-shedding). Points reward total ' +
      'spend, encouraging those add-ons.',
    earn: '1 point per $1 spent.',
    redeem: '150 points = $20 off a grooming session.',
    pointsPerDollar: 1,
    pointsPerReward: 150
  },
  salon_barber: {
    structure: 'tiers',
    rationale:
      'Salon and barber relationships are personal — clients pick a stylist, not ' +
      'a price. Tiers turn loyalty into status (priority booking, birthday perks), ' +
      'which deepens the relationship instead of just discounting it.',
    earn: 'Tier based on visits in the last 12 months: 0–5 Regular, 6–11 Gold, 12+ Platinum.',
    redeem: 'Gold: 10% off retail products. Platinum: priority booking + free birthday service upgrade.'
  },
  gym: {
    structure: 'tiers',
    rationale:
      'Gyms sell commitment, not transactions. Tiers reward consistency (the ' +
      'behavior that keeps members from cancelling) with status and perks like ' +
      'guest passes — which also bring in referrals.',
    earn: 'Tier based on check-ins per month: 0–7 Member, 8–11 Plus, 12+ Elite.',
    redeem: 'Plus: 1 guest pass/month. Elite: 2 guest passes + merch discount.'
  }
};

/* Fallback recommendation for unknown business types. */
const FALLBACK_RECOMMENDATION = {
  structure: 'points',
  rationale:
    'We don\'t have a tailored playbook for this business type yet, so we ' +
    'recommend points as the safe default: it works for almost any business ' +
    'because rewards scale with what each customer actually spends.',
  earn: '1 point per $1 spent.',
  redeem: '100 points = $10 off a future purchase.'
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toNum(v, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

function fmtMoney(n) {
  const v = round2(Number(n) || 0);
  return '$' + v.toFixed(2);
}

/* Normalize a business-type input to a canonical id (or ''). */
function normalizeType(input) {
  if (input == null) return '';
  const key = String(input)
    .toLowerCase()
    .trim()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z_]/g, '');
  if (!key) return '';
  if (RECOMMENDATIONS[key]) return key;
  if (TYPE_ALIASES[key]) return TYPE_ALIASES[key];
  return key; // unknown but normalized — caller decides fallback
}

function labelOf(typeId) {
  const t = BUSINESS_TYPES.find(function (b) { return b.id === typeId; });
  return t ? t.label : 'General business';
}

/* ------------------------------------------------------------------ */
/* 1. Program recommender                                              */
/* ------------------------------------------------------------------ */

function recommendProgram(businessType) {
  const key = normalizeType(businessType);
  const rec = RECOMMENDATIONS[key];
  if (rec) {
    return {
      businessType: key,
      label: labelOf(key),
      structure: rec.structure,
      structureName: STRUCTURES[rec.structure].name,
      rationale: rec.rationale,
      earn: rec.earn,
      redeem: rec.redeem,
      fallback: false
    };
  }
  return {
    businessType: key || 'unknown',
    label: 'General business',
    structure: FALLBACK_RECOMMENDATION.structure,
    structureName: STRUCTURES[FALLBACK_RECOMMENDATION.structure].name,
    rationale: FALLBACK_RECOMMENDATION.rationale,
    earn: FALLBACK_RECOMMENDATION.earn,
    redeem: FALLBACK_RECOMMENDATION.redeem,
    fallback: true
  };
}

/* ------------------------------------------------------------------ */
/* 2. Reward economics calculator                                      */
/* ------------------------------------------------------------------ */

/* Clamp + coerce raw calculator inputs into sane numbers. */
function sanitizeEconomics(inputs) {
  const i = inputs || {};
  return {
    avgTicket: Math.max(0, toNum(i.avgTicket, 0)),
    visitsPerMonth: Math.max(0, toNum(i.visitsPerMonth, 0)),
    marginPct: Math.min(100, Math.max(0, toNum(i.marginPct, 0))),
    rewardCost: Math.max(0, toNum(i.rewardCost, 0)),
    rewardEveryN: Math.max(1, Math.round(toNum(i.rewardEveryN, 10))),
    visitLiftPct: Math.max(0, toNum(i.visitLiftPct, 0))
  };
}

/*
 * Break-even visit lift %: the lift L (in %) at which net benefit = 0.
 * net(L) = T*V*(L/100)*m − C*V*(1+L/100)/N = 0
 *   → L = 100 * (C/N) / (T*m − C/N)
 * Returns Infinity when the reward costs more per visit than a visit earns
 * (then no lift can ever break even), 0 when rewards are free.
 */
function breakEvenLift(inputs) {
  const s = sanitizeEconomics(inputs);
  const margin = s.marginPct / 100;
  const costPerVisit = s.rewardCost / s.rewardEveryN; // reward cost spread per visit
  const profitPerVisit = s.avgTicket * margin; // gross profit per visit
  if (costPerVisit === 0) return 0;
  const denom = profitPerVisit - costPerVisit;
  if (denom <= 0) return Infinity;
  return round2((100 * costPerVisit) / denom);
}

function buildVerdict(o) {
  const net = o.netBenefit;
  const be = o.breakEvenLiftPct;
  const beText = be === Infinity
    ? 'no amount of extra visits'
    : 'a ' + be.toFixed(2) + '% visit lift';
  if (net > 0.005) {
    return (
      'Looks profitable: at your expected ' + o.inputs.visitLiftPct + '% visit lift, ' +
      'the program adds about ' + fmtMoney(net) + ' of net profit per member per month ' +
      'after reward costs. Break-even only needs ' + beText + ' — you are comfortably above it. ' +
      'Run it.'
    );
  }
  if (net < -0.005) {
    let s =
      'Not profitable at these settings: you would lose about ' + fmtMoney(-net) +
      ' per member per month. To break even you need ' + beText + '. ';
    if (be === Infinity) {
      s += 'In fact the reward costs more per visit than you earn per visit, so extra ' +
        'visits can never cover it — lower the reward cost or require more visits per reward.';
    } else {
      s += 'Either aim for a bigger visit lift (marketing, reminders) or make the ' +
        'reward cheaper / harder to earn.';
    }
    return s;
  }
  return (
    'Roughly break-even: the program neither makes nor loses money at these ' +
    'settings. It may still be worth it for the loyalty and word-of-mouth, but ' +
    'tighten the reward cost or push visit lift to make it clearly pay.'
  );
}

function calculateEconomics(inputs) {
  const s = sanitizeEconomics(inputs);
  const margin = s.marginPct / 100;
  const liftedVisits = s.visitsPerMonth * (1 + s.visitLiftPct / 100);
  // Members earn (liftedVisits / N) rewards per month on average.
  const rewardCostPerMemberMonth = round2(s.rewardCost * (liftedVisits / s.rewardEveryN));
  const extraGrossProfit = round2(s.avgTicket * s.visitsPerMonth * (s.visitLiftPct / 100) * margin);
  const netBenefit = round2(extraGrossProfit - rewardCostPerMemberMonth);
  const be = breakEvenLift(s);
  const out = {
    inputs: s,
    rewardCostPerMemberMonth: rewardCostPerMemberMonth,
    extraGrossProfit: extraGrossProfit,
    netBenefit: netBenefit,
    breakEvenLiftPct: be,
    verdict: ''
  };
  out.verdict = buildVerdict(out);
  return out;
}

/* ------------------------------------------------------------------ */
/* 3. Printable card spec                                              */
/* ------------------------------------------------------------------ */

function punchCardSpec(businessName, punchesPerCard, rewardLabel) {
  const n = Math.max(1, Math.round(toNum(punchesPerCard, 10)));
  const name = String(businessName == null ? '' : businessName).trim() || 'Your Business';
  const reward = String(rewardLabel == null ? '' : rewardLabel).trim() || 'Free reward';
  const cells = [];
  for (let k = 1; k <= n; k++) cells.push(k);
  return {
    businessName: name,
    punchesPerCard: n,
    rewardLabel: reward,
    cells: cells
  };
}

/* ------------------------------------------------------------------ */
/* 4. Member tracker                                                   */
/* ------------------------------------------------------------------ */

let _memberSeq = 0;

function createMember(name, opts) {
  opts = opts || {};
  const clean = String(name == null ? '' : name).trim();
  if (!clean) throw new Error('createMember: name is required');
  const punchesPerCard = Math.max(1, Math.round(toNum(opts.punchesPerCard, 10)));
  const mode = opts.mode === 'points' ? 'points' : 'punches';
  _memberSeq += 1;
  return {
    id: opts.id != null ? String(opts.id) : 'm_' + _memberSeq + '_' + Date.now().toString(36),
    name: clean,
    mode: mode, // 'punches' = buy-N-get-1 card; 'points' = earn per dollar spent
    visits: 0,
    punchesPerCard: punchesPerCard,
    points: 0, // points-mode balance
    pointsPerDollar: Math.max(0.01, toNum(opts.pointsPerDollar, 1)),
    pointsPerReward: Math.max(1, Math.round(toNum(opts.pointsPerReward, 100))),
    redeemed: 0,       // rewards the member has cashed in
    lastVisitAt: null, // ISO string of the most recent logged visit
    joinedAt: new Date().toISOString(),
    // Referral merge: referrers auto-enroll as members; completed referrals
    // award bonusPunches (punch mode folds them into rewards math).
    bonusPunches: 0,
    bonusPoints: 0, // points-mode bonus points from referrals
    referralCode: opts.referralCode != null ? String(opts.referralCode) : '',
    referredBy: opts.referredBy != null ? String(opts.referredBy).trim() : '',
    referralsSent: 0,
    referralsCompleted: 0,
    referralsRewarded: 0
  };
}

/* Number of full rewards a member has earned.
 * Punch mode: floor((visits + bonusPunches) / punchesPerCard).
 * Points mode: floor(points / pointsPerReward). */
function rewardsEarned(member) {
  if (!member || typeof member.visits !== 'number') return 0;
  if (member.mode === 'points') {
    const per = Math.max(1, Math.round(toNum(member.pointsPerReward, 100)));
    const pts = Math.max(0, toNum(member.points, 0));
    return Math.floor(pts / per);
  }
  if (!member.punchesPerCard) return 0;
  const bonus = Math.max(0, Math.floor(toNum(member.bonusPunches, 0)));
  return Math.floor((Math.max(0, member.visits) + bonus) / member.punchesPerCard);
}

/* Rewards earned but not yet redeemed (never negative; tolerates old records). */
function rewardsAvailable(member) {
  const earned = rewardsEarned(member);
  const redeemed = member && Number.isFinite(Number(member.redeemed)) ? Number(member.redeemed) : 0;
  return Math.max(0, earned - redeemed);
}

/* Cash in one reward. Mutates the member. Throws when none are available.
 * Points mode also deducts the reward's point cost from the balance. */
function redeemReward(member) {
  if (!member || typeof member.visits !== 'number') {
    throw new Error('redeemReward: invalid member object');
  }
  if (rewardsAvailable(member) < 1) {
    throw new Error('redeemReward: no rewards available to redeem');
  }
  if (member.mode === 'points') {
    const per = Math.max(1, Math.round(toNum(member.pointsPerReward, 100)));
    member.points = Math.max(0, toNum(member.points, 0) - per);
  }
  member.redeemed = (Number.isFinite(Number(member.redeemed)) ? Number(member.redeemed) : 0) + 1;
  return {
    member: member,
    redeemed: member.redeemed,
    rewardsAvailable: rewardsAvailable(member)
  };
}

/* Log one visit. Mutates + returns the member, and whether a reward was earned.
 * atISO is the visit timestamp (ISO string); defaults to now. */
function logVisit(member, atISO) {
  if (!member || typeof member.visits !== 'number') {
    throw new Error('logVisit: invalid member object');
  }
  const before = rewardsEarned(member);
  member.visits += 1;
  member.lastVisitAt = atISO || new Date().toISOString();
  const after = rewardsEarned(member);
  return {
    member: member,
    visits: member.visits,
    lastVisitAt: member.lastVisitAt,
    rewardEarnedNow: after > before,
    rewardsEarned: after
  };
}

/* Log a purchase for a points-mode member: counts as a visit AND earns
 * pointsPerDollar points per dollar spent. Throws on bad member or spend. */
function logPurchase(member, spend, atISO) {
  if (!member || typeof member.visits !== 'number') {
    throw new Error('logPurchase: invalid member object');
  }
  const amount = toNum(spend, NaN);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('logPurchase: spend must be a positive number');
  }
  if (member.mode !== 'points') {
    throw new Error('logPurchase: member is not on a points program');
  }
  const before = rewardsEarned(member);
  const earned = Math.round(amount * Math.max(0.01, toNum(member.pointsPerDollar, 1)) * 100) / 100;
  member.points = round2(toNum(member.points, 0) + earned);
  member.visits += 1;
  member.lastVisitAt = atISO || new Date().toISOString();
  const after = rewardsEarned(member);
  return {
    member: member,
    spend: round2(amount),
    pointsEarned: earned,
    points: member.points,
    rewardEarnedNow: after > before,
    rewardsEarned: after
  };
}

/* Case-insensitive substring search over member names. Empty q returns all. */
function searchMembers(list, q) {
  const query = String(q == null ? '' : q).trim().toLowerCase();
  if (!query) return (list || []).slice();
  return (list || []).filter(function (m) {
    return String(m.name || '').toLowerCase().indexOf(query) !== -1;
  });
}

/* Sort a member list without mutating it.
 * key: 'name' (A–Z) | 'visits' (most visits first) | 'newest' (joined last first). */
function sortMembers(list, key) {
  const arr = (list || []).slice();
  if (key === 'name') {
    arr.sort(function (a, b) {
      return String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase());
    });
  } else if (key === 'visits') {
    arr.sort(function (a, b) { return (b.visits || 0) - (a.visits || 0); });
  } else { // 'newest'
    arr.sort(function (a, b) {
      return String(b.joinedAt || '').localeCompare(String(a.joinedAt || ''));
    });
  }
  return arr;
}

/* CSV export of the member roster (header + one row per member). */
function membersToCSV(list) {
  const escCell = function (v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rows = [['name', 'visits', 'rewards_earned', 'rewards_redeemed', 'rewards_available', 'last_visit', 'joined']];
  (list || []).forEach(function (m) {
    rows.push([
      m.name, m.visits, rewardsEarned(m),
      Number.isFinite(Number(m.redeemed)) ? Number(m.redeemed) : 0,
      rewardsAvailable(m),
      m.lastVisitAt || '',
      (m.joinedAt || '').slice(0, 10)
    ]);
  });
  return rows.map(function (r) { return r.map(escCell).join(','); }).join('\n');
}

/* Reset the internal id counter (useful for tests). */
function _resetMemberSeq() {
  _memberSeq = 0;
}

/* ------------------------------------------------------------------ */
/* 5. Win-back: at-risk members, segments, reward progress              */
/* ------------------------------------------------------------------ */

/* Days since a member's last visit (falls back to join date when never
 * visited). Null when no date is recorded at all. */
function daysSinceVisit(member, refISO) {
  var ref = refISO ? new Date(refISO + 'T12:00:00') : new Date();
  var stamp = (member && member.lastVisitAt) || (member && member.joinedAt);
  if (!stamp) return null;
  var d = new Date(stamp);
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((ref - d) / 86400000));
}

/* Members who haven't visited in `days` or more — win-back candidates,
 * most-lapsed first. Default window: 30 days. */
function atRiskMembers(list, days, refISO) {
  var threshold = Math.max(1, Math.round(toNum(days, 30)));
  return (list || [])
    .map(function (m) { return { member: m, daysSince: daysSinceVisit(m, refISO) }; })
    .filter(function (x) { return x.daysSince != null && x.daysSince >= threshold; })
    .sort(function (a, b) { return b.daysSince - a.daysSince; });
}

/* Member segment: champion (20+ visits), regular (8+), occasional (2+),
 * new (under 2), lapsed (no visit in 45+ days). */
function segmentMember(member, refISO) {
  var visits = Math.max(0, Math.floor(toNum(member && member.visits, 0)));
  var since = daysSinceVisit(member, refISO);
  if (since != null && since >= 45 && visits > 0) return 'lapsed';
  if (visits >= 20) return 'champion';
  if (visits >= 8) return 'regular';
  if (visits >= 2) return 'occasional';
  return 'new';
}

function segmentCounts(list, refISO) {
  var counts = { champion: 0, regular: 0, occasional: 0, new: 0, lapsed: 0 };
  (list || []).forEach(function (m) { counts[segmentMember(m, refISO)]++; });
  return counts;
}

/* Progress toward the next free reward: {perCard, intoCard, toGo, pct}.
 * Punch mode: punches on the current card. Points mode: points toward the
 * next reward's point cost. */
function visitsToNextReward(member) {
  if (member && member.mode === 'points') {
    var per = Math.max(1, Math.round(toNum(member.pointsPerReward, 100)));
    var pts = Math.max(0, toNum(member.points, 0));
    var into = Math.floor(pts) % per;
    var toGo = into === 0 && pts > 0 ? 0 : per - into;
    return { perCard: per, visits: Math.max(0, Math.floor(toNum(member.visits, 0))),
             intoCard: into, toGo: toGo, pct: Math.round((into / per) * 100),
             points: true };
  }
  var perCard = Math.max(1, Math.round(toNum(member && member.punchesPerCard, 10)));
  var visits = Math.max(0, Math.floor(toNum(member && member.visits, 0)));
  var bonus = Math.max(0, Math.floor(toNum(member && member.bonusPunches, 0)));
  var effective = visits + bonus; // referral bonus punches count as punches
  var intoCard = effective % perCard;
  var toGo2 = intoCard === 0 ? perCard : perCard - intoCard; // fresh card still needs a full card
  if (effective > 0 && intoCard === 0) toGo2 = 0;  // reward just earned
  return { perCard: perCard, visits: visits, bonusPunches: bonus, intoCard: intoCard, toGo: toGo2,
           pct: Math.round((intoCard / perCard) * 100), points: false };
}

/* Win-back nudge: a ready-to-send personal message for a lapsed member.
 * offerText is the incentive ("10% off your next visit"); businessName signs it. */
function winBackMessage(member, daysSince, offerText, businessName) {
  var name = String((member && member.name) || 'there').trim() || 'there';
  var first = name.split(/\s+/)[0];
  var days = Math.max(1, Math.round(toNum(daysSince, 30)));
  var offer = String(offerText == null ? '' : offerText).trim() || 'a little thank-you on your next visit';
  var biz = String(businessName == null ? '' : businessName).trim() || 'us';
  var prog = visitsToNextReward(member);
  var hook = '';
  if (member && member.mode === 'points' && prog.toGo > 0) {
    hook = ' You\'re only ' + prog.toGo + ' points away from a free reward — don\'t let them go to waste.';
  } else if (prog.toGo > 0 && (!member || member.mode !== 'points')) {
    hook = ' You\'re only ' + prog.toGo + ' visit' + (prog.toGo === 1 ? '' : 's') + ' away from a free reward.';
  }
  return 'Hi ' + first + ' — we haven\'t seen you in ' + days + ' days and we miss you!' +
    ' Here\'s ' + offer + '.' + hook + ' Hope to see you soon — ' + biz + '.';
}

/* Parse a member CSV into createMember-ready objects (not persisted).
 * Accepts a header row (name[,punches_per_card] / name[,punches]) or plain
 * one-name-per-line files. Quoted fields (commas, escaped "") are handled.
 * Blank lines are skipped; the summary counts them. */
function splitCsvRow(line) {
  var cells = [];
  var cur = '';
  var inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      cells.push(cur); cur = '';
    } else cur += ch;
  }
  cells.push(cur);
  return cells.map(function (c) { return c.trim(); });
}

function membersFromCSV(text) {
  var lines = String(text == null ? '' : text).replace(/^\uFEFF/, '').split(/\r?\n/);
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  var members = [];
  var skipped = 0;
  var start = 0;
  var punchesIdx = -1;
  if (lines.length) {
    var first = splitCsvRow(lines[0]).map(function (c) { return c.toLowerCase(); });
    if (first[0] === 'name') {
      start = 1;
      punchesIdx = first.indexOf('punches_per_card') !== -1 ? first.indexOf('punches_per_card')
        : first.indexOf('punches');
    }
  }
  for (var i = start; i < lines.length; i++) {
    if (!lines[i].trim()) { skipped++; continue; }
    var cells = splitCsvRow(lines[i]);
    var name = cells[0] || '';
    if (!name) { skipped++; continue; }
    var opts = {};
    if (punchesIdx !== -1 && cells[punchesIdx]) {
      opts.punchesPerCard = Math.max(1, Math.round(toNum(cells[punchesIdx], 10)));
    }
    try {
      members.push(createMember(name, opts));
    } catch (e) { skipped++; }
  }
  return { members: members, skipped: skipped };
}

/* ------------------------------------------------------------------ */
/* 6. Referral engine (merged from ReferralPilot AI)                    */
/* One roster: loyalty members ARE the referrers. Referrals move        */
/* sent -> completed -> rewarded; completed referrals award the        */
/* referrer bonus punches and auto-enroll referrers as members.         */
/* ------------------------------------------------------------------ */

var CODE_SUFFIX_LEN = 4;
var CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no lookalikes (0/O, 1/I/L)

var STATUS = {
  SENT: 'sent',
  COMPLETED: 'completed',
  REWARDED: 'rewarded'
};

// Allowed one-step transitions; no skipping.
var ALLOWED_TRANSITIONS = {
  sent: ['completed'],
  completed: ['rewarded'],
  rewarded: []
};

function normalizePrefix(prefix) {
  return String(prefix === null || prefix === undefined ? '' : prefix)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 16) || 'REF';
}

function randomSegment(len, rand) {
  rand = rand || Math.random;
  var out = '';
  for (var i = 0; i < len; i++) {
    out += CODE_ALPHABET.charAt(Math.floor(rand() * CODE_ALPHABET.length));
  }
  return out;
}

// Single referral code, e.g. "MAIN-ST-7K2Q".
function generateCode(prefix, rand) {
  return normalizePrefix(prefix) + '-' + randomSegment(CODE_SUFFIX_LEN, rand);
}

// Batch of n unique codes. Throws on invalid n.
function generateBatch(prefix, n, rand) {
  n = Math.floor(Number(n));
  if (!isFinite(n) || n < 1 || n > 1000) {
    throw new Error('Batch size must be an integer between 1 and 1000.');
  }
  var codes = [];
  var seen = {};
  var guard = 0;
  while (codes.length < n && guard < n * 50) {
    guard++;
    var code = generateCode(prefix, rand);
    if (!seen[code]) {
      seen[code] = true;
      codes.push(code);
    }
  }
  if (codes.length < n) {
    throw new Error('Could not generate ' + n + ' unique codes.');
  }
  return codes;
}

// Code format check: PREFIX-XXXX where XXXX is 4 chars from the alphabet.
function isValidCodeFormat(code) {
  return /^[A-Z0-9-]{1,17}-[A-Z0-9]{4}$/.test(String(code)) &&
    new RegExp('^[' + CODE_ALPHABET.replace(/\]/g, '') + ']{4}$').test(String(code).slice(-4));
}

// A personal referral code for a member, e.g. "MARIA-LOPEZ-7K2Q".
function personalReferralCode(name, rand) {
  var prefix = normalizePrefix(String(name == null ? '' : name).trim()) || 'MEMBER';
  return generateCode(prefix, rand);
}

var REWARD_TYPES = {
  dollars: { label: '$ off', kind: 'money' },
  percent: { label: '% off', kind: 'percent' },
  freebie: { label: 'freebie', kind: 'item' }
};

function money(n) {
  var v = Number(n);
  return '$' + (Math.floor(v) === v ? String(v) : v.toFixed(2));
}

// Legacy rule shape (ReferralPilot): {give, get, type, minPurchase}.
function buildRule(opts) {
  opts = opts || {};
  var give = Math.max(0, Number(opts.give) || 0);
  var get = Math.max(0, Number(opts.get) || 0);
  var type = REWARD_TYPES[opts.type] ? opts.type : 'dollars';
  var minPurchase = Math.max(0, Number(opts.minPurchase) || 0);

  var giveText, getText, costPerReferral;
  if (type === 'percent') {
    giveText = give + '% off';
    getText = get + '% off';
    var aov = minPurchase > 0 ? minPurchase * 2 : 50;
    costPerReferral = (get / 100) * aov;
  } else if (type === 'freebie') {
    giveText = 'a free item (worth up to ' + money(give) + ')';
    getText = 'a free item (worth up to ' + money(get) + ')';
    costPerReferral = get;
  } else {
    giveText = money(give) + ' off';
    getText = money(get) + ' off';
    costPerReferral = get;
  }

  var summary = 'Give ' + giveText + ', get ' + getText;
  if (minPurchase > 0) {
    summary += ', min purchase ' + money(minPurchase);
  }

  return {
    give: give,
    get: get,
    type: type,
    typeLabel: REWARD_TYPES[type].label,
    minPurchase: minPurchase,
    summary: summary,
    costPerReferral: Math.round(costPerReferral * 100) / 100
  };
}

// Merged referral rule: friend-side give/type/min + referrer-side bonus punches.
// {give, type, minPurchase, bonusPunches} -> {summary, costPerReferral, ...}
function buildReferralRule(opts) {
  opts = opts || {};
  var give = Math.max(0, Number(opts.give) || 0);
  var type = REWARD_TYPES[opts.type] ? opts.type : 'dollars';
  var minPurchase = Math.max(0, Number(opts.minPurchase) || 0);
  var bonusPunches = Math.max(1, Math.round(toNum(opts.bonusPunches, 2)));

  var giveText, costPerReferral;
  if (type === 'percent') {
    giveText = give + '% off';
    // Percent cost depends on average order value; estimate assumes AOV = 2x min purchase or $50 fallback.
    var aov = minPurchase > 0 ? minPurchase * 2 : 50;
    costPerReferral = (give / 100) * aov;
  } else if (type === 'freebie') {
    giveText = 'a free item (worth up to ' + money(give) + ')';
    costPerReferral = give; // cost ~= item value
  } else {
    giveText = money(give) + ' off';
    costPerReferral = give;
  }

  var summary = 'Give friends ' + giveText;
  if (minPurchase > 0) {
    summary += ', min purchase ' + money(minPurchase);
  }
  summary += ' — referrers earn ' + bonusPunches + ' bonus punch' +
    (bonusPunches === 1 ? '' : 'es') + ' per completed referral';

  return {
    give: give,
    type: type,
    typeLabel: REWARD_TYPES[type].label,
    minPurchase: minPurchase,
    bonusPunches: bonusPunches,
    giveText: giveText,
    summary: summary,
    costPerReferral: Math.round(costPerReferral * 100) / 100
  };
}

// ---- Referral tracker ----

var CHANNELS = ['sms', 'email', 'in-person', 'social', 'other'];
var CHANNEL_LABELS = {
  'sms': 'SMS', 'email': 'Email', 'in-person': 'In person',
  'social': 'Social', 'other': 'Other', 'unknown': 'Not recorded'
};

function normalizeChannel(c) {
  c = String(c === null || c === undefined ? '' : c).trim().toLowerCase();
  return CHANNELS.indexOf(c) >= 0 ? c : '';
}

// Referral shape: {code, referrerName, friendName, friendContact, channel, status}
function createReferral(code, referrerName, friendName, friendContact, channel) {
  code = String(code || '').trim().toUpperCase();
  if (!code) throw new Error('A referral code is required.');
  if (!isValidCodeFormat(code)) throw new Error('Invalid referral code format: ' + code);
  var ref = String(referrerName || '').trim();
  var friend = String(friendName || '').trim();
  if (!ref) throw new Error('Referrer name is required.');
  if (!friend) throw new Error('Friend name is required.');
  return {
    code: code,
    referrerName: ref,
    friendName: friend,
    friendContact: String(friendContact || '').trim(),
    channel: normalizeChannel(channel),
    status: STATUS.SENT,
    createdAt: new Date().toISOString(),
    history: [{ status: STATUS.SENT, at: new Date().toISOString() }]
  };
}

function canAdvance(referral) {
  return (ALLOWED_TRANSITIONS[referral.status] || []).length > 0;
}

function nextStatus(referral) {
  var allowed = ALLOWED_TRANSITIONS[referral.status] || [];
  return allowed.length ? allowed[0] : null;
}

// Advance one step in the pipeline: sent -> completed -> rewarded.
// Throws if the transition is illegal (e.g. sent -> rewarded skips a step).
function advanceStatus(referral, target) {
  var from = referral.status;
  var allowed = ALLOWED_TRANSITIONS[from] || [];
  target = target || nextStatus(referral);
  if (!target || allowed.indexOf(target) === -1) {
    throw new Error(
      'Illegal status transition: "' + from + '" -> "' + target + '". ' +
      'Referrals must move one step at a time (sent -> completed -> rewarded).'
    );
  }
  referral.status = target;
  referral.history.push({ status: target, at: new Date().toISOString() });
  return referral;
}

function countByStatus(referrals) {
  var counts = { sent: 0, completed: 0, rewarded: 0 };
  referrals.forEach(function (r) {
    if (counts[r.status] !== undefined) counts[r.status]++;
  });
  return counts;
}

// ---- Leaderboard ----
// Ranked by completed referrals, tiebreak = rewarded count, then name A-Z.
function leaderboard(referrals, rule) {
  var map = {};
  referrals.forEach(function (r) {
    var key = r.referrerName;
    if (!map[key]) {
      map[key] = { name: key, sent: 0, completed: 0, rewarded: 0 };
    }
    map[key].sent++;
    if (r.status === STATUS.COMPLETED || r.status === STATUS.REWARDED) map[key].completed++;
    if (r.status === STATUS.REWARDED) map[key].rewarded++;
  });
  var rows = Object.keys(map).map(function (k) { return map[k]; });
  var getAmount = rule && isFinite(Number(rule.get)) ? Number(rule.get) : 0;
  rows.forEach(function (row) {
    row.rewardsPaid = Math.round(row.rewarded * getAmount * 100) / 100;
    row.tier = tierFor(row.completed).name;
  });
  rows.sort(function (a, b) {
    if (b.completed !== a.completed) return b.completed - a.completed;
    if (b.rewarded !== a.rewarded) return b.rewarded - a.rewarded;
    return a.name.localeCompare(b.name);
  });
  return rows;
}

// ---- Share-message templates ----
var DEFAULT_TEMPLATES = {
  sms: 'Hey! {business} has a referral deal: your friend gets {give}, and you get {get} when they join. Use code {code} — let\'s both win!',
  email: 'Subject: You\'ve been invited to {business}\n\nHi there,\n\nYour friend thinks you\'ll love {business}. Sign up with referral code {code} and you\'ll get {give}. They\'ll get {get} as a thank-you.\n\nSee you soon,\nThe {business} team'
};

// Fill {business}, {code}, {give}, {get} placeholders. Unknown placeholders left as-is.
function fillTemplate(template, vars) {
  vars = vars || {};
  return String(template).replace(/\{(business|code|give|get)\}/g, function (match, key) {
    var v = vars[key];
    return v === undefined || v === null ? match : String(v);
  });
}

// Build template vars from a rule + current selections (legacy shape).
function templateVarsFromRule(rule, business, code) {
  var r = rule || buildRule({});
  var giveVal = r.type === 'percent' ? r.give + '% off' :
    r.type === 'freebie' ? 'a free item (up to ' + money(r.give) + ')' : money(r.give) + ' off';
  var getVal = r.type === 'percent' ? r.get + '% off' :
    r.type === 'freebie' ? 'a free item (up to ' + money(r.get) + ')' : money(r.get) + ' off';
  return {
    business: business || 'our business',
    code: code || 'YOURCODE',
    give: giveVal,
    get: getVal
  };
}

// Template vars for the merged rule: {get} = the referrer's bonus punches.
function referralTemplateVars(rule, business, code) {
  var r = rule || buildReferralRule({});
  var bp = Math.max(1, Math.round(toNum(r.bonusPunches, 2)));
  return {
    business: business || 'our business',
    code: code || 'YOURCODE',
    give: r.giveText || '',
    get: bp + ' bonus punch' + (bp === 1 ? '' : 'es')
  };
}

// ---- Stats bar ----
function computeStats(referrals, rule) {
  var counts = countByStatus(referrals);
  var total = referrals.length;
  var converted = counts.completed + counts.rewarded;
  var conversion = total > 0 ? converted / total : 0;
  // Completed but not yet rewarded = owed.
  var owedCount = referrals.filter(function (r) { return r.status === STATUS.COMPLETED; }).length;
  var getAmount = rule && isFinite(Number(rule.get)) ? Number(rule.get) : 0;
  return {
    totalSent: total,
    completed: counts.completed,
    rewarded: counts.rewarded,
    conversionRate: Math.round(conversion * 1000) / 10, // percent, 1 decimal
    rewardsOwedCount: owedCount,
    rewardsOwedValue: Math.round(owedCount * getAmount * 100) / 100
  };
}

// ---- CSV export ----
function csvCell(v) {
  var s = String(v === undefined || v === null ? '' : v);
  return (/[",\n]/.test(s)) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function referralsToCSV(referrals) {
  var lines = [[
    'Code', 'Referrer', 'Friend', 'Friend contact', 'Status', 'Created at'
  ].map(csvCell).join(',')];
  (referrals || []).forEach(function (r) {
    lines.push([r.code, r.referrerName, r.friendName, r.friendContact, r.status, r.createdAt].map(csvCell).join(','));
  });
  return lines.join('\n');
}

// ---- Search + status filter ----
function filterReferrals(referrals, query, status) {
  var q = String(query === undefined || query === null ? '' : query).trim().toLowerCase();
  return (referrals || []).filter(function (r) {
    if (status && r.status !== status) return false;
    if (!q) return true;
    var hay = [r.code, r.referrerName, r.friendName, r.friendContact].join(' ').toLowerCase();
    return q.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  });
}

// ---- Duplicate detection ----
// Same friend contact (email/phone) or same friend name => likely a duplicate referral.
function findDuplicate(referrals, friendName, friendContact) {
  var fn = String(friendName || '').trim().toLowerCase();
  var fc = String(friendContact || '').trim().toLowerCase();
  if (!fn && !fc) return null;
  var hit = null;
  (referrals || []).forEach(function (r) {
    if (hit) return;
    var sameContact = fc && String(r.friendContact || '').trim().toLowerCase() === fc;
    var sameName = fn && String(r.friendName || '').trim().toLowerCase() === fn;
    if (sameContact || sameName) hit = r;
  });
  return hit;
}

// ---- Bulk reward ----
// Advance every completed referral one step to rewarded. Returns count rewarded.
function markAllRewarded(referrals) {
  var count = 0;
  (referrals || []).forEach(function (r) {
    if (r.status === STATUS.COMPLETED) { advanceStatus(r, STATUS.REWARDED); count++; }
  });
  return count;
}

// ---- Monthly conversion trend ----
function monthKey(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2);
}

function conversionByMonth(referrals) {
  var buckets = {};
  (referrals || []).forEach(function (r) {
    var k = monthKey(r.createdAt) || 'unknown';
    if (!buckets[k]) buckets[k] = { month: k, sent: 0, converted: 0 };
    buckets[k].sent++;
    if (r.status === STATUS.COMPLETED || r.status === STATUS.REWARDED) buckets[k].converted++;
  });
  return Object.keys(buckets).sort().map(function (k) {
    var b = buckets[k];
    b.conversionRate = b.sent ? Math.round(b.converted / b.sent * 1000) / 10 : 0;
    return b;
  });
}

// ---- Conversion by channel ----
// Which outreach channel converts best? Sorted by conversion rate desc.
function conversionByChannel(referrals) {
  var buckets = {};
  (referrals || []).forEach(function (r) {
    var ch = normalizeChannel(r.channel) || 'unknown';
    if (!buckets[ch]) buckets[ch] = { channel: ch, label: CHANNEL_LABELS[ch] || ch, sent: 0, converted: 0 };
    buckets[ch].sent++;
    if (r.status === STATUS.COMPLETED || r.status === STATUS.REWARDED) buckets[ch].converted++;
  });
  var out = Object.keys(buckets).map(function (k) {
    var b = buckets[k];
    b.conversionRate = b.sent ? Math.round(b.converted / b.sent * 1000) / 10 : 0;
    return b;
  });
  out.sort(function (a, b) { return b.conversionRate - a.conversionRate || b.sent - a.sent; });
  return out;
}

// ---- Referrer tiers ----
// Bronze <3, Silver 3+, Gold 6+, Platinum 12+ completed referrals.
var TIERS = [
  { min: 0, name: 'Bronze' },
  { min: 3, name: 'Silver' },
  { min: 6, name: 'Gold' },
  { min: 12, name: 'Platinum' }
];

function tierFor(completed) {
  completed = Math.max(0, Math.floor(Number(completed) || 0));
  var tier = TIERS[0], next = null;
  for (var i = 0; i < TIERS.length; i++) {
    if (completed >= TIERS[i].min) tier = TIERS[i];
    else { next = TIERS[i]; break; }
  }
  return {
    name: tier.name,
    completed: completed,
    nextTier: next ? next.name : null,
    needed: next ? next.min - completed : 0
  };
}

// ---- Stale-referral follow-up ----
// Referrals stuck in "sent" longer than maxAgeDays (default 21), oldest first,
// so the business can nudge friends who never converted.
function staleReferrals(referrals, maxAgeDays, now) {
  var days = Math.max(1, Math.floor(Number(maxAgeDays) || 21));
  var t = now ? new Date(now).getTime() : Date.now();
  if (isNaN(t)) t = Date.now();
  var cutoff = t - days * 86400000;
  return (referrals || []).filter(function (r) {
    if (r.status !== STATUS.SENT) return false;
    var at = new Date(r.createdAt).getTime();
    return !isNaN(at) && at < cutoff;
  }).sort(function (a, b) {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

// Copy-ready nudge message for a stale referral.
function followUpText(ref, business) {
  business = business || 'our business';
  return 'Hi ' + ref.friendName + ' — just checking in! Your friend ' + ref.referrerName +
    ' shared a referral for ' + business + ' with you. Use code ' + ref.code +
    ' and you will get the referral deal. Let me know if you have any questions!';
}

// ---- Code batch expiry ------------------------------------------
// A batch: {id, prefix, codes[], createdAt, expiresAt}. Legacy flat codes never expire.
function makeBatch(prefix, n, expiresAt, rand) {
  var codes = generateBatch(prefix, n, rand);
  return {
    id: 'batch_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36),
    prefix: normalizePrefix(prefix),
    codes: codes,
    createdAt: new Date().toISOString().slice(0, 10),
    expiresAt: expiresAt || ''
  };
}
// Expiry date of a code: from its batch, or null (never expires / unknown).
function codeExpiry(batches, code) {
  for (var i = 0; i < (batches || []).length; i++) {
    var b = batches[i];
    if (b.codes && b.codes.indexOf(code) !== -1) return b.expiresAt || null;
  }
  return null;
}
function isCodeExpired(batches, code, todayISO) {
  var exp = codeExpiry(batches, code);
  if (!exp) return false;
  var today = todayISO || new Date().toISOString().slice(0, 10);
  return exp < today;
}

// ---- Reward cost ledger -----------------------------------------
// entry: {id, at, referralId, referrer, friend, code, amount}
function logReward(ledger, entry) {
  entry = entry || {};
  var list = (ledger || []).slice();
  list.push({
    id: 'rw_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36),
    at: new Date().toISOString(),
    referralId: entry.referralId || '',
    referrer: entry.referrer || '',
    friend: entry.friend || '',
    code: entry.code || '',
    amount: Math.max(0, Number(entry.amount) || 0)
  });
  return list;
}
function ledgerTotals(ledger) {
  var t = { count: 0, total: 0 };
  (ledger || []).forEach(function (e) { t.count++; t.total += Number(e.amount) || 0; });
  t.total = Math.round(t.total * 100) / 100;
  return t;
}
// Program ROI: estimated new-customer revenue (rewarded referrals x avg value)
// vs. actual reward spend from the ledger.
function programROI(referrals, ledger, avgCustomerValue) {
  var v = Math.max(0, Number(avgCustomerValue) || 0);
  var won = (referrals || []).filter(function (r) { return r.status === STATUS.REWARDED; }).length;
  var cost = ledgerTotals(ledger).total;
  var revenue = Math.round(won * v * 100) / 100;
  return {
    rewardedCount: won, avgValue: v, estRevenue: revenue,
    rewardCost: cost, net: Math.round((revenue - cost) * 100) / 100
  };
}

// ---- Referrer of the month ---------------------------------------
function referrerOfMonth(referrals, month) {
  var m = month || new Date().toISOString().slice(0, 7);
  var counts = {};
  (referrals || []).forEach(function (r) {
    if ((r.status === STATUS.COMPLETED || r.status === STATUS.REWARDED) && monthKey(r.createdAt) === m) {
      counts[r.referrerName] = (counts[r.referrerName] || 0) + 1;
    }
  });
  var best = null;
  Object.keys(counts).forEach(function (name) {
    if (!best || counts[name] > best.count) best = { name: name, count: counts[name] };
  });
  return best ? { month: m, name: best.name, completed: best.count } : null;
}
function spotlightText(spot, business) {
  if (!spot) return '';
  return 'Big thanks to ' + spot.name + ' — our top referrer for ' + spot.month +
    ' with ' + spot.completed + ' completed referral' + (spot.completed === 1 ? '' : 's') + '!' +
    (business ? ' — ' + business : '');
}

/* ------------------------------------------------------------------ */
/* 7. Member <-> referral merge: auto-enroll + bonus punches            */
/* ------------------------------------------------------------------ */

/* Find a member by exact name (case-insensitive). Null when absent. */
function findMemberByName(list, name) {
  var q = String(name == null ? '' : name).trim().toLowerCase();
  if (!q) return null;
  var arr = list || [];
  for (var i = 0; i < arr.length; i++) {
    if (String(arr[i].name || '').trim().toLowerCase() === q) return arr[i];
  }
  return null;
}

/* The killer feature, part 1: referrers auto-enroll as members.
 * Returns {member, created}. Mutates `list` when creating. */
function autoEnrollMember(list, name, opts) {
  var clean = String(name == null ? '' : name).trim();
  if (!clean) throw new Error('autoEnrollMember: name is required');
  var existing = findMemberByName(list, clean);
  if (existing) return { member: existing, created: false };
  var member = createMember(clean, opts || {});
  list.push(member);
  return { member: member, created: true };
}

/* The killer feature, part 2: members who refer earn bonus punches.
 * Punch mode: n folds into member.bonusPunches (counts toward rewards).
 * Points mode: converts at 10 bonus punches = 1 full reward, credited as
 * bonus points. Mutates + returns the member. */
function awardBonusPunches(member, n) {
  if (!member || typeof member.visits !== 'number') {
    throw new Error('awardBonusPunches: invalid member object');
  }
  var count = Math.max(1, Math.round(toNum(n, 1)));
  var before = rewardsEarned(member);
  var pointsBonus = 0;
  if (member.mode === 'points') {
    var per = Math.max(1, Math.round(toNum(member.pointsPerReward, 100)));
    pointsBonus = Math.max(1, Math.round((count * per) / 10));
    member.points = round2(toNum(member.points, 0) + pointsBonus);
    member.bonusPoints = round2(toNum(member.bonusPoints, 0) + pointsBonus);
  } else {
    member.bonusPunches = Math.max(0, Math.floor(toNum(member.bonusPunches, 0))) + count;
  }
  var after = rewardsEarned(member);
  return {
    member: member,
    bonusPunches: count,
    pointsBonus: pointsBonus,
    rewardEarnedNow: after > before,
    rewardsEarned: after
  };
}

/* Track a referral lifecycle event on the referrer's member record.
 * 'sent' / 'completed' / 'rewarded' increment the matching counter;
 * 'completed' also awards `bonusPunches` bonus punches. Tolerates legacy
 * member records missing the referral fields. */
function recordReferralEvent(member, event, bonusPunches) {
  if (!member || typeof member.visits !== 'number') {
    throw new Error('recordReferralEvent: invalid member object');
  }
  if (event === 'sent') {
    member.referralsSent = (member.referralsSent == null ? 0 : member.referralsSent) + 1;
    return { member: member, bonus: null };
  }
  if (event === 'completed') {
    member.referralsCompleted = (member.referralsCompleted == null ? 0 : member.referralsCompleted) + 1;
    return { member: member, bonus: awardBonusPunches(member, bonusPunches) };
  }
  if (event === 'rewarded') {
    member.referralsRewarded = (member.referralsRewarded == null ? 0 : member.referralsRewarded) + 1;
    return { member: member, bonus: null };
  }
  throw new Error('recordReferralEvent: unknown event "' + event + '"');
}

/* ------------------------------------------------------------------ */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STRUCTURES: STRUCTURES,
    BUSINESS_TYPES: BUSINESS_TYPES,
    TYPE_ALIASES: TYPE_ALIASES,
    RECOMMENDATIONS: RECOMMENDATIONS,
    FALLBACK_RECOMMENDATION: FALLBACK_RECOMMENDATION,
    round2: round2,
    fmtMoney: fmtMoney,
    normalizeType: normalizeType,
    recommendProgram: recommendProgram,
    sanitizeEconomics: sanitizeEconomics,
    breakEvenLift: breakEvenLift,
    calculateEconomics: calculateEconomics,
    punchCardSpec: punchCardSpec,
    createMember: createMember,
    rewardsEarned: rewardsEarned,
    rewardsAvailable: rewardsAvailable,
    redeemReward: redeemReward,
    logVisit: logVisit,
    logPurchase: logPurchase,
    winBackMessage: winBackMessage,
    membersFromCSV: membersFromCSV,
    searchMembers: searchMembers,
    sortMembers: sortMembers,
    membersToCSV: membersToCSV,
    daysSinceVisit: daysSinceVisit,
    atRiskMembers: atRiskMembers,
    segmentMember: segmentMember,
    segmentCounts: segmentCounts,
    visitsToNextReward: visitsToNextReward,
    _resetMemberSeq: _resetMemberSeq,
    // Referral engine (merged from ReferralPilot AI)
    CODE_ALPHABET: CODE_ALPHABET,
    STATUS: STATUS,
    normalizePrefix: normalizePrefix,
    generateCode: generateCode,
    generateBatch: generateBatch,
    isValidCodeFormat: isValidCodeFormat,
    personalReferralCode: personalReferralCode,
    REWARD_TYPES: REWARD_TYPES,
    money: money,
    buildRule: buildRule,
    buildReferralRule: buildReferralRule,
    CHANNELS: CHANNELS,
    CHANNEL_LABELS: CHANNEL_LABELS,
    normalizeChannel: normalizeChannel,
    createReferral: createReferral,
    canAdvance: canAdvance,
    nextStatus: nextStatus,
    advanceStatus: advanceStatus,
    countByStatus: countByStatus,
    leaderboard: leaderboard,
    DEFAULT_TEMPLATES: DEFAULT_TEMPLATES,
    fillTemplate: fillTemplate,
    templateVarsFromRule: templateVarsFromRule,
    referralTemplateVars: referralTemplateVars,
    computeStats: computeStats,
    referralsToCSV: referralsToCSV,
    filterReferrals: filterReferrals,
    findDuplicate: findDuplicate,
    markAllRewarded: markAllRewarded,
    monthKey: monthKey,
    conversionByMonth: conversionByMonth,
    conversionByChannel: conversionByChannel,
    TIERS: TIERS,
    tierFor: tierFor,
    staleReferrals: staleReferrals,
    followUpText: followUpText,
    makeBatch: makeBatch,
    codeExpiry: codeExpiry,
    isCodeExpired: isCodeExpired,
    logReward: logReward,
    ledgerTotals: ledgerTotals,
    programROI: programROI,
    referrerOfMonth: referrerOfMonth,
    spotlightText: spotlightText,
    // Member <-> referral merge
    findMemberByName: findMemberByName,
    autoEnrollMember: autoEnrollMember,
    awardBonusPunches: awardBonusPunches,
    recordReferralEvent: recordReferralEvent
  };
}
