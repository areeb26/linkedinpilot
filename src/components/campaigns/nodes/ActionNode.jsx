import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Send, UserPlus, Eye, MessageSquare, Clock } from 'lucide-react'

const icons = {
  connect: UserPlus,
  message: Send,
  inmail: MessageSquare,
  view_profile: Eye,
}

export default memo(({ data, selected }) => {
  const Icon = icons[data.actionType] || Send
  
  return (
    <div className={`px-4 py-3 rounded-xl border bg-[#1e1e1e] shadow-2xl min-w-[200px] transition-all ${
      selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-white/10'
    }`}>
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-blue-500 border-2 border-[#0f0f0f]"
      />
      
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
          <Icon className="w-4 h-4 text-blue-500" />
        </div>
        <div>
          <div className="text-xs font-medium text-blue-500 uppercase tracking-wider">Action</div>
          <div className="text-sm font-bold text-white capitalize">{data.actionType?.replace('_', ' ') || 'Send Message'}</div>
        </div>
      </div>

      {data.delay && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-[#94a3b8]">
          <Clock className="w-3 h-3" />
          <span className="text-[10px] font-medium uppercase tracking-tight">Delay: {data.delay}h</span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-blue-500 border-2 border-[#0f0f0f]"
      />
    </div>
  )
})
