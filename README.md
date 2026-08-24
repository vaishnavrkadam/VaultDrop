# [ VAULTDROP ] - Zero-Knowledge Sharing Utility

VaultDrop is a modern, privacy-first, zero-knowledge platform for securely sharing sensitive text, source code, and arbitrary files online. It serves as an advanced, minimalist interpretation of the core problem addressed by PrivateBin, built on a contemporary monorepo architecture and designed with a geometric, cyber-technical user experience.

---

## 🛡️ Core Security Architecture

VaultDrop is designed around the fundamental principle that the storage server must be treated as **untrusted infrastructure**. 

1. **Client-Side Encryption (Zero-Knowledge)**: 
   All encryption and decryption happen fully within the trusted client domain (the user's browser). Plaintext payloads and content encryption keys (CEKs) are never sent to the server.
2. **URL-as-Key Hygiene**:
   For anonymous shares, the 256-bit CEK is stored in the URL hash fragment (`#key=...`). Since browsers do not transmit hash fragments to servers, the key never crosses the network boundary.
3. **Argon2id Password Wrapping**:
   Password-protected shares derive their envelope keys client-side using memory-hard Argon2id KDF. Passwords are never sent to the network, preventing brute-force attacks on the server.
4. **M-of-N Cryptographic Escrow (Shamir Secret Sharing)**:
   Supports splitting the CEK into $N$ Shamir shares, requiring $M$ participants to open their unique links to reconstruct the key. The server serves as a secure, authenticated escrow lobby.
5. **Physical Shredding & Erasure**:
   When a share is deleted, revoked, or burned (burn-after-reading), the server immediately executes physical redacting updates to wipe ciphertext and metadata, backed by SQLite/PostgreSQL foreign key cascades.

---

## 📦 Project Layout

VaultDrop is organized as an NPM workspaces monorepo:
* **`apps/web`**: Next.js 14 frontend web application.
* **`services/api`**: Express Node.js backend REST API.
* **`packages/crypto`**: Shared Web-Crypto & TweetNaCl helper package (Argon2id KDF, AES-256-GCM, Shamir SSS, HKDF).
* **`packages/ui`**: Shared React UI styled component library.

---

## 🚀 Installation & Local Setup

### Prerequisites
* **Node.js**: Version 18 or 20+
* **NPM**: Version 9+

### Quick Start
1. **Clone the Repository** and open the root workspace.
2. **Install Workspace Dependencies**:
   ```bash
   npm install
   ```
3. **Build Core Packages**:
   ```bash
   npm run build -w packages/crypto
   npm run build -w packages/ui
   ```
4. **Start Development Servers**:
   - Start backend API (port 3001):
     ```bash
     npm run dev:api
     ```
   - Start Next.js frontend (port 3000):
     ```bash
     npm run dev:web
     ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

VaultDrop features automated test suites for both its core cryptography library and backend database API:

### 1. Cryptographic Tests
Verifies mathematical correctness of random entropy, Argon2id key derivation, HKDF separations, AES-GCM wrapping, and Shamir Secret Sharing:
```bash
npm run build -w packages/crypto
npm run test -w packages/crypto
```

### 2. Backend Integration Tests
Tests database schema integrity, rate limit blocks, burn-after-reading lease consumption, and SQLite cascade deletes:
```bash
npm run test -w services/api
```

---

## ⚙️ Security Hardening Log

The following production-hardening security features were added during development:
1. **Helmet HTTP Headers**: Configured Express API with Helmet to set robust security headers (HSTS, Content Security Policy, XSS Protection, Frameguard).
2. **IP Rate Limiting**: Applied general rate limiters (300 requests / 15 minutes) and strict creation limiters (15 share posts / hour per IP) using `express-rate-limit`.
3. **Authenticated Escrow Lobbies**: Protected the M-of-N shares endpoint. A requester must now supply their own `shareIndex` and `secretShare` as proof of ownership to fetch the other shares from the server lobby.
4. **SQLite Cascade Deletes**: Configured `PRAGMA foreign_keys = ON;` to enforce cascade triggers on SQLite deletion leases, guaranteeing no orphan comments or share data are left in the database.
5. **Clean Shutdown Gracefulness**: Integrated a `closeDb` pool teardown in testing hooks to prevent Windows-specific libuv event loop race condition crashes.
