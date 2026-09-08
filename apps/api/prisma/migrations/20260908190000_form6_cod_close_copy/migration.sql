-- Form 6 and CoD client emails now ask for Review & Close, explain day-60 auto-close,
-- and note that Sustainability / Recycling Heroes credits require a closed request.
-- Rewrites in place because seed preserves existing template rows (update: {}).

UPDATE "email_templates"
SET
  "name" = 'Recycling & Form 6',
  "subject" = 'Form 6 {{form6_no}} issued for invoice {{invoice_no}} — please close your request',
  "body" = E'Dear {{contact_name}},\n\nRecycling has been completed and Form 6 has been issued for request {{request_id}}.\n\n  Form 6  : {{form6_no}}\n  Invoice : {{invoice_no}}\n\nPlease review the documents and complete Review & Close for this request in your portal when ready:\n{{portal_url}}\n\nThe request will auto-close on day 60 if it is not manually closed. Only closed requests generate Sustainability and Recycling Heroes credits for your organisation.\n\nQuestions? {{contact_email}}\n\nWarm regards,\nUrbeno Private Limited\nRecycling Heroes™',
  "variables" = ARRAY['request_id','contact_name','form6_no','invoice_no','portal_url','contact_email']
WHERE "key" = 'recycling_form6';

UPDATE "email_templates"
SET
  "name" = 'Certificate of Destruction',
  "subject" = 'Certificate {{cert_no}} issued for request {{request_id}} — please close your request',
  "body" = E'Dear {{contact_name}},\n\nThe Certificate of Destruction has been uploaded for request {{request_id}}.\n\n  Certificate : {{cert_no}}\n  Invoice     : {{invoice_no}}\n  Date        : {{cert_date}}\n\nPlease review the certificate and complete Review & Close for this request in your portal when ready:\n{{portal_url}}\n\nThe request will auto-close on day 60 if it is not manually closed. Only closed requests generate Sustainability and Recycling Heroes credits for your organisation.\n\nQuestions? {{contact_email}}\n\nWarm regards,\nUrbeno Private Limited\nRecycling Heroes™',
  "variables" = ARRAY['request_id','contact_name','cert_no','invoice_no','cert_date','portal_url','contact_email']
WHERE "key" = 'cod_generated';
