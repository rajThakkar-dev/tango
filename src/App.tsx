import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cloneBoard, getViolations, isBoardComplete } from './game/engine'
import { dailySeed, generatePuzzle } from './game/generator'
import type { Board, Difficulty, GameMode, Mark, Puzzle, Relation } from './game/types'

const MODES: { value: GameMode; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'infinite', label: 'Infinite' },
  { value: 'levels', label: 'Levels' },
]

interface Stats {
  solved: number
  bestTime: number | null
  dailyStreak: number
  lastDaily: string | null
}

const DEFAULT_STATS: Stats = { solved: 0, bestTime: null, dailyStreak: 0, lastDaily: null }
const STORAGE = {
  stats: 'equinox-v1-stats',
  level: 'equinox-v1-level',
  infinite: 'equinox-v1-infinite',
}

function loadStats(): Stats {
  try {
    return { ...DEFAULT_STATS, ...JSON.parse(localStorage.getItem(STORAGE.stats) ?? '{}') }
  } catch {
    return DEFAULT_STATS
  }
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remainder = (seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}

function utcDateLabel() {
  return new Intl.DateTimeFormat('en', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date())
}

function SymbolIcon({ mark, small = false }: { mark: Mark; small?: boolean }) {
  if (mark === 0) {
    return (
      <svg className={`symbol sun ${small ? 'small' : ''}`} viewBox="0 0 100 100" aria-hidden="true">
        <g className="sun-rays">
          {Array.from({ length: 12 }, (_, index) => (
            <path key={index} d="M50 4 L54 19 L46 19 Z" transform={`rotate(${index * 30} 50 50)`} />
          ))}
        </g>
        <circle cx="50" cy="50" r="23" />
        <circle className="symbol-glint" cx="42" cy="42" r="5" />
      </svg>
    )
  }
  return (
    <svg className={`symbol moon ${small ? 'small' : ''}`} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M68 17C44 20 29 38 29 58c0 14 8 27 21 34C25 91 10 72 12 49 14 24 37 7 61 12c3 1 5 2 7 5Z" />
      <circle className="moon-crater" cx="35" cy="50" r="5" />
      <circle className="moon-crater" cx="45" cy="73" r="3" />
    </svg>
  )
}

function Icon({ name }: { name: 'undo' | 'spark' | 'refresh' | 'info' }) {
  const paths = {
    undo: <path d="M9 8 4 12l5 4M5 12h8a6 6 0 1 1 0 12h-2" />,
    spark: <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Zm7 13 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />,
    refresh: <><path d="M20 7v5h-5" /><path d="M18.5 16a8 8 0 1 1-.5-8l2 4" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
  }
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function relationAt(relations: Relation[], row: number, col: number, direction: 'right' | 'down') {
  return relations.find((relation) => {
    if (relation.a.row !== row || relation.a.col !== col) return false
    return direction === 'right'
      ? relation.b.row === row && relation.b.col === col + 1
      : relation.b.row === row + 1 && relation.b.col === col
  })
}

function BoardView({ puzzle, board, violations, completed, onCell }: {
  puzzle: Puzzle
  board: Board
  violations: Set<string>
  completed: boolean
  onCell: (row: number, col: number, reverse?: boolean) => void
}) {
  return (
    <div className={`board-shell ${completed ? 'is-complete' : ''}`}>
      <div className="board" role="grid" aria-label="Equinox puzzle board">
        {board.flatMap((line, row) => line.map((cell, col) => {
          const given = puzzle.givens[row][col] !== null
          const right = relationAt(puzzle.relations, row, col, 'right')
          const down = relationAt(puzzle.relations, row, col, 'down')
          const invalid = violations.has(`${row}-${col}`)
          return (
            <div className="cell-wrap" key={`${row}-${col}`} role="presentation">
              <button
                className={`cell ${given ? 'given' : ''} ${invalid ? 'invalid' : ''}`}
                type="button"
                role="gridcell"
                aria-label={`Row ${row + 1}, column ${col + 1}${cell === 0 ? ', sun' : cell === 1 ? ', moon' : ', empty'}${given ? ', fixed' : ''}`}
                aria-invalid={invalid || undefined}
                disabled={given || completed}
                onClick={() => onCell(row, col)}
                onContextMenu={(event) => { event.preventDefault(); onCell(row, col, true) }}
              >
                {cell !== null && <SymbolIcon mark={cell} />}
                {invalid && <span className="error-dot" />}
              </button>
              {right && <span className="relation relation-right">{right.kind === 'same' ? '=' : '×'}</span>}
              {down && <span className="relation relation-down">{down.kind === 'same' ? '=' : '×'}</span>}
            </div>
          )
        }))}
      </div>
      {completed && (
        <div className="complete-stamp" aria-live="polite">
          <span>Celestial balance</span>
          <strong>Restored</strong>
        </div>
      )}
    </div>
  )
}

function App() {
  const [mode, setMode] = useState<GameMode>('daily')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [level, setLevel] = useState(() => Number(localStorage.getItem(STORAGE.level) ?? 1))
  const [infiniteIndex, setInfiniteIndex] = useState(() => Number(localStorage.getItem(STORAGE.infinite) ?? 1))
  const [board, setBoard] = useState<Board>([])
  const [history, setHistory] = useState<Board[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [autoCheck, setAutoCheck] = useState(true)
  const [showRules, setShowRules] = useState(false)
  const [stats, setStats] = useState<Stats>(loadStats)
  const completionRecorded = useRef(false)

  const seed = mode === 'daily'
    ? dailySeed()
    : mode === 'levels'
      ? `level-${level}`
      : `infinite-${infiniteIndex}`

  const puzzle = useMemo(() => generatePuzzle(seed, mode === 'daily' ? 'medium' : difficulty), [seed, difficulty, mode])

  useEffect(() => {
    setBoard(cloneBoard(puzzle.givens))
    setHistory([])
    setElapsed(0)
    setCompleted(false)
    completionRecorded.current = false
  }, [puzzle])

  useEffect(() => {
    if (completed) return
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [completed, puzzle.id])

  useEffect(() => {
    localStorage.setItem(STORAGE.level, String(level))
    localStorage.setItem(STORAGE.infinite, String(infiniteIndex))
  }, [level, infiniteIndex])

  const violations = useMemo(
    () => autoCheck ? getViolations(board, puzzle.relations) : new Set<string>(),
    [autoCheck, board, puzzle.relations],
  )

  useEffect(() => {
    if (!board.length || !isBoardComplete(board, puzzle.relations) || completed) return
    setCompleted(true)
    if (completionRecorded.current) return
    completionRecorded.current = true
    setStats((current) => {
      let dailyStreak = current.dailyStreak
      let lastDaily = current.lastDaily
      if (mode === 'daily') {
        const today = new Date().toISOString().slice(0, 10)
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
        if (lastDaily !== today) dailyStreak = lastDaily === yesterday ? dailyStreak + 1 : 1
        lastDaily = today
      }
      const next = {
        solved: current.solved + 1,
        bestTime: current.bestTime === null ? elapsed : Math.min(current.bestTime, elapsed),
        dailyStreak,
        lastDaily,
      }
      localStorage.setItem(STORAGE.stats, JSON.stringify(next))
      return next
    })
  }, [board, completed, elapsed, mode, puzzle.relations])

  const updateCell = useCallback((row: number, col: number, reverse = false) => {
    if (puzzle.givens[row][col] !== null || completed) return
    setHistory((items) => [...items.slice(-39), cloneBoard(board)])
    setBoard((current) => {
      const next = cloneBoard(current)
      const sequence: (Mark | null)[] = reverse ? [null, 1, 0] : [null, 0, 1]
      const index = sequence.indexOf(next[row][col])
      next[row][col] = sequence[(index + 1) % sequence.length]
      return next
    })
  }, [board, completed, puzzle.givens])

  const undo = () => {
    const previous = history.at(-1)
    if (!previous || completed) return
    setBoard(previous)
    setHistory((items) => items.slice(0, -1))
  }

  const clear = () => {
    if (completed) return
    setHistory((items) => [...items, cloneBoard(board)])
    setBoard(cloneBoard(puzzle.givens))
  }

  const hint = () => {
    if (completed) return
    const open: { row: number; col: number }[] = []
    board.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
      if (cell !== puzzle.solution[rowIndex][colIndex] && puzzle.givens[rowIndex][colIndex] === null) {
        open.push({ row: rowIndex, col: colIndex })
      }
    }))
    if (!open.length) return
    const target = open[0]
    setHistory((items) => [...items, cloneBoard(board)])
    setBoard((current) => {
      const next = cloneBoard(current)
      next[target.row][target.col] = puzzle.solution[target.row][target.col]
      return next
    })
  }

  const nextPuzzle = () => {
    if (mode === 'levels') setLevel((value) => value + 1)
    else if (mode === 'infinite') setInfiniteIndex((value) => value + 1)
    else {
      setBoard(cloneBoard(puzzle.givens))
      setHistory([])
      setElapsed(0)
      setCompleted(false)
      completionRecorded.current = false
    }
  }

  return (
    <div className="app">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Equinox home">
          <span className="brand-mark"><span className="brand-sun" /><span className="brand-moon" /></span>
          <span><strong>Equinox</strong><small>Celestial logic</small></span>
        </a>
        <nav className="mode-tabs" aria-label="Game mode">
          {MODES.map((item) => (
            <button key={item.value} className={mode === item.value ? 'active' : ''} onClick={() => setMode(item.value)}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button className="round-button" aria-label="How to play" onClick={() => setShowRules(true)}><Icon name="info" /></button>
        </div>
      </header>

      <main id="top" className="game-layout">
        <section className="intro-panel">
          <div className="eyebrow"><span /> {mode === 'daily' ? utcDateLabel() : mode === 'levels' ? `Archive · Level ${level}` : `Endless · Puzzle ${infiniteIndex}`}</div>
          <h1>Find the balance<br />between <em>day</em> &amp; night.</h1>
          <p>Place suns and moons until every line reaches perfect equilibrium. A small ritual for a sharper mind.</p>

          <div className="stats-row">
            <div><strong>{stats.dailyStreak}</strong><span>day streak</span></div>
            <i />
            <div><strong>{stats.solved}</strong><span>puzzles solved</span></div>
            <i />
            <div><strong>{stats.bestTime === null ? '—' : formatTime(stats.bestTime)}</strong><span>best time</span></div>
          </div>

          <div className="rules-card">
            <div className="rules-card-title"><span>Four laws of balance</span><button onClick={() => setShowRules(true)}>View all</button></div>
            <ol>
              <li><span className="rule-symbols"><SymbolIcon mark={0} small /><SymbolIcon mark={1} small /></span><p>Equal suns and moons in every row and column.</p></li>
              <li><span className="rule-triplet"><b /><b /><b /></span><p>Never place three of the same symbol together.</p></li>
              <li><span className="rule-eq">=</span><p>Equals match. Crosses must be different.</p></li>
            </ol>
          </div>
        </section>

        <section className="play-panel">
          <div className="game-meta">
            <div>
              <span>{mode === 'daily' ? "Today's puzzle" : mode === 'levels' ? `Level ${level}` : `Puzzle ${infiniteIndex}`}</span>
              <strong>#{puzzle.id.split('-')[1]}</strong>
            </div>
            <div className="timer"><small>Time</small><strong>{formatTime(elapsed)}</strong></div>
          </div>

          {mode !== 'daily' && (
            <div className="difficulty-switch" aria-label="Difficulty">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((value) => (
                <button key={value} className={difficulty === value ? 'active' : ''} onClick={() => setDifficulty(value)}>{value}</button>
              ))}
            </div>
          )}

          <BoardView
            puzzle={puzzle}
            board={board}
            violations={violations}
            completed={completed}
            onCell={updateCell}
          />

          <div className="controls">
            <button onClick={undo} disabled={!history.length || completed}><Icon name="undo" /><span>Undo</span></button>
            <button className="hint-button" onClick={hint} disabled={completed}><Icon name="spark" /><span>Hint</span></button>
            <button onClick={clear} disabled={completed}><Icon name="refresh" /><span>Clear</span></button>
          </div>

          <div className="play-footer">
            <label className="toggle-label">
              <input type="checkbox" checked={autoCheck} onChange={(event) => setAutoCheck(event.target.checked)} />
              <span className="toggle" /> Auto-check
            </label>
            <span>{puzzle.difficulty} · 6 × 6</span>
          </div>

          {completed && <button className="next-button" onClick={nextPuzzle}>{mode === 'daily' ? 'Play again' : 'Next puzzle'} <span>→</span></button>}
        </section>
      </main>

      <footer>
        <span>Equinox v0.1</span>
        <p>A quiet place to think.</p>
        <span>New daily puzzle at 00:00 UTC</span>
      </footer>

      {showRules && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowRules(false)}>
          <section className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" aria-label="Close rules" onClick={() => setShowRules(false)}>×</button>
            <div className="eyebrow"><span /> Field notes</div>
            <h2 id="rules-title">How to restore balance</h2>
            <p>Fill every empty cell with either a sun or a moon. A completed board follows all four laws.</p>
            <div className="modal-rules">
              <div><b>01</b><p>Every row and column contains three suns and three moons.</p></div>
              <div><b>02</b><p>No row or column can contain three identical symbols in a row.</p></div>
              <div><b>=</b><p>Cells separated by an equals sign contain matching symbols.</p></div>
              <div><b>×</b><p>Cells separated by a cross contain different symbols.</p></div>
            </div>
            <button className="understood" onClick={() => setShowRules(false)}>Begin the ritual</button>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
