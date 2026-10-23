# Internship-radar

En personlig app for iPhone som viser internships, sommerjobber og arrangementer som passer deg. Tirsdag, torsdag og lørdag legger en kort sjekk i Claude inn nye treff, og hver mandag kommer en større ukesjekk med oppsummering på e-post. Sjekkene henter stillinger fra NAV (arbeidsplassen.nav.no) og arbeidsgivernes egne sider, og lenker bare til FINN når en stilling ikke finnes andre steder. I appen markerer du hva som er interessant og hva du har søkt på, og du kan skrive notater.

Appen er en **PWA** (Progressive Web App): en nettside som installeres på hjemskjermen og oppfører seg som en vanlig app, med eget ikon, fullskjerm og støtte for å åpnes uten nett. Den er gratis å lage, publisere og bruke.

## To måter å bruke Radar på

- **Med stillinger fra NAV (for alle, gratis):** åpne appen, svar på noen få spørsmål (sted, type stilling, områder, erfaring), og få ledige stillinger som passer. Ingen konto, ingen Google-ark og ingen Claude-abonnement. Det du lagrer, ligger bare på telefonen. Se «Stillinger fra NAV» under.
- **Med eget Google-ark (superbruker):** Claude-sjekker legger inn treff med styrker og svakheter, og du får push-varsler, kalender og e-post. Resten av denne filen beskriver dette oppsettet.

## Stillinger fra NAV

```
 NAVs stillingsfeed  →  GitHub-jobben (hver natt)  →  grenen nav-data  →  appen
 (åpent API, gratis)    scripts/hent-nav.mjs          én fil per fylke     plukker ut det som passer deg
```

- Jobben `.github/workflows/nav-stillinger.yml` kjører hver natt kl. 04.20 (vintertid). Den leser NAVs åpne stillingsfeed (https://navikt.github.io/pam-stilling-feed/), fjerner stillinger som er blitt inaktive eller har gått ut, og beholder det som passer studenter og nyutdannede: internships, sommerjobber, trainee, deltid, vikariater og fulltid uten krav om mange års erfaring. FINN-annonser er ikke med i feeden, og kontaktpersoner tas aldri med.
- Resultatet legges i grenen `nav-data` (bare siste versjon, uten historikk): `nav/index.json` og én fil per fylke. Appen henter bare filene for stedene du har valgt, og lagrer dem på telefonen til neste natt.
- Jobben bruker NAVs offentlige test-nøkkel. Får du en egen nøkkel fra NAV (gratis, send en e-post til nav.team.arbeidsplassen@nav.no), legg den inn som hemmeligheten `NAV_TOKEN` i GitHub, så brukes den i stedet.
- Vil du hente alt på nytt (for eksempel etter at reglene for områder er endret), kjør jobben for hånd i «Actions» med «Start på nytt» huket av.
- Områdene bygger på NAVs egne yrkeskategorier og ord i tittelen. Listen står både i `scripts/hent-nav.mjs` og i `app.js` (`NAV_OMRADER`), og navnene må være like.
- Har du allerede eget Google-ark, påvirker ikke dette din app: med nøkkel og adresse til Apps Script på telefonen brukes arket som før.

## Slik henger det sammen (eget Google-ark)

```
 iPhone-appen  ⇄  Apps Script  ⇄  Google-arket  ←  ukentlig sjekk i Claude
 (GitHub Pages)   (hos Google)    (dataene)        (mandag morgen)
```

- **Appen** er HTML, CSS og JavaScript som ligger gratis på GitHub Pages.
- **Google-arket** er databasen. Én rad per mulighet.
- **Apps Script** er et lite program hos Google som lar appen lese fra og skrive til arket. Det er beskyttet med en nøkkel du velger selv.
- **Den ukentlige sjekken** skriver nye treff rett inn i arket.

## Filene

| Fil | Hva den gjør |
|---|---|
| `index.html` | Strukturen: overskrift, faner, filtre, listen og skjemaene. |
| `styles.css` | Utseendet: farger, skrift, kort og knapper. Lys og mørk modus følger telefonen. |
| `app.js` | Logikken: henter data, tegner kortene, lagrer status og notater. |
| `config.js` | Adressen til Apps Script-en din (tom: stillinger fra NAV eller eksempeldata). Her kan også `navData` peke til stillingsfilene. |
| `manifest.webmanifest` | Forteller telefonen at dette er en app: navn, ikon og fullskjerm. |
| `sw.js` | Service worker: lagrer appens filer på telefonen, så den åpner uten nett. |
| `icons/` | App-ikonene. `apple-touch-icon.png` er den iPhone bruker på hjemskjermen. |
| `data/demo.json` | Eksempeldata som vises før appen er koblet til arket. |
| `apps-script/Code.gs` | Koden du limer inn i Apps Script (steg 3). Brukes ikke av selve appen. |
| `scripts/hent-nav.mjs` | Henter stillinger fra NAV hver natt (se «Stillinger fra NAV»). |

## Oppsett

### 1. Publiser appen på GitHub Pages

1. Lag en gratis konto på [github.com](https://github.com) og et **offentlig** repo som heter `internship-radar`.
2. Legg filene i repoet. Claude kan gjøre dette for deg hvis du deler brukernavnet ditt.
3. Gå til **Settings → Pages**. Under «Build and deployment» velger du **Deploy from a branch**, branch `main` og mappe `/ (root)`, og trykker **Save**.
4. Etter et minutt eller to ligger appen på `https://BRUKERNAVN.github.io/internship-radar/`.

Allerede nå kan du åpne den og prøve den med demo-data.

### 2. Lag Google-arket

1. Gå til [sheets.new](https://sheets.new) og kall arket «Internship-radar data».
2. Del lenken med Claude, så fyller Claude inn mulighetene vi allerede har funnet.

Arket kan være privat. Appen leser det gjennom Apps Script, ikke direkte.

### 3. Sett opp Apps Script

1. I arket: **Utvidelser → Apps Script**.
2. Slett det som står der, og lim inn alt fra `apps-script/Code.gs`. Trykk lagre-ikonet.
3. Velg en nøkkel, gjerne et langt, tilfeldig ord som ikke brukes noe annet sted. Gå til **Prosjektinnstillinger** (tannhjulet) → **Skriptegenskaper** → **Legg til skriptegenskap**. Egenskap: `NOKKEL`, verdi: nøkkelen din. Lagre.
4. Tilbake i **Redigering**: velg funksjonen `oppsett` i menyen øverst og trykk **Kjør**. Google ber om tillatelse første gang. Godkjenn med kontoen din. Hvis du får «Google har ikke bekreftet denne appen», trykker du **Avansert → Gå til … (usikker)**. Det er din egen kode, så det er trygt.
5. **Implementer → Ny implementering**. Trykk tannhjulet ved «Velg type» og velg **Nettapp**.
   - Kjør som: **Meg**
   - Hvem har tilgang: **Alle**
6. Trykk **Implementer** og kopier adressen som slutter på `/exec`.

«Alle» betyr at hvem som helst med adressen kan *prøve* å bruke den, men uten riktig nøkkel får de ingenting ut.

### 4. Koble appen til arket

Adressen og nøkkelen skrives inn i appen, ikke i koden. Repoet er offentlig, så `config.js` inneholder ingenting personlig: ikke navn, ikke adressen til arket og ikke nøkkelen. Uten adresse og nøkkel viser appen oppdiktede demodata.

### 5. Installer på iPhone

1. Åpne `https://BRUKERNAVN.github.io/internship-radar/` i **Safari**.
2. Trykk på del-knappen (firkanten med pil opp) → **Legg til på Hjem-skjerm** → **Legg til**.
3. Åpne Radar fra hjemskjermen, gå til **Innstillinger** i menyen og skriv inn adressen (slutter på `/exec`) og nøkkelen. De lagres bare på telefonen. Navnet, utdanningen og erfaringen din leses fra profilen i arket (fanen «meta», raden «profil»). Ferdig!

## Funksjoner

- **Forsiden (Hjem):** øverst skifter «Anbefalt for deg» mellom de mulighetene og stillingene som passer deg best. Rett under ser du neste frist, og så listen over åpne muligheter med en liten områdevelger.
- **Bunnmenyen:** Hjem · I dag · Claude-knappen i midten · Søknader · Favoritter. Hold og dra over menyen for å bytte fane. Den krymper til en hjem-knapp når du scroller nedover.
- **I dag:** det som haster samlet på ett sted: frister denne uken, intervju og case, søknader du bør følge opp, oppfølginger i nettverket og det som er nytt siden i går. Tallet på fanen viser det som haster mest.
- **Spør Claude (knappen i midten):** still et spørsmål der Claude får vite litt om deg, favorittene og søknadene dine, eller velg en snarvei: lag søknadsutkast, øv på intervju, følg opp en søknad, skriv til en kontakt, sjekk CV-en mot en stilling eller finn lignende stillinger. Her legger du også til en ny mulighet eller kontakt.
- **Følg opp søknader:** Radar husker når du søkte. Etter ti dager uten svar dukker søknaden opp i I dag, med en ferdig skrevet oppfølgingsmail du kan kopiere, åpne i Mail eller forbedre med Claude.
- **Meldinger til kontakter:** maler for koble til (under 300 tegn for LinkedIn), kaffeprat, takk for praten og oppfølging. Trykk på en person inne på en mulighet, eller velg «Skriv til en kontakt» hos Claude.
- **Sjekk CV mot en stilling:** lim inn CV-en én gang (lagres bare på telefonen, også under innstillinger), så lager Radar en ferdig forespørsel til Claude med matchvurdering og hva du bør fremheve.
- **Hamburgermenyen** (oppe til høyre) har alle områdene: Hjem, I dag, Favoritter, Søknader, Nettverk, Marked og Arkiv, og i tillegg Spør Claude, Legg til mulighet, Radarjakt, Oppdater og Innstillinger.
- **Hva vil du se?** (i hamburgermenyen og under innstillinger): velg *Mer*, *Vanlig*, *Mindre* eller *Skjul* for hver type stilling og hvert område, og hvor mye erfaring en stilling kan kreve. To raske valg: «Som student» og «Klar for fulltid». Valgene styrer Hjem, «Anbefalt for deg», I dag og Marked. De lagres i raden `radar-innstillinger` i arket, og de daglige og ukentlige Claude-sjekkene følger dem når de finner nye stillinger. Favoritter og søknader vises alltid.
- **Søk nå:** inne på en åpen mulighet åpner «Søk nå» en søknadspakke: søknadsteksten, svar på «Hvorfor søker du hos oss?», «Hvorfor denne rollen?» og «Hva gjør deg til en god kandidat?», og faste svar som går igjen (om deg, utdanning, erfaring, verktøy, oppstart, referanser, LinkedIn). Alt har en kopier-knapp og lagres på telefonen. «Åpne søknaden» åpner skjemaet, og når du kommer tilbake til Radar, spør appen om søknaden ble sendt. Ett trykk markerer den som søkt. Søknader du har åpnet, men ikke markert, vises også i I dag. Søker du heller på PC-en, sender «Send til innboksen min» en e-post fra «Radar» til deg selv med lenken, fristen og alle tekstene (krever Apps Script versjon 3, se under). Med en eldre Apps Script åpnes i stedet en ferdig e-post i e-postappen din, og du trykker Send selv.
- **Hva har skjedd?** Inne på en søknad velger du tydelig mellom Søkt, Intervju, Case, Tilbud og Avslag, med en kort forklaring og datoen for hvert steg.
- **Liste eller ruter:** knappen ved områdevelgeren bytter mellom liste og ruter (to bokser i bredden) i Hjem, Favoritter, Søknader, Marked og Arkiv. I ruter legger du til favoritter med stjernen i hjørnet. Valget huskes. Rutene har stemningsbilder av kontorer, møterom, arbeidsplasser og Oslo (lisensfrie bilder fra [Unsplash](https://unsplash.com/license)), valgt ut fra området og alltid det samme for hver bedrift. Det er ikke bilder av bedriftens egne lokaler. Bildene kan skrus av under Innstillinger → Utseende.
- **Åpne / Favoritter:** mulighetene sortert etter frist, i en enkel liste. Sveip et kort til høyre for *Favoritt*, til venstre for *Ikke aktuell*.
- **Detaljer:** trykk på et kort for å åpne et stort ark med status, frist, lenke til annonsen, nettverk og notat, og:
  - **Styrker og svakheter:** hva som taler for deg i akkurat denne stillingen, hva du bør være forberedt på, og et tips. Den ukentlige sjekken skriver dette for hvert nytt treff (og for stillinger du har lagret selv).
  - **Lag søknadsutkast:** et utkast bygget på profilen din og styrkene for stillingen, som du kan redigere, kopiere eller sende til Claude med «Forbedre med Claude».
  - **Lignende forslag:** lignende muligheter i Radar, lignende stillinger i markedet akkurat nå, og ferdige søk hos NAV (med FINN som et ekstra valg).
- **Søkt (søknadsløpet):** følg hver søknad gjennom Søkt → Intervju → Case → Tilbud eller Avslag. Øverst ser du hvor mange du har søkt på totalt og de siste 30 dagene, hvor stor andel som har gått videre til intervju, og hvor mange som er på hvert steg. Trykk på et steg for å filtrere.
- **Marked:** en oversikt over relevante heltids- og deltidsstillinger og internships fra NAV og arbeidsgivernes egne sider: hvor mange det er, hvor mange som er nye, fordelingen på områdene dine, og hvor mange ledige stillinger det er totalt for noen faste søk. Trykk på en stilling for å se den eller lagre den i Radar. Fylles på av den ukentlige sjekken, og viser utviklingen uke for uke.
- **Radarjakt:** et lite spill der du fanger muligheter på radaren. Trykk på «Radar.» øverst, eller åpne det fra innstillinger.
- **Mørkt tema** hele tiden: «Midnatt» (nesten svart) som standard, eller «Navy» under innstillinger. Der kan du også skru av at «Anbefalt for deg» blar av seg selv.
- **Forbered intervju:** inne på hver mulighet finner du en presentasjon av deg selv, spørsmål du kan få (også om svakhetene dine), STAR-metoden, case-tips, spørsmål du kan stille, en sjekkliste og «Øv på intervjuet med Claude».
- **Nettverk:** logg kaffeprater og andre kontakter per bedrift, med notat og dato for oppfølging. Kontaktene vises også inne på kortet til bedriften.
- **Arkiv:** det du har merket *Ikke aktuell*, og muligheter der fristen har gått ut. Lenken ligger nederst i Åpne.
- **Bjellen og tallet på app-ikonet:** alle varsler du har fått (nye treff, frister, oppfølginger og påminnelser) samles under bjellen øverst. Tallet på app-ikonet er antall varsler du ikke har sett, og forsvinner når du åpner bjellen. Da fjernes også varslene fra låseskjermen. Trykk på et varsel for å gå rett til stillingen.
- **«Husket du å søke?»:** har du åpnet en søknad i appen («Søk nå», «Åpne søknaden» eller «Send til innboksen min») uten å markere den som søkt, får du én påminnelse neste morgen (tidligst 18 timer etter). Bare én gang per stilling. Krever Apps Script versjon 5.
- **Starter på Hjem:** når appen har vært helt lukket, åpner den alltid på Hjem.
- **Kalender:** frister og oppfølginger rett i iPhone-kalenderen. Trykk *Abonner i Kalender* under innstillinger.

Arket har tre faner: `muligheter`, `kontakter` og `meta`. I `meta` ligger siste sjekk, målet ditt, `profil` (brukes i søknadsutkastene), `marked` (stillingene fra NAV og arbeidsgiverne) og `markedHistorikk` (tallene uke for uke). Markedsdataene skrives av den ukentlige sjekken som tekst i arket, så de virker også med den eldre Apps Script-en.

Kolonnen `hvorfor` har dette formatet, som appen viser som styrker og svakheter:

```
Én–to setninger om hvorfor den passer.
Styrker: punkt 1; punkt 2; punkt 3
Svakheter: punkt 1; punkt 2
Tips: én setning
```

Kjører arket en eldre versjon av Apps Script (uten nettverk og mål), lagrer appen nettverk, mål, intervju-steg og typen på stillinger du lagrer fra markedet (som Fulltid) på telefonen i mellomtiden. Når du limer inn den nyeste `Code.gs` og publiserer en ny versjon, flytter appen alt automatisk over til arket neste gang den åpnes.

## Personvern

- Koden og demodataene er offentlige, men inneholder ingenting om deg. Demoen bruker oppdiktede bedrifter.
- Alt personlig ligger i Google-arket ditt (mulighetene, notater, profil) eller bare på telefonen (nøkkelen, adressen til arket, CV-tekst, utkast, svar i søknadspakken og e-postadressen din).
- Med stillinger fra NAV lagres alt (valg, favoritter, søknader, notater, profil og CV) bare på telefonen. Ingenting sendes til arket ditt eller til noen andre. Stillingsfilene i grenen `nav-data` er offentlige annonser fra NAV, uten kontaktpersoner.
- Adressen til Apps Script bør ligge som hemmeligheten `RADAR_SCRIPT_URL` i GitHub (Settings → Secrets and variables → Actions), slik at varslingsjobben ikke trenger den i koden.

## Push-varsler

Radar kan sende varsler til iPhonen, med eget ikon, akkurat som en vanlig app:

- **Nye treff:** «2 nye muligheter: Bekk og Knowit» når den ukentlige sjekken har lagt inn noe nytt.
- **Frister:** 3 dager før, dagen før og samme dag for det du har merket som **Interessant**.
- **Oppfølging:** samme dag som du har satt en oppfølging i nettverksloggen.

Slik henger det sammen:

```
 GitHub Actions (hver morgen)  →  Apple  →  iPhone
        ↑ henter muligheter og abonnementer
   Apps Script / Google-arket
```

| Fil | Hva den gjør |
|---|---|
| `.github/workflows/varsler.yml` | Starter jobben hver morgen kl. 07.15 UTC, og når du trykker «Run workflow». |
| `scripts/send-varsler.mjs` | Finner ut hva det skal varsles om, og sender det. |
| `scripts/webpush.mjs` | Krypterer og signerer varslene (Web Push-standarden), uten eksterne pakker. |

**Oppsett:**

1. Legg inn to hemmeligheter under **Settings → Secrets and variables → Actions → New repository secret**:
   - `RADAR_NOKKEL`: samme nøkkel som i Apps Script
   - `VAPID_PRIVATE_KEY`: den private varsel-nøkkelen (den offentlige står i `config.js`)
2. Lim inn den nye versjonen av `apps-script/Code.gs` i Apps Script og publiser en ny versjon (se under).
3. Åpne Radar fra hjemskjermen, trykk innstillinger-knappen og **Slå på varsler**.
4. Test: **Actions → Varsler → Run workflow** med «Send bare et testvarsel» huket av.

Varsler på iPhone krever iOS 16.4 eller nyere, og at appen er åpnet fra hjemskjermen. GitHub slår av planlagte jobber i repoer som ikke har hatt endringer på 60 dager. Da får du en e-post, og du slår den på igjen med **Enable workflow** under Actions.

## Oppdatere Apps Script (uten å endre adressen)

1. Åpne arket → **Utvidelser → Apps Script**.
2. Marker all koden i `Code.gs` (⌘A / Ctrl+A), slett den, og lim inn den nye koden fra `apps-script/Code.gs`. Lagre (⌘S).
3. Velg funksjonen **testEpost** i menyen øverst og trykk **Kjør**. Google ber om lov til å sende e-post. Godkjenn (ved «Google har ikke bekreftet denne appen»: **Avansert → Gå til … (usikker)**). Du får en e-post fra «Radar».
4. **Implementer → Administrer implementeringer** → blyanten på den implementeringen du har → **Versjon: Ny versjon** → **Implementer**. Velg *ikke* «Ny implementering», for da får du en ny adresse.
5. Åpne Radar og oppdater. Kontakter, mål og intervju-steg som lå på telefonen, flyttes automatisk til arket.

## Sende e-post fra en egen Radar-konto (valgfritt)

E-postene sendes fra kontoen som lager implementeringen. Vil du at de skal komme fra en egen Gmail-konto (for eksempel radar.internship@gmail.com) i stedet for din egen:

1. Del arket med Radar-kontoen som **redigerer**.
2. I Apps Script: **Prosjektinnstillinger → Skriptegenskaper** → legg til `MOTTAKER` med din vanlige e-postadresse. Da går e-postene dit.
3. Logg inn *bare* med Radar-kontoen (gjerne i et privat vindu), åpne arket → **Utvidelser → Apps Script**, kjør **testEpost** og godkjenn.
4. **Implementer → Ny implementering** → Nettapp, Kjør som: Meg (Radar-kontoen), Tilgang: Alle. Kopier den nye adressen.
5. Lim inn den nye adressen i appen (Innstillinger) og i GitHub-hemmeligheten `RADAR_SCRIPT_URL`.

## Når du endrer koden

- Endre filene og last dem opp til GitHub. Pages oppdateres etter et minutt.
- Øk tallet i `VERSJON` øverst i `sw.js` (for eksempel `radar-v2`). Da vet telefonen at den skal hente de nye filene. Åpne appen to ganger, så har du den nye versjonen.
- Endrer du `Code.gs`, må du lage en ny versjon i Apps Script: **Implementer → Administrer implementeringer → blyanten → Versjon: Ny versjon → Implementer**. Adressen blir den samme.

## Prøve appen på datamaskinen

Fra mappen med filene:

```
python3 -m http.server 8000
```

Åpne så `http://localhost:8000`. I Chrome kan du trykke F12 og velge iPhone-visning for å se hvordan den ser ut på telefonen.

## Ideer til neste versjon

- Flere uker med markedsdata gir en trendgraf i Marked-fanen (den dukker opp automatisk fra uke 2).
- Automatisk påminnelse om å følge opp en søknad en uke etter at du har søkt.
