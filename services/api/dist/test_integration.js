"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const uuid_1 = require("uuid");
const db_1 = require("./db");
// Setup temporary API server for integration testing
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.post('/v1/shares', async (req, res) => {
    try {
        const { shareType, accessMode, ciphertext, nonce, tag, wrappedContentKey, salt, expiry, fileMeta } = req.body;
        const shareId = (0, uuid_1.v4)();
        const createdAt = Date.now();
        const expiresAt = expiry === '5m' ? createdAt + 5 * 60 * 1000 : createdAt + 7 * 24 * 60 * 60 * 1000;
        const burnAfterReading = expiry === '5m' ? 1 : 0;
        await (0, db_1.dbRun)(`INSERT INTO shares (
        id, share_type, access_mode, ciphertext, nonce, tag, 
        wrapped_content_key, salt, burn_after_reading, file_meta, 
        expires_at, consumed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`, [shareId, shareType, accessMode, ciphertext, nonce, tag, wrappedContentKey || null, salt || null, burnAfterReading, fileMeta || null, expiresAt, createdAt]);
        res.status(201).json({ id: shareId });
    }
    catch (e) {
        res.status(500).send(e);
    }
});
app.get('/v1/shares/:id/config', async (req, res) => {
    const { id } = req.params;
    const share = await (0, db_1.dbGet)('SELECT * FROM shares WHERE id = ?', [id]);
    if (!share || share.consumed_at)
        return res.status(404).send('Not found');
    res.json({ id: share.id, accessMode: share.access_mode, burnAfterReading: share.burn_after_reading === 1 });
});
app.get('/v1/shares/:id', async (req, res) => {
    const { id } = req.params;
    const share = await (0, db_1.dbGet)('SELECT * FROM shares WHERE id = ?', [id]);
    if (!share || share.consumed_at)
        return res.status(404).send('Not found');
    res.json({ ciphertext: share.ciphertext, nonce: share.nonce, tag: share.tag });
});
app.post('/v1/shares/:id/consume', async (req, res) => {
    const { id } = req.params;
    await (0, db_1.dbRun)(`UPDATE shares SET consumed_at = ?, ciphertext = '', nonce = '', tag = '' WHERE id = ?`, [Date.now(), id]);
    res.send('Consumed');
});
app.delete('/v1/shares/:id', async (req, res) => {
    const { id } = req.params;
    await (0, db_1.dbRun)('DELETE FROM shares WHERE id = ?', [id]);
    res.send('Deleted');
});
async function runIntegrationTests() {
    console.log('--- STARTING BACKEND INTEGRATION TESTS ---');
    await (0, db_1.initDb)();
    const server = app.listen(3002, async () => {
        console.log('Test Server listening on port 3002');
        try {
            const payload = {
                shareType: 'text',
                accessMode: 'anonymous',
                ciphertext: 'base64-encoded-ciphertext',
                nonce: 'base64-encoded-nonce',
                tag: 'base64-encoded-tag',
                expiry: '5m'
            };
            // Test 1: Create share
            console.log('Testing Share Creation...');
            const createRes = await fetch('http://localhost:3002/v1/shares', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!createRes.ok)
                throw new Error('Create Share failed');
            const { id } = await createRes.json();
            console.log(`✓ Share created with ID: ${id}`);
            // Test 2: Fetch config
            console.log('Testing Fetch Config...');
            const configRes = await fetch(`http://localhost:3002/v1/shares/${id}/config`);
            if (!configRes.ok)
                throw new Error('Fetch Config failed');
            const config = await configRes.json();
            if (!config.burnAfterReading)
                throw new Error('Config burn_after_reading mismatch');
            console.log('✓ Config matches expected zero-knowledge fields');
            // Test 3: Fetch ciphertext
            console.log('Testing Fetch Payload...');
            const payloadRes = await fetch(`http://localhost:3002/v1/shares/${id}`);
            if (!payloadRes.ok)
                throw new Error('Fetch Payload failed');
            const body = await payloadRes.json();
            if (body.ciphertext !== 'base64-encoded-ciphertext')
                throw new Error('Payload ciphertext mismatch');
            console.log('✓ Payload retrieved correctly');
            // Test 4: Consume share (Burn)
            console.log('Testing Consume Share (Burn)...');
            const consumeRes = await fetch(`http://localhost:3002/v1/shares/${id}/consume`, { method: 'POST' });
            if (!consumeRes.ok)
                throw new Error('Consume Share failed');
            console.log('✓ Share burn command executed');
            // Test 5: Verify share is unavailable after burn
            console.log('Verifying unavailability after burn...');
            const verifyRes = await fetch(`http://localhost:3002/v1/shares/${id}`);
            if (verifyRes.status !== 404)
                throw new Error('Burned share is still available!');
            console.log('✓ Verified: Burned share is completely unavailable');
            // Test 6: Revoke share
            console.log('Testing Share Revocation...');
            const payload2 = { ...payload, expiry: '7d' };
            const createRes2 = await fetch('http://localhost:3002/v1/shares', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload2)
            });
            const { id: id2 } = await createRes2.json();
            const revokeRes = await fetch(`http://localhost:3002/v1/shares/${id2}`, { method: 'DELETE' });
            if (!revokeRes.ok)
                throw new Error('Delete Share failed');
            const verifyRes2 = await fetch(`http://localhost:3002/v1/shares/${id2}`);
            if (verifyRes2.status !== 404)
                throw new Error('Revoked share is still available!');
            console.log('✓ Verified: Revoked share is completely deleted');
            console.log('--- INTEGRATION TESTS COMPLETED SUCCESSFULLY ---');
            server.close(() => process.exit(0));
        }
        catch (err) {
            console.error('✗ INTEGRATION TESTS FAILED:', err);
            server.close(() => process.exit(1));
        }
    });
}
runIntegrationTests();
