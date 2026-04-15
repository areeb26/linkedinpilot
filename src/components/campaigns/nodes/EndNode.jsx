import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { LogOut } from 'lucide-react'

export default memo(({ data, selected }) => {
  return (
    <div className={`px-4 py-3 rounded-xl border bg-[#1e1e1e] shadow-2xl min-w-[150px] transition-all ${
      selected ? 'border-red-500 ring-2 ring-red-500/20' : 'border-white/10'
    }`}>
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-red-500 border-2 border-[#0f0f0f]"
      />
      
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <LogOut className="w-4 h-4 text-red-500" />
        </div>
        <div>
          <div className="text-xs font-medium text-red-500 uppercase tracking-wider">Finish</div>
          <div className="text-sm font-bold text-white">{data.label || 'End Sequence'}</div>
        </div>
      </div>
    </div>
  )
})
