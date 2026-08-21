import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface GridLineProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export const GridLine: React.FC<GridLineProps> = ({ className, orientation = 'horizontal', ...props }) => {
  return (
    <div
      className={twMerge(
        clsx("bg-neutral-200 dark:bg-neutral-800", {
          "h-[1px] w-full": orientation === 'horizontal',
          "w-[1px] h-full": orientation === 'vertical',
        }),
        className
      )}
      {...props}
    />
  );
};
GridLine.displayName = 'GridLine';
