const swaggerJsdoc = require('swagger-jsdoc');

// Importe directement le fichier JSON
const swaggerDocument = require('./api-docs.json');

const options = {
  swaggerDefinition: swaggerDocument,
  apis: [], // Laissez vide car nous n'utilisons plus les JSDoc
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;