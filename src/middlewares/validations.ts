import IUser from "../interfaces/user.interface";
import userModel from "../models/user.model";
import { Request, Response, NextFunction } from "express";
import { requestErrorMessages } from "../configs/constants/configs";

export const validateUserData = async (req: Request, res: Response, next: NextFunction) => {
    const errors = await validate(req.body);

    if (errors)
        return res.status(400).json({message: errors[0]});

    if (await userModel.findOne({ email: req.body.email }))
        return res.status(400).json({message: requestErrorMessages.EMAIL_IN_USE});

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