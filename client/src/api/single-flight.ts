export const createSingleFlight = <T>(
  operation: () => Promise<T>,
): (() => Promise<T>) => {
  let inFlight: Promise<T> | null = null;

  return () => {
    if (!inFlight) {
      inFlight = operation().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  };
};

