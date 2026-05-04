# UI

Note: For the time being this is a work in progress, there is no **real** mechanism to deliver multiple UIs, it is as simple as the [default ui](./default/README.md) is always selected so there is some work needed there. Maybe l10n support could be added too to make things easier.

# What an UI is

An UI not to confound with the [UI class](./ui.js), is a generic term tthat is a conceptualized representation of Instagram DOM along with a strategy and a workflow that enables running various actions such as unsending messages.

## Why should I create a new UI

For the time being there is no way for a user to choose a particular UI which means that there can only be one UI at the same time.

When progress is made towards having a UI manager, creating new UIs should in theory enables users to choose efficient workflows based on their needs as well as supporting both new localization and internationalization.

## How to create a new UI

- Copy any existing UI
- Update ``getUI`` so that the UI is loaded when certain conditions are met
> This might be something as simple as testing ``navigator.language``
- Update the copied UI workflows to fit your needs
- Test manually
- Update the tests
- Run automated tests: ``npm test -- src/ui/[uiname]`` where uiname is the name of the UI you just created.
- Write documentation

## Troubleshooting an UI

Read the relevant README.md for the ui you're trying to troubleshoot.

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

Because there is rate limitings and above all, because as part of a failed best-effort to make technology better, web standards and web less standards such as popular frameworks and libraries have deemed intelligent to break accessibility and mostly everything by introducing [anti-features](https://github.com/whatwg/html/issues/2858#issuecomment-3172510066) that remove non-visible [Elements](https://html.spec.whatwg.org/multipage/dom.html#elements) from web pages. Basically, everytime you scroll, search or do anything that causes a the web page to be updated, some messages (Elements) become non-visible, those messages are outside of what we call the viewport (the visible part of the page). Keep in mind that technology gets less better as time goes on. Sorry.

## Troubleshooting the workflow

Most the time when the workflow is not working this is caused by Instagram rolling out new version of their UI, which mean that [selectors](./dom-lookup.js) need to be updated. That is if we are lucky, if we are not so lucky we might have to update the core of the workflow itself. 

One way to attempt troubleshooting of the workflow is to add a mutation observer and running the workflows step manually and then comparing the elements you obtained with the one that the workflow is looking for.

```js
const mutationObserver = new MutationObserver((mutations, observer) => {
  console.debug(mutations.map(mutation => [...mutation.addedNodes].map(a => a.innerHTML)).join("\n======================\n"))
})
mutationObserver.observe(document.body, { subtree: true, childList: true })
```
