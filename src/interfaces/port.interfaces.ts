import { Document } from "mongoose";

export default interface IPort extends Document {
    [key: string]: any;
    id: string | undefined;
    folio: string | undefined;
    rid: string;
    rcr: string;
    numberPorts: number;
    viralNumber: number;
    pin: number;
};