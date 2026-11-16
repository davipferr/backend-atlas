# Processes & Threads

The units your backend actually runs as, and how they share (and fight over) the CPU.

## The Process

> A running program with its own isolated memory, file descriptors and PID. One process cannot read another's memory.

Each process has its own virtual address space, its own open files and sockets, and is scheduled by the kernel. Isolation is the big win: a crash or memory corruption stays inside one process. The cost: creating a process is heavier, and processes talk through IPC (pipes, sockets, shared memory) instead of plain variables.

::: tip Real world
- nginx runs one master process plus worker processes. Postgres forks one backend process per client connection, which is why connections are expensive and [pooling](/communication/connections-state#connection-pooling) matters.
- Running a Node app with PM2 cluster mode or several containers: separate processes, so in-memory caches are not shared between them.
:::

## The Thread

> A unit of execution inside a process. Threads share the process memory, so they communicate cheaply but must synchronize access to shared data.

Each thread has its own stack and registers but shares the heap with its siblings. Sharing makes them lightweight and fast to communicate, and also dangerous: two threads updating the same counter without a lock create **race conditions**, and locks bring contention and deadlocks.

```text
process (PID 4120) ─ heap, open sockets, config
  ├─ thread 1 (main / event loop)
  ├─ thread 2 (worker)
  └─ thread 3 (worker)
```

::: tip Real world
- A Java Spring app with a pool of 200 Tomcat threads, all reading the same in-memory cache.
- Node.js: your JavaScript runs on one thread, but libuv has a thread pool (4 threads by default) for file I/O, DNS and crypto.
- A Go program: goroutines are scheduled by the Go runtime onto a few OS threads.
:::

## How Processes and Threads Compete for CPU Time

> There are more runnable threads than CPU cores, so the kernel scheduler gives each a time slice and switches between them. Every switch has a cost.

A **context switch** saves the registers of one thread and loads another's. Switching between threads of the same process is cheaper than between processes (same memory mappings), but both pollute CPU caches and the TLB. A thread is **taken off** the CPU when its time slice ends, when a higher priority task arrives, or when it blocks (waiting for disk, network or a lock).

- **CPU-bound** work wants about one thread per core; more threads only add switching.
- **I/O-bound** work spends most time waiting, so many threads (or an event loop) keep the CPU busy.

::: tip Real world
- A server set to 2,000 threads on 8 cores spends much of its time switching: latency goes up while CPU looks "busy".
- Containers with a CPU limit of 1 core but a runtime that sees all 64 host cores and starts 64 threads: heavy throttling. Set `GOMAXPROCS`, JVM `-XX:ActiveProcessorCount` or use container-aware runtimes.
- `vmstat 1` shows context switches per second (`cs` column) on Linux.
:::

## When to Use Threads

> Use threads for CPU-heavy work that blocks the main loop, for blocking I/O you cannot make async, and for work that runs at a different pace. Avoid them when an event loop already does the job.

Good reasons:

- **IO blocking:** a library has only blocking calls (some DB drivers, file system calls) — run it in a worker so the main thread keeps serving.
- **Heavy CPU work:** image resizing, compression, PDF generation, password hashing, parsing big JSON.
- **Large volumes of small tasks** that can be processed in parallel across cores.

Costs to accept: synchronization bugs, harder debugging, more memory per thread (about 1–8 MB of stack each), and the context switching above.

```js
// Node: move CPU work off the event loop
import { Worker } from 'node:worker_threads';

app.post('/thumbnails', (req, res) => {
  const worker = new Worker('./resize.js', { workerData: req.body.imageUrl });
  worker.once('message', (url) => res.json({ url }));
});
```

::: tip Real world
- A Node API freezing for every user while one request computes a bcrypt hash or a large CSV report: move that work to a worker thread or a queue.
- For many independent jobs, prefer [async backend processing](/communication/request-response#asynchronous-backend-processing) with separate worker processes: they scale and fail independently.
:::
