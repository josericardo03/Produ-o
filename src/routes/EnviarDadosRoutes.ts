import express from "express";
import EnviarDadosController from "../controllers/EnviarDadosController";

const envio = express.Router();

envio.get("/enviar-dados-producao", EnviarDadosController.enviarDados);

export default envio;

// AND DATE(p.finalizadaEm) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
