# Error Handling & Compensation

```markdown
# Error Handling & Compensation

Real-world applications need robust error handling. This page demonstrates the **Saga pattern** using your order processing example with compensation workflows.

## The Challenge: Distributed Transactions

When building distributed systems, you often need to coordinate multiple services. What happens when one step fails halfway through? The **Saga pattern** provides an elegant solution.

## Saga Pattern Implementation

Your repository demonstrates this with a complete order processing workflow:

```

// From: examples/02-error-handling/workflows/order-saga.ts import \* as workflow from '@temporalio/workflow'; import type \* as activities from '../activities';

const { processPayment, reserveInventory, createShipment, // Compensation activities refundPayment, releaseInventory, cancelShipment, } = workflow.proxyActivities({ startToCloseTimeout: '1 minute', retry: { initialInterval: '1s', backoffCoefficient: 2, maximumAttempts: 3, }, });

export async function orderSagaWorkflow(orderId: string): Promise { const compensations: (() => Promise)\[] = \[];

try { // Step 1: Process payment await processPayment(orderId); compensations.push(() => refundPayment(orderId));

```
// Step 2: Reserve inventory  
await reserveInventory(orderId);
compensations.push(() => releaseInventory(orderId));

// Step 3: Create shipment
await createShipment(orderId);
compensations.push(() => cancelShipment(orderId));

return `Order ${orderId} processed successfully!`;
```

} catch (error) { // Run compensations in reverse order workflow.log.warn('Order processing failed, running compensations', { orderId, error: error.message });

```
for (const compensation of compensations.reverse()) {
  try {
    await compensation();
  } catch (compensationError) {
    workflow.log.error('Compensation failed', { 
      orderId, 
      compensationError: compensationError.message 
    });
  }
}

throw new workflow.ApplicationFailure(
  `Order processing failed: ${error.message}`,
  'ORDER_PROCESSING_FAILED'
);
```

} }

```

## The Activities Implementation

Here are the business logic activities with built-in failure scenarios:

```

// From: examples/02-error-handling/activities/order-activities.ts import { log } from '@temporalio/activity';

export async function processPayment(orderId: string): Promise { log.info('Processing payment', { orderId });

// Simulate payment processing await new Promise(resolve => setTimeout(resolve, 1000));

// Simulate random payment failures (20% chance) if (Math.random() < 0.2) { throw new Error('Payment processing failed - insufficient funds'); }

log.info('Payment processed successfully', { orderId }); }

export async function reserveInventory(orderId: string): Promise { log.info('Reserving inventory', { orderId });

await new Promise(resolve => setTimeout(resolve, 800));

// Simulate inventory issues (15% chance) if (Math.random() < 0.15) { throw new Error('Inventory reservation failed - out of stock'); }

log.info('Inventory reserved', { orderId }); }

export async function createShipment(orderId: string): Promise { log.info('Creating shipment', { orderId });

await new Promise(resolve => setTimeout(resolve, 1200));

// Simulate shipping issues (10% chance) if (Math.random() < 0.1) { throw new Error('Shipment creation failed - carrier unavailable'); }

log.info('Shipment created', { orderId }); }

// Compensation Activities export async function refundPayment(orderId: string): Promise { log.info('COMPENSATION: Refunding payment', { orderId }); await new Promise(resolve => setTimeout(resolve, 500)); log.info('Payment refunded', { orderId }); }

export async function releaseInventory(orderId: string): Promise { log.info('COMPENSATION: Releasing inventory', { orderId }); await new Promise(resolve => setTimeout(resolve, 300)); log.info('Inventory released', { orderId }); }

export async function cancelShipment(orderId: string): Promise { log.info('COMPENSATION: Cancelling shipment', { orderId }); await new Promise(resolve => setTimeout(resolve, 400)); log.info('Shipment cancelled', { orderId }); }

```

## Testing Error Scenarios

Run your saga with built-in failure simulation:

```

## Start the worker

npm run start:saga-worker

## In another terminal, trigger the saga

npm run start:saga-client

```

## Key Error Handling Patterns

### 1. **Retry Policies**
```

retry: { initialInterval: '1s', backoffCoefficient: 2, maximumAttempts: 3, }

```

### 2. **Compensation Tracking**
- Build a list of compensations as you progress
- Execute compensations in **reverse order** on failure
- Handle compensation failures gracefully

### 3. **Structured Error Handling**
```

throw new workflow.ApplicationFailure( 'Descriptive error message', 'ERROR\_TYPE\_CODE' );

```

## Observability in Action

When failures occur, you'll see clear compensation logs:

```

INFO: Processing payment { orderId: 'ORD-123' } INFO: Payment processed successfully { orderId: 'ORD-123' } INFO: Reserving inventory { orderId: 'ORD-123' } ERROR: Inventory reservation failed - out of stock WARN: Order processing failed, running compensations { orderId: 'ORD-123' } INFO: COMPENSATION: Refunding payment { orderId: 'ORD-123' } INFO: Payment refunded { orderId: 'ORD-123' }

```

## Why This Approach Works

- ✅ **Automatic retries** for transient failures
- ✅ **Consistent state** through compensations  
- ✅ **Clear error tracking** with structured logging
- ✅ **Business continuity** even when services fail

Ready to learn how to test these complex workflows? Let's dive into testing strategies! →
```
