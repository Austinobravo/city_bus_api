import { createSwaggerSpec } from 'next-swagger-doc';

export function getApiDocs() {
  return createSwaggerSpec({
    apiFolder: './app/api',
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'City Bus Transit API Docs',
        version: '1.0',
      },
      servers: [
        {
          url: "https://city-bus-api.vercel.app",
          description: "Production server",
        },
        {
          url: "http://localhost:3000",
          description: "Local dev server",
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT', 
          },
        },
      },
      security: [
        {
          BearerAuth: [], // applies globally to all endpoints
        },
      ],
    },
  });
}
