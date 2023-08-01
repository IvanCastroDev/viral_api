import { Document } from "mongoose";

export default interface IUser extends Document {
    [key: string]: any;
    username: string;
    name: string;
    lastName: string;
    password: string;
    email: string;
};