import * as E from 'effect'
import * as S from '@effect/schema/Schema'
import * as Rx from 'rxjs'

import { buildUseLastEmittedValue } from './buildUseLastEmittedValue'
import {
  Direction,
  DirectionKeySchema,
  GameEvent,
  World,
  determineNextWorld,
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

const initialGameState = 'NotStarted'

const initialWorld: World = {
  snakePosition: initialSnakePosition,
  applePosition: initialApplePosition,
  points: initialPoints,
  gameState: initialGameState,
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

const world$ = new Rx.Subject<World>()

const direction$: Rx.Observable<Direction> = directionKeyPress$.pipe(
  Rx.withLatestFrom(world$),
  Rx.filter(([_, { gameState }]) => gameState === 'Playing'),
  Rx.map(([key]) => key),
  Rx.map(keyToDirection),
  Rx.startWith(initialDirection),
  Rx.scan((acc, curr) => {
    return toOppositeDirection(curr) === acc ? acc : curr
  }),
)

const clockTick$ = world$.pipe(
  Rx.switchMap(({ points, gameState }) => {
    if (gameState !== 'Playing') {
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

gameEvent$
  .pipe(
    Rx.withLatestFrom(direction$),
    Rx.scan(
      (world, [gameEvent, direction]) =>
        determineNextWorld(BOARD_SIZE, direction, gameEvent, world),
      initialWorld,
    ),
    Rx.startWith(initialWorld),
    Rx.takeWhile(({ gameState }) => gameState !== 'GameOver', true),
    Rx.repeat({ delay: () => spaceBarDown$ }),
    Rx.observeOn(Rx.animationFrameScheduler),
  )
  .subscribe((world) => {
    world$.next(world)
  })

export const useWorld = buildUseLastEmittedValue(world$, initialWorld)
