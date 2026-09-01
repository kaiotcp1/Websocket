# Contribution conventions

Commits merged into `main` determine the GitHub Release version automatically.
Use Conventional Commits:

- `fix: handle malformed WebSocket payload` → patch release, for example `v0.1.1`.
- `feat: add room creation route` → minor release, for example `v0.2.0`.
- `feat!: replace the message contract` or a `BREAKING CHANGE:` footer → major
  release, for example `v1.0.0`.
- `docs:`, `test:`, `build:` and `chore:` do not create a release by themselves.

The project starts in the `0.y.z` range while its public message contract is
still evolving. The first successful deployment creates `v0.1.0`; subsequent
versions are calculated from the Conventional Commits merged after that tag.
