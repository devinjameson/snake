import * as E from 'effect'
import * as S from '@effect/schema/Schema'
import * as Rx from 'rxjs'
import cn from 'classnames'

import { buildUseObservable } from './buildUseObservable'
import {
  Board,
  Cell,
  Direction,
  DirectionKeySchema,
  foldGameStatus,
  GameEvent,
  GameState,
  determineNextGameState,
  getRandomApplePosition,
  keyToDirection,
  Row,
  SnakePosition,
  toOppositeDirection,
} from './model'

const GAME_INTERVAL_MS = 100
const MAX_GAME_INTERVAL_MS = 50
const GAME_INTERVAL_DECREASE_PER_POINT_MS = 2
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

const direction$: Rx.Observable<Direction> = directionKeyPress$.pipe(
  Rx.map(keyToDirection),
  Rx.scan((acc, curr) => {
    return toOppositeDirection(curr) === acc ? acc : curr
  }),
  Rx.startWith(initialDirection),
)

const pointsProxy$ = new Rx.BehaviorSubject<number>(initialPoints)

const clockTick$ = pointsProxy$.pipe(
  Rx.switchMap((points) =>
    Rx.interval(
      Math.max(
        GAME_INTERVAL_MS - points * GAME_INTERVAL_DECREASE_PER_POINT_MS,
        MAX_GAME_INTERVAL_MS,
      ),
    ),
  ),
)

const gameEvent$: Rx.Observable<GameEvent> = Rx.merge(
  clockTick$.pipe(Rx.map(() => ({ kind: 'ClockTick' }) as const)),
  spaceBarDown$.pipe(Rx.map(() => ({ kind: 'SpaceBarDown' }) as const)),
)

const gameState$: Rx.Observable<GameState> = Rx.merge(gameEvent$).pipe(
  Rx.withLatestFrom(direction$),
  Rx.scan(
    (gameState, [gameEvent, direction]) =>
      determineNextGameState(BOARD_SIZE, direction, gameEvent, gameState),
    initialGameState,
  ),
  Rx.takeWhile(({ gameStatus }) => gameStatus !== 'GameOver', true),
  Rx.repeat({ delay: () => spaceBarDown$ }),
  Rx.share(),
)

gameState$
  .pipe(
    Rx.map(({ points }) => points),
    Rx.distinctUntilChanged(),
  )
  .subscribe((points) => {
    pointsProxy$.next(points)
  })

const useGameState = buildUseObservable(gameState$, initialGameState)

const App = (): JSX.Element => {
  const { points, gameStatus } = useGameState()

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <p className="mb-8 font-mono font-bold text-5xl">{points}</p>

      <div className="flex items-center justify-center relative bg-white">
        <div className="flex items-center justify-center divide-x divide-white">
          {board.pipe(
            E.Chunk.map((row, rowIdx) => {
              return <Row row={row} rowIdx={rowIdx} key={rowIdx} />
            }),
          )}
        </div>

        {E.pipe(
          gameStatus,
          foldGameStatus({
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

            onGameOver: () => {
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

export default App
