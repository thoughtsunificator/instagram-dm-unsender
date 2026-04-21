# Developer manual

This manual is aimed at developers and attempts to describe the technical parts of the software.

## Workflow

All you need is a browser that is able to load a single userscript.

This could be as simple as installing [Violentmonkey](https://violentmonkey.github.io/) or something similar and enabling userscript autoreloading as explained here : https://violentmonkey.github.io/posts/how-to-edit-scripts-with-your-favorite-editor/

### Get it up and running

Install dependencies:
- ``npm install``

To both serve and build with autoreloading:
- ``npm start``

> This will also start an HTTP server and allow autoreloading of the userscript as changes are made.

You can also do a one-time build with:
- ``npm run build``

> The script will build to ``dist/idmu.user.js`` by default.

### Testing

> Please do set the  ``NODE_NO_WARNINGS=1`` to disable  ``punycode `` deprecation warnings.

Use the ``DEBUG=idmu:test`` env to enable debug logs while testing.

Lint files:
- ``npm run lint:ecmascript``

Run test with ava:
- ``npm test``

See the [testing documentation] for more information

Coverage:
- ``npm run test:coverage``

## Key point

The most important thing to remember is that web is a first class citizen. No bloating, polyfill or ponyfill, wrappers, preprocessors or whatever you can think of to mess things up.

## Architecture 

### Overall look

instagram-dm-unsender is basically a userscript that is the result of javascript bundling (rollup) and that browsers are able to easily integrate through the use of userscript managers or similar tools. You can think of the userscript context as being the runtime.

## Technologies

The client basic vanilla js to create the minimal UI which leverages [rollup](https://github.com/rollup/rollup) to generate a bundle of all the javascript files under `src/` (ecmascript modules) using [./src/runtime/userscript/main.js](../src/runtime/userscript/main.js) as the entrypoint.

### Application

All the choices made in terms of external requirements are made based on my version of the KISS principle which you should read no more than: keep the god damn code base maintainable and sustainable. 

- Mostly vanilla js
> Because I only need to write JavaScript code that best leverage the DOM APIs.

### Bundler

- [rollup](https://github.com/rollup/rollup) (bundle `src/main.js` to `dist`)
> Because it's not bloated although its API and core features could be improved

### Static analysis

- [husky](https://github.com/tipycode/husky) (git hooks)
> Use `git commit --no-verify -m "My message"` to temporarily disable the git hooks. Do this only if you're committing non-source code files such as markdown files.
- [eslint](https://github.com/eslint/eslint) (analysis for `.js` files)
- [stylelint](https://github.com/stylelint/stylelint) (analysis for `.css` files)
> Its usage is currently very limited and that's how it should be

### Testing

- [avajs](https://github.com/avajs/ava) (unit testing)
> Not that bloated and allows tests to run in isolated environments  
- [jsdom](https://github.com/jsdom/jsdom)
> Because it's not bloated and do a pretty good job interfacing with the web platform and its tests

## Guidelines

This guide lists, non-exhaustively, a few guidelines to follow when contributing to the code base.

As the guidelines are enforced by tools such as [eslint](https://github.com/eslint/eslint) and [stylelint](https://github.com/stylelint/stylelint), for the most part you can easily verify that your work is compliant (in terms of style) using `npm run lint`.

### Code style

- code shall be written in english
- UTF-8 for the file encoding
- LF for the end of line sequence
- indentation is 2 tabs (except when its not and `.editorconfig` will make sure to police your IDE about that)
- maximum text width is 200 characters
- no space to indent, no trailing spaces
- no trailing semi-colon unless necessary
- code shall be documented using english and [jsdoc](https://github.com/jsdoc/jsdoc) (version 4)
- code shall be tested using [avajs](https://github.com/avajs/ava)
- code shall be lintable
- no copyring shall be present in the source files a the sole exception of the LICENSE file
- tool configuration file begins with `.` and are placed at the root of the project
- modules import order is as follow: third-party modules, observables, models
- ecmascript classes or function declaration (no expression function style)
- external links must have their target attributes set to `blank` and `rel` attribute set to `noreferrer`
- Documentation is to be written in common markdown 

## Folder structure

In addition to the dot files which contain the tooling configurations the application is several folders:

```
├── data - data, sample and configuration files
├── dist - build artifacts
├── documentation - user and developer guides
├── public - static files
├── [src](../src/README.md] - source files
├── test - test setups
```

### `src/`

```
├── model - models, bindings event listeners and their tests
└── object - observable classes and their tests
└── persistence - anything related to data persistence
```

## Testing

See [test/README.md](../test/README.md).

## Roadmap

A simplified version of the roadmap is available in the [TODO.md](../TODO.md) file. Otherwise, checkout the [enhancement issues](https://github.com/thoughtsunificator/bookmarks-web-ui/labels/enhancement).

