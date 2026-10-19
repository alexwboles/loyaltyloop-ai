# LoyaltyLoop AI — Redesign Audit (2026-10-13, v1 + 2026-10-19, v2)

## v1 (2026-10-13) — archived summary
Studied Square Loyalty (KPI dashboard: total customers, rewards issued, top customers, loyalty-vs-non-loyalty spend), Fivestars (AutoPilot win-back, visit/spend reporting), Loyally.ai (stamp cards, wallet delivery).
Gaps closed: merchant dashboard (Overview tab: KPIs, top 5 members, member mix, at-risk, recent activity), sidebar back-office IA, win-back composer surfaced. Visual identity: "LoyaltyOS for Main Street" — dark walnut sidebar + harvest gold #b45309 accent + cream paper content, no rounded corners.
Later (2026-10-19 merge): referral engine ported from referralpilot-ai — code batches w/ expiry, personal member codes, merged reward rule, sent→completed→rewarded tracker, duplicates, CSV export, bulk-reward, stale follow-ups, monthly trend, conversion-by-channel, leaderboard (podium + Bronze→Platinum), referrer-of-month, friend-offer preview, SMS/email templates, program ROI ledger; killer feature (completed referrals auto-award bonus punches; referrers/friends auto-enroll); Referrals tab; one-time rp_* → loyaltyloop.*.v1 localStorage migration. ALL PRESERVED in v2.

## v2 competitor research (2026-10-19)

### Square Loyalty (squareup.com help + merchant reviews)
- Points systems: by visit, by amount spent, or by item; customers see progress via text updates.
- **Analytics**: bird's-eye view — loyalty customers, points balances, rewards issued/used; VIP tiers with points multipliers.
- Custom earn terminology ("stars" vs "points").
- Setup is a guided 3-step flow: terminology → earn rule → reward tiers.

### Yotpo Loyalty & Referrals (yotpo.com platform + support docs)
- **Customer profile**: per-customer earning history (Earned / Progress-to-complete / Pending / Reversed / Refunded statuses) + redemption history (used/not used, expired/not expired) + purchase history.
- **Active Campaigns**: run double-points days to drive sales in slow months — time-boxed promos.
- Points expiration with auto alerts; fraud prevention (self-referral blocks).
- **Revenue tracking**: money driven directly by the program; tier performance; **liability reports** — unused points = financial risk.

### Smile.io (Shopify app listing, 4.9★/4.2k reviews)
- Points + VIP tiers + referrals; **action-based earning rules** ("ways to earn": purchases, signups, social follows, reviews) alongside "ways to redeem".
- **2× points weekends** and VIP pricing events as a standard promo mechanic.
- Fully branded program design; loyalty hub inside customer accounts.

## v2 — 6 layout/IA/visual patterns worth borrowing
1. **Yotpo's per-customer profile** → per-member ledger drawer: every earn / bonus / redeem as a timestamped transaction with statuses (earned / redeemed), referred-by lineage, personal code. Members tab gains "History" per member; data already exists in aggregate, now stored as events.
2. **Yotpo's liability report** → Outstanding-liability KPI on Overview: unredeemed rewards × reward cost (from Economics settings). Yotpo merchants get "unused point risk"; our merchants get the same number for punch cards.
3. **Smile's "Ways to earn / Ways to redeem"** → Program-studio "Ways to earn" editor: signup bonus, birthday bonus, review/shout-out bonus — configurable bonus punches/points with one-click "Award" on member rows (Smile's action-based earning).
4. **Yotpo Active Campaigns / Smile 2× weekends** → Promotions: time-bound campaigns (double-punches window, bonus-per-visit window, signup-bonus window) with Live/Scheduled/Ended states, auto-applied at stamp time, per-campaign visits/joins/rewards reporting.
5. **Square's analytics-first dashboard** → register-tape activity feed gains reward + bonus + redemption events (currently visits/referrals only); campaign chips surface live promos on Members.
6. **Rubber-stamp & countertop-ledger craft**: premium local-business identity = physical stamp-card motifs (real stamp-slot progress strips instead of generic progress bars), rubber-stamp "REWARD EARNED" seals, perforated register-tape feed, hairline ledger rules. Distinctive to the loyalty domain; never a template.

## v2 — top 3 functional gaps vs competitors (closed this round)
1. **No promotions/campaign engine** (Yotpo Active Campaigns, Smile 2× weekends). → New Promotions tab + auto-apply at visit/purchase time + per-campaign reporting.
2. **No action-based earning** (Smile "ways to earn", Yotpo flexible rules). → Configurable earning rules (signup/birthday/review/social) + one-click award buttons in member rows, all recorded in the ledger.
3. **No per-member transaction history or liability view** (Yotpo customer profile + liability reports). → Append-only member ledger on every earn/bonus/redeem; member history drawer; outstanding-liability KPI on Overview fed by Economics reward-cost setting.

## v2 — new distinctive visual identity: "The Countertop Ledger"
Evolve (never replace) the walnut-sidebar + gold + cream foundation into premium grade:
- **Type**: display serif (Georgia/Charter stack) for H1/H2 + system sans for data/UI; tabular-nums on all KPIs; uppercase hairline kickers.
- **Signature motifs**: stamp-slot progress strips (square cells fill gold like a real inked card), rubber-stamp seals for earned rewards, perforated register-tape activity feed, hairline ledger rules in tables.
- **Zero rounded corners** (v1's circular `.stamp` becomes a square stamp mark); no gradients; no emoji chrome; one accent (harvest gold #b45309).
- **Layering**: offset hairline frames on cards, tiered podium with staggered heights, drawer-style member history panel, campaign status badges.
- Fully responsive: sidebar collapses to top nav under 900px; tables scroll; ledger drawer becomes full-screen sheet on mobile.
