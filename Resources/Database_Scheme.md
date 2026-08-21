# Database Schema

## 1. Database

Use:

**PostgreSQL 16+**

The database stores metadata and encrypted envelopes.

It must never store plaintext content or plaintext encryption keys.

---

# 2. UUID Strategy

Use UUIDv7 where ordering is useful.

Use cryptographically random opaque identifiers for externally visible share/object IDs.

Do not expose PostgreSQL sequential IDs.

---

# 3. users

Stores authenticated users.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    public_id VARCHAR(64) UNIQUE NOT NULL,

    username VARCHAR(255),
    email_ciphertext BYTEA,

    status VARCHAR(32) NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

The email address should be encrypted if the deployment's privacy model requires it.

---

# 4. user_keys

Stores public keys only.

```sql
CREATE TABLE user_keys (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    key_type VARCHAR(32) NOT NULL,
    algorithm VARCHAR(32) NOT NULL,

    public_key BYTEA NOT NULL,

    key_version INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_user_keys_user
ON user_keys(user_id);
```

Examples:

```text
identity-signing
key-agreement
recovery
```

Private keys must never be stored here.

---

# 5. shares

The central share record.

```sql
CREATE TABLE shares (
    id UUID PRIMARY KEY,

    public_id VARCHAR(64) UNIQUE NOT NULL,

    owner_user_id UUID REFERENCES users(id),

    share_type VARCHAR(32) NOT NULL,
    access_mode VARCHAR(32) NOT NULL,

    encryption_version INTEGER NOT NULL,

    authorization_epoch BIGINT NOT NULL DEFAULT 1,

    expires_at TIMESTAMPTZ,

    burn_after_reading BOOLEAN NOT NULL DEFAULT FALSE,

    revoked_at TIMESTAMPTZ,

    consumed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Example values:

```text
share_type:
    text
    file
    mixed

access_mode:
    anonymous
    password
    recipient
    threshold
```

---

# 6. share_crypto

Stores public cryptographic metadata.

```sql
CREATE TABLE share_crypto (
    share_id UUID PRIMARY KEY REFERENCES shares(id) ON DELETE CASCADE,

    algorithm VARCHAR(64) NOT NULL,

    salt BYTEA,

    kdf_algorithm VARCHAR(32),

    kdf_parameters JSONB,

    wrapped_content_key BYTEA,

    key_version INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

For threshold shares, `wrapped_content_key` may remain NULL because the CEK is reconstructed from shares.

---

# 7. share_capabilities

Optional anonymous capabilities.

```sql
CREATE TABLE share_capabilities (
    id UUID PRIMARY KEY,

    share_id UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,

    capability_hash BYTEA NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ,

    max_uses INTEGER,

    uses INTEGER NOT NULL DEFAULT 0,

    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Never store the raw capability if it can be avoided.

Store a cryptographic hash.

---

# 8. share_recipients

Maps users to shares.

```sql
CREATE TABLE share_recipients (
    id UUID PRIMARY KEY,

    share_id UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,

    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    recipient_key_id UUID REFERENCES user_keys(id),

    encrypted_key_envelope BYTEA,

    recipient_role VARCHAR(32),

    status VARCHAR(32) NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_share_recipients_share
ON share_recipients(share_id);

CREATE INDEX idx_share_recipients_user
ON share_recipients(user_id);
```

The encrypted key envelope contains the CEK encrypted for the recipient.

---

# 9. threshold_policies

```sql
CREATE TABLE threshold_policies (
    id UUID PRIMARY KEY,

    share_id UUID NOT NULL UNIQUE REFERENCES shares(id) ON DELETE CASCADE,

    threshold INTEGER NOT NULL,

    participant_count INTEGER NOT NULL,

    version INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (threshold >= 2),
    CHECK (participant_count >= threshold)
);
```

---

# 10. threshold_shares

Stores encrypted Shamir shares.

```sql
CREATE TABLE threshold_shares (
    id UUID PRIMARY KEY,

    policy_id UUID NOT NULL REFERENCES threshold_policies(id) ON DELETE CASCADE,

    recipient_id UUID REFERENCES share_recipients(id) ON DELETE CASCADE,

    encrypted_secret_share BYTEA NOT NULL,

    share_index INTEGER NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(policy_id, share_index)
);
```

The plaintext Shamir share must never be stored.

---

# 11. recovery_policies

For emergency recovery.

```sql
CREATE TABLE recovery_policies (
    id UUID PRIMARY KEY,

    share_id UUID NOT NULL UNIQUE REFERENCES shares(id) ON DELETE CASCADE,

    threshold INTEGER NOT NULL,

    trustee_count INTEGER NOT NULL,

    hardware_key_required BOOLEAN NOT NULL DEFAULT TRUE,

    enabled BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (threshold >= 1),
    CHECK (trustee_count >= threshold)
);
```

---

# 12. recovery_trustees

```sql
CREATE TABLE recovery_trustees (
    id UUID PRIMARY KEY,

    recovery_policy_id UUID NOT NULL
        REFERENCES recovery_policies(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL REFERENCES users(id),

    encrypted_recovery_share BYTEA NOT NULL,

    hardware_key_required BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    revoked_at TIMESTAMPTZ
);
```

---

# 13. files

File metadata.

```sql
CREATE TABLE files (
    id UUID PRIMARY KEY,

    share_id UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,

    public_id VARCHAR(64) UNIQUE NOT NULL,

    encrypted_filename BYTEA,

    encrypted_mime_type BYTEA,

    plaintext_size BIGINT,

    padded_size BIGINT,

    chunk_size INTEGER NOT NULL,

    chunk_count INTEGER,

    encryption_version INTEGER NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_files_share
ON files(share_id);
```

---

# 14. file_objects

Maps files to object-storage objects.

```sql
CREATE TABLE file_objects (
    id UUID PRIMARY KEY,

    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,

    chunk_index INTEGER NOT NULL,

    object_key VARCHAR(512) NOT NULL,

    ciphertext_size BIGINT,

    ciphertext_hash BYTEA,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(file_id, chunk_index)
);
```

The object key must not expose the original filename.

---

# 15. encrypted_text

Text content should also be stored as encrypted objects rather than plaintext database fields.

```sql
CREATE TABLE encrypted_text (
    id UUID PRIMARY KEY,

    share_id UUID NOT NULL UNIQUE REFERENCES shares(id) ON DELETE CASCADE,

    ciphertext BYTEA NOT NULL,

    nonce BYTEA NOT NULL,

    authentication_tag BYTEA,

    compression_algorithm VARCHAR(32),

    formatter VARCHAR(64),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

For very large text, use object storage instead.

---

# 16. comments

Comments contain ciphertext only.

```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY,

    share_id UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,

    author_user_id UUID REFERENCES users(id),

    encrypted_author BYTEA,

    ciphertext BYTEA NOT NULL,

    nonce BYTEA NOT NULL,

    authentication_tag BYTEA,

    encryption_version INTEGER NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_comments_share
ON comments(share_id, created_at);
```

The author nickname should be encrypted when privacy mode requires it.

---

# 17. access_leases

Short-lived authorization leases.

```sql
CREATE TABLE access_leases (
    id UUID PRIMARY KEY,

    share_id UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,

    recipient_id UUID REFERENCES share_recipients(id),

    authorization_epoch BIGINT NOT NULL,

    lease_hash BYTEA NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    consumed_at TIMESTAMPTZ,

    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_leases_share
ON access_leases(share_id);
```

Raw lease tokens should not be stored.

---

# 18. audit_events

Audit events should contain only the metadata necessary for security auditing.

```sql
CREATE TABLE audit_events (
    id UUID PRIMARY KEY,

    share_id UUID REFERENCES shares(id) ON DELETE SET NULL,

    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    event_type VARCHAR(64) NOT NULL,

    authorization_epoch BIGINT,

    metadata_ciphertext BYTEA,

    event_hash BYTEA,

    previous_event_hash BYTEA,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

The hash chain provides tamper evidence.

For highly sensitive deployments, event metadata can be encrypted to an organizational audit key.

---

# 19. break_glass_events

Separate break-glass records.

```sql
CREATE TABLE break_glass_events (
    id UUID PRIMARY KEY,

    share_id UUID NOT NULL REFERENCES shares(id),

    requested_by UUID REFERENCES users(id),

    reason_ciphertext BYTEA NOT NULL,

    authorization_method VARCHAR(64) NOT NULL,

    trustee_count_required INTEGER NOT NULL,

    trustee_count_approved INTEGER NOT NULL DEFAULT 0,

    status VARCHAR(32) NOT NULL,

    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    completed_at TIMESTAMPTZ,

    failed_at TIMESTAMPTZ
);
```

Possible status:

```text
pending
approved
completed
denied
expired
failed
```

---

# 20. notifications

For revocation and break-glass notifications.

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY,

    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    event_type VARCHAR(64) NOT NULL,

    payload_ciphertext BYTEA,

    delivered_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Do not put sensitive content directly into push notification payloads.

---

# 21. sessions

Avoid persistent sessions for anonymous users.

Authenticated sessions may use:

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY,

    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    token_hash BYTEA NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    expires_at TIMESTAMPTZ NOT NULL,

    revoked_at TIMESTAMPTZ
);
```

Never store raw session tokens.

---

# 22. upload_sessions

Supports resumable uploads.

```sql
CREATE TABLE upload_sessions (
    id UUID PRIMARY KEY,

    share_id UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,

    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,

    upload_token_hash BYTEA NOT NULL UNIQUE,

    expected_chunks INTEGER,

    received_chunks INTEGER NOT NULL DEFAULT 0,

    status VARCHAR(32) NOT NULL DEFAULT 'active',

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

# 23. WebRTC Signaling

Only if WebRTC is implemented.

```sql
CREATE TABLE signaling_sessions (
    id UUID PRIMARY KEY,

    public_id VARCHAR(64) UNIQUE NOT NULL,

    initiator_ephemeral_key BYTEA,

    responder_ephemeral_key BYTEA,

    state VARCHAR(32) NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Signaling data must be ephemeral.

Do not turn the signaling server into a persistent communication archive.

---

# 24. Abuse Controls

Use privacy-preserving operational state.

```sql
CREATE TABLE quota_counters (
    id UUID PRIMARY KEY,

    scope_hash BYTEA NOT NULL,

    counter_type VARCHAR(64) NOT NULL,

    counter_value BIGINT NOT NULL DEFAULT 0,

    window_start TIMESTAMPTZ NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_quota_scope
ON quota_counters(scope_hash, counter_type);
```

Where possible, counters should be short-lived.

Do not retain raw IP addresses merely to implement rate limiting.

---

# 25. Retention

Every data category should have an explicit retention policy.

Example:

```text
share metadata:
until share expiration + cleanup period

ciphertext:
until expiration/revocation cleanup

access leases:
minutes

signaling:
minutes

operational rate-limit counters:
minutes/hours

audit:
deployment-configured retention

break-glass audit:
long-term retention
```

---

# 26. Deletion Model

Deletion must occur in layers:

```text
logical revoke
      ↓
authorization invalidated
      ↓
database metadata deleted/marked
      ↓
object storage deletion
      ↓
backup lifecycle
```

The system must document that object-store backups may have their own retention periods.

---

# 27. Database Security

Use:

* TLS connections;
* separate database roles;
* least privilege;
* encrypted backups;
* restricted network access;
* migration-only schema permissions;
* no application superuser.

The API should never connect as PostgreSQL superuser.

---

# 28. Database Principle

The database must be considered compromised during threat modeling.

Ask:

> If an attacker copies the entire PostgreSQL database tonight, can they decrypt a share created yesterday?

Expected answer:

**No.**

If the answer becomes **yes**, the cryptographic architecture is wrong.

---

# 29. Final Data Flow

The complete system should conceptually operate as:

```text
                  USER A
                    │
              plaintext/file
                    │
                    ▼
          ┌───────────────────┐
          │ Trusted Client    │
          │                   │
          │ Generate CEK      │
          │ Encrypt content   │
          │ Encrypt metadata  │
          │ Create envelopes  │
          └─────────┬─────────┘
                    │
             ciphertext only
                    │
                    ▼
          ┌───────────────────┐
          │ VaultDrop API     │
          └─────────┬─────────┘
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
   ┌─────────────┐     ┌─────────────┐
   │ PostgreSQL  │     │ Object Store│
   │ metadata    │     │ ciphertext  │
   └─────────────┘     └─────────────┘


                  USER B
                    │
                    ▼
          ┌───────────────────┐
          │ Trusted Client    │
          │                   │
          │ Obtain envelope   │
          │ Authenticate      │
          │ Reconstruct key   │
          │ Decrypt locally   │
          └───────────────────┘
                    │
                    ▼
               plaintext
```

This separation is the core security property of VaultDrop.
