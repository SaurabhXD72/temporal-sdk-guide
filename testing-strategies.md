# Testing Strategies

```
# Testing Strategies

Testing Temporal workflows requires special techniques since workflows are deterministic and stateful. This guide shows you how to test activities, workflows, and end-to-end scenarios using your repository examples.

**[SCREENSHOT PLACEHOLDER: Terminal showing test results with green checkmarks - npm run test output]**

## Testing Philosophy

Temporal applications have three main testing layers:

1. **Unit Tests** - Test individual activities and workflow logic
2. **Integration Tests** - Test workflows with real Temporal server
3. **End-to-End Tests** - Test complete business scenarios

## Unit Testing Activities

Activities are the easiest to test since they're just functions:

```

// From: examples/03-testing/tests/activities.test.ts\
import { greet, processPayment } from '../activities/order-activities';

describe('Order Activities', () => {\
test('greet returns formatted greeting', async () => {\
const result = await greet('Alice');\
expect(result).toBe('Hello, Alice!');\
});

test('processPayment handles valid orders', async () => {\
const orderId = 'ORDER-123';\
await expect(processPayment(orderId)).resolves.not.toThrow();\
});

test('processPayment throws on invalid orders', async () => {\
const invalidOrderId = 'INVALID';\
await expect(processPayment(invalidOrderId)).rejects.toThrow('Invalid order');\
});\
});

```
text
**[SCREENSHOT PLACEHOLDER: Jest test output showing activity tests passing]**

## Testing Workflows with TestWorkflowEnvironment

For workflow testing, use Temporal's test environment:

```

// From: examples/03-testing/tests/workflows.test.ts\
import { TestWorkflowEnvironment } from '@temporalio/testing';\
import { Worker } from '@temporalio/worker';\
import { WorkflowClient } from '@temporalio/client';\
import { helloWorkflow } from '../workflows';\
import \* as activities from '../activities';

describe('Hello Workflow', () => {\
let testEnv: TestWorkflowEnvironment;\
let worker: Worker;\
let client: WorkflowClient;

beforeAll(async () => {\
testEnv = await TestWorkflowEnvironment.createTimeSkipping();

```
textworker = await Worker.create({
  connection: testEnv.nativeConnection,
  taskQueue: 'test-queue',
  workflowsPath: require.resolve('../workflows'),
  activities,
});

client = testEnv.client;
```

});

afterAll(async () => {\
await worker?.shutdown();\
await testEnv?.teardown();\
});

test('helloWorkflow executes successfully', async () => {\
const result = await client.execute(helloWorkflow, {\
workflowId: 'test-hello-workflow',\
taskQueue: 'test-queue',\
args: \['World'],\
});

```
textexpect(result).toBe('Hello, World! Goodbye, World!');
```

});\
});

```
text
## Mocking Activities in Workflow Tests

Sometimes you want to test workflow logic without running real activities:

```

// From: examples/03-testing/tests/mocked-workflows.test.ts\
import { TestWorkflowEnvironment } from '@temporalio/testing';\
import { Worker } from '@temporalio/worker';\
import { orderSagaWorkflow } from '../workflows/order-saga';

describe('Order Saga with Mocked Activities', () => {\
let testEnv: TestWorkflowEnvironment;\
let worker: Worker;

beforeAll(async () => {\
testEnv = await TestWorkflowEnvironment.createTimeSkipping();

```
text// Mock activities
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
```

});

test('saga completes successfully with valid order', async () => {\
const result = await testEnv.client.execute(orderSagaWorkflow, {\
workflowId: 'test-saga-success',\
taskQueue: 'test-saga-queue',\
args: \['ORDER-123'],\
});

```
textexpect(result).toContain('processed successfully');
```

});

test('saga runs compensations on failure', async () => {\
// Mock inventory failure\
const mockActivities = {\
processPayment: jest.fn().mockResolvedValue(undefined),\
reserveInventory: jest.fn().mockRejectedValue(new Error('Out of stock')),\
refundPayment: jest.fn().mockResolvedValue(undefined),\
};

```
textconst worker = await Worker.create({
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
```

});\
});

```
text
**[SCREENSHOT PLACEHOLDER: Test output showing both success and failure scenarios]**

## Testing Time-Based Workflows

Temporal's test environment can skip time for testing timeouts and schedules:

```

// From: examples/03-testing/tests/time-workflows.test.ts\
import { TestWorkflowEnvironment } from '@temporalio/testing';\
import { delayedWorkflow } from '../workflows/delayed-workflow';

describe('Time-based Workflows', () => {\
let testEnv: TestWorkflowEnvironment;

beforeAll(async () => {\
// Time-skipping environment for fast testing\
testEnv = await TestWorkflowEnvironment.createTimeSkipping();\
});

test('workflow waits for specified duration', async () => {\
const startTime = Date.now();

```
textawait testEnv.client.execute(delayedWorkflow, {
  workflowId: 'test-delayed',
  taskQueue: 'test-queue',
  args: ['5 minutes'], // This will complete instantly in tests
});

const endTime = Date.now();

// Should complete almost instantly due to time skipping
expect(endTime - startTime).toBeLessThan(1000);
```

});\
});

```
text
## Integration Testing Setup

For testing against a real Temporal server:

```

// From: examples/03-testing/tests/integration.test.ts\
import { Connection, WorkflowClient } from '@temporalio/client';\
import { Worker } from '@temporalio/worker';

describe('Integration Tests', () => {\
let connection: Connection;\
let client: WorkflowClient;\
let worker: Worker;

beforeAll(async () => {\
// Connect to real Temporal server (docker-compose)\
connection = await Connection.connect({\
address: 'localhost:7233',\
});

```
textclient = new WorkflowClient({ connection });

worker = await Worker.create({
  connection,
  taskQueue: 'integration-test-queue',
  workflowsPath: require.resolve('../workflows'),
  activities: require('../activities'),
});

// Start worker
await worker.runUntil(async () => {
  // Tests will run here
});
```

});

test('end-to-end order processing', async () => {\
const workflowId = `integration-test-${Date.now()}`;

```
textconst handle = await client.start(orderSagaWorkflow, {
  workflowId,
  taskQueue: 'integration-test-queue',
  args: ['REAL-ORDER-123'],
});

const result = await handle.result();
expect(result).toContain('processed successfully');
```

});\
});

```
text
**[SCREENSHOT PLACEHOLDER: Docker containers running + integration test output]**

## Running Your Tests

Your repository includes comprehensive test scripts:

```

## Run all tests <a href="#run-all-tests" id="run-all-tests"></a>

npm run test

## Run tests with coverage <a href="#run-tests-with-coverage" id="run-tests-with-coverage"></a>

npm run test:coverage

## Run only unit tests <a href="#run-only-unit-tests" id="run-only-unit-tests"></a>

npm run test:unit

## Run only integration tests <a href="#run-only-integration-tests" id="run-only-integration-tests"></a>

npm run test:integration

## Watch mode for development <a href="#watch-mode-for-development" id="watch-mode-for-development"></a>

npm run test:watch

```
text
**[SCREENSHOT PLACEHOLDER: Coverage report showing high test coverage percentages]**

## Test Configuration

Jest configuration for Temporal projects:

```

// From: jest.config.js\
{\
"preset": "ts-jest",\
"testEnvironment": "node",\
"testMatch": \[\
"**/tests/**/_.ts",_\
&#xNAN;_"\*\*/?(_.)+(spec|test).ts"\
],\
"collectCoverageFrom": \[\
"src/**/\*.ts",**\
&#xNAN;**"examples/**/_.ts",_\
&#xNAN;_"!\*\*/_.d.ts"\
],\
"coverageThreshold": {\
"global": {\
"branches": 80,\
"functions": 80,\
"lines": 80,\
"statements": 80\
}\
}\
}

```
text
## Key Testing Principles

### ✅ **Test Pyramid Structure**
- **Many unit tests** for activities
- **Some integration tests** for workflows  
- **Few end-to-end tests** for complete scenarios

### ✅ **Use Test Environment**
- Time-skipping for fast execution
- Isolated test runs
- Deterministic results

### ✅ **Mock External Dependencies**
- Database calls
- HTTP requests
- Third-party services

### ✅ **Test Error Scenarios**
- Activity failures
- Timeout handling
- Compensation logic

**[SCREENSHOT PLACEHOLDER: Temporal Web UI showing workflow execution history from tests]**

## Debugging Test Failures

When tests fail, check:

1. **Workflow history** in Temporal Web UI
2. **Activity logs** for error details
3. **Test environment setup** 
4. **Mock configurations**

Ready to learn production deployment patterns? Let's explore signals, queries, and monitoring! →
```
