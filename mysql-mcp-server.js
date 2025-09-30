#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import mysql from "mysql2/promise";
import { createServer } from 'http';

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

// Determine if running in container (Docker) or as CLI tool
const isContainer = process.env.CONTAINER_MODE === 'true' || process.argv.includes('--container');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

if (isContainer) {
  // Run as HTTP server for containerized deployment
  const port = process.env.PORT || 5000;
  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', service: 'mysql-mcp-server' }));
      return;
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      service: 'MySQL MCP Server', 
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/health'
      }
    }));
  });

  httpServer.listen(port, () => {
    console.log(`MySQL MCP Server started successfully on port ${port}`);
    console.log('Health check available at /health');
  });

  // Keep the process alive
  setInterval(() => {
    console.log('MySQL MCP Server is running...');
  }, 30000);

} else {
  // Run with stdio transport for MCP client usage
  const transport = new StdioServerTransport();
  
  try {
    await server.connect(transport);
    console.log('MySQL MCP Server started successfully with stdio transport');
    
    // Keep the process alive for stdio mode
    process.stdin.resume();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
