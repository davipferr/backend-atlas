# HTTP/1.1, HTTP/2 & HTTP/3

Three generations of the same semantics (methods, headers, status codes), each fixing the previous one's transport bottleneck.

## HTTP/1.1

> A text protocol: one request at a time per connection, headers as plain lines, and keep-alive to reuse the TCP connection.

```http
POST /orders HTTP/1.1
Host: api.example.com
Content-Type: application/json
Content-Length: 41
Authorization: Bearer eyJhbGciOi…

{"items":[{"sku":"A-1","qty":2}]}

HTTP/1.1 201 Created
Content-Type: application/json
Location: /orders/42
Content-Length: 27

{"id":42,"status":"placed"}
```

What it brought over 1.0: **persistent connections** (keep-alive by default), the mandatory `Host` header (many sites on one IP), chunked transfer encoding (stream a response of unknown length), caching headers (`ETag`, `Cache-Control`).

**Limits:**
- **One outstanding request per connection.** Pipelining exists but is broken in practice, so browsers open ~6 connections per host and developers used to bundle files and shard domains.
- **Head-of-line blocking at the application level**: a slow response blocks the next one on that connection.
- **Verbose, repeated headers** (cookies, user agent) on every request, uncompressed.

::: tip Real world
- Still the default between a reverse proxy and most backends, and for simple webhooks and internal tools.
- A page that loads 80 assets is limited by those ~6 connections: the network waterfall in DevTools shows the queueing.
- Text is easy to debug: `curl -v`, or even `nc`, shows exactly what was sent.
:::

## HTTP/2

> Binary framing that multiplexes many requests as independent streams over one TCP connection, with compressed headers.

```text
one TCP connection
  ├─ stream 1: HEADERS(GET /app.js)   DATA … DATA
  ├─ stream 3: HEADERS(GET /app.css)  DATA
  └─ stream 5: HEADERS(POST /api)     DATA … DATA     ← frames interleaved on the wire
```

- **Multiplexing:** requests do not wait for each other; no need for 6 connections or bundling tricks.
- **HPACK header compression:** repeated headers are sent as small table indexes.
- **Stream priorities and flow control** per stream.
- Requires TLS in browsers, negotiated with ALPN (`h2`).

**Cons:** still TCP, so **one lost packet stalls every stream** (TCP head-of-line blocking), which hurts on lossy mobile networks. More CPU to parse frames and manage streams, and server push (one of its features) was a failure and is removed from browsers.

::: tip Real world
- Every major CDN and browser uses it; gRPC is built on it.
- A dashboard firing 50 API calls at once runs them in parallel on one connection.
- Enabling it is often one line: `listen 443 ssl; http2 on;` in nginx.
:::

## HTTP/3

> HTTP over QUIC: streams are handled by a transport on top of UDP, so a lost packet only stalls its own stream, and the handshake merges transport and TLS.

QUIC moves what TCP and TLS did into one protocol in user space:

- **Independent streams:** packet loss on stream 3 does not block stream 5. No TCP head-of-line blocking.
- **Faster setup:** transport + TLS 1.3 handshake in **1 round trip**, and 0-RTT on resumption (see [Many Ways to HTTPS](/https/handshakes#https-over-quic-http-3)).
- **Connection migration:** a connection is identified by a **connection ID**, not the IP/port 4-tuple, so switching from Wi-Fi to 4G keeps the connection alive.
- QPACK header compression (HPACK adapted for out-of-order streams).

**Cons:** UDP is blocked or throttled on some corporate networks (browsers fall back to HTTP/2), more CPU than kernel TCP, and middleboxes cannot inspect it, which some operators dislike.

The server advertises support with a header like `alt-svc: h3=":443"`; the browser tries QUIC on the next connection.

::: tip Real world
- Google, YouTube, Meta and Cloudflare serve a large share of traffic over HTTP/3. It shines for mobile users on unstable networks.
- A video call or file download surviving the move from home Wi-Fi to the street.
- Turning it on at the edge (Cloudflare, a CDN, Caddy, nginx `listen 443 quic`) while the backend stays HTTP/1.1 is the usual setup.
:::
