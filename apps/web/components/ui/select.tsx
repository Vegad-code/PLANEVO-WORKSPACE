import * as React from "react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-11 w-full appearance-none rounded-lg border border-border bg-paper px-3 text-body text-ink outline-none focus:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function SelectField({
  label,
  className,
  labelClassName,
  children,
  ...props
}: SelectProps & {
  label: string;
  labelClassName?: string;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span
        className={cn(
          "mb-2 block text-label uppercase text-text-muted",
          labelClassName,
        )}
      >
        {label}
      </span>
      <Select {...props}>{children}</Select>
    </label>
  );
}
