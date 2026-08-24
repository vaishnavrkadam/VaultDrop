'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button, GridLine } from '@vaultdrop/ui';
import { Shield, Eye, Trash2, Calendar, Lock, CheckCircle, RefreshCw, Key } from 'lucide-react';
import { CryptoProvider } from '@vaultdrop/crypto';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Browser-safe encoding helpers to avoid Node.js Buffer global dependency
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim().replace(/^0x/i, '');
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface LocalShare {
  id: string;
  shareType: 'text' | 'file';
  accessMode: 'anonymous' | 'password' | 'threshold';
  expiry: string;
  expiresAt?: number | null;
  keyHex?: string;
  createdAt: string;
}

interface ShareStat {
  viewCount: number;
  maxViews: number | null;
  consumed: boolean;
}

export default function MySharesPage() {
  const [shares, setShares] = useState<LocalShare[]>([]);
  const [hudStatus, setHudStatus] = useState<string[]>([]);
  
  // Views limit stats state
  const [sharesStats, setSharesStats] = useState<Record<string, ShareStat>>({});
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);

  // Recovery keys state
  const [recoveryPublicKey, setRecoveryPublicKey] = useState('');
  const [recoveryPrivateKeyInput, setRecoveryPrivateKeyInput] = useState('');
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState('');

  useEffect(() => {
    logHUD('SYSTEM: LOADING ACTIVE VAULTS FROM CLIENT CACHE...');
    loadSharesAndSync();
  }, []);

  const logHUD = (line: string) => {
    setHudStatus(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);
  };

  const loadSharesAndSync = () => {
    if (typeof window !== 'undefined') {
      // Load recovery public key
      const pubKey = localStorage.getItem('vaultdrop_recovery_public_key');
      if (pubKey) {
        setRecoveryPublicKey(pubKey);
        linkExistingLocalRecords(pubKey);
      }

      // Load created shares
      const stored = localStorage.getItem('vaultdrop_created_shares');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as LocalShare[];
          const now = Date.now();
          // Filter out expired shares
          const active = parsed.filter(s => !s.expiresAt || s.expiresAt > now);
          setShares(active);
          
          if (active.length !== parsed.length) {
            localStorage.setItem('vaultdrop_created_shares', JSON.stringify(active));
          }

          // Fetch views count
          fetchSharesStats(active);
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  const fetchSharesStats = async (activeShares: LocalShare[]) => {
    if (activeShares.length === 0) return;
    try {
      setIsRefreshingStats(true);
      const ids = activeShares.map(s => s.id);
      const res = await fetch(`${API_URL}/v1/shares/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (res.ok) {
        const stats = await res.json();
        setSharesStats(stats);
        logHUD(`✓ NETWORK: LIVE RETRIEVAL STATISTICS REFRESHED (${ids.length} VAULTS)`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshingStats(false);
    }
  };

  const handleRevokeShare = async (id: string) => {
    if (!confirm('Are you sure you want to cryptographically revoke this share? This action is permanent and immediate.')) {
      return;
    }
    try {
      logHUD(`NETWORK: SENDING REVOCATION COMMAND FOR SHARE ${id}...`);
      
      const res = await fetch(`${API_URL}/v1/shares/${id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) {
        throw new Error('Server rejected revocation check');
      }
      
      logHUD(`✓ NETWORK: SHARE ${id} REVOKED ON STORAGE SERVER`);
      
      // Update local state
      const updated = shares.filter(s => s.id !== id);
      setShares(updated);
      localStorage.setItem('vaultdrop_created_shares', JSON.stringify(updated));
    } catch (e: any) {
      logHUD(`✗ SYSTEM ERROR: ${e.message}`);
      alert('Revocation failed: ' + e.message);
    }
  };

  // Recovery functions
  const linkExistingLocalRecords = async (pubHex: string) => {
    try {
      logHUD('SYSTEM: BACKING UP LOCAL VAULTS & ROOMS UNDER SYNC IDENTITY...');
      
      // Sync local shares
      const storedShares = localStorage.getItem('vaultdrop_created_shares');
      let shareCount = 0;
      if (storedShares) {
        const localShares = JSON.parse(storedShares) as LocalShare[];
        await Promise.all(
          localShares.map(async (s) => {
            if (s.accessMode === 'anonymous' && s.keyHex) {
              try {
                const cek = hexToBytes(s.keyHex);
                const pubBytes = hexToBytes(pubHex);
                const envelopeBytes = CryptoProvider.encryptForRecipient(cek, pubBytes);
                const recoveryEnvelope = bytesToBase64(envelopeBytes);
                
                const res = await fetch(`${API_URL}/v1/shares/${s.id}/recovery`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ creatorPublicKey: pubHex, recoveryEnvelope })
                });
                if (res.ok) shareCount++;
              } catch (err) {
                console.error(err);
              }
            }
          })
        );
      }

      // Sync local rooms
      const storedRooms = localStorage.getItem('vaultdrop_created_rooms');
      let roomCount = 0;
      if (storedRooms) {
        const localRooms = JSON.parse(storedRooms) as any[];
        await Promise.all(
          localRooms.map(async (r) => {
            if (r.accessMode === 'anonymous' && r.keyHex) {
              try {
                const roomKey = hexToBytes(r.keyHex);
                const pubBytes = hexToBytes(pubHex);
                const envelopeBytes = CryptoProvider.encryptForRecipient(roomKey, pubBytes);
                const recoveryEnvelope = bytesToBase64(envelopeBytes);
                
                const res = await fetch(`${API_URL}/v1/rooms/${r.id}/recovery`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ creatorPublicKey: pubHex, recoveryEnvelope })
                });
                if (res.ok) roomCount++;
              } catch (err) {
                console.error(err);
              }
            }
          })
        );
      }
      
      if (shareCount > 0 || roomCount > 0) {
        logHUD(`✓ SYSTEM: SYNCED ${shareCount} VAULTS & ${roomCount} ROOMS TO ACCOUNT IDENTITY`);
      }
    } catch (e) {
      console.error('Failed to link existing records:', e);
    }
  };

  const generateRecoveryKeypair = async () => {
    try {
      logHUD('CRYPTO: GENERATING X25519 BOX KEYPAIR...');
      const keypair = CryptoProvider.generateBoxKeyPair();
      const privHex = bytesToHex(keypair.secretKey);
      const pubHex = bytesToHex(keypair.publicKey);

      if (typeof window !== 'undefined') {
        localStorage.setItem('vaultdrop_recovery_public_key', pubHex);
      }

      setRecoveryPublicKey(pubHex);
      setGeneratedPrivateKey(privHex);
      logHUD('✓ CRYPTO: NEW RECOVERY IDENTITY REGISTERED');
      
      await linkExistingLocalRecords(pubHex);
    } catch (e: any) {
      logHUD(`✗ SYSTEM ERROR: ${e.message}`);
    }
  };

  const importPrivateKey = async () => {
    if (!recoveryPrivateKeyInput.trim()) return;
    try {
      logHUD('CRYPTO: PARSING PRIVATE RECOVERY KEY...');
      const privHex = recoveryPrivateKeyInput.trim();
      const privBytes = hexToBytes(privHex);
      if (privBytes.length !== 32) throw new Error('Private key must be exactly 32 bytes (64 hex characters).');

      logHUD('CRYPTO: DERIVING CORRESPONDING PUBLIC IDENTITY...');
      const keypair = CryptoProvider.generateBoxKeyPairFromSecretKey(privBytes);
      const pubHex = bytesToHex(keypair.publicKey);
      
      logHUD(`✓ CRYPTO: IDENTITY DERIVED (${pubHex.substring(0, 8)}...)`);
      
      // Save identity locally
      localStorage.setItem('vaultdrop_recovery_public_key', pubHex);
      setRecoveryPublicKey(pubHex);

      await linkExistingLocalRecords(pubHex);

      // Query account shares
      logHUD('NETWORK: FETCHING ESCROW VAULTS MATCHING PUBLIC KEY...');
      const sharesRes = await fetch(`${API_URL}/v1/account/${pubHex}/shares`);
      if (!sharesRes.ok) throw new Error('Failed to retrieve vaults from server');
      const accountShares = await sharesRes.json();
      logHUD(`✓ NETWORK: RETRIEVED ${accountShares.length} ESCROWED VAULTS`);

      // Query account rooms
      logHUD('NETWORK: FETCHING ESCROW ROOMS MATCHING PUBLIC KEY...');
      const roomsRes = await fetch(`${API_URL}/v1/account/${pubHex}/rooms`);
      if (!roomsRes.ok) throw new Error('Failed to retrieve rooms from server');
      const accountRooms = await roomsRes.json();
      logHUD(`✓ NETWORK: RETRIEVED ${accountRooms.length} ESCROWED ROOMS`);

      // Decrypt share CEKs
      let decryptedCount = 0;
      const storedShares = localStorage.getItem('vaultdrop_created_shares');
      const localShares = storedShares ? JSON.parse(storedShares) : [];
      
      for (const sh of accountShares) {
        if (localShares.some((s: any) => s.id === sh.id)) continue; // Already indexed locally
        
        try {
          logHUD(`CRYPTO: DECRYPTING RECOVERY ENVELOPE FOR VAULT ${sh.id}...`);
          const envelopeBytes = base64ToBytes(sh.recoveryEnvelope);
          const cek = CryptoProvider.decryptForRecipient(envelopeBytes, privBytes);
          const keyHex = bytesToHex(cek);
          
          localShares.push({
            id: sh.id,
            shareType: sh.shareType,
            accessMode: sh.accessMode,
            expiry: 'Recovered',
            expiresAt: null, // Recovery keys keep vaults active
            keyHex: sh.accessMode === 'password' ? '' : (sh.accessMode === 'threshold' ? 'threshold' : keyHex),
            createdAt: sh.createdAt
          });
          decryptedCount++;
        } catch (decErr) {
          console.error(decErr);
        }
      }

      // Decrypt room keys
      let decryptedRoomsCount = 0;
      const storedRooms = localStorage.getItem('vaultdrop_created_rooms');
      const localRooms = storedRooms ? JSON.parse(storedRooms) : [];

      for (const rm of accountRooms) {
        if (localRooms.some((r: any) => r.id === rm.id)) continue; // Already indexed locally
        
        try {
          logHUD(`CRYPTO: DECRYPTING RECOVERY ENVELOPE FOR ROOM ${rm.id}...`);
          const envelopeBytes = base64ToBytes(rm.recoveryEnvelope);
          const roomKey = CryptoProvider.decryptForRecipient(envelopeBytes, privBytes);
          const keyHex = bytesToHex(roomKey);
          
          localRooms.push({
            id: rm.id,
            accessMode: rm.accessMode,
            keyHex: rm.accessMode === 'password' ? '' : keyHex,
            createdAt: rm.createdAt
          });
          decryptedRoomsCount++;
        } catch (decErr) {
          console.error(decErr);
        }
      }

      localStorage.setItem('vaultdrop_created_shares', JSON.stringify(localShares));
      localStorage.setItem('vaultdrop_created_rooms', JSON.stringify(localRooms));
      setShares(localShares);
      
      logHUD(`✓ SYSTEM: SYNCHRONIZATION COMPLETED. SHARES RESTORED: ${decryptedCount}, ROOMS RESTORED: ${decryptedRoomsCount}`);
      setRecoveryPrivateKeyInput('');
      fetchSharesStats(localShares);
    } catch (e: any) {
      logHUD(`✗ SYSTEM ERROR: ${e.message}`);
      alert('Import failed: ' + e.message);
    }
  };

  const deauthorizeRecoveryKeys = () => {
    if (confirm('De-authorize synchronization keys? You will not be able to sync new vaults on this device until you generate or import a key.')) {
      localStorage.removeItem('vaultdrop_recovery_public_key');
      setRecoveryPublicKey('');
      setGeneratedPrivateKey('');
      logHUD('SYSTEM: RECOVERY PUBLIC IDENTITY CLEARED');
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-[#171717]">
      
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-mono font-bold uppercase tracking-[0.25em] text-sm">
              [ VAULTDROP ]
            </Link>
            <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest hidden md:inline">
              // MANAGEMENT BOARD
            </span>
          </div>
          <div className="flex gap-4">
            <Link href="/app" className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition-colors">
              [ CREATE SHARE ]
            </Link>
            <Link href="/app/rooms" className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition-colors">
              [ VAULT ROOMS ]
            </Link>
            <Link href="/" className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition-colors">
              [ EXIT ]
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-grow max-w-4xl w-full mx-auto px-6 py-12 flex flex-col gap-10">
        
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">// LOCALLY STORED SECURE TARGETS</span>
          <h1 className="font-mono text-3xl font-bold uppercase tracking-wider">ACTIVE VAULT SHARES</h1>
          <GridLine className="mt-2" />
        </div>

        {/* Recovery Identity Section */}
        <div className="border border-neutral-200 bg-white p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <Shield className="w-4 h-4 text-neutral-900" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider">ACCOUNT RECOVERY IDENTITY & KEY SYNC</span>
          </div>

          {recoveryPublicKey ? (
            <div className="flex flex-col gap-3 font-mono text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-neutral-400 uppercase tracking-wider">ACTIVE PUBLIC ACCOUNT KEY (IDENTITY)</span>
                <span className="bg-neutral-50 px-3 py-2 border border-neutral-200 select-all break-all text-[11px] font-bold text-neutral-800">
                  {recoveryPublicKey}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 uppercase leading-relaxed">
                Vaults and Rooms created on this device are automatically encrypted for this identity. You can import your private key on other devices to restore them.
                <br />
                <span className="text-neutral-500 font-bold font-mono">Note: The active identity key shown above is the derived X25519 Public Key. It is mathematically generated from your secret 32-byte Private Key.</span>
              </p>
              <div className="flex gap-3">
                <Button variant="danger" size="sm" onClick={deauthorizeRecoveryKeys} className="font-mono text-[10px] uppercase tracking-wider">
                  [ DE-AUTHORIZE SYNC KEYS ]
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="font-mono text-[11px] text-neutral-500 uppercase leading-relaxed">
                Generate an anonymous public identity keypair. All future shares you create will have their encryption keys wrapped for this public key, allowing you to restore them on any new device using your private recovery key.
              </p>
              <div className="flex flex-wrap gap-4 items-end">
                <Button variant="primary" size="sm" onClick={generateRecoveryKeypair} className="font-mono text-[10px]">
                  GENERATE RECOVERY KEYPAIR
                </Button>
                <div className="flex-grow min-w-[240px] flex gap-2">
                  <input
                    type="password"
                    placeholder="Enter Private Key to Import Account (hex)..."
                    value={recoveryPrivateKeyInput}
                    onChange={(e) => setRecoveryPrivateKeyInput(e.target.value)}
                    className="bg-white border border-neutral-300 font-mono text-xs px-3 py-2 flex-grow focus:outline-none"
                  />
                  <Button variant="secondary" size="sm" onClick={importPrivateKey} className="font-mono text-[10px]">
                    IMPORT & SYNC
                  </Button>
                </div>
              </div>
              
              {generatedPrivateKey && (
                <div className="border border-green-200 bg-green-50/50 p-4 font-mono text-xs flex flex-col gap-3 mt-2">
                  <div className="flex items-center gap-1.5 text-green-700 font-bold">
                    <CheckCircle className="w-4 h-4" /> RECOVERY KEYPAIR GENERATED successfully!
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-green-600 uppercase font-semibold">YOUR PRIVATE KEY (SAVE THIS SECURELY!)</span>
                    <span className="bg-white border border-green-200 px-3 py-2 text-[11px] font-bold select-all break-all text-neutral-800">
                      {generatedPrivateKey}
                    </span>
                  </div>
                  <span className="text-[9px] text-green-600 font-semibold uppercase leading-snug">
                    WARNING: Keep this private key safe. Anyone who has it can retrieve and decrypt all your vaults. It will not be shown again.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="md:col-span-2 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">// LOCALLY STORED SECURES</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchSharesStats(shares)}
                disabled={isRefreshingStats}
                className="flex items-center gap-1 font-mono text-[9px] py-1 px-2 uppercase"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingStats ? 'animate-spin' : ''}`} /> Refresh views
              </Button>
            </div>
            {shares.length === 0 ? (
              <div className="border border-neutral-200 bg-white p-8 text-center flex flex-col items-center justify-center min-h-[240px] gap-4">
                <Shield className="w-8 h-8 text-neutral-300" />
                <div className="font-mono text-xs text-neutral-500">
                  NO ACTIVE VAULTS DISCOVERED ON THIS CLIENT ENVIRONMENT
                </div>
                <Link href="/app">
                  <Button variant="primary" size="sm">CREATE SECURE SHARE</Button>
                </Link>
              </div>
            ) : (
              <div className="border border-neutral-200 bg-white overflow-hidden">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] text-neutral-500 tracking-widest uppercase">
                      <th className="p-4 font-bold">LOCATOR ID</th>
                      <th className="p-4 font-bold">TYPE</th>
                      <th className="p-4 font-bold">VIEWS / LIMIT</th>
                      <th className="p-4 font-bold">MODE</th>
                      <th className="p-4 font-bold text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shares.map(s => {
                      const stat = sharesStats[s.id];
                      return (
                        <tr key={s.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50">
                          <td className="p-4 font-bold break-all">{s.id}</td>
                          <td className="p-4 uppercase text-neutral-600">{s.shareType}</td>
                          <td className="p-4 uppercase text-neutral-600">
                            {stat ? (
                              stat.consumed ? (
                                <span className="text-red-500 font-bold">BURNED</span>
                              ) : (
                                <span>{stat.viewCount} / {stat.maxViews !== null ? stat.maxViews : '∞'}</span>
                              )
                            ) : (
                              <span className="text-neutral-400">Loading...</span>
                            )}
                          </td>
                          <td className="p-4 uppercase text-neutral-600">
                            {s.accessMode === 'password' ? (
                              <span className="flex items-center gap-1">
                                <Lock className="w-3 h-3" /> PASS
                              </span>
                            ) : s.accessMode === 'threshold' ? 'M-of-N' : 'URL'}
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            <Link href={s.accessMode === 'password' ? `/s/${s.id}` : `/s/${s.id}#key=${s.keyHex}`} target="_blank">
                              <Button variant="secondary" size="sm" className="px-2 py-1">
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                            <Button variant="danger" size="sm" onClick={() => handleRevokeShare(s.id)} className="px-2 py-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sidebar HUD */}
          <div className="flex flex-col gap-6">
            <div className="border border-neutral-200 bg-neutral-950 text-green-400 p-4 font-mono text-[10px] h-[340px] flex flex-col justify-between select-none">
              <div className="flex justify-between items-center border-b border-neutral-800 pb-2 mb-2">
                <span>SECURE CRYPTO HUD v1.0</span>
                <span className="animate-pulse">●</span>
              </div>
              <div className="flex-grow overflow-y-auto flex flex-col gap-1.5 pr-1 font-semibold">
                {hudStatus.length === 0 ? (
                  <span className="text-neutral-600">[Awaiting client instructions...]</span>
                ) : (
                  hudStatus.map((line, idx) => (
                    <div key={idx} className="leading-snug break-all">{line}</div>
                  ))
                )}
              </div>
              <div className="border-t border-neutral-800 pt-2 mt-2 text-[9px] text-neutral-500">
                REVOCATION DELETES TEXT AND CHUNKS ON STORAGE LAYER INSTANTLY
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-6 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest">
            VaultDrop executes revocation via direct API deletion. Unwrapped keys are never sent to the API.
          </span>
        </div>
      </footer>

    </div>
  );
}
