import type { Board, Cell, Mark, Position, Relation } from './types'

export const BOARD_SIZE = 6

export function emptyBoard(size = BOARD_SIZE): Board {
  return Array.from({ length: size }, () => Array<Cell>(size).fill(null))
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row])
}

function hasTriple(values: Cell[]): boolean {
  for (let index = 0; index <= values.length - 3; index += 1) {
    const value = values[index]
    if (value !== null && value === values[index + 1] && value === values[index + 2]) return true
  }
  return false
}

function lineIsPossible(values: Cell[]): boolean {
  const half = values.length / 2
  const zeros = values.filter((value) => value === 0).length
  const ones = values.filter((value) => value === 1).length
  return zeros <= half && ones <= half && !hasTriple(values)
}

export function isBoardPossible(board: Board, relations: Relation[]): boolean {
  const size = board.length
  for (let row = 0; row < size; row += 1) {
    if (!lineIsPossible(board[row])) return false
  }
  for (let col = 0; col < size; col += 1) {
    if (!lineIsPossible(board.map((row) => row[col]))) return false
  }
  for (const relation of relations) {
    const first = board[relation.a.row][relation.a.col]
    const second = board[relation.b.row][relation.b.col]
    if (first === null || second === null) continue
    if (relation.kind === 'same' && first !== second) return false
    if (relation.kind === 'different' && first === second) return false
  }
  return true
}

export function isBoardComplete(board: Board, relations: Relation[]): boolean {
  return board.every((row) => row.every((cell) => cell !== null)) && isBoardPossible(board, relations)
}

export function getViolations(board: Board, relations: Relation[]): Set<string> {
  const invalid = new Set<string>()
  if (board.length === 0) return invalid
  const add = (row: number, col: number) => invalid.add(`${row}-${col}`)
  const size = board.length

  const inspectLine = (positions: Position[]) => {
    const values = positions.map(({ row, col }) => board[row][col])
    const half = size / 2
    for (const mark of [0, 1] as Mark[]) {
      if (values.filter((value) => value === mark).length > half) {
        positions.forEach(({ row, col }, index) => values[index] === mark && add(row, col))
      }
    }
    for (let index = 0; index <= size - 3; index += 1) {
      const value = values[index]
      if (value !== null && value === values[index + 1] && value === values[index + 2]) {
        for (let offset = 0; offset < 3; offset += 1) {
          add(positions[index + offset].row, positions[index + offset].col)
        }
      }
    }
  }

  for (let row = 0; row < size; row += 1) {
    inspectLine(Array.from({ length: size }, (_, col) => ({ row, col })))
  }
  for (let col = 0; col < size; col += 1) {
    inspectLine(Array.from({ length: size }, (_, row) => ({ row, col })))
  }
  relations.forEach((relation) => {
    const a = board[relation.a.row][relation.a.col]
    const b = board[relation.b.row][relation.b.col]
    if (a === null || b === null) return
    const broken = relation.kind === 'same' ? a !== b : a === b
    if (broken) {
      add(relation.a.row, relation.a.col)
      add(relation.b.row, relation.b.col)
    }
  })
  return invalid
}

function nextEmpty(board: Board): Position | null {
  let best: Position | null = null
  let bestScore = -1
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (board[row][col] !== null) continue
      const score = board[row].filter((cell) => cell !== null).length
        + board.map((line) => line[col]).filter((cell) => cell !== null).length
      if (score > bestScore) {
        best = { row, col }
        bestScore = score
      }
    }
  }
  return best
}

export function countSolutions(initial: Board, relations: Relation[], limit = 2): number {
  const board = cloneBoard(initial)
  let count = 0
  const search = () => {
    if (count >= limit) return
    const position = nextEmpty(board)
    if (!position) {
      if (isBoardComplete(board, relations)) count += 1
      return
    }
    for (const mark of [0, 1] as Mark[]) {
      board[position.row][position.col] = mark
      if (isBoardPossible(board, relations)) search()
      board[position.row][position.col] = null
    }
  }
  if (isBoardPossible(board, relations)) search()
  return count
}
