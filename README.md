# Cake Quote Kit launch site

Static English landing page with a working client-side cake pricing calculator and printable free checklist. Built for the Cake Quote Kit v2 Excel product. No backend services or paid campaigns are connected in this release.

The deployment includes only `dist/`. Owner launch documents are in `docs/`; calculation checks are in `tests/`. Read `docs/Integration-Guide.md` before enabling checkout, signup or public indexing.

Validation: `node tests/calculator.test.mjs`, JavaScript syntax checks, and local asset/anchor/label checks. Browser QA has not been performed.

Never commit credentials or put customer data or the paid buyer ZIP into public assets.
