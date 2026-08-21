import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={twMerge(
          clsx(
            "font-mono uppercase tracking-wider transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-neutral-400 disabled:opacity-50 disabled:pointer-events-none",
            {
              "bg-[#171717] text-[#FCFCFC] border border-[#171717] hover:bg-neutral-800": variant === 'primary',
              "bg-transparent text-[#171717] border border-[#171717] hover:bg-[#171717] hover:text-[#FCFCFC]": variant === 'secondary',
              "bg-transparent text-[#DC2626] border border-[#DC2626] hover:bg-[#DC2626] hover:text-[#FCFCFC]": variant === 'danger',
              "px-3 py-1 text-xs": size === 'sm',
              "px-6 py-2.5 text-sm": size === 'md',
              "px-8 py-4 text-base": size === 'lg',
            }
          ),
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
