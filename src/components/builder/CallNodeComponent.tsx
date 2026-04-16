import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

const STAGE_COLORS: Record<string, string> = {
  opening: 'border-blue-400 bg-blue-50',
  treatment_status: 'border-green-400 bg-green-50',
  symptoms: 'border-purple-400 bg-purple-50',
  appointments: 'border-cyan-400 bg-cyan-50',
  barriers: 'border-orange-400 bg-orange-50',
  progression: 'border-teal-400 bg-teal-50',
  direction: 'border-indigo-400 bg-indigo-50',
  next_step: 'border-emerald-400 bg-emerald-50',
  closeout: 'border-gray-400 bg-gray-50',
}

const STAGE_LABELS: Record<string, string> = {
  opening: 'Opening',
  treatment_status: 'Treatment',
  symptoms: 'Symptoms',
  appointments: 'Appointments',
  barriers: 'Barriers',
  progression: 'Progression',
  direction: 'Direction',
  next_step: 'Next Step',
  closeout: 'Close-out',
}

interface CallNodeData {
  nodeId: string
  nodeName: string
  stage: string
  promptText: string
  answerCount: number
  isComplete: boolean // has COMPLETE exit
  [key: string]: unknown
}

function CallNodeComponent({ data, selected }: NodeProps & { data: CallNodeData }) {
  const colors = STAGE_COLORS[data.stage] || 'border-gray-300 bg-white'

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400" />
      <div
        className={`rounded-lg border-2 shadow-sm px-3 py-2 min-w-[180px] max-w-[220px] cursor-pointer transition-shadow ${colors} ${
          selected ? 'ring-2 ring-primary shadow-md' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            {STAGE_LABELS[data.stage] || data.stage}
          </span>
          <span className="text-[9px] bg-white/80 rounded px-1.5 py-0.5 font-medium">
            {data.answerCount} answer{data.answerCount !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-xs font-semibold leading-tight truncate">{data.nodeName}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-tight">
          {data.promptText.slice(0, 80)}{data.promptText.length > 80 ? '...' : ''}
        </p>
        {data.isComplete && (
          <span className="text-[9px] bg-green-200 text-green-800 rounded px-1 mt-1 inline-block">EXIT</span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-gray-400" />
    </>
  )
}

export default memo(CallNodeComponent)
