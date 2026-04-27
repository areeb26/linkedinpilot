import React, { useState, useCallback, useEffect, useRef } from 'react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, Clock, ChevronLeft, ChevronRight, Rocket, Save, Loader2, Search, Check, ChevronDown, Loader, Users, GitBranch, LayoutGrid, Info, Zap, Mail, Pencil, LayoutTemplate, Trash2, Plus } from 'lucide-react'
import { toast } from 'react-hot-toast'

import TriggerNode   from '@/components/campaigns/nodes/TriggerNode'
import ActionNode    from '@/components/campaigns/nodes/ActionNode'
import ConditionNode from '@/components/campaigns/nodes/ConditionNode'
import EndNode       from '@/components/campaigns/nodes/EndNode'

const nodeTypes = {
  trigger:   TriggerNode,
  action:    ActionNode,
  condition: ConditionNode,
  end:       EndNode,
}

const edgeTypes = {}

const PRO_OPTIONS = { hideAttribution: true }

const EDGE = (id, source, target, opts = {}) => ({
  id,
  source,
  target,
  type: 'smoothstep',
  style: { stroke: '#334155', strokeDasharray: '5 5' },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#334155' },
  labelStyle: { fill: '#94a3b8', fontWeight: 700, fontSize: 10 },
  labelBgStyle: { fill: '#1e1e1e', fillOpacity: 0.9 },
  labelBgPadding: [4, 2],
  labelBgBorderRadius: 4,
  ...opts,
})

const FULL_TEMPLATE = {
  nodes: [
    { id: 'start',         type: 'trigger',   position: { x: 430, y: 0    }, data: { label: 'Lead Enrollment' } },
    { id: 'if-connected',  type: 'condition', position: { x: 400, y: 150  }, data: { conditionType: 'if_connected' } },

    // ── Left branch: Not Connected ──────────────────────────────────────────
    { id: 'send-conn',     type: 'action', position: { x: 120, y: 350  }, data: { actionType: 'connect',  message: 'Hi {{first_name}}, I\'d love to connect!' } },

    // Not Accepted path
    { id: 'wait-na',       type: 'action', position: { x: 350, y: 540  }, data: { actionType: 'wait',    delay: 360  } },
    { id: 'withdraw',      type: 'action', position: { x: 350, y: 680  }, data: { actionType: 'withdraw' } },
    { id: 'stop-withdraw', type: 'end',    position: { x: 350, y: 820  }, data: { label: 'Stop' } },

    // Accepted path
    { id: 'wait-acc',      type: 'action', position: { x: 30,  y: 540  }, data: { actionType: 'wait',    delay: 0.25 } },
    { id: 'msg-1',         type: 'action', position: { x: 30,  y: 680  }, data: { actionType: 'message', message: 'Hey {{first_name}}, glad we\'re connected! {{value_prop}}' } },
    { id: 'stop-m1r',      type: 'end',    position: { x: -180, y: 820  }, data: { label: 'Stop' } },
    { id: 'wait-3d-1',     type: 'action', position: { x: 30,  y: 820  }, data: { actionType: 'wait',    delay: 72   } },
    { id: 'msg-2',         type: 'action', position: { x: 30,  y: 960  }, data: { actionType: 'message', message: 'Just following up, {{first_name}} — did you get a chance to look?' } },
    { id: 'stop-m2r',      type: 'end',    position: { x: -180, y: 1100 }, data: { label: 'Stop' } },
    { id: 'wait-15d-1',    type: 'action', position: { x: 30,  y: 1100 }, data: { actionType: 'wait',    delay: 360  } },
    { id: 'stop-final-1',  type: 'end',    position: { x: 30,  y: 1240 }, data: { label: 'Stop' } },

    // ── Right branch: Already Connected ────────────────────────────────────
    { id: 'msg-r1',        type: 'action', position: { x: 730, y: 350  }, data: { actionType: 'message', message: 'Hi {{first_name}}, reaching out about {{topic}}.' } },
    { id: 'stop-r1r',      type: 'end',    position: { x: 940, y: 490  }, data: { label: 'Stop' } },
    { id: 'wait-r-15m',    type: 'action', position: { x: 730, y: 490  }, data: { actionType: 'wait',    delay: 0.25 } },
    { id: 'msg-r2',        type: 'action', position: { x: 730, y: 630  }, data: { actionType: 'message', message: 'Quick follow-up, {{first_name}} — happy to jump on a call?' } },
    { id: 'stop-r2r',      type: 'end',    position: { x: 940, y: 770  }, data: { label: 'Stop' } },
    { id: 'wait-r-3d',     type: 'action', position: { x: 730, y: 770  }, data: { actionType: 'wait',    delay: 72   } },
    { id: 'msg-r3',        type: 'action', position: { x: 730, y: 910  }, data: { actionType: 'message', message: 'Last one from me, {{first_name}} — let me know if there\'s a better time.' } },
    { id: 'stop-r3r',      type: 'end',    position: { x: 940, y: 1050 }, data: { label: 'Stop' } },
    { id: 'wait-r-15d',    type: 'action', position: { x: 730, y: 1050 }, data: { actionType: 'wait',    delay: 360  } },
    { id: 'stop-r-final',  type: 'end',    position: { x: 730, y: 1190 }, data: { label: 'Stop' } },
  ],
  edges: [
    EDGE('e-start-cond',    'start',       'if-connected'),
    EDGE('e-cond-no',       'if-connected','send-conn',     { sourceHandle: 'false', label: 'No'  }),
    EDGE('e-cond-yes',      'if-connected','msg-r1',        { sourceHandle: 'true',  label: 'Yes' }),

    // Send Connection → Not Accepted
    EDGE('e-conn-na',       'send-conn',   'wait-na',       { sourceHandle: 'not_accepted', label: 'Not Accepted' }),
    EDGE('e-na-withdraw',   'wait-na',     'withdraw'),
    EDGE('e-withdraw-stop', 'withdraw',    'stop-withdraw'),

    // Send Connection → Accepted
    EDGE('e-conn-acc',      'send-conn',   'wait-acc',      { sourceHandle: 'accepted', label: 'Accepted' }),
    EDGE('e-acc-msg1',      'wait-acc',    'msg-1'),
    EDGE('e-m1-replied',    'msg-1',       'stop-m1r',      { sourceHandle: 'replied',     label: 'Replied'     }),
    EDGE('e-m1-nr',         'msg-1',       'wait-3d-1',     { sourceHandle: 'not_replied', label: 'Not Replied' }),
    EDGE('e-3d1-msg2',      'wait-3d-1',   'msg-2'),
    EDGE('e-m2-replied',    'msg-2',       'stop-m2r',      { sourceHandle: 'replied',     label: 'Replied'     }),
    EDGE('e-m2-nr',         'msg-2',       'wait-15d-1',    { sourceHandle: 'not_replied', label: 'Not Replied' }),
    EDGE('e-15d1-stop',     'wait-15d-1',  'stop-final-1'),

    // Right branch
    EDGE('e-r1-replied',    'msg-r1',      'stop-r1r',      { sourceHandle: 'replied',     label: 'Replied'     }),
    EDGE('e-r1-nr',         'msg-r1',      'wait-r-15m',    { sourceHandle: 'not_replied', label: 'Not Replied' }),
    EDGE('e-r15m-msg-r2',   'wait-r-15m',  'msg-r2'),
    EDGE('e-r2-replied',    'msg-r2',      'stop-r2r',      { sourceHandle: 'replied',     label: 'Replied'     }),
    EDGE('e-r2-nr',         'msg-r2',      'wait-r-3d',     { sourceHandle: 'not_replied', label: 'Not Replied' }),
    EDGE('e-r3d-msg-r3',    'wait-r-3d',   'msg-r3'),
    EDGE('e-r3-replied',    'msg-r3',      'stop-r3r',      { sourceHandle: 'replied',     label: 'Replied'     }),
    EDGE('e-r3-nr',         'msg-r3',      'wait-r-15d',    { sourceHandle: 'not_replied', label: 'Not Replied' }),
    EDGE('e-r15d-stop',     'wait-r-15d',  'stop-r-final'),
  ]
}

const BASIC_TEMPLATE = {
  nodes: [
    { id: '1', type: 'trigger',   position: { x: 250, y: 0   }, data: { label: 'Lead Enrollment' } },
    { id: '2', type: 'action',    position: { x: 250, y: 150 }, data: { actionType: 'connect', message: '' } },
    { id: '3', type: 'action',    position: { x: 250, y: 300 }, data: { actionType: 'message', message: 'Hi {{first_name}}, thanks for connecting!' } },
    { id: '4', type: 'end',       position: { x: 250, y: 450 }, data: { label: 'Done' } },
  ],
  edges: [
    EDGE('e1-2', '1', '2'),
    EDGE('e2-3', '2', '3', { sourceHandle: 'accepted' }),
    EDGE('e3-4', '3', '4', { sourceHandle: 'replied' }),
  ]
}

// Advanced template matching the screenshot with nested If Replied conditions
const ADVANCED_TEMPLATE = {
  nodes: [
    // Start
    { id: 'start', type: 'trigger', position: { x: 500, y: 0 }, data: { label: 'Start' } },
    
    // First condition: If Connected
    { id: 'if-connected', type: 'condition', position: { x: 500, y: 100 }, data: { conditionType: 'if_connected' } },
    
    // ── LEFT BRANCH: Not Connected → Send Connection ─────────────────────────
    { id: 'send-conn', type: 'action', position: { x: 200, y: 220 }, data: { actionType: 'connect', message: '' } },
    
    // Not Accepted path (left side of Send Connection)
    { id: 'wait-na', type: 'action', position: { x: 50, y: 340 }, data: { actionType: 'wait', delay: 360 } },
    { id: 'withdraw', type: 'action', position: { x: 50, y: 460 }, data: { actionType: 'withdraw' } },
    { id: 'stop-withdraw', type: 'end', position: { x: 50, y: 580 }, data: { label: 'Stop' } },
    
    // Accepted path (right side of Send Connection)
    { id: 'wait-acc', type: 'action', position: { x: 200, y: 340 }, data: { actionType: 'wait', delay: 0.25 } },
    { id: 'msg-acc', type: 'action', position: { x: 200, y: 460 }, data: { actionType: 'message', message: 'Hi {{first_name}}, thanks for connecting!' } },
    
    // If Replied after first message (Accepted branch)
    { id: 'if-replied-1', type: 'condition', position: { x: 200, y: 580 }, data: { conditionType: 'if_replied' } },
    { id: 'stop-replied-1', type: 'end', position: { x: 80, y: 700 }, data: { label: 'Stop' } },
    { id: 'wait-3d-1', type: 'action', position: { x: 200, y: 700 }, data: { actionType: 'wait', delay: 72 } },
    { id: 'msg-2', type: 'action', position: { x: 200, y: 820 }, data: { actionType: 'message', message: 'Following up - did you get a chance to look?' } },
    
    // If Replied after second message
    { id: 'if-replied-2', type: 'condition', position: { x: 200, y: 940 }, data: { conditionType: 'if_replied' } },
    { id: 'stop-replied-2', type: 'end', position: { x: 80, y: 1060 }, data: { label: 'Stop' } },
    { id: 'wait-15d-1', type: 'action', position: { x: 200, y: 1060 }, data: { actionType: 'wait', delay: 360 } },
    { id: 'msg-3', type: 'action', position: { x: 200, y: 1180 }, data: { actionType: 'message', message: 'Last follow up - let me know if interested!' } },
    
    // If Replied after third message
    { id: 'if-replied-3', type: 'condition', position: { x: 200, y: 1300 }, data: { conditionType: 'if_replied' } },
    { id: 'stop-replied-3', type: 'end', position: { x: 80, y: 1420 }, data: { label: 'Stop' } },
    { id: 'wait-15d-2', type: 'action', position: { x: 200, y: 1420 }, data: { actionType: 'wait', delay: 360 } },
    { id: 'stop-final-1', type: 'end', position: { x: 200, y: 1540 }, data: { label: 'Stop' } },
    
    // ── RIGHT BRANCH: Already Connected ────────────────────────────────────
    { id: 'msg-connected', type: 'action', position: { x: 800, y: 220 }, data: { actionType: 'message', message: 'Hi {{first_name}}, reaching out about {{topic}}.' } },
    
    // If Replied after first message (Connected branch)
    { id: 'if-replied-r1', type: 'condition', position: { x: 800, y: 340 }, data: { conditionType: 'if_replied' } },
    { id: 'stop-replied-r1', type: 'end', position: { x: 680, y: 460 }, data: { label: 'Stop' } },
    { id: 'wait-15m-r', type: 'action', position: { x: 800, y: 460 }, data: { actionType: 'wait', delay: 0.25 } },
    { id: 'msg-r2', type: 'action', position: { x: 800, y: 580 }, data: { actionType: 'message', message: 'Quick follow up - happy to jump on a call?' } },
    
    // If Replied after second message (Connected branch)
    { id: 'if-replied-r2', type: 'condition', position: { x: 800, y: 700 }, data: { conditionType: 'if_replied' } },
    { id: 'stop-replied-r2', type: 'end', position: { x: 680, y: 820 }, data: { label: 'Stop' } },
    { id: 'wait-3d-r', type: 'action', position: { x: 800, y: 820 }, data: { actionType: 'wait', delay: 72 } },
    { id: 'msg-r3', type: 'action', position: { x: 800, y: 940 }, data: { actionType: 'message', message: 'Last one from me - let me know if there\'s a better time.' } },
    
    // If Replied after third message (Connected branch)
    { id: 'if-replied-r3', type: 'condition', position: { x: 800, y: 1060 }, data: { conditionType: 'if_replied' } },
    { id: 'stop-replied-r3', type: 'end', position: { x: 680, y: 1180 }, data: { label: 'Stop' } },
    { id: 'wait-15d-r', type: 'action', position: { x: 800, y: 1180 }, data: { actionType: 'wait', delay: 360 } },
    { id: 'stop-final-r', type: 'end', position: { x: 800, y: 1300 }, data: { label: 'Stop' } },
  ],
  edges: [
    // Start → If Connected
    EDGE('e-start', 'start', 'if-connected'),
    
    // If Connected branches
    EDGE('e-conn-no', 'if-connected', 'send-conn', { sourceHandle: 'false', label: 'No' }),
    EDGE('e-conn-yes', 'if-connected', 'msg-connected', { sourceHandle: 'true', label: 'Yes' }),
    
    // ── LEFT BRANCH: Send Connection ────────────────────────────────────────
    // Not Accepted path
    EDGE('e-conn-na', 'send-conn', 'wait-na', { sourceHandle: 'not_accepted', label: 'Not Accepted' }),
    EDGE('e-na-wait', 'wait-na', 'withdraw'),
    EDGE('e-withdraw-stop', 'withdraw', 'stop-withdraw'),
    
    // Accepted path
    EDGE('e-conn-acc', 'send-conn', 'wait-acc', { sourceHandle: 'accepted', label: 'Accepted' }),
    EDGE('e-acc-wait', 'wait-acc', 'msg-acc'),
    EDGE('e-msg1-if', 'msg-acc', 'if-replied-1'),
    
    // If Replied 1
    EDGE('e-if1-yes', 'if-replied-1', 'stop-replied-1', { sourceHandle: 'true', label: 'Replied' }),
    EDGE('e-if1-no', 'if-replied-1', 'wait-3d-1', { sourceHandle: 'false', label: 'Not Replied' }),
    EDGE('e-wait3d-msg2', 'wait-3d-1', 'msg-2'),
    EDGE('e-msg2-if', 'msg-2', 'if-replied-2'),
    
    // If Replied 2
    EDGE('e-if2-yes', 'if-replied-2', 'stop-replied-2', { sourceHandle: 'true', label: 'Replied' }),
    EDGE('e-if2-no', 'if-replied-2', 'wait-15d-1', { sourceHandle: 'false', label: 'Not Replied' }),
    EDGE('e-wait15d-msg3', 'wait-15d-1', 'msg-3'),
    EDGE('e-msg3-if', 'msg-3', 'if-replied-3'),
    
    // If Replied 3
    EDGE('e-if3-yes', 'if-replied-3', 'stop-replied-3', { sourceHandle: 'true', label: 'Replied' }),
    EDGE('e-if3-no', 'if-replied-3', 'wait-15d-2', { sourceHandle: 'false', label: 'Not Replied' }),
    EDGE('e-wait15d-stop', 'wait-15d-2', 'stop-final-1'),
    
    // ── RIGHT BRANCH: Already Connected ───────────────────────────────────
    EDGE('e-msg1-ifr', 'msg-connected', 'if-replied-r1'),
    
    // If Replied R1
    EDGE('e-ifr1-yes', 'if-replied-r1', 'stop-replied-r1', { sourceHandle: 'true', label: 'Replied' }),
    EDGE('e-ifr1-no', 'if-replied-r1', 'wait-15m-r', { sourceHandle: 'false', label: 'Not Replied' }),
    EDGE('e-wait15m-msgr2', 'wait-15m-r', 'msg-r2'),
    EDGE('e-msgr2-if', 'msg-r2', 'if-replied-r2'),
    
    // If Replied R2
    EDGE('e-ifr2-yes', 'if-replied-r2', 'stop-replied-r2', { sourceHandle: 'true', label: 'Replied' }),
    EDGE('e-ifr2-no', 'if-replied-r2', 'wait-3d-r', { sourceHandle: 'false', label: 'Not Replied' }),
    EDGE('e-wait3d-msgr3', 'wait-3d-r', 'msg-r3'),
    EDGE('e-msgr3-if', 'msg-r3', 'if-replied-r3'),
    
    // If Replied R3
    EDGE('e-ifr3-yes', 'if-replied-r3', 'stop-replied-r3', { sourceHandle: 'true', label: 'Replied' }),
    EDGE('e-ifr3-no', 'if-replied-r3', 'wait-15d-r', { sourceHandle: 'false', label: 'Not Replied' }),
    EDGE('e-wait15d-stopr', 'wait-15d-r', 'stop-final-r'),
  ]
}

const MESSAGE_ONLY_TEMPLATE = {
  nodes: [
    { id: '1', type: 'trigger', position: { x: 250, y: 0   }, data: { label: 'Lead Enrollment' } },
    { id: '2', type: 'action',  position: { x: 250, y: 150 }, data: { actionType: 'message', message: 'Hi {{first_name}}, reaching out about {{topic}}.' } },
    { id: '3', type: 'action',  position: { x: 450, y: 300 }, data: { actionType: 'wait', delay: 72 } },
    { id: '4', type: 'action',  position: { x: 450, y: 450 }, data: { actionType: 'message', message: 'Just following up, {{first_name}} — any thoughts?' } },
    { id: '5', type: 'end',     position: { x: 250, y: 450 }, data: { label: 'Stop (replied)' } },
    { id: '6', type: 'end',     position: { x: 450, y: 600 }, data: { label: 'Stop' } },
  ],
  edges: [
    EDGE('e1-2', '1', '2'),
    EDGE('e2-stop', '2', '5', { sourceHandle: 'replied', label: 'Replied' }),
    EDGE('e2-wait', '2', '3', { sourceHandle: 'not_replied', label: 'Not Replied' }),
    EDGE('e3-4', '3', '4'),
    EDGE('e4-stop', '4', '6', { sourceHandle: 'replied', label: 'Replied' }),
  ]
}

const INMAIL_TEMPLATE = {
  nodes: [
    { id: '1', type: 'trigger', position: { x: 250, y: 0   }, data: { label: 'Lead Enrollment' } },
    { id: '2', type: 'action',  position: { x: 250, y: 150 }, data: { actionType: 'view_profile' } },
    { id: '3', type: 'action',  position: { x: 250, y: 300 }, data: { actionType: 'inmail', message: 'Hi {{first_name}}, I noticed your work at {{company}} and wanted to reach out directly.' } },
    { id: '4', type: 'end',     position: { x: 450, y: 450 }, data: { label: 'Stop (replied)' } },
    { id: '5', type: 'action',  position: { x: 250, y: 450 }, data: { actionType: 'wait', delay: 120 } },
    { id: '6', type: 'action',  position: { x: 250, y: 600 }, data: { actionType: 'inmail', message: 'Following up, {{first_name}} — would love to connect.' } },
    { id: '7', type: 'end',     position: { x: 250, y: 750 }, data: { label: 'Stop' } },
  ],
  edges: [
    EDGE('e1-2', '1', '2'),
    EDGE('e2-3', '2', '3'),
    EDGE('e3-r', '3', '4', { sourceHandle: 'replied', label: 'Replied' }),
    EDGE('e3-nr', '3', '5', { sourceHandle: 'not_replied', label: 'Not Replied' }),
    EDGE('e5-6', '5', '6'),
    EDGE('e6-stop', '6', '7'),
  ]
}

const SCRATCH_NODES = {
  nodes: [
    { id: 'start', type: 'trigger', position: { x: 250, y: 100 }, data: { label: 'Lead Enrollment' } },
  ],
  edges: []
}

const SYSTEM_TEMPLATES = [
  {
    id: 'basic',
    name: 'Basic Connect',
    description: 'Send a connection request, then follow up with a message once accepted.',
    icon: Users,
    steps: '3 steps',
    template: BASIC_TEMPLATE,
  },
  {
    id: 'full',
    name: 'Full Outreach',
    description: 'Advanced flow with if/else branching for connected vs new leads.',
    icon: GitBranch,
    steps: '12+ steps',
    template: FULL_TEMPLATE,
  },
  {
    id: 'message',
    name: 'Message Only',
    description: 'For leads already connected — direct message sequence with follow-up.',
    icon: Mail,
    steps: '4 steps',
    template: MESSAGE_ONLY_TEMPLATE,
  },
  {
    id: 'inmail',
    name: 'InMail Campaign',
    description: 'Profile view followed by InMail — ideal for premium accounts.',
    icon: Zap,
    steps: '4 steps',
    template: INMAIL_TEMPLATE,
  },
]

export function SequencesStep() {
  const { campaignData, updateCampaignData, nextStep, prevStep } = useWizard()
  const [view, setView] = useState('loading')
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const initialized = useRef(false)
  const [confirmTemplate, setConfirmTemplate] = useState(null)

  // Initialize view based on campaign data once it's loaded
  useEffect(() => {
    if (view !== 'loading') return
    const hasExistingSequence = (campaignData.sequence?.nodes?.length ?? 0) > 0
    setView(hasExistingSequence ? 'builder' : 'select')
  }, [campaignData.sequence, view])

  // Initialize nodes/edges when entering builder view
  useEffect(() => {
    if (view !== 'builder' || initialized.current) return
    initialized.current = true
    const withDelete = (campaignData.sequence?.nodes || []).map(n => ({
      ...n,
      data: { ...n.data, ...(n.type !== 'trigger' ? { onDelete: () => deleteNode(n.id) } : {}) }
    }))
    setNodes(withDelete)
    setEdges(campaignData.sequence?.edges || [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), [])
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), [])
  const onConnect     = useCallback((params) => setEdges((eds) => addEdge({ ...params, ...EDGE(`e-${Date.now()}`, params.source, params.target) }, eds)), [])

  const onNodeClick = (_, node) => setSelectedNode(node)
  const onPaneClick = () => setSelectedNode(null)

  const updateNodeData = (nodeId, newData) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n))
    setSelectedNode(prev => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...newData } } : prev)
  }

  const addNode = (type, extraData = {}) => {
    const id = `${type}-${Date.now()}`
    setNodes((nds) => [...nds, {
      id,
      type,
      position: { x: 250, y: nds.length * 150 + 50 },
      data: { actionType: 'message', delay: 24, ...extraData, ...(type !== 'trigger' ? { onDelete: () => deleteNode(id) } : {}) }
    }])
  }

  const deleteNode = (id) => {
    setNodes((nds) => nds.filter(n => n.id !== id))
    setEdges((eds) => eds.filter(e => e.source !== id && e.target !== id))
    setSelectedNode(null)
  }

  const loadFullTemplate = () => loadTemplate(FULL_TEMPLATE)
  const loadAdvancedTemplate = () => loadTemplate(ADVANCED_TEMPLATE)

  const validateSequence = () => {
    if (!nodes.some(n => n.type === 'trigger')) return { valid: false, message: 'Sequence must have a Start node.' }
    if (!nodes.some(n => n.type === 'end'))     return { valid: false, message: 'Sequence must have an End node.' }
    const emptyMsgNodes = nodes.filter(n =>
      n.type === 'action' &&
      ['message', 'connect', 'inmail'].includes(n.data?.actionType) &&
      !n.data?.message?.trim()
    )
    if (emptyMsgNodes.length > 0)
      return { valid: false, message: `${emptyMsgNodes.length} node${emptyMsgNodes.length > 1 ? 's have' : ' has'} an empty message. Fill all message fields before continuing.` }
    return { valid: true }
  }

  const handleContinue = () => {
    const v = validateSequence()
    if (!v.valid) { toast.error(v.message); return }
    // Strip onDelete functions before saving (can't be serialized to JSON)
    const cleanNodes = nodes.map(n => {
      const { onDelete, ...cleanData } = n.data
      return { ...n, data: cleanData }
    })
    updateCampaignData({ sequence: { nodes: cleanNodes, edges } })
    nextStep()
  }

  const applyTemplate = (template) => {
    const withDelete = template.nodes.map(n => ({
      ...n,
      data: { ...n.data, ...(n.type !== 'trigger' ? { onDelete: () => deleteNode(n.id) } : {}) }
    }))
    setNodes(withDelete)
    setEdges(template.edges)
    initialized.current = true
    setView('builder')
    setSelectedNode(null)
    setConfirmTemplate(null)
    toast.success('Template loaded')
  }

  const loadTemplate = (template) => {
    if (nodes.length > 1) { setConfirmTemplate(template); return }
    applyTemplate(template)
  }

  const startScratch = () => {
    setNodes(SCRATCH_NODES.nodes)
    setEdges(SCRATCH_NODES.edges)
    initialized.current = true
    setView('builder')
  }

  const autoLayout = () => {
    const rankMap = {}
    const childMap = {}
    nodes.forEach(n => { rankMap[n.id] = -1; childMap[n.id] = [] })
    edges.forEach(e => { if (childMap[e.source]) childMap[e.source].push(e.target) })
    const roots = nodes.filter(n => n.type === 'trigger').map(n => n.id)
    const queue = roots.map(id => ({ id, rank: 0 }))
    roots.forEach(id => { rankMap[id] = 0 })
    while (queue.length) {
      const { id, rank } = queue.shift()
      ;(childMap[id] || []).forEach(childId => {
        if (rankMap[childId] < rank + 1) { rankMap[childId] = rank + 1; queue.push({ id: childId, rank: rank + 1 }) }
      })
    }
    const ranks = {}
    nodes.forEach(n => { const r = rankMap[n.id] >= 0 ? rankMap[n.id] : 99; (ranks[r] = ranks[r] || []).push(n.id) })
    const newPos = {}
    Object.entries(ranks).forEach(([rank, ids]) => {
      const totalW = (ids.length - 1) * 240
      ids.forEach((id, i) => { newPos[id] = { x: i * 240 - totalW / 2 + 500, y: parseInt(rank) * 160 + 50 } })
    })
    setNodes(nds => nds.map(n => ({ ...n, position: newPos[n.id] || n.position })))
  }

  if (view === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-300px)] gap-4">
        <Loader className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Loading sequence...</p>
      </div>
    )
  }

  if (view === 'select') {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-300px)] gap-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Create Your Sequence</h2>
          <p className="text-muted-foreground">Choose how you want to start building your campaign sequence</p>
        </div>
        <div className="grid grid-cols-2 gap-6 w-full max-w-2xl">
          <button
            onClick={startScratch}
            className="group relative flex flex-col gap-4 p-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] hover:border-violet-500/50 hover:bg-[var(--color-input)] transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
              <Pencil className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Start from Scratch</h3>
              <p className="text-sm text-muted-foreground mt-1">Build your sequence from the ground up</p>
            </div>
            <ul className="space-y-2 mt-2">
              {['Perfect for unique workflows', 'Build exactly what you envision', 'Maximum flexibility and control'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-violet-400 shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </button>

          <button
            onClick={() => setView('templates')}
            className="group relative flex flex-col gap-4 p-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] hover:border-violet-500/50 hover:bg-[var(--color-input)] transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
              <LayoutTemplate className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Create from Templates</h3>
              <p className="text-sm text-muted-foreground mt-1">Start with pre-built or your saved templates</p>
            </div>
            <ul className="space-y-2 mt-2">
              {['Browse proven system templates', 'Access your saved templates', 'Customize to fit your workflow'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-violet-400 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-auto pt-2 border-t border-white/5">Save time with ready-made flows</p>
          </button>
        </div>

        <div className="flex justify-start w-full max-w-2xl">
          <Button variant="outline" onClick={prevStep}>
            <ChevronLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
      </div>
    )
  }

  if (view === 'templates') {
    return (
      <div className="flex flex-col gap-6 h-[calc(100vh-300px)] overflow-y-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setView('select')}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <h2 className="text-xl font-bold">Choose a Template</h2>
            <p className="text-sm text-muted-foreground">Select a template to start with, then customize it</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {SYSTEM_TEMPLATES.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => loadTemplate(t.template)}
                className="group flex flex-col gap-3 p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-strong)] hover:border-violet-500/50 hover:bg-[var(--color-input)] transition-all text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                    <Icon className="w-5 h-5 text-violet-400" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-[var(--color-input)] px-2 py-1 rounded-full">{t.steps}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{t.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                </div>
                <span className="text-xs text-violet-400 group-hover:underline mt-auto">Use this template →</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col gap-4">
      <div className="flex-1 flex gap-4 overflow-hidden">

        {/* Left Panel */}
        <Card className="w-64 bg-card border-border flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Info className="w-4 h-4" /> Step Library
            </h3>
          </div>
          <div className="p-4 space-y-2 overflow-y-auto flex-1">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Actions</p>
            <StepButton label="Send Connection" tooltip="Send a connection request with an optional note" onClick={() => addNode('action', { actionType: 'connect'      })} />
            <StepButton label="Send Message"    tooltip="Send a direct message to a connected lead" onClick={() => addNode('action', { actionType: 'message'      })} />
            <StepButton label="Wait"            tooltip="Pause the sequence for a set duration" onClick={() => addNode('action', { actionType: 'wait', delay: 24 })} />
            <StepButton label="Send InMail"     tooltip="Send a LinkedIn InMail (Premium required)" onClick={() => addNode('action', { actionType: 'inmail'       })} />
            <StepButton label="View Profile"    tooltip="Visit the lead's profile to trigger a viewed notification" onClick={() => addNode('action', { actionType: 'view_profile' })} />
            <StepButton label="Withdraw Conn."  tooltip="Withdraw a pending connection request" onClick={() => addNode('action', { actionType: 'withdraw'     })} />
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-3 mb-1">Logic</p>
            <StepButton label="Condition"       tooltip="Branch the flow based on a Yes/No condition" onClick={() => addNode('condition', { conditionType: 'if_connected' })} />
            <StepButton label="End Point"       tooltip="Terminate this branch of the sequence" onClick={() => addNode('end', { label: 'Stop' })} />
            <div className="pt-3 border-t border-border mt-2 space-y-2">
              <Button variant="secondary" className="w-full text-xs" onClick={loadFullTemplate}>
                Load Full Template
              </Button>
              <Button variant="secondary" className="w-full text-xs" onClick={loadAdvancedTemplate}>
                Load Advanced Template (IF Nodes)
              </Button>
              <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => {
                if (nodes.length > 1) { setConfirmTemplate('browse'); return }
                initialized.current = false; setView('templates')
              }}>
                Browse Templates
              </Button>
            </div>
          </div>
          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Drag handles to connect nodes. Click to edit.
            </p>
          </div>
        </Card>

        {/* Canvas */}
        <div className="flex-1 bg-muted/30 rounded-xl border border-border overflow-hidden relative">
          <button
            onClick={autoLayout}
            title="Auto-arrange nodes top-to-bottom"
            className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-surface-strong)] border border-[var(--color-border)] text-xs font-semibold text-muted-foreground hover:text-[var(--color-text-primary)] hover:border-violet-500/50 transition-all"
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Auto-arrange
          </button>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            proOptions={PRO_OPTIONS}
          >
            <Background color="oklch(var(--muted-foreground))" gap={20} />
            <Controls />
          </ReactFlow>
        </div>

        {/* Right Panel */}
        <Card className={`w-64 bg-card border-border flex flex-col overflow-hidden transition-all ${selectedNode ? 'opacity-100' : 'opacity-50'}`}>
          {selectedNode ? (
            <>
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest">Edit Node</h3>
                <Button variant="ghost" size="sm" onClick={() => deleteNode(selectedNode.id)} className="text-destructive hover:text-destructive h-8 w-8 p-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto">

                {selectedNode.type === 'action' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Action Type</Label>
                      <Select value={selectedNode.data.actionType} onValueChange={(v) => updateNodeData(selectedNode.id, { actionType: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="connect">Send Connection</SelectItem>
                          <SelectItem value="message">Send Message</SelectItem>
                          <SelectItem value="wait">Wait</SelectItem>
                          <SelectItem value="inmail">Send InMail</SelectItem>
                          <SelectItem value="view_profile">View Profile</SelectItem>
                          <SelectItem value="withdraw">Withdraw Connection</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedNode.data.actionType === 'wait' ? (
                      <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Wait Duration</Label>
                        <Select
                          value={String(selectedNode.data.delay ?? 24)}
                          onValueChange={(v) => updateNodeData(selectedNode.id, { delay: parseFloat(v) })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0.25">15 minutes</SelectItem>
                            <SelectItem value="1">1 hour</SelectItem>
                            <SelectItem value="6">6 hours</SelectItem>
                            <SelectItem value="24">1 day</SelectItem>
                            <SelectItem value="72">3 days</SelectItem>
                            <SelectItem value="168">7 days</SelectItem>
                            <SelectItem value="336">14 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Delay Before (Hours)</Label>
                        <Input
                          type="number"
                          step="0.25"
                          value={selectedNode.data.delay ?? ''}
                          onChange={(e) => updateNodeData(selectedNode.id, { delay: parseFloat(e.target.value) || 0 })}
                          placeholder="e.g. 0.25 = 15min, 72 = 3d"
                        />
                        <p className="text-[10px] text-muted-foreground">0.25h=15m · 24h=1d · 72h=3d · 360h=15d</p>
                      </div>
                    )}

                    {['message', 'connect', 'inmail'].includes(selectedNode.data.actionType) && (
                      <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Message Body</Label>
                        <textarea
                          value={selectedNode.data.message || ''}
                          onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                          placeholder="Hey {{first_name}}, ..."
                          className="w-full h-32 bg-background border rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                        />
                        <p className="text-[10px] text-muted-foreground">{'{{first_name}}'} · {'{{company}}'} · {'{{value_prop}}'}</p>
                      </div>
                    )}
                  </>
                )}

                {selectedNode.type === 'condition' && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Condition</Label>
                    <Select value={selectedNode.data.conditionType} onValueChange={(v) => updateNodeData(selectedNode.id, { conditionType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="if_connected">If Connected</SelectItem>
                        <SelectItem value="if_accepted">If Accepted</SelectItem>
                        <SelectItem value="if_replied">If Replied</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedNode.type === 'end' && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Label</Label>
                    <Input
                      value={selectedNode.data.label || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-4 flex flex-col gap-3">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Tips</p>
              {[
                { key: 'click',   hint: 'Click any node to edit its settings' },
                { key: 'del',     hint: 'Select an edge + Delete key to remove it' },
                { key: 'connect', hint: 'Drag from a handle dot to connect nodes' },
                { key: 'pan',     hint: 'Scroll to zoom · Click canvas to deselect' },
              ].map(({ key, hint }) => (
                <div key={key} className="flex gap-2 items-start">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{hint}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={!!confirmTemplate} onOpenChange={() => setConfirmTemplate(null)}>
        <DialogContent className="bg-[var(--color-surface-strong)] border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Replace current sequence?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Loading a template will discard all current nodes and edges. This cannot be undone.</p>
          <DialogFooter className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmTemplate(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (confirmTemplate === 'browse') { setConfirmTemplate(null); initialized.current = false; setView('templates') }
              else applyTemplate(confirmTemplate)
            }}>Replace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

function StepButton({ label, onClick, tooltip }) {
  return (
    <Button title={tooltip} variant="outline" onClick={onClick} className="w-full justify-start gap-3 text-xs font-bold uppercase tracking-widest h-10">
      <Plus className="w-3 h-3" /> {label}
    </Button>
  )
}
