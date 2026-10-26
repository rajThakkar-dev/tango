import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cloneBoard, getViolations, isBoardComplete } from './game/engine'
import { dailySeed, generateLevelPuzzle, generatePuzzle, levelDifficulty } from './game/generator'
import type { Board, Difficulty, GameMode, Mark, Puzzle, Relation } from './game/types'

interface Stats { solved: number; bestTime: number | null; dailyStreak: number; lastDaily: string | null }
const DEFAULT_STATS: Stats = { solved: 0, bestTime: null, dailyStreak: 0, lastDaily: null }
const STORAGE = { stats: 'tango-v2-stats', level: 'tango-v2-level', infinite: 'tango-v2-infinite', unlocked: 'tango-levels-v1-unlocked' }

function loadStats(): Stats {
  try { return { ...DEFAULT_STATS, ...JSON.parse(localStorage.getItem(STORAGE.stats) ?? '{}') } }
  catch { return DEFAULT_STATS }
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function levelDifficultyLabel(level: number) {
  if (level <= 2) return 'Very easy'
  if (level <= 5) return 'Easy'
  if (level <= 10) return 'Medium'
  if (level <= 15) return 'Challenging'
  return 'Hard'
}

function SymbolIcon({ mark, tiny = false }: { mark: Mark; tiny?: boolean }) {
  if (mark === 0) return <svg className={`piece sun-piece ${tiny ? 'tiny' : ''}`} viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="34" /></svg>
  return <svg className={`piece moon-piece ${tiny ? 'tiny' : ''}`} viewBox="0 0 100 100" aria-hidden="true"><path d="M70 17c-2 0-4 0-6 1 9 6 15 17 15 29 0 21-17 38-38 38-6 0-12-1-17-4 7 8 18 13 30 13 22 0 40-18 40-40 0-16-10-30-24-37Z" /></svg>
}

function ArrowIcon({ direction = 'left' }: { direction?: 'left' | 'up' | 'down' }) {
  const rotation = direction === 'left' ? 0 : direction === 'up' ? 90 : -90
  return <svg className="line-icon" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${rotation}deg)` }}><path d="M19 12H5m6-6-6 6 6 6" /></svg>
}

function ClockIcon() {
  return <svg className="clock-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>
}

function relationAt(relations: Relation[], row: number, col: number, direction: 'right' | 'down') {
  return relations.find((relation) => {
    if (relation.a.row !== row || relation.a.col !== col) return false
    return direction === 'right'
      ? relation.b.row === row && relation.b.col === col + 1
      : relation.b.row === row + 1 && relation.b.col === col
  })
}

function GameBoard({ puzzle, board, violations, completed, onCell }: {
  puzzle: Puzzle; board: Board; violations: Set<string>; completed: boolean
  onCell: (row: number, col: number, reverse?: boolean) => void
}) {
  return (
    <div className={`board ${completed ? 'board-complete' : ''}`} role="grid" aria-label="Tango puzzle board">
      {board.flatMap((line, row) => line.map((cell, col) => {
        const fixed = puzzle.givens[row][col] !== null
        const right = relationAt(puzzle.relations, row, col, 'right')
        const down = relationAt(puzzle.relations, row, col, 'down')
        const invalid = violations.has(`${row}-${col}`)
        return (
          <div className="cell-wrap" key={`${row}-${col}`} role="presentation">
            <button type="button" role="gridcell" className={`cell ${fixed ? 'fixed' : ''} ${invalid ? 'invalid' : ''}`}
              aria-label={`Row ${row + 1}, column ${col + 1}${cell === 0 ? ', sun' : cell === 1 ? ', moon' : ', empty'}${fixed ? ', fixed' : ''}`}
              aria-invalid={invalid || undefined} disabled={fixed || completed}
              onClick={() => onCell(row, col)} onContextMenu={(event) => { event.preventDefault(); onCell(row, col, true) }}>
              {cell !== null && <SymbolIcon mark={cell} />}
            </button>
            {right && <span className="relation relation-right">{right.kind === 'same' ? '=' : '×'}</span>}
            {down && <span className="relation relation-down">{down.kind === 'same' ? '=' : '×'}</span>}
          </div>
        )
      }))}
    </div>
  )
}

function App() {
  const [mode, setMode] = useState<GameMode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [highestUnlocked, setHighestUnlocked] = useState(() => Math.max(1, Number(localStorage.getItem(STORAGE.unlocked) ?? 1)))
  const [level, setLevel] = useState(() => Math.min(
    Math.max(1, Number(localStorage.getItem(STORAGE.level) ?? 1)),
    Math.max(1, Number(localStorage.getItem(STORAGE.unlocked) ?? 1)),
  ))
  const [infiniteIndex, setInfiniteIndex] = useState(() => Number(localStorage.getItem(STORAGE.infinite) ?? 1))
  const [board, setBoard] = useState<Board>([])
  const [history, setHistory] = useState<Board[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [autoCheck, setAutoCheck] = useState(true)
  const [rulesOpen, setRulesOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [stats, setStats] = useState<Stats>(loadStats)
  const completionRecorded = useRef(false)

  const seed = mode === 'daily' ? dailySeed() : mode === 'levels' ? `level-${level}` : `infinite-${infiniteIndex}`
  const activeDifficulty = mode === 'levels' ? levelDifficulty(level) : mode === 'daily' ? 'medium' : difficulty
  const puzzle = useMemo(
    () => mode === 'levels' ? generateLevelPuzzle(level) : generatePuzzle(seed, activeDifficulty),
    [seed, activeDifficulty, level, mode],
  )

  useEffect(() => {
    setBoard(cloneBoard(puzzle.givens)); setHistory([]); setElapsed(0); setCompleted(false); completionRecorded.current = false
  }, [puzzle])

  useEffect(() => {
    if (completed) return
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [completed, puzzle.id])

  useEffect(() => {
    localStorage.setItem(STORAGE.level, String(level)); localStorage.setItem(STORAGE.infinite, String(infiniteIndex))
  }, [level, infiniteIndex])

  useEffect(() => {
    localStorage.setItem(STORAGE.unlocked, String(highestUnlocked))
  }, [highestUnlocked])

  const violations = useMemo(() => autoCheck ? getViolations(board, puzzle.relations) : new Set<string>(), [autoCheck, board, puzzle.relations])

  useEffect(() => {
    if (!board.length || completed || !isBoardComplete(board, puzzle.relations)) return
    setCompleted(true)
    if (completionRecorded.current) return
    completionRecorded.current = true
    if (mode === 'levels') setHighestUnlocked((current) => Math.max(current, level + 1))
    setStats((current) => {
      let dailyStreak = current.dailyStreak; let lastDaily = current.lastDaily
      if (mode === 'daily') {
        const today = new Date().toISOString().slice(0, 10)
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
        if (lastDaily !== today) dailyStreak = lastDaily === yesterday ? dailyStreak + 1 : 1
        lastDaily = today
      }
      const next = { solved: current.solved + 1, bestTime: current.bestTime === null ? elapsed : Math.min(current.bestTime, elapsed), dailyStreak, lastDaily }
      localStorage.setItem(STORAGE.stats, JSON.stringify(next)); return next
    })
  }, [board, completed, elapsed, level, mode, puzzle.relations])

  const updateCell = useCallback((row: number, col: number, reverse = false) => {
    if (puzzle.givens[row][col] !== null || completed) return
    setHistory((items) => [...items.slice(-39), cloneBoard(board)])
    setBoard((current) => {
      const next = cloneBoard(current); const sequence: (Mark | null)[] = reverse ? [null, 1, 0] : [null, 0, 1]
      next[row][col] = sequence[(sequence.indexOf(next[row][col]) + 1) % sequence.length]; return next
    })
  }, [board, completed, puzzle.givens])

  const reset = () => {
    setBoard(cloneBoard(puzzle.givens)); setHistory([]); setElapsed(0); setCompleted(false); completionRecorded.current = false
  }

  const undo = () => {
    const previous = history.at(-1); if (!previous || completed) return
    setBoard(previous); setHistory((items) => items.slice(0, -1))
  }

  const hint = () => {
    if (completed) return
    for (let row = 0; row < board.length; row += 1) for (let col = 0; col < board.length; col += 1) {
      if (puzzle.givens[row][col] === null && board[row][col] !== puzzle.solution[row][col]) {
        setHistory((items) => [...items, cloneBoard(board)])
        setBoard((current) => { const next = cloneBoard(current); next[row][col] = puzzle.solution[row][col]; return next })
        return
      }
    }
  }

  const nextPuzzle = () => {
    if (mode === 'levels') setLevel((value) => value + 1)
    else if (mode === 'infinite') setInfiniteIndex((value) => value + 1)
    else reset()
  }

  const modeLabel = mode === 'daily' ? 'Daily' : mode === 'levels' ? `Level ${level}` : `Unlimited ${infiniteIndex}`

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left"><button className="icon-button back-button" aria-label="Back"><ArrowIcon /></button><strong>Tango</strong><span className="unofficial">Unlimited</span></div>
        <div className="timer" aria-label={`Elapsed time ${formatTime(elapsed)}`}><ClockIcon /><strong>{formatTime(elapsed)}</strong></div>
        <div className="topbar-right">
          <button className="reset-button" onClick={reset}>Reset</button>
          <button className="help-button" aria-label="How to play" onClick={() => setRulesOpen((value) => !value)}>?</button>
          <div className="settings-wrap">
            <button className="settings-button" onClick={() => setSettingsOpen((value) => !value)} aria-expanded={settingsOpen}>Settings <span>⌄</span></button>
            {settingsOpen && <section className="settings-popover" aria-label="Game settings">
              <label className="check-setting"><span>Auto-check mistakes</span><input type="checkbox" checked={autoCheck} onChange={(event) => setAutoCheck(event.target.checked)} /></label>
              <div className="mini-stats"><span><b>{stats.solved}</b> Solved</span><span><b>{stats.dailyStreak}</b> Day streak</span><span><b>{stats.bestTime === null ? '—' : formatTime(stats.bestTime)}</b> Best</span></div>
            </section>}
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="game-column">
          <nav className="primary-modes" aria-label="Game mode">
            {(['daily', 'infinite', 'levels'] as GameMode[]).map((value) => (
              <button key={value} className={mode === value ? 'active' : ''} onClick={() => setMode(value)}>
                {value === 'infinite' ? 'Unlimited' : value}
              </button>
            ))}
          </nav>

          {mode !== 'daily' && <div className="mode-options">
            {mode === 'infinite' && <>
            <div className="difficulty-tabs" aria-label="Difficulty">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((value) => (
                <button key={value} className={difficulty === value ? 'active' : ''} onClick={() => setDifficulty(value)}>{value}</button>
              ))}
            </div>
            <button className="new-puzzle-link" onClick={() => setInfiniteIndex((value) => value + 1)}>New puzzle</button>
            </>}
            {mode === 'levels' && <div className="level-control" aria-label="Level selector">
              <button aria-label="Previous level" disabled={level === 1} onClick={() => setLevel((value) => Math.max(1, value - 1))}>‹</button>
              <span>Level <b>{level}</b> <em>{levelDifficultyLabel(level)}</em></span>
              <button aria-label="Next level" title={level >= highestUnlocked ? 'Complete this level to unlock the next one' : 'Next level'} disabled={level >= highestUnlocked} onClick={() => setLevel((value) => Math.min(highestUnlocked, value + 1))}>›</button>
            </div>}
            {mode === 'levels' && <span className="unlock-note">Unlocked through {highestUnlocked}</span>}
          </div>}

          <div className="mode-line"><span>{modeLabel}</span><span>#{puzzle.id.split('-')[1]}</span></div>
          <div className="board-card">
            <GameBoard puzzle={puzzle} board={board} violations={violations} completed={completed} onCell={updateCell} />
            {completed && <div className="win-overlay" role="status"><span>Completed</span><strong>{formatTime(elapsed)}</strong></div>}
          </div>
          <div className="game-actions"><button onClick={undo} disabled={!history.length || completed}>Undo</button><button onClick={hint} disabled={completed}>Hint</button></div>
          {completed && <button className="continue-button" onClick={nextPuzzle}>{mode === 'daily' ? 'Play again' : 'Next puzzle'}</button>}
          <section className="how-to-card">
            <button className="how-to-heading" onClick={() => setRulesOpen((value) => !value)} aria-expanded={rulesOpen}><span>How to play</span><ArrowIcon direction={rulesOpen ? 'up' : 'down'} /></button>
            {rulesOpen && <ul>
              <li>Fill the grid so each cell contains either a <SymbolIcon mark={0} tiny /> or a <SymbolIcon mark={1} tiny />.</li>
              <li>No more than 2 matching symbols can be next to each other, vertically or horizontally.</li>
              <li>Each row and column must contain the same number of suns and moons.</li>
              <li>Cells separated by <b>=</b> must match. Cells separated by <b>×</b> must be different.</li>
              <li>Every puzzle has one answer and can be solved without guessing.</li>
            </ul>}
          </section>
        </section>
      </main>
    </div>
  )
}

export default App
