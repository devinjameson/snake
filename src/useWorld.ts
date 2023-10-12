import * as E from 'effect'
import * as S from '@effect/schema/Schema'
import * as Rx from 'rxjs'

import { buildUseLastEmittedValue } from './buildUseLastEmittedValue'
import {
  Direction,
  DirectionKeySchema,
  GameEvent,
  World,
  determineNextWorldProgram,
  getRandomApplePosition,
  keyToDirection,
  SnakePosition,
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

const initialSnakePosition: SnakePosition = E.Chunk.fromIterable([
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

// We will push world values into this subject, as well as use it to define
// other observables

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

const direction$: Rx.Observable<Direction> = directionKeyPress$.pipe(
  Rx.withLatestFrom(world$),
  // User can only change direction when gameState is 'Playing'
  Rx.filter(([_, { gameState }]) => gameState === 'Playing'),
  Rx.map(([key]) => key),
  Rx.map(keyToDirection),
  // Don't allow the user to change to the opposite direction
  Rx.scan((acc, curr) => {
    return toOppositeDirection(curr) === acc ? acc : curr
  }),
  Rx.startWith(initialDirection),
)

// -- GAME EVENTS

// Merge game events into a single stream

const gameEvent$: Rx.Observable<GameEvent> = Rx.merge(
  clockTick$.pipe(Rx.map(() => ({ kind: 'ClockTick' }) as const)),
  spaceBarDown$.pipe(Rx.map(() => ({ kind: 'SpaceBarDown' }) as const)),
)

// Transform game events to world values and push them into world$

gameEvent$
  .pipe(
    Rx.withLatestFrom(direction$),
    // Scan is like reduce, but it emits the intermediate values
    Rx.scan((world, [gameEvent, direction]) => {
      return E.Effect.runSync(
        determineNextWorldProgram(BOARD_SIZE, direction, gameEvent, world),
      )
    }, initialWorld),
    Rx.startWith(initialWorld),
    // Complete with gameState is 'GameOver'
    Rx.takeWhile(({ gameState }) => gameState !== 'GameOver', true),
    // Restart the game when the space bar is pressed
    Rx.repeat({ delay: () => spaceBarDown$ }),
    Rx.observeOn(Rx.animationFrameScheduler),
  )
  .subscribe((world) => {
    world$.next(world)
  })

export const useWorld = buildUseLastEmittedValue(world$, initialWorld)
