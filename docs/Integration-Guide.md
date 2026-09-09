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

There is no analytics provider in this version. `cake:action` browser events expose only action names (checkout-link, signup-link, download-result, checklist_open). They are local events and are not persisted. Actual calculator-use and page-view tracking must be added with a selected analytics provider and appropriate consent behaviour.

Do not transmit numeric calculator inputs or emails in analytics. Add source tags to published links. Verify how campaign attribution crosses the checkout and signup domains. A paid-order conversion must come from a verified order, not a CTA click. Before advertising, test one complete path from tagged landing visit to paid-order reporting. If provider attribution is insufficient, use campaign-specific checkout offers/codes or implement server-side attribution only after choosing the provider.

## Release checks

- Mobile-friendly styles and labelled inputs are implemented; no browser visual QA was requested or performed in this build.
- Calculator logic has automated arithmetic and invalid-input checks.
- Check external checkout and form flows in the actual accounts before public release; currently not connected.
- Pricing excludes taxes and omitted costs, and does not predict market demand.
- No customer data, paid workbook, source credentials or owner campaign notes should be included in `dist`.

## Calculator conventions

Cost = ingredients + hours × chosen pay + overheads. Current fees = current price × fee percentage + fixed fee. Surplus = current price − cost − fees. Target price = (cost + fixed fee) ÷ (1 − fee percentage − margin). Break-even uses margin = 0. Prices are rounded upward to cents. Percentage rates are converted to decimal form. Margin plus fees must be below 100%. Currency changes labels, not values.
