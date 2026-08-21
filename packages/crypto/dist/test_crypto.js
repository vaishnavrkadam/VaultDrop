"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CryptoProvider_js_1 = require("./CryptoProvider.js");
const threshold_js_1 = require("./threshold.js");
async function runTests() {
    console.log('--- STARTING CRYPTOGRAPHIC TESTS ---');
    // Test 1: Random Bytes
    try {
        const bytes = CryptoProvider_js_1.CryptoProvider.getRandomBytes(16);
        if (bytes.length !== 16)
            throw new Error('Random bytes size mismatch');
        console.log('✓ Random Bytes: OK');
    }
    catch (e) {
        console.error('✗ Random Bytes FAILED:', e);
    }
    // Test 2: Argon2id KDF
    try {
        const salt = new Uint8Array(16);
        salt.fill(0xab);
        const key = await CryptoProvider_js_1.CryptoProvider.deriveKeyFromPassword('super-secret-password', salt);
        if (key.length !== 32)
            throw new Error('Derived key length mismatch');
        console.log('✓ Argon2id KDF: OK');
    }
    catch (e) {
        console.error('✗ Argon2id KDF FAILED:', e);
    }
    // Test 3: HKDF Key Derivation
    try {
        const masterKey = new Uint8Array(32);
        masterKey.fill(0x01);
        const childKey = await CryptoProvider_js_1.CryptoProvider.deriveHKDF(masterKey, 'vaultdrop/test-purpose');
        if (childKey.length !== 32)
            throw new Error('HKDF derived key length mismatch');
        console.log('✓ HKDF Domain Separation: OK');
    }
    catch (e) {
        console.error('✗ HKDF FAILED:', e);
    }
    // Test 4: AES-GCM Encrypt & Decrypt
    try {
        const key = CryptoProvider_js_1.CryptoProvider.getRandomBytes(32);
        const plaintext = new TextEncoder().encode('Hello, VaultDrop! This is a sensitive message.');
        const associatedData = new TextEncoder().encode('share-id-123');
        const encrypted = await CryptoProvider_js_1.CryptoProvider.encryptAES_GCM(plaintext, key, associatedData);
        const decrypted = await CryptoProvider_js_1.CryptoProvider.decryptAES_GCM(encrypted.ciphertext, key, encrypted.nonce, encrypted.tag, associatedData);
        const decryptedStr = new TextDecoder().decode(decrypted);
        if (decryptedStr !== 'Hello, VaultDrop! This is a sensitive message.') {
            throw new Error('Decrypted content mismatch');
        }
        console.log('✓ AES-GCM Encrypt/Decrypt (with AD): OK');
    }
    catch (e) {
        console.error('✗ AES-GCM FAILED:', e);
    }
    // Test 5: Asymmetric Envelope (ECIES Box)
    try {
        const recipientKey = CryptoProvider_js_1.CryptoProvider.generateBoxKeyPair();
        const message = new TextEncoder().encode('Secret Content Encryption Key (CEK)');
        const envelope = CryptoProvider_js_1.CryptoProvider.encryptForRecipient(message, recipientKey.publicKey);
        const decrypted = CryptoProvider_js_1.CryptoProvider.decryptForRecipient(envelope, recipientKey.secretKey);
        const decryptedStr = new TextDecoder().decode(decrypted);
        if (decryptedStr !== 'Secret Content Encryption Key (CEK)') {
            throw new Error('Envelope decryption mismatch');
        }
        console.log('✓ Asymmetric Recipient Envelope (X25519): OK');
    }
    catch (e) {
        console.error('✗ Asymmetric Envelope FAILED:', e);
    }
    // Test 6: Shamir Secret Sharing (M-of-N)
    try {
        const secret = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
        const threshold = 3;
        const totalShares = 5;
        const shares = await threshold_js_1.ShamirSSS.splitSecret(secret, threshold, totalShares);
        if (shares.length !== totalShares)
            throw new Error('Split count mismatch');
        // Combine using exactly threshold (shares 0, 2, 4)
        const subShares = [shares[0], shares[2], shares[4]];
        const combined = await threshold_js_1.ShamirSSS.combineShares(subShares);
        if (Buffer.compare(Buffer.from(secret), Buffer.from(combined)) !== 0) {
            throw new Error('Reconstructed secret mismatch');
        }
        // Attempt combine with less than threshold (shares 0, 1)
        let belowThresholdFailed = false;
        try {
            await threshold_js_1.ShamirSSS.combineShares([shares[0], shares[1]]);
        }
        catch (e) {
            belowThresholdFailed = true;
        }
        console.log('✓ Shamir Secret Sharing (3-of-5): OK');
    }
    catch (e) {
        console.error('✗ Shamir Secret Sharing FAILED:', e);
    }
    console.log('--- CRYPTOGRAPHIC TESTS COMPLETE ---');
}
runTests();
