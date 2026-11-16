# WebSockets, gRPC & WebRTC

Protocols for the cases plain request-response does not fit: two-way real-time, typed service-to-service calls, and peer-to-peer media.

## WebSockets

> A full-duplex, message-based channel over one TCP connection, started as an HTTP request that is "upgraded". Either side can send at any time.

```http
GET /chat HTTP/1.1
Host: chat.example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==

HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

After the `101`, both sides exchange framed messages (text or binary) plus ping/pong for keep-alive.

```js
// Browser
const ws = new WebSocket('wss://chat.example.com/chat');
ws.onmessage = (e) => showMessage(JSON.parse(e.data));
ws.send(JSON.stringify({ room: 'general', text: 'hi' }));

// Node (ws library)
wss.on('connection', (socket, req) => {
  socket.on('message', (raw) => broadcast(req.user.room, raw));
});
```

**Pros:** real-time in both directions, low per-message overhead, works on port 443 through most firewalls.
**Cons:** the connection is **stateful**, so scaling needs sticky routing and a shared bus (Redis Pub/Sub, NATS) to reach users on other servers; proxies must support the upgrade and long timeouts; you must handle reconnects, heartbeats and backpressure yourself.

::: tip Real world
- Chat (Slack, Discord), live collaboration cursors, trading screens, multiplayer browser games, live auctions.
- Behind a load balancer, see [WebSocket Proxying](/proxying/proxies#websocket-proxying).
- If data only flows server → client, [SSE](/communication/polling-sse#server-sent-events) is simpler.
:::

::: warning Gotcha
Browsers do not apply CORS to WebSockets. Check the `Origin` header on the upgrade request yourself, or any site can open a socket with your user's cookies (cross-site WebSocket hijacking).
:::

## gRPC

> Remote procedure calls defined in a `.proto` schema, serialized with protobuf and carried over HTTP/2, with generated clients in every language.

```proto
syntax = "proto3";

service Orders {
  rpc GetOrder (GetOrderRequest) returns (Order);
  rpc WatchOrder (GetOrderRequest) returns (stream OrderEvent); // server streaming
}

message GetOrderRequest { int64 id = 1; }
message Order { int64 id = 1; string status = 2; repeated Item items = 3; }
```

One schema generates the server interface and type-safe clients for Go, Java, Node, Python…, so services in different languages agree on the contract. It supports four call types: unary, server streaming, client streaming and bidirectional streaming, plus deadlines and cancellation propagated across services.

**Pros:** compact binary payloads, one multiplexed HTTP/2 connection, strong contracts, streaming built in.
**Cons:** browsers cannot speak it directly (need gRPC-Web or a gateway), binary messages are harder to inspect, schema evolution needs discipline (never reuse field numbers), and L7 load balancing is required because one long-lived connection carries all calls.

::: tip Real world
- Internal microservice traffic at Google, Netflix, Uber; Kubernetes and etcd APIs.
- A mobile app talking to its backend with generated clients instead of hand-written JSON parsing.
- Public APIs usually stay REST/JSON; gRPC lives behind the gateway.
:::

::: warning Gotcha
An L4 load balancer spreads *connections*, not *calls*. With gRPC, one client connection sticks to one backend pod and new pods get no traffic. Use an L7 proxy (Envoy) or client-side load balancing.
:::

## WebRTC

> Real-time audio, video and data directly between two peers (usually browsers), over UDP, after a signaling server helps them find each other.

The hard problem is that both peers sit behind NAT and do not know their public address:

```text
1. Signaling (your server, any channel, e.g. a WebSocket):
   A ── offer (SDP: codecs, media) ──▶ server ──▶ B
   A ◀── answer (SDP) ─────────────── server ◀── B
2. ICE: each peer gathers candidates (local IP, public IP from a STUN server, relay address from a TURN server)
3. Peers try the candidate pairs; media flows peer-to-peer over UDP (encrypted with DTLS/SRTP)
4. If direct fails (symmetric NAT, strict firewall) → traffic goes through the TURN relay
```

**Pros:** lowest latency (no server in the media path), built into every browser, encrypted by default.
**Cons:** complex (SDP, ICE, STUN, TURN), TURN relays cost bandwidth, and pure peer-to-peer does not scale past a few participants. Large calls use an **SFU** (selective forwarding unit) server that each peer sends to once.

::: tip Real world
- Google Meet, Discord voice, WhatsApp web calls, telehealth video, screen sharing tools.
- Cloud gaming and remote desktop streaming, and data channels for peer-to-peer file transfer.
- Group calls with 50 people run through an SFU (LiveKit, mediasoup, Janus), not a mesh.
:::
