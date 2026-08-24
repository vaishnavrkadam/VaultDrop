import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dns from 'dns';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initDb, dbRun, dbGet, dbAll } from './db';

// Force DNS resolution to prefer IPv4 (resolves ENETUNREACH on IPv6-disabled hosts like Render)
dns.setDefaultResultOrder('ipv4first');

const app = express();
const PORT = process.env.PORT || 3001;

// Use Helmet for securing HTTP headers
app.use(helmet());

// General rate limiter: max 300 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes.'
});

// Stricter rate limiter for share creation: max 15 shares per hour per IP
const shareCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Share creation rate limit exceeded. Please try again after an hour.'
});

app.use(generalLimiter);

// CORS setup: Allow connections from Next.js development client
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      /\.vercel\.app$/
    ];
    const isAllowed = allowed.some(pattern => {
      if (pattern instanceof RegExp) return pattern.test(origin);
      return pattern === origin;
    });
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' })); // Allow large pastes/images

// Share configuration type representation
interface ShareRow {
  id: string;
  share_type: string;
  access_mode: string;
  ciphertext: string;
  nonce: string;
  tag: string;
  wrapped_content_key: string | null;
  salt: string | null;
  burn_after_reading: number;
  file_meta: string | null;
  expires_at: number | null;
  consumed_at: number | null;
  created_at: number;
  allow_comments: number;
}

/**
 * Create a new encrypted share.
 * Accepts client-side encrypted payloads, initialization vectors (nonce), and integrity tags.
 * Rate-limited to prevent automated spam (storage DoS protection).
 */
app.post('/v1/shares', shareCreationLimiter, async (req, res) => {
  try {
    const {
      shareType,
      accessMode,
      ciphertext,
      nonce,
      tag,
      wrappedContentKey,
      salt,
      expiry,
      fileMeta,
      threshold,
      participantCount,
      allowComments
    } = req.body;

    if (!shareType || !accessMode || !ciphertext || !nonce || !tag) {
      return res.status(400).send('Missing required cryptographic parameters.');
    }

    const shareId = uuidv4();
    const createdAt = Date.now();
    
    // Parse retention expiry duration
    let expiresAt: number | null = null;
    if (expiry !== 'never') {
      let durationMs = 7 * 24 * 60 * 60 * 1000; // default 7 days
      if (expiry === '5m') durationMs = 5 * 60 * 1000;
      else if (expiry === '1h') durationMs = 60 * 60 * 1000;
      else if (expiry === '1d') durationMs = 24 * 60 * 60 * 1000;
      else if (expiry === '7d') durationMs = 7 * 24 * 60 * 60 * 1000;
      else if (expiry === '30d') durationMs = 30 * 24 * 60 * 60 * 1000;
      else if (typeof expiry === 'string' && expiry.startsWith('custom:')) {
        const mins = parseInt(expiry.split(':')[1], 10);
        if (!isNaN(mins) && mins > 0) {
          durationMs = mins * 60 * 1000;
        }
      }
      expiresAt = createdAt + durationMs;
    }

    const burnAfterReading = (expiry === '5m' || expiry === 'burn') ? 1 : 0;
    const allowCommentsVal = allowComments ? 1 : 0;

    await dbRun(
      `INSERT INTO shares (
        id, share_type, access_mode, ciphertext, nonce, tag, 
        wrapped_content_key, salt, burn_after_reading, file_meta, 
        expires_at, consumed_at, created_at, allow_comments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [
        shareId,
        shareType,
        accessMode,
        ciphertext,
        nonce,
        tag,
        wrappedContentKey || null,
        salt || null,
        burnAfterReading,
        fileMeta ? JSON.stringify(fileMeta) : null,
        expiresAt,
        createdAt,
        allowCommentsVal
      ]
    );

    if (accessMode === 'threshold' && threshold && participantCount) {
      await dbRun(
        'INSERT INTO threshold_policies (share_id, threshold, participant_count) VALUES (?, ?, ?)',
        [shareId, parseInt(threshold, 10), parseInt(participantCount, 10)]
      );
      console.log(`[THRESHOLD POLICY CREATED] Share ID: ${shareId}, Threshold: ${threshold}/${participantCount}`);
    }

    console.log(`[SHARE CREATED] ID: ${shareId}, Expiry: ${expiry}, Burn: ${burnAfterReading}`);
    res.status(201).json({ id: shareId });
  } catch (e: any) {
    console.error('Failed to create share:', e);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Retrieve metadata envelope configuration for a specific share (e.g. access mode, KDF salt, SSS lobby status).
 * Does not return the encrypted content payload itself to preserve access checks separation.
 */
app.get('/v1/shares/:id/config', async (req, res) => {
  try {
    const { id } = req.params;
    const share = await dbGet<ShareRow>('SELECT * FROM shares WHERE id = ?', [id]);

    if (!share) {
      return res.status(404).send('Locator share not found.');
    }

    // Check if share is expired
    if (share.expires_at && share.expires_at < Date.now()) {
      return res.status(404).send('Share has expired.');
    }

    // Check if share has already been burned
    if (share.consumed_at) {
      return res.status(404).send('Share has been burned.');
    }

    let submittedCount = 0;
    let threshold = 0;
    let participantCount = 0;

    if (share.access_mode === 'threshold') {
      const policy = await dbGet<any>('SELECT * FROM threshold_policies WHERE share_id = ?', [id]);
      if (policy) {
        threshold = policy.threshold;
        participantCount = policy.participant_count;
        const submitted = await dbAll<any>('SELECT * FROM threshold_shares WHERE share_id = ?', [id]);
        submittedCount = submitted.length;
      }
    }

    res.json({
      id: share.id,
      accessMode: share.access_mode,
      burnAfterReading: share.burn_after_reading === 1,
      salt: share.salt,
      wrappedContentKey: share.wrapped_content_key,
      protectedViewing: share.share_type === 'text', // Auto-protect text shares with watermarks
      submittedCount,
      threshold,
      participantCount,
      allowComments: share.allow_comments === 1
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Internal Server Error');
  }
});

// 3. Retrieve ciphertext payload
app.get('/v1/shares/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const share = await dbGet<ShareRow>('SELECT * FROM shares WHERE id = ?', [id]);

    if (!share) {
      return res.status(404).send('Locator share not found.');
    }

    if (share.expires_at && share.expires_at < Date.now()) {
      return res.status(404).send('Share has expired.');
    }

    if (share.consumed_at) {
      return res.status(404).send('Share has been burned.');
    }

    if (share.burn_after_reading === 1) {
      await dbRun(
        `UPDATE shares SET 
          consumed_at = ?,
          ciphertext = '',
          nonce = '',
          tag = '',
          wrapped_content_key = NULL,
          file_meta = NULL
        WHERE id = ?`,
        [Date.now(), id]
      );
      console.log(`[SHARE AUTO-BURNED ON RETRIEVAL] ID: ${id}`);
    }

    res.json({
      id: share.id,
      shareType: share.share_type,
      ciphertext: share.ciphertext,
      nonce: share.nonce,
      tag: share.tag,
      fileMeta: share.file_meta ? JSON.parse(share.file_meta) : null
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Internal Server Error');
  }
});

// 4. Burn share (consumes access lease)
app.post('/v1/shares/:id/consume', async (req, res) => {
  try {
    const { id } = req.params;
    const share = await dbGet<ShareRow>('SELECT * FROM shares WHERE id = ?', [id]);

    if (!share) {
      return res.status(404).send('Share not found.');
    }

    // Redact payload columns immediately to guarantee physical destruction of content
    await dbRun(
      `UPDATE shares SET 
        consumed_at = ?,
        ciphertext = '',
        nonce = '',
        tag = '',
        wrapped_content_key = NULL,
        file_meta = NULL
      WHERE id = ?`,
      [Date.now(), id]
    );

    console.log(`[SHARE BURNED] Locator ID: ${id}`);
    res.status(200).send('Share consumed successfully.');
  } catch (e) {
    console.error(e);
    res.status(500).send('Internal Server Error');
  }
});

// 5. Revoke/delete a share
app.delete('/v1/shares/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Wipe row completely
    await dbRun('DELETE FROM shares WHERE id = ?', [id]);
    await dbRun('DELETE FROM comments WHERE share_id = ?', [id]);
    
    console.log(`[SHARE REVOKED] Locator ID: ${id}`);
    res.status(200).send('Share permanently deleted.');
  } catch (e) {
    console.error(e);
    res.status(500).send('Internal Server Error');
  }
});

// 6. Post encrypted comment
app.post('/v1/shares/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { encryptedAuthor, authorNonce, authorTag, ciphertext, nonce, tag } = req.body;

    if (!encryptedAuthor || !authorNonce || !authorTag || !ciphertext || !nonce || !tag) {
      return res.status(400).send('Missing encrypted comment payload fields.');
    }

    const share = await dbGet<ShareRow>('SELECT * FROM shares WHERE id = ?', [id]);
    if (!share) {
      return res.status(404).send('Share not found.');
    }
    if (share.allow_comments !== 1) {
      return res.status(403).send('Comments are disabled for this share.');
    }

    const commentId = uuidv4();
    await dbRun(
      `INSERT INTO comments (
        id, share_id, encrypted_author, author_nonce, author_tag, 
        ciphertext, nonce, tag, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        commentId,
        id,
        encryptedAuthor,
        authorNonce,
        authorTag,
        ciphertext,
        nonce,
        tag,
        Date.now()
      ]
    );

    res.status(201).json({ id: commentId });
  } catch (e) {
    console.error(e);
    res.status(500).send('Internal Server Error');
  }
});

// 7. Get encrypted comments
app.get('/v1/shares/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const comments = await dbAll<any>(
      'SELECT * FROM comments WHERE share_id = ? ORDER BY created_at ASC',
      [id]
    );

    res.json(comments.map(c => ({
      id: c.id,
      encryptedAuthor: c.encrypted_author,
      authorNonce: c.author_nonce,
      authorTag: c.author_tag,
      ciphertext: c.ciphertext,
      nonce: c.nonce,
      tag: c.tag,
      createdAt: c.created_at
    })));
  } catch (e) {
    console.error(e);
    res.status(500).send('Internal Server Error');
  }
});

// 8. Submit a Shamir secret share to the threshold lobby
app.post('/v1/shares/:id/submit-share', async (req, res) => {
  try {
    const { id } = req.params;
    const { shareIndex, secretShare } = req.body;

    if (shareIndex === undefined || !secretShare) {
      return res.status(400).send('Missing shareIndex or secretShare.');
    }

    const policy = await dbGet<any>('SELECT * FROM threshold_policies WHERE share_id = ?', [id]);
    if (!policy) {
      return res.status(404).send('No threshold policy found for this share.');
    }

    const shareIdDb = uuidv4();
    // Insert and ignore duplicate index submissions
    if (parseInt(shareIndex, 10) >= 0) {
      try {
        await dbRun(
          'INSERT INTO threshold_shares (id, share_id, share_index, encrypted_secret_share, created_at) VALUES (?, ?, ?, ?, ?)',
          [shareIdDb, id, parseInt(shareIndex, 10), secretShare, Date.now()]
        );
        console.log(`[SHARE SUBMITTED] Share ID: ${id}, Index: ${shareIndex}`);
      } catch (e) {
        // Duplicate share_index matches, ignore or update
        console.log(`[SHARE DUPLICATE] Share ID: ${id}, Index: ${shareIndex} already submitted`);
      }
    }

    // Get current submitted count
    const submitted = await dbAll<any>('SELECT * FROM threshold_shares WHERE share_id = ?', [id]);
    const submittedCount = submitted.length;
    const isCompleted = submittedCount >= policy.threshold;

    res.json({
      status: isCompleted ? 'completed' : 'pending',
      submittedCount,
      threshold: policy.threshold,
      participantCount: policy.participant_count
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Internal Server Error');
  }
});

// 9. Retrieve all submitted shares (only released once threshold is met)
app.get('/v1/shares/:id/shares', async (req, res) => {
  try {
    const { id } = req.params;
    const requesterIndex = req.query.shareIndex;
    const requesterSecretShare = req.query.secretShare;

    if (requesterIndex === undefined || !requesterSecretShare) {
      return res.status(401).send('Unauthorized. Requester share proof is required.');
    }

    const policy = await dbGet<any>('SELECT * FROM threshold_policies WHERE share_id = ?', [id]);
    if (!policy) {
      return res.status(404).send('No threshold policy found.');
    }

    // Verify that the requester holds a valid share in this specific lobby
    const requesterIndexNum = parseInt(requesterIndex as string, 10);
    const match = await dbGet<any>(
      'SELECT * FROM threshold_shares WHERE share_id = ? AND share_index = ? AND encrypted_secret_share = ?',
      [id, requesterIndexNum, requesterSecretShare]
    );

    if (!match) {
      return res.status(401).send('Unauthorized. Invalid shareholder credentials.');
    }

    const submitted = await dbAll<any>('SELECT * FROM threshold_shares WHERE share_id = ?', [id]);
    const submittedCount = submitted.length;

    if (submittedCount < policy.threshold) {
      return res.status(403).json({
        error: 'Threshold not met.',
        submittedCount,
        threshold: policy.threshold
      });
    }

    res.json(submitted.map(s => ({
      shareIndex: s.share_index,
      secretShare: s.encrypted_secret_share
    })));
  } catch (e) {
    console.error(e);
    res.status(500).send('Internal Server Error');
  }
});

// Janitor task: delete expired database shares every 60s
setInterval(async () => {
  try {
    const now = Date.now();
    await dbRun('DELETE FROM shares WHERE expires_at IS NOT NULL AND expires_at < ?', [now]);
  } catch (e) {
    console.error('Janitor failed to clean expired records:', e);
  }
}, 60000);

// Initialize DB and launch server
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(` VaultDrop Secure API Server Running on port ${PORT}`);
      console.log(` Mode: Zero-Knowledge / Content is Encrypted`);
      console.log(`===============================================`);
    });
  })
  .catch(err => {
    console.error('Failed to launch VaultDrop API:', err);
    process.exit(1);
  });
