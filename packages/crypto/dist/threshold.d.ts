export declare class ShamirSSS {
    /**
     * Splits a secret (Uint8Array) into N shares, requiring T (threshold) shares to reconstruct.
     */
    static splitSecret(secret: Uint8Array, threshold: number, shares: number): Promise<Uint8Array[]>;
    /**
     * Reconstructs the secret from a set of shares (Uint8Array[]).
     */
    static combineShares(shares: Uint8Array[]): Promise<Uint8Array>;
}
