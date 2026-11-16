# TLS, Keys & Certificates

How HTTPS keeps traffic private and proves the server is who it says it is.

## TLS

> Transport Layer Security encrypts a connection with a fast symmetric key, and uses asymmetric cryptography only to agree on that key and to authenticate the server.

Two kinds of encryption, two jobs:

- **Symmetric** (AES-GCM, ChaCha20): one shared key encrypts and decrypts. Very fast, used for all the actual data.
- **Asymmetric** (RSA, ECDSA, Diffie-Hellman): a public/private key pair. Slow, used only to exchange keys and to sign.

The handshake's goal is that both sides end with the same symmetric key without ever sending it:

```text
TLS 1.3 (1 round trip)
client                                         server
  │── ClientHello: ciphers, key share (DH) ──────▶ │
  │◀─ ServerHello: key share, certificate,         │
  │   signature, Finished (already encrypted) ──── │
  │── Finished + first HTTP request ─────────────▶ │
```

With **(EC)DHE** key exchange, each side combines its private value with the other's public value and gets the same secret. The keys are new for every connection, so stealing the server's private key later does not decrypt recorded traffic (**forward secrecy**). Old RSA key exchange (the client encrypts the key with the server's public key) has no forward secrecy and was removed in TLS 1.3.

TLS also uses **SNI** (the hostname in the ClientHello, so one IP can host many sites) and **ALPN** (negotiating `h2` or `http/1.1` during the handshake).

::: tip Real world
- Every HTTPS site, plus Postgres `sslmode=require`, Redis over TLS, SMTP STARTTLS, gRPC.
- TLS termination: the load balancer or nginx decrypts, and traffic to the backend is plain HTTP inside the private network (or re-encrypted for zero trust).
- Mutual TLS (mTLS): the client also presents a certificate. Used between microservices in a service mesh and for bank/payment APIs.
:::

## Keys and Certificates

> A certificate binds a public key to a domain name and is signed by a Certificate Authority the client already trusts. The private key never leaves the server.

```text
Root CA (in the OS / browser trust store, self-signed)
  └── signs → Intermediate CA
                └── signs → leaf certificate: "api.example.com", public key, valid until …
```

During the handshake the server sends its leaf certificate **and the intermediates** (the chain). The client checks:

1. Each signature up to a root it trusts.
2. The name matches the host it dialed (SAN field).
3. Dates are valid and the certificate is not revoked.
4. The server proves it holds the private key by signing the handshake.

A **self-signed** certificate has no chain to a trusted root, so clients reject it unless you install it manually.

::: tip Real world
- Let's Encrypt issues free 90-day certificates via the ACME protocol; Certbot, Caddy, Traefik or cert-manager on Kubernetes renew them automatically.
- "Works in the browser, fails in `curl`/Java": the server is not sending the intermediate certificate. Browsers sometimes fetch it; other clients do not.
- An expired certificate is one of the most common causes of full outages (it happened to Microsoft Teams, Spotify and others). Monitor expiry dates.
:::

::: warning Gotcha
Never commit private keys to git or bake them into Docker images. Store them in a secret manager, and turning off certificate verification (`rejectUnauthorized: false`, `verify=False`) "just for now" removes the protection TLS gives you.
:::
