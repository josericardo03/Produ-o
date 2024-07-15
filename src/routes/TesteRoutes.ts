// routes.ts
import express from "express";
import TesteController from "../controllers/TesteController";

const envioTeste = express.Router();

envioTeste.get("/teste", TesteController.fetchDados);

export default envioTeste;
