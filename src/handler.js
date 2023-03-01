/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: MIT-0
 */

const AWS = require('aws-sdk')
AWS.config.region = process.env.AWS_REGION;
const s3 = new AWS.S3({apiVersion: '2006-03-01'});
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});
const chromium = require('chrome-aws-lambda');

const pageURL = process.env.TARGET_URL
const agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36'

// Fetch the messages from SQS
async function getMessages() {

  console.log((""+process.env.QUEUE_URL).toString());


  // pull the message off the queue
  const params = {
    QueueUrl: (""+process.env.QUEUE_URL).toString(),
    MaxNumberOfMessages: 1
  };
  const { Messages } = await sqs.receiveMessage(params).promise();

  console.log(Messages);

  let result;
  if (Messages && Messages.length > 0) {      // if there is a message, process it and remove it from the queue
    const params = {
      QueueUrl: (""+process.env.QUEUE_URL).toString(),
      ReceiptHandle: Messages[0]['ReceiptHandle']
    };
    await sqs.deleteMessage(params).promise();
    result = {
      status: 200,
      data: JSON.parse(Messages[0].Body)
    };
  } else {
    result = {
      status: 400,
      data: 'problem fetching messages'
    };
  }

  return result;
}

exports.handler = async (event, context) => {

  let result = null;
  let browser = null;

  try {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    let page = await browser.newPage();
    await page.setUserAgent(agent)

    console.log('Navigating to page: ', pageURL)

    await page.goto(pageURL)
    // const buffer = await page.screenshot()
    // result = await page.title()

    result = [
      {
        title: await page.title(),
        message: await getMessages()
      }
    ]

    console.log(result);

    // upload the image using the current timestamp as filename
    const s3result = await s3
      .upload({
        Bucket: process.env.S3_BUCKET,
        Key: `${Date.now()}.json`,
        Body: JSON.stringify(result),
        ContentType: 'application/json',
        ACL: 'public-read'
      })
      .promise()

    console.log('S3 json URL:', s3result.Location)

    await page.close();
    await browser.close();

  } catch (error) {
    console.log(error)
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }

  return result
}
