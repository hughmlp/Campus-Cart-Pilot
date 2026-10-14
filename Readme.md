# Campus Cart

Campus Cart is a mobile-first web prototype where Notre Dame students and staff record what they would want an agent to buy, so we can see which items and merchants people ask for and whether they would connect a card to let it happen. It is a research prototype and the demand experiment behind Aimsigh, which I am building with Jack O'Connell.

## What the first working slice does

A user signs in with an nd.edu email and an invite code, then fills in a short form with the item they need, a category, an optional preferred merchant and a maximum total budget including taxes and fees. The user taps Review request to check the details, then Submit request. The app records the request as "Request only" and confirms that no order was placed and no payment was taken. If the merchant is not on the support list, it says "We can't purchase from this merchant yet. Your request has been recorded." After the request is recorded, the user can optionally connect a card through Stripe in test mode, and can disconnect it again. The card step is separate from the request, and no purchase or charge is ever made in this version.

## Try it

- Prototype: [Hugh: paste your live Replit link here]
- Access is invite-only. Invite code for testers and reviewers: `IRISH-PILOT`
- To test the card step, use Stripe's test card 4242 4242 4242 4242 with any future expiry and any 3-digit CVC. Do not enter a real card.

## How to log in (for reviewers)

Sign-in uses an email code, so there is no password to remember. Anyone with an nd.edu email address can get in by following these steps.

1. Open the prototype link above. It works best on a phone-sized screen but runs in any browser.
2. Enter your nd.edu email address and continue. Clerk, the sign-in service, emails you a one-time verification code.
3. Open that email, copy the code and enter it in the app. Check your spam folder if it does not arrive within a minute.
4. On the "About you" screen, choose the role that fits you (for example student or staff) and enter the invite code `IRISH-PILOT`. The app will not save your role without a valid invite code.
5. You land on the request form. Fill in the item, category and budget, add a merchant if you like, tap Review request, then Submit request. The confirmation screen then offers the optional card step.

Only nd.edu addresses are accepted, so a personal Gmail address will not work. If you do not have an nd.edu address, the test results below show what each screen does.

The researcher dashboard at `/research` is not open to every tester. It shows only for email addresses listed in the app's researcher settings (`CAMPUS_CART_RESEARCHER_EMAILS`). If a reviewer needs to see the dashboard, send me their nd.edu email and I will add it.

## AI role and what is working

The future AI system is a purchasing agent that discovers a merchant, uses its website and pays for what the user asked. That part is not built, and real purchasing is switched off on purpose.

| Behavior | Status |
| --- | --- |
| Sign-in with nd.edu email code and invite code | Working |
| Request form, review, recording and status screens | Working |
| Merchant support check ("We can't purchase from this merchant yet") | Working |
| Card setup through Stripe, test mode | Working, test mode only |
| Voice transcription | Working. Speech is transcribed on the server, the raw audio is deleted afterward, and the text stays editable. |
| Extracting item and budget from a spoken or typed request | Simulated. Voice produces editable text, but the item, category and budget fields are filled in by the user, not extracted automatically. |
| Purchasing agent that discovers, checks out and pays | Not built, disabled by design |

## Test results

| Test | Input or action | What happened | Pass, partial, or fail |
| --- | --- | --- | --- |
| Typical case | Item: running socks, category: clothing, merchant: sports retailer, budget $30, then card setup with Stripe test card 4242 4242 4242 4242 | The request was recorded as "Request only" with no order placed. Stripe test-mode card setup completed and the app showed "Test-mode card connected" with a Disconnect option. No purchase or charge took place. | Pass |
| Challenge case | Item: something for a cold, category chosen, no merchant, budget $15 | The app accepted the vague item as typed and recorded it. It did not ask for a more specific item and did not add a merchant or product on its own. | Partial |
| Invalid or empty case | (a) Item left empty, then tapped Review request. (b) Item: tennis racket, category: sports, merchant: Dick's Sporting Goods, budget $100 | (a) The app showed "Add an item, category, and a valid maximum total budget." and did not move to the review screen, so no request was recorded. (b) After Review request and Submit request, the app showed "We can't purchase from this merchant yet. Your request has been recorded." | Pass |

## Known limitations

1. The app records vague items as typed and does not ask a follow-up question, so a request like "something for a cold" reaches the dashboard with little detail. A next step is to prompt for a more specific product when the item is too general.
2. Real purchasing is disabled in this version, so the app only records requests and places no orders. The purchasing agent itself is a future step, and the dashboard labels its rankings "Requested purchases", not items bought.
3. Card setup works only in Stripe test mode and only when a test key is configured. Without a key, the card step is disabled with an explanation, so the card step cannot be shown on a deployment that lacks one.

## Secrets

No passwords, API keys or tokens are stored in this repository. Credentials live in environment secrets, and card setup runs only through Stripe-hosted Checkout in test mode. The invite code above is a shared pilot code that only gates access to a test-mode prototype.
