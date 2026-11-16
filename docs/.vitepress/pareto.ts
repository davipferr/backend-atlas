// The 80/20 path: the ~20% of the atlas that explains ~80% of what a developer who already
// writes APIs meets when building, running and debugging real backends.
//
// Every `features` entry is the exact title of a `## ` heading on that page.
// ParetoPath.vue resolves them against features.data.ts, so links and summaries stay
// in sync with the content (a title that no longer exists is flagged on the page).

export interface ParetoRead {
  page: string // page link, e.g. '/protocols/udp-tcp'
  features: string[] // concept titles on that page, in reading order
}

export interface ParetoStep {
  title: string
  goal: string // "Be able to…"
  why: string // why this is in the 20%
  reads: ParetoRead[]
}

export interface ParetoLater {
  page: string
  why: string
}

export const paretoSteps: ParetoStep[] = [
  {
    title: 'What a request really is',
    goal: 'Describe every step a request goes through before and after your handler runs.',
    why: 'Most "the API is slow" investigations end outside the handler. This mental model tells you where to look.',
    reads: [
      { page: '/communication/request-response', features: ['Request Response'] },
      { page: '/real-world/request-journey', features: ['The Journey of a Request to the Backend'] }
    ]
  },
  {
    title: 'The layers under HTTP',
    goal: 'Place any component (router, load balancer, proxy, your app) on the right layer and know what it can see.',
    why: 'Layers explain why some tools can route by URL and others cannot, and how to split "network problem" from "app problem".',
    reads: [{ page: '/protocols/basics', features: ['OSI Model'] }]
  },
  {
    title: 'TCP, the protocol under almost everything',
    goal: 'Explain the handshake, why new connections are slow and what TIME_WAIT is.',
    why: 'HTTP, databases, Redis and Kafka all ride on TCP. Connection cost is behind keep-alive, pools and many production incidents.',
    reads: [{ page: '/protocols/udp-tcp', features: ['TCP', 'TCP Handshake & Teardown'] }]
  },
  {
    title: 'HTTPS without the magic',
    goal: 'Explain what TLS protects, how certificates are checked and what a handshake costs in round trips.',
    why: 'Every public API is HTTPS. Certificate errors and handshake latency are daily realities.',
    reads: [
      { page: '/protocols/tls', features: ['TLS', 'Keys and Certificates'] }
    ]
  },
  {
    title: 'HTTP versions',
    goal: 'Know what HTTP/2 and HTTP/3 fix over HTTP/1.1 and when the difference matters.',
    why: 'Picking a protocol, configuring a proxy or a CDN, and understanding gRPC all depend on it.',
    reads: [{ page: '/protocols/http', features: ['HTTP/1.1', 'HTTP/2'] }]
  },
  {
    title: 'Getting news from the server',
    goal: 'Choose between polling, long polling, SSE and WebSockets for a real-time feature.',
    why: 'Notifications, progress bars, chat and AI streaming are in almost every product, and the wrong choice is costly to undo.',
    reads: [
      { page: '/communication/polling-sse', features: ['Server Sent Events', 'Choosing a Real-Time Pattern'] },
      { page: '/protocols/websockets-grpc-webrtc', features: ['WebSockets'] }
    ]
  },
  {
    title: 'Slow work belongs in the background',
    goal: 'Move long tasks to a queue and decouple services with events.',
    why: 'Keeps APIs fast and lets services fail independently. The basis of most scalable systems.',
    reads: [
      { page: '/communication/request-response', features: ['Asynchronous Backend Processing'] },
      { page: '/communication/pubsub', features: ['Publish Subscribe (Pub/Sub)'] }
    ]
  },
  {
    title: 'Scale out: state and connections',
    goal: 'Make a service stateless so any instance can serve any request, and reuse connections instead of opening new ones.',
    why: 'Horizontal scaling, autoscaling and zero-downtime deploys depend on it. Connection pools prevent the most common database meltdown.',
    reads: [
      { page: '/communication/connections-state', features: ['Stateful vs Stateless', 'Connection Pooling'] }
    ]
  },
  {
    title: 'What sits in front of your app',
    goal: 'Explain reverse proxies and pick an L4 or L7 load balancer.',
    why: 'Every production backend runs behind one. Its behavior explains client IPs, timeouts and routing.',
    reads: [
      { page: '/proxying/proxies', features: ['Reverse Proxy', 'Layer 4 Load Balancer', 'Layer 7 Load Balancer'] }
    ]
  },
  {
    title: 'How your server runs',
    goal: 'Explain processes vs threads, what an event loop does, and why one slow handler can freeze a Node server.',
    why: 'Choosing a runtime and diagnosing CPU or latency problems start here.',
    reads: [
      { page: '/execution/processes-threads', features: ['The Thread', 'When to Use Threads'] },
      { page: '/execution/threading-patterns', features: ['Single Listener, Acceptor and Reader Thread'] }
    ]
  },
  {
    title: 'Safe retries',
    goal: 'Make writes idempotent so retries never charge, ship or email twice.',
    why: 'Networks fail and everything retries: clients, proxies, queues. Without idempotency, failures become duplicate side effects.',
    reads: [{ page: '/execution/idempotency-nagle', features: ['Backend Idempotency'] }]
  },
  {
    title: 'Production habits',
    goal: 'Ship deploys without errors and close the most common security holes.',
    why: 'These are the problems that page you at night and the flaws attackers try first.',
    reads: [
      { page: '/real-world/request-journey', features: ['HTTP Graceful Connection Shutdown'] },
      {
        page: '/real-world/security',
        features: ['Validate All Input', 'Enforce Access Control on Every Request']
      }
    ]
  }
]

// The remaining ~80% of the atlas, grouped by page: read it when a real need shows up.
export const paretoLater: ParetoLater[] = [
  { page: '/execution/connections', why: 'Kernel queues and socket buffers matter when you tune a server under heavy load.' },
  { page: '/execution/threading-patterns', why: 'The other patterns explain how nginx, memcached and Envoy scale. Read it when you build or tune a high-throughput server.' },
  { page: '/https/handshakes', why: 'The individual handshakes matter when you optimize latency for distant or mobile users.' },
  { page: '/protocols/websockets-grpc-webrtc', why: 'gRPC and WebRTC are worth it once you build internal RPC or real-time media.' },
  { page: '/communication/connections-state', why: 'Multiplexing and sidecars come up with HTTP/2 proxies and service meshes.' },
  { page: '/real-world/case-studies', why: 'Case studies make the fundamentals stick. Read them when you meet a similar problem.' }
]
