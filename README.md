# vettedgaps-skill

Claude Code skill for [Pain Radar](https://vettedgaps.com) — search validated user pain points, save favorites, and post comments without leaving your IDE.

## Install (one command)

```bash
npx vettedgaps-skill
```

This copies the skill to `~/.claude/skills/vettedgaps/` (user-level, available in all projects).

Add `--project` to install into the current project's `.claude/skills/vettedgaps/` instead.

If the target directory already exists you'll be prompted: `overwrite / skip / cancel` (default `cancel`). Use `--force` or `-y` to skip the prompt and overwrite (useful in CI / scripts).

## Setup

1. Generate an API token at [vettedgaps.com/api_tokens](https://vettedgaps.com/api_tokens) (requires Pro subscription).
2. Export it in your shell:
   ```bash
   export VETTED_GAPS_TOKEN=<your-token>
   ```
   Add this line to `~/.zshrc` (or `~/.bashrc`) to make it permanent.
3. Restart Claude Code or open a new session — the skill will be auto-loaded.

## Try it

In Claude Code, ask:

- *"Find me 5 addon-opportunity ideas for Shopify with score above 0.5."*
- *"Show me the details of pain card #310."*
- *"Save card #310 to favorites with note 'building a chrome extension for this'."*
- *"Comment on #310: 'starting to prototype this'."*

The skill knows how to call the [Pain Radar API](https://vettedgaps.com/api/v1) — search, get details, favorite, comment.

## Manual install (without npx)

If you prefer to inspect or vendor the skill files yourself:

```bash
git clone git@github.com:OlegPhenomenon/vettedgaps-skill.git
cp -r vettedgaps-skill/skill ~/.claude/skills/vettedgaps
export VETTED_GAPS_TOKEN=<your-token>
```

That's it — same result as `npx vettedgaps-skill`.

## What's inside

```
~/.claude/skills/vettedgaps/
└── SKILL.md   ← instructions for Claude (API endpoints, auth, error handling, examples)
```

That's the entire skill — one markdown file. Claude reads it on session start and knows how to use the Pain Radar API.

## API reference

See [`skill/SKILL.md`](./skill/SKILL.md) for the full operation list and request/response shapes. Or browse the live endpoints (requires token):

- `GET https://vettedgaps.com/api/v1/pains` — search
- `GET https://vettedgaps.com/api/v1/pains/:id` — get card with evidence
- `POST https://vettedgaps.com/api/v1/favorites` — save
- `POST https://vettedgaps.com/api/v1/pains/:id/comments` — comment

Rate limit: 60 requests per minute per token. Error envelope: `{"error": {"code": "...", "message": "..."}}`.

## License

MIT — see [LICENSE](./LICENSE).

## Links

- Pain Radar website: https://vettedgaps.com
- Generate API token: https://vettedgaps.com/api_tokens
- Pricing: https://vettedgaps.com/pricing
- Skill repo: https://github.com/OlegPhenomenon/vettedgaps-skill
- Pain Radar source: https://github.com/OlegPhenomenon/pain-radar
