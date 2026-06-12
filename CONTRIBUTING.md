# Contributing to DocCode

Thank you for your interest in contributing! This document covers the development
setup, testing, and house rules that keep the codebase consistent.

See also: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [LICENSE.md](LICENSE.md)

---

## Code of Conduct

Please be respectful and considerate. Everyone is welcome to contribute,
regardless of background or experience level.

---

## How to Contribute

### Reporting Bugs

Create a GitHub issue with:
- A clear, descriptive title
- Steps to reproduce, expected behaviour, actual behaviour
- Relevant logs or screenshots
- Your environment (OS, Docker version, browser)

### Suggesting Enhancements

Create an issue with:
- A clear title and description of the current behaviour
- What you'd like instead and why
- Examples of how the enhancement would work

### Pull Requests

1. Fork the repository
2. Create a branch: `git checkout -b feat/your-feature-name`
3. Make your changes (see house rules below)
4. Run the test suites (see Testing)
5. Commit with a conventional commit message (see Commit style)
6. Push and open a pull request against `main`

**PR guidelines:**
- Clear, descriptive title
- Reference any related issues
- Update documentation if needed
- Add tests for new features
- Keep PRs focused on a single concern
- Squash-merge is the default (maintainers do this at merge time)

---

## Development Setup

### Prerequisites

- Docker and Docker Compose >= 2.24.0
- Bash shell (Linux / macOS / WSL)
- Python 3.9+ with `pip` (for server tests)
- [Bun](https://bun.sh) (for JS tests)

### Getting started

```bash
git clone https://github.com/vppillai/kroki-server.git
cd kroki-server
./setup-kroki-server.sh start
# Access DocCode at https://localhost:8443/
```

For changes to `demoSite/` files, restart to apply:

```bash
./setup-kroki-server.sh restart
```

---

## Testing

CI runs both suites on every push/PR to `main` (see `.github/workflows/ci.yml`).
Run them locally before opening a PR:

```bash
# Python server tests
cd demoSite && pip install -r requirements-dev.txt
python -m pytest tests/test_server.py -q

# JavaScript tests (Bun)
cd demoSite && bun test tests/
```

`requirements-dev.txt` chains `requirements.txt` + pytest — installing it is
sufficient; there is no separate `tests/requirements.txt`.

---

## House Rules

### nginx.conf is GENERATED — never commit it

`nginx.conf` is produced by a heredoc inside `setup-kroki-server.sh`
(around lines 159–290) and is listed in `.gitignore`. Any nginx changes must
be made in the heredoc inside the script, not in the generated file.

### .env.example is the sole version source

`VERSION` in `.env.example` is the single source of truth for the release
version. **Contributors must not bump it.** Maintainers bump it in the release
PR (the final commit, after all feature commits).

`.env` itself is untracked and auto-bootstrapped from `.env.example` on the
first `./setup-kroki-server.sh start` (see `setup-kroki-server.sh` ~line 22).
New configuration options must be added to `.env.example` with safe
closed-network defaults and a short comment.

### Empty-string-tolerant env parsing

Shell: use `${VAR:-default}` so that an uncommented-but-empty var (e.g.
`GUNICORN_WORKERS=`) falls through to the default rather than passing an
empty string to the consumer. The one deliberate exception is
`${COMPOSE_PROFILES-companions}` (non-colon form): an explicit empty value
(`COMPOSE_PROFILES=`) means "no companion renderers" and must be passed through
as empty, not replaced with `companions`.

Python: use `os.environ.get(name) or default` rather than
`os.environ.get(name, default)` so that an empty string also triggers the
default.

### IMPORTMAP_SHA256 + CSP hash rule

If you change any vendored JS file or the import map, update `IMPORTMAP_SHA256`
in `.env.example` (or wherever it is sourced) and run the bun test suite to
confirm the CSP integrity test still passes.

### Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`.

Example: `fix(ai): handle empty AI_PROXY_API_KEY gracefully`

Squash-merge is the default — the PR title becomes the merge commit message,
so keep it conventional too.
