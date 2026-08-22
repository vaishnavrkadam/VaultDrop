'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button, GridLine } from '@vaultdrop/ui';
import { Shield, Eye, Trash2, Calendar, Lock } from 'lucide-react';

interface LocalShare {
  id: string;
  shareType: 'text' | 'file';
  accessMode: 'anonymous' | 'password';
  expiry: string;
  expiresAt?: number;
  keyHex?: string;
  createdAt: string;
}

export default function MySharesPage() {
  const [shares, setShares] = useState<LocalShare[]>([]);
  const [hudStatus, setHudStatus] = useState<string[]>([]);

  useEffect(() => {
    // Load created shares from local storage (locator IDs only)
    if (typeof window !== 'undefined') {
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
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  const logHUD = (line: string) => {
    setHudStatus(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);
  };

  const handleRevokeShare = async (id: string) => {
    if (!confirm('Are you sure you want to cryptographically revoke this share? This action is permanent and immediate.')) {
      return;
    }
    try {
      logHUD(`NETWORK: SENDING REVOCATION COMMAND FOR SHARE ${id}...`);
      
      const res = await fetch(`http://localhost:3001/v1/shares/${id}`, {
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

  return (
    <div className="min-h-screen bg-paper flex flex-col grid-dots text-[#171717]">
      
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="md:col-span-2 flex flex-col gap-6">
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
                      <th className="p-4 font-bold">EXPIRY</th>
                      <th className="p-4 font-bold">MODE</th>
                      <th className="p-4 font-bold text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shares.map(s => (
                      <tr key={s.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50">
                        <td className="p-4 font-bold break-all">{s.id}</td>
                        <td className="p-4 uppercase text-neutral-600">{s.shareType}</td>
                        <td className="p-4 uppercase text-neutral-600">{s.expiry}</td>
                        <td className="p-4 uppercase text-neutral-600">
                          {s.accessMode === 'password' ? (
                            <span className="flex items-center gap-1">
                              <Lock className="w-3 h-3" /> PASS
                            </span>
                          ) : 'URL'}
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
                    ))}
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
