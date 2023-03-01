const AWS = require("aws-sdk");
AWS.config.region = process.env.AWS_REGION;
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});
const { v4: uuidv4 } = require("uuid");
const mysql = require('mysql2')({
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

exports.handler = async (event, context) => {
  console.log(event);
  console.log(process.env.QUEUE_URL);

  // let stock_list = [
  //   {
  //     ticker: "BLMN",
  //     name: "Bloomin' Brands, Inc.",
  //     exchange: "NASDAQ"
  //   }
  // ]

  let stock_list = [];
  try {
    let value = await fetch_stocks_list();
    console.log(value);
    if (value.status === 200) {
      stock_list = value.data;
    }
  } catch (e) {
    console.error(e);
    return {"statusCode": 501, "body": e};
  }

  console.log(stock_list);

  // for (let x = 0; x < stock_list.length; x++) {
  //   // Structure the message for SQS
  //   let message = {
  //     ticker: stock_list[x].ticker.toString().toUpperCase(),
  //     company_name: stock_list[x].name || stock_list[x].ticker.toString().toUpperCase(),
  //     exchange: stock_list[x].exchange.toString().toUpperCase()
  //   };
  //   // SQS message parameters
  //   const params = {
  //     MessageBody: JSON.stringify(message),
  //     QueueUrl: process.env.QUEUE_URL,
  //     MessageGroupId: (await uuidv4()),
  //     MessageDeduplicationId: (await uuidv4())
  //   };
  //   await sqs.sendMessage(params).promise().then(
  //       function (data) {
  //         console.info("data:", data);
  //       }
  //   );
  // }

  let response = null;
  try {
    response = {
      'statusCode': 200,
      'body': JSON.stringify({
        stock_list
      })
    }
  } catch (err) {
    console.log(err);
    return err;
  }

  return response;
}
