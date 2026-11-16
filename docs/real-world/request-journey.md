# The Journey of a Request

Following one request from the network card to your handler and back, plus the kernel limits and shutdown behavior that bite in production.

## The Journey of a Request to the Backend

> Before your handler runs, a request is accepted, read, decrypted, parsed and decoded. Each step costs CPU and can be the real bottleneck.

```text
1. Accept   kernel finishes the TCP handshake; app accept()s the connection
2. Read     bytes copied from the kernel receive buffer into the app
3. Decrypt  TLS turns ciphertext into plaintext bytes
4. Parse    find where the request starts and ends (HTTP/1.1 text, HTTP/2 frames)
5. Decode   JSON / protobuf / form → objects; decompress gzip; decode UTF-8
6. Process  your code: auth, DB queries, business logic (often on another thread)
7. Respond  serialize, encrypt, write to the send buffer
```

Frameworks hide steps 1–5, so it is easy to believe "the handler only takes 5 ms" while each request spends 20 ms elsewhere: TLS handshakes on new connections, parsing a 2 MB JSON body, or a queue in the accept backlog.

::: tip Real world
- A latency graph where the app reports 10 ms but clients see 300 ms: measure at the load balancer and at the client too; the gap is in steps 1–5 or the network.
- Moving JSON parsing of huge payloads to streams, compressing less, or switching internal traffic to protobuf are fixes for steps 4–5, not for the handler.
:::

## How the Kernel Manages Backend Connections

> For every listening socket the kernel keeps a SYN queue and an accept queue; for every connection a receive and a send buffer. Their sizes decide how much a slow app can absorb.

Recap of the [accept path](/execution/connections#how-the-backend-accepts-connections) with the limits that matter:

| Structure | Holds | Limited by |
| --- | --- | --- |
| SYN queue | half-open handshakes | `tcp_max_syn_backlog`, SYN cookies |
| Accept queue | established connections waiting for `accept()` | `listen()` backlog, `net.core.somaxconn` |
| Receive buffer | bytes not yet `read()` | `net.ipv4.tcp_rmem` |
| Send buffer | bytes not yet ACKed by the client | `net.ipv4.tcp_wmem` |
| File descriptors | every open socket and file | `ulimit -n`, `fs.file-max` |

When the app is slower than the traffic, these fill in order, and the symptom tells you where: dropped SYNs, connection timeouts, slow uploads, or "too many open files".

::: tip Real world
- A Black Friday spike where p99 latency jumps before CPU is saturated: check accept queue overflows with `nstat -az TcpExtListenOverflows`.
- Raising `somaxconn` without making the app accept faster only hides the problem longer.
:::

## Running Out of TCP Ports

> A connection is identified by (source IP, source port, destination IP, destination port). A client talking to one destination can only open as many connections as it has ephemeral source ports, and sockets in TIME_WAIT keep holding them.

On Linux the ephemeral range is about 28,000 ports by default (`net.ipv4.ip_local_port_range = 32768 60999`). The side that closes first keeps the socket in TIME_WAIT for ~60 s. A service that opens a **new connection per request** to the same database or API, at 500 requests per second, needs 30,000 ports in TIME_WAIT: new connections start failing with `EADDRNOTAVAIL` / "Cannot assign requested address".

Fixes, best first:

1. **Reuse connections**: keep-alive and connection pools.
2. Add destination IPs or source IPs (each new 4-tuple combination has its own port space).
3. Widen the port range and enable `net.ipv4.tcp_tw_reuse` for outgoing connections.

::: tip Real world
- A Node service calling an internal API with `fetch` and no keep-alive agent, failing intermittently under load.
- A NAT gateway shared by hundreds of pods talking to one third-party API exhausts its ports (AWS NAT gateways have a per-destination limit).
- `ss -tan state time-wait | wc -l` confirms it.
:::

## HTTP Graceful Connection Shutdown

> To stop a server without breaking requests: stop accepting new connections, tell clients to reconnect elsewhere, let in-flight requests finish, then close.

```js
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));        // stop accepting; callback when all connections close
  server.closeIdleConnections();               // close keep-alive sockets with no request in flight
  setTimeout(() => process.exit(1), 25_000).unref(); // hard deadline before the orchestrator kills us
});
```

Protocol signals help clients move away cleanly:

- **HTTP/1.1:** respond with `Connection: close` so the client does not reuse the socket.
- **HTTP/2 and HTTP/3:** send a `GOAWAY` frame with the last stream ID processed; the client retries later streams on a new connection.
- **Load balancers:** deregister the instance first (connection draining) so no new traffic arrives.

::: tip Real world
- Kubernetes sends SIGTERM, waits `terminationGracePeriodSeconds` (30 s default), then SIGKILL. Without graceful shutdown, every deploy throws a burst of 502s.
- Add a short sleep in a `preStop` hook so the pod is removed from the Service endpoints before the app stops accepting.
- WebSocket servers should send a close frame and let clients reconnect with jitter.
:::
