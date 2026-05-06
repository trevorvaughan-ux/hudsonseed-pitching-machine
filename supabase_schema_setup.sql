-- HudsonSeed Pitch Machine Supabase Schema - Grok Finalized May 6 2026

-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Schools table
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  district TEXT,
  city TEXT NOT NULL DEFAULT 'Jersey City',
  state TEXT DEFAULT 'NJ',
  zip TEXT,
  website TEXT,
  contact_email TEXT,
  contact_name TEXT,
  phone TEXT,
  grade_levels TEXT[],
  enrollment INTEGER,
  yoga_interest_level INTEGER CHECK (yoga_interest_level BETWEEN 1 AND 5),
  last_contacted TIMESTAMPTZ,
  status TEXT DEFAULT 'new' CHECK (status IN ('new','contacted','pitched','warm','closed_won','closed_lost')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT,
  title TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pitches table
CREATE TABLE IF NOT EXISTS pitches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID REFERENCES schools(id),
  lead_id UUID REFERENCES leads(id),
  subject TEXT,
  body TEXT,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft',
  reply_sentiment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Replies table
CREATE TABLE IF NOT EXISTS replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pitch_id UUID REFERENCES pitches(id),
  from_email TEXT,
  body TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  sentiment TEXT,
  next_action TEXT
);

-- Machine logs
CREATE TABLE IF NOT EXISTS machine_logs (
  id BIGSERIAL PRIMARY KEY,
  run_type TEXT,
  records_processed INTEGER,
  success_count INTEGER,
  error_count INTEGER,
  details JSONB,
  run_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_schools_city_status ON schools(city, status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_logs ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies (for agents)
CREATE POLICY service_role_bypass ON schools USING (true) WITH CHECK (true);
CREATE POLICY service_role_bypass ON leads USING (true) WITH CHECK (true);
CREATE POLICY service_role_bypass ON pitches USING (true) WITH CHECK (true);
CREATE POLICY service_role_bypass ON replies USING (true) WITH CHECK (true);
CREATE POLICY service_role_bypass ON machine_logs USING (true) WITH CHECK (true);

-- Materialized view for dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_counts AS
SELECT 
  (SELECT COUNT(*) FROM schools) as total_schools,
  (SELECT COUNT(*) FROM schools WHERE status = 'new') as new_schools,
  (SELECT COUNT(*) FROM pitches WHERE status = 'draft') as draft_pitches;

-- Seed 10 test NJ schools
INSERT INTO schools (name, city, state, status, enrollment, grade_levels) VALUES
('Hoboken Public Schools', 'Hoboken', 'NJ', 'new', 4500, ARRAY['K','1','2','3','4','5']),
('Jersey City Board of Education', 'Jersey City', 'NJ', 'new', 28000, ARRAY['K','1','2','3','4','5','6']),
('Union City School District', 'Union City', 'NJ', 'new', 12000, ARRAY['K','1','2','3']),
('Weehawken Township Schools', 'Weehawken', 'NJ', 'new', 1800, ARRAY['K','1','2','3','4']),
('North Bergen School District', 'North Bergen', 'NJ', 'new', 8500, ARRAY['K','1','2','3','4','5']),
('Secaucus Public Schools', 'Secaucus', 'NJ', 'new', 2200, ARRAY['K','1','2','3']),
('Guttenberg Public Schools', 'Guttenberg', 'NJ', 'new', 950, ARRAY['K','1','2']),
('West New York Board of Education', 'West New York', 'NJ', 'new', 7800, ARRAY['K','1','2','3','4']),
('Bayonne Public Schools', 'Bayonne', 'NJ', 'new', 9200, ARRAY['K','1','2','3','4','5']),
('Kearny Public Schools', 'Kearny', 'NJ', 'new', 6500, ARRAY['K','1','2','3','4','5'])
ON CONFLICT DO NOTHING;

-- Refresh materialized view
REFRESH MATERIALIZED VIEW dashboard_counts;
