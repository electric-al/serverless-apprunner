module.exports = 
{
  type: 'object',
  properties: {
    services: {
      type: 'object',
      patternProperties: {
        '^[a-zA-Z0-9\-]+$': {
          type: 'object',
          additionalProperties: false,
          properties: {
            serviceName: { type: 'string' },
            memory: { type: 'integer', enum: [256, 512, 1024, 2048, 4096] },
            image: { type: 'string' },
            httpPort: { type: 'integer' },
            cpu: { type: 'integer', enum: [256, 512, 1024, 2048, 4096] },
            environment: { type: 'object' },
            iamRoleStatements: { type: 'array' },
            tags: {
              type: 'object',
              patternProperties: {
                '^.+$': { type: 'string' },
              },
            },
          },
        }
      }
    }
  }
};
