import { Request, Response } from "express";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import AuthController from "./AuthController";
import CreateLoggers from "../../utils/loggers";
import nodemailer from "nodemailer";
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "ti@desenvolve.mt.gov.br",
    pass: process.env.EMAIL_PASSWORD,
  },
});

const enviarPastaLogs = async () => {
  try {
    const hoje = new Date()
      .toISOString()
      .slice(0, 10)
      .split("-")
      .reverse()
      .join("-");

    const diretorioLogs = path.join(__dirname, "../logs", hoje);

    if (!fs.existsSync(diretorioLogs)) {
      throw new Error(`O diretório ${diretorioLogs} não existe.`);
    }

    const nomeArquivoZIP = "logs.zip";

    const caminhoArquivoZIP = path.join(__dirname, nomeArquivoZIP);

    const zip = new AdmZip();

    zip.addLocalFolder(diretorioLogs);

    zip.writeZip(caminhoArquivoZIP);

    console.log(`Pasta de logs compactada em ${caminhoArquivoZIP}`);

    return caminhoArquivoZIP;
  } catch (error) {
    console.error("Erro ao compactar a pasta de logs:", error);
    throw error;
  }
};

const prisma = new PrismaClient();

const EnviarDadosController = {
  enviarDados: async (req: Request, res: Response) => {
    const loggers = CreateLoggers();

    const {
      loggerErros,
      loggerClientes,
      loggerBanco,
      loggerClientesAtualizados,
    } = loggers;

    try {
      await AuthController.obterToken(res);
      const access_token = AuthController.getAccessToken();

      const resultado: any[] = await prisma.$queryRaw`
       SELECT DISTINCT
    p.*, 
    c.*, 
    cn.code AS cnae_code, 
    cn.descDivisao AS cnae_descDivisao,
    cid.nome AS cidadeComercio,
    es.uf as estadoComercio,
    cidp.nome as cidadepessoal,
    est.uf as estadoPessoal
FROM 
    proposta AS p
INNER JOIN 
    clients AS c ON c.id = p.clientId
LEFT JOIN 
    cnaes AS cn ON cn.id = c.cnaeId
LEFT JOIN 
    socios AS s ON s.clientId = c.id
LEFT JOIN 
    cidades AS cid ON c.cidadeComercial = cid.id
Left join 
		estados as es ON c.estadoComercial = es.id
Left join
        cidades as cidp On c.cidade = cidp.id
Left join
		estados as est on c.estado = est.id
WHERE 
    p.status = 'deferido' and c.tipoCliente="juridica"AND DATE(p.finalizadaEm) = DATE_SUB(CURDATE(), INTERVAL 2 DAY)
ORDER BY 
    p.createdAt DESC 


      `;

      if (resultado.length === 0) {
        loggerBanco.info(
          "Nenhum registro de proposta pendente para cliente pessoa juridica. %s",
          new Date()
        );
        throw new Error(
          "Não foi encontrado nenhum registro da consulta da proposta"
        );
      }

      const hoje = new Date().toISOString().slice(0, 10);

      const dadosParaEnviar = [];
      let enderecoParaEnviar = [];
      let enderecoPessoal = [];
      let ramoAtividade = [];
      const codCli = [];
      let contatosEnvio = [];
      let sociosArray = [];

      for (const cliente of resultado) {
        const formatarData = (data: Date | null) => {
          return data ? data.toISOString().slice(0, 10) : null;
        };
        let dadosSocios;
        const resultadoSocios: any[] = await prisma.$queryRaw`
       SELECT 
          * from socios where clientId=${cliente.id}
      `;
        const sociosCliente = [];
        for (let i = 0; i < resultadoSocios.length; i++) {
          const socios = resultadoSocios[i];

          dadosSocios = {
            codigoCliente: "",
            numeroSequencial: i + 1,

            numeroCicSocio: socios.document
              ? socios.document.replace(/[./ -]/g, "")
              : "",
            quantidadeCota: socios.participacao,
            percentualParticipacaoCapitalTotal: socios.participacao,
            representanteLegal: socios.isGerente,
            poderRepresentacao: false,
            nomePessoa: socios.name,
            nacionalidade: cliente.socioNacionalidade || "BRASIL",

            numeroDocumento: socios.numeroIdentificacao,
            codigoEstadoCivil: mapearEstadoCivil(socios.estadoCivil),
            dataAdministrativaDesdobramento: hoje,
            dataHoraAtualizacao: hoje,
            dataEmissao: formatarData(socios.dataEmissaoDocumento),
            siglaOrgaoEmissorOutroDocumento: socios.orgaoExpeditor,
            enderecoPrincipal: {
              nomeLogradouro: socios.endereco,
              nomeBairro: socios.enderecoBairro,
              // descricaoComplementoEndereco: socios.enderecoComplemento,
              nomeCidade: socios.enderecoCidade,
              codigoCep: socios.enderecoCep
                ? socios.enderecoCep.replace(/[./ -]/g, "")
                : "",
            },
          };
          sociosCliente.push(dadosSocios);
        }
        sociosArray.push(sociosCliente);
        // console.log(sociosArray);
        // console.log(dadosSocios);
        // console.log("----------------------------------------------");

        const resultadoContatos: any[] = await prisma.$queryRaw`
    SELECT DISTINCT
    c.email AS cliente_email,
    c.telefone,
    s.telefoneFixo,
    s.telefoneCelular,
    s.telefoneWhatsApp,
    s.email AS socio_email
FROM
    clients c
JOIN
    socios s ON c.id = s.clientId
WHERE
    c.id =${cliente.id}
    limit 1
      `;
        for (let i = 0; i < resultadoContatos.length; i++) {
          const contact = resultadoContatos[i];
          const contatosArray = [];

          let camposPreenchidos = 0;
          if (contact.cliente_email) {
            camposPreenchidos++;
            const dadosContatos = {
              codigoCliente: "",
              codigoTipoContato: "EML",
              numeroSequencial: camposPreenchidos,
              descricaoEmail: contact.cliente_email,
            };
            contatosArray.push(dadosContatos);
          }

          if (contact.telefone) {
            camposPreenchidos++;
            let telefoneCliente = contact.telefone.replace(
              /[/ - - ()]/g,
              ""
            ).length;
            const dadosContatos = {
              codigoCliente: "",
              codigoTipoContato: telefoneCliente === 10 ? "FNE" : "CEL",
              telefoneCompleto: cliente.telefone
                ? contact.telefone.replace(/[/ - - ()]/g, "")
                : "",
              numeroSequencial: camposPreenchidos,
            };
            contatosArray.push(dadosContatos);
          }
          if (
            contact.telefoneFixo &&
            contact.telefoneFixo !== contact.telefone
          ) {
            camposPreenchidos++;
            const dadosContatos = {
              codigoCliente: "",
              codigoTipoContato: "FNE",
              numeroSequencial: camposPreenchidos,
              telefoneCompleto: contact.telefoneFixo
                ? contact.telefoneFixo.replace(/[/ - - ()]/g, "")
                : "",
            };
            contatosArray.push(dadosContatos);
          }
          if (
            contact.telefoneCelular &&
            contact.telefoneCelular !== contact.telefone
          ) {
            camposPreenchidos++;
            const dadosContatos = {
              codigoCliente: "",
              codigoTipoContato: "CEL",
              numeroSequencial: camposPreenchidos,
              telefoneCompleto: contact.telefoneCelular
                ? contact.telefoneCelular.replace(/[/ - - ()]/g, "")
                : "",
            };
            contatosArray.push(dadosContatos);
          }
          if (
            contact.telefoneWhatsApp &&
            contact.telefoneWhatsApp !== contact.telefone &&
            contact.telefoneWhatsApp !== contact.telefoneCelular
          ) {
            camposPreenchidos++;
            const dadosContatos = {
              codigoCliente: "",
              codigoTipoContato: "CEL",
              numeroSequencial: camposPreenchidos,
              telefoneCompleto: contact.telefoneWhatsApp
                ? contact.telefoneWhatsApp.replace(/[/ - - ()]/g, "")
                : "",
            };
            contatosArray.push(dadosContatos);
          }
          if (
            contact.socio_email &&
            contact.socio_email !== contact.cliente_email
          ) {
            camposPreenchidos++;
            const dadosContatos = {
              codigoCliente: "",
              codigoTipoContato: "EML",
              numeroSequencial: camposPreenchidos,
              descricaoEmail: contact.socio_email,
            };
            contatosArray.push(dadosContatos);
          }

          contatosEnvio.push(contatosArray);
        }

        function mapearCodigoPorte(n: any) {
          switch (n) {
            case "mei":
              return 11;
            case "microempresa":
              return 8;
            case "pequena-empresa":
              return 9;
            case "media-empresa":
              return 2;
            case "grande-empresa":
              return 3;
            default:
              return null;
          }
        }
        let v;
        if (cliente.enquadramentoTributario) {
          v = 11;
        }

        function mapearEstadoCivil(n: any) {
          switch (n) {
            case "solteiro":
              return "SO";
            case "casado":
              return "CA";
            case "divorciado":
              return "DI";
            default:
              return null;
          }
        }

        function mapearSede(n: any) {
          switch (n) {
            case "propria":
              return 1;
            case "alugada":
              return 2;
            case "financiada":
              return 3;
            case "outros":
              return 4;
            default:
              return null;
          }
        }

        let dadosCliente;

        if (cliente.tipoCliente === "juridica") {
          dadosCliente = {
            codigoPortaBnds: cliente.porte
              ? v
              : mapearCodigoPorte(cliente.porte),
            descricaoRazaoSocialAnterior: cliente.razaoSocial,
            campoCnaeBndes: cliente.cnae_code
              ? cliente.cnae_code.replace(/[./ -]/g, "")
              : "",
            codigoUnidadeResponsavel: 1,
            tipoPessoa: cliente.tipoCliente
              ? cliente.tipoCliente.charAt(0).toUpperCase()
              : "",
            nomePessoa: cliente.razaoSocial,
            numeroCic: cliente.cnpj.replace(/[./ -]/g, ""),
            dataClienteDesde: hoje,
            dataRenovacaoCadastral: hoje,
            // descricaoLocalizacao: cliente.logradouro,
            segmento: 1,

            indicadorNivelRelacionamento: false,
            dataInicioRelacionamentoInstituicao: formatarData(
              cliente.createdAt
            ),
            tipoLigacao: {
              description: "Não Ligado",
            },

            unidadePessoa: [
              {
                codigoUnidade: 1,
                codigoGerente: 1,

                numeroInscricaoEstatudal: cliente.inscricaoEstadual,
                numeroInscricaoMunicipal: cliente.inscricaoMunicipal,
                dataConstituicao: formatarData(cliente.dataAbertura),
                identificadorSituacao: "ATIVO",
                complementoUnidadePessoa: {
                  dataCadastro: formatarData(cliente.createdAt),
                  dataRenovacaoCadastro: hoje,
                  tipoCadatro: "PJ",
                },
              },
            ],
            indicadorAtualizacaoCliente: true,
            indicadorPossuiProcurador: false,
            identificadorGrupoEconomico: false,
            pessoaJuridica: {
              valorPatrimonioLiquido: cliente.capitalSocial,
              dataUltimoBalancete: "2021-12-31",
              valorCapitalSocial: cliente.capitalSocial,
              codigoPortaBnds: cliente.portabnds
                ? v
                : mapearCodigoPorte(cliente.porte),
              valorFaturamentoAnual: cliente.faturamentoTotalUltimosMeses,
              identificadorTipoBalanco: "REAL",
              identificadorControleAcionista: "PN",
              codigoNaturezaBndes: cliente.naturezaJuridicaId,
              descricaoCaracteristicaNegocioEmpresa: `${cliente.cnae_code.replace(
                /[^\w\s]/g,
                ""
              )} ${cliente.cnae_descDivisao}`,
              numeroSetor: 1,
            },
          };
        }
        const socioFisico = {};
        const enderecoCliente = {
          codigoCliente: "",
          codigoUnidade: 1,
          siglaTipoEndereco: cliente.siglaTipoEndereco
            ? cliente.siglaTipoEndereco
            : "EMPRESA",
          siglaUf: cliente.estadoComercio,
          nomeCidade: cliente.cidadeComercio,
          nomeBairro: cliente.bairroComercial,
          codigoCep: cliente.cepComercial
            ? cliente.cepComercial.replace(/[./ -]/g, "")
            : "",
          nomeLogradouro: cliente.logradouroComercial,
          numeroEndereco: cliente.numeroEnderecoComercial,

          idenTipoEndereco: true,
          telefoneCompleto: cliente.telefone
            ? cliente.telefone.replace(/[/ - - ()]/g, "")
            : "",
          codigoTipoImovel: mapearSede(cliente.sede),
        };
        enderecoParaEnviar.push(enderecoCliente);
        const endereco = {
          siglaTipoEndereco: cliente.siglaTipoEndereco
            ? cliente.siglaTipoEndereco
            : "CORRESPONDENCIA",
          codigoCliente: "",
          codigoUnidade: 1,
          nomeCidade: cliente.cidadepessoal,
          codigoCep: cliente.cep ? cliente.cep.replace(/[./ -]/g, "") : "",
          numeroEndereco: cliente.numeroEndereco,
          nomeLogradouro: cliente.logradouro,
          nomeBairro: cliente.bairro,
          // descricaoComplementoEndereco: cliente.complementoEndereco,
          siglaUf: cliente.estadoPessoal,
        };
        enderecoPessoal.push(endereco);

        const ramo = {
          codigoCliente: "",
          codigoRamoAtividade: 3002,
          atividadePrincipal: true,
          siglaAtividade: cliente.cnae_code.replace(/[./ -]/g, ""),
        };
        ramoAtividade.push(ramo);

        dadosParaEnviar.push(dadosCliente);
      }

      let indicesParaRemover = [];
      let indicesParaAtualizar = [];
      let flag;
      for (let i = 0; i < dadosParaEnviar.length; i++) {
        const cliente = dadosParaEnviar[i];
        try {
          let codigoCliente = "";

          const response = await axios.post(
            "https://amtf.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/pessoa",
            cliente,
            {
              headers: {
                Accept: "*/*",
                "Content-Type": "application/json",
                Authorization: `Bearer ${access_token}`,
              },
            }
          );
          codigoCliente = response.data.codigoCliente;
          flag = 1;
          codCli.push(codigoCliente);
          console.log("Dados enviados:", cliente);
          console.log("Resposta do servidor:", response.data);
          loggerClientes.info(
            "Dados enviados: %s => Resultado do cadastro %s",
            cliente,
            response.data
          );
        } catch (error: any) {
          loggerErros.error(
            "Erro ao cadastrar cliente: %s => Resultado do cadastro %s",
            cliente ? cliente.nomePessoa : "Cliente não encontrado",
            error.response.data
          );
          flag = 0;
          if (error) {
            try {
              const responsecnpj = await axios.get(
                `https://amtf.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/buscarpessoaviacnpj/${cliente?.numeroCic}`,

                {
                  headers: {
                    Accept: "*/*",
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${access_token}`,
                  },
                }
              );
              let codtemporario = "";
              codtemporario = responsecnpj.data.body.codigoCliente;

              if (codtemporario) {
                try {
                  const responsecodtemporario = await axios.get(
                    `https://amtf.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/buscapessoa/${codtemporario}`,

                    {
                      headers: {
                        Accept: "*/*",
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${access_token}`,
                      },
                    }
                  );
                  let cadastral;
                  let clienteDesde: Date;
                  function diffInMonths(date1: Date, date2: Date): number {
                    const diffYears = date2.getFullYear() - date1.getFullYear();
                    const diffMonths = date2.getMonth() - date1.getMonth();
                    return diffYears * 12 + diffMonths;
                  }
                  cadastral = new Date(
                    responsecodtemporario.data.body.dataRenovacaoCadastral
                  );
                  if (isNaN(cadastral.getTime())) {
                    cadastral = null;
                  }
                  clienteDesde = new Date(
                    responsecodtemporario.data.body.dataClienteDesde
                  );
                  console.log(cadastral);
                  console.log(clienteDesde);
                  let teste = new Date();
                  // teste.setMonth(teste.getMonth() - 5);
                  let diferencaMeses;
                  if (cadastral) {
                    diferencaMeses = diffInMonths(teste, cadastral);
                    console.log(diferencaMeses);
                  } else {
                    diferencaMeses = diffInMonths(teste, clienteDesde);
                    console.log(diferencaMeses);
                  }

                  // console.log(cadastral);
                  // console.log(teste);
                  // console.log(diferencaMeses);
                  if (diferencaMeses < -4) {
                    // console.log("deu certo");
                    codCli.push(codtemporario);
                    console.log(codtemporario);
                    indicesParaAtualizar.push(i);
                    flag = 1;
                  }
                } catch (error: any) {
                  console.log(error.responsecodtemporario.data);
                }
              }
            } catch (error: any) {
              console.log(error.responsecnpj);
            }
          }
          if (flag === 0) {
            indicesParaRemover.push(i);
          }

          if (error.response && error.response.status === 400) {
            console.error(
              "Erro 400 - Bad Request. Pulando para o próximo cliente.",
              cliente,
              error.response.data
            );
          } else {
            console.error("Erro durante a solicitação:", error.response.data);
          }
        }
      }
      for (let i = 0; i < indicesParaAtualizar.length; i++) {
        let count = 0;
        const valorAtualizar = indicesParaAtualizar[i];

        for (let j = 0; j < indicesParaRemover.length; j++) {
          if (indicesParaRemover[j] < valorAtualizar) {
            count++;
          }
        }

        indicesParaAtualizar[i] -= count;
      }
      console.log("começa aqui");
      for (let i = 0; i < dadosParaEnviar.length; i++) {
        let cliente = dadosParaEnviar[i];
        try {
          if (indicesParaAtualizar.includes(i)) {
            cliente = Object.assign({}, cliente, { codigoCliente: codCli[i] });
            const response = await axios.put(
              "https://amtf.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/pessoa",
              cliente,
              {
                headers: {
                  Accept: "*/*",
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${access_token}`,
                },
              }
            );
            loggerClientesAtualizados.info(
              "Dados enviados: %s => Resultado do cadastro %s",
              cliente,
              response.data
            );
            console.log("Dados atualizados:", cliente);
            console.log("Resposta do servidor:", response.data);
          }
        } catch (error: any) {
          loggerErros.error(
            "Erro ao atualizar cliente: %s com o cnpj %s => Resultado do cadastro %s",
            cliente ? cliente.nomePessoa : "Cliente não encontrado",
            cliente ? cliente.numeroCic : "cnpj nao escontrado",
            error.response.data
          );

          if (error.response && error.response.status === 400) {
            console.error(
              "Erro 400 - Bad Request. Pulando para o próximo cliente.",
              cliente,
              error.response.data
            );
          } else {
            console.error("Erro durante a solicitação:", error.response.data);
          }
        }
      }
      contatosEnvio = contatosEnvio.filter(
        (_, index) => !indicesParaRemover.includes(index)
      );

      ramoAtividade = ramoAtividade.filter(
        (_, index) => !indicesParaRemover.includes(index)
      );
      enderecoParaEnviar = enderecoParaEnviar.filter(
        (_, index) => !indicesParaRemover.includes(index)
      );
      sociosArray = sociosArray.filter(
        (_, index) => !indicesParaRemover.includes(index)
      );
      enderecoPessoal = enderecoPessoal.filter(
        (_, index) => !indicesParaRemover.includes(index)
      );

      for (let i = 0; i < contatosEnvio.length; i++) {
        const codigoCliente = codCli[i];
        for (let j = 0; j < contatosEnvio[i].length; j++) {
          try {
            const dadosContacts = contatosEnvio[i][j];
            dadosContacts.codigoCliente = codigoCliente;

            if (indicesParaAtualizar.includes(i)) {
              const responseContatos = await axios.put(
                "https://amtf.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/formaContato",
                dadosContacts,
                {
                  headers: {
                    Accept: "*/*",
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${access_token}`,
                  },
                }
              );
              console.log("Contato atualizado com sucesso:", dadosContacts);
              console.log("Resposta do servidor:", responseContatos.data);
            } else {
              const responseContatos = await axios.post(
                "https://amtf.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/formaContato",
                dadosContacts,
                {
                  headers: {
                    Accept: "*/*",
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${access_token}`,
                  },
                }
              );
              console.log("Contato enviado com sucesso:", dadosContacts);
              console.log("Resposta do servidor:", responseContatos.data);
            }
          } catch (error: any) {
            loggerErros.error(
              "Erro ao enviar Contato: => Resultado do cadastro %s",

              error.response.data
            );
            console.error("Erro ao enviar dados:", error.response.data);
          }
        }
      }

      for (let i = 0; i < ramoAtividade.length; i++) {
        const ramo = ramoAtividade[i];

        try {
          const codigoCliente = codCli[i];

          ramo.codigoCliente = codigoCliente;
          if (indicesParaAtualizar.includes(i)) {
            const responseRamo = await axios.put(
              "https://amtf.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/atividadeCliente",
              ramo,
              {
                headers: {
                  Accept: "*/*",
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${access_token}`,
                },
              }
            );

            console.log("Ramo enviado com sucesso:", ramo);
            console.log("Resposta do servidor:", responseRamo.data);
          } else {
            const responseRamo = await axios.post(
              "https://amtf.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/atividadeCliente",
              ramo,
              {
                headers: {
                  Accept: "*/*",
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${access_token}`,
                },
              }
            );

            console.log("Ramo enviado com sucesso:", ramo);
            console.log("Resposta do servidor:", responseRamo.data);
          }
        } catch (error: any) {
          loggerErros.error(
            "Erro ao enviar ramo: %s => Resultado do cadastro %s",
            ramo ? ramo : "Ramo não encontrado",
            error.response.data
          );
          console.error("Erro ao enviar Ramo:", error.response.data);
        }
      }

      for (let i = 0; i < enderecoParaEnviar.length; i++) {
        const enderecoCliente = enderecoParaEnviar[i];
        try {
          const codigoCliente = codCli[i];
          enderecoCliente.codigoCliente = codigoCliente;
          if (indicesParaAtualizar.includes(i)) {
            const responseEndereco = await axios.put(
              "https://amtf.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/endereco",
              enderecoCliente,
              {
                headers: {
                  Accept: "*/*",
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${access_token}`,
                },
              }
            );

            console.log("Endereço enviado com sucesso:", enderecoCliente);
            console.log("Resposta do servidor:", responseEndereco.data);
          } else {
            const responseEndereco = await axios.post(
              "https://amtf.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/endereco",
              enderecoCliente,
              {
                headers: {
                  Accept: "*/*",
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${access_token}`,
                },
              }
            );

            console.log("Endereço enviado com sucesso:", enderecoCliente);
            console.log("Resposta do servidor:", responseEndereco.data);
          }
        } catch (error: any) {
          loggerErros.error(
            "Erro ao enviar endereço: %s => Resultado do cadastro %s",
            enderecoCliente ? enderecoCliente : "Endereço não encontrado",
            error.response.data
          );
          console.error("Erro ao enviar endereço:", error.response.data);
        }
      }
      for (let i = 0; i < sociosArray.length; i++) {
        const codigoCliente = codCli[i];
        for (let j = 0; j < sociosArray[i].length; j++) {
          try {
            const dadosSocio = sociosArray[i][j];
            dadosSocio.codigoCliente = codigoCliente;
            console.log(dadosSocio);
            if (indicesParaAtualizar.includes(i)) {
              const responseSocios = await axios.put(
                "https://amtf.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/socio",
                dadosSocio,
                {
                  headers: {
                    Accept: "*/*",
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${access_token}`,
                  },
                }
              );
              console.log("Socios atualizado com sucesso:", dadosSocio);
              console.log("Resposta do servidor:", responseSocios.data);
            } else {
              const responseSocios = await axios.post(
                "https://amtf.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/socio",
                dadosSocio,
                {
                  headers: {
                    Accept: "*/*",
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${access_token}`,
                  },
                }
              );
              console.log("Socios enviado com sucesso:", dadosSocio);
              console.log("Resposta do servidor:", responseSocios.data);
            }
          } catch (error: any) {
            loggerErros.error(
              "Erro ao enviar socios: => Resultado do cadastro %s",

              error.response.data
            );
            console.error("Erro ao enviar dados:", error.response.data);
          }
        }
      }

      for (let i = 0; i < enderecoPessoal.length; i++) {
        const endereco = enderecoPessoal[i];

        try {
          const codigoCliente = codCli[i];
          endereco.codigoCliente = codigoCliente;
          console.log(codigoCliente);
          const responseEndereco = await axios.put(
            "https://amtf.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/endereco",
            endereco,
            {
              headers: {
                Accept: "*/*",
                "Content-Type": "application/json",
                Authorization: `Bearer ${access_token}`,
              },
            }
          );

          console.log("Endereço enviado com sucesso:", endereco);
          console.log("Resposta do servidor:", responseEndereco.data);
        } catch (error: any) {
          loggerErros.error(
            "Erro ao enviar endereço: %s => Resultado do cadastro %s",
            endereco ? endereco : "Endereço não encontrado",
            error.response.data
          );
          console.error("Erro ao enviar endereço:", error.response.data);
        }
      }

      res.json({ message: "Dados enviados com sucesso" });
    } catch (error) {
      console.error("Erro ao enviar dados:", error);
      res.status(500).send("Erro ao enviar dados");
    }
    const caminhoArquivoZIP = await enviarPastaLogs();
    const enviarEmailComAnexo = async (caminhoArquivoZIP: string) => {
      try {
        const mailOptions = {
          from: "ti@desenvolve.mt.gov.br",
          to: "josesilva@desenvolve.mt.gov.br",
          subject: "Arquivo ZIP com logs",
          text: "Segue anexo o arquivo ZIP com os logs.",
          attachments: [
            {
              filename: "logs.zip",
              path: caminhoArquivoZIP,
            },
          ],
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("E-mail enviado:", info.response);

        fs.unlinkSync(caminhoArquivoZIP);
        console.log("Arquivo ZIP removido após envio por e-mail.");
      } catch (error) {
        console.error("Erro ao enviar e-mail:", error);
        throw error;
      }
    };
    // await enviarEmailComAnexo(caminhoArquivoZIP);
  },
};

export default EnviarDadosController;

//   siglaTipoLogradouro: cliente.logradouro,
//   descricaoComplementoEndereco:
//     cliente.complementoEnderecoComercial.replace(/[./ -]/g, " "),
// .slice(0, -1) + "5"
