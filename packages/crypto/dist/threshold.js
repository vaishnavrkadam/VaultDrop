"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShamirSSS = void 0;
const shamir_secret_sharing_1 = require("shamir-secret-sharing");
class ShamirSSS {
    /**
     * Splits a secret (Uint8Array) into N shares, requiring T (threshold) shares to reconstruct.
     */
    static async splitSecret(secret, threshold, shares) {
        if (threshold < 2 || shares < threshold) {
            throw new Error('Invalid threshold/shares configuration');
        }
        // split returns Promise<Uint8Array[]>
        const result = await (0, shamir_secret_sharing_1.split)(secret, shares, threshold);
        return result;
    }
    /**
     * Reconstructs the secret from a set of shares (Uint8Array[]).
     */
    static async combineShares(shares) {
        if (shares.length < 2) {
            throw new Error('Need at least two shares to reconstruct');
        }
        // combine returns Promise<Uint8Array>
        return await (0, shamir_secret_sharing_1.combine)(shares);
    }
}
exports.ShamirSSS = ShamirSSS;
