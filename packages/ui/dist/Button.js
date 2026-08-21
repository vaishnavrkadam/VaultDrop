"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Button = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importDefault(require("react"));
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
exports.Button = react_1.default.forwardRef(({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return ((0, jsx_runtime_1.jsx)("button", { ref: ref, className: (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)("font-mono uppercase tracking-wider transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-neutral-400 disabled:opacity-50 disabled:pointer-events-none", {
            "bg-[#171717] text-[#FCFCFC] border border-[#171717] hover:bg-neutral-800": variant === 'primary',
            "bg-transparent text-[#171717] border border-[#171717] hover:bg-[#171717] hover:text-[#FCFCFC]": variant === 'secondary',
            "bg-transparent text-[#DC2626] border border-[#DC2626] hover:bg-[#DC2626] hover:text-[#FCFCFC]": variant === 'danger',
            "px-3 py-1 text-xs": size === 'sm',
            "px-6 py-2.5 text-sm": size === 'md',
            "px-8 py-4 text-base": size === 'lg',
        }), className), ...props, children: children }));
});
exports.Button.displayName = 'Button';
