# Release manual

A GitHub-specific [workflow] has been created, this workflow will attempt to detect new tags and create a release accordingly.

Once the release is created, the final step of the workflow will "publish" the artifact/asset which is ./dist/idmu.user.js into a production-ready branch (userscript).

Ideally, the release would contain some sorts of changelog, at the current time this is not the case.

[workflow]: ../.github/workflows/release.yml

## How to create a release

1. Create a new tag using ``npm version``
2. Push both your commits and the tags (using ``git push --tags``)



