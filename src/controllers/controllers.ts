import IUser from "../interfaces/user.interface";
import userModel from "../models/user.model";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { hashConfigs } from "../configs/constants/configs";
import { PG_CLIENT } from "../configs/constants/configs";
import { msisdnProfile } from "../interfaces/altan.interfaces";
import { isSandbox } from "../configs/constants/configs";

const altanURL = "https://altanredes-prod.apigee.net";
const sandbox = "-sandbox";

let token = "";
let viralIda = '061';

export const login = async (req: Request, res: Response) => {
    const { password } = req.body;

    if (!await bcrypt.compare(password, req.user.password, ))
        return res.status(401).json({message: "Incorrect password"});

    const token = createToke(createTokenData(req.user));

    return res.status(200).json({status: "success", email: req.user.email, phone: req.user.phone, name: req.user.name, lastName: req.user.lastName, token: token});
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

export const getMSISDN = async (req: Request, res: Response) => {
    const esim = req.params.esim === "True";
    const tableNamePrefix = esim ? "viral_esim" : "viral_numbers";
    const tableName = `${tableNamePrefix}${isSandbox ? "_test" : ""}`;
    
    const MSISDN = (await PG_CLIENT.query(`SELECT * FROM ${tableName} WHERE is_saled = false limit 1`)).rows;

    if (MSISDN.length == 0)
        return res.status(400).json({status: "Error", type: "No MSISDN available", message: "No se encontraron MSISDN disponibles"});

    return res.status(200).json({status: "success", msisdnData: MSISDN[0]})
};

export const pre_activate = async (req: Request, res: Response) => {
    const esim = req.params.esim === "True";
    const tableNamePrefix = esim ? "viral_esim" : "viral_numbers";
    const tableName = `${tableNamePrefix}${isSandbox ? "_test" : ""}`;

    const { msisdn } = req.params;
    const { offeringId } = req.body;

    try {
        let tokenError = false;
        let done = false;
        let Header = new Headers();
        let retData = {};
        let route = `${altanURL}/cm${isSandbox ? sandbox : ""}/v1/subscribers/${msisdn}/preregistered`;

        let body = JSON.stringify({
            "offeringId": offeringId,
            "idPoS": ""
        });

        while (!done) {
            let token = await getAltanToken(tokenError);

            Header.append("Authorization", `Bearer ${token}`);
            Header.append("Content-Type", "application/json");
    
            const response = await fetch(route, { method: 'POST', headers: Header, body: body }).then((r) => r.json());

            if (response["description"] === "Access token expired" || response["description"] === "Invalid access token") {
                tokenError = true;
                continue;
            }

            if (response["description"])
                return res.status(400).json({status: 'error', message: response["description"]})

            retData = response;
            done = true;
        }

        await updateElement(`UPDATE ${tableName} SET is_saled = true WHERE msisdn = '${msisdn}'`);

        return res.status(200).json({status: "success", data: retData});

    } catch (err) {
        console.error(err);
        return res.status(501).json({status: "error", message: err});
    }

};

export const isMSISDNAvailable = async (req: Request, res: Response) => {
    const esim = req.params.esim === "True";
    const tableNamePrefix = esim ? "viral_esim" : "viral_numbers";
    const tableName = `${tableNamePrefix}${isSandbox ? "_test" : ""}`;
    
    const MSISDNCount = (await PG_CLIENT.query(`SELECT COUNT(*) FROM ${tableName} WHERE is_saled = false`)).rows;
    
    return res.status(200).json({status: "success", number: MSISDNCount[0]["count"]})
};

export const portHandler = async (req: Request, res: Response) => {
    console.log(req.user)
};

export const imeiData = async (req: Request, res: Response) => {
    const { imei } = req.params;

    if (!imei)
        return res.status(400).json({status: 'error', message: 'No imei provided'})
    
    let done = false;
    let tokenError = false;
    let Header = new Headers();
    let retData = {};
    let route = `${altanURL}/ac/v1/imeis/${imei}/status`;

    try {
        while (!done) {
            let token = await getAltanToken(tokenError);
    
            Header.append("Authorization", `Bearer ${token}`);
    
            const response = await fetch(route, { method: 'GET', headers: Header }).then((r) => r.json());
    
            if (response["description"] === "Access token expired" || response["description"] === "Invalid access token") {
                tokenError = true;
                continue;
            }

            if (response["description"])
                return res.status(400).json({status: 'error', message: response["description"]})

            retData = response;
            done = true;
        }
    
        return res.status(200).json({status: "success", data: retData});

    } catch (err) {
        console.error(err);
        return res.status(500).json({status: "error", message: err});
    }
};

interface operatorRespons  {
    [key: string]: string;
    msisdn: string;
    cr: string;
    ida: string;
    type: string;
}

export const getOperator = async (req: Request, res: Response) => {
    const { msisdn } = req.params;

    if (!msisdn)
        return res.status(400).json({status: "error", message:'Invalid msisdn'});

    let done = false;
    let tokenError = false;
    let Header = new Headers();
    let retData = {} as operatorRespons;
    let route = `${altanURL}/cm/v1/subscribers/lookupForOperator?msisdn=${msisdn}`;

    try {
        while (!done) {
            let token = await getAltanToken(tokenError);

            Header.append("Authorization", `Bearer ${token}`);
            
            const response = await fetch(route, { method: 'GET', headers: Header }).then((r) => r.json());

            if (response["description"] === "Access token expired" || response["description"] === "Invalid access token") {
                tokenError = true;
                continue;
            }

            if (response["description"] === "The request sent is incorrect")
                return res.status(400).json({status: 'error', message: 'Some parameters are incorrect'})
            
            if (response["description"])
                return res.status(400).json({status: 'error', message: response["description"]})

            retData = response;
            done = true;
        }

        if(retData['ida'] === viralIda)
            return res.status(200).json({status: 'success', message: 'Valid MSISDN'});

        return res.status(200).json({status: "error", data: 'Invalid MSISDN'});

    } catch (err) {
        console.error(err);
        return res.status(500).json({status: "error", message: err});
    }
}

export const purchase_plan = async (req: Request, res: Response) => {
    const { offer_id, msisdn } = req.params

    if (!offer_id || !msisdn)
        return res.status(400).json({status: 'error', message: 'No offertId or msisdn provided'})

    let done = false;
    let tokenError = false;
    let Header = new Headers();
    let retData = {};
    let route = `${altanURL}/cm${isSandbox? sandbox : ""}/v1/products/purchase`;

    try {
        let body = JSON.stringify({
            offerings: [
                offer_id
            ],
            msisdn: msisdn,
            scheduleDate: '',
            expireEffectiveDate: ''
        })

        while (!done) {
            let token = await getAltanToken(tokenError);

            Header.append("Authorization", `Bearer ${token}`);
            Header.append("Content-Type", "application/json");
            
            const response = await fetch(route, { method: 'POST', headers: Header, body: body }).then((r) => r.json());

            if (response["description"] === "Access token expired" || response["description"] === "Invalid access token") {
                tokenError = true;
                continue;
            }

            if (response["description"] === "The request sent is incorrect") {
                console.log(response)
                return res.status(400).json({status: 'error', message: 'Some parameters are incorrect'})
            }
            if (response["description"]) {
                console.log(response)
                return res.status(400).json({status: 'error', message: response["description"]})
            }
            
            retData = response;
            done = true;
        }

        return res.status(200).json({status: "success", data: retData});

    } catch (err) {
        console.error(err);
        return res.status(500).json({status: "error", message: err});
    }
};

export const get_msisdn_profile = async (req: Request, res: Response) => {
    const { msisdn } = req.params;

    if (!msisdn)
        return res.status(400).json({status: 'error', message: 'No msisdn provided'});

    let done = false;
    let tokenError = false;
    let Header = new Headers();
    let retData = {} as msisdnProfile;
    let route = `${altanURL}/cm/v1/subscribers/${msisdn}/profile`;

    try {
        while (!done) {
            let token = await getAltanToken(tokenError);

            Header.append("Authorization", `Bearer ${token}`);

            const response = await fetch(route, { method: 'GET', headers: Header }).then((r) => r.json());

            if (response["description"] === "Access token expired" || response["description"] === "Invalid access token") {
                tokenError = true;
                continue;
            }
            
            if (response["description"] === "The request sent is incorrect")
                return res.status(400).json({status: 'error', message: 'Some parameters are incorrect'})

            if (response["description"])
                return res.status(400).json({status: 'error', message: response["description"]})

            retData = response['responseSubscriber'];
            done = true;
        }

        return res.status(200).json({status: "success", data: retData});

    } catch (err) {
        console.error(err);
        return res.status(500).json({status: 'error', message: err})
    }
};

export const altan_rute_type = (req: Request, res: Response) => {
    return res.status(200).send(`connection type: ${isSandbox? sandbox : "prod"}`)
};

/* -------------------------------------------------------------------------- */

const updateElement = async (query: string) => {
    await PG_CLIENT.query(query);
};

const getAltanToken =  (tokenError: boolean) => {
    return new Promise( async (resolve, reject) => {

        if (token !== "" && !tokenError)
            resolve(token)

        var myHeaders = new Headers();
        myHeaders.append("Authorization", "Basic d0NHYWlNTXJBRDdMTkR5d0owTDhkTGxjZnJQRzVJWmE6RHg1WWFubzdMQVhpdzFUYw==");
        
        try {
            const response = await fetch(`${altanURL}/v1/oauth/accesstoken?grant-type=client_credentials`, {
                method: 'POST',
                headers: myHeaders
            }).then((res) => res.json())
    
            token = response["accessToken"];
            resolve(response["accessToken"]);

        } catch (error: any) {
            console.error(error)
            reject(error);
        }
    })
};

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

function getDate(actualDate?: Date) {
    if (actualDate) {
        let fecha = new Date(actualDate);
        fecha.setMonth(fecha.getMonth() + 1);
        return formatDate(fecha)
    }

    let fecha = new Date();

    return formatDate(fecha);
}

const formatDate = (fecha: Date) => {
    var year = fecha.getFullYear();
    var month = (fecha.getMonth() + 1).toString().padStart(2, '0');
    var day = fecha.getDate().toString().padStart(2, '0');
    return year + month + day;
}