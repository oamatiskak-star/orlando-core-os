-- 219_aquier_products_from_stripe.sql
-- Herbouwt aquier_products uit de AUTORITATIEVE Stripe LIVE-catalogus (account Aquier, NL/EUR).
-- Voegt stripe-ids + bedrag/interval toe; payment_link wordt apart gevuld (Stripe Payment Links).
-- SterkCalc bewust uitgesloten (ander merk). Website-seed (mig 218) wordt vervangen.

alter table public.aquier_products
  add column if not exists stripe_product_id text,
  add column if not exists stripe_price_id   text,
  add column if not exists amount_cents       integer,
  add column if not exists currency           text default 'eur',
  add column if not exists interval           text,           -- one_time|month|year|90d
  add column if not exists payment_link       text;
alter table public.aquier_products alter column url drop not null;
alter table public.aquier_products alter column needs_review set default false;

truncate table public.aquier_products;

insert into public.aquier_products
  (sku, name, kind, description, audiences, price, amount_cents, currency, interval, stripe_product_id, stripe_price_id, needs_review, sort) values
  ('basis-investeringsscan','Basis Investeringsscan','report','Snelle go/no-go score op een object.','{investor,developer,agent,dealfinder}','€97',9700,'eur','one_time','prod_Udz1KKfGZ6AOqn','price_1Teh3W8CCmvrqg0biPZgkDZY',false,10),
  ('premium-dealscan','Premium Dealscan','report','Vlaggenschip-scan met comparables en biedadvies.','{investor,developer,agent,dealfinder}','€297',29700,'eur','one_time','prod_Udz2APpmWdpgAt','price_1Teh408CCmvrqg0bMsKk5QzU',false,20),
  ('transformatie-analyse','Transformatie-analyse','report','Kantoor-naar-woning transformatiepotentieel.','{developer,investor}','€499',49900,'eur','one_time','prod_Udz2Zt9xJkS4sf','price_1Teh448CCmvrqg0bK8aCXQpU',false,30),
  ('optop-splitsanalyse','Optop-/Splitsanalyse','report','Optop- en splitspotentieel van een object.','{developer,investor}','€749',74900,'eur','one_time','prod_Udz2zKtr7iOyi9','price_1Teh498CCmvrqg0bdq6u75ME',false,40),
  ('sloop-nieuwbouwanalyse','Sloop- en Nieuwbouwanalyse','report','Haalbaarheid sloop + nieuwbouw.','{developer}','€1.250',125000,'eur','one_time','prod_Udz27h9V9AM3vA','price_1Teh4F8CCmvrqg0b4HjbdigE',false,50),
  ('ontwikkelaar-intelligence-rapport','Ontwikkelaar Intelligence-rapport','report','Diepe ontwikkel-intelligence per object.','{developer,institutional}','€2.500',250000,'eur','one_time','prod_Udz2C3dabJ95NN','price_1Teh4K8CCmvrqg0bo57IN9KW',false,60),
  ('exclusive-deal-lock','Exclusive Deal Lock','report','Exclusieve lock op een deal.','{investor,developer,dealfinder}','€2.500',250000,'eur','one_time','prod_Udz2ALe8x44EjT','price_1Teh4S8CCmvrqg0bhfB0IRVg',false,70),
  ('acquisitiepakket','Acquisitiepakket','report','Volledig acquisitiepakket per object.','{developer,investor}','€4.500',450000,'eur','one_time','prod_Udz2dikib3rO1y','price_1Teh4O8CCmvrqg0b3xkSxY6d',false,80),
  ('compleet-ontwikkelpakket','Compleet Ontwikkelpakket','report','End-to-end ontwikkelpakket.','{developer,institutional}','€15.000',1500000,'eur','one_time','prod_Udz2mJFQBZKguo','price_1Teh4W8CCmvrqg0bkjs9115c',false,90),
  ('mandaat-i-explorer','Mandaat I — Explorer','membership','Marktscreening, go/no-go, basisroutes.','{investor,agent,dealfinder}','€199/mnd',19900,'eur','month','prod_UWUXlJtIqV07zC','price_1TZyG98CCmvrqg0bhJAifvuw',false,100),
  ('mandaat-ii-developer','Mandaat II — Developer','membership','Capital stack, vergunningen, white-label, 20 analyses/mnd.','{developer,institutional}','€299/mnd',29900,'eur','month','prod_UWUXPft8eAQqEY','price_1TZyGA8CCmvrqg0b8bYF6LH5',false,110),
  ('mandaat-iii-warroom','Mandaat III — WarRoom (Black)','membership','Exclusieve dealflow, elite/distressed objecten.','{investor,institutional,family_office}','€14.940/jr',1494000,'eur','year','prod_UWUXssDec3tluS','price_1TZyGE8CCmvrqg0bBgW6JPEG',false,120),
  ('mandaat-iv-capital-desk','Mandaat IV — Capital Desk','membership','Multi-user governance, private deal rooms, API, success manager.','{institutional,family_office,financier}','€45.000/jr',4500000,'eur','year','prod_UWUXJzhup7f59d','price_1TZyGG8CCmvrqg0bh3JM4Wm6',false,130),
  ('mandaat-v-track-record','Mandaat V — Track Record & Private Deal Room','membership','Private deal-samenwerking en mandaatbegeleiding.','{institutional,family_office}','€5.000/90d',500000,'eur','90d','prod_UYxQBQ4lt7NxPI','price_1TeFK78CCmvrqg0b0EPfpjmm',false,140),
  ('developer-extra-seat','Aquier Developer Extra Seat','membership','Extra seat op Mandaat II — Developer.','{developer}','€99/mnd',9900,'eur','month','prod_UYxQ0hakIsifyl','price_1TZyGC8CCmvrqg0bkDfiiIQv',false,150),
  ('makelaar-solo','Aquier Makelaar Solo','membership','Aquier voor de solo-makelaar.','{agent}','€349/mnd',34900,'eur','month','prod_Uc9jjb90JOa4Z6','price_1TcvQ18CCmvrqg0bKpdwgy0P',false,160),
  ('makelaar-kantoor','Aquier Makelaar Kantoor','membership','Aquier voor het makelaarskantoor.','{agent}','€699/mnd',69900,'eur','month','prod_Uc9jM0KHZ3v4Q8','price_1TcvQd8CCmvrqg0bBJU4Rf7f',false,170),
  ('white-label-seat','White-label Seat (Makelaar)','membership','White-label rapport-seat.','{agent}','€99/mnd',9900,'eur','month','prod_UYxQooSwjfMx1N','price_1TZyGQ8CCmvrqg0bxbxom2vo',false,180),
  ('preferred-placement','Preferred Placement (Financier)','membership','Preferente plaatsing voor financiers.','{financier}','€2.500/mnd',250000,'eur','month','prod_UYxQ7NjTqBcCWX','price_1TZyGR8CCmvrqg0bdMvtIyqh',false,190),
  ('api-sandbox','Aquier API Sandbox','membership','API-toegang (sandbox).','{institutional,financier}','€199/mnd',19900,'eur','month','prod_UYxQK3E26ZB5dM','price_1TZyGS8CCmvrqg0bEfyKZO7j',false,200);
