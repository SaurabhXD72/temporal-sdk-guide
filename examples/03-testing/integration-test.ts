import { Client } from '@temporalio/client';
import { orderProcessingWorkflow, OrderRequest } from '../02-error-handling/order-processing-workflow';

/**
 * Integration test that runs against real Temporal server
 * Demonstrates end-to-end testing approach
 */
async function runIntegrationTest() {
  console.log('🧪 Running integration test...');
  
  const client = new Client();
  
  const testOrder: OrderRequest = {
    orderId: `integration-test-${Date.now()}`,
    customerId: 'integration-customer',
    items: [{ productId: 'integration-product', quantity: 1 }],
    paymentMethod: 'integration-card'
  };

  try {
    const handle = await client.workflow.start(orderProcessingWorkflow, {
      taskQueue: 'order-processing',
      workflowId: `integration-${Date.now()}`,
      args: [testOrder],
    });

    console.log('⏱️  Waiting for workflow completion...');
    const result = await handle.result();
    
    console.log('✅ Integration test passed:', result);
    
    // Verify workflow history
    const history = handle.fetchHistory();
    console.log('📊 Workflow completed with history events');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runIntegrationTest()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { runIntegrationTest };
