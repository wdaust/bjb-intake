import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getAllNodes } from '@/data/callFlowNodes'
import type { CallNode, CallStage } from '@/types'
import CallNodeComponent from '@/components/builder/CallNodeComponent'

const nodeTypes = { callNode: CallNodeComponent }

const STAGES: CallStage[] = ['opening', 'treatment_status', 'symptoms', 'appointments', 'barriers', 'progression', 'direction', 'next_step', 'closeout']

const STAGE_Y: Record<string, number> = {
  opening: 0,
  treatment_status: 200,
  symptoms: 400,
  appointments: 600,
  barriers: 800,
  progression: 1000,
  direction: 1200,
  next_step: 1400,
  closeout: 1600,
}

function buildFlowFromNodes(callNodes: CallNode[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Group by stage for x positioning
  const stageGroups: Record<string, CallNode[]> = {}
  for (const cn of callNodes) {
    if (!stageGroups[cn.stage]) stageGroups[cn.stage] = []
    stageGroups[cn.stage].push(cn)
  }

  for (const cn of callNodes) {
    const stageNodes = stageGroups[cn.stage] || []
    const indexInStage = stageNodes.indexOf(cn)
    const totalInStage = stageNodes.length
    const xSpread = 260
    const xOffset = (indexInStage - (totalInStage - 1) / 2) * xSpread

    nodes.push({
      id: cn.nodeId,
      type: 'callNode',
      position: { x: 500 + xOffset, y: STAGE_Y[cn.stage] || 0 },
      data: {
        nodeId: cn.nodeId,
        nodeName: cn.nodeName,
        stage: cn.stage,
        promptText: cn.promptText,
        answerCount: cn.answerOptions.length,
        isComplete: Object.values(cn.nextNodeMap).includes('COMPLETE'),
      },
    })

    // Edges from nextNodeMap
    for (const [answerId, targetNodeId] of Object.entries(cn.nextNodeMap)) {
      if (targetNodeId === 'COMPLETE') continue
      const targetExists = callNodes.some(n => n.nodeId === targetNodeId)
      if (!targetExists) continue

      edges.push({
        id: `${cn.nodeId}-${answerId}-${targetNodeId}`,
        source: cn.nodeId,
        target: targetNodeId,
        label: answerId.length > 20 ? answerId.slice(0, 18) + '...' : answerId,
        type: 'smoothstep',
        style: { strokeWidth: 1.5 },
        labelStyle: { fontSize: 8, fill: '#666' },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
      })
    }
  }

  return { nodes, edges }
}

export function FlowBuilder() {
  const [callNodes, setCallNodes] = useState<CallNode[]>(getAllNodes)
  const [selectedNode, setSelectedNode] = useState<CallNode | null>(null)
  const [editingNode, setEditingNode] = useState<CallNode | null>(null)

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildFlowFromNodes(callNodes),
    [callNodes]
  )

  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)

  // Rebuild when callNodes change
  useEffect(() => {
    const built = buildFlowFromNodes(callNodes)
    setNodes(built.nodes)
    setEdges(built.edges)
  }, [callNodes])

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const cn = callNodes.find(n => n.nodeId === node.id)
    if (cn) {
      setSelectedNode(cn)
      setEditingNode(null)
    }
  }, [callNodes])

  function startEditing() {
    if (selectedNode) {
      setEditingNode(JSON.parse(JSON.stringify(selectedNode)))
    }
  }

  function saveEdit() {
    if (!editingNode) return
    setCallNodes(prev => prev.map(n => n.nodeId === editingNode.nodeId ? editingNode : n))
    setSelectedNode(editingNode)
    setEditingNode(null)
  }

  function cancelEdit() {
    setEditingNode(null)
  }

  function addNewNode() {
    const id = `node_${Date.now()}`
    const newNode: CallNode = {
      nodeId: id,
      nodeName: 'New Node',
      stage: 'opening',
      promptText: 'Enter the prompt text here...',
      empathyGuidance: 'Enter empathy guidance...',
      purposeText: 'Enter the purpose of this step...',
      answerOptions: [
        { id: 'option_1', label: 'Option 1' },
        { id: 'option_2', label: 'Option 2' },
      ],
      followUpProbes: [],
      fieldUpdates: [],
      scoreUpdates: [],
      directionUpdates: [],
      taskRules: [],
      escalationRules: [],
      requiredCompletionFlags: [],
      nextNodeMap: { option_1: 'COMPLETE', option_2: 'COMPLETE' },
    }
    setCallNodes(prev => [...prev, newNode])
    setSelectedNode(newNode)
    setEditingNode(newNode)
  }

  function deleteNode(nodeId: string) {
    setCallNodes(prev => prev.filter(n => n.nodeId !== nodeId))
    if (selectedNode?.nodeId === nodeId) {
      setSelectedNode(null)
      setEditingNode(null)
    }
  }

  function exportJson() {
    const json = JSON.stringify(callNodes, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'callFlowNodes.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const active = editingNode || selectedNode

  return (
    <div className="h-[calc(100vh-80px)] flex">
      {/* Flow Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{ type: 'smoothstep' }}
        >
          <Background gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const stage = (n.data as Record<string, unknown>)?.stage as string
              const colors: Record<string, string> = {
                opening: '#93c5fd', treatment_status: '#86efac', symptoms: '#c4b5fd',
                appointments: '#67e8f9', barriers: '#fdba74', progression: '#5eead4',
                direction: '#a5b4fc', next_step: '#6ee7b7', closeout: '#d1d5db',
              }
              return colors[stage] || '#d1d5db'
            }}
            style={{ height: 120 }}
          />
          <Panel position="top-left">
            <div className="flex gap-2">
              <Button size="sm" onClick={addNewNode}>+ Add Node</Button>
              <Button size="sm" variant="outline" onClick={exportJson}>Export JSON</Button>
              <Badge variant="secondary">{callNodes.length} nodes</Badge>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Side Panel */}
      <div className="w-96 border-l bg-card overflow-y-auto">
        {!active ? (
          <div className="p-4 text-center text-muted-foreground mt-20">
            <p className="text-sm">Click a node to view or edit it</p>
            <p className="text-xs mt-2">Or click + Add Node to create a new step</p>
          </div>
        ) : editingNode ? (
          /* EDIT MODE */
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Editing Node</h3>
              <div className="flex gap-1">
                <Button size="sm" onClick={saveEdit}>Save</Button>
                <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Node ID</Label>
              <Input value={editingNode.nodeId} disabled className="text-xs" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Node Name</Label>
              <Input
                value={editingNode.nodeName}
                onChange={(e) => setEditingNode({ ...editingNode, nodeName: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Stage</Label>
              <Select
                value={editingNode.stage}
                onValueChange={(v) => { if (v) setEditingNode({ ...editingNode, stage: v as CallStage }) }}
              >
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Prompt Text</Label>
              <Textarea
                value={editingNode.promptText}
                onChange={(e) => setEditingNode({ ...editingNode, promptText: e.target.value })}
                rows={4}
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Empathy Guidance</Label>
              <Textarea
                value={editingNode.empathyGuidance}
                onChange={(e) => setEditingNode({ ...editingNode, empathyGuidance: e.target.value })}
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Purpose</Label>
              <Textarea
                value={editingNode.purposeText}
                onChange={(e) => setEditingNode({ ...editingNode, purposeText: e.target.value })}
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Answer Options ({editingNode.answerOptions.length})</Label>
              {editingNode.answerOptions.map((opt, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <Input
                    value={opt.id}
                    onChange={(e) => {
                      const updated = [...editingNode.answerOptions]
                      updated[i] = { ...updated[i], id: e.target.value }
                      setEditingNode({ ...editingNode, answerOptions: updated })
                    }}
                    className="text-xs flex-1"
                    placeholder="ID"
                  />
                  <Input
                    value={opt.label}
                    onChange={(e) => {
                      const updated = [...editingNode.answerOptions]
                      updated[i] = { ...updated[i], label: e.target.value }
                      setEditingNode({ ...editingNode, answerOptions: updated })
                    }}
                    className="text-xs flex-[2]"
                    placeholder="Label"
                  />
                  <span className="text-[9px] text-muted-foreground w-16 truncate">
                    → {editingNode.nextNodeMap[opt.id] || '?'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={() => {
                      const updated = editingNode.answerOptions.filter((_, j) => j !== i)
                      const newMap = { ...editingNode.nextNodeMap }
                      delete newMap[opt.id]
                      setEditingNode({ ...editingNode, answerOptions: updated, nextNodeMap: newMap })
                    }}
                  >
                    x
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={() => {
                  const newId = `opt_${editingNode.answerOptions.length + 1}`
                  setEditingNode({
                    ...editingNode,
                    answerOptions: [...editingNode.answerOptions, { id: newId, label: 'New Option' }],
                    nextNodeMap: { ...editingNode.nextNodeMap, [newId]: 'COMPLETE' },
                  })
                }}
              >
                + Add Answer
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Routing (nextNodeMap)</Label>
              {Object.entries(editingNode.nextNodeMap).map(([answerId, targetId]) => (
                <div key={answerId} className="flex gap-1 items-center">
                  <span className="text-xs text-muted-foreground w-24 truncate">{answerId}</span>
                  <span className="text-xs">→</span>
                  <Select
                    value={targetId}
                    onValueChange={(v) => {
                      if (v) setEditingNode({
                        ...editingNode,
                        nextNodeMap: { ...editingNode.nextNodeMap, [answerId]: v },
                      })
                    }}
                  >
                    <SelectTrigger className="text-xs flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMPLETE">COMPLETE (end call)</SelectItem>
                      {callNodes.filter(n => n.nodeId !== editingNode.nodeId).map(n => (
                        <SelectItem key={n.nodeId} value={n.nodeId}>
                          {n.nodeName} ({n.nodeId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Follow-Up Probes</Label>
              {editingNode.followUpProbes.map((probe, i) => (
                <div key={i} className="flex gap-1">
                  <Input
                    value={probe}
                    onChange={(e) => {
                      const updated = [...editingNode.followUpProbes]
                      updated[i] = e.target.value
                      setEditingNode({ ...editingNode, followUpProbes: updated })
                    }}
                    className="text-xs"
                  />
                  <Button size="sm" variant="ghost" className="h-8 w-6 p-0 text-destructive"
                    onClick={() => setEditingNode({
                      ...editingNode,
                      followUpProbes: editingNode.followUpProbes.filter((_, j) => j !== i),
                    })}
                  >x</Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={() => setEditingNode({
                  ...editingNode,
                  followUpProbes: [...editingNode.followUpProbes, ''],
                })}
              >
                + Add Probe
              </Button>
            </div>

            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => deleteNode(editingNode.nodeId)}
            >
              Delete Node
            </Button>
          </div>
        ) : selectedNode ? (
          /* VIEW MODE */
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{selectedNode.stage}</Badge>
              <Button size="sm" onClick={startEditing}>Edit</Button>
            </div>

            <h3 className="font-semibold">{selectedNode.nodeName}</h3>
            <p className="text-[10px] text-muted-foreground">{selectedNode.nodeId}</p>

            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs">Prompt</CardTitle></CardHeader>
              <CardContent><p className="text-xs leading-relaxed">{selectedNode.promptText}</p></CardContent>
            </Card>

            <Card className="bg-amber-50 border-amber-200">
              <CardHeader className="pb-1"><CardTitle className="text-xs text-amber-900">Empathy Guidance</CardTitle></CardHeader>
              <CardContent><p className="text-xs text-amber-800">{selectedNode.empathyGuidance}</p></CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-xs">Purpose</CardTitle></CardHeader>
              <CardContent><p className="text-xs text-muted-foreground">{selectedNode.purposeText}</p></CardContent>
            </Card>

            <div>
              <p className="text-xs font-semibold mb-1">Answers ({selectedNode.answerOptions.length})</p>
              {selectedNode.answerOptions.map(opt => (
                <div key={opt.id} className="flex justify-between items-center text-xs py-1 border-b">
                  <span>{opt.label}</span>
                  <span className="text-muted-foreground">→ {selectedNode.nextNodeMap[opt.id] || '?'}</span>
                </div>
              ))}
            </div>

            {selectedNode.followUpProbes.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1">Follow-Up Probes</p>
                {selectedNode.followUpProbes.map((p, i) => (
                  <p key={i} className="text-xs text-muted-foreground">• {p}</p>
                ))}
              </div>
            )}

            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => deleteNode(selectedNode.nodeId)}
            >
              Delete Node
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
