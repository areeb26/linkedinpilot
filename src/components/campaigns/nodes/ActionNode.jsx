import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Send, UserPlus, Eye, MessageSquare, Clock, UserMinus, Trash2 } from 'lucide-react'

const CONFIG = {
  connect:      { icon: UserPlus,      border: 'border-blue-500',   ring: 'ring-blue-500/20',   bg: 'bg-blue-500/10',   iconBorder: 'border-blue-500/20',   text: 'text-blue-500',   handle: '!bg-blue-500'   },
  message:      { icon: Send,          border: 'border-purple-500', ring: 'ring-purple-500/20', bg: 'bg-purple-500/10', iconBorder: 'border-purple-500/20', text: 'text-purple-500', handle: '!bg-purple-500' },
  inmail:       { icon: MessageSquare, border: 'border-cyan-500',   ring: 'ring-cyan-500/20',   bg: 'bg-cyan-500/10',   iconBorder: 'border-cyan-500/20',   text: 'text-cyan-500',   handle: '!bg-cyan-500'   },
  view_profile: { icon: Eye,           border: 'border-slate-500',  ring: 'ring-slate-500/20',  bg: 'bg-slate-500/10',  iconBorder: 'border-slate-500/20',  text: 'text-slate-400',  handle: '!bg-slate-500'  },
  withdraw:     { icon: UserMinus,     border: 'border-orange-500', ring: 'ring-orange-500/20', bg: 'bg-orange-500/10', iconBorder: 'border-orange-500/20', text: 'text-orange-500', handle: '!bg-orange-500' },
}

const DUAL = {
  connect: { left: { id: 'accepted',    label: 'Accepted',    cls: '!bg-green-500'  }, right: { id: 'not_accepted', label: 'Not Accepted', cls: '!bg-orange-500' } },
  message: { left: { id: 'replied',     label: 'Replied',     cls: '!bg-green-500'  }, right: { id: 'not_replied',  label: 'Not Replied',  cls: '!bg-orange-500' } },
}

function formatDelay(hours) {
  if (!hours) return null
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

const DeleteBtn = ({ onDelete }) => onDelete ? (
  <button
    onClick={(e) => { e.stopPropagation(); onDelete() }}
    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#1e1e1e] border border-white/20 text-red-400 hover:text-red-300 hover:border-red-400/50 items-center justify-center hidden group-hover:flex transition-all z-10"
  >
    <Trash2 className="w-3 h-3" />
  </button>
) : null

const ActionNode = memo(({ data, selected }) => {
  const { actionType = 'message', onDelete } = data
  const delay = formatDelay(data.delay)
  const dual = DUAL[actionType]

  if (actionType === 'wait') {
    return (
      <div className={`relative group px-4 py-3 rounded-xl border bg-[#1e1e1e] shadow-2xl min-w-[140px] transition-all ${selected ? 'border-slate-400 ring-2 ring-slate-400/20' : 'border-white/10'}`}>
        <DeleteBtn onDelete={onDelete} />
        <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-slate-400 border-2 border-[#0f0f0f]" />
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-bold text-white">Wait {delay || '...'}</span>
        </div>
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-slate-400 border-2 border-[#0f0f0f]" />
      </div>
    )
  }

  const cc = CONFIG[actionType] || CONFIG.message
  const Icon = cc.icon

  return (
    <div className={`relative group px-4 py-3 rounded-xl border bg-[#1e1e1e] shadow-2xl min-w-[200px] transition-all ${selected ? `${cc.border} ring-2 ${cc.ring}` : 'border-white/10'}`}>
      <DeleteBtn onDelete={onDelete} />
      <Handle type="target" position={Position.Top} className={`w-3 h-3 ${cc.handle} border-2 border-[#0f0f0f]`} />

      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${cc.bg} flex items-center justify-center border ${cc.iconBorder}`}>
          <Icon className={`w-4 h-4 ${cc.text}`} />
        </div>
        <div>
          <div className={`text-xs font-medium ${cc.text} uppercase tracking-wider`}>Action</div>
          <div className="text-sm font-bold text-white capitalize">{actionType.replace(/_/g, ' ')}</div>
        </div>
      </div>

      {delay && !dual && (
        <div className="mt-2 flex items-center gap-1 text-[#94a3b8]">
          <Clock className="w-3 h-3" />
          <span className="text-[10px] font-medium uppercase">Delay: {delay}</span>
        </div>
      )}

      {dual && (
        <>
          <div className="mt-3 pt-2 border-t border-white/5 flex justify-between px-1">
            <span className="text-[9px] text-green-400 font-semibold">{dual.left.label}</span>
            <span className="text-[9px] text-orange-400 font-semibold">{dual.right.label}</span>
          </div>
          <Handle type="source" position={Position.Bottom} id={dual.left.id}  style={{ left: '25%' }} className={`w-3 h-3 ${dual.left.cls}  border-2 border-[#0f0f0f]`} />
          <Handle type="source" position={Position.Bottom} id={dual.right.id} style={{ left: '75%' }} className={`w-3 h-3 ${dual.right.cls} border-2 border-[#0f0f0f]`} />
        </>
      )}

      {!dual && (
        <Handle type="source" position={Position.Bottom} className={`w-3 h-3 ${cc.handle} border-2 border-[#0f0f0f]`} />
      )}
    </div>
  )
})

ActionNode.displayName = 'ActionNode'
export default ActionNode
