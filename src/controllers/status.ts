import { Router } from "express";

const route = Router();

route.get('/test', (req, res) => {
    return res.status(200).send("Server responded");
});

export default route;