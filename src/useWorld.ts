import * as E from 'effect'
import * as S from '@effect/schema/Schema'
import * as Rx from 'rxjs'

import { buildUseLastEmittedValue } from './buildUseLastEmittedValue'
import {
  Direction,
  DirectionKeySchema,
  World,
  determineNextWorldProgram,
  getRandomApplePosition,
  keyToDirection,
  toOppositeDirection,
  GameState,
  Cell,
} from './model'
import {
  BOARD_SIZE,
  GAME_INTERVAL_DECREASE_PER_POINT_MS,
  GAME_INTERVAL_MS,
  MIN_GAME_INTERVAL_MS,
} from './constants'

// -- INITIAL WORLD

const initialSnakePosition = E.Chunk.fromIterable([
  E.Data.tuple(9, 10),
  E.Data.tuple(10, 10),
  E.Data.tuple(11, 10),
  E.Data.tuple(12, 10),
  E.Data.tuple(13, 10),
])

const initialApplePosition: Cell = getRandomApplePosition(BOARD_SIZE)
const initialDirection: Direction = 'Left'
const initialPoints = 0
const initialGameState: GameState = 'NotStarted'

const initialWorld: World = {
  snakePosition: initialSnakePosition,
  applePosition: initialApplePosition,
  points: initialPoints,
  gameState: initialGameState,
}

// -- WORLD SUBJECT

const world$ = new Rx.Subject<World>()

// -- CLOCK

const clockTick$ = world$.pipe(
  Rx.switchMap(({ points, gameState }) => {
    if (gameState !== 'Playing') {
      // Pause the clock when the game is not in the 'Playing' state
      return Rx.NEVER
    } else {
      // Decrease the interval between clock ticks as the score increases
      const gameIntervalMs = Math.max(
        GAME_INTERVAL_MS - points * GAME_INTERVAL_DECREASE_PER_POINT_MS,
        MIN_GAME_INTERVAL_MS,
      )
      return Rx.interval(gameIntervalMs)
    }
  }),
)

// -- DIRECTION

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

const direction$ = directionKeyPress$
  .pipe(
    Rx.withLatestFrom(world$),
    Rx.filter(([_, { gameState }]) => gameState === 'Playing'),
    Rx.map(([key]) => key),
    Rx.map(keyToDirection),
    Rx.buffer(clockTick$),
    Rx.map(E.Chunk.fromIterable),
    Rx.map(E.Chunk.last),
    Rx.filter(E.Option.isSome),
    Rx.map(({ value }) => value),
  )
  .pipe(
    Rx.scan<Direction, Direction>(
      (curr, next) => (toOppositeDirection(next) === curr ? curr : next),
      initialDirection,
    ),
    Rx.startWith<Direction>(initialDirection),
  )

// -- GAME EVENTS

const gameEvent$ = Rx.merge(
  clockTick$.pipe(Rx.map(() => ({ kind: 'ClockTick' }) as const)),
  spaceBarDown$.pipe(Rx.map(() => ({ kind: 'SpaceBarDown' }) as const)),
)

gameEvent$
  .pipe(
    Rx.withLatestFrom(direction$),
    Rx.scan((world, [gameEvent, direction]) => {
      return E.Effect.runSync(
        determineNextWorldProgram(BOARD_SIZE, direction, gameEvent, world),
      )
    }, initialWorld),
    Rx.startWith(initialWorld),
    Rx.takeWhile(({ gameState }) => gameState !== 'GameOver', true),
    Rx.repeat({ delay: () => spaceBarDown$ }),
    Rx.observeOn(Rx.animationFrameScheduler),
  )
  .subscribe((world) => {
    world$.next(world)
  })

export const useWorld = buildUseLastEmittedValue(world$, initialWorld)
