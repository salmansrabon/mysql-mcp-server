#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import mysql from "mysql2/promise";

// Setup MySQL pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "123",
  database: process.env.MYSQL_DATABASE || "sharebox_db",
});

// Create MCP server
const server = new McpServer({
  name: "mysql-mcp",
  version: "0.1.0",
  capabilities: {
    tools: {}, // tools will be registered below
    resources: {},
  },
});

// Tool: Run a SQL query
server.tool(
  "query",
  {
    description: "Run a SQL query on the MySQL database",
    inputSchema: z.object({
      sql: z.string().describe("SQL query to execute"),
    }),
  },
  async ({ sql }) => {
    const [rows] = await pool.query(sql);
    return { content: [{ type: "json", data: rows }] };
  }
);

// Tool: List all tables
server.tool(
  "listTables",
  {
    description: "List all tables in the database",
    inputSchema: z.object({}),
  },
  async () => {
    const [rows] = await pool.query("SHOW TABLES");
    return { content: [{ type: "json", data: rows }] };
  }
);

// Tool: Describe a table
server.tool(
  "describeTable",
  {
    description: "Describe a table structure (columns, types, etc.)",
    inputSchema: z.object({
      table: z.string().describe("The table name to describe"),
    }),
  },
  async ({ table }) => {
    const [rows] = await pool.query(`DESCRIBE \`${table}\``);
    return { content: [{ type: "json", data: rows }] };
  }
);

// Start server with stdio transport
const transport = new StdioServerTransport();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

try {
  await server.connect(transport);
  console.log('MySQL MCP Server started successfully');
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}

// Keep the process alive
process.stdin.resume();
