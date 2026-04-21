# Test

For the stack used for testing read [the developer manual].

Testing is done both manually and automatically through unit testing.

idmu has a [virtual](./fake-ui.js) UI that can be tested against without the need to run the entire stack (web extension + live instagram version) this makes for a better DX that allows for faster iteration. 

## How to write tests

Along with the source code in some cases you will find a `.test.js` file, this is where the tests are written.

The test runner is [ava](https://github.com/avajs/ava), its config file is located at [/ava.config.js](../ava.config.js).

## Guidelines

- Test file ends with `.test.js` and are placed beside the source file they test against.
- Keep it simple, no god test functions and no bloated test files 
- Human-like test description 

## Basic example

```js
ava("Clicking on the menu button should open/close the menu", test => {
    test.is(t.context.document.querySelector("[role=row]"), dummyMessageElement)
})
```

## What should be tested

In the event that instagram has made a breaking change to its UI, the fake UI must be updated accordingly to reflect the changes. 
Furthermore, the tests of the fake ui must also be updated along with the workflow tests.

## How to run the debugger while testing

``npm run test:debug file.js`` allows you to use v8 debugger while testing (atm only works on one file at a time)

[the developer manual]: ../documentation/developer-manual.md
