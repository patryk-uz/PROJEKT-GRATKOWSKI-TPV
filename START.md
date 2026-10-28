# Kasyno Pro — instalacja

To wersja do gry na wirtualne zetony. Nie obsluguje prawdziwych pieniedzy.
Gotowe: ruletka, wlasne saldo, historia 20 rund, logowanie i rejestracja.
Slots pozostaje zapowiedzia, bo w zrodlowym projekcie nie bylo mechaniki tej gry.

## 1. Baza (najpierw)

Supabase → SQL Editor → New query. Otworz lokalnie `supabase/001_game.sql`,
skopiuj CALA zawartosc i kliknij Run. Uruchom tylko raz. Skrypt nie kasuje
istniejacych tabel. Jesli nazwa jest juz zajeta, przerywa transakcje — nie usuwaj
tabel na slepo; przeslij blad do sprawdzenia.

Nie dodawaj schema `casino_private` do Exposed schemas w ustawieniach API.
Public schema musi pozostac dostepny przez Data API. Reguly RLS i GRANT
ograniczaja dostep do nowych tabel. Nie wylaczaj RLS.

## 2. Konta

Authentication → wlacz logowanie Email i potwierdzanie adresu (Confirm email).
Wymagaj hasla min. 12 znakow po stronie Supabase (sam formularz nie wystarcza).
Authentication → URL Configuration:
- Site URL: aktualny adres strony, np. https://kasyno-pro.32psi.workers.dev
- Redirect URLs: https://kasyno-pro.32psi.workers.dev/

Wbudowany serwer poczty Supabase jest testowy i ogranicza odbiorcow/wysylke.
Do rejestracji innych osob skonfiguruj wlasny SMTP w Authentication.
W projekcie uczelnianym najbezpieczniej utworzyc/zaprosic konta dla uczestnikow
w Authentication → Users, a potem wylaczyc publiczna rejestracje.
Nowe konto otrzymuje 1000 zetonow tylko raz. Tworzenie wielu nowych kont
da wiele bonusow — limit na konto nie jest limitem na czlowieka.
Nie ma automatycznego uzupelniania po przegranej.

## 3. GitHub i Cloudflare

Zrob kopie obecnego public/index.html.
Wgraj cala zawartosc folderu `public` z paczki DO folderu public repozytorium.
Maja powstac m.in. `public/index.html`, `public/app.js`, `public/_headers`
i `public/vendor/react.js` (nie public/public/index.html!).
Nie wgrywaj samego index.html — potrzebne sa tez pozostale pliki.

Cloudflare → projekt → Settings → Builds:
- Build command: puste
- Deploy command: npx wrangler deploy --name kasyno-pro --assets ./public
- Root directory: /

Pole --name musi odpowiadac faktycznej nazwie Workera. Jesli jest inna,
wpisz ja zamiast kasyno-pro. Jesli masz plik wrangler.jsonc/toml, ustaw w nim
tez poprawna nazwe. Zapisz zmiany i wdroz najnowszy commit.

Zaloguj sie na potwierdzone konto. Powinno byc 1000 zetonow. Zagraj, odswiez
strone: saldo i historia maja pozostac. Drugie konto ma widziec swoje dane.
Przy zerwanym polaczeniu kliknij „Sprawdz poprzedni zaklad” — powtorzenie
tej samej proby nie pobierze ponownie stawki ani nie wyplaci kolejnej wygranej.

## Zabezpieczenia i granice

- Zaden tajny klucz nie jest wysylany do przegladarki. Publishable key jest publiczny.
- Losowanie kryptograficzne i wyplaty odbywaja sie w bazie. Klient nie podaje wyniku/salda.
- Kazdy widzi tylko swoj portfel i rundy (RLS). Brak INSERT/UPDATE/DELETE dla gracza.
- Walidacja stawki 1–1000 calych zetonow, salda, typu i numeru po stronie serwera.
- Blokada wiersza i transakcja chronia przed podwojnym wydaniem srodkow.
- UUID proby zapewnia jednokrotne rozliczenie, takze przy ponowieniu zadania.
- Minimum 2 sekundy miedzy nowymi rundami jednego konta; nie jest to pelna ochrona DDoS.
- Biblioteki sa dolaczone lokalnie; kod produkcyjny nie pobiera ruchomych wersji z CDN.
- Naglowki ograniczaja wykonywanie skryptow i osadzanie strony w ramkach.

Skrypt zabezpiecza swoje dwie tabele i funkcje, nie stanowi audytu innych obiektow
w projekcie. Nie mam dostepu administracyjnego do Twojego Supabase: nie sprawdzilem
jego obecnych polityk, ustawien Auth ani poczty. Wlacz MFA na kontach administratorow
Supabase, GitHuba i Cloudflare. Nie publikuj service_role, sb_secret ani hasla bazy.
Przed otwarciem publicznej rejestracji dodaj CAPTCHA w formularzu i Supabase Auth;
ta wersja nie zawiera widgetu CAPTCHA. Nie ma gwarancji „nikt sie nie wlamie”.
Nie uzywaj tego prototypu do rozliczania prawdziwych pieniedzy.

## Weryfikacja

Testy wykonano lokalnie na PGlite (PostgreSQL WASM) z symulacja rol i auth.uid,
nie na Twojej produkcyjnej bazie: uprawnienia, izolacja RLS, potwierdzenie konta,
bonus jednorazowy, bledne stawki, brak srodkow, cooldown, idempotencja i 185
kombinacji wyplat przeszly. Nie wykonano testu konkurencyjnych polaczen do
produkcyjnego PostgreSQL ani audytu penetracyjnego.

Zrodlo interfejsu: src/app.jsx. Gotowy kod dla przegladarki: public/app.js.
Zmiana JSX wymaga ponownej kompilacji; w paczce jest gotowa wersja do wgrania.

Testu renderowania w przegladarce nie uruchomiono: srodowisko nie pozwolilo
pobrac przegladarki. Kompilacja JSX i kontrola skladni wynikowego JS przeszly.
Testy mozna odtworzyc: w folderze tests uruchom npm ci, potem npm test.

Dokumentacja:
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/auth-smtp
- https://developers.cloudflare.com/workers/static-assets/headers/
