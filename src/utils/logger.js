// Only operational metadata belongs here. Never pass request data or raw errors.
export function createLogger(write = (line) => console.log(line)) {
  return (event, { requestId, method, status, durationMs, attempt, port, errorType } = {}) => {
    write(JSON.stringify({ time: new Date().toISOString(), event, requestId,
      method, status, durationMs, attempt, port, errorType }));
  };
}

export const logger = createLogger();
