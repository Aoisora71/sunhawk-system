/**
 * API Documentation Endpoint
 * Returns OpenAPI/Swagger specification
 */

import { NextResponse } from 'next/server'
import { generateOpenAPISpec, exampleEndpoints } from '@/lib/api-docs'

export async function GET() {
  try {
    const spec = generateOpenAPISpec(exampleEndpoints)
    return NextResponse.json(spec, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate API documentation' },
      { status: 500 }
    )
  }
}

