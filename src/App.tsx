import * as E from 'effect'
import cn from 'classnames'

import { Board, Cell, matchGameState, Row } from './model'
import { useWorld } from './useWorld'
import { BOARD_SIZE } from './constants'

// --
// View layer is only concerned with rendering the game state
// Logic within components is very simple
// Single slice of state
// --

// -- BOARD

const board: Board = E.Chunk.makeBy(BOARD_SIZE, (x) =>
  E.Chunk.makeBy(BOARD_SIZE, (y) => E.Data.tuple(x, y)),
)

// -- VIEW

const App = (): JSX.Element => {
  const { points } = useWorld()

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <p className="mb-8 font-mono font-bold text-5xl">{points}</p>

      <div className="flex items-center justify-center relative bg-white">
        <div className="flex items-center justify-center">
          <Board />
        </div>

        <Overlays />
      </div>
    </div>
  )
}

const Board = (): JSX.Element => {
  return (
    <>
      {board.pipe(
        E.Chunk.map((row, rowIdx) => {
          return <Row row={row} rowIdx={rowIdx} key={rowIdx} />
        }),
      )}
    </>
  )
}

const Row = ({ row, rowIdx }: { row: Row; rowIdx: number }): JSX.Element => {
  return (
    <div className="flex flex-col">
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
  const { snakePosition, applePosition } = useWorld()

  const isSnakeCell = snakePosition.pipe(E.Chunk.contains(cell))
  const isAppleCell = E.Equal.equals(cell)(applePosition)

  const className = cn(
    'w-4 h-4',
    isAppleCell ? 'bg-red-500' : isSnakeCell ? 'bg-green-700' : 'bg-gray-300',
  )

  return <div className={className} />
}

const Overlays = (): JSX.Element => {
  const { gameState } = useWorld()

  return (
    <>
      {E.pipe(
        gameState,
        matchGameState({
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
                bodyText="Press space to start over"
                backgroundColor="bg-red-600"
              />
            )
          },
        }),
      )}
    </>
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

export default App
