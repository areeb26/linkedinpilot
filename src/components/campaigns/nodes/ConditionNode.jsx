import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { GitBranch, Check, X } from 'lucide-react'

export default memo(({ data, selected }) => {
  return (
    <div className={`px-4 py-3 rounded-xl border bg-[#1e1e1e] shadow-2xl min-w-[180px] transition-all ${
      selected ? 'border-yellow-500 ring-2 ring-yellow-500/20' : 'border-white/10'
    }`}>
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-yellow-500 border-2 border-[#0f0f0f]"
      />
      
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
          <GitBranch className="w-4 h-4 text-yellow-500" />
        </div>
        <div>
          <div className="text-xs font-medium text-yellow-500 uppercase tracking-wider">Condition</div>
          <div className="text-sm font-bold text-white capitalize">{data.conditionType || 'If Accepted'}</div>
        </div>
      </div>

      <div className="flex justify-between mt-4">
        <div className="flex flex-col items-center gap-1">
          <Check className="w-3 h-3 text-green-500" />
          <Handle
            type="source"
            id="true"
            position={Position.Bottom}
            className="w-3 h-3 !bg-green-500 border-2 border-[#0f0f0f] relative !left-0 !transform-none"
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <X className="w-3 h-3 text-red-500" />
          <Handle
            type="source"
            id="false"
            position={Position.Bottom}
            className="w-3 h-3 !bg-red-500 border-2 border-[#0f0f0f] relative !left-0 !transform-none"
          />
        </div>
      </div>
    </div>
  )
})
