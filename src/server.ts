import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import axios, { AxiosResponse } from "axios";
import cron from "node-cron";

import router from "./routes";

const app = express();

app.use(router);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
cron.schedule("45 12 * * *", async () => {
  try {
    await axios.get("http://localhost:4000/teste");
    console.log("Rota de envio de dados executada com sucesso");
  } catch (error) {
    console.error("Erro ao executar rota de envio de dados:", error);
  }
});

cron.schedule("46 12 * * *", async () => {
  try {
    await axios.get("http://localhost:4000/cadastroSocios");
    console.log("Rota de envio de dados executada com sucesso");
  } catch (error) {
    console.error("Erro ao executar rota de envio de dados:", error);
  }
});

cron.schedule("48 12 * * *", async () => {
  try {
    await axios.get("http://localhost:4000/enviar-dados-fisicos");
    console.log("Rota de envio de dados executada com sucesso");
  } catch (error) {
    console.error("Erro ao executar rota de envio de dados:", error);
  }
});
cron.schedule("11 13 * * *", async () => {
  try {
    await axios.get("http://localhost:4000/enviar-dados");
    console.log("Rota de envio de dados executada com sucesso");
  } catch (error) {
    console.error("Erro ao executar rota de envio de dados:", error);
  }
});
