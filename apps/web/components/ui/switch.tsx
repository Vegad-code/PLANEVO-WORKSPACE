"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/**
 * Shared toggle — shadcn/Radix Switch with Apple press-stretch thumb motion.
 * Colors stay on Planevo tokens; only travel/press animation is iOS-like.
 */
const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, onPointerDown, onPointerUp, onPointerLeave, onPointerCancel, ...props }, ref) => {
  const [pressed, setPressed] = React.useState(false);

  return (
    <SwitchPrimitives.Root
      ref={ref}
      data-slot="switch"
      {...props}
      data-pressed={pressed ? "true" : undefined}
      className={cn(
        "peer group/switch inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border-strong bg-border p-0.5 outline-none transition-colors",
        "data-[state=checked]:bg-ink",
        "focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "motion-reduce:transition-none",
        className,
      )}
      onPointerDown={(event) => {
        if (!event.defaultPrevented && !props.disabled) setPressed(true);
        onPointerDown?.(event);
      }}
      onPointerUp={(event) => {
        setPressed(false);
        onPointerUp?.(event);
      }}
      onPointerLeave={(event) => {
        setPressed(false);
        onPointerLeave?.(event);
      }}
      onPointerCancel={(event) => {
        setPressed(false);
        onPointerCancel?.(event);
      }}
    >
      <SwitchPrimitives.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-4 w-4 origin-center rounded-full bg-paper shadow-sm ring-0",
          "transition-[transform,width] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          "data-[state=unchecked]:translate-x-0",
          "data-[state=checked]:translate-x-6",
          "group-data-[pressed=true]/switch:w-5",
          "group-data-[pressed=true]/switch:data-[state=checked]:translate-x-5",
          "motion-reduce:transition-none",
        )}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
