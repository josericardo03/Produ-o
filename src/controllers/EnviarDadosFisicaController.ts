import { Request, Response } from "express";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import AuthController from "./AuthController";
import CreateLoggers from "../../utils/loggers";
const prisma = new PrismaClient();

const EnviarDadosFisicaController = {
  enviarDadosFisica: async (req: Request, res: Response) => {
    const loggers = CreateLoggers();

    const { loggerErros, loggerClientes, loggerBanco } = loggers;

    try {
      await AuthController.obterToken(res);
      const access_token = AuthController.getAccessToken();

      const resultado: any[] = await prisma.$queryRaw`
        
      
SELECT 
      p.*, 
      c.*, 
      es.uf as estadoUf,
      cidp.nome as cidadeNome,
      cn.code AS cnae_code, 
      cn.descDivisao AS cnae_descDivisao,         
	  es.nome as estadoNome,
      s.nacionalidade as socioNacionalidade,
      s.dataNascimento as socioDataNascimento
  FROM 
      proposta AS p
  INNER JOIN 
      clients AS c ON c.id = p.clientId
  LEFT JOIN 
      cnaes AS cn ON cn.id = c.cnaeId

  LEFT JOIN 
      socios AS s ON s.clientId = c.id
  Left join 
          estados as es ON c.estado = es.id
  Left join
          cidades as cidp On c.cidade = cidp.id
  WHERE 
      p.status = 'deferido' and c.tipoCliente='fisica'AND DATE(p.finalizadaEm) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
  ORDER BY 
      p.createdAt DESC

  
        `;

      if (resultado.length === 0) {
        loggerBanco.info(
          "Nenhum registro de proposta pendente para cliente pessoa física. %s",
          new Date()
        );
        throw new Error(
          "Não foi encontrado nenhum registro da consulta da proposta"
        );
      }

      const hoje = new Date().toISOString().slice(0, 10);
      console.log(hoje);
      const dadosParaEnviar = [];
      const enderecoParaEnviar = [];
      const enderecoPessoal = [];
      const ramoAtividade = [];
      const codCli = [];
      const maeEnvio = [];
      const paiEnvio = [];
      const conjugeEnvio = [];

      for (const cliente of resultado) {
        const formatarData = (data: Date | null) => {
          return data ? data.toISOString().slice(0, 10) : null;
        };

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
        function mapearSexo(n: any) {
          switch (n) {
            case "M":
              return "MASCULINO";
            case "F":
              return "FEMININO";
            default:
              return null;
          }
        }
        function formatDate(n: any) {
          const [day, month, year] = n.split("/");

          const formattedDate = `${year}-${month}-${day}`;

          return formattedDate;
        }

        function mapearCodigoPorte(n: any) {
          switch (n) {
            case "mei":
              return 0;
            case "microempresa":
              return 1;
            case "pequena_empresa":
              return 2;
            case "media_empresa":
              return 3;
            case "grande_empresa":
              return 4;
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

        dadosCliente = {
          codigoCliente: "",

          siglaOrgaoEmissorOutroDocumento: cliente.orgaoExpeditor,
          telefoneCompleto: cliente.telefone
            ? cliente.telefone.replace(/[/ - - ()]/g, "")
            : "",
          codigoUnidadeResponsavel: 1,
          tipoPessoa: cliente.tipoCliente
            ? cliente.tipoCliente.charAt(0).toUpperCase()
            : "",
          nomePessoa: cliente.razaoSocial,
          numeroCic: cliente.cnpj.replace(/[./ -]/g, ""),
          dataClienteDesde: hoje,
          dataRenovacaoCadastral: hoje,
          descricaoLocalizacao: cliente.estadoNome,
          segmento: 1,
          indicadorNivelRelacionamento: true,
          indicadorIsencaoIof: false,
          indicadorIsencaoIrf: false,
          tipoLigacao: {
            description: "Não Ligado",
          },
          dataInicioRelacionamentoInstituicao: formatarData(cliente.createdAt),
          unidadePessoa: [
            {
              codigoUnidade: 1,

              codigoGerente: 1,
              dataConstituicao: cliente.cnpj.dataAbertura,
              identificadorSituacao: "ATIVO",
              complementoUnidadePessoa: {
                ocupacaoPrincipal: cliente.naturezaOcupacao,
                dataRenovacaoCadastro: cliente.hoje,
                tipoCadastro: "PF",
                codigoUsuarioRenovacao: "TB",
              },
            },
          ],
          pessoaFisica: {
            dataEmissaoIdentidade: formatDate(cliente.dataEmissaoDocumento),
            indicadorSexo: mapearSexo(cliente.sexo),
            ufNaturalidade: cliente.estadoUf,
            nacionalidade: cliente.socioNacionalidade || "BRASIL",
            descricaoLocalidadeNascimento: cliente.estadoNome,
            dataNascimento: cliente.dataNascimento
              ? formatDate(cliente.socioDataNascimento)
              : formatarData(cliente.dataNascimento),

            siglaOrgaoEmissorOutroDocumento: "SSP SP",
            numeroOutroDocumento: cliente.numeroIdentificacao,
            pessoaPoliticamenteExposta: false,
            indicadorOutroDocumento: "CARTEIRA_IDENTIDADE",
            indicadorNivelEscolaridade: cliente.escolaridade,
            nomeSocial: cliente.razaoSocial,
            codigoEstadoCivil: mapearEstadoCivil(cliente.estadoCivil),
            identificadorGrupoEconomico: false,
            tipoLigacao: {
              description: "Não Ligado",
            },
            indicadorTipoTitularidade: true,

            indicadorCapacidadeCivil: "CAPAZ",
            siglaUfEmissao: cliente.ufExpeditor,
            dataClienteDesde: hoje,
            dataRenovacaoCadastral: hoje,
            descricaoLocalizacao: cliente.naturalidade,
            numeroSegmento: 1,
            indicadorNivelRelacionamento: true,
            indicadorParteRelacionada: false,
          },
        };

        const socioFisico = {};
        const enderecoCliente = {
          siglaTipoEndereco: cliente.siglaTipoEndereco
            ? cliente.siglaTipoEndereco
            : "RESIDENCIAL",
          codigoCliente: "",
          codigoUnidade: 1,
          telefoneCompleto: cliente.telefone
            ? cliente.telefone.replace(/[/ - - ()]/g, "")
            : "",
          nomeCidade: cliente.cidadeNome,
          codigoCep: cliente.cep.replace(/[./ -]/g, ""),
          numeroEndereco: cliente.numeroEndereco,
          nomeLogradouro: cliente.logradouro,
          nomeBairro: cliente.bairro,
          // descricaoComplementoEndereco: cliente.complementoEndereco.replace(
          //   /[./ -]/g,
          //   ""
          // ),
          siglaUf: cliente.estadoUf,
        };
        enderecoParaEnviar.push(enderecoCliente);
        console.log(enderecoParaEnviar);
        const mae = {
          codigoCliente: "",

          siglaRelacionamento: "MAE",
          nomeParente: cliente.nomeMae,
          parentePoliticamenteExposto: false,
        };
        maeEnvio.push(mae);
        const pai = {
          codigoCliente: "",
          siglaRelacionamento: "PAI",
          nomeParente: cliente.nomePai,
          parentePoliticamenteExposto: false,
        };
        paiEnvio.push(pai);
        const conjuge = {
          codigoCliente: "",
          //   cpfParente: cliente.conjugeCpf.replace(/[./ -]/g, ""),
          dataNascimentoParente: formatarData(cliente.conjugeDataNascimento),
          siglaRelacionamento: "CONJUGE",
          nomeParente: cliente.conjugeNome,
          parentePoliticamenteExposto: false,
        };
        conjugeEnvio.push(conjuge);
        const endereco = {
          siglaTipoEndereco: cliente.siglaTipoEndereco
            ? cliente.siglaTipoEndereco
            : "CORRESPONDENCIA",
          codigoCliente: "",
          telefoneCompleto: cliente.telefone
            ? cliente.telefone.replace(/[/ - - ()]/g, "")
            : "",
          codigoUnidade: 1,
          nomeCidade: cliente.cidadeNome,
          codigoCep: cliente.cep.replace(/[./ -]/g, ""),
          numeroEndereco: cliente.numeroEndereco,
          nomeLogradouro: cliente.logradouro,
          nomeBairro: cliente.bairro,
          // descricaoComplementoEndereco: cliente.complementoEndereco.replace(
          //   /[./ -]/g,
          //   " "
          // ),
          siglaUf: cliente.estadoUf,
        };
        enderecoPessoal.push(endereco);
        console.log(enderecoPessoal);

        const ramo = {
          codigoCliente: "",
          codigoRamoAtividade: 3002,
          atividadePrincipal: true,
          // siglaAtividade: cliente.cnae_code.replace(/[./ -]/g, ""),
        };
        ramoAtividade.push(ramo);

        dadosParaEnviar.push(dadosCliente);
      }

      let problems: any[] = [];
      for (const cliente of dadosParaEnviar) {
        try {
          let codigoCliente = "";

          const response = await axios.post(
            "https://amtf-pp.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/pessoa",
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
          codCli.push(codigoCliente);
          console.log("Dados enviados:", cliente);
          console.log("Resposta do servidor:", response.data);
          loggerClientes.info(
            "Dados enviados: %s => Resultado do cadastro %s",
            cliente,
            response.data
          );
        } catch (error: any) {
          const existingIndex = problems.findIndex(
            (problem) => problem.numeroCic === cliente?.numeroCic
          );
          if (existingIndex === -1) {
            const problem = {
              nomePessoa: cliente?.nomePessoa,
              numeroCic: cliente?.numeroCic,
              dataClienteDesde: cliente?.dataClienteDesde,
              erro: "",
            };
            problem.erro = error.response.data;
            problems.push(problem);
          }
          loggerErros.error(
            "Erro ao cadastrar cliente: %s => Resultado do cadastro %s",
            cliente ? cliente.nomePessoa : "Cliente não encontrado",
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

      for (let i = 0; i < ramoAtividade.length; i++) {
        const ramo = ramoAtividade[i];

        try {
          const codigoCliente = codCli[i];

          ramo.codigoCliente = codigoCliente;

          const responseRamo = await axios.post(
            "https://amtf-pp.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/atividadeCliente",
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
        } catch (error: any) {
          loggerErros.error(
            "Erro ao enviar ramo: %s => Resultado do cadastro %s",
            ramo ? ramo : "Ramo não encontrado",
            error.response.data
          );
          console.error("Erro ao enviar Ramo:", error.response.data);
        }
      }
      for (let i = 0; i < maeEnvio.length; i++) {
        const maes = maeEnvio[i];
        try {
          const codigoCliente = codCli[i];
          maes.codigoCliente = codigoCliente;

          const responseMae = await axios.post(
            "https://amtf-pp.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/parentesco",
            maes,
            {
              headers: {
                Accept: "*/*",
                "Content-Type": "application/json",
                Authorization: `Bearer ${access_token}`,
              },
            }
          );
          console.log("Mae enviada com sucesso:", maes);
          console.log("Resposta do servidor:", responseMae.data);
        } catch (error: any) {
          loggerErros.error(
            "Erro ao enviar mãe: %s => Resultado do cadastro %s",
            maes ? maes : "Mãe não encontrada",
            error.response.data
          );
          console.error("Erro ao enviar Mae:", error.response.data);
        }
      }
      for (let i = 0; i < paiEnvio.length; i++) {
        const pais = paiEnvio[i];
        try {
          const codigoCliente = codCli[i];
          pais.codigoCliente = codigoCliente;

          const responsePai = await axios.post(
            "https://amtf-pp.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/parentesco",
            pais,
            {
              headers: {
                Accept: "*/*",
                "Content-Type": "application/json",
                Authorization: `Bearer ${access_token}`,
              },
            }
          );
          console.log("Pai enviado com sucesso:", pais);
          console.log("Resposta do servidor:", responsePai.data);
        } catch (error: any) {
          loggerErros.error(
            "Erro ao enviar Pai: %s => Resultado do cadastro %s",
            pais ? pais : "Pai não encontrado",
            error.response.data
          );
          console.error("Erro ao enviar Pai:", error.response.data);
        }
      }
      for (let i = 0; i < conjugeEnvio.length; i++) {
        const conjug = conjugeEnvio[i];
        try {
          const codigoCliente = codCli[i];
          conjug.codigoCliente = codigoCliente;

          const responseConjuge = await axios.post(
            "https://amtf-pp.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/parentesco",
            conjug,
            {
              headers: {
                Accept: "*/*",
                "Content-Type": "application/json",
                Authorization: `Bearer ${access_token}`,
              },
            }
          );
          console.log("Conjuge enviado com sucesso:", conjug);
          console.log("Resposta do servidor:", responseConjuge.data);
        } catch (error: any) {
          loggerErros.error(
            "Erro ao enviar Pai: %s => Resultado do cadastro %s",
            conjug ? conjug : "Pai não encontrado",
            error.response.data
          );
          console.error("Erro ao enviar Conjuge:", error.response.data);
        }
      }

      for (let i = 0; i < enderecoParaEnviar.length; i++) {
        const enderecoCliente = enderecoParaEnviar[i];
        try {
          const codigoCliente = codCli[i];
          enderecoCliente.codigoCliente = codigoCliente;
          const responseEndereco = await axios.put(
            "https://amtf-pp.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/endereco",
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
        } catch (error: any) {
          loggerErros.error(
            "Erro ao enviar endereço: %s => Resultado do cadastro %s",
            enderecoCliente ? enderecoCliente : "Endereço não encontrado",
            error.response.data
          );
          console.error("Erro ao enviar endereço:", error.response.data);
        }
      }
      for (let i = 0; i < enderecoPessoal.length; i++) {
        const endereco = enderecoPessoal[i];

        try {
          const codigoCliente = codCli[i];
          endereco.codigoCliente = codigoCliente;
          console.log(codigoCliente);
          const responseEndereco = await axios.put(
            "https://amtf-pp.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/endereco",
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
  },
};

export default EnviarDadosFisicaController;
//   siglaTipoLogradouro: cliente.logradouro,
//   descricaoComplementoEndereco:
//     cliente.complementoEnderecoComercial.replace(/[./ -]/g, " "),
