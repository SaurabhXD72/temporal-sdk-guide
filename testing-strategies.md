# Testing Strategies

Testing Temporal workflows requires special techniques since workflows are deterministic and stateful. This guide shows you how to test activities, workflows, and end-to-end scenarios using your repository examples.

### Testing Philosophy <a href="#testing-philosophy" id="testing-philosophy"></a>

Temporal applications have three main testing layers:

1. **Unit Tests** - Test individual activities and workflow logic
2. **Integration Tests** - Test workflows with real Temporal server
3. **End-to-End Tests** - Test complete business scenarios

### Unit Testing Activities <a href="#unit-testing-activities" id="unit-testing-activities"></a>

Activities are the easiest to test since they're just functions:

```typescript
// From: examples/03-testing/tests/activities.test.ts
import { greet, processPayment } from '../activities/order-activities';

describe('Order Activities', () => {
  test('greet returns formatted greeting', async () => {
    const result = await greet('Alice');
    expect(result).toBe('Hello, Alice!');
  });

  test('processPayment handles valid orders', async () => {
    const orderId = 'ORDER-123';
    await expect(processPayment(orderId)).resolves.not.toThrow();
  });

  test('processPayment throws on invalid orders', async () => {
    const invalidOrderId = 'INVALID';
    await expect(processPayment(invalidOrderId)).rejects.toThrow('Invalid order');
  });
});
```

### Testing Workflows with TestWorkflowEnvironment <a href="#testing-workflows-with-testworkflowenvironment" id="testing-workflows-with-testworkflowenvironment"></a>

For workflow testing, use Temporal's test environment:

```typescript
// From: examples/03-testing/tests/workflows.test.ts
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { WorkflowClient } from '@temporalio/client';
import { helloWorkflow } from '../workflows';
import * as activities from '../activities';

describe('Hello Workflow', () => {
  let testEnv: TestWorkflowEnvironment;
  let worker: Worker;
  let client: WorkflowClient;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
    
    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test-queue',
      workflowsPath: require.resolve('../workflows'),
      activities,
    });

    client = testEnv.client;
  });

  afterAll(async () => {
    await worker?.shutdown();
    await testEnv?.teardown();
  });

  test('helloWorkflow executes successfully', async () => {
    const result = await client.execute(helloWorkflow, {
      workflowId: 'test-hello-workflow',
      taskQueue: 'test-queue',
      args: ['World'],
    });

    expect(result).toBe('Hello, World! Goodbye, World!');
  });
});
```

### Mocking Activities in Workflow Tests <a href="#mocking-activities-in-workflow-tests" id="mocking-activities-in-workflow-tests"></a>

Sometimes you want to test workflow logic without running real activities:

```typescript
// From: examples/03-testing/tests/mocked-workflows.test.ts
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { orderSagaWorkflow } from '../workflows/order-saga';

describe('Order Saga with Mocked Activities', () => {
  let testEnv: TestWorkflowEnvironment;
  let worker: Worker;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
    
    // Mock activities
    const mockActivities = {
      processPayment: jest.fn().mockResolvedValue(undefined),
      reserveInventory: jest.fn().mockResolvedValue(undefined),
      createShipment: jest.fn().mockResolvedValue(undefined),
      refundPayment: jest.fn().mockResolvedValue(undefined),
      releaseInventory: jest.fn().mockResolvedValue(undefined),
      cancelShipment: jest.fn().mockResolvedValue(undefined),
    };

    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test-saga-queue',
      workflowsPath: require.resolve('../workflows'),
      activities: mockActivities,
    });
  });

  test('saga completes successfully with valid order', async () => {
    const result = await testEnv.client.execute(orderSagaWorkflow, {
      workflowId: 'test-saga-success',
      taskQueue: 'test-saga-queue',
      args: ['ORDER-123'],
    });

    expect(result).toContain('processed successfully');
  });

  test('saga runs compensations on failure', async () => {
    // Mock inventory failure
    const mockActivities = {
      processPayment: jest.fn().mockResolvedValue(undefined),
      reserveInventory: jest.fn().mockRejectedValue(new Error('Out of stock')),
      refundPayment: jest.fn().mockResolvedValue(undefined),
    };

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: 'test-saga-failure',
      workflowsPath: require.resolve('../workflows'),
      activities: mockActivities,
    });

    await expect(
      testEnv.client.execute(orderSagaWorkflow, {
        workflowId: 'test-saga-failure',
        taskQueue: 'test-saga-failure',
        args: ['ORDER-456'],
      })
    ).rejects.toThrow('Out of stock');

    // Verify compensation was called
    expect(mockActivities.refundPayment).toHaveBeenCalledWith('ORDER-456');
  });
});
```

### Testing Time-Based Workflows <a href="#testing-time-based-workflows" id="testing-time-based-workflows"></a>

Temporal's test environment can skip time for testing timeouts and schedules:

```typescript
// From: examples/03-testing/tests/time-workflows.test.ts
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { delayedWorkflow } from '../workflows/delayed-workflow';

describe('Time-based Workflows', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    // Time-skipping environment for fast testing
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  });

  test('workflow waits for specified duration', async () => {
    const startTime = Date.now();
    
    await testEnv.client.execute(delayedWorkflow, {
      workflowId: 'test-delayed',
      taskQueue: 'test-queue',
      args: ['5 minutes'], // This will complete instantly in tests
    });
    
    const endTime = Date.now();
    
    // Should complete almost instantly due to time skipping
    expect(endTime - startTime).toBeLessThan(1000);
  });
});
```

### Running Your Tests <a href="#running-your-tests" id="running-your-tests"></a>

Your repository includes comprehensive test scripts:

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests  
npm run test:integration

# Watch mode for development
npm run test:watch
```

### Test Configuration <a href="#test-configuration" id="test-configuration"></a>

Jest configuration for Temporal projects:

```javascript
// From: jest.config.js
{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "testMatch": [
    "**/__tests__/**/*.ts",
    "**/?(*.)+(spec|test).ts"
  ],
  "collectCoverageFrom": [
    "src/**/*.ts",
    "examples/**/*.ts",
    "!**/*.d.ts"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

### Key Testing Principles <a href="#key-testing-principles" id="key-testing-principles"></a>

### Test Pyramid Structure

* **Many unit tests** for activities
* **Some integration tests** for workflows
* **Few end-to-end tests** for complete scenarios

### Use Test Environment

* Time-skipping for fast execution
* Isolated test runs
* Deterministic results

### Mock External Dependencies

* Database calls
* HTTP requests
* Third-party services

### Test Error Scenarios

* Activity failures
* Timeout handling
* Compensation logic

### Debugging Test Failures <a href="#debugging-test-failures" id="debugging-test-failures"></a>

When tests fail, check:

1. **Workflow history** in Temporal Web UI
2. **Activity logs** for error details
3. **Test environment setup**
4. **Mock configurations**

Ready to learn production deployment patterns? Let's explore signals, queries, and monitoring!
