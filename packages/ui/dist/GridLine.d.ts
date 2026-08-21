import React from 'react';
export interface GridLineProps extends React.HTMLAttributes<HTMLDivElement> {
    orientation?: 'horizontal' | 'vertical';
}
export declare const GridLine: React.FC<GridLineProps>;
