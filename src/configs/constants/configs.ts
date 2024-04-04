import { ConnectOptions } from "mongoose";
import MongoConnectionOptions from "../../interfaces/mongo.interfaces";
import expressConfigs from "../../interfaces/express.interfaces";
import * as dotenv from 'dotenv';
import { Client } from "pg";

dotenv.config()

// Mongo DB configurations
const MONGO_DB = process.env.MONGO_DB || "localhost";
const MONGO_USERNAME = process.env.MONGO_USERNAME || "root";
const MONGO_PASSWORD = process.env.MONGO_PASSWORD || "password";

export const MONGO_OPTIONS: ConnectOptions = {
    socketTimeoutMS: 30000,
    maxPoolSize: 50,
    autoIndex: false,
    dbName: MONGO_DB
};

export const MONGO: MongoConnectionOptions = {
    username: MONGO_USERNAME,
    password: MONGO_PASSWORD,
    options: MONGO_OPTIONS,
    url: `mongodb+srv://${MONGO_USERNAME}:${MONGO_PASSWORD}@cluster0.pqdbpet.mongodb.net/?retryWrites=true&w=majority`
    
};
const PG_DB = process.env.PG_DB || "postgres";
const PG_USERNAME = process.env.PG_USERNAME || "postgres";
const PG_PASSWORD = process.env.PG_PASSWORD || "password";
const PG_PORT = process.env.PG_PORT || "3000";
const PG_HOST = process.env.PG_HOST || "127.0.0.1";

export const PG_OPTIONS = {
    user: PG_USERNAME,
    password: PG_PASSWORD,
    db: PG_DB,
    port: parseInt(PG_PORT),
    host: PG_HOST
}

export const PG_CLIENT = new Client({
    user: PG_OPTIONS.user,
    password: PG_OPTIONS.password,
    host: PG_OPTIONS.host,
    port: PG_OPTIONS.port,
    database: PG_OPTIONS.db
    
});

export const requestErrorMessages = {
    EMAIL_IN_USE: "El email indicado ya se encuentra en uso.",
    EMAIL_NOT_IN_REQUEST: "No email provided",
    PHONE_IN_USE: "El número de teléfono ya se encuentra en uso.",
    PASWORD_NOT_IN_REQUEST: "no password provided",
    NO_USER_FOUND: "El usuario indicado no esta registrado"
};

// Express server configuration
const port = parseInt(process.env.PORT || "8080");

export const EXPRESS: expressConfigs = {
    port: port
};

const hashString = process.env.HASH_STRING || "myhash";

export const hashConfigs = {
    HASH_STRING: hashString
};

const ALTAN_SANDBOX = (process.env.ALTAN_SANDBOX === 'true');

export const isSandbox = ALTAN_SANDBOX;