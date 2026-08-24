'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Button, GridLine } from '@vaultdrop/ui';
import { Shield, Key, EyeOff, Network, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);

  // Steps for the interactive zero-knowledge animation
  const steps = [
    { title: '1. PLAINTEXT', desc: 'Sensitive data (text, file) is loaded into the secure client memory.' },
    { title: '2. ENCRYPTION', desc: 'A Content Encryption Key (CEK) is generated in-memory. Payload is encrypted with AES-256-GCM.' },
    { title: '3. TRANSMISSION', desc: 'Only the ciphertext and wrapped key envelopes are sent. The raw key never leaves your browser.' },
    { title: '4. VAULTED STORAGE', desc: 'The server stores the ciphertext blobs in object storage and metadata in Postgres.' }
  ];

  return (
    <div
      className="min-h-screen relative flex flex-col justify-between text-[#171717]"
    >
      
      {/* 1. Header Navigation */}
      <header className="relative z-10 border-b border-neutral-200/90">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold uppercase tracking-[0.25em] text-sm">
              [ VAULTDROP ]
            </span>
            <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest hidden md:inline">
              // ZERO-KNOWLEDGE UTILITY v1.0.0
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="#architecture" className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition-colors">
              [ ARCHITECTURE ]
            </Link>
            <Link href="/app" className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition-colors">
              [ VAULTS ]
            </Link>
            <Link href="/app/rooms" className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition-colors">
              [ VAULT ROOMS ]
            </Link>
          </nav>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="relative z-10 flex-grow max-w-7xl w-full mx-auto px-6 py-12 flex flex-col justify-center gap-16 md:gap-24">
        
        {/* Hero Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 flex flex-col items-start text-left gap-6">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400 bg-neutral-100 px-2.5 py-1">
              PRIVACY BY MATHEMATICS, NOT PROMISES
            </span>
            
            <h1 className="max-w-[11.5ch] font-mono text-[clamp(2.25rem,5.1vw,3.75rem)] font-bold uppercase tracking-[-0.045em] leading-[0.98]">
              SECURE SHARING <br />
              <span className="text-neutral-400">FREE FROM COMPROMISE.</span>
            </h1>
            
            <p className="max-w-xl text-neutral-600 text-sm sm:text-base leading-relaxed">
              VaultDrop encrypts your sensitive text, source code, and files locally on your device before upload. 
              The storage server receives only ciphertext. Compromise of the server reveals nothing.
            </p>

            <div className="flex flex-wrap gap-4 mt-2">
              <Link href="/app">
                <Button variant="primary" size="md">
                  SECURE VAULTS [ → ]
                </Button>
              </Link>
              <Link href="/app/rooms">
                <Button variant="primary" size="md">
                  VAULT ROOMS [ Real-time Chat ]
                </Button>
              </Link>
              <Link href="#architecture">
                <Button variant="secondary" size="md">
                  SPECIFICATION
                </Button>
              </Link>
            </div>
          </div>

          {/* Interactive Cinematic Graphic */}
          <div className="lg:col-span-5 min-w-0 border border-neutral-200 bg-white/95 p-6 relative flex flex-col justify-between h-[360px]">
            {/* Corner decorations reminiscent of CAD blueprint lines */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-neutral-400"></div>
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-neutral-400"></div>
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-neutral-400"></div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-neutral-400"></div>

            {/* Header info */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <span className="font-mono text-[10px] text-neutral-400 tracking-wider">HUD: ZERO-KNOWLEDGE BOUNDARY</span>
              <span className="font-mono text-[10px] text-green-600 tracking-wider uppercase font-bold animate-pulse">● SECURE</span>
            </div>

            {/* Content rendering the interactive flow */}
            <div className="flex-grow flex items-center justify-center relative overflow-hidden my-4">
              

              {/* Step Animation Elements */}
              <AnimatePresence mode="wait">
                {activeStep === 0 && (
                  <motion.div
                    key="step-0"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="w-full min-w-0 flex items-center justify-around gap-3"
                  >
                    <div className="border border-neutral-800 px-2.5 py-3 font-mono text-xs w-[min(160px,42%)] overflow-hidden text-center bg-neutral-50 shadow-sm">
                      <span className="text-[13px] text-neutral-400 block font-bold mb-1">LOCAL MEMORY</span>
                      <span className="block whitespace-nowrap text-[12px] tracking-[-0.08em]">"sensitive_payload.txt"</span>
                    </div>
                    <ArrowRight className="text-neutral-300 w-5 h-5 animate-pulse" />
                    <div className="border border-dashed border-neutral-200 p-4 font-mono text-xs w-[min(140px,42%)] text-center opacity-30 select-none">
                      UNAVAILABLE
                    </div>
                  </motion.div>
                )}

                {activeStep === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="w-full flex flex-col items-center gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="border border-neutral-800 p-3 font-mono text-xs w-[130px] text-center bg-neutral-50">
                        PLAINTEXT
                      </div>
                      <div className="bg-neutral-900 text-white p-2 font-mono text-xs flex flex-col items-center rounded-sm">
                        <Key className="w-4 h-4 text-green-400 mb-1" />
                        <span>AES-GCM [KEY]</span>
                      </div>
                    </div>
                    <motion.div 
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="text-[10px] font-mono text-green-700 bg-green-50 border border-green-200 px-4 py-1"
                    >
                      CRYPTOGRAPHIC PROCESSING
                    </motion.div>
                  </motion.div>
                )}

                {activeStep === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="w-full flex items-center justify-between px-2"
                  >
                    <div className="flex flex-col items-center">
                      <Shield className="w-5 h-5 text-neutral-400 mb-1" />
                      <span className="font-mono text-[9px] text-neutral-400">CLIENT</span>
                    </div>
                    
                    {/* Animated moving packet across the boundary */}
                    <div className="flex-grow mx-4 relative h-10 border border-neutral-200 bg-neutral-50 flex items-center justify-center overflow-hidden">
                      <motion.div
                        initial={{ x: -100 }}
                        animate={{ x: 100 }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                        className="absolute font-mono text-[9px] bg-neutral-950 text-green-400 px-2 py-0.5 rounded-sm whitespace-nowrap"
                      >
                        4a7b9c...f8e2
                      </motion.div>
                    </div>

                    <div className="flex flex-col items-center">
                      <Network className="w-5 h-5 text-neutral-400 mb-1" />
                      <span className="font-mono text-[9px] text-neutral-400">SERVER</span>
                    </div>
                  </motion.div>
                )}

                {activeStep === 3 && (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="w-full min-w-0 flex items-center justify-around gap-3"
                  >
                    <div className="border border-dashed border-neutral-200 p-4 font-mono text-xs w-[min(140px,42%)] text-center opacity-30 select-none">
                      DELETED IN-MEMORY
                    </div>
                    <ArrowRight className="text-neutral-300 w-5 h-5" />
                    <div className="border border-red-800 bg-red-950 text-red-200 p-4 font-mono text-[10px] w-[min(140px,42%)] text-center break-all">
                      <span className="text-[9px] text-red-400 block font-bold mb-1 uppercase">CIPHERTEXT STORE</span>
                      u3G9rL+P8zK...
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Steps interactive selector */}
            <div className="grid grid-cols-4 gap-1.5 border-t border-neutral-100 pt-3">
              {steps.map((step, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`font-mono text-[9px] text-center py-1 border transition-colors ${
                    activeStep === idx 
                      ? 'bg-neutral-900 text-white border-neutral-900 font-bold' 
                      : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                  }`}
                >
                  STEP 0{idx + 1}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Core Tech Pillars Grid */}
        <section id="architecture" className="border-t border-neutral-200 pt-16 flex flex-col gap-12">
          <div className="flex flex-col gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">ARCHITECTURAL LOG</span>
            <h2 className="font-mono text-2xl font-bold uppercase tracking-wider">
              ZERO-KNOWLEDGE SECURITY MODEL
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="border border-neutral-200 p-6 flex flex-col gap-4 bg-white">
              <Shield className="w-5 h-5 text-neutral-900" />
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
                AES-256-GCM Encryption
              </h3>
              <p className="text-neutral-600 text-xs leading-relaxed">
                All uploaded content, file chunks, comment threads, and metadata are encrypted on-device. The server never receives raw keys or plaintext payloads.
              </p>
            </div>

            <div className="border border-neutral-200 p-6 flex flex-col gap-4 bg-white">
              <Key className="w-5 h-5 text-neutral-900" />
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
                Argon2id Key Derivation
              </h3>
              <p className="text-neutral-600 text-xs leading-relaxed">
                If password-protected, encryption keys are derived client-side via memory-hard Argon2id KDF. Passwords are never sent to the network.
              </p>
            </div>

            <div className="border border-neutral-200 p-6 flex flex-col gap-4 bg-white">
              <EyeOff className="w-5 h-5 text-neutral-900" />
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
                Opaque Share IDs
              </h3>
              <p className="text-neutral-600 text-xs leading-relaxed">
                VaultDrop uses opaque capability IDs in URLs rather than placing raw encryption keys in the fragment, resolving URL-as-key leaks.
              </p>
            </div>

            <div className="border border-neutral-200 p-6 flex flex-col gap-4 bg-white">
              <Network className="w-5 h-5 text-neutral-900" />
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider">
                M-of-N Cryptography
              </h3>
              <p className="text-neutral-600 text-xs leading-relaxed">
                Supports threshold policies based on Shamir Secret Sharing. Secrets are split among multiple trustees. Single keys cannot decrypt the vault.
              </p>
            </div>

          </div>
        </section>

      </main>

      {/* 4. Footer */}
      <footer className="relative z-10 border-t border-neutral-200 py-8 bg-white/95 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest">
            © 2026 VaultDrop Secure sharing. All mathematical properties guaranteed.
          </span>
          <div className="flex items-center gap-6">
            <Link href="/security" className="font-mono text-[9px] uppercase tracking-widest text-neutral-500 hover:text-neutral-900">
              Security Statement
            </Link>
            <span className="font-mono text-[9px] text-neutral-300">|</span>
            <Link href="https://github.com/PrivateBin/PrivateBin" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-widest text-neutral-500 hover:text-neutral-900">
              Reference
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
