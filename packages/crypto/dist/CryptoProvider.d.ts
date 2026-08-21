import nacl from 'tweetnacl';
export declare class CryptoProvider {
    /**
     * Generates a random Uint8Array of the specified size.
     */
    static getRandomBytes(size: number): Uint8Array;
    /**
     * Derives a 32-byte key from a password using Argon2id.
     */
    static deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<Uint8Array>;
    /**
     * Derives a child key using HKDF (SHA-256) with domain separation.
     */
    static deriveHKDF(masterKey: Uint8Array, info: string, length?: number): Promise<Uint8Array>;
    /**
     * Encrypts plaintext using AES-256-GCM.
     */
    static encryptAES_GCM(plaintext: Uint8Array, key: Uint8Array, associatedData?: Uint8Array): Promise<{
        ciphertext: Uint8Array;
        nonce: Uint8Array;
        tag: Uint8Array;
    }>;
    /**
     * Decrypts ciphertext using AES-256-GCM.
     */
    static decryptAES_GCM(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array, tag: Uint8Array, associatedData?: Uint8Array): Promise<Uint8Array>;
    /**
     * Generates a key agreement (X25519) keypair.
     */
    static generateBoxKeyPair(): nacl.BoxKeyPair;
    /**
     * Generates a signature (Ed25519) keypair.
     */
    static generateSigningKeyPair(): nacl.SignKeyPair;
    /**
     * Signs a message using Ed25519 private key.
     */
    static signMessage(message: Uint8Array, secretKey: Uint8Array): Uint8Array;
    /**
     * Verifies an Ed25519 signature.
     */
    static verifySignature(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean;
    /**
     * Encrypts a message anonymously for a recipient's X25519 public key.
     * This generates an ephemeral sender keypair to execute key agreement securely.
     * Structure of envelope: [ Ephemeral Public Key (32 bytes) ] + [ Nonce (24 bytes) ] + [ Ciphertext ]
     */
    static encryptForRecipient(data: Uint8Array, recipientPublicKey: Uint8Array): Uint8Array;
    /**
     * Decrypts an anonymous envelope using recipient's X25519 private key.
     */
    static decryptForRecipient(envelope: Uint8Array, recipientPrivateKey: Uint8Array): Uint8Array;
}
