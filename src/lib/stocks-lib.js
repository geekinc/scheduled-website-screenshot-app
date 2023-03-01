import moment from 'moment';
import jsonLogic from 'json-logic-js';
const util = require('util');

const mysql = require('serverless-mysql')({
    library: require('mysql2'),
    config: {
        host: 'cyfr-enigma-data-lake.cy1nfcrlyv4y.ca-central-1.rds.amazonaws.com',
        user: 'admin',
        password: 'Sunshine123!',
        database: 'cyfr',
        waitForConnections: true,
        connectionLimit: 25,
        queueLimit: 0
    }
});


const WEEKEND = [moment().day("Saturday").weekday(), moment().day("Sunday").weekday()];
const subtractBusinessDays = (date, daysToSubtract) => {
    let daysSubtracted = 0;
    let momentDate = moment(new Date(date));
    while (daysSubtracted < daysToSubtract) {
        momentDate = momentDate.subtract(1, 'days');
        if (!WEEKEND.includes(momentDate.weekday())) {
            daysSubtracted++;
        }
    }

    return momentDate;
};

async function fetch_stocks_list() {
    let response = {};

    try {
        let entry = await mysql.query(
            `   select 		
                        s.logo as src,
                        s.ticker,
                        s.company_name as name,
                        s.ticker as text,
                        s.exchange,
                        false as status,
                        false as active,
                        false as mark,
                        null as subtitle,
                        null as badge
                from 
                        stocks s
                where
                        error = 0
                order by company_name
                `, [{}]);

        if (entry.length > 0) {
            response.status = 200;
            response.data = entry;
        } else {
            response = {
                status: 500,
                error: "No records available"
            };
        }
    } catch (e) {
        console.log(e);
        response = {
            status: 500,
            error: e
        };
    } finally {
        await mysql.end();
    }

    return response;
}

async function fetch_stocks_indicators(ticker) {
    let response = {};

    try {

            // Format of the object in the returned array
            /*
            {
              "date": "2022-11-3",
              "open": 0.6499999761581421,
              "high": 0.7200000286102295,
              "low": 0.6399999856948853,
              "close": 0.699999988079071,
              "volume": 1466516,
              "adjclose": 0.699999988079071,
              "timestamp": 1667499266000,
              "digitalnoise": 679,
              "zscore": 4.379227957537883,
              "peak": "#FF0000"
            }
            */

        let entry = await mysql.query(
            `select 
                        concat(h.\`year\`, '-', h.\`month\`, '-', h.\`day\`) as date,
                        h.\`open\`,
                        h.\`high\`,
                        h.\`low\`,
                        h.\`close\`,
                        h.\`volume\`,
                        h.\`adj_close\`,
                        h.\`date\` * 1000 as \`timestamp\`,
                        dn.\`value\` as \`digitalnoise\`,
                        dn.\`signal\` as \`signal\` 
                from historical as h 
                left join digital_noise dn 
                        on h.\`day\` = dn.\`day\` 
                        and h.\`month\` = dn.\`month\` 
                        and h.\`year\` = dn.\`year\` 
                        and h.\`stock_id\` = dn.\`stock_id\`
                        where
                        h.\`ticker\` = ?
                order by h.\`date\` desc
                `,
            [
                ticker
            ]);

        if (entry.length > 0) {
            let output = [];

            // typecast the string numeric values to numbers
            for (let x = 0; x < entry.length; x++) {
                let item = {
                    adj_close: entry[x].adj_close,
                    close: (entry[x].close === null) ? null : Number(entry[x].close),
                    date: entry[x].date,
                    digitalnoise: (entry[x].digitalnoise === null) ? null : Number(entry[x].digitalnoise),
                    high: (entry[x].high === null) ? null : Number(entry[x].high),
                    low: (entry[x].low === null) ? null : Number(entry[x].low),
                    open: (entry[x].open === null) ? null : Number(entry[x].open),
                    timestamp: entry[x].timestamp,
                    volume: entry[x].volume,
                    signal: entry[x].signal
                };
                output.push(item);
            }

            response.status = 200;
            response.data = output;
        } else {
            response = {
                status: 500,
                error: entry
            };
        }
    } catch (e) {
        console.log(e);
        response = {
            status: 500,
            error: e
        };
    } finally {
        await mysql.end();
    }

    return response;
}

async function sql_ticker(ticker, date) {
    let response = {};

    let [param_year, param_month, param_day] = date.split('-');

    let entry = await mysql.query(`
                select
                    \`open\`, \`close\`, \`high\`, \`low\`
                from
                    historical
                where 
                    \`year\` = ?
                AND 
                    \`month\` = ?
                AND
                    \`day\` = ?
                AND 
                    \`ticker\` = ?
            `,
        [
            param_year,
            param_month,
            param_day,
            ticker
        ]);

    if (entry.length > 0) {
        let output = [];

        // typecast the string numeric values to numbers
        for (let x = 0; x < entry.length; x++) {
            let item = {
                close: (entry[x].close === null) ? null : Number(entry[x].close),
                high: (entry[x].high === null) ? null : Number(entry[x].high),
                low: (entry[x].low === null) ? null : Number(entry[x].low),
                open: (entry[x].open === null) ? null : Number(entry[x].open),
            };
            output.push(item);
        }

        response.status = 200;
        response.data = output;
    } else {
        response = {
            status: 500,
            error: entry,
            data: [{
                close: 0,
                high: 0,
                low: 0,
                open: 0
            }]
        };
    }

    return response;
}

async function sql_volume(ticker, date) {
    let response = {};

    let [param_year, param_month, param_day] = date.split('-');

    let entry = await mysql.query(`
            select
                h.\`volume\` as count,
                (select FLOOR(AVG(items.\`volume\`)) from ( select \`volume\` from historical where FROM_UNIXTIME(\`date\`) <= DATE_SUB(FROM_UNIXTIME(h.\`date\`), INTERVAL 1 DAY) AND \`ticker\` = h.\`ticker\` ORDER BY \`date\` DESC Limit 5) as items) as \`ma5\`,
                (select FLOOR(AVG(items.\`volume\`)) from ( select \`volume\` from historical where FROM_UNIXTIME(\`date\`) <= DATE_SUB(FROM_UNIXTIME(h.\`date\`), INTERVAL 1 DAY) AND \`ticker\` = h.\`ticker\` ORDER BY \`date\` DESC Limit 10) as items) as \`ma10\`,
                (select FLOOR(AVG(items.\`volume\`)) from ( select \`volume\` from historical where FROM_UNIXTIME(\`date\`) <= DATE_SUB(FROM_UNIXTIME(h.\`date\`), INTERVAL 1 DAY) AND \`ticker\` = h.\`ticker\` ORDER BY \`date\` DESC Limit 30) as items) as \`ma20\`
            from
                historical h
            where
                \`year\` = ?
            AND
                \`month\` = ?
            AND
                \`day\` = ?
            AND
                \`ticker\` = ?
            `,
        [
            param_year,
            param_month,
            param_day,
            ticker
        ]);

    if (entry.length > 0) {
        let output = [];

        // typecast the string numeric values to numbers
        for (let x = 0; x < entry.length; x++) {
            let item = {
                count: (entry[x].count === null) ? null : entry[x].count,
                ma5: (entry[x].ma5 === null) ? null : Number(entry[x].ma5),
                ma10: (entry[x].ma10 === null) ? null : Number(entry[x].ma10),
                ma20: (entry[x].ma20 === null) ? null : Number(entry[x].ma20),
            };
            output.push(item);
        }
        response.status = 200;
        response.data = output;
    } else {
        response = {
            status: 500,
            error: entry,
            data: [{
                count: 0,
                ma5: 0,
                ma10: 0,
                ma20: 0
            }]
        };
    }

    return response;
}

async function sql_digital_noise(ticker, date) {
    let response = {};

    let [param_year, param_month, param_day] = date.split('-');

    let entry = await mysql.query(`
            select
                dn.\`value\` as count,
                dn.\`signal\` as peak
            from
                digital_noise dn
            where
                \`year\` = ?
            AND
                \`month\` = ?
            AND
                \`day\` = ?
            AND
                \`ticker\` = ?
            `,
        [
            param_year,
            param_month,
            param_day,
            ticker
        ]);

    if (entry.length > 0) {
        let output = [];

        // typecast the string numeric values to numbers
        for (let x = 0; x < entry.length; x++) {
            let item = {
                count: (entry[x].count === null) ? null : Number(entry[x].count),
                peak: (entry[x].peak === null) ? null : Number(entry[x].peak)
            };
            output.push(item);
        }
        response.status = 200;
        response.data = output;
    } else {
        response = {
            status: 500,
            error: entry,
            data: [{
                count: 0,
                peak: 0
            }]
        };
    }

    return response;
}

async function fetch_working_data(ticker, date, sources) {
    console.time('fetch_working_data');

    let response = {
        "ticker": ticker,
        "date": date,
        "now": {}
    };

    try {
        let sources_array = sources.split(',');

        // we always fetch ticker data
        let data_ticker = await sql_ticker(ticker, date);
        data_ticker = data_ticker?.data[0];
        let entry = {
            open: data_ticker.open,
            close: data_ticker.close,
            low: data_ticker.low,
            high: data_ticker.high
        };
        response.now.ticker = entry;

        // other optional data sources
        for (let x=1; x<sources_array.length + 1; x++) {
            switch (x) {

                case 1: // volume
                    let data_volume = await sql_volume(ticker, date);
                    data_volume = data_volume?.data[0];
                    entry = {
                        count: data_volume.count,
                        ma5: data_volume.ma5,
                        ma10: data_volume.ma10,
                        ma20: data_volume.ma20
                    };
                    response.now.volume = entry;
                    break;

                case 2: // digital_noise
                    let data_digital_noise = await sql_digital_noise(ticker, date);
                    data_digital_noise = data_digital_noise?.data[0];
                    entry = {
                        count: data_digital_noise.count,
                        peak: data_digital_noise.peak
                    };
                    response.now.digital_noise = entry;
                    break;

                case 3: // trailing days
                case 4:
                case 5:
                case 6:
                case 7:
                case 8:
                case 9:
                    let trailing_day = x - 2;
                    response['td-' + trailing_day] = {};

                    // Ticker Data
                    let data_td = await sql_ticker(ticker, await subtractBusinessDays(date, trailing_day).format('YYYY-MM-DD'));
                    data_td = data_td?.data[0];
                    entry = {
                        open: data_td.open,
                        close: data_td.close,
                        low: data_td.low,
                        high: data_td.high
                    };
                    response['td-' + trailing_day].ticker = entry;

                    // Volume Data
                    data_td = await sql_volume(ticker, await subtractBusinessDays(date, trailing_day).format('YYYY-MM-DD'));
                    data_td = data_td?.data[0];
                    entry = {
                        count: data_td.count,
                        ma5: data_td.ma5,
                        ma10: data_td.ma10,
                        ma20: data_td.ma20
                    };
                    response['td-' + trailing_day].volume = entry;

                    // Digital Noise Data
                    data_td = await sql_digital_noise(ticker, await subtractBusinessDays(date, trailing_day).format('YYYY-MM-DD'));
                    data_td = data_td?.data[0];
                    entry = {
                        count: data_td.count,
                        peak: data_td.peak
                    };
                    response['td-' + trailing_day].digital_noise = entry;

                    break;
                default:
                    break;
            }
        }

    } catch (e) {
        console.log(e);

        response = {
            status: 500,
            error: e
        };
    } finally {
        await mysql.end();
        await mysql.quit();
    }

    console.timeEnd('fetch_working_data');

    return response;
}

async function signal_test(query, ticker, sources) {

    console.time('signal_test');

    let response = {};
    let all_data = [];

    try {

        // This query will need to be added to as we have additional data sources to work with
        let sql_data = await mysql.query(
            `  select
                        h.\`open\`, h.\`close\`, h.\`high\`, h.\`low\`, 
                        concat(h.\`year\`, '-', h.\`month\`, '-', h.\`day\`) as \`date\`,
                        h.\`volume\` as volume_count,
                        (select FLOOR(AVG(items.\`volume\`)) from ( select \`volume\` from historical where FROM_UNIXTIME(\`date\`) <= DATE_SUB(FROM_UNIXTIME(h.\`date\`), INTERVAL 1 DAY) AND \`ticker\` = h.\`ticker\` ORDER BY \`date\` DESC Limit 5) as items) as \`ma5\`, 
                        (select FLOOR(AVG(items.\`volume\`)) from ( select \`volume\` from historical where FROM_UNIXTIME(\`date\`) <= DATE_SUB(FROM_UNIXTIME(h.\`date\`), INTERVAL 1 DAY) AND \`ticker\` = h.\`ticker\` ORDER BY \`date\` DESC Limit 10) as items) as \`ma10\`, 
                        (select FLOOR(AVG(items.\`volume\`)) from ( select \`volume\` from historical where FROM_UNIXTIME(\`date\`) <= DATE_SUB(FROM_UNIXTIME(h.\`date\`), INTERVAL 1 DAY) AND \`ticker\` = h.\`ticker\` ORDER BY \`date\` DESC Limit 30) as items) as \`ma20\`,
                        dn.\`value\` as dn_count,
                        dn.\`signal\` as dn_peak
                    from
                        historical h
                    left join digital_noise dn on 
                        dn.\`year\` = h.\`year\`
                    AND
                        dn.\`month\` = h.\`month\`
                    AND
                        dn.\`day\` = h.\`day\`
                    AND
                        dn.\`ticker\` = h.\`ticker\`
                    where 
                        h.\`ticker\` = ?
                    order by h.\`date\` asc
                `,
            [
                ticker
            ]);

        let indicators = [];
        for (let z = 0; z < sql_data.length; z++) {
            if (!!sql_data[z].close) {
                indicators.push(sql_data[z]);
            }
        }

        for (let y = 0; y < indicators.length; y++) {       // Iterate through the list and create an array of "todays"

            let current_day = {
                "ticker": ticker,
                "date": indicators[y].date,
                "now": {
                    "ticker": {
                        open: indicators[y].open,
                        close: indicators[y].close,
                        low: indicators[y].low,
                        high: indicators[y].high
                    },
                    "volume": {
                        "count": indicators[y].volume_count,
                        "ma5": indicators[y].ma5,
                        "ma10": indicators[y].ma10,
                        "ma20": indicators[y].ma20
                    },
                    "digital_noise": {
                        "count": Number(indicators[y].dn_count),
                        "peak": indicators[y].dn_peak
                    }
                }
            };

            let trailing_days = (y > 6) ? 7 : y;        // If this is in the first 6 entries, use the entry number - otherwise 7
            for (let a = 1; a < trailing_days; a++) {   // Iterate through the 7(ish) trailing days' data
                if (!!indicators[y - a].close) {        // Use the number 'a' to find the correct value in the array
                    current_day['td-' + a] = {          // Now, use the same 'a' as a string to create a new node in the json object
                        "date": indicators[y - a].date,
                        "ticker": {
                            open: indicators[y - a].open,
                            close: indicators[y - a].close,
                            low: indicators[y - a].low,
                            high: indicators[y - a].high
                        },
                        "volume": {
                            "count": indicators[y - a].volume_count,
                            "ma5": indicators[y - a].ma5,
                            "ma10": indicators[y - a].ma10,
                            "ma20": indicators[y - a].ma20
                        },
                        "digital_noise": {
                            "count": Number(indicators[y - a].dn_count),
                            "peak": indicators[y - a].dn_peak
                        }
                    };
                }
            }

            all_data.push(current_day);
        }

        // Next loop to run the signal test on each day
        let signal_data = [];
        for (let b = 0; b < all_data.length; b++) {
            let entry = {
                "date": all_data[b].date,
                "signal": jsonLogic.apply(JSON.parse(query), all_data[b])
            };
            signal_data.push(entry);
        }

        response = {
            status: 200,
            data: signal_data
        };

    } catch (e) {
        console.log(e);

        response = {
            status: 500,
            error: e
        };
    } finally {
        await mysql.end();
        await mysql.quit();
    }

    console.log(util.inspect(response, {showHidden: false, depth: null, colors: true}));
    console.timeEnd('signal_test');
    return response;
}

export const stocks = {
    list_stocks: () => fetch_stocks_list(),
    get_indicators: (ticker) => fetch_stocks_indicators(ticker),
    get_signal_raw_data: (ticker, date, sources) => fetch_working_data(ticker, date, sources),
    signal_test: (query, ticker, sources) => signal_test(query, ticker, sources)
};
