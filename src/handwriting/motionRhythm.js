/** Monotone cubic timing curve: shared p still drives pen, reveal and shadow.
 * Knots are authored for each gesture's press, turn and release, never random.
 */
export function motionRhythm(knots) {
  const slopes = knots.slice(1).map(([t, p], i) =>
    (p - knots[i][1]) / (t - knots[i][0]));
  const tangents = knots.map((_, i) => i === 0 ? slopes[0]
    : i === knots.length - 1 ? slopes.at(-1)
      : 2 * slopes[i - 1] * slopes[i] / (slopes[i - 1] + slopes[i]));
  return time => {
    if (time <= 0) return 0;
    if (time >= 1) return 1;
    let i = 0;
    while (knots[i + 1][0] < time) i++;
    const [t, p] = knots[i], [end, next] = knots[i + 1], width = end - t;
    const u = (time - t) / width;
    return (2 * u ** 3 - 3 * u ** 2 + 1) * p +
      (u ** 3 - 2 * u ** 2 + u) * width * tangents[i] +
      (-2 * u ** 3 + 3 * u ** 2) * next +
      (u ** 3 - u ** 2) * width * tangents[i + 1];
  };
}
