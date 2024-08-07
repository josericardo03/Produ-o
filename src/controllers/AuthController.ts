import { Request, Response } from "express";
import axios, { AxiosResponse } from "axios";
require("dotenv").config();
let access_token = "";

const obterToken = async (res: Response) => {
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
      console.log(access_token);
    } else {
      console.error("Erro ao gerar token:", response.data);
    }
  } catch (error) {
    console.error("Erro ao gerar token:", error);
    res.status(500).send("Erro ao gerar token");
  }
};

const getAccessToken = () => {
  return access_token;
};

export default { obterToken, getAccessToken };
