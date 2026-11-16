# Design Lessons & Case Studies

How to approach a backend design, and real cases where the fundamentals in this atlas decided the outcome.

## How I Design Software

> Start from the problem and the user experience, then pick communication patterns and protocols that fit, and only then the tools. Understand every layer you choose.

A practical order of questions:

1. **What does the client experience?** Interactive (needs ms), background (minutes are fine), real-time (push)?
2. **Who talks to whom, and how often?** That picks the [communication pattern](/communication/polling-sse#choosing-a-real-time-pattern): request-response, polling, SSE, WebSockets, pub/sub.
3. **What protocol carries it?** HTTP/1.1, HTTP/2, gRPC, QUIC, raw TCP or UDP, judged on its [properties](/protocols/basics#protocol-properties).
4. **Where does state live?** Can any instance serve any request?
5. **What happens when a part fails or is slow?** Timeouts, retries, idempotency, queues.
6. **Only then:** frameworks, databases, cloud services.

Avoid copying architectures from big companies by default: microservices, Kafka and service meshes solve their scale problems and bring operational cost you may not need.

::: tip Real world
- A booking system for a clinic: plain request-response + Postgres + a job queue for reminders. No Kafka.
- A live sports app: the same API, plus SSE for scores because the data flows one way and fans out to many readers.
:::

## How ChatGPT Uses Server Sent Events

> LLM chat apps stream the answer token by token over SSE: the request is a normal POST, and the response is an event stream that stays open until the answer ends.

```http
POST /v1/chat/completions
Content-Type: application/json

{"model":"…","stream":true,"messages":[{"role":"user","content":"Explain TCP"}]}

HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"choices":[{"delta":{"content":"TCP"}}]}

data: {"choices":[{"delta":{"content":" is a"}}]}

data: [DONE]
```

Why SSE fits: the data flows one way, the client already speaks HTTP (auth headers, CDNs, load balancers just work), and the user sees the first words in under a second instead of waiting for the full answer. Because the browser's `EventSource` only supports GET, these apps read the stream with `fetch` and a `ReadableStream`.

Trade-offs observed: each answer holds a connection open for many seconds (capacity planning counts concurrent streams, not requests per second), and buffering proxies break the effect.

::: tip Real world
- Any feature that streams progress: AI answers, log tailing, import progress, build output.
- See [Server Sent Events](/communication/polling-sse#server-sent-events) for the protocol details.
:::

## JSON Web Token (JWT), Its Pros and Cons

> A JWT is a signed, self-contained token (`header.payload.signature`). Any server with the key can verify it without a database lookup, which also means it cannot easily be revoked.

```text
eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiI0MiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTczMDAwMDAwMH0 . 3f9a…
  header (alg)           payload: { "sub": "42", "role": "admin", "exp": 1730000000 }   signature
```

The payload is only **Base64-encoded, not encrypted**: anyone can read it. The signature (HMAC with a shared secret, or RSA/ECDSA with a key pair) proves it was not changed.

**Pros:**
- Stateless: no session store, any service verifies it locally. Good across microservices and domains.
- Carries claims (user ID, roles, tenant) with the request.

**Cons:**
- **Revocation is hard:** a stolen or logged-out token stays valid until `exp`. You end up with short-lived access tokens + refresh tokens, or a deny list (which brings back state).
- Size: big tokens sent on every request.
- Easy to misuse: accepting `alg: none`, mixing HMAC and RSA keys, storing it in `localStorage` (readable by any XSS).

::: tip Real world
- Access tokens from an OAuth/OIDC provider (Auth0, Cognito, Keycloak) verified by every API with the provider's public keys (JWKS).
- A classic single web app on one domain is often simpler and safer with a server session in an `HttpOnly` cookie.
- Access token for 5–15 minutes, refresh token rotated and stored server side so it can be revoked.
:::

## SELECT COUNT(*) Can Impact Your Backend Performance

> Counting rows in a large table is not free: it scans the table or an index on every call. A count shown on every page load can become your slowest query.

In Postgres, MVCC means each row's visibility depends on the transaction, so `COUNT(*)` must check rows (an index-only scan helps only when the visibility map is up to date). In a table with 50 million rows, that is seconds of I/O per call, repeated for every user.

Options:

- **Do you need the exact number?** Show "1,000+" or use estimates: `SELECT reltuples FROM pg_class WHERE relname = 'orders'`.
- **Avoid counts for pagination:** use cursor ("keyset") pagination and a "next" link instead of "page 1 of 48,213".
- **Keep a counter:** update it with the writes (a counters table, Redis `INCR`) or cache the count for a minute.
- Count with a selective `WHERE` on an indexed column, not the whole table.

::: tip Real world
- An admin dashboard calling `COUNT(*)` on `events` on every refresh, slowing down the database for every customer.
- "Unread notifications" badges: maintain the counter on insert/read instead of counting on every page load.
:::

## Postgres Failure Caused by a Cisco Router

> A real incident: connections between the app and Postgres broke because a network device in the middle mishandled TCP. The database was fine; the transport between them was not.

The pattern of the case: queries hung or failed on a path that crossed a router/firewall, while the same queries worked from elsewhere. The device was interfering with the TCP connection (for example, dropping long-lived idle connections from its state table, or mishandling TCP options or sequence numbers), so one side kept sending into a connection the other side no longer had.

Lessons that apply to any backend:

- **Middleboxes have state and opinions.** Firewalls, NAT gateways and load balancers silently drop idle TCP connections after a timeout (AWS NAT: 350 s), and the app only learns about it on the next query.
- **TCP keepalives** (`tcp_keepalives_idle` in Postgres, `keepAlive` in drivers) keep idle connections alive and detect dead ones.
- **Look below the app:** when errors depend on the network path, capture packets (`tcpdump`, Wireshark) on both sides and compare.
- Pool settings like max idle time and connection validation turn a hang into a quick reconnect.

::: tip Real world
- Lambda or a container pool reusing a Postgres connection that sat idle for 10 minutes and hangs on the first query.
- "Connection reset by peer" errors only between two specific subnets: check the firewall's idle timeout.
:::
