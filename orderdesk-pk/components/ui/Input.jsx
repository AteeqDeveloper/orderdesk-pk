import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const Input = forwardRef(function Input({ className, error, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400",
        "focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600",
        error ? "border-red-400" : "border-ink-200",
        className
      )}
      {...props}
    />
  );
});

export default Input;
