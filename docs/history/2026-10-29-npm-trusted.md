# @moood/check on npm, published by CI without a token (2026-10-29)

**Why.** With moood open, `@moood/check` can be on npm with its provenance; a token in the repository's secrets is a
secret to keep and renew. npm's trusted publishing trusts one workflow of one repository instead — but only for a
package that is there already.

**What.** 0.1.0 published by hand (the owner's npm account, `npm publish --access public` in `packages/check`); on npm
the package's trusted publisher set to GitHub Actions — `moood-me/moood`, `ci.yml`. The `npm` job of `ci.yml`: npm 11
(trusted publishing wants 11.5.1 or later), `npm publish --access public` with no token — provenance comes with it.
A version after: its number in `packages/check/package.json`, a tag `check-v<that number>` pushed.
