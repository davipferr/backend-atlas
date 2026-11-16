# HTTPS Handshakes Compared

Every HTTPS request needs a transport connection and a TLS session before the first byte of HTTP. The protocol choices decide how many round trips (RTT) that costs.

## Counting Round Trips

> Latency is dominated by round trips, not bandwidth. The fewer RTTs before the request, the faster the first byte.

| Setup | RTTs before the HTTP request is sent |
| --- | --- |
| TCP + TLS 1.2 | 3 (1 TCP + 2 TLS) |
| TCP + TLS 1.3 | 2 (1 TCP + 1 TLS) |
| QUIC (HTTP/3) | 1 |
| TCP Fast Open + TLS 1.3 | 1 |
| TCP + TLS 1.3 with 0-RTT | 1 (TCP only) |
| QUIC with 0-RTT | 0 |

At 150 ms RTT (Brazil ↔ US East), going from 3 RTT to 1 RTT saves 300 ms on every new connection, which is more than most API handlers take to run.

::: tip Real world
- Users far from your region feel this first. A CDN or edge proxy close to them terminates TLS in a short RTT and keeps warm connections to your origin.
- Mobile apps that open a new connection per request pay the full handshake every time: reuse connections.
:::

## HTTPS over TCP with TLS 1.2

> One RTT for the TCP handshake, then two for TLS 1.2, before the request can be sent.

```text
client                                        server
  │── SYN ──────────────────────────────────▶ │   RTT 1 (TCP)
  │◀─ SYN-ACK ────────────────────────────── │
  │── ACK + ClientHello ────────────────────▶ │   RTT 2 (TLS)
  │◀─ ServerHello, Certificate, KeyExchange ─ │
  │── ClientKeyExchange, Finished ──────────▶ │   RTT 3 (TLS)
  │◀─ Finished ───────────────────────────── │
  │── GET /  (encrypted) ───────────────────▶ │   request finally sent
```

TLS 1.2 negotiates the cipher first and only then exchanges keys, which is why it needs the extra round trip. It still allows weak options (RSA key exchange, CBC ciphers) unless the server restricts them.

::: tip Real world
- Old clients, older Java and Android versions, and some corporate middleboxes still use it. Keep it enabled for compatibility, with modern ciphers only, and turn off TLS 1.0/1.1.
:::

## HTTPS over TCP with TLS 1.3

> TLS 1.3 sends the key share in the first message, so TLS needs one round trip instead of two: two RTTs in total.

```text
  │── SYN ─────────────────────────────────▶ │   RTT 1 (TCP)
  │◀─ SYN-ACK ───────────────────────────── │
  │── ACK + ClientHello + key share ───────▶ │   RTT 2 (TLS)
  │◀─ ServerHello + key share, {Cert, Fin} ─ │
  │── {Finished} + GET / ──────────────────▶ │   request goes with the last flight
```

The client guesses the key exchange group (X25519, almost always right) and sends its key share immediately. Only forward-secret key exchanges and AEAD ciphers remain, so it is both faster and safer.

::: tip Real world
- The default for modern browsers, curl, Node, Go and nginx with OpenSSL 1.1.1+. Check with `curl -v https://… 2>&1 | grep TLS`.
:::

## HTTPS over QUIC (HTTP/3)

> QUIC combines the transport and TLS 1.3 handshakes into one: the request goes after a single round trip.

```text
  │── Initial: QUIC hello + TLS ClientHello ─▶ │   RTT 1 (transport + TLS together)
  │◀─ Initial/Handshake: ServerHello, Cert ─── │
  │── Finished + GET / ─────────────────────▶ │
```

There is no separate TCP handshake because QUIC runs on UDP and carries the TLS messages inside its own packets.

::: tip Real world
- Big gains on high-latency and mobile connections. Turning HTTP/3 on at the CDN is usually a toggle. See [HTTP/3](/protocols/http#http-3).
:::

## HTTPS over TFO with TLS 1.3

> TCP Fast Open lets a returning client put data (the ClientHello) inside the SYN, so TCP and TLS overlap: one round trip.

On the first connection the server gives the client a TFO cookie. On later connections the client sends `SYN + cookie + ClientHello` together, and the server can answer with `SYN-ACK + ServerHello`.

```text
  │── SYN + TFO cookie + ClientHello ───────▶ │   RTT 1
  │◀─ SYN-ACK + ServerHello, {Cert, Fin} ──── │
  │── ACK + {Finished} + GET / ─────────────▶ │
```

::: tip Real world
- Supported by Linux (`net.ipv4.tcp_fastopen`) but rarely used on the open internet: middleboxes drop SYNs with data, and browsers disabled it. More useful inside controlled networks.
:::

## HTTPS over TCP with TLS 1.3 and 0-RTT

> A client that connected before can resume with a pre-shared key and send the HTTP request in its very first TLS flight ("early data"). Only the TCP RTT remains.

```text
  │── SYN ─────────────────────────────────▶ │   RTT 1 (TCP)
  │◀─ SYN-ACK ───────────────────────────── │
  │── ACK + ClientHello + PSK + GET / ─────▶ │   request sent with zero TLS round trips
```

::: warning Gotcha
Early data can be **replayed**: an attacker who records it can resend it, and the server may process it twice. Only allow 0-RTT for safe, idempotent requests (`GET`), never for `POST /payments`. Servers mark it with `Early-Data: 1` so the backend can reject it (`425 Too Early`).
:::

::: tip Real world
- Cloudflare and other CDNs enable 0-RTT for GET requests to speed up returning visitors.
:::

## HTTPS over QUIC with 0-RTT

> A returning client sends the QUIC hello, the TLS resumption and the HTTP request in the first packet: zero round trips before the request.

```text
  │── Initial (ClientHello + PSK) + 0-RTT: GET / ─▶ │   request in the first flight
  │◀─ Handshake + response data ────────────────── │
```

This is the fastest possible start, with the same replay caveat as TLS 0-RTT: idempotent requests only.

::: tip Real world
- A user reopening your mobile app gets the first API response within one RTT of tapping the icon.
:::
