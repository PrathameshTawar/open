import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { loadConfig } from './config.js';
import { AgentTaskStore } from './agentTaskStore.js';
import { ToolExecutionStore } from './toolExecutionStore.js';
import { WorkspaceChangeStore } from './changeStore.js';
import { WorkspaceWatcher } from './workspaceWatcher.js';
import { createWorkspaceTools } from './workspaceTools.js';
function jsonText(value) {
    return JSON.stringify(value, null, 2);
}
export function createOpenClawMcpServer(opts = {}) {
    const cfg = opts.cfg ?? loadConfig();
    const changes = opts.changes ?? new WorkspaceChangeStore();
    const agentTasks = opts.agentTasks ?? new AgentTaskStore();
    const toolExecutions = opts.toolExecutions ?? new ToolExecutionStore();
    const workspaceTools = createWorkspaceTools({ cfg, agentTasks, toolExecutions, changes });
    const watcher = new WorkspaceWatcher({ cfg, changes });
    const server = new McpServer({
        name: 'openclaw-reader',
        version: '0.1.0'
    });
    server.registerTool('list_projects', {
        description: 'List the configured workspace roots for OpenClaw reader.',
        inputSchema: z.object({}).strict()
    }, async () => ({
        content: [{ type: 'text', text: jsonText(workspaceTools.listProjects()) }]
    }));
    server.registerTool('get_project_tree', {
        description: 'Read the project tree for a specific root.',
        inputSchema: {
            root: z.string().min(1)
        }
    }, async ({ root }) => ({
        content: [{ type: 'text', text: jsonText(await workspaceTools.getWorkspaceTree(root)) }]
    }));
    server.registerTool('read_file', {
        description: 'Safely read a workspace file inside the allowed roots.',
        inputSchema: {
            filePath: z.string().min(1)
        }
    }, async ({ filePath }) => ({
        content: [{ type: 'text', text: jsonText(await workspaceTools.readWorkspaceFile(filePath)) }]
    }));
    server.registerTool('search_code', {
        description: 'Search the workspace for text matches.',
        inputSchema: {
            query: z.string().min(1),
            limit: z.coerce.number().int().positive().max(100).optional()
        }
    }, async ({ query, limit }) => {
        const result = await workspaceTools.searchWorkspaceCode(query);
        if (limit && result && 'ok' in result && result.ok) {
            result.results = result.results.slice(0, limit);
        }
        return {
            content: [{ type: 'text', text: jsonText(result) }]
        };
    });
    server.registerTool('get_recent_changes', {
        description: 'Return the most recent workspace change records.',
        inputSchema: {
            limit: z.coerce.number().int().positive().max(100).optional()
        }
    }, async ({ limit }) => ({
        content: [{ type: 'text', text: jsonText(workspaceTools.getRecentWorkspaceChanges(limit ?? 10)) }]
    }));
    server.registerTool('get_recent_tool_executions', {
        description: 'Return the most recent tracked tool execution records.',
        inputSchema: {
            limit: z.coerce.number().int().positive().max(100).optional()
        }
    }, async ({ limit }) => ({
        content: [{ type: 'text', text: jsonText(workspaceTools.getRecentToolExecutions(limit ?? 10)) }]
    }));
    server.registerTool('get_recent_agent_tasks', {
        description: 'Return recent agent task records.',
        inputSchema: {
            limit: z.coerce.number().int().positive().max(100).optional()
        }
    }, async ({ limit }) => ({
        content: [{ type: 'text', text: jsonText(workspaceTools.getRecentAgentTasks(limit ?? 10)) }]
    }));
    server.registerTool('get_latest_git_diff', {
        description: 'Return the current git diff for the primary workspace root when available.',
        inputSchema: z.object({}).strict()
    }, async () => ({
        content: [{ type: 'text', text: jsonText(await workspaceTools.getLatestWorkspaceDiff()) }]
    }));
    server.registerTool('get_workspace_summary', {
        description: 'Return a consolidated workspace summary including recent changes, tool executions, agent tasks, artifacts, and git metadata.',
        inputSchema: z.object({}).strict()
    }, async () => ({
        content: [{ type: 'text', text: jsonText(await workspaceTools.getWorkspaceSummary()) }]
    }));
    server.registerTool('get_recent_artifacts', {
        description: 'Return locally discovered OpenClaw-related artifacts.',
        inputSchema: {
            limit: z.coerce.number().int().positive().max(100).optional()
        }
    }, async ({ limit }) => ({
        content: [{ type: 'text', text: jsonText(await workspaceTools.getRecentArtifacts(limit ?? 10)) }]
    }));
    return {
        server,
        start: async () => {
            await watcher.start();
            const transport = new StdioServerTransport();
            await server.connect(transport);
        },
        stop: async () => {
            await watcher.stop();
            await server.close();
        }
    };
}
async function main() {
    const openClaw = createOpenClawMcpServer();
    await openClaw.start();
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
