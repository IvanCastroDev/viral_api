import IUser from "../interfaces/user.interface";
import userModel from "../models/user.model";
import { Request, Response, response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { hashConfigs } from "../configs/constants/configs";
import { msisdnProfile } from "../interfaces/altan.interfaces";
import { isSandbox } from "../configs/constants/configs";
import { altanConfigs, numlexConfigs, odooConfigs } from "../configs/constants/configs";
import { Builder, parseStringPromise } from 'xml2js';
import { randomInt } from "crypto";
import NodeCache from "node-cache";
import { isWeekend, addDays, setHours, format, subDays } from 'date-fns';

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

export const numblexMessageHandler = async (req: Request, res: Response) => {
    console.log(req.body);
    const data = await parseStringPromise(req.body);

    let msgID = data['NPCData']['NPCMessage'][0]['$']['MessageID'];
    let portReq = {} as any;
    
    if (msgID === numlexConfigs.PORT_REQUEST_ACK_CODE)
        portReq = data['NPCData']['NPCMessage'][0]['PortRequestAck'][0];

    if (msgID === numlexConfigs.PORT_SCHEDULE_AUTH_CODE)
        portReq = data['NPCData']['NPCMessage'][0]['PortToBeScheduled'][0];

    if (msgID === numlexConfigs.PORT_REQUEST_SCHEDULED_CODE)
        portReq = data['NPCData']['NPCMessage'][0]['PortScheduled'][0];

    if (msgID === numlexConfigs.PORT_ERROR_CODE)
        portReq = data['NPCData']['NPCMessage'][0]['ErrorNotification'][0];

    if (Object.keys(portReq).length === 0)
        return returnSuccessMsg(res);

    console.log(portReq);

    const msgData = {
        msgID: msgID,
        portID: portReq['PortID'][0],
        rida: portReq['RIDA'][0],
        dida: portReq['DIDA'] ? portReq['DIDA'][0] : '',
        rcr: portReq['RCR'][0],
        dcr: portReq['DCR'] ? portReq['DCR'][0] : '',
        numberPort: portReq['Numbers'][0]['NumberRange'][0]['NumberFrom'][0],
        reasonCode: portReq['ReasonCode'] ? portReq['ReasonCode'][0] : undefined,
        xml: req.body
    }

    console.log(msgData)

    if (msgData.portID && msgData.msgID) {
        await sendPortMsg(msgData);

        const portData = await getPortData(msgData.portID);

        portData['rida'] = msgData['rida'];
        portData['dida'] = msgData['dida'];
        portData['rcr'] = msgData['rcr'];
        portData['dcr'] = msgData['dcr'];

        console.log(portData)

        if (msgData.msgID === numlexConfigs.PORT_SCHEDULE_AUTH_CODE) {
            if (!portData || Object.keys(portData).length === 0) {
                return returnSuccessMsg(res);
            }

            const maxDateToSchedule = portReq['DeadlineToSchedulePort'][0];
            const dateToSchedule = findEligibleDate(maxDateToSchedule);
            
            console.log(dateToSchedule);

            portData['PortExecDate'] = dateToSchedule;
            
            const portScheduleMessage = JsonToXml(getSchedulePortObject(portData));

            await sendNumlexMsg(portScheduleMessage);
        } else if (msgData.msgID === numlexConfigs.PORT_REQUEST_SCHEDULED_CODE) {
            const DateToSchedule = portReq['PortExecDate'][0];

            await altanPortIn(portData, DateToSchedule);
        };
    }

    return returnSuccessMsg(res);
};


const returnSuccessMsg = (res: Response) => {
    const soapResponse = `<?xml version="1.0"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
            <processNPCMsgResponse xmlns = "https://www.portabilidad.mx/">
                <processNPCMsgReturn>success</processNPCMsgReturn>
            </processNPCMsgResponse>
        </soap:Body>
    </soap:Envelope>`;
    
    res.header('Content-Type', 'text/xml');
    res.send(soapResponse);
};

export const portHandler = async (req: Request, res: Response) => {
    const portJson = getPortObject(req) as any;
    const portRequestMessage = JsonToXml(portJson);

    const xml = await sendNumlexMsg(portRequestMessage).catch(err => {
        return res.status(500).json({status: 'error', message: err});
    }) as string;

    const response = await parseStringPromise(xml);
    
    if (response['soap:Envelope']['soap:Body'][0]['processNPCMsgResponse'][0]['processNPCMsgReturn'][0])
        return res.status(200).json({status: "success", 
        data:
            {
                portabilityId: 0,
                curp: req.body.curp,
                nombres: req.body.nombres,
                apellidoPaterno: req.body.apellidoPaterno,
                apellidoMaterno: req.body.apellidoMaterno,
                numeroPortar: req.body.numeroPortar,
                numeroViral: req.body.numeroViral,
                nip: req.body.nip,
                portID: portJson['soapenv:Body']['por:processNPCMsg']['por:xmlMsg']['NPCData']['NPCMessage']['PortRequest']['PortID'],
                folioID: portJson['soapenv:Body']['por:processNPCMsg']['por:xmlMsg']['NPCData']['NPCMessage']['PortRequest']['FolioID'],
                timestamp: portJson['soapenv:Body']['por:processNPCMsg']['por:xmlMsg']['NPCData']['NPCMessage']['PortRequest']['Timestamp'],
                xml: portRequestMessage
            }
        })

    return res.status(500).json({status: 'error', message: response});
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

function findEligibleDate(date: string) {
    const year = parseInt(date.substring(0, 4));
    const month = parseInt(date.substring(4, 6)) - 1;
    const day = parseInt(date.substring(6, 8));
    const hour = parseInt(date.substring(8, 10));
    const minute = parseInt(date.substring(10, 12));

    let givenDate = new Date(Date.UTC(year, month, day, hour, minute));
    let targetDate = subDays(givenDate, 1);

    let currentDate = new Date();

    if (currentDate.getUTCHours() > 14) {
        currentDate = setHours(currentDate, 9);
        currentDate = addDays(currentDate, 1);
    }

    currentDate = setHours(currentDate, currentDate.getUTCHours() + 1);

    while (isWeekend(currentDate) && currentDate < targetDate) {
        currentDate = addDays(currentDate, 1);
        currentDate = setHours(currentDate, 9);
    }

    return format(currentDate, "yyyyMMddHHmmss");
}

const altanPortIn = async (port: any, approvedDate: string) => {
    try {
        let tokenError = false;
        let done = false;
        let Header = new Headers();
        let retData = {};
        let route = `${altanURL}/ac${isSandbox ? sandbox : ""}/v1/msisdns/port-in-c`;
        console.log(route)
        let body = JSON.stringify({
            "msisdnTransitory": port.numeroViral,
            "msisdnPorted": port.numeroPortar,
            "imsi": port.imsi,
            "approvedDateABD": approvedDate.substring(0, 8),
            "dida": port.dida,
            "rida": port.rida,
            "dcr": port.dcr,
            "rcr": port.rcr
        });
        console.log(body)

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
            }

            retData = response;
            done = true;
        }

        return retData;

    } catch (err) {
        console.error(err);
    }

};

async function getPortData(portId: string) {
    const body = JSON.stringify({
        jsonrpc: "2.0", 
        method: "call",
        params: {
            portId: portId
        }
    })

    const Header = new Headers({
        'Content-Type': 'application/json'
    });

    const route = `${odooConfigs.ODOO_ROUTE}/get_port`;
    let result = {} as any;

    try  {
        result = await fetch(route, {method: 'POST', headers: Header, body: body}).then(r => r.json())
    } catch (err) {
        console.error('Error at get port data', err);
    }

    return result.result;
}

async function sendPortMsg(port: any) {
    const body = JSON.stringify({
        jsonrpc: "2.0", 
        method: "call",
        params: {
            portID: port.portID,
            msgID: port.msgID,
            msg: port.xml,
            rida: port.rida,
            number: port.numberPort,
            reasonCode: port.reasonCode ? port.reasonCode : undefined,
            dcr: port.dcr,
            dida: port.dida,
            rcr: port.rcr
        }
    });

    const Header = new Headers({
        'Content-Type': 'application/json'
    });

    const route = `${odooConfigs.ODOO_ROUTE}/update_portability`;

    await fetch(route, {method: 'POST', headers: Header, body: body}).catch(err => {
        console.error('Error at handler numblex mesage', err);
    });
}

async function sendNumlexMsg(msg: string) {
    let Header = new Headers(); 
    Header.append('Content-Type', 'text/xml');

    try {
        const response = await fetch(numlexConfigs.MSG_ROUTE, { method: 'POST', headers: Header, body: msg })
        
        if (!response.ok) 
            throw new Error(`SOAP Error: ${response.status}`)

        const xml = await response.text();

        return xml;
        
    } catch (error) {
        console.error('Error al enviar la petición:', error);
        
    }
}

const getPortObject = (req: Request): Object => {
    const Timestamp = getFormattedTimestamp(false);
    const randomized = randomInt(10000,99999)
    const portID = `${numlexConfigs.VIRAL_IDA}${Timestamp}${randomized.toString().slice(1)}`;
    const folioId = `${numlexConfigs.VIRAL_IDA}${getFormattedTimestamp(true)}${randomized}`;

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
                                "PortID": portID,
                                "FolioID": folioId,
                                "Timestamp": `${Timestamp}`,
                                "SubsReqTime": `${Timestamp}`,
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

const getSchedulePortObject = (port: any): Object => {
    const Timestamp = getFormattedTimestamp(false);

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
                                "MessageID": "1006"
                            },
                            "PortScheduled": {
                                "PortType": "6",
                                "SubscriberType": "0",
                                "RecoveryFlagType": "N",
                                "PortID": port.portID,
                                "Timestamp": `${Timestamp}`,
                                "RIDA": `${port.rida}`,
                                "RCR": `${port.rcr}`,
                                "DIDA": `${port.dida}`,
                                "DCR": `${port.dcr}`,
                                "TotalPhoneNums": "1",
                                "Numbers": {
                                    "NumberRange": {
                                        "NumberFrom": `${port.numeroPortar}`,
                                        "NumberTo": `${port.numeroPortar}`
                                    }
                                },
                                'PortExecDate': port.PortExecDate
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

function getFormattedTimestamp(isId: boolean) {
    let now = new Date();
    let year = isId ? now.getFullYear().toString().slice(2) : now.getFullYear().toString();
    let month = (now.getMonth() + 1).toString().padStart(2, '0');
    let day = now.getDate().toString().padStart(2, '0');
    let hour = now.getHours().toString().padStart(2, '0');
    let minute = now.getMinutes().toString().padStart(2, '0');
    let second = isId ? '' : now.getSeconds().toString().padStart(2, '0');

    return year + month + day + hour + minute + second;
}