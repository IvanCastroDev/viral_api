import IUser from "../interfaces/user.interface";
import userModel from "../models/user.model";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { hashConfigs } from "../configs/constants/configs";

export const login = async (req: Request, res: Response) => {
    const { password } = req.body;

    if (!await bcrypt.compare(password, req.user.password, ))
        return res.status(401).json({message: "Incorrect password"});

    const token = createToke(createTokenData(req.user));

    return res.status(200).json({email: req.user.email, phone: req.user.phone, name: req.user.name, lastName: req.user.lastName, token: token});
};

export const signIn = async (req: Request, res: Response) => {
    let newUser: IUser = await createUser(req.body);

    try {
        await newUser.save()

        let token = createToke(createTokenData(newUser));
        
        return res.status(200).json({token: token});
    } catch (err) {
        await handleError(err, res);
    }
};

export const portHandler = async (req: Request, res: Response) => {
    console.log(req.user)
};

const getAltanToken = async () => {
    var myHeaders = new Headers();
    myHeaders.append("Authorization", "Basic d0NHYWlNTXJBRDdMTkR5d0owTDhkTGxjZnJQRzVJWmE6RHg1WWFubzdMQVhpdzFUYw==");

    var requestOptions = {
    method: 'POST',
    headers: myHeaders,
    redirect: 'follow'
    };
    
};

const updateUser = async (userEmail: string, data: any) => {
    await userModel.findOneAndUpdate({email: userEmail}, data, {new: true});
}

const createUser = async (body: any): Promise<IUser> => {
    let user: IUser = new userModel();
    for (let key of Object.keys(body)) {
        user[key] = key === "password" ? await bcrypt.hash(body[key], 10) : body[key]
    }
    return user;
}

const createTokenData = (userData: IUser) => {
    const { email, userName, name, lastName } = userData;
    return { email, userName, name, lastName };
}

const createToke = (userData: any): string => {
    return jwt.sign({userData}, hashConfigs.HASH_STRING, {expiresIn: "365d"});
}

const handleError = async (error: any, res: Response): Promise<Response> => {
    if (error.code !== 11000)
        return res.status(500).json({
            message: "Error saving user", 
            error: error
        });

    switch (true) {
        case "email" in error.keyValue: 
            return res.status(400).json({message: "Email already exists"});
        case "username" in error.keyValue:
            return res.status(400).json({message: "Username already exist"});
        default:
            console.log(error);
            return res.status(500).json({message: "internal error", error: error});
            
    } 
}