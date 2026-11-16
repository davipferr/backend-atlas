# Polling, Long Polling & SSE

Three ways to get "news" from the server using plain HTTP, from the crudest to the most efficient.

## Short Polling

> The client asks "anything new?" on a timer. The server answers right away, usually with "no".

```text
client: GET /jobs/r_91   → { status: "running" }
   … 2 s …
client: GET /jobs/r_91   → { status: "running" }
   … 2 s …
client: GET /jobs/r_91   → { status: "done", url: "…" }
```

**Pros:** trivial to build, works through any proxy or firewall, the server stays stateless, the client controls the pace.
**Cons:** most requests are wasted ("chatty"), each one costs bandwidth, TLS, parsing and a DB lookup, and updates arrive up to one interval late.

::: tip Real world
- Checking the status of a long job: a report export, a CI build, a payment that is "processing".
- Integrating with a third-party API that has no webhooks: poll every minute for new invoices.
- Good when updates are rare and a few seconds of delay is fine.
:::

::: warning Gotcha
1,000,000 clients polling every second is 1,000,000 requests per second of mostly empty answers. Add jitter and back off (2 s, 4 s, 8 s…) so clients do not all hit the server at the same moment.
:::

## Long Polling

> The client asks "anything new?" and the server holds the request open until there is something to say (or a timeout). Then the client immediately asks again.

```text
client: GET /messages?after=1050  ─┐
                                   │  server waits… (no answer yet)
                                   │  new message arrives
client: ◀── [ { id: 1051, … } ] ───┘
client: GET /messages?after=1051  ─┐  (re-asks immediately)
                                   │  … 30 s with nothing …
client: ◀── [] (timeout) ──────────┘
```

Same HTTP as polling, but almost no wasted requests and near real-time delivery. The client still decides when to ask (unlike push), so it cannot be flooded. The cost: a held request ties up a connection (and, on thread-per-request servers, a thread), and messages that arrive between two polls must be buffered by the server and fetched with a cursor (`after=1051`).

::: tip Real world
- Kafka consumers *long poll* the broker: `poll()` waits until records arrive or the timeout ends.
- AWS SQS "long polling" (`WaitTimeSeconds=20`) cuts empty responses and cost.
- Telegram bot `getUpdates`, older chat apps (early Facebook chat) before WebSockets were common.
:::

## Server Sent Events

> One long HTTP response that never ends. The server writes events into it as text lines, and the browser's `EventSource` reads them as they come.

```http
GET /events HTTP/1.1
Accept: text/event-stream

HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache

event: order-status
id: 1051
data: {"orderId":42,"status":"shipped"}

data: {"orderId":42,"status":"out-for-delivery"}
```

```js
// Browser: reconnects automatically and sends Last-Event-ID to resume
const events = new EventSource('/events');
events.addEventListener('order-status', (e) => render(JSON.parse(e.data)));

// Node server
app.get('/events', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  const send = (e) => res.write(`event: order-status\ndata: ${JSON.stringify(e)}\n\n`);
  bus.on('order-status', send);
  req.on('close', () => bus.off('order-status', send));
});
```

SSE is plain HTTP, so it works with existing load balancers, auth cookies and HTTP/2. It is **one-way** (server → client); the client talks back with normal requests.

**Limits:** text only; on HTTP/1.1 browsers allow about 6 connections per domain, so several open tabs can starve the page (HTTP/2 fixes this); each client holds an open connection on the server.

::: tip Real world
- ChatGPT and most LLM APIs stream tokens with SSE (see [How ChatGPT Uses SSE](/real-world/case-studies#how-chatgpt-uses-server-sent-events)).
- Live sports scores, stock tickers, delivery tracking, notification badges, build logs streaming in a CI dashboard.
- Pick SSE over WebSockets when the data flows one way: simpler, and HTTP infrastructure already understands it.
:::

::: warning Gotcha
Proxies that buffer responses (nginx `proxy_buffering on`, some CDNs) hold the events until the buffer fills, so the "stream" arrives in bursts. Disable buffering for SSE routes (`X-Accel-Buffering: no`).
:::

## Choosing a Real-Time Pattern <Badge type="tip" text="extra" />

> Match the pattern to who talks, how often, and how fresh the data must be.

| Need | Pick |
| --- | --- |
| Rare updates, delay of seconds is fine | Short polling |
| Near real-time over strict HTTP infrastructure, client controls the pace | Long polling |
| Server → client stream (feeds, tokens, progress) | Server Sent Events |
| Both sides talk often, low latency (chat, games, collaborative editing) | [WebSockets](/protocols/websockets-grpc-webrtc#websockets) |
| Server → another server when something happens | Webhooks (an HTTP request to a URL the other side registered) |
| Peer-to-peer audio, video, game state | [WebRTC](/protocols/websockets-grpc-webrtc#webrtc) |

::: tip Real world
A delivery app can mix all of them: the courier app sends GPS over a WebSocket, the customer page follows the courier with SSE, the restaurant integration gets webhooks, and an old POS system polls every 30 seconds.
:::
