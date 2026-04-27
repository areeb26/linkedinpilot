import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Zap } from 'lucide-react'

const TriggerNode = memo(({ data, selected }) => {
  return (
    <div className={`px-4 py-3 rounded-xl border bg-[#1e1e1e] shadow-2xl min-w-[180px] transition-all ${
      selected ? 'border-green-500 ring-2 ring-green-500/20' : 'border-white/10'
    }`}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/20">
          <Zap className="w-4 h-4 text-green-500" />
        </div>
        <div>
          <div className="text-xs font-medium text-green-500 uppercase tracking-wider">Start</div>
          <div className="text-sm font-bold text-white">{data.label || 'Lead Enrollment'}</div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-green-500 border-2 border-[#0f0f0f]"
      />
    </div>
  )
})
TriggerNode.displayName = 'TriggerNode'
export default TriggerNode
