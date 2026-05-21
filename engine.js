const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const SUPABASE_URL = "https://pebhikfbpgntedvbxqph.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlYmhpa2ZicGdudGVkdmJ4cXBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzk1Njc4NywiZXhwIjoxNzQ5NDkyNzg3fQ.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlYmhpa2ZicGdudGVkdmJ4cXBoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzk1Njc4NywiZXhwIjoxNzQ5NDkyNzg3fQ.6MTc3NjODY4MTAwLDYwNjI0OTcxMDZUCzI1lnDK4";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: 'trevorvaughan@hudsonseed.com', pass: 'cdpw jobq ujdz oyag' }
});
async function run() {
  const { data: leads, error } = await supabase.from('leads').select('*').eq('status', 'lead').limit(10);
  if (error || !leads || leads.length === 0) return;
  for (let lead of leads) {
    await transporter.sendMail({
      from: '"Trevor Vaughan" <trevorvaughan@hudsonseed.com>',
      to: lead.email,
      subject: `HudsonSeed introduction - ${lead.school_name}`,
      text: `Hi ${lead.first_name || 'Principal'},\n\nI hope your week is going well.\n\nI wanted to reach out briefly regarding HudsonSeed and how we can support your students at ${lead.school_name || 'your school'}.\n\nBest,\n\nTrevor Vaughan\nFounder, HudsonSeed`,
      headers: { 'X-Unsent': '1' }
    });
    await supabase.from('leads').update({ status: 'drafted' }).eq('id', lead.id);
  }
}
run();
