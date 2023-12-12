import { model, Schema } from "mongoose";
import IUser from "../interfaces/user.interface";

const userSchema: Schema = new Schema ({
    username: {
        type: String, 
        required: false,
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
    phone: {
        type: String,
        validate: {
            validator: function(value: string) {
                return /^([+]?52[]1[])?[0-9]{2}[0-9]{4}[0-9]{4}$/.test(value);
            },
            message: (props: { value: any; }) => `${props.value} is not a valid phone number`
        },
        required: [true, "No phone Number Provided"],
        unique: [true, "This phone is not available"],
        index: true
    } as any,
    email: {
        type: String, 
        validate: {
            validator: function(v: string) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: (props: { value: any; }) => `${props.value} is not a valid Email`
        },
        required: [true, "No Email Provided"], 
        unique: {
            value: true,
            message: 'El correo electrónico debe ser único'
        },
        index: true
    } as any,
    birthday: { type: Date, required: false }
}, { timestamps: true });

export default model<IUser>("user", userSchema);
