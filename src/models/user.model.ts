import { model, Schema } from "mongoose";
import IUser from "../interfaces/user.interface";

const userSchema: Schema = new Schema ({
    username: {
        type: String, 
        required: [true, "No username Provided"], 
        unique: true,
    },
    name: {
        type: String, 
        required: [true, "No name Provided"]
    },   
    lastName: {
        type: String, 
        required: [true, "No last name Provided"]
    },
    password: {
        type: String, 
        required: [true, "No password Provided"]
    },
    email: {
        type: String, 
        validate: {
            validator: function(v: string) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: (props: { value: any; }) => `${props.value} is not a valid Email`
        },
        required: [true, "No Email Provided"], 
        unique: [true, "email already exists"],
        index: true
    } as any,
}, { timestamps: true });

export default model<IUser>("user", userSchema);
