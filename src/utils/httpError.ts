export class HttpError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'HttpError'
  }
}

// React Query retry policy. A 4xx will not change on retry, and a retried 429
// only eats further into the same per-client limit. A retried 5xx can spend
// provider quota, so it gets one attempt. Anything else is a network failure.
export const shouldRetryQuery = (failureCount: number, error: unknown) => {
  if (error instanceof HttpError) return error.status >= 500 && failureCount < 1
  return failureCount < 3
}
