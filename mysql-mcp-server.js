#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import mysql from "mysql2/promise";

// ✅ Base MySQL Config
const baseConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "1234",
};

// ✅ Utility: Run query safely (with optional params)
async function runQuery({ sql, database, params = [] }) {
  const pool = mysql.createPool(database ? { ...baseConfig, database } : baseConfig);
  try {
    const [rows] = await pool.query(sql, params);
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  } catch (err) {
    return { content: [{ type: "text", text: `❌ SQL Error: ${err.message}` }] };
  } finally {
    await pool.end();
  }
}

// ✅ Create MCP Server
const server = new McpServer({
  name: "mysql-mcp",
  version: "0.2.0",
  capabilities: { tools: {}, resources: {} },
});

// ✅ Dynamic tool: executeQuery
server.tool(
  "executeQuery",
  "Run any SQL query dynamically on any MySQL database",
  z.object({
    sql: z.string().describe("The SQL query to execute"),
    database: z.string().optional().describe("Database name (optional, uses default if not set)"),
    params: z.array(z.any()).optional().describe("Optional array of parameters for prepared queries"),
  }),
  async ({ sql, database, params }) => {
    if (!sql) {
      return { content: [{ type: "text", text: "⚠️ Error: SQL query is required." }] };
    }
    return await runQuery({ sql, database, params });
  }
);

// ✅ Graceful shutdown
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`Received ${sig}, shutting down gracefully`);
    process.exit(0);
  });
}

// ✅ Start MCP Server
const transport = new StdioServerTransport();
try {
  await server.connect(transport);
  console.error("🚀 MySQL MCP Server (Dynamic) started successfully with stdio transport");
} catch (err) {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
}
