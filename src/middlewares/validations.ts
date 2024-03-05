import IUser from "../interfaces/user.interface";
import userModel from "../models/user.model";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { requestErrorMessages } from "../configs/constants/configs";
import { hashConfigs } from "../configs/constants/configs";

export const validateUserData = async (req: Request, res: Response, next: NextFunction) => {
    const errors = await validate(req.body);

    if (errors)
        return res.status(400).json({message: errors[0]});

    if (await userModel.findOne({ email: req.body.email }))
        return res.status(400).json({message: requestErrorMessages.EMAIL_IN_USE});

    if (await userModel.findOne({ phone: req.body.phone }))
        return res.status(400).json({message: requestErrorMessages.PHONE_IN_USE});

    next(); 
};

export const validateLoginData = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.body.email)
        return res.status(400).json({message: requestErrorMessages.EMAIL_NOT_IN_REQUEST});
    if (!req.body.password)
        return res.status(400).json({message: requestErrorMessages.PASWORD_NOT_IN_REQUEST});
    
    const userData = await userModel.findOne({email: req.body.email});

    if (!userData)
        return res.status(404).json({message: requestErrorMessages.NO_USER_FOUND});

    req.user = userData;

    next();
};

export const validateToken = async (req: Request, res: Response, next: NextFunction) => {
    if(!req.headers.authorization)
        return res.status(401).json({message: "Header authentication not found"})

    let token = req.headers.authorization?.replace("bearer ", "");
    let segment = token.split(".");
    
    try {
        if (segment.length != 3)
            throw Error("Invalid authorization");

        let payload: any = jwt.verify(token, hashConfigs.HASH_STRING);

        if (Date.now() >= payload.exp * 1000)
            return res.status(401).json({ message: "token expired" });

        const user = await userModel.findOne({ email: payload.userData.email });

        if(!user)
            return res.status(401).json({ message: "invalid token" });

        req.user = user;

    } catch (err) {
        return res.status(503).json({ message: "invalid token", err });
    }

    next();
};

const validate = async (userData: IUser): Promise<String[] | void> => {
    return new Promise<string[] | void>(async (resolve) => {
        await userModel.validate(userData).catch(error => {
            const errors = error.errors;
            const errorsReturn: string[] = Object.keys(errors).map(key => errors[key].message);

            resolve(errorsReturn)
        });

        resolve();
    })
}