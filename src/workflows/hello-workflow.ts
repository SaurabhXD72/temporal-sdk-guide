import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/hello-activities';

// Proxy activities with default options
const { sayHello } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

/** A workflow that demonstrates basic Temporal concepts */
export async function helloWorkflow(name: string): Promise<string> {
  const greeting = await sayHello(name);
  return `Workflow completed: ${greeting}`;
}
