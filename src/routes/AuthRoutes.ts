import express, { Request, Response } from "express";
import AuthController from "../controllers/AuthController";

const senha = express.Router();

senha.get("/token", async (req: Request, res: Response) => {
  await AuthController.obterToken(res);
});

export default senha;
