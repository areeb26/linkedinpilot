import React, { useState, useCallback, useEffect } from 'react'
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  applyEdgeChanges, 
  applyNodeChanges,
  MarkerType
} from 'reactflow'
import 'reactflow/dist/style.css'

import { useWizard } from './WizardContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, Plus, Trash2, Info } from 'lucide-react'
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
      { id: 'e1-2', source: '1', target: '2', markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e2-3', source: '2', target: '3', markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e3-4', source: '3', target: '4', markerEnd: { type: MarkerType.ArrowClosed } },
    ]
  }
}

export function SequencesStep() {
  const { campaignData, updateCampaignData, nextStep, prevStep } = useWizard()
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)

  // Load from campaignData or use template
  useEffect(() => {
    if (campaignData.sequence?.nodes?.length > 0) {
      setNodes(campaignData.sequence.nodes)
      setEdges(campaignData.sequence.edges)
    } else {
      setNodes(TEMPLATES.basic.nodes)
      setEdges(TEMPLATES.basic.edges)
    }
  }, [])

  // Persist to campaignData when changed
  useEffect(() => {
    updateCampaignData({ sequence: { nodes, edges } })
  }, [nodes, edges])

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
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
      position: { x: 250, y: nodes.length * 150 + 50 },
      data: { label: `New ${type}`, actionType: 'message', delay: 24 }
    }
    setNodes((nds) => [...nds, newNode])
  }

  const deleteNode = (id) => {
    setNodes((nds) => nds.filter(n => n.id !== id))
    setEdges((eds) => eds.filter(e => e.source !== id && e.target !== id))
    setSelectedNode(null)
  }

  const validateSequence = () => {
    const hasTrigger = nodes.some(n => n.type === 'trigger')
    const hasEnd = nodes.some(n => n.type === 'end')
    
    if (!hasTrigger) return { valid: false, message: 'Sequence must have a Start node.' }
    if (!hasEnd) return { valid: false, message: 'Sequence must have an End node.' }
    
    return { valid: true }
  }

  const handleContinue = () => {
    const validation = validateSequence()
    if (!validation.valid) {
      toast.error(validation.message)
      return
    }
    nextStep()
  }

  return (
    <div className="h-[calc(100vh-300px)] flex flex-col gap-4">
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Panel: Step Library */}
        <Card className="w-64 bg-card border-border flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Info className="w-4 h-4" /> Step Library
            </h3>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-1 gap-2">
              <StepButton icon={Plus} label="Action Step" onClick={() => addNode('action')} />
              <StepButton icon={Plus} label="Condition" onClick={() => addNode('condition')} />
              <StepButton icon={Plus} label="End Point" onClick={() => addNode('end')} />
            </div>
          </div>
          <div className="p-4 border-t border-border mt-auto">
            <div className="p-3 rounded-lg bg-muted/50 border text-xs">
              <p className="leading-relaxed text-muted-foreground">
                Connect nodes by dragging from handles. Click nodes to edit.
              </p>
            </div>
          </div>
        </Card>

        {/* Center Canvas */}
        <div className="flex-1 bg-muted/30 rounded-xl border border-border overflow-hidden relative">
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
            <Background color="oklch(var(--muted-foreground))" gap={20} />
            <Controls />
          </ReactFlow>
        </div>

        {/* Right Panel: Node Editor */}
        <Card className={`w-64 bg-card border-border flex flex-col overflow-hidden transition-all ${selectedNode ? 'opacity-100' : 'opacity-50'}`}>
          {selectedNode ? (
            <>
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest">Edit Node</h3>
                <Button variant="ghost" size="sm" onClick={() => deleteNode(selectedNode.id)} className="text-destructive hover:text-destructive h-8 w-8 p-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-4 space-y-6">
                {selectedNode.type === 'action' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Action Type</Label>
                      <Select value={selectedNode.data.actionType} onValueChange={(v) => updateNodeData(selectedNode.id, { actionType: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="connect">Send Connection</SelectItem>
                          <SelectItem value="message">Send Message</SelectItem>
                          <SelectItem value="view_profile">View Profile</SelectItem>
                          <SelectItem value="inmail">Send InMail</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Wait Time (Hours)</Label>
                      <Input type="number" value={selectedNode.data.delay} onChange={(e) => updateNodeData(selectedNode.id, { delay: parseInt(e.target.value) })} />
                    </div>

                    {(selectedNode.data.actionType === 'message' || selectedNode.data.actionType === 'connect' || selectedNode.data.actionType === 'inmail') && (
                      <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Message Body</Label>
                        <textarea 
                          value={selectedNode.data.message || ''} 
                          onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                          placeholder="Hey {{first_name}}, ..."
                          className="w-full h-32 bg-background border rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <p className="text-xs text-muted-foreground">Variables: {"{{first_name}}"}, {"{{company}}"}</p>
                      </div>
                    )}
                  </>
                )}

                {selectedNode.type === 'condition' && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Check Condition</Label>
                    <Select value={selectedNode.data.conditionType} onValueChange={(v) => updateNodeData(selectedNode.id, { conditionType: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="if_accepted">If Connection Accepted</SelectItem>
                        <SelectItem value="if_replied">If Replied</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Select a node to edit
            </div>
          )}
        </Card>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={prevStep}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={handleContinue}>
          Continue to Schedule <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}

function StepButton({ icon: Icon, label, onClick }) {
  return (
    <Button 
      variant="outline" 
      onClick={onClick}
      className="w-full justify-start gap-3 text-xs font-bold uppercase tracking-widest h-12"
    >
      <Icon className="w-4 h-4" />
      {label}
    </Button>
  )
}
