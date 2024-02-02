import { Router } from "express";
import { login, signIn, portHandler, getMSISDN, isMSISDNAvailable, pre_activate, imeiData } from "../controllers/controllers";
import { validateUserData, validateLoginData, validateToken } from "../middlewares/validations";
import { uploadImage, uploadImages } from "../middlewares/multer";
import multer from 'multer';

const routes = Router();

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
      cb(null, './src/public/esims');
    },
    filename: function(req, file, cb) {
      cb(null, file.originalname);
    }
  });

const upload = multer({storage: storage});
  

routes.post("/login", validateLoginData, login)
    .post("/signin", validateUserData, signIn)
    .post("/port", validateToken, portHandler)
    .post("/pre_activate/:msisdn/:esim", validateToken, pre_activate)
    .post("/msisdn/:esim", validateToken, getMSISDN)
    .get("/msisdn_count/:esim", validateToken, isMSISDNAvailable)
    .get("/imeiData/:imei", imeiData)
    .post('/qrupload', upload.single('file'), uploadImage)
    .post('/qruploads', upload.array('files'), uploadImages)
    .post('/test_req', (req, res) => {
        console.log(req.body)
        return res.status(200).json({pass: true})
    })

export default routes;