import * as E from 'effect'
import * as S from '@effect/schema/Schema'

// --
// Model is all types and pure functions
// --

// -- WORLD

export type World = {
  snakePosition: E.Chunk.Chunk<Cell>
  applePosition: Cell
  points: number
  gameState: GameState
}

export type GameState = 'NotStarted' | 'Playing' | 'Paused' | 'GameOver'

export type Board = E.Chunk.Chunk<Row>
export type Row = E.Chunk.Chunk<Cell>
export type Cell = E.Data.Data<[number, number]>

// -- DIRECTION

export type Direction = 'Up' | 'Down' | 'Left' | 'Right'
export type DirectionKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
export const DirectionKeySchema: S.Schema<DirectionKey> = S.literal(
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
)

export const keyToDirection = (key: DirectionKey): Direction => {
  switch (key) {
    case 'ArrowUp':
      return 'Up'
    case 'ArrowDown':
      return 'Down'
    case 'ArrowLeft':
      return 'Left'
    case 'ArrowRight':
      return 'Right'
  }
}

export const toOppositeDirection = (direction: Direction): Direction => {
  switch (direction) {
    case 'Up':
      return 'Down'
    case 'Down':
      return 'Up'
    case 'Left':
      return 'Right'
    case 'Right':
      return 'Left'
  }
}

// -- RANDOM

const getRandomCoordinateComponent = (boardSize: number): number => {
  return Math.floor(Math.random() * boardSize)
}

export const getRandomApplePosition = (boardSize: number): Cell => {
  return E.Data.tuple(
    getRandomCoordinateComponent(boardSize),
    getRandomCoordinateComponent(boardSize),
  )
}

// -- GAME LOGIC

const isCollidingWithSelfTask = (snakePosition: E.Chunk.Chunk<Cell>) =>
  E.Effect.gen(function* (_) {
    const head = yield* _(chunkHeadTask(snakePosition))
    const tail = yield* _(chunkTailTask(snakePosition))

    return tail.pipe(E.Chunk.contains(head))
  })

const isCollidingWithWallTask = (
  boardSize: number,
  snake: E.Chunk.Chunk<Cell>,
) =>
  E.Effect.gen(function* (_) {
    const head = yield* _(chunkHeadTask(snake))

    return !isInBoard(boardSize)(head)
  })

const isInBoard =
  (boardSize: number) =>
  ([x, y]: Cell): boolean =>
    x >= 0 && x < boardSize && y >= 0 && y < boardSize

const isCollidingTask = (
  boardSize: number,
  snakePosition: E.Chunk.Chunk<Cell>,
) =>
  E.Effect.gen(function* (_) {
    const isCollidingWithSelf = yield* _(isCollidingWithSelfTask(snakePosition))
    const isCollidingWithWall = yield* _(
      isCollidingWithWallTask(boardSize, snakePosition),
    )

    return isCollidingWithSelf || isCollidingWithWall
  })

// These errors are contrived, but useful for demonstration

class ChunkMissingHeadError {
  readonly _tag = 'ChunkMissingHeadError'
}

const chunkHeadTask = <T>(chunk: E.Chunk.Chunk<T>) =>
  chunk.pipe(
    E.Chunk.head,
    E.Option.match({
      onNone: () => E.Effect.fail(new ChunkMissingHeadError()),
      onSome: E.Effect.succeed,
    }),
  )

class ChunkMissingTailError {
  readonly _tag = 'ChunkMissingTailError'
}

const chunkTailTask = <T>(chunk: E.Chunk.Chunk<T>) =>
  chunk.pipe(
    E.Chunk.tail,
    E.Option.match({
      onNone: () => E.Effect.fail(new ChunkMissingTailError()),
      onSome: E.Effect.succeed,
    }),
  )

export type GameEvent = ClockTick | ChangeGameState
type ClockTick = { kind: 'ClockTick' }
type ChangeGameState = { kind: 'ChangeGameState' }

export const determineNextWorldProgram = (
  boardSize: number,
  direction: Direction,
  gameEvent: GameEvent,
  world: World,
) =>
  E.Effect.gen(function* (_) {
    switch (gameEvent.kind) {
      case 'ClockTick': {
        const { snakePosition, applePosition, points } = world

        const head = yield* _(chunkHeadTask(snakePosition))

        const nextHead = determineNextHead(direction)(head)

        const isNextHeadOnApple = E.Equal.equals(nextHead)(applePosition)

        const nextApplePosition = isNextHeadOnApple
          ? getRandomApplePosition(boardSize)
          : applePosition

        const maybeWithoutTail = isNextHeadOnApple
          ? snakePosition
          : snakePosition.pipe(E.Chunk.dropRight(1))

        const nextSnakePosition = maybeWithoutTail.pipe(
          E.Chunk.prepend(nextHead),
        )

        const isGameOver = yield* _(
          isCollidingTask(boardSize, nextSnakePosition),
        )

        return E.pipe(
          isGameOver,
          E.Boolean.match({
            onFalse: () => {
              const nextPoints = isNextHeadOnApple ? points + 1 : points

              return {
                ...world,
                snakePosition: nextSnakePosition,
                applePosition: nextApplePosition,
                points: nextPoints,
              }
            },
            onTrue: () => {
              return {
                ...world,
                gameState: 'GameOver' as const,
              }
            },
          }),
        )
      }

      case 'ChangeGameState': {
        switch (world.gameState) {
          case 'Playing': {
            return {
              ...world,
              gameState: 'Paused' as const,
            }
          }

          case 'NotStarted':
          case 'Paused':
          case 'GameOver': {
            return {
              ...world,
              gameState: 'Playing' as const,
            }
          }
        }
      }
    }
  }).pipe(E.Effect.onError(E.Console.error))

const determineNextHead =
  (direction: Direction) =>
  ([x, y]: Cell): Cell => {
    switch (direction) {
      case 'Up':
        return E.Data.tuple(x, y - 1)
      case 'Down':
        return E.Data.tuple(x, y + 1)
      case 'Left':
        return E.Data.tuple(x - 1, y)
      case 'Right':
        return E.Data.tuple(x + 1, y)
    }
  }

export const matchGameState =
  <T extends unknown>({
    onNotStarted,
    onPlaying,
    onPaused,
    onGameOver,
  }: {
    onNotStarted: () => T
    onPlaying: () => T
    onPaused: () => T
    onGameOver: () => T
  }) =>
  (gameState: GameState): T => {
    switch (gameState) {
      case 'NotStarted':
        return onNotStarted()
      case 'Playing':
        return onPlaying()
      case 'Paused':
        return onPaused()
      case 'GameOver':
        return onGameOver()
    }
  }
