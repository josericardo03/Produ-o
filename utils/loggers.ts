import winston, { createLogger, format, transports } from "winston";

export default function CreateLoggers() {
  let data = new Date()
    .toLocaleDateString("pr-BR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "-");

  const { splat, combine, timestamp, printf } = winston.format;

  const myFormat = printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp};${level};${message};${
      meta ? JSON.stringify(meta) : ""
    }`;
  });

  const loggerErros = createLogger({
    level: "info",
    format: format.combine(
      format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
      }),
      format.errors({ stack: true }),
      format.splat(),
      format.json(),
      myFormat
    ),
    defaultMeta: { service: "IntegracaoBancos" },
    transports: [
      //
      // - Write to all logs with level `info` and below to `quick-start-combined.log`.
      // - Write all logs error (and below) to `quick-start-error.log`.
      //
      new transports.File({
        filename: `src/logs/${data}/cliente-erros.log`,
        level: "error",
      }),
    ],
  });

  const loggerClientes = createLogger({
    level: "info",
    format: format.combine(
      format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
      }),
      format.errors({ stack: true }),
      format.splat(),
      format.json()
    ),
    defaultMeta: { service: "IntegracaoBancos" },
    transports: [
      //
      // - Write to all logs with level `info` and below to `quick-start-combined.log`.
      // - Write all logs error (and below) to `quick-start-error.log`.
      //

      new transports.File({
        filename: `src/logs/${data}/clientes-cadastrados.log`,
        level: "info",
      }),
    ],
  });
  const loggerClientesAtualizados = createLogger({
    level: "info",
    format: format.combine(
      format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
      }),
      format.errors({ stack: true }),
      format.splat(),
      format.json()
    ),
    defaultMeta: { service: "IntegracaoBancos" },
    transports: [
      //
      // - Write to all logs with level `info` and below to `quick-start-combined.log`.
      // - Write all logs error (and below) to `quick-start-error.log`.
      //

      new transports.File({
        filename: `src/logs/${data}/clientes-atualizados.log`,
        level: "info",
      }),
    ],
  });

  const loggerBanco = createLogger({
    level: "info",
    format: format.combine(
      format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
      }),
      format.errors({ stack: true }),
      format.splat(),
      format.json(),
      myFormat
    ),
    defaultMeta: { service: "IntegracaoBancos" },
    transports: [
      //
      // - Write to all logs with level `info` and below to `quick-start-combined.log`.
      // - Write all logs error (and below) to `quick-start-error.log`.
      //
      new transports.File({
        filename: `src/logs/${data}/requisicoes-banco.log`,
        level: "info",
      }),
    ],
  });

  return {
    loggerErros,
    loggerClientes,
    loggerBanco,
    loggerClientesAtualizados,
  };
}
