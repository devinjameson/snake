import * as E from 'effect'
import * as S from '@effect/schema/Schema'
import * as Rx from 'rxjs'
import cn from 'classnames'

import { buildUseObservable } from './buildUseObservable'

// Model

type GameState = {
  snakePosition: SnakePosition
  applePosition: ApplePosition
  score: number
  status: Status
}

type Status = 'NotStarted' | 'Playing' | 'Paused' | 'Over'

const foldStatus =
  <T extends unknown>({
    onNotStarted,
    onPlaying,
    onPaused,
    onOver,
  }: {
    onNotStarted: () => T
    onPlaying: () => T
    onPaused: () => T
    onOver: () => T
  }) =>
  (status: Status): T => {
    switch (status) {
      case 'NotStarted':
        return onNotStarted()
      case 'Playing':
        return onPlaying()
      case 'Paused':
        return onPaused()
      case 'Over':
        return onOver()
    }
  }

type SnakePosition = E.Chunk.Chunk<Cell>

type ApplePosition = Cell

type Cell = E.Data.Data<[number, number]>

type Direction = 'Up' | 'Down' | 'Left' | 'Right'

type DirectionKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

type Row = E.Chunk.Chunk<Cell>

type Board = E.Chunk.Chunk<Row>

// Constants

const BOARD_SIZE = 40

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

const getRandomCoordinateComponent = (): number =>
  Math.floor(Math.random() * BOARD_SIZE)

const getRandomApplePosition = (): ApplePosition =>
  E.Data.tuple(getRandomCoordinateComponent(), getRandomCoordinateComponent())

const initialApplePosition = getRandomApplePosition()

const initialDirection: Direction = 'Left'

const initialGameState: GameState = {
  snakePosition: initialSnakePosition,
  applePosition: initialApplePosition,
  score: 0,
  status: 'NotStarted',
}

const GAME_INTERVAL_MS = 100

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

const keyDown$ = Rx.fromEvent<KeyboardEvent>(document, 'keydown')
const isSpaceKeyboardEvent = ({ key }: KeyboardEvent): boolean => key === ' '
const spaceBarDown$ = keyDown$.pipe(Rx.filter(isSpaceKeyboardEvent))

const directionKeyPress$ = keyDown$.pipe(
  Rx.map(({ key }) => key),
  Rx.filter(DirectionKeySchema.pipe(S.is)),
)

const direction$: Rx.Observable<Direction> = directionKeyPress$.pipe(
  Rx.map(keyToDirection),
  Rx.scan((acc, curr) => {
    return toOppositeDirection(curr) === acc ? acc : curr
  }),
  Rx.startWith(initialDirection),
)

const toOppositeDirection = (direction: Direction): Direction => {
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

const determineNextGameState =
  (direction: Direction) =>
  (gameState: GameState): GameState => {
    if (gameState.status !== 'Playing') {
      return gameState
    }

    const { snakePosition, applePosition, score } = gameState

    const head = snakePosition.pipe(E.Chunk.head)

    const nextHead = head.pipe(
      E.Option.map(determineNextHead(direction)),
      E.Option.getOrThrowWith(() => new Error('Snake has no head')),
    )

    const isNextHeadOnApple = E.Equal.equals(nextHead)(applePosition)

    const nextApplePosition = isNextHeadOnApple
      ? getRandomApplePosition()
      : applePosition

    const maybeWithoutTail = isNextHeadOnApple
      ? snakePosition
      : snakePosition.pipe(E.Chunk.dropRight(1))

    const nextSnakePosition = maybeWithoutTail.pipe(E.Chunk.prepend(nextHead))

    const nextScore = isNextHeadOnApple ? score + 1 : score

    const isOver = isColliding(nextSnakePosition)

    if (isOver) {
      return {
        ...gameState,
        status: 'Over',
      }
    } else {
      return {
        ...gameState,
        snakePosition: nextSnakePosition,
        applePosition: nextApplePosition,
        score: nextScore,
      }
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

const gameStateReducer = (
  direction: Direction,
  gameEvent: GameEvent,
  gameState: GameState,
): GameState => {
  switch (gameEvent.kind) {
    case 'ClockTick': {
      return determineNextGameState(direction)(gameState)
    }

    case 'SpaceBarDown': {
      switch (gameState.status) {
        case 'NotStarted': {
          return {
            ...gameState,
            status: 'Playing',
          }
        }
        case 'Playing': {
          return {
            ...gameState,
            status: 'Paused',
          }
        }
        case 'Paused': {
          return {
            ...gameState,
            status: 'Playing',
          }
        }
        case 'Over': {
          return {
            ...gameState,
            status: 'Playing',
          }
        }
      }
    }
  }
}

type GameEvent = ClockTick | SpaceBarDown
type ClockTick = { kind: 'ClockTick' }
type SpaceBarDown = { kind: 'SpaceBarDown' }

const clockTick$ = Rx.interval(GAME_INTERVAL_MS)

const gameEvent$: Rx.Observable<GameEvent> = Rx.merge(
  clockTick$.pipe(Rx.map(() => ({ kind: 'ClockTick' }) as const)),
  spaceBarDown$.pipe(Rx.map(() => ({ kind: 'SpaceBarDown' }) as const)),
)

const gameState$: Rx.Observable<GameState> = Rx.merge(gameEvent$).pipe(
  Rx.withLatestFrom(direction$),
  Rx.scan(
    (gameState, [gameEvent, direction]) =>
      gameStateReducer(direction, gameEvent, gameState),
    initialGameState,
  ),
  Rx.takeWhile(({ status }) => status !== 'Over', true),
  Rx.repeat({ delay: () => spaceBarDown$ }),
  Rx.share(),
)

// View

const useGameState = buildUseObservable(gameState$, initialGameState)

const App = (): JSX.Element => {
  const { score, status } = useGameState()

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <p className="mb-8 font-mono font-bold text-5xl">{score}</p>

      <div className="flex items-center justify-center relative bg-white">
        <div className="flex items-center justify-center divide-x divide-white">
          {board.pipe(
            E.Chunk.map((row, rowIdx) => {
              return <Row row={row} rowIdx={rowIdx} key={rowIdx} />
            }),
          )}
        </div>

        {E.pipe(
          status,
          foldStatus({
            onNotStarted: () => {
              return (
                <Overlay
                  headerText="Snake"
                  bodyText="Press space to start"
                  backgroundColor="bg-green-600"
                />
              )
            },
            onPlaying: () => {
              return <></>
            },
            onPaused: () => {
              return (
                <Overlay
                  headerText="Paused"
                  bodyText="Press space to resume"
                  backgroundColor="bg-blue-600"
                />
              )
            },
            onOver: () => {
              return (
                <Overlay
                  headerText="Game over"
                  bodyText="Press space to try again"
                  backgroundColor="bg-red-600"
                />
              )
            },
          }),
        )}
      </div>
    </div>
  )
}

const Overlay = ({
  headerText,
  bodyText,
  backgroundColor,
}: {
  headerText: string
  bodyText: string
  backgroundColor: string
}): JSX.Element => {
  const className = cn(
    'absolute inset-0 flex flex-col justify-center items-center opacity-70',
    backgroundColor,
  )

  return (
    <div className={className}>
      <p className="text-5xl font-semibold text-white font-mono uppercase mb-8">
        {headerText}
      </p>
      <p className="text-2xl font-medium text-white font-mono">{bodyText}</p>
    </div>
  )
}

const Row = ({ row, rowIdx }: { row: Row; rowIdx: number }): JSX.Element => {
  return (
    <div className="flex flex-col divide-y divide-white">
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
  const { snakePosition, applePosition } = useGameState()

  const isSnakeCell = snakePosition.pipe(E.Chunk.contains(cell))
  const isAppleCell = E.Equal.equals(cell)(applePosition)

  const className = cn(
    'w-4 h-4',
    isAppleCell ? 'bg-red-500' : isSnakeCell ? 'bg-green-700' : 'bg-gray-300',
  )

  return <div className={className} />
}

export default App
