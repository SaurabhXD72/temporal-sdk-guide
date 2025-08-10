# Overview & Setup

## Temporal TypeScript SDK Guide <a href="#temporal-typescript-sdk-guide" id="temporal-typescript-sdk-guide"></a>

A comprehensive guide to building production-ready distributed systems with Temporal and TypeScript.

### What You'll Learn <a href="#what-youll-learn" id="what-youll-learn"></a>

* Set up Temporal with TypeScript from scratch
* Build fault-tolerant workflows and activities
* Handle errors with compensation patterns
* Test your Temporal applications
*   Deploy workflows to production environments

    \


### Prerequisites <a href="#prerequisites" id="prerequisites"></a>

* Node.js 18+ installed (run `node --version` to check)
* Basic TypeScript knowledge
* Code editor (VS Code recommended)

### Quick Installation <a href="#quick-installation" id="quick-installation"></a>

```bash
# Clone the example repository
git clone https://github.com/SaurabhXD72/temporal-sdk-guide.git
cd temporal-sdk-guide

# Install dependencies
npm install

# Start Temporal server
temporal server start-dev

# Start the worker(in separate workflow)
npm run start:worker

# Run your first workflow(in separate workflow)
npm run start:client

```

### Repository Structure <a href="#repository-structure" id="repository-structure"></a>

This guide follows a hands-on approach with real code examples:

* **Basic Examples** - Hello world workflows and activities
* **Error Handling** - Compensation patterns and saga implementation
* **Testing** - Unit tests, integration tests, and mocking
* **Production Patterns** - Signals, queries, and monitoring

### Guide Features <a href="#what-makes-this-guide-different" id="what-makes-this-guide-different"></a>

* Complete working examples - Every code sample runs without modification
* Production-tested patterns - Approaches used in real distributed systems
* Full testing coverage - Unit tests, integration tests, and mocking strategies
* Progressive complexity - Start simple, build to advanced production workflows

Ready to build resilient distributed systems? Let's start! ->

