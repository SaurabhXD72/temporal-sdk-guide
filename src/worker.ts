import { Worker } from '@temporalio/worker';
import * as helloActivities from './activities/hello-activities';
import * as orderActivities from '../examples/02-error-handling/order-activities';
import * as managementActivities from '../examples/04-production-patterns/management-activities';

async function run() {
  // Original hello-world worker
  const helloWorker = await Worker.create({
    workflowsPath: require.resolve('./workflows/hello-workflow.ts'),
    activities: helloActivities,
    taskQueue: 'hello-world',
  });

  // Order processing worker
  const orderWorker = await Worker.create({
    workflowsPath: require.resolve('../examples/02-error-handling/order-processing-workflow.ts'),
    activities: orderActivities,
    taskQueue: 'order-processing',
  });

  // Production patterns worker (NEW)
  const managementWorker = await Worker.create({
    workflowsPath: require.resolve('../examples/04-production-patterns/order-management-workflow.ts'),
    activities: managementActivities,
    taskQueue: 'order-management',
  });

  console.log('🚀 Workers are running...');
  console.log('📋 Task queues: hello-world, order-processing, order-management');
  
  // Run all workers concurrently
  await Promise.all([
    helloWorker.run(),
    orderWorker.run(),
    managementWorker.run(),
  ]);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
