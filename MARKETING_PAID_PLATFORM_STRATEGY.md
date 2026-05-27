# MARKETING & PAID PLATFORM STRATEGY — Modiwe Media BV

> **Build Tracker:** `YouTube Monetization — 3-Layer Funnel` (`a10cfb37-fbf1-4848-91fa-856de9e56787`)
> **Doel:** €10.000 MRR eind Q4 2026 uit het YouTube-netwerk.
> **Laatste update:** 2026-05-27
> **Bron van waarheid:** Supabase `shaunumewswpxhmgbtvv` (`youtube_channels`, `affiliate_programs`, `affiliate_channel_mappings`, `monetization_streams`).

---

## 0. Realiteitscheck (waarom de fasering zo is)

Het netwerk heeft op 2026-05-27 **~5 subscribers totaal** over 5 kanalen:

| Kanaal | Niche | Subs | Views |
|---|---|---|---|
| VermogenTv | Vermogensopbouw / beleggen breed | 4 | 767 |
| BeleggingsTv | Beleggen / aandelen | 1 | 284 |
| VastgoedTv | Vastgoed investeren | 0 | 732 |
| SpaarTv | Sparen / persoonlijke financiën | 0 | 256 |
| CryptoVermogen | Crypto | 0 | 381 |

Dit dwingt de volgorde van de 3 lagen af. **Niet elke laag heeft dezelfde drempel:**

| Laag | Mechanisme | Harde drempel | Status nu |
|---|---|---|---|
| **1. AdSense baseline** | YouTube Partner Program | **1000 subs + 4000u watchtime** (of 10M Shorts-views/90d) | ⛔ Geblokkeerd (audience) |
| **2. Affiliate** | Per-niche partnerprogramma's, link in beschrijving/pinned comment | **Geen drempel** — werkt vanaf view #1 | ✅ Activeerbaar nu |
| **3. Betaald platform** | YouTube Memberships €4,99 + Skool €99 | Memberships: 1000 subs. Skool: audience om te converteren | ⛔ Geblokkeerd (audience) |

**Kernconclusie:** zolang de kanalen onder 1000 subs zitten is **Laag 2 (Affiliate) de enige inkomstenlaag die nu te bouwen en te activeren is.** Laag 1 en 3 worden volledig vóórbereid (assets + infra), maar gaan pas live bij het bereiken van de drempels. De groei-naar-1000-subs zelf valt onder build-taak `5 YouTube kanalen monetization (YPP)` (`6bb941a8`), niet onder deze taak.

---

## 1. MRR-doel — opbouw naar €10k

| Bron | Q4 2026 target MRR | Vereiste vóór activatie |
|---|---|---|
| AdSense (Laag 1) | €200 | 1000 subs/4000u per kanaal |
| Affiliate (Laag 2) | €3.000 | Registratie + audience-volume |
| YouTube Memberships (Laag 3a) | €5.000 | 1000 subs per kanaal |
| Skool community (Laag 3b) | €2.000 | Converteerbare audience |
| **Totaal** | **€10.200** | |

Dit is een **richtmodel, geen forecast** — de bedragen zijn pas haalbaar nadat de audience-drempels gehaald zijn. De realistische *eerste* euro's komen uit Affiliate, daarna AdSense, daarna betaald platform.

---

## 2. Laag 2 — Affiliate (de actieve laag)

### 2.1 Niche-matching per kanaal

De `affiliate_programs`-registry (32 programma's) wordt per kanaal gematcht via `affiliate_channel_mappings` (priority 1 = sterkste fit). Leidend principe: **alleen programma's die het Nederlandse publiek van het kanaal daadwerkelijk kan gebruiken** krijgen hoge prioriteit. US-only producten (M1 Finance, Robinhood, Fundrise, Roofstock) krijgen lage prioriteit en worden alleen ingezet in expliciet educatieve "hoe doen ze het in de VS"-content.

| Kanaal | Top affiliate-fits (niche) |
|---|---|
| **CryptoVermogen** | Binance, Bybit, Kraken, TradingView, Interactive Brokers |
| **BeleggingsTv** | TradingView, Interactive Brokers, Binance, Semrush*, Bybit |
| **VermogenTv** | TradingView, Interactive Brokers, Binance, TubeBuddy*, Fundrise |
| **VastgoedTv** | Fundrise, Roofstock, Mashvisor, Interactive Brokers, TradingView |
| **SpaarTv** | Interactive Brokers, TradingView, Binance, vidIQ*, M1 Finance |

\* creator-/SaaS-programma's: lagere audience-fit, ingezet bij "geld verdienen online / tools"-content.

### 2.2 Payout-modellen (feitelijk, publiek bekend — geen aannames)

| Programma | Categorie | Model | Recurring | Land |
|---|---|---|---|---|
| Binance Affiliates | finance_crypto | Rev-share tot 50% van trading fees | Ja (lifetime) | Globaal (MiCA-registratie EU) |
| Bybit Affiliates | finance_crypto | Rev-share tot 30% | Ja | Globaal (ex-US) |
| Kraken Affiliates | finance_crypto | 20% van trading fees | Ja | Globaal |
| TradingView Partner | finance_crypto | 20–30% op abonnementen | Ja | Globaal |
| Interactive Brokers | finance_crypto | CPA + rev-share | Deels | Globaal |
| Fundrise | vastgoed_data | CPA per funded investor | Nee | VS-only |
| Roofstock | vastgoed_data | CPA per transactie | Nee | VS-only |
| Mashvisor | vastgoed_data | Rev-share SaaS | Ja | Globaal (data-VS) |
| TubeBuddy | saas_ai | 30–50% recurring | Ja | Globaal |
| vidIQ | saas_ai | Recurring rev-share | Ja | Globaal |

**Compliance NL/EU:** crypto-affiliate valt onder reclameregels (AFM/MiCA). Elke crypto-link krijgt verplicht een risicodisclaimer in de beschrijving ("Beleggen in crypto brengt risico's met zich mee"). Geen rendementsbeloftes.

### 2.3 Link-architectuur
- Centrale registry in `affiliate_programs` (referral-link per programma, ingevuld ná registratie).
- Per kanaal een vaste blok in de video-beschrijving (gegenereerd via de affiliate link-manager, module M3).
- Pinned comment per upload met de 1–2 hoogst-priority links voor dat kanaal.
- Click/conversie-tracking via `affiliate_clicks` + `affiliate_conversions` → `affiliate_revenue_ledger`.

### 2.4 Registratie-gate (handmatig, bewust)
Conform de Account Setup Agent-architectuur (sessie 9/10): de agent **bereidt** registratie voor (teksten, checklist, ontbrekende gegevens) maar **verzendt nooit autonoom**. `affiliate_link`/`referral_code` blijven leeg tot Orlando het account daadwerkelijk aanmaakt en de link terugplakt. `account_status` blijft `not_started` tot dat moment.

---

## 3. Laag 1 — AdSense baseline (voorbereid, geblokkeerd)

- YPP-aanvraag per kanaal zodra **1000 subs + 4000u watchtime** (of 10M Shorts-views/90d) bereikt is.
- Voorbereiding: alle kanalen hebben monetisatie-relevante metadata (categorie, taal NL, doelpubliek) in `youtube_channels`.
- AdSense-koppeling loopt via het Google-account van het kanaal; payout naar Modiwe Media BV bankrekening.
- Tracking: `youtube_channels.estimated_revenue` + `monetization_streams` (kind=`adsense`).

**Unblock-pad:** zie build-taak `6bb941a8` (groei naar 1000 subs).

---

## 4. Laag 3 — Betaald platform (voorbereid, geblokkeerd)

### 4.1 YouTube Memberships (€4,99/maand)
- Vereist 1000 subs per kanaal. Perks + pinned-comment templates: zie `MODULE_4_9_ASSETS.md`.
- Target €5.000 MRR = ~1000 betalende members netwerkbreed.

### 4.2 Skool community (€99/maand)
- Twee communities: **Vermogen** (beleggen/sparen/crypto-crossover) en **Vastgoed**.
- Vereist een converteerbare audience + extern Skool-account (handmatige gate).
- Cursusmodules: Finance 101 + Vastgoed 101 (zie `MODULE_4_9_ASSETS.md`).
- Target €2.000 MRR = ~20 leden.

---

## 5. Funnel: YouTube → e-mail → community → paid

```
YouTube video  ──►  Lead magnet (gratis PDF)  ──►  E-mail nurture (7 mails)  ──►  Skool / Membership
   (Laag 1+2)         (formulier → Resend)          (affiliate + paid pitch)        (Laag 3)
```

- **Lead magnet** per niche: "Beginnersgids Beleggen", "Vastgoed-rekenmodel", "Crypto-veiligheid checklist".
- **E-mail infra:** Resend + Supabase edge function, `leads`-tabel als store.
- **Nurture:** 7-mail sequence met affiliate-links (Laag 2) + community-pitch (Laag 3).

Infra hiervoor (M6–M8) is gepland maar pas zinvol zodra er verkeer is dat in de funnel stroomt.

---

## 6. Modules & status (14)

| # | Module | Owner | Status 2026-05-27 |
|---|---|---|---|
| 1 | Affiliate registry setup | Executor | ✅ Klaar (32 programma's + per-kanaal top-5 mapping + terms verrijkt) |
| 2 | Account Setup Agent integratie | Backend | 🔄 Queued — lokale LLM-runner ligt plat; terms-analyse deterministisch overgenomen |
| 3 | Affiliate link management | Frontend | ⏳ Wacht op echte referral-links (registratie-gate) |
| 4 | YouTube Membership buttons | Social/Ops | ⛔ Geblokkeerd (subs<1000) — assets klaar |
| 5 | Exclusive member content | Content | ⛔ Geblokkeerd (subs<1000) |
| 6 | Email infrastructure | Backend | ⏳ Gepland |
| 7 | Lead magnet automation | Automation | ⏳ Gepland |
| 8 | Email sequences | Copywriting | ⏳ Gepland |
| 9 | Skool community setup | Community/Ops | ⛔ Geblokkeerd (geen audience + extern account) — assets klaar |
| 10 | Skool course modules | Content | ⏳ Gepland |
| 11 | Payment reconciliation | Finance/Backend | ⏳ Gepland (ledger → Stripe → Moneybird) |
| 12 | Analytics dashboard | Frontend/BI | 🔄 Deels (`/dashboard/media-holding/monetization`) |
| 13 | Paid ad campaign | Marketing | ⏳ Gepland |
| 14 | Community moderation + support | Ops/Community | ⏳ Gepland |

---

## 7. Eerstvolgende echte acties (na deze sessie)

1. **Orlando registreert** de top-priority affiliate-accounts (Binance, TradingView, Interactive Brokers, Bybit, Kraken) — agent heeft teksten + checklist klaar.
2. **Lokale LLM-runner herstarten** (`account-setup-runner` PM2) zodat de queue van 6 runs verwerkt wordt; deterministische terms-data uit deze sessie dient als baseline.
3. **Groei-sprint** naar 1000 subs (taak `6bb941a8`) — deblokkeert Laag 1 + Laag 3.
4. **E-mail infra (M6)** bouwen zodra er verkeer is dat de funnel in stroomt.
