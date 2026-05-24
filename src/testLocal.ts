import { loadConfig } from './config.js';
import { AgentTaskStore } from './agentTaskStore.js';
import { ToolExecutionStore } from './toolExecutionStore.js';
import { WorkspaceChangeStore } from './changeStore.js';
import { createWorkspaceTools } from './workspaceTools.js';

async function main() {
  const cfgPath = process.argv[2];
  const cfg = loadConfig(cfgPath);

  const agentTasks = new AgentTaskStore();
  const toolExecutions = new ToolExecutionStore();
  const changes = new WorkspaceChangeStore();

  const tools = createWorkspaceTools({ cfg, agentTasks, toolExecutions, changes });

  const root = cfg.allowedRoots[0] ?? process.cwd();

  console.log(JSON.stringify({
    allowedRoots: tools.listProjects(),
    workspaceTree: await tools.getWorkspaceTree(root),
    searchOpenclaw: await tools.searchWorkspaceCode('openclaw'),
    recentChanges: tools.getRecentWorkspaceChanges(5),
    recentToolExecutions: tools.getRecentToolExecutions(5),
    recentAgentTasks: tools.getRecentAgentTasks(5),
    recentArtifacts: await tools.getRecentArtifacts(5),
    latestGitDiff: await tools.getLatestWorkspaceDiff(),
    workspaceSummary: await tools.getWorkspaceSummary()
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

