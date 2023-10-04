import * as E from 'effect'
import * as S from '@effect/schema/Schema'
import * as Rx from 'rxjs'

import { buildUseObservable } from './buildUseObservable'
import {
  Direction,
  DirectionKeySchema,
  GameEvent,
  GameState,
  determineNextGameState,
  getRandomApplePosition,
  keyToDirection,
  SnakePosition,
  toOppositeDirection,
} from './model'
import {
  BOARD_SIZE,
  GAME_INTERVAL_DECREASE_PER_POINT_MS,
  GAME_INTERVAL_MS,
  MIN_GAME_INTERVAL_MS,
} from './constants'

const initialSnakePosition: SnakePosition = E.Chunk.fromIterable([
  E.Data.tuple(9, 10),
  E.Data.tuple(10, 10),
  E.Data.tuple(11, 10),
  E.Data.tuple(12, 10),
  E.Data.tuple(13, 10),
])

const initialApplePosition = getRandomApplePosition(BOARD_SIZE)

const initialDirection: Direction = 'Left'

const initialPoints = 0

const initialGameStatus = 'NotStarted'

const initialGameState: GameState = {
  snakePosition: initialSnakePosition,
  applePosition: initialApplePosition,
  points: initialPoints,
  gameStatus: initialGameStatus,
}

const keyDown$ = Rx.fromEvent<KeyboardEvent>(document, 'keydown')
const spaceBarDown$ = keyDown$.pipe(
  Rx.filter(({ key }) => {
    return key === ' '
  }),
)

const directionKeyPress$ = keyDown$.pipe(
  Rx.map(({ key }) => key),
  Rx.filter(DirectionKeySchema.pipe(S.is)),
)

const gameStateSubject$ = new Rx.Subject<GameState>()

const direction$: Rx.Observable<Direction> = directionKeyPress$.pipe(
  Rx.withLatestFrom(gameStateSubject$),
  Rx.filter(([_, { gameStatus }]) => gameStatus === 'Playing'),
  Rx.map(([key]) => key),
  Rx.map(keyToDirection),
  Rx.startWith(initialDirection),
  Rx.scan((acc, curr) => {
    return toOppositeDirection(curr) === acc ? acc : curr
  }),
)

const clockTick$ = gameStateSubject$.pipe(
  Rx.switchMap(({ points, gameStatus }) => {
    if (gameStatus !== 'Playing') {
      return Rx.NEVER
    } else {
      const gameIntervalMs = Math.max(
        GAME_INTERVAL_MS - points * GAME_INTERVAL_DECREASE_PER_POINT_MS,
        MIN_GAME_INTERVAL_MS,
      )
      return Rx.interval(gameIntervalMs)
    }
  }),
)

const gameEvent$: Rx.Observable<GameEvent> = Rx.merge(
  clockTick$.pipe(Rx.map(() => ({ kind: 'ClockTick' }) as const)),
  spaceBarDown$.pipe(Rx.map(() => ({ kind: 'SpaceBarDown' }) as const)),
)

const gameState$: Rx.Observable<GameState> = gameEvent$.pipe(
  Rx.withLatestFrom(direction$),
  Rx.scan(
    (gameState, [gameEvent, direction]) =>
      determineNextGameState(BOARD_SIZE, direction, gameEvent, gameState),
    initialGameState,
  ),
  Rx.startWith(initialGameState),
  Rx.takeWhile(({ gameStatus }) => gameStatus !== 'GameOver', true),
  Rx.repeat({ delay: () => spaceBarDown$ }),
  Rx.observeOn(Rx.animationFrameScheduler),
)

gameState$.subscribe((gameState) => {
  gameStateSubject$.next(gameState)
})

export const useGameState = buildUseObservable(
  gameStateSubject$,
  initialGameState,
)
