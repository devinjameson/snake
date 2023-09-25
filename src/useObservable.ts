import {useEffect, useState} from 'react'

import * as Rx from 'rxjs'

export const useObservable = <T extends NonNullable<unknown>>(
  observable$: Rx.Observable<T>,
  initialState: T,
): T => {
  const [state, setState] = useState<T>(initialState)

  useEffect(() => {
    const subscription = observable$.subscribe(setState)

    return () => {
      subscription.unsubscribe()
    }
  }, [observable$])

  return state
}
