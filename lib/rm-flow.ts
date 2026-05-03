export function getRMMethod(trainingMonths: number) {
  if (trainingMonths < 4) return "estimation";
  return "advanced";
}
