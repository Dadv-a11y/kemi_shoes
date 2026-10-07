// Point d'entrée Passenger (cPanel › Setup Node.js App) pour le build standalone de Next.js.
// Passenger remplace le port d'écoute par sa propre socket : la valeur ci-dessous n'est qu'un repli.
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || '3000';
process.env.HOSTNAME = process.env.HOSTNAME || '0.0.0.0';
require('./server.js');
