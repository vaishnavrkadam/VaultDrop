'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button, GridLine, Input } from '@vaultdrop/ui';
import { Shield, MessageSquare, Plus, Key, Link as LinkIcon, Trash2, HelpCircle } from 'lucide-react';
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

interface LocalRoom {
  id: string;
  accessMode: 'anonymous' | 'password';
  keyHex: string;
  createdAt: string;
}

export default function RoomsPortalPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [accessMode, setAccessMode] = useState<'anonymous' | 'password'>('anonymous');
  const [password, setPassword] = useState('');
  const [joinLink, setJoinLink] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hudStatus, setHudStatus] = useState<string[]>([]);
  const [rooms, setRooms] = useState<LocalRoom[]>([]);
  const [createdRoomResult, setCreatedRoomResult] = useState<{ id: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    logHUD('SYSTEM: READY FOR SECURE ROOM INITIALIZATION');
    loadLocalRooms();
  }, []);

  const logHUD = (line: string) => {
    setHudStatus(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);
  };

  const loadLocalRooms = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vaultdrop_created_rooms');
      if (stored) {
        try {
          setRooms(JSON.parse(stored) as LocalRoom[]);
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  const handleCreateRoom = async () => {
    try {
      setIsProcessing(true);
      setCreatedRoomResult(null);
      logHUD('CRYPTO: INITIALIZING SECURE VAULT ROOM GENERATOR...');

      // 1. Generate room master key in browser memory
      const roomKey = CryptoProvider.getRandomBytes(32);
      const roomKeyHex = bytesToHex(roomKey);
      logHUD('✓ CRYPTO: 256-BIT CHAT SYMMETRIC MASTER KEY GENERATED');

      let payload: any = { accessMode };

      // 2. Wrap the room master key if password mode is selected
      if (accessMode === 'password') {
        if (!password) throw new Error('Passphrase is required for password envelope.');
        logHUD('KDF: DERIVING ENVELOPE KEY FROM PASSWORD VIA ARGON2ID...');
        const salt = CryptoProvider.getRandomBytes(16);
        const derivedKey = await CryptoProvider.deriveKeyFromPassword(password, salt);
        logHUD('✓ KDF: STRETCHED DECRYPTION ENVELOPE KEY ESTABLISHED');

        logHUD('CRYPTO: SEALING MASTER CHAT KEY WITH PASSWORD ENVELOPE...');
        const { ciphertext, nonce, tag } = await CryptoProvider.encryptAES_GCM(roomKey, derivedKey);
        
        payload.salt = bytesToHex(salt);
        payload.wrappedRoomKey = bytesToBase64(ciphertext);
        payload.nonce = bytesToBase64(nonce);
        payload.tag = bytesToBase64(tag);
        logHUD('✓ CRYPTO: WRAPPED KEY ENVELOPE READY');
      }

      // Check if creator recovery public key is active in browser
      if (typeof window !== 'undefined') {
        const pubHex = localStorage.getItem('vaultdrop_recovery_public_key');
        if (pubHex) {
          logHUD('CRYPTO: ENCRYPTING KEY COPY FOR ACCOUNT RECOVERY ENVELOPE...');
          const pubBytes = hexToBytes(pubHex);
          const envelopeBytes = CryptoProvider.encryptForRecipient(roomKey, pubBytes);
          payload.creatorPublicKey = pubHex;
          payload.recoveryEnvelope = bytesToBase64(envelopeBytes);
          logHUD('✓ CRYPTO: ACCOUNT RECOVERY SYNCHRONIZER ATTACHED');
        }
      }

      // 3. Post configuration to API server (server never gets the roomKeyHex plaintext)
      logHUD('NETWORK: DEPLOYING ROOM INSTANCE TO STORE API...');
      const res = await fetch(`${API_URL}/v1/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('API server rejected room setup: ' + (await res.text()));
      }

      const data = await res.json();
      logHUD('NETWORK: SECURE ROOM REGISTERED SUCCESSFULLY');

      // 4. Generate URL capability link
      const roomUrl = accessMode === 'password'
        ? `${window.location.origin}/r/${data.id}`
        : `${window.location.origin}/r/${data.id}#key=${roomKeyHex}`;

      setCreatedRoomResult({ id: data.id, url: roomUrl });

      // Save to local rooms list
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('vaultdrop_created_rooms');
        const list = stored ? JSON.parse(stored) : [];
        list.push({
          id: data.id,
          accessMode,
          keyHex: accessMode === 'password' ? '' : roomKeyHex,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem('vaultdrop_created_rooms', JSON.stringify(list));
        setRooms(list);
      }

      setPassword('');
    } catch (e: any) {
      logHUD(`✗ SYSTEM ERROR: ${e.message}`);
      alert('Failed to establish room: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleJoinRoom = () => {
    if (!joinLink) {
      alert('Please enter a valid VaultRoom URL or ID.');
      return;
    }

    let roomId = joinLink.trim();
    let hash = '';

    if (joinLink.includes('/r/')) {
      const parts = joinLink.split('/r/');
      const roomPart = parts[1].split('#');
      roomId = roomPart[0];
      if (roomPart[1]) hash = '#' + roomPart[1];
    }

    logHUD(`SYSTEM: JOINING SECURE VAULT ROOM ${roomId}...`);
    
    // Save to local storage for quick access in dashboard (if not already there)
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vaultdrop_created_rooms');
      const list = stored ? JSON.parse(stored) : [];
      if (!list.some((r: any) => r.id === roomId)) {
        let keyHex = '';
        if (hash.startsWith('#key=')) {
          keyHex = hash.substring(5);
        }
        list.push({
          id: roomId,
          accessMode: hash ? 'anonymous' : 'password',
          keyHex,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem('vaultdrop_created_rooms', JSON.stringify(list));
      }
    }

    window.location.href = joinLink.includes('http') ? joinLink : `/r/${roomId}${hash}`;
  };

  const handleCopyLink = () => {
    if (createdRoomResult) {
      navigator.clipboard.writeText(createdRoomResult.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRemoveRoom = (id: string) => {
    if (confirm('Remove this room locator from your local client index? (Does not delete server conversation history)')) {
      const updated = rooms.filter(r => r.id !== id);
      localStorage.setItem('vaultdrop_created_rooms', JSON.stringify(updated));
      setRooms(updated);
      logHUD(`SYSTEM: ROOM INDEX ${id} REMOVED`);
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
              // ROOM PORTAL
            </span>
          </div>
          <div className="flex gap-4">
            <Link href="/app" className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition-colors">
              [ CREATE SHARE ]
            </Link>
            <Link href="/app/shares" className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition-colors">
              [ MY VAULTS ]
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
          <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">// SECURE MULTI-WAY CHAT</span>
          <h1 className="font-mono text-3xl font-bold uppercase tracking-wider">VAULT ROOMS</h1>
          <GridLine className="mt-2" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="md:col-span-2 flex flex-col gap-6">
            
            {/* Tabs selector */}
            <div className="flex gap-4">
              <Button
                variant={activeTab === 'create' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('create')}
                className="font-mono flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> CREATE VAULT ROOM
              </Button>
              <Button
                variant={activeTab === 'join' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('join')}
                className="font-mono flex items-center gap-2"
              >
                <LinkIcon className="w-4 h-4" /> JOIN VAULT ROOM
              </Button>
            </div>

            {/* TAB CONTENT: CREATE */}
            {activeTab === 'create' && (
              <div className="flex flex-col gap-6">
                
                <div className="grid grid-cols-1 gap-6 bg-white p-6 border border-neutral-200">
                  
                  {/* Access mode selection */}
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                      ROOM AUTHORIZATION LAYER
                    </label>
                    <div className="flex gap-6 pt-1.5">
                      <label className="flex items-center gap-2 font-mono text-xs cursor-pointer select-none">
                        <input
                          type="radio"
                          checked={accessMode === 'anonymous'}
                          onChange={() => setAccessMode('anonymous')}
                          className="accent-neutral-900"
                          disabled={isProcessing}
                        />
                        ANYONE WITH LINK (KEY IN HASH)
                      </label>
                      <label className="flex items-center gap-2 font-mono text-xs cursor-pointer select-none">
                        <input
                          type="radio"
                          checked={accessMode === 'password'}
                          onChange={() => setAccessMode('password')}
                          className="accent-neutral-900"
                          disabled={isProcessing}
                        />
                        PASSPHRASE DERIVED KEY
                      </label>
                    </div>
                  </div>

                  {/* Password input */}
                  {accessMode === 'password' && (
                    <div className="mt-2">
                      <Input
                        label="ROOM ACCESS PASSPHRASE"
                        type="password"
                        placeholder="Enter the password required to derive the room key..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isProcessing}
                      />
                    </div>
                  )}

                  {/* Create Trigger */}
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleCreateRoom}
                    disabled={isProcessing}
                    className="mt-2"
                  >
                    {isProcessing ? 'INITIALIZING CHAT ENVELOPE...' : 'CREATE SECURE VAULT ROOM'}
                  </Button>

                </div>

                {/* Result output card */}
                {createdRoomResult && (
                  <div className="border border-neutral-200 bg-neutral-50 p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-green-700 font-mono text-xs font-bold">
                      <Shield className="w-4 h-4" /> SECURE VAULT ROOM GENERATED SUCCESSFULLY!
                    </div>
                    <p className="font-mono text-[11px] text-neutral-500 leading-relaxed uppercase">
                      Share the capability link below. If anonymous, the encryption key agreement is inside the URL fragment (#key=...) and will never cross the network boundary.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={createdRoomResult.url}
                        className="bg-white border border-neutral-300 font-mono text-xs px-3 py-2 flex-grow focus:outline-none"
                      />
                      <Button variant="secondary" onClick={handleCopyLink} className="whitespace-nowrap font-mono text-xs">
                        {copied ? 'COPIED!' : 'COPY'}
                      </Button>
                    </div>
                    <Link href={createdRoomResult.url}>
                      <Button variant="primary" size="sm" className="w-full font-mono text-xs">
                        OPEN CHAT ROOM [ → ]
                      </Button>
                    </Link>
                  </div>
                )}

              </div>
            )}

            {/* TAB CONTENT: JOIN */}
            {activeTab === 'join' && (
              <div className="grid grid-cols-1 gap-6 bg-white p-6 border border-neutral-200">
                <Input
                  label="VAULTROOM LINK OR LOCATOR ID"
                  placeholder="Paste the VaultRoom link here (e.g. http://localhost:3000/r/[id]#key=...)"
                  value={joinLink}
                  onChange={(e) => setJoinLink(e.target.value)}
                />
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleJoinRoom}
                >
                  ENTER CHAT PORTAL [ → ]
                </Button>
              </div>
            )}

            {/* Local rooms table */}
            <div className="flex flex-col gap-2 mt-4">
              <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">// RECENT VAULT ROOMS</span>
              {rooms.length === 0 ? (
                <div className="border border-neutral-200 bg-white p-6 text-center text-xs font-mono text-neutral-500">
                  NO ACTIVE CHAT ROOMS LINKED TO THIS DEVICE
                </div>
              ) : (
                <div className="border border-neutral-200 bg-white overflow-hidden">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] text-neutral-500 tracking-widest uppercase">
                        <th className="p-4 font-bold">ROOM LOCATOR</th>
                        <th className="p-4 font-bold">MODE</th>
                        <th className="p-4 font-bold text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.map(r => (
                        <tr key={r.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50">
                          <td className="p-4 font-bold break-all">{r.id}</td>
                          <td className="p-4 uppercase text-neutral-600">{r.accessMode}</td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            <Link href={r.accessMode === 'password' ? `/r/${r.id}` : `/r/${r.id}#key=${r.keyHex}`}>
                              <Button variant="secondary" size="sm" className="px-3 py-1.5 font-mono text-[10px]">
                                OPEN
                              </Button>
                            </Link>
                            <Button variant="danger" size="sm" onClick={() => handleRemoveRoom(r.id)} className="px-2 py-1.5">
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

          </div>

          {/* Sidebar HUD */}
          <div className="flex flex-col gap-6">
            <div className="border border-neutral-200 bg-neutral-950 text-green-400 p-4 font-mono text-[10px] h-[340px] flex flex-col justify-between select-none shadow-md">
              <div className="flex justify-between items-center border-b border-neutral-800 pb-2 mb-2">
                <span>SECURE CRYPTO HUD v1.0</span>
                <span className="animate-pulse">●</span>
              </div>
              <div className="flex-grow overflow-y-auto flex flex-col gap-1.5 pr-1 font-semibold">
                {hudStatus.length === 0 ? (
                  <span className="text-neutral-600">[Awaiting instructions...]</span>
                ) : (
                  hudStatus.map((line, idx) => (
                    <div key={idx} className="leading-snug break-all">{line}</div>
                  ))
                )}
              </div>
              <div className="border-t border-neutral-800 pt-2 mt-2 text-[9px] text-neutral-500 uppercase">
                Zero-knowledge chat uses in-browser GCM envelopes. Plaintext never crosses the network.
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-6 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest">
            VaultRooms executes asymmetric key agreements locally. Messages are encrypted end-to-end.
          </span>
        </div>
      </footer>
    </div>
  );
}
