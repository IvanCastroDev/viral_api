import { Router } from "express";
import { login, signIn, portHandler, getMSISDN, isMSISDNAvailable, pre_activate, imeiData } from "../controllers/controllers";
import { validateUserData, validateLoginData, validateToken } from "../middlewares/validations";
const routes = Router();

routes.post("/login", validateLoginData, login)
    .post("/signin", validateUserData, signIn)
    .post("/port", validateToken, portHandler)
    .post("/pre_activate/:msisdn/:esim", validateToken, pre_activate)
    .post("/msisdn/:esim", validateToken, getMSISDN)
    .get("/msisdn_count/:esim", validateToken, isMSISDNAvailable)
    .get("/imeiData/:imei", imeiData)
    .post('/test_req', (req, res) => {
        console.log(req.body)
        return res.status(200).json({pass: true})
    })

export default routes;