#!/usr/bin/env node

import fetch from "node-fetch";
import cheerio from 'cheerio';
import dotenv from 'dotenv';
// import { exec } from 'child_process';

dotenv.config();

const EMAIL = process.env.EMAIL
const PASSWORD = process.env.PASSWORD
const SCHEDULE_ID = process.env.SCHEDULE_ID
const FACILITY_ID = process.env.FACILITY_ID
const LOCALE = process.env.LOCALE
const CURRENT_SCHEDULED_DATE = process.env.CURRENT_SCHEDULED_DATE
const REFRESH_DELAY = Number(process.env.REFRESH_DELAY || 3)

const BASE_URI = `https://ais.usvisa-info.com/${LOCALE}/niv`

async function main(currentBookedDate) {
  if (!currentBookedDate) {
    log(`Invalid current booked date: ${currentBookedDate}`);
    process.exit(1);
  }

  log(`Initializing with current date ${currentBookedDate}`);

  try {
    const sessionHeaders = await login();

    while (true) {
      const date = await checkAvailableDate(sessionHeaders);
      if (!date) {
        log("No dates available");
      } else if (date > currentBookedDate) {
        log(`Nearest date is further than already booked (${currentBookedDate} vs ${date})`);
      } else if (date < currentBookedDate) {
        // Parse the dates for comparison
        const currentDate = new Date(`${currentBookedDate}T00:00:00`); // Ensure correct parsing
        const newDate = new Date(`${date}T00:00:00`);

        // Calculate the difference in days
        const differenceInDays = (newDate - currentDate) / (1000 * 60 * 60 * 24);

        if (differenceInDays > 1) {
          const time = await checkAvailableTime(sessionHeaders, date);

          log(`FOUND DATE at ${date} ${time}`);
          log(`FOUND DATE at ${date} ${time}`);
          log(`FOUND DATE at ${date} ${time}`);

          // exec(
          //   'toast64.exe --app-id "US VISA BOT" --title "AVAILABLE DATE FOUND" --message "A closer available date for scheduling was found for the US VISA." --audio "default" --loop --activation-arg "https://ais.usvisa-info.com/pt-pt/niv/users/sign_in"',
          //   (error, stdout, stderr) => {
          //     if (error) {
          //       console.error(`Error: ${error.message}`);
          //       return;
          //     }
          //     if (stderr) {
          //       console.error(`Standard Error: ${stderr}`);
          //       return;
          //     }
          //     console.log(`Output: ${stdout}`);
          //   }
          // );

          await book(sessionHeaders, date, time)
            .then(() => log(`Booked time at ${date} ${time}`))
            .catch(err => {
              console.error(`Error booking date: ${err}`);
              log(`Retrying script with the current booked date: ${currentBookedDate} `);
              main(currentBookedDate); // Restart with the problematic date
              return;
            });
          
          currentBookedDate = date;
            
          // Restart main with the newly booked date
          log(`Restarting main with the newly booked date: ${currentBookedDate}`);
          main(currentBookedDate);
          return;
        } else {
          log(`Found date ${date} is only 1 day before the current booked date (${currentBookedDate}), skipping.`);
        }
      } else if (date === currentBookedDate) {
        log(`The available date is equal to your booked date (${date})`);
      } else {
        log(`Check if there's any problem with the APPLICATION (${date})`);
      }

      await sleep(REFRESH_DELAY);
    }
  } catch (err) {
    console.error(err);
    log(`Error occurred. Retrying main with currentBookedDate: ${currentBookedDate}`);
    main(currentBookedDate); // Retry with the last used date
  }
}

async function login() {
  log(`Logging in`)

  const anonymousHeaders = await fetch(`${BASE_URI}/users/sign_in`, {
    headers: {
      "User-Agent": "",
      "Accept": "*/*",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
    },
  })
    .then(response => extractHeaders(response))

  return fetch(`${BASE_URI}/users/sign_in`, {
    "headers": Object.assign({}, anonymousHeaders, {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    }),
    "method": "POST",
    "body": new URLSearchParams({
      'utf8': '✓',
      'user[email]': EMAIL,
      'user[password]': PASSWORD,
      'policy_confirmed': '1',
      'commit': 'Acessar'
    }),
  })
    .then(res => (
      Object.assign({}, anonymousHeaders, {
        'Cookie': extractRelevantCookies(res)
      })
    ))
}

function checkAvailableDate(headers) {
  return fetch(`${BASE_URI}/schedule/${SCHEDULE_ID}/appointment/days/${FACILITY_ID}.json?appointments[expedite]=false`, {
    "headers": Object.assign({}, headers, {
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    }),
    "cache": "no-store"
  })
    .then(r => r.json())
    .then(r => handleErrors(r))
    .then(d => d.length > 0 ? d[0]['date'] : null)

}

function checkAvailableTime(headers, date) {
  return fetch(`${BASE_URI}/schedule/${SCHEDULE_ID}/appointment/times/${FACILITY_ID}.json?date=${date}&appointments[expedite]=false`, {
    "headers": Object.assign({}, headers, {
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    }),
    "cache": "no-store",
  })
    .then(r => r.json())
    .then(r => handleErrors(r))
    .then(d => d['business_times'][0] || d['available_times'][0])
}

function handleErrors(response) {
  const errorMessage = response['error']

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return response
}

async function book(headers, date, time) {
  const url = `${BASE_URI}/schedule/${SCHEDULE_ID}/appointment`

  const newHeaders = await fetch(url, { "headers": headers })
    .then(response => extractHeaders(response))

  return fetch(url, {
    "method": "POST",
    "redirect": "follow",
    "headers": Object.assign({}, newHeaders, {
      'Content-Type': 'application/x-www-form-urlencoded',
    }),
    "body": new URLSearchParams({
      'authenticity_token': newHeaders['X-CSRF-Token'],
      'confirmed_limit_message': '1',
      'use_consulate_appointment_capacity': 'true',
      'appointments[consulate_appointment][facility_id]': FACILITY_ID,
      'appointments[consulate_appointment][date]': date,
      'appointments[consulate_appointment][time]': time
    }),
  })
}

async function extractHeaders(res) {
  const cookies = extractRelevantCookies(res)

  const html = await res.text()
  const $ = cheerio.load(html);
  const csrfToken = $('meta[name="csrf-token"]').attr('content')

  return {
    "Cookie": cookies,
    "X-CSRF-Token": csrfToken,
    "Referer": BASE_URI,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    'Cache-Control': 'no-store',
    'Connection': 'keep-alive'
  }
}

function extractRelevantCookies(res) {
  const parsedCookies = parseCookies(res.headers.get('set-cookie'))
  return `_yatri_session=${parsedCookies['_yatri_session']}`
}

function parseCookies(cookies) {
  const parsedCookies = {}

  cookies.split(';').map(c => c.trim()).forEach(c => {
    const [name, value] = c.split('=', 2)
    parsedCookies[name] = value
  })

  return parsedCookies
}

function sleep(s) {
  return new Promise((resolve) => {
    setTimeout(resolve, s * 1000);
  });
}

function log(message) {
  console.log(`[${new Date().toISOString()}]`, message)
}

main(CURRENT_SCHEDULED_DATE)
