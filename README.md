# Skolesekken 3.0.7 – Morgenklar 🎒

Komplett Netlify-app for **3. klasse (rød gruppe)** og **7. klasse** ved Fagerholt skole.

Dette er **produksjonsprosjektet**, ikke den tidligere statiske designprototypen. Frontend er bygget om til 3.0-designet, mens eksisterende Netlify Functions for ukeplan og vær er videreført. Ingen uke 44-eksempeldata vises som gjeldende ukeplan.

## Endret i 3.0.7

- **Ukas tema flyttet:** På 3. og 7. klasses egne sider vises uketema/oppdrag nå **rett under ukens lekser og rett over Beskjeder fra skolen**. Det vises fortsatt ikke i familieoversikten.
- Tema, oppdrag, lagring, kompakt fullført-visning og øvrig funksjonalitet er uendret.

## Nytt i 3.0.6

- **Læringsmål fra PDF:** Leser en eksplisitt merket læringsmålseksjon fra hver klasses egen ukeplan, med støtte for punktlister, fag og linjer som går over flere rader.
- **Valgfri, lavprioritert visning:** «Læringsmål» ligger under «Beskjeder fra skolen» på klassesidene og skjules helt når ingen mål kan identifiseres.
- Læringsmål er ikke lekser eller avkrysninger. Innholdet kommer fra PDF-en uten å finne på mål. «Begge»-visningen er uendret.

## Nytt i 3.0.5

- **Ukas tema vises kun på barnets egen klasseside**, mellom hero og dagvelger. Familieoversikten viser ikke uketema.
- **Mer presist tema per klassetrinn:** Et tydelig `Ukas tema` eller `Fokus` i klassens egen PDF prioriteres. Et generelt `Periode` behandles ikke som 7. klasses uketema. Hvis det ikke finnes et sikkert tema, utelates kortet. Tidligere plan-cache oppgraderes slik at mulig feilaktige tema ikke blir værende.
- **Kompakt fullført oppdrag:** Etter «Jeg har gjort det!» krymper temakortet og kan åpnes igjen; man kan fortsatt angre.
- **Regntøypåminnelse:** Et tydelig banner vises når den valgte skoledagens prognose fra Yr (ca. kl. 08–15) varsler regn/sludd. Ingen påminnelse ved tørre/manglende værdata.

Det faktiske temaet for 7. klasse må fortsatt verifiseres mot skolens publiserte PDF; appen skal ikke dikte opp eller kopiere et tema fra 3. klasse.

## Rettet i 3.0.4

- **Avkrysningsboksene i pakkelisten og leksene fungerer igjen:** Klassevelgeren lytter nå bare på klasseknappene, ikke på hele siden. Tidligere stoppet klikket avkrysningen før lagring.
- Kontrollert i Chromium med ekte klikk på avkrysningsboksen og hele raden, inkludert lagring, og med automatiserte regresjonstester.

## Hva er nytt i 3.0.3?

- **Lekseavkrysning:** Hver lekse kan merkes som ferdig ved å trykke på teksten eller avkrysningsboksen.
- **Progresjon:** Teller antall ferdige lekser, viser status på fagfanene og feirer når alle er gjort.
- **Husker utførte lekser:** Lagres i nettleseren per barn og ISO-uke, også ved fanebytte og omlasting.
- **Ingen endringer i innhenting:** Bruker samme skole-PDF, vær-API og klassefiltrering som før.

## Hva var nytt i 3.0.2?

- **Temaet fra skolens PDF er hovedoverskriften**: «Solidaritet» fremheves; «Jeg bryr meg» vises som undertittel når det følger med.
- **Oppdraget er alltid synlig** i et tydelig kort med knappen «Jeg har gjort det!», hyggelig bekreftelse og mulighet for å angre.
- **Familieoversikten** viser oppdragene for begge barna, med direkte inngang til å gjennomføre dem.
- De frivillige oppdragene kommer fra Skolesekken, mens temaet kommer fra skolens ukeplan. Avkrysninger beholdes per barn og uke.

## Tidligere funksjoner

- **Begge barna** som startside: to kort med dagens program, hva som skal pakkes og eventuelt kjøreansvar.
- **3. klasse:** barnets pakkeliste først på mobil, eget dagsprogram og fortsatt filtrering til rød gruppe.
- **7. klasse:** skoleaktiviteter og fritidsaktiviteter integrert i samme dagskort. Hip-hop **mandag og torsdag**; tennis **onsdag**.
- **Kjøreplan for 2026:** Nora uke 37, 42, 46; Julie 38, 43, 47; Smilla 39, 44, 48; Maya 41, 45, 49. Tennis: Maya partallsuker og Julie oddetallsuker. Ingen gjetting for manglende kjøreuker.
- **Vær** for valgt skoledag, fra MET/Yr for koordinatene i Pent-lenken. Ingen fiktive prognoser.
- **Lekser i fagfaner** (norsk og engelsk er skilt), **Ukas tema**, minioppdrag og beskjeder i sammenleggbart felt.
- **Oppdatering:** nettsiden laster seg på nytt hver 60. minutt, ved datoovergang og når fanen vekkes etter lang dvale. Tidligere dager i uken er deaktivert.
- **Avkrysninger:** eksisterende `skolesekken.pack.v6...`-nøkler gjenbrukes, slik at pakkestatus fra 2.5 bevares på samme enhet.

## Publiser på GitHub og Netlify

1. **Pakk ut ZIP-filen** først. Ikke legg selve ZIP-filen i GitHub som en fil.
2. Åpne https://github.com/morronetlab/skolesekken og legg inn filene i **roten av repositoryet**, med denne mappestrukturen:

   ```text
   .gitignore
   netlify.toml
   package.json
   README.md
   public/
     network.mjs
     index.html
     style.css
     app.js
     calendar.mjs
     after-school.mjs
     theme.mjs
   netlify/functions/
     plan.mjs
     weather.mjs
   lib/
     plan-core.mjs
     weather-core.mjs
     after-school.mjs
   tests/
     ...
   ```

3. GitHub-grensesnittet egner seg ikke alltid til å erstatte eksisterende undermapper. Tryggest er å pakke ut ZIP-en i en lokal kopi av repositoryet og gjøre `git add -A`, `git commit` og `git push`. Alternativt bruk Codex med tilgang til repositoryet.
4. Kontroller at Netlify-prosjektet bruker repositoryet som kilde, og at det ikke finnes egne UI-innstillinger som overstyrer `netlify.toml`.
5. Når Netlify viser **Published**, åpne https://fagerholt.netlify.app/ og sjekk både familievisning, 3. klasse og 7. klasse.

Netlify-konfigurasjonen i prosjektet:

- **Build command:** `npm test`
- **Publish directory:** `public`
- **Functions directory:** `netlify/functions`
- **API-endepunkter:** `/api/plan?grade=3`, `/api/plan?grade=7`, `/api/weather`
- **Node:** 20+

**Viktig:** Dra-og-slipp av kun `public/` i Netlify Drop publiserer bare HTML/CSS/JS. Da fungerer **ikke** automatisk PDF- eller værinnhenting, fordi Netlify Functions mangler. Prosjektet må bygges fra repositoryet.

## Test lokalt

```bash
npm install
npm test
npx netlify dev
```

Den siste kommandoen krever Netlify CLI (installeres ved `npx` ved behov). Bruk den for å teste hele appen. Åpning av `public/index.html` alene gir ikke tilgang til `/api/plan` eller `/api/weather`.

## Slik fungerer innhentingen

- `netlify/functions/plan.mjs` henter hver trinnside og velger PDF med riktig ISO-ukenummer.
- `lib/plan-core.mjs` tolker tekst og tabeller i PDF-en og håndhever rød gruppe. Tolkningen kan bli ufullstendig ved endret PDF-layout.
- `netlify/functions/weather.mjs` bruker Meteorologisk institutt (ikke skraping av Pent.no), med data begrenset til skoleperioden ca. kl. 08–15.
- Frontenden spør begge plan-API-ene parallelt og viser en advarsel ved delvis lesing, ikke-publisert plan eller feil. Kun en tidligere bekreftet plan fra **samme uke** kan brukes ved midlertidig feil, tydelig merket som lagret kopi.
- Brukerspesifikk pakkestatus og minioppdrag lagres kun i nettleseren (`localStorage`).

## Kilder og begrensninger

- 3. trinn: https://www.minskole.no/fagerholt/seksjon/22636
- 7. trinn: https://www.minskole.no/fagerholt/seksjon/22640
- Vær: [Meteorologisk institutt / Yr](https://developer.yr.no/doc/locationforecast/HowTO/), samme koordinater som https://pent.no/58.14671,7.9956

Skole-PDF-er kan være vanskelige å tolke. Les alltid originalen ved tvil. Ekte PDF-innhenting og Netlify-deploy må sluttkontrolleres i produksjon etter publisering. Ingen Spond- eller Flyt Foresatt-integrasjon er med i denne versjonen.
