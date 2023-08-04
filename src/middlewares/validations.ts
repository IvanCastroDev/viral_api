import IUser from "../interfaces/user.interface";
import userModel from "../models/user.model";
import { Request, Response, NextFunction } from "express";

export const validateUserData = async (req: Request, res: Response, next: NextFunction) => {
    const errors = await validate(req.body);

    if (errors)
        return res.status(400).json({message: errors[0]});

    next(); 
};

export const validateLoginData = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.body.email)
        return res.status(400).json({message: "no email provided"});
    if (!req.body.password)
        return res.status(400).json({message: "no password provided"});
    
    const userData = await userModel.findOne({email: req.body.email});

    if (!userData)
        return res.status(404).json({message: "User not found"});

    req.user = userData;

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