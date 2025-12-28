/**
 * Request size and rate limiting utilities
 */

const MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_JSON_DEPTH = 10

/**
 * Validate request body size
 * @param request - Next.js request object
 * @throws Error if request body is too large
 */
export async function validateRequestSize(request: Request): Promise<void> {
  const contentLength = request.headers.get('content-length')
  
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (size > MAX_REQUEST_BODY_SIZE) {
      throw new Error(
        `Request body too large. Maximum size is ${MAX_REQUEST_BODY_SIZE / 1024 / 1024}MB`
      )
    }
  }
}

/**
 * Safely parse JSON request body with size and depth limits
 * @param request - Next.js request object
 * @returns Parsed JSON object
 * @throws Error if parsing fails or limits exceeded
 */
export async function parseRequestBody<T = any>(request: Request): Promise<T> {
  await validateRequestSize(request)
  
  try {
    // Use request.json() for JSON requests (more efficient and handles stream properly)
    // Clone the request if we need to read it multiple times (but we don't in this case)
    const parsed = await request.json()
    
    // Check object size (approximate - count keys)
    const sizeEstimate = JSON.stringify(parsed).length
    if (sizeEstimate > MAX_REQUEST_BODY_SIZE) {
      throw new Error(
        `Request body too large. Maximum size is ${MAX_REQUEST_BODY_SIZE / 1024 / 1024}MB`
      )
    }
    
    // Validate JSON depth
    if (typeof parsed === 'object' && parsed !== null) {
      const depth = getObjectDepth(parsed)
      if (depth > MAX_JSON_DEPTH) {
        throw new Error(`JSON depth exceeds maximum of ${MAX_JSON_DEPTH} levels`)
      }
    }
    
    return parsed as T
  } catch (error) {
    if (error instanceof SyntaxError || (error as any)?.message?.includes('JSON')) {
      throw new Error('Invalid JSON format')
    }
    // Re-throw size/depth errors
    if ((error as any)?.message?.includes('too large') || (error as any)?.message?.includes('depth')) {
      throw error
    }
    throw error
  }
}

/**
 * Get approximate depth of an object
 */
function getObjectDepth(obj: any, currentDepth: number = 0): number {
  if (currentDepth > MAX_JSON_DEPTH) {
    return currentDepth
  }
  
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return currentDepth
  }
  
  let maxDepth = currentDepth
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const depth = getObjectDepth(obj[key], currentDepth + 1)
      maxDepth = Math.max(maxDepth, depth)
    }
  }
  
  return maxDepth
}

/**
 * Middleware to validate request before processing
 */
export async function validateRequest(request: Request): Promise<void> {
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
    await validateRequestSize(request)
  }
}

