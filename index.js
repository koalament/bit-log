const bitcoin = require('bitcoinjs-lib');
const watcher = require('socket.io-client')(process.env.WATCHER_HOST);
const mongo = require("mongodb");
const consoleLogger = require("tracer").colorConsole({ level: process.env.LOG_LEVEL });
const express = require('express')
const MongoClient = mongo.MongoClient;

let timeCollection = null;

const app = express()
function initExpress() {
  app.get('/time/tx/:txid', function (req, res) {
    timeCollection.findOne({ _id: req.params.txid }, (err, tx) => {
      if (err) {
        res.sendStatus(404);

        return;
      }
      res.send({ txid: tx._id, seen_on: tx.created_at });
    })
  })

  app.listen(parseInt(process.env.EXPRESS_PORT));
}

function onNewTransaction(hex) {
  const createdAt = new Date();
  let decodedTx = undefined;
  try {
    decodedTx = bitcoin.Transaction.fromHex(hex);
  } catch (e) {
    consoleLogger.error(e);
  }
  if (!decodedTx) {
    return;
  }
  const txid = decodedTx.getId()
  consoleLogger.info({ _id: txid, created_at: createdAt })
  timeCollection.insertOne({ _id: txid, created_at: createdAt }, (err) => {
    if (err) {
      consoleLogger.error(err);
    }
  })
}

MongoClient.connect(process.env.MONGO_BIT_LOG_STORE, { useUnifiedTopology: true }, function (err, client) {
  if (err) {
    throw err;
  }
  console.log("Connected successfully to server");
  const db = client.db('bitlog');
  timeCollection = db.collection("time");

  initExpress();
  watcher.on("tx:*", (hex) => {
    onNewTransaction(hex);
  })
});


