# Testing Strategies

Testing Temporal workflows requires special techniques since workflows are deterministic and stateful. This guide shows you how to test activities, workflows, and end-to-end scenarios using your repository examples.

### Testing Philosophy <a href="#testing-philosophy" id="testing-philosophy"></a>

Temporal applications have three main testing layers:

1. **Unit Tests** - Test individual activities and workflow logic
2. **Integration Tests** - Test workflows with real Temporal server
3. **End-to-End Tests** - Test complete business scenarios

### Workflow Unit Testing <a href="#workflow-unit-testing" id="workflow-unit-testing"></a>

The repository includes comprehensive workflow tests using Temporal's testing framework:

{% code title="examples/03-testing/integration-test.ts" overflow="wrap" %}
```typescript
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

```
{% endcode %}



### Test Configuration <a href="#test-configuration" id="test-configuration"></a>

The repository includes Jest configuration optimized for Temporal testing:

{% code title="jest.config.ts" overflow="wrap" %}
```typescript
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/*.(test|spec).ts'],
    // testMatch: ['**/?(*.)+(test|spec|workflow-tests).ts'],

    collectCoverageFrom: [
      'src/**/*.ts',
      'examples/**/*.ts',
      '!**/*.d.ts',
    ],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    testTimeout: 30000,
  };
  
```
{% endcode %}

### Running the Tests <a href="#running-the-tests" id="running-the-tests"></a>

The repository includes comprehensive test scripts:

{% code overflow="wrap" %}
```bash
# Run all tests
npm test

# Run tests with coverage reporting
npm run test:coverage

# Run tests in watch mode for development
npm run test:watch

# Run integration tests against real server
npm run test:integration
```
{% endcode %}

### Key Testing Patterns Demonstrated <a href="#key-testing-patterns-demonstrated" id="key-testing-patterns-demonstrated"></a>

### 1. Time-Skipping Environment

{% code overflow="wrap" %}
```typescript
// Create test environment that can skip time
testEnv = await TestWorkflowEnvironment.createTimeSkipping();
```
{% endcode %}

This allows tests to complete instantly even if workflows contain delays.

### 2. Activity Mocking

{% code overflow="wrap" %}
```typescript
// Mock specific activities to test error scenarios
const mockActivities = {
  ...activities,
  validatePayment: jest.fn().mockRejectedValue(new Error('Payment failed')),
};
```
{% endcode %}

### 3. Compensation Verification

{% code overflow="wrap" %}
```typescript
// Verify compensation activities were called
expect(mockActivities.sendNotification).toHaveBeenCalledWith(
  'test-customer',
  'ORDER_FAILED',
  'test-order-456'
);
```
{% endcode %}

### 4. Integration Test Structure

{% code overflow="wrap" %}
```typescript
// Test against real Temporal server
const client = new Client();
const handle = await client.workflow.start(orderProcessingWorkflow, {
  taskQueue: 'order-processing',
  workflowId: `integration-${Date.now()}`,
  args: [testOrder],
});
```
{% endcode %}

### Testing Benefits <a href="#testing-benefits" id="testing-benefits"></a>

* **Fast execution** - Time-skipping eliminates real delays
* **Deterministic results** - Same outcome every run
* **Error scenario coverage** - Test both success and failure paths
* **Integration confidence** - End-to-end validation against real server

### Best Practices Demonstrated <a href="#best-practices-demonstrated" id="best-practices-demonstrated"></a>

1. **Separate unit and integration tests** for different validation levels
2. **Mock external dependencies** to isolate workflow logic
3. **Test compensation logic** to ensure proper error handling
4. **Use descriptive test names** that explain the scenario being tested

Ready to learn production deployment patterns? Let's explore signals, queries, and monitoring!
