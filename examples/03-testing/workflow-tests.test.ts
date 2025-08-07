import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { orderProcessingWorkflow, OrderRequest } from '../02-error-handling/order-processing-workflow';
import * as activities from '../02-error-handling/order-activities';

/**
 * Unit tests for order processing workflow
 * Demonstrates Temporal's time-skipping and mocking capabilities
 */
describe('Order Processing Workflow', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    // Create test environment with time skipping
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('should process successful order', async () => {
    const { client, nativeConnection } = testEnv;
    
    // Create worker for testing
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test-queue',
      workflowsPath: require.resolve('../02-error-handling/order-processing-workflow'),
      activities,
    });

    const testOrder: OrderRequest = {
      orderId: 'test-order-123',
      customerId: 'test-customer',
      items: [{ productId: 'test-product', quantity: 1 }],
      paymentMethod: 'test-card'
    };

    // Execute workflow in test environment
    await worker.runUntil(async () => {
      const handle = await client.workflow.start(orderProcessingWorkflow, {
        taskQueue: 'test-queue',
        workflowId: 'test-successful-order',
        args: [testOrder],
      });

      const result = await handle.result();
      expect(result).toBe('Order test-order-123 processed successfully');
    });
  });

  it('should handle payment failure with compensation', async () => {
    const { client, nativeConnection } = testEnv;
    
    // Mock activities to force payment failure
    const mockActivities = {
      ...activities,
      validatePayment: jest.fn().mockRejectedValue(new Error('Payment failed')),
      sendNotification: jest.fn().mockResolvedValue(undefined),
    };

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test-queue',
      workflowsPath: require.resolve('../02-error-handling/order-processing-workflow'),
      activities: mockActivities,
    });

    const testOrder: OrderRequest = {
      orderId: 'test-order-456',
      customerId: 'test-customer',
      items: [{ productId: 'test-product', quantity: 1 }],
      paymentMethod: 'invalid-card'
    };

    await worker.runUntil(async () => {
      const handle = await client.workflow.start(orderProcessingWorkflow, {
        taskQueue: 'test-queue',
        workflowId: 'test-payment-failure',
        args: [testOrder],
      });

      // Expect workflow to fail
      await expect(handle.result()).rejects.toThrow('Payment failed');
      
      // Verify compensation notification was sent
      expect(mockActivities.sendNotification).toHaveBeenCalledWith(
        'test-customer',
        'ORDER_FAILED',
        'test-order-456'
      );
    });
  });
});
