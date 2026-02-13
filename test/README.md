# Test

In addition to living testing, idmu has a [virtual](./fake-ui.js) UI that can be tested against without the need to run the entire stack (web extension + live instagram version). This makes for a better DX. 

## Introduction

Along with the source code in some cases you will find a `.test.js` file, this is where the tests are written.

The test runner is [ava](https://github.com/avajs/ava), its config file is located at [/ava.config.js](../ava.config.js).

## Guidelines

- Test file ends with `.test.js` and are placed beside the source file they test against.

## Basic example

```js
ava("Clicking on the menu button should open/close the menu", test => {
    test.is(t.context.document.querySelector("[role=row]"), dummyMessageElement)
})
```

## Updating the Fake UI

Whenever changes are made to the live version of instagram they must be propagated to the fake UI.

