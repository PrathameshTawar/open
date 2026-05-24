import { loadConfig } from './config';
import { createWorkspaceTools } from './workspaceTools';
import { AgentTaskStore } from './agentTaskStore';
import { ToolExecutionStore } from './toolExecutionStore';

async function main() {
  const cfg = loadConfig(process.argv[2]);
  const agentTasks = new AgentTaskStore();
  const toolExecutions = new ToolExecutionStore();

  const tools = createWorkspaceTools({ cfg, agentTasks, toolExecutions });
  const root = cfg.allowedRoots[0] ?? process.cwd();

  console.log(JSON.stringify({
    allowedRoots: tools.listProjects(),
    tree: await tools.getWorkspaceTree(root),
    latestGitDiff: await tools.getLatestWorkspaceDiff(),
    searchOpenclaw: await tools.searchWorkspaceCode('openclaw')
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

