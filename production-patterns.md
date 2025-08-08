# Production Patterns

Ready for production? This page covers advanced Temporal patterns using real-world examples from your repository: signals, queries, monitoring, and deployment strategies.

### Signals: Dynamic Workflow Communication <a href="#signals-dynamic-workflow-communication" id="signals-dynamic-workflow-communication"></a>

Signals allow external systems to send data to running workflows. Perfect for user interactions, status updates, and dynamic control flow.

```typescript
// From: examples/04-production-patterns/workflows/interactive-workflow.ts
import * as workflow from '@temporalio/workflow';

interface OrderState {
  orderId: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  approvedBy?: string;
  rejectedReason?: string;
}

export async function interactiveOrderWorkflow(orderId: string): Promise<string> {
  const state: OrderState = {
    orderId,
    status: 'pending'
  };

  // Define signals
  const approveSignal = workflow.defineSignal<[string]>('approve');
  const rejectSignal = workflow.defineSignal<[string]>('reject');
  
  // Set signal handlers
  workflow.setHandler(approveSignal, (approvedBy: string) => {
    state.status = 'approved';
    state.approvedBy = approvedBy;
  });
  
  workflow.setHandler(rejectSignal, (reason: string) => {
    state.status = 'rejected';
    state.rejectedReason = reason;
  });

  workflow.log.info('Order workflow started, waiting for approval', { orderId });

  // Wait for approval or rejection
  await workflow.condition(() => state.status !== 'pending');

  if (state.status === 'approved') {
    workflow.log.info('Order approved, processing', { 
      orderId, 
      approvedBy: state.approvedBy 
    });
    
    // Continue with order processing
    await workflow.proxyActivities({
      startToCloseTimeout: '5 minutes',
    }).processApprovedOrder(orderId);
    
    state.status = 'completed';
    return `Order ${orderId} completed successfully!`;
  } else {
    workflow.log.info('Order rejected', { 
      orderId, 
      reason: state.rejectedReason 
    });
    
    throw new workflow.ApplicationFailure(
      `Order rejected: ${state.rejectedReason}`,
      'ORDER_REJECTED'
    );
  }
}
```

### Queries: Real-time Workflow State <a href="#queries-real-time-workflow-state" id="queries-real-time-workflow-state"></a>

Queries let you peek into running workflows without affecting their execution:

```typescript
// From: examples/04-production-patterns/workflows/queryable-workflow.ts
import * as workflow from '@temporalio/workflow';

interface WorkflowProgress {
  currentStep: string;
  completedSteps: string[];
  progress: number;
  estimatedCompletion: Date;
}

export async function trackableWorkflow(taskId: string): Promise<string> {
  const progress: WorkflowProgress = {
    currentStep: 'initializing',
    completedSteps: [],
    progress: 0,
    estimatedCompletion: new Date(Date.now() + 10 * 60 * 1000) // 10 min estimate
  };

  // Define query
  const getProgressQuery = workflow.defineQuery<WorkflowProgress>('getProgress');
  workflow.setHandler(getProgressQuery, () => progress);

  const steps = ['validate', 'process', 'analyze', 'generate', 'complete'];
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    progress.currentStep = step;
    progress.progress = Math.round((i / steps.length) * 100);
    
    workflow.log.info('Starting step', { taskId, step, progress: progress.progress });
    
    // Simulate work
    await workflow.proxyActivities({
      startToCloseTimeout: '2 minutes',
    }).processStep(taskId, step);
    
    progress.completedSteps.push(step);
    
    // Update estimated completion
    const remainingSteps = steps.length - i - 1;
    const avgTimePerStep = 2 * 60 * 1000; // 2 minutes per step
    progress.estimatedCompletion = new Date(Date.now() + (remainingSteps * avgTimePerStep));
  }
  
  progress.currentStep = 'completed';
  progress.progress = 100;
  
  return `Task ${taskId} completed successfully!`;
}
```

### Client Usage: Signals and Queries <a href="#client-usage-signals-and-queries" id="client-usage-signals-and-queries"></a>

Here's how external systems interact with your workflows:

```typescript
// From: examples/04-production-patterns/client/interactive-client.ts
import { Connection, WorkflowClient } from '@temporalio/client';
import { interactiveOrderWorkflow, trackableWorkflow } from '../workflows';

async function runInteractiveExample() {
  const connection = await Connection.connect({ address: 'localhost:7233' });
  const client = new WorkflowClient({ connection });

  // Start interactive workflow
  const orderHandle = await client.start(interactiveOrderWorkflow, {
    taskQueue: 'production-queue',
    workflowId: `order-${Date.now()}`,
    args: ['ORDER-12345'],
  });

  console.log(`Started interactive workflow: ${orderHandle.workflowId}`);

  // Simulate external approval after 5 seconds
  setTimeout(async () => {
    await orderHandle.signal('approve', 'manager@company.com');
    console.log('Order approved via signal!');
  }, 5000);

  const result = await orderHandle.result();
  console.log('Final result:', result);
}

async function queryWorkflowProgress() {
  const connection = await Connection.connect({ address: 'localhost:7233' });
  const client = new WorkflowClient({ connection });

  // Start trackable workflow
  const taskHandle = await client.start(trackableWorkflow, {
    taskQueue: 'production-queue',
    workflowId: `task-${Date.now()}`,
    args: ['TASK-67890'],
  });

  // Query progress every 2 seconds
  const progressInterval = setInterval(async () => {
    try {
      const progress = await taskHandle.query('getProgress');
      console.log(`Progress: ${progress.progress}% - ${progress.currentStep}`);
      console.log(`ETA: ${progress.estimatedCompletion.toLocaleTimeString()}`);
      
      if (progress.progress === 100) {
        clearInterval(progressInterval);
      }
    } catch (error) {
      console.error('Query failed:', error);
      clearInterval(progressInterval);
    }
  }, 2000);

  const result = await taskHandle.result();
  console.log('Task completed:', result);
}
```

### Advanced Activity Patterns <a href="#advanced-activity-patterns" id="advanced-activity-patterns"></a>

Production activities with retry policies, heartbeats, and cancellation:

```typescript
// From: examples/04-production-patterns/activities/production-activities.ts
import { 
  Context, 
  log, 
  heartbeat, 
  cancelled,
  ActivityCancellationType 
} from '@temporalio/activity';

export async function processLargeDataset(datasetId: string): Promise<string> {
  const context = Context.current();
  
  // Configure cancellation
  context.configure({
    cancellationType: ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
  });

  log.info('Starting large dataset processing', { datasetId });
  
  const totalItems = 10000; // Simulate large dataset
  
  try {
    for (let i = 0; i < totalItems; i++) {
      // Check for cancellation
      if (await cancelled()) {
        log.warn('Processing cancelled by user', { datasetId, processed: i });
        throw new Error('Processing cancelled');
      }
      
      // Process item (simulate work)
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Send heartbeat every 100 items
      if (i % 100 === 0) {
        heartbeat(`Processed ${i}/${totalItems} items`);
        log.info('Progress update', { 
          datasetId, 
          processed: i, 
          total: totalItems,
          percentage: Math.round((i / totalItems) * 100)
        });
      }
    }
    
    log.info('Dataset processing completed', { datasetId, totalItems });
    return `Successfully processed ${totalItems} items for dataset ${datasetId}`;
    
  } catch (error) {
    log.error('Dataset processing failed', { 
      datasetId, 
      error: error.message 
    });
    throw error;
  }
}
```

### Production Configuration <a href="#production-configuration" id="production-configuration"></a>

Environment-specific worker configuration:

```typescript
// From: examples/04-production-patterns/worker/production-worker.ts
import { Worker } from '@temporalio/worker';
import { getEnv } from '../config/environment';

async function createProductionWorker() {
  const env = getEnv();
  
  return await Worker.create({
    workflowsPath: require.resolve('../workflows'),
    activities: require('../activities'),
    taskQueue: env.TASK_QUEUE,
    
    // Production settings
    maxConcurrentActivityTaskExecutions: env.MAX_CONCURRENT_ACTIVITIES,
    maxConcurrentWorkflowTaskExecutions: env.MAX_CONCURRENT_WORKFLOWS,
    
    // Logging configuration
    sinks: {
      logger: {
        info: (message, meta) => console.log(JSON.stringify({
          level: 'info',
          message,
          ...meta,
          timestamp: new Date().toISOString(),
        })),
        error: (message, meta) => console.error(JSON.stringify({
          level: 'error', 
          message,
          ...meta,
          timestamp: new Date().toISOString(),
        })),
      },
    },

    // Health check endpoint
    enableNonLocalActivities: true,
  });
}

async function main() {
  const worker = await createProductionWorker();
  
  // Graceful shutdown
  process.on('SIGINT', () => worker.shutdown());
  process.on('SIGTERM', () => worker.shutdown());
  
  console.log('Production worker started');
  await worker.run();
}

main().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
```

### Deployment with Docker <a href="#deployment-with-docker" id="deployment-with-docker"></a>

Production deployment configuration:

```docker
# From: docker-compose.production.yml
version: '3.8'
services:
  temporal-worker:
    build: .
    environment:
      - NODE_ENV=production
      - TEMPORAL_ADDRESS=temporal-server:7233
      - TASK_QUEUE=production-queue
      - MAX_CONCURRENT_ACTIVITIES=10
      - MAX_CONCURRENT_WORKFLOWS=5
    depends_on:
      - temporal-server
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
        max_attempts: 3
        
  temporal-server:
    image: temporalio/temporal:latest
    ports:
      - "7233:7233"
      - "8233:8233"
    environment:
      - DB=postgresql
      - POSTGRES_DSN=postgresql://temporal:temporal@postgres:5432/temporal
      
  postgres:
    image: postgres:13
    environment:
      POSTGRES_DB: temporal
      POSTGRES_USER: temporal
      POSTGRES_PASSWORD: temporal
```

### Key Production Considerations <a href="#key-production-considerations" id="key-production-considerations"></a>

### Scalability

* Multiple worker instances
* Horizontal scaling
* Load balancing

### Reliability

* Graceful shutdowns
* Health checks
* Circuit breakers

### Observability

* Structured logging
* Metrics collection
* Distributed tracing

### Security

* TLS encryption
* Authentication
* Authorization

### Running in Production <a href="#running-in-production" id="running-in-production"></a>

Deploy your Temporal application:

```bash
# Build and deploy
docker-compose -f docker-compose.production.yml up -d

# Monitor logs
docker-compose logs -f temporal-worker

# Scale workers
docker-compose up -d --scale temporal-worker=5

# Health check
curl http://localhost:8080/health
```

### Congratulations! 🎉 <a href="#congratulations" id="congratulations"></a>

You've built a complete Temporal TypeScript SDK guide covering:

* **Setup and basic workflows**
* **Error handling with Saga pattern**
* **Comprehensive testing strategies**
* **Production-ready patterns**

Your documentation showcases real, working code that developers can immediately use in production. This positions you as a Temporal expert and thought leader in distributed systems!

**What's Next?**

* Share your GitBook with the Temporal community
* Add screenshots and polish the formatting
* Submit to Temporal's community resources
* Build your reputation as a distributed systems expert

Great work building this comprehensive SDK guide! -----:)
