# Multiplexing, State & Sidecars

How many requests share a connection, where session state lives, and how to move networking concerns out of your application.

## Multiplexing vs Demultiplexing

> Multiplexing merges many logical streams into one connection. Demultiplexing splits one connection's streams back out into many connections.

```text
HTTP/1.1 browser: 6 connections, one request at a time on each
HTTP/2 browser:   1 connection, many streams interleaved (multiplexed)

HTTP/2 proxy multiplexing                 HTTP/2 proxy demultiplexing
clients ─┐                                 client ══ 1 h2 connection ══▶ proxy ─┬─▶ backend (h1)
clients ─┼─▶ proxy ══ 1 h2 connection ══▶  (many streams)                     ├─▶ backend (h1)
clients ─┘          backend                                                 └─▶ backend (h1)
```

A proxy like Envoy can accept many HTTP/1.1 client connections and multiplex them into a few HTTP/2 connections to the backend, or accept one HTTP/2 connection and spread its streams over several HTTP/1.1 backend connections.

**Trade-off:** multiplexing saves connections (fewer handshakes, less memory, fewer ports), but one connection carries all the load: one slow consumer, one TCP packet loss ([head-of-line blocking](/protocols/http#http-2)) or one CPU core parsing frames can limit everything on it.

::: tip Real world
- gRPC between microservices: one HTTP/2 connection carries thousands of concurrent calls.
- Envoy/Istio upgrading old HTTP/1.1 services to HTTP/2 between pods without touching application code.
- A database proxy (PgBouncer) multiplexing thousands of app connections onto a few Postgres connections.
:::

## Connection Pooling

> Open a fixed set of connections up front, lend one to each request, and return it when done, instead of opening and closing a connection per request.

```js
import pg from 'pg';

// 20 connections opened lazily and reused for every query
const pool = new pg.Pool({ max: 20, idleTimeoutMillis: 30_000 });

app.get('/orders/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  res.json(rows[0]);
}); // the connection goes back to the pool automatically
```

A new Postgres connection costs a TCP handshake, a TLS handshake, authentication and a forked backend process on the server: often more time than the query itself. A pool pays that once. When all connections are busy, the next request waits in the pool's queue.

::: tip Real world
- Every ORM (Prisma, Hibernate, SQLAlchemy) pools DB connections. HTTP clients pool too (Node's `Agent` with `keepAlive`, Java `HttpClient`).
- Serverless (Lambda) can open one connection per function instance and exhaust Postgres `max_connections` during a traffic spike: put RDS Proxy or PgBouncer in front.
:::

::: warning Gotcha
Pool size × number of app instances must stay below what the database allows. 30 pods × 20 connections = 600 Postgres connections, and Postgres degrades well before that. Bigger pools are often slower.
:::

## Stateful vs Stateless

> A stateless backend can serve any request without remembering previous ones: all state lives in the request or in shared storage. A stateful backend keeps state in its own memory and depends on it.

The test: **can you restart the server and the client never notices?** If yes, it is stateless.

```text
Stateful: session stored in server memory
  login on server A → session in A's RAM → next request hits server B → "please log in"

Stateless: session stored outside the process
  login on any server → session in Redis (or a signed token) → any server can read it
```

A system is rarely stateless as a whole: the state just moves to a database, a cache or the client (a cookie or a JWT). Protocols have the same split: TCP is stateful (connection state, sequence numbers), UDP is stateless; HTTP is stateless, but cookies add state on top.

**Stateless** servers scale horizontally (add instances behind a load balancer, kill any of them). **Stateful** servers are faster for some workloads (game servers, in-memory caches, WebSocket connections) but need sticky routing and careful failover.

::: tip Real world
- A REST API on Kubernetes autoscaling from 3 to 30 pods: possible only because sessions live in Redis or JWTs.
- A multiplayer game server keeps the match in memory: it is stateful by design, and losing it ends the match.
- Uploading files to local disk on one pod is hidden state: the next request on another pod cannot find the file. Use S3.
:::

## Sidecar Pattern

> Move cross-cutting networking (TLS, retries, routing, metrics, auth) out of the application into a separate process that runs next to it and proxies its traffic.

Every language needs its own HTTP library, retry logic, TLS config and tracing. A sidecar does it once, in one place, for every service:

```text
pod ─────────────────────────────────────────────────────────
│ app (any language)  ── plain HTTP on localhost ──▶ sidecar proxy (Envoy) ══ mTLS, retries, metrics ══▶ other pod's sidecar ─▶ app
──────────────────────────────────────────────────────────────
```

**Pros:** language-agnostic, upgrade the networking layer without redeploying apps, consistent observability and security, protocol upgrades (h1 → h2) for free.
**Cons:** an extra hop on every request (latency), more processes to run and debug, and the whole mesh is complex to operate.

::: tip Real world
- Service meshes: Istio and Linkerd inject an Envoy/linkerd2-proxy sidecar into every Kubernetes pod to provide mutual TLS between services.
- Log shippers (Fluent Bit) running as a sidecar that tails the app's log files.
- Dapr sidecars giving any language the same pub/sub and state APIs.
:::
