# Error Handling & Compensation

Handle Errors with Compensation Patterns

Real-world applications need robust error handling. Learn to implement the Saga pattern - when payment succeeds but shipping fails, your system automatically refunds the customer

### The Business Scenario <a href="#the-business-scenario" id="the-business-scenario"></a>

This repository implements a complete e-commerce order processing system that handles:

1. **Payment Validation** - Check customer payment methods
2. **Inventory Reservation** - Lock items for the order
3. **Shipment Processing** - Arrange delivery
4. **Customer Notifications** - Confirm success or failure

**The Challenge**: If any step fails after others complete, you need automatic **compensation** (rollback) to maintain data consistency.

\
**Implementation of Saga Pattern**

This repository demonstrates this with a complete order processing workflow:

{% code title="examples/02-error-handling/order-processing-workflow.ts" overflow="wrap" %}
```tsx

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './order-activities';

// Configure activity options with retry policies
const { 
  validatePayment, 
  reserveInventory, 
  processShipment,
  sendNotification 
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    maximumInterval: '30s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export interface OrderRequest {
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: string;
}

export async function orderProcessingWorkflow(order: OrderRequest): Promise<string> {
  let inventoryReserved = false;
  let paymentProcessed = false;

  try {
    // Step 1: Validate payment
    console.log(`Processing order ${order.orderId}`);
    await validatePayment(order.customerId, order.paymentMethod);
    paymentProcessed = true;

    // Step 2: Reserve inventory
    await reserveInventory(order.items);
    inventoryReserved = true;

    // Step 3: Process shipment
    await processShipment(order.orderId, order.items);

    // Step 4: Send confirmation
    await sendNotification(order.customerId, 'ORDER_CONFIRMED', order.orderId);

    return `Order ${order.orderId} processed successfully`;

  } catch (error) {
    // Compensation logic - cleanup in reverse order
    console.log(`Order ${order.orderId} failed, starting compensation...`);

    if (inventoryReserved) {
      // Release reserved inventory
      await proxyActivities<typeof activities>({
        startToCloseTimeout: '2 minutes'
      }).releaseInventory(order.items);
    }

    if (paymentProcessed) {
      // Refund payment
      await proxyActivities<typeof activities>({
        startToCloseTimeout: '2 minutes'
      }).refundPayment(order.customerId, order.orderId);
    }

    // Notify customer of failure
    await sendNotification(order.customerId, 'ORDER_FAILED', order.orderId);

    throw error; // Re-throw to mark workflow as failed
  }
}

```
{% endcode %}

### Implement the Activities <a href="#the-activities-implementation" id="the-activities-implementation"></a>

Here are the business logic activities with built-in failure scenarios:

{% code title="examples/02-error-handling/order-activities.ts" overflow="wrap" %}
```typescript

export interface InventoryItem {
  productId: string;
  quantity: number;
}

/**
 * Validates customer payment method
 * Simulates potential payment failures for demonstration
 */
export async function validatePayment(customerId: string, paymentMethod: string): Promise<void> {
  console.log(`Validating payment for customer ${customerId}`);
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Simulate 5% failure rate for demonstration
  if (Math.random() < 0.05) {
    throw new Error(`Payment validation failed for customer ${customerId}`);
  }
  
  console.log(`Payment validated for customer ${customerId}`);
}

/**
 * Reserves inventory for order items
 * Demonstrates retry-able business logic
 */
export async function reserveInventory(items: InventoryItem[]): Promise<void> {
  console.log(`Reserving inventory for ${items.length} items`);
  
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Simulate occasional inventory issues
  if (Math.random() < 0.05) {
    throw new Error('Insufficient inventory available');
  }
  
  console.log('Inventory reserved successfully');
}

/**
 * Processes shipment for the order
 */
export async function processShipment(orderId: string, items: InventoryItem[]): Promise<void> {
  console.log(`Processing shipment for order ${orderId}`);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log(`Shipment processed for order ${orderId}`);
}

/**
 * Compensation activity: releases reserved inventory
 */
export async function releaseInventory(items: InventoryItem[]): Promise<void> {
  console.log(`Releasing reserved inventory for ${items.length} items`);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('Inventory released successfully');
}

/**
 * Compensation activity: refunds customer payment
 */
export async function refundPayment(customerId: string, orderId: string): Promise<void> {
  console.log(`Processing refund for customer ${customerId}, order ${orderId}`);
  
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  console.log(`Refund processed for order ${orderId}`);
}

```
{% endcode %}

### Testing Your Error Handling <a href="#testing-your-error-handling" id="testing-your-error-handling"></a>

This repository includes a test client to demonstrate the saga pattern:

{% code title="examples/02-error-handling/test-client.ts" overflow="wrap" %}
```typescript

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

  console.log('🧪 Testing order processing...');
  
  try {
    const handle = await client.workflow.start(orderProcessingWorkflow, {
      taskQueue: 'order-processing',
      workflowId: `order-test-${Date.now()}`,
      args: [successOrder],
    });

    console.log(`🚀 Started workflow ${handle.workflowId}`);
    
    const result = await handle.result();
    console.log(`✅ Success: ${result}`);
  } catch (error) {
    console.log(`❌ Failed: ${error}`);
  }
}

runOrderTest().catch(console.error);
```
{% endcode %}

### Running Your Implementation <a href="#running-your-implementation" id="running-your-implementation"></a>

Test the error handling and compensation logic:

```bash
# Make sure your worker is running
npm run start:worker

# In another terminal, run the order test
npx ts-node examples/02-error-handling/test-client.ts
```

### Expected Results <a href="#what-youll-observe" id="what-youll-observe"></a>

**Successful Order Processing:**

```
text🧪 Testing order processing...
🚀 Started workflow order-test-1697123456789
Processing order order-1697123456789
Validating payment for customer cust-123
Payment validated for customer cust-123
Reserving inventory for 2 items
Inventory reserved successfully
Processing shipment for order order-1697123456789
Shipment processed for order order-1697123456789
✅ Success: Order order-1697123456789 processed successfully
```

**Failed Order with Compensation:**

```
text🧪 Testing order processing...
🚀 Started workflow order-test-1697123456790
Processing order order-1697123456790
Validating payment for customer cust-123
Payment validated for customer cust-123
Reserving inventory for 2 items
Insufficient inventory available
Order order-1697123456790 failed, starting compensation...
Processing refund for customer cust-123, order order-1697123456790
Refund processed for order order-1697123456790
❌ Failed: Error: Insufficient inventory available
```

### Key Patterns in Your Implementation <a href="#key-patterns-in-your-implementation" id="key-patterns-in-your-implementation"></a>

### 1. State Tracking

```
typescriptlet inventoryReserved = false;
let paymentProcessed = false;
```

Track completion status to know which compensations to run

### 2. Reverse Order Compensation

```
typescript// Compensations run in reverse order
if (inventoryReserved) {
  await releaseInventory(order.items);
}
if (paymentProcessed) {
  await refundPayment(order.customerId, order.orderId);
}
```

### 3. Retry Configuration

This implementation includes sophisticated retry policies:

```
typescriptretry: {
  initialInterval: '1s',      // Start with 1 second delay
  maximumInterval: '30s',     // Max 30 seconds between retries
  backoffCoefficient: 2,      // Double delay each retry
  maximumAttempts: 3,         // Try up to 3 times
}
```

### Why This Implementation Works <a href="#why-this-implementation-works" id="why-this-implementation-works"></a>

* **Automatic retries** for transient failures
* **Consistent state** through compensations
* **Clear error tracking** with console logging
* **Business continuity** even when services fail
* **Production-ready** error handling patterns

This saga pattern handles distributed transactions reliably in production systems.

Ready to learn how to test these complex workflows? Let's dive into testing strategies! --->
