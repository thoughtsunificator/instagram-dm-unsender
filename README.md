# instagram-dm-unsender

As of 2023 [instagram.com](https://www.instagram.com) does not allow batch unsending of messages which is why this project came to be.

The userscript allow a user to batch unsend DM in a thread on the web version of [instagram.com](https://www.instagram.com) 

⚠️ [Only works on the US version](#why-only-us)

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

[Install userscript](https://github.com/thoughtsunificator/instagram-dm-unsender/raw/userscript/idmu.user.js)

[Older releases](https://github.com/thoughtsunificator/instagram-dm-unsender/releases)

## Development

I recommend using [Violentmonkey](https://violentmonkey.github.io/) or similar and enable userscript autoreloading as explained in here https://violentmonkey.github.io/posts/how-to-edit-scripts-with-your-favorite-editor/ 

Install all dependencies:
- ``npm install``

Start rollup with the watch flag:
- ``npm start``

You can also do a one-time build with:
- ``npm run build``

## Why only US

Instagram web app is different based on the user location and supporting all of them would require extra efforts which I do not see as a priority right now. As of now only the US version is supported.

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
