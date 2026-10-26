# Skolesekken – automatisk ukeplan for Fagerholt skole

Dette er en mobilvennlig webapp for **3. klasse (rød gruppe) og 7. klasse** på Fagerholt skole.

## Hva appen gjør

- Regner ut *dagens dato og ISO-ukenummer i tidssonen Europe/Oslo*.
- Henter offisielle trinnsider for 3. og 7. klasse på `minskole.no`.
- Søker etter PDF-lenke merket med **samme ukenummer** som vi er i.
- Leser ukeplanens dagkolonner, tidspunkt, utstyrspåminnelser, lekser og beskjeder fra PDF-en. Brukeren kan bytte klasse og dag.
- **3. klasse er låst til rød gruppe:** Programmet forsøker å finne rød gruppes tider i svømmetabellen, fjerner aktiviteter for andre grupper og beholder felles beskjeder, lekser og pakkelister. Hvis gruppetiden ikke kan bekreftes, gis det en advarsel i stedet for å vise andre gruppers tider.
- Lagrer avkrysninger for sekken lokalt i nettleseren per klasse, uke og dag.
- Oppdaterer seg ved besøk (Netlify-funksjonen har ca. 15 minutters mellomlagring), med **Oppdater** for ferskt oppslag.
- Hvis skolen ikke har publisert aktuell plan, vises **ikke** forrige ukes plan som gjeldende.
- Hvis skolens nettsted er midlertidig utilgjengelig, kan en tidligere hentet plan fra **samme uke** vises tydelig merket som lagret kopi.
- Ingen passord, innlogging, analyse/sporing eller håndtering av barns personopplysninger.

**Begrensning:** PDF-er har svært ulik layout. Automatisk tekstuttrekk kan feiltolke tabeller eller overse beskjeder (særlig i skannede dokumenter). Original-PDF er alltid lenket, og appen sier fra hvis uttrekket er usikkert.

## Publisere på din eksisterende Netlify-adresse (anbefalt)

> Den tidligere løsningen din ble dratt rett inn i Netlify som statiske filer. Denne versjonen bruker en **Netlify Function** for å hente og lese PDF-ene. Du må bygge/publisere hele prosjektet, ikke bare `public`-mappen eller `index.html`.

1. Pakk ut ZIP-filen.
2. Opprett et nytt GitHub-repository på <https://github.com/new> (gjerne privat). Last opp **innholdet** i denne mappen til repoets rot. Behold filstrukturen, spesielt `netlify.toml`, `package.json`, `public/`, `lib/` og `netlify/functions/`.
3. Åpne den **eksisterende** Netlify-siden din: <https://app.netlify.com/> → velg `lucent-marigold-876014`.
4. Gå til **Project configuration → Developer settings → Continuous deployment → Repository → Link repository**. Velg det nye GitHub-repositoryet.
5. Kontroller innstillingene: Build command = `npm test`, Publish directory = `public`, Functions directory = `netlify/functions` (dette ligger allerede i `netlify.toml`).
6. Start første deploy og se at den ender med **Published**.
7. Åpne <https://lucent-marigold-876014.netlify.app/> og test begge klassene. I Netlify finner du funksjonslogger under **Logs → Functions**, eller fra prosjektets Functions-side.

> Hvis du drar bare `public`-mappen inn i Netlify Drop, får du designet – men API-endepunktet `/api/plan` vil mangle, og automatisk oppdatering vil **ikke** fungere.

### Slik bekrefter du at automatikken virker

- Åpne `https://lucent-marigold-876014.netlify.app/api/plan?grade=3`
- Du skal få et JSON-svar med `week`, `year`, `status` og PDF-lenke når skolen har publisert planen.
- Test tilsvarende med `grade=7`.
- Hvis `status = "unpublished"`, har skolen ingen PDF med dette ukenummeret på trinnsiden; appen viser en forklaring.
- Hvis `status = "error"`, åpne funksjonsloggene for detaljer.

## Prosjektstruktur

```
public/
  index.html        # Design og grensesnitt
  app.js            # Kalender, klassevelger, API og huskelister
lib/
  plan-core.mjs     # PDF-layouttolkning og tekstparsing
netlify/functions/
  plan.mjs          # Serverløs API: henter skolens PDF og leser innholdet
netlify.toml        # Netlify-konfigurasjon /api/plan → funksjon
package.json        # Node-avhengighet for PDF-lesing
README.md
```

## Utvikle lokalt

Kjør `npm install` og `npm test`. For komplett app med serverfunksjoner: installer Netlify CLI og kjør `npx netlify dev`. Statisk HTML alene kan åpnes, men vil ikke kunne kontakte serverfunksjonen uten Netlify-miljøet.

Prosjektet bruker skoleplaner som er offentlig tilgjengelige på nettsidene til Fagerholt skole, og viser kildehenvisninger tilbake til dem.

## Tilpasning for rød gruppe – uke 44

I skolens offentlig publiserte PDF er rød gruppe satt opp med **svømming mandag 12:00–13:30**, og **svømming tirsdag 08:30–10:00** med buss **08:05**. Mandagens tidlige buss gjelder andre grupper og skal ikke vises som oppmøtetid for rød. DKS mandag og Halloween fredag gjelder hele klassen og beholdes.

Disse tallene finnes i `public/seed.json` som oppstartseksempel **kun i uke 44 / 2026**; kommende uker leses fra PDF ved hvert API-kall. Ved ulikt eller ukjent layout markeres usikkerheten, og original ukeplan bør leses. Det er ikke lagt inn varig antagelse om svømmetid for fremtidige uker.
