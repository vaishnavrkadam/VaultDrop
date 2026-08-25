# VaultDrop

Zero-knowledge, privacy-first secure sharing utility for text, source code, and arbitrary files with E2E encrypted rooms and multi-party cryptographic escrow.

[Demo](https://vaultdrop.vercel.app) [Video](https://github.com/vaishnavrkadam/VaultDrop/raw/main/Resources/Ledger%20Brandbook%20-%20Brave%202026-08-21%2015-12-21.mp4) [Repository](https://github.com/vaishnavrkadam/VaultDrop)

## Overview
VaultDrop is a modern, privacy-first, zero-knowledge platform designed for securely sharing sensitive text, source code, documents, and arbitrary files online. Drawing conceptual inspiration from PrivateBin, VaultDrop reimagines file-sharing security by treating the storage server as entirely untrusted infrastructure. It is built on a contemporary NPM workspaces monorepo architecture, combining a Next.js 14 frontend web app with a TypeScript Express backend and dedicated, auditable libraries.

## Problem
Traditional pastebin and file-sharing solutions suffer from critical architectural weaknesses:
* **URL-as-Key Exposure**: Storing encryption keys directly in the URL hash fragment (`#key=...`) makes key protection depend entirely on URL secrecy. Possession of the URL equals possession of the content.
* **Server-Side Trust**: Many platforms serve dynamic, untrusted JavaScript directly from the API server, enabling a compromised server to inject malicious scripts and intercept plaintexts or encryption keys.
* **Data Erasure Integrity**: "Burn-after-reading" features are often fragile, triggering deletions on raw HTTP GET requests (before decryption succeeds) or leaving cached traces.
* **Coarse Access Controls**: Inability to restrict shares to specific authorized recipient identities or implement multi-party escrow logic (M-of-N secret sharing).

## Target Users
* **Security & Privacy Professionals**: Users requiring zero-trust metadata minimisation and cryptographically verifiable data destruction.
* **Software Engineers & DevOps**: Teams securely sharing source code, logs, configuration files, and secrets.
* **Corporate & Legal Operators**: Users needing authorized multi-party escrow, emergency revocation, and break-glass capabilities.
* **General Public**: Users seeking anonymous, secure sharing without server tracking or account requirements.

## Solution
VaultDrop separates the trusted client domain from untrusted server infrastructure. Encryption and decryption occur fully client-side. The server only sees ciphertext and minimal, non-identifying metadata. For authenticated shares, access is controlled via client-side identity keypairs, multi-party Shamir Secret Sharing, or password-derived wrapping (using memory-hard Argon2id), ensuring that server compromise does not compromise data.

## Key Features
* **Zero-Knowledge Core**: All data is encrypted/decrypted in-browser using Web Crypto APIs (AES-256-GCM) before upload.
* **E2E Encrypted Vault Rooms & Chat**: Real-time group chat and file sharing where all messages are signed and encrypted client-side.
* **Argon2id KDF Password Wrapping**: Memory-hard key derivation ensures brute-force resistance.
* **M-of-N Cryptographic Escrow**: Split the content encryption key (CEK) into \(N\) Shamir shares, requiring \(M\) participants to reconstruct it.
* **Identity Key Sync & Recovery**: Secure account recovery using client-side identity key agreement (X25519) and envelope synchronization.
* **Physical Shredding & Erasure**: Cascading SQLite/PostgreSQL foreign key constraints to physically delete all comments and ciphertexts upon revocation.

## Accessibility
### Accessibility Goals
VaultDrop targets compliance with WCAG 2.1 AA guidelines, ensuring the secure sharing tool remains usable by individuals with diverse visual, motor, and cognitive abilities. We aim for full keyboard navigability, high-contrast clarity, and screen-reader compatibility across all critical flows (creation, access, and room collaboration).

### Accessibility Features
* **Keyboard-Only Traversal**: All interactive controls, dropdowns, and buttons support standard focus rings and keyboard triggers.
* **Semantic HTML Markup**: Explicit usage of landmarks (`<main>`, `<nav>`, `<header>`), header hierarchies, and labels.
* **ARIA Attributes**: Integrated `aria-hidden` attributes for geometric lines and decorative SVG icons to prevent screen-reader clutter.
* **Cinematic High Contrast**: Optimized light/dark themes offering text-to-background contrast ratios exceeding 4.5:1.
* **Screen Reader Labels**: Clearly described dynamic elements, such as file-upload progress bars and copy-to-clipboard alerts.

### Accessibility Testing
* **Manual Audits**: Step-by-step navigation testing using keyboard-only input (Tab, Enter, Space).
* **Screen Reader Validation**: Verification of visual states and screen reader descriptions using NVDA and VoiceOver.
* **Automated Checking**: Chrome DevTools Lighthouse accessibility scoring, maintaining a target rating above 95/100.

## What Makes This Different
| Feature | Traditional Pastebins | PrivateBin | VaultDrop |
| :--- | :--- | :--- | :--- |
| **Trust Model** | Trust the server | Trust server JS | Independent, verifiable client boundaries |
| **URL Security** | Plaintext or hash key | Hash key (raw) | Locators only; cryptographic separation |
| **Authentication** | Server-side logins | None / Password | Client-side Identity Keys (X25519/Ed25519) |
| **Multi-Party Share** | No | No | Shamir Secret Sharing (M-of-N) |
| **Recovery** | Email reset (server knows) | None | Sync via encrypted Escrow Envelopes |
| **Discussion** | Plaintext / Database | Encrypted | E2E signed & encrypted comments |

## How It Works
```
                  SENDER (Trusted Client)                     UNTRUSTED SERVER
                ┌────────────────────────┐                ┌──────────────────────┐
                │ 1. Generate CEK        │                │                      │
                │ 2. Encrypt Content     ├── Ciphertext ──>   PostgreSQL / SQLite│
                │ 3. Wrap CEK via KDF    │                │   (Opaque Metadata)  │
                │ 4. Derive Envelopes    │                └──────────┬───────────┘
                └────────────────────────┘                           │
                                                                 Ciphertext
                                                                     │
                 RECIPIENT (Trusted Client)                          ▼
                ┌────────────────────────┐                ┌──────────────────────┐
                │ 1. Download Ciphertext <────────────────┤   Object Storage     │
                │ 2. Unwrap/Decrypt CEK  │                │   (Encrypted Chunks) │
                │ 3. Verify Signature    │                └──────────────────────┘
                │ 4. Render Plaintext    │
                └────────────────────────┘
```
1. **Key Generation**: The client generates a cryptographically random Content Encryption Key (CEK) locally.
2. **Encryption**: Content is encrypted client-side using AES-256-GCM. Filenames and MIME-types are encrypted as well.
3. **Escrow / Wrapping**: The CEK is wrapped:
   * *For password shares*: Derived via Argon2id client-side.
   * *For recipient shares*: Encrypted with the recipient's public X25519 key.
   * *For threshold shares*: Split into Shamir shares and distributed to participant lobbies.
4. **Lease/Consumption**: The client receives a one-time token. For burn-after-reading shares, accessing the share consumes this lease, prompting the server to permanently overwrite database and storage rows.

## User Journey
1. **Creation**: The user opens the dashboard, drops a code snippet or document, configures the access policy (e.g. password, M-of-N), and sets the lifetime.
2. **Distribution**: VaultDrop generates a unique locator link and displays the security details (including a QR code).
3. **Retrieval**: The recipient opens the link, enters the password (or signs in with their identity key), downloads the ciphertext, and decrypts it fully in memory.
4. **Collaboration (Rooms)**: Participants join a shared room, exchange E2E encrypted chats, and safely download client-side decrypted attachments.
5. **Revocation**: The creator views their shared list and revokes access instantly. The server purges database entries.

## Architecture
VaultDrop utilizes a modular, monorepo architecture structured as NPM workspaces to enforce isolation:
* **Frontend Application (`apps/web`)**: Next.js 14 application providing marketing pages, an editorial landing experience, and an interactive, client-side dashboard.
* **Backend API (`services/api`)**: Node.js Express REST server managing client-side encrypted payloads, database storage, and rate-limiting.
* **Cryptographic Package (`packages/crypto`)**: Dedicated, audited, and environment-agnostic library containing core cryptographic logic (Web Crypto, TweetNaCl, Hash-WASM).
* **UI Component Library (`packages/ui`)**: Modular component library styled with Tailwind CSS to maintain design consistency across multiple workspace projects.

## Tech Stack
* **Frontend**: Next.js 14, React 18, Tailwind CSS, Framer Motion, TypeScript
* **Backend**: Express, Node.js, TypeScript
* **Database**: PostgreSQL (production), SQLite 3 (local/testing)
* **Cryptography**: Web Crypto API (AES-GCM-256, HKDF SHA-256), TweetNaCl (Ed25519, X25519), `hash-wasm` (Argon2id), `shamir-secret-sharing`
* **Utilities**: Lucide React, QRCode, Canvas Confetti

## Technical Implementation
* **Web Crypto Interface Helper**: Standardizes SubtleCrypto calls across browser and Node.js runtimes.
* **HKDF Domain Separation**: Computes separated encryption keys using unique salt and info configurations (e.g., `HKDF(CEK, "vaultdrop/file")`).
* **Argon2id Key Derivation**: Configured with light, browser-safe parameters (`parallelism: 1`, `iterations: 3`, `memorySize: 16384`) to balance speed and brute-force resistance.
* **SQLite Cascade Deletes**: Programmatic sqlite database configuration (`PRAGMA foreign_keys = ON;`) to clean up all orphaned relational rows during revoking operations.
* **PostgreSQL BIGINT Parsing**: Configured pg-driver middleware to safely parse database timestamps, preventing date constructor failures.

## AI / ML Architecture
To protect user communication against modern AI surveillance, VaultDrop integrates an **AI-Resilient Architecture**:
* **Traffic Analysis Resistance**: AI models regularly profile packet sizes to guess file types. VaultDrop uses randomized padding sizing to make files appear as uniform blocks, neutralizing metadata analysis.
* **Zero-Knowledge Data Boundaries**: Plaintexts never reach the network, keeping chats and code safe from remote training scraper bots or predictive LLM analytics.
* **AI-Agent Auditable Codebase**: Built with strict, modular boundaries and a standalone `@vaultdrop/crypto` package. This allows security agents and developer systems to easily scan and verify cryptographic security invariants.

## Performance & Reliability
* **Fast Decryption**: Symmetric encryption (AES-256-GCM) is run on native Web Crypto APIs, translating to hardware-accelerated processing speeds.
* **Resumable Chunks**: Large file transfers are split into minor chunks to prevent memory overflows and enable retry logic during network drops.
* **Rate Limiting Protection**: `express-rate-limit` prevents API exhaustion by enforcing limits (300 requests/15 mins per IP, and 15 share posts/hour).
* **SWC Compilations**: Configured SWC compilers as optional dependencies to guarantee fluid builds across major cloud deployment platforms (Vercel and Render).

## Security & Privacy
* **Untrusted Servers**: The database is structured to contain ciphertext only. A database compromise leaks no keys, passwords, or plaintexts.
* **Helmet Hardening**: The Express API uses Helmet headers (HSTS, Content Security Policy, XSS Protection, Frameguard) to resist clickjacking and injection attacks.
* **URL Hygiene**: Locators are separated from content keys. Plaintext keys never cross network boundaries.
* **Privacy-Sensitive Logs**: No persistent storage of IP addresses, User-Agents, or Referer metrics. Rate limits leverage ephemeral hashing.

## Demo / Quick Start
To test VaultDrop locally, clone the workspace and boot up the local SQLite configuration:
```bash
git clone https://github.com/vaishnavrkadam/VaultDrop.git
cd VaultDrop
npm install
npm run build -w packages/crypto
npm run build -w packages/ui
npm run dev:api
npm run dev:web
```
Open `http://localhost:3000` to start creating shares.

## Installation
Ensure you have Node.js v18/v20+ and NPM v9+ installed.
```bash
npm install
```

## Environment Variables
Create a `.env` file at the root or specify these environment configurations:
### Frontend (`apps/web`):
* `NEXT_PUBLIC_API_URL`: Backend service URL (Default: `http://localhost:3001`).

### Backend (`services/api`):
* `PORT`: Server port (Default: `3001`).
* `DATABASE_URL`: PostgreSQL connection string. (If omitted, database falls back to SQLite).

## Running Locally
Start frontend and backend development configurations simultaneously:
```bash
# Start backend (Port 3001)
npm run dev:api

# Start Next.js frontend (Port 3000)
npm run dev:web
```

## Usage
1. **Share Text/Code**: Write text in the dashboard, set expiry, and generate the URL.
2. **Share Files**: Drag and drop arbitrary files; they are encrypted chunk-by-chunk and uploaded.
3. **Enter Rooms**: Create a Room, copy the Room link (which contains the #roomKey in the hash), and share with participants for real-time E2E encrypted group chats.
4. **Sync Identities**: Visit `/security`, export your Private Key, and paste it on another device's import page to restore access to created shares.

## Testing
VaultDrop features a comprehensive automated test framework:
* **Cryptographic Protocol Tests**:
  ```bash
  npm run test -w packages/crypto
  ```
  Validates Web Crypto operations, Argon2id derivations, and Shamir Secret Sharing correctness.
* **Integration API Tests**:
  ```bash
  npm run test -w services/api
  ```
  Validates API endpoint responses, SQLite cascade deletions, burn-after-reading leases, and rate-limiting handlers.

## Project Structure
```
vaultdrop-monorepo/
├── apps/
│   └── web/                 # Next.js 14 Frontend UI Dashboard
├── services/
│   └── api/                 # Express Node.js API (TypeScript)
├── packages/
│   ├── crypto/              # Cryptographic Library (Web Crypto & TweetNaCl)
│   └── ui/                  # Shared Tailwind CSS React components
├── package.json             # Monorepo workspaces definition
└── README.md                # Project documentation
```

## Limitations
* **Screenshot Deterrence**: Protected Viewing Mode is a best-effort visual watermark. It cannot prevent a physical camera from photographing the display.
* **Client-Side Key Loss**: If a user loses their room password or identity private key, there is no server-side recovery route.
* **Browser Sandbox**: Security depends on the browser's sandbox environment remaining secure.

## Future Improvements
* **Passkeys / WebAuthn**: Support browser-based hardware keys for identity verification.
* **Manual WebRTC Signaling**: Peer-to-peer file transfers using local QR code signaling to bypass server storage entirely.
* **Enterprise HSM Support**: Integrating Hardware Security Modules for organizational recovery trustee setups.

## Team
* **Vaishnav**
* **Hemanth**
* **Rohan**
* **Babu**

## License
VaultDrop is open-source software licensed under the [MIT License](LICENSE).
