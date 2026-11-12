# Synk-serveren til Radar

En liten Cloudflare Worker som tar vare på en **kryptert** kopi av det du har lagret i Radar, så du kan se det samme på telefonen og PC-en uten konto.

## Slik virker det

1. Når du slår på synk i appen (Innstillinger → Synk mellom telefon og PC), lager appen en tilfeldig synkkode på 20 tegn (rundt 100 biter).
2. Av koden lager appen (PBKDF2, 150 000 runder) en krypteringsnøkkel, en id og en skrivenøkkel.
3. Alt krypteres på enheten med AES-GCM før det sendes hit. Serveren får bare id-en, et fingeravtrykk av skrivenøkkelen og den krypterte teksten.
4. På den andre enheten skriver du inn samme kode, og appen henter og låser opp kopien der.

Serveren kan ikke lese noe, og det finnes ingen navn, e-post eller konto. Mister du koden, kan ingen hente dataene tilbake. Det som ligger på enhetene, er der fortsatt.

Nøkkelen og adressen til Google-arket synkes aldri.

## Filer

| Fil | Hva |
| --- | --- |
| `wrangler.toml` | Navnet på Workeren (`radar-synk`), databasen (D1 `radar-synk`) og nattlig opprydding. |
| `src/worker.js` | API-et: hent, lagre og slett en kryptert kopi. |
| `test/lokal-server.mjs` | Kjører serveren lokalt med SQLite i minnet (`node test/lokal-server.mjs`). |
| `test/api-test.mjs` | Tester API-et mot den lokale serveren. |

## Grenser

- Opptil rundt 450 kB kryptert data per kopi, og maks 5 000 kopier totalt.
- Kopier som ikke er brukt på 400 dager, slettes automatisk om natten.
- Bare appen på `defysaga.github.io` (og `localhost` for testing) får lov til å bruke API-et fra en nettleser.

## Legg den ut hos Cloudflare (én gang)

Databasen `radar-synk` (D1) er allerede laget, og id-en står i `wrangler.toml`.

1. Cloudflare → **Workers & Pages → Create → Import a repository** → `defysaga/internship-radar`.
2. **Project name:** `radar-synk` (samme som i `wrangler.toml`).
3. Under **Advanced settings → Path / Root directory:** `synk`.
4. **Deploy.** La byggekommandoen stå tom og deploy-kommandoen være `npx wrangler deploy`.
5. (Valgfritt) Under **Settings → Build → Build watch paths:** `synk/*`, så den bare bygges på nytt når serveren endres.

Adressen blir `https://radar-synk.mads-lunde-sorensen.workers.dev`, som står i `config.js`.
Sjekk at den virker: åpne `https://radar-synk.mads-lunde-sorensen.workers.dev/v1/status`. Den skal svare `{"ok":true}`.
