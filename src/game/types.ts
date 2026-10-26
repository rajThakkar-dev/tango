export type Mark = 0 | 1
export type Cell = Mark | null
export type Board = Cell[][]
export type SolvedBoard = Mark[][]
export type Difficulty = 'easy' | 'medium' | 'hard'
export type GameMode = 'daily' | 'infinite' | 'levels'

export interface Position {
  row: number
  col: number
}

export interface Relation {
  a: Position
  b: Position
  kind: 'same' | 'different'
}

export interface Puzzle {
  id: string
  seed: string
  size: number
  difficulty: Difficulty
  solution: SolvedBoard
  givens: Board
  relations: Relation[]
}
