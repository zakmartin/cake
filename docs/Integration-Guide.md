# Launch connections and verification

Update: the owner supplied https://payhip.com/b/N5CET and reported that PayPal is now connected. The product link is enabled as “Buy on Payhip” independently of email setup. The owner's screenshot dated 9 September 2026 confirms a price of USD 6.90 and the expected product title and description. The earlier screenshot predates the PayPal connection. Payment and delivery remain unverified until a full purchase succeeds. Email signup, legal URLs, support details, analytics and full public launch remain pending.

This repository contains a static, owner-private preview. It does not collect email addresses, charge customers, send email, persist calculator entries, or report analytics events to a server. The public-looking design is not proof of a connected backend.

## Current files

- `dist/index.html`: English landing page and calculator.
- `dist/calculator.mjs`: pure calculation logic.
- `dist/app.mjs`: interactions and safe external integration links.
- `dist/config.js`: public connection configuration. No secrets belong here.
- `dist/cake-pricing-checklist.html`: printable free resource.
- `docs/`: owner launch plan, email drafts and promotion pack. Not included in the public static deployment.

## Checkout

1. Create the digital product in the owner's Payhip account, connect payments and configure the real seller identity, tax presentation, refund terms and support details.
2. Upload `Cake-Quote-Kit-Download.zip` from the v2 deliverable, not `Seller-Assets.zip`. Verify it contains the workbook, quick-start guide and README.
3. Confirm the current launch price (USD 6.90 in the supplied screenshot) and keep the public product URL in `checkoutUrl`.
4. Complete a platform-supported test purchase and verify the download, workbook version and receipt. Any real charge requires spending authorization.

## Email collection and delivery

1. Create a MailerLite subscriber group for Cake Pricing Checklist and a hosted signup form. The hosted form avoids storing subscriber data inside this static site.
2. Use the copy and explicit opt-in in `Email-Sequence-EN.md`, real privacy information and the owner's verified sending identity. Confirm sending-domain authentication as requested by the provider.
3. Build the three-message automation and replace every placeholder URL/footer with real values. Link to the checklist on the public site.
4. Use a confirmed opt-in flow. Test confirmation, delivery and unsubscribe using owner-controlled test addresses. Do not send to third parties during setup.
5. Put the public hosted form URL into `signupUrl`. This is an ordinary public URL, not an API credential.
6. Suppress sales messages for buyers only after a verified purchase integration exists. UTM attribution across providers also needs testing, not assumption.

## Launch switch

Populate `checkoutUrl`, `signupUrl`, `privacyUrl`, `termsUrl`, `supportEmail` and `priceLabel` in `dist/config.js`. Links must be HTTPS. Set `launchReady: true` only after all above steps pass. Until then, the website remains in preview mode and does not show a fake signup form or claim a purchase succeeded.

Remove the `noindex, nofollow` meta from the landing page only as part of the intended public launch. The printable checklist can remain noindex. Add canonical and sitemap using the confirmed public domain. Change Site audience through the supported Sites flow; the current private URL is not a marketing destination. The final public launch requires a real seller identity and completed privacy/terms documents, not placeholder pages.

## Analytics and attribution

Page views: Vercel Web Analytics (cookie-free). Google Ads: the Google tag `AW-1040350636` is loaded on `index.html` and `thank-you.html`. `site/tracking.mjs` listens to the local `cake:action` events and turns them into gtag events (`begin_checkout`, `calculate_price`, `generate_lead`, `view_checklist`, `download_result`) and, when a label is configured, into Google Ads conversions. Only action names and the public product price are sent; never emails or calculator inputs.

### Google Ads conversion setup

Conversion labels live in `site/config.js` → `conversionLabels`. An empty label disables that conversion.

The conversion actions were created through the Google Ads API on 15 September 2026 by `scripts/ads-conversions.mjs` in Google Ads customer 491-053-2870 (the account that also runs pojistitonline.cz; the shared Google tag is `AW-1040350636`):

| Action | Category | Counting | Goal | Conversion action id |
|---|---|---|---|---|
| Cake Quote Kit – Purchase | Purchase, value 6.90 USD default, page value preferred | Every | Primary | 7768956189 |
| Cake Quote Kit – Lead (result email) | Submit lead form | One | Secondary | 7768956192 |
| Cake Quote Kit – Checkout click | Begin checkout | One | Secondary | 7768956195 |

The script is idempotent: `node scripts/ads-conversions.mjs` lists the account's actions and validates, `--apply` creates whatever is missing and writes the labels into `site/config.js`. Credentials are read from `../pojistitonline.cz/.env` (override with `ADS_ENV_FILE`); `scripts/google-ads.mjs` is a dependency-free port of that project's `googleAdsAuth.ts`. Never copy the `.env` into this repo.

Goal note: campaign "Website traffic- CAKE" (24230575146) uses customer-level goals, and the account's *Purchase* goal is not biddable (pojistitonline deliberately keeps only "Rixo lead" biddable). Conversions are still reported per action, but before switching the CAKE campaign to Maximize conversions, give it campaign-level goals with a custom goal containing only the Cake actions, so the insurance campaigns stay untouched.

Remaining manual steps:

1. In Payhip open **Account → Settings → Advanced Settings → Checkout Settings**, tick *Redirect customers to a particular webpage when they successfully complete the checkout*, apply it to product `N5CET` and enter `https://www.cakequotekit.app/thank-you.html`. Payhip then delivers the file by email instead of the immediate download screen; the thank-you page tells the buyer to check their inbox. Payhip does not append an order id to the redirect, so the purchase conversion has no `transaction_id` and is de-duplicated per browser session only.
2. Deploy, then verify: run **Tag Assistant** on the landing page, click a Buy button (expect `begin_checkout` plus the checkout_click conversion), send a calculator result to a test address (expect `generate_lead` plus the lead conversion), and complete one real test purchase. The purchase must appear in Google Ads under the Purchase action within a few hours; refund the test order in Payhip afterwards.

Fallback if the Payhip redirect is unacceptable: import Payhip sales as offline conversions (Payhip → Zapier → Google Ads "Send offline conversion"), which needs the GCLID stored at click time and passed to Payhip; that is not implemented.

Consent: the tag currently loads without a consent banner. Before EU traffic is bought, add a consent management platform with Google Consent Mode v2, or restrict campaigns to regions where consent is not required. The privacy policy already describes Google Ads measurement.

Do not transmit numeric calculator inputs or emails in analytics. Add source tags to published links. Verify how campaign attribution crosses the checkout and signup domains. A paid-order conversion must come from a verified order, not a CTA click. Before advertising, test one complete path from tagged landing visit to paid-order reporting. If provider attribution is insufficient, use campaign-specific checkout offers/codes or implement server-side attribution only after choosing the provider.

## Release checks

- Mobile-friendly styles and labelled inputs are implemented; no browser visual QA was requested or performed in this build.
- Calculator logic has automated arithmetic and invalid-input checks.
- Check external checkout and form flows in the actual accounts before public release; currently not connected.
- Pricing excludes taxes and omitted costs, and does not predict market demand.
- No customer data, paid workbook, source credentials or owner campaign notes should be included in `dist`.

## Calculator conventions

Cost = ingredients + hours × chosen pay + overheads. Current fees = current price × fee percentage + fixed fee. Surplus = current price − cost − fees. Target price = (cost + fixed fee) ÷ (1 − fee percentage − margin). Break-even uses margin = 0. Prices are rounded upward to cents. Percentage rates are converted to decimal form. Margin plus fees must be below 100%. Currency changes labels, not values.
