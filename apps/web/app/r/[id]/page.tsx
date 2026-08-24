'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button, GridLine, Input } from '@vaultdrop/ui';
import { Shield, MessageSquare, Send, Paperclip, Download, Lock, CheckCircle, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { CryptoProvider, ShamirSSS } from '@vaultdrop/crypto';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  isSelf: boolean;
  fileAttachment?: {
    id: string;
    name: string;
    size: number;
    mime: string;
  };
  createdAt: number;
}

export default function ChatRoomPage({ params }: { params: { id: string } }) {
  const roomId = params.id;
  const [roomKey, setRoomKey] = useState<Uint8Array | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isDecryptingRoom, setIsDecryptingRoom] = useState(false);
  const [nickname, setNickname] = useState('');
  const [tempNickname, setTempNickname] = useState('');
  const [hasSetNickname, setHasSetNickname] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hudStatus, setHudStatus] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  const lastMessageTimeRef = useRef<number>(0);
  const pollIntervalRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    logHUD(`SYSTEM: ATTEMPTING CONNECTION TO VAULT ROOM ${roomId}...`);
    fetchRoomConfig();
    
    // Load nickname if cached
    if (typeof window !== 'undefined') {
      const cachedNick = localStorage.getItem('vaultdrop_chat_nickname');
      if (cachedNick) {
        setNickname(cachedNick);
        setTempNickname(cachedNick);
        setHasSetNickname(true);
      }
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [roomId]);

  useEffect(() => {
    // Scroll to bottom on new messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Start message polling only once room key and nickname are established
    if (roomKey && hasSetNickname) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(pollMessages, 2500);
      pollMessages(); // Initial fetch
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [roomKey, hasSetNickname]);

  const logHUD = (line: string) => {
    setHudStatus(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);
  };

  const fetchRoomConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/v1/rooms/${roomId}/config`);
      if (!res.ok) throw new Error('VaultRoom locator not found or expired.');
      const data = await res.json();
      
      setRequiresPassword(data.accessMode === 'password');

      if (data.accessMode === 'anonymous') {
        const hash = window.location.hash;
        if (hash.startsWith('#key=')) {
          const keyHex = hash.substring(5);
          if (keyHex.length === 64) {
            const key = new Uint8Array(Buffer.from(keyHex, 'hex'));
            setRoomKey(key);
            logHUD('✓ CRYPTO: ROOM KEY EXTRACTED FROM CAPABILITY HASH FRAGMENT');
          } else {
            setErrorMsg('Invalid URL key signature length.');
          }
        } else {
          setErrorMsg('Missing URL key signature. Make sure you opened the full link.');
        }
      } else {
        logHUD('SECURITY: ROOM IS PROTECTED. PASSPHRASE AUTH REQUIRED.');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
      logHUD(`✗ SYSTEM ERROR: ${e.message}`);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    try {
      setIsDecryptingRoom(true);
      setErrorMsg('');
      logHUD('KDF: DERIVING ENVELOPE DECRYPTION KEY FROM PASSWORD...');

      // Fetch room config again to get salt/wrapped key
      const res = await fetch(`${API_URL}/v1/rooms/${roomId}/config`);
      if (!res.ok) throw new Error('Failed to retrieve room parameters');
      const data = await res.json();

      const saltBytes = new Uint8Array(Buffer.from(data.salt, 'hex'));
      const derivedKey = await CryptoProvider.deriveKeyFromPassword(password, saltBytes);
      logHUD('✓ KDF: DECRYPTION KEY DERIVED SUCCESS');

      logHUD('CRYPTO: ATTEMPTING ENVELOPE KEY AGREEMENT UNWRAPPING...');
      const decryptedRoomKey = await CryptoProvider.decryptAES_GCM(
        Buffer.from(data.wrappedRoomKey, 'base64'),
        derivedKey,
        Buffer.from(data.nonce, 'base64'),
        Buffer.from(data.tag, 'base64')
      );

      setRoomKey(decryptedRoomKey);
      logHUD('✓ CRYPTO: ROOM SYMMETRIC MASTER KEY ESTABLISHED');
    } catch (e: any) {
      logHUD('✗ CRYPTO ERROR: PASSPHRASE INCORRECT OR INTEGRITY CORRUPT');
      setErrorMsg('Passphrase incorrect. Failed to unwrap room key.');
    } finally {
      setIsDecryptingRoom(false);
    }
  };

  const handleNicknameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempNickname.trim()) return;
    setNickname(tempNickname.trim());
    setHasSetNickname(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('vaultdrop_chat_nickname', tempNickname.trim());
    }
    logHUD(`SYSTEM: LOGGED IN WITH NICKNAME: "${tempNickname.trim()}"`);
  };

  const pollMessages = async () => {
    if (!roomKey) return;
    try {
      const res = await fetch(`${API_URL}/v1/rooms/${roomId}/messages?since=${lastMessageTimeRef.current}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.length === 0) return;

      const newMessages: ChatMessage[] = [];
      let maxTime = lastMessageTimeRef.current;

      for (const msg of data) {
        if (msg.createdAt > maxTime) {
          maxTime = msg.createdAt;
        }

        try {
          const cipherBytes = Buffer.from(msg.ciphertext, 'base64');
          const nonceBytes = Buffer.from(msg.nonce, 'base64');
          const tagBytes = Buffer.from(msg.tag, 'base64');

          const decrypted = await CryptoProvider.decryptAES_GCM(cipherBytes, roomKey, nonceBytes, tagBytes);
          const parsed = JSON.parse(new TextDecoder().decode(decrypted));

          newMessages.push({
            id: msg.id,
            sender: parsed.sender,
            text: parsed.text,
            isSelf: parsed.sender === nickname,
            fileAttachment: parsed.fileAttachment,
            createdAt: msg.createdAt
          });
        } catch (decErr) {
          // Message encrypted with a different key, ignore
        }
      }

      if (newMessages.length > 0) {
        setMessages(prev => {
          // Filter duplicates
          const ids = new Set(prev.map(m => m.id));
          const filtered = newMessages.filter(m => !ids.has(m.id));
          return [...prev, ...filtered];
        });
        lastMessageTimeRef.current = maxTime;
        logHUD(`✓ NETWORK: RETRIEVED ${newMessages.length} NEW CONVERSATION ENVELOPES`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !roomKey || isSending) return;

    try {
      setIsSending(true);
      logHUD('CRYPTO: ENCRYPTING OUTGOING CHAT MESSAGE...');
      
      const payloadString = JSON.stringify({ sender: nickname, text: inputText.trim() });
      const payloadBytes = new TextEncoder().encode(payloadString);
      
      const { ciphertext, nonce, tag } = await CryptoProvider.encryptAES_GCM(payloadBytes, roomKey);

      logHUD('NETWORK: SUBMITTING CIPHERTEXT TO ROOM STREAM...');
      const senderHash = Buffer.from(CryptoProvider.getRandomBytes(16)).toString('hex'); // pseudo-anonymous sender ID

      const res = await fetch(`${API_URL}/v1/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderHash,
          ciphertext: Buffer.from(ciphertext).toString('base64'),
          nonce: Buffer.from(nonce).toString('base64'),
          tag: Buffer.from(tag).toString('base64')
        })
      });

      if (!res.ok) throw new Error('API server rejected message upload');

      setInputText('');
      await pollMessages();
    } catch (e: any) {
      logHUD(`✗ SYSTEM ERROR: ${e.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomKey || isUploading) return;

    try {
      setIsUploading(true);
      logHUD(`CRYPTO: INITIATING ZERO-KNOWLEDGE ENCRYPTION FOR FILE "${file.name}"...`);

      // 1. Generate unique attachment ID
      const attachmentId = Buffer.from(CryptoProvider.getRandomBytes(16)).toString('hex');

      // 2. Derive attachment-specific encryption key via HKDF from roomKey
      const attachmentKey = await CryptoProvider.deriveHKDF(roomKey, `vaultdrop/attachment/${attachmentId}`);
      logHUD('✓ CRYPTO: CHILD FILE KEY DERIVED SUCCESSFULLY');

      // 3. Encrypt file payload in browser memory
      const arrayBuffer = await file.arrayBuffer();
      const fileBytes = new Uint8Array(arrayBuffer);
      logHUD('CRYPTO: ENCRYPTING RAW CHUNKS WITH AES-256-GCM...');
      const fileEncrypt = await CryptoProvider.encryptAES_GCM(fileBytes, attachmentKey);

      // 4. Encrypt file metadata with room key
      const metaString = JSON.stringify({ name: file.name, size: file.size, mime: file.type });
      const metaBytes = new TextEncoder().encode(metaString);
      const metaEncrypt = await CryptoProvider.encryptAES_GCM(metaBytes, roomKey);

      logHUD('NETWORK: UPLOADING ENCRYPTED FILE TO STORAGE CLOUD...');
      const fileMetaPayload = JSON.stringify({
        ciphertext: Buffer.from(metaEncrypt.ciphertext).toString('base64'),
        nonce: Buffer.from(metaEncrypt.nonce).toString('base64'),
        tag: Buffer.from(metaEncrypt.tag).toString('base64')
      });

      // Submit attachment
      const uploadRes = await fetch(`${API_URL}/v1/rooms/${roomId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciphertext: Buffer.from(fileEncrypt.ciphertext).toString('base64'),
          nonce: Buffer.from(fileEncrypt.nonce).toString('base64'),
          tag: Buffer.from(fileEncrypt.tag).toString('base64'),
          fileMeta: fileMetaPayload
        })
      });

      if (!uploadRes.ok) throw new Error('API server rejected attachment upload');
      const uploadData = await uploadRes.json();
      logHUD('✓ NETWORK: ATTACHMENT STORAGE DEPLOYED SUCCESSFULLY');

      // 5. Send message linking to this attachment
      logHUD('CRYPTO: SUBMITTING ATTACHMENT NOTICE MESSAGE...');
      const payloadString = JSON.stringify({
        sender: nickname,
        text: `[FILE:${uploadData.id}]`,
        fileAttachment: {
          id: uploadData.id,
          name: file.name,
          size: file.size,
          mime: file.type
        }
      });
      const payloadBytes = new TextEncoder().encode(payloadString);
      const msgEncrypt = await CryptoProvider.encryptAES_GCM(payloadBytes, roomKey);
      const senderHash = Buffer.from(CryptoProvider.getRandomBytes(16)).toString('hex');

      await fetch(`${API_URL}/v1/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderHash,
          ciphertext: Buffer.from(msgEncrypt.ciphertext).toString('base64'),
          nonce: Buffer.from(msgEncrypt.nonce).toString('base64'),
          tag: Buffer.from(msgEncrypt.tag).toString('base64')
        })
      });

      await pollMessages();
    } catch (e: any) {
      logHUD(`✗ SYSTEM ERROR: ${e.message}`);
      alert('Upload failed: ' + e.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadAttachment = async (attachmentId: string, fileName: string) => {
    if (!roomKey) return;
    try {
      logHUD(`NETWORK: RETRIEVING SECURE ATTACHMENT ${attachmentId}...`);
      const res = await fetch(`${API_URL}/v1/rooms/${roomId}/attachments/${attachmentId}`);
      if (!res.ok) throw new Error('Attachment not found or expired.');
      const data = await res.json();

      logHUD('CRYPTO: DERIVING CHILD DECRYPTION KEY FROM MASTER CHAT KEY...');
      const attachmentKey = await CryptoProvider.deriveHKDF(roomKey, `vaultdrop/attachment/${attachmentId}`);

      logHUD('CRYPTO: DECRYPTING RAW PAYLOAD CHUNKS IN CLIENT MEMORY...');
      const decrypted = await CryptoProvider.decryptAES_GCM(
        Buffer.from(data.ciphertext, 'base64'),
        attachmentKey,
        Buffer.from(data.nonce, 'base64'),
        Buffer.from(data.tag, 'base64')
      );

      logHUD('SYSTEM: WRITING BLOB AND TRIGGERING DOWNLOAD...');
      const blob = new Blob([decrypted as any]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      logHUD(`✓ SYSTEM: ATTACHMENT "${fileName}" DOWNLOADED`);
    } catch (e: any) {
      logHUD(`✗ CRYPTO ERROR: DECRYPTION FAILED (${e.message})`);
      alert('Failed to retrieve file: ' + e.message);
    }
  };

  // UI rendering blocks
  if (errorMsg) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-white font-mono text-xs text-[#171717]">
        <div className="border border-neutral-200 p-8 max-w-md w-full flex flex-col gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-sm font-bold uppercase tracking-wider">ROOM SYSTEM FAULT</h2>
          <p className="text-neutral-500 uppercase leading-relaxed">{errorMsg}</p>
          <GridLine />
          <Link href="/app/rooms" className="text-neutral-900 font-bold hover:underline mt-2">
            [ BACK TO ROOM PORTAL ]
          </Link>
        </div>
      </div>
    );
  }

  // 1. Password envelope check
  if (requiresPassword && !roomKey) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-white font-mono text-xs text-[#171717]">
        <form onSubmit={handlePasswordSubmit} className="border border-neutral-200 p-8 max-w-md w-full flex flex-col gap-6 bg-white">
          <div className="flex flex-col gap-2 text-center">
            <Lock className="w-8 h-8 mx-auto text-neutral-800" />
            <h2 className="text-sm font-bold uppercase tracking-wider">PROTECTED VAULT ROOM</h2>
            <p className="text-neutral-400 text-[10px] uppercase">Passphrase authentication required to derive master key</p>
          </div>
          <GridLine />
          <Input
            label="ROOM PASSPHRASE"
            type="password"
            placeholder="Enter password..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isDecryptingRoom}
          />
          <Button variant="primary" type="submit" disabled={isDecryptingRoom}>
            {isDecryptingRoom ? 'DERIVING ROOM ENVELOPE...' : 'AUTHENTICATE & ENTER'}
          </Button>
          <Link href="/app/rooms" className="text-center font-mono text-[10px] text-neutral-400 hover:text-neutral-900 uppercase">
            [ BACK TO PORTAL ]
          </Link>
        </form>
      </div>
    );
  }

  // 2. Nickname setup check
  if (!hasSetNickname) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-white font-mono text-xs text-[#171717]">
        <form onSubmit={handleNicknameSubmit} className="border border-neutral-200 p-8 max-w-md w-full flex flex-col gap-6 bg-white">
          <div className="flex flex-col gap-2 text-center">
            <MessageSquare className="w-8 h-8 mx-auto text-neutral-800" />
            <h2 className="text-sm font-bold uppercase tracking-wider">ENTER VAULT ROOM</h2>
            <p className="text-neutral-400 text-[10px] uppercase">Identify yourself. Nicknames are encrypted locally.</p>
          </div>
          <GridLine />
          <Input
            label="CONVERSATION NICKNAME"
            type="text"
            placeholder="Enter nickname..."
            value={tempNickname}
            onChange={(e) => setTempNickname(e.target.value)}
          />
          <Button variant="primary" type="submit">
            ENTER CONVERSATION [ → ]
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-[#171717] bg-[#fcfcfc]">
      
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white relative z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-mono font-bold uppercase tracking-[0.25em] text-sm">
              [ VAULTDROP ]
            </Link>
            <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest hidden md:inline">
              // ROOM CHAT PORTAL
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[9px] text-green-600 font-bold uppercase tracking-widest bg-green-50 px-2 py-0.5 border border-green-200">
              ● SECURE CONVERSATION
            </span>
            <Link href="/app/rooms" className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition-colors">
              [ LEAVE ROOM ]
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-6 py-8 flex flex-col lg:flex-row gap-6 h-[calc(100vh-4rem-6rem)] min-h-[500px]">
        
        {/* Chat window */}
        <div className="flex-grow flex flex-col border border-neutral-200 bg-white h-full relative">
          
          {/* Room header */}
          <div className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between bg-neutral-50/50">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">ROOM IDENTIFIER</span>
              <span className="font-mono text-[11px] font-bold text-neutral-800 break-all">{roomId}</span>
            </div>
            <span className="font-mono text-[9px] text-neutral-400 uppercase">User: {nickname}</span>
          </div>

          {/* Messages window */}
          <div className="flex-grow p-6 overflow-y-auto flex flex-col gap-4 max-h-[calc(100vh-22rem)]">
            {messages.length === 0 ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center p-8 gap-3">
                <MessageSquare className="w-8 h-8 text-neutral-300 animate-pulse" />
                <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider">AWAITING CLIENT MESSAGE ENVELOPES...</span>
              </div>
            ) : (
              messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col max-w-[70%] font-mono text-xs ${
                    m.isSelf ? 'self-end items-end' : 'self-start items-start'
                  }`}
                >
                  <span className="text-[9px] text-neutral-400 uppercase mb-1">
                    {m.isSelf ? 'YOU' : m.sender} • {new Date(m.createdAt).toLocaleTimeString()}
                  </span>
                  
                  {m.fileAttachment ? (
                    <div className="border border-neutral-200 bg-neutral-50 p-3 flex items-center gap-3 w-full">
                      <ImageIcon className="w-6 h-6 text-neutral-500" />
                      <div className="flex flex-col gap-0.5 min-w-0 flex-grow">
                        <span className="font-bold text-neutral-800 truncate text-[11px]">{m.fileAttachment.name}</span>
                        <span className="text-neutral-400 text-[9px]">({(m.fileAttachment.size / 1024).toFixed(2)} KB)</span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDownloadAttachment(m.fileAttachment!.id, m.fileAttachment!.name)}
                        className="p-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className={`p-3 border rounded-sm leading-relaxed break-all ${
                        m.isSelf
                          ? 'bg-neutral-900 border-neutral-900 text-white'
                          : 'bg-neutral-100 border-neutral-200 text-neutral-800'
                      }`}
                    >
                      {m.text}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Text Input area */}
          <div className="border-t border-neutral-200 p-4 bg-white relative">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input
                type="text"
                placeholder="Secure zero-knowledge message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isSending || isUploading}
                className="flex-grow bg-white border border-neutral-300 font-mono text-xs px-4 py-2.5 focus:outline-none focus:border-neutral-900 transition-colors"
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="secondary"
                type="button"
                disabled={isSending || isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-3"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={isSending || isUploading || !inputText.trim()}
                className="px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>

        </div>

        {/* Sidebar HUD */}
        <div className="lg:w-[320px] shrink-0 flex flex-col gap-6 h-full">
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
              All messages are encrypted client-side. The server has no decryption capabilities.
            </div>
          </div>
        </div>

      </main>

    </div>
  );
}
