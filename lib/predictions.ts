export interface Prediction {
  id: number;
  playerSlug: string;
  market: string;
  line: number;
  confidence?: number;
  createdAt: string;
  result?: string;
}

const predictions: Prediction[] = [];
let nextPredictionId = 1;

export function listPredictions(): Prediction[] {
  return predictions;
}

export function addPrediction(
  data: Omit<Prediction, 'id' | 'createdAt'>,
): Prediction {
  const pred: Prediction = {
    id: nextPredictionId++,
    createdAt: new Date().toISOString(),
    ...data,
  };
  predictions.push(pred);
  return pred;
}

export function addResult(id: number, result: string): Prediction | undefined {
  const pred = predictions.find((p) => p.id === id);
  if (pred) {
    pred.result = result;
  }
  return pred;
}