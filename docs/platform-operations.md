# Developer console

Open `/developer` and sign in with the configured Plaza operator account.
Existing operator routes still work. If you have not bootstrapped the operator
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
- **PayPal, optional:** Set `PLAZA_PAYPAL_CLIENT_ID`, `PLAZA_PAYPAL_SECRET`,
  `PLAZA_PAYPAL_WEBHOOK_ID`, and `PLAZA_PAYPAL_MODE=live`. Register
  `/api/billing/hooks/paypal` for subscription activation, suspension,
  cancellation, expiry and payment failure, plus completed, refunded and
  reversed sales. Attach a matching active USD PayPal monthly plan ID to
  the Plaza plan. Plaza validates the amount, interval, tax and setup fee.
  A browser return or subscription approval never activates paid access.
- **Refunds:** Process approved refunds through the original provider and
  reconcile them in the provider dashboard. PayPal refund/reversal events
  appear in the Plaza billing ledger. Cancelling renewal does not refund
  a payment. There is no automated refund action in Plaza.

Keep credentials in Railway variables. Test with the merchant providers
before advertising paid plans. The app's release tests use provider fixtures;
they do not create live charges.

## Vendor support

Open **Vendors → Open vendor workspace**, record the merchant’s request, and edit their storefront, products or media for up to 30 minutes. The support session stays tied to your developer login and that vendor. It does not expose orders, exports, payment credentials, or the vendor’s password. Open and close events and writes are logged under the developer account.
