"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const uuid_1 = require("uuid");
const db_1 = require("./db");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// CORS setup: Allow connections from Next.js development client
app.use((0, cors_1.default)({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json({ limit: '50mb' })); // Allow large pastes/images
// 1. Create a share
app.post('/v1/shares', async (req, res) => {
    try {
        const { shareType, accessMode, ciphertext, nonce, tag, wrappedContentKey, salt, expiry, fileMeta } = req.body;
        if (!shareType || !accessMode || !ciphertext || !nonce || !tag) {
            return res.status(400).send('Missing required cryptographic parameters.');
        }
        const shareId = (0, uuid_1.v4)();
        const createdAt = Date.now();
        // Parse retention expiry duration
        let expiresAt = null;
        if (expiry !== 'never') {
            let durationMs = 7 * 24 * 60 * 60 * 1000; // default 7 days
            if (expiry === '5m')
                durationMs = 5 * 60 * 1000;
            else if (expiry === '1h')
                durationMs = 60 * 60 * 1000;
            else if (expiry === '1d')
                durationMs = 24 * 60 * 60 * 1000;
            else if (expiry === '7d')
                durationMs = 7 * 24 * 60 * 60 * 1000;
            else if (expiry === '30d')
                durationMs = 30 * 24 * 60 * 60 * 1000;
            expiresAt = createdAt + durationMs;
        }
        const burnAfterReading = (expiry === '5m' || expiry === 'burn') ? 1 : 0;
        await (0, db_1.dbRun)(`INSERT INTO shares (
        id, share_type, access_mode, ciphertext, nonce, tag, 
        wrapped_content_key, salt, burn_after_reading, file_meta, 
        expires_at, consumed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`, [
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
            createdAt
        ]);
        console.log(`[SHARE CREATED] ID: ${shareId}, Expiry: ${expiry}, Burn: ${burnAfterReading}`);
        res.status(201).json({ id: shareId });
    }
    catch (e) {
        console.error('Failed to create share:', e);
        res.status(500).send('Internal Server Error');
    }
});
// 2. Fetch share configuration/envelope metadata (No payload)
app.get('/v1/shares/:id/config', async (req, res) => {
    try {
        const { id } = req.params;
        const share = await (0, db_1.dbGet)('SELECT * FROM shares WHERE id = ?', [id]);
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
        res.json({
            id: share.id,
            accessMode: share.access_mode,
            burnAfterReading: share.burn_after_reading === 1,
            salt: share.salt,
            wrappedContentKey: share.wrapped_content_key,
            protectedViewing: share.share_type === 'text' // Auto-protect text shares with watermarks
        });
    }
    catch (e) {
        console.error(e);
        res.status(500).send('Internal Server Error');
    }
});
// 3. Retrieve ciphertext payload
app.get('/v1/shares/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const share = await (0, db_1.dbGet)('SELECT * FROM shares WHERE id = ?', [id]);
        if (!share) {
            return res.status(404).send('Locator share not found.');
        }
        if (share.expires_at && share.expires_at < Date.now()) {
            return res.status(404).send('Share has expired.');
        }
        if (share.consumed_at) {
            return res.status(404).send('Share has been burned.');
        }
        res.json({
            id: share.id,
            shareType: share.share_type,
            ciphertext: share.ciphertext,
            nonce: share.nonce,
            tag: share.tag,
            fileMeta: share.file_meta ? JSON.parse(share.file_meta) : null
        });
    }
    catch (e) {
        console.error(e);
        res.status(500).send('Internal Server Error');
    }
});
// 4. Burn share (consumes access lease)
app.post('/v1/shares/:id/consume', async (req, res) => {
    try {
        const { id } = req.params;
        const share = await (0, db_1.dbGet)('SELECT * FROM shares WHERE id = ?', [id]);
        if (!share) {
            return res.status(404).send('Share not found.');
        }
        // Redact payload columns immediately to guarantee physical destruction of content
        await (0, db_1.dbRun)(`UPDATE shares SET 
        consumed_at = ?,
        ciphertext = '',
        nonce = '',
        tag = '',
        wrapped_content_key = NULL,
        file_meta = NULL
      WHERE id = ?`, [Date.now(), id]);
        console.log(`[SHARE BURNED] Locator ID: ${id}`);
        res.status(200).send('Share consumed successfully.');
    }
    catch (e) {
        console.error(e);
        res.status(500).send('Internal Server Error');
    }
});
// 5. Revoke/delete a share
app.delete('/v1/shares/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Wipe row completely
        await (0, db_1.dbRun)('DELETE FROM shares WHERE id = ?', [id]);
        await (0, db_1.dbRun)('DELETE FROM comments WHERE share_id = ?', [id]);
        console.log(`[SHARE REVOKED] Locator ID: ${id}`);
        res.status(200).send('Share permanently deleted.');
    }
    catch (e) {
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
        const commentId = (0, uuid_1.v4)();
        await (0, db_1.dbRun)(`INSERT INTO comments (
        id, share_id, encrypted_author, author_nonce, author_tag, 
        ciphertext, nonce, tag, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            commentId,
            id,
            encryptedAuthor,
            authorNonce,
            authorTag,
            ciphertext,
            nonce,
            tag,
            Date.now()
        ]);
        res.status(201).json({ id: commentId });
    }
    catch (e) {
        console.error(e);
        res.status(500).send('Internal Server Error');
    }
});
// 7. Get encrypted comments
app.get('/v1/shares/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const comments = await (0, db_1.dbAll)('SELECT * FROM comments WHERE share_id = ? ORDER BY created_at ASC', [id]);
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
    }
    catch (e) {
        console.error(e);
        res.status(500).send('Internal Server Error');
    }
});
// Janitor task: delete expired database shares every 60s
setInterval(async () => {
    try {
        const now = Date.now();
        await (0, db_1.dbRun)('DELETE FROM shares WHERE expires_at IS NOT NULL AND expires_at < ?', [now]);
    }
    catch (e) {
        console.error('Janitor failed to clean expired records:', e);
    }
}, 60000);
// Initialize DB and launch server
(0, db_1.initDb)()
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
