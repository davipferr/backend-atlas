// Single source of truth for the site structure.
// Used by the sidebar (config.mts) and by the concept index loader (features.data.ts).

export interface Page {
  text: string
  link: string
}

export interface Section {
  text: string
  icon: string
  description: string
  items: Page[]
}

export const sections: Section[] = [
  {
    text: 'Communication Patterns',
    icon: '📡',
    description: 'How clients and backends talk: request-response, push, polling, SSE, pub/sub, multiplexing, state and sidecars.',
    items: [
      { text: 'Request-Response, Push & Async', link: '/communication/request-response' },
      { text: 'Polling, Long Polling & SSE', link: '/communication/polling-sse' },
      { text: 'Publish-Subscribe', link: '/communication/pubsub' },
      { text: 'Multiplexing, State & Sidecars', link: '/communication/connections-state' }
    ]
  },
  {
    text: 'Protocols',
    icon: '🔌',
    description: 'The wire under your API: OSI, IP, UDP, TCP, TLS, HTTP/1.1, HTTP/2, HTTP/3, WebSockets, gRPC and WebRTC.',
    items: [
      { text: 'Protocol Basics, OSI & IP', link: '/protocols/basics' },
      { text: 'UDP & TCP', link: '/protocols/udp-tcp' },
      { text: 'TLS, Keys & Certificates', link: '/protocols/tls' },
      { text: 'HTTP/1.1, HTTP/2 & HTTP/3', link: '/protocols/http' },
      { text: 'WebSockets, gRPC & WebRTC', link: '/protocols/websockets-grpc-webrtc' }
    ]
  },
  {
    text: 'Many Ways to HTTPS',
    icon: '🔐',
    description: 'Counting round trips: TLS 1.2, TLS 1.3, QUIC, TCP Fast Open and 0-RTT, and what each costs before the first byte.',
    items: [{ text: 'HTTPS Handshakes Compared', link: '/https/handshakes' }]
  },
  {
    text: 'Execution Patterns',
    icon: '🧵',
    description: 'Processes, threads, how the kernel hands connections to your code, threading models, idempotency and Nagle.',
    items: [
      { text: 'Processes & Threads', link: '/execution/processes-threads' },
      { text: 'Accepting & Reading Connections', link: '/execution/connections' },
      { text: 'Threading Execution Patterns', link: '/execution/threading-patterns' },
      { text: 'Idempotency & Nagle', link: '/execution/idempotency-nagle' }
    ]
  },
  {
    text: 'Proxying & Load Balancing',
    icon: '⚖️',
    description: 'Forward and reverse proxies, layer 4 vs layer 7 load balancers and proxying long-lived WebSocket connections.',
    items: [{ text: 'Proxies & Load Balancers', link: '/proxying/proxies' }]
  },
  {
    text: 'Backend in the Real World',
    icon: '🌍',
    description: 'The journey of a request, kernel connection queues, port exhaustion, graceful shutdown, JWT, COUNT(*) and OWASP.',
    items: [
      { text: 'The Journey of a Request', link: '/real-world/request-journey' },
      { text: 'Design Lessons & Case Studies', link: '/real-world/case-studies' },
      { text: 'Building Secure Backends', link: '/real-world/security' }
    ]
  }
]
