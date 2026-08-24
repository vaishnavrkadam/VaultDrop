'use client';

import React from 'react';
import Link from 'next/link';
import { GridLine } from '@vaultdrop/ui';
import { Shield, Key, Lock, EyeOff, FileText, Database, ShieldCheck } from 'lucide-react';

export default function SecurityPage() {
  return (
    <div className="min-h-screen relative flex flex-col justify-between text-[#171717]">
      
      {/* 1. Header Navigation */}
      <header className="relative z-10 border-b border-neutral-200/90 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="font-mono font-bold uppercase tracking-[0.25em] text-sm hover:opacity-80">
              [ VAULTDROP ]
            </Link>
            <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest hidden md:inline">
              // SECURITY STATEMENT v1.0.0
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/" className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-900 transition-colors">
              [ BACK TO MAIN ]
            </Link>
            <Link href="/app" className="font-mono text-[10px] uppercase tracking-wider text-neutral-900 font-bold hover:underline">
              [ LAUNCH APP ]
            </Link>
          </nav>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="relative z-10 flex-grow max-w-4xl w-full mx-auto px-6 py-12 flex flex-col gap-10">
        
        {/* Page Title */}
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">// ARCHITECTURAL VERIFICATION</span>
          <h1 className="font-mono text-3xl font-bold uppercase tracking-wider">SECURITY BRIEF & THREAT MODEL</h1>
          <GridLine className="mt-2" />
        </div>

        {/* Introduction */}
        <section className="border border-neutral-200 bg-white p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-green-600">
            <ShieldCheck className="w-5 h-5" />
            <span className="font-mono text-[11px] uppercase tracking-widest font-bold">Mathematical Trust Model</span>
          </div>
          <p className="text-neutral-600 text-sm leading-relaxed">
            VaultDrop treats the storage server as **untrusted infrastructure**. 
            Plaintext content, passwords, and decryption keys are processed in client memory and **never** cross the network boundary. 
            A compromise of the hosting server or database reveals nothing but encrypted blobs.
          </p>
        </section>

        {/* Cryptographic Details Section */}
        <section className="flex flex-col gap-6">
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest">// CRYPTOGRAPHIC SPECIFICATION</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Payload Encryption */}
            <div className="border border-neutral-200 bg-white p-6 flex flex-col gap-3">
              <Shield className="w-5 h-5 text-neutral-900" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest">1. Payload AES-256-GCM</h3>
              <p className="text-neutral-500 text-xs leading-relaxed">
                Vault content and files are encrypted in-browser using Web Crypto's AES-GCM-256. 
                Each share generates a unique 12-byte random initialization vector (IV) and outputs a 16-byte authentication tag to guarantee integrity.
              </p>
            </div>

            {/* Password Derivation */}
            <div className="border border-neutral-200 bg-white p-6 flex flex-col gap-3">
              <Key className="w-5 h-5 text-neutral-900" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest">2. Password Argon2id</h3>
              <p className="text-neutral-500 text-xs leading-relaxed">
                Passphrases derive keys using the memory-hard **Argon2id** algorithm (WASM-based, 3 iterations, 16MB memory cost). 
                The derived key wraps the master key client-side, ensuring offline brute-force protection.
              </p>
            </div>

            {/* Threshold Escrow */}
            <div className="border border-neutral-200 bg-white p-6 flex flex-col gap-3">
              <Lock className="w-5 h-5 text-neutral-900" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest">3. M-of-N Shamir SSS</h3>
              <p className="text-neutral-500 text-xs leading-relaxed">
                For threshold shares, the Content Encryption Key is divided using Shamir's Secret Sharing. 
                The database lobby collects shares but cannot reconstruct the key without at least $M$ authenticated members.
              </p>
            </div>

            {/* Key Derivation (HKDF) */}
            <div className="border border-neutral-200 bg-white p-6 flex flex-col gap-3">
              <EyeOff className="w-5 h-5 text-neutral-900" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest">4. Domain Separation (HKDF)</h3>
              <p className="text-neutral-500 text-xs leading-relaxed">
                VaultDrop uses HMAC-based Key Derivation (HKDF-SHA-256) to derive separate keys for file metadata encryption and comment discussion threads, separating security contexts.
              </p>
            </div>

          </div>
        </section>

        {/* Threat Mitigation Table */}
        <section className="flex flex-col gap-4">
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest">// THREAT MITIGATION MATRIX</h2>
          <div className="overflow-x-auto border border-neutral-200 bg-white">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="p-3 uppercase tracking-wider font-bold">Threat Scenario</th>
                  <th className="p-3 uppercase tracking-wider font-bold">Mitigation Strategy</th>
                  <th className="p-3 uppercase tracking-wider font-bold">Security Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                <tr>
                  <td className="p-3 font-semibold">Server Database Leak</td>
                  <td className="p-3 text-neutral-600">All text/files are encrypted. Database holds only ciphertext and metadata.</td>
                  <td className="p-3 text-green-600 font-bold">PREVENTED</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold">Eavesdropping on Escrow Lobby</td>
                  <td className="p-3 text-neutral-600">Requesters must verify they own a valid participant share before downloading other lobby shares.</td>
                  <td className="p-3 text-green-600 font-bold">PREVENTED</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold">URL Eavesdropping (Hash Key)</td>
                  <td className="p-3 text-neutral-600">The key is in the hash fragment (`#key=...`), which is never sent to the network or server.</td>
                  <td className="p-3 text-green-600 font-bold">PREVENTED</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold">Brute-Force Attack on Password</td>
                  <td className="p-3 text-neutral-600">Argon2id KDF makes key derivation slow and computationally expensive for attackers.</td>
                  <td className="p-3 text-neutral-600 font-bold">MITIGATED</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold">Data Residual After Delete</td>
                  <td className="p-3 text-neutral-600">SQLite/Postgres execute cascading deletes, immediately purging comments and escrow shares.</td>
                  <td className="p-3 text-green-600 font-bold">PREVENTED</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* 3. Footer */}
      <footer className="relative z-10 border-t border-neutral-200 py-8 bg-white/95">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-widest">
            © 2026 VaultDrop Secure sharing. All mathematical properties guaranteed.
          </span>
          <div className="flex items-center gap-6">
            <Link href="/" className="font-mono text-[9px] uppercase tracking-widest text-neutral-500 hover:text-neutral-900">
              [ RETURN TO MAIN ]
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
