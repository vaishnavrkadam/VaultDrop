import { split, combine } from 'shamir-secret-sharing';

export class ShamirSSS {
  /**
   * Splits a secret (Uint8Array) into N shares, requiring T (threshold) shares to reconstruct.
   */
  static async splitSecret(secret: Uint8Array, threshold: number, shares: number): Promise<Uint8Array[]> {
    if (threshold < 2 || shares < threshold) {
      throw new Error('Invalid threshold/shares configuration');
    }
    // split returns Promise<Uint8Array[]>
    const result = await split(secret, shares, threshold);
    return result;
  }

  /**
   * Reconstructs the secret from a set of shares (Uint8Array[]).
   */
  static async combineShares(shares: Uint8Array[]): Promise<Uint8Array> {
    if (shares.length < 2) {
      throw new Error('Need at least two shares to reconstruct');
    }
    // combine returns Promise<Uint8Array>
    return await combine(shares);
  }
}
