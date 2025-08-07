import { proxyActivities, sleep } from '@temporalio/workflow';
 import type * as activities from './order-activities';
// import type * as activities from '../activities/hello-activities';


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

/**
 * Order processing workflow demonstrating error handling and compensation patterns
 */
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
