import { existsSync, readdirSync, cpSync, mkdirSync, readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"
import { intro, outro, select, isCancel, cancel } from "@clack/prompts"

export async function runInstaller(argv) {
  const args = new Set(argv)
  const force = args.has("--force") || args.has("--yes") || args.has("-y") || args.has("-f")
  const projectLocal = args.has("--project")

  const pkgRoot = dirname(fileURLToPath(import.meta.url))
  const pkgVersion = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")).version
  const srcDir = join(pkgRoot, "skill")

  const targetDir = projectLocal
    ? join(process.cwd(), ".claude/skills/vettedgaps")
    : join(homedir(), ".claude/skills/vettedgaps")

  intro(`vettedgaps-skill@${pkgVersion}`)

  const isExisting = existsSync(targetDir) && readdirSync(targetDir).length > 0

  if (isExisting && !force) {
    if (!process.stdin.isTTY) {
      console.error(`refusing to overwrite ${targetDir} non-interactively, pass --force`)
      process.exit(1)
    }

    const choice = await select({
      message: `${targetDir} already exists. What to do?`,
      options: [
        { value: "overwrite", label: "Overwrite contents" },
        { value: "skip", label: "Skip — keep existing files, no changes" },
        { value: "cancel", label: "Cancel" }
      ],
      initialValue: "cancel"
    })

    if (isCancel(choice) || choice === "cancel" || choice === "skip") {
      cancel("nothing changed")
      process.exit(0)
    }
  }

  mkdirSync(targetDir, { recursive: true })
  cpSync(srcDir, targetDir, { recursive: true, force: true })

  outro(`installed to ${targetDir}

Next steps:
  1. Generate API token: https://vettedgaps.com/api_tokens (requires Pro subscription)
  2. export VETTED_GAPS_TOKEN=<your-token>
  3. Restart Claude Code or open a new session
  4. Try: "find me addon opportunities for Shopify with score above 0.5"

Using Claude Desktop, Cursor, or Windsurf? Run \`npx vettedgaps-skill mcp\`
or see https://github.com/OlegPhenomenon/vettedgaps-skill#mcp-server for setup.
`)
}
