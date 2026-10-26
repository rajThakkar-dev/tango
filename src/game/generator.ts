import { BOARD_SIZE, cloneBoard, countSolutions, emptyBoard, isBoardPossible } from './engine'
import { seededRandom, shuffle } from './random'
import type { Board, Difficulty, Mark, Puzzle, Relation, SolvedBoard } from './types'

const ROW_PATTERNS: Mark[][] = []
for (let mask = 0; mask < 1 << BOARD_SIZE; mask += 1) {
  const row = Array.from({ length: BOARD_SIZE }, (_, index) => ((mask >> index) & 1) as Mark)
  const equalCount = row.filter((value) => value === 1).length === BOARD_SIZE / 2
  const noTriples = row.every((value, index) => index < 2 || !(value === row[index - 1] && value === row[index - 2]))
  if (equalCount && noTriples) ROW_PATTERNS.push(row)
}

function createSolution(random: () => number): SolvedBoard {
  const board = emptyBoard()
  const fillRow = (row: number): boolean => {
    if (row === BOARD_SIZE) return true
    for (const candidate of shuffle(ROW_PATTERNS, random)) {
      board[row] = [...candidate]
      if (isBoardPossible(board, []) && fillRow(row + 1)) return true
      board[row] = Array(BOARD_SIZE).fill(null)
    }
    return false
  }
  if (!fillRow(0)) throw new Error('Unable to construct a solved board')
  return board as SolvedBoard
}

function relationCandidates(solution: SolvedBoard): Relation[] {
  const relations: Relation[] = []
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (col < BOARD_SIZE - 1) {
        relations.push({
          a: { row, col }, b: { row, col: col + 1 },
          kind: solution[row][col] === solution[row][col + 1] ? 'same' : 'different',
        })
      }
      if (row < BOARD_SIZE - 1) {
        relations.push({
          a: { row, col }, b: { row: row + 1, col },
          kind: solution[row][col] === solution[row + 1][col] ? 'same' : 'different',
        })
      }
    }
  }
  return relations
}

const SETTINGS: Record<Difficulty, { relations: number; targetGivens: number }> = {
  easy: { relations: 10, targetGivens: 10 },
  medium: { relations: 8, targetGivens: 8 },
  hard: { relations: 7, targetGivens: 6 },
}

export function generatePuzzle(seed: string, difficulty: Difficulty): Puzzle {
  const random = seededRandom(`equinox-v1|${seed}|${difficulty}`)
  const solution = createSolution(random)
  const settings = SETTINGS[difficulty]
  const relations = shuffle(relationCandidates(solution), random).slice(0, settings.relations)
  const givens: Board = solution.map((row) => [...row])
  const cells = shuffle(
    Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => ({
      row: Math.floor(index / BOARD_SIZE),
      col: index % BOARD_SIZE,
    })),
    random,
  )

  let givenCount = BOARD_SIZE * BOARD_SIZE
  for (const { row, col } of cells) {
    if (givenCount <= settings.targetGivens) break
    const previous = givens[row][col]
    givens[row][col] = null
    if (countSolutions(givens, relations, 2) === 1) {
      givenCount -= 1
    } else {
      givens[row][col] = previous
    }
  }

  const fingerprint = Array.from(seed).reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7)
  return {
    id: `${difficulty}-${fingerprint.toString(36).toUpperCase()}`,
    seed,
    size: BOARD_SIZE,
    difficulty,
    solution,
    givens: cloneBoard(givens),
    relations,
  }
}

export function dailySeed(date = new Date()): string {
  return `daily-${date.toISOString().slice(0, 10)}`
}
