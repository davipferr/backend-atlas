# Threading Execution Patterns

Five ways to distribute the listener, acceptor and reader jobs across threads and processes, each with a famous server that uses it.

## Single Listener, Acceptor and Reader Thread

> One thread does everything: listens, accepts and reads all connections through an event loop on non-blocking sockets.

```text
thread 1: listen → event loop { accept new, read ready sockets, run handlers }
```

The event loop asks the kernel (`epoll`) which sockets are ready and handles them one by one. It is simple and has no locks, but **one CPU core** does all the work, and any slow handler (CPU work, a blocking call) freezes every connection.

::: tip Real world
- Node.js and classic Redis: one main thread serving thousands of connections.
- A Node API where one endpoint parses a 50 MB JSON body: every other user waits while it runs.
- Scale it by running one process per core (Node cluster, PM2, several containers) behind a load balancer.
:::

## Single Listener, Acceptor and Multiple Readers

> One thread accepts connections and hands each one to a worker thread that reads and processes it for its whole life.

```text
thread 1 (acceptor): accept → assign connection to worker N
worker 1: reads connections A, D, G …
worker 2: reads connections B, E …
worker 3: reads connections C, F …
```

Uses all cores, but load can be **unbalanced**: connections are assigned once, and a worker that got the busy connections (a client sending thousands of requests on one keep-alive connection) is overloaded while others idle. Threads also compete for shared resources.

::: tip Real world
- memcached, Java servlet containers (thread per connection), Apache with the worker MPM.
- Uneven CPU across threads in a profile, while a few clients with long-lived connections generate most traffic.
:::

## Single Listener, Acceptor, Reader with Message Load Balancing

> One thread accepts and reads raw messages, then dispatches each **message** (not each connection) to a pool of worker threads.

```text
thread 1: accept + read → parse message → put in queue
workers: take message → process → reply via thread 1
```

Load is balanced per request, so one chatty connection cannot overload a worker. The single reader thread can become the bottleneck, and the hand-off between threads adds latency and complexity.

::: tip Real world
- Twitter's Finagle and similar RPC frameworks; message brokers that read on I/O threads and process on a worker pool.
- Netty's boss/worker groups plus a separate business thread pool follow the same idea.
:::

## Multiple Acceptor Threads on a Single Socket

> One listening socket shared by several threads, each calling `accept()` on it and then reading the connections it got.

```text
listener: one socket
thread 1: accept → read its connections
thread 2: accept → read its connections
thread 3: accept → read its connections
```

The kernel hands each new connection to one of the waiting threads. The shared socket needs locking inside the kernel (contention under very high connection rates), and the distribution may still be uneven (the "thundering herd" when all threads wake up for one connection).

::: tip Real world
- nginx (before `reuseport`), with several worker processes accepting from one socket inherited from the master.
:::

## Multiple Listeners, Acceptors and Readers with Socket Sharding

> Each thread or process opens its **own** listening socket on the same port (`SO_REUSEPORT`), and the kernel load-balances new connections between them.

```text
process 1: listen(:443, SO_REUSEPORT) → accept → read
process 2: listen(:443, SO_REUSEPORT) → accept → read
process 3: listen(:443, SO_REUSEPORT) → accept → read
            kernel hashes each new connection to one socket
```

No shared accept queue, no lock contention, and connections spread evenly. A slow process still gets its share of connections, since the kernel does not know it is busy.

::: tip Real world
- nginx `listen 443 reuseport;`, Envoy, HAProxy, and Go/Rust servers that run one listener per core.
- Zero-downtime restarts: a new version binds the same port with `SO_REUSEPORT` while the old one drains.
:::
