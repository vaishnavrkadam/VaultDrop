import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          className={twMerge(
            clsx(
              "w-full bg-transparent border-b border-neutral-300 py-2 px-1 text-sm font-sans focus:outline-none focus:border-neutral-900 transition-colors duration-150 placeholder-neutral-400",
              {
                "font-mono": type === 'password' || props.name === 'shareId' || props.name === 'key',
                "border-red-500 focus:border-red-500": error,
              }
            ),
            className
          )}
          {...props}
        />
        {error && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-red-600">
            {error}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
