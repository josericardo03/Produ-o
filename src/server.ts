import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import axios, { AxiosResponse } from "axios";
import cron from "node-cron";

import router from "./routes";

const app = express();

app.use(router);

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
cron.schedule("00 04 * * *", async () => {
  try {
    await axios.get("http://localhost:4001/teste-producao");
    console.log("Rota de envio de dados executada com sucesso");
  } catch (error) {
    console.error("Erro ao executar rota de envio de dados:", error);
  }
});

cron.schedule("01 04 * * *", async () => {
  try {
    await axios.get("http://localhost:4001/cadastroSocios-producao");
    console.log("Rota de envio de dados executada com sucesso");
  } catch (error) {
    console.error("Erro ao executar rota de envio de dados:", error);
  }
});

cron.schedule("02 04 * * *", async () => {
  try {
    await axios.get("http://localhost:4001/enviar-dados-fisicos-producao");
    console.log("Rota de envio de dados executada com sucesso");
  } catch (error) {
    console.error("Erro ao executar rota de envio de dados:", error);
  }
});
cron.schedule("03 04 * * *", async () => {
  try {
    await axios.get("http://localhost:4001/enviar-dados-producao");
    console.log("Rota de envio de dados executada com sucesso");
  } catch (error) {
    console.error("Erro ao executar rota de envio de dados:", error);
  }
});
