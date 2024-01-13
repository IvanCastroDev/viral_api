import { Router } from "express";
import { login, signIn, portHandler } from "../controllers/controllers";
import { validateUserData, validateLoginData, validateToken } from "../middlewares/validations";
const routes = Router();

routes.post("/login", validateLoginData, login)
    .post("/signin", validateUserData, signIn)
    .post("/port", validateToken, portHandler)
    .post('/test_req', (req, res) => {
        console.log(req.body)
        return res.status(200).json({pass: true})
    })

export default routes;