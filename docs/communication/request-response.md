# Request-Response, Push & Async

The two oldest ways a client and a backend talk, and the difference between waiting for work and handing it off.

## Request Response

> The client sends a request, the server parses it, processes it and sends back one response. Everything else is built on top of this.

The cycle has five steps, and every one of them costs time:

```text
client                                   server
  │ 1. build request (method, path, headers, body)
  │ ───────────── request ───────────────▶ │ 2. parse: where does the request end?
  │                                        │ 3. decode: JSON / protobuf / form → objects
  │                                        │ 4. process: query DB, call services
  │ ◀──────────── response ─────────────── │ 5. serialize response
```

The hard part people forget is **step 2**: the server must know where a request starts and ends in a stream of bytes. HTTP/1.1 uses `Content-Length` or chunked encoding, gRPC uses length-prefixed frames, a database protocol has its own message format. Parsing and decoding are often more expensive than the "real" work.

Request-response is used by HTTP, DNS, SSH, database protocols (a SQL query is a request) and RPC frameworks.

::: tip Real world
- A REST call `GET /orders/42` from your SPA, a SQL `SELECT` from your app to Postgres, a DNS lookup before every connection.
- **Uploading a large file**: one big request (simple, but a failure restarts everything) vs chunked uploads like S3 multipart or tus (resumable, each chunk is its own request-response).
:::

::: warning Gotcha
Request-response is a bad fit when the server has news the client did not ask for (chat, notifications), or when the work takes minutes. That is what push, polling and async processing are for.
:::

## Push

> The server sends data to the client the moment it has it, over a connection the client opened earlier. No request per message.

```text
client ── open connection ──▶ server
client ◀── message ─────────── server   (new chat message)
client ◀── message ─────────── server   (user is typing…)
client ◀── message ─────────── server   (order shipped)
```

Push gives real-time delivery, but it has costs:

- The client must be **online and connected**. Offline clients need a fallback (store and deliver on reconnect, or a mobile push service).
- The client may not be able to keep up: the server can flood it. Push needs some form of backpressure.
- It needs a **bidirectional protocol** (WebSockets, or HTTP/2 streams) and long-lived connections, which make the backend stateful and harder to scale.

::: tip Real world
- Chat apps (Slack, WhatsApp Web, Discord) push messages over WebSockets.
- Live dashboards, multiplayer games, collaborative editors (Figma, Google Docs cursors).
- Mobile notifications use push through Apple APNs / Google FCM because apps cannot hold a socket open in the background.
:::

## Synchronous I/O

> The caller blocks and can do nothing else until the response arrives. Simple to reason about, wasteful while waiting.

```js
// Synchronous: the thread sleeps until the disk returns
const data = fs.readFileSync('/var/data/report.csv'); // nothing else runs in this thread
process(data);
```

When a program makes a blocking call, the OS takes it off the CPU (a context switch) and wakes it up when the data is ready. In a thread-per-request server, a slow database call means a thread sitting idle and holding memory.

::: tip Real world
- A Python/Flask or classic Java servlet app: each request occupies one thread while it waits on Postgres. Too many slow queries and the thread pool runs out, and new requests queue up even though CPU is idle.
- CLI scripts and migrations, where blocking is fine and simpler.
:::

## Asynchronous I/O

> The caller starts the operation and keeps working. It learns about the result later, through a callback, a promise or by checking readiness.

```js
// Asynchronous: the event loop serves other requests while the disk works
const data = await fs.promises.readFile('/var/data/report.csv');
process(data);
```

There are two ways the OS makes this possible:

| Model | How it works | Used by |
| --- | --- | --- |
| **Readiness** (`epoll`, `kqueue`) | "Tell me when this socket has data, I will read it myself." | Node.js (libuv), nginx, Netty, Go runtime |
| **Completion** (`io_uring`, Windows IOCP) | "Do this read for me and tell me when it is done." | Modern high-performance servers, databases |
| **Thread pool** | Run the blocking call on a worker thread so the main thread is free. | Node.js for file I/O and DNS (`getaddrinfo`) |

`async/await` is syntax over this: the code *looks* sequential, but the thread is free while it waits.

::: tip Real world
- One Node.js process handling 10,000 idle WebSocket connections with a single thread.
- Calling three microservices in parallel with `Promise.all` instead of one after the other: total latency becomes the slowest call, not the sum.
:::

## Asynchronous Backend Processing

> For work that takes longer than a user should wait, the backend accepts the request, queues a job, answers immediately with a job ID, and does the work in the background.

```text
POST /reports           ──▶ API: validate, enqueue job, return 202 { jobId: "r_91" }
                              │
                              ▼
                         queue (RabbitMQ, SQS, Redis/BullMQ, Kafka)
                              │
                              ▼
                         worker: generate PDF, upload to S3, mark job done

GET /reports/r_91       ──▶ { status: "done", url: "https://…/r_91.pdf" }
```

The client learns the result by polling the job, through a push/SSE notification, or by a webhook. The API stays fast, the workers scale separately, and a crash in a worker does not lose the request: the job stays in the queue.

::: tip Real world
- Video upload on YouTube: the upload finishes, then "processing…" runs in the background.
- Exporting a CSV of a year of orders, sending a batch of emails, resizing images, payment webhooks you must process but answer within seconds.
- Postgres itself is async in places: a commit returns after the WAL is written, while data pages are flushed later.
:::

::: warning Gotcha
Queues deliver at least once. A worker can run the same job twice after a crash, so jobs must be [idempotent](/execution/idempotency-nagle#backend-idempotency).
:::
