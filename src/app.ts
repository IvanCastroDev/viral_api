import express from 'express';
import cors from 'cors';
import Connections from './db/connect';
import { EXPRESS } from "./configs/constants/configs";
import logging from './configs/log/logs';
import testRoute from "./controllers/status";
import Routes from "./routes/routes";
import bodyParser from 'body-parser';
import swaggerUi from 'swagger-ui-express';
import basicAuth from 'express-basic-auth';
import specs from './swagger';
import { docConfigs } from './configs/constants/configs';

// Initalize the server
const app = express();
const version = "/v1";
const NAMESPACE = "SERVER";

const myAuthorizer = (username: string, password: string) => {
  const userMatches = basicAuth.safeCompare(username, docConfigs.DOC_USER);
  const passwordMatches = basicAuth.safeCompare(password, docConfigs.DOC_PASS);
  return userMatches && passwordMatches;
}

// Add initial configuration
app.use(cors({
  origin: '*'
}));
app.use(express.urlencoded({extended: true})); 
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.text({
  type: '*/*'
}));

app.use('/api-docs', basicAuth({
  authorizer: myAuthorizer,
  challenge: true
}), swaggerUi.serve, swaggerUi.setup(specs));

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