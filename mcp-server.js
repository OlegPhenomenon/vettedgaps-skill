import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, dirname, isAbsolute } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"

const pkgRoot = dirname(fileURLToPath(import.meta.url))
const version = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")).version

const API_BASE = process.env.VETTED_GAPS_API_BASE ?? "https://vettedgaps.com/api/v1"
const TOKEN = process.env.VETTED_GAPS_TOKEN
if (!TOKEN) {
  console.error("VETTED_GAPS_TOKEN env var is required. Get one at https://vettedgaps.com/api_tokens")
  process.exit(1)
}

async function api(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": `vettedgaps-skill-mcp/${version}`,
      Accept: "application/json",
      ...(init.headers ?? {})
    }
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 500)}`)
  return text ? JSON.parse(text) : null
}

const ok = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] })
const errResp = (msg) => ({ content: [{ type: "text", text: msg }], isError: true })

const server = new McpServer({ name: "vettedgaps", version })

server.registerTool(
  "search_pains",
  {
    description:
      "Search Pain Radar for validated user pain points on SaaS marketplaces. " +
      "Use when the user wants to discover product opportunities, browse pain cards by niche " +
      "(shopify, notion, atlassian, etc), filter by score, or find addon/workflow ideas. " +
      "Returns paginated cards with score, opportunity_type, and a short summary. " +
      "To get more results, call again with `cursor` from previous response's `meta.next_cursor`.",
    inputSchema: {
      niche: z.string().optional().describe("Marketplace slug (shopify, notion, atlassian, etc)"),
      min_score: z.number().min(0).max(1).optional().describe("Minimum score filter, 0..1"),
      opportunity_type: z
        .enum(["vendor_only", "addon_opportunity", "workflow_tool", "competitor_opportunity"])
        .optional()
        .describe("Filter by opportunity classification"),
      actionable: z
        .boolean()
        .optional()
        .describe("If true, excludes vendor_only cards. Use for miniapp/extension ideas."),
      per_page: z.number().int().min(1).max(50).optional().describe("Page size, default 20, max 50"),
      cursor: z.string().optional().describe("Pagination cursor from previous response's meta.next_cursor")
    }
  },
  async (input) => {
    try {
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(input)) if (v !== undefined) qs.set(k, String(v))
      return ok(await api(`/pains?${qs}`))
    } catch (e) {
      return errResp(`search_pains failed: ${e.message}`)
    }
  }
)

server.registerTool(
  "get_pain_card",
  {
    description:
      "Fetch full details of a single pain card by ID — title, description, score_components, " +
      "and evidence array with quoted Reddit/forum posts and source URLs. Use after search_pains " +
      "to dig into a specific result before favoriting or commenting.",
    inputSchema: {
      id: z.union([z.string(), z.number()]).describe("Pain card ID")
    }
  },
  async ({ id }) => {
    try {
      return ok(await api(`/pains/${encodeURIComponent(String(id))}`))
    } catch (e) {
      return errResp(`get_pain_card failed: ${e.message}`)
    }
  }
)

server.registerTool(
  "favorite_pain",
  {
    description:
      "Save a pain card to the user's favorites for later. Idempotent — repeat calls " +
      "return 200 with existing record (note is NOT updated on repeat). " +
      "Use when the user says they want to save, bookmark, or star a pain card.",
    inputSchema: {
      pain_card_id: z.number().int().describe("Pain card ID to favorite"),
      note: z
        .string()
        .max(1000)
        .optional()
        .describe("Optional personal note, max 1000 chars. Only saved on first favorite, ignored on idempotent repeats.")
    }
  },
  async ({ pain_card_id, note }) => {
    try {
      return ok(
        await api(`/favorites`, {
          method: "POST",
          body: JSON.stringify({ pain_card_id, note })
        })
      )
    } catch (e) {
      return errResp(`favorite_pain failed: ${e.message}`)
    }
  }
)

server.registerTool(
  "comment_on_pain",
  {
    description:
      "Post a comment on a pain card. Optionally reply to an existing top-level comment " +
      "via parent_comment_id (must be on the same pain card and not itself a reply). " +
      "Use when the user says they want to comment, post, or reply on a pain.",
    inputSchema: {
      pain_card_id: z.number().int().describe("Pain card ID to comment on"),
      body: z.string().min(1).max(10000).describe("Comment body, 1..10000 chars (markdown supported)"),
      parent_comment_id: z
        .number()
        .int()
        .optional()
        .describe("ID of a top-level comment on the same card to reply to")
    }
  },
  async ({ pain_card_id, body, parent_comment_id }) => {
    try {
      return ok(
        await api(`/pains/${pain_card_id}/comments`, {
          method: "POST",
          body: JSON.stringify({ body, parent_comment_id })
        })
      )
    } catch (e) {
      return errResp(`comment_on_pain failed: ${e.message}`)
    }
  }
)

function parseFilenameFromContentDisposition(header) {
  if (!header) return null
  const m = /filename="?([^";]+)"?/.exec(header)
  return m ? m[1] : null
}

function resolveOutputPath(outputPath, defaultFilename) {
  if (outputPath) {
    return isAbsolute(outputPath) ? outputPath : join(process.cwd(), outputPath)
  }
  return join(homedir(), "Downloads", defaultFilename)
}

server.registerTool(
  "export_pain_card",
  {
    description:
      "Export a pain card as Markdown, JSON, or PDF — using the same render as the website. " +
      "For md/json the content is returned as text in the response (unless output_path is given). " +
      "For pdf the file is saved to output_path (default ~/Downloads/painradar-<slug>-<date>.pdf) " +
      "and the saved path + byte size are returned. Use when the user wants to save, share, " +
      "or print a pain card for offline reading or briefing materials.",
    inputSchema: {
      id: z.union([z.string(), z.number()]).describe("Pain card ID"),
      format: z.enum(["md", "pdf", "json"]).describe("Export format"),
      output_path: z
        .string()
        .optional()
        .describe(
          "Optional file path to save the export. For PDF the default is " +
          "~/Downloads/painradar-<slug>-<date>.pdf. Absolute paths are used as-is; " +
          "relative paths are resolved against the current working directory."
        )
    }
  },
  async ({ id, format, output_path }) => {
    try {
      const path = `/pains/${encodeURIComponent(String(id))}/export.${format}`
      const res = await fetch(`${API_BASE}${path}`, {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "User-Agent": `vettedgaps-skill-mcp/${version}`,
          Accept: "*/*"
        }
      })

      if (!res.ok) {
        const text = await res.text()
        return errResp(
          `export_pain_card failed: HTTP ${res.status} ${res.statusText}: ${text.slice(0, 500)}`
        )
      }

      const filename =
        parseFilenameFromContentDisposition(res.headers.get("content-disposition")) ||
        `painradar-${id}.${format}`

      if (format === "pdf") {
        const targetPath = resolveOutputPath(output_path, filename)
        mkdirSync(dirname(targetPath), { recursive: true })
        const buffer = Buffer.from(await res.arrayBuffer())
        writeFileSync(targetPath, buffer)
        return ok({ saved_to: targetPath, size_bytes: buffer.length, format: "pdf" })
      }

      const text = await res.text()
      if (output_path) {
        const targetPath = resolveOutputPath(output_path, filename)
        mkdirSync(dirname(targetPath), { recursive: true })
        writeFileSync(targetPath, text)
        return ok({ saved_to: targetPath, size_bytes: text.length, format })
      }
      return ok({ format, content: text })
    } catch (e) {
      return errResp(`export_pain_card failed: ${e.message}`)
    }
  }
)

await server.connect(new StdioServerTransport())
