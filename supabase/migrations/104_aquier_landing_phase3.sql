-- Phase 3: Aquier as Central Hub - Landing Page Tracking & Funnel Events

-- Table: aquier_landing_events
-- Tracks when visitors land on Aquier landing pages from YouTube videos
CREATE TABLE IF NOT EXISTS aquier_landing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES media_holding_channels(id) ON DELETE CASCADE,
  video_id uuid NOT NULL,
  affiliate_id uuid NOT NULL REFERENCES affiliate_programs(id) ON DELETE CASCADE,
  visitor_country text NOT NULL,
  visitor_language text,
  visitor_intent text,
  funnel_type text CHECK (funnel_type IN ('membership', 'saas', 'course', 'coaching', 'hybrid')),
  primary_goal text CHECK (primary_goal IN ('revenue', 'leads', 'subscribers')),
  visitor_id text,
  session_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_aquier_landing_events_video_id ON aquier_landing_events(video_id);
CREATE INDEX idx_aquier_landing_events_channel_id ON aquier_landing_events(channel_id);
CREATE INDEX idx_aquier_landing_events_affiliate_id ON aquier_landing_events(affiliate_id);
CREATE INDEX idx_aquier_landing_events_created_at ON aquier_landing_events(created_at);

-- Table: aquier_affiliate_clicks
-- Tracks clicks on affiliate links from Aquier landing pages
CREATE TABLE IF NOT EXISTS aquier_affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL,
  affiliate_id uuid NOT NULL REFERENCES affiliate_programs(id) ON DELETE CASCADE,
  visitor_country text NOT NULL,
  visitor_id text,
  visitor_utm_source text,
  visitor_utm_medium text,
  visitor_utm_campaign text,
  click_timestamp timestamp with time zone DEFAULT now(),
  conversion_latency_hours int,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_aquier_affiliate_clicks_video_id ON aquier_affiliate_clicks(video_id);
CREATE INDEX idx_aquier_affiliate_clicks_affiliate_id ON aquier_affiliate_clicks(affiliate_id);
CREATE INDEX idx_aquier_affiliate_clicks_visitor_id ON aquier_affiliate_clicks(visitor_id);
CREATE INDEX idx_aquier_affiliate_clicks_created_at ON aquier_affiliate_clicks(created_at);

-- Table: aquier_conversion_events
-- Tracks conversions from affiliate links back to Aquier tracking pixel
CREATE TABLE IF NOT EXISTS aquier_conversion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL,
  affiliate_id uuid NOT NULL REFERENCES affiliate_programs(id) ON DELETE CASCADE,
  visitor_country text NOT NULL,
  visitor_id text,
  conversion_value decimal(10, 2),
  conversion_currency text DEFAULT 'USD',
  conversion_type text NOT NULL CHECK (conversion_type IN ('signup', 'purchase', 'trial', 'trial_to_paid', 'referral')),
  source_affiliate text,
  is_recurring boolean DEFAULT false,
  attribution_chain jsonb,
  timestamp timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_aquier_conversion_events_video_id ON aquier_conversion_events(video_id);
CREATE INDEX idx_aquier_conversion_events_affiliate_id ON aquier_conversion_events(affiliate_id);
CREATE INDEX idx_aquier_conversion_events_visitor_id ON aquier_conversion_events(visitor_id);
CREATE INDEX idx_aquier_conversion_events_conversion_type ON aquier_conversion_events(conversion_type);
CREATE INDEX idx_aquier_conversion_events_created_at ON aquier_conversion_events(created_at);

-- Table: aquier_funnel_events
-- Tracks visitor journey through the funnel (landing view → click → conversion)
CREATE TABLE IF NOT EXISTS aquier_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL,
  affiliate_id uuid NOT NULL REFERENCES affiliate_programs(id) ON DELETE CASCADE,
  visitor_id text,
  session_id text,
  stage text NOT NULL CHECK (stage IN ('landing_view', 'affiliate_link_click', 'external_site_visit', 'conversion')),
  stage_timestamp timestamp with time zone DEFAULT now(),
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_aquier_funnel_events_video_id ON aquier_funnel_events(video_id);
CREATE INDEX idx_aquier_funnel_events_affiliate_id ON aquier_funnel_events(affiliate_id);
CREATE INDEX idx_aquier_funnel_events_visitor_id ON aquier_funnel_events(visitor_id);
CREATE INDEX idx_aquier_funnel_events_stage ON aquier_funnel_events(stage);
CREATE INDEX idx_aquier_funnel_events_created_at ON aquier_funnel_events(created_at);

-- Table: aquier_membership_events
-- Tracks membership signups and upgrades from Aquier landing pages
CREATE TABLE IF NOT EXISTS aquier_membership_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL,
  channel_id uuid NOT NULL REFERENCES media_holding_channels(id) ON DELETE CASCADE,
  affiliate_id uuid NOT NULL REFERENCES affiliate_programs(id) ON DELETE CASCADE,
  member_country text NOT NULL,
  membership_tier text CHECK (membership_tier IN ('free', 'basic', 'premium', 'elite')),
  conversion_value decimal(10, 2),
  recurring_value decimal(10, 2),
  lifetime_value decimal(10, 2),
  signup_date timestamp with time zone DEFAULT now(),
  churn_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_aquier_membership_events_video_id ON aquier_membership_events(video_id);
CREATE INDEX idx_aquier_membership_events_channel_id ON aquier_membership_events(channel_id);
CREATE INDEX idx_aquier_membership_events_affiliate_id ON aquier_membership_events(affiliate_id);
CREATE INDEX idx_aquier_membership_events_signup_date ON aquier_membership_events(signup_date);

-- Table: aquier_checkout_events
-- Tracks checkout/purchase events across different product types
CREATE TABLE IF NOT EXISTS aquier_checkout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL,
  channel_id uuid NOT NULL REFERENCES media_holding_channels(id) ON DELETE CASCADE,
  affiliate_id uuid NOT NULL REFERENCES affiliate_programs(id) ON DELETE CASCADE,
  product_type text CHECK (product_type IN ('saas', 'membership', 'course', 'coaching', 'affiliate')),
  customer_country text NOT NULL,
  order_value decimal(10, 2) NOT NULL,
  currency text DEFAULT 'USD',
  customer_id text,
  email text,
  checkout_timestamp timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_aquier_checkout_events_video_id ON aquier_checkout_events(video_id);
CREATE INDEX idx_aquier_checkout_events_affiliate_id ON aquier_checkout_events(affiliate_id);
CREATE INDEX idx_aquier_checkout_events_product_type ON aquier_checkout_events(product_type);
CREATE INDEX idx_aquier_checkout_events_created_at ON aquier_checkout_events(created_at);

-- Trigger: Update aquier_landing_events timestamp
CREATE OR REPLACE FUNCTION update_aquier_landing_events_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_aquier_landing_events_timestamp
BEFORE UPDATE ON aquier_landing_events
FOR EACH ROW
EXECUTE FUNCTION update_aquier_landing_events_timestamp();

-- Trigger: Update aquier_membership_events timestamp
CREATE OR REPLACE FUNCTION update_aquier_membership_events_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_aquier_membership_events_timestamp
BEFORE UPDATE ON aquier_membership_events
FOR EACH ROW
EXECUTE FUNCTION update_aquier_membership_events_timestamp();

-- View: Aquier Funnel Summary
-- Aggregates funnel data for analysis
CREATE OR REPLACE VIEW v_aquier_funnel_summary AS
SELECT
  video_id,
  affiliate_id,
  COUNT(DISTINCT CASE WHEN stage = 'landing_view' THEN visitor_id END) as landing_views,
  COUNT(DISTINCT CASE WHEN stage = 'affiliate_link_click' THEN visitor_id END) as affiliate_clicks,
  COUNT(DISTINCT CASE WHEN stage = 'conversion' THEN visitor_id END) as conversions,
  ROUND(
    (COUNT(DISTINCT CASE WHEN stage = 'affiliate_link_click' THEN visitor_id END)::numeric /
     NULLIF(COUNT(DISTINCT CASE WHEN stage = 'landing_view' THEN visitor_id END), 0) * 100)::numeric,
    2
  ) as click_through_rate,
  ROUND(
    (COUNT(DISTINCT CASE WHEN stage = 'conversion' THEN visitor_id END)::numeric /
     NULLIF(COUNT(DISTINCT CASE WHEN stage = 'affiliate_link_click' THEN visitor_id END), 0) * 100)::numeric,
    2
  ) as conversion_rate,
  DATE_TRUNC('day', MAX(stage_timestamp)) as last_activity_date
FROM aquier_funnel_events
GROUP BY video_id, affiliate_id;

-- RLS Policies
ALTER TABLE aquier_landing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE aquier_affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE aquier_conversion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE aquier_funnel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE aquier_membership_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE aquier_checkout_events ENABLE ROW LEVEL SECURITY;

-- Policy: service_role has full access to all tables
CREATE POLICY "service_role_aquier_landing_all" ON aquier_landing_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_aquier_clicks_all" ON aquier_affiliate_clicks
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_aquier_conversions_all" ON aquier_conversion_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_aquier_funnel_all" ON aquier_funnel_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_aquier_membership_all" ON aquier_membership_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service_role_aquier_checkout_all" ON aquier_checkout_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Policy: authenticated users have read-only access
CREATE POLICY "authenticated_aquier_landing_read" ON aquier_landing_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_aquier_clicks_read" ON aquier_affiliate_clicks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_aquier_conversions_read" ON aquier_conversion_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_aquier_funnel_read" ON aquier_funnel_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_aquier_membership_read" ON aquier_membership_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_aquier_checkout_read" ON aquier_checkout_events
  FOR SELECT USING (auth.role() = 'authenticated');
