import { Client } from '@temporalio/client';
import { 
  orderManagementWorkflow, 
  cancelOrderSignal, 
  updateOrderSignal,
  getOrderStatusQuery,
  getOrderUpdatesQuery 
} from './order-management-workflow';

async function demonstrateSignalsAndQueries() {
  const client = new Client();

  const testOrder = {
    orderId: `signal-demo-${Date.now()}`,
    customerId: 'demo-customer-123',
    items: [
      { id: 'product-1', quantity: 2 },
      { id: 'product-2', quantity: 1 }
    ]
  };

  console.log('🚀 Starting order management workflow...');

  // Start the workflow
  const handle = await client.workflow.start(orderManagementWorkflow, {
    taskQueue: 'order-management',
    workflowId: `order-mgmt-${Date.now()}`,
    args: [testOrder],
  });

  console.log(`📋 Workflow started: ${handle.workflowId}`);

  // Query initial status
  await sleep(500);
  let status = await handle.query(getOrderStatusQuery);
  console.log(`📊 Initial status: ${status}`);

  // Wait a bit, then query status during processing
  await sleep(1000);
  status = await handle.query(getOrderStatusQuery);
  const updates = await handle.query(getOrderUpdatesQuery);
  console.log(`📊 Current status: ${status}`);
  console.log(`📝 Updates so far:`, updates);

  // Send an update signal
  await handle.signal(updateOrderSignal, 'priority', 'HIGH');
  console.log('📡 Sent update signal: priority = HIGH');

  // Demonstrate cancellation (uncomment to test cancellation)
  // await sleep(2000);
  // await handle.signal(cancelOrderSignal, 'Customer requested cancellation');
  // console.log('📡 Sent cancellation signal');

  // Wait for completion and get final status
  try {
    const result = await handle.result();
    console.log(`✅ Final result: ${result}`);

    const finalUpdates = await handle.query(getOrderUpdatesQuery);
    console.log(`📝 Final updates:`, finalUpdates);
  } catch (error) {
    console.log(`❌ Workflow failed: ${error}`);
  }
}

// Helper function for delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

demonstrateSignalsAndQueries().catch(console.error);
