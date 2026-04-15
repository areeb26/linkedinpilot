import React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StepIndicator({ currentStep, steps }) {
  return (
    <div className="space-y-6">
      {steps.map((step, idx) => {
        const stepNumber = idx + 1
        const isActive = currentStep === stepNumber
        const isCompleted = currentStep > stepNumber

        return (
          <div key={idx} className="flex gap-4 relative group">
            {/* Step number/icon */}
            <div className="flex flex-col items-center shrink-0">
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all",
                isActive 
                  ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(124,58,237,0.3)]" 
                  : isCompleted 
                    ? "bg-green-500/10 text-green-500 border border-green-500/20"
                    : "bg-white/5 text-[#94a3b8]"
              )}>
                {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
              </div>
              {idx < steps.length - 1 && (
                <div className={cn(
                  "w-[1px] h-10 mt-2 bg-white/5",
                  isCompleted && "bg-green-500/20"
                )} />
              )}
            </div>

            {/* Step Text */}
            <div className="flex-1 pt-0.5">
              <h4 className={cn(
                "font-semibold text-sm transition-colors",
                isActive ? "text-white" : "text-[#94a3b8]"
              )}>
                {step.title}
              </h4>
              <p className={cn(
                "text-xs mt-0.5 transition-colors leading-tight",
                isActive ? "text-[#94a3b8]" : "text-[#94a3b8]/50"
              )}>
                {step.description}
              </p>
            </div>

            {/* Active Indicator Bar */}
            {isActive && (
              <div className="absolute -left-4 top-0 bottom-0 w-[3px] bg-purple-600 rounded-r-full" />
            )}
          </div>
        )
      })}
    </div>
  )
}
