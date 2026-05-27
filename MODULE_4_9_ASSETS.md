# MODULE 4 & 9 ASSETS — YouTube Memberships + Skool Community

> **Build Tracker:** `YouTube Monetization — 3-Layer Funnel` (`a10cfb37-fbf1-4848-91fa-856de9e56787`)
> **Hoort bij:** `MARKETING_PAID_PLATFORM_STRATEGY.md` (Laag 3).
> **Status:** assets **klaar** — activatie geblokkeerd tot 1000 subs (M4) resp. converteerbare audience + extern Skool-account (M9).
> **Laatste update:** 2026-05-27

Dit document bevat de kant-en-klare teksten en structuren zodat M4 en M9 op de dag dat de drempels gehaald zijn binnen een uur live kunnen. Geen placeholders — dit is de definitieve copy.

---

## MODULE 4 — YouTube Memberships (€4,99/maand)

### 4.1 Membership-tiers
Eén tier per kanaal, prijs **€4,99/maand**, naam neutraal (NL-naamloosheidsregel — geen persoonsnaam):

| Kanaal | Tier-naam | Belofte |
|---|---|---|
| VermogenTv | Vermogen Insider | Vroege toegang + maandelijkse portefeuille-update |
| BeleggingsTv | Beleggers Kring | Aandelen-watchlist + ledenvragenuur |
| VastgoedTv | Vastgoed Club | Rekenmodellen + dealbesprekingen |
| SpaarTv | Spaar Squad | Bespaaracties + budget-templates |
| CryptoVermogen | Crypto Circle | Marktupdates + veiligheidschecks |

### 4.2 Member-perks (identiek mechanisme per kanaal)
1. **Loyalty badges** naast naam in comments/livechat.
2. **Members-only community posts** (2×/week).
3. **Vroege toegang** tot uploads (24u eerder, unlisted link).
4. **Members-only video** wekelijks (Module 5).
5. **Custom emoji's** per kanaal.

### 4.3 Pinned-comment template (per upload)
```
📌 Word lid van [Kanaalnaam] voor €4,99/maand:
→ Ledenvideo's elke week
→ 24u eerder bij nieuwe uploads
→ Stel je vraag in het maandelijkse ledenvragenuur
Tik op "Lid worden" onder deze video. 💡

⚠️ Niets in deze video is financieel advies. Beleggen brengt risico's met zich mee.
```

### 4.4 Activatie-checklist (op de dag van 1000 subs)
- [ ] YouTube Studio → Verdienen → Channel memberships inschakelen.
- [ ] Tier €4,99 aanmaken met bovenstaande naam + perks.
- [ ] 5 custom emoji's + 2 loyalty badges uploaden.
- [ ] Pinned-comment template plaatsen onder laatste 3 video's.
- [ ] `monetization_streams` rij toevoegen (kind=`membership`, channel_id).

---

## MODULE 9 — Skool Communities (€99/maand)

### 9.1 Twee communities
| Community | Dekt kanalen | Belofte |
|---|---|---|
| **Vermogen Academy** | VermogenTv, BeleggingsTv, SpaarTv, CryptoVermogen | Van eerste euro naar gespreide portefeuille |
| **Vastgoed Academy** | VastgoedTv | Van oriëntatie naar eerste (verhuur)pand |

### 9.2 Community-structuur (Skool secties)
1. **Start hier** — welkom + huisregels + roadmap.
2. **Cursussen** — Finance 101 / Vastgoed 101 (Module 10).
3. **Wekelijkse Q&A** — vaste thread, live call 1×/week.
4. **Wins** — leden delen resultaten (social proof).
5. **Tools & templates** — rekenmodellen, checklists (overlap met lead magnets).

### 9.3 Cursus-outline (Module 10)

**Finance 101 (Vermogen Academy)**
1. Geldbasis: budget, buffer, schuld aflossen.
2. Sparen vs beleggen: wanneer wat.
3. Eerste belegging: broker kiezen, spreiding, kosten.
4. Crypto met beleid: wallets, veiligheid, risico.
5. Lange termijn: indexbeleggen, herbalanceren, belasting (box 3).

**Vastgoed 101 (Vastgoed Academy)**
1. Marktoriëntatie + rendementsbegrippen (bruto/netto/ROI).
2. Financiering: hypotheek, eigen geld, LTV.
3. Een pand doorrekenen (rekenmodel).
4. Verhuur: huurrecht, beheer, kosten.
5. Opschalen: tweede pand, JV-structuren.

### 9.4 Welkomstbericht (nieuw lid)
```
Welkom bij [Community]! 🎉
Begin hier:
1) Lees de huisregels in "Start hier".
2) Volg les 1 in "Cursussen".
3) Stel je voor in "Wins" — wat is je doel dit jaar?
Vragen? Dropje in de wekelijkse Q&A. We zien je daar. 💪

⚠️ Educatie, geen financieel advies.
```

### 9.5 Activatie-checklist
- [ ] Extern Skool-account aanmaken op naam Modiwe Media BV (handmatige gate).
- [ ] 2 communities aanmaken, prijs €99/maand.
- [ ] Secties + welkomstbericht + huisregels plaatsen.
- [ ] Finance 101 + Vastgoed 101 modules uploaden (Module 10).
- [ ] Skool-betaling koppelen aan reconciliatie (Module 11: ledger → Stripe → Moneybird).
- [ ] `monetization_streams` rijen (kind=`skool`, per community).

---

## Compliance (M4 + M9)
- Elke financiële uiting: disclaimer "Educatie, geen financieel advies" + crypto-risicozin.
- NL publieke teksten naamloos (geen persoonsnaam) conform ecosysteemregel.
- Ledenbetalingen lopen via Modiwe Media BV; BTW-afdracht via Moneybird (Module 11).
