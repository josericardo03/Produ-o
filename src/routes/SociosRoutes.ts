import express from "express";
import SociosController from "../controllers/SociosController";

const envios = express.Router();

envios.get("/cadastroSocios-producao", SociosController.sociosDados);

export default envios;
