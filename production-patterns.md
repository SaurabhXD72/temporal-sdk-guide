# Production Patterns

Enable real-time communication between your workflows and external systems using signals and queries. This page demonstrates advanced Temporal patterns using signals, queries, and production-ready configurations from the repository.

### Signals and Queries Overview <a href="#signals-and-queries-overview" id="signals-and-queries-overview"></a>

Production systems need:

* **Dynamic updates** during execution (order cancellations, priority changes)
* **Status monitoring** for dashboards and APIs
* **External event handling** (user actions, system events)

Send data to workflows with signals and read workflow state with queries in real-time.

### Order Management with Real-Time Updates <a href="#order-management-with-real-time-updates" id="order-management-with-real-time-updates"></a>

The repository implements a complete order management system with signals and queries:

{% code title="examples/04-production-patterns/order-management-workflow.ts" overflow="wrap" %}
```typescript
import { defineSignal, defineQuery, setHandler, condition, proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from './management-activities';

// Define external communication interfaces
export const cancelOrderSignal = defineSignal<[string]>('cancelOrder');
export const updateOrderSignal = defineSignal<[string, any]>('updateOrder');
export const getOrderStatusQuery = defineQuery<string>('getOrderStatus');
export const getOrderUpdatesQuery = defineQuery<string[]>('getOrderUpdates');

// Configure activities
const { 
  processPayment, 
  fulfillOrder, 
  cancelOrder, 
  sendOrderNotification 
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3 }
});

interface Order {
  orderId: string;
  status: 'PENDING' | 'PROCESSING' | 'FULFILLED' | 'CANCELLED';
  customerId: string;
  items: Array<{ id: string; quantity: number }>;
  updates: string[];
}

/**
 * Production-ready order management workflow with signals and queries
 * Demonstrates real-time communication patterns
 */
export async function orderManagementWorkflow(initialOrder: Omit<Order, 'status' | 'updates'>): Promise<string> {
  // Initialize order state
  let order: Order = {
    ...initialOrder,
    status: 'PENDING',
    updates: ['Order created']
  };

  let shouldCancel = false;
  let cancellationReason = '';

  // Handle cancel signal
  setHandler(cancelOrderSignal, (reason: string) => {
    if (order.status !== 'FULFILLED') {
      shouldCancel = true;
      cancellationReason = reason;
      order.updates.push(`Cancellation requested: ${reason}`);
    }
  });

  // Handle update signal
  setHandler(updateOrderSignal, (field: string, value: any) => {
    order.updates.push(`Updated ${field} to ${value}`);
  });

  // Handle status query
  setHandler(getOrderStatusQuery, () => order.status);

  // Handle updates query
  setHandler(getOrderUpdatesQuery, () => order.updates);

  try {
    // Step 1: Payment processing
    order.status = 'PROCESSING';
    order.updates.push('Processing payment...');

    // Check for cancellation before each major step
    if (shouldCancel) {
      await cancelOrder(order.orderId, cancellationReason);
      order.status = 'CANCELLED';
      return `Order ${order.orderId} cancelled: ${cancellationReason}`;
    }

    await processPayment(order.orderId, order.customerId);
    order.updates.push('Payment processed successfully');

    // Step 2: Fulfillment (with cancellation check)
    order.updates.push('Starting fulfillment...');
    
    // Wait for fulfillment or cancellation (whichever comes first)
    const fulfillmentPromise = fulfillOrder(order.orderId, order.items);
    const cancellationPromise = condition(() => shouldCancel);

    await Promise.race([fulfillmentPromise, cancellationPromise]);

    if (shouldCancel) {
      await cancelOrder(order.orderId, cancellationReason);
      order.status = 'CANCELLED';
      await sendOrderNotification(order.customerId, 'Order cancelled', order.orderId);
      return `Order ${order.orderId} cancelled during fulfillment: ${cancellationReason}`;
    }

    // Wait for fulfillment to complete if not cancelled
    await fulfillmentPromise;

    // Success path
    order.status = 'FULFILLED';
    order.updates.push('Order fulfilled successfully');
    
    await sendOrderNotification(order.customerId, 'Order completed', order.orderId);
    
    return `Order ${order.orderId} completed successfully`;

  } catch (error) {
    order.status = 'CANCELLED';
    order.updates.push(`Error: ${error}`);
    await sendOrderNotification(order.customerId, 'Order failed', order.orderId);
    throw error;
  }
}

```
{% endcode %}

### Implement Production Activities <a href="#production-activities-implementation" id="production-activities-implementation"></a>

The repository includes production-ready activities that handle the actual business operations:

{% code title="examples/04-production-patterns/management-activities.ts" overflow="wrap" %}
```typescript


export async function processPayment(orderId: string, customerId: string): Promise<void> {
    console.log(`💳 Processing payment for order ${orderId}, customer ${customerId}`);
    
    // Simulate payment processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate occasional payment failures (5% chance)
    if (Math.random() < 0.05) {
      throw new Error(`Payment failed for order ${orderId}`);
    }
    
    console.log(`✅ Payment processed successfully for order ${orderId}`);
  }
  
  export async function fulfillOrder(
    orderId: string, 
    items: Array<{ id: string; quantity: number }>
  ): Promise<void> {
    console.log(`📦 Fulfilling order ${orderId} with ${items.length} items`);
    
    // Simulate fulfillment processing (longer operation)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log(`✅ Order ${orderId} fulfilled successfully`);
  }
  
  export async function cancelOrder(orderId: string, reason: string): Promise<void> {
    console.log(`❌ Cancelling order ${orderId}. Reason: ${reason}`);
    
    // Simulate cancellation cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`✅ Order ${orderId} cancelled successfully`);
  }
  
  export async function sendOrderNotification(
    customerId: string, 
    message: string, 
    orderId: string
  ): Promise<void> {
    console.log(`📧 Sending notification to customer ${customerId}: ${message} (Order: ${orderId})`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`✅ Notification sent successfully`);
  }
  
```
{% endcode %}

### Client Interaction Patterns <a href="#client-interaction-patterns" id="client-interaction-patterns"></a>

The repository demonstrates how external systems interact with workflows using signals and queries:

{% code title="examples/04-production-patterns/signal-query-client.ts" overflow="wrap" %}
```typescript
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
```
{% endcode %}

### Configure Workers for Multiple Task Queues <a href="#production-worker-configuration" id="production-worker-configuration"></a>

The repository includes production-ready worker setup:

{% code title="src/worker.ts " overflow="wrap" %}
```typescript

import { Worker } from '@temporalio/worker';
import * as helloActivities from './activities/hello-activities';
import * as orderActivities from '../examples/02-error-handling/order-activities';
import * as managementActivities from '../examples/04-production-patterns/management-activities';

async function run() {
  // Original hello-world worker
  const helloWorker = await Worker.create({
    workflowsPath: require.resolve('./workflows/hello-workflow'),
    activities: helloActivities,
    taskQueue: 'hello-world',
  });

  // Order processing worker
  const orderWorker = await Worker.create({
    workflowsPath: require.resolve('../examples/02-error-handling/order-processing-workflow'),
    activities: orderActivities,
    taskQueue: 'order-processing',
  });

  // Production patterns worker (NEW)
  const managementWorker = await Worker.create({
    workflowsPath: require.resolve('../examples/04-production-patterns/order-management-workflow'),
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
```
{% endcode %}

### Running the Production Example <a href="#running-the-production-example" id="running-the-production-example"></a>

Test the signals and queries implementation:

{% code overflow="wrap" %}
```bash
# Start the multi-queue worker
npm run start:worker

# In another terminal, run the signals/queries demo
npx ts-node examples/04-production-patterns/signal-query-client.ts
```
{% endcode %}

### Expected Output <a href="#expected-output" id="expected-output"></a>

**Successful execution with real-time updates:**

```
text🚀 Starting order management workflow...
📋 Workflow started: order-mgmt-1697123456789
📊 Initial status: PENDING
💳 Processing payment for order signal-demo-1697123456789, customer demo-customer-123
📊 Current status: PROCESSING
📝 Updates so far: [
  'Order created',
  'Processing payment...'
]
📡 Sent update signal: priority = HIGH
✅ Payment processed successfully for order signal-demo-1697123456789
📦 Fulfilling order signal-demo-1697123456789 with 2 items
✅ Order signal-demo-1697123456789 fulfilled successfully
📧 Sending notification to customer demo-customer-123: Order completed (Order: signal-demo-1697123456789)
✅ Notification sent successfully
✅ Final result: Order signal-demo-1697123456789 completed successfully
📝 Final updates: [
  'Order created',
  'Processing payment...',
  'Payment processed successfully',
  'Updated priority to HIGH',
  'Starting fulfillment...',
  'Order fulfilled successfully'
]
```

### Production Patterns <a href="#key-production-patterns-demonstrated" id="key-production-patterns-demonstrated"></a>

### 1. Signal Handling

{% code overflow="wrap" %}
```typescript
// Define and handle external signals
const cancelOrderSignal = defineSignal<[string]>('cancelOrder');
setHandler(cancelOrderSignal, (reason: string) => {
  shouldCancel = true;
  cancellationReason = reason;
});
```
{% endcode %}

### 2. Query Implementation

{% code overflow="wrap" %}
```typescript
// Provide real-time state access
const getOrderStatusQuery = defineQuery<string>('getOrderStatus');
setHandler(getOrderStatusQuery, () => order.status);
```
{% endcode %}

### 3. Race Conditions

{% code overflow="wrap" %}
```typescript
// Handle competing operations
const fulfillmentPromise = fulfillOrder(order.orderId, order.items);
const cancellationPromise = condition(() => shouldCancel);
await Promise.race([fulfillmentPromise, cancellationPromise]);
```
{% endcode %}

### 4. State Management

{% code overflow="wrap" %}
```typescript
// Track workflow state for external visibility
let order: Order = {
  orderId,
  status: 'PENDING',
  updates: ['Order created']
};
```
{% endcode %}

### Production Benefits <a href="#production-benefits" id="production-benefits"></a>

* **Real-time updates** - cancel orders, change priorities, check status instantly
* **Dynamic workflow control** via signals
* **Live status monitoring** via queries
* **Cancellation support** for long-running operations
* **Audit trails** with update tracking

These patterns enable production systems with human-in-the-loop processes, dynamic business rules, and real-time monitoring capabilities.

### Congratulations :)  <a href="#congratulations" id="congratulations"></a>

You've built a complete Temporal TypeScript system covering:

* **Basic workflow setup** and execution
* **Error handling** with compensation patterns
* **Comprehensive testing** strategies
* **Production patterns** with signals and queries

The implementation showcases enterprise-ready distributed system patterns that can handle complex business processes with reliability and observability.
