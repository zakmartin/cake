export function calculate(v) {
  const keys = ['ingredients','hours','rate','extras','price','feePercent','feeFixed','margin'];
  if (keys.some(k => typeof v[k] !== 'number' || !Number.isFinite(v[k]) || v[k] < 0))
    throw new RangeError('Enter a valid number of zero or more in every field.');
  if (v.feePercent + v.margin >= 100)
    throw new RangeError('Payment fees plus target margin must be less than 100%.');
  const labour = v.hours * v.rate;
  const cost = v.ingredients + labour + v.extras;
  const fees = v.price * v.feePercent / 100 + v.feeFixed;
  const surplus = v.price - cost - fees;
  const denominator = 1 - (v.feePercent + v.margin) / 100;
  // Round prices UP to the nearest cent so the chosen margin is not undershot.
  const target = Math.max(0, Math.ceil(((cost + v.feeFixed) / denominator - 1e-9) * 100) / 100);
  const floor = Math.max(0, Math.ceil(((cost + v.feeFixed) / (1-v.feePercent/100) - 1e-9) * 100) / 100);
  const actualRate = v.hours > 0 ? (v.price-v.ingredients-v.extras-fees) / v.hours : null;
  return {labour,cost,fees,surplus,target,floor,actualRate,
    actualMargin:v.price > 0 ? surplus/v.price*100 : null};
}
