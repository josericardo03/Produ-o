import express from "express";
import EnviarDadosFisicaController from "../controllers/EnviarDadosFisicaController";

const envioFisico = express.Router();

envioFisico.get(
  "/enviar-dados-fisicos",
  EnviarDadosFisicaController.enviarDadosFisica
);

export default envioFisico;
