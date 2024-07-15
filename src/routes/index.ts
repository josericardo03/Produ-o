import express from "express";
import envio from "./EnviarDadosRoutes";
import senha from "./AuthRoutes";
import envios from "./SociosRoutes";
import envioFisico from "./EnviarDadosFisica";
import envioTeste from "./TesteRoutes";

const router = express.Router();
router.use(envioTeste);
router.use(envioFisico);
router.use(envios);
router.use(envio);
router.use(senha);

export default router;
