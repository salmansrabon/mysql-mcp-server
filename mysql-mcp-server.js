#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import mysql from "mysql2/promise";
import { createServer } from 'http';

// Setup MySQL base config
const baseConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "123",
};

// Map to store pools for different databases
const pools = new Map();

// Function to get or create a pool for a specific database
function getPool(database) {
  if (!pools.has(database)) {
    pools.set(database, mysql.createPool({ ...baseConfig, database }));
  }
  return pools.get(database);
}

// Create MCP server
const server = new McpServer({
  name: "mysql-mcp",
  version: "0.1.0",
  capabilities: {
    tools: {}, // tools will be registered below
    resources: {},
  },
});

// Tool: List all databases
server.tool(
  "listDatabases",
  {
    description: "List all available databases on the MySQL server",
    inputSchema: z.object({}),
  },
  async () => {
    // Use a temporary connection without specifying database
    const tempPool = mysql.createPool(baseConfig);
    try {
      const [rows] = await tempPool.query("SHOW DATABASES");
      return { content: [{ type: "json", data: rows }] };
    } finally {
      await tempPool.end();
    }
  }
);

// Tool: Run a SQL query
server.tool(
  "query",
  {
    description: "Run a SQL query on the MySQL database",
    inputSchema: z.object({
      sql: z.string().describe("SQL query to execute"),
      database: z.string().describe("The database name to run the query on"),
    }),
  },
  async ({ sql, database }) => {
    const pool = getPool(database);
    const [rows] = await pool.query(sql);
    return { content: [{ type: "json", data: rows }] };
  }
);

// Tool: List all tables
server.tool(
  "listTables",
  {
    description: "List all tables in the database",
    inputSchema: z.object({
      database: z.string().describe("The database name to list tables from"),
    }),
  },
  async ({ database }) => {
    const pool = getPool(database);
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
      database: z.string().describe("The database name where the table is located"),
    }),
  },
  async ({ table, database }) => {
    const pool = getPool(database);
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
