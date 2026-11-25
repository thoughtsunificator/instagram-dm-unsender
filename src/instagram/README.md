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

## Troubleshooting

Log what Instagram renders and compare it with what the code looks for:

```js
const mutationObserver = new MutationObserver((mutations) => {
  console.debug(mutations.map(mutation => [...mutation.addedNodes].map(node => node.innerHTML)).join("\n======\n"))
})
mutationObserver.observe(document.body, { subtree: true, childList: true })
```

Each step logs its progress with `console.debug`. Enable them with `DEBUG=idmu:test` when running the tests, or read the devtools console in the browser.
