# Default UI

The default UI is the first and default workflow and unsend strategy.
> If you do not know what an unsend strategy or default workflow is please read the [definition of an ui](../README.md#what-an-ui-is).

1. Load all the pages in the thread.
2. Once the pages are loaded, scroll until a message is visible. This is because Instagram hides messages as you scroll so that those outside of the viewport are actually hidden.
3. Once the first visible message is found, that is once certain steps are met, run the following workflow on the message:

     1. Show action menu button:
        Dispatch a mouseover for this message so that the three dots button appears.

     2. Open action menu:
        Click the three dots button to open the message actions.

     3. Open unsend confirm modal:
        Click the "Unsend" action button, a modal will open with a dialog that asks the user to confirm the intent.

     4. Click "confirm":
        Click the "confirm" button inside the modal.
        
> There is no concurrency. Messages are unsent one after the other by using a queue.

## Why are messages unsent one after another? 

Instagram can rate-limit repeated unsend actions, so the workflow processes one message at a time. The web UI also virtualizes the conversation: when you scroll, messages outside the viewport may be removed from the DOM and re-created later. The strategy therefore loads pages, scans only visible messages, and repeats that cycle instead of trying to operate on stale elements.

## Troubleshooting the workflow

Most workflow failures are caused by Instagram rolling out a new UI shape. In those cases, update the DOM lookup helpers in [dom-lookup.js](./dom-lookup.js) first, then inspect the workflow steps if selectors are still valid.

One way to attempt troubleshooting of the workflow is to add a mutation observer and running the workflows step manually and then comparing the elements you obtained with the one that the workflow is looking for.

```js
const mutationObserver = new MutationObserver((mutations, observer) => {
  const addedNodes = mutations.flatMap(mutation => [...mutation.addedNodes])
  console.info(addedNodes.map(node => node.textContent).join("\n======================\n"))
})
mutationObserver.observe(document.body, { subtree: true, childList: true })
```
