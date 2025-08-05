import { Worker } from '@temporalio/worker';
import * as activities from './activities/hello-activities';

async function run() {
  // Create a Worker that polls the 'hello-world' task queue
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows/hello-workflow.ts'),
    activities,
    taskQueue: 'hello-world',
  });

  console.log('🚀 Worker is running and polling for tasks...');
  
  // Start accepting tasks on the `hello-world` queue
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
