# Cake Quote Kit — email sequence

Status: copy prepared, not configured or sent. Replace brace placeholders with real links before activation. Use only subscribers who explicitly choose the checklist and pricing emails. Recommend confirmed/double opt-in. Every email needs the provider's unsubscribe link and the real sender's required footer. Suppress the sales email for buyers when a verified purchase integration is available; do not claim that integration exists yet.

## Signup form copy

Title: Your next cake quote, with fewer forgotten costs.

Description: Get the Cake Pricing Checklist and three short emails about labour, overheads and using Cake Quote Kit. You can unsubscribe at any time.

Fields: Email address (required). Do not ask for phone, revenue, address or customer data.

Checkbox, unchecked: Send me the checklist and cake pricing tips, including information about Cake Quote Kit. I can unsubscribe at any time.

Button: Send me the checklist

Links: Privacy information ({privacy_url}).

After submission: Check your inbox to confirm your email address. If you do not see the message, check your spam folder.

After successful confirmation: You're subscribed. Your checklist is on its way. You can also open it here: {checklist_url}.

## Email 1 — immediately after confirmed opt-in

Subject: Your cake pricing checklist is here

Preheader: One cake. Every cost. A clearer starting price.

Hi,

Here's your Cake Pricing Checklist:

{checklist_url}

Open it in your browser and choose Print to save a PDF or make a paper copy.

Start with the next cake you need to quote. Add the ingredients, the time you'll spend, and the less obvious costs—like the box, delivery and payment fees.

Then try those numbers in the free calculator:

{calculator_url}

The result shows what your entered costs and chosen pay require. You'll still need to decide whether the final quote fits your design, customers and market.

Cake Quote Kit

{sender_identity_and_address}
{unsubscribe_link}

## Email 2 — two days later

Subject: A $65 cake can pay less than you think

Preheader: A worked example that includes the time behind the cake.

Hi,

Imagine a cake priced at $65:

- Ingredients: $18
- Packaging and overheads: $6
- Payment fee: $2.25 (an example fee of 3% + $0.30)

That leaves $38.75 for your time and any surplus.

If the cake takes three hours, you're left with about $12.92 per hour before tax and any costs you haven't included.

If you intended to pay yourself $15 per hour, your chosen pay is $45. The cake is $6.25 short of covering that pay alongside the other entered costs.

This is a fictional example. Your ingredients, time and fees will be different.

Check your next quote with your own numbers:

{calculator_url}

Cake Quote Kit

{sender_identity_and_address}
{unsubscribe_link}

## Email 3 — four days after confirmation

Subject: Keep the next cake quote in one place

Preheader: A look inside the Excel kit, with its practical limits.

Hi,

The free calculator is useful for checking one price. If you're repeating that work for different cakes, Cake Quote Kit brings the next steps into one Excel workbook:

- Calculate ingredient costs, labour, fees and a target price.
- Prepare a printable customer quote.
- Track up to 50 ingredients and see what you need to buy for the current quote.
- Record order history and review three editable charts.

It is an English digital download for desktop Microsoft Excel. Stock movements and historical orders are entered manually; creating a quote does not deduct inventory.

See the workbook and current price:

{product_url}

The kit includes a quick-start guide. Desktop Excel is required and is not included. Google Sheets and mobile spreadsheet apps have not been verified.

Cake Quote Kit

{sender_identity_and_address}
{unsubscribe_link}

## Automation setup

One automation: subscriber joins Cake Pricing Checklist group after confirmation → send Email 1 → wait 2 days → send Email 2 → wait 2 days → if not a verified buyer, send Email 3. If purchase-based suppression is unavailable, do not invent a buyer status; adjust Email 3 to accommodate existing customers or add suppression before activation.

Use your own addresses for a complete test of confirmation, delivery, links, timing and unsubscribe before opening signup. This document does not authorize sending campaigns to imported or unrelated contacts.
