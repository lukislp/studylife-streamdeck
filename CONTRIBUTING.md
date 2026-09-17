# Contributing to StudyLife for Stream Deck

Thanks for taking the time. This is a single-maintainer project, so the process is deliberately
small - but it is the same for every change, including the maintainer's own.

## How changes get in

1. Open an issue first for anything bigger than a typo or an obvious bug fix, so the direction can
   be agreed before you spend time on it. Use the templates under `.github/ISSUE_TEMPLATE/`.
2. Fork the repository (or branch, if you have write access) and make your change on a branch.
3. Open a pull request against `main`. The pull-request template asks for what changed and why.
4. `main` is protected by a ruleset: a PR merges only after `lint`, `build` and
   `review / dependency-review` are green. Nobody pushes to `main` directly, not even the
   maintainer.

## What a pull request needs

- **Conventional Commits.** The version and the changelog are generated from the commit messages
  (`feat:` = minor release, `fix:` = patch release, `build:`/`ci:`/`docs:`/`test:` = no release).
  Squash-merge keeps the PR title as the commit message, so give the PR a Conventional Commit
  title.
- **Tests for new functionality.** New behaviour in `src/oauth.ts`, `src/timer.ts`, `src/render.ts`
  or the pure helpers in `src/api.ts` comes with a test under `tests/`.
- **No behaviour change in the wire shapes without checking the server.** `timer.ts`'s doc comment
  explains why - the server accepts unknown JSON fields silently, so a wrong field name is a green
  build that does nothing.

## Running things locally

```bash
npm install
npm run typecheck
npm test
npm run build
npm run package
```

## Security issues

Please do not open a public issue for a vulnerability - use the private reporting path described
in [SECURITY.md](SECURITY.md).
