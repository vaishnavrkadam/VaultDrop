# VaultDrop --- Implementation Plan

## 0. Purpose

This document is the implementation bridge between:

-   The VaultDrop Product Requirements Document (PRD)
-   The VaultDrop database schema
-   The VaultDrop AI / system specification
-   The reference website recording and its visual design language

The goal is to build VaultDrop as a privacy-first, zero-knowledge secure
sharing platform while giving it a highly polished, minimalist,
technical visual experience inspired by the reference design.

The reference website should **not** be copied page-for-page. Its visual
language, layout philosophy, typography, spacing, geometry, motion, and
presentation style should be translated into VaultDrop's own product
experience.

------------------------------------------------------------------------

# 1. Product Direction

## 1.1 Product

**VaultDrop**

A privacy-first, zero-knowledge platform for securely sharing:

-   Text
-   Source code
-   Markdown
-   Documents
-   Images
-   PDFs
-   Office documents
-   Archives
-   Arbitrary binary files
-   Large encrypted files

VaultDrop is conceptually similar to PrivateBin, but its primary design
goal is to reduce trust placed in the storage server and improve:

-   Secure file sharing
-   Revocation
-   Multi-party access
-   Auditing
-   Operational privacy
-   Client-side cryptographic control

## 1.2 Core Product Principle

The storage server must be treated as **untrusted infrastructure**.

The server should not possess:

-   Plaintext content
-   Content encryption keys
-   Recipient private keys
-   Plaintext passwords

The trusted client is responsible for:

-   Encryption
-   Decryption
-   Key management
-   Rendering
-   File processing

The server should receive/store ciphertext and required metadata only.

The fundamental security architecture is:

``` text
                 TRUSTED DOMAIN
            ┌──────────────────────┐
            │   VaultDrop Client   │
            │                      │
            │ Encryption           │
            │ Decryption           │
            │ Key management       │
            │ Rendering            │
            │ File processing      │
            └──────────┬───────────┘
                       │
                       │ ciphertext
                       ▼
              ┌──────────────────┐
              │  UNTRUSTED SERVER│
              └────────┬─────────┘
                       │
                ┌──────┴──────┐
                │             │
            PostgreSQL      S3/MinIO
             metadata       ciphertext
```

## 1.3 Critical Architectural Rule

Do not reproduce PrivateBin's browser trust model.

Do not make the security model depend solely on:

``` text
server → HTML → JavaScript → decrypt
```

Prefer:

``` text
signed client
      │
      │ ciphertext
      ▼
untrusted server
```

The high-security cryptographic client should be independently
distributed, versioned, signed, and auditable.

------------------------------------------------------------------------

# 2. Design Direction

## 2.1 Reference Design Language

The visual design should translate the reference recording into a
VaultDrop-specific design system.

Key characteristics:

-   Minimalist / almost monochrome interface
-   Large amounts of white / empty space
-   Thin borders
-   Subtle UI elements
-   Technical / futuristic typography
-   Small uppercase labels
-   Centered hero content
-   Geometric / technical decorative elements
-   Black-and-white visual language
-   Large isolated product/content presentation
-   Restrained outlined buttons
-   Smooth transitions and animations
-   Full-screen sections
-   Occasional dark cinematic sections
-   Product imagery/video used as a visual focal point
-   Minimal navigation
-   Technical diagrams
-   Small loading/state indicators

The resulting design should feel like:

> **A secure technical instrument rather than another SaaS dashboard.**

## 2.2 Design Translation

Do not simply recreate the reference website.

Translate:

``` text
Reference Website
       ↓
Visual Language
       ↓
VaultDrop Design System
       ↓
VaultDrop-specific components
       ↓
VaultDrop pages and flows
```

The visual identity should support VaultDrop's core ideas:

-   Privacy
-   Security
-   Trust minimization
-   Encryption
-   Technical sophistication
-   Controlled access

------------------------------------------------------------------------

# 3. Experience Architecture

VaultDrop should have multiple visual/product experiences.

## 3.1 Public / Marketing Experience

Routes:

``` text
/
├── Landing
├── Security
├── How It Works
├── Features
├── Privacy
└── Download / Launch
```

This section should use the reference visual language most aggressively.

## 3.2 Application Experience

Routes:

``` text
/app
├── Create Share
├── My Shares
├── Share Details
├── Recipient Access
├── Discussions
├── Settings
└── Security
```

The application should retain the same design language while becoming
more functional and information-dense.

## 3.3 Administrative Experience

Routes:

``` text
/admin
├── Overview
├── Users
├── Shares
├── Storage
├── Audit
├── Recovery
└── System
```

The administrative console should support the operational requirements
described by the product specification, including storage, quotas,
retention, abuse controls, users/teams, recovery trustees, audit
configuration, and server health.

------------------------------------------------------------------------

# 4. Landing Page Implementation

The landing page should feel like a cinematic technical presentation
rather than a conventional SaaS landing page.

## 4.1 Hero

Conceptual structure:

``` text
┌─────────────────────────────────────────────┐
│ VAULTDROP                         [MENU]    │
│                                             │
│                                             │
│              YOUR DATA                      │
│              STAYS YOURS                    │
│                                             │
│          encrypted before upload            │
│                                             │
│                                             │
│                    ↓                        │
└─────────────────────────────────────────────┘
```

The exact copy should be determined by the approved product copy.

## 4.2 Security Statement Section

Example composition:

``` text
TRUST NOTHING
STORE NOTHING
EXPOSE NOTHING
```

Use large typography and substantial negative space.

## 4.3 Encryption Visualization

Create an animated geometric security diagram:

``` text
PLAINTEXT
    ↓
TRUSTED CLIENT
    ↓
ENCRYPTION
    ↓
CIPHERTEXT
    ↓
UNTRUSTED SERVER
```

Expanded version:

``` text
                    ┌──────────────┐
                    │   PLAINTEXT  │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ TRUSTED      │
                    │ CLIENT       │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           TEXT          FILE       METADATA
              │            │            │
              └────────────┼────────────┘
                           ▼
                       CIPHERTEXT
                           │
                           ▼
                    UNTRUSTED SERVER
```

The diagram should be implemented as a reusable component rather than as
a one-off page graphic.

------------------------------------------------------------------------

# 5. Create Share --- Primary Application Screen

This should be one of the most important UI screens.

The PRD requires support for:

-   Text
-   Files
-   Folder
-   Drag and drop
-   Expiration
-   Password protection
-   Anonymous access
-   Recipient-specific access
-   M-of-N access

## 5.1 Visual Structure

Avoid a conventional dense form.

Use an editorial / technical composition:

``` text
CREATE
SECURE
SHARE

────────────────────────────────────

WHAT ARE YOU SHARING?

[ TEXT ]        [ FILES ]        [ FOLDER ]

────────────────────────────────────

DROP FILES HERE

        +

────────────────────────────────────

EXPIRATION

05 MIN    1 HR    1 DAY    7 DAYS    CUSTOM

────────────────────────────────────

ACCESS

ANONYMOUS       RECIPIENTS       M-OF-N

────────────────────────────────────

                         [ CREATE → ]
```

## 5.2 Reusable Components

Create:

-   `ShareTypeSelector`
-   `FileDropZone`
-   `TextEditor`
-   `FolderSelector`
-   `ExpirationSelector`
-   `PasswordSettings`
-   `AccessModeSelector`
-   `RecipientSelector`
-   `ThresholdPolicySelector`
-   `CreateShareButton`
-   `ShareCreationProgress`

------------------------------------------------------------------------

# 6. Share Created Experience

After successful creation, show a controlled security-oriented success
state.

Possible structure:

``` text
SECURE SHARE CREATED

STATUS
ACTIVE

SHARE ID
7J92K8A1...

EXPIRES
20 AUG 2026 · 20:00

ACCESS
ANONYMOUS / RECIPIENT / M-OF-N

────────────────────────

[ COPY SHARE ID ]
[ SHOW QR ]
[ MANAGE SHARE ]
```

Do not expose the encryption key through a normal URL.

The URL should identify the share using an opaque identifier such as:

``` text
/s/{opaque-share-id}
```

The raw encryption key must not be placed in a normal URL.

------------------------------------------------------------------------

# 7. Share Management

The share management UI should be data-driven from the database schema.

The database entities should map to UI concepts.

## 7.1 Entity-to-UI Mapping

  Database Concept       UI
  ---------------------- -----------------------------
  `shares`               Share overview / status
  `share_recipients`     Recipient management
  `files`                Encrypted file list
  `comments`             Discussion panel
  `access_leases`        Active session/access state
  `audit_events`         Security timeline
  `break_glass_events`   Emergency recovery UI
  `threshold_policies`   M-of-N configuration

## 7.2 Share Overview

Example:

``` text
SHARE / 7J92K...

STATUS
ACTIVE

ACCESS
3 / 4 RECIPIENTS

EXPIRES
20 AUG 2026 · 20:00

BURN
ENABLED

────────────────────────────────

RECIPIENTS

01   ENGINEERING-01       ACTIVE
02   ENGINEERING-02       ACTIVE
03   ENGINEERING-03       ACTIVE
04   ENGINEERING-04       REVOKED

────────────────────────────────

[ MANAGE ACCESS ]    [ REVOKE ]
```

Support:

-   Status
-   Expiration
-   Burn-after-reading
-   Recipients
-   Recipient status
-   Revocation
-   Authorization state
-   File list
-   Discussions
-   Security/audit information

------------------------------------------------------------------------

# 8. Recipient Experience

Recipient access should be deliberately minimal.

A recipient should be able to:

1.  Open the share.
2.  Authenticate/authorize using the configured mechanism.
3.  Download encrypted data.
4.  Decrypt locally.
5.  View/render content.
6.  Participate in encrypted discussions where allowed.

The UI must distinguish these stages where relevant:

``` text
URL OPENED
     ↓
CIPHERTEXT DOWNLOADED
     ↓
PASSWORD ACCEPTED
     ↓
CONTENT AUTHENTICATED
     ↓
CONTENT RENDERED
```

This distinction is especially important for burn-after-reading.

------------------------------------------------------------------------

# 9. Protected Viewing Mode

Protected Viewing Mode should be a dedicated visual mode.

Use a dark, high-contrast presentation.

Conceptual layout:

``` text
┌─────────────────────────────────────────────┐
│                                             │
│ CONFIDENTIAL                                │
│                                             │
│             decrypted content               │
│                                             │
│                                             │
│       SESSION: 7F2A91                       │
│       RECIPIENT: ENGINEERING-03             │
│       21 AUG 2026 · 15:42                   │
│                                             │
└─────────────────────────────────────────────┘
```

Features:

-   Dynamic watermark
-   Share ID
-   Recipient/session identifier
-   Timestamp
-   Optional organization identifier
-   Diagonal repeating watermark for highly sensitive documents
-   Optional screen-capture response where platform APIs support it
-   Warning / blur / termination / security event as appropriate

The UI must clearly state that screenshot prevention is best-effort and
cannot prevent someone from photographing the screen with another
device.

------------------------------------------------------------------------

# 10. Dark / Light Visual Modes

Do not treat dark mode as merely an inverted theme.

Use two intentional visual modes.

## 10.1 Light --- Trust / Creation

Use for:

-   Landing
-   Create Share
-   File upload
-   Share management
-   Settings

Characteristics:

-   White / paper background
-   Black typography
-   Fine borders
-   Large negative space
-   Technical labels

## 10.2 Dark --- Security / Protected Viewing

Use for:

-   Encrypted viewer
-   Protected viewing
-   Security verification
-   Sensitive content
-   Emergency recovery

Characteristics:

-   Dark background
-   High contrast
-   Minimal distractions
-   Watermark overlays
-   Security/session information

------------------------------------------------------------------------

# 11. Typography System

Typography is a core part of the visual identity.

Avoid generic:

``` text
Inter + Roboto + rounded SaaS cards
```

Instead use:

## Display

Condensed / technical grotesk.

Use for:

-   Hero statements
-   Large section headings
-   Major product statements

## Body

Neutral grotesk.

Use for:

-   Explanations
-   Descriptions
-   Form labels
-   Supporting copy

## Technical

Monospace.

Use for:

-   Share IDs
-   Encryption versions
-   Authorization epochs
-   Chunk indices
-   Audit events
-   Session identifiers
-   Technical metadata

Example:

``` text
VAULTDROP
SECURE SHARING SYSTEM
V1.0.0

SHARE ID
7J92K8A1...

AUTHORIZATION EPOCH
42
```

------------------------------------------------------------------------

# 12. Design System

Create the design system before building all pages.

## 12.1 Color System

Define semantic tokens:

``` text
Void
Paper
Border
Muted
Warning
Danger
Success
```

Keep the default palette highly restrained.

## 12.2 Layout

Define:

-   Full viewport layouts
-   Editorial grid
-   Technical grid
-   Dashboard grid
-   Maximum content widths
-   Responsive breakpoints
-   Horizontal and vertical rhythm
-   Section spacing

## 12.3 Borders

Use thin, restrained borders.

Avoid:

-   Heavy cards
-   Excessive shadows
-   Excessive rounding
-   Generic floating SaaS panels

## 12.4 Components

Create reusable components for:

-   Button
-   Input
-   FileDrop
-   ShareCard
-   RecipientRow
-   StatusIndicator
-   SecurityBadge
-   AuditTimeline
-   EncryptionDiagram
-   Navigation
-   Footer
-   Modal
-   Toast
-   Progress indicator
-   QR display
-   Code viewer
-   Markdown viewer
-   File preview
-   Watermark layer

## 12.5 Motion

Create a consistent motion system:

-   Page transitions
-   Hover states
-   Reveal animations
-   Loading states
-   Encryption animation
-   Upload progress
-   Share creation progress
-   Security verification states

Animations should remain subtle and purposeful.

------------------------------------------------------------------------

# 13. Frontend Architecture

Recommended stack:

-   Next.js
-   React
-   TypeScript
-   Tailwind CSS
-   Framer Motion

## 13.1 Suggested Frontend Structure

``` text
apps/
└── web/
    ├── app/
    │   ├── (marketing)/
    │   ├── app/
    │   ├── admin/
    │   └── s/
    │
    ├── components/
    │   ├── ui/
    │   ├── navigation/
    │   ├── sharing/
    │   ├── viewer/
    │   ├── security/
    │   ├── audit/
    │   └── diagrams/
    │
    ├── features/
    │   ├── shares/
    │   ├── recipients/
    │   ├── files/
    │   ├── discussions/
    │   ├── settings/
    │   └── admin/
    │
    ├── crypto/
    │   └── CryptoProvider/
    │
    ├── lib/
    ├── hooks/
    ├── state/
    └── styles/
```

------------------------------------------------------------------------

# 14. Cryptographic Trust Boundary

Do not scatter cryptographic operations throughout UI components.

Create a dedicated abstraction:

``` text
CryptoProvider
```

UI components should communicate with the cryptographic layer through
controlled interfaces.

Conceptually:

``` text
React UI
   │
   ▼
Application Services
   │
   ▼
CryptoProvider
   │
   ├── Encryption
   ├── Decryption
   ├── Key Management
   ├── Password KDF
   ├── Key Derivation
   ├── Identity
   └── File Encryption
```

Only trusted components should be allowed to interact with sensitive
cryptographic material.

------------------------------------------------------------------------

# 15. Cryptography Implementation

Never implement cryptographic primitives manually.

Use audited libraries.

Required primitives:

``` text
Content encryption:
AES-256-GCM or XChaCha20-Poly1305

Password KDF:
Argon2id

Key derivation:
HKDF

Identity signatures:
Ed25519

Key agreement:
X25519

M-of-N:
Audited Shamir Secret Sharing implementation
```

All encrypted data must be authenticated.

Do not use unauthenticated AES-CBC or home-grown encryption.

------------------------------------------------------------------------

# 16. Key Hierarchy

Use a key hierarchy similar to:

``` text
Root / Content Encryption Key
          │
          ├── text encryption key
          │
          ├── file encryption keys
          │
          ├── discussion encryption key
          │
          └── metadata encryption key
```

Use HKDF with domain separation, for example:

``` text
HKDF(CEK, "vaultdrop/file")
HKDF(CEK, "vaultdrop/discussion")
HKDF(CEK, "vaultdrop/metadata")
```

Never reuse nonces.

Never reuse encryption keys across unrelated security domains unless
explicitly permitted by the construction.

------------------------------------------------------------------------

# 17. Password Protection

Passwords must never be sent to the server.

Use:

``` text
password
    ↓
Argon2id
    ↓
derived key
    ↓
wrap CEK
```

Store only:

-   Salt
-   KDF parameters
-   Encrypted key envelope

Never store:

-   Password
-   Plaintext CEK
-   Reversible password representation

------------------------------------------------------------------------

# 18. File Encryption

Files must be encrypted before upload.

For large files, use:

-   Chunked encryption
-   Resumable uploads
-   Resumable downloads
-   Streaming encryption
-   Integrity verification

Conceptually:

``` text
File
 │
 ├── Chunk 001 → encrypted
 ├── Chunk 002 → encrypted
 ├── Chunk 003 → encrypted
 └── Chunk N   → encrypted
```

The server never receives plaintext chunks.

Each file should have a file-specific key derived from the CEK:

``` text
CEK
 │
 └── HKDF
       │
       └── File Encryption Key
```

Each chunk receives a unique nonce.

Associated data should bind:

``` text
share_id
file_id
chunk_index
encryption_version
```

This prevents chunk substitution and reordering.

------------------------------------------------------------------------

# 19. File Metadata Privacy

Filenames can contain sensitive information.

Therefore filenames should also be encrypted.

The server should ideally see only:

``` text
file_id
encrypted_size
chunk_count
creation/expiry metadata required for storage
```

Optionally pad file sizes to reduce metadata leakage.

------------------------------------------------------------------------

# 20. URL Architecture

Normal share URLs must not contain raw encryption keys.

Use:

``` text
/s/{opaque-share-id}
```

The URL identifies the share.

The decryption capability must be obtained independently through the
appropriate authorization mechanism.

Possible mechanisms include:

-   Recipient-specific encrypted key envelopes
-   Independently entered passwords
-   Invitation codes
-   Authenticated recipient identities
-   M-of-N key shares
-   Locally stored keys
-   Hardware-backed credentials

An optional capability URL may exist, but capability and object
identifier must remain cryptographically separated.

------------------------------------------------------------------------

# 21. Expiration

Support:

-   5 minutes
-   15 minutes
-   30 minutes
-   1 hour
-   6 hours
-   12 hours
-   1 day
-   3 days
-   1 week
-   1 month
-   Custom expiration
-   Never

Expiration must be enforced:

-   By the server for storage deletion
-   By clients for access authorization

The UI should expose common values as compact selectable controls and
provide a custom option.

------------------------------------------------------------------------

# 22. Burn After Reading

Burn-after-reading should not simply trigger when the URL is opened.

Use a short-lived access lease.

Conceptually:

``` text
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

Use:

-   `Cache-Control: no-store`
-   `Pragma: no-cache`
-   Restrictive browser storage policy
-   No plaintext localStorage
-   No plaintext IndexedDB
-   Memory-only decrypted content where practical

The security event for consuming the share should preferably be
successful authorization/decryption rather than simply opening the URL.

------------------------------------------------------------------------

# 23. Discussions

Preserve the PrivateBin-style discussion capability.

Each comment must be encrypted client-side.

Support:

-   Anonymous participants
-   Optional nickname
-   Authenticated participants
-   Encrypted timestamps where practical
-   Deletion
-   Moderation by authorized team members

UI:

``` text
DISCUSSION

01
ANONYMOUS
Encrypted message...

02
ENGINEERING-03
Encrypted message...

[ WRITE COMMENT ]
```

The discussion UI should visually fit the same design system.

------------------------------------------------------------------------

# 24. QR Code

The MVP should support QR code sharing.

The Share Created screen should provide:

``` text
[ SHOW QR ]
```

QR contents must follow the same security rules as normal share URLs.

Do not place a raw encryption key in a normal URL.

------------------------------------------------------------------------

# 25. Markdown / Code / Preview Support

The MVP should support:

-   Markdown
-   Syntax highlighting
-   Previews

Because content is decrypted client-side, rendering must happen inside
the trusted client boundary.

Treat untrusted decrypted content carefully.

Testing must include malicious:

-   Markdown
-   HTML
-   SVG

Do not blindly inject decrypted content into the DOM.

------------------------------------------------------------------------

# 26. Privacy and Audit UI

Audit logging should be divided into:

## Security Audit Events

Examples:

-   Share created
-   Share revoked
-   Recipient added
-   Recipient removed
-   M-of-N policy changed
-   Break-glass initiated
-   Break-glass completed
-   Recovery failed

## Privacy-Sensitive Access Logs

Avoid persistent storage of:

-   IP addresses
-   User-Agent
-   Referer
-   Plaintext share IDs where unnecessary
-   Exact access timestamps unless required

Provide configurable privacy modes.

### Maximum Privacy Mode

``` text
No persistent IP logging
No persistent User-Agent logging
No persistent Referer logging
Minimal access counters
Short-lived operational telemetry
```

Rate limiting should use short-lived or privacy-preserving identifiers
where practical.

Do not claim that infrastructure outside the application's control
cannot log access.

------------------------------------------------------------------------

# 27. Audit Timeline Component

Create a reusable:

``` text
AuditTimeline
```

Example:

``` text
SECURITY AUDIT

● SHARE CREATED
  15:42

│
● RECIPIENT ADDED
  15:44

│
● ACCESS AUTHORIZED
  15:51

│
● SHARE REVOKED
  16:03
```

Use technical typography and restrained lines.

------------------------------------------------------------------------

# 28. M-of-N Access

M-of-N is Phase 2.

UI should eventually support:

``` text
M-OF-N ACCESS

REQUIRED
[ 3 ]

TRUSTEES
[ 5 ]

────────────────────

01  TRUSTEE
02  TRUSTEE
03  TRUSTEE
04  TRUSTEE
05  TRUSTEE
```

The system must enforce that N-1 shares are insufficient to reconstruct
the secret.

Do not implement this before the core cryptographic foundation is
stable.

------------------------------------------------------------------------

# 29. Break-Glass Recovery

Break-glass is Phase 3.

It requires:

-   Authorized operator
-   Hardware-backed authentication
-   Required recovery threshold
-   Reason code
-   Explicit confirmation
-   Immutable audit event
-   Notification to configured team members

UI should make the action deliberately high-friction and unmistakable.

Example:

``` text
EMERGENCY RECOVERY

THIS ACTION REQUIRES
ELEVATED AUTHORIZATION

REASON
[________________________]

AUTHORIZATION
[ HARDWARE AUTHENTICATOR ]

RECOVERY THRESHOLD
3 / 5

[ CANCEL ]       [ INITIATE RECOVERY ]
```

------------------------------------------------------------------------

# 30. WebRTC / P2P

WebRTC is Phase 3 / stretch.

It does not eliminate the need for signaling.

Treat it as an optional transfer mechanism when the server is
unavailable.

Future architecture:

``` text
Client A
   │
   │ signaling
   ▼
Signaling service
   │
   ▼
Client B

Client A ◄──── WebRTC ────► Client B
```

Potential future support:

-   Offline/P2P transfer
-   WebRTC transfer
-   Hardware security key workflows
-   Enterprise SSO
-   Advanced compliance controls

------------------------------------------------------------------------

# 31. Backend Architecture

Recommended:

``` text
Go API
    │
    ├── PostgreSQL 16+
    │
    └── S3-compatible storage / MinIO
```

Responsibilities:

-   Share metadata
-   Recipient metadata
-   Encrypted envelopes
-   Ciphertext storage
-   Expiration enforcement
-   Revocation state
-   Access leases
-   Audit events
-   Privacy-preserving operational controls

The backend must not decrypt content.

------------------------------------------------------------------------

# 32. Database-to-Frontend Architecture

The database schema should drive application state without exposing
sensitive server-side secrets.

Core relationships:

``` text
Share
 ├── Recipients
 ├── Files
 ├── Comments
 ├── Access Leases
 ├── Audit Events
 ├── Threshold Policies
 └── Break-Glass Events
```

Frontend state should distinguish:

-   Public share metadata
-   Client-only decrypted state
-   Server-provided encrypted envelopes
-   Session/access state
-   UI state

Never place plaintext secrets into persistent browser storage.

------------------------------------------------------------------------

# 33. Suggested Monorepo

Use the following high-level structure:

``` text
vaultdrop/
├── apps/
│   ├── web/
│   ├── desktop/
│   ├── mobile/
│   └── cli/
│
├── services/
│   ├── api/
│   ├── worker/
│   └── signaling/
│
├── packages/
│   ├── crypto/
│   ├── protocol/
│   ├── client/
│   ├── storage/
│   └── ui/
│
├── migrations/
├── deployment/
├── docs/
├── security/
└── tests/
```

For the initial MVP, prioritize the web client, API, crypto/protocol
packages, storage layer, migrations, security documentation, and
automated tests.

------------------------------------------------------------------------

# 34. Development Stages

Do not implement every feature simultaneously.

## Stage 0 --- Design

Create:

``` text
VaultDrop Design System
        ↓
Page Map
        ↓
Component Map
        ↓
Wireframes
        ↓
High-Fidelity Screens
```

## Stage 1 --- Frontend Shell

Build using fake data:

-   Landing
-   Create Share
-   Share Created
-   Share Viewer
-   My Shares
-   Share Management
-   Settings

The purpose is to establish the visual language before backend/crypto
complexity.

## Stage 2 --- Cryptographic Protocol

Implement and test:

-   Content encryption
-   Key hierarchy
-   Password-derived key wrapping
-   Key derivation
-   Identity primitives
-   Recipient key envelopes
-   Nonce handling
-   Chunk encryption

## Stage 3 --- Trusted Client

Build:

-   `CryptoProvider`
-   Secure client boundary
-   Encryption/decryption APIs
-   Local key handling
-   Secure rendering pipeline

## Stage 4 --- Encrypted Storage API

Build:

-   Go API
-   PostgreSQL
-   S3/MinIO
-   Ciphertext upload/download
-   Metadata operations
-   Share lifecycle

## Stage 5 --- Text Sharing

Implement:

-   Text creation
-   Encryption
-   Upload
-   Retrieval
-   Decryption
-   Markdown
-   Syntax highlighting
-   Preview

## Stage 6 --- File / Chunk Transfer

Implement:

-   File encryption
-   Chunking
-   Resumable upload
-   Resumable download
-   Integrity verification
-   Encrypted filenames
-   File previews

## Stage 7 --- Password + Expiration

Implement:

-   Argon2id
-   Password-protected shares
-   Expiration choices
-   Custom expiration
-   Server deletion
-   Client authorization checks

## Stage 8 --- Revocation

Implement:

-   Recipient revocation
-   Share revocation
-   Authorization epoch changes
-   Session invalidation
-   Tests for revoked access

## Stage 9 --- Discussion

Implement:

-   Encrypted comments
-   Anonymous participants
-   Nicknames
-   Authenticated participants
-   Deletion
-   Moderation

## Stage 10 --- M-of-N

Implement:

-   Threshold policies
-   Secret sharing
-   Trustee management
-   Reconstruction
-   Threshold tests

## Stage 11 --- Protected Viewing

Implement:

-   Protected viewer
-   Dynamic watermark
-   Session identifier
-   Recipient identifier
-   Timestamp
-   Screenshot-awareness best-effort behavior
-   Security notifications

## Stage 12 --- Break-Glass

Implement:

-   Recovery trustees
-   Hardware-backed authentication
-   Authorization threshold
-   Reason code
-   Explicit confirmation
-   Immutable audit event
-   Team notification

## Stage 13 --- WebRTC / P2P

Implement:

-   Signaling
-   WebRTC transfer
-   Offline/P2P workflows
-   Failure handling

------------------------------------------------------------------------

# 35. MVP Scope

The MVP must include:

-   Text sharing
-   Encrypted file sharing
-   Password protection
-   Expiration
-   Revocation
-   Burn after successful decryption
-   Encrypted discussions
-   Anonymous sharing
-   Recipient-specific sharing
-   Secure client
-   PostgreSQL
-   S3-compatible storage
-   API
-   CLI
-   QR code
-   Markdown
-   Syntax highlighting
-   Previews
-   Privacy-preserving logs

Do not attempt every advanced feature in the MVP.

## Phase 2

-   M-of-N
-   Hardware-backed recipient identity
-   Protected viewing
-   Encrypted audit
-   Organization/team accounts
-   Advanced revocation
-   Recovery trustees

## Phase 3

-   Break-glass
-   WebRTC
-   Offline/P2P transfer
-   Hardware security key workflows
-   Enterprise SSO
-   Advanced compliance controls

------------------------------------------------------------------------

# 36. Security Testing

The system must not be considered secure merely because the database
contains encrypted data.

Implement automated tests for:

``` text
Server compromise
Ciphertext modification
Chunk modification
Chunk reordering
Replay
Expired share
Revoked share
Wrong password
Wrong recipient
M-of-N below threshold
M-of-N exactly threshold
M-of-N above threshold
Burn-after-reading
Break-glass authorization
Audit generation
Malicious metadata
Malicious Markdown
Malicious HTML
Malicious SVG
```

## Required Acceptance Tests

### Server Compromise

An attacker with:

-   Database
-   Object storage
-   API server
-   Server configuration

must not be able to decrypt a previously created share.

### Malicious Server

A malicious server must not be able to replace trusted cryptographic
client code and capture a key.

### URL

Possession of a normal share URL must not automatically reveal the
encryption key.

### Revocation

After revocation, a new recipient session must fail.

### M-of-N

N-1 shares must be insufficient to reconstruct the secret.

### Break-Glass

Recovery must require all configured authorization controls.

### Tampering

Modified ciphertext must fail authentication.

### Chunk

Missing, reordered, or modified chunks must be detected.

### Burn

Opening the URL without successful authorization must not consume a
protected share.

### Privacy

Normal server logs must not contain:

-   Plaintext
-   Passwords
-   Encryption keys

### Screenshot

Protected viewing must clearly state that screenshot prevention is
best-effort.

------------------------------------------------------------------------

# 37. Threat Modeling

Every major feature requires a threat model.

For each feature document:

``` text
Assets
Threat actors
Trust boundaries
Attack surface
Failure modes
Mitigations
Residual risk
```

Threat models should be stored alongside implementation/security
documentation.

Security review is part of implementation, not a post-development
activity.

------------------------------------------------------------------------

# 38. Secure Defaults

Default configuration must favor privacy.

Defaults:

``` text
HTTPS required
HSTS enabled
IP logging disabled
Analytics disabled
Third-party resources disabled
Password option enabled
Expiration enabled
Plaintext server storage impossible
Strict CSP
no-store for sensitive responses
```

Do not introduce analytics or third-party resources that expand the
privacy boundary without an explicit product/security decision.

------------------------------------------------------------------------

# 39. Claims and Product Messaging

The product should advertise:

> **Your data is encrypted before it leaves your device. The storage
> server stores ciphertext, not your plaintext or encryption keys.**

Do not advertise claims such as:

-   "Nobody can ever know you accessed a file."
-   "Screenshots are impossible."
-   "The server cannot be compelled to provide any metadata."
-   "Anonymous under all circumstances."
-   "Unbreakable."
-   "Revoked content can never be accessed."
-   "WebRTC requires no signaling."
-   "Zero metadata."

The product should clearly document limitations.

------------------------------------------------------------------------

# 40. Responsive Design

The reference design should be adapted rather than simply shrunk.

## Desktop

Use:

-   Large editorial compositions
-   Full-width sections
-   Large typography
-   Multi-column layouts
-   Technical diagrams

## Tablet

Reduce:

-   Typography scale
-   Horizontal spacing
-   Number of simultaneous columns

Preserve:

-   Visual hierarchy
-   Negative space
-   Technical aesthetic

## Mobile

Prioritize:

-   Single-column layouts
-   Large touch targets
-   Compact navigation
-   Simplified diagrams
-   Scroll-based section presentation
-   Readability

The visual language must remain recognizable on mobile.

------------------------------------------------------------------------

# 41. Accessibility

Every UI component must remain usable despite the highly visual design.

Include:

-   Keyboard navigation
-   Visible focus states
-   Semantic HTML
-   Sufficient contrast
-   Screen-reader labels
-   Accessible form controls
-   Reduced-motion support
-   Clear status messaging
-   Non-color-only status indicators

Motion should never be required to understand critical security
information.

------------------------------------------------------------------------

# 42. Implementation Rules for AI Coding Agents

If this plan is given to an AI coding agent, it must follow these rules:

1.  Do not invent a different visual design.
2.  Do not replace the design system with generic SaaS UI.
3.  Do not implement cryptography manually.
4.  Do not move cryptographic operations to the server for convenience.
5.  Do not place raw encryption keys in normal URLs.
6.  Do not send plaintext passwords to the server.
7.  Do not persist plaintext decrypted content in localStorage.
8.  Do not persist plaintext decrypted content in IndexedDB.
9.  Do not store plaintext content on the server.
10. Do not store plaintext encryption keys on the server.
11. Do not add analytics by default.
12. Do not add unnecessary third-party resources.
13. Do not weaken security to simplify implementation.
14. Do not implement advanced features before the required foundation is
    stable.
15. Every major security feature must have tests and a threat model.
16. Keep UI components separated from the cryptographic trust boundary.
17. Reuse the component system rather than creating one-off visual
    elements.
18. Preserve the reference design's minimalist, technical, editorial
    character.

------------------------------------------------------------------------

# 43. Definition of Done

A feature is complete only when:

-   Implementation exists
-   Tests exist
-   Threat model exists
-   Security documentation exists
-   Privacy implications are documented
-   Failure modes are tested
-   Logging has been reviewed
-   No secret is unintentionally transmitted to the server

Security review is part of implementation, not a post-development
activity.

------------------------------------------------------------------------

# 44. Final Implementation Sequence

The overall project should follow this sequence:

``` text
REFERENCE RECORDING
        +
       PRD
        +
 DATABASE SCHEMA
        +
 SECURITY SPECIFICATION
        │
        ▼
┌──────────────────────────┐
│ 1. DESIGN DIRECTION      │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 2. DESIGN SYSTEM         │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 3. PAGE / ROUTE MAP      │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 4. COMPONENT ARCHITECTURE│
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 5. WIREFRAMES            │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 6. HIGH-FIDELITY UI      │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 7. FRONTEND SHELL        │
│    (fake data)           │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 8. CRYPTOGRAPHIC         │
│    PROTOCOL              │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 9. TRUSTED CLIENT        │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 10. STORAGE API          │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 11. TEXT + FILE SHARING  │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 12. PASSWORD + EXPIRY    │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 13. REVOCATION           │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 14. DISCUSSIONS          │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 15. M-OF-N               │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 16. PROTECTED VIEWING    │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 17. BREAK-GLASS          │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 18. WEBRTC / P2P         │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 19. SECURITY REVIEW      │
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│ 20. PRODUCTION HARDENING │
└──────────────────────────┘
```

------------------------------------------------------------------------

# 45. Immediate Next Deliverable

Before starting full implementation, create the following artifact:

## `VaultDrop UI/UX Blueprint`

It should contain:

``` text
1. Design philosophy
2. Color system
3. Typography
4. Grid system
5. Spacing
6. Borders
7. Buttons
8. Inputs
9. Cards
10. Icons
11. Animation principles

12. Landing page
13. Create Share
14. Share Created
15. Share Viewer
16. My Shares
17. Share Management
18. Discussions
19. Settings
20. Admin Console
21. Protected Viewer

22. Component architecture
23. Frontend folder structure
24. Route structure
25. State management
26. API integration boundaries
27. Crypto boundary
28. Responsive behavior
29. Accessibility
30. Implementation order
```

This blueprint is the bridge between the existing documents and actual
coding.

Once approved, the design system can be implemented first, followed by
the frontend shell with fake data, and then the cryptographic/backend
implementation can be integrated without allowing implementation
convenience to weaken the security model.
