globalThis.SurveyStats = (() => {
  function variance(xs) {
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    return xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1);
  }
  function summarize(rows, k) {
    if (rows.some(r => r.length !== k || r.some(x => !Number.isInteger(x) || x < 1 || x > 4))) throw Error('Responses must contain every item scored 1–4.');
    const n = rows.length;
    const mean = n ? rows.flat().reduce((a, b) => a + b, 0) / (n * k) : null;
    const totalVariance = n > 1 ? variance(rows.map(r => r.reduce((a,b) => a+b, 0))) : 0;
    const alpha = n > 1 && k > 1 && totalVariance > 0 ? k / (k - 1) * (1 - Array.from({length:k}, (_,i) => variance(rows.map(r => r[i]))).reduce((a,b) => a+b,0) / totalVariance) : null;
    return {n, mean, alpha, remark: alpha === null ? 'Insufficient variation / data' : alpha >= .9 ? 'Excellent*' : alpha >= .8 ? 'Good' : alpha >= .7 ? 'Acceptable' : 'Below acceptable'};
  }
  function generate(n, seed, mode, sizes) {
    let state = seed >>> 0;
    const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
    if (!['uniform', 'positive', 'correlated', 'shared'].includes(mode)) throw Error('Unknown simulation mode.');
    return Array.from({length:n}, () => {
      // Shared across constructs to demonstrate an association between scores.
      const shared = mode === 'shared' ? 1 + Math.floor(random() * 4) : null;
      return sizes.map(k => {
      if (mode === 'shared') {
        return Array.from({length:k}, () => random() < 0.7 ? shared : 1 + Math.floor(random() * 4));
      }
      if (mode === 'correlated') {
        // A new shared tendency for each respondent and section. Each item
        // copies it with probability 0.7, otherwise draws independently.
        // This models dependence without searching for a target alpha.
        const tendency = 1 + Math.floor(random() * 4);
        return Array.from({length:k}, () => random() < 0.7 ? tendency : 1 + Math.floor(random() * 4));
      }
      return Array.from({length:k}, () => mode === 'positive' ? 3 + Math.floor(random()*2) : 1 + Math.floor(random()*4));
      });
    });
  }
  return {summarize, generate};
})();
