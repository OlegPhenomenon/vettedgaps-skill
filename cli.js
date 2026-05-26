#!/usr/bin/env node
const subcommand = process.argv[2]

if (subcommand === "mcp") {
  await import("./mcp-server.js")
} else {
  const { runInstaller } = await import("./installer.js")
  await runInstaller(process.argv.slice(2))
}
