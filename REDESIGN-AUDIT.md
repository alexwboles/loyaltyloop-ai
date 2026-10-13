# LoyaltyLoop AI — Redesign Audit (2026-10-13)

Competitors researched: **Square Loyalty** (merchant dashboard: total loyalty customers, loyalty rewards issued, top loyalty customers, loyalty vs non-loyalty spend comparison), **Fivestars** (AutoPilot win-back automation, promotion builder, visit/spend behavior reporting), **Loyally.ai** (stamp cards, wallet delivery).

## Visual gaps vs competitors
1. **No merchant dashboard.** Square/Fivestars open on a dashboard of KPIs + top customers; LoyaltyLoop opened on a 4-step wizard (recommend → economics → print → members), which reads as an onboarding flow, not a tool you run daily.
2. **Top-nav tabs + punch-strip header** looked crafty but not like commercial loyalty software; Fivestars/Square use a left sidebar back-office layout.
3. **Member rows** were dense text rows — competitors show member cards with progress toward reward front-and-center.
4. Win-back nudge composer (a Fivestars-AutoPilot-grade feature) was buried at the bottom of the Members tab.

## Functional gaps vs competitors
1. **No overview KPIs**: total members, visits, rewards earned/redeemed, top members — Square Dashboard 101.
2. **No recent-activity feed**: merchants want "who just visited / who just earned a reward."
3. **No new-member-this-month / at-risk counts** surfaced anywhere except deep in Members.
4. LoyaltyLoop has what Fivestars charges $99/mo for (win-back segments + message composer) but doesn't lead with it.

## Redesign plan
- **"LoyaltyOS for Main Street"**: dark walnut sidebar + gold accent, cream paper content. Tabs: Overview (NEW), Program studio, Economics, Members, Print cards.
- **Overview dashboard**: KPI cards (members, total visits, rewards earned, rewards redeemed), Top 5 members by visits, member-mix segments, new-this-month + at-risk counts, recent activity feed (last 8 by lastVisitAt).
- Win-back moved to its own card on Overview ("At risk — bring them back") while keeping the composer in Members.
- All features preserved: recommender, economics calculator, printable punch card + signup sheet, member CRUD, visits/purchases, redeem, search/sort, CSV import/export, segments, win-back composer. logic.js untouched.

## Concept (1 paragraph)
A merchant back-office for Main Street: a dark walnut left sidebar with a gold-foil stamp mark, cream-paper content area, and a proper loyalty dashboard up front — KPI cards, ranked top-members list with visit bars, member-mix chips, and a recent-activity feed — so it reads like Square Loyalty the moment it opens. Program design (recommender + economics) and printable cards remain as the "studio" tabs. One accent: harvest gold #b45309. Type: system sans, tabular numbers on KPIs.
