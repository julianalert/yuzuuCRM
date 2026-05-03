export function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 75 ? 'score-high' : score >= 50 ? 'score-mid' : 'score-low'
  return <span className={`score ${cls}`}>{score}</span>
}
