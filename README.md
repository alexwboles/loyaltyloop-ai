# LoyaltyLoop AI

Customer loyalty program designer for local businesses. Answer three questions —
what kind of business you run, what a visit is worth, and what a reward costs —
and LoyaltyLoop AI recommends a program structure, checks whether the rewards
actually pay for themselves, prints your punch cards and signup sheet, and
tracks members and visits.

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
   and print cleanly (`@media print` hides all app chrome).
4. **Member tracker** — add members, log visits with one click, see visit counts,
   last-visit dates, and rewards earned. **Redeem rewards** with one click
   (available rewards = earned − redeemed). **Search** members by name, **sort**
   by newest / name / most visits, and **export the roster to CSV**.
   Persisted in `localStorage`; nothing ever leaves the browser.

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
