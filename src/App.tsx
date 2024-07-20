import * as E from 'effect'
import cn from 'classnames'

import {
  ArrowUpIcon,
  ArrowRightIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'

import { Board, Cell, Direction, matchGameState, Row } from './model'
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

      <div className="flex items-center justify-center relative bg-white mb-8">
        <div className="flex items-center justify-center">
          <BoardView />
        </div>

        <Overlays />
      </div>

      <Controls />
    </div>
  )
}

const Controls = (): JSX.Element => {
  return (
    <div className="w-36 h-36 flex">
      <div className="flex flex-col flex-1">
        <div className="flex-1" />
        <ControlButton direction="Left" />
        <div className="flex-1" />
      </div>

      <div className="flex flex-col flex-1">
        <ControlButton direction="Up" />
        <div className="flex-1" />
        <ControlButton direction="Down" />
      </div>

      <div className="flex flex-col flex-1">
        <div className="flex-1" />
        <ControlButton direction="Right" />
        <div className="flex-1" />
      </div>
    </div>
  )
}

const clickUpEvent = new CustomEvent<Direction>('directionClick', {
  detail: 'Up',
})
const clickRightEvent = new CustomEvent<Direction>('directionClick', {
  detail: 'Right',
})
const clickDownEvent = new CustomEvent<Direction>('directionClick', {
  detail: 'Down',
})
const clickLeftEvent = new CustomEvent<Direction>('directionClick', {
  detail: 'Left',
})

const directionToClickEvent = (direction: Direction): Event => {
  switch (direction) {
    case 'Up':
      return clickUpEvent
    case 'Right':
      return clickRightEvent
    case 'Down':
      return clickDownEvent
    case 'Left':
      return clickLeftEvent
  }
}

const ControlButton = ({
  direction,
}: {
  direction: Direction
}): JSX.Element => {
  const handleOnClick = () => {
    document.dispatchEvent(directionToClickEvent(direction))
  }

  return (
    <button
      className="flex-1 flex items-center justify-center bg-purple-500 rounded-md"
      onClick={handleOnClick}>
      <ArrowIcon direction={direction} />
    </button>
  )
}

const ArrowIcon = ({ direction }: { direction: Direction }): JSX.Element => {
  const className = 'text-white w-6 h-6 stroke-2'

  switch (direction) {
    case 'Up':
      return <ArrowUpIcon className={className} />
    case 'Right':
      return <ArrowRightIcon className={className} />
    case 'Down':
      return <ArrowDownIcon className={className} />
    case 'Left':
      return <ArrowLeftIcon className={className} />
  }
}

const BoardView = (): JSX.Element => {
  return (
    <>
      {board.pipe(
        E.Chunk.map((row, rowIdx) => {
          return <RowView row={row} rowIdx={rowIdx} key={rowIdx} />
        }),
      )}
    </>
  )
}

const RowView = ({
  row,
  rowIdx,
}: {
  row: Row
  rowIdx: number
}): JSX.Element => {
  return (
    <div className="flex flex-col">
      {row.pipe(
        E.Chunk.map((_, colIdx) => {
          const cell = E.Data.tuple(rowIdx, colIdx)

          return <CellView cell={cell} key={colIdx} />
        }),
      )}
    </div>
  )
}

const CellView = ({ cell }: { cell: Cell }): JSX.Element => {
  const { snakePosition, applePosition } = useWorld()

  const isSnakeCell = snakePosition.pipe(E.Chunk.contains(cell))
  const isAppleCell = E.Equal.equals(cell)(applePosition)

  const className = cn(
    'w-2 h-2',
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
                bodyText="Press space or tap to start"
                backgroundColor="bg-green-600"
              />
            )
          },

          onPlaying: () => {
            return <Overlay backgroundColor="bg-transparent" />
          },

          onPaused: () => {
            return (
              <Overlay
                headerText="Paused"
                bodyText="Press space or tap to resume"
                backgroundColor="bg-blue-600"
              />
            )
          },

          onGameOver: () => {
            return (
              <Overlay
                headerText="Game over"
                bodyText="Press space or tap to start over"
                backgroundColor="bg-red-600"
              />
            )
          },
        }),
      )}
    </>
  )
}

const boardClickEvent = new Event('boardClick')

const Overlay = ({
  headerText,
  bodyText,
  backgroundColor,
}: {
  headerText?: string
  bodyText?: string
  backgroundColor: string
}): JSX.Element => {
  const handleOnClick = () => {
    document.dispatchEvent(boardClickEvent)
  }

  const className = cn(
    'absolute inset-0 flex flex-col justify-center items-center opacity-70',
    backgroundColor,
  )

  return (
    <div className={className} onClick={handleOnClick}>
      {headerText && (
        <p className="text-2xl font-semibold text-white font-mono uppercase mb-8">
          {headerText}
        </p>
      )}

      {bodyText && (
        <p className="text-lg font-medium text-white font-mono px-12 text-center">
          {bodyText}
        </p>
      )}
    </div>
  )
}

export default App
