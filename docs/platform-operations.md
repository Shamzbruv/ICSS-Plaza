# Developer console

Open `/developer` and sign in with the configured Plaza operator account.
The designated Plaza developer signs in through the pinned Supabase Auth identity and is mapped to a local operator session. Other existing operator routes still work. If you have not bootstrapped the operator
yet, set `OPERATOR_EMAIL` and `OPERATOR_PASSWORD` as private Railway variables,
deploy, and remove the bootstrap password after the first login. Do not reuse a
merchant email as the operator email. Access is enforced at the API.

The console covers storefronts, rental plans and subscriptions, consultations,
trust and safety, support and email, audit, and system readiness. Use
**System & testing → Create test account** for a 14-day merchant login. Test
accounts cannot publish, pay for rentals, or access any other tenant.

## Consultations

Visitors use `/consultation` without signing up. Requests appear in the
developer console even when email is off. With Resend configured, the applicant
and operator receive an acknowledgement, and operators can send a branded
follow-up. Requests are not automatically booked; record a time and share the
meeting details with the prospect after agreeing on availability.

## Rental billing

The plans and payments here belong to ICSS Plaza, not the independent
vendor's shop. The plans are monthly. No prices or active plans are seeded.

- **Fygaro, primary:** Set `PLAZA_FYGARO_LINK`, `PLAZA_FYGARO_KEY_ID`,
  and `PLAZA_FYGARO_SECRET` for the platform's dynamic button. Configure
  `/api/billing/hooks/fygaro` as its HTTPS webhook on the live Plaza host.
  Each verified payment buys one month; the next month is paid separately.
- **PayPal, automatic renewal:** As the Plaza owner, open **Developer →
  Subscriptions → PayPal settings**. Enter the Client ID and secret from
  the same PayPal **Live** app and re-enter your current Plaza password.
  Plaza verifies the app against PayPal before saving the credentials
  encrypted. The portal never shows the saved secret. To replace a
  secret for the same app later, leave the Client ID blank.
  Then select **Complete PayPal setup**. Plaza registers or verifies the
  webhook and publishes **ICSS Plaza Monthly** at **US$31.39/month**
  (J$5,000 launch equivalent). Setup does not create a subscription or charge
  anyone. Running it again verifies the connection without duplicating the
  plan or reopening a retired plan. Existing Railway variables are used only
  until the owner saves credentials in the portal.
- **Existing PayPal webhooks and plans:** If you set `PLAZA_PAYPAL_WEBHOOK_ID`,
  the launch setup checks that this ID belongs to the same app and points to
  `https://icssplaza.com/api/billing/hooks/paypal`. The webhook needs
  `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.SUSPENDED`,
  `BILLING.SUBSCRIPTION.CANCELLED`, `BILLING.SUBSCRIPTION.EXPIRED`,
  `BILLING.SUBSCRIPTION.PAYMENT.FAILED`, `PAYMENT.SALE.COMPLETED`,
  `PAYMENT.SALE.REFUNDED`, and `PAYMENT.SALE.REVERSED`.
  A manually linked PayPal plan must match the Plaza USD price and recur
  monthly without a setup fee or separate PayPal tax. Only a verified payment
  counts toward paid access; subscription approval by itself does not.
- **Refunds:** Process approved refunds through the original provider and
  reconcile them in the provider dashboard. PayPal refund/reversal events
  appear in the Plaza billing ledger. Cancelling renewal does not refund
  a payment. There is no automated refund action in Plaza.

Keep Fygaro credentials in Railway variables. Back up the existing encryption key separately from the database. Test with the merchant providers
before advertising paid plans. The app's release tests use provider fixtures;
they do not create live charges.

## Vendor support

Open **Vendors → Open vendor workspace**, record the merchant’s request, and edit their storefront, products or media for up to 30 minutes. The support session stays tied to your developer login and that vendor. It does not expose orders, exports, payment credentials, or the vendor’s password. Open and close events and writes are logged under the developer account.
