import { createContext, useContext, useState, type ReactNode } from 'react'
import type { FullCaseView } from '@/types'

interface QueueContextType {
  queue: FullCaseView[]
  setQueue: (cases: FullCaseView[]) => void
  currentIndex: number
  setCurrentIndex: (i: number) => void
  currentCase: FullCaseView | undefined
  nextCase: FullCaseView | undefined
  prevCase: FullCaseView | undefined
  goNext: () => string | null  // returns caseId or null
  goPrev: () => string | null
  cmName: string
  cmId: string
}

const QueueContext = createContext<QueueContextType>({
  queue: [], setQueue: () => {}, currentIndex: -1, setCurrentIndex: () => {},
  currentCase: undefined, nextCase: undefined, prevCase: undefined,
  goNext: () => null, goPrev: () => null, cmName: '', cmId: '',
})

// Default demo CM: Cassandra Spanato
const DEFAULT_CM_ID = '005Pp000002WJxdIAG'
const DEFAULT_CM_NAME = 'Cassandra Spanato'

export function QueueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<FullCaseView[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)

  const currentCase = currentIndex >= 0 ? queue[currentIndex] : undefined
  const nextCase = currentIndex < queue.length - 1 ? queue[currentIndex + 1] : undefined
  const prevCase = currentIndex > 0 ? queue[currentIndex - 1] : undefined

  function goNext(): string | null {
    if (currentIndex < queue.length - 1) {
      const next = currentIndex + 1
      setCurrentIndex(next)
      return queue[next].caseData.id
    }
    return null
  }

  function goPrev(): string | null {
    if (currentIndex > 0) {
      const prev = currentIndex - 1
      setCurrentIndex(prev)
      return queue[prev].caseData.id
    }
    return null
  }

  return (
    <QueueContext.Provider value={{
      queue, setQueue, currentIndex, setCurrentIndex,
      currentCase, nextCase, prevCase, goNext, goPrev,
      cmName: DEFAULT_CM_NAME, cmId: DEFAULT_CM_ID,
    }}>
      {children}
    </QueueContext.Provider>
  )
}

export function useQueue() {
  return useContext(QueueContext)
}

export { DEFAULT_CM_ID, DEFAULT_CM_NAME }
