-- UAT fixes: insert missing email templates (request_changes, vehicle_assigned)
INSERT INTO "email_templates" ("id", "key", "name", "subject", "body", "variables", "created_at")
VALUES (
  'tpl_request_changes',
  'request_changes',
  'Changes Requested',
  'Action required — your request {{request_id}} needs changes',
  E'Dear {{contact_name}},\n\nOur operations team has reviewed your e-waste collection request and would like you to make some changes before we can proceed.\n\n  Request ID : {{request_id}}\n  Site       : {{site_name}}\n\nChanges requested:\n  {{reason}}\n\nPlease sign in to your Urb TecTrack portal, open this request, and update it as requested. Once you save, our team will be notified immediately.\n\nIf you have any questions, please reply to this email or reach us on WhatsApp.\n\nWarm regards,\nUrbeno Private Limited\nRecycling Heroes™',
  ARRAY['request_id','client_name','site_name','reason','contact_name'],
  NOW()
) ON CONFLICT ("key") DO NOTHING;

INSERT INTO "email_templates" ("id", "key", "name", "subject", "body", "variables", "created_at")
VALUES (
  'tpl_vehicle_assigned',
  'vehicle_assigned',
  'Pickup Scheduled',
  'Pickup scheduled for request {{request_id}} — {{expected_date}}',
  E'Dear {{contact_name}},\n\nGreat news! A pickup has been scheduled for your e-waste collection request.\n\n  Request ID      : {{request_id}}\n  Site            : {{site_name}}\n  Expected arrival: {{expected_date}}\n  Vehicle         : {{registration}}\n  Driver          : {{driver_name}} · {{driver_phone}}\n\nPlease ensure the material is ready and accessible at the pickup location. If you need to reschedule or have any concerns, contact us as soon as possible.\n\nWarm regards,\nUrbeno Private Limited\nRecycling Heroes™',
  ARRAY['request_id','site_name','expected_date','registration','driver_name','driver_phone','contact_name','client_name'],
  NOW()
) ON CONFLICT ("key") DO NOTHING;
