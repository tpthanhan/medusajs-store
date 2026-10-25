export const calculateManualBalance = (total: number, payments: number[]) => {
  const paid = payments.reduce((sum, amount) => sum + amount, 0)
  return {
    paid,
    remaining: Math.max(0, total - paid),
    tip: Math.max(0, paid - total),
  }
}
