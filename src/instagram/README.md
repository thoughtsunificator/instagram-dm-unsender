# Instagram

Objects that mirror Instagram's direct messages DOM. Nothing here decides what to do: the steps that act on these objects live in [unsend-workflow](../unsend-workflow/).

| Module                   | What it is                                                                                              |
|--------------------------|---------------------------------------------------------------------------------------------------------|
| `thread.js`              | A conversation, found from the page. Finds the scrollable messages container                             |
| `messages-wrapper.js`    | The scrollable container. Finds the next message to unsend (scrolling when needed) and loads older pages |
| `message.js`             | One message sent by us: the four UI steps of an unsend (see `workflow/README.md`)                       |
| `messages.js`            | Localized "Unsend" labels and "more options" aria-label patterns                                        |
| `mutations.js`           | Hover events Instagram's React listens to                                                                |
| `overlays.js`            | Closes dialogs and menus left open by a previous failed action                                          |

Selectors are the most fragile part: when Instagram ships a new UI, these modules are what needs updating.

## Troubleshooting / DOM debugging

When Instagram changes its DOM, unsending usually fails because selectors no longer match. IDMU now exposes debug helpers on `window.__idmuDebug` in the browser console:

```js
__idmuDebug.help()                 // list commands
__idmuDebug.snapshotThread()       // container + row snapshot, selector config
__idmuDebug.probeSelectors()       // per-row: sentByCurrentUser, actionButton, aria labels
__idmuDebug.highlightActionButtons() // outline detected "..." buttons in purple
__idmuDebug.probeUnsendMenu()      // inspect open menu/dialog and unsend match
__idmuDebug.formatText()           // full debug log as text for bug reports
```

The on-screen Debug panel (next to "What's new") shows live debug log entries and can copy a full report including a DOM snapshot. Include that report in bug reports.

For low-level inspection, you can still log mutations:

```js
const mutationObserver = new MutationObserver((mutations) => {
  console.debug(mutations.map(mutation => [...mutation.addedNodes].map(node => node.innerHTML)).join("\n======\n"))
})
mutationObserver.observe(document.body, { subtree: true, childList: true })
```

Key selector sources:
- `messages.js`: `UNSEND_TEXT_VARIANTS` (menu label) and `MORE_OPTIONS_LABELS`/`LABEL_PATTERNS` (action button).
- `message.js`: `findActionButton`, `findUnsendMenuItem`, `findConfirmUnsendButton`.
- `messages-wrapper.js`: `isSentByCurrentUser`, `getMessagesInnerContainer`, `findVisibleLoader`.

Each step logs its progress with `console.debug`. Enable them with `DEBUG=idmu:test` when running the tests, or read the devtools console in the browser.
