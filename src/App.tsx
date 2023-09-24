import * as E from 'effect'

type Board = E.Chunk.Chunk<Row>

type Row = E.Chunk.Chunk<Cell>

type Cell = [number, number]

const BOARD_SIZE = 20

const board: Board = E.Chunk.makeBy(BOARD_SIZE, (x) =>
  E.Chunk.makeBy(BOARD_SIZE, (y) => [x, y]),
)

const App = (): JSX.Element => {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="border-black border divide-y divide-black">
        {board.pipe(
          E.Chunk.map((row, rowIdx) => {
            return (
              <div key={rowIdx} className="flex divide-x divide-black">
                {row.pipe(
                  E.Chunk.map((_, colIdx) => {
                    return <div key={colIdx} className="w-10 h-10"></div>
                  }),
                )}
              </div>
            )
          }),
        )}
      </div>
    </div>
  )
}

export default App
