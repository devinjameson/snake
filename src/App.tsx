import * as E from 'effect'
import cn from 'classnames'

type Board = E.Chunk.Chunk<Row>

type Row = E.Chunk.Chunk<Cell>

type Cell = E.Data.Structural<[number, number]>

const BOARD_SIZE = 20

const board: Board = E.Chunk.makeBy(BOARD_SIZE, (x) =>
  E.Chunk.makeBy(BOARD_SIZE, (y) => E.Data.tuple(x, y)),
)

type Snake = E.Chunk.Chunk<Cell>

const initialSnake: Snake = E.Chunk.fromIterable([
  E.Data.tuple(10, 10),
  E.Data.tuple(10, 11),
  E.Data.tuple(10, 12),
  E.Data.tuple(10, 13),
  E.Data.tuple(10, 14),
])

const snake = initialSnake

const App = (): JSX.Element => {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="border-black border divide-y divide-black">
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
    <div className="flex divide-x divide-black">
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
  const isActive = snake.pipe(E.Chunk.contains(cell))

  const className = cn('w-10 h-10', isActive ? 'bg-black' : 'bg-white')

  return <div className={className}></div>
}

export default App
