import * as E from 'effect'
import * as S from '@effect/schema/Schema'

export type World = {
  snakePosition: SnakePosition
  applePosition: ApplePosition
  points: number
  gameState: GameState
}

export type GameState = 'NotStarted' | 'Playing' | 'Paused' | 'GameOver'

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

export type SnakePosition = E.Chunk.Chunk<Cell>
export type ApplePosition = Cell

export type Board = E.Chunk.Chunk<Row>
export type Row = E.Chunk.Chunk<Cell>
export type Cell = E.Data.Data<[number, number]>

export type GameEvent = ClockTick | SpaceBarDown
type ClockTick = { kind: 'ClockTick' }
type SpaceBarDown = { kind: 'SpaceBarDown' }

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

const getRandomCoordinateComponent = (boardSize: number): number => {
  return Math.floor(Math.random() * boardSize)
}

export const getRandomApplePosition = (boardSize: number): ApplePosition => {
  return E.Data.tuple(
    getRandomCoordinateComponent(boardSize),
    getRandomCoordinateComponent(boardSize),
  )
}

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

const isCollidingWithSelf = (snake: SnakePosition): boolean => {
  return E.pipe(
    E.Option.Do,
    E.Option.bind('head', () => snake.pipe(E.Chunk.head)),
    E.Option.bind('tail', () => snake.pipe(E.Chunk.tail)),
    E.Option.map(({ head, tail }) => {
      return tail.pipe(E.Chunk.contains(head))
    }),
    E.Option.getOrThrowWith(() => new Error('Snake has no head or no tail!')),
  )
}

const isCollidingWithWall = (
  boardSize: number,
  snake: SnakePosition,
): boolean => {
  return snake.pipe(
    E.Chunk.head,
    E.Option.map(
      E.flow(
        E.Chunk.fromIterable,
        E.Chunk.some<number>((xy) => xy < 0 || xy >= boardSize),
      ),
    ),
    E.Option.getOrElse(() => false),
  )
}

const isColliding = (boardSize: number, snake: SnakePosition): boolean => {
  return isCollidingWithSelf(snake) || isCollidingWithWall(boardSize, snake)
}

export const determineNextWorld = (
  boardSize: number,
  direction: Direction,
  gameEvent: GameEvent,
  world: World,
): World => {
  switch (gameEvent.kind) {
    case 'ClockTick': {
      const { snakePosition, applePosition, points } = world

      const head = snakePosition.pipe(E.Chunk.head)

      const nextHead = head.pipe(
        E.Option.map(determineNextHead(direction)),
        E.Option.getOrThrowWith(() => new Error('Snake has no head')),
      )

      const isNextHeadOnApple = E.Equal.equals(nextHead)(applePosition)

      const nextApplePosition = isNextHeadOnApple
        ? getRandomApplePosition(boardSize)
        : applePosition

      const maybeWithoutTail = isNextHeadOnApple
        ? snakePosition
        : snakePosition.pipe(E.Chunk.dropRight(1))

      const nextSnakePosition = maybeWithoutTail.pipe(E.Chunk.prepend(nextHead))

      const isOver = isColliding(boardSize, nextSnakePosition)

      if (isOver) {
        return {
          ...world,
          gameState: 'GameOver',
        }
      } else {
        const nextPoints = isNextHeadOnApple ? points + 1 : points

        return {
          ...world,
          snakePosition: nextSnakePosition,
          applePosition: nextApplePosition,
          points: nextPoints,
        }
      }
    }

    case 'SpaceBarDown': {
      switch (world.gameState) {
        case 'NotStarted': {
          return {
            ...world,
            gameState: 'Playing',
          }
        }
        case 'Playing': {
          return {
            ...world,
            gameState: 'Paused',
          }
        }
        case 'Paused': {
          return {
            ...world,
            gameState: 'Playing',
          }
        }
        case 'GameOver': {
          return {
            ...world,
            gameState: 'Playing',
          }
        }
      }
    }
  }
}
