import { Target, Gavel, XCircle, ArrowRightLeft, HelpCircle } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  trackChipClass,
  trackLabel,
  type CaseTrack,
  type CaseTrackInfo,
} from '@/lib/caseTrack'

const ICON_FOR_TRACK: Record<CaseTrack, React.ComponentType<{ className?: string }>> = {
  rfd: Target,
  litigation: Gavel,
  cut: XCircle,
  transfer: ArrowRightLeft,
  unset: HelpCircle,
}

interface TrackChipProps {
  info: CaseTrackInfo
  /** Compact = label only; default also shows progress %. */
  variant?: 'default' | 'compact'
  className?: string
}

export function TrackChip({ info, variant = 'default', className }: TrackChipProps) {
  const Icon = ICON_FOR_TRACK[info.track]
  const showProgress =
    variant === 'default' && info.track !== 'cut' && info.track !== 'transfer'

  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-medium',
        trackChipClass(info.track),
        className,
      )}
      title={info.reason}
    >
      <Icon className="h-3 w-3" />
      <span>{trackLabel(info.track)}</span>
      {showProgress && (
        <span className="opacity-70">· {info.progress}%</span>
      )}
    </span>
  )
}
