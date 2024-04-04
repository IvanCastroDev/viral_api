import { Router } from "express";
import { login, 
  signIn, 
  portHandler, 
  getMSISDN, 
  isMSISDNAvailable, 
  pre_activate, 
  imeiData, 
  purchase_plan, 
  getOperator, 
  get_msisdn_profile,
  altan_rute_type
} from "../controllers/controllers";
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

    /*Rutas para realizar portabilidad */
    .post("/port", validateToken, portHandler)

    /* Rutas para la venta de lineas nuevas y preactivacion */
    .post("/pre_activate/:msisdn/:esim", validateToken, pre_activate)
    .post("/msisdn/:esim", validateToken, getMSISDN)
    .get("/msisdn_count/:esim", validateToken, isMSISDNAvailable)
    
    /* Rutas para obtener informacion del equipo con base al IMEI o MSISDN*/
    .get("/imeiData/:imei", imeiData)
    .get("/msisdn/:msisdn", getOperator)
    .get("/msisdn_profile/:msisdn", get_msisdn_profile)

    /* Rutas para guardar imagenes para activacion de ESIM con Qr */
    .post('/qrupload', upload.single('file'), uploadImage)
    .post('/qruploads', upload.array('files'), uploadImages)

    /*Rutas para recargas */
    .post('/purchase_plan/:offer_id/:msisdn', validateToken, purchase_plan)
    .post('/test_req', (req, res) => {
        console.log(req.body)
        return res.status(200).json({pass: true})
    })
    .get('/altan_connection', altan_rute_type)

export default routes;