"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoProvider = void 0;
const hash_wasm_1 = require("hash-wasm");
const tweetnacl_1 = __importDefault(require("tweetnacl"));
// Robust helper to get Web Crypto Subtle interface in browser and Node.js
const getSubtleCrypto = () => {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
        return globalThis.crypto.subtle;
    }
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        return window.crypto.subtle;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodeCrypto = require('crypto');
        if (nodeCrypto.webcrypto && nodeCrypto.webcrypto.subtle) {
            return nodeCrypto.webcrypto.subtle;
        }
    }
    catch (e) {
        // Ignore require error in browser
    }
    throw new Error('SubtleCrypto is not supported in this environment');
};
const getCrypto = () => {
    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
        return globalThis.crypto;
    }
    if (typeof window !== 'undefined' && window.crypto) {
        return window.crypto;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodeCrypto = require('crypto');
        if (nodeCrypto.webcrypto) {
            return nodeCrypto.webcrypto;
        }
    }
    catch (e) {
        // Ignore require error in browser
    }
    throw new Error('Crypto is not supported in this environment');
};
class CryptoProvider {
    /**
     * Generates a random Uint8Array of the specified size.
     */
    static getRandomBytes(size) {
        const bytes = new Uint8Array(size);
        getCrypto().getRandomValues(bytes);
        return bytes;
    }
    /**
     * Derives a 32-byte key from a password using Argon2id.
     */
    static async deriveKeyFromPassword(password, salt) {
        const hash = await (0, hash_wasm_1.argon2id)({
            password,
            salt,
            parallelism: 1,
            iterations: 3,
            memorySize: 16384, // 16MB standard for browser light KDF
            hashLength: 32,
            outputType: 'binary',
        });
        return hash;
    }
    /**
     * Derives a child key using HKDF (SHA-256) with domain separation.
     */
    static async deriveHKDF(masterKey, info, length = 32) {
        const subtle = getSubtleCrypto();
        const baseKey = await subtle.importKey('raw', masterKey, { name: 'HKDF' }, false, ['deriveBits']);
        const derivedBits = await subtle.deriveBits({
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new Uint8Array(),
            info: new TextEncoder().encode(info),
        }, baseKey, length * 8);
        return new Uint8Array(derivedBits);
    }
    /**
     * Encrypts plaintext using AES-256-GCM.
     */
    static async encryptAES_GCM(plaintext, key, associatedData) {
        const subtle = getSubtleCrypto();
        const nonce = this.getRandomBytes(12); // 12-byte IV for AES-GCM
        const cryptoKey = await subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);
        const encryptParams = {
            name: 'AES-GCM',
            iv: nonce,
            tagLength: 128, // 16-byte tag (128 bits)
        };
        if (associatedData) {
            encryptParams.additionalData = associatedData;
        }
        const encryptedBuffer = await subtle.encrypt(encryptParams, cryptoKey, plaintext);
        const encryptedBytes = new Uint8Array(encryptedBuffer);
        // Web Crypto appends the 16-byte tag at the end of the ciphertext
        const tag = encryptedBytes.slice(-16);
        const ciphertext = encryptedBytes.slice(0, -16);
        return { ciphertext, nonce, tag };
    }
    /**
     * Decrypts ciphertext using AES-256-GCM.
     */
    static async decryptAES_GCM(ciphertext, key, nonce, tag, associatedData) {
        const subtle = getSubtleCrypto();
        const cryptoKey = await subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
        const decryptParams = {
            name: 'AES-GCM',
            iv: nonce,
            tagLength: 128,
        };
        if (associatedData) {
            decryptParams.additionalData = associatedData;
        }
        // Reconstruct Web Crypto input by concatenating ciphertext and tag
        const dataToDecrypt = new Uint8Array(ciphertext.length + tag.length);
        dataToDecrypt.set(ciphertext, 0);
        dataToDecrypt.set(tag, ciphertext.length);
        const decryptedBuffer = await subtle.decrypt(decryptParams, cryptoKey, dataToDecrypt);
        return new Uint8Array(decryptedBuffer);
    }
    /**
     * Generates a key agreement (X25519) keypair.
     */
    static generateBoxKeyPair() {
        return tweetnacl_1.default.box.keyPair();
    }
    /**
     * Generates a signature (Ed25519) keypair.
     */
    static generateSigningKeyPair() {
        return tweetnacl_1.default.sign.keyPair();
    }
    /**
     * Signs a message using Ed25519 private key.
     */
    static signMessage(message, secretKey) {
        return tweetnacl_1.default.sign.detached(message, secretKey);
    }
    /**
     * Verifies an Ed25519 signature.
     */
    static verifySignature(message, signature, publicKey) {
        return tweetnacl_1.default.sign.detached.verify(message, signature, publicKey);
    }
    /**
     * Encrypts a message anonymously for a recipient's X25519 public key.
     * This generates an ephemeral sender keypair to execute key agreement securely.
     * Structure of envelope: [ Ephemeral Public Key (32 bytes) ] + [ Nonce (24 bytes) ] + [ Ciphertext ]
     */
    static encryptForRecipient(data, recipientPublicKey) {
        const ephemeralPair = this.generateBoxKeyPair();
        const nonce = this.getRandomBytes(24); // TweetNaCl uses 24-byte nonces for nacl.box
        const ciphertext = tweetnacl_1.default.box(data, nonce, recipientPublicKey, ephemeralPair.secretKey);
        const envelope = new Uint8Array(32 + 24 + ciphertext.length);
        envelope.set(ephemeralPair.publicKey, 0);
        envelope.set(nonce, 32);
        envelope.set(ciphertext, 32 + 24);
        return envelope;
    }
    /**
     * Decrypts an anonymous envelope using recipient's X25519 private key.
     */
    static decryptForRecipient(envelope, recipientPrivateKey) {
        if (envelope.length < 32 + 24) {
            throw new Error('Invalid envelope length');
        }
        const ephemeralPublicKey = envelope.slice(0, 32);
        const nonce = envelope.slice(32, 32 + 24);
        const ciphertext = envelope.slice(32 + 24);
        const decrypted = tweetnacl_1.default.box.open(ciphertext, nonce, ephemeralPublicKey, recipientPrivateKey);
        if (!decrypted) {
            throw new Error('Failed to decrypt envelope: integrity or key mismatch');
        }
        return decrypted;
    }
}
exports.CryptoProvider = CryptoProvider;
