# Contributing

## Local checks

The CI pipeline runs `ruff check`, `ruff format --check`, `pytest`, `pnpm lint`,
`tsc --noEmit`, `vitest`, and `pnpm build`. Run them locally before pushing:

```powershell
# Backend
cd backend
.\.venv\Scripts\Activate.ps1
ruff check app
ruff format app
pytest

# Frontend
cd ..
pnpm lint
npx tsc --noEmit
npx vitest run
```

## Pre-commit hook (recommended)

A `.pre-commit-config.yaml` is included to wire up `ruff-check`, `ruff-format`,
and `tsc --noEmit` on every commit. Install it once:

```bash
pip install pre-commit
pre-commit install
```

Now `git commit` will fail loudly on any drift instead of waiting for CI.

## File size

Source files (`*.py`, `*.ts`, `*.tsx`) must stay under 300 lines. Extract
reusable components, helpers, or domain modules when a file approaches the
limit.

The only exemption is `src/components/ui/sidebar.tsx`, which is vendored
verbatim from `shadcn/ui` (`npx shadcn add sidebar`). Splitting it would
diverge from upstream and break future updates.

## Commit style

Conventional commits, imperative mood, body as bullet list. No emojis.
