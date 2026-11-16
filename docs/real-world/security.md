# Building Secure Backends

The OWASP recommendations that matter most for backend code: trust nothing from outside, check every permission, and make attacks visible.

## Validate All Input

> Treat everything from outside (body, query, headers, cookies, files, webhooks) as hostile. Validate type, length, format and range at the edge, and reject what does not match.

Prefer an allowlist (what is accepted) over a denylist (what is blocked). Validate on the server even if the front end validates too: anyone can call your API with `curl`.

```js
import { z } from 'zod';

const CreateUser = z.object({
  email: z.string().email().max(254),
  name: z.string().min(1).max(100),
  age: z.number().int().min(13).max(120)
}).strict();                                  // reject unknown fields (no "role": "admin" sneaking in)

app.post('/users', (req, res) => {
  const input = CreateUser.safeParse(req.body);
  if (!input.success) return res.status(400).json({ errors: input.error.issues });
  // …
});
```

Also limit request **size** (body, uploads, JSON depth) so a single request cannot exhaust memory.

::: tip Real world
- Mass assignment: a signup endpoint that copies `req.body` into the user record lets an attacker send `"isAdmin": true`.
- File uploads: check the real content type and size, store outside the web root, rename files.
:::

## Prevent Injection

> Never build queries or commands by concatenating user input. Use parameterized queries, safe APIs and output encoding so data can never become code.

```js
// ❌ SQL injection: id = "1 OR 1=1" returns every row
db.query(`SELECT * FROM orders WHERE id = ${req.params.id}`);

// ✅ Parameterized: the driver sends the value separately from the SQL
db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);

// ❌ Command injection: filename = "a.png; rm -rf /"
exec(`convert ${filename} out.jpg`);
// ✅ No shell, arguments as an array
execFile('convert', [filename, 'out.jpg']);
```

The same idea applies to NoSQL queries, LDAP, templates (server-side template injection) and HTML output (XSS): encode for the context where the data lands.

::: tip Real world
- Injection is still in the OWASP Top 10 because of raw SQL in "just this one report query".
- ORMs protect you until someone uses their raw query escape hatch with string interpolation.
:::

## Authentication and Session Management

> Store passwords with a slow, salted hash, protect sessions and tokens, and make login hard to brute force.

- Hash passwords with **Argon2id, bcrypt or scrypt**, never MD5/SHA-256 alone and never reversible encryption.
- Rate-limit login and password reset, and offer MFA.
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`), rotated after login.
- Tokens: short expiry, verified signature and algorithm, audience and issuer checked (see [JWT](/real-world/case-studies#json-web-token-jwt-its-pros-and-cons)).
- Generic error messages ("invalid email or password") so attackers cannot enumerate accounts.

::: tip Real world
- Credential stuffing: attackers try leaked email/password pairs from other sites. Rate limits per IP and per account, plus breached-password checks, stop most of it.
- Prefer a proven provider or library (OIDC, Auth0, Keycloak, Devise, Spring Security) over hand-rolled auth.
:::

## Enforce Access Control on Every Request

> Authentication says who the user is; authorization decides what they may do. Check ownership and role on the server for every object, every time.

The most common API flaw (OWASP API #1, broken object level authorization):

```js
// ❌ Any logged-in user can read any invoice by changing the ID
app.get('/invoices/:id', auth, async (req, res) => {
  res.json(await db.invoices.find(req.params.id));
});

// ✅ Scope the query to what the user owns
app.get('/invoices/:id', auth, async (req, res) => {
  const invoice = await db.invoices.findOne({ id: req.params.id, accountId: req.user.accountId });
  if (!invoice) return res.sendStatus(404);
  res.json(invoice);
});
```

Deny by default, centralize checks (middleware, policies), and never trust IDs or roles sent by the client.

::: tip Real world
- Multi-tenant SaaS: every query must filter by tenant. Postgres row-level security adds a second line of defense.
- Sequential IDs (`/orders/1001`, `/orders/1002`) make enumeration trivial; UUIDs help but do not replace the check.
:::

## Protect Data and Secrets

> Encrypt in transit (TLS everywhere), protect sensitive data at rest, keep secrets out of code, and return only the fields the client needs.

- TLS for every hop, including internal services and the database connection.
- Secrets in a secret manager (Vault, AWS Secrets Manager) or injected env vars, never in git, images or logs.
- Don't serialize whole DB rows: password hashes, internal flags and other users' data leak through "convenient" responses.
- Minimize what you store; encrypt or tokenize the sensitive parts (documents, card data).

::: tip Real world
- AWS keys pushed to a public GitHub repo are found by bots within minutes. Enable secret scanning and rotate on any leak.
- Logging full request bodies writes passwords and card numbers into your log platform.
:::

## Rate Limiting and Resource Limits

> Limit how much any client can consume: requests per time window, payload sizes, query complexity and timeouts. Without limits, one client can take the whole service down.

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
server {
  location /api/login { limit_req zone=api burst=5 nodelay; }
  client_max_body_size 2m;
}
```

Apply limits per IP, per user and per API key; return `429 Too Many Requests` with `Retry-After`; set timeouts on every outgoing call so a slow dependency cannot hold all your threads.

::: tip Real world
- Protecting a login or SMS-sending endpoint from abuse (each SMS costs money).
- GraphQL APIs need depth and cost limits: one nested query can ask for millions of rows.
:::

## Security Logging and Dependency Hygiene

> You cannot respond to attacks you cannot see, and most code you run is someone else's. Log security events and keep dependencies patched.

- Log logins, failures, permission denials, admin actions and input validation errors, with user, IP and request ID, without secrets.
- Alert on anomalies (spikes of 401/403, many password resets).
- Track vulnerable dependencies (`npm audit`, Dependabot, Snyk) and update regularly; pin versions with lockfiles.
- Show generic errors to clients, keep stack traces in logs only.

::: tip Real world
- Log4Shell (2021): one logging library made millions of Java backends remotely exploitable. Teams with a dependency inventory patched in hours.
- Without a request ID in every log line, reconstructing what an attacker did across services is guesswork.
:::
