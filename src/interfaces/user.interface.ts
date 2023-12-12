import { Document } from "mongoose";

export default interface IUser extends Document {
    [key: string]: any;
    name: string;
    lastName: string;
    password: string;
    email: string;
    birthday: Date;
    phone: string;
};