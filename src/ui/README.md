# UI

Note: For the time being this is a work in progress, there is no **real** mechanism to deliver multiple UIs, it is as simple as the [default ui](./default/README.md) is always selected so there is some work needed there. Maybe l10n support could be added too to make things easier.

# What an UI is

An UI is basically a strategy/workflow to unsend messages as opposed to the [UIPI](../uipi/README.md) which encapsulates it. An UI will provide an actual implementation of the UIPI.

## Why should I create a new UI

There's need to have several UIs because Instagram UI keeps changing and so the intent here is to save as much effort when fixing IDMU in the event that there is a breaking change.

1. Add support for non-english language. (l10n)
> For the time being that's how l10n can be done, in the future l10n should ne supported at the UI level which would mean that there would we be no need to create an UI, instead an UI could be internationalized directly.
2. Add a different workflow either as backup or as a more efficient alternative.

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

