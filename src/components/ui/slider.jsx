import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

/**
 * Slider — design system component
 *
 * Tokens:
 *   surface.raised (#04644a) → active range fill and thumb border
 *   color.border             → track background
 *   radius.sm (pill)         → track and thumb shape
 *   motion.instant (150ms)   → thumb hover scale
 */
const Slider = React.forwardRef(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    {/* Track */}
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-sm bg-[var(--color-border)]">
      {/* Filled range — surface.raised green */}
      <SliderPrimitive.Range className="absolute h-full bg-[var(--color-surface-raised)]" />
    </SliderPrimitive.Track>

    {/* Thumbs */}
    {[...Array(props.value?.length || 1)].map((_, i) => (
      <SliderPrimitive.Thumb
        key={i}
        className={cn(
          "block h-4 w-4 rounded-sm",                        // pill thumb
          "border-2 border-[var(--color-surface-raised)]",   // green border
          "bg-[var(--color-surface-muted)]",                 // white fill
          "shadow-elevation-1",
          "transition-transform duration-[150ms] ease-out-quart",
          "hover:scale-110 cursor-pointer",
          // Focus — always visible
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-base)]",
          "disabled:pointer-events-none disabled:opacity-40",
        )}
      />
    ))}
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
