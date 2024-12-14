# us-visa-bot
Bot to anticipate the interview date for a US visa.

## How it works

The bot is quite simple. You provide some informations for the bot to sign in in your behalf on https://ais.usvisa-info.com/, and then
it checks the nearest dates every few seconds. When it finds a closer date, it automatically book that time for you.

## How to find the variables?

- EMAIL and PASSWORD are your credentials to https://ais.usvisa-info.com.
- LOCALE depends on your language, can be found in the URL when trying to reschedule https://ais.usvisa-info.com/{LOCALE}/. 'fr-fr' for France, 'pt-br' for Brazil...
- SCHEDULE_ID can be found in the URL when trying to reschedule manually https://ais.usvisa-info.com/{LOCALE}/niv/schedule/{SCHEDULE_ID}/continue_actions.
- FACILITY_ID can be found looking at the network calls when trying to reschedule manually, when you get on the page where you can select a new date, you should see a network call similar to https://ais.usvisa-info.com/{LOCALE}/niv/schedule/{SCHEDULE_ID}/appointment/address/{FACILITY_ID}. Paris is 44. Alternatively you can inspect the Selector on this page and look at the value.
- REFRESH_DELAY is the number of seconds the bot must wait before trying to find new dates again. I recommend leaving it as 120 seconds, which is a sweet spot, because the website can block your requests for 24h if it detects too many of them.
- CURRENT_SCHEDULED_DATE is the date you currently have scheduled for the interview. It follows the YYYY-MM-DD format, therefore an example would be `2024-10-25`.

## Installing

You'll need node 16+ to run the bot. Also, you'll have to install some dependencies:

```sh
npm install
```

## Usage

Copy `.env.example` and rename the copy as `.env`. There you'll need to enter all the variables described

```sh
node ./index.js
```
