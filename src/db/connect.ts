import mongoose from "mongoose";
import { MONGO, PG_CLIENT} from "../configs/constants/configs";

// Try to connect to mongo database

const Connections = () => {
    return new Promise<void>(async(resolve, reject) => {
        console.info("Connecting to MongoDB...");
        await mongoose.connect(MONGO.url, MONGO.options).catch((error) => 
            reject(error)
        );
        
        console.info("Connecting to Postgresql...");

        await PG_CLIENT.connect().catch((error) =>
            reject(error)
        );

        resolve();
    });
};

export default Connections;