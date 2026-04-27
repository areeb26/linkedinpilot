import React, { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Link2, Trash2 } from 'lucide-react'

const LABELS = {
  if_connected:  { title: 'If Connected',  yes: 'Yes', no: 'No'           },
  if_accepted:   { title: 'If Accepted',   yes: 'Yes', no: 'No'           },
  if_replied:    { title: 'If Replied',    yes: 'Replied', no: 'Not Replied' },
}

const ConditionNode = memo(({ data, selected }) => {
  const cfg = LABELS[data.conditionType] || { title: data.conditionType || 'Condition', yes: 'Yes', no: 'No' }
  const { onDelete } = data

  return (
    <div className={`relative group px-4 py-3 rounded-xl border bg-[#1e1e1e] shadow-2xl min-w-[180px] transition-all ${selected ? 'border-yellow-500 ring-2 ring-yellow-500/20' : 'border-white/10'}`}>
      {onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#1e1e1e] border border-white/20 text-red-400 hover:text-red-300 hover:border-red-400/50 items-center justify-center hidden group-hover:flex transition-all z-10">
          <Trash2 className="w-3 h-3" />
        </button>
      )}
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-yellow-500 border-2 border-[#0f0f0f]" />

      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
          <Link2 className="w-4 h-4 text-yellow-500" />
        </div>
        <div>
          <div className="text-xs font-medium text-yellow-500 uppercase tracking-wider">Condition</div>
          <div className="text-sm font-bold text-white">{cfg.title}</div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-white/5 flex justify-between px-1">
        <span className="text-[9px] text-red-400 font-semibold">{cfg.no}</span>
        <span className="text-[9px] text-green-400 font-semibold">{cfg.yes}</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: '25%' }} className="w-3 h-3 !bg-red-500   border-2 border-[#0f0f0f]" />
      <Handle type="source" position={Position.Bottom} id="true"  style={{ left: '75%' }} className="w-3 h-3 !bg-green-500 border-2 border-[#0f0f0f]" />
    </div>
  )
})

ConditionNode.displayName = 'ConditionNode'
export default ConditionNode
