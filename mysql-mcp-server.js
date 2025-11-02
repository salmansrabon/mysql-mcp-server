#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import mysql from "mysql2/promise";

// Setup MySQL base config
const baseConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "1234",
};


// Create MCP server
const server = new McpServer({
  name: "mysql-mcp",
  version: "0.1.0",
  capabilities: {
    tools: {},
    resources: {},
  },
});

// Tool: List all databases
server.tool(
  "listDatabases",
  "List all available databases on the MySQL server",
  z.object({}),
  async () => {
    const tempPool = mysql.createPool(baseConfig);
    try {
      const [rows] = await tempPool.query("SHOW DATABASES");
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(rows, null, 2) 
        }] 
      };
    } catch (error) {
      return { 
        content: [{ 
          type: "text", 
          text: `Error: ${error.message}` 
        }] 
      };
    } finally {
      await tempPool.end();
    }
  }
);

// Tool: Get top 5 users from dmoneydb
server.tool(
  "getTop5Users",
  "Get top 5 users from dmoneydb.users table",
  z.object({}),
  async () => {
    const tempPool = mysql.createPool({ ...baseConfig, database: "dmoneydb" });
    try {
      const [rows] = await tempPool.query("SELECT * FROM users LIMIT 5");
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(rows, null, 2) 
        }] 
      };
    } catch (error) {
      return { 
        content: [{ 
          type: "text", 
          text: `Error: ${error.message}` 
        }] 
      };
    } finally {
      await tempPool.end();
    }
  }
);

// Tool: Run a SQL query
server.tool(
  "query",
  "Run a SQL query on the MySQL database",
  z.object({
    sql: z.string().describe("SQL query to execute"),
    database: z.string().describe("The database name to run the query on")
  }),
  async (params) => {
    console.error('Query params received:', JSON.stringify(params));
    
    const sql = params?.sql || params?.query;
    const database = params?.database || params?.db;
    
    if (!sql) {
      return { 
        content: [{ 
          type: "text", 
          text: `Error: SQL query is required. Received params: ${JSON.stringify(params)}` 
        }] 
      };
    }
    
    if (!database) {
      return { 
        content: [{ 
          type: "text", 
          text: `Error: Database name is required. Received params: ${JSON.stringify(params)}` 
        }] 
      };
    }

    const tempPool = mysql.createPool({ ...baseConfig, database });
    try {
      const [rows] = await tempPool.query(sql);
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(rows, null, 2) 
        }] 
      };
    } catch (error) {
      return { 
        content: [{ 
          type: "text", 
          text: `Error: ${error.message}` 
        }] 
      };
    } finally {
      await tempPool.end();
    }
  }
);

// Tool: List all tables
server.tool(
  "listTables",
  "List all tables in the database",
  z.object({
    database: z.string().describe("The database name to list tables from")
  }),
  async ({ database }) => {
    if (!database) {
      return { 
        content: [{ 
          type: "text", 
          text: "Error: Database name is required" 
        }] 
      };
    }

    const tempPool = mysql.createPool({ ...baseConfig, database });
    try {
      const [rows] = await tempPool.query("SHOW TABLES");
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(rows, null, 2) 
        }] 
      };
    } catch (error) {
      return { 
        content: [{ 
          type: "text", 
          text: `Error: ${error.message}` 
        }] 
      };
    } finally {
      await tempPool.end();
    }
  }
);

// Tool: Describe a table
server.tool(
  "describeTable",
  "Describe a table structure (columns, types, etc.)",
  z.object({
    table: z.string().describe("The table name to describe"),
    database: z.string().describe("The database name where the table is located")
  }),
  async ({ table, database }) => {
    if (!table) {
      return { 
        content: [{ 
          type: "text", 
          text: "Error: Table name is required" 
        }] 
      };
    }
    
    if (!database) {
      return { 
        content: [{ 
          type: "text", 
          text: "Error: Database name is required" 
        }] 
      };
    }

    const tempPool = mysql.createPool({ ...baseConfig, database });
    try {
      const [rows] = await tempPool.query(`DESCRIBE \`${table}\``);
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(rows, null, 2) 
        }] 
      };
    } catch (error) {
      return { 
        content: [{ 
          type: "text", 
          text: `Error: ${error.message}` 
        }] 
      };
    } finally {
      await tempPool.end();
    }
  }
);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Run with stdio transport for MCP client usage
const transport = new StdioServerTransport();

try {
  await server.connect(transport);
  console.error('MySQL MCP Server started successfully with stdio transport');
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}
