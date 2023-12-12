import express, { Request, Response, NextFunction as next } from 'express';
import cors from 'cors';
import createError from 'http-errors';
import MongoConnection from './db/connect';
import { EXPRESS } from "./configs/constants/configs";
import logging from './configs/log/logs';
import testRoute from "./controllers/status";
import loginRoutes from "./routes/login.routes";

// Initalize the server
const app = express();
const version = "/v1";
const NAMESPACE = "SERVER";

// Add initial configuration
app.use(cors({
  origin: '*'
}));
app.use(express.urlencoded({extended: true})); 
app.use(express.json());

// Loggs
app.use((req, res, next) => {
    logging.warn(
      NAMESPACE,
      `METHOD->[${req.method}], URL->[${req.url}] IP->[${req.socket.remoteAddress}]`
    );
  
    res.on("finish", () => {
      logging.warn(
        NAMESPACE,
        `METHOD->[${req.method}], URL->[${req.url}] IP->[${req.socket.remoteAddress}] STATUS->[${res.statusCode}]`
      );
    });
  
    next();
  });

// Handle on fordwards requests
/* app.use((req: Request, res: Response, next: next) => {
    next(createError(404));
}); */

// Test server route
app.use(version, testRoute);
app.use(version, loginRoutes);

// Try to connect to MongoDB
MongoConnection().then(() =>{
    app.listen(EXPRESS.port, () => {
        console.info("Connection established");
        console.log('Server listening on port ' + EXPRESS.port);
    })
}).catch(error => console.error(error));