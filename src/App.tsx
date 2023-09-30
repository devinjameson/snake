import * as E from 'effect'
import * as S from '@effect/schema/Schema'
import * as Rx from 'rxjs'
import cn from 'classnames'

import { useObservable } from './useObservable'

// Model

type Game = {
  snakePosition: SnakePosition
  applePosition: ApplePosition
  direction: Direction
  score: number
  isOver: boolean
}

type SnakePosition = E.Chunk.Chunk<Cell>

type ApplePosition = Cell

type Cell = E.Data.Data<[number, number]>

type Direction = 'Up' | 'Down' | 'Left' | 'Right'

type DirectionKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

type Row = E.Chunk.Chunk<Cell>

type Board = E.Chunk.Chunk<Row>

// Constants

const BOARD_SIZE = 20

const board: Board = E.Chunk.makeBy(BOARD_SIZE, (x) =>
  E.Chunk.makeBy(BOARD_SIZE, (y) => E.Data.tuple(x, y)),
)

const initialSnakePosition: SnakePosition = E.Chunk.fromIterable([
  E.Data.tuple(9, 10),
  E.Data.tuple(10, 10),
  E.Data.tuple(11, 10),
  E.Data.tuple(12, 10),
  E.Data.tuple(13, 10),
])

const initialApplePosition = E.Data.tuple(5, 10)

const initialDirection = 'Left'

const initialGame: Game = {
  snakePosition: initialSnakePosition,
  applePosition: initialApplePosition,
  direction: initialDirection,
  score: 0,
  isOver: false,
}

const GAME_INTERVAL_MS = 250

// Rx

const DirectionKeySchema: S.Schema<DirectionKey> = S.literal(
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
)

const keyToDirection = (key: DirectionKey): Direction => {
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

const directionKeyPress$ = Rx.fromEvent<KeyboardEvent>(
  document,
  'keydown',
).pipe(
  Rx.map(({ key }) => key),
  Rx.filter(DirectionKeySchema.pipe(S.is)),
)

const direction$: Rx.Observable<Direction> = directionKeyPress$.pipe(
  Rx.map(keyToDirection),
)

const clockTick$ = Rx.interval(GAME_INTERVAL_MS)

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

const determineNextGame = (game: Game): Game => {
  const { direction, snakePosition, applePosition, score } = game

  const head = snakePosition.pipe(E.Chunk.head)

  const nextHead = head.pipe(
    E.Option.map(determineNextHead(direction)),
    E.Option.getOrThrowWith(() => new Error('Snake has no head')),
  )

  const isNextHeadOnApple = E.Equal.equals(nextHead)(applePosition)

  const nextApplePosition = isNextHeadOnApple
    ? determineNextApplePosition()
    : applePosition

  const maybeWithoutTail = isNextHeadOnApple
    ? snakePosition
    : snakePosition.pipe(E.Chunk.dropRight(1))

  const nextSnakePosition = maybeWithoutTail.pipe(E.Chunk.prepend(nextHead))

  const nextScore = isNextHeadOnApple ? score + 1 : score

  return {
    ...game,
    snakePosition: nextSnakePosition,
    applePosition: nextApplePosition,
    score: nextScore,
  }
}

const isCollidingWithSelf = (snake: SnakePosition): boolean => {
  return snake.pipe(
    E.Chunk.head,
    E.Option.map((head) => {
      return snake.pipe(E.Chunk.drop(1), E.Chunk.contains(head))
    }),
    E.Option.getOrElse(() => false),
  )
}

const isCollidingWithWall = (snake: SnakePosition): boolean => {
  return snake.pipe(
    E.Chunk.head,
    E.Option.map(
      E.flow(
        E.Chunk.fromIterable,
        E.Chunk.some<number>((xy) => xy < 0 || xy >= BOARD_SIZE),
      ),
    ),
    E.Option.getOrElse(() => false),
  )
}

const isColliding = (snake: SnakePosition): boolean => {
  return isCollidingWithSelf(snake) || isCollidingWithWall(snake)
}

const determineNextApplePosition = (): ApplePosition => {
  const x = Math.floor(Math.random() * BOARD_SIZE)
  const y = Math.floor(Math.random() * BOARD_SIZE)
  return E.Data.tuple(x, y)
}

type Action = ClockTicked | DirectionChanged
type ClockTicked = { kind: 'ClockTicked' }
type DirectionChanged = { kind: 'DirectionChanged'; direction: Direction }

const game$: Rx.Observable<Game> = Rx.merge(
  clockTick$.pipe(Rx.map(() => ({ kind: 'ClockTicked' }) as const)),
  direction$.pipe(
    Rx.map((direction) => ({ kind: 'DirectionChanged', direction }) as const),
  ),
).pipe(
  Rx.scan<Action, Game>((game, action) => {
    switch (action.kind) {
      case 'ClockTicked': {
        return determineNextGame(game)
      }

      case 'DirectionChanged': {
        return {
          ...game,
          direction: action.direction,
        }
      }
    }
  }, initialGame),
  Rx.takeWhile((game) => !isColliding(game.snakePosition)),
  Rx.share(),
)

// View

const App = (): JSX.Element => {
  const { score } = useObservable(game$, initialGame)

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <p className="mb-8 font-bold text-5xl">{score}</p>

      <div className="flex items-center justify-center">
        <div className="flex border-black border divide-x divide-black">
          {board.pipe(
            E.Chunk.map((row, rowIdx) => {
              return <Row row={row} rowIdx={rowIdx} key={rowIdx} />
            }),
          )}
        </div>
      </div>
    </div>
  )
}

const Row = ({ row, rowIdx }: { row: Row; rowIdx: number }): JSX.Element => {
  return (
    <div className="flex flex-col divide-y divide-black">
      {row.pipe(
        E.Chunk.map((_, colIdx) => {
          const cell = E.Data.tuple(rowIdx, colIdx)
          return <Cell cell={cell} key={colIdx} />
        }),
      )}
    </div>
  )
}

const Cell = ({ cell }: { cell: Cell }): JSX.Element => {
  const game = useObservable(game$, initialGame)

  const { snakePosition, applePosition } = game

  const isSnakeCell = snakePosition.pipe(E.Chunk.contains(cell))
  const isAppleCell = E.Equal.equals(cell)(applePosition)

  const className = cn(
    'w-10 h-10',
    isSnakeCell && 'bg-black',
    isAppleCell && 'bg-red-500',
  )

  return <div className={className} />
}

export default App
