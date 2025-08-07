import { Client } from '@temporalio/client';
import { orderProcessingWorkflow, OrderRequest } from './order-processing-workflow';

async function runOrderTest() {
  const client = new Client();

  const successOrder: OrderRequest = {
    orderId: `order-${Date.now()}`,
    customerId: 'cust-123',
    items: [
      { productId: 'prod-1', quantity: 2 },
      { productId: 'prod-2', quantity: 1 }
    ],
    paymentMethod: 'credit-card'
  };

  console.log('🧪 Testing successful order processing...');
  
  try {
    const handle = await client.workflow.start(orderProcessingWorkflow, {
      taskQueue: 'order-processing',
      workflowId: `order-test-${Date.now()}`,
      args: [successOrder],
    });

    console.log(`🚀 Started workflow ${handle.workflowId}`);
    
    // Add timeout protection
    const result = await Promise.race([
      handle.result(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Workflow timeout after 30s')), 30000)
      )
    ]);
    
    console.log(`✅ Success: ${result}`);
  } catch (error) {
    console.log(`❌ Failed: ${error}`);
  }

  // Exit the process after first test
  process.exit(0);
}

runOrderTest().catch(console.error);
