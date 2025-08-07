# Quick Start Tutorial

## Quick Start Tutorial

Let's build your first Temporal workflow in TypeScript! This tutorial uses the code from your repository to create a working "Hello World" example.

### Step 1: Project Setup

First, make sure you have Temporal running locally:\
\
Start Temporal server (in one terminal)

npm run temporal:start

## In another terminal, run the worker <a href="#in-another-terminal-run-the-worker" id="in-another-terminal-run-the-worker"></a>

npm run start:worker

## In a third terminal, execute a workflow <a href="#in-a-third-terminal-execute-a-workflow" id="in-a-third-terminal-execute-a-workflow"></a>

npm run start:client

### Step 2: Your First Activity

Activities are the building blocks of Temporal workflows. Here's a simple greeting activity:



// From: src/activities.ts\
import { log } from '@temporalio/activity';

export async function greet(name: string): Promise\<string> {\
log.info('Greeting activity started', { name });\
return `Hello, ${name}!`;\
}

export async function farewell(name: string): Promise\<string> {\
log.info('Farewell activity started', { name });\
return `Goodbye, ${name}!`;\
}



**Key Points:**

* Activities contain your business logic
* They can fail and be retried automatically
* Use `@temporalio/activity` for logging
* Keep activities idempotent (safe to run multiple times)

### Step 3: Your First Workflow

Workflows orchestrate activities and handle the execution flow:

// From: src/workflows.ts\
import \* as workflow from '@temporalio/workflow';\
import type \* as activities from './activities';

const { greet, farewell } = workflow.proxyActivities\<typeof activities>({\
startToCloseTimeout: '1 minute',\
});

export async function helloWorkflow(name: string): Promise\<string> {\
const greeting = await greet(name);\
const goodbye = await farewell(name);\
return `${greeting} ${goodbye}`;\
}

**Key Points:**

* Workflows are deterministic and can be replayed
* Use `proxyActivities` to call activities
* Set appropriate timeouts for activities
* Workflows coordinate the business process

### Step 4: The Worker

Workers execute your workflows and activities:

// From: src/worker.ts\
import { Worker } from '@temporalio/worker';\
import \* as activities from './activities';

async function run() {\
const worker = await Worker.create({\
workflowsPath: require.resolve('./workflows'),\
activities,\
taskQueue: 'hello-world',\
});

await worker.run();\
}

run().catch((err) => {\
console.error(err);\
process.exit(1);\
});

### Step 5: Executing Your Workflow

Finally, create a client to start your workflow:

// From: src/client.ts\
import { Connection, WorkflowClient } from '@temporalio/client';\
import { helloWorkflow } from './workflows';

async function run() {\
const connection = await Connection.connect({\
address: 'localhost:7233',\
});

const client = new WorkflowClient({\
connection,\
});

const handle = await client.start(helloWorkflow, {\
taskQueue: 'hello-world',\
workflowId: 'my-business-id',\
args: \['Temporal'],\
});

console.log(`Started workflow ${handle.workflowId}`);\
console.log(await handle.result());\
}

run().catch((err) => {\
console.error(err);\
process.exit(1);\
});

### Test Your Setup

Run these commands to see your workflow in action:

## Terminal 1: Start Temporal <a href="#terminal-1-start-temporal" id="terminal-1-start-temporal"></a>

npm run temporal:start

## Terminal 2: Start worker <a href="#terminal-2-start-worker" id="terminal-2-start-worker"></a>

npm run start:worker

## Terminal 3: Run workflow <a href="#terminal-3-run-workflow" id="terminal-3-run-workflow"></a>

npm run start:client

**Expected Output:**

Started workflow my-business-id\
Hello, Temporal! Goodbye, Temporal!

### What Just Happened?

1. **Client** started a workflow execution
2. **Worker** picked up the workflow task
3. **Workflow** executed two activities in sequence
4. **Activities** performed the actual work
5. **Result** was returned to the client

### Next Steps

Now that you have a working Temporal application, let's learn how to handle failures and implement compensation patterns! →

```
```
