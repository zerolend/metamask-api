import express from "express";
import bodyParser from "body-parser";
import * as http from "http";
import nconf from "nconf";
import cors from "cors";
import cron from "node-cron";

import { apy, zeroPrice } from "./protocols/zerolend";
import { getApy } from "./protocols/aave-v2";
import routes from "./routes";

const app = express();
const server = new http.Server(app);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(routes);

cron.schedule("*/30 * * * *", async () => {
  console.log("update metrics every 30 mins");
  await zeroPrice();
});

cron.schedule("*/5 * * * *", async () => {
  console.log("fetch updated pools data every 5 mins");
  await apy();
});
zeroPrice();
apy();
// getApy();
// protocolPoints();
// calculateCirculatingSupply();

app.set("port", nconf.get("PORT") || 5004);
const port = app.get("port");
server.listen(port, () => console.log(`Server started on port ${port}`));
