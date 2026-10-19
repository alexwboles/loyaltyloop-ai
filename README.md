# LoyaltyLoop AI

Customer loyalty + referral engine for local businesses. Answer three
questions — what kind of business you run, what a visit is worth, and what a
reward costs — and LoyaltyLoop AI recommends a program structure, checks
whether the rewards actually pay for themselves, prints your punch cards and
signup sheet, and tracks members, visits, and referrals on one roster.

## Features

1. **Program recommender** — pick your business type (coffee shop, salon/barber,
   restaurant, bakery, car wash, gym, retail, pet groomer) and get a recommended
   structure — punch card, points, or tiers — with a plain-English rationale and
   suggested earn/redeem rules.
2. **Reward economics calculator** — enter average ticket, visits/month, margin,
   reward cost, reward frequency, and expected visit lift. Get reward cost per
   member/month, extra gross profit from the lift, net benefit, break-even lift
   %, and a plain-English verdict.
3. **Printable punch card & signup sheet** — enter your business name, preview a
   punch-card grid with a member-name line plus a signup table (name/phone/email),
   and print cleanly (`@media print` hides all app chrome). Optional: print your
   referral offer on the card — punch card + referral code in one print kit —
   and add a "Referred by (code)" column to the signup sheet.
4. **Member tracker** — add members, log visits with one click, see visit counts,
   last-visit dates, and rewards earned. **Redeem rewards** with one click
   (available rewards = earned − redeemed). **Search** members by name, **sort**
   by newest / name / most visits, and **export the roster to CSV**.
   Persisted in `localStorage`; nothing ever leaves the browser.
5. **Referral engine (merged from ReferralPilot AI)** — mint referral code
   batches (with optional expiry), set the friend-side reward + the referrer's
   bonus punches, and track referrals through sent → completed → rewarded
   (no skipping steps). Duplicate friends are caught before adding.
6. **Members who refer earn bonus punches** — the killer feature. Completing a
   referral credits the referrer's loyalty card automatically (punch-card mode:
   bonus punches; points mode: bonus points at 10 punches = 1 reward), and
   **referrers auto-enroll as members**. The friend auto-enrolls when their
   referral completes. Every member gets a personal referral code with a
   copy-ready SMS invite.
7. **Leaderboard, trends & ROI** — referrer leaderboard with Bronze/Silver/Gold/
   Platinum tiers and podium, referrer-of-the-month spotlight, monthly
   conversion trend, conversion by channel, stale-referral follow-ups with
   copy-ready nudges, friend-offer preview card, SMS/email share templates,
   and program ROI (rewarded referrals × average new-customer value − reward
   spend from the ledger). The overview dashboard shows referral KPIs and a
   unified activity feed.
8. **Lapsed-member detection + win-back nudges** — members with no visit in 30+
   days surface on a win-back list with a personalized, copy-ready nudge
   (offer + "you're N visits from a reward" progress hook).
9. **Promotions (campaign engine)** — launch time-bound campaigns: double-punch
   weekends, bonus-punches-per-visit events, and signup bonuses. Live campaigns
   apply themselves automatically when you stamp a visit or log a purchase,
   every affected stamp is tagged in the member's ledger, and each campaign
   reports visits, joins, and rewards earned inside its window. Persisted in
   `loyaltyloop.campaigns.v1`.
10. **Ways to earn (action-based bonuses)** — beyond visits and purchases:
    configurable bonus punches for new-member signup, birthdays, reviews /
    shout-outs, and social follows. Award with one click from the member's
    profile panel; bonuses fold into the card exactly like referral bonuses.
    Rules live in Program studio (`loyaltyloop.rules.v1`).
11. **Member profile + transaction ledger** — every member carries an
    append-only ledger (visit, purchase, bonus, reward, redemption, signup)
    with timestamps and notes. Click **History** on any member for a
    Yotpo-grade profile: stats, one-click bonus awards, and the full
    transaction history. Pre-upgrade rosters are migrated automatically
    (a `signup` entry is backfilled; history starts from the upgrade).
12. **Outstanding-liability KPI** — unredeemed rewards × your reward cost
    (set in Economics), right on the dashboard, so you always know what the
    program owes. The register-tape activity feed now streams bonuses,
    rewards, redemptions, and signups alongside visits and referrals.

## Migration from ReferralPilot AI

ReferralPilot AI has been merged into this product and its repo archived.
If you used it, your data carries over automatically: on first run,
LoyaltyLoop AI copies the old `rp_*` localStorage keys into its own
(`loyaltyloop.*.v1`) without overwriting anything it already wrote.

## How to run

Just open `index.html` in any modern browser. No build step, no server, no install.

```sh
# or serve it locally if you prefer:
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Tests

```sh
./test/smoke.sh   # file checks, syntax checks, logic unit checks
./test/e2e.sh     # end-to-end flows through js/logic.js
```

All pure business logic lives in `js/logic.js` (browser + Node compatible);
`js/app.js` is UI wiring only.

## Free, local-first, zero API keys

LoyaltyLoop AI costs nothing to run and needs nothing from the internet:
no API keys, no accounts, no network calls, no analytics. Member data stays in
your browser's `localStorage`.
