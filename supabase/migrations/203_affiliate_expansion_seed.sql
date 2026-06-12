-- 203_affiliate_expansion_seed.sql
-- AFFILIATE MARKET EXPANSION: ~44 programma's voor de winnaarkanalen
-- (maker/3D-print/laser/marketplace/AI-video/automation/productivity/creator) +
-- rpm_equiv/niche_fit voor bestaande programma's + Kanaal->Niche->Programma-koppeling.
-- EPC/RPM = research-schattingen (metadata.epc_source), valideren bij signup.

insert into public.affiliate_programs
  (company_id, name, category, payout_model, recurring, cookie_days, api_available, avg_epc, rpm_equiv, audience_fit_score, content_keywords, niche_fit, account_status, metadata)
select (select company_id from affiliate_programs where company_id is not null limit 1),
       v.name, v.category, v.payout, v.recurring, v.cookie, v.api, v.epc, v.rpm, v.fit,
       string_to_array(v.kw, ','), v.nf, 'not_started',
       jsonb_build_object('epc_source','research_estimate_pending_validation')
from (values
  ('xTool','maker_hardware','6-10% op laser/CNC',true,30,false,3.0,16.0,82,'laser cutter,cnc,maker','maker'),
  ('Glowforge','maker_hardware','CPA ~$100+/sale',false,30,false,2.5,12.0,78,'laser cutter,maker,diy','maker'),
  ('Bambu Lab','maker_hardware','~5% op 3D-printers',true,30,false,1.5,10.0,85,'3d printing,fdm,maker','maker'),
  ('Snapmaker','maker_hardware','~5% (3-in-1)',true,60,false,2.0,10.0,80,'cnc,laser,3d printer','maker'),
  ('Creality','maker_hardware','3-8% op 3D-printers',false,30,false,1.0,6.0,80,'3d printer,maker','maker'),
  ('Elegoo','maker_hardware','5-10% resin/fdm',false,30,false,0.8,5.0,78,'resin printer,maker','maker'),
  ('Anycubic','maker_hardware','5-8% op printers',false,30,false,0.8,5.0,76,'3d printer,resin','maker'),
  ('Prusa Research','maker_hardware','affiliate op printers',false,30,false,0.9,5.0,80,'3d printer,open source','maker'),
  ('Two Trees','maker_hardware','~5% laser/printer',false,30,false,0.9,4.0,70,'laser,3d printer','maker'),
  ('Cricut','maker_hardware','crafting CPA',false,30,false,0.8,4.0,60,'crafting,diy,maker','maker'),
  ('Seeed Studio','maker_hardware','electronics affiliate',false,30,false,0.6,3.0,65,'electronics,iot,maker','maker'),
  ('Amazon Associates NL/EU','marketplace','1-4% op alle producten',false,1,true,0.4,5.0,70,'gadgets,products,shop','satisfying'),
  ('Amazon Associates US','marketplace','1-4% op alle producten',false,1,true,0.4,4.0,68,'gadgets,products,shop','satisfying'),
  ('Banggood Affiliate','marketplace','3-10% gadgets/maker',false,30,true,0.5,4.0,68,'gadgets,maker,tools','satisfying'),
  ('AliExpress Affiliate','marketplace','2-8% marktplaats',false,30,true,0.4,4.0,66,'gadgets,maker,cheap','satisfying'),
  ('Temu Affiliate','marketplace','hoge CPA nieuwe klant',false,30,false,0.6,5.0,60,'products,deals,gadgets','satisfying'),
  ('Geekbuying','marketplace','3-8% tech/3d',false,30,false,0.5,3.0,62,'gadgets,3d printer,tech','maker'),
  ('Tindie','marketplace','maker-marktplaats',false,30,false,0.5,2.0,70,'maker,hardware,diy','maker'),
  ('ElevenLabs','ai_video','~22% recurring (voice AI)',true,30,true,1.2,7.0,80,'ai voice,tts,voiceover','ai'),
  ('HeyGen','ai_video','30% recurring (avatar)',true,30,false,1.3,8.0,80,'ai video,avatar','ai'),
  ('Synthesia','ai_video','affiliate AI-video',true,30,false,1.5,9.0,82,'ai video,avatar','ai'),
  ('Descript','ai_video','15-30% recurring',true,30,false,0.9,6.0,78,'video editing,ai,podcast','ai'),
  ('Runway ML','ai_video','affiliate generative video',true,30,false,1.0,6.0,78,'ai video,generative','ai'),
  ('Leonardo AI','ai_video','affiliate AI-image',true,30,false,0.6,3.0,70,'ai art,image','ai'),
  ('Pictory','ai_video','20% recurring',true,30,false,0.8,5.0,74,'ai video,repurpose,shorts','ai'),
  ('InVideo AI','ai_video','30% recurring',true,30,false,0.8,5.0,74,'ai video,editor','ai'),
  ('Murf AI','ai_video','20-30% recurring (voice)',true,30,false,0.9,5.0,72,'ai voice,voiceover','ai'),
  ('Opus Clip','ai_video','20% recurring (clips)',true,30,false,0.9,5.0,76,'ai clips,shorts,repurpose','ai'),
  ('Make.com','automation','recurring no-code',true,30,true,1.0,6.0,76,'automation,no-code,integration','automation'),
  ('Zapier','automation','recurring integraties',true,30,false,0.8,5.0,74,'automation,integration','automation'),
  ('Pabbly','automation','30%+ recurring lifetime',true,9999,false,1.2,7.0,72,'automation,saas,connect','automation'),
  ('Airtable','automation','affiliate database',false,90,false,0.7,4.0,70,'database,no-code','automation'),
  ('Bardeen','automation','affiliate ai-automation',true,30,false,0.6,3.0,68,'automation,ai,scraper','automation'),
  ('n8n','automation','cloud affiliate workflow',true,30,true,0.6,3.0,70,'automation,workflow,open source','automation'),
  ('ClickUp','productivity','recurring PM-tool',true,90,false,0.9,5.0,72,'productivity,project management','productivity'),
  ('Grammarly','productivity','CPA writing-tool',false,90,false,0.7,5.0,68,'writing,grammar','productivity'),
  ('Motion (usemotion)','productivity','25% recurring AI-agenda',true,30,false,0.9,5.0,70,'ai calendar,productivity','productivity'),
  ('Todoist','productivity','affiliate todo',false,30,false,0.4,2.0,60,'todo,productivity','productivity'),
  ('Epidemic Sound','creator_tools','recurring muziek voor creators',true,30,true,1.0,7.0,84,'music,royalty-free,creator','creator'),
  ('Artlist','creator_tools','recurring muziek/stock',true,30,false,0.9,6.0,80,'music,stock,creator','creator'),
  ('Envato Elements','creator_tools','30% eerste jaar',true,30,true,0.8,5.0,76,'stock,templates,creator','creator'),
  ('VEED.io','creator_tools','30% recurring editor',true,30,false,0.8,5.0,74,'video editing,creator','creator'),
  ('Riverside.fm','creator_tools','20% recurring opname',true,30,false,0.8,5.0,72,'podcast,recording,creator','creator'),
  ('Placeit by Envato','creator_tools','affiliate mockups',false,30,false,0.5,3.0,68,'mockups,design,thumbnails','creator')
) as v(name,category,payout,recurring,cookie,api,epc,rpm,fit,kw,nf)
where not exists (select 1 from public.affiliate_programs p2 where p2.name = v.name);

-- bestaande programma's: rpm_equiv + niche_fit (unified Top-50 ranking)
update public.affiliate_programs set rpm_equiv = x.rpm, niche_fit = x.nf from (values
  ('TradingView Partner Program',14.0,'finance'),('Binance Affiliates',10.0,'finance'),
  ('HubSpot Affiliate Program',10.0,'productivity'),('Interactive Brokers Affiliates',9.0,'finance'),
  ('Semrush Affiliate Program',9.0,'productivity'),('Bybit Affiliates',8.0,'finance'),
  ('ClickFunnels Affiliates',7.0,'productivity'),('Kraken Affiliates',6.0,'finance'),
  ('Jasper AI Affiliate',6.0,'ai'),('TubeBuddy Affiliate',6.0,'creator'),('vidIQ Affiliate',5.0,'creator'),
  ('SurferSEO Affiliate',5.0,'productivity'),('Shopify Affiliates',5.0,'productivity'),
  ('Webflow Affiliates',4.0,'creator'),('Notion Affiliate Program',4.0,'productivity'),
  ('Adobe Affiliates',4.0,'creator'),('Canva Affiliates',3.0,'creator'),
  ('Mashvisor',3.0,'vastgoed'),('Fundrise',2.0,'vastgoed'),('Roofstock',2.0,'vastgoed'),
  ('M1 Finance Affiliate',2.0,'finance'),('Robinhood Affiliates',2.0,'finance')
) as x(name,rpm,nf) where affiliate_programs.name = x.name;

-- Kanaal -> dominante niche -> best-passend programma -> verwachte omzet/30d
create or replace view public.v_channel_revenue_match as
with chan as (
  select cr.channel_id, cr.channel_name, cr.views_30d,
    (select wi.niche from public.v_winner_intelligence wi where wi.channel = cr.channel_name group by wi.niche order by count(*) desc limit 1) as dom_niche
  from public.v_channel_ranking cr
),
mapped as (
  select c.*,
    case when dom_niche ~* 'brick|lego' then 'maker'
         when dom_niche ~* 'loop|satisfying|mini-world|seamless|cutting' then 'satisfying'
         when dom_niche ~* 'crypto' then 'finance'
         when dom_niche ~* 'finance|vermogen|beleg|spaar' then 'finance'
         when dom_niche ~* 'vastgoed|property' then 'vastgoed'
         else 'satisfying' end as niche_fit
  from chan c
)
select m.channel_id, m.channel_name, m.views_30d, m.dom_niche, m.niche_fit,
  b.name as best_program, b.rpm_equiv, b.tier,
  round(m.views_30d/1000.0 * coalesce(b.rpm_equiv,0), 2) as expected_rev_30d_eur
from mapped m
left join lateral (
  select name, rpm_equiv, tier from public.affiliate_programs ap
  where ap.niche_fit = m.niche_fit order by ap.rpm_equiv desc nulls last limit 1
) b on true;

comment on view public.v_channel_revenue_match is
  'AFFILIATE EXPANSION: Kanaal -> dominante niche -> best-passend programma (rpm) -> verwachte omzet/30d.';

select public.rank_affiliate_programs();
