import { Router } from "express";
import { login, signIn } from "../controllers/login.controllers";
import { validateUserData, validateLoginData } from "../middlewares/validations";
const routes = Router();

routes.post("/login", validateLoginData, login)
    .post("/signin", validateUserData, signIn)

export default routes;