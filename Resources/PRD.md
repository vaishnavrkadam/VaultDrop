# Product Requirements Document (PRD)

## 1. Product Overview

### 1.1 Working Name

**VaultDrop**

A privacy-first, zero-knowledge platform for securely sharing text, source code, documents and files over the Internet.

The product is conceptually similar to PrivateBin, but its primary design goal is to eliminate the trust placed in the storage server and substantially improve secure file sharing, revocation, multi-party access, auditing and operational privacy.

### 1.2 Product Vision

VaultDrop should allow a user to securely share sensitive information without requiring the storage server to know:

* the plaintext content;
* the encryption keys;
* the password;
* the identity of recipients;
* which recipient successfully decrypted the content;
* the originating IP address, wherever technically and operationally avoidable;
* the contents of discussions;
* the contents or filenames of uploaded files.

The system should remain useful even when the storage server is considered **honest-but-curious, breached, compromised, malicious or legally compelled**.

### 1.3 Core Security Principle

The system must follow:

> **Compromise of the storage server must not automatically compromise previously encrypted content or future decryption keys.**

More specifically:

1. Encryption happens entirely on a trusted client.
2. The storage server receives ciphertext only.
3. The storage server never receives plaintext encryption keys.
4. The storage server must not be responsible for serving cryptographically trusted application code.
5. Cryptographic client releases must be independently signed and verifiable.
6. Sensitive operations should use authenticated cryptographic protocols rather than relying on URL secrecy.
7. Metadata collection must be minimized.
8. Revocation must be cryptographically enforced, not merely implemented as a UI feature.

---

# 2. Problems Being Solved

## 2.1 URL-as-the-key problem

PrivateBin places the decryption key in the URL fragment. PrivateBin documents that publicly sharing such a URL exposes the paste unless an additional password is used.

VaultDrop should not make possession of a URL equivalent to possession of the decryption key.

A URL should contain only a random, non-secret object identifier or capability identifier.

The decryption capability should instead be obtained through one or more of:

* recipient-specific encrypted key envelopes;
* independently entered passwords;
* invitation codes;
* authenticated recipient identities;
* M-of-N key shares;
* locally stored keys;
* hardware-backed credentials.

For anonymous one-time sharing, a capability URL may still optionally be supported, but the architecture must treat the URL as a **locator/capability**, not as the cryptographic root key.

---

# 3. Security Architecture

## 3.1 Separate Client and Server Trust Domains

The most important architectural change is:

```text
             TRUSTED DOMAIN
        ┌──────────────────────┐
        │ VaultDrop Client     │
        │                      │
        │ Encryption           │
        │ Decryption           │
        │ Key management       │
        │ Rendering            │
        │ File processing      │
        └──────────┬───────────┘
                   │
                   │ ciphertext only
                   ▼
        ┌──────────────────────┐
        │ Untrusted Server     │
        │                      │
        │ API                  │
        │ Metadata             │
        │ Ciphertext           │
        │ Blob storage         │
        └──────────────────────┘
```

The server must not be able to replace the cryptographic client with malicious code.

### Recommended implementation

The primary client should be distributed as:

* signed desktop application;
* signed mobile application;
* optionally a browser extension;
* optionally a web client with independently verifiable signed releases.

The web interface should be considered a convenience client, not the strongest security boundary.

A high-security user should be able to use a signed client whose cryptographic code is not downloaded from the storage server.

---

# 4. Threat Model

The system must explicitly defend against:

### T1 — Malicious storage administrator

The administrator can:

* read the database;
* read object storage;
* modify ciphertext;
* delete ciphertext;
* inspect API requests;
* inspect metadata available to the server;
* attempt to correlate requests.

The administrator must not be able to decrypt stored content.

### T2 — Database compromise

An attacker obtains the entire database.

Expected result:

* no plaintext;
* no encryption keys;
* no passwords;
* no recipient private keys;
* no plaintext discussions.

### T3 — Object-storage compromise

An attacker obtains every encrypted file.

Expected result:

* ciphertext only.

### T4 — Malicious server response

The server attempts to send modified data.

The client must:

* authenticate ciphertext;
* verify signatures/MACs;
* reject tampered metadata;
* never execute server-provided executable content as trusted application code.

### T5 — Malicious server JavaScript

The strongest security requirement is:

> A compromised storage server must not be able to inject JavaScript that captures plaintext or cryptographic keys.

This is why the cryptographic client must not depend on arbitrary JavaScript served by the storage server.

### T6 — Network observer

Network observers should not see plaintext.

TLS is still mandatory because encryption at rest does not protect request metadata.

### T7 — Malicious recipient

The system cannot prevent an authorized recipient from photographing a screen, copying plaintext or using another device.

The system should therefore provide:

* dynamic watermarks;
* session identifiers;
* recipient identifiers;
* screenshot awareness where supported;
* copy/download restrictions where technically possible.

These must never be marketed as absolute screenshot prevention.

### T8 — Legal/administrative compulsion

The server should minimize stored information.

However, the product must explicitly state that it cannot mathematically guarantee protection against every infrastructure provider, reverse proxy, hosting provider or network operator that may independently maintain logs.

---

# 5. Cryptographic Design

## 5.1 Data Encryption

Use modern authenticated encryption.

Recommended baseline:

**AES-256-GCM**

Alternative:

**XChaCha20-Poly1305**

The implementation should use a well-reviewed cryptographic library rather than implementing cryptographic primitives.

Every encrypted object must have:

```text
ciphertext
nonce
authentication tag
algorithm/version
key identifier
associated data version
```

## 5.2 Envelope Encryption

Each share should have a randomly generated content encryption key:

```text
CEK = random 256-bit key
```

The CEK encrypts:

* text;
* file chunks;
* discussion messages;
* attachment metadata.

The CEK itself is never stored in plaintext on the server.

---

# 6. URL Design

A share URL should look conceptually like:

```text
https://share.example/s/7Jk29...
```

The URL should contain:

* opaque share ID;
* optionally a short-lived capability token.

It should NOT contain the raw CEK.

For anonymous sharing, an optional high-entropy capability can be supported, but it should be separate from the object identifier.

Example:

```text
https://share.example/s/OBJECT_ID

decryption capability:
stored locally / password-derived / recipient envelope
```

---

# 7. Password Protection

Passwords must never be transmitted to the server.

Recommended flow:

```text
password
   │
   ▼
Argon2id
   │
   ▼
password-derived key
   │
   ▼
wrap CEK
```

The server stores only:

* salt;
* KDF parameters;
* encrypted key envelope.

The plaintext password must never enter server application memory.

---

# 8. Multi-Party Decryption

## 8.1 M-of-N Requirement

The system should support:

```text
2 of 3
3 of 4
3 of 5
4 of 7
...
```

Do not create a separate encryption key for every participant.

Instead:

```text
                    CEK
                     │
             Shamir Secret Sharing
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
    Share A        Share B        Share C
```

For a 3-of-4 policy:

```text
A ──┐
B ──┼──► CEK
C ──┤
D ──┘
```

Any three shares reconstruct the CEK.

Any two shares reveal nothing useful about the CEK, assuming a correct secret-sharing implementation.

## 8.2 Participant Keys

Each participant should have an asymmetric identity key.

Recommended:

* Ed25519 for signatures;
* X25519 for key agreement.

Private keys should be generated and stored on the client.

Where possible:

* Secure Enclave;
* Android Keystore;
* TPM;
* hardware security key.

---

# 9. Emergency Revocation

Revocation must be cryptographically meaningful.

The sender can select:

**Revoke Share**

The server then marks the share revoked and refuses future key-envelope retrieval.

For active sessions, the client should periodically obtain a signed authorization state.

Example:

```text
Share
  │
  ├── authorization epoch 41
  │
  └── session starts
          │
          ▼
     client periodically checks
          │
          ▼
       epoch 42
          │
          ▼
        revoked
```

The client must immediately destroy:

* plaintext cached content;
* temporary decrypted files;
* content encryption keys in application memory where practical;
* session authorization material.

### Important limitation

Once a recipient has already obtained plaintext, revocation cannot make that plaintext cease to exist.

Therefore:

> Revocation controls future access, not previously copied information.

---

# 10. Emergency Break-Glass Access

Break-glass is useful but dangerous because it introduces an additional trust path.

It should therefore **not** simply be:

```text
Admin YubiKey → decrypt everything
```

Instead use a separate recovery threshold.

Example:

```text
Normal:
3-of-4 recipients

Emergency:
2-of-3 recovery trustees
+
hardware-backed authentication
+
mandatory audit
```

A YubiKey should authenticate the authorized recovery operator, not directly contain the master plaintext encryption key.

Recommended architecture:

```text
              Recovery Secret
                    │
            Secret Sharing
             /      |      \
            A       B       C
            │       │       │
          Trustee Trustee Trustee
```

Break-glass requires:

* authorized operator;
* hardware-backed authentication;
* required recovery threshold;
* reason code;
* explicit confirmation;
* immutable audit event;
* notification to configured team members.

---

# 11. Audit Logging

Audit logs must be divided into:

### Security Audit Events

Examples:

* share created;
* share revoked;
* recipient added;
* recipient removed;
* M-of-N policy changed;
* break-glass initiated;
* break-glass completed;
* recovery failed.

### Privacy-Sensitive Access Logs

Avoid storing:

* IP addresses;
* User-Agent;
* Referer;
* plaintext share IDs where unnecessary;
* exact access timestamps unless required.

The product should provide configurable privacy modes.

### Maximum Privacy Mode

```text
No persistent IP logging
No persistent User-Agent logging
No persistent Referer logging
Minimal access counters
Short-lived operational telemetry
```

Rate limiting should use short-lived or privacy-preserving identifiers where practical.

The product must not claim that it can prevent logging by infrastructure outside its control.

---

# 12. File Sharing

Unlike a traditional pastebin, VaultDrop is a secure file-transfer platform.

Supported content:

* TXT
* Markdown
* JSON
* XML
* CSV
* source code
* images
* PDFs
* office documents
* archives
* arbitrary binary files.

## 12.1 Recommended File Size

The architecture should support configurable limits rather than a single hardcoded maximum.

Suggested initial deployment:

```text
Anonymous share:
1 GB

Authenticated/team share:
5–10 GB

Enterprise/self-hosted:
configurable
```

These are product defaults, not cryptographic limitations.

Large files should use:

* chunked encryption;
* resumable uploads;
* resumable downloads;
* streaming encryption;
* integrity verification.

Example:

```text
File
 │
 ├── Chunk 001 → encrypted
 ├── Chunk 002 → encrypted
 ├── Chunk 003 → encrypted
 └── Chunk N   → encrypted
```

The server never receives the plaintext chunks.

---

# 13. Chunk Encryption

Each file receives a file-specific key derived from the CEK.

Conceptually:

```text
CEK
 │
 └── HKDF
       │
       └── File Encryption Key
```

Each chunk receives a unique nonce.

Associated data should bind:

```text
share_id
file_id
chunk_index
encryption_version
```

This prevents chunk substitution and reordering.

---

# 14. File Metadata Privacy

Filenames can contain sensitive information.

Therefore filenames should also be encrypted.

The server should ideally see only:

```text
file_id
encrypted_size
chunk_count
creation/expiry metadata required for storage
```

Optionally even file size can be padded to reduce metadata leakage.

---

# 15. Discussions

Preserve PrivateBin's discussion feature.

Each comment should be encrypted client-side.

Comments should support:

* anonymous participants;
* optional nickname;
* authenticated participants;
* encrypted timestamps where practical;
* deletion;
* moderation by authorized team members.

PrivateBin supports discussions and multiple discussion modes, so this feature remains part of feature parity.

---

# 16. Expiration

Support:

* 5 minutes;
* 15 minutes;
* 30 minutes;
* 1 hour;
* 6 hours;
* 12 hours;
* 1 day;
* 3 days;
* 1 week;
* 1 month;
* custom expiration;
* never.

Expiration must be enforced by the server for storage deletion and by clients for access authorization.

---

# 17. Burn After Reading

Preserve the feature but redesign it carefully.

PrivateBin has historically had edge cases around burn-after-reading behavior and incorrect-password access, and browser caching can complicate one-time viewing.

VaultDrop should use:

```text
REQUEST
   │
   ▼
short-lived access lease
   │
   ▼
client obtains encrypted data
   │
   ▼
client successfully authenticates/decrypts
   │
   ▼
server consumes lease
   │
   ▼
share becomes unavailable
```

Additionally:

* `Cache-Control: no-store`
* `Pragma: no-cache`
* restrictive browser storage policy;
* no plaintext localStorage;
* no plaintext IndexedDB;
* memory-only decrypted content where practical.

The client should explicitly distinguish:

1. URL opened;
2. ciphertext downloaded;
3. password accepted;
4. content successfully authenticated;
5. content rendered.

Burn-after-reading should occur at the defined security event, preferably successful authorization/decryption rather than merely opening the URL.

---

# 18. Screenshot / Screen-Capture Awareness

Provide a **Protected Viewing Mode**.

Features:

* dynamic watermark;
* share ID;
* recipient/session identifier;
* timestamp;
* optional organization identifier;
* diagonal repeating watermark for highly sensitive documents.

Example:

```text
CONFIDENTIAL
Session: 7F2A91
Recipient: Engineering-03
2026-08-20 20:31
```

Where platform APIs support screen-capture detection, the client may:

* blur content;
* display warning;
* terminate session;
* revoke session;
* record a security event.

The product must explicitly state:

> Screenshot prevention is not guaranteed. A user can photograph a screen with another device.

---

# 19. WebRTC Transfer

WebRTC should be treated as a **Phase 3 / stretch feature**.

Important architectural correction:

WebRTC does not eliminate the need for signaling.

Therefore support:

```text
Browser A
   │
   │ signaling
   ▼
Rendezvous service
   │
   ▼
Browser B

After connection:

Browser A ═══════════ Browser B
          encrypted P2P
```

The rendezvous service should see only signaling metadata.

For maximum privacy, support manual signaling through:

* QR code;
* copy/paste;
* local network discovery.

WebRTC should transfer already-encrypted chunks where practical.

---

# 20. PrivateBin Feature Parity

VaultDrop must include:

| PrivateBin capability | VaultDrop       |
| --------------------- | --------------- |
| Text paste            | Yes             |
| Source code           | Yes             |
| Markdown              | Yes             |
| Syntax highlighting   | Yes             |
| Password protection   | Yes             |
| File upload           | Yes             |
| Image preview         | Yes             |
| PDF preview           | Yes             |
| Discussions           | Yes             |
| Expiration            | Yes             |
| Burn after reading    | Yes, redesigned |
| QR codes              | Yes             |
| Themes                | Yes             |
| Localization          | Yes             |
| Anonymous sharing     | Yes             |
| API                   | Yes             |
| Delete/revoke         | Yes             |
| Custom deployment     | Yes             |
| Open source           | Yes             |
| Encrypted storage     | Yes             |
| Zero-knowledge server | Stronger        |
| M-of-N decryption     | Yes             |
| Emergency revocation  | Yes             |
| Break-glass           | Yes             |
| Protected viewing     | Yes             |
| P2P/WebRTC            | Phase 3         |

PrivateBin currently lists these major capabilities, including file upload, previews, expiration, discussions, Markdown, syntax highlighting and QR codes.

---

# 21. User Experience

## Create Share

User sees:

```text
┌──────────────────────────────────────┐
│ What do you want to share?           │
│                                      │
│ [ Text ] [ Files ] [ Folder ]        │
│                                      │
│ Drop files here                      │
│                                      │
│ Expiration: [ 7 days ▼ ]             │
│                                      │
│ Password: [ Optional ]               │
│                                      │
│ Access:                               │
│ ○ Anyone with capability             │
│ ○ Specific recipients                │
│ ○ M-of-N team access                 │
│                                      │
│ [ Create Secure Share ]              │
└──────────────────────────────────────┘
```

## Share Result

Display:

```text
Share created successfully.

Share ID:
7J92K...

Access:
3 of 4 recipients

Expires:
20 Aug 2026 20:00

[Copy Share Link]
[Show QR Code]
[Manage Access]
[Revoke Share]
```

---

# 22. Recipient Experience

Recipient opens the share.

The client:

1. retrieves encrypted metadata;
2. verifies server response;
3. obtains the appropriate encrypted key envelope;
4. authenticates the recipient;
5. reconstructs the CEK if threshold access is required;
6. decrypts locally;
7. renders content.

No plaintext is sent back to the server.

---

# 23. API Requirements

REST or equivalent API.

Core endpoints:

```text
POST   /v1/shares
GET    /v1/shares/{id}
DELETE /v1/shares/{id}

POST   /v1/shares/{id}/authorize
POST   /v1/shares/{id}/revoke

POST   /v1/shares/{id}/recipients
DELETE /v1/shares/{id}/recipients/{id}

POST   /v1/shares/{id}/comments
GET    /v1/shares/{id}/comments

POST   /v1/shares/{id}/break-glass
GET    /v1/shares/{id}/audit

POST   /v1/uploads
POST   /v1/uploads/{id}/chunks
POST   /v1/uploads/{id}/complete
```

The API must never expose plaintext content.

---

# 24. Administrative Console

Administrators should manage:

* storage;
* quotas;
* retention;
* rate limits;
* abuse controls;
* user/team accounts;
* recovery trustees;
* audit configuration;
* server health;
* storage backends.

Administrators must not have a "decrypt content" button in normal operation.

---

# 25. Privacy Modes

### Maximum Privacy

* no persistent IP logs;
* no analytics;
* no third-party JavaScript;
* no third-party fonts;
* no external images;
* minimal metadata;
* encrypted audit logs.

### Standard

Adds operational telemetry without content telemetry.

### Enterprise

Allows organization-controlled:

* identity;
* audit;
* retention;
* compliance;
* SSO;
* hardware-backed authentication.

---

# 26. Security Headers

The service must use strict security headers, including appropriate:

* CSP;
* HSTS;
* X-Content-Type-Options;
* Referrer-Policy;
* Permissions-Policy;
* frame restrictions;
* cache-control.

The strongest client must not depend on server-controlled JavaScript.

---

# 27. Content Rendering Security

Markdown and HTML rendering must be isolated.

Never render uploaded HTML directly into the privileged application context.

Use:

* sanitization;
* isolated iframe/sandbox where required;
* strict CSP;
* trusted rendering libraries;
* no inline executable JavaScript.

Uploaded SVG, HTML, PDF and office content must be treated as potentially hostile.

---

# 28. Abuse Protection

Zero-knowledge must not mean zero abuse protection.

Implement:

* request rate limiting;
* upload quotas;
* storage quotas;
* anonymous share quotas;
* configurable proof-of-work or CAPTCHA-style challenge;
* abuse reporting without decrypting content;
* automatic expiry.

Rate limiting should avoid persistent IP storage where possible.

---

# 29. Storage Architecture

Recommended:

```text
                 ┌──────────────┐
                 │ PostgreSQL   │
                 └──────┬───────┘
                        │
                 encrypted metadata
                        │
                        ▼
                 ┌──────────────┐
                 │ API Server   │
                 └──────┬───────┘
                        │
                        ▼
                 ┌──────────────┐
                 │ S3/MinIO     │
                 │ ciphertext   │
                 └──────────────┘
```

The object store must contain ciphertext only.

---

# 30. Technology Recommendation

## Backend

Recommended:

**Go**

Reasons:

* strong concurrency model;
* easy deployment;
* static binaries;
* good networking;
* suitable cryptographic libraries;
* low operational overhead.

Alternative:

Rust if the team has strong Rust expertise.

## Database

**PostgreSQL**

## Object Storage

S3-compatible:

* AWS S3;
* MinIO;
* Cloudflare R2;
* self-hosted object storage.

## Client

Web:

* TypeScript;
* React;
* Web Crypto API where appropriate.

Desktop:

* Tauri preferred over Electron for a smaller security footprint.

Mobile:

* native Android/iOS or a carefully designed cross-platform client.

## Cryptography

Use established libraries.

Do not implement:

* AES;
* ChaCha20;
* Argon2;
* Ed25519;
* X25519;
* Shamir secret sharing

from scratch.

---

# 31. Non-Functional Requirements

### Security

* No known critical vulnerabilities.
* Mandatory authenticated encryption.
* Mandatory TLS.
* Cryptographic versioning.
* Key rotation support.
* Replay protection.
* Tamper detection.

### Performance

Target:

* 1 GB upload without browser freezing;
* resumable uploads;
* streaming encryption;
* parallel chunk transfer.

### Availability

The server should tolerate:

* database restart;
* object-storage interruption;
* API instance failure.

WebRTC is an optional mechanism for transfers when the server is unavailable.

### Scalability

Architecture should support:

```text
10K shares
100K shares
1M+ shares
```

without requiring architectural changes.

---

# 32. MVP

MVP should NOT attempt to implement every advanced feature.

### MVP must include

* text sharing;
* encrypted file sharing;
* password protection;
* expiration;
* revocation;
* burn after successful decryption;
* encrypted discussions;
* anonymous sharing;
* recipient-specific sharing;
* secure client;
* PostgreSQL;
* S3-compatible storage;
* API;
* CLI;
* QR code;
* Markdown;
* syntax highlighting;
* previews;
* privacy-preserving logs.

### Phase 2

* M-of-N;
* hardware-backed recipient identity;
* protected viewing;
* encrypted audit;
* organization/team accounts;
* advanced revocation;
* recovery trustees.

### Phase 3

* break-glass;
* WebRTC;
* offline/P2P transfer;
* hardware security key workflows;
* enterprise SSO;
* advanced compliance controls.

---

# 33. Acceptance Criteria

The project is not considered secure merely because the database contains encrypted data.

It must pass these tests:

### Server compromise test

An attacker with:

* database;
* object storage;
* API server;
* server configuration

must not be able to decrypt a previously created share.

### Malicious-server test

A malicious server must not be able to replace the trusted client cryptographic code and capture a key.

### URL test

Possession of a normal share URL must not automatically reveal the encryption key.

### Revocation test

After revocation, a new recipient session must fail.

### M-of-N test

N-1 shares must be insufficient to reconstruct the secret.

### Break-glass test

Recovery requires all configured authorization controls.

### Tampering test

Modified ciphertext must fail authentication.

### Chunk test

Missing, reordered or modified chunks must be detected.

### Burn test

Opening the URL without successful authorization must not consume a protected share.

### Privacy test

Normal server logs must not contain plaintext, passwords or encryption keys.

### Screenshot test

Protected viewing must clearly state that screenshot prevention is best-effort.

---

# 34. Product Security Statement

The product should advertise:

> **Your data is encrypted before it leaves your device. The storage server stores ciphertext, not your plaintext or encryption keys.**

It should NOT advertise:

> "Nobody can ever know you accessed a file."

or:

> "Screenshots are impossible."

or:

> "The server cannot be compelled to provide any metadata."

Those claims cannot be guaranteed by the application alone.

---

# 35. Fundamental Design Decision

The most important decision in this PRD is:

> **Do not reproduce PrivateBin's browser trust model.**

The server should be treated as untrusted infrastructure.

The cryptographic client should be independently distributed, versioned, signed and auditable.

That is the architectural improvement that makes this project substantially more secure rather than merely adding features to PrivateBin.
