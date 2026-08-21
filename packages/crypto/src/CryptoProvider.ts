import { argon2id } from 'hash-wasm';
import nacl from 'tweetnacl';

// Robust helper to get Web Crypto Subtle interface in browser and Node.js
const getSubtleCrypto = (): SubtleCrypto => {
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
  } catch (e) {
    // Ignore require error in browser
  }
  throw new Error('SubtleCrypto is not supported in this environment');
};

const getCrypto = (): Crypto => {
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
      return nodeCrypto.webcrypto as unknown as Crypto;
    }
  } catch (e) {
    // Ignore require error in browser
  }
  throw new Error('Crypto is not supported in this environment');
};

export class CryptoProvider {
  /**
   * Generates a random Uint8Array of the specified size.
   */
  static getRandomBytes(size: number): Uint8Array {
    const bytes = new Uint8Array(size);
    getCrypto().getRandomValues(bytes);
    return bytes;
  }

  /**
   * Derives a 32-byte key from a password using Argon2id.
   */
  static async deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<Uint8Array> {
    const hash = await argon2id({
      password,
      salt,
      parallelism: 1,
      iterations: 3,
      memorySize: 16384, // 16MB standard for browser light KDF
      hashLength: 32,
      outputType: 'binary',
    });
    return hash as Uint8Array;
  }

  /**
   * Derives a child key using HKDF (SHA-256) with domain separation.
   */
  static async deriveHKDF(masterKey: Uint8Array, info: string, length = 32): Promise<Uint8Array> {
    const subtle = getSubtleCrypto();
    const baseKey = await subtle.importKey(
      'raw',
      masterKey as any,
      { name: 'HKDF' },
      false,
      ['deriveBits']
    );

    const derivedBits = await subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(),
        info: new TextEncoder().encode(info),
      },
      baseKey,
      length * 8
    );

    return new Uint8Array(derivedBits);
  }

  /**
   * Encrypts plaintext using AES-256-GCM.
   */
  static async encryptAES_GCM(
    plaintext: Uint8Array,
    key: Uint8Array,
    associatedData?: Uint8Array
  ): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array; tag: Uint8Array }> {
    const subtle = getSubtleCrypto();
    const nonce = this.getRandomBytes(12); // 12-byte IV for AES-GCM
    const cryptoKey = await subtle.importKey(
      'raw',
      key as any,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const encryptParams: AesGcmParams = {
      name: 'AES-GCM',
      iv: nonce as any,
      tagLength: 128, // 16-byte tag (128 bits)
    };
    if (associatedData) {
      encryptParams.additionalData = associatedData as any;
    }

    const encryptedBuffer = await subtle.encrypt(encryptParams, cryptoKey, plaintext as any);
    const encryptedBytes = new Uint8Array(encryptedBuffer);

    // Web Crypto appends the 16-byte tag at the end of the ciphertext
    const tag = encryptedBytes.slice(-16);
    const ciphertext = encryptedBytes.slice(0, -16);

    return { ciphertext, nonce, tag };
  }

  /**
   * Decrypts ciphertext using AES-256-GCM.
   */
  static async decryptAES_GCM(
    ciphertext: Uint8Array,
    key: Uint8Array,
    nonce: Uint8Array,
    tag: Uint8Array,
    associatedData?: Uint8Array
  ): Promise<Uint8Array> {
    const subtle = getSubtleCrypto();
    const cryptoKey = await subtle.importKey(
      'raw',
      key as any,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decryptParams: AesGcmParams = {
      name: 'AES-GCM',
      iv: nonce as any,
      tagLength: 128,
    };
    if (associatedData) {
      decryptParams.additionalData = associatedData as any;
    }

    // Reconstruct Web Crypto input by concatenating ciphertext and tag
    const dataToDecrypt = new Uint8Array(ciphertext.length + tag.length);
    dataToDecrypt.set(ciphertext, 0);
    dataToDecrypt.set(tag, ciphertext.length);

    const decryptedBuffer = await subtle.decrypt(decryptParams, cryptoKey, dataToDecrypt as any);
    return new Uint8Array(decryptedBuffer);
  }

  /**
   * Generates a key agreement (X25519) keypair.
   */
  static generateBoxKeyPair(): nacl.BoxKeyPair {
    return nacl.box.keyPair();
  }

  /**
   * Generates a signature (Ed25519) keypair.
   */
  static generateSigningKeyPair(): nacl.SignKeyPair {
    return nacl.sign.keyPair();
  }

  /**
   * Signs a message using Ed25519 private key.
   */
  static signMessage(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
    return nacl.sign.detached(message, secretKey);
  }

  /**
   * Verifies an Ed25519 signature.
   */
  static verifySignature(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
    return nacl.sign.detached.verify(message, signature, publicKey);
  }

  /**
   * Encrypts a message anonymously for a recipient's X25519 public key.
   * This generates an ephemeral sender keypair to execute key agreement securely.
   * Structure of envelope: [ Ephemeral Public Key (32 bytes) ] + [ Nonce (24 bytes) ] + [ Ciphertext ]
   */
  static encryptForRecipient(data: Uint8Array, recipientPublicKey: Uint8Array): Uint8Array {
    const ephemeralPair = this.generateBoxKeyPair();
    const nonce = this.getRandomBytes(24); // TweetNaCl uses 24-byte nonces for nacl.box

    const ciphertext = nacl.box(
      data,
      nonce,
      recipientPublicKey,
      ephemeralPair.secretKey
    );

    const envelope = new Uint8Array(32 + 24 + ciphertext.length);
    envelope.set(ephemeralPair.publicKey, 0);
    envelope.set(nonce, 32);
    envelope.set(ciphertext, 32 + 24);

    return envelope;
  }

  /**
   * Decrypts an anonymous envelope using recipient's X25519 private key.
   */
  static decryptForRecipient(envelope: Uint8Array, recipientPrivateKey: Uint8Array): Uint8Array {
    if (envelope.length < 32 + 24) {
      throw new Error('Invalid envelope length');
    }

    const ephemeralPublicKey = envelope.slice(0, 32);
    const nonce = envelope.slice(32, 32 + 24);
    const ciphertext = envelope.slice(32 + 24);

    const decrypted = nacl.box.open(
      ciphertext,
      nonce,
      ephemeralPublicKey,
      recipientPrivateKey
    );

    if (!decrypted) {
      throw new Error('Failed to decrypt envelope: integrity or key mismatch');
    }

    return decrypted;
  }
}
