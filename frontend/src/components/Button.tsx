import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "link";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50",
  secondary:
    "border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50",
  ghost:
    "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50",
  link: "text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 p-0",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    const isLink = variant === "link";
    const baseStyles = isLink
      ? "font-medium transition-colors cursor-pointer disabled:cursor-default"
      : "rounded-lg font-medium transition-colors cursor-pointer disabled:cursor-default";

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={`${baseStyles} ${variantStyles[variant]} ${isLink ? "" : sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading ? "Loading…" : children}
      </button>
    );
  },
);

Button.displayName = "Button";
