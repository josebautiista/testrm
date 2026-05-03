export function getAvailableRMMethods(trainingMonths: number) {
  if (trainingMonths < 4) {
    return ["estimation"];
  }

  return ["estimation", "casas", "nacleiro"];
}
