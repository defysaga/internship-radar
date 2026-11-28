# Stillinger fra NAV

Lages hver natt av `scripts/hent-nav.mjs` i hovedgrenen, fra NAVs åpne stillingsfeed
(https://navikt.github.io/pam-stilling-feed/). Inaktive og utløpte stillinger fjernes,
og kontaktpersoner tas aldri med. Selve annonsene ligger på arbeidsplassen.nav.no.
