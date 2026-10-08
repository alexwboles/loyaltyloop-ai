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
  _memberSeq += 1;
  return {
    id: opts.id != null ? String(opts.id) : 'm_' + _memberSeq + '_' + Date.now().toString(36),
    name: clean,
    visits: 0,
    punchesPerCard: punchesPerCard,
    redeemed: 0,       // rewards the member has cashed in
    lastVisitAt: null, // ISO string of the most recent logged visit
    joinedAt: new Date().toISOString()
  };
}

/* Number of full rewards a member has earned: floor(visits / punchesPerCard). */
function rewardsEarned(member) {
  if (!member || typeof member.visits !== 'number' || !member.punchesPerCard) return 0;
  return Math.floor(member.visits / member.punchesPerCard);
}

/* Rewards earned but not yet redeemed (never negative; tolerates old records). */
function rewardsAvailable(member) {
  const earned = rewardsEarned(member);
  const redeemed = member && Number.isFinite(Number(member.redeemed)) ? Number(member.redeemed) : 0;
  return Math.max(0, earned - redeemed);
}

/* Cash in one reward. Mutates the member. Throws when none are available. */
function redeemReward(member) {
  if (!member || typeof member.visits !== 'number') {
    throw new Error('redeemReward: invalid member object');
  }
  if (rewardsAvailable(member) < 1) {
    throw new Error('redeemReward: no rewards available to redeem');
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
    searchMembers: searchMembers,
    sortMembers: sortMembers,
    membersToCSV: membersToCSV,
    _resetMemberSeq: _resetMemberSeq
  };
}
