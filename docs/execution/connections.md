# Accepting & Reading Connections

What happens between a client's SYN and your handler running: kernel queues, socket buffers, and the three roles every server plays.

## How the Backend Accepts Connections

> The kernel completes the TCP handshake on its own and parks the connection in a queue. Your application then calls `accept()` to take it and get a file descriptor.

```text
server calls listen(port 8080)  →  kernel creates a listening socket with two queues

client SYN ──────▶ SYN queue (half-open connections)
client ACK ──────▶ accept queue (fully established, waiting for the app)
app accept() ────▶ removes one connection, returns a new socket file descriptor
```

- `listen(fd, backlog)` sets the **accept queue** size (capped on Linux by `net.core.somaxconn`).
- The handshake finishes even if your app is busy. If the app does not call `accept()` fast enough, the queue fills up and new connections are dropped or reset.
- Each accepted connection is a **file descriptor**, limited by `ulimit -n` per process.

::: tip Real world
- During a traffic spike, clients see connection timeouts while the app's CPU is maxed: the accept queue is full. On Linux, `ss -lnt` shows `Recv-Q` (queue length) vs `Send-Q` (backlog) for listening sockets.
- "Too many open files" errors: the process hit its file descriptor limit, not a code bug.
- SYN floods attack the SYN queue; SYN cookies (`net.ipv4.tcp_syncookies`) defend against them.
:::

## Reading and Sending Socket Data

> Every connection has a kernel receive buffer and send buffer. `read()` copies from the receive buffer into your process; `write()` copies into the send buffer and returns before the data reaches the client.

```text
network ──▶ NIC ──▶ kernel receive buffer ──read()──▶ app memory (parse, process)
app memory ──write()──▶ kernel send buffer ──▶ NIC ──▶ network (kernel handles ACKs, retransmits)
```

- The receive buffer's free space is the TCP window advertised to the client: if your app reads slowly, the buffer fills and the client must slow down (flow control).
- `write()` succeeding only means the kernel accepted the bytes. Once the send buffer is full, `write()` blocks (or returns `EAGAIN` on non-blocking sockets).
- Copies between kernel and user space cost CPU; techniques like `sendfile` (zero-copy) send files directly from the page cache.

::: tip Real world
- A server streaming a large export to a slow mobile client: its send buffer fills, and a careless server keeps buffering in its own memory until it runs out. Respect backpressure (`stream.pipe`, `res.write()` returning `false`).
- nginx serves static files with `sendfile on` so bytes go from disk to the socket without passing through user space.
:::

## The Listener, The Acceptor and the Reader

> Every server does three jobs: the listener creates the listening socket, the acceptor takes connections from the accept queue, and the reader reads bytes, parses requests and processes them.

```text
Listener:  socket() + bind() + listen()   — once, at startup
Acceptor:  loop { fd = accept() }          — per new connection
Reader:    loop { read(fd) → parse → handle → write(fd) }  — per request
```

They can live in one thread or many. How they are distributed across threads and processes is the **execution pattern** of the server, and it explains most performance differences between Node, nginx, Apache, Java and Go servers.

::: tip Real world
- In Node, `http.createServer().listen(3000)` is the listener; libuv's event loop is the acceptor and reader on one thread.
- In a Java servlet container, one thread accepts and hands each connection to a pooled worker thread that reads it.
- See the [threading execution patterns](/execution/threading-patterns) for the variations.
:::
