import { Router } from "express";
import { login, signIn, portHandler, getMSISDN, isMSISDNAvailable, pre_activate } from "../controllers/controllers";
import { validateUserData, validateLoginData, validateToken } from "../middlewares/validations";
const routes = Router();

routes.post("/login", validateLoginData, login)
    .post("/signin", validateUserData, signIn)
    .post("/port", validateToken, portHandler)
    .post("/pre_activate/:msisdn", validateToken, pre_activate)
    .post("/msisdn", validateToken, getMSISDN)
    .get("/msisdn_count", validateToken, isMSISDNAvailable)
    .post('/test_req', (req, res) => {
        console.log(req.body)
        return res.status(200).json({pass: true})
    })

export default routes;