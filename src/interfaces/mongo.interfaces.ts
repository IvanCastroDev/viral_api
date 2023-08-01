import { ConnectOptions } from "mongoose";

interface MongoConnectionOptions {
    username: string;
    password: string;
    options: ConnectOptions;
    url: string;
}

export default MongoConnectionOptions;