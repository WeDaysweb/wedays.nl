# WeDays Website

Complete WeDays website met WeDays Studio.

## Upload
Upload de inhoud van deze map naar de hoofdmap van de GitHub repository.

De hoofdmap moet direct bevatten:
- functions
- public
- src
- astro.config.mjs
- package.json
- README.md

Upload niet het zip-bestand zelf en plaats deze map niet als extra map in GitHub.

## Cloudflare Pages
- Build command: npm run build
- Build output directory: dist
- Root directory: leeg laten
- Production branch: main

## Controle
Test na deployment:
- /
- /contact
- /contact/
- /keuzehulp
- /pakketten
- /diensten
- /website-scan
- /admin

## E-mailmeldingen voor leads
De contactformulieren en de knop **Ja, neem contact met mij op** sturen via de Cloudflare Pages Function `/api/lead` een e-mailmelding.

Stel in Cloudflare Pages bij **Settings → Variables and Secrets** in:

- `RESEND_API_KEY` als versleuteld secret (verplicht)
- `LEAD_TO_EMAIL` als ontvangstadres (optioneel, standaard `info@wedays.nl`)
- `LEAD_SCAN_TO_EMAIL` als apart ontvangstadres voor Website Scans (optioneel, standaard `leadscan@wedays.nl`)
- `LEAD_FROM_EMAIL` als afzender (optioneel, standaard `WeDays Website <meldingen@wedays.nl>`)

Verifieer `wedays.nl` als verzenddomein in Resend voordat je publiceert. Zonder `RESEND_API_KEY` toont het formulier bewust een foutmelding en nooit een valse succesmelding.
