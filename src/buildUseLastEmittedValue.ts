import { useEffect, useState } from 'react'

import * as Rx from 'rxjs'

export const buildUseLastEmittedValue = <T extends NonNullable<unknown>>(
  observable$: Rx.Observable<T>,
  initialState: T,
): (() => T) => {
  return () => useObservable(observable$, initialState)
}

const useObservable = <T>(
  observable$: Rx.Observable<T>,
  initialState: T,
): T => {
  const [lastEmittedValue, setLastEmittedValue] = useState<T>(initialState)

  useEffect(() => {
    const subscription = observable$.subscribe(setLastEmittedValue)

    return () => {
      subscription.unsubscribe()
    }
  }, [observable$])

  return lastEmittedValue
}
