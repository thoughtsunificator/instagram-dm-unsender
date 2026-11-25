# src/

Layers, from the lowest to the highest. A layer only imports from the layers below it.

| Directory        | Description                                                                                                  |
|------------------|--------------------------------------------------------------------------------------------------------------|
| event/           | `Observable`, the event emitter shared by workflows, navigation and UI components                           |
| dom/             | Generic DOM helpers: wait for an element, click and wait for an element (with timeouts and abort support)   |
| workflow/        | Generic workflow system: `Workflow` (abort, retry with backoff, metrics, status), `pipe`, timing helpers     |
| instagram/       | Instagram's DOM as objects: `Thread`, `MessagesWrapper`, `Message`, selectors and hover/overlay helpers       |
| unsend-workflow/ | Workflows built on the above: `LoadMessages`, `MessageUnsend`, `MessageValidateUnsend`, `UnsendWorkflow`     |
| runtime/         | Context where idmu runs (the userscript): page navigation, features, OSD                                     |

See [the workflow design](./workflow/README.md) for how a workflow is composed.
