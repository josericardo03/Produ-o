import { Request, Response } from "express";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import AuthController from "./AuthController";
import CreateLoggers from "../../utils/loggers";

const prisma = new PrismaClient();
const fs = require("fs");

const SociosController = {
  sociosDados: async (req: Request, res: Response) => {
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
    c.*, 
    sub.estadoNome, 
    sub.estadoUf, 
    sub.cidadeNome,
    sub.cnae_code,
    sub.cnae_descDivisao,
    sub.cidadeComercio,
    sub.estadoComercio,
    s.nacionalidade as socioNacionalidade,
    s.dataNascimento as socioDataNascimento
FROM 
    clients c
INNER JOIN 
    socios s ON c.name = s.name
INNER JOIN (
    SELECT 
        c.id, 
        es.nome AS estadoNome, 
        es.uf AS estadoUf, 
        cid.nome AS cidadeNome,
        cn.id AS cnae_code,
        cn.descDivisao AS cnae_descDivisao,
        ci.nome AS cidadeComercio,
        est.uf AS estadoComercio
    FROM 
        clients c
    INNER JOIN 
        estados AS es ON c.estado = es.id
    INNER JOIN 
        cidades AS cid ON c.cidade = cid.id
    LEFT JOIN 
        cnaes AS cn ON c.cnaeId = cn.id
    LEFT JOIN 
        cidades AS ci ON c.cidadeComercial = ci.id
    LEFT JOIN 
        estados AS est ON c.estadoComercial = est.id
) AS sub ON sub.id = c.id
INNER JOIN (
    SELECT 
        c.id
    FROM 
        clients c
    INNER JOIN 
        proposta AS p ON c.id = p.clientId 
    WHERE 
        p.status = 'deferido'  AND DATE(p.finalizadaEm) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    ORDER BY 
        p.createdAt DESC 
    
) AS ids ON s.clientId = ids.id 




      `;

      if (resultado.length === 0) {
        loggerBanco.info(
          "Nenhum registro pendente para socios. %s",
          new Date()
        );
        throw new Error(
          "Não foi encontrado nenhum registro da consulta da proposta"
        );
      }

      const hoje = new Date().toISOString().slice(0, 10);

      let dadosParaEnviar = [];
      let enderecoParaEnviar = [];
      let enderecoPessoal = [];
      let enderecoEmpresa = [];
      let ramoAtividade = [];
      const codCli = [];
      let maeEnvio = [];
      let paiEnvio = [];
      let conjugeEnvio = [];

      let contatosEnvio = [];

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
        function formatDate(n: any) {
          const [day, month, year] = n.split("/");

          const formattedDate = `${year}-${month}-${day}`;

          return formattedDate;
        }

        const resultadoContatos: any[] = await prisma.$queryRaw`
      SELECT
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
    s.name=${cliente.razaoSocial} 
    limit 1
      `;
        const contatosArray = [];

        for (let i = 0; i < resultadoContatos.length; i++) {
          const contact = resultadoContatos[i];
          console.log(contact);
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
              telefoneCompleto: contact.telefone
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
        console.log(contatosEnvio);

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
            codigoCliente: "",

            descricaoRazaoSocialAnterior: cliente.razaoSocial,
            campoCnaeBndes: cliente.cnae_code,
            codigoUnidadeResponsavel: 1,
            tipoPessoa: cliente.tipoCliente
              ? cliente.tipoCliente.charAt(0).toUpperCase()
              : "",
            nomePessoa: cliente.razaoSocial,
            numeroCic: cliente.cnpj.replace(/[./ -]/g, ""),
            dataClienteDesde: hoje,
            dataRenovacaoCadastral: hoje,
            descricaoLocalizacao: cliente.logradouro,
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
              codigoPortaBnds: cliente.porte
                ? v
                : mapearCodigoPorte(cliente.porte),
              dataUltimoBalancete: "2021-12-31",
              valorCapitalSocial: cliente.capitalSocial,

              identificadorTipoBalanco: "REAL",
              identificadorControleAcionista: "PN",
              codigoNaturezaBndes: cliente.naturezaJuridicaId,
              descricaoCaracteristicaNegocioEmpresa: `${cliente.cnae_code} ${cliente.cnae_descDivisao}`,
              numeroSetor: 1,
            },
          };
        } else {
          dadosCliente = {
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
            dataInicioRelacionamentoInstituicao: formatarData(
              cliente.createdAt
            ),
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
              indicadorSexo: mapearSexo(cliente.sexo),
              dataEmissaoIdentidade: formatDate(cliente.dataEmissaoDocumento),
              ufNaturalidade: cliente.cidadeNome
                ? cliente.cidadeNome
                    .replace(/[áàâãäå]/g, "a")
                    .replace(/[ÁÀÂÃÄÅ]/g, "A")
                    .replace(/[éèêë]/g, "e")
                    .replace(/[ÉÈÊË]/g, "E")
                    .replace(/[íìîï]/g, "i")
                    .replace(/[ÍÌÎÏ]/g, "I")
                    .replace(/[óòôõö]/g, "o")
                    .replace(/[ÓÒÔÕÖ]/g, "O")
                    .replace(/[úùûü]/g, "u")
                    .replace(/[ÚÙÛÜ]/g, "U")
                : "",
              nacionalidade: cliente.socioNacionalidade || "BRASIL",
              descricaoLocalidadeNascimento: cliente.estadoNome,
              dataNascimento: formatarData(cliente.socioDataNascimento),

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
              descricaoLocalizacao: cliente.cidadeNome
                ? cliente.cidadeNome
                    .replace(/[áàâãäå]/g, "a")
                    .replace(/[ÁÀÂÃÄÅ]/g, "A")
                    .replace(/[éèêë]/g, "e")
                    .replace(/[ÉÈÊË]/g, "E")
                    .replace(/[íìîï]/g, "i")
                    .replace(/[ÍÌÎÏ]/g, "I")
                    .replace(/[óòôõö]/g, "o")
                    .replace(/[ÓÒÔÕÖ]/g, "O")
                    .replace(/[úùûü]/g, "u")
                    .replace(/[ÚÙÛÜ]/g, "U")
                : "",
              numeroSegmento: 1,
              indicadorNivelRelacionamento: true,
              indicadorParteRelacionada: false,
            },
          };
        }
        const enderecoComercial = {
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
        enderecoEmpresa.push(enderecoComercial);
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
          codigoCep: cliente.cep ? cliente.cep.replace(/[./ -]/g, "") : "",
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
          cpfParente: cliente.conjugeCpf
            ? cliente.conjugeCpf.replace(/[./ -]/g, "")
            : "",

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
          codigoCep: cliente.cep ? cliente.cep.replace(/[./ -]/g, "") : "",
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

        if ((cliente.tipoCliente = "juridica")) {
          const ramo = {
            codigoCliente: "",
            codigoRamoAtividade: 3002,
            atividadePrincipal: true,
            siglaAtividade: cliente.cnae_code,
          };
          ramoAtividade.push(ramo);
        } else {
          const ramo = {
            codigoCliente: "",
            codigoRamoAtividade: 3002,
            atividadePrincipal: true,
            // siglaAtividade: cliente.cnae_code,
          };
          ramoAtividade.push(ramo);
        }

        dadosParaEnviar.push(dadosCliente);
      }

      let indicesParaRemover = [];
      let indicesParaAtualizar = [];
      let flag;
      let cnpjEnvio = [];
      for (let i = 0; i < dadosParaEnviar.length; i++) {
        const cliente = dadosParaEnviar[i];

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
          flag = 1;
          codCli.push(codigoCliente);
          console.log("Dados enviados:", cliente);
          cnpjEnvio.push(cliente.numeroCic);
          console.log("Resposta do servidor:", response.data);
          loggerClientes.info(
            "Dados enviados: %s => Resultado do cadastro %s",
            cliente,
            response.data
          );
        } catch (error: any) {
          flag = 0;
          if (error) {
            try {
              const responsecnpj = await axios.get(
                `https://amtf-pp.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/buscarpessoaviacnpj/${cliente?.numeroCic}`,

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
                    `https://amtf-pp.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/buscapessoa/${codtemporario}`,

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
                  // teste.setMonth(teste.getMonth() + 5);
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
                  } else {
                    loggerErros.error(
                      "Erro ao cadastrar cliente: %s => Resultado do cadastro %s",
                      cliente ? cliente.nomePessoa : "Cliente não encontrado",
                      error.response.data
                    );
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
      fs.writeFileSync(
        "dadosenviados.txt",
        cnpjEnvio.join("\n"),
        (err: any) => {
          if (err) {
            console.error("Erro ao salvar o arquivo:", err);
          } else {
            console.log("Arquivo salvo com sucesso.");
          }
        }
      );
      let c = indicesParaAtualizar;
      indicesParaAtualizar = indicesParaAtualizar.map((indice) => {
        let count = 0;
        for (let j = 0; j < indicesParaRemover.length; j++) {
          if (indicesParaRemover[j] < indice) {
            count++;
          }
        }
        return indice - count;
      });
      console.log(indicesParaAtualizar);
      dadosParaEnviar = dadosParaEnviar.filter(
        (_, index) => !indicesParaRemover.includes(index)
      );
      contatosEnvio = contatosEnvio.filter(
        (_, index) => !indicesParaRemover.includes(index)
      );

      ramoAtividade = ramoAtividade.filter(
        (_, index) => !indicesParaRemover.includes(index)
      );
      enderecoParaEnviar = enderecoParaEnviar.filter(
        (_, index) => !indicesParaRemover.includes(index)
      );
      enderecoEmpresa = enderecoEmpresa.filter(
        (_, index) => !indicesParaRemover.includes(index)
      );

      enderecoPessoal = enderecoPessoal.filter(
        (_, index) => !indicesParaRemover.includes(index)
      );
      maeEnvio = maeEnvio.filter(
        (_, index) => !indicesParaRemover.includes(index)
      );
      paiEnvio = paiEnvio.filter(
        (_, index) => !indicesParaRemover.includes(index)
      );
      conjugeEnvio = conjugeEnvio.filter(
        (_, index) => !indicesParaRemover.includes(index)
      );
      console.log("começa aqui");

      let cnpjAtualizados = [];
      for (let i = 0; i < dadosParaEnviar.length; i++) {
        let cliente = dadosParaEnviar[i];
        cnpjAtualizados.push(cliente.numeroCic);
        try {
          if (indicesParaAtualizar.includes(i)) {
            cliente = Object.assign({}, cliente, { codigoCliente: codCli[i] });
            const response = await axios.put(
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
            "Erro ao atualizar cliente: %s com o cnpj %s SS=> Resultado do cadastro %s",
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
      for (let i = 0; i < contatosEnvio.length; i++) {
        const codigoCliente = codCli[i];
        for (let j = 0; j < contatosEnvio[i].length; j++) {
          try {
            const dadosContacts = contatosEnvio[i][j];
            dadosContacts.codigoCliente = codigoCliente;
            if (indicesParaAtualizar.includes(i)) {
              const responseContatos = await axios.put(
                "https://amtf-pp.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/formaContato",
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
                "https://amtf-pp.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/formaContato",
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

            console.log("Ramo atualizado com sucesso:", ramo);
            console.log("Resposta do servidor:", responseRamo.data);
          } else {
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
      for (let i = 0; i < maeEnvio.length; i++) {
        const maes = maeEnvio[i];
        try {
          const codigoCliente = codCli[i];
          maes.codigoCliente = codigoCliente;
          if (indicesParaAtualizar.includes(i)) {
            const responseMae = await axios.put(
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
            console.log("Mae atualizada com sucesso:", maes);
            console.log("Resposta do servidor:", responseMae.data);
          } else {
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
          }
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
          if (indicesParaAtualizar.includes(i)) {
            const responsePai = await axios.put(
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
            console.log("Pai atualizado com sucesso:", pais);
            console.log("Resposta do servidor:", responsePai.data);
          } else {
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
          }
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
          if (indicesParaAtualizar.includes(i)) {
            const responseConjuge = await axios.put(
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
            console.log("Conjuge atualizado com sucesso:", conjug);
            console.log("Resposta do servidor:", responseConjuge.data);
          } else {
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
          }
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
      for (let i = 0; i < enderecoEmpresa.length; i++) {
        const enderecoEmpre = enderecoEmpresa[i];
        try {
          const codigoCliente = codCli[i];
          enderecoEmpre.codigoCliente = codigoCliente;
          const responseEnderecoEmpresa = await axios.put(
            "https://amtf-pp.app.dimensa.com.br/tfsbasicoservice/rest/cadastro/endereco",
            enderecoEmpre,
            {
              headers: {
                Accept: "*/*",
                "Content-Type": "application/json",
                Authorization: `Bearer ${access_token}`,
              },
            }
          );

          console.log("Endereço enviado com sucesso:", enderecoEmpre);
          console.log("Resposta do servidor:", responseEnderecoEmpresa.data);
        } catch (error: any) {
          loggerErros.error(
            "Erro ao enviar Endereço da empresa: %s => Resultado do cadastro %s",
            enderecoEmpre ? enderecoEmpre : "Endereço não encontrado",
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

          if (indicesParaAtualizar.includes(i)) {
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

            console.log("Endereço atualizado com sucesso:", endereco);
            console.log("Resposta do servidor:", responseEndereco.data);
          } else {
            const responseEndereco = await axios.post(
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
          }
        } catch (error: any) {
          loggerErros.error(
            "Erro ao enviar endereço pessoal: %s => Resultado do cadastro %s",
            endereco ? endereco : "Endereço não encontrado",
            error.response.data
          );
          console.error("Erro ao enviar endereço:", error.response.data);
        }
      }
      loggerClientes.info("Clientes enviados %s", cnpjEnvio);

      res.json({ message: "Dados enviados com sucesso" });
    } catch (error) {
      console.error("Erro ao enviar dados:", error);
      res.status(500).send("Erro ao enviar dados");
    }
  },
};

export default SociosController;
//   siglaTipoLogradouro: cliente.logradouro,
//   descricaoComplementoEndereco:
//     cliente.complementoEnderecoComercial.replace(/[./ -]/g, " "),
