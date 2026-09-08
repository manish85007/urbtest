-- Payment reminders are no longer sent to clients. The reminder now goes to Super Admins
-- as a daily worklist of invoices that are overdue with no payment recorded.
-- Rewrites the template in place because the seed preserves existing rows (update: {}).
INSERT INTO "email_templates" ("id", "key", "name", "subject", "body", "variables", "editable", "created_at")
VALUES (
  'tpl_payment_reminder',
  'payment_reminder',
  'Payment Record Reminder (Super Admin)',
  'Record payment — {{invoice_count}} invoice(s) overdue, {{total_outstanding}} outstanding',
  E'Internal reminder for Super Admins.\n\n{{invoice_count}} invoice(s) are past their payment terms with no payment recorded in Urb TecTrack.\n\n{{invoice_list}}\n\nTotal outstanding : {{total_outstanding}}\n\nOpen each invoice and use Record payment once the funds are received. A request cannot be closed until its invoices are fully settled.\n{{portal_url}}\n\nThis reminder repeats daily until the payment is recorded or the invoice is closed. Clients are not notified about payment.\n\nUrb TecTrack automated reminder',
  ARRAY['invoice_count','total_outstanding','invoice_list','portal_url'],
  false,
  NOW()
)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "subject" = EXCLUDED."subject",
  "body" = EXCLUDED."body",
  "variables" = EXCLUDED."variables",
  "editable" = false;

-- Per-invoice dunning counters are replaced by a single daily digest key.
DELETE FROM "reminder_log" WHERE "key" LIKE 'pay:%';
