const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'G-House API',
            version: '1.0.0',
            description: 'API pour la plateforme de location G-House, gérant les utilisateurs, les logements, les réservations et les documents.'
        },
        servers: [
            {
                url: 'http://localhost:5000',
                description: 'Serveur de développement'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [{
            bearerAuth: [],
        }],
    },
    apis: ['./index.js'], // Chemin vers votre fichier principal
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;