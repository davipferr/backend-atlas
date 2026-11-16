# Idempotency & Nagle

Making retries safe, and the TCP optimization that can quietly add latency to every request.

## Backend Idempotency

> A request is idempotent when running it twice has the same effect as running it once. Since networks fail, clients and proxies retry, so anything that can be retried must be idempotent.

The trap: a client sends `POST /payments`, the server charges the card, and the response is lost. The client cannot tell "failed" from "succeeded but I did not hear back", so it retries, and the card is charged twice.

HTTP semantics help: `GET`, `PUT`, `DELETE` are defined as idempotent, `POST` is not. Browsers, proxies and SDKs will retry or prefetch `GET`, so a `GET` must never change state.

The standard fix is an **idempotency key**: the client generates a unique ID per operation and resends the same ID on retries.

```js
app.post('/payments', async (req, res) => {
  const key = req.header('Idempotency-Key');            // e.g. a UUID from the client
  const previous = await db.idempotency.find(key);
  if (previous) return res.status(previous.status).json(previous.body); // replay the stored result

  const charge = await psp.charge(req.body);             // the side effect happens once
  await db.idempotency.insert({ key, status: 201, body: charge }); // unique index on key
  res.status(201).json(charge);
});
```

Other techniques: upserts instead of inserts, unique constraints (`order_id` unique on shipments), conditional updates (`UPDATE … WHERE status = 'pending'`), and storing processed message IDs for queue consumers.

::: tip Real world
- Stripe, Adyen and most payment APIs require an `Idempotency-Key` header on POST.
- A queue consumer receiving the same `order.paid` message twice must not ship two packages.
- A double-click on "Place order" in a slow checkout page.
:::

::: warning Gotcha
Two requests with the same key can arrive at the same time. Insert the key first (with a unique constraint or a lock) and mark it "in progress", or both requests will pass the check and both will charge.
:::

## Nagle's Algorithm

> TCP's Nagle algorithm holds small writes in the buffer while earlier data is still unacknowledged, combining them into fuller segments. It saves packets and adds latency.

It was designed for terminals sending one keystroke per packet (40 bytes of headers for 1 byte of data). The rule: if there is unacknowledged data in flight, wait to send a small segment until the ACK arrives or a full segment is ready.

Combined with **delayed ACK** on the other side (the receiver waits up to ~40 ms hoping to piggyback the ACK), a request written in two small pieces can stall for tens of milliseconds:

```text
client write(headers) → sent
client write(body)    → held by Nagle (waiting for ACK)
server                → delays ACK (waiting for more data)    ← ~40 ms stall
```

Most latency-sensitive software disables it with `TCP_NODELAY`:

```js
const socket = net.connect(6379, 'redis.internal');
socket.setNoDelay(true); // Node HTTP servers and most clients already do this by default
```

::: tip Real world
- curl, Node, Go, Redis, Postgres drivers and gRPC all set `TCP_NODELAY` by default.
- A custom TCP protocol (game server, IoT gateway, internal RPC) with mysterious 40 ms latency spikes on small messages is a classic Nagle + delayed ACK interaction.
- The better fix is to write each message in one `write()` call (build the buffer first), which helps whether Nagle is on or off.
:::
