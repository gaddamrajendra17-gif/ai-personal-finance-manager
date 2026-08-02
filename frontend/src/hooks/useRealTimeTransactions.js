import { useEffect, useRef } from 'react'

export default function useRealTimeTransactions(onNewTransaction) {
  const callbackRef = useRef(onNewTransaction)
  
  useEffect(() => {
    callbackRef.current = onNewTransaction
  }, [onNewTransaction])

  useEffect(() => {
    const handler = (e) => {
      if (callbackRef.current) {
        callbackRef.current(e.detail)
      }
    }

    window.addEventListener('new-transaction-event', handler)
    return () => {
      window.removeEventListener('new-transaction-event', handler)
    }
  }, [])
}
