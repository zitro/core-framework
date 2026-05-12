<p align="center">
  <img src="https://raw.githubusercontent.com/zitro/core-framework/main/public/brand/core_logoText_nobg.png" alt="CORE Discovery" width="380" />
</p>

# create-core-discovery-app

Scaffold a new CORE Discovery customer repository in seconds.

```bash
npx create-core-discovery-app acme
```

You'll be prompted for:

- Customer display name
- LLM provider (local / Azure OpenAI / OpenAI direct)
- Storage provider (local / Cosmos DB)
- Auth provider (none / Entra ID)
- Framework version to pin
- Optional initial discovery slug

The output is a self-contained customer repo with `compose.yaml` pinned to signed framework images, `.env` pre-filled with your provider choices, Renovate config for grouped image bumps, and an empty `projects/` ready for your content.

## What it creates

```
acme/
├── compose.yaml          # pinned to ghcr.io/zitro/core-framework-*:<version>
├── .env                  # filled in from your prompt answers
├── .env.example
├── .gitignore
├── README.md
├── renovate.json
├── projects/
│   └── <initial-slug>/   # if you provided one
├── extensions/
│   └── README.md
├── config/prompts/
└── infra/
    └── README.md         # Bicep placeholder
```

## After scaffolding

```powershell
cd acme
docker compose pull
docker compose up -d
start http://localhost:3000
```

## Keeping up to date

CORE checks the GitHub releases feed and shows an in-app banner whenever a new framework version is available. To upgrade:

```bash
npx create-core-discovery-app --upgrade
```

Run from inside an existing customer repo. The CLI plans the changes, shows a diff, and applies them atomically — no orphan files, no broken pinning.

## Why a CLI instead of a template repo?

A template repo gives you a static copy. The CLI fills in customer-specific names, picks the right Cosmos partition strategy for your storage choice, and pins to whatever framework version is current at scaffold time. Same end state, less manual editing.

## License

MIT — see the [framework repo](https://github.com/zitro/core-framework) for source and full docs.
