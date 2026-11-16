# UDP & TCP

The two transport protocols almost everything runs on: one fast and simple, one reliable and stateful.

## UDP

> User Datagram Protocol: each message is an independent datagram with source and destination ports. No connection, no ordering, no retransmission, no flow control.

The header is only 8 bytes: source port, destination port, length, checksum. Sending is just "write a datagram"; there is no handshake, so the first message is the first byte on the wire.

**Pros:** tiny overhead, no connection state on the server (scales to millions of clients), low latency, supports broadcast and multicast.
**Cons:** packets can be lost, duplicated or reordered, there is no congestion control (a sender can flood the network), and it is easy to spoof the source IP, which enables amplification attacks.

Applications that need reliability build it on top: QUIC (and so HTTP/3) is reliable and runs on UDP.

::: tip Real world
- DNS queries: one small question, one small answer, retry on timeout.
- Video calls, live streaming, online games: a late packet is useless, so dropping it is better than waiting for a retransmission.
- Metrics (StatsD), syslog, VPNs (WireGuard), DHCP, and QUIC/HTTP/3.
:::

## TCP

> Transmission Control Protocol: a reliable, ordered, bidirectional byte stream between two ports, with flow control and congestion control.

TCP gives your app a **stream**, not messages: a `write()` of 10 KB can arrive as three `read()`s, or two writes as one read. Application protocols must define their own framing (HTTP's `Content-Length`, length prefixes).

What TCP guarantees, and how:

- **Reliability:** each byte has a sequence number; the receiver acknowledges (ACK) what it got; unacknowledged segments are retransmitted.
- **Ordering:** out-of-order segments are held until the gaps are filled.
- **Flow control:** the receiver advertises a **window** (free buffer space). The sender never sends more than that.
- **Congestion control:** the sender also limits itself by a congestion window that grows while ACKs arrive (slow start) and shrinks on loss, so the network is not overloaded.
- **Connection state:** the 4-tuple (source IP, source port, destination IP, destination port) identifies the connection, and both kernels keep state for it.

**Cons:** latency of the handshake, head-of-line blocking (one lost segment stalls everything after it), and per-connection memory on the server.

::: tip Real world
- HTTP/1.1, HTTP/2, database protocols (Postgres, MySQL, Redis), SSH, SMTP, Kafka: anything where losing or reordering a byte is unacceptable.
- A Redis client reading a 1 MB value gets it in many `read()` calls. Client libraries hide this; your own TCP protocol must handle partial reads.
:::

## TCP Handshake & Teardown

> A connection opens with three packets (SYN, SYN-ACK, ACK) and closes with FIN/ACK in each direction. The side that closes first waits in TIME_WAIT.

```text
Open (1 round trip before data)          Close
client           server                   A (closes first)      B
  │── SYN ──────▶ │  seq=x                  │── FIN ──────────▶ │
  │◀── SYN-ACK ── │  seq=y, ack=x+1         │◀── ACK ────────── │
  │── ACK ──────▶ │  ack=y+1                │◀── FIN ────────── │
  │== data ======▶│                         │── ACK ──────────▶ │
                                            TIME_WAIT (2×MSL, often 60 s)
```

The handshake agrees on initial sequence numbers and options (window scaling, MSS, SACK). TIME_WAIT keeps the 4-tuple reserved so late packets from the old connection are not mistaken for a new one.

::: tip Real world
- A client in São Paulo calling a server in Virginia (~120 ms RTT) pays 120 ms before sending a byte, plus TLS on top. That is why keep-alive, connection pools and CDNs at the edge matter.
- Thousands of short-lived outgoing connections leave thousands of sockets in TIME_WAIT and can [exhaust ephemeral ports](/real-world/request-journey#running-out-of-tcp-ports).
- `ss -tan state time-wait | wc -l` on Linux counts them.
:::

## Flow & Congestion Control <Badge type="tip" text="extra" />

> Flow control protects the receiver; congestion control protects the network. Together they decide how fast a connection can actually send.

The sender can have in flight at most `min(receiver window, congestion window)` bytes. A new connection starts with a small congestion window (about 10 segments ≈ 14 KB) and doubles it each round trip (**slow start**), so a fresh connection is slow for the first few round trips no matter how big the pipe is.

Throughput is bounded by `window / RTT`: a 64 KB window over a 100 ms link caps you at about 5 Mbit/s. Window scaling and large socket buffers fix that on long, fat links. Algorithms such as CUBIC (Linux default) and BBR (Google) decide how the window reacts to loss and delay.

::: tip Real world
- Why the first page load on a new connection is slow and why reused connections are fast: they are already past slow start.
- Copying a backup between regions that only reaches 30% of the link: check `tcp_rmem`/`tcp_wmem` buffer limits, or run parallel streams.
- Switching servers to BBR is a common win for video and large downloads over lossy mobile networks.
:::
