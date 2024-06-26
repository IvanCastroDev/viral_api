import IUser from "../interfaces/user.interface";
import userModel from "../models/user.model";
import { Request, Response, response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { hashConfigs } from "../configs/constants/configs";
import { msisdnProfile } from "../interfaces/altan.interfaces";
import { isSandbox } from "../configs/constants/configs";
import { altanConfigs, numlexConfigs } from "../configs/constants/configs";
import { Builder } from 'xml2js';
import { randomInt } from "crypto";
import NodeCache from "node-cache";

const altanURL = "https://altanredes-prod.apigee.net";
const sandbox = "-sandbox";

let token = "";
let viralIda = '061';

const xmlBuilder = new Builder({
    xmldec: { version: '1.0', encoding: 'UTF-8' },
    renderOpts: { 'pretty': true, 'indent': '    ', 'newline': '\n' },
    headless: false
});

interface Action {
    [key: string]: any;
    action: string,
    msisdn: string,
    offer_id: string,
    response: Record<string, any>,
    status: 'success',
    date: string
}

let actionsCache =  new NodeCache({stdTTL: 86400, checkperiod: 3600});

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

export const pre_activate = async (req: Request, res: Response) => {
    const { msisdn } = req.params;
    const { offeringId } = req.body;

    if (!validateAction(msisdn, offeringId))
        return res.status(400).json({status: "error", message: 'MSISDN already actived'});

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
                console.log(response)
                tokenError = true;
                continue;
            }

            if (response["description"]) {
                console.log(response)
                return res.status(400).json({status: 'error', message: response["description"]})
            }

            retData = response;
            done = true;
        }

        createAction('pre_activation', msisdn, offeringId, retData);

        return res.status(200).json({status: "success", data: retData});

    } catch (err) {
        console.error(err);
        return res.status(501).json({status: "error", message: err});
    }

};

export const portHandler = async (req: Request, res: Response) => {
    console.log(req.body)

    const portJson = getPortObject(req);
    const portRequestMessage = JsonToXml(portJson);

    return res.status(200).send(portRequestMessage)
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
            console.log(response)

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

    if (!validateAction(msisdn, offer_id))
        return res.status(400).json({status: 'error', message: 'Already have this offer'}) 

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

        createAction('purchase_plan',msisdn,offer_id,retData);

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

export const change_viral_plan = async (req: Request, res: Response) => {
    const { msisdn } = req.params;
    const { offer_id } = req.params;
    
    if (!msisdn ||!offer_id)
        return res.status(400).json({status: 'error', message: 'No msisdn or offer_id provided'});

    if (!validateAction(msisdn, offer_id))
        return res.status(400).json({status: 'error', message: 'Already have this offer'})

    let done = false;
    let tokenError = false;
    let Header = new Headers();
    let retData = {};
    let route = `${altanURL}/cm${isSandbox? sandbox : ""}/v1/subscribers/${msisdn}`;
    
    try {
        let body = JSON.stringify({
            primaryOffering: {
                offeringId: offer_id
            }
        })

        while (!done) {
            let token = await getAltanToken(tokenError);
            
            Header.append("Authorization", `Bearer ${token}`);
            Header.append("Content-Type", "application/json");
            
            const response = await fetch(route, { method: 'PATCH', headers: Header, body: body}).then(r => r.json());

            if (response["description"] === "Access token expired" || response["description"] === "Invalid access token") {
                tokenError = true;
                continue;
            }

            if (response["description"] === "The request sent is incorrect") {
                console.log(response);
                return res.status(400).json({status: 'error', message: 'Some parameters are incorrect'})
            }

            if (response["description"]) {
                console.log(response);
                return res.status(400).json({status: 'error', message: response["description"]})
            }
            retData = response;
            done = true;
        }

        createAction('change_plan', msisdn, offer_id, retData)

        return res.status(200).json({status: "success", data: retData});

    } catch (err) {
        console.error(err);
        return res.status(500).json({status: 'error', message: err})
    }
}

export const deleteAction = (req: Request, res: Response) => {
    const msisdn = req.params.msisdn;

    try {
        actionsCache.del(msisdn);
    } catch (err) {
        console.error(err);
        return res.status(500).json({status: 'error', message: err})
    }

    return res.status(200).json({status: "success", message: "Action deleted"});
};

export const altan_rute_type = (req: Request, res: Response) => {
    return res.status(200).send(`connection type: ${isSandbox? sandbox : "prod"}`)
};

/* -------------------------------------------------------------------------- */

const getPortObject = (req: Request): Object => {
    const userTimestamp = getFormattedTimestamp();

    const Timestamp = getFormattedTimestamp();
    const randomized = randomInt(10000,99999)

    return {
        "soapenv:Body": {
            "por:processNPCMsg": {
                "por:userId": `${numlexConfigs.NUMLEX_USER}`,
                "por:password": `${numlexConfigs.NUMLEX_PASS}`,
                "por:xmlMsg": {
                    "NPCData": {
                        "MessageHeader": {
                            "TransTimestamp": `${Timestamp}`,
                            "Sender": `${numlexConfigs.VIRAL_IDA}`,
                            "NumOfMessages": "1"
                        },
                        "NPCMessage": {
                            "$": {
                                "MessageID": "1001"
                            },
                            "PortRequest": {
                                "PortType": "6",
                                "SubscriberType": "0",
                                "RecoveryFlagType": "N",
                                "PortID": `${numlexConfigs.VIRAL_IDA}${Timestamp}${randomized}`,
                                "FolioID": `${numlexConfigs.VIRAL_IDA}${Timestamp}${randomized}`,
                                "Timestamp": `${Timestamp}`,
                                "SubsReqTime": `${userTimestamp}`,
                                "RIDA": `${numlexConfigs.VIRAL_IDA}`,
                                "RCR": `${numlexConfigs.ALTAN_CR}`,
                                "TotalPhoneNums": "1",
                                "Numbers": {
                                    "NumberRange": {
                                        "NumberFrom": `${req.body.numeroPortar}`,
                                        "NumberTo": `${req.body.numeroPortar}`
                                    }
                                },
                                "Pin": `${req.body.nip}`,
                                "Comments": "",
                                "NumOfFiles": "0"
                            }
                        }
                    }
                }
            }
        }
    }
}

const JsonToXml = (data:Object): string => {
    return xmlBuilder.buildObject(data);
};

const getAltanToken =  (tokenError: boolean) => {
    return new Promise( async (resolve, reject) => {

        if (token !== "" && !tokenError)
            resolve(token)

        var myHeaders = new Headers();
        myHeaders.append("Authorization", `Basic ${altanConfigs.ALTAN_ADMIN_TOKEN}`);
        
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

const validateAction = (msisdn: string, offer_id: string) => {
    const action = actionsCache.get(msisdn) as Action;
    const today = new Date().toDateString();

    if (action && action.date === today && action.offer_id === offer_id) {
        return false;
    }

    return true;
}

const createAction = (action: string, msisdn:  string, offer_id: string, retData: Object ) => {
    actionsCache.set(msisdn, {
        action: action,
        msisdn: msisdn,
        offer_id: offer_id,
        response: retData,
        status: 'success',
        date: new Date().toDateString()
    });
};

function getFormattedTimestamp() {
    let now = new Date();
    let year = now.getFullYear().toString().slice(2);
    let month = (now.getMonth() + 1).toString().padStart(2, '0');
    let day = now.getDate().toString().padStart(2, '0');
    let hour = now.getHours().toString().padStart(2, '0');
    let minute = now.getMinutes().toString().padStart(2, '0');

    return year + month + day + hour + minute;
}