import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API REST VIRALCEL',
      version: '1.5.0',
      description: 'Lista de endpoints para consumir',
    }
  },
  apis: [`${path.join(__dirname, './routes/*')}`]
};

const specs = swaggerJsdoc(options);

export default specs;