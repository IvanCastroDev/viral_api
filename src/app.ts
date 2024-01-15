import express from 'express';
import cors from 'cors';
import Connections from './db/connect';
import { EXPRESS } from "./configs/constants/configs";
import logging from './configs/log/logs';
import testRoute from "./controllers/status";
import Routes from "./routes/routes";
import { PG_CLIENT } from './configs/constants/configs';

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
app.use(version, Routes);

// Try to connect to MongoDB
Connections().then(() =>{
    app.listen(EXPRESS.port, () => {
        console.info("Connections established");
        console.log('Server listening on port ' + EXPRESS.port);
    })
}).catch(error => console.error(error));