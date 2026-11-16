# Protocol Basics, OSI & IP

How to judge any protocol, the layers that let a request cross the internet, and the IP packet that carries everything.

## Protocol Properties

> A protocol is a set of rules two parties agree on. You can compare any protocol by the same handful of properties.

| Property | Question | Examples |
| --- | --- | --- |
| **Data format** | Text or binary? Schema? | HTTP/1.1 and JSON are text; HTTP/2, protobuf, MessagePack are binary |
| **Transfer mode** | Message-based or a byte stream? | UDP and HTTP are messages; TCP is a stream (you must find the boundaries) |
| **Addressing** | Who is the destination? | IP address, port, MAC address, `Host` header, topic name |
| **Direction** | One-way, half duplex, full duplex? | HTTP/1.1 request-response vs WebSockets full duplex |
| **State** | Does it remember previous messages? | TCP and gRPC streams are stateful; UDP and HTTP are stateless |
| **Routing** | How does it reach the target? Through proxies and gateways? | IP routing, HTTP reverse proxies |
| **Flow & congestion control** | Can a fast sender drown the receiver or the network? | TCP has both; UDP has neither |
| **Error management** | Error codes, retries, timeouts? | HTTP status codes, TCP retransmission |

::: tip Real world
- Choosing between REST + JSON, gRPC + protobuf or a binary TCP protocol for an internal service is a choice on these properties: readability vs size and speed, browser support vs streaming.
- Debugging a "slow API" often ends at a property you did not pick on purpose: text parsing cost, no multiplexing, or a stateful connection pinned to one server.
:::

## OSI Model

> Seven layers, each solving one problem and relying on the layer below. Knowing the layer of a component tells you what it can see and do.

```text
7 Application   HTTP, gRPC, DNS, SMTP          ← your code, L7 load balancers, API gateways
6 Presentation  encoding, serialization (JSON)
5 Session       connection state, TLS*
4 Transport     TCP, UDP, QUIC — ports          ← L4 load balancers, NAT with ports
3 Network       IP — addresses, routing         ← routers
2 Data link     Ethernet frames, MAC addresses  ← switches
1 Physical      electric, light, radio signals  ← cables, fiber, Wi-Fi
```

A request goes **down** the layers on the sender (each adds its header: segment → packet → frame → bits) and **up** on the receiver (each removes its header). In practice, the TCP/IP model merges 5–7 into "application" (* TLS sits awkwardly between layers 4 and 7).

Why it matters: a **layer 4** device sees IPs and ports only and cannot read the URL; a **layer 7** device decrypts and reads the HTTP request, so it can route by path or header, cache and add auth, at the cost of terminating TLS.

::: tip Real world
- "Is it the network or the app?" — a `ping` (L3) that works and a `curl` (L7) that fails points at TLS, the proxy or your server, not the cable.
- An AWS Network Load Balancer (L4) vs an Application Load Balancer (L7): see [Layer 4 vs Layer 7](/proxying/proxies#layer-4-load-balancer).
- A Kubernetes NetworkPolicy works at L3/L4 (IP and port); an Istio AuthorizationPolicy can match L7 (HTTP path, method).
:::

## Internet Protocol (IP)

> IP moves packets from one address to another through routers, one hop at a time, with no guarantee of delivery, order or uniqueness.

An IPv4 address is 4 bytes (`192.168.1.10`). Its **network** part and **host** part are split by a subnet mask: `192.168.1.0/24` means the first 24 bits are the network, so 256 addresses share it. If the destination is in the same subnet, the host sends it directly (using ARP to find its MAC); otherwise it sends it to its **default gateway** (a router).

Key header fields:

- **Source / destination IP.**
- **TTL** (time to live): decremented at every router; at 0 the packet is dropped and an ICMP message goes back. `traceroute` uses this to map the path.
- **Protocol**: what is inside (6 = TCP, 17 = UDP, 1 = ICMP).
- **Total length / fragmentation**: packets larger than the link's **MTU** (usually 1500 bytes) must be fragmented or dropped.
- **ECN**: lets routers signal congestion without dropping packets.

**ICMP** carries control messages: "destination unreachable", "TTL exceeded", "fragmentation needed", and `ping`.

::: tip Real world
- Planning a VPC: `10.0.0.0/16` for the VPC, `/24` subnets per availability zone, private subnets for databases with no route to the internet.
- A VPN or tunnel adds headers and lowers the effective MTU: large responses silently hang while small ones work. If a firewall blocks ICMP "fragmentation needed", Path MTU discovery breaks ("MTU black hole").
- Private address ranges (`10/8`, `172.16/12`, `192.168/16`) behind NAT are why your laptop and a pod can share an address and still reach the internet.
:::

::: warning Gotcha
Blocking all ICMP "for security" breaks MTU discovery and makes debugging harder. Allow at least "fragmentation needed" and "TTL exceeded".
:::
