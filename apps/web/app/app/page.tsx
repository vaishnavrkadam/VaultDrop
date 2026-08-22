'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Button, Input, GridLine } from '@vaultdrop/ui';
import { CryptoProvider, ShamirSSS } from '@vaultdrop/crypto';
import QRCode from 'qrcode';
import { FileUp, File, ShieldAlert, Key, Clipboard, Check, RefreshCw } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function CreateSharePage() {
  // Navigation / Tabs
  const [shareType, setShareType] = useState<'text' | 'file'>('text');
  
  // Input fields
  const [textPayload, setTextPayload] = useState('');
  const [filePayload, setFilePayload] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState('7d');
  const [customMinutes, setCustomMinutes] = useState('15');
  const [accessMode, setAccessMode] = useState<'anonymous' | 'password' | 'threshold'>('anonymous');
  const [threshold, setThreshold] = useState('3');
  const [participantCount, setParticipantCount] = useState('5');
  
  // Loading & HUD State
  const [hudStatus, setHudStatus] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [creationResult, setCreationResult] = useState<{
    id: string;
    decryptionKeyHex: string;
    shareUrl: string;
    qrCodeDataUrl: string;
    thresholdLinks?: string[];
  } | null>(null);
  
  const [copied, setCopied] = useState(false);

  // File Drag & Drop Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFilePayload(e.target.files[0]);
    }
  };

  // Helper to add lines to the HUD console
  const logHUD = (line: string) => {
    setHudStatus(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);
  };

  const handleCreateShare = async () => {
    try {
      setIsProcessing(true);
      setHudStatus([]);
      setCreationResult(null);
      
      logHUD('CRYPTO: INITIALIZING CRYPTOGRAPHIC PROCESS');
      // 1. Generate Content Encryption Key (CEK)
      logHUD('CRYPTO: GENERATING ENTROPY FOR KEY MATERIAL...');
      const cek = CryptoProvider.getRandomBytes(32);
      logHUD(`CRYPTO: CEK CREATED (SIZE: 256 BITS)`);
      
      // 2. Encrypt Payload
      let ciphertext: Uint8Array;
      let nonce: Uint8Array;
      let tag: Uint8Array;
      let fileMeta: { name: string; size: number; mime: string } | null = null;
      
      if (shareType === 'text') {
        if (!textPayload.trim()) {
          throw new Error('Payload cannot be empty');
        }
        logHUD('CRYPTO: ENCRYPTING TEXT PASTE VIA AES-256-GCM...');
        const encoder = new TextEncoder();
        const encrypted = await CryptoProvider.encryptAES_GCM(encoder.encode(textPayload), cek);
        ciphertext = encrypted.ciphertext;
        nonce = encrypted.nonce;
        tag = encrypted.tag;
      } else {
        if (!filePayload) {
          throw new Error('Please select a file');
        }
        logHUD(`CRYPTO: ENCRYPTING FILE "${filePayload.name}" (${filePayload.size} bytes)...`);
        
        // Read file as Uint8Array
        const arrayBuffer = await filePayload.arrayBuffer();
        const fileData = new Uint8Array(arrayBuffer);
        
        // Encrypt file metadata separately using a derived key or include in main payload
        // To be simple and robust: we'll bundle the filename + payload, or encrypt filename separately
        logHUD('CRYPTO: DERIVING SEPARATE METADATA ENCRYPTION KEY VIA HKDF...');
        const metadataKey = await CryptoProvider.deriveHKDF(cek, 'vaultdrop/metadata');
        
        const metadataEncoder = new TextEncoder();
        const metaPlaintext = JSON.stringify({
          name: filePayload.name,
          size: filePayload.size,
          mime: filePayload.type || 'application/octet-stream'
        });
        const metaEncrypted = await CryptoProvider.encryptAES_GCM(metadataEncoder.encode(metaPlaintext), metadataKey);
        
        fileMeta = {
          name: Buffer.from(metaEncrypted.ciphertext).toString('base64'),
          size: filePayload.size,
          mime: Buffer.from(metaEncrypted.tag).toString('base64') + ':' + Buffer.from(metaEncrypted.nonce).toString('base64')
        };
        
        logHUD('CRYPTO: ENCRYPTING FILE PAYLOAD CHUNKS...');
        const encrypted = await CryptoProvider.encryptAES_GCM(fileData, cek);
        ciphertext = encrypted.ciphertext;
        nonce = encrypted.nonce;
        tag = encrypted.tag;
      }
      
      // 3. Password KDF protection or Shamir Splitting (optional)
      let wrappedContentKey: string | null = null;
      let kdfSaltHex: string | null = null;
      let computedShares: Uint8Array[] = [];
      
      if (accessMode === 'password') {
        if (!password) {
          throw new Error('Password protection is selected but no password was entered');
        }
        logHUD('CRYPTO: DERIVING PASSWORD ENVELOPE KEY (ARGON2ID)...');
        const salt = CryptoProvider.getRandomBytes(16);
        const derivedPasswordKey = await CryptoProvider.deriveKeyFromPassword(password, salt);
        
        logHUD('CRYPTO: WRAPPING CEK INSIDE PASSWORD ENVELOPE...');
        const wrapped = await CryptoProvider.encryptAES_GCM(cek, derivedPasswordKey);
        // Base64 encode the wrapped key parts
        wrappedContentKey = JSON.stringify({
          ciphertext: Buffer.from(wrapped.ciphertext).toString('base64'),
          nonce: Buffer.from(wrapped.nonce).toString('base64'),
          tag: Buffer.from(wrapped.tag).toString('base64')
        });
        kdfSaltHex = Buffer.from(salt).toString('hex');
      } else if (accessMode === 'threshold') {
        const m = parseInt(threshold, 10);
        const n = parseInt(participantCount, 10);
        if (isNaN(m) || isNaN(n) || m < 2 || n < m) {
          throw new Error('Invalid M-of-N configuration.');
        }
        logHUD(`CRYPTO: SPLITTING CEK INTO ${n} SHAMIR SHARES (MIN THRESHOLD M: ${m})...`);
        computedShares = await ShamirSSS.splitSecret(cek, m, n);
        logHUD(`✓ CRYPTO: SHAMIR KEY SPLIT COMPLETED`);
      }
      
      // 4. Send to storage server
      logHUD('NETWORK: CONNECTING TO STORAGE API...');
      const payloadBase64 = Buffer.from(ciphertext).toString('base64');
      const nonceBase64 = Buffer.from(nonce).toString('base64');
      const tagBase64 = Buffer.from(tag).toString('base64');
      
      const response = await fetch(`${API_URL}/v1/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareType,
          accessMode,
          ciphertext: payloadBase64,
          nonce: nonceBase64,
          tag: tagBase64,
          wrappedContentKey,
          salt: kdfSaltHex,
          expiry: expiry === 'custom' ? `custom:${customMinutes}` : expiry,
          fileMeta,
          threshold: accessMode === 'threshold' ? threshold : undefined,
          participantCount: accessMode === 'threshold' ? participantCount : undefined
        })
      });
      
      if (!response.ok) {
        throw new Error('API server returned error: ' + (await response.text()));
      }
      
      const responseData = await response.json();
      logHUD('NETWORK: VAULTING COMPLETED SUCCESSFULLY');
      
      // Calculate absolute local expiresAt timestamp
      let durationMs = 7 * 24 * 60 * 60 * 1000;
      if (expiry === '5m') durationMs = 5 * 60 * 1000;
      else if (expiry === '1h') durationMs = 60 * 60 * 1000;
      else if (expiry === '1d') durationMs = 24 * 60 * 60 * 1000;
      else if (expiry === '7d') durationMs = 7 * 24 * 60 * 60 * 1000;
      else if (expiry === '30d') durationMs = 30 * 24 * 60 * 60 * 1000;
      else if (expiry === 'custom') durationMs = parseInt(customMinutes, 10) * 60 * 1000;
      const expiresAt = Date.now() + durationMs;

      const keyHex = Buffer.from(cek).toString('hex');

      // Save metadata locally to list in dashboard
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('vaultdrop_created_shares');
        const list = stored ? JSON.parse(stored) : [];
        list.push({
          id: responseData.id,
          shareType,
          accessMode,
          expiry: expiry === 'custom' ? `${customMinutes}m` : expiry,
          expiresAt,
          keyHex: accessMode === 'password' ? '' : (accessMode === 'threshold' ? 'threshold' : keyHex),
          createdAt: new Date().toISOString()
        });
        localStorage.setItem('vaultdrop_created_shares', JSON.stringify(list));
      }
      
      // 5. Generate links
      // The decryption key is either derived from password/threshold (not in URL) or appended to URL
      
      // Build the capability URL.
      // For anonymous, the key is in the hash fragment (client-side only).
      const shareUrl = accessMode !== 'anonymous'
        ? `${window.location.origin}/s/${responseData.id}`
        : `${window.location.origin}/s/${responseData.id}#key=${keyHex}`;
        
      const qrDataUrl = await QRCode.toDataURL(shareUrl);

      // Generate the unique link for each split share
      let thresholdLinks: string[] = [];
      if (accessMode === 'threshold' && computedShares.length > 0) {
        thresholdLinks = computedShares.map((share, idx) => {
          const shareHex = Buffer.from(share).toString('hex');
          return `${window.location.origin}/s/${responseData.id}#share=${idx + 1}:${shareHex}`;
        });
      }
      
      setCreationResult({
        id: responseData.id,
        decryptionKeyHex: keyHex,
        shareUrl,
        qrCodeDataUrl: qrDataUrl,
        thresholdLinks
      });
      logHUD('HUD: VAULT COMPLETED. SECURE KEY ESTABLISHED.');
    } catch (e: any) {
      logHUD(`SYSTEM ERROR: ${e.message}`);
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    if (creationResult) {
      navigator.clipboard.writeText(creationResult.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
              // CREATION UNIT
            </span>
          </div>
          <div className="flex gap-4">
            <Link href="/app/shares" className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition-colors">
              [ MY VAULTS ]
            </Link>
            <Link href="/" className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition-colors">
              [ BACK TO MAIN ]
            </Link>
          </div>
        </div>
      </header>

      {/* Main app panel */}
      <main className="flex-grow max-w-4xl w-full mx-auto px-6 py-12 flex flex-col gap-10">
        
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">// DEPOSIT VAULT ENTRY</span>
          <h1 className="font-mono text-3xl font-bold uppercase tracking-wider">CREATE SECURE VAULT</h1>
          <GridLine className="mt-2" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Main share form controls */}
          <div className="md:col-span-2 flex flex-col gap-6">
            
            {/* Share Type Tab Selector */}
            <div className="flex gap-4">
              <Button
                variant={shareType === 'text' ? 'primary' : 'secondary'}
                onClick={() => setShareType('text')}
                className="flex-1"
                disabled={isProcessing}
              >
                TEXT / CODE
              </Button>
              <Button
                variant={shareType === 'file' ? 'primary' : 'secondary'}
                onClick={() => setShareType('file')}
                className="flex-1"
                disabled={isProcessing}
              >
                SECURE FILE
              </Button>
            </div>

            {/* Input fields based on share type */}
            <div className="border border-neutral-200 bg-white p-4">
              {shareType === 'text' ? (
                <textarea
                  value={textPayload}
                  onChange={(e) => setTextPayload(e.target.value)}
                  placeholder="Paste sensitive text, markdown, or source code here..."
                  className="w-full h-64 bg-transparent border-0 resize-none font-mono text-sm focus:outline-none placeholder-neutral-400"
                  disabled={isProcessing}
                />
              ) : (
                <div className="h-64 border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center gap-4 bg-neutral-50 relative">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={isProcessing}
                  />
                  <FileUp className="w-8 h-8 text-neutral-400" />
                  <div className="text-center font-mono text-xs">
                    {filePayload ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold text-neutral-800">{filePayload.name}</span>
                        <span className="text-neutral-400">({(filePayload.size / 1024).toFixed(2)} KB)</span>
                      </div>
                    ) : (
                      <span>DRAG AND DROP FILE OR CLICK TO EXPLORE</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Configuration options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white p-6 border border-neutral-200">
              
              {/* Expiration selection */}
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  STORAGE RETENTION (EXPIRY)
                </label>
                <select
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="bg-transparent border-b border-neutral-300 py-1.5 px-1 font-mono text-sm focus:outline-none focus:border-neutral-900"
                  disabled={isProcessing}
                >
                  <option value="5m">5 MINUTES (BURN)</option>
                  <option value="1h">1 HOUR</option>
                  <option value="1d">1 DAY</option>
                  <option value="7d">7 DAYS</option>
                  <option value="30d">30 DAYS</option>
                  <option value="custom">CUSTOM MINUTES</option>
                </select>
                {expiry === 'custom' && (
                  <div className="mt-2">
                    <Input
                      label="RETENTION (MINUTES)"
                      type="number"
                      min="1"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>
                )}
              </div>

              {/* Access Mode */}
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                  AUTHORIZATION LAYER
                </label>
                <div className="flex gap-4 pt-1.5">
                  <label className="flex items-center gap-2 font-mono text-xs cursor-pointer select-none">
                    <input
                      type="radio"
                      checked={accessMode === 'anonymous'}
                      onChange={() => setAccessMode('anonymous')}
                      className="accent-neutral-900"
                      disabled={isProcessing}
                    />
                    ANYONE WITH URL
                  </label>
                  <label className="flex items-center gap-2 font-mono text-xs cursor-pointer select-none">
                    <input
                      type="radio"
                      checked={accessMode === 'password'}
                      onChange={() => setAccessMode('password')}
                      className="accent-neutral-900"
                      disabled={isProcessing}
                    />
                    PASSWORD ENVELOPE
                  </label>
                  <label className="flex items-center gap-2 font-mono text-xs cursor-pointer select-none">
                    <input
                      type="radio"
                      checked={accessMode === 'threshold'}
                      onChange={() => setAccessMode('threshold')}
                      className="accent-neutral-900"
                      disabled={isProcessing}
                    />
                    M-OF-N ACCESS
                  </label>
                </div>
              </div>

              {/* Password configuration */}
              {accessMode === 'password' && (
                <div className="sm:col-span-2 mt-2">
                  <Input
                    label="ENVELOPE DECRYPTION PASSWORD"
                    type="password"
                    placeholder="Enter passphrase used to derive encryption envelope..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
              )}

              {/* Threshold policy configuration */}
              {accessMode === 'threshold' && (
                <div className="sm:col-span-2 grid grid-cols-2 gap-4 mt-2 border-t border-neutral-100 pt-4">
                  <Input
                    label="REQUIRED SHARE THRESHOLD (M)"
                    type="number"
                    min="2"
                    max="255"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    disabled={isProcessing}
                  />
                  <Input
                    label="TOTAL SHARES (N)"
                    type="number"
                    min="2"
                    max="255"
                    value={participantCount}
                    onChange={(e) => setParticipantCount(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
              )}

            </div>

            {/* Action Trigger */}
            <Button
              variant="primary"
              size="lg"
              onClick={handleCreateShare}
              disabled={isProcessing || (shareType === 'text' ? !textPayload : !filePayload)}
            >
              {isProcessing ? 'PROCESSING VAULT...' : 'CREATE SECURE VAULT SHARE'}
            </Button>

          </div>

          {/* Sidebar HUD and Status panel */}
          <div className="flex flex-col gap-6">
            
            {/* Real-time HUD Process console */}
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
                SYSTEM MEMORY IS CLEANED AUTOMATICALLY
              </div>
            </div>

            {/* Results rendering */}
            <AnimatePresence>
              {creationResult && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="border border-green-200 bg-green-50/50 p-6 flex flex-col items-center text-center gap-4"
                >
                  <span className="font-mono text-[10px] text-green-600 font-bold tracking-widest">// SECURE LINK COMPLETED</span>
                  
                  {creationResult.thresholdLinks && creationResult.thresholdLinks.length > 0 ? (
                    <div className="w-full flex flex-col gap-3 text-left">
                      <span className="font-mono text-[9px] text-green-600 font-bold tracking-widest">// N-SPLIT CRYPTO SHARE LINKS</span>
                      <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                        {creationResult.thresholdLinks.map((link, idx) => (
                          <div key={idx} className="bg-white p-3 border border-neutral-200 flex flex-col gap-1.5">
                            <div className="flex justify-between items-center">
                              <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest">RECIPIENT LINK {idx + 1}</span>
                              <button
                                className="font-mono text-[8px] bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 uppercase tracking-widest px-2 py-0.5"
                                onClick={() => {
                                  navigator.clipboard.writeText(link);
                                  alert(`Link ${idx + 1} copied!`);
                                }}
                              >
                                COPY
                              </button>
                            </div>
                            <span className="font-mono text-[9px] text-neutral-800 break-all select-all font-semibold">
                              {link}
                            </span>
                          </div>
                        ))}
                      </div>
                      <span className="font-mono text-[9px] text-neutral-500 text-center mt-2 leading-relaxed">
                        Distribute each link to a separate recipient. Decryption requires at least {threshold} of them to open their link!
                      </span>
                    </div>
                  ) : (
                    <>
                      {/* QR code */}
                      <img
                        src={creationResult.qrCodeDataUrl}
                        alt="Decryption Link QR Code"
                        className="w-32 h-32 border border-neutral-200 p-1 bg-white select-none"
                      />

                      {/* Share ID */}
                      <div className="w-full flex flex-col gap-1 text-left bg-white p-3 border border-neutral-200">
                        <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest">SECURE URL</span>
                        <span className="font-mono text-[10px] text-neutral-800 break-all select-all font-bold">
                          {creationResult.shareUrl}
                        </span>
                      </div>

                      {/* Envelope protection note */}
                      {accessMode === 'password' && (
                        <div className="flex items-start gap-2 text-left text-[10px] text-neutral-500 font-mono">
                          <Key className="w-4 h-4 text-neutral-600 shrink-0" />
                          <span>URL contains locator ID only. Plaintext password is required for client envelopes.</span>
                        </div>
                      )}

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={copyToClipboard}
                        className="w-full flex items-center justify-center gap-2"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> COPIED
                          </>
                        ) : (
                          <>
                            <Clipboard className="w-3.5 h-3.5" /> COPY SHARE URL
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-6 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest">
            VaultDrop executes encryption fully within the client domain boundary. The host server does not hold the keys.
          </span>
        </div>
      </footer>

    </div>
  );
}
