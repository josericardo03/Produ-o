import { Request, Response } from "express";
import axios, { AxiosResponse } from "axios";
import nodemailer from "nodemailer";
require("dotenv").config();

let access_token = "";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "ti@desenvolve.mt.gov.br",
    pass: process.env.EMAIL_PASSWORD,
  },
});

class TesteController {
  constructor() {
    this.fetchDados = this.fetchDados.bind(this);
    this.obterToken = this.obterToken.bind(this);
  }

  async fetchDados(req: Request, res: Response) {
    try {
      await this.obterToken();

      const response: AxiosResponse<any> = await axios.get(
        "https://amtf.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/buscapessoa/1040157",
        {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
            Authorization: `Bearer ${access_token}`,
          },
        }
      );

      res.json(response.data);
    } catch (error: any) {
      console.error("Erro ao buscar dados:", error.response.data);
      this.enviarEmailErro("Erro ao buscar dados", error.response.data); // Envie o email em caso de erro
      res.status(500).send("Erro ao buscar dados");
    }
  }

  async obterToken() {
    try {
      const response: AxiosResponse<any> = await axios.post(
        "https://amtf.app.dimensa.com.br/keycloakcorebank/auth/realms/master/protocol/openid-connect/token",
        `client_id=portal-admin-web&grant_type=password&username=${process.env.USER}&password=${process.env.PASSWORD}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "*/*",
          },
        }
      );

      if (
        response.status === 200 &&
        response.data &&
        response.data.access_token
      ) {
        access_token = response.data.access_token;
        console.log("Token obtido:", access_token);
      } else {
        console.error("Erro ao gerar token:", response.data);
        throw new Error("Erro ao obter token");
      }
    } catch (error: any) {
      console.error("Erro ao gerar token:", error.response.data);
      await this.enviarEmailErro("Erro ao gerar token", error.response.data);
      throw error;
    }
  }

  private async enviarEmailErro(tipoErro: string, mensagemErro: string) {
    try {
      const mailOptions = {
        from: "ti@desenvolve.mt.gov.br",
        to: "josesilva@desenvolve.mt.gov.br",
        subject: `Erro no servidor - ${tipoErro}`,
        text: `O seguinte erro ocorreu no servidor:\n\n${JSON.stringify(
          mensagemErro,
          null,
          2
        )}`,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Email enviado para notificação de erro (${tipoErro})`);
    } catch (error: any) {
      console.error("Erro ao enviar email de erro:", error.response.data);
    }
  }
}

export default new TesteController();
