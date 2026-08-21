import React from 'react';
import '../styles/globals.css';

export const metadata = {
  title: 'VaultDrop // Secure Zero-Knowledge Data Vaulting',
  description: 'Encrypt your text and files client-side before sharing. Privacy by mathematics, not promises.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-paper text-[#171717] antialiased">
        {children}
      </body>
    </html>
  );
}
