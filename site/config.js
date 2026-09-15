window.CAKE_CONFIG = Object.freeze({
  // Public HTTPS URLs only. Never put API keys or subscriber data in this file.
  checkoutUrl: 'https://payhip.com/b/N5CET',
  privacyUrl: 'https://www.cakequotekit.app/privacy.html',
  termsUrl: '',
  supportEmail: '',
  launchReady: false,
  priceLabel: '$6.90 USD',
  priceValue: 6.9,
  priceCurrency: 'USD',
  productId: 'N5CET',
  productName: 'Cake Quote Kit 2.0',
  // Google Ads conversion tracking. The tag itself is loaded in index.html and thank-you.html.
  // Fill each label from Google Ads → Goals → Conversions → (action) → Tag setup ("send_to" is AW-.../LABEL).
  // An empty label disables that conversion; plain gtag events still fire so the account has data.
  googleAdsId: 'AW-1040350636',
  conversionLabels: Object.freeze({
    purchase: 'p3ldCJ26w_gcEKz7ifAD',        // fired on /thank-you.html after Payhip redirects a paid order there
    lead: 'xGPwCKC6w_gcEKz7ifAD',            // fired when the calculator result email is accepted by the server
    checkout_click: 'kbmICKO6w_gcEKz7ifAD'   // optional secondary action: click on any "Buy" button that opens Payhip
  })
});
