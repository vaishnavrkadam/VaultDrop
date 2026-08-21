"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Input = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importDefault(require("react"));
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
exports.Input = react_1.default.forwardRef(({ className, label, error, type = 'text', ...props }, ref) => {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "w-full flex flex-col gap-1.5", children: [label && ((0, jsx_runtime_1.jsx)("label", { className: "font-mono text-[10px] uppercase tracking-widest text-neutral-500", children: label })), (0, jsx_runtime_1.jsx)("input", { ref: ref, type: type, className: (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)("w-full bg-transparent border-b border-neutral-300 py-2 px-1 text-sm font-sans focus:outline-none focus:border-neutral-900 transition-colors duration-150 placeholder-neutral-400", {
                    "font-mono": type === 'password' || props.name === 'shareId' || props.name === 'key',
                    "border-red-500 focus:border-red-500": error,
                }), className), ...props }), error && ((0, jsx_runtime_1.jsx)("span", { className: "font-mono text-[10px] uppercase tracking-wider text-red-600", children: error }))] }));
});
exports.Input.displayName = 'Input';
