# Proxies & Load Balancers

Everything that sits between the client and your backend: who it works for, what layer it sees, and how it handles long-lived connections.

## Proxy

> A forward proxy acts for the **client**: the client connects to the proxy, and the proxy makes the request to the destination. The server sees the proxy's IP.

```text
client ──▶ proxy ──▶ google.com     (the client knows the destination; the server sees the proxy)
```

Uses: caching for many clients, filtering and logging outgoing traffic, anonymity, and egress control. For HTTPS, the client sends `CONNECT host:443` and the proxy just tunnels the encrypted bytes, unless it is configured to intercept TLS.

::: tip Real world
- Corporate networks forcing all traffic through a proxy that blocks some sites and logs requests.
- A backend calling partner APIs from a fixed egress IP (a NAT gateway or Squid) so the partner can allowlist it.
- Fiddler, Charles or mitmproxy on your machine to inspect what a mobile app sends.
:::

## Reverse Proxy

> A reverse proxy acts for the **servers**: the client connects to it thinking it is the server, and it forwards the request to one of the backends it chooses.

```text
client ──▶ api.example.com (reverse proxy) ──┬─▶ backend A
           (the client does not know          ├─▶ backend B
            which backend answers)            └─▶ backend C
```

What it gives you: **load balancing**, TLS termination, caching (a CDN is a geographically distributed reverse proxy), compression, rate limiting, routing by path to different services (an API gateway), canary deployments, and hiding the internal topology.

```nginx
upstream api {
  server 10.0.1.10:3000;
  server 10.0.1.11:3000;
}
server {
  listen 443 ssl;
  server_name api.example.com;
  location /api/ {
    proxy_pass http://api;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

::: tip Real world
- nginx, HAProxy, Envoy, Traefik, Caddy, AWS ALB, Cloudflare, Kubernetes Ingress controllers.
- Sending 5% of traffic to the new version of a service (canary) by weight at the proxy.
:::

::: warning Gotcha
Behind a reverse proxy, the client IP your app sees is the proxy's. Read `X-Forwarded-For` (Express: `app.set('trust proxy', 1)`), but only trust it from your own proxy, or clients can fake their IP and dodge rate limits.
:::

## Layer 4 Load Balancer

> Balances TCP/UDP **connections** using only IPs and ports. It does not read the data, so it is fast, protocol-agnostic and cannot route by URL.

When a connection arrives, the L4 balancer picks a backend and all packets of that connection go there (either it keeps state per connection or uses NAT/direct server return). It can pass TLS through untouched.

**Pros:** very fast, works for any protocol (Postgres, MQTT, SMTP, raw TCP), no TLS certificates needed on it, one connection maps to one backend.
**Cons:** no smart routing (path, header, cookie), no caching, no per-request balancing: one long-lived connection with many requests stays on one backend.

::: tip Real world
- AWS Network Load Balancer, Google TCP/UDP LB, HAProxy in `mode tcp`, Linux IPVS, Kubernetes `Service` of type `ClusterIP` (kube-proxy/iptables).
- Load balancing a Postgres read-replica pool or an MQTT broker cluster.
:::

## Layer 7 Load Balancer

> Terminates the connection, reads the HTTP request, and decides per **request** where it goes: by path, host, header, cookie or method.

```text
client ══ TLS ══▶ L7 LB (decrypts, reads "GET /images/…")
                   ├─ /api/*    → api service
                   ├─ /images/* → image service (cached)
                   └─ host: admin.example.com → admin service
```

**Pros:** smart routing, caching, auth at the edge, request-level balancing (great for HTTP/2 and gRPC), retries, header rewrites, observability per endpoint.
**Cons:** more CPU (TLS and parsing), must hold the TLS certificates (it sees plaintext), and it must understand the protocol.

::: tip Real world
- AWS ALB, GCP HTTPS LB, nginx, Envoy, Traefik, API gateways (Kong, AWS API Gateway).
- Routing `/v2/*` to a new service while `/v1/*` stays on the monolith during a migration.
- gRPC traffic needs L7 balancing to spread calls, as noted in [gRPC](/protocols/websockets-grpc-webrtc#grpc).
:::

## WebSocket Proxying

> WebSockets start as HTTP and then become a long-lived stateful connection. An L4 proxy passes it through blindly; an L7 proxy must understand the upgrade and keep the connection open.

```nginx
# L7 WebSocket proxying in nginx
location /ws/ {
  proxy_pass http://chat_backend;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 3600s;   # default 60 s would cut idle sockets
}
```

- **L4:** a tunnel from client to one backend. Simple and fast; the backend handles TLS and the upgrade.
- **L7:** the proxy handles TLS and the `Upgrade` handshake, can route `/chat` and `/feed` to different backends, authenticate the upgrade request, and then just shovels frames.

Either way, the connection lives on one backend for hours, so load does not rebalance when you add servers, and deploying a backend drops all its sockets (clients must reconnect with backoff).

::: tip Real world
- A chat service behind an AWS ALB: set the idle timeout above the client's ping interval, or sockets drop every 60 seconds.
- Rolling deploys of a WebSocket service cause a reconnect storm; add jitter to client reconnection.
:::
