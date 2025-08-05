import { Client } from '@temporalio/client';
import { helloWorkflow } from './workflows/hello-workflow';

async function run() {
  // Connect to Temporal server
  const client = new Client();

  // Execute workflow
  const handle = await client.workflow.start(helloWorkflow, {
    taskQueue: 'hello-world',
    workflowId: `hello-world-${Date.now()}`,
    args: ['Temporal Developer'],
  });

  console.log(`🎯 Started workflow ${handle.workflowId}`);

  // Wait for result
  const result = await handle.result();
  console.log(`✅ Result: ${result}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
