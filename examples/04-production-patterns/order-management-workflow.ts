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
