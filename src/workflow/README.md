# Workflow

A workflow is a unit of work that acts on the page. Every workflow:

- owns an `AbortController`; stopping it (`abort()`) stops the workflow and every child that shares it.
- emits `status` (human readable text for the OSD) and `metrics` (`count`/`setState` changes).
- retries with `withBackoff(task, { retries, baseMs, maxMs })`, exponential backoff, aborts immediately.
- waits with `wait(ms)`, which is cut short when aborted.

Steps are composed with `pipe(abortController, [step1, step2, ...], initial)`: each step receives the previous result and the abort controller.

## Layers

1. `MessageUnsend` runs the four UI steps (actions button, actions menu, confirm dialog, confirm). On failure it dismisses leftover overlays and marks the message as ignored for this scan.
2. `MessageValidateUnsend` waits for Instagram to remove the message. If it is still there the unsend was refused (likely a rate limit): `LateFailureWorkflowError`.
3. `LoadMessages` scrolls up page after page until the start of the conversation.
4. `UnsendWorkflow` loads the history, then unsends the messages from the newest to the oldest, with a randomized pause between two unsends. It stops after `maxConsecutiveFailures` failures in a row and rescans when nothing was found at all (the page may not be hydrated yet). Options are documented in `DEFAULT_OPTIONS`.

## Errors

- `WorkflowAbortedError`: the workflow was stopped; never retried.
- `FailedWorkflowError`: one message could not be unsent.
- `LateFailureWorkflowError`: the message was not removed after confirmation.
