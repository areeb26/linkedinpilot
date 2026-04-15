import React, { useState, useCallback, useEffect, useMemo } from 'react'
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  applyEdgeChanges, 
  applyNodeChanges,
  MarkerType
} from 'reactflow'
import 'reactflow/dist/style.css'

import { useParams, useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ChevronLeft, Save, Rocket, Plus, Trash2, Info, AlertCircle } from 'lucide-react'
import { useCampaign, useCreateCampaign, useUpdateCampaign, useLaunchCampaign } from '@/hooks/useCampaigns'
import { useLinkedInAccounts } from '@/hooks/useLinkedInAccounts'
import { toast } from 'react-hot-toast'

// Custom Nodes
import TriggerNode from '@/components/campaigns/nodes/TriggerNode'
import ActionNode from '@/components/campaigns/nodes/ActionNode'
import ConditionNode from '@/components/campaigns/nodes/ConditionNode'
import EndNode from '@/components/campaigns/nodes/EndNode'

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  end: EndNode,
}

const TEMPLATES = {
  basic: {
    nodes: [
      { id: '1', type: 'trigger', position: { x: 250, y: 0 }, data: { label: 'LinkedIn Enrollment' } },
      { id: '2', type: 'action', position: { x: 250, y: 150 }, data: { actionType: 'connect', delay: 0 } },
      { id: '3', type: 'action', position: { x: 250, y: 300 }, data: { actionType: 'message', delay: 24, message: 'Hi {{first_name}}, thanks for connecting!' } },
      { id: '4', type: 'end', position: { x: 250, y: 450 }, data: { label: 'Done' } },
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2', markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },
      { id: 'e2-3', source: '2', target: '3', markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },
      { id: 'e3-4', source: '3', target: '4', markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },
    ]
  },
  nurture: {
    nodes: [
      { id: '1', type: 'trigger', position: { x: 250, y: 0 }, data: { label: 'Existing Connections' } },
      { id: '2', type: 'action', position: { x: 250, y: 150 }, data: { actionType: 'view_profile', delay: 0 } },
      { id: '3', type: 'action', position: { x: 250, y: 300 }, data: { actionType: 'message', delay: 48, message: 'Hey {{first_name}}, noticed your recent post!' } },
      { id: '4', type: 'end', position: { x: 250, y: 450 }, data: { label: 'Nurture Complete' } },
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
      { id: 'e3-4', source: '3', target: '4' },
    ]
  }
}

export default function CampaignBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  
  const { data: campaign, isLoading } = useCampaign(id)
  const { data: accounts = [] } = useLinkedInAccounts()
  
  const createMutation = useCreateCampaign()
  const updateMutation = useUpdateCampaign()
  const launchMutation = useLaunchCampaign()

  // Campaign Meta State
  const [name, setName] = useState('')
  const [type, setType] = useState('outreach')
  const [accountId, setAccountId] = useState('')
  const [dailyLimit, setDailyLimit] = useState(20)

  // React Flow State
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)

  useEffect(() => {
    if (campaign) {
      setName(campaign.name || '')
      setType(campaign.type || 'outreach')
      setAccountId(campaign.linkedin_account_id || '')
      setDailyLimit(campaign.daily_limit || 20)
      
      if (campaign.sequence_json) {
        setNodes(campaign.sequence_json.nodes || [])
        setEdges(campaign.sequence_json.edges || [])
      }
    } else if (isNew) {
      // Default Template
      setNodes(TEMPLATES.basic.nodes)
      setEdges(TEMPLATES.basic.edges)
      setName('New Outreach Campaign')
    }
  }, [campaign, isNew])

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } }, eds)),
    []
  )

  const onNodeClick = (_, node) => setSelectedNode(node)
  const onPaneClick = () => setSelectedNode(null)

  const updateNodeData = (nodeId, newData) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } }
        }
        return node
      })
    )
    setSelectedNode(prev => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...newData } } : prev)
  }

  const addNode = (type) => {
    const id = `${type}-${Date.now()}`
    const newNode = {
      id,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { label: `New ${type}`, actionType: 'message', delay: 24 }
    }
    setNodes((nds) => nds.concat(newNode))
  }

  const deleteNode = (id) => {
    setNodes((nds) => nds.filter(n => n.id !== id))
    setEdges((eds) => eds.filter(e => e.source !== id && e.target !== id))
    setSelectedNode(null)
  }

  const validateSequence = () => {
    const hasTrigger = nodes.some(n => n.type === 'trigger')
    const hasEnd = nodes.some(n => n.type === 'end')
    const hasAccountId = !!accountId
    
    if (!hasTrigger) return { valid: false, message: 'Sequence must have a Start node.' }
    if (!hasEnd) return { valid: false, message: 'Sequence must have an End node.' }
    if (!hasAccountId) return { valid: false, message: 'Please select a LinkedIn account.' }
    
    return { valid: true }
  }

  const handleSave = async (isLaunch = false) => {
    const val = validateSequence()
    if (isLaunch && !val.valid) {
      toast.error(val.message)
      return
    }

    const payload = {
      name,
      type,
      linkedin_account_id: accountId,
      daily_limit: dailyLimit,
      sequence_json: { nodes, edges },
      status: isLaunch ? 'active' : (campaign?.status || 'draft')
    }

    if (isNew) {
      const result = await createMutation.mutateAsync(payload)
      navigate(`/campaigns/${result.id}`)
    } else {
      await updateMutation.mutateAsync({ id, ...payload })
    }
  }

  if (isLoading && !isNew) return <div className="p-8 text-white">Loading builder...</div>

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/campaigns')} className="text-[#94a3b8] hover:text-white">
            <ChevronLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="h-4 w-px bg-white/10" />
          <h1 className="text-xl font-bold text-white uppercase tracking-tight">{name}</h1>
          <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest border-white/5 py-0">
            {isNew ? 'New Campaign' : campaign?.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-white/5 bg-white/5 text-white hover:bg-white/10" onClick={() => handleSave(false)}>
            <Save className="w-4 h-4 mr-2" /> Save Draft
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-500 text-white border-none px-6" onClick={() => handleSave(true)}>
            <Rocket className="w-4 h-4 mr-2" /> Launch Campaign
          </Button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Panel: Settings */}
        <Card className="w-80 bg-[#1e1e1e] border-white/5 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" /> Settings
            </h3>
          </div>
          <div className="p-4 space-y-6 overflow-y-auto">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-[#94a3b8] tracking-widest">Campaign Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white/5 border-white/5 text-white" />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-[#94a3b8] tracking-widest">Target Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="bg-white/5 border-white/5 text-white">
                  <SelectValue placeholder="Select Account" />
                </SelectTrigger>
                <SelectContent className="bg-[#1e1e1e] border-white/10 text-white">
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-[#94a3b8] tracking-widest">Daily Limit</Label>
              <Input type="number" value={dailyLimit} onChange={(e) => setDailyLimit(parseInt(e.target.value))} className="bg-white/5 border-white/5 text-white" />
            </div>

            <Separator className="bg-white/5" />

            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-bold text-[#94a3b8] tracking-widest">Step Library</Label>
              <div className="grid grid-cols-1 gap-2">
                <StepButton icon={Plus} label="Action Step" onClick={() => addNode('action')} color="blue" />
                <StepButton icon={Plus} label="Condition" onClick={() => addNode('condition')} color="yellow" />
                <StepButton icon={Plus} label="End Point" onClick={() => addNode('end')} color="red" />
              </div>
            </div>
            
            <div className="mt-8 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <div className="flex gap-2 text-blue-400 mb-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Pro Tip</span>
              </div>
              <p className="text-[11px] text-[#94a3b8] leading-relaxed">
                Connect nodes by dragging from their bottom handles to another node's top handle. 
              </p>
            </div>
          </div>
        </Card>

        {/* Center Canvas */}
        <div className="flex-1 bg-[#161616] rounded-xl border border-white/5 overflow-hidden relative group">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
          >
            <Background color="#333" gap={20} />
            <Controls className="bg-[#1e1e1e] border-white/10 fill-white" />
          </ReactFlow>
        </div>

        {/* Right Panel: Node Editor */}
        <Card className={`w-80 bg-[#1e1e1e] border-white/5 flex flex-col overflow-hidden transition-all ${selectedNode ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
          {selectedNode && (
            <>
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Edit Node</h3>
                <Button variant="ghost" size="sm" onClick={() => deleteNode(selectedNode.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10 h-8 w-8 p-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-4 space-y-6">
                {selectedNode.type === 'action' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-[#94a3b8] tracking-widest">Action Type</Label>
                      <Select value={selectedNode.data.actionType} onValueChange={(v) => updateNodeData(selectedNode.id, { actionType: v })}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1e1e1e] border-white/10 text-white">
                          <SelectItem value="connect">Send Connection</SelectItem>
                          <SelectItem value="message">Send Message</SelectItem>
                          <SelectItem value="view_profile">View Profile</SelectItem>
                          <SelectItem value="inmail">Send InMail</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-[#94a3b8] tracking-widest">Wait Time (Hours)</Label>
                      <Input type="number" value={selectedNode.data.delay} onChange={(e) => updateNodeData(selectedNode.id, { delay: parseInt(e.target.value) })} className="bg-white/5 border-white/10 text-white" />
                    </div>

                    {(selectedNode.data.actionType === 'message' || selectedNode.data.actionType === 'connect' || selectedNode.data.actionType === 'inmail') && (
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-[#94a3b8] tracking-widest">Message Body</Label>
                        <textarea 
                          value={selectedNode.data.message || ''} 
                          onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                          placeholder="Hey {{first_name}}, ..."
                          className="w-full h-40 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <p className="text-[9px] text-[#555] font-bold uppercase tracking-tighter">Variables: {"{{first_name}}"}, {"{{company}}"}</p>
                      </div>
                    )}
                  </>
                )}

                {selectedNode.type === 'condition' && (
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-[#94a3b8] tracking-widest">Check Condition</Label>
                    <Select value={selectedNode.data.conditionType} onValueChange={(v) => updateNodeData(selectedNode.id, { conditionType: v })}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1e1e1e] border-white/10 text-white">
                        <SelectItem value="if_accepted">If Connection Accepted</SelectItem>
                        <SelectItem value="if_replied">If Replied</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedNode.type === 'trigger' && (
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-[#94a3b8] tracking-widest">Trigger Label</Label>
                    <Input value={selectedNode.data.label} onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })} className="bg-white/5 border-white/10 text-white" />
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

function StepButton({ icon: Icon, label, onClick, color }) {
  const colors = {
    blue: 'hover:bg-blue-500/10 border-blue-500/10 text-blue-400',
    yellow: 'hover:bg-yellow-500/10 border-yellow-500/10 text-yellow-400',
    red: 'hover:bg-red-500/10 border-red-500/10 text-red-400',
  }
  return (
    <Button 
      variant="outline" 
      onClick={onClick}
      className={`w-full justify-start gap-3 bg-white/5 border-white/5 text-xs font-bold uppercase tracking-widest h-12 ${colors[color]}`}
    >
      <div className={`p-1.5 rounded-lg bg-current/10 overflow-hidden`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      {label}
    </Button>
  )
}

function Badge({ children, variant, className }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${className}`}>
      {children}
    </span>
  )
}
