# vettedgaps-skill

Bring [Pain Radar](https://vettedgaps.com) into your AI: search validated user pain points, save favorites, post comments — without leaving your IDE.

**Two ways to use:**

- **Claude Code** → markdown skill (`SKILL.md` in `~/.claude/skills/vettedgaps/`)
- **Claude Desktop / Cursor / Windsurf** → MCP server (`npx vettedgaps-skill mcp`)

Both share the same npm package and the same Pain Radar API auth.

---

## Claude Code skill

```bash
npx vettedgaps-skill
```

Copies the skill to `~/.claude/skills/vettedgaps/` (user-level, available in all projects). Add `--project` for `./.claude/skills/vettedgaps/`. If the target already exists, you'll get a prompt (`overwrite / skip / cancel`, default `cancel`). Use `--force` / `-y` to skip the prompt.

Then:

1. Generate an API token at [vettedgaps.com/api_tokens](https://vettedgaps.com/api_tokens) (Pro subscription required).
2. `export VETTED_GAPS_TOKEN=<your-token>` (add to `~/.zshrc` for persistence).
3. Restart Claude Code or open a new session.

Ask Claude: *"find me 5 addon-opportunity ideas for shopify with score above 0.5"*.

## MCP server <a id="mcp-server"></a>

For Claude Desktop, Cursor, Windsurf, or any other MCP-compatible client. Same auth model — `VETTED_GAPS_TOKEN` from your Pro account.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "vettedgaps": {
      "command": "npx",
      "args": ["-y", "vettedgaps-skill", "mcp"],
      "env": { "VETTED_GAPS_TOKEN": "<your-token>" }
    }
  }
}
```

Restart Claude Desktop (Cmd+Q + open). Ask: *"what tools do I have from vettedgaps?"*

### Cursor

Edit `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per project). Same `mcpServers` block as above.

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`. Same `mcpServers` block as above.

### Available MCP tools

| Tool | Description |
|---|---|
| `search_pains` | Search by niche, min_score, opportunity_type, actionable shortcut. Paginated via cursor. |
| `get_pain_card` | Full card details with score components and evidence quotes. |
| `favorite_pain` | Save to favorites (idempotent — repeat = 200 OK). |
| `comment_on_pain` | Post a comment; optional reply to top-level via parent_comment_id. |
| `export_pain_card` | Export card as `md` / `pdf` / `json` (same renders as the website). PDF saves to `~/Downloads/painradar-<slug>-<date>.pdf` (override via `output_path`); md/json return text directly. |

### Testing the MCP server locally

```bash
# List tools (any non-empty VETTED_GAPS_TOKEN will start the server)
VETTED_GAPS_TOKEN=test npx -y @modelcontextprotocol/inspector --cli \
  npx vettedgaps-skill mcp --method tools/list

# Real call (needs real Pro token)
VETTED_GAPS_TOKEN=<real-token> npx -y @modelcontextprotocol/inspector --cli \
  npx vettedgaps-skill mcp --method tools/call --tool-name search_pains \
  --tool-arg niche=shopify --tool-arg per_page=2
```

## Manual install (without npx)

```bash
git clone git@github.com:OlegPhenomenon/vettedgaps-skill.git
cp -r vettedgaps-skill/skill ~/.claude/skills/vettedgaps
export VETTED_GAPS_TOKEN=<your-token>
```

For MCP — point your client's config to `node /path/to/vettedgaps-skill/mcp-server.js` instead of `npx`.

## API reference

See [`skill/SKILL.md`](./skill/SKILL.md) for the full operation list (same operations exposed via MCP, same endpoints).

Underlying API:

- `GET https://vettedgaps.com/api/v1/pains` — search (with `niche`, `min_score`, `opportunity_type`, `actionable`, `cursor` filters)
- `GET https://vettedgaps.com/api/v1/pains/:id` — get card with evidence
- `POST https://vettedgaps.com/api/v1/favorites` — save (idempotent)
- `POST https://vettedgaps.com/api/v1/pains/:id/comments` — comment (with optional `parent_comment_id` for replies)

Rate limit: 60 requests per minute per token. Error envelope: `{"error": {"code": "...", "message": "..."}}`.

## License

MIT — see [LICENSE](./LICENSE).

## Links

- Pain Radar: https://vettedgaps.com
- Generate API token: https://vettedgaps.com/api_tokens
- Pricing: https://vettedgaps.com/pricing
- Skill repo: https://github.com/OlegPhenomenon/vettedgaps-skill
- Pain Radar source: https://github.com/OlegPhenomenon/pain-radar
- MCP spec: https://modelcontextprotocol.io
