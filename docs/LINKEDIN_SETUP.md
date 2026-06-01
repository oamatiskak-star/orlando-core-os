# LinkedIn Koppeling Setup

End-to-end om de **Aquier** LinkedIn-bedrijfspagina te koppelen aan het dashboard
(`/dashboard/social/connect`). Spiegelt `aquire/docs/FACEBOOK_SETUP.md`.

> **Realistische verwachting:** auto-posten naar een LinkedIn *organisatie* vereist de
> **Community Management API**, die LinkedIn handmatig reviewt (kan dagen duren).
> Tot goedkeuring werkt de dashboard-pagina `/dashboard/social/linkedin` als
> **planner/tracker** (je post handmatig op LinkedIn). De koppeling-velden hieronder
> kun je nu al invullen; auto-publish schakelt aan zodra de API is goedgekeurd.

---

## 1. App aanmaken (Orlando — ~15 min)

1. https://www.linkedin.com/developers/apps → **Create app**
2. App name: `Aquier` · **LinkedIn Page**: koppel de bestaande **Aquier** company page
   (verplicht — anders geen org-scopes) · Logo uploaden · Create
3. Tab **Auth** → noteer:
   - **Client ID**  → veld `client_id`
   - **Primary Client Secret** → veld `client_secret`
4. Tab **Auth → OAuth 2.0 settings → Authorized redirect URLs**, voeg toe:
   `https://<dashboard-domein>/api/social/oauth/linkedin/callback`
   (alleen nodig als we later de volledige redirect-flow aanzetten; voor handmatige
   token-paste niet vereist.)

## 2. Producten aanvragen (Orlando — review-gate)

Tab **Products** → request:
- **Sign In with LinkedIn using OpenID Connect** (instant)
- **Share on LinkedIn** (`w_member_social` — instant, post als persoon)
- **Community Management API** (`w_organization_social`, `r_organization_social` —
  **review vereist**, post als de Aquier-pagina)

Vul het review-formulier in met: use-case = "scheduling & publishing our own
company page content from an internal dashboard". Dit is de gate voor org-posting.

## 3. Organisatie-ID (URN) ophalen (~5 min)

1. Open de Aquier company page als **admin**.
2. URL bevat het nummer: `linkedin.com/company/XXXXXXXX/admin` → `XXXXXXXX`.
3. URN-vorm voor de API: `urn:li:organization:XXXXXXXX` → veld `external_account_id`.

## 4. Access token genereren (~5 min)

- Snelst voor test: tab **Auth → OAuth 2.0 token generator** → selecteer scopes
  (`w_member_social` werkt direct; `w_organization_social` pas na §2-goedkeuring) →
  **Generate** → kopieer token → veld `access_token`.
- Tokens: access ~60 dagen, refresh ~365 dagen. Refresh-flow voegen we toe bij de
  callback-route zodra Community Management API live is.

## 5. Invullen in het dashboard (~2 min)

`/dashboard/social/connect` → kaart **LinkedIn → Verbinden**:

| Veld in modal | Waarde |
|---|---|
| Account label | `Aquier` |
| Pagina/Org ID | `urn:li:organization:XXXXXXXX` |
| Pagina-naam | `Aquier` |
| Pagina-URL | `https://www.linkedin.com/company/aquier` |
| Client ID | uit §1.3 |
| Client Secret | uit §1.3 |
| Access Token | uit §4 |

Opslaan → status wordt **Verbonden** (token aanwezig) of **Geconfigureerd**
(alleen app-creds). Secrets worden server-side opgeslagen, nooit naar de browser
teruggestuurd.

## 6. Facebook (zelfde hub)

Voor de FB-kaart op dezelfde pagina: volg `aquire/docs/FACEBOOK_SETUP.md` (Page Access
Token), en plak Page ID + long-lived token in de **Facebook → Verbinden** modal.

---

### Wat jij mij moet geven (om af te ronden)
- LinkedIn **Client ID + Secret** + **Org-URN** + **access token** → ik vul ze in via
  de API (of jij plakt ze zelf in de modal).
- Of: zeg dat de **Community Management API** nog in review is → dan laat ik LinkedIn
  als planner/tracker draaien tot goedkeuring.
