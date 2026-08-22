'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Button, Input, GridLine } from '@vaultdrop/ui';
import { CryptoProvider, ShamirSSS } from '@vaultdrop/crypto';
import { Shield, Key, EyeOff, FileText, Download, MessageSquare, Trash2, ShieldAlert } from 'lucide-react';

interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export default function ShareViewerPage({ params }: { params: { id: string } }) {
  const shareId = params.id;
  
  // Decryption & Fetch state
  const [password, setPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hudStatus, setHudStatus] = useState<string[]>([]);
  
  // Decrypted content
  const [decryptedData, setDecryptedData] = useState<{
    shareType: 'text' | 'file';
    plaintext: string;
    fileMeta: { name: string; size: number; mime: string } | null;
    rawPayload: Uint8Array | null;
  } | null>(null);

  // Discussions
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentNickname, setCommentNickname] = useState('ANONYMOUS');
  const [commentText, setCommentText] = useState('');
  const [discussionKey, setDiscussionKey] = useState<Uint8Array | null>(null);

  // Share meta configuration
  const [isBurn, setIsBurn] = useState(false);
  const [isProtected, setIsProtected] = useState(false); // Enable diagonal watermark for secure text paste

  // Read hash fragment for CEK / Share split
  const [cekHexFromUrl, setCekHexFromUrl] = useState('');
  const [shareIndex, setShareIndex] = useState<number | null>(null);
  const [shareHex, setShareHex] = useState('');
  
  // Threshold state
  const [isThreshold, setIsThreshold] = useState(false);
  const [thresholdStatus, setThresholdStatus] = useState<'idle' | 'submitting' | 'waiting' | 'ready' | 'error'>('idle');
  const [submittedCount, setSubmittedCount] = useState(0);
  const [requiredThreshold, setRequiredThreshold] = useState(0);
  const [lobbyParticipants, setLobbyParticipants] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.startsWith('#key=')) {
        setCekHexFromUrl(hash.substring(5));
      } else if (hash.startsWith('#share=')) {
        const parts = hash.substring(7).split(':');
        if (parts.length === 2) {
          setShareIndex(parseInt(parts[0], 10));
          setShareHex(parts[1]);
        }
      }
    }
    fetchShareConfig();
  }, [shareId]);

  const logHUD = (line: string) => {
    setHudStatus(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);
  };

  // Fetch share config details (salt, access mode, protected mode) from server
  const fetchShareConfig = async () => {
    try {
      const res = await fetch(`http://localhost:3001/v1/shares/${shareId}/config`);
      if (!res.ok) {
        throw new Error('Locator ID not found or share has expired/been burned');
      }
      const data = await res.json();
      setRequiresPassword(data.accessMode === 'password');
      setIsBurn(data.burnAfterReading);
      setIsProtected(data.protectedViewing || false);
      setIsThreshold(data.accessMode === 'threshold');
      
      // Auto-decrypt if key is in URL and no password is required
      if (data.accessMode === 'anonymous' && window.location.hash.startsWith('#key=')) {
        const urlKey = window.location.hash.substring(5);
        if (urlKey) {
          triggerDecryption(Buffer.from(urlKey, 'hex'));
        }
      } else if (data.accessMode === 'threshold') {
        setSubmittedCount(data.submittedCount);
        setRequiredThreshold(data.threshold);
        setLobbyParticipants(data.participantCount);

        const hash = window.location.hash;
        if (hash.startsWith('#share=')) {
          const parts = hash.substring(7).split(':');
          if (parts.length === 2) {
            const idx = parseInt(parts[0], 10);
            const hex = parts[1];
            submitThresholdShare(idx, hex);
          } else {
            setErrorMsg('Invalid recipient share link fragment.');
          }
        } else {
          // No share key in URL - this is a visitor or creator observing the lobby progress
          logHUD('SYSTEM: VIEWING LOBBY PROGRESS WITHOUT PARTICIPANT KEY.');
          if (data.submittedCount >= data.threshold) {
            logHUD('✓ SYSTEM: THRESHOLD ALREADY MET. ATTEMPTING RECONSTRUCTION...');
            setThresholdStatus('ready');
            reconstructAndDecrypt();
          } else {
            setThresholdStatus('waiting');
          }
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  const submitThresholdShare = async (idx: number, hex: string) => {
    try {
      setThresholdStatus('submitting');
      logHUD(`NETWORK: SUBMITTING PARTICIPANT SHARE #${idx} TO CRYPTO LOBBY...`);
      
      const response = await fetch(`http://localhost:3001/v1/shares/${shareId}/submit-share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareIndex: idx, secretShare: hex })
      });
      
      if (!response.ok) {
        throw new Error('Failed to register share in threshold escrow.');
      }
      
      const result = await response.json();
      setSubmittedCount(result.submittedCount);
      setRequiredThreshold(result.threshold);
      setLobbyParticipants(result.participantCount);
      
      if (result.status === 'completed') {
        logHUD(`✓ LOBBY: MINIMUM THRESHOLD MET (${result.submittedCount}/${result.threshold})! RECONSTRUCTING CEK...`);
        setThresholdStatus('ready');
        await reconstructAndDecrypt();
      } else {
        logHUD(`LOBBY: REGISTERED OK. WAITING FOR OTHER SHAREHOLDERS... (${result.submittedCount}/${result.threshold} AUTHENTICATED)`);
        setThresholdStatus('waiting');
      }
    } catch (e: any) {
      setThresholdStatus('error');
      setErrorMsg(e.message);
    }
  };

  const reconstructAndDecrypt = async () => {
    try {
      setIsDecrypting(true);
      logHUD('NETWORK: ACQUIRING SUBMITTED SHAMIR SHARES FROM ESCROW...');
      const response = await fetch(`http://localhost:3001/v1/shares/${shareId}/shares`);
      if (!response.ok) {
        throw new Error('Failed to retrieve threshold shares.');
      }
      const data = await response.json() as Array<{ shareIndex: number; secretShare: string }>;
      
      logHUD('CRYPTO: REASSEMBLING CONTENT ENCRYPTION KEY (CEK) VIA SHAMIR SSS...');
      const sharesArray = data.map(s => new Uint8Array(Buffer.from(s.secretShare, 'hex')));
      
      const reconstructedCek = await ShamirSSS.combineShares(sharesArray);
      logHUD('✓ CRYPTO: CEK KEY RECONSTRUCTED IN CLIENT MEMORY');
      await triggerDecryption(reconstructedCek);
    } catch (e: any) {
      logHUD(`✗ CRYPTO ERROR: CEK RECONSTRUCTION FAILED (${e.message})`);
      setErrorMsg('Reassembling threshold shares failed. Decryption key mismatch.');
      setIsDecrypting(false);
    }
  };

  const checkLobbyStatus = async () => {
    try {
      const response = await fetch(`http://localhost:3001/v1/shares/${shareId}/shares`);
      if (response.ok) {
        logHUD(`✓ LOBBY UPDATED: THRESHOLD MET! INITIATING RECONSTRUCTION...`);
        setThresholdStatus('ready');
        await reconstructAndDecrypt();
      } else {
        const testRes = await fetch(`http://localhost:3001/v1/shares/${shareId}/config`);
        if (testRes.ok) {
          const result = await testRes.json();
          setSubmittedCount(result.submittedCount);
          setRequiredThreshold(result.threshold);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let timer: any;
    if (thresholdStatus === 'waiting') {
      timer = setInterval(() => {
        checkLobbyStatus();
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [thresholdStatus]);

  const handlePasswordSubmit = async () => {
    try {
      setErrorMsg('');
      setIsDecrypting(true);
      setHudStatus([]);
      
      logHUD('CRYPTO: INITIALIZING PASS-ENVELOPE DECRYPTION');
      
      // 1. Fetch encrypted config from API
      const res = await fetch(`http://localhost:3001/v1/shares/${shareId}/config`);
      if (!res.ok) throw new Error('Locator ID not found or share expired');
      const config = await res.json();
      
      if (!config.wrappedContentKey || !config.salt) {
        throw new Error('Crypto envelope mismatch: missing salt or wrapped key material');
      }
      
      const salt = Buffer.from(config.salt, 'hex');
      const envelope = JSON.parse(config.wrappedContentKey);
      
      // 2. Derive key from password
      logHUD('CRYPTO: DERIVING ENVELOPE DECRYPTION KEY (ARGON2ID)...');
      const derivedKey = await CryptoProvider.deriveKeyFromPassword(password, salt);
      
      // 3. Unwrap CEK
      logHUD('CRYPTO: ATTEMPTING ENVELOPE UNWRAPPING...');
      const cek = await CryptoProvider.decryptAES_GCM(
        Buffer.from(envelope.ciphertext, 'base64'),
        derivedKey,
        Buffer.from(envelope.nonce, 'base64'),
        Buffer.from(envelope.tag, 'base64')
      );
      
      logHUD('✓ CRYPTO: CEK UNWRAPPED SUCCESSFULLY');
      await triggerDecryption(cek);
    } catch (e: any) {
      logHUD('✗ CRYPTO ERROR: PASSWORD INCORRECT OR INTEGRITY VIOLATED');
      setErrorMsg('Decryption failed. Please check the password.');
      setIsDecrypting(false);
    }
  };

  const triggerDecryption = async (cek: Uint8Array) => {
    try {
      if (!isDecrypting) setIsDecrypting(true);
      
      // 1. Fetch ciphertext payload from server
      logHUD('NETWORK: RETRIEVING CIPHERTEXT PAYLOAD FROM SERVER...');
      const res = await fetch(`http://localhost:3001/v1/shares/${shareId}`);
      if (!res.ok) throw new Error('Failed to retrieve vault data');
      const share = await res.json();
      
      // 2. Decrypt Content
      logHUD('CRYPTO: DECRYPTING PAYLOAD...');
      const ciphertext = Buffer.from(share.ciphertext, 'base64');
      const nonce = Buffer.from(share.nonce, 'base64');
      const tag = Buffer.from(share.tag, 'base64');
      
      const decrypted = await CryptoProvider.decryptAES_GCM(ciphertext, cek, nonce, tag);
      logHUD('✓ CRYPTO: PAYLOAD DECRYPTED');
      
      // 3. Decrypt Metadata if it is a File
      let fileMeta: { name: string; size: number; mime: string } | null = null;
      if (share.shareType === 'file' && share.fileMeta) {
        logHUD('CRYPTO: DECRYPTING FILE METADATA...');
        const metaKey = await CryptoProvider.deriveHKDF(cek, 'vaultdrop/metadata');
        
        const metaCipher = Buffer.from(share.fileMeta.name, 'base64');
        const [metaTagB64, metaNonceB64] = share.fileMeta.mime.split(':');
        const metaTag = Buffer.from(metaTagB64, 'base64');
        const metaNonce = Buffer.from(metaNonceB64, 'base64');
        
        const decryptedMeta = await CryptoProvider.decryptAES_GCM(metaCipher, metaKey, metaNonce, metaTag);
        fileMeta = JSON.parse(new TextDecoder().decode(decryptedMeta));
        logHUD(`✓ CRYPTO: METADATA COMPLETED (FILE: ${fileMeta?.name})`);
      }
      
      let plaintext = '';
      if (share.shareType === 'text') {
        plaintext = new TextDecoder().decode(decrypted);
      }
      
      setDecryptedData({
        shareType: share.shareType,
        plaintext,
        fileMeta,
        rawPayload: decrypted
      });
      
      // 4. Derive discussions key
      logHUD('CRYPTO: DERIVING DISCUSSION ENCRYPTION KEY VIA HKDF...');
      const discKey = await CryptoProvider.deriveHKDF(cek, 'vaultdrop/discussion');
      setDiscussionKey(discKey);
      
      // 5. Load and decrypt comments
      await fetchComments(discKey);
      
      logHUD('HUD: DATA DECRYPTION COMPLETED');
      
      // 6. If burn-after-reading, trigger consumed signal on server
      if (isBurn) {
        logHUD('NETWORK: VAULT IS BURN-AFTER-READING. CONSUMING ACCESS LEASE...');
        await fetch(`http://localhost:3001/v1/shares/${shareId}/consume`, { method: 'POST' });
        logHUD('NETWORK: VAULT PERMANENTLY DESTROYED ON SERVER');
      }
    } catch (e: any) {
      logHUD(`✗ SYSTEM ERROR: ${e.message}`);
      setErrorMsg('Failed to decrypt: ' + e.message);
    } finally {
      setIsDecrypting(false);
    }
  };

  const fetchComments = async (discKey: Uint8Array) => {
    try {
      const res = await fetch(`http://localhost:3001/v1/shares/${shareId}/comments`);
      if (!res.ok) return;
      const encryptedComments = await res.json();
      
      const decryptedComments: Comment[] = [];
      for (const item of encryptedComments) {
        try {
          const authCipher = Buffer.from(item.encryptedAuthor, 'base64');
          const authNonce = Buffer.from(item.authorNonce, 'base64');
          const authTag = Buffer.from(item.authorTag, 'base64');
          
          const textCipher = Buffer.from(item.ciphertext, 'base64');
          const textNonce = Buffer.from(item.nonce, 'base64');
          const textTag = Buffer.from(item.tag, 'base64');
          
          const decAuthor = await CryptoProvider.decryptAES_GCM(authCipher, discKey, authNonce, authTag);
          const decText = await CryptoProvider.decryptAES_GCM(textCipher, discKey, textNonce, textTag);
          
          decryptedComments.push({
            id: item.id,
            author: new TextDecoder().decode(decAuthor),
            text: new TextDecoder().decode(decText),
            timestamp: new Date(item.createdAt).toLocaleTimeString()
          });
        } catch (e) {
          console.error('Failed to decrypt comment', e);
        }
      }
      setComments(decryptedComments);
    } catch (e) {
      console.error(e);
    }
  };

  const postComment = async () => {
    if (!commentText.trim() || !discussionKey) return;
    try {
      logHUD('CRYPTO: ENCRYPTING COMMENT PAYLOAD...');
      const encoder = new TextEncoder();
      
      const authorEnc = await CryptoProvider.encryptAES_GCM(encoder.encode(commentNickname), discussionKey);
      const textEnc = await CryptoProvider.encryptAES_GCM(encoder.encode(commentText), discussionKey);
      
      const res = await fetch(`http://localhost:3001/v1/shares/${shareId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encryptedAuthor: Buffer.from(authorEnc.ciphertext).toString('base64'),
          authorNonce: Buffer.from(authorEnc.nonce).toString('base64'),
          authorTag: Buffer.from(authorEnc.tag).toString('base64'),
          ciphertext: Buffer.from(textEnc.ciphertext).toString('base64'),
          nonce: Buffer.from(textEnc.nonce).toString('base64'),
          tag: Buffer.from(textEnc.tag).toString('base64')
        })
      });
      
      if (res.ok) {
        setCommentText('');
        fetchComments(discussionKey);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownload = () => {
    if (!decryptedData || !decryptedData.rawPayload || !decryptedData.fileMeta) return;
    const blob = new Blob([decryptedData.rawPayload as any], { type: decryptedData.fileMeta.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = decryptedData.fileMeta.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`min-h-screen bg-paper flex flex-col grid-dots text-[#171717] ${
      isProtected ? 'select-none relative overflow-hidden' : ''
    }`}>
      
      {/* 1. Diagonal Watermark Overlay for Protected Mode */}
      {isProtected && decryptedData && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center opacity-[0.03] select-none font-mono text-sm leading-none font-bold text-neutral-900 uppercase">
          <div className="grid grid-cols-4 gap-24 rotate-[-30deg] scale-150 whitespace-nowrap">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="tracking-widest">
                CONFIDENTIAL // RECIPIENT SESSION // {new Date().toLocaleDateString()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-mono font-bold uppercase tracking-[0.25em] text-sm">
              [ VAULTDROP ]
            </span>
            <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest hidden md:inline">
              // RECIPIENT RETRIEVAL SYSTEM
            </span>
          </div>
          <Link href="/" className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-900">
            [ EXIT ]
          </Link>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-grow max-w-4xl w-full mx-auto px-6 py-12 flex flex-col gap-8">
        
        {/* Error panel */}
        {errorMsg && (
          <div className="border border-red-200 bg-red-50 p-4 font-mono text-xs text-red-700 flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <div>
              <span className="font-bold block uppercase mb-1">VAULT ERROR</span>
              {errorMsg}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="md:col-span-2 flex flex-col gap-6">
            
            {/* Expiry / Burn status */}
            <div className="flex justify-between items-center border border-neutral-200 bg-white px-4 py-2 text-xs font-mono text-neutral-500">
              <span>LOCATOR: {shareId}</span>
              {isBurn && (
                <span className="text-red-600 font-bold animate-pulse">
                  ⚠ BURN-AFTER-READING ACTIVE
                </span>
              )}
            </div>

            {/* Awaiting Decryption State */}
            {!decryptedData ? (
              <div className="border border-neutral-200 bg-white p-8 flex flex-col items-center justify-center min-h-[300px] gap-6 text-center">
                <Key className="w-10 h-10 text-neutral-400" />
                
                {isThreshold ? (
                  <div className="w-full max-w-sm flex flex-col gap-4 font-mono">
                    <div className="flex flex-col gap-1 text-center">
                      <h3 className="text-sm font-bold uppercase text-neutral-800">M-OF-N ESCROW LOBBY ACTIVE</h3>
                      <p className="text-[11px] text-neutral-500">
                        Waiting for required participants to join.
                      </p>
                    </div>
                    
                    {/* Progress Bar / Counter */}
                    <div className="bg-neutral-100 p-4 border border-neutral-300">
                      <div className="flex justify-between items-center text-xs mb-2">
                        <span className="font-bold">LOBBY PROGRESS:</span>
                        <span className="font-mono text-neutral-800 font-bold">
                          {submittedCount} / {requiredThreshold} SHARES
                        </span>
                      </div>
                      
                      {/* Bar visual */}
                      <div className="w-full bg-neutral-200 h-2 overflow-hidden border border-neutral-300">
                        <div 
                          className="bg-neutral-950 h-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, (submittedCount / (requiredThreshold || 1)) * 100)}%` }}
                        />
                      </div>
                      
                      <div className="mt-3 text-[9px] text-neutral-400 text-center leading-relaxed">
                        Lobby capacity: {lobbyParticipants} total links generated. At least {requiredThreshold} must authorize to decrypt content.
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] text-neutral-400 animate-pulse">
                        {thresholdStatus === 'waiting' ? '● WAITING FOR OTHERS TO OPEN LINK...' : '● INITIALIZING LOBBY...'}
                      </span>
                      <button 
                        className="font-mono text-[10px] bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 py-1.5 uppercase tracking-wider"
                        onClick={checkLobbyStatus}
                      >
                        REFRESH STATUS
                      </button>
                    </div>
                  </div>
                ) : requiresPassword ? (
                  <div className="w-full max-w-sm flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="font-mono text-sm font-bold uppercase">ENVELOPE PASSWORD REQUIRED</h3>
                      <p className="text-[11px] text-neutral-500 font-mono">
                        This share is sealed with a password-derived envelope.
                      </p>
                    </div>
                    <Input
                      type="password"
                      placeholder="Enter decryption password..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isDecrypting}
                    />
                    <Button variant="primary" onClick={handlePasswordSubmit} disabled={isDecrypting}>
                      {isDecrypting ? 'DERIVING KDF...' : 'DECRYPT VAULT [ ENTER ]'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 font-mono">
                    <h3 className="text-sm font-bold uppercase">AWAITING LOCATOR PATH</h3>
                    <p className="text-[11px] text-neutral-400">
                      Decrypting automatically if key fragment is present...
                    </p>
                    {isDecrypting && <span className="text-xs text-neutral-900 animate-pulse mt-2">PROCESSING...</span>}
                  </div>
                )}
              </div>
            ) : (
              /* Decrypted content panel */
              <div className="border border-neutral-200 bg-white p-6 flex flex-col gap-4">
                
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider">
                    DECRYPTED PAYLOAD ({decryptedData.shareType})
                  </span>
                  {isProtected && (
                    <span className="font-mono text-[9px] text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 font-bold">
                      PROTECTED VIEWING ACTIVE
                    </span>
                  )}
                </div>

                {decryptedData.shareType === 'text' ? (
                  <div className="font-mono text-xs overflow-auto bg-neutral-50 p-4 border border-neutral-100 break-all select-all leading-relaxed whitespace-pre-wrap max-h-[400px]">
                    {decryptedData.plaintext}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 bg-neutral-50 border border-dashed border-neutral-200 gap-4">
                    <FileText className="w-12 h-12 text-neutral-400" />
                    <div className="text-center font-mono text-xs flex flex-col gap-1">
                      <span className="font-bold text-neutral-800">{decryptedData.fileMeta?.name}</span>
                      <span className="text-neutral-400">({(decryptedData.fileMeta?.size! / 1024).toFixed(2)} KB)</span>
                      <span className="text-neutral-400 font-semibold">{decryptedData.fileMeta?.mime}</span>
                    </div>
                    <Button variant="primary" onClick={handleDownload} className="flex items-center gap-2 mt-2">
                      <Download className="w-4 h-4" /> DOWNLOAD DECRYPTED FILE
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Discussions Frame */}
            {decryptedData && discussionKey && (
              <div className="border border-neutral-200 bg-white p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
                  <MessageSquare className="w-4 h-4 text-neutral-900" />
                  <span className="font-mono text-[10px] text-neutral-800 uppercase tracking-widest font-bold">
                    CLIENT-ENCRYPTED DISCUSSIONS
                  </span>
                </div>

                {/* Comment feeds */}
                <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1">
                  {comments.length === 0 ? (
                    <span className="font-mono text-[10px] text-neutral-400 italic">No comments posted to this vault.</span>
                  ) : (
                    comments.map(c => (
                      <div key={c.id} className="border border-neutral-100 p-3 bg-neutral-50 flex flex-col gap-1 font-mono text-xs">
                        <div className="flex justify-between items-center text-[9px] text-neutral-400 uppercase tracking-wider font-bold">
                          <span>{c.author}</span>
                          <span>{c.timestamp}</span>
                        </div>
                        <p className="text-neutral-700 leading-normal break-all">{c.text}</p>
                      </div>
                    ))
                  )}
                </div>

                <GridLine />

                {/* Write comment */}
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="NICKNAME"
                      value={commentNickname}
                      onChange={(e) => setCommentNickname(e.target.value.toUpperCase())}
                    />
                  </div>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Type encrypted message..."
                    className="w-full h-16 border border-neutral-200 p-2 font-mono text-xs focus:outline-none placeholder-neutral-400"
                  />
                  <Button variant="secondary" onClick={postComment} disabled={!commentText.trim()}>
                    SUBMIT ENCRYPTED COMMENT
                  </Button>
                </div>

              </div>
            )}

          </div>

          {/* Real-time HUD Process console */}
          <div className="flex flex-col gap-6">
            <div className="border border-neutral-200 bg-neutral-950 text-green-400 p-4 font-mono text-[10px] h-[340px] flex flex-col justify-between select-none">
              <div className="flex justify-between items-center border-b border-neutral-800 pb-2 mb-2">
                <span>SECURE CRYPTO HUD v1.0</span>
                <span className="animate-pulse">●</span>
              </div>
              <div className="flex-grow overflow-y-auto flex flex-col gap-1.5 pr-1 font-semibold">
                {hudStatus.length === 0 ? (
                  <span className="text-neutral-600">[Awaiting decryption initiation...]</span>
                ) : (
                  hudStatus.map((line, idx) => (
                    <div key={idx} className="leading-snug break-all">{line}</div>
                  ))
                )}
              </div>
              <div className="border-t border-neutral-800 pt-2 mt-2 text-[9px] text-neutral-500">
                IN-MEMORY SESSIONS AUTOMATICALLY DESTROYED ON TAB CLOSE
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-6 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest">
            VaultDrop executes decryption fully within the client domain boundary. Plaintext payloads never cross back to the server.
          </span>
        </div>
      </footer>

    </div>
  );
}
