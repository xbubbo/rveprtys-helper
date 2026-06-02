const formatNumber = (n) => Math.floor(Number(n)).toLocaleString('en-US');

function parseAmount(str, balance) {
    if (!str) return NaN;
    const s = str.toString().toLowerCase().trim();
    if (s === 'all' || s === 'max') return balance ?? NaN;
    if (s === 'half')               return balance != null ? Math.floor(balance / 2) : NaN;
    const pct = s.match(/^(\d+(?:\.\d+)?)%$/);
    if (pct) return balance != null ? Math.floor(balance * parseFloat(pct[1]) / 100) : NaN;
    const k = s.match(/^(\d+(?:\.\d+)?)k$/);
    if (k) return Math.floor(parseFloat(k[1]) * 1_000);
    const m = s.match(/^(\d+(?:\.\d+)?)m$/);
    if (m) return Math.floor(parseFloat(m[1]) * 1_000_000);
    return Math.floor(parseFloat(s));
}

module.exports = { formatNumber, parseAmount };