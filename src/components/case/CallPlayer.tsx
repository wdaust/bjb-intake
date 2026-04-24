import { useEffect, useRef, useState } from 'react'
import { Play, Pause, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

// Reusable audio player + live-synced transcript pane. Feed it an audio
// src and a list of time-coded transcript segments; the active segment
// highlights as playback progresses and the pane auto-scrolls to follow.

export interface CallPlayerSegment {
  speaker: string
  start: number
  end: number
  text: string
}

interface CallPlayerProps {
  src: string
  title: string
  durationLabel?: string
  segments: CallPlayerSegment[]
  onComplete?: () => void
  onPlayingChange?: (playing: boolean) => void
  className?: string
}

function formatTimestamp(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  const m = Math.floor(safe / 60)
  const s = Math.floor(safe % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function CallPlayer({
  src,
  title,
  durationLabel,
  segments,
  onComplete,
  onPlayingChange,
  className,
}: CallPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const segmentRefs = useRef<Array<HTMLDivElement | null>>([])

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [completedOnce, setCompletedOnce] = useState(false)

  // Active segment = last segment whose start <= t. Guarantees a value
  // while the audio is within any segment window, including tail silence.
  const activeIndex = (() => {
    if (segments.length === 0) return -1
    let idx = -1
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      if (!seg) continue
      if (currentTime >= seg.start) idx = i
      else break
    }
    return idx
  })()

  // Auto-scroll the active segment into view within the right pane.
  useEffect(() => {
    if (activeIndex < 0) return
    const el = segmentRefs.current[activeIndex]
    const pane = scrollRef.current
    if (!el || !pane) return
    const paneRect = pane.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const fullyVisible =
      elRect.top >= paneRect.top && elRect.bottom <= paneRect.bottom
    if (!fullyVisible) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeIndex])

  useEffect(() => {
    onPlayingChange?.(playing)
  }, [playing, onPlayingChange])

  // Audio event wiring.
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => setCurrentTime(a.currentTime)
    const onMeta = () => setDuration(a.duration || 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      setPlaying(false)
      if (!completedOnce) {
        setCompletedOnce(true)
        onComplete?.()
      }
    }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('ended', onEnded)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('ended', onEnded)
    }
  }, [completedOnce, onComplete])

  const togglePlay = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      void a.play()
    } else {
      a.pause()
    }
  }

  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current
    if (!a) return
    const next = Number(e.target.value)
    a.currentTime = next
    setCurrentTime(next)
  }

  const seekTo = (t: number) => {
    const a = audioRef.current
    if (!a) return
    a.currentTime = t
    setCurrentTime(t)
  }

  const totalLabel = durationLabel ?? formatTimestamp(duration)
  const progressPct =
    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-border bg-card',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[12px] font-medium text-foreground">
            {title}
          </span>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {segments.length} segments
        </span>
      </div>

      {/* Split body: controls column on the left, synced transcript right */}
      <div className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-border">
        {/* Left — artwork + controls */}
        <div className="flex flex-col justify-between gap-5 p-5">
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div
              className={cn(
                'flex h-32 w-32 items-center justify-center rounded-full border border-border bg-card transition-colors',
                playing && 'border-ring/40 bg-ring/10',
              )}
            >
              <WaveformIcon playing={playing} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? 'Pause' : 'Play'}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-ring text-background transition-colors hover:bg-ring/90"
              >
                {playing ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="ml-[2px] h-4 w-4" />
                )}
              </button>
              <div className="flex-1">
                <div className="relative h-1 w-full rounded-full bg-border">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-ring/80"
                    style={{ width: `${progressPct}%` }}
                  />
                  <input
                    aria-label="Seek"
                    type="range"
                    min={0}
                    max={Math.max(duration, 0.1)}
                    step={0.1}
                    value={currentTime}
                    onChange={onScrub}
                    className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>{formatTimestamp(currentTime)}</span>
              <span>{totalLabel}</span>
            </div>
          </div>

          <audio ref={audioRef} src={src} preload="metadata" />
        </div>

        {/* Right — live-synced transcript */}
        <div
          ref={scrollRef}
          className="max-h-[400px] min-h-[320px] overflow-y-auto p-4"
        >
          <div className="space-y-1.5">
            {segments.map((seg, i) => {
              const active = i === activeIndex
              return (
                <div
                  key={i}
                  ref={(el) => {
                    segmentRefs.current[i] = el
                  }}
                  onClick={() => seekTo(seg.start)}
                  className={cn(
                    'grid cursor-pointer grid-cols-[52px_56px_1fr] gap-2 rounded-md border-l-2 px-2 py-1 transition-colors',
                    active
                      ? 'border-ring bg-ring/10'
                      : 'border-transparent hover:bg-card',
                  )}
                >
                  <span
                    className={cn(
                      'font-mono text-[11px]',
                      active ? 'text-ring' : 'text-muted-foreground',
                    )}
                  >
                    [{formatTimestamp(seg.start)}]
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-bold uppercase tracking-wider',
                      active ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {seg.speaker}:
                  </span>
                  <span
                    className={cn(
                      'text-[12px] leading-[1.5]',
                      active ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {seg.text}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function WaveformIcon({ playing }: { playing: boolean }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      {[6, 12, 18, 24, 30].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={20 - (i % 2 === 0 ? 8 : 4)}
          width={2}
          height={(i % 2 === 0 ? 8 : 4) * 2}
          rx={1}
          fill={playing ? 'var(--ring)' : 'var(--muted-foreground)'}
          style={{
            animation: playing ? `cp-bounce 1.1s ease-in-out infinite` : undefined,
            animationDelay: `${i * 0.12}s`,
            transformOrigin: '50% 50%',
          }}
        />
      ))}
      <style>{`@keyframes cp-bounce { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(0.5) } }`}</style>
    </svg>
  )
}

export default CallPlayer
