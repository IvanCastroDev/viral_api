import { Router } from "express";
import { login, 
  signIn, 
  portHandler,
  pre_activate, 
  imeiData, 
  purchase_plan, 
  getOperator, 
  get_msisdn_profile,
  altan_rute_type,
  change_viral_plan,
  deleteAction,
  numblexMessageHandler
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
    .post("/soap_api", numblexMessageHandler)

    /* Rutas para la venta de lineas nuevas y preactivacion */
    .post("/pre_activate/:msisdn", validateToken, pre_activate)
    
    /* Rutas para obtener informacion del equipo con base al IMEI o MSISDN*/
    .get("/imeiData/:imei", imeiData)
    .get("/msisdn/:msisdn", getOperator)
    .get("/msisdn_profile/:msisdn", get_msisdn_profile)

    /* Rutas para guardar imagenes para activacion de ESIM con Qr */
    .post('/qrupload', upload.single('file'), uploadImage)
    .post('/qruploads', upload.array('files'), uploadImages)

    /*Rutas para recargas */
    .post('/purchase_plan/:offer_id/:msisdn', validateToken, purchase_plan)
    .post('/change_plan/:offer_id/:msisdn', validateToken, change_viral_plan)

    /*Rutas para eliminar acciones dentro del cache*/
    .delete('/action/:msisdn', validateToken, deleteAction)

    /* Rutas de pruebas y validacion de conexiones */
    .post('/test_req', (req, res) => {
        console.log(req.body)
        return res.status(200).json({pass: true})
    })
    .get('/altan_connection', altan_rute_type)

export default routes;


/**
  * @swagger
  * components:
  *   securitySchemes:
  *     apiAuth:
  *       type: apiKey
  *       in: header
  *       name: authorization
  * 
  * /v1/port:
  *  post:
  *    summary: Procesa una solicitud de portabilidad
  *    description: Recibe datos del usuario y detalles de la portabilidad para procesarla y devolver el estado con los detalles correspondientes.
  *    security:
  *      - apiAuth: []
  *    tags:
  *      - Portabilidad
  *    requestBody:
  *      required: true
  *      content:
  *        application/json:
  *           schema:
  *             type: object
  *             properties:
  *               curp:
  *                 type: string
  *                 description: Clave Única de Registro de Población del usuario.
  *               nombres:
  *                 type: string
  *                 description: Nombres del usuario.
  *               apellidoPaterno:
  *                 type: string
  *                 description: Apellido paterno del usuario.
  *               apellidoMaterno:
  *                 type: string
  *                 description: Apellido materno del usuario.
  *               numeroPortar:
  *                 type: string
  *                 description: Número de teléfono a portar.
  *               numeroViral:
  *                 type: string
  *                 description: Número viral asociado a la portabilidad.
  *               nip:
  *                 type: string
  *                 description: Número de identificación personal para la portabilidad.        
  *    responses:
  *       401:
  *         description: No autenticado.
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 message:
  *                   type: string
  *                   description: Mensaje de error
  *       200:
  *         description: Detalles de la solicitud de portabilidad procesada correctamente.
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 portabilityId:
  *                   type: integer
  *                   description: Identificador interno de la portabilidad.
  *                 curp:
  *                   type: string
  *                   description: CURP recibida en la solicitud.
  *                 nombres:
  *                   type: string
  *                   description: Nombres recibidos en la solicitud.
  *                 apellidoPaterno:
  *                   type: string
  *                   description: Apellido paterno recibido en la solicitud.
  *                 apellidoMaterno:
  *                   type: string
  *                   description: Apellido materno recibido en la solicitud.
  *                 numeroPortar:
  *                   type: string
  *                   description: Número de teléfono a portar.
  *                 numeroViral:
  *                   type: string
  *                   description: Número viral asociado a la portabilidad.
  *                 nip:
  *                   type: string
  *                   description: NIP proporcionado en la solicitud.
  *                 portID:
  *                   type: string
  *                   description: Identificador de la portabilidad obtenido del sistema externo.
  *                 folioID:
  *                   type: string
  *                   description: Folio de la transacción de portabilidad obtenido del sistema externo.
  *                 timestamp:
  *                   type: string
  *                   description: Timestamp de la transacción obtenido del sistema externo.
  *                 xml:
  *                   type: string
  *                   description: Mensaje XML de la solicitud de portabilidad.
  * /v1/soap_api:
  *  post:
  *    summary: Procesa mensajes XML
  *    description: Recibe y procesa los mensajes de actualización de las portabilidades provenientes de Numlex.
  *    tags:
  *      - Portabilidad
  *    requestBody:
  *      required: true
  *      content:
  *        application/xml:
 *           schema:
 *             type: object
 *             properties:
 *               NPCData:
 *                 type: object
 *                 properties:
 *                   MessageHeader:
 *                     type: object
 *                     properties:
 *                       TransTimestamp:
 *                         type: string
 *                       Sender:
 *                         type: string
 *                       NumOfMessages:
 *                         type: integer
 *                   NPCMessage:
 *                     type: object
 *                     properties:
 *                       MessageID:
 *                         type: string
 *                       PortToBeScheduled:
 *                         type: object
 *                         properties:
 *                           PortType:
 *                             type: string
 *                           SubscriberType:
 *                             type: string
 *                           RecoveryFlagType:
 *                             type: string
 *                           PortID:
 *                             type: string
 *                           Timestamp:
 *                             type: string
 *                           DIDA:
 *                             type: string
 *                           DCR:
 *                             type: string
 *                           RIDA:
 *                             type: string
 *                           RCR:
 *                             type: string
 *                           TotalPhoneNums:
 *                             type: integer
 *                           Numbers:
 *                             type: object
 *                             properties:
 *                               NumberRange:
 *                                 type: object
 *                                 properties:
 *                                   NumberFrom:
 *                                     type: string
 *                                   NumberTo:
 *                                     type: string
 *                           DeadlineToSchedulePort:
 *                             type: string
 *                           DeadlineToExecutePort:
 *                             type: string
 *                           DIDAResponse:
 *                             type: string       
  *    responses:
  *       200:
 *         description: XML procesado y respuesta SOAP generada
 *         content:
 *           application/xml:
 *             schema:
 *               type: object
 *               properties:
 *                 soap:Envelope:
 *                   type: object
 *                   properties:
 *                     soap:Body:
 *                       type: object
 *                       properties:
 *                         processNPCMsgResponse:
 *                           type: object
 *                           properties:
 *                             processNPCMsgReturn:
 *                               type: string
 *                   xml:
 *                     soap: "http://schemas.xmlsoap.org/soap/envelope/"
 *                     xsi: "http://www.w3.org/2001/XMLSchema-instance"
 *                     xsd: "http://www.w3.org/2001/XMLSchema"
  * /v1/pre_activate/{msisdn}:
  *  post:
  *    summary: Realiza una orden de preactivación
  *    description: Recibe un MSISD y Offer ID para preactivar dicho número.
  *    security:
  *      - apiAuth: []
  *    tags:
  *      - Planes y recargas
  *    parameters:
  *     - in: path
  *       name: msisdn
  *       required: true
  *       description: Línea VIRAL que será preactivada
  *       schema:
  *         type: string
  *    requestBody:
  *      required: true
  *      content:
  *        application/json:
  *           schema:
  *             type: object
  *             properties:
  *               offeringId:
  *                 type: string
  *                 description: ID de la oferta.
  *    responses:
  *       401:
  *         description: No autenticado.
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 message:
  *                   type: string
  *                   description: Mensaje de error
  *       400:
  *         description: Error en el formato de los parametros enviados
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 status:
  *                   type: string
  *                 message:
  *                   type: string
  *       200:
  *         description: Detalles de la operación efectuada correctamente.
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 status:
  *                   type: string
  *                   description: Estado de la operación.
  *                 data:
  *                   type: object
  *                   description: Datos de respuesta de Altan. 
  *                   properties:
  *                     effectiveDate:
  *                       type: string
  *                     order:
  *                       type: object
  *                       properties:
  *                         id:
  *                           type: string
  * 
  * /v1/imeiData/{imei}:
  *  get:
  *    summary: Obten información de un equipo
  *    description: Retorna información de un equipo como la compatibilidad con la red VIRAL.
  *    tags:
  *      - Información de equipos y Lineas
  *    parameters:
  *     - in: path
  *       name: imei
  *       required: true
  *       description: IMEI del dispositivo
  *       schema:
  *         type: string
  *    responses:
  *       401:
  *         description: No autenticado.
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 message:
  *                   type: string
  *                   description: Mensaje de error
  *       400:
  *         description: Error en el formato de los parametros enviados
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 status:
  *                   type: string
  *                 message:
  *                   type: string
  *       200:
  *         description: Retorna los datos del equipo.
  *         content:
  *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: 'success'
 *                 data:
 *                   type: object
 *                   properties:
 *                     imei:
 *                       type: object
 *                       properties:
 *                         imei:
 *                           type: string
 *                           example: '00000000'
 *                         homologated:
 *                           type: string
 *                           example: 'COMPATIBLE PROBADO'
 *                         blocked:
 *                           type: string
 *                           example: 'NO'
 *                         sub_category:
 *                           type: string
 *                           example: 'Voz y Datos'
 *                         soportaESIM:
 *                           type: string
 *                           example: 'SI'
 *                     deviceFeatures:
 *                       type: object
 *                       properties:
 *                         volteCapable:
 *                           type: string
 *                           example: 'SI'
 *                         band28:
 *                           type: string
 *                           example: 'SI'
 *                         model:
 *                           type: string
 *                           example: 'iPhone'
 *                         brand:
 *                           type: string
 *                           example: 'Apple'
  * /v1/msisdn/{msisdn}:
  *  get:
  *    summary: Valida que una línea sea VIRAL
  *    tags:
  *      - Información de equipos y Lineas
  *    parameters:
  *     - in: path
  *       name: msisdn
  *       required: true
  *       description: Número a validar
  *       schema:
  *         type: string
  *    responses:
  *       401:
  *         description: No autenticado.
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 message:
  *                   type: string
  *                   description: Mensaje de error
  *       400:
  *         description: Error en el formato de los parametros enviados
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 status:
  *                   type: string
  *                 message:
  *                   type: string
  *       200:
  *         description: Retorna los datos del equipo.
  *         content:
  *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: 'success'
 *                 message:
 *                   type: string
 *                   example: 'Valid MSISDN'
  * /v1/msisdn_profile/{msisdn}:
  *  get:
  *    summary: Obtiene el estado de una linea en Altan
  *    description: Retorna los datos disponibles para una línea, así como el estado de esta
  *    tags:
  *      - Información de equipos y Lineas
  *    parameters:
  *     - in: path
  *       name: msisdn
  *       required: true
  *       description: Número a validar
  *       schema:
  *         type: string
  *    responses:
  *       401:
  *         description: No autenticado.
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 message:
  *                   type: string
  *                   description: Mensaje de error
  *       400:
  *         description: Error en el formato de los parametros enviados
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 status:
  *                   type: string
  *                 message:
  *                   type: string
  *       200:
  *         description: Retorna los datos del equipo.
  *         content:
  *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                status:
 *                  type: string
 *                  example: 'success'
 *                data:
 *                  type: object
  * /v1/purchase_plan/{offer_id}/{msisdn}:
  *  post:
  *    summary: Recarga a una línea
  *    description: Envía una orde de reacarga para un número a Altan
  *    tags:
  *      - Planes y recargas
  *    security:
  *      - apiAuth: []
  *    parameters:
  *     - in: path
  *       name: offer_id
  *       required: true
  *       description: ID de la oferta
  *       schema:
  *         type: string
  *     - in: path
  *       name: msisdn
  *       required: true
  *       description: Número al que se le aplicará la recarga
  *       schema:
  *         type: string
  *    responses:
  *       401:
  *         description: No autenticado.
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 message:
  *                   type: string
  *                   description: Mensaje de error
  *       400:
  *         description: Error en el formato de los parametros enviados
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 status:
  *                   type: string
  *                 message:
  *                   type: string
  *       200:
  *         description: Detalles de la orden efectuada.
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 status:
  *                   type: string
  *                   description: Estado de la operación.
  *                   example: 'success'
  *                 data:
  *                   type: object
  *                   description: Datos de respuesta de Altan. 
  *                   properties:
  *                     msisdn:
  *                       type: string
  *                     effectiveDate:
  *                       type: string
  *                     offerings:
  *                       type: array
  *                       items:
  *                         type: string
  *                     order:
  *                       type: object
  *                       properties:
  *                         id:
  *                           type: string
  * /v1/change_plan/{offer_id}/{msisdn}:
  *  post:
  *    summary: Cambia la oferta primaria
  *    description: Cambiar el plan domiciliado de una línea
  *    tags:
  *      - Planes y recargas
  *    security:
  *      - apiAuth: []
  *    parameters:
  *     - in: path
  *       name: offer_id
  *       required: true
  *       description: ID de la oferta
  *       schema:
  *         type: string
  *     - in: path
  *       name: msisdn
  *       required: true
  *       description: Número al que se le aplicará el cambio de plan
  *       schema:
  *         type: string
  *    responses:
  *       401:
  *         description: No autenticado.
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 message:
  *                   type: string
  *                   description: Mensaje de error
  *       400:
  *         description: Error en el formato de los parametros enviados
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 status:
  *                   type: string
  *                 message:
  *                   type: string
  *       200:
  *         description: Detalles de la orden efectuada.
  *         content:
  *           application/json:
  *             schema:
  *               type: object
  *               properties:
  *                 status:
  *                   type: string
  *                   description: Estado de la operación.
  *                   example: 'success'
  *                 data:
  *                   type: object
  *                   description: Datos de respuesta de Altan. 
  *                   properties:
  *                     msisdn:
  *                       type: string
  *                     effectiveDate:
  *                       type: string
  *                     offeringId:
  *                       type: string
  *                     order:
  *                       type: object
  *                       properties:
  *                         id:
  *                           type: string
  */