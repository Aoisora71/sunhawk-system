/**
 * API Documentation Generator
 * Generates OpenAPI/Swagger documentation from route handlers
 */

export interface ApiEndpoint {
  path: string
  method: string
  summary: string
  description?: string
  parameters?: Array<{
    name: string
    in: 'path' | 'query' | 'header'
    required: boolean
    schema: any
    description?: string
  }>
  requestBody?: {
    required: boolean
    content: {
      'application/json': {
        schema: any
      }
    }
  }
  responses: {
    [status: string]: {
      description: string
      content?: {
        'application/json': {
          schema: any
        }
      }
    }
  }
  tags?: string[]
}

/**
 * Generate OpenAPI 3.0 specification
 */
export function generateOpenAPISpec(endpoints: ApiEndpoint[]): any {
  const paths: any = {}

  endpoints.forEach((endpoint) => {
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {}
    }

    paths[endpoint.path][endpoint.method.toLowerCase()] = {
      summary: endpoint.summary,
      description: endpoint.description,
      parameters: endpoint.parameters?.map((param) => ({
        name: param.name,
        in: param.in,
        required: param.required,
        schema: param.schema,
        description: param.description,
      })),
      requestBody: endpoint.requestBody,
      responses: endpoint.responses,
      tags: endpoint.tags || [],
    }
  })

  return {
    openapi: '3.0.0',
    info: {
      title: 'Sunhawk System API',
      version: '1.0.0',
      description: 'API documentation for the Sunhawk Survey Management System',
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
        description: 'API Server',
      },
    ],
    paths,
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'authToken',
        },
      },
    },
    security: [
      {
        cookieAuth: [],
      },
    ],
  }
}

/**
 * Example endpoint documentation
 */
export const exampleEndpoints: ApiEndpoint[] = [
  {
    path: '/api/auth/login',
    method: 'POST',
    summary: 'User login',
    description: 'Authenticate user and return JWT token',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              email: { type: 'string', format: 'email' },
              password: { type: 'string', minLength: 8 },
            },
            required: ['email', 'password'],
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Login successful',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    email: { type: 'string' },
                    name: { type: 'string' },
                    role: { type: 'string', enum: ['admin', 'employee', 'none'] },
                  },
                },
              },
            },
          },
        },
      },
      '401': {
        description: 'Invalid credentials',
      },
    },
    tags: ['Authentication'],
  },
]

