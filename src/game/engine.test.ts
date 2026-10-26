import { describe, expect, it } from 'vitest'
import { countSolutions, isBoardComplete, isBoardPossible } from './engine'
import { dailySeed, generatePuzzle } from './generator'
import type { Board } from './types'

describe('puzzle engine', () => {
  it('recreates the same puzzle from the same seed', () => {
    expect(generatePuzzle('level-42', 'medium')).toEqual(generatePuzzle('level-42', 'medium'))
  })

  it('generates complete valid solutions and uniquely solvable puzzles', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (let seed = 0; seed < 12; seed += 1) {
        const puzzle = generatePuzzle(`test-${difficulty}-${seed}`, difficulty)
        expect(isBoardComplete(puzzle.solution, puzzle.relations)).toBe(true)
        expect(countSolutions(puzzle.givens, puzzle.relations)).toBe(1)
      }
    }
  })

  it('rejects three matching marks in a row', () => {
    const puzzle = generatePuzzle('triple-test', 'easy')
    const board: Board = puzzle.givens.map((row) => row.map(() => null))
    board[0][0] = 1
    board[0][1] = 1
    board[0][2] = 1
    expect(isBoardPossible(board, [])).toBe(false)
  })

  it('uses the UTC date for daily seeds', () => {
    expect(dailySeed(new Date('2026-10-26T23:59:59Z'))).toBe('daily-2026-10-26')
  })
})
