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

## Forbedringer i versjon 2.2

- 3. trinns «Engelsklekse til neste engelsktime» skal skilles fra norsk. Også lekseoverskrifter med parenteser støttes.
- Svømmedager for **rød gruppe** gir alltid **badetøy og håndkle** i pakkelisten. Hårstrikk tas med dersom skolen nevner det.
- Penal og skiftetøy vises ikke lenger som avkryssingsoppgaver. Postmappe kan fortsatt vises hvis skolen krever den.
- PDF-elementer fra «Les mer her», svømmetabellen og SVG-/lenkeetiketter fjernes fra daglige aktiviteter. Hvis noe ikke kan leses, se originalplanen.
- Kompakt toppfelt og ekstra tydelig ukenummer.
- Cacheversjon oppdatert for at gamle feiltolkede data ikke skal bli hengende etter oppgraderingen.

## Værvisning – versjon 2.3

Værpanelet vises i det kompakte toppfeltet og følger automatisk dagen som velges (mandag–fredag), uavhengig av om du ser 3. eller 7. trinn. Hvert dagskort viser også en liten værindikasjon.

- **Sted:** Samme koordinater som Pent-lenken: `58.14671, 7.9956` (avrundet til 4 desimaler for METs API-krav).
- **Værkilde:** [Meteorologisk institutt / Yr Locationforecast](https://developer.yr.no/doc/locationforecast/HowTO/). Pent.no viser både Yr og Storm, men har ikke et bekreftet offentlig API for tilsvarende tilgang og beskytter nettstedet mot automatisk uthenting. Appen skraper derfor **ikke** Pent, og viser **ikke Storm-prognosen**. Lenken til Pent er tilgjengelig fra værpanelet.
- **Tidsrom:** Ca. 08–17 i lokal tid (`Europe/Oslo`). Temperaturen ved ca. kl. 12, anslått nedbør i skoletiden og høyeste vindstyrke i skoletiden vises. Nedbør fra seks-timers prognoseblokker merkes «ca.».
- **Oppdatering:** Nettlify-funksjonen `/api/weather` leser fra MET API, overholder «Expires» og mellomlagrer; appen henter ved åpning, ved manuell «Oppdater» og når vinduet igjen blir aktivt etter over 30 minutter. Ved feil vises tydelig varsel eller eldre prognose (maks fire timer lokalt).
- **Kreditering:** Værdata fra Meteorologisk institutt, bearbeidet for skoletid, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

### Verifisere etter publisering

1. Åpne `https://DIN-NETLIFY-ADRESSE/api/weather`. Den skal returnere JSON med `days` (datonøkler på formen `2026-10-26`).
2. Åpne hovedsiden. Velg mandag og deretter tirsdag: vær og dato i hero-elementet skal skifte.
3. Velg 3. og 7. trinn; været skal være det samme for den samme dagen.
4. Ved feil i vær-API skal appen fortsatt fungere med ukeplan og pakkeliste.

Den medfølgende HTML-forhåndsvisningen er kun en **designdemo med illustrasjonsvær**, ikke en sanntidsværmelding. Publiser **hele GitHub-prosjektet med Netlify Functions** for reell værhenting og løpende ukeplaner.


## Vær – presisering fra v2.3.1

- Værvarselet i **Netlify-utgaven** hentes fra MET Locationforecast via `/api/weather`, for Pent-koordinatene 58.1467, 7.9956. Appen bruker `Europe/Oslo` for å knytte riktig prognose til hver dag.
- Været er nå oppsummert for **kl. 08:00–15:00** (skole- og morgenperioden), ikke et helt døgn. Regn på kvelden tas ikke med.
- Den nedlastbare **HTML-forhåndsvisningen** inneholder nå **ingen oppdiktede værdata**. Den viser en merknad om at live-været kun fungerer i publisert Netlify-versjon.
- Som alltid kan varsel endre seg; Pent.no kan avvike fra Yr fordi de også viser Storm.


## Aktiviteter etter skolen – versjon 2.4

Vises kun for **7. klasse** og følger ukedagen som velges, uavhengig av om skolens PDF er tilgjengelig.
- **Mandag + torsdag:** Hip-hop dans. Fremhevet oppmøte for kjøring, basert på familiens egen kjøreplan.
- **Onsdag:** Tennis. Maya kjører i partallsuker, Julie kjører i oddetallsuker.
- **Tirsdag + fredag:** Ingen faste fritidsaktiviteter registrert; panelet skjules.
- Tydelige merker på dagskortene, egen stor aktivitetsseksjon ved valgt dag.

Kjøreplan for dans gjelder **2026**: Nora (37, 42, 46), Smilla (39, 44, 48), Julie (38, 43, 47), Maya (41, 45, 49). Ved **uke 40 og 50–53**, eller i senere år, vil appen vise «Kjøreplan ikke oppgitt» – den gjetter ikke hvem som skal kjøre. Aktivitetsdagene vises likevel. Ingen klokkeslett er oppgitt, derfor gjettes heller ikke disse.

Fritidsaktivitetene er **familiens egne opplysninger** og ikke hentet fra skolens PDF; de påvirker ikke pakkelisten for skolen. Endre mappingen i `public/after-school.mjs` ved fremtidige avtaler.

### Rettelse i versjon 2.4.1

Julie og Smilla har byttet danseuker. **Julie: uke 38, 43, 47. Smilla: uke 39, 44, 48.** Nora og Maya, samt tennisplanen, er uendret. I uke 44 går jentene hjem til **Smilla** for kjøring på mandag og torsdag.

## Automatisk oppdatering og utgåtte dager – versjon 2.4.2

- Nettsiden lastes automatisk på nytt **hver time** fra den åpnes. En ekstra klokkesjekk kjører hvert minutt og laster siden på nytt når datoen endres i tidssonen `Europe/Oslo`, slik at riktig dag velges etter midnatt.
- Hvis en nettleser pauser tidsintervallene i en bakgrunnsfane, sjekkes dato og tidsfrist straks fanen blir aktiv eller får fokus igjen. Avkrysningene i pakkelisten lagres fortsatt lokalt.
- Tidligere skoledager i samme uke vises nedtonet, merket «Utgått» og deaktivert med HTML `disabled`. Fremtidige dager og dagens dag er klikkbare.
- Lørdag og søndag er alle fem skoledager utgått. Appen viser fredagens informasjon som en historisk oppsummering uten aktivt dagkort, og gir beskjed om at neste uke vises fra mandag.
- Datoer, uker og utgått-status følger norsk tid (`Europe/Oslo`) selv om nettbrettet eller mobilen skulle ha en annen tidssone.

## Rettelse i versjon 2.4.3

Hip-hop for 7. klasse er **mandag og torsdag**, ikke tirsdag og torsdag. Oppmøte for kjøring vises begge dagene. Tirsdag har ingen fast aktivitet; onsdag er fortsatt tennis. Kjøreukene og all annen funksjonalitet er uendret.
