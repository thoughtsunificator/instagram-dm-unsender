# instagram-dm-unsender

As of 2023 [instagram.com](https://www.instagram.com) does not allow batch unsending of messages which is why this project came to be.

The userscript allow a user to batch unsend DM in a thread on the web version of [instagram.com](https://www.instagram.com) 

⚠️ [This might not work](#why-only-us)

## Use cases

- One possible use case would be people wanting to switch to fediverse and want to "remove" all their messages from Meta's platform.

## How does it work ?

This script is meant to be run on the page that lists the message threads.

The workflow works as follow:
- Create a list of all messages by querying the DOM with an early messages detection strategy (we test the raw outputs of our ``find-messages-strategy`` against parts of the workflow).
  - For each message do the following:

     - ### Show action menu button:
        Dispatch a mouseover for this message so that the three dots button appears.

     - ### Open action menu:
        Click the three dots button to open the message actions.

     - ### Open unsend confirm modal:
        Click the "Unsend" action button, a modal will open with a dialog that asks user to confirm the intent.

     - ### Click "confirm":
        Click the "confirm" button inside the modal.



There is no concurrency, message are unsent one after another by using a queue.

⚠️ Instagram has a rate limits, after a certain of messages you might get blocked from unsending message for a period of time.

## Installing

[Install stable](https://github.com/thoughtsunificator/instagram-dm-unsender/releases/download/v0.4.41/idmu.user.js)

[Install latest](https://github.com/thoughtsunificator/instagram-dm-unsender/raw/userscript/idmu.user.js)

[Older releases](https://github.com/thoughtsunificator/instagram-dm-unsender/releases)

## Development

I recommend using [Violentmonkey](https://violentmonkey.github.io/) or similar and enable userscript autoreloading as explained in here https://violentmonkey.github.io/posts/how-to-edit-scripts-with-your-favorite-editor/ 

Install all dependencies:
- ``npm install``

Start rollup with the watch flag:
- ``npm start``

You can also do a one-time build with:
- ``npm run build``

## This might not work

Instagram web app is serving different UIs probably based on the user location. [Yours might not be supported](https://github.com/thoughtsunificator/instagram-dm-unsender/issues/1)

## Testing

Use the ``DEBUG=idmu:test`` env to enable debug logs while testing.

Lint files:
- ``npm run eslint``

Run test with ava:
- ``npm test``

Coverage:
- ``npm run c8``

## TODO 

- [ ] i18n, make sure it works for all languages
- [ ] l10n, make sure it works not only for the US version but also for the others.
- [ ] alert system (for scenarios such as rate limits)
