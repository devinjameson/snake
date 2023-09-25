import * as E from 'effect'
import * as S from '@effect/schema/Schema'
import * as Rx from 'rxjs'
import cn from 'classnames'

import { useObservable } from './useObservable'

// Types

type Board = E.Chunk.Chunk<Row>

type Row = E.Chunk.Chunk<Cell>

type Cell = E.Data.Data<[number, number]>

type Snake = E.Chunk.Chunk<Cell>

type Direction = 'Up' | 'Down' | 'Left' | 'Right'

// Constants

const BOARD_SIZE = 20

const board: Board = E.Chunk.makeBy(BOARD_SIZE, (x) =>
  E.Chunk.makeBy(BOARD_SIZE, (y) => E.Data.tuple(x, y)),
)

const initialSnake: Snake = E.Chunk.fromIterable([
  E.Data.tuple(9, 10),
  E.Data.tuple(10, 10),
  E.Data.tuple(11, 10),
  E.Data.tuple(12, 10),
  E.Data.tuple(13, 10),
])

type Key = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

const GAME_INTERVAL_MS = 250

// Rx

const DirectionKeySchema: S.Schema<Key> = S.literal(
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
)

const keyToDirection = (key: Key): Direction => {
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
  Rx.startWith('Left' as const),
)

const tick$ = Rx.interval(GAME_INTERVAL_MS)

const nextHead =
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

const nextSnake =
  (direction: Direction) =>
  (snake: Snake): Snake => {
    const head = snake.pipe(E.Chunk.head)

    const withoutTail = snake.pipe(E.Chunk.dropRight(1))

    return withoutTail.pipe(
      E.Chunk.prepend(
        head.pipe(
          E.Option.map(nextHead(direction)),
          E.Option.getOrThrowWith(() => new Error('Snake has no head')),
        ),
      ),
    )
  }

const isCollidingWithSelf = (snake: Snake): boolean => {
  return snake.pipe(
    E.Chunk.head,
    E.Option.map((head) => {
      return snake.pipe(E.Chunk.drop(1), E.Chunk.contains(head))
    }),
    E.Option.getOrElse(() => false),
  )
}

const isCollidingWithWall = (snake: Snake): boolean => {
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

const isColliding = (snake: Snake): boolean => {
  return isCollidingWithSelf(snake) || isCollidingWithWall(snake)
}

const snake$: Rx.Observable<Snake> = tick$.pipe(
  Rx.withLatestFrom(direction$),
  Rx.scan((snake, [_, direction]) => nextSnake(direction)(snake), initialSnake),
  Rx.takeWhile((snake) => !isColliding(snake)),
)

// View

const App = (): JSX.Element => {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="flex border-black border divide-x divide-black">
        {board.pipe(
          E.Chunk.map((row, rowIdx) => {
            return <Row row={row} rowIdx={rowIdx} key={rowIdx} />
          }),
        )}
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
  const snake = useObservable(snake$, initialSnake)

  const isActive = snake.pipe(E.Chunk.contains(cell))

  const className = cn('w-10 h-10', isActive ? 'bg-black' : 'bg-white')

  return <div className={className} />
}

export default App
