'use client';

import { motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';

type PointerState = {
  x: number;
  y: number;
  visible: boolean;
  interactive: boolean;
};

const INTERACTIVE_SELECTOR = 'a, button, input, textarea, select, [role="button"]';
const SOUND_SELECTOR = 'a, button, [role="button"]';

export default function InteractionShell({ children }: { children: React.ReactNode }) {
  const [pointer, setPointer] = useState<PointerState>({ x: 0, y: 0, visible: false, interactive: false });
  const pointerRef = useRef(pointer);
  const hoverSound = useRef<HTMLAudioElement | null>(null);
  const selectSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(pointer: fine)');
    hoverSound.current = new Audio('/sounds/hover.mp3');
    selectSound.current = new Audio('/sounds/select.mp3');
    hoverSound.current.volume = 0.28;
    selectSound.current.volume = 0.36;

    const play = (sound: HTMLAudioElement | null) => {
      if (!sound) return;
      sound.currentTime = 0;
      void sound.play().catch(() => undefined);
    };

    const setCustomCursor = () => document.documentElement.classList.toggle('vaultdrop-cursor-enabled', media.matches);

    const handleMove = (event: PointerEvent) => {
      if (!media.matches) return;
      const target = event.target as HTMLElement | null;
      const nextPointer = {
        x: event.clientX,
        y: event.clientY,
        visible: true,
        interactive: Boolean(target?.closest(INTERACTIVE_SELECTOR)),
      };
      pointerRef.current = nextPointer;
      setPointer(nextPointer);
    };

    const handleHover = (event: PointerEvent) => {
      if (!media.matches) return;
      const control = (event.target as HTMLElement | null)?.closest<HTMLElement>(SOUND_SELECTOR);
      const previousControl = (event.relatedTarget as HTMLElement | null)?.closest<HTMLElement>(SOUND_SELECTOR);
      if (!control || control === previousControl || control.matches(':disabled')) return;
      play(hoverSound.current);
    };

    const handleSelect = (event: PointerEvent) => {
      const control = (event.target as HTMLElement | null)?.closest<HTMLElement>(SOUND_SELECTOR);
      if (control && !control.matches(':disabled')) play(selectSound.current);
    };

    const handleLeave = () => {
      pointerRef.current = { ...pointerRef.current, visible: false };
      setPointer(pointerRef.current);
    };

    setCustomCursor();
    window.addEventListener('pointermove', handleMove, { passive: true });
    document.addEventListener('pointerover', handleHover, { passive: true });
    document.addEventListener('pointerdown', handleSelect, { passive: true });
    document.documentElement.addEventListener('mouseleave', handleLeave);
    media.addEventListener('change', setCustomCursor);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerover', handleHover);
      document.removeEventListener('pointerdown', handleSelect);
      document.documentElement.removeEventListener('mouseleave', handleLeave);
      media.removeEventListener('change', setCustomCursor);
      document.documentElement.classList.remove('vaultdrop-cursor-enabled');
    };
  }, []);

  return (
    <div className="vaultdrop-shell">
      <div
        className="interactive-dot-field"
        style={{ '--pointer-x': `${pointer.x}px`, '--pointer-y': `${pointer.y}px` } as React.CSSProperties}
        aria-hidden="true"
      />
      <motion.div
        aria-hidden="true"
        className={`vault-cursor ${pointer.interactive ? 'vault-cursor--active' : ''}`}
        initial={false}
        animate={{ x: pointer.x, y: pointer.y, opacity: pointer.visible ? 1 : 0, scale: pointer.interactive ? 1.25 : 1 }}
        transition={{ type: 'spring', stiffness: 760, damping: 42, mass: 0.18 }}
      >
        <i /><i /><i /><i />
        <span className="vault-cursor__core" />
      </motion.div>
      <div className="vaultdrop-content">{children}</div>
    </div>
  );
}
