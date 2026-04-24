import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

// Diarized transcript with speaker-labeled lines (not bubbles).
// Click a timestamp to seek; highlightQuote lights up matching segments.

export interface TranscriptSegment {
  speaker: string
  start: number // seconds
  end: number
  text: string
}

interface TranscriptViewerProps {
  segments: TranscriptSegment[]
  highlightQuote?: string
  onSeek?: (ts: number) => void
  autoScroll?: boolean
  className?: string
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function matchesHighlight(text: string, quote?: string): boolean {
  if (!quote) return false
  const t = text.toLowerCase()
  const q = quote.toLowerCase().trim()
  if (!q) return false
  // Match whole quote OR a sliding window of the first 40 chars.
  return t.includes(q) || (q.length > 40 && t.includes(q.slice(0, 40)))
}

export function TranscriptViewer({
  segments,
  highlightQuote,
  onSeek,
  autoScroll = false,
  className,
}: TranscriptViewerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [autoScroll, segments.length])

  return (
    <div
      ref={scrollRef}
      className={cn(
        'overflow-y-auto rounded-lg border border-[#26251F] bg-[#141412]',
        className,
      )}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#26251F] bg-[#141412]/95 px-4 py-2 backdrop-blur-sm">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[#8A897F]">
          Transcript
        </div>
        <div className="font-mono text-[11px] text-[#8A897F]">
          {segments.length} segments
        </div>
      </div>
      <div className="px-4 py-3">
        {segments.map((seg, i) => {
          const hit = matchesHighlight(seg.text, highlightQuote)
          return (
            <div
              key={i}
              className={cn(
                'mb-2 grid grid-cols-[56px_60px_1fr] gap-2 rounded-md px-2 py-1 transition-colors',
                hit && 'border-l-2 border-[#6B8DFF] bg-[#1B1930] pl-1.5',
              )}
            >
              <button
                type="button"
                onClick={() => onSeek?.(seg.start)}
                className="text-left font-mono text-[11px] text-[#8A897F] transition-colors hover:text-[#6B8DFF]"
                aria-label={`Seek to ${formatTimestamp(seg.start)}`}
              >
                [{formatTimestamp(seg.start)}]
              </button>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A897F]">
                {seg.speaker}:
              </span>
              <span className="text-[13px] leading-[1.5] text-[#EDECE5]">
                {seg.text}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export default TranscriptViewer
