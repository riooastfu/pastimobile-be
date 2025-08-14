import { Sequelize } from "sequelize";
import * as tedious from "tedious";

export const db = new Sequelize('portal_prd', 'root', '', {
    host: "localhost",
    dialect: "mysql",
    dialectOptions: {
        useUTC: false,
        dateStrings: true,
        typeCast: function (field, next) { // for reading from database
            if (field.type === 'DATETIME') {
                return field.string()
            }
            return next()
        },
    },
    timezone: '+07:00',
    logging: false
})

export const db_finpro = new Sequelize('fin_pro', 'root', '', {
    host: "localhost",
    dialect: "mysql",
    timezone: '+07:00',
    logging: false,
})

export const db_cusg = new Sequelize('CUSG', 'portaldb', 'pas7892020', {
    host: "10.131.1.9",
    dialect: "mssql",
    dialectModule: tedious,
    dialectOptions: {
        options: {
            encrypt: false
        }
    }
})
