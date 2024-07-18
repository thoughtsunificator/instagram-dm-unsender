# UI

Instagram UI API implementations.

There are multiple UIs because Instagram UI keeps changing and so the intent here is to save as much effort when fixing IDMU in the event that there is a breaking change.

UI can also be a mean of l10n (not i18n).

## How to implement a new UI

- Copy any existing UI
- Update ``getUI`` so that the UI is loaded when certain conditions are met
> This might be something as simple as testing ``navigator.language``
- Update the implementations
- Test manually
- Update the tests
- Run automated tests: ``npm test -- src/ui/[uiname]`` where uiname is the name of the UI you just created.
