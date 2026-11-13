# ICSS Plaza email setup

ICSS Plaza sends transactional messages through Resend. Supabase Custom SMTP
is a separate transport for Supabase Auth; Plaza currently runs its own sign-in.
The SMTP password alone does not enable storefront or support email.

## Supabase Auth

In [The Plaza → Custom SMTP](https://supabase.com/dashboard/project/twyihgetuuuievxfgfti/auth/smtp),
enable custom SMTP and enter:

- Sender name: **ICSS Plaza**
- Sender email: an address on your verified Resend sending domain
- Host: `smtp.resend.com`
- Port: `587`
- Username: `resend`
- Password: the Resend API key for that domain

Save and install the branded Auth templates. `npm run mail:auth-templates`
prints the Management API fields for the confirmation, invite, recovery,
magic-link, email-change and reauthentication templates and the security
notifications. Leave link tracking off for messages with sign-in, order-access
or reset links.

## Plaza sending (Railway)

Add `RESEND_API_KEY` and `RESEND_FROM` in the ICSS Plaza service variables.
Use a Resend sending key and a verified sender, for example
`ICSS Plaza <plaza@YOUR-VERIFIED-DOMAIN>`. Use the HTTPS public Plaza origin.
For ordinary support replies, set `RESEND_REPLY_TO` to the support inbox
address. Buyer order notifications reply directly to the independent seller.

Welcome, password reset/security, order/verification/fulfilment, rental,
support, and vendor case messages use the same logo and palette, with
plain-text alternatives. Cases never send evidence or their private access
keys by email. The queue retries transient errors; **sent** in Plaza means
Resend accepted it, not that the recipient opened or received it.

## Plaza receiving (Resend)

Use a Resend-provided inbound address or a dedicated inbound subdomain to
avoid changing existing business email delivery. Set `RESEND_INBOX_ADDRESS`
and `RESEND_REPLY_TO` to the selected address. In Resend, add a webhook for
`email.received` at `https://YOUR-PLAZA-DOMAIN/api/webhooks/resend`.
Add the signing secret as `RESEND_WEBHOOK_SECRET` and a separate API key
with receiving access as `RESEND_INBOUND_API_KEY`. Do not commit secrets.

The private operator inbox receives messages only for the configured address.
It verifies Resend signatures, deduplicates messages, shows plain text and
allows the operator to send a branded reply. Review original HTML or attachments
inside Resend. The Plaza inbox retains message text for 30 days. Review
sending and receiving from a controlled test account after setting credentials.

## Database

Apply the tracked Resend migration before starting this release on Supabase.
It creates two private tables for the encrypted email queue and inbox.
With SQLite, the same tables are created at startup.
