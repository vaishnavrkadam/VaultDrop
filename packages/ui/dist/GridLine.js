"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridLine = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
const GridLine = ({ className, orientation = 'horizontal', ...props }) => {
    return ((0, jsx_runtime_1.jsx)("div", { className: (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)("bg-neutral-200 dark:bg-neutral-800", {
            "h-[1px] w-full": orientation === 'horizontal',
            "w-[1px] h-full": orientation === 'vertical',
        }), className), ...props }));
};
exports.GridLine = GridLine;
exports.GridLine.displayName = 'GridLine';
