# Publish-Subscribe

Decoupling services: producers publish to a broker, consumers subscribe, and neither knows the other exists.

## Publish Subscribe (Pub/Sub)

> Publishers write messages to a topic on a broker. Any number of subscribers read from that topic, each at its own pace. The publisher does not wait for them.

Request-response between services creates chains: if the upload service calls compress, then format, then notification synchronously, the user waits for all of them and one slow service blocks everything.

```text
Request-response chain                  Pub/Sub
upload ─▶ compress ─▶ format ─▶ notify   upload ─▶ [topic: video.uploaded]
(user waits for the whole chain)                         ├─▶ compress service
                                                         ├─▶ thumbnail service
                                                         └─▶ analytics service
```

**Pros:**
- Scales to many receivers: adding a new consumer means subscribing, not changing the publisher.
- Great for microservices: services fail and deploy independently, and the broker buffers messages while a consumer is down.
- Loose coupling: the publisher only knows the topic.

**Cons:**
- **Delivery problems:** did the subscriber get it? Twice? Brokers offer at-least-once delivery, so consumers must handle duplicates.
- **Complexity:** you now operate a broker (Kafka, RabbitMQ, NATS, Google Pub/Sub, SNS), and debugging a flow across topics is harder than reading a call stack.
- **Push vs poll:** brokers that push can overwhelm a slow subscriber; brokers that are polled (Kafka) add latency and network chatter.

::: tip Real world
- An e-commerce `order.placed` event consumed by billing, inventory, email and the analytics warehouse.
- YouTube-style upload pipeline: one upload event fans out to transcoding at several resolutions, thumbnails and copyright checks.
- Redis Pub/Sub to broadcast a chat message to every WebSocket server, so users connected to different servers all see it.
:::

## Queue vs Topic <Badge type="tip" text="extra" />

> A queue gives each message to one consumer (work distribution). A topic gives each message to every subscriber group (fan-out).

| | Queue | Topic |
| --- | --- | --- |
| A message is read by | one worker | every subscriber (group) |
| Typical use | background jobs | events many systems care about |
| Examples | SQS, RabbitMQ queue, BullMQ | Kafka topic, SNS, RabbitMQ fanout exchange |

Kafka mixes both: inside one **consumer group** a partition goes to one consumer (queue behavior), and different groups each get every message (topic behavior).

::: tip Real world
- Queue: 50 workers sharing a backlog of "send welcome email" jobs.
- Topic: "user signed up" → the email service, the CRM sync and the fraud check all get it.
- SNS topic fanning out into several SQS queues is a classic AWS pattern for both at once.
:::

## Delivery Guarantees <Badge type="tip" text="extra" />

> At-most-once can lose messages, at-least-once can duplicate them, and exactly-once is mostly at-least-once plus deduplication.

- **At-most-once:** acknowledge before processing. A crash loses the message. Fine for metrics and logs.
- **At-least-once:** acknowledge after processing. A crash after the work but before the ack means the message is redelivered. The default for most systems.
- **Exactly-once (effectively):** at-least-once delivery + an [idempotent](/execution/idempotency-nagle#backend-idempotency) consumer (store processed message IDs, use upserts, or Kafka transactions).

::: tip Real world
A payment consumer that receives `charge.succeeded` twice must not ship the order twice: store the event ID in a `processed_events` table inside the same DB transaction as the order update.
:::

::: warning Gotcha
The "dual write" problem: saving to the database and publishing to the broker are two operations, and one can fail. The **outbox pattern** writes the event into an `outbox` table in the same transaction, and a relay publishes it afterwards.
:::
